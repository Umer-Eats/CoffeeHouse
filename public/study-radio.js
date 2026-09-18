'use strict';
(() => {
  const frame=document.querySelector('.study-radio iframe');
  if(!frame)return;
  // Session storage survives reloads and page navigation, without competing tabs.
  const key='coffeehouse.radio.v1';
  const playlist='PLYs708nM2aGMhTE4jTvFMVKR04SfmdJMb';
  let saved=null,player,ready=false,playing=false,settled=false;
  try{
    const value=JSON.parse(sessionStorage.getItem(key));
    if(value?.playlist===playlist&&/^[\w-]{11}$/.test(value.video)&&Number.isFinite(value.time)&&value.time>=0&&Number.isInteger(value.index)&&value.index>=0&&Number.isFinite(value.volume)&&value.volume>=0&&value.volume<=100)saved=value;
  }catch{}
  const source=new URL(frame.src);
  source.searchParams.set('enablejsapi','1');
  source.searchParams.set('origin',location.origin);
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
        persist();
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
