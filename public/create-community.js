'use strict';
const form=document.getElementById('createCommunityForm');
const status=document.getElementById('status');
const password=form.elements.password;
password.addEventListener('input',()=>{
  const value=password.value;
  const score=Number(value.length>=8)+Number(value.length>=14)+Number(/[a-z]/.test(value)&&/[A-Z]/.test(value))+Number(/\d/.test(value)&&/[^\w\s]/.test(value));
  document.getElementById('strength').value=score;
  form.elements.confirmPassword.setCustomValidity('');
});
form.elements.confirmPassword.addEventListener('input',()=>form.elements.confirmPassword.setCustomValidity(''));
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(password.value!==form.elements.confirmPassword.value){
    form.elements.confirmPassword.setCustomValidity('The passwords must match.');
    form.elements.confirmPassword.reportValidity();return;
  }
  if(new TextEncoder().encode(password.value).length>72){status.textContent='Please use a password of at most 72 UTF-8 bytes.';return;}
  const button=form.querySelector('button');button.disabled=true;status.textContent='Preparing your community…';
  try{
    await api('/api/school/create',{method:'POST',body:{name:form.elements.name.value.trim(),password:password.value},timeout:110000});
    location.assign('/student.html');
  }catch(error){status.textContent=error.message;button.disabled=false;}
});
