const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function client(fetch,put) {
  const context={window:{},fetch,put};
  vm.runInNewContext(fs.readFileSync(require.resolve('../browser/blob-client.js'),'utf8').replace(/^import .*;\r?\n/,''),context);
  return context.window.CoffeeHouseBlobClient;
}
test('PDF authorization forwards cancellation, preserves binary data and uses the restricted token',async()=>{
  const controller=new AbortController();const file=new Blob(['%PDF-1.4']);let uploaded;
  const uploader=client(async(url,opts)=>{
    assert.equal(url,'/api/blob/upload');assert.equal(opts.signal,controller.signal);
    assert.equal(JSON.parse(opts.body).payload.pathname,'coffeehouse-brewer/test.pdf');
    return {ok:true,json:async()=>({clientToken:'restricted-token'})};
  },async(pathname,body,opts)=>{assert.equal(body,file);assert.equal(opts.token,'restricted-token');assert.equal(opts.abortSignal,controller.signal);uploaded=true;return {url:'uploaded'};});
  await uploader.upload('coffeehouse-brewer/test.pdf',file,{handleUploadUrl:'/api/blob/upload',abortSignal:controller.signal});
  assert.equal(uploaded,true);
});
test('missing storage configuration and expired sessions reach the UI unchanged',async()=>{
  for(const message of ['Sign in required.','Large PDF uploads are not configured.']){
    const uploader=client(async()=>({ok:false,json:async()=>({error:message})}),()=>{throw Error('Must not upload');});
    await assert.rejects(uploader.upload('file.pdf',new Blob([]),{}),e=>e.message===message);
  }
});
