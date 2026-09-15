'use strict';
const {validateImages}=require('./image-input');
function validateAttachment(file) {
  if (file === undefined || file === null) return null;
  const fail=()=>{throw Object.assign(Error('Use a PDF up to 1 MB or a JPEG/PNG image.'),{status:400});};
  if(typeof file.data!=='string' || file.data.length>1398104 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data) || file.data.length%4) fail();
  const bytes=Buffer.from(file.data,'base64');
  if(!bytes.length || bytes.length>1048576) fail();
  if(file.mimeType==='application/pdf') {if(bytes.subarray(0,5).toString()!=='%PDF-')fail();}
  else if(file.mimeType==='image/jpeg') validateImages([file]);
  else fail();
  const name=String(file.name||'attachment').replace(/[\r\n"\\/<>]/g,'').slice(0,100);
  return {mimeType:file.mimeType,data:file.data,name};
}
module.exports={validateAttachment};
