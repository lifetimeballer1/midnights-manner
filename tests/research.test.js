import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {startResearch,tickResearch,researchRate,researchReason} from '../src/systems/research.js';
import {exportSave,importSaveBlob} from '../src/storage.js';
import {researchPanel} from '../src/research-ui.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const state=()=>({world:createWorld(data),home:null,mission:null,completed:[],questsCompleted:[],xp:0,unlocks:['tower'],research:{points:100,completed:[],active:null}});
test('six research branches form valid acyclic unlock paths with real rewards',()=>{
 const nodes=data.world.technologies,ids=new Set();assert.equal(new Set(nodes.map(n=>n.branch)).size,6);assert.equal(nodes.length,12);
 for(const n of nodes){assert.ok(!ids.has(n.id));for(const p of n.requires)assert.ok(ids.has(p));ids.add(n.id);assert.ok(n.points>0&&n.seconds>0);for(const id of n.unlocks){assert.ok(data.world.locked.includes(id));assert.ok(data.buildings[id]||data.items[id]||data.troops[id]);}}
});
test('prerequisites, costs and active queue reject atomically without duplicate spend',()=>{
 const s=state();s.world.resources={wood:1000,gold:1000,food:100};const before=structuredClone(s.world.resources);assert.equal(startResearch(s,data,'medicine'),false);assert.deepEqual(s.world.resources,before);assert.equal(startResearch(s,data,'orchards'),true);const paid=structuredClone(s.world.resources);assert.equal(startResearch(s,data,'orchards'),false);assert.deepEqual(s.world.resources,paid);assert.equal(s.research.points,90);tickResearch(s,data,60);assert.ok(s.unlocks.includes('grove'));assert.equal(s.research.active,null);assert.equal(startResearch(s,data,'orchards'),false);assert.equal(startResearch(s,data,'medicine'),true);
});
test('no partial payment on insufficient resources or insight',()=>{
 const s=state();s.world.resources.gold=0;const before=structuredClone(s.world.resources);assert.equal(startResearch(s,data,'orchards'),false);assert.equal(s.research.points,100);assert.deepEqual(s.world.resources,before);s.world.resources.gold=100;s.research.points=0;assert.equal(startResearch(s,data,'orchards'),false);assert.equal(s.world.resources.gold,100);
});
test('insight requires a living manor; only living posted scholars boost it',()=>{
 const s=state();assert.equal(researchRate(s,data),.1);const b=makeBuilding('scriptorium',2,2,data),u=makeUnit('scholar',data,0);b.remaining=0;s.world.buildings.push(b);s.world.troops.push(u);u.workplace=b.id;assert.equal(researchRate(s,data),.25);u.expedition={};assert.equal(researchRate(s,data),.1);s.world.buildings.find(b=>b.type==='hall').hp=0;assert.equal(researchRate(s,data),0);
});
test('active research survives save export/import; raids and missions pause progress',()=>{
 const s=state();s.world.resources.gold=1000;startResearch(s,data,'orchards');tickResearch(s,data,12);const saved=importSaveBlob(exportSave(s),data);assert.ok(saved.ok);assert.equal(saved.state.research.active.remaining,48);s.world.raidPending={timer:25};const before=structuredClone(s.research);tickResearch(s,data,20);assert.deepEqual(s.research,before);s.world.raidPending=null;s.mission={id:data.missions[0].id};tickResearch(s,data,20);assert.deepEqual(s.research,before);
});
test('old saves gain empty research without losing earned unlocks or granting duplicate rewards',()=>{
 const s=state();delete s.research;const unlocks=[...s.unlocks];tickResearch(s,data,10);assert.deepEqual(s.unlocks,unlocks);assert.deepEqual(s.research.completed,[]);assert.equal(s.research.points,1);const html=researchPanel({state:s,data});assert.ok(html.includes('TECHNOLOGY TREE'));assert.equal((html.match(/class="tech-branch"/g)||[]).length,6);assert.ok(html.includes('data-research="orchards" disabled'));
});
