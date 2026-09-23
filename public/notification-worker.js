/* Displays browser notifications only; no cached pages or background push subscription. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const channel=event.notification.data?.channel;
 if(channel!==null&&channel!==undefined&&(typeof channel!=='string'||!/^(dm:[1-9]\d*|channel:[\w:-]+)$/.test(channel)))return;
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const page=windows.find(w=>{const u=new URL(w.url);return u.origin===self.location.origin&&['/student.html','/settings.html','/ai-assistant.html'].includes(u.pathname);});
  if(page){await page.focus();if(channel)page.postMessage({type:'coffeehouse-open-conversation',channel});}
  else await self.clients.openWindow('/student.html'+(channel?'?conversation='+encodeURIComponent(channel):''));
 })());
});
