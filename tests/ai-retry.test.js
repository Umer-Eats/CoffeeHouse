const test=require('node:test');
const assert=require('node:assert/strict');
const {withRetry}=require('../ai-retry');
test('retries temporary failures then returns the answer',async()=>{
  let calls=0;const delays=[];
  assert.equal(await withRetry(async()=>{if(++calls<3)throw {status:503};return 'Answer';},async ms=>delays.push(ms)),'Answer');
  assert.equal(calls,3);assert.equal(delays.length,2);assert.ok(delays[1]>delays[0]);
});
test('caps retries and does not retry configuration errors',async()=>{
  for(const status of [503,401]){
    let calls=0;
    await assert.rejects(withRetry(async()=>{calls++;throw Object.assign(Error('Unavailable'),{status});},async()=>{}));
    assert.equal(calls,status===503?3:1);
  }
});
