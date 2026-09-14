/* Animate the existing painting in source-image coordinates, keeping UI separate. */
'use strict';
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  try { paused = localStorage.getItem('ch-scenery-paused') === 'true'; } catch (_) {}
  document.documentElement.dataset.sceneryPaused = String(paused);
  const hosts = [...document.querySelectorAll('.cafe, .cafe-window')];
  if (!hosts.length && document.body.matches('.hall-page,.study-page,.settings-page')) hosts.push(document.body);
  if (!hosts.length) return;
  const toggle = document.createElement('button');
  toggle.className = 'motion-control';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Pause decorative animation');
  function updateControl() {
    toggle.setAttribute('aria-pressed', String(paused || reduced.matches));
    toggle.textContent = reduced.matches ? 'Reduced motion on' : paused ? 'Resume scenery' : 'Pause scenery';
    toggle.disabled = reduced.matches;
  }
  toggle.addEventListener('click', () => {
    paused = !paused;
    document.documentElement.dataset.sceneryPaused = String(paused);
    try { localStorage.setItem('ch-scenery-paused', String(paused)); } catch (_) {}
    updateControl();
    schedule();
  });
  document.body.appendChild(toggle);
  updateControl();
  const scenes = [];
  let frame = 0, previous = 0, clock = 0;
  const isDark = () => (document.body.dataset.theme || document.documentElement.dataset.theme) === 'dark';

  // Region positions refer to the supplied 1751 × 898 café paintings.
  const regions = {
    light: [[245,0,122,348],[478,0,74,137],[1104,0,154,225],[1274,0,174,159],[0,639,306,259],[1560,563,191,335]],
    dark: [[95,0,185,170],[356,0,276,177],[1170,0,325,210],[1520,0,200,175],[0,664,300,234],[1545,754,206,144]]
  };
  function draw(scene, time) {
    const {ctx, image, kind} = scene;
    ctx.clearRect(0, 0, 1751, 898);
    ctx.drawImage(image, 0, 0, 1751, 898);
    if (reduced.matches || paused) return;
    // Small strip displacements taper to zero at the region boundaries. The
    // original painting stays underneath, so no transparent gaps can appear.
    regions[kind].forEach(([x,y,w,h], index) => {
      ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
      for (let row=0; row<h; row+=6) {
        const height = Math.min(6,h-row);
        const sway = Math.sin(time*.75 + index + row/h) * 2.2 * Math.sin(Math.PI*row/h);
        ctx.drawImage(image,x,y+row,w,height,x+sway,y+row,w,height);
      }
      ctx.restore();
    });
    // The sleeping cat breathes gently; paws stay planted on the stool.
    const cat = kind === 'light' ? [1446,587,174,76] : [1447,634,161,82];
    const [cx,cy,cw,ch] = cat;
    const breath = (1 + Math.sin(time*1.25)) * 1.15;
    ctx.drawImage(image,cx,cy,cw,ch,cx,cy-breath,cw,ch+breath);
    const lamps = kind === 'light' ? [[408,161],[1317,226]] : [[333,204],[1642,670]];
    lamps.forEach(([x,y],i) => {
      const glow = ctx.createRadialGradient(x,y,1,x,y,38);
      glow.addColorStop(0,`rgba(255,204,109,${.12+.06*Math.sin(time*1.3+i)})`);
      glow.addColorStop(1,'rgba(255,204,109,0)');
      ctx.fillStyle=glow; ctx.fillRect(x-38,y-38,76,76);
    });
    // Occasional sleep marks, cup steam, and pixel dust / cherry petals.
    ctx.font='12px monospace'; ctx.fillStyle=kind==='light'?'#fff0cf':'#d3b6ee';
    ctx.globalAlpha=Math.max(0,Math.sin(time*.6));
    ctx.fillText('z',cx+cw*.48,cy-7-(time%5)*3); ctx.globalAlpha=1;
    for(let i=0;i<9;i++) {
      const x=480+((i*139+Math.sin(time*.4+i)*20)%800);
      const y=80+((time*(kind==='dark'?13:4)+i*57)%430);
      ctx.globalAlpha=.2+.2*Math.sin(time+i)**2;
      ctx.fillStyle=kind==='dark'?'#efa8d1':'#fff5ce';
      ctx.fillRect(x,y,kind==='dark'?5:2,kind==='dark'?3:2);
    }
    ctx.globalAlpha=.35;
    const steamX=kind==='light'?653:626, steamY=kind==='light'?487:536;
    ctx.fillStyle=kind==='light'?'#fff0cf':'#dfbcea';
    for(let i=0;i<3;i++) ctx.fillRect(steamX+Math.sin(time*1.2+i)*4,steamY-8-((time*8+i*8)%28),2,5);
    ctx.globalAlpha=1;
  }
  function fit(scene) {
    const host=scene.host;
    const w=host===document.body?innerWidth:host.clientWidth;
    const h=host===document.body?innerHeight:host.clientHeight;
    const scale=Math.max(w/1751,h/898);
    Object.assign(scene.canvas.style,{width:`${1751*scale}px`,height:`${898*scale}px`,left:`${(w-1751*scale)/2}px`,top:`${(h-898*scale)/2}px`});
  }
  function tick(now) {
    frame=0;
    if(document.hidden || paused || reduced.matches) { previous=0; return; }
    if(now-previous>=1000/15) {
      clock+=Math.min((now-previous)/1000,.1); previous=now;
      const kind=isDark()?'dark':'light';
      scenes.forEach(scene=>{if(scene.visible && scene.kind===kind) draw(scene,clock);});
    }
    schedule();
  }
  function schedule() {
    if(!frame && !document.hidden && !paused && !reduced.matches && scenes.some(s=>s.visible)) frame=requestAnimationFrame(tick);
  }
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>scenes.filter(s=>s.host===entry.target).forEach(s=>{s.visible=entry.isIntersecting;}));
    schedule();
  });
  hosts.forEach(host=>{
    const root=document.createElement('div'); root.className='living-scene'; root.setAttribute('aria-hidden','true');
    host.prepend(root);
    ['light','dark'].forEach(kind=>{
      const layer=document.createElement('div'); layer.className='scene-layer'; layer.dataset.scene=kind;
      const canvas=document.createElement('canvas'); canvas.width=1751; canvas.height=898;
      const ctx=canvas.getContext('2d'); if(!ctx) return;
      ctx.imageSmoothingEnabled=false;
      const image=new Image();
      image.onload=()=>{
        const scene={host,canvas,ctx,image,kind,visible:true}; scenes.push(scene);
        draw(scene,0); fit(scene); layer.appendChild(canvas);
        if(host===document.body) host.classList.add('has-living-scene'); else host.classList.add('scene-host');
        schedule();
      };
      image.src=`/images/cafe-scenery-${kind==='light'?'day':'night'}.png`;
      root.appendChild(layer);
    });
    observer.observe(host);
    new ResizeObserver(()=>scenes.filter(s=>s.host===host).forEach(fit)).observe(host);
  });
  addEventListener('resize',()=>scenes.forEach(fit));
  document.addEventListener('visibilitychange',()=>{previous=0;schedule();});
  reduced.addEventListener('change',()=>{updateControl();scenes.forEach(s=>draw(s,0));schedule();});
})();
