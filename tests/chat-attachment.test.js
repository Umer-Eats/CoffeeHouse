const test=require('node:test');
const assert=require('node:assert/strict');
const {validateAttachment}=require('../chat-attachment');
test('accepts bounded PDF attachment and rejects invalid types and payloads',()=>{
  assert.equal(validateAttachment(undefined),null);
  const file={name:'worksheet.pdf',mimeType:'application/pdf',data:Buffer.from('%PDF-1.7\n%%EOF').toString('base64')};
  assert.equal(validateAttachment(file).name,'worksheet.pdf');
  assert.throws(()=>validateAttachment({...file,mimeType:'text/html'}));
  assert.throws(()=>validateAttachment({...file,data:Buffer.from('not a pdf').toString('base64')}));
  assert.throws(()=>validateAttachment({...file,data:'A'.repeat(1400000)}));
});
