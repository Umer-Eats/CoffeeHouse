'use strict';

// Vercel adds READ_WRITE_TOKEN to a custom integration prefix.
function blobToken(env = process.env) {
  return String(env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN || '').trim();
}

module.exports = {blobToken};
