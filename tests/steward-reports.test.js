import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {buildingMaxHp} from '../src/systems/endgame.js';
import {ensureConquest,recordPreliminary} from '../src/systems/conquest.js';
import {movementMetrics} from '../src/systems/pathfinding.js';
import {refreshReports,reportsSnapshot} from '../src/systems/steward-reports.js';
const dir=new URL('../data/',import.meta.url),files=(await readdir(dir)).filter(n=>n.endsWith('.json'));
const data=Object.fromEntries(await Promise.all(files.map(async f=>[f.slice(0,-5),JSON.parse(await readFile(new URL(f,dir)))])));
function fixture(){const w=createWorld(data);w.steward={enabled:true};w.enemies=[];w.raidPending=null;w.resources={...w.resources,food:50000,bread:10000,wood:50000,gold:50000,plate:50000,lumber:50000,frostwood:50000};return {world:w,data,state:{world:w,mission:null,completed:[],vlevel:12},locked:()=>false};}
test('reports remain runtime-only, detached and route-free; disabled/campaign reads empty',()=>{
 const g=fixture(),saved=JSON.stringify(g.world),paths=movementMetrics(g.world).movementSearches;
 refreshReports(g);const snap=reportsSnapshot(g);assert.ok(snap.readiness.length);snap.readiness[0].requirements[0].ok='mutated';snap.readiness[0].cost.gold=-1;
 for(let i=0;i<100;i++)reportsSnapshot(g);
 assert.equal(JSON.stringify(g.world),saved);assert.equal(movementMetrics(g.world).movementSearches,paths);assert.notEqual(reportsSnapshot(g).readiness[0].requirements[0].ok,'mutated');
 g.world.steward.enabled=false;assert.deepEqual(reportsSnapshot(g),{recovery:{active:false,steps:[]},readiness:[],history:[]});
 g.world.steward.enabled=true;g.state.mission={status:'active'};refreshReports(g);assert.equal(reportsSnapshot(g).readiness.length,0);
});
test('recovery orders manor, meals, defenses then housing with actual repair costs and ≤8 steps',()=>{
 const g=fixture();g.world.buildings=[];const add=(type,x)=>{const b=makeBuilding(type,x,3,data);b.remaining=0;b.hp=0;g.world.buildings.push(b);return b;};
 const home=add('cottage',3),defense=add('tower',9),hall=add('hall',15);for(let i=0;i<20;i++)add('storehouse',i*3);
 g.world.resources.food=0;refreshReports(g);const r=reportsSnapshot(g).recovery;
 assert.equal(r.active,true);assert.equal(r.steps.length,8);assert.equal(r.steps[0].buildingId,hall.id);assert.equal(r.steps[1].kind,'meal');assert.equal(r.steps[2].buildingId,defense.id);assert.equal(r.steps[3].buildingId,home.id);
 assert.equal(r.steps[0].cost.wood,Math.ceil(buildingMaxHp(hall,data)/15));assert.ok(r.steps[1].missing.food>0);
});
test('recovery recommendation identifies compatible missing crew without moving manual posts',()=>{
 const g=fixture();g.world.buildings=[];const hall=makeBuilding('hall',3,3,data),shop=makeBuilding('forge',10,3,data);hall.hp-=15;g.world.buildings.push(hall,shop);
 const u=makeUnit('weaponsmith',data);u.workplace='another-shop';u.manualPost=true;g.world.troops=[u];refreshReports(g);
 assert.ok(reportsSnapshot(g).recovery.steps.some(s=>s.kind==='staff'&&s.buildingId===shop.id));assert.equal(u.workplace,'another-shop');
 u.workplace=shop.id;u.emergency={kind:'shelter'};u.shelteredIn=hall.id;refreshReports(g);assert.ok(!reportsSnapshot(g).recovery.steps.some(s=>s.kind==='staff'&&s.buildingId===shop.id));
});
test('conquest readiness uses real laws, actual supplies and does not launch',()=>{
 const g=fixture(),tribe=data.conquest.tribe,m=data.missions.find(m=>m.id===tribe.assault);g.world.renown=2;
 const yard=g.world.buildings.find(b=>b.type==='barracks')||makeBuilding('barracks',8,8,data,3);yard.level=3;yard.remaining=0;if(!g.world.buildings.includes(yard))g.world.buildings.push(yard);g.world.troops=[];for(let i=0;i<8;i++)g.world.troops.push(makeUnit('warrior',data));
 ensureConquest(g.world).scouted=true;for(const p of tribe.preliminaries)recordPreliminary(g.world,p.id);g.state.completed=[...(m.requires||[])];g.world.resources={...g.world.resources,...m.launchCost};
 refreshReports(g);let row=reportsSnapshot(g).readiness.find(r=>r.id==='tribe:ironshield');assert.equal(row.ready,true);assert.deepEqual(row.cost,m.launchCost);
 g.world.resources.gold=0;refreshReports(g);row=reportsSnapshot(g).readiness.find(r=>r.id==='tribe:ironshield');assert.equal(row.ready,false);assert.equal(row.missing.gold,m.launchCost.gold);assert.equal(g.state.mission,null);
 g.world.resources.gold=m.launchCost.gold;g.world.raidPending={timer:5};refreshReports(g);assert.equal(reportsSnapshot(g).readiness.find(r=>r.id==='tribe:ironshield').ready,false);
});
test('campaign readiness respects free versus paid departure and authored crew advisories',()=>{
 const g=fixture(),free=data.missions.find(m=>!m.conquest&&!m.launchCost&&!m.requires?.length),paid=data.missions.find(m=>!m.conquest&&m.launchCost);assert.ok(free);assert.ok(paid);
 const custom={...data,missions:[free,paid]};g.data=custom;g.state.completed=[...(paid.requires||[])];g.world.resources={...g.world.resources,...paid.launchCost};g.world.raidPending={timer:5};
 const u=makeUnit('warrior',data);u.hp=1;u.expedition={phase:'gather'};g.world.troops=[u];refreshReports(g);const rows=reportsSnapshot(g).readiness;
 assert.equal(rows.find(r=>r.id===`mission:${free.id}`).ready,true);assert.equal(rows.find(r=>r.id===`mission:${paid.id}`).ready,false);assert.match(rows.find(r=>r.id===`mission:${free.id}`).detail,/1 away, 1 injured/);
 assert.match(rows[0].detail,/own starting crew/);assert.equal(rows.filter(r=>r.kind==='conquest').length,4);assert.ok(rows.filter(r=>r.kind==='campaign').length<=4);
});
test('history logs changed goals, shortages, fitted equipment and queue completions once, capped at12',()=>{
 const g=fixture(),u=g.world.troops[0],goal={id:'grow',slot:'main',buildingId:'target',targetTier:2,label:'Housing goal',status:'Waiting for materials'};
 refreshReports(g,{goals:[goal],queue:[{id:'q1',label:'Build cottage',status:'Ready'}]});const initial=reportsSnapshot(g).history.length;
 g.world.resources.food=0;u.gear='changed-gear';goal.status='Complete';g.world.elapsed+=3;
 refreshReports(g,{goals:[goal],queue:[],queueCompleted:'q1'});const history=reportsSnapshot(g).history;
 assert.equal(history.length,initial+4);assert.ok(history.some(h=>h.label==='Village goal completed'));assert.ok(history.some(h=>h.label==='Construction queue completed'));
 for(let i=0;i<20;i++)refreshReports(g,{goals:[goal],queueCompleted:'q1'});assert.equal(reportsSnapshot(g).history.length,history.length);
 for(let i=0;i<20;i++){u.gear=`changed-${i}`;g.world.elapsed+=3;refreshReports(g,{goals:[goal]});}assert.equal(reportsSnapshot(g).history.length,12);
});
test('rotating diagnostic input samples do not create repeating shortage reports',()=>{
 const g=fixture();g.world.resources.wood=0;const issue={id:'input:shop:wood',resource:'wood'};
 refreshReports(g,{issues:[issue]});const initial=reportsSnapshot(g).history.filter(h=>h.label==='New village shortage').length;
 for(let i=0;i<10;i++)refreshReports(g,{issues:i%2?[]:[issue]});assert.equal(reportsSnapshot(g).history.filter(h=>h.label==='New village shortage').length,initial);
 g.world.resources.wood=5;refreshReports(g);g.world.resources.wood=0;refreshReports(g,{issues:[issue]});assert.equal(reportsSnapshot(g).history.filter(h=>h.label==='New village shortage').length,initial+1);
});
test('woodland readiness uses actual living/away gates and weather risk, never launches',()=>{
 const g=fixture(),type=Object.keys(data.troops).find(type=>data.troops[type].expedition?.durationSec>0);assert.ok(type);
 g.world.troops=[];for(let i=0;i<6;i++){const u=makeUnit(type,data);u.id=`ranger-${i}`;g.world.troops.push(u);}g.world.troops[0].hp=0;g.world.troops[1].expedition={phase:'gather',timer:5};
 g.world.night=true;g.world.weather='fog';g.world.raidPending={timer:5};const saved=JSON.stringify(g.world);refreshReports(g);let rows=reportsSnapshot(g).readiness.filter(r=>r.kind==='woodland');
 assert.equal(rows.length,4);assert.ok(rows.every(r=>r.ready));assert.deepEqual(rows[0].cost,{});assert.ok(rows[0].risk>data.troops[type].expedition.risk);assert.equal(JSON.stringify(g.world),saved);
 g.world.troops=g.world.troops.slice(0,2);refreshReports(g);rows=reportsSnapshot(g).readiness.filter(r=>r.kind==='woodland');assert.ok(rows.every(r=>!r.ready));assert.match(rows.find(r=>r.unitId==='ranger-1').status,/Gathering/);
});
