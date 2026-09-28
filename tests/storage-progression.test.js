import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {makeBuilding,makeUnit,buildingLimit,buildingCount,center} from '../src/model.js';
import {storageCapacity,storageRoom} from '../src/resources.js';
import {tickEconomy} from '../src/systems/economy.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','levels','expansion','calendar']
 .map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])
));

test('dedicated stores add capacity without clamping an existing over-cap save',()=>{
 const g=new Game(structuredClone(data));
 assert.equal(storageCapacity(g.world,g.data,'food'),500,'tier-1 Manor supplies starter food storage');
 g.world.resources.food=900;
 assert.equal(storageRoom(g.world,g.data,'food'),0,'grandfathered resources stay over cap instead of being deleted');
 assert.equal(g.world.resources.food,900);
 const granary=makeBuilding('granary',2,2,g.data);
 g.world.buildings.push(granary);
 assert.equal(storageCapacity(g.world,g.data,'food'),1500,'granary adds its capacity to the Manor');
 assert.equal(storageRoom(g.world,g.data,'food'),600);
});

test('manual collection takes only what storage can hold and leaves the rest on-site',()=>{
 const g=new Game(structuredClone(data));
 g.state.research={points:0,completed:[],active:null};
 const farm=g.world.buildings.find(b=>b.type==='farm');
 g.world.resources.food=490;
 farm.harvestBonus=50;
 assert.equal(g.harvest(farm.id),10);
 assert.equal(g.world.resources.food,500);
 assert.equal(farm.harvestBonus,40);
 assert.equal(g.harvest(farm.id),false,'full storage blocks the next collection');
 assert.equal(farm.harvestBonus,40,'blocked collection never destroys producer output');
});

test('collector work feeds the producer buffer instead of bypassing storage',()=>{
 const g=new Game(structuredClone(data));
 const farm=g.world.buildings.find(b=>b.type==='farm');
 const worker=makeUnit('farmer',g.data,0);
 const at=center(farm,g.data);
 Object.assign(worker,{workplace:farm.id,x:at.x,y:at.y,carry:5,phase:'return'});
 g.world.troops=[worker];
 farm.harvestBonus=0;
 const before=g.world.resources.food;
 tickEconomy(g.world,g.data,.05);
 assert.equal(g.world.resources.food,before,'worker delivery never writes directly to global storage');
 assert.equal(worker.carry,0);
 assert.ok(farm.harvestBonus>=5,'worker haul lands in the farm reserve for later collection');
});

test('core producer limits grow from two to four through research unlock tokens',()=>{
 const g=new Game(structuredClone(data));
 g.state.research={points:0,completed:[],active:null};
 assert.equal(buildingLimit(g.state,g.data,'farm'),2);
 g.world.buildings.push(makeBuilding('farm',2,2,g.data));
 assert.equal(buildingCount(g.world,'farm'),2);
 g.world.resources={...g.world.resources,wood:10000,food:10000,gold:10000};
 const before={...g.world.resources};
 assert.equal(g.build('farm',3,2),undefined,'new construction is refused at the cap before placement');
 assert.deepEqual(g.world.resources,before,'cap refusal spends nothing');
 g.state.research.completed.push('masonry');
 assert.equal(buildingLimit(g.state,g.data,'farm'),3);
 g.state.research.completed.push('engineering');
 assert.equal(buildingLimit(g.state,g.data,'farm'),4);
});

test('research gates high core tiers and the Longhouse now upgrades twice',()=>{
 const g=new Game(structuredClone(data));
 g.state.research={points:0,completed:[],active:null};
 const farm=g.world.buildings.find(b=>b.type==='farm');
 farm.level=3;farm.hp=g.data.buildings.farm.tiers[2].hp;farm.remaining=0;
 g.world.resources={...g.world.resources,wood:10000,food:10000,gold:10000};
 g.upgrade(farm.id);
 assert.equal(farm.level,3,'tier 4 waits for logistics research');
 g.state.research.completed.push('masonry');
 g.upgrade(farm.id);
 assert.equal(farm.level,4);
 assert.equal(g.data.buildings.farm.tiers.length,6);
 assert.equal(g.data.buildings.lumber.tiers.length,6);
 assert.equal(g.data.buildings.mine.tiers.length,6);
 assert.equal(g.data.buildings.longhouse.tiers.length,3);
 assert.deepEqual(g.data.buildings.longhouse.housing,[14,24,38]);
});

test('technology tree owns storage buildings, extra slots and tier milestones',()=>{
 const masonry=data.world.technologies.find(t=>t.id==='masonry');
 const engineering=data.world.technologies.find(t=>t.id==='engineering');
 assert.ok(masonry&&engineering);
 for(const id of ['granary','lumber_storage','treasury'])assert.ok(masonry.unlocks.includes(id));
 assert.ok(engineering.unlocks.includes('warehouse'));
 for(const id of ['farm','lumber','mine']){
  assert.equal(data.buildings[id].limit.unlocks[0].research,'masonry');
  assert.equal(data.buildings[id].limit.unlocks[1].research,'engineering');
  assert.equal(data.buildings[id].tierRequires[4],'masonry');
  assert.equal(data.buildings[id].tierRequires[6],'engineering');
 }
 assert.equal(data.buildings.longhouse.tierRequires[2],'masonry');
 assert.equal(data.buildings.longhouse.tierRequires[3],'engineering');
});
