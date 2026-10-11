'use strict';
const form=document.getElementById('createCommunityForm');
const status=document.getElementById('status');
const password=form.elements.password;
function applyTheme(theme){
  document.documentElement.dataset.theme=theme;
  try{localStorage.setItem('ch-theme',theme);}catch{}
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===theme)));
}
applyTheme(document.documentElement.dataset.theme||'light');
document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>applyTheme(button.dataset.themeChoice)));
password.addEventListener('input',()=>{
  const value=password.value;
  const score=Number(value.length>=8)+Number(value.length>=14)+Number(/[a-z]/.test(value)&&/[A-Z]/.test(value))+Number(/\d/.test(value)&&/[^\w\s]/.test(value));
  const strength=document.getElementById('strength');
  strength.setAttribute('aria-valuenow',String(score));
  strength.setAttribute('aria-valuetext',['Not entered','Weak','Fair','Good','Strong'][score]);
  [...strength.children].forEach((segment,index)=>segment.classList.toggle('is-filled',index<score));
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
