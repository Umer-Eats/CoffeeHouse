/* Image attachments stay local until Ask/Brew. Clipboard access uses paste only. */
'use strict';
(function () {
  const INPUT_LIMIT = 10 * 1024 * 1024;
  const OUTPUT_LIMIT = 1024 * 1024;
  async function prepare(file) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG, or WebP image.');
    if (!file.size || file.size > INPUT_LIMIT) throw new Error('Choose an image smaller than 10 MB.');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve,reject) => { image.onload=resolve; image.onerror=()=>reject(new Error('This image cannot be opened. Try a different image.')); image.src=url; });
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth*image.naturalHeight > 25000000) throw new Error('This image is too large. Use a screenshot or a smaller copy.');
      const canvas = document.createElement('canvas');
      const scale = Math.min(1,2000/Math.max(image.naturalWidth,image.naturalHeight));
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const ctx=canvas.getContext('2d');
      if (!ctx) throw new Error('Your browser could not prepare the image.');
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      // Re-encoding removes original metadata and keeps the request below host limits.
      for (const quality of [.9,.8,.7,.6]) {
        const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
        if (!blob) throw new Error('This image could not be prepared.');
        if (blob.size <= OUTPUT_LIMIT) {
          const data = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Image reading failed.'));reader.readAsDataURL(blob);});
          return {mimeType:'image/jpeg',data,name:file.name || 'Pasted image'};
        }
      }
      throw new Error('This image is too detailed to send. Crop it or use a smaller screenshot.');
    } finally { URL.revokeObjectURL(url); }
  }
  function create(prefix, panelId, submitId) {
    const picker=document.getElementById(prefix+'ImageInput');
    const button=document.getElementById(prefix+'ImageButton');
    const list=document.getElementById(prefix+'ImagePreview');
    const status=document.getElementById(prefix+'ImageStatus');
    const submit=document.getElementById(submitId);
    let images=[],busy=false,processing=false;
    function render() {
      button.disabled=picker.disabled=busy || processing;
      submit.disabled=busy || processing;
      list.replaceChildren();
      images.forEach((image,index)=>{
        const item=document.createElement('figure');item.className='image-attachment';
        const preview=document.createElement('img');preview.src='data:image/jpeg;base64,'+image.data;preview.alt='Attached image '+(index+1)+': '+image.name;
        const caption=document.createElement('figcaption');caption.textContent=image.name;
        const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.className='btn';remove.disabled=busy||processing;remove.setAttribute('aria-label','Remove image '+(index+1));
        remove.addEventListener('click',()=>{images.splice(index,1);status.textContent='Image removed.';render();button.focus();});
        item.append(preview,caption,remove);list.appendChild(item);
      });
    }
    async function add(files) {
      if(busy || processing) { status.textContent='Please wait for the current action to finish.'; return; }
      if(images.length+files.length>2) {status.textContent='You can attach up to two images. Remove one before adding more.';return;}
      processing=true;status.textContent='Preparing image…';render();
      try {
        const prepared=[];
        for(const file of files) prepared.push(await prepare(file));
        images.push(...prepared);
        status.textContent=images.length+' image'+(images.length===1?'':'s')+' ready. Press '+(prefix==='bar'?'Ask':'Brew notes')+' to send.';
      } catch(err) {status.textContent=err.message;}
      finally {processing=false;picker.value='';render();}
    }
    button.addEventListener('click',()=>picker.click());
    picker.addEventListener('change',()=>{const files=Array.from(picker.files || []);if(files.length) add(files);});
    document.getElementById(panelId).addEventListener('paste',event=>{
      const files=Array.from(event.clipboardData?.items || []).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean);
      if(files.length) {event.preventDefault();add(files);}
      // Plain text paste is deliberately untouched.
    });
    render();
    return {get:()=>images.map(image=>({...image})),ready:()=>!processing,
      setBusy(value){busy=value;render();},clear(){images=[];status.textContent='';render();}};
  }
  window.AIImages={create,prepare};
})();
