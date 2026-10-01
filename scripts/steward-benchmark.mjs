// Optional development evidence, never a physical-iPhone certification.
// CANVAS_MODULE=/absolute/path/to/@napi-rs/canvas/index.js node scripts/steward-benchmark.mjs
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {recordTravel} from '../src/systems/trails.js';
import {spawnRaid} from '../src/systems/combat.js';
import {movementMetrics} from '../src/systems/pathfinding.js';
import {matureSettlement} from './settlement-fixture.mjs';
const mod=process.env.CANVAS_MODULE;
if(!mod)throw Error('Set CANVAS_MODULE to the optional @napi-rs/canvas/index.js');
const {createCanvas}=await import(pathToFileURL(mod));
const {stewardMetrics}=await import('../src/systems/steward.js');
const dataDir=new URL('../data/',import.meta.url),files=(await readdir(dataDir)).filter(n=>n.endsWith('.json'));
const data=Object.fromEntries(await Promise.all(files.map(async f=>[f.slice(0,-5),JSON.parse(await readFile(new URL(f,dataDir)))])));
const stats=a=>{const s=[...a].sort((x,y)=>x-y);return {average:a.reduce((x,y)=>x+y,0)/a.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)]};};
const reports=[],originalRandom=Math.random;
try{
 for(const mode of ['peace','raid'])for(const enabled of [false,true]){
  let seed=0x5eed;
  Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  const game=new Game(data),w=matureSettlement(data,{createWorld,makeBuilding,makeUnit,recordTravel});
  game.state.world=w;game.state.vlevel=12;game.paused=false;game.notify=()=>{};game.persist=()=>true;
  const home=w.buildings.find(b=>b.id==='settlement-b-15'),tower=w.buildings.find(b=>b.id==='settlement-b-17');
  home.level=5;home.hp=data.buildings[home.type].tiers[4].hp;tower.hp-=60;
  w.steward={enabled,protectMeals:true,protectRepairs:true,main:{id:'fortify',buildingId:tower.id,action:'repair',baseline:tower.hp},secondary:[{id:'grow',buildingId:home.id,targetTier:6,baseline:5},{id:'conquest',tribeId:'ironshield'}]};
  w.automation={autoUpgrade:true,reserves:{wood:500,food:500,gold:500},stockTarget:1};
  for(const b of w.buildings){b.autoUpgrade=true;b.autoUpgradeMaxTier=b.level;b.autoCraft=true;}
  const canvas=createCanvas(780,1688);canvas.style={};
  const renderer=new Renderer(canvas,data,{});renderer.resize(390,844,2);
  renderer.cam={x:19,y:13,zoom:1.1,yaw:Math.PI/4,pitch:.8};renderer.calm=false;
  for(let i=0;i<100;i++)game.tick(.05);
  if(mode==='raid')spawnRaid(w,6,null,data,null);
  const frames=[],ticks=[],renders=[],heapBefore=process.memoryUsage().heapUsed;
  const before={...movementMetrics(w),...stewardMetrics(w)};
  // 18 active seconds include six planner intervals rather than timing one refresh.
  for(let i=0;i<380;i++){
   const start=performance.now();game.tick(.05);const afterTick=performance.now();
   renderer.draw(w,5000+i*50);const end=performance.now();
   if(i>=20){ticks.push(afterTick-start);renders.push(end-afterTick);frames.push(end-start);}
  }
  reports.push({mode,enabled,viewport:[390,844],dpr:2,villagers:w.troops.length,buildings:w.buildings.length,frames:frames.length,activeSeconds:18,frameMs:stats(frames),tickMs:stats(ticks),renderMs:stats(renders),heapDeltaBytes:process.memoryUsage().heapUsed-heapBefore,faces:renderer.sceneFaces.length,movementSearches:movementMetrics(w).movementSearches-before.movementSearches,stewardBefore:before,stewardAfter:stewardMetrics(w)});
  console.log(JSON.stringify(reports.at(-1)));
 }
}finally{Math.random=originalRandom;}
const comparison=['peace','raid'].map(mode=>{
 const off=reports.find(r=>r.mode===mode&&!r.enabled),on=reports.find(r=>r.mode===mode&&r.enabled);
 return {mode,tickP50DeltaMs:on.tickMs.p50-off.tickMs.p50,tickP95DeltaMs:on.tickMs.p95-off.tickMs.p95,frameP50DeltaMs:on.frameMs.p50-off.frameMs.p50,frameP95DeltaMs:on.frameMs.p95-off.frameMs.p95,movementSearchDelta:on.movementSearches-off.movementSearches};
});
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/steward-benchmark.json',JSON.stringify({environment:'Node + optional CPU Canvas in container; complete Game.tick; same seed and settlement; not physical iPhone or Safari',reports,comparison},null,2)+'\n');
