(function(){
'use strict';
const el=id=>document.getElementById(id);
const dialog=el('deleteCommunityDialog');
let community=null,userId=null,deleting=false;
window.CommunityDeletion={setCommunity(school,ownerId){
  community=school;userId=ownerId;
  el('communityOwnerActions').hidden=!school?.isOwner;
  el('ownedCommunityName').textContent=school?.name||'';
  el('deleteCommunityButton').textContent=school?.status==='deleting'?'RETRY DELETION':'DELETE COMMUNITY';
  el('communityDeleteStatus').textContent=school?.status==='deleting'?'Deletion is unfinished. Retry to finish removing this community.':'';
}};
el('deleteCommunityButton').addEventListener('click',()=>{
  if(!community?.isOwner||deleting)return;
  el('deleteCommunityExpectedName').textContent=community.name;
  el('deleteCommunityName').value='';
  el('deleteCommunityError').textContent='';
  el('confirmDeleteCommunity').disabled=true;
  dialog.showModal();el('deleteCommunityName').focus();
});
el('deleteCommunityName').addEventListener('input',()=>{
  el('confirmDeleteCommunity').disabled=deleting||el('deleteCommunityName').value!==community?.name;
});
el('cancelDeleteCommunity').addEventListener('click',()=>dialog.close());
dialog.addEventListener('cancel',event=>{if(deleting)event.preventDefault();});
el('deleteCommunityForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(deleting||!community?.isOwner||el('deleteCommunityName').value!==community.name)return;
  const target={...community};
  deleting=true;el('confirmDeleteCommunity').disabled=true;el('cancelDeleteCommunity').disabled=true;
  el('deleteCommunityError').textContent='Deleting your community…';
  try{
    await api('/api/school/'+target.id,{method:'DELETE',body:{confirmName:target.name},timeout:110000});
    try{localStorage.removeItem('coffeehouse-matcha-v2:'+userId+':'+target.id);}catch{}
    dialog.close();el('communityOwnerActions').hidden=true;
    location.assign('/?login=1');
  }catch(error){el('deleteCommunityError').textContent=error.message;}
  finally{
    deleting=false;el('confirmDeleteCommunity').disabled=el('deleteCommunityName').value!==community?.name;
    el('cancelDeleteCommunity').disabled=false;
  }
});
})();
