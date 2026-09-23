const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('cafe sounds wait for interaction and use distinct order, completion and brew cues',async()=>{
 const listeners={},tones=[],sources=[],buffers=[];
 const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({connect(){},disconnect(){},start(){},stop(){}});
 class AudioContext{
 constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=1000;this.destination={};}
 resume(){this.state='running';return Promise.resolve();}
 createOscillator(){const o={...node(),frequency:parameter()};tones.push(o);return o;}
 createGain(){return {...node(),gain:parameter()};}
 createBuffer(_,size){const data=new Float32Array(size);buffers.push(data);return {getChannelData:()=>data};}
 createBufferSource(){const n=node();sources.push(n);return n;}
 createBiquadFilter(){return {...node(),frequency:parameter()};}
 }
 const window={AudioContext,addEventListener(){}};
 vm.runInNewContext(fs.readFileSync('public/notifications.js','utf8'),{window,Event,document:{dispatchEvent(){},addEventListener:(type,fn)=>listeners[type]=fn},api:async()=>({}),navigator:{},localStorage:{getItem:()=>null},setInterval(){},setTimeout(){},queueMicrotask,console});
 window.CoffeeAlerts.sound('order');assert.equal(tones.length,0);
 listeners.pointerdown();window.CoffeeAlerts.sound('order');assert.equal(tones.length,2);
 window.CoffeeAlerts.sound('complete');assert.equal(tones.length,6);
 window.CoffeeAlerts.sound('message');assert.equal(tones.length,8);assert.equal(sources.length,1);assert.equal(buffers[0].length,400);assert.equal(buffers[0][0],0);assert.equal(buffers[0].at(-1),0);
});
