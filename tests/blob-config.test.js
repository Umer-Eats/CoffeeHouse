const test = require('node:test');
const assert = require('node:assert/strict');
const {blobToken} = require('../blob-config');

test('resolves the configured custom-prefix credential', () => {
  assert.equal(blobToken({}), '');
  assert.equal(blobToken({BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN:' prefixed '}), 'prefixed');
  assert.equal(blobToken({BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN:' '}), '');
  assert.equal(blobToken({BLOB_READ_WRITE_TOKEN_STORE_ID:'store_example'}), '');
});
