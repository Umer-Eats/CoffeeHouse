const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(){
 const listeners={},tones=[],sources=[],requests=[];let fail=false;
 const parameter=()=>({setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}});
 const decoded={duration:4};
 class AudioContext{
 constructor(){this.state='suspended';this.currentTime=0;this.destination={};}
 resume(){this.state='running';return Promise.resolve();}
 createOscillator(){const o={...node(),frequency:parameter()};tones.push(o);return o;}
 createGain(){return {...node(),gain:parameter()};}
 decodeAudioData(bytes){assert.ok(bytes.byteLength>0);return Promise.resolve(decoded);}
 createBufferSource(){const n=node();sources.push(n);return n;}
 }
 const window={AudioContext,addEventListener(){}};
 vm.runInNewContext(fs.readFileSync('public/notifications.js','utf8'),{window,Event,AbortSignal,document:{dispatchEvent(){},addEventListener:(type,fn)=>listeners[type]=fn},api:async()=>({}),fetch:async url=>{requests.push(url);if(fail)throw Error('Network unavailable');return {ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};},navigator:{},localStorage:{getItem:()=>null},setInterval(){},setTimeout(){},queueMicrotask,console});
 return {alerts:window.CoffeeAlerts,listeners,tones,sources,requests,decoded,fail:()=>{fail=true;},recover:()=>{fail=false;}};
}
test('message sound plays the bundled MP3, caches decoding, and replaces overlapping playback',async()=>{
 const h=harness();assert.equal(await h.alerts.sound('message'),false);assert.equal(h.requests.length,0);
 await h.listeners.pointerdown();h.alerts.sound('order');assert.equal(h.tones.length,2);h.alerts.sound('complete');assert.equal(h.tones.length,6);
 assert.equal(await h.alerts.sound('message'),true);assert.equal(h.requests[0],'/sounds/message-notification.mp3?v=1');assert.equal(h.sources[0].buffer,h.decoded);assert.equal(h.sources[0].started,true);assert.equal(h.tones.length,6);
 await h.alerts.sound('message');assert.equal(h.requests.length,1);assert.equal(h.sources[0].stopped,true);assert.equal(h.sources[1].started,true);
});
test('failed MP3 loads do not throw and can retry successfully',async()=>{
 const h=harness();await h.listeners.pointerdown();h.fail();assert.equal(await h.alerts.sound('message'),false);h.recover();assert.equal(await h.alerts.sound('message'),true);assert.equal(h.requests.length,2);
});
test('notification MP3 is a bundled nonempty audio asset',()=>{const bytes=fs.readFileSync('public/sounds/message-notification.mp3');assert.ok(bytes.length>1000);assert.ok(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255);});
