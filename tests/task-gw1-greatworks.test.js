import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,auras,buildingCost,buildingLimit} from '../src/model.js';
import {storageCap} from '../src/systems/storage.js';
import {validateSave,exportSave,importSaveBlob,VERSION} from '../src/storage.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest']
 .map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const ids=['manner-citadel','grand-watchtower'];
const baskets={
 'manner-citadel':[
  {wood:10000,lumber:5000,gold:10000,plate:1000,frostwood:250,food:2000,bread:500},
  {wood:20000,lumber:10000,gold:20000,plate:14000,frostwood:2500,food:4000,bread:1000},
  {wood:30000,lumber:15000,gold:30000,plate:22000,frostwood:8250,food:6000,bread:1500},
  {wood:40000,lumber:20000,gold:40000,plate:23000,frostwood:14000,food:8000,bread:2000}],
 'grand-watchtower':[
  {wood:3000,lumber:2000,gold:3300,plate:100,frostwood:250,food:1000,bread:250},
  {wood:6000,lumber:4000,gold:6600,plate:5900,frostwood:500,food:2000,bread:500},
  {wood:21000,lumber:14000,gold:23100,plate:14000,frostwood:7500,food:7000,bread:1750}]
};
function developed(){
 const w=createWorld(data);w.troops=[];w.buildings=[];
 for(const id of ['hall','storehouse','grand-granary']){
  const count=id==='storehouse'?buildingLimit(id,11,data):1;
  for(let i=0;i<count;i++){
   const b=makeBuilding(id,2+i*3,8,data);b.level=data.buildings[id].tiers.length;
   b.hp=data.buildings[id].tiers[b.level-1].hp;b.remaining=0;w.buildings.push(b);
  }
 }
 return w;
}
const capKeys=Object.keys(data.world.storageBase);
function fresh(level){
 const g=new Game(data);g.state.vlevel=level;g.state.world=developed();
 g.world.resources=Object.fromEntries(capKeys.map(k=>[k,storageCap(g.world,data,k)]));
 return g;
}
const hash=value=>createHash('sha256').update(value).digest('hex');

test('GW1: exactly two additive projects preserve earlier buildings and campaign fingerprints',async()=>{
 const earlier=Object.fromEntries(Object.entries(data.buildings).filter(([id])=>!ids.includes(id)));
  assert.equal(hash(JSON.stringify(earlier)),'d512d232c2753032b0ccf61c03d6a70659f3624744e75c6df5ecbfce5f3c84d3');
 assert.equal(hash(JSON.stringify(data.buildings['dawn-gate'])),'00d6157bcb7d5e00372e02318c3f8ee8626e85584e6e263c38cdb179626ce0f0');
  // Raw-file pins normalize line endings: Windows checkouts use CRLF, CI uses LF.
  // J1 appends ix-ashen-crown + the Ashen Warlord additively; J2 orders the arc 34-36 with the crown at 39; J3 branches at shared chapter 37; J4 reconverges at 38; G1 adds scorched-ridge theme to the crown map — deliberate pin update.
  const raw=async url=>(await readFile(url,'utf8')).replace(/\r\n?/g,'\n');
  for(const [file,pin] of Object.entries({conquest:'348c44debdf8cc91dd7b165edd27c98640ff94550aa183f28cf7e04f299ace23',missions:'6fe13e36a96a5ed442a07bc9e27dd5a8dc957a5a1231fbb2992416ac1d5f7b0e'})){
   assert.equal(hash(await raw(new URL(`../data/${file}.json`,import.meta.url))),pin);
  }
  // Renown stays optional; the future project hook stays an unwired comment.
 assert.equal(hash(await raw(new URL('../data/endgame.json',import.meta.url))),'f5a1930d87089b12db594991a6c947fc6b6da8ccf338f7ce7225e739f24d7f1d');
 assert.equal(hash(await raw(new URL('../src/systems/endgame.js',import.meta.url))),'b6903b3e72a29ab66f719fa92aaf38d72b243cb22d44a07713876e287746adfd');
});

test('GW1: stages, gates and aura keys reuse the Town Projects contract',()=>{
 const keys=new Set(['city-wall','forge-quarter','lantern-rows'].flatMap(id=>Object.keys(data.buildings[id].flatAuras)));
 for(const id of ids){
  const b=data.buildings[id],citadel=id==='manner-citadel';
  assert.equal(b.project,true);assert.equal(b.maxPerVillage,1);
  assert.equal(b.size,citadel?3:2);assert.equal(b.minLevel,citadel?10:9);
  assert.equal(b.tiers.length,citadel?4:3);
  assert.deepEqual(b.costCurve,citadel?[1,2,3,4]:[1,2,7]);
  assert.deepEqual(b.tierGates,citadel?{'4':11}:{'3':10});
  assert.deepEqual(b.flatAuras,citadel?{armor:0.02,heal:0.1}:{damage:0.02,survey:0.05});
  assert.equal(b.production,null);assert.equal(b.rate,0);
  for(const key of Object.keys(b.flatAuras))assert.ok(keys.has(key));
  for(const t of b.tiers){assert.equal(t.damage,0);assert.equal(t.range,0.75);}
 }
});

test('GW1: all seven stages resolve to distinct original transparent 32px PNGs',async()=>{
 const files=[];
 for(const id of ids)for(const t of data.buildings[id].tiers){
  const png=await readFile(new URL(`../assets/sprites/${t.sprite}`,import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),32);
  assert.equal(png[25],6);files.push(hash(png));
 }
 assert.equal(new Set(files).size,7);
});

test('GW1: exact undiscounted baskets and totals fit data-derived developed central caps',()=>{
 const w=developed();
 const caps=Object.fromEntries(capKeys.map(k=>[k,storageCap(w,data,k)]));
  assert.deepEqual(caps,{wood:232000,food:250000,gold:156000,lumber:75200,flour:87200,bread:87200,frostwood:45600,plate:45600,rations:800,'feast-supplies':400});
 for(const id of ids){
  const totals={};
  baskets[id].forEach((basket,i)=>{
   assert.deepEqual(buildingCost(id,i+1,w,data),basket);
   for(const [k,v] of Object.entries(basket)){
    assert.ok(v<=caps[k],`${id} stage ${i+1} ${k}: ${v} <= ${caps[k]}`);
    totals[k]=(totals[k]||0)+v;
   }
  });
  assert.deepEqual(totals,id==='manner-citadel'?
   {wood:100000,lumber:50000,gold:100000,plate:60000,frostwood:25000,food:20000,bread:5000}:
   {wood:30000,lumber:20000,gold:33000,plate:20000,frostwood:8250,food:10000,bread:2500});
 }
});

test('GW1: build and every stage enforce gates, uniqueness and exact central-store payment',()=>{
 for(const id of ids){
  const spec=data.buildings[id],g=fresh(spec.minLevel-1);
  const locked=structuredClone(g.world.resources);
  assert.equal(g.build(id,2,2),undefined);assert.match(g.message,new RegExp(`village level ${spec.minLevel}`));
  assert.deepEqual(g.world.resources,locked);g.state.vlevel=spec.minLevel;
  const b=g.build(id,2,2);assert.ok(b);
  for(const k of capKeys)assert.equal(g.world.resources[k],locked[k]-(baskets[id][0][k]||0));
  const once=structuredClone(g.world.resources);
  assert.equal(g.build(id,6,2),undefined);assert.match(g.message,/only one/i);
  assert.deepEqual(g.world.resources,once);
  for(let stage=2;stage<=spec.tiers.length;stage++){
   b.remaining=0;
   g.world.resources=Object.fromEntries(capKeys.map(k=>[k,storageCap(g.world,data,k)]));
   const before=structuredClone(g.world.resources);
   if(stage===spec.tiers.length){
    assert.equal(g.upgrade(b.id),undefined);assert.equal(b.level,stage-1);
    assert.match(g.message,new RegExp(`village level ${spec.tierGates[stage]}`));
    assert.deepEqual(g.world.resources,before);g.state.vlevel=spec.tierGates[stage];
   }
   g.upgrade(b.id);assert.equal(b.level,stage);assert.ok(b.remaining>0);
   assert.equal(b.hp,spec.tiers[stage-1].hp);
   for(const k of capKeys)assert.equal(g.world.resources[k],before[k]-(baskets[id][stage-1][k]||0));
  }
 }
});

test('GW1: any missing central good rejects the whole basket despite protected buffers',()=>{
 for(const id of ids)for(let stage=1;stage<=data.buildings[id].tiers.length;stage++){
  for(const [key,price] of Object.entries(baskets[id][stage-1])){
   const g=fresh(11);let b;
   if(stage>1){b=makeBuilding(id,2,2,data);b.level=stage-1;g.world.buildings.push(b);}
   g.world.resources[key]=price-1;
   g.world.pendingRewards={[key]:price*2};g.world.buildings[0].harvestStock=price*2;
   const before=structuredClone(g.world);
   assert.equal(stage===1?g.build(id,2,2):g.upgrade(b.id),undefined);
   assert.deepEqual(g.world,before,`${id} stage ${stage} short ${key} is atomic`);
  }
 }
});

test('GW1: only living finished stages grant tier-scaled auras',()=>{
 for(const id of ids){
  const g=fresh(11),base=auras(g.world,data),b=g.build(id,2,2);assert.ok(b);
  assert.deepEqual(auras(g.world,data),base,'initial scaffold grants nothing');
  for(let stage=1;stage<=data.buildings[id].tiers.length;stage++){
   b.level=stage;b.remaining=0;b.hp=data.buildings[id].tiers[stage-1].hp;
   const expected={...base};
   for(const [key,value] of Object.entries(data.buildings[id].flatAuras))expected[key]+=value*stage;
   const actual=auras(g.world,data);
   for(const key of Object.keys(base))assert.ok(Math.abs(actual[key]-expected[key])<1e-9,`${id} stage ${stage} ${key}`);
   b.remaining=5;assert.deepEqual(auras(g.world,data),base);
   b.remaining=0;b.hp=0;assert.deepEqual(auras(g.world,data),base);
  }
 }
});

test('GW1: every stage round-trips and old saves import without a version bump',()=>{
 assert.equal(VERSION,15);
 for(const id of ids)for(let stage=1;stage<=data.buildings[id].tiers.length;stage++){
  const g=fresh(11),b=makeBuilding(id,2,2,data);b.level=stage;b.hp=data.buildings[id].tiers[stage-1].hp;
  g.world.buildings.push(b);assert.equal(validateSave(g.state,data),true);
  const back=importSaveBlob(exportSave(g.state),data);assert.equal(back.ok,true);
  const restored=back.state.world.buildings.find(x=>x.type===id);
  assert.equal(restored.level,stage);assert.equal(restored.hp,b.hp);assert.equal(back.state.version,15);
 }
 const g=fresh(11);g.state.version=13;delete g.world.pendingRewards;
 const back=importSaveBlob(JSON.stringify(g.state),data);assert.equal(back.ok,true);
 assert.equal(back.state.version,15);assert.ok(back.state.world.buildings.every(b=>!ids.includes(b.type)));
});
