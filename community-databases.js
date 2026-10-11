'use strict';
const {createClient} = require('@libsql/client');
const fs = require('node:fs');
const path = require('node:path');

// Use the documented REST API directly; no dependency on a platform SDK version.
async function platformRequest(resource, method = 'GET', body) {
  if (!process.env.TURSO_API_TOKEN || !process.env.TURSO_ORG_NAME) {
    throw new Error('Set TURSO_API_TOKEN and TURSO_ORG_NAME for platform mode.');
  }
  const response = await fetch(`https://api.turso.tech/v1/organizations/${encodeURIComponent(process.env.TURSO_ORG_NAME)}/${resource}`, {
    method, headers: {Authorization: `Bearer ${process.env.TURSO_API_TOKEN}`, 'Content-Type': 'application/json'},
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Turso provisioning failed (${response.status}).`);
  return response.status === 204 ? null : response.json();
}

async function createSchoolDatabase(id) {
  const remoteMain=process.env.TURSO_DATABASE_URL && !process.env.TURSO_DATABASE_URL.startsWith('file:');
  const mode = process.env.TURSO_MULTI_DB_MODE || (remoteMain || process.env.VERCEL ? 'platform' : 'local');
  if (!['local', 'platform'].includes(mode)) throw new Error('TURSO_MULTI_DB_MODE must be local or platform.');
  if (mode === 'local') {
    if (process.env.VERCEL) throw new Error('Local community databases need persistent storage; use platform mode on Vercel.');
    const directory = path.resolve(process.env.COFFEEHOUSE_DATA_DIR || path.join(__dirname, 'data'));
    fs.mkdirSync(directory, {recursive: true});
    return {url: 'file:' + path.join(directory, `school-${id}.db`)};
  }
  const name = `coffeehouse-school-${id}`;
  let database;
  try {
    ({database} = await platformRequest('databases', 'POST', {name, group: process.env.TURSO_DB_GROUP || 'default'}));
  } catch (error) {
    // Resume an interrupted provisioning attempt using its durable index ID.
    if (!error.message.includes('(409)')) throw error;
    ({database} = await platformRequest(`databases/${name}`));
  }
  const {jwt} = await platformRequest(`databases/${name}/auth/tokens?expiration=never&authorization=full-access`, 'POST');
  const hostname = database.Hostname || database.hostname;
  if (!hostname || !jwt) throw new Error('Turso returned incomplete database credentials.');
  return {url: `libsql://${hostname}`, authToken: jwt};
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
module.exports = {createSchoolDatabase, openSchoolDatabase};
