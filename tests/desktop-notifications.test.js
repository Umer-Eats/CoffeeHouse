const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(worker=false){
 const calls=[];class Notification{static permission='default';static requestPermission(){calls.push('permission');Notification.permission='granted';return Promise.resolve('granted');}constructor(title,options){calls.push({title,options});}}
 const registration={showNotification:async(title,options)=>calls.push({title,options})};
 const navigator=worker?{serviceWorker:{addEventListener(){},register:async url=>{calls.push(url);return registration;},ready:Promise.resolve(registration)}}:{};
 const window={Notification,addEventListener(){}};
 vm.runInNewContext(fs.readFileSync('public/notifications.js','utf8'),{window,Event,document:{dispatchEvent(){},addEventListener(){}},api:async()=>({}),navigator,localStorage:{getItem:()=>null},setInterval(){},setTimeout(){},queueMicrotask,console});
 return {alerts:window.CoffeeAlerts,Notification,calls};
}
test('desktop alerts request permission only on explicit enable and suppress the separate system notification sound',async()=>{
 const {alerts,Notification,calls}=setup();assert.equal(calls.length,0);
 assert.equal(await alerts.desktop('DM','Hello','dm:2','message-1'),false);assert.equal(calls.length,0);
 const pending=alerts.enableDesktop();assert.equal(calls[0],'permission');await pending;
 assert.equal(Notification.permission,'granted');assert.equal(calls[1].options.silent,true);
 await alerts.desktop('DM','Hello','dm:2','message-2',true);assert.equal(calls[2].options.silent,true);assert.equal(calls[2].options.data.channel,'dm:2');
 Notification.permission='denied';assert.equal(await alerts.desktop('DM','Hidden'),false);assert.equal(calls.length,3);
});
test('supported browsers deliver through service worker persistent notifications',async()=>{
 const {alerts,Notification,calls}=setup(true);Notification.permission='granted';
 assert.equal(await alerts.desktop('CoffeeHouse · Jamie','Hi','dm:2','message-3',false),true);
 assert.equal(calls[0],'/notification-worker.js');assert.equal(calls[1].title,'CoffeeHouse · Jamie');assert.equal(calls[1].options.data.channel,'dm:2');assert.equal(calls[1].options.silent,true);
 await alerts.desktop('Again','Hi','dm:2','message-4');assert.equal(calls.filter(c=>typeof c==='string').length,1);
});
test('disabling sound does not disable desktop notifications',async()=>{
 const {alerts,Notification,calls}=setup();Notification.permission='granted';await alerts.toggleSound();
 assert.equal(await alerts.sound('message'),false);assert.equal(await alerts.desktop('Message','Hello','dm:2','muted-sound-test'),true);
 assert.equal(calls[0].options.silent,true);assert.equal(calls[0].title,'Message');
});
