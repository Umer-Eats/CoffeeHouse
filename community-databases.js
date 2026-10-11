'use strict';
const {createClient} = require('@libsql/client');
const fs = require('node:fs');
const path = require('node:path');

const setupMessage = 'Community creation is not configured yet. Please ask the site owner to finish setup.';
function provisioningError(code, message, publicMessage = setupMessage, providerStatus) {
  return Object.assign(new Error(message), {code, status: 503, publicMessage, providerStatus});
}

function provisioningConfig() {
  const value = key => (process.env[key] || '').trim();
  const remoteMain = value('TURSO_DATABASE_URL') && !value('TURSO_DATABASE_URL').startsWith('file:');
  const mode = value('TURSO_MULTI_DB_MODE') || (remoteMain || process.env.VERCEL ? 'platform' : 'local');
  if (!['local', 'platform'].includes(mode)) {
    throw provisioningError('COMMUNITY_CONFIG_INVALID', 'TURSO_MULTI_DB_MODE must be local or platform.');
  }
  if (mode === 'local') {
    if (process.env.VERCEL) {
      throw provisioningError('COMMUNITY_CONFIG_INVALID', 'Set TURSO_MULTI_DB_MODE=platform on Vercel; local community files are not persistent.');
    }
    return {mode, directory: path.resolve(value('COFFEEHOUSE_DATA_DIR') || path.join(__dirname, 'data'))};
  }
  const missing = ['TURSO_API_TOKEN', 'TURSO_ORG_NAME'].filter(key => !value(key));
  if (missing.length) {
    throw provisioningError('COMMUNITY_CONFIG_MISSING', `Set ${missing.join(' and ')} in the server environment. TURSO_AUTH_TOKEN only accesses the main database and cannot provision communities.`);
  }
  return {mode, token: value('TURSO_API_TOKEN'), org: value('TURSO_ORG_NAME'), group: value('TURSO_DB_GROUP') || 'default'};
}

// Use the documented REST API directly; no dependency on a platform SDK version.
async function platformRequest(config, resource, method = 'GET', body) {
  let response;
  try {
    response = await fetch(`https://api.turso.tech/v1/organizations/${encodeURIComponent(config.org)}/${resource}`, {
      method, headers: {Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json'},
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw provisioningError('COMMUNITY_PROVIDER_UNREACHABLE', 'Could not reach the Turso Platform API.', 'Community setup could not reach the database service. Please try again shortly.');
  }
  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw provisioningError('COMMUNITY_PROVIDER_AUTH', 'Turso rejected provisioning access. Check TURSO_API_TOKEN (a Platform API token, not a database token) and access to TURSO_ORG_NAME.', setupMessage, status);
    }
    if (status === 400 || status === 404) {
      throw provisioningError('COMMUNITY_PROVIDER_CONFIG', 'Turso rejected the provisioning request. Check TURSO_ORG_NAME and that TURSO_DB_GROUP names an existing group.', setupMessage, status);
    }
    throw provisioningError('COMMUNITY_PROVIDER_ERROR', `Turso provisioning failed (HTTP ${status}, ${method} ${resource.split('?')[0]}). Check the organization database limits and service status.`, 'The database service could not finish community setup. Please try again later.', status);
  }
  try { return response.status === 204 ? null : await response.json(); }
  catch { throw provisioningError('COMMUNITY_PROVIDER_RESPONSE', 'Turso returned an invalid provisioning response.', 'The database service could not finish community setup. Please try again later.'); }
}

async function createSchoolDatabase(id) {
  const config = provisioningConfig();
  if (config.mode === 'local') {
    const {directory} = config;
    fs.mkdirSync(directory, {recursive: true});
    return {url: 'file:' + path.join(directory, `school-${id}.db`)};
  }
  const name = `coffeehouse-school-${id}`;
  let database;
  try {
    ({database} = await platformRequest(config, 'databases', 'POST', {name, group: config.group}));
  } catch (error) {
    // Resume an interrupted provisioning attempt using its durable index ID.
    if (error.providerStatus !== 409) throw error;
    ({database} = await platformRequest(config, `databases/${name}`));
  }
  const {jwt} = await platformRequest(config, `databases/${name}/auth/tokens?expiration=never&authorization=full-access`, 'POST');
  const hostname = database?.Hostname || database?.hostname;
  if (!hostname || !jwt) throw provisioningError('COMMUNITY_PROVIDER_RESPONSE', 'Turso returned incomplete database credentials.', 'The database service could not finish community setup. Please try again later.');
  return {url: `libsql://${hostname}`, authToken: jwt};
}

// Read-only deployment check: does not create a database or mint a token.
async function checkCommunityConfiguration() {
  const config = provisioningConfig();
  if (config.mode === 'platform') {
    const result = await platformRequest(config, 'groups');
    if (!result?.groups?.some(group => group.name === config.group)) {
      throw provisioningError('COMMUNITY_PROVIDER_CONFIG', 'TURSO_DB_GROUP does not name an existing group in TURSO_ORG_NAME. Run turso group list and set TURSO_DB_GROUP to the correct group.');
    }
  }
  return {mode: config.mode};
}

async function openSchoolDatabase(credentials, schema) {
  const client = createClient(credentials);
  try {
    // New remote databases may take a moment to accept connections.
    for (let attempt = 0; ; attempt++) {
      try { await client.execute('SELECT 1'); break; }
      catch (error) {
        if (attempt === 4 || credentials.url.startsWith('file:')) throw error;
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    await client.executeMultiple(schema);
    return client;
  } catch (error) { client.close(); throw error; }
}
module.exports = {createSchoolDatabase, openSchoolDatabase, provisioningConfig, checkCommunityConfiguration};
