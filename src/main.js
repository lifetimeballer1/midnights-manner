import {Game} from './game.js';
import {Renderer} from './renderer.js';
import {UI} from './ui.js';
import {MapInput} from './input.js';
import {snapZoom} from './camera.js';
import {unlock} from './systems/audio.js';
async function boot(){
 const names=['world','troops','items','abilities','buildings','missions','quests'];
 const data=Object.fromEntries(await Promise.all(names.map(async name=>{const response=await fetch(new URL(`../data/${name}.json`,import.meta.url));if(!response.ok)throw Error(`Could not load ${name}`);return [name,await response.json()];})));
 const sprites=[...Object.values(data.buildings).flatMap(b=>b.tiers.map(t=>t.sprite)),...Object.values(data.troops).map(t=>t.sprite),...Object.values(data.items).map(i=>i.sprite),'raider.png'];
 const images=Object.fromEntries(await Promise.all(sprites.map(name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([name,image]);image.onerror=()=>reject(Error(`Missing sprite: ${name}`));image.src=new URL(`../assets/sprites/${name}`,import.meta.url).href;}))));
 const canvas=document.querySelector('#world'),game=new Game(data),renderer=new Renderer(canvas,data,images),ui=new UI(game,renderer);
 // Size-derived viewport (DPR capped at 2); re-measure on layout changes.
 renderer.resize();
 try{if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>renderer.resize()).observe(canvas);}catch{}
 window.addEventListener('orientationchange',()=>setTimeout(()=>renderer.resize(),60));
 // Phone hero: open zoomed into the village on narrow screens (desktop untouched).
 try{if(canvas.clientWidth&&canvas.clientWidth<520)renderer.cam.zoom=snapZoom(1.3);}catch{}
 // Touch camera: one finger pans, two finger pinch zooms, tap selects.
 // A drag is never a build tap (7px threshold in MapInput).
 new MapInput(canvas,{
  onTap:(sx,sy)=>{const cell=renderer.cellAt(sx,sy);renderer.hover=cell;ui.selectCell(cell);},
  onPan:(sdx,sdy)=>renderer.panPixels(sdx,sdy),
  onPinch:(f,fx,fy)=>renderer.zoomAt(f,fx,fy),
 });
 // ?perf overlay: live frame-time readout for the Phase A measurement.
 try{if(new URLSearchParams(location.search).has('perf')){const badge=document.createElement('div');badge.id='perf';document.body.appendChild(badge);setInterval(()=>{const r=renderer.frameReport();if(r)badge.textContent=`frame avg ${r.avg}ms · p50 ${r.p50}ms · p95 ${r.p95}ms · n=${r.n} · ${renderer.staticLayer?'cached':'uncached'}`;},500);}}catch{}
 const title=document.querySelector('#title'),begin=document.querySelector('#begin');
 if(title&&begin)begin.onclick=()=>{title.hidden=true;canvas.focus();};
 const unlockAudio=()=>unlock();
 window.addEventListener('pointerdown',unlockAudio,{once:false});
 window.addEventListener('keydown',unlockAudio,{once:false});
 canvas.addEventListener('pointermove',event=>{renderer.hover=renderer.cell(event);});
 canvas.addEventListener('pointerleave',()=>{renderer.hover=null;});
 canvas.addEventListener('pointermove',event=>{if(event.pointerType==='mouse')renderer.hover=renderer.cell(event);});
 canvas.addEventListener('keydown',event=>{const arrows={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
  if(arrows[event.key]){event.preventDefault();const current=renderer.hover||{x:9,y:8},[dx,dy]=arrows[event.key];renderer.hover={x:Math.max(1,Math.min(data.world.width-2,current.x+dx)),y:Math.max(1,Math.min(data.world.height-2,current.y+dy))};renderer.grid=true;}
  if(event.key==='Enter'){event.preventDefault();ui.selectCell(renderer.hover||{x:9,y:8});}
  const pan={w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[event.key.toLowerCase()];
  if(pan&&!arrows[event.key]){event.preventDefault();renderer.pan(pan[0],pan[1]);}
  if(event.key.toLowerCase()==='h'&&ui.selectedTroop){game.commandHold(ui.selectedTroop);ui.refresh();}
  if(event.key==='+'||event.key==='=')renderer.zoomBy(1.1);
  if(event.key==='-')renderer.zoomBy(0.9);
  if(event.key==='0')renderer.resetCam();
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape')ui.cancel();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)game.persist();last=performance.now();accumulator=0;});
 window.addEventListener('pagehide',()=>game.persist());
 let last=performance.now(),accumulator=0;
 function frame(now){const dt=Math.min((now-last)/1000,.15);last=now;if(!document.hidden){accumulator+=dt;while(accumulator>=.05){game.tick(.05);accumulator-=.05;}ui.tick(dt);renderer.draw(game.world,now);}requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
 // Read-only diagnostics for browser smoke tests and future debugging.
 window.midnightsManner={snapshot:()=>structuredClone(game.state),get paused(){return game.paused;},cam:()=>({...renderer.cam}),preview:()=>renderer.preview?{...renderer.preview}:null,frameReport:()=>renderer.frameReport(),freeTile:(type)=>{for(let y=1;y<data.world.height-1;y++)for(let x=1;x<data.world.width-1;x++)if(game.canBuild(type,x,y).ok)return {x,y};return null;},tileScreen:(x,y)=>{const p=renderer.project(x+.5,y+.5),r=canvas.getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y};}};
}
boot().catch(error=>{console.error(error);document.querySelector('#fatal').hidden=false;document.querySelector('#fatal').textContent=`The village could not load: ${error.message}. Serve this folder over HTTP (npm run dev); opening index.html directly is not supported.`;document.querySelector('#status').textContent='Village failed to load.';});
