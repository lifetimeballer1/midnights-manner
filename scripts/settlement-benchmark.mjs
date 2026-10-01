// Optional development Canvas dependency, supplied externally; no game dependency.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {recordTravel} from '../src/systems/trails.js';
import {tickLogistics,logisticsMetrics} from '../src/systems/logistics.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickRefine} from '../src/systems/crafting.js';
import {tickCombat,spawnRaid} from '../src/systems/combat.js';
import {movementMetrics} from '../src/systems/pathfinding.js';
import {tickEmergency} from '../src/systems/emergency.js';
import {weatherAt,phaseAt} from '../src/systems/daynight.js';
import {matureSettlement} from './settlement-fixture.mjs';
const mod=process.env.CANVAS_MODULE;if(!mod)throw Error('Set CANVAS_MODULE to your optional @napi-rs/canvas/index.js');const {createCanvas}=await import(pathToFileURL(mod));
const names=['world','buildings','troops','items','abilities','quests','missions','biomes','expansion','calendar','conquest','endgame','factions'];const d=Object.fromEntries(await Promise.all(names.map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const stats=times=>{const sorted=[...times].sort((a,b)=>a-b);return {average:times.reduce((a,b)=>a+b,0)/times.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)]};};
await mkdir('artifacts',{recursive:true});const reports=[];
for(const mode of ['day','night','rain','warning','raid']){const w=matureSettlement(d,{createWorld,makeBuilding,makeUnit,recordTravel}),canvas=createCanvas(780,1688);canvas.style={};const r=new Renderer(canvas,d,{});r.resize(390,844,2);r.cam={x:19,y:13,zoom:Number(process.env.BENCH_ZOOM)||1.1,yaw:Math.PI/4,pitch:.8};r.calm=false;
 for(let i=0;i<100;i++){w.elapsed+=.05;tickLogistics(w,d,.05);tickRefine(w,d,.05,true);}if(mode==='night'){for(let t=0;t<30000;t+=5)if(phaseAt(t,d).night&&weatherAt(t,d).id==='clear'){w.elapsed=t;break;}}else if(mode==='rain'){for(let t=0;t<30000;t+=300)if(weatherAt(t,d).id==='rain'){w.elapsed=t+100;break;}}else{for(let t=0;t<30000;t+=300)if(weatherAt(t,d).id==='clear'){w.elapsed=t+100;break;}}if(mode==='warning')w.raidPending={at:w.elapsed+30};if(mode==='raid')spawnRaid(w,6,null,d,null);
 const times=[],ticks=[],frames=[],heapBefore=process.memoryUsage().heapUsed;for(let i=0;i<40;i++){const frameStart=performance.now();let t=frameStart;tickEmergency(w,d,.05);tickEconomy(w,d,.05);tickLogistics(w,d,.05);tickRefine(w,d,.05,true);tickCombat(w,d,.05);ticks.push(performance.now()-t);w.elapsed+=.05;t=performance.now();r.draw(w,2000+i*50);if(i>=10){times.push(performance.now()-t);frames.push(performance.now()-frameStart);}}
 const report={mode,phase:phaseAt(w.elapsed,d).id,weather:weatherAt(w.elapsed,d).id,viewport:[390,844],dpr:2,villagers:w.troops.length,buildings:w.buildings.length,frames:times.length,frameMs:stats(frames),renderMs:stats(times),tickMs:stats(ticks),heapDeltaBytes:process.memoryUsage().heapUsed-heapBefore,faces:r.sceneFaces.length,...logisticsMetrics(w),...movementMetrics(w)};reports.push(report);await writeFile(`artifacts/settlement-${mode}.png`,canvas.toBuffer('image/png'));console.log(JSON.stringify(report));}
await writeFile('artifacts/settlement-benchmark.json',JSON.stringify({environment:'Node + @napi-rs/canvas CPU renderer in container; not a phone or Chromium measurement',reports},null,2));
