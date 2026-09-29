import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {makeBuilding, housing, buildingCost} from '../src/model.js';
import {reserveCapacity} from '../src/resources.js';

const names=['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','biomes','expansion'];
const data=Object.fromEntries(await Promise.all(names.map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));

test('upgrade expansion: longhouse owns three real housing tiers with distinct sprites', async()=>{
 const spec=data.buildings.longhouse;
 assert.equal(spec.minLevel,5);
 assert.deepEqual(spec.housing,[14,22,32]);
 assert.deepEqual(spec.tierGates,{2:6,3:8});
 assert.deepEqual(spec.tiers.map(t=>t.hp),[900,1250,1700]);
 assert.equal(new Set(spec.tiers.map(t=>t.sprite)).size,3,'each longhouse tier has its own sprite');
 const files=await Promise.all(spec.tiers.map(t=>readFile(new URL(`../assets/sprites/${t.sprite}`,import.meta.url))));
 assert.ok(!files[0].equals(files[1])&&!files[1].equals(files[2])&&!files[0].equals(files[2]),'longhouse tier art is structurally distinct');
});

test('upgrade expansion: core producers gain gated tier 4 with 4x output and reserve growth',async()=>{
 for(const id of ['farm','lumber','mine']){
  const spec=data.buildings[id];
  assert.equal(spec.tiers.length,4,`${id} has four tiers`);
  assert.equal(spec.tierGates['4'],8,`${id} tier 4 waits for village level 8`);
  assert.equal(spec.tiers[3].rateMultiplier,4,`${id} tier 4 is 4x base output`);
  assert.equal(reserveCapacity(spec,4),2000,`${id} tier 4 reserve grows with production`);
  assert.equal(new Set(spec.tiers.map(t=>t.sprite)).size,4,`${id} uses distinct tier sprites`);
  const third=await readFile(new URL(`../assets/sprites/${spec.tiers[2].sprite}`,import.meta.url));
  const fourth=await readFile(new URL(`../assets/sprites/${spec.tiers[3].sprite}`,import.meta.url));
  assert.ok(!third.equals(fourth),`${id} tier 4 sprite is not a copy of tier 3`);
 }
});

test('upgrade expansion: generic upgrade path enforces longhouse gates and updates housing',()=>{
 const d=structuredClone(data),g=new Game(d);
 g.world.resources={...g.world.resources,wood:100000,food:100000,gold:100000};
 const b=makeBuilding('longhouse',2,2,d);b.remaining=0;g.world.buildings.push(b);
 const baseline=housing(g.world,d).beds;
 assert.equal(baseline>=14,true);
 g.state.vlevel=5;g.upgrade(b.id);assert.equal(b.level,1,'level 5 cannot buy longhouse tier 2');
 g.state.vlevel=6;g.upgrade(b.id);assert.equal(b.level,2);assert.equal(housing(g.world,d).beds,baseline-14,'beds go offline while tier 2 is under construction');
 b.remaining=0;assert.equal(housing(g.world,d).beds,baseline+8,'finished tier 2 adds eight beds');
 g.state.vlevel=7;g.upgrade(b.id);assert.equal(b.level,2,'level 7 cannot buy longhouse tier 3');
 g.state.vlevel=8;g.upgrade(b.id);assert.equal(b.level,3);assert.equal(housing(g.world,d).beds,baseline-14,'beds go offline while tier 3 is under construction');
 b.remaining=0;assert.equal(housing(g.world,d).beds,baseline+18,'finished tier 3 reaches 32 beds');
});

test('upgrade expansion: tier-4 producer uses existing late-tier price curve and gate',()=>{
 const d=structuredClone(data),g=new Game(d);
 g.world.resources={...g.world.resources,wood:100000,food:100000,gold:100000};
 const farm=makeBuilding('farm',3,3,d,3);farm.remaining=0;g.world.buildings.push(farm);
 const quoteWorld=structuredClone(g.world);quoteWorld.troops=[];
 const quoted=buildingCost('farm',4,quoteWorld,d);
 assert.deepEqual(quoted,{wood:440},'tier 4 keeps the existing 8x-base late-tier price curve before builder discounts');
 g.state.vlevel=7;g.upgrade(farm.id);assert.equal(farm.level,3,'tier 4 stays locked before level 8');
 g.state.vlevel=8;g.upgrade(farm.id);assert.equal(farm.level,4);
 assert.equal(farm.hp,640);
});
