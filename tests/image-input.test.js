'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {validateImages,inputText,MAX_BYTES}=require('../image-input');
// Minimal SOF header fixture for structural validation, not a decoded picture.
function fixture(width=100,height=100) {
  const b=Buffer.from([255,216,255,192,0,11,8,0,0,0,0,1,1,17,0,255,217]);
  b.writeUInt16BE(height,7);b.writeUInt16BE(width,9);
  return {mimeType:'image/jpeg',data:b.toString('base64')};
}
test('image validation allows bounded JPEG payloads and image-free requests',()=>{
  assert.deepEqual(validateImages(undefined),[]);
  assert.equal(validateImages([fixture(),fixture()]).length,2);
  assert.equal(inputText(undefined,20,'Question'),'');
});
test('image validation rejects wrong types, corrupt data, huge images and excess attachments',()=>{
  for(const bad of [null,{},[fixture(),fixture(),fixture()],[{mimeType:'image/svg+xml',data:'abc'}],[{mimeType:'image/jpeg',data:'<script>'}],[{mimeType:'image/jpeg',data:'YWJj'}],[fixture(2500,10)],[fixture(0,10)],[{mimeType:'image/jpeg',data:'A'.repeat(MAX_BYTES*2)}]]) {
    assert.throws(()=>validateImages(bad),error=>error.status===400);
  }
  assert.throws(()=>inputText(123,20,'Question'),/must be text/);
  assert.throws(()=>inputText('abc',2,'Question'),/too long/);
});
test('Barista and Brewer pass inline images to the model alongside text',async()=>{
  const requests=[];
  const context=vm.createContext({module:{exports:{}},process:{env:{BARISTA_API_KEY:'test-only',BREWER_API_KEY:'test-only'}},
    require(name){
      if(name==='dotenv') return {config(){}};
      if(name==='@google/generative-ai') return {GoogleGenerativeAI:class {getGenerativeModel(){return {generateContent:async request=>{requests.push(request);return {response:{text:()=> 'Analysis from test double'}};}};}}};
      throw new Error('Unexpected dependency');
    }});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../ai.js'),'utf8'),context);
  const api=context.module.exports;
  const images=[fixture()];
  await api.baristaReply('',images);
  await api.brewNotes('Worksheet','',images);
  for(const request of requests){
    assert.equal(request.contents[0].parts[1].inlineData.data,images[0].data);
    assert.equal(request.contents[0].parts[1].inlineData.mimeType,'image/jpeg');
    assert.ok(request.contents[0].parts[0].text.length>0);
    assert.match(request.systemInstruction,/do not invent unreadable/);
  }
  await api.baristaReply('Explain fractions');
  assert.equal(requests[2].contents[0].parts.length,1);
});
