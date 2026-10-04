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
import {attachQuality} from './fx/quality.js';

async function boot(){
 const names=['world','troops','items','abilities','buildings','missions','quests','levels','rumors','names','legends','calendar','traders','biomes','expansion','updates','artifacts','endgame','music','festivals','conquest','art-manifest'];
 const data=Object.fromEntries(await Promise.all(names.map(async name=>{const response=await fetch(new URL(`../data/${name}.json`,import.meta.url));if(!response.ok)throw Error(`Could not load ${name}`);return [name,await response.json()];})));

 let ambientScore=null;
 try{
  const res=await fetch(new URL('../data/ambient-score.json',import.meta.url));
  if(res.ok) ambientScore=await res.json();
 }catch{}

  const sprites=[...Object.values(data.buildings).flatMap(b=>b.tiers.map(t=>t.sprite)),...Object.values(data.troops).map(t=>t.sprite),...Object.values(data.items).map(i=>i.sprite),'raider.png',...resourceSpriteNames];
  // Converted art meshes: only manifest-enabled entries load, and only once.
  // Disabled entries cost nothing at runtime; missing files fall back silently.
  const meshes={};
  try{
   const manifest=data['art-manifest'];
   if(manifest)for(const [id,entry] of Object.entries(manifest.meshes||{})){
    if(!entry?.enabled)continue;
    try{const res=await fetch(new URL('../'+entry.file,import.meta.url));if(res.ok)meshes[id]=await res.json();}catch{}
   }
   // Baked hand-gear sub-meshes preload the same way, keyed gear-<name>.
   if(manifest)for(const [id,entry] of Object.entries(manifest.gear||{})){
    if(!entry?.enabled)continue;
    try{const res=await fetch(new URL('../'+entry.file,import.meta.url));if(res.ok)meshes[`gear-${id}`]=await res.json();}catch{}
   }
   // R3 baked character sets preload the same way, keyed <set>-<pose>-<lod>.
   if(manifest)for(const [id,entry] of Object.entries(manifest.baked||{})){
    if(!entry?.enabled)continue;
    for(const [key,file] of Object.entries(entry.poses||{})){
     try{const res=await fetch(new URL('../'+file,import.meta.url));if(res.ok)meshes[`${id}-${key}`]=await res.json();}catch{}
    }
   }
  }catch{}
 const images=Object.fromEntries(await Promise.all([...new Set(sprites)].map(name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([name,image]);image.onerror=()=>reject(Error(`Missing sprite: ${name}`));image.src=new URL(`../assets/sprites/${name}`,import.meta.url).href;}))));
  const canvas=document.querySelector('#world'),game=new Game(data),renderer=new Renderer(canvas,data,images);
  renderer.meshes=meshes;
  attachQuality(renderer);
  const resize=()=>{const rect=canvas.getBoundingClientRect();renderer.resize(rect.width,rect.height,window.devicePixelRatio||1);};resize();renderer.fitVillage(game.world);

  const music=new MusicPlayer(data.music);
 const ambient=new AmbientScoreEngine();
 if(ambientScore) ambient.loadScore(ambientScore);
 const ambience=new AmbiencePlayer(game),moodMemory={};
 music.setMood(soundtrackMood(game.world,data,{memory:moodMemory,vlevel:game.state.vlevel}));

 // Calm moods play the keeper soundtrack (AmbientScoreEngine); battle moods
 // stay on the legacy generative engine (music.json battle themes).
 const CALM_MOODS=new Set(['day','night','dawn','weather','prosperous','calm','upbeat']);
 const calmMood=mood=>CALM_MOODS.has(mood);
 let usingAmbient=false;
 let playGenerative=()=>{}, playAmbient=()=>{};
 if(ambientScore){
  const origStart=music.start.bind(music);
  playGenerative=opts=>{usingAmbient=false;ambient.stop();origStart(opts);};
  playAmbient=opts=>{
   unlock();
   ambient.calm=Boolean(opts?.calm??music.calm);
   const ok=ambient.start(ambientScore);
   if(ok){
    usingAmbient=true;
    ambient.updateGameState(stateFromWorld(game, data));
    music.entered=true;
    music.enabled=!isMuted();
    music.mood=typeof opts?.mood==='string'?opts.mood:music.mood;
    music.calm=Boolean(opts?.calm);
   }else playGenerative(opts);
  };
  music.start=function(opts){
   const mood=typeof opts?.mood==='string'?opts.mood:(music.mood||'day');
   if(calmMood(mood)&&!music.celebrationHold)playAmbient(opts);
   else playGenerative(opts);
  };
  const origSetEnabled=music.setEnabled.bind(music);
  music.setEnabled=function(enabled){
   if(usingAmbient){
    music.enabled=Boolean(enabled)&&!isMuted();
    ambient.setEnabled(Boolean(enabled)&&!isMuted());
   }else{
    origSetEnabled(enabled);
   }
  };
  const origSetCalm=music.setCalm.bind(music);
  music.setCalm=function(calm){
   origSetCalm(calm);
   ambient.setCalm(calm);
  };
  const origStop=music.stop.bind(music);
  music.stop=function(){
   ambient.stop();
   origStop();
  };
  const origCelebrate=music.celebrate.bind(music);
  music.celebrate=function(ms){
   const ok=origCelebrate(ms);
   // The choir takes the stage alone: pause the keepers until the frame loop
   // routes back to a calm mood after the celebration hold clears.
   if(ok){usingAmbient=false;ambient.stop();}
   return ok;
  };
 }

  const ui=new UI(game,renderer,music);new MapInput(canvas,renderer,ui);new GameUpdates(game);new PatchNotes(game,ui,{onFresh:()=>{try{music.celebrate();}catch{}}});
  new ResizeObserver(resize).observe(canvas);
 try{if(new URLSearchParams(location.search).has('perf')){const badge=document.createElement('div');badge.id='perf';document.body.appendChild(badge);setInterval(()=>{const r=renderer.frameReport();if(r)badge.textContent='frame avg '+r.avg+'ms · render '+r.renderAvg+'ms · p95 '+r.p95+'ms · n='+r.n+' · faces '+r.faces+' · quality '+r.quality+' · '+(renderer.staticLayer?'cached':'uncached');},500);}}catch{}
 try{if(new URLSearchParams(location.search).has('meshes')){const badge=document.createElement('div');badge.id='meshes';document.body.appendChild(badge);setInterval(()=>{const r=renderer.frameReport();badge.textContent='buildings '+Object.keys(data.buildings).length+' · troops '+Object.keys(data.troops).length+' · items '+Object.keys(data.items).length+' · quality '+renderer.quality+' · faces '+(r?.faces||0);},500);}}catch{}

 window.addEventListener('pointerdown',()=>unlock(),{passive:true});window.addEventListener('keydown',()=>unlock());
 const mobilePowerProfile=(()=>{try{return Math.min(innerWidth,innerHeight)<900&&(matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0);}catch{return false;}})();
 const targetRenderMs=mobilePowerProfile?1000/30:0;
 let last=performance.now(),lastRender=0,accumulator=0;
 document.addEventListener('visibilitychange',()=>{if(document.hidden){game.persist();ambience.reset();}last=performance.now();lastRender=0;accumulator=0;});window.addEventListener('pagehide',()=>game.persist());

 function stateFromWorld(g, d){
  const profile=ambienceProfile(g.world, d);
  const mood=soundtrackMood(g.world, d, {memory:moodMemory, vlevel:g.state.vlevel});
   return {
    mood,
    inRaid: Boolean(profile.raid),
   raidPending: Boolean(profile.warning),
   isNight: Boolean(profile.night),
   isDawn: profile.phase === 'dawn' || mood === 'dawn',
   isVictory: Boolean(g.world?.victory || g.state?.victory || g.state?.phase === 'victory'),
   weather: profile.weather || 'clear',
  };
 }

 function frame(now){
  const dt=Math.min((now-last)/1000,.15);last=now;
  if(!document.hidden){
   accumulator+=dt;
   while(accumulator>=.05){game.tick(.05);accumulator-=.05;}
   const due=!targetRenderMs||!lastRender||now-lastRender>=targetRenderMs-1;
   if(due){
    const renderDt=lastRender?Math.min((now-lastRender)/1000,.15):dt;lastRender=now;
    const mood=soundtrackMood(game.world,data,{memory:moodMemory,vlevel:game.state.vlevel});
    music.setMood(mood);
    if(ambientScore){
     // Route live: calm moods get the keepers, battle moods get the legacy
     // generative themes. The celebration hold keeps the choir on stage.
     const wantAmbient=calmMood(mood)&&!music.celebrationHold;
     if(wantAmbient&&!usingAmbient)playAmbient({calm:music.calm,mood});
     else if(!wantAmbient&&usingAmbient)playGenerative({calm:music.calm,mood});
     else if(usingAmbient&&ambient.started)ambient.updateGameState(stateFromWorld(game, data));
    }else if(usingAmbient && ambient.started){
     ambient.updateGameState(stateFromWorld(game, data));
    }
    ui.tick(renderDt);
    if(ui.started)ambience.tick();
    renderer.draw(game.world,now);
    try{const r=renderer.frameReport();if(r&&renderer.autoDegrade)renderer.autoDegrade(r.avg,now,r.renderAvg);}catch{}
   }
  }
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);

 window.midnightsManner={snapshot:()=>structuredClone(game.state),modelPoints:id=>(renderer.sceneFaces||[]).filter(f=>f.owner?.id===id).map(f=>({x:f.points.reduce((n,p)=>n+p.x,0)/f.points.length,y:f.points.reduce((n,p)=>n+p.y,0)/f.points.length})).filter(p=>renderer.pick(p.x,p.y)?.id===id),pick:(x,y)=>{const hit=renderer.pick(x,y);return hit?{...hit}:null;},collectionBubbles:()=>renderer.hitAreas.filter(h=>h.kind==='harvest').map(h=>({...h})),project:(x,y)=>renderer.project(x,y),camera:()=>({...renderer.cam}),frameReport:()=>renderer.frameReport(),get paused(){return game.paused;},get ready(){return ui.started;},setElapsed:seconds=>{const t=Number(seconds);if(Number.isFinite(t)&&t>=0)game.world.elapsed=t;},setCamera:({yaw,pitch,zoom,x,y}={})=>{const cam=renderer.cam;if(Number.isFinite(yaw))cam.yaw=yaw;if(Number.isFinite(pitch))cam.pitch=pitch;if(Number.isFinite(zoom)&&zoom>0)renderer.zoomBy(zoom/cam.zoom);if(Number.isFinite(x))cam.x=x;if(Number.isFinite(y))cam.y=y;},ambientTrack:()=>ambient.currentTrackKey,usingAmbient:()=>usingAmbient};
}
boot().catch(error=>{console.error(error);document.querySelector('#fatal').hidden=false;document.querySelector('#fatal').textContent=`The village could not load: ${error.message}. Refresh to retry. If running locally, serve the game over HTTP.`;});
