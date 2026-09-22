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
const privateUrl='https://test.private.blob.vercel-storage.com/coffeehouse-brewer/test.pdf';
const privateToken='vercel_blob_rw_test_test-only-secret';
test('private PDF reads authenticate only to the configured store',async()=>{
  const result=await resolveAttachments([{mimeType:pdf.mimeType,url:privateUrl}],{
    token:privateToken,deleteBlob:async()=>{},fetchImpl:async(url,opts)=>{
      assert.equal(url,privateUrl);
      assert.equal(opts.headers.authorization,'Bearer '+privateToken);
      assert.equal(opts.redirect,'error');
      return new Response(Buffer.from(pdf.data,'base64'));
    }
  });
  assert.deepEqual(result,[pdf]);
});
test('private files reject missing credentials and foreign stores before download',async()=>{
  for(const token of ['', 'vercel_blob_rw_other_test-only-secret']) {
    await assert.rejects(resolveAttachments([{mimeType:pdf.mimeType,url:privateUrl}],{
      token,fetchImpl:()=>{assert.fail('Must not transmit credentials');},deleteBlob:async()=>{}
    }), /not configured|different store/);
  }
});
test('both assistants resolve a full 20 MiB private PDF; larger files are rejected',async()=>{
  const bytes=Buffer.alloc(20*1024*1024,32);bytes.write('%PDF-1.4\n');
  for(const kind of ['barista','brewer']) {
    const url=privateUrl.replace('coffeehouse-brewer','coffeehouse-'+kind);
    const result=await resolveAttachments([{mimeType:'application/pdf',url}],{
      token:privateToken,deleteBlob:async()=>{},fetchImpl:async()=>new Response(bytes)
    });
    assert.equal(Buffer.from(result[0].data,'base64').length,bytes.length);
  }
  await assert.rejects(resolveAttachments([{mimeType:'application/pdf',url:privateUrl}],{
    token:privateToken,deleteBlob:async()=>{},fetchImpl:async()=>new Response(Buffer.alloc(bytes.length+1))
  }),/too large/);
});
