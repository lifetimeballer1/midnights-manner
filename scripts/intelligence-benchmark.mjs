// Full fixed-step simulation on a repeatable 150-villager world. No renderer.
// node scripts/intelligence-benchmark.mjs [repository-root-for-comparison]
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {matureSettlement} from './settlement-fixture.mjs';
const root=resolve(process.argv[2]||'.'),files=(await readdir(resolve(root,'data'))).filter(f=>f.endsWith('.json'));
const data=Object.fromEntries(await Promise.all(files.map(async f=>[f.slice(0,-5),JSON.parse(await readFile(resolve(root,'data',f)))])));
const module=n=>import(pathToFileURL(resolve(root,'src',n)));
const [{Game},model,trails,combat,logistics,routing]=await Promise.all(['game.js','model.js','systems/trails.js','systems/combat.js','systems/logistics.js','systems/pathfinding.js'].map(module));
let siege;try{siege=await module('systems/siege.js');}catch{}
const reports=[];
for(const mode of ['peace','raid']){
 let seed=0x5eed;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
 const g=new Game(data),w=matureSettlement(data,{...model,...trails});g.state.world=w;g.state.vlevel=12;g.paused=false;g.notify=()=>{};g.persist=()=>true;
 if(mode==='raid')combat.spawnRaid(w,12,null,data,{id:'cinder-clan',roles:['breaker','bowman','raider']});
 const samples=[];
 for(let i=0;i<600;i++){const start=performance.now();g.tick(.05);if(i>=100)samples.push(performance.now()-start);}
 samples.sort((a,b)=>a-b);reports.push({mode,villagers:150,buildings:72,averageMs:samples.reduce((n,x)=>n+x,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1),...logistics.logisticsMetrics(w),...routing.movementMetrics(w),siegePlanningRuns:siege?.battlefieldStatus(w,data).planningRuns||0});
}
console.log(JSON.stringify({environment:'Node full simulation in container, no rendering; not phone or Safari',reports},null,2));
