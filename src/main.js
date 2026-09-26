import {Game} from './game.js';
import {Renderer} from './renderer.js';
import {UI} from './ui.js';
import {unlock} from './systems/audio.js';
async function boot(){
 const names=['world','troops','items','abilities','buildings','missions','quests'];
 const data=Object.fromEntries(await Promise.all(names.map(async name=>{const response=await fetch(new URL(`../data/${name}.json`,import.meta.url));if(!response.ok)throw Error(`Could not load ${name}`);return [name,await response.json()];})));
 const sprites=[...Object.values(data.buildings).flatMap(b=>b.tiers.map(t=>t.sprite)),...Object.values(data.troops).map(t=>t.sprite),...Object.values(data.items).map(i=>i.sprite),'raider.png'];
 const images=Object.fromEntries(await Promise.all(sprites.map(name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([name,image]);image.onerror=()=>reject(Error(`Missing sprite: ${name}`));image.src=new URL(`../assets/sprites/${name}`,import.meta.url).href;}))));
 const canvas=document.querySelector('#world'),game=new Game(data),renderer=new Renderer(canvas,data,images),ui=new UI(game,renderer);
 const unlockAudio=()=>unlock();
 window.addEventListener('pointerdown',unlockAudio,{once:false});
 window.addEventListener('keydown',unlockAudio,{once:false});
 canvas.addEventListener('pointermove',event=>{renderer.hover=renderer.cell(event);});
 canvas.addEventListener('pointerleave',()=>{renderer.hover=null;});
 canvas.addEventListener('click',event=>{renderer.hover=renderer.cell(event);ui.selectCell(renderer.hover);});
 canvas.addEventListener('wheel',event=>{event.preventDefault();renderer.zoomBy(event.deltaY>0?0.9:1.1);},{passive:false});
 canvas.addEventListener('keydown',event=>{const arrows={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
  if(arrows[event.key]){event.preventDefault();const current=renderer.hover||{x:9,y:8},[dx,dy]=arrows[event.key];renderer.hover={x:Math.max(1,Math.min(data.world.width-2,current.x+dx)),y:Math.max(1,Math.min(data.world.height-2,current.y+dy))};renderer.grid=true;}
  if(event.key==='Enter'){event.preventDefault();ui.selectCell(renderer.hover||{x:9,y:8});}
  const pan={w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[event.key.toLowerCase()];
  if(pan&&!arrows[event.key]){event.preventDefault();renderer.pan(pan[0],pan[1]);}
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
 window.midnightsManner={snapshot:()=>structuredClone(game.state),get paused(){return game.paused;}};
}
boot().catch(error=>{console.error(error);document.querySelector('#fatal').hidden=false;document.querySelector('#fatal').textContent=`The village could not load: ${error.message}. Serve this folder over HTTP (npm run dev); opening index.html directly is not supported.`;document.querySelector('#status').textContent='Village failed to load.';});
