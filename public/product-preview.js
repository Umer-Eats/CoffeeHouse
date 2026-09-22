/* Presentation-only sample content. No API calls or user storage. */
(function(){
'use strict';
const kind=document.body.dataset.preview;
const set=(id,html)=>{const el=document.getElementById(id);if(el)el.innerHTML=html;};
const msg=(who,text)=>`<div class="preview-message"><strong>${who}</strong><p>${text}</p></div>`;
set('meAvatar','AL');set('meName','Alex Lee <span class="status-dot"></span><small id="meSub">alex@example.com · Sample School</small>');
set('meEmail','alex@example.com');set('curSchool','Sample School');
const name=document.getElementById('displayName');if(name)name.value='Alex Lee';
set('schoolSelect','<option>Sample School</option>');
if(kind==='study'){
 set('barChat',msg('You','Can you explain how photosynthesis works?')+msg('BARISTA','Think of a leaf as a tiny solar-powered kitchen. It uses sunlight to turn water and carbon dioxide into sugar, releasing oxygen along the way.')+msg('You','Can you help me remember it?')+msg('BARISTA','Sunlight + water + carbon dioxide → sugar + oxygen. The plant makes its food and shares the oxygen.'));
 set('brewFlow','<div class="doc-card"><h3>Photosynthesis study notes</h3><hr><h4>1. Key terms</h4><p>Chlorophyll captures light. Chloroplasts are where photosynthesis happens.</p><h4>2. Core idea</h4><p>Light energy becomes chemical energy stored in sugar.</p><h4>3. Quick quiz</h4><p>What gas does the plant release? Oxygen.</p></div>');
 const src=document.getElementById('brewSource');if(src)src.value='Biology — class notes';
 const txt=document.getElementById('brewText');if(txt)txt.value='Plants use light energy, water, and carbon dioxide to make sugar. Chlorophyll absorbs sunlight in the chloroplasts.';
 set('cheatList','<div class="preview-room">Photosynthesis essentials</div><div class="preview-room">Algebra: solving equations</div>');
 set('docList','<div class="preview-room">Biology study notes</div><div class="preview-room">History review guide</div>');
 document.querySelectorAll('[data-companion]').forEach(el=>{el.innerHTML='<h2>'+ (el.dataset.companion==='barista'?'Barista':'Brewer')+'</h2><p>Ready for your next idea.</p>';});
}
if(kind==='chat'||kind==='matcha'){
 set('classList','<h3>School Community</h3><div class="preview-room selected"># General</div><div class="preview-room"># Homework help</div><div class="preview-room"># Study together</div>');
 set('chatTitle','# General');set('chatMeta','Sample School · School Community');
 set('msgScroll',msg('Jamie','Anyone reviewing biology after class?')+msg('Alex','I am! Let’s work through the practice questions together.')+msg('Taylor','I made a study guide. We can compare notes here.')+msg('Jamie','Perfect. Meet in # Study together at four?')+msg('Alex','See you there!'));
 set('studentList','<div class="preview-room">JL · Jamie Lee</div><div class="preview-room">TC · Taylor Chen</div>');set('groupList','<div class="preview-room">Biology review crew</div>');
}
document.querySelectorAll('a').forEach(a=>{a.removeAttribute('href');a.setAttribute('aria-disabled','true');});
document.querySelectorAll('button,input,textarea,select').forEach(el=>{if(!el.matches('[data-panel],[data-theme-choice]')&&!(kind==='matcha'&&el.id==='matchaModeButton'))el.disabled=true;});
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-panel]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});document.querySelectorAll('.ws-panel').forEach(p=>p.classList.toggle('on',p.id===b.dataset.panel));});
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>{document.body.dataset.theme=b.dataset.themeChoice;document.querySelectorAll('[data-theme-choice]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
})();
