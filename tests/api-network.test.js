const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function apiWith(fetch) {
  const ctx=vm.createContext({fetch,AbortController,setTimeout,clearTimeout,TypeError});
  const code=fs.readFileSync(require.resolve('../public/app.js'),'utf8').split('function esc(s)')[0];
  vm.runInContext(code,ctx);
  return ctx.api;
}
test('browser deadline cancels stalled AI fetch',async()=>{
  let signal;
  const api=apiWith((_,opts)=>new Promise((_,reject)=>{
    signal=opts.signal;signal.addEventListener('abort',()=>reject(new Error('Aborted')));
  }));
  await assert.rejects(api('/api/ai/baristi',{timeout:5}),/timed out/);
  assert.equal(signal.aborted,true);
});
test('browser deadline covers stalled response bodies too',async()=>{
  const api=apiWith(async(_,opts)=>({ok:true,json:()=>new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('Aborted'))))}));
  await assert.rejects(api('/api/ai/brewer',{timeout:5}),/timed out/);
});
test('browser reports network failure and non-JSON hosting errors',async()=>{
  await assert.rejects(apiWith(async()=>{throw new TypeError('Failed to fetch');})('/api/ai/brewer'),/Could not reach/);
  await assert.rejects(apiWith(async()=>({ok:false,status:504,statusText:'Gateway Timeout',json:async()=>{throw Error('HTML');}}))('/api/ai/baristi'),/504/);
});
