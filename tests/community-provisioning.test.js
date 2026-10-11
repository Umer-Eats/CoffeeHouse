'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {databaseFixture} = require('./database-fixture.cjs');
const {provisioningConfig, createSchoolDatabase, checkCommunityConfiguration} = require('../community-databases');

async function withEnvironment(values, run) {
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  const originalFetch = global.fetch;
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  try { await run(); }
  finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
const platform = {TURSO_MULTI_DB_MODE: 'platform', TURSO_API_TOKEN: 'test-platform-secret', TURSO_ORG_NAME: 'test-org', TURSO_DB_GROUP: 'test-group'};
const response = (status, body) => ({ok: status >= 200 && status < 300, status, json: async () => body});

test('auto-selects persistent hosting and reports missing provisioning credentials without leaking secrets', async () => {
  await withEnvironment({...platform, TURSO_MULTI_DB_MODE: '', VERCEL: '1', TURSO_API_TOKEN: '', TURSO_ORG_NAME: '', TURSO_DATABASE_URL: ''}, async () => {
    assert.throws(provisioningConfig, {code: 'COMMUNITY_CONFIG_MISSING', status: 503});
    process.env.TURSO_API_TOKEN = 'test-platform-secret';
    assert.throws(provisioningConfig, error => error.message.includes('TURSO_ORG_NAME') && !error.message.includes('test-platform-secret'));
    process.env.TURSO_ORG_NAME = 'test-org';
    assert.equal(provisioningConfig().mode, 'platform');
    process.env.TURSO_MULTI_DB_MODE = 'local';
    assert.throws(provisioningConfig, {code: 'COMMUNITY_CONFIG_INVALID'});
    process.env.VERCEL = ''; process.env.TURSO_MULTI_DB_MODE = ''; process.env.TURSO_DATABASE_URL = 'libsql://main.example.test';
    assert.equal(provisioningConfig().mode, 'platform');
  });
});

test('deployment check verifies platform access and the existing group without any writes', async () => {
  await withEnvironment(platform, async () => {
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({url, options});
      return response(200, {groups: [{name: 'test-group'}]});
    };
    assert.deepEqual(await checkCommunityConfiguration(), {mode: 'platform'});
    assert.equal(calls.length, 1); assert.equal(calls[0].options.method, 'GET');
    assert.match(calls[0].url, /\/organizations\/test-org\/groups$/);
    process.env.TURSO_DB_GROUP = 'missing-group';
    await assert.rejects(checkCommunityConfiguration(), {code: 'COMMUNITY_PROVIDER_CONFIG'});
  });
});

test('provider failures return safe actionable errors and interrupted provisioning resumes on conflict', async () => {
  await withEnvironment(platform, async () => {
    for (const [status, code] of [[401, 'COMMUNITY_PROVIDER_AUTH'], [403, 'COMMUNITY_PROVIDER_AUTH'], [400, 'COMMUNITY_PROVIDER_CONFIG'], [404, 'COMMUNITY_PROVIDER_CONFIG'], [429, 'COMMUNITY_PROVIDER_ERROR'], [500, 'COMMUNITY_PROVIDER_ERROR']]) {
      global.fetch = async () => response(status, {error: 'private provider payload'});
      await assert.rejects(createSchoolDatabase(42), error => {
        assert.equal(error.code, code); assert.equal(error.status, 503); assert.equal(error.providerStatus, status);
        assert.ok(!JSON.stringify(error).includes('test-platform-secret'));
        assert.ok(!error.message.includes('private provider payload'));
        return true;
      });
    }
    global.fetch = async () => { throw Error('private network diagnostic'); };
    await assert.rejects(createSchoolDatabase(42), {code: 'COMMUNITY_PROVIDER_UNREACHABLE'});
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({url, options});
      if (calls.length === 1) return response(409, {error: 'already exists'});
      return response(200, url.includes('/auth/tokens') ? {jwt: 'db-secret'} : {database: {Hostname: 'school.example.test'}});
    };
    assert.deepEqual(await createSchoolDatabase(42), {url: 'libsql://school.example.test', authToken: 'db-secret'});
    assert.equal(calls.length, 3); assert.equal(calls[1].options.method, 'GET');
    assert.match(calls[1].url, /\/databases\/coffeehouse-school-42$/);
    assert.equal(JSON.parse(calls[0].options.body).group, 'test-group');
  });
});

test('missing configuration reserves nothing; failed provisioning preserves membership and retries the same name', async () => {
  const {db, close} = await databaseFixture();
  try {
    const user = await db.upsertUser({sub: 'retry-owner', email: 'retry@example.test', name: 'Retry'});
    await db.setUserSchool(user.id, 1);
    await withEnvironment({...platform, TURSO_API_TOKEN: ''}, async () => {
      await assert.rejects(db.createCommunity(user.id, 'Retry group', 'long password'), {code: 'COMMUNITY_CONFIG_MISSING'});
      assert.equal(await db.get('SELECT id FROM schools WHERE name=?', 'Retry group'), null);
      process.env.TURSO_API_TOKEN = platform.TURSO_API_TOKEN;
      global.fetch = async () => response(401, {});
      await assert.rejects(db.createCommunity(user.id, 'Retry group', 'long password'), {code: 'COMMUNITY_PROVIDER_AUTH'});
      const failed = await db.get('SELECT id,status FROM schools WHERE name=?', 'Retry group');
      assert.equal(failed.status, 'failed');
      assert.equal((await db.getUserSchool(user.id)).id, 1);
      await withEnvironment({TURSO_MULTI_DB_MODE: 'local', VERCEL: '', COFFEEHOUSE_DATA_DIR: path.dirname((await db.get('SELECT db_url FROM schools WHERE id=1')).db_url.slice(5))}, async () => {
        const result = await db.createCommunity(user.id, 'Retry group', 'long password');
        assert.equal(result.id, failed.id);
        assert.equal((await db.getUserSchool(user.id)).id, result.id);
        assert.equal((await db.get('SELECT status FROM schools WHERE id=?', result.id)).status, 'ready');
      });
    });
  } finally { await close(); }
});
