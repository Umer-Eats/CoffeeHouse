/* Shared café sounds and on-screen notifications. Uses a bundled message MP3; no microphone access. */
(function(){
'use strict';
let messageBufferPromise,messageSource,soundsEnabled=true;
let context,userKey='',muted={},busy=false,cursor=null,feedFailed=false;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
function unlock(){if(!soundsEnabled)return Promise.resolve(false);try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return Promise.resolve(false);context ||= new Audio();return (context.state==='running'?Promise.resolve():context.resume()).then(()=>context.state==='running').catch(()=>false);}catch{return Promise.resolve(false);}}
document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock);
async function playMessage(){
 if(!soundsEnabled||!context||context.state!=='running')return false;
 try{
  messageBufferPromise ||= (async()=>{
   const response=await fetch('/sounds/message-notification.mp3?v=1',{signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Could not load notification sound.');
   return context.decodeAudioData(await response.arrayBuffer());
  })().catch(err=>{messageBufferPromise=null;throw err;});
  const buffer=await messageBufferPromise;
  if(!soundsEnabled||context.state!=='running')return false;
  // Restart instead of layering multiple messages into a loud burst.
  if(messageSource){messageSource.stop();messageSource.disconnect();}
  const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);messageSource=source;
  source.onended=()=>{source.disconnect();if(messageSource===source)messageSource=null;};source.start();return true;
 }catch(err){status('Notification sound could not play. Use Test notification & sound in Settings to retry.');return false;}
}
function sound(kind){
 if(!soundsEnabled)return false;
 if(kind==='message')return playMessage();
 if(!context||context.state!=='running')return false;
 try{
 const t=context.currentTime;
 function tone(freq,start,length,volume,type='sine'){
 const o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.setValueAtTime(freq,t+start);g.gain.setValueAtTime(0,t+start);g.gain.linearRampToValueAtTime(volume,t+start+.015);g.gain.exponentialRampToValueAtTime(.0001,t+start+length);o.connect(g);g.connect(context.destination);o.start(t+start);o.stop(t+start+length+.03);o.onended=()=>{o.disconnect();g.disconnect();};
 }
 if(kind==='order'){tone(660,0,.18,.07);tone(880,.12,.3,.07);}
 else { [523,659,784,1047].forEach((f,i)=>tone(f,i*.16,.48,.07)); }
 return true;
 }catch{return false;/* Audio support must never interrupt an order or message. */}
}
function popup(title,text,onClick){
 const host=document.querySelector('dialog.matcha-mode[open]')||document.body;
 let stack=host.querySelector(':scope > .coffee-notifications');if(!stack){stack=document.createElement('div');stack.className='coffee-notifications';stack.setAttribute('aria-live','polite');stack.setAttribute('aria-label','Notifications');host.append(stack);}
 while(stack.children.length>=4)stack.firstElementChild.remove();
 const toast=document.createElement('section');toast.className='coffee-toast';
 const action=document.createElement('button');action.type='button';action.className='coffee-toast-open';const heading=document.createElement('strong');heading.textContent=title;const body=document.createElement('span');body.textContent=text;action.append(heading,body);action.onclick=()=>{if(onClick)onClick();else toast.remove();};
 const close=document.createElement('button');close.type='button';close.className='coffee-toast-close';close.textContent='×';close.setAttribute('aria-label','Dismiss notification');close.onclick=()=>toast.remove();toast.append(action,close);stack.append(toast);setTimeout(()=>toast.remove(),12000);
}
let controls,desktopError='',workerPromise;
function status(text){if(controls)controls.querySelector('[role=status]').textContent=text;}
function permission(){return window.Notification?.permission||'unsupported';}
function updatePermissionStatus(){
 const p=permission();
 status(desktopError||(p==='granted'?'Desktop notifications are allowed. Test the sound on this device.':p==='denied'?'Notifications are blocked. In Chrome site settings, allow Notifications, then test again.':p==='unsupported'?'This browser does not support desktop notifications here. In-page alerts and sound are still available.':'Message alerts are on by default. Allow Chrome notifications once to receive desktop alerts.'));
 if(controls){controls.querySelector('[data-enable-alerts]').hidden=p==='granted';const toggle=controls.querySelector('[data-toggle-sound]');toggle.textContent=soundsEnabled?'Disable sound':'Enable sound';toggle.setAttribute('aria-pressed',String(!soundsEnabled));}
 if(!soundsEnabled)status('Sound disabled. Visual notifications remain on.');
}
async function desktop(title,body,channel,tag,audible=false){
 if(permission()!=='granted')return false;
 const options={body,icon:'/favicon.svg',tag:tag||'coffeehouse-test',silent:true,data:{channel:channel||null}};
 try{
  // Persistent notifications support both desktop and mobile Chrome.
  if(navigator.serviceWorker){
   workerPromise ||= navigator.serviceWorker.register('/notification-worker.js').then(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Notification service did not start. Please retry.')),10000))])).catch(err=>{workerPromise=null;throw err;});
   const registration=await workerPromise;await registration.showNotification(title,options);
  }else{
   const notification=new window.Notification(title,options);notification.onclick=()=>{window.focus();if(channel)openConversation(channel);notification.close();};
  }
  desktopError='';return true;
 }catch(err){desktopError='Desktop notification failed: '+err.message;status(desktopError);return false;}
}
async function toggleSound(){
 soundsEnabled=!soundsEnabled;if(userKey)write(userKey+'-sound',soundsEnabled);
 if(!soundsEnabled){if(messageSource){messageSource.stop();messageSource.disconnect();messageSource=null;}if(context?.suspend)await context.suspend().catch(()=>{});}
 else await unlock();
 updatePermissionStatus();status(soundsEnabled?'Sound enabled.':'Sound disabled. Visual notifications remain on.');
}
async function enableDesktop(){
 const audioReady=unlock();let requested;
 try{
  // Call the permission API during the click, before awaiting anything.
  requested=permission()==='default'?window.Notification.requestPermission():Promise.resolve(permission());
  await requested;await audioReady;desktopError='';updatePermissionStatus();
  const played=await sound('message');
  if(permission()==='granted'){const shown=await desktop('CoffeeHouse notifications enabled','New messages will appear here while CoffeeHouse is open.',null,'coffeehouse-enabled',played);if(shown)status(played?'Notifications enabled. Coffee sound played.':(!soundsEnabled?'Notifications enabled. Sound is disabled.':'Notifications enabled. Sound is blocked; allow Sound in Chrome site settings.'));}
 }catch(err){status('Could not enable notifications: '+err.message);}
}
async function testAlerts(){
 const audioReady=await unlock(),played=await sound('message');popup('Notification test','This is how a new message will appear.');
 const shown=await desktop('CoffeeHouse notification test','Your desktop message notifications are working.',null,'coffeehouse-test',played);
 if(!soundsEnabled){status('Sound disabled. Visual notification test sent.');return;}
 if(shown)status(played?'Test notification sent and coffee sound played. If you heard nothing, check device volume and Chrome site Sound settings.':(!soundsEnabled?'Test notification sent. Sound is disabled.':'Test notification sent. Sound is blocked; check Chrome site Sound settings.'));
 else if(!desktopError)status(permission()==='denied'?'Desktop notifications are blocked. Allow Notifications in Chrome site settings.':permission()==='default'?'Click Enable desktop notifications, then choose Allow in Chrome.':audioReady?'Coffee sound played. Desktop notifications are unavailable in this browser.':'Sound is unavailable or blocked on this device.');
}
function mountControls(){
 const mount=document.getElementById('notificationSettings');if(controls||!mount)return;
 controls=document.createElement('section');controls.className='coffee-alert-settings';controls.setAttribute('aria-label','Message notifications');
 controls.innerHTML='<strong>Message notifications</strong><div><button type="button" class="btn" data-toggle-sound>Disable sound</button><button type="button" class="btn" data-enable-alerts>Enable desktop notifications & sound</button><button type="button" class="btn" data-test-alerts>Test notification & sound</button></div><p role="status"></p><small>Keep CoffeeHouse open to receive alerts. Right-click a conversation to mute it.</small>';
 mount.append(controls);
 controls.querySelector('[data-toggle-sound]').onclick=toggleSound;controls.querySelector('[data-enable-alerts]').onclick=enableDesktop;controls.querySelector('[data-test-alerts]').onclick=testAlerts;updatePermissionStatus();
}
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='coffeehouse-open-conversation'&&typeof e.data.channel==='string')openConversation(e.data.channel);});
function isMuted(channel){return muted[channel]===true;}
function updateMuteIndicators(){document.querySelectorAll('[data-notification-channel]').forEach(row=>{
 const off=isMuted(row.dataset.notificationChannel),icon=row.querySelector('.notification-muted');
 if(icon)icon.hidden=!off;
 row.title=(off?'Muted. Right-click to unmute':'Right-click to mute')+' notifications for '+row.dataset.notificationTitle;
});}
function bindMute(row,channel,title){
 row.dataset.notificationChannel=channel;row.dataset.notificationTitle=title;
 const icon=document.createElement('span');icon.className='notification-muted';icon.hidden=true;icon.setAttribute('role','img');icon.setAttribute('aria-label','Notifications muted');
 icon.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M2 7h4l5-4v14l-5-4H2z"/><path d="m14 7 4 6m0-6-4 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
 row.append(icon);if(!row.matches('button,a,[tabindex]'))row.tabIndex=0;
 const toggle=async e=>{e.preventDefault();e.stopPropagation();await ready;if(!userKey)return;muted=read(userKey+'-muted',{});muted[channel]=!isMuted(channel);write(userKey+'-muted',muted);updateMuteIndicators();};
 row.addEventListener('contextmenu',toggle);
 row.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10'))toggle(e);});
 queueMicrotask(updateMuteIndicators);
}
function openConversation(channel){
 if(document.querySelector('dialog.matcha-mode[open]')){popup('Finish your focus session','Use Cancel order to leave Matcha Mode before opening the conversation.');return;}
 if(window.CoffeeOpenConversation)Promise.resolve(window.CoffeeOpenConversation(channel)).catch(()=>popup('Could not open conversation','Please try again from Student Hall.'));
 else location.href='/student.html?conversation='+encodeURIComponent(channel);
}
async function poll(){
 if(!userKey||busy)return;busy=true;
 const run=async()=>{
  const focused=!document.hidden&&document.hasFocus(),active=read(userKey+'-active-tab',0);
  if(focused)write(userKey+'-active-tab',Date.now());else if(Date.now()-active<10000)return;
  const saved=read(userKey+'-cursor',null),recent=saved&&Date.now()-saved.time<60000&&Number.isSafeInteger(saved.cursor);
  const after=recent?Math.max(cursor||0,saved.cursor):cursor;
  const data=await api('/api/message-notifications'+(after!==null?'?after='+after:''));cursor=data.cursor;if(feedFailed){feedFailed=false;updatePermissionStatus();}
  write(userKey+'-cursor',{cursor:data.cursor,time:Date.now()});muted=read(userKey+'-muted',{});
  const messages=data.messages.filter(m=>!isMuted(m.channel));
  const played=messages.length?await sound('message'):false;
  for(const m of messages.slice(-4)){popup(m.title,m.author+': '+m.text,()=>openConversation(m.channel));await desktop('CoffeeHouse · '+m.title,m.author+': '+m.text,m.channel,'coffeehouse-message-'+m.id,played);}
 };
 try{if(navigator.locks)await navigator.locks.request(userKey+'-poll',{ifAvailable:true},lock=>lock?run():undefined);else await run();}catch{feedFailed=true;status('Message alerts could not connect. Retrying automatically…');}finally{busy=false;}
}
async function initialize(){try{const me=await api('/api/me');if(!me.user?.id||!me.school?.id)return;userKey='coffeehouse-alerts:'+me.user.id+':'+me.school.id;muted=read(userKey+'-muted',{});soundsEnabled=read(userKey+'-sound',true)!==false;updateMuteIndicators();mountControls();await poll();setInterval(poll,4000);}catch{setTimeout(initialize,10000);}}
const ready=initialize();
window.addEventListener('storage',e=>{if(userKey&&e.key===userKey+'-sound'){soundsEnabled=read(userKey+'-sound',true)!==false;if(!soundsEnabled&&context?.suspend)context.suspend().catch(()=>{});updatePermissionStatus();}if(userKey&&e.key===userKey+'-muted'){muted=read(userKey+'-muted',{});updateMuteIndicators();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
window.CoffeeAlerts={sound,popup,bindMute,isMuted,enableDesktop,testAlerts,desktop,toggleSound};
document.dispatchEvent(new Event('coffee-alerts-ready'));
})();
