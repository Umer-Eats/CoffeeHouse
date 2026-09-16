'use strict';
window.GroupMembers={async open(group,onLeft){
  const dialog=document.createElement('dialog');dialog.className='member-dialog';dialog.setAttribute('aria-label','Group members');
  const close=document.createElement('button');close.className='btn member-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','Close member list');
  const title=document.createElement('h2');title.textContent=group.name;
  const list=document.createElement('div');list.className='member-list';
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Loading members…';
  const leave=document.createElement('button');leave.className='btn danger';leave.type='button';leave.textContent='Leave Group';leave.disabled=true;
  dialog.append(close,title,list,status,leave);document.body.appendChild(dialog);
  let saving=false;
  close.onclick=()=>{if(!saving)dialog.close();};
  dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  try{
    const members=await api('/api/groups/'+encodeURIComponent(group.id)+'/members');
    if(!dialog.open)return;
    members.forEach(member=>{const row=document.createElement('p');row.className='group-option';row.textContent=member.name+(member.id===group.creator_id?' · Creator':'');list.appendChild(row);});
    status.textContent=members.length+' members';leave.disabled=false;
  }catch(err){if(dialog.open)status.textContent=err.message;}
  leave.onclick=async()=>{
    if(saving||!confirm('Leave “'+group.name+'”? You will lose access to its messages and files until the creator adds you again.'))return;
    saving=true;leave.disabled=close.disabled=true;status.textContent='Leaving group…';
    try{await api('/api/groups/'+encodeURIComponent(group.id)+'/leave',{method:'POST'});dialog.close();await onLeft(group);}
    catch(err){status.textContent=err.message;}
    finally{saving=false;leave.disabled=close.disabled=false;}
  };
}};
