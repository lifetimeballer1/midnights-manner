import {resourceSpriteNames} from './resources.js';
import {Game} from './game.js';
import {PatchNotes} from './patchnotes.js';
import {GameUpdates} from './updates.js';
import {Renderer} from './renderer.js';
import {UI} from './ui.js';
import {MapInput} from './input.js';
import {unlock, isMuted} from './systems/audio.js';
import {AmbiencePlayer, ambienceProfile, soundtrackMood} from './systems/ambience.js';
import {MusicPlayer} from './music.js';
import {AmbientScoreEngine} from './audio.js';

async function boot(){
 const names=['world','troops','items','abilities','buildings','missions','quests','levels','rumors','names','legends','calendar','traders','biomes','expansion','updates','artifacts','endgame','music','festivals','conquest'];
 const data=Object.fromEntries(await Promise.all(names.map(async name=>{const response=await fetch(new URL(`../data/${name}.json`,import.meta.url));if(!response.ok)throw Error(`Could not load ${name}`);return [name,await response.json()];})));

 // Optional ambient score (C418-style reactive tracks). Fail soft if missing.
 let ambientScore=null;
 try{
  const res=await fetch(new URL('../data/ambient-score.json',import.meta.url));
  if(res.ok) ambientScore=await res.json();
 }catch{}

 const sprites=[...Object.values(data.buildings).flatMap(b=>b.tiers.map(t=>t.sprite)),...Object.values(data.troops).map(t=>t.sprite),...Object.values(data.items).map(i=>i.sprite),'raider.png',...resourceSpriteNames];
 const images=Object.fromEntries(await Promise.all([...new Set(sprites)].map(name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([name,image]);image.onerror=()=>reject(Error(`Missing sprite: ${name}`));image.src=new URL(`../assets/sprites/${name}`,import.meta.url).href;}))));
 const canvas=document.querySelector('#world'),game=new Game(data),renderer=new Renderer(canvas,data,images);
 const resize=()=>{const rect=canvas.getBoundingClientRect();renderer.resize(rect.width,rect.height,window.devicePixelRatio||1);};resize();renderer.fitVillage(game.world);

 const music=new MusicPlayer(data.music);
 const ambient=new AmbientScoreEngine();
 if(ambientScore) ambient.loadScore(ambientScore);
 const ambience=new AmbiencePlayer(game),moodMemory={};
 music.setMood(soundtrackMood(game.world,data,{memory:moodMemory,vlevel:game.state.vlevel}));

 const ui=new UI(game,renderer,music);new MapInput(canvas,renderer,ui);new GameUpdates(game);new PatchNotes(game,ui);
 new ResizeObserver(resize).observe(canvas);
 try{if(new URLSearchParams(location.search).has('perf')){const badge=document.createElement('div');badge.id='perf';document.body.appendChild(badge);setInterval(()=>{const r=renderer.frameReport();if(r)badge.textContent='frame avg '+r.avg+'ms · p50 '+r.p50+'ms · p95 '+r.p95+'ms · n='+r.n+' · faces '+r.faces+' · '+(renderer.staticLayer?'cached':'uncached');},500);}}catch{}

 // When the player hits Begin, start the ambient score and pause the old theme player
 // so the two systems never layer on top of each other.
 let ambientSessionStarted=false;
 const originalBegin=document.querySelector('#begin')?.onclick;
 const beginBtn=document.querySelector('#begin');
 if(beginBtn){
  const prev=beginBtn.onclick;
  beginBtn.onclick=function(...args){
   if(typeof prev==='function') prev.apply(this,args);
   if(!ambientSessionStarted && ambientScore){
    ambientSessionStarted=true;
    // Hand soundtrack duty to the ambient engine.
    try{music.stop();}catch{}
    ambient.start(ambientScore);
    ambient.updateGameState(stateFromWorld(game, data));
   }
  };
 }

 // Keep mute button in sync for ambient as well (UI already toggles music).
 const soundBtn=document.querySelector('#opt-sound');
 if(soundBtn){
  const prevSound=soundBtn.onclick;
  soundBtn.onclick=function(...args){
   if(typeof prevSound==='function') prevSound.apply(this,args);
   ambient.setEnabled(!isMuted());
  };
 }

 window.addEventListener('pointerdown',()=>unlock(),{passive:true});window.addEventListener('keydown',()=>unlock());
 let last=performance.now(),accumulator=0;
 document.addEventListener('visibilitychange',()=>{if(document.hidden){game.persist();ambience.reset();}last=performance.now();accumulator=0;});window.addEventListener('pagehide',()=>game.persist());

 function stateFromWorld(g, d){
  const profile=ambienceProfile(g.world, d);
  const mood=soundtrackMood(g.world, d, {memory:moodMemory, vlevel:g.state.vlevel});
  return {
   inRaid: Boolean(profile.raid),
   raidPending: Boolean(profile.warning),
   isNight: Boolean(profile.night),
   isDawn: profile.phase === 'dawn' || mood === 'dawn',
   // Victory / endgame flags if present on world or state
   isVictory: Boolean(g.world?.victory || g.state?.victory || g.state?.phase === 'victory'),
  };
 }

 function frame(now){
  const dt=Math.min((now-last)/1000,.15);last=now;
  if(!document.hidden){
   accumulator+=dt;
   while(accumulator>=.05){game.tick(.05);accumulator-=.05;}
   const mood=soundtrackMood(game.world,data,{memory:moodMemory,vlevel:game.state.vlevel});
   music.setMood(mood);
   if(ambient.started){
    ambient.updateGameState(stateFromWorld(game, data));
   }
   ui.tick(dt);
   if(ui.started)ambience.tick();
   renderer.draw(game.world,now);
  }
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);

 // Read-only hooks keep real-input browser tests independent of camera constants.
 // setElapsed/setCamera are test-only drivers for the look-capture harness:
 // they set transient view/clock state, never saves, rules or placement.
 window.midnightsManner={snapshot:()=>structuredClone(game.state),modelPoints:id=>(renderer.sceneFaces||[]).filter(f=>f.owner?.id===id).map(f=>({x:f.points.reduce((n,p)=>n+p.x,0)/f.points.length,y:f.points.reduce((n,p)=>n+p.y,0)/f.points.length})).filter(p=>renderer.pick(p.x,p.y)?.id===id),pick:(x,y)=>{const hit=renderer.pick(x,y);return hit?{...hit}:null;},collectionBubbles:()=>renderer.hitAreas.filter(h=>h.kind==='harvest').map(h=>({...h})),project:(x,y)=>renderer.project(x,y),camera:()=>({...renderer.cam}),frameReport:()=>renderer.frameReport(),get paused(){return game.paused;},get ready(){return ui.started;},setElapsed:seconds=>{const t=Number(seconds);if(Number.isFinite(t)&&t>=0)game.world.elapsed=t;},setCamera:({yaw,pitch,zoom,x,y}={})=>{const cam=renderer.cam;if(Number.isFinite(yaw))cam.yaw=yaw;if(Number.isFinite(pitch))cam.pitch=pitch;if(Number.isFinite(zoom)&&zoom>0)renderer.zoomBy(zoom/cam.zoom);if(Number.isFinite(x))cam.x=x;if(Number.isFinite(y))cam.y=y;},ambientTrack:()=>ambient.currentTrackKey};
}
boot().catch(error=>{console.error(error);document.querySelector('#fatal').hidden=false;document.querySelector('#fatal').textContent=`The village could not load: ${error.message}. Refresh to retry. If running locally, serve the game over HTTP.`;});
