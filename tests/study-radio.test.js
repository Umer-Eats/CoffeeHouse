const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const script=fs.readFileSync(require('node:path').join(__dirname,'../public/study-radio.js'),'utf8');
function boot(saved){
  let stored=saved,events,tick,loaded,cued;
  const frame={src:'https://www.youtube-nocookie.com/embed/lSLwapzJNaE?list=PL9ndRPYDuLTe4zuQo8B3kfignCJ1RYyT7'};
  const controls=['previous','next','toggle','up','down'].map(action=>({dataset:{radio:action},setAttribute(){},addEventListener(type,fn){this.click=fn;}}));
  const player={setLoop(){},setVolume(v){this.volume=v;},mute(){this.muted=true;},unMute(){this.muted=false;},loadPlaylist(v){loaded=v;},cuePlaylist(v){cued=v;},getVideoUrl:()=> 'https://www.youtube.com/watch?v=lSLwapzJNaE',getPlaylistIndex:()=>3,getCurrentTime:()=>123,getVolume:()=>42,isMuted:()=>true};
  const context={URL,sessionStorage:{getItem:()=>stored,setItem:(k,v)=>stored=v},location:{origin:'https://www.coffee-house.app'},document:{querySelector:()=>frame,addEventListener(){}},window:{YT:{Player:true},addEventListener(){}},YT:{Player:function(f,opts){events=opts.events;return player;}},setInterval(fn){tick=fn;}};
  context.document.querySelectorAll=()=>controls;
  player.getPlayerState=()=>player.state||2;
  player.previousVideo=()=>player.previous=true;
  player.nextVideo=()=>player.next=true;
  player.playVideo=()=>player.state=1;
  player.pauseVideo=()=>player.state=2;
  vm.runInNewContext(script,context);events.onReady({target:player});
  return {player,events,tick,controls,stored:()=>stored,loaded:()=>loaded,cued:()=>cued};
}
const saved=playing=>JSON.stringify({playlist:'PL9ndRPYDuLTe4zuQo8B3kfignCJ1RYyT7',video:'lSLwapzJNaE',index:3,time:123,volume:42,muted:true,playing});
test('controls skip tracks, toggle playback and clamp player-only volume',()=>{
  const app=boot(null),p=app.player;
  const click=action=>app.controls.find(b=>b.dataset.radio===action).click();
  click('previous');click('next');assert(p.previous&&p.next);
  click('toggle');assert.equal(p.state,1);click('toggle');assert.equal(p.state,2);
  p.isMuted=()=>false;p.getVolume=()=>95;click('up');assert.equal(p.volume,100);
  p.getVolume=()=>5;click('down');assert.equal(p.volume,0);
  p.isMuted=()=>true;click('up');assert.equal(p.volume,10);assert.equal(p.muted,false);
});
test('restores playing track, offset, volume and mute',()=>{
  const app=boot(saved(true));assert.equal(app.loaded().index,3);assert.equal(app.loaded().startSeconds,123);assert.equal(app.player.volume,42);assert.equal(app.player.muted,true);
});
test('paused track stays cued and is not overwritten before playback',()=>{
  const app=boot(saved(false));assert.equal(app.loaded(),undefined);assert.equal(app.cued().startSeconds,123);app.tick();assert.equal(app.stored(),saved(false));
});
test('saves playing and paused states; malformed storage does not break player',()=>{
  const app=boot('broken');app.events.onStateChange({data:1});app.tick();assert.equal(JSON.parse(app.stored()).playing,true);app.events.onStateChange({data:2});assert.equal(JSON.parse(app.stored()).playing,false);
});
