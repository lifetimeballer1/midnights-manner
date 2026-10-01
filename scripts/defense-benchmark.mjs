// Optional development benchmark: full Game.tick, all new planners enabled.
// CANVAS_MODULE=/absolute/path/to/@napi-rs/canvas/index.js node scripts/defense-benchmark.mjs
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {recordTravel} from '../src/systems/trails.js';
import {spawnRaid} from '../src/systems/combat.js';
import {defensePlanningMetrics} from '../src/systems/defense-posts.js';
import {movementMetrics} from '../src/systems/pathfinding.js';
import {matureSettlement} from './settlement-fixture.mjs';
const mod=process.env.CANVAS_MODULE;if(!mod)throw Error('Set CANVAS_MODULE to your optional @napi-rs/canvas/index.js');
const {createCanvas}=await import(pathToFileURL(mod));
const dataDir=new URL('../data/',import.meta.url),files=(await readdir(dataDir)).filter(n=>n.endsWith('.json'));
const data=Object.fromEntries(await Promise.all(files.map(async f=>[f.slice(0,-5),JSON.parse(await readFile(new URL(f,dataDir)))])));
const stats=a=>{const s=[...a].sort((x,y)=>x-y);return {average:a.reduce((x,y)=>x+y,0)/a.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)]};};
await mkdir('artifacts',{recursive:true});const reports=[];
for(const mode of ['day','warning','raid']){
 // Repeatable unit identities, traits and raid entry positions across revisions.
 let seed=0x5eed;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
 const game=new Game(data),w=matureSettlement(data,{createWorld,makeBuilding,makeUnit,recordTravel});
 game.state.world=w;game.state.vlevel=12;game.paused=false;game.notify=()=>{};game.persist=()=>true;
 w.automation={autoUpgrade:true,reserves:{wood:500,food:500,gold:500},stockTarget:1};
 for(const b of w.buildings){b.autoUpgrade=true;b.autoUpgradeMaxTier=6;b.autoCraft=true;}
 const canvas=createCanvas(780,1688);canvas.style={};const r=new Renderer(canvas,data,{});r.resize(390,844,2);r.cam={x:19,y:13,zoom:1.1,yaw:Math.PI/4,pitch:.8};r.calm=false;
 for(let i=0;i<100;i++)game.tick(.05);
 if(mode==='warning')w.raidPending={at:w.elapsed+30,count:6};
 if(mode==='raid')spawnRaid(w,6,null,data,null);
 const frames=[],ticks=[],renders=[],heapBefore=process.memoryUsage().heapUsed;
 for(let i=0;i<120;i++){const start=performance.now();game.tick(.05);const afterTick=performance.now();r.draw(w,2000+i*50);const end=performance.now();if(i>=20){ticks.push(afterTick-start);renders.push(end-afterTick);frames.push(end-start);}}
 reports.push({mode,viewport:[390,844],dpr:2,villagers:w.troops.length,buildings:w.buildings.length,frames:frames.length,frameMs:stats(frames),tickMs:stats(ticks),renderMs:stats(renders),heapDeltaBytes:process.memoryUsage().heapUsed-heapBefore,faces:r.sceneFaces.length,sheltered:w.troops.filter(u=>u.shelteredIn).length,postedFighters:w.troops.filter(u=>u.defensePost).length,...defensePlanningMetrics(w),...movementMetrics(w)});
 console.log(JSON.stringify(reports.at(-1)));
}
await writeFile('artifacts/defense-benchmark.json',JSON.stringify({environment:'Node + optional CPU Canvas in container; full Game.tick; not physical iPhone or Safari',reports},null,2));
