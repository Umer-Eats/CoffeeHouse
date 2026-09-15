'use strict';
window.GroupPicker={init(onCreated){
  const $=id=>document.getElementById(id),dialog=$('groupDialog'),selected=new Map();
  let version=0,after=0,saving=false,timer,editing=null;
  function selection(){
    $('groupSelected').replaceChildren();
    selected.forEach((name,id)=>{const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=name+' ×';button.setAttribute('aria-label','Remove '+name);button.onclick=()=>{selected.delete(id);selection();dialog.querySelectorAll('input[data-member]').forEach(input=>{input.checked=selected.has(Number(input.dataset.member));});};$('groupSelected').appendChild(button);});
    $('groupAdd').disabled=!editing&&selected.size<2;$('groupAdd').classList.toggle('matcha',!!editing||selected.size>=2);
    $('groupSelectionCount').textContent=selected.size+(editing?' selected. You remain in the group as its creator.':' selected. Choose at least two other students.');
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
    editing=null;$('groupTitle').textContent='Create Group';$('groupAdd').textContent='Add Group';
    selected.clear();selection();$('groupSearch').value='';$('groupName').value='';$('groupPickStep').hidden=false;$('groupNameStep').hidden=true;
    dialog.showModal();$('groupSearch').focus();search();
  };
  $('groupClose').onclick=()=>{if(!saving){version++;dialog.close();}};
  dialog.addEventListener('cancel',event=>event.preventDefault());
  $('groupSearch').oninput=()=>{clearTimeout(timer);version++;timer=setTimeout(()=>search(),180);};
  $('groupMore').onclick=()=>search(true);
  $('groupAdd').onclick=async()=>{
    if(editing){
      if(saving)return;saving=true;$('groupAdd').disabled=true;$('groupClose').disabled=true;
      $('groupStatus').textContent='Saving members…';
      try{const group=await api('/api/groups/'+encodeURIComponent(editing.id)+'/members',{method:'PUT',body:{memberIds:[...selected.keys()]}});version++;dialog.close();onCreated(group);}
      catch(err){$('groupStatus').textContent=err.message;}
      finally{saving=false;$('groupClose').disabled=false;selection();}
      return;
    }
    if(selected.size<2)return;$('groupPickStep').hidden=true;$('groupNameStep').hidden=false;$('groupStatus').textContent='';$('groupName').focus();
  };
  window.GroupPicker.edit=async group=>{
    editing=group;selected.clear();$('groupTitle').textContent='Edit Members';$('groupAdd').textContent='Save Members';$('groupSearch').value='';$('groupPickStep').hidden=false;$('groupNameStep').hidden=true;$('groupResults').replaceChildren();$('groupSelected').replaceChildren();$('groupAdd').disabled=true;
    dialog.showModal();$('groupStatus').textContent='Loading members…';
    const request=++version;
    try{const members=await api('/api/groups/'+encodeURIComponent(group.id)+'/members');if(request!==version)return;members.forEach(member=>selected.set(member.id,member.name));selection();search();}
    catch(err){if(request===version)$('groupStatus').textContent=err.message;}
  };
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
