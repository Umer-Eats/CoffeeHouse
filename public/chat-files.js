'use strict';
window.ChatFiles=(()=>{
  let file=null,busy=false;
  const input=document.getElementById('chatFileInput'),status=document.getElementById('chatFileStatus'),remove=document.getElementById('chatFileRemove'),button=document.getElementById('chatFileButton');
  async function add(files){
    if(busy)return;
    if(files.length!==1){status.textContent='Attach one file at a time.';return;}
    busy=true;status.textContent='Preparing file…';
    try{
      const source=files[0];
      if(source.type==='application/pdf'){
        if(!source.size || source.size>1048576)throw Error('PDFs must be 1 MB or smaller.');
        const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(source);});
        file={name:source.name,mimeType:source.type,data};
      }else file=await AIImages.prepare(source);
      status.textContent=file.name+' ready to send';remove.hidden=false;
    }catch(err){status.textContent=err.message||'Could not read this file.';}
    finally{busy=false;input.value='';}
  }
  button.addEventListener('click',()=>input.click());
  input.addEventListener('change',()=>{if(input.files.length)add(Array.from(input.files));});
  document.getElementById('msgInput').addEventListener('paste',event=>{
    const files=Array.from(event.clipboardData?.files||[]);
    if(files.length){event.preventDefault();add(files);}
  });
  function clear(){file=null;status.textContent='';remove.hidden=true;}
  remove.addEventListener('click',()=>{if(!busy)clear();});
  return {get:()=>file,ready:()=>!busy,clear,setBusy(value){busy=value;button.disabled=input.disabled=remove.disabled=value;}};
})();
