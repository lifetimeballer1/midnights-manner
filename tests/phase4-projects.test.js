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
const PROJECTS=['market-square','grand-granary','manor-gardens','monument'];
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
 assert.equal(c3.plate,base.plate*6,'forged plate scales with the stage');
 assert.equal(c3.lumber,base.lumber*6,'and so does sawn stock');
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
