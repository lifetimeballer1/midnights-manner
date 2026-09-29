import {resourceSpriteNames} from './resources.js';
import {Game} from './game.js';
import {PatchNotes} from './patchnotes.js';
import {GameUpdates} from './updates.js';
import {Renderer} from './renderer.js';
import {UI} from './ui.js';
import {MapInput} from './input.js';
import {unlock} from './systems/audio.js';
import {MusicPlayer} from './music.js';
import {makeUnit} from './model.js';
async function boot(){
 const names=['world','troops','items','abilities','buildings','missions','quests','levels','rumors','names','legends','calendar','traders','biomes','expansion','updates','artifacts','endgame','music'];
 const data=Object.fromEntries(await Promise.all(names.map(async name=>{const response=await fetch(new URL(`../data/${name}.json`,import.meta.url));if(!response.ok)throw Error(`Could not load ${name}`);return [name,await response.json()];})));
 const sprites=[...Object.values(data.buildings).flatMap(b=>b.tiers.map(t=>t.sprite)),...Object.values(data.troops).map(t=>t.sprite),...Object.values(data.items).map(i=>i.sprite),'raider.png',...resourceSpriteNames];
 const images=Object.fromEntries(await Promise.all([...new Set(sprites)].map(name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([name,image]);image.onerror=()=>reject(Error(`Missing sprite: ${name}`));image.src=new URL(`../assets/sprites/${name}`,import.meta.url).href;}))));
 const canvas=document.querySelector('#world'),game=new Game(data),renderer=new Renderer(canvas,data,images);
 const benchmarkMode=new URLSearchParams(location.search).has('benchmark');
 const resize=()=>{const rect=canvas.getBoundingClientRect();renderer.resize(rect.width,rect.height,window.devicePixelRatio||1);};resize();renderer.fitVillage(game.world);
 const ui=new UI(game,renderer,new MusicPlayer(data.music));new MapInput(canvas,renderer,ui);new GameUpdates(game);new PatchNotes(game,ui);
 new ResizeObserver(resize).observe(canvas);
 try{if(new URLSearchParams(location.search).has('perf')){const badge=document.createElement('div');badge.id='perf';document.body.appendChild(badge);setInterval(()=>{const r=renderer.frameReport();if(r)badge.textContent='frame avg '+r.avg+'ms · p50 '+r.p50+'ms · p95 '+r.p95+'ms · n='+r.n+' · faces '+r.faces+' · '+(renderer.staticLayer?'cached':'uncached');},500);}}catch{}
 window.addEventListener('pointerdown',()=>unlock(),{passive:true});window.addEventListener('keydown',()=>unlock());
 let last=performance.now(),accumulator=0;
 document.addEventListener('visibilitychange',()=>{if(document.hidden)game.persist();last=performance.now();accumulator=0;});window.addEventListener('pagehide',()=>game.persist());
 function frame(now){const dt=Math.min((now-last)/1000,.15);last=now;if(!document.hidden){accumulator+=dt;while(accumulator>=.05){game.tick(.05);accumulator-=.05;}ui.tick(dt);renderer.draw(game.world,now);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
 // Read-only hooks keep real-input browser tests independent of camera constants.
 // setElapsed/setCamera are test-only drivers for the look-capture harness:
 // they set transient view/clock state, never saves, rules or placement.
 window.midnightsManner={snapshot:()=>structuredClone(game.state),modelPoints:id=>(renderer.sceneFaces||[]).filter(f=>f.owner?.id===id).map(f=>({x:f.points.reduce((n,p)=>n+p.x,0)/f.points.length,y:f.points.reduce((n,p)=>n+p.y,0)/f.points.length})).filter(p=>renderer.pick(p.x,p.y)?.id===id),pick:(x,y)=>{const hit=renderer.pick(x,y);return hit?{...hit}:null;},collectionBubbles:()=>renderer.hitAreas.filter(h=>h.kind==='harvest').map(h=>({...h})),project:(x,y)=>renderer.project(x,y),camera:()=>({...renderer.cam}),frameReport:()=>renderer.frameReport(),get paused(){return game.paused;},get ready(){return ui.started;},setElapsed:seconds=>{const t=Number(seconds);if(Number.isFinite(t)&&t>=0)game.world.elapsed=t;},setCamera:({yaw,pitch,zoom,x,y}={})=>{const cam=renderer.cam;if(Number.isFinite(yaw))cam.yaw=yaw;if(Number.isFinite(pitch))cam.pitch=pitch;if(Number.isFinite(zoom)&&zoom>0)renderer.zoomBy(zoom/cam.zoom);if(Number.isFinite(x))cam.x=x;if(Number.isFinite(y))cam.y=y;}};
 if(benchmarkMode){
  game.persist=()=>true;
  window.midnightsManner.stressPopulation=(count=150)=>{const target=Math.max(game.world.troops.length,Math.min(500,Math.floor(Number(count)||150))),types=Object.keys(data.troops).filter(id=>data.troops[id]?.base&&data.troops[id].role!=='boss'),hall=game.world.buildings.find(b=>b.type==='hall');for(let i=game.world.troops.length;i<target;i++){const u=makeUnit(types[i%types.length],data,i);u.x=(hall?.x??10)+.3+(i%15)*.26;u.y=(hall?.y??8)+.3+Math.floor(i/15)*.26;u.workplace=null;u.order=null;game.world.troops.push(u);}game.paused=true;game.dirty=true;renderer.fitVillage(game.world);renderer.resetFrameReport();return game.world.troops.length;};
  window.midnightsManner.resetFrameReport=()=>renderer.resetFrameReport();
 }
}
boot().catch(error=>{console.error(error);document.querySelector('#fatal').hidden=false;document.querySelector('#fatal').textContent=`The village could not load: ${error.message}. Refresh to retry. If running locally, serve the game over HTTP.`;});
