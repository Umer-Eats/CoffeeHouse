const test = require('node:test');
const assert = require('node:assert/strict');
const {resolveAttachments} = require('../blob-helpers');
const pdf = {mimeType:'application/pdf', data:Buffer.from('%PDF-1.4\nTest').toString('base64')};
const url = 'https://test.public.blob.vercel-storage.com/coffeehouse-brewer/test.pdf';
test('inline PDFs bypass storage and retain their actual MIME type', async () => {
  assert.deepEqual(await resolveAttachments([pdf], {fetchImpl:()=>{throw Error('Unexpected download');}}), [pdf]);
});
test('PDF URLs resolve to validated bytes and cleanup runs', async () => {
  const deleted=[];
  assert.deepEqual(await resolveAttachments([{mimeType:pdf.mimeType,url}], {
    fetchImpl:async()=>new Response(Buffer.from(pdf.data,'base64')),deleteBlob:async url=>deleted.push(url)
  }), [pdf]);
  assert.deepEqual(deleted,[url]);
});
test('stalled attachment response bodies time out and abort the network', async () => {
  let signal;
  await assert.rejects(resolveAttachments([{mimeType:pdf.mimeType,url}], {
    timeout:10,deleteBlob:async()=>{},fetchImpl:async(_,opts)=>{signal=opts.signal;return {ok:true,body:{async *[Symbol.asyncIterator](){await new Promise(()=>{});}}};}
  }), /timed out/);
  assert.equal(signal.aborted,true);
});
test('invalid URLs, excess files, malformed images and fake PDFs fail before AI', async () => {
  for(const input of [null,{},[null],[{mimeType:'image/jpeg'}],[{...pdf,data:'YWJj'}],[pdf,pdf],[{mimeType:pdf.mimeType,url:'http://localhost/test.pdf'}],[{mimeType:pdf.mimeType,url:'https://evil.com/file.pdf'}]]) {
    await assert.rejects(resolveAttachments(input),e=>e.status===400);
  }
});
