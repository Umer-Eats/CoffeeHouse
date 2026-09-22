const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createBlobUploadHandler } = require('../blob-upload-handler');

function browser() {
  const calls = [];
  const window = { CoffeeHouseBlobClient: { upload: async (...args) => { calls.push(args); return { url: 'https://example.public.blob.vercel-storage.com/file.pdf' }; } } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/blob-upload.js'), 'utf8'), { window, Blob, Uint8Array, atob, btoa, setTimeout, clearTimeout, AbortController });
  return { calls, helper: window.VercelBlob };
}

test('10 MB PDF goes directly to Blob as binary, never base64 JSON through the server', async () => {
  const { calls, helper } = browser();
  const pdf = new Blob([new Uint8Array(10 * 1024 * 1024)], { type: 'application/pdf' });
  const result = await helper.upload(pdf, { prefix: 'coffeehouse-brewer' });
  assert.ok(result.url);
  assert.equal(calls[0][1], pdf);
  assert.equal(calls[0][2].multipart, undefined);
  assert.equal(calls[0][2].handleUploadUrl, '/api/blob/upload');
  assert.match(calls[0][0], /^coffeehouse-brewer\/.*\.pdf$/);
});

test('image base64 is decoded into binary for direct uploads', async () => {
  const { calls, helper } = browser();
  await helper.uploadBase64({ mimeType: 'image/jpeg', data: Buffer.from('image bytes').toString('base64') });
  assert.equal(await calls[0][1].text(), 'image bytes');
  assert.equal(calls[0][2].contentType, 'image/jpeg');
});

test('oversized and unsupported files are rejected before upload', async () => {
  const { calls, helper } = browser();
  await assert.rejects(helper.upload(new Blob([new Uint8Array(20 * 1024 * 1024 + 1)], { type: 'application/pdf' })), /20 MB/);
  await assert.rejects(helper.upload(new Blob(['html'], { type: 'text/html' })), /File type/);
  assert.equal(calls.length, 0);
});

async function authorize(user, pathname) {
  let options;
  const handler = createBlobUploadHandler({
    sessionUser: async cookie => cookie === 'valid-session' ? user : null,
    handleUpload: async config => { options = await config.onBeforeGenerateToken(pathname); return { clientToken: 'restricted-token' }; },
  });
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await handler({ cookies: { ch_session: 'valid-session' }, body: {} }, res);
  return { res, options };
}

test('token issuance requires a valid session and constrains PDF type, size and expiry', async () => {
  assert.equal((await authorize(null, 'coffeehouse-brewer/file.pdf')).res.code, 401);
  const { res, options } = await authorize({ id: 1 }, 'coffeehouse-brewer/file.pdf');
  assert.equal(res.code, 200);
  assert.deepEqual(options.allowedContentTypes, ['application/pdf']);
  assert.equal(options.maximumSizeInBytes, 20 * 1024 * 1024);
  assert.equal(options.allowOverwrite, false);
  assert.ok(options.validUntil > Date.now());
  assert.ok(options.validUntil <= Date.now() + 600000);
});

test('token issuance rejects arbitrary paths and unsupported extensions', async () => {
  for (const pathname of ['elsewhere/file.pdf', 'coffeehouse-brewer/../file.pdf', 'coffeehouse-brewer/file.html']) {
    assert.equal((await authorize({ id: 1 }, pathname)).res.code, 400);
  }
});

test('images and small PDFs use inline data without calling Blob', async () => {
  const {calls,helper}=browser();
  const img={mimeType:'image/jpeg',data:'YWJj'};
  const result=await helper.prepareAttachments([img],new Blob(['%PDF-1.4 test'],{type:'application/pdf'}));
  assert.equal(result[0].data,img.data);
  assert.equal(Buffer.from(result[1].data,'base64').toString(),'%PDF-1.4 test');
  assert.equal(calls.length,0);
});
test('large PDFs keep the binary direct-upload path', async () => {
  const {calls,helper}=browser();
  const result=await helper.prepareAttachments([],new Blob([new Uint8Array(1024*1024)],{type:'application/pdf'}));
  assert.equal(calls.length,1);
  assert.ok(result[0].url);
  assert.equal(result[0].data,undefined);
});
