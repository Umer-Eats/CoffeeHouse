(function(){
'use strict';
const menu=MatchaMenu,core=MatchaCore,preview=document.body.dataset.matchaPreview==='true';
let state,key,selected,category='All drinks',dialog,content,interval,notice='',savingFailed=false,opening=false,rewardBusy=false;
const button=document.getElementById('matchaModeButton');
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=d=>`<img class="mm-drink-art" src="${d.art}" alt="Pixel illustration of ${html(d.name)}">`;
function save(){if(preview)return;try{localStorage.setItem(key,JSON.stringify(state));savingFailed=false;}catch{savingFailed=true;}}
function load(){if(preview){state=core.create(menu);return;}let stored;try{stored=JSON.parse(localStorage.getItem(key)||'{}');}catch{stored={};}state=core.create(menu,stored);save();}
function drink(){return menu.drinks.find(d=>d.id===state.active?.drinkId);}
function render(){
 const a=state.active;
 dialog.querySelector('.mm-send').hidden=preview||a?.phase!=='receipt'||!!a?.giftId;
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
 <footer class="mm-source">A CoffeeHouse focus ritual inspired by HEYTEA. Digital rewards only.<br>Menu reference: <a href="https://www.heytea.com/" target="_blank" rel="noopener">www.heytea.com</a> · Prices shown here are focus minutes. ${preview?'Demo progress resets when you reload.':'Progress stays in this browser.'}</footer>`;
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
 if(unlocked)pane.querySelector('form').onsubmit=e=>{e.preventDefault();const additions=[...pane.querySelectorAll('input:checked')].map(c=>c.value);const note=pane.querySelector('textarea').value.trim();try{core.order(menu,state,d.id,[...additions,note].filter(Boolean).join(' · '));save();notice='';window.CoffeeAlerts?.sound('order');render();content.querySelector('.mm-tear').focus();}catch(err){pane.querySelector('.mm-form-error').textContent=err.message;}};
 wireCoupon();
}
function coupon(d){
 const count=state.stamps[d.id],used=state.redeemed[d.id],rows=menu.drinks.filter(x=>x.category===d.category),last=rows.at(-1).id===d.id;
 return `<section class="mm-coupon" aria-label="Drink coupon"><div class="mm-coupon-head"><span>COFFEEHOUSE / LOYALTY CLUB</span><span>№ ${d.id.toUpperCase()}</span></div><h3>${html(d.name)}</h3>${state.giftCoupons?.[d.id]?`<p>${state.giftCoupons[d.id]} full gift coupon${state.giftCoupons[d.id]===1?'':'s'} earned for this drink.</p>`:''}<div class="mm-stamps" aria-label="${count} of 5 completed orders">${Array.from({length:5},(_,i)=>`<span class="${i<count?'stamped':''}">${i<count?'✿':i+1}</span>`).join('')}</div><p>${used?(last?'Collection complete. Beautifully brewed.':'Coupon redeemed. Your next cup is unlocked.'):'Five finished timers. One new favorite.'}</p><button class="mm-redeem" data-redeem="${d.id}" ${count<5||used?'disabled':''}>${last?'Redeem collection badge':'Redeem coupon'} ${count}/5</button></section>`;
}
function wireCoupon(){content.querySelectorAll('[data-redeem]').forEach(b=>b.onclick=()=>{const next=core.redeem(menu,state,b.dataset.redeem);save();notice=next?next.name+' unlocked. Find it on the menu.':'Collection complete!';render();});}
function renderReceipt(){
 const d=drink();
 content.innerHTML=`<section class="mm-receipt-scene"><p class="mm-eyebrow">ONE ORDER. A LITTLE INTENTION.</p><h1 id="mm-title">Your moment, on paper.</h1><p>Pull down the customer copy to begin brewing.</p><div class="mm-receipt"><div class="mm-receipt-top"><h2>MATCHA MODE</h2><p>COFFEEHOUSE FOCUS BAR<br>ORDER ${d.id.toUpperCase()} / MADE FOR YOU</p><hr><div class="mm-receipt-line"><strong>${html(d.name)}</strong><span>${state.minutes[d.id]} MIN</span></div><p>${html(state.active.instructions)}</p><hr><div class="mm-receipt-line"><span>TOTAL TIME</span><strong>${state.minutes[d.id]} MIN</strong></div><p class="mm-receipt-thanks">GOOD THINGS TAKE YOUR TIME.</p></div><button class="mm-tear" type="button" aria-label="Tear off customer receipt and start timer"><span>✂ · · · · · · · · · · · · · · · · · · ·</span><strong>CUSTOMER COPY</strong><small>Drag down to tear · or press Enter</small><span class="mm-barcode">▌▏▌▌▏▎▌▏▌▎▏▌▌▏▌▌▏▎▌</span></button></div></section>`;
 const tear=content.querySelector('.mm-tear');let start=null,dragged=false;
 const receiptOrder=state.active;
 const begin=async()=>{if(tear.disabled)return;tear.disabled=true;if(state.active.giftId){try{const g=await api('/api/matcha/gifts/'+state.active.giftId+'/start',{method:'POST'});state.active.startedAt=g.started_at;state.active.endAt=g.started_at+g.minutes*60000;}catch(err){tear.disabled=false;dialog.querySelector('.mm-status').textContent=err.message;return;}}tear.classList.add('is-torn');setTimeout(()=>{if(!dialog.open||state.active!==receiptOrder)return;if(state.active.giftId){state.active.phase='running';save();render();}else if(core.tear(state)){save();render();}},350);};
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
 if(!state?.active)return;
 if(state.active?.giftId&&state.active.phase==='running'&&Date.now()>=state.active.endAt){finishGift();return;}
 if(!state.active?.giftId&&core.finish(state)){window.CoffeeAlerts?.sound('complete');window.CoffeeAlerts?.popup('Your drink is ready!','Focus session complete. Your coupon has a new stamp.');save();notice='Timer complete. Your coupon has a new stamp.';render();return;}
 const clock=content?.querySelector('.mm-clock');if(clock){const seconds=Math.max(0,Math.ceil((state.active.endAt-Date.now())/1000));clock.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
}
async function open(giftId){
 if(typeof giftId!=='string')giftId=null;
 if(opening||dialog?.open)return;opening=true;button.disabled=true;
 try{
  const me=preview?{user:{id:'preview'}}:await api('/api/me');if(!me.user?.id)throw Error('Sign in to open Matcha Mode.');
  key='coffeehouse-matcha-v1:'+me.user.id;load();notice='';await syncRewards();
  if(giftId){if(state.active&&state.active.giftId!==giftId&&state.active.phase!=='complete')throw Error('Finish or cancel your current order before opening a gift.');const g=await api('/api/matcha/gifts/'+giftId);if(g.completed)throw Error('This gift is already complete. Your coupon has been credited.');state.active={giftId:g.id,drinkId:g.drink_id,instructions:g.instructions,phase:g.started_at?'running':'receipt',startedAt:g.started_at||0,endAt:g.started_at?g.started_at+g.minutes*60000:0};save();}
  if(!dialog){dialog=document.createElement('dialog');dialog.className='matcha-mode';dialog.setAttribute('closedby','none');dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();}},true);dialog.setAttribute('aria-labelledby','mm-title');dialog.innerHTML='<div class="mm-top"><span class="mm-wordmark">✿ MATCHA MODE <small>by CoffeeHouse</small></span><div class="mm-actions"><button class="mm-send mm-cancel" type="button" hidden>Send to Friend</button><button class="mm-cancel mm-exit" type="button">Cancel order ×</button></div></div><p class="mm-status" role="status"></p><main class="mm-content"></main>';document.body.appendChild(dialog);content=dialog.querySelector('main');dialog.addEventListener('cancel',e=>e.preventDefault());dialog.querySelector('.mm-send').onclick=sendToFriend;dialog.querySelector('.mm-exit').onclick=async()=>{if(state.active?.giftId){try{await api('/api/matcha/gifts/'+state.active.giftId+'/cancel',{method:'POST'});}catch(err){dialog.querySelector('.mm-status').textContent=err.message;return;}}state.active=null;save();clearInterval(interval);dialog.close();document.body.classList.remove('matcha-open');button.focus();};}
  const completedOnOpen=!state.active?.giftId&&core.finish(state);save();render();dialog.showModal();if(completedOnOpen){window.CoffeeAlerts?.sound('complete');window.CoffeeAlerts?.popup('Your drink is ready!','Your focus session is complete.');}document.body.classList.add('matcha-open');interval=setInterval(tick,500);
 }catch(err){button.textContent='Matcha unavailable — retry';button.title=err.message;window.alert(err.message);}finally{opening=false;button.disabled=false;}
}
button.addEventListener('click',()=>open());
window.openMatchaGift=id=>{if(dialog?.open){dialog.querySelector('.mm-status').textContent='Finish or cancel your current order first.';return;}open(id);};
async function syncRewards(){
 if(preview)return;
 const rewards=await api('/api/matcha/rewards');state.giftCoupons=Object.fromEntries(rewards.map(r=>[r.drink_id,Number(r.coupons)]));
 // Completed gifts are authoritative and reusable as a full coupon on every device.
 for(const r of rewards)if(state.stamps[r.drink_id]!==undefined&&r.coupons>0)state.stamps[r.drink_id]=5;
 save();
 if(dialog?.open){const current=menu.drinks.find(d=>d.id===(state.active?.drinkId||selected));const old=content.querySelector('.mm-coupon');if(current&&old){old.outerHTML=coupon(current);wireCoupon();}}
}
async function finishGift(){
 if(rewardBusy)return;rewardBusy=true;const a=state.active;
 try{await api('/api/matcha/gifts/'+a.giftId+'/finish',{method:'POST'});if(state.active!==a)return;await syncRewards();a.phase='complete';window.CoffeeAlerts?.sound('complete');window.CoffeeAlerts?.popup('Your gifted drink is ready!','You and your friend each earned a coupon.');save();notice='Gift complete! You and your friend each earned a full drink coupon.';render();}
 catch(err){dialog.querySelector('.mm-status').textContent=err.message+' Completion will retry automatically.';}
 finally{setTimeout(()=>{rewardBusy=false;},5000);}
}
async function sendToFriend(){
 if(content.querySelector('.mm-friends')){content.querySelector('.mm-friends input').focus();return;}
 const order=state.active;if(order?.phase!=='receipt'||order.giftId)return;
 const send=dialog.querySelector('.mm-send');send.disabled=true;
 try{
 const students=await api('/api/students');
 const picker=document.createElement('section');picker.className='mm-friends';picker.setAttribute('aria-label','Send drink to a friend');
 picker.innerHTML='<h2>Send to Friend</h2><p>Choose someone in your community. When they finish this timer, you both earn a full coupon for this drink.</p><label>Find a friend <input type="search" placeholder="Search by name"></label><div class="mm-friend-list"></div><p role="status"></p><button type="button" class="mm-primary">Back to receipt</button>';
 content.prepend(picker);picker.querySelector('button').onclick=()=>picker.remove();
 const list=picker.querySelector('.mm-friend-list'),status=picker.querySelector('[role=status]');let sending=false;
 const draw=()=>{list.replaceChildren();const matches=students.filter(u=>u.name.toLowerCase().includes(picker.querySelector('input').value.toLowerCase()));status.textContent=matches.length?'':'No community members found.';for(const u of matches){const b=document.createElement('button');b.type='button';b.textContent=u.name;b.onclick=async()=>{if(sending)return;sending=true;list.querySelectorAll('button').forEach(x=>x.disabled=true);status.textContent='Sending…';try{await api('/api/matcha/gifts',{method:'POST',body:{recipientId:u.id,drinkId:order.drinkId,instructions:order.instructions}});notice='Drink sent to '+u.name+'. Find it in your direct messages.';render();}catch(err){status.textContent=err.message;sending=false;list.querySelectorAll('button').forEach(x=>x.disabled=false);}};list.append(b);}};
 picker.querySelector('input').oninput=draw;draw();picker.querySelector('input').focus();
 }catch(err){dialog.querySelector('.mm-status').textContent=err.message;}finally{send.disabled=false;}
}

window.addEventListener('storage',e=>{if(e.key===key&&dialog?.open){let stored;try{stored=JSON.parse(e.newValue||'{}');}catch{stored={};}state=core.create(menu,stored);render();}});
document.addEventListener('visibilitychange',()=>{tick();if(!document.hidden&&dialog?.open&&!preview)syncRewards().catch(()=>{});});
setInterval(()=>{if(dialog?.open&&!preview)syncRewards().catch(()=>{});},30000);
// Restore a running order after a reload, without opening the mode for new users.
(async()=>{if(preview){open();return;}try{const me=await api('/api/me');const saved=JSON.parse(localStorage.getItem('coffeehouse-matcha-v1:'+me.user?.id)||'{}');if(saved.active)open();}catch{}})();
})();
