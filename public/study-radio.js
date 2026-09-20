'use strict';
(() => {
  const frame=document.querySelector('.study-radio iframe');
  if(!frame)return;
  const key='coffeehouse.radio.v1';
  const stations={
    jazz:{list:'PL9ndRPYDuLTe4zuQo8B3kfignCJ1RYyT7',credit:'@ICYFOG'},
    hiphop:{list:'PL-oM23jv3aFJFCSy3WMirbB_xLVnyehrF',credit:'@DJ___NBA'},
    lockin:{list:'PLHXjm-OqioH0',credit:'@productivityonyt'},
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
  let saved=null,player,ready=false,playing=false,settled=false,pendingPause=false;
  const controls=Array.from(document.querySelectorAll('[data-radio]'));

  function persist(){
    if(!ready||!settled)return;
    try{
      const video=new URL(player.getVideoUrl()).searchParams.get('v');
      const index=player.getPlaylistIndex(),time=player.getCurrentTime();
      if(!/^[\w-]{11}$/.test(video)||index<0||!Number.isFinite(time))return;
      sessionStorage.setItem(key,JSON.stringify({playlist,video,index,time,volume:player.getVolume(),muted:player.isMuted(),playing}));
    }catch{}
  }

  function syncControls(){
    const toggle=controls.find(button=>button.dataset.radio==='toggle');
    if(toggle){toggle.textContent=playing?'Ⅱ':'▶';toggle.title=playing?'Pause music':'Play music';toggle.setAttribute('aria-label',toggle.title);}
  }

  function initialize(){
    player=new YT.Player(frame,{events:{
      onReady(event){
        player=event.target;ready=true;player.setLoop(true);
        controls.forEach(button=>button.disabled=false);
        stationButtons.forEach(button=>button.disabled=false);
        if(saved){
          player.setVolume(saved.volume);
          if(saved.muted)player.mute();else player.unMute();
          playing=saved.playing===true;
          const options={list:playlist,index:saved.index,startSeconds:saved.time};
          if(playing)player.loadPlaylist(options);else player.cuePlaylist(options);
        }
        syncControls();
      },
      onStateChange(event){
        if(event.data===1){
          if(pendingPause){player.pauseVideo();playing=false;pendingPause=false;}
          else{playing=true;}
          settled=true;
        }
        else if(event.data===2){playing=false;settled=true;pendingPause=false;}
        persist();syncControls();
      },
      onAutoplayBlocked(){}
    }});
  }

  stationButtons.forEach(button=>button.addEventListener('click',()=>{
    if(!ready||button.dataset.station===station)return;
    station=button.dataset.station;playlist=stations[station].list;settled=false;
    try{sessionStorage.setItem(key+'.station',station);sessionStorage.removeItem(key);}catch{}
    showStation();
    const source=new URL(frame.src);
    source.searchParams.set('list',playlist);
    source.searchParams.delete('start');
    frame.src=source.href;
    ready=false;
    if(window.YT?.Player)initialize();
  }));

  controls.forEach(button=>button.addEventListener('click',()=>{
    if(!ready)return;
    const action=button.dataset.radio;
    if(action==='previous'){
      player.previousVideo();
      if(!playing)pendingPause=true;
    }else if(action==='next'){
      player.nextVideo();
      if(!playing)pendingPause=true;
    }else if(action==='toggle'){
      if(playing){player.pauseVideo();playing=false;pendingPause=false;}
      else{player.playVideo();playing=true;}
    }else{
      try{
        const vol=player.isMuted()?0:player.getVolume();
        const next=Math.max(0,Math.min(100,vol+(action==='up'?10:-10)));
        player.setVolume(next);if(next>0)player.unMute();
      }catch{}
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
  source.searchParams.set('controls','0');
  if(station!=='jazz')source.pathname='/embed/videoseries';
  if(saved){
    source.pathname='/embed/'+saved.video;
    source.searchParams.set('start',String(Math.floor(saved.time)));
  }
  frame.src=source.href;

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
