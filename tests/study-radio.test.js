const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const script=fs.readFileSync(require('node:path').join(__dirname,'../public/study-radio.js'),'utf8');
function boot(saved){
  let stored=saved,events,tick,loaded,cued;
  const frame={src:'https://www.youtube-nocookie.com/embed/EjrZsN4Eb5Q?list=PLYs708nM2aGMhTE4jTvFMVKR04SfmdJMb'};
  const player={setLoop(){},setVolume(v){this.volume=v;},mute(){this.muted=true;},unMute(){this.muted=false;},loadPlaylist(v){loaded=v;},cuePlaylist(v){cued=v;},getVideoUrl:()=> 'https://www.youtube.com/watch?v=EjrZsN4Eb5Q',getPlaylistIndex:()=>3,getCurrentTime:()=>123,getVolume:()=>42,isMuted:()=>true};
  const context={URL,sessionStorage:{getItem:()=>stored,setItem:(k,v)=>stored=v},location:{origin:'https://www.coffee-house.app'},document:{querySelector:()=>frame,addEventListener(){}},window:{YT:{Player:true},addEventListener(){}},YT:{Player:function(f,opts){events=opts.events;return player;}},setInterval(fn){tick=fn;}};
  vm.runInNewContext(script,context);events.onReady({target:player});
  return {player,events,tick,stored:()=>stored,loaded:()=>loaded,cued:()=>cued};
}
const saved=playing=>JSON.stringify({playlist:'PLYs708nM2aGMhTE4jTvFMVKR04SfmdJMb',video:'EjrZsN4Eb5Q',index:3,time:123,volume:42,muted:true,playing});
test('restores playing track, offset, volume and mute',()=>{
  const app=boot(saved(true));assert.equal(app.loaded().index,3);assert.equal(app.loaded().startSeconds,123);assert.equal(app.player.volume,42);assert.equal(app.player.muted,true);
});
test('paused track stays cued and is not overwritten before playback',()=>{
  const app=boot(saved(false));assert.equal(app.loaded(),undefined);assert.equal(app.cued().startSeconds,123);app.tick();assert.equal(app.stored(),saved(false));
});
test('saves playing and paused states; malformed storage does not break player',()=>{
  const app=boot('broken');app.events.onStateChange({data:1});app.tick();assert.equal(JSON.parse(app.stored()).playing,true);app.events.onStateChange({data:2});assert.equal(JSON.parse(app.stored()).playing,false);
});
