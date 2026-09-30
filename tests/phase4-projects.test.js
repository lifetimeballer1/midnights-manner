import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,auras,housing,reviveFraction,buildingCost} from '../src/model.js';
import {storageCap} from '../src/systems/storage.js';
import {validateSave,exportSave,importSaveBlob,VERSION} from '../src/storage.js';
const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals']
  .map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const PROJECTS=['market-square','grand-granary','manor-gardens','monument','stone-road','city-wall'];
const fresh=(vlevel=1)=>{const g=new Game(data);g.state={...g.state,world:createWorld(data),home:null,mission:null,vlevel};g.world.resources={wood:99999,food:99999,gold:99999,lumber:99999,plate:9999,frostwood:9999,flour:9999,bread:9999};return g;};

test('phase4: town projects are data-shaped grand works',()=>{
 const auraKeys=['damage','armor','gather','carry','build','discount','heal','xp','survey','food','plate','produce','beds','trade'];
 for(const id of PROJECTS){
  const b=data.buildings[id];
  assert.ok(b,`${id} exists`);
  assert.equal(b.project,true,`${id} carries the project flag`);
  assert.equal(b.maxPerVillage,1,`${id} stands alone`);
  assert.ok(b.minLevel>=5,`${id} opens in the late game`);
  assert.equal(new Set(b.tiers.map(t=>t.sprite)).size,b.tiers.length,`${id} keeps distinct stage art`);
  assert.equal(b.costCurve[0],1,`${id} stage one at base`);
  assert.equal(b.costCurve[1],2,`${id} stage two friendly`);
  for(const k of Object.keys(b.flatAuras||{}))assert.ok(auraKeys.includes(k),`${id} aura key ${k}`);
 }
});

test('phase4: a project is raised in stages with multi-resource prices',()=>{
 const base=data.buildings['market-square'].cost;
 const bare={...createWorld(data),troops:[]};
 const c1=buildingCost('market-square',1,bare,data);
 const c2=buildingCost('market-square',2,bare,data);
 const c3=buildingCost('market-square',3,bare,data);
 assert.equal(c1.plate,base.plate);
 assert.equal(c2.plate,base.plate*2);
  assert.equal(c3.plate,base.plate*8,'forged plate scales with the stage');
  assert.equal(c3.lumber,base.lumber*8,'and so does sawn stock');
 assert.equal(c1.gold,base.gold,'stage one stands at base price');
});

test('phase4: the square gates by village level and stands alone',()=>{
 const g=fresh(5);
 assert.equal(g.build('market-square',2,2),undefined,'level 6 gate holds');
 assert.match(g.message,/village level 6/);
 g.state.vlevel=6;
 const before=structuredClone(g.world.resources),cost=buildingCost('market-square',1,g.world,g.data);
 const b=g.build('market-square',2,2);
 assert.ok(b&&b.type==='market-square','the square rises');
 for(const [k,v] of Object.entries(cost))assert.equal(g.world.resources[k],before[k]-v,`${k} paid exactly`);
 assert.equal(g.build('market-square',6,2),undefined,'one square per village');
 assert.match(g.message,/only one/i);
});

test('phase4: stages upgrade behind village levels and land as real tiers',()=>{
 const g=fresh(6);
 const b=g.build('market-square',2,2);b.remaining=0;
 g.upgrade(b.id);
 assert.equal(b.level,2,'stage two opens at level 6');
 b.remaining=0;
 assert.equal(g.upgrade(b.id),undefined,'stage three waits');
 assert.match(g.message,/village level 9/);
 assert.equal(b.level,2,'no stage beyond the gate');
 g.state.vlevel=9;
 g.upgrade(b.id);
 assert.equal(b.level,3,'stage three opens at level 9');
 assert.equal(b.hp,data.buildings['market-square'].tiers[2].hp,'the new stage stands whole');
});

test('phase4: a finished project blesses the town through flatAuras',()=>{
 const g=fresh(6);
 const base=auras(g.world,data);
 const b=makeBuilding('market-square',2,2,data);g.world.buildings.push(b);
 const a1=auras(g.world,data);
 assert.ok(Math.abs(a1.trade-base.trade-0.04)<1e-9,'stage one warms trade');
 assert.ok(Math.abs(a1.carry-base.carry-2)<1e-9,'and hands');
 assert.ok(Math.abs(a1.xp-base.xp-0.02)<1e-9,'and study');
 b.level=3;b.hp=data.buildings['market-square'].tiers[2].hp;
 const a3=auras(g.world,data);
 assert.ok(Math.abs(a3.trade-base.trade-0.12)<1e-9,'stage three triples the blessing');
 b.hp=0;
 assert.ok(Math.abs(auras(g.world,data).trade-base.trade)<1e-9,'ruins bless nothing');
 b.hp=100;b.remaining=5;
 assert.ok(Math.abs(auras(g.world,data).trade-base.trade)<1e-9,'scaffolds bless nothing');
});

test('phase4: each grand work pays in its own coin',()=>{
 const w=createWorld(data);
 const cap0=storageCap(w,data,'food');
 const granary=makeBuilding('grand-granary',2,2,data);w.buildings.push(granary);
 assert.equal(storageCap(w,data,'food'),cap0+3000,'stage one extends the pantry');
 granary.level=3;granary.hp=data.buildings['grand-granary'].tiers[2].hp;
 assert.equal(storageCap(w,data,'food'),cap0+9000,'stage three triples it');
 const beds0=housing(w,data).beds;
 const gardens=makeBuilding('manor-gardens',8,2,data);w.buildings.push(gardens);
 assert.equal(housing(w,data).beds,beds0+10,'the gardens house ten');
 const monument=makeBuilding('monument',2,8,data);w.buildings.push(monument);
 assert.ok(Math.abs(reviveFraction(w,data)-0.6)<1e-9,'the monument remembers the fallen');
});

test('phase4: project saves validate and round-trip',()=>{
 const g=fresh(6);
 const b=g.build('market-square',2,2);b.remaining=0;
 b.level=2;b.hp=data.buildings['market-square'].tiers[1].hp;
 assert.equal(validateSave(g.state,data),true,'the save contract accepts projects');
 const back=importSaveBlob(exportSave(g.state),data);
 assert.equal(back.ok,true,'a project save imports cleanly');
 const imported=back.state.world.buildings.find(x=>x.type==='market-square');
 assert.equal(imported.level,2,'the stage survives the trip');
 assert.equal(VERSION,back.state.version);
});

test('H2: infrastructure stages have distinct original 32px PNG assets',async()=>{
 const pixels=[];
 for(const id of ['stone-road','city-wall']){
  const b=data.buildings[id];
  assert.equal(b.size,2);
  assert.equal(b.minLevel,id==='stone-road'?6:7);
  assert.deepEqual(b.costCurve,[1,2,8]);
  assert.equal(b.tiers.length,3);
  for(const t of b.tiers){
   const png=await readFile(new URL(`../assets/sprites/${t.sprite}`,import.meta.url));
   assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
   assert.equal(png.readUInt32BE(16),32);
   assert.equal(png.readUInt32BE(20),32);
   pixels.push(png.toString('hex'));
  }
 }
 assert.equal(new Set(pixels).size,6,'all six stage assets differ');
});

test('H2: infrastructure baskets retain friendly opening and road plate joins stage three',()=>{
 const w={...createWorld(data),troops:[]};
 for(const id of ['stone-road','city-wall']){
  const b=data.buildings[id];
  for(const stage of [1,2,3]){
   const expected=Object.fromEntries(Object.entries(b.cost).map(([k,v])=>[k,v*b.costCurve[stage-1]]));
   if(id==='stone-road'&&stage===3)expected.plate=120;
   assert.deepEqual(buildingCost(id,stage,w,data),expected);
  }
 }
 assert.equal(buildingCost('stone-road',1,w,data).plate,undefined);
 assert.equal(buildingCost('stone-road',2,w,data).plate,undefined);
});

test('H2: infrastructure uses normal gates, exact payments and once-per-village limits',()=>{
 for(const id of ['stone-road','city-wall']){
  const spec=data.buildings[id],g=fresh(spec.minLevel-1);
  assert.equal(g.build(id,2,2),undefined);
  assert.match(g.message,new RegExp(`village level ${spec.minLevel}`));
  g.state.vlevel=spec.minLevel;
  const before=structuredClone(g.world.resources),cost=buildingCost(id,1,g.world,data);
  const b=g.build(id,2,2);assert.ok(b);
  for(const [k,v] of Object.entries(before))assert.equal(g.world.resources[k],v-(cost[k]||0));
  assert.equal(g.build(id,6,2),undefined);
  assert.match(g.message,/only one/i);
  b.remaining=0;
  const stage2=structuredClone(g.world.resources),cost2=buildingCost(id,2,g.world,data);
  g.upgrade(b.id);assert.equal(b.level,2);
  for(const [k,v] of Object.entries(stage2))assert.equal(g.world.resources[k],v-(cost2[k]||0));
  b.remaining=0;
  const held=structuredClone(g.world.resources);
  assert.equal(g.upgrade(b.id),undefined);
  assert.match(g.message,new RegExp(`village level ${spec.tierGates[3]}`));
  assert.deepEqual(g.world.resources,held);
  g.state.vlevel=spec.tierGates[3];
  const cost3=buildingCost(id,3,g.world,data);
  // Missing any stage-three good refuses the entire basket.
  g.world.resources.plate=cost3.plate-1;
  const short=structuredClone(g.world.resources);
  assert.equal(g.upgrade(b.id),undefined);
  assert.equal(b.level,2);assert.deepEqual(g.world.resources,short);
  g.world.resources.plate=9999;
  const ready=structuredClone(g.world.resources);
  g.upgrade(b.id);assert.equal(b.level,3);
  for(const [k,v] of Object.entries(ready))assert.equal(g.world.resources[k],v-(cost3[k]||0));
  assert.equal(b.hp,spec.tiers[2].hp);
 }
});

test('H2: infrastructure warmth scales only while finished and living',()=>{
 const expected={'stone-road':{carry:1,trade:0.02},'city-wall':{armor:0.02,heal:0.1}};
 for(const [id,effects] of Object.entries(expected)){
  const w=createWorld(data),base=auras(w,data),b=makeBuilding(id,2,2,data);
  assert.deepEqual(data.buildings[id].flatAuras,effects);
  w.buildings.push(b);
  for(const stage of [1,2,3]){
   b.level=stage;b.hp=data.buildings[id].tiers[stage-1].hp;
   const a=auras(w,data);
   for(const [k,v] of Object.entries(effects))assert.ok(Math.abs(a[k]-base[k]-v*stage)<1e-9,`${id} stage ${stage} ${k}`);
  }
  b.hp=0;assert.deepEqual(auras(w,data),base);
  b.hp=100;b.remaining=5;assert.deepEqual(auras(w,data),base);
 }
});

test('H2: both infrastructure projects round-trip all stages in existing saves',()=>{
 for(const stage of [1,2,3]){
  const g=fresh(10);
  for(const [id,x] of [['stone-road',2],['city-wall',6]]){
   const b=makeBuilding(id,x,2,data);b.level=stage;b.hp=data.buildings[id].tiers[stage-1].hp;
   g.world.buildings.push(b);
  }
  assert.equal(validateSave(g.state,data),true);
  const back=importSaveBlob(exportSave(g.state),data);
  assert.equal(back.ok,true);
  for(const id of ['stone-road','city-wall'])assert.equal(back.state.world.buildings.find(b=>b.type===id).level,stage);
  assert.equal(back.state.version,VERSION);
 }
});
