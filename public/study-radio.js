'use strict';
(() => {
  const frame=document.querySelector('.study-radio iframe');
  if(!frame)return;
  // Session storage survives reloads and page navigation, without competing tabs.
  const key='coffeehouse.radio.v1';
  const stations={
    jazz:{list:'PL9ndRPYDuLTe4zuQo8B3kfignCJ1RYyT7',credit:'@ICYFOG'},
    hiphop:{list:'PL-oM23jv3aFJFCSy3WMirbB_xLVnyehrF',credit:'@DJ___NBA'},
    indie:{list:'PLhT4JwDPPf89IGvy-7JcK5U6tibi6IBvl',credit:'@napsea'}
  };
  let station='jazz';
  try{const choice=sessionStorage.getItem(key+'.station');if(Object.hasOwn(stations,choice))station=choice;}catch{}
  let playlist=stations[station].list;
  const stationButtons=Array.from(document.querySelectorAll('[data-station]'));
  const credit=document.querySelector('.study-radio figcaption a');
  function showStation(){
    if(credit){credit.textContent=stations[station].credit;credit.href='https://www.youtube.com/'+stations[station].credit;}
    stationButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.station===station)));
  }
  showStation();
  let saved=null,player,ready=false,playing=false,settled=false;
  const controls=Array.from(document.querySelectorAll('[data-radio]'));
  stationButtons.forEach(button=>button.addEventListener('click',()=>{
    if(!ready||button.dataset.station===station)return;
    station=button.dataset.station;playlist=stations[station].list;settled=false;playing=true;
    try{sessionStorage.setItem(key+'.station',station);sessionStorage.removeItem(key);}catch{}
    showStation();player.loadPlaylist({listType:'playlist',list:playlist,index:0,startSeconds:0});player.setLoop(true);
  }));
  function syncControls(){
    const active=[1,3].includes(player.getPlayerState());
    const toggle=controls.find(button=>button.dataset.radio==='toggle');
    if(toggle){toggle.textContent=active?'Ⅱ':'▶';toggle.title=active?'Pause music':'Play music';toggle.setAttribute('aria-label',toggle.title);}
  }
  controls.forEach(button=>button.addEventListener('click',()=>{
    if(!ready)return;
    const action=button.dataset.radio;
    if(action==='previous')player.previousVideo();
    else if(action==='next')player.nextVideo();
    else if(action==='toggle'){
      if([1,3].includes(player.getPlayerState()))player.pauseVideo();else player.playVideo();
    }else{
      const volume=player.isMuted()?0:player.getVolume();
      const next=Math.max(0,Math.min(100,volume+(action==='up'?10:-10)));
      player.setVolume(next);if(next>0)player.unMute();
    }
    persist();syncControls();
  }));
  try{
    const value=JSON.parse(sessionStorage.getItem(key));
    if(value?.playlist===playlist&&/^[\w-]{11}$/.test(value.video)&&Number.isFinite(value.time)&&value.time>=0&&Number.isInteger(value.index)&&value.index>=0&&Number.isFinite(value.volume)&&value.volume>=0&&value.volume<=100)saved=value;
  }catch{}
  const source=new URL(frame.src);
  source.searchParams.set('enablejsapi','1');
  source.searchParams.set('origin',location.origin);
  source.searchParams.set('list',playlist);
  if(station!=='jazz')source.pathname='/embed/videoseries';
  if(saved){
    source.pathname='/embed/'+saved.video;
    source.searchParams.set('start',String(Math.floor(saved.time)));
  }
  frame.src=source.href;
  function persist(){
    if(!ready||!settled)return;
    try{
      const video=new URL(player.getVideoUrl()).searchParams.get('v');
      const index=player.getPlaylistIndex(),time=player.getCurrentTime();
      if(!/^[\w-]{11}$/.test(video)||index<0||!Number.isFinite(time))return;
      sessionStorage.setItem(key,JSON.stringify({playlist,video,index,time,volume:player.getVolume(),muted:player.isMuted(),playing}));
    }catch{} // Storage restrictions must not interrupt playback.
  }
  function initialize(){
    player=new YT.Player(frame, {events:{
      onReady(event){
        player=event.target;ready=true;player.setLoop(true);
        controls.forEach(button=>button.disabled=false);
        stationButtons.forEach(button=>button.disabled=false);
        if(saved){
          player.setVolume(saved.volume);
          if(saved.muted)player.mute();else player.unMute();
          playing=saved.playing===true;
          const options={listType:'playlist',list:playlist,index:saved.index,startSeconds:saved.time};
          if(playing)player.loadPlaylist(options);else player.cuePlaylist(options);
        }
      },
      onStateChange(event){
        if(event.data===1){playing=true;settled=true;}
        else if(event.data===2){playing=false;settled=true;}
        // A cued/restoring player can report time zero; preserve the saved offset
        // until real playback or an explicit pause supplies a reliable position.
        persist();syncControls();
      },
      onAutoplayBlocked(){ /* Native Play control resumes the restored video. */ }
    }});
  }
  if(window.YT?.Player)initialize();
  else{
    const previous=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{if(previous)previous();initialize();};
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;document.head.appendChild(script);
  }
  setInterval(persist,1000);
  window.addEventListener('pagehide',persist);
  document.addEventListener('visibilitychange',persist);
})();
