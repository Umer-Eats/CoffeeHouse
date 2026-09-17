'use strict';
(() => {
  const launch=document.getElementById('notepadButton');
  if(!launch)return;
  const notes=new Map(),windows=new Map();
  let layer=100,library=null;
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  function button(text,label){const el=node('button','btn',text);el.type='button';el.setAttribute('aria-label',label||text);return el;}
  function bringFront(el){el.style.zIndex=++layer;}
  function floating(title,width,height,onClose){
    const el=node('section','notepad-window');el.setAttribute('role','dialog');el.setAttribute('aria-label',title);
    const header=node('div','notepad-handle');header.tabIndex=0;header.setAttribute('aria-label','Move '+title+' with arrow keys or drag');
    const label=node('span','notepad-caption',title),close=button('×','Close '+title);header.append(label,close);el.appendChild(header);
    const count=windows.size+(library?1:0);
    const bounds={x:Math.min(70+count*26,innerWidth/3),y:Math.min(95+count*26,innerHeight/3),w:width,h:height};
    function position(){
      bounds.w=Math.max(Math.min(250,innerWidth-16),Math.min(bounds.w,innerWidth-16));
      bounds.h=Math.max(Math.min(200,innerHeight-16),Math.min(bounds.h,innerHeight-16));
      bounds.x=Math.max(8,Math.min(bounds.x,innerWidth-bounds.w-8));bounds.y=Math.max(8,Math.min(bounds.y,innerHeight-bounds.h-8));
      Object.assign(el.style,{left:bounds.x+'px',top:bounds.y+'px',width:bounds.w+'px',height:bounds.h+'px'});
    }
    function pointer(handle,direction){
      handle.addEventListener('pointerdown',event=>{
        if(event.button!==0||event.target.closest('button'))return;
        event.preventDefault();bringFront(el);handle.setPointerCapture(event.pointerId);
        const start={...bounds,x0:event.clientX,y0:event.clientY};
        const move=e=>{
          const dx=e.clientX-start.x0,dy=e.clientY-start.y0;
          if(!direction){bounds.x=start.x+dx;bounds.y=start.y+dy;}
          else{
            if(direction.includes('e'))bounds.w=start.w+dx;
            if(direction.includes('s'))bounds.h=start.h+dy;
            if(direction.includes('w')){bounds.w=Math.max(Math.min(250,innerWidth-16),Math.min(start.w-dx,start.x+start.w-8));bounds.x=start.x+start.w-bounds.w;}
            if(direction.includes('n')){bounds.h=Math.max(Math.min(200,innerHeight-16),Math.min(start.h-dy,start.y+start.h-8));bounds.y=start.y+start.h-bounds.h;}
          }
          position();
        };
        const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);};
        handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
      });
    }
    pointer(header,'');
    header.addEventListener('keydown',event=>{
      if(event.target!==header||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();bounds.x+=event.key==='ArrowLeft'?-12:event.key==='ArrowRight'?12:0;bounds.y+=event.key==='ArrowUp'?-12:event.key==='ArrowDown'?12:0;position();
    });
    for(const direction of ['n','s','e','w','ne','nw','se','sw']){
      const grip=node('div','notepad-grip grip-'+direction);grip.setAttribute('aria-hidden','true');pointer(grip,direction);el.appendChild(grip);
    }
    el.addEventListener('pointerdown',()=>bringFront(el));
    el.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}});
    close.onclick=onClose;window.addEventListener('resize',position);document.body.appendChild(el);position();bringFront(el);
    return {el,close,label,destroy(){window.removeEventListener('resize',position);el.remove();}};
  }

  function renderList(){
    if(!library)return;
    library.list.replaceChildren();
    if(!notes.size)library.list.appendChild(node('p','notepad-empty','No notes yet. Create one for a quick thought or to-do list.'));
    for(const note of notes.values()){
      const row=node('div','notepad-row'),open=button(note.title.trim()||'Untitled note'),remove=button('×','Delete '+(note.title.trim()||'untitled note'));
      open.classList.add('notepad-open');open.onclick=()=>openNote(note);
      remove.onclick=async()=>{
        if(!confirm('Delete “'+(note.title.trim()||'Untitled note')+'”? This cannot be undone.'))return;
        const editor=windows.get(note.id);remove.disabled=true;
        if(editor){editor.deleting=true;clearTimeout(editor.timer);editor.title.disabled=editor.body.disabled=true;}
        try{
          if(editor?.inflight)await editor.inflight;
          await api('/api/notes/'+encodeURIComponent(note.id),{method:'DELETE'});
          if(editor){editor.frame.destroy();windows.delete(note.id);}notes.delete(note.id);renderList();
        }catch(err){if(library)library.status.textContent=err.message;if(editor){editor.deleting=false;editor.title.disabled=editor.body.disabled=false;editor.status.textContent='Deletion failed. Your note is still open.';if(editor.dirty)editor.retry.hidden=false;}remove.disabled=false;}
      };
      row.append(open,remove);library.list.appendChild(row);
    }
  }
  async function save(editor){
    clearTimeout(editor.timer);
    if(editor.inflight)return editor.inflight;
    if(editor.deleting||!editor.dirty)return true;
    editor.inflight=(async()=>{
      try{
        while(editor.dirty&&!editor.deleting){
          const snapshot={title:editor.title.value,body:editor.body.value,revision:editor.note.revision};
          editor.status.textContent='Saving…';editor.retry.hidden=true;
          const result=await api('/api/notes/'+encodeURIComponent(editor.note.id),{method:'PUT',body:snapshot});
          editor.note.revision=result.revision;
          editor.dirty=editor.title.value!==snapshot.title||editor.body.value!==snapshot.body;
        }
        editor.status.textContent='Saved';return true;
      }catch(err){editor.status.textContent=err.message;editor.retry.hidden=false;return false;}
      finally{editor.inflight=null;}
    })();
    return editor.inflight;
  }
  function openNote(note){
    const existing=windows.get(note.id);if(existing){bringFront(existing.frame.el);existing.body.focus();return;}
    let editor;
    const frame=floating(note.title.trim()||'Untitled note',380,330,async()=>{
      if(editor.deleting)return;
      if(await save(editor)){frame.destroy();windows.delete(note.id);launch.focus();}
    });
    const title=node('input','notepad-title');title.type='text';title.maxLength=120;title.placeholder='Note title';title.setAttribute('aria-label','Note title');title.value=note.title;
    const body=node('textarea','notepad-body');body.maxLength=100000;body.placeholder='Write a quick note or to-do list…';body.setAttribute('aria-label','Note text');body.value=note.body;
    const footer=node('div','notepad-footer'),status=node('span','','Saved'),retry=button('Retry save');status.setAttribute('role','status');retry.hidden=true;footer.append(status,retry);
    frame.el.append(title,body,footer);
    editor={note,frame,title,body,status,retry,dirty:false,inflight:null,timer:null,deleting:false};windows.set(note.id,editor);
    const input=()=>{
      note.title=title.value;note.body=body.value;editor.dirty=true;status.textContent='Unsaved changes…';
      frame.label.textContent=title.value.trim()||'Untitled note';frame.el.setAttribute('aria-label',title.value.trim()||'Untitled note');
      renderList();clearTimeout(editor.timer);editor.timer=setTimeout(()=>save(editor),500);
    };
    title.addEventListener('input',input);body.addEventListener('input',input);retry.onclick=()=>save(editor);title.focus();
  }
  async function openLibrary(){
    if(library){bringFront(library.frame.el);library.add.focus();return;}
    const frame=floating('Notepad',330,400,()=>{frame.destroy();library=null;launch.setAttribute('aria-expanded','false');launch.focus();});
    const add=button('+ New note'),list=node('div','notepad-list'),status=node('p','notepad-library-status','Loading notes…'),retry=button('Retry loading');
    retry.hidden=true;status.setAttribute('role','status');list.tabIndex=0;list.setAttribute('aria-label','Saved notes');
    frame.el.append(add,list,status,retry);library={frame,add,list,status,retry};const active=library;
    launch.setAttribute('aria-expanded','true');
    let loading=false;
    async function load(){
      if(loading)return;loading=true;add.disabled=true;retry.hidden=true;
      try{
        const saved=await api('/api/notes');
        const remoteIds=new Set(saved.map(note=>note.id));
        for(const id of notes.keys())if(!remoteIds.has(id)&&!windows.has(id))notes.delete(id);
        for(const note of saved)if(!windows.has(note.id))notes.set(note.id,note);
        if(library===active){status.textContent='';renderList();}
      }catch(err){status.textContent=err.message;retry.hidden=false;}
      finally{loading=false;add.disabled=false;}
    }
    retry.onclick=load;
    add.onclick=async()=>{
      add.disabled=true;status.textContent='Creating note…';
      try{const note=await api('/api/notes',{method:'POST'});notes.set(note.id,note);renderList();openNote(note);status.textContent='';}
      catch(err){status.textContent=err.message;}
      finally{add.disabled=false;}
    };
    await load();
  }
  launch.onclick=openLibrary;
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')for(const editor of windows.values())save(editor);});
  window.addEventListener('beforeunload',event=>{if([...windows.values()].some(editor=>editor.dirty||editor.inflight)){event.preventDefault();event.returnValue='';}});
})();
