'use strict';
window.GroupPicker={init(onCreated){
  const $=id=>document.getElementById(id),dialog=$('groupDialog'),selected=new Map();
  let version=0,after=0,saving=false,timer;
  function selection(){
    $('groupSelected').replaceChildren();
    selected.forEach((name,id)=>{const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=name+' ×';button.setAttribute('aria-label','Remove '+name);button.onclick=()=>{selected.delete(id);selection();dialog.querySelectorAll('input[data-member]').forEach(input=>{input.checked=selected.has(Number(input.dataset.member));});};$('groupSelected').appendChild(button);});
    $('groupAdd').disabled=selected.size<2;$('groupAdd').classList.toggle('matcha',selected.size>=2);
    $('groupSelectionCount').textContent=selected.size+' selected. Choose at least two other students.';
  }
  async function search(append=false){
    const request=++version;
    if(!append){after=0;$('groupResults').replaceChildren();}
    $('groupMore').hidden=true;$('groupStatus').textContent='Loading students…';
    try{
      const data=await api('/api/groups/students?q='+encodeURIComponent($('groupSearch').value)+'&after='+after);
      if(request!==version)return;
      data.students.forEach(student=>{
        const label=document.createElement('label');label.className='group-option';
        const input=document.createElement('input');input.type='checkbox';input.dataset.member=student.id;input.checked=selected.has(student.id);
        input.onchange=()=>{if(input.checked)selected.set(student.id,student.name);else selected.delete(student.id);selection();};
        label.append(input,document.createTextNode(student.name));$('groupResults').appendChild(label);after=student.id;
      });
      $('groupMore').hidden=!data.more;$('groupStatus').textContent=(!append&&!data.students.length)?'No matching students.':'';
    }catch{if(request===version)$('groupStatus').textContent='Could not load students. Try searching again.';}
  }
  $('createGroup').onclick=()=>{
    selected.clear();selection();$('groupSearch').value='';$('groupName').value='';$('groupPickStep').hidden=false;$('groupNameStep').hidden=true;
    dialog.showModal();$('groupSearch').focus();search();
  };
  $('groupClose').onclick=()=>{if(!saving){version++;dialog.close();}};
  dialog.addEventListener('cancel',event=>event.preventDefault());
  $('groupSearch').oninput=()=>{clearTimeout(timer);version++;timer=setTimeout(()=>search(),180);};
  $('groupMore').onclick=()=>search(true);
  $('groupAdd').onclick=()=>{if(selected.size<2)return;$('groupPickStep').hidden=true;$('groupNameStep').hidden=false;$('groupStatus').textContent='';$('groupName').focus();};
  $('groupBack').onclick=()=>{$('groupPickStep').hidden=false;$('groupNameStep').hidden=true;$('groupSearch').focus();};
  $('groupNameStep').onsubmit=async event=>{
    event.preventDefault();if(saving)return;
    const name=$('groupName').value.trim();if(!name){$('groupStatus').textContent='Enter a group name.';return;}
    saving=true;['groupSave','groupBack','groupClose'].forEach(id=>$(id).disabled=true);$('groupStatus').textContent='Creating your group…';
    try{
      const group=await api('/api/groups',{method:'POST',body:{name,memberIds:[...selected.keys()]}});
      version++;dialog.close();onCreated(group);
    }catch(err){$('groupStatus').textContent=err.message;}
    finally{saving=false;['groupSave','groupBack','groupClose'].forEach(id=>$(id).disabled=false);}
  };
}};
