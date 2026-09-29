import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit,buildingCost,buildingLimit,buildingCount} from '../src/model.js';
import {Game} from '../src/game.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const rich=()=>{const g=new Game(data);g.world.resources={wood:999999,food:999999,gold:999999,frostwood:9999,plate:9999,lumber:9999,flour:9999,bread:9999};return g;};

// ---- Upper-tier cost curves ----

test('phase2: data curves steepen upper tiers and keep the opening friendly',()=>{
 const w=createWorld(data);
 const bare={...w,troops:[]};
 const tower=data.buildings.tower.cost;
 const c1=buildingCost('tower',1,bare,data),c2=buildingCost('tower',2,bare,data),c4=buildingCost('tower',4,bare,data);
 assert.equal(c1.wood,tower.wood,'tier 1 stands at base price');
 assert.equal(c2.wood,tower.wood*2,'tier 2 keeps the legacy friendly curve');
 assert.equal(c4.wood,tower.wood*16,'tier 4 rides the endgame curve');
 assert.equal(c4.plate,20,'forged plate joins the high tier');
 assert.equal(c4.lumber,30,'and sawn lumber');
});

test('phase2: tierCosts extras are flat — the curve never multiplies them',()=>{
 const w=createWorld(data);
 const bare={...w,troops:[]};
 const store=data.buildings.storehouse.cost;
 const c3=buildingCost('storehouse',3,bare,data);
 assert.equal(c3.wood,store.wood*6);
 assert.equal(c3.gold,store.gold*6);
 assert.equal(c3.lumber,60,'extras name their own price');
 assert.equal(c3.plate,20);
});

test('phase2: buildings without a curve keep the legacy formula byte-for-byte',()=>{
 const w=createWorld(data);
 const bare={...w,troops:[]};
 const base=data.buildings.smeltery.cost;
 const c2=buildingCost('smeltery',2,bare,data);
 assert.deepEqual(c2,Object.fromEntries(Object.entries(base).map(([k,v])=>[k,Math.ceil(v*2)])));
});

test('phase2: the builder discount trims curve prices and extras alike',()=>{
 const w=createWorld(data);
 const builder=makeUnit('builder',data);
 w.troops=[builder];
 const plain={...w,troops:[]};
 const full=buildingCost('storehouse',3,plain,data);
 const cheap=buildingCost('storehouse',3,w,data);
 assert.ok(cheap.wood<full.wood,'curve price discounted');
 assert.ok(cheap.lumber<full.lumber,'extras discounted like coin');
});

test('phase2: every curve keeps tier 1 at base and tier 2 at double',()=>{
 for(const [id,b] of Object.entries(data.buildings)){
  if(!Array.isArray(b.costCurve)||!b.costCurve.length)continue;
  assert.equal(b.costCurve[0],1,`${id} tier 1 stays base`);
  assert.equal(b.costCurve[1],2,`${id} tier 2 stays friendly`);
  for(let i=1;i<b.costCurve.length;i++)assert.ok(b.costCurve[i]>=b.costCurve[i-1],`${id} curve never dips`);
 }
});

// ---- Building limits ----

test('phase2: limits read as numbers or per-level arrays, clamped at the end',()=>{
 assert.equal(buildingLimit('butchery',1,data),2,'flat number rule');
 assert.equal(buildingLimit('farm',3,data),3);
 assert.equal(buildingLimit('farm',9,data),6);
 assert.equal(buildingLimit('farm',99,data),6,'beyond the array, the last entry holds');
 assert.equal(buildingLimit('wall',9,data),Infinity,'walls stay uncapped for layouts');
 assert.equal(buildingLimit('trap',9,data),Infinity,'traps stay uncapped');
 assert.equal(buildingLimit('hall',9,data),Infinity,'no field, no limit');
});

test('phase2: game.build enforces the limit and the limit grows with the village',()=>{
 const g=rich();g.state.vlevel=3;
 const spots=[[2,2],[2,5],[9,2],[9,5],[2,8],[9,8]];
 let built=0;
 for(const [x,y] of spots){const b=g.build('farm',x,y);if(b&&b.type==='farm')built++;}
 const count=g.world.buildings.filter(b=>b.type==='farm'&&b.hp>0).length;
 assert.equal(count,buildingLimit('farm',3,data),'the village fills to its level cap and no further');
 assert.ok(built<spots.length,'at least one placement was refused');
 assert.match(g.message,/supports 3 Wheat Farms/i,'the refusal speaks plainly');
 g.state.vlevel=9;
 const more=g.build('farm',spots[built][0],spots[built][1]);
 assert.ok(more&&more.type==='farm','a higher village level opens more ground');
});

test('phase2: over-limit villages keep every building; ruins free a slot',()=>{
 const g=rich();g.state.vlevel=2;
 const farm=g.world.buildings.find(b=>b.type==='farm'&&b.hp>0);
 g.world.buildings.push(makeBuilding('farm',9,5,data),makeBuilding('farm',9,8,data));
 assert.equal(buildingCount(g.world,'farm'),3,'grandfathered beyond the level-2 cap');
 assert.equal(g.build('farm',2,2),undefined,'no new farm while over the cap');
 assert.equal(buildingCount(g.world,'farm'),3,'the village keeps what it built');
 farm.hp=0;
 assert.ok(g.build('farm',2,2),'a ruin frees a slot for the replacement');
});

test('phase2: multi-resource upper tiers are affordable only when the whole basket is there',()=>{
 const g=rich();g.state.vlevel=10;
 g.world.resources={wood:999999,gold:999999,food:999999};
 const tower=g.world.buildings.find(b=>b.type==='tower');
 tower.level=3;tower.remaining=0;tower.hp=data.buildings.tower.tiers[2].hp;
 assert.equal(g.upgrade(tower.id),undefined,'no plate, no lumber, no tier 4');
 assert.match(g.message,/Not enough resources/i);
 g.world.resources.plate=20;g.world.resources.lumber=30;
 g.upgrade(tower.id);
 assert.equal(tower.level,4,'the full basket raises the high tower');
});
