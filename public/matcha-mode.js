(function(){
'use strict';
const menu=MatchaMenu,core=MatchaCore,preview=document.body.dataset.matchaPreview==='true';
let state,key,selected,category='All drinks',dialog,content,interval,notice='',savingFailed=false,opening=false;
const button=document.getElementById('matchaModeButton');
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=d=>`<img class="mm-drink-art" src="${d.art}" alt="Pixel illustration of ${html(d.name)}">`;
function save(){if(preview)return;try{localStorage.setItem(key,JSON.stringify(state));savingFailed=false;}catch{savingFailed=true;}}
function load(){if(preview){state=core.create(menu);return;}let stored;try{stored=JSON.parse(localStorage.getItem(key)||'{}');}catch{stored={};}state=core.create(menu,stored);save();}
function drink(){return menu.drinks.find(d=>d.id===state.active?.drinkId);}
function render(){
 const a=state.active;
 content.innerHTML='';
 dialog.scrollTop=0;
 if(a?.phase==='running'||a?.phase==='complete')renderTimer();
 else if(a?.phase==='receipt')renderReceipt();
 else renderMenu();
 const status=dialog.querySelector('.mm-status');status.textContent=savingFailed?'Progress could not be saved in this browser. Keep this page open.':notice;
}
function renderMenu(){
 content.innerHTML=`<div class="mm-menu-heading"><p class="mm-eyebrow">A LITTLE RITUAL FOR YOUR NEXT BIG IDEA</p><h1 id="mm-title">A slower kind of order.</h1><p>Choose a cup. Give it your time. Let something good brew.</p><span class="mm-tag">${menu.drinks.length} cups · 7 collections · yours to discover</span></div>
 <nav class="mm-categories" aria-label="Drink categories">${['All drinks',...menu.categories].map(c=>`<button type="button" data-category="${html(c)}" aria-pressed="${category===c}">${html(c)}</button>`).join('')}</nav>
 <div class="mm-menu-layout"><section class="mm-grid" aria-label="Drink menu"></section><aside class="mm-detail" aria-label="Your drink"></aside></div>
 <footer class="mm-source">A CoffeeHouse focus ritual inspired by HEYTEA. Digital rewards only.<br>Menu reference: <a href="https://heyteas.com/" target="_blank" rel="noopener">heyteas.com</a> · Prices shown here are focus minutes. ${preview?'Demo progress resets when you reload.':'Progress stays in this browser.'}</footer>`;
 const filtered=menu.drinks.filter(d=>category==='All drinks'||d.category===category);
 if(!selected||!filtered.some(d=>d.id===selected))selected=filtered[0].id;
 content.querySelector('.mm-grid').innerHTML=filtered.map(d=>{
 const unlocked=core.available(menu,state,d);
 return `<button class="mm-card ${unlocked?'':'is-locked'} ${selected===d.id?'is-selected':''}" data-drink="${d.id}" aria-pressed="${selected===d.id}">${art(d)}<span class="mm-card-category">${html(d.category)}</span><strong>${html(d.name)}</strong><span class="mm-price">${state.minutes[d.id]} <small>MIN</small></span><span class="mm-availability">${unlocked?'AVAILABLE TO BREW':'◇ COLLECT TO UNLOCK'}</span></button>`;
 }).join('');
 content.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;render();});
 content.querySelectorAll('[data-drink]').forEach(b=>b.onclick=()=>{selected=b.dataset.drink;content.querySelectorAll('[data-drink]').forEach(c=>{c.classList.toggle('is-selected',c===b);c.setAttribute('aria-pressed',String(c===b));});renderDetail();if(window.matchMedia('(max-width:650px)').matches)content.querySelector('.mm-detail').scrollIntoView({block:'start'});});
 renderDetail();
}
function renderDetail(){
 const d=menu.drinks.find(d=>d.id===selected),unlocked=core.available(menu,state,d);
 const rows=menu.drinks.filter(x=>x.category===d.category),previous=rows[Math.max(0,rows.indexOf(d)-1)];
 const pane=content.querySelector('.mm-detail');pane.scrollTop=0;
 pane.innerHTML=`<p class="mm-eyebrow">${html(d.category)} / YOUR SELECTION</p>${art(d)}<h2>${html(d.name)}</h2><p>${html(d.description)}</p><p class="mm-detail-price">${state.minutes[d.id]} <span>minutes of focus</span></p>
 ${unlocked?`<form class="mm-order-form"><fieldset><legend>Make it yours <small>Choose an addition or leave a note.</small></legend>${menu.toppings.map(t=>`<label><input type="checkbox" name="topping" value="${html(t)}"> ${html(t)}</label>`).join('')}</fieldset><label class="mm-note-label" for="mm-note">SPECIAL INSTRUCTIONS</label><textarea id="mm-note" maxlength="200" rows="3" placeholder="Less ice, extra care. Or: finish my biology notes."></textarea><p class="mm-form-error" role="alert"></p><button class="mm-primary" type="submit">Order drink <span>↗</span></button></form>`:`<div class="mm-locked-note">◇ This cup is waiting for you.<br>Complete five orders of <strong>${html(previous.name)}</strong>, then redeem its coupon.</div>`}
 ${coupon(d)}`;
 if(unlocked)pane.querySelector('form').onsubmit=e=>{e.preventDefault();const additions=[...pane.querySelectorAll('input:checked')].map(c=>c.value);const note=pane.querySelector('textarea').value.trim();try{core.order(menu,state,d.id,[...additions,note].filter(Boolean).join(' · '));save();notice='';render();content.querySelector('.mm-tear').focus();}catch(err){pane.querySelector('.mm-form-error').textContent=err.message;}};
 wireCoupon();
}
function coupon(d){
 const count=state.stamps[d.id],used=state.redeemed[d.id],rows=menu.drinks.filter(x=>x.category===d.category),last=rows.at(-1).id===d.id;
 return `<section class="mm-coupon" aria-label="Drink coupon"><div class="mm-coupon-head"><span>COFFEEHOUSE / LOYALTY CLUB</span><span>№ ${d.id.toUpperCase()}</span></div><h3>${html(d.name)}</h3><div class="mm-stamps" aria-label="${count} of 5 completed orders">${Array.from({length:5},(_,i)=>`<span class="${i<count?'stamped':''}">${i<count?'✿':i+1}</span>`).join('')}</div><p>${used?(last?'Collection complete. Beautifully brewed.':'Coupon redeemed. Your next cup is unlocked.'):'Five finished timers. One new favorite.'}</p><button class="mm-redeem" data-redeem="${d.id}" ${count<5||used?'disabled':''}>${last?'Redeem collection badge':'Redeem coupon'} ${count}/5</button></section>`;
}
function wireCoupon(){content.querySelectorAll('[data-redeem]').forEach(b=>b.onclick=()=>{const next=core.redeem(menu,state,b.dataset.redeem);save();notice=next?next.name+' unlocked. Find it on the menu.':'Collection complete!';render();});}
function renderReceipt(){
 const d=drink();
 content.innerHTML=`<section class="mm-receipt-scene"><p class="mm-eyebrow">ONE ORDER. A LITTLE INTENTION.</p><h1 id="mm-title">Your moment, on paper.</h1><p>Pull down the customer copy to begin brewing.</p><div class="mm-receipt"><div class="mm-receipt-top"><h2>MATCHA MODE</h2><p>COFFEEHOUSE FOCUS BAR<br>ORDER ${d.id.toUpperCase()} / MADE FOR YOU</p><hr><div class="mm-receipt-line"><strong>${html(d.name)}</strong><span>${state.minutes[d.id]} MIN</span></div><p>${html(state.active.instructions)}</p><hr><div class="mm-receipt-line"><span>TOTAL TIME</span><strong>${state.minutes[d.id]} MIN</strong></div><p class="mm-receipt-thanks">GOOD THINGS TAKE YOUR TIME.</p></div><button class="mm-tear" type="button" aria-label="Tear off customer receipt and start timer"><span>✂ · · · · · · · · · · · · · · · · · · ·</span><strong>CUSTOMER COPY</strong><small>Drag down to tear · or press Enter</small><span class="mm-barcode">▌▏▌▌▏▎▌▏▌▎▏▌▌▏▌▌▏▎▌</span></button></div></section>`;
 const tear=content.querySelector('.mm-tear');let start=null,dragged=false;
 const receiptOrder=state.active;
 const begin=()=>{if(tear.disabled)return;tear.disabled=true;tear.classList.add('is-torn');setTimeout(()=>{if(!dialog.open||state.active!==receiptOrder)return;if(core.tear(state)){save();render();}},350);};
 tear.onpointerdown=e=>{start=e.clientY;dragged=false;tear.setPointerCapture(e.pointerId);};
 tear.onpointermove=e=>{if(start===null)return;const dy=Math.max(0,e.clientY-start);dragged=dy>8;tear.style.transform=`translateY(${Math.min(dy,120)}px) rotate(${Math.min(dy/20,5)}deg)`;};
 tear.onpointerup=e=>{const distance=e.clientY-start;start=null;if(distance>60)begin();else tear.style.transform='';};
 tear.onpointercancel=()=>{start=null;tear.style.transform='';};
 tear.onclick=e=>{if(e.detail===0||!dragged)begin();};
}
function renderTimer(){
 const d=drink(),done=state.active.phase==='complete';
 content.innerHTML=`<section class="mm-focus ${done?'is-complete':''}"><p class="mm-eyebrow">${done?'YOUR ORDER IS READY':'SOMETHING GOOD IS COMING TOGETHER'}</p><div class="mm-brewing" aria-hidden="true"><div class="mm-whisk"><i></i><b></b></div><div class="mm-bowl"><span></span></div><div class="mm-pour"></div>${art(d)}<span class="mm-spark s1">✦</span><span class="mm-spark s2">✧</span></div><h1 id="mm-title">${html(d.name)}</h1><div class="mm-clock" role="timer" aria-label="Focus time remaining"></div><p>${done?'One full order. One more stamp. Well done.':'Stay with your work. We’ll take care of the stirring.'}</p><p class="mm-order-note">${html(state.active.instructions)}</p>${done?'<button class="mm-primary mm-again">Choose your next order ↗</button>':''}<div class="mm-coupon-dock">${coupon(d)}</div></section>`;
 wireCoupon();tick();
 const again=content.querySelector('.mm-again');if(again)again.onclick=()=>{state.active=null;save();render();};
}
function tick(){
 if(!state)return;
 if(core.finish(state)){save();notice='Timer complete. Your coupon has a new stamp.';render();return;}
 const clock=content?.querySelector('.mm-clock');if(clock){const seconds=Math.max(0,Math.ceil((state.active.endAt-Date.now())/1000));clock.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
}
async function open(){
 if(opening||dialog?.open)return;opening=true;button.disabled=true;
 try{
  const me=preview?{user:{id:'preview'}}:await api('/api/me');if(!me.user?.id)throw Error('Sign in to open Matcha Mode.');
  key='coffeehouse-matcha-v1:'+me.user.id;load();notice='';
  if(!dialog){dialog=document.createElement('dialog');dialog.className='matcha-mode';dialog.setAttribute('closedby','none');dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();}},true);dialog.setAttribute('aria-labelledby','mm-title');dialog.innerHTML='<div class="mm-top"><span class="mm-wordmark">✿ MATCHA MODE <small>by CoffeeHouse</small></span><button class="mm-cancel" type="button">Cancel order ×</button></div><p class="mm-status" role="status"></p><main class="mm-content"></main>';document.body.appendChild(dialog);content=dialog.querySelector('main');dialog.addEventListener('cancel',e=>e.preventDefault());dialog.querySelector('.mm-cancel').onclick=()=>{state.active=null;save();clearInterval(interval);dialog.close();document.body.classList.remove('matcha-open');button.focus();};}
  core.finish(state);save();render();dialog.showModal();document.body.classList.add('matcha-open');interval=setInterval(tick,500);
 }catch(err){button.textContent='Matcha unavailable — retry';button.title=err.message;}finally{opening=false;button.disabled=false;}
}
button.addEventListener('click',open);
window.addEventListener('storage',e=>{if(e.key===key&&dialog?.open){let stored;try{stored=JSON.parse(e.newValue||'{}');}catch{stored={};}state=core.create(menu,stored);render();}});
document.addEventListener('visibilitychange',tick);
// Restore a running order after a reload, without opening the mode for new users.
(async()=>{if(preview){open();return;}try{const me=await api('/api/me');const saved=JSON.parse(localStorage.getItem('coffeehouse-matcha-v1:'+me.user?.id)||'{}');if(saved.active)open();}catch{}})();
})();
