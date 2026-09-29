import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit,center} from '../src/model.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickRefine} from '../src/systems/crafting.js';
import {storageCap,centralRoom,depositCentral,grantCentral,flushPending,isOverCap} from '../src/systems/storage.js';
import {migrateToLatest,VERSION} from '../src/storage.js';
import {performTrade,dealsFor} from '../src/systems/calendar.js';
import {Game} from '../src/game.js';
import {insideWorkplace} from '../src/systems/villagers.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','calendar','traders'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));

// ---- Caps come from data ----

test('storage caps: base floor + hall + storehouse tiers',()=>{
 const w=createWorld(data);
 const base=storageCap(w,data,'wood');
 assert.equal(base,data.world.storageBase.wood+data.buildings.hall.storage.wood,'base floor plus the hall');
 const store=makeBuilding('storehouse',2,2,data);
 w.buildings.push(store);
 assert.equal(storageCap(w,data,'wood'),base+data.buildings.storehouse.storage.wood,'one storehouse adds its tier-1 share');
 store.level=3;store.hp=data.buildings.storehouse.tiers[2].hp;
 assert.equal(storageCap(w,data,'wood'),base+data.buildings.storehouse.storage.wood*3,'storage grows with the building tier');
 store.hp=0;
 assert.equal(storageCap(w,data,'wood'),base,'ruins hold nothing');
 assert.equal(storageCap({buildings:[]},{},'unobtanium'),Infinity,'keys with no data stay uncapped');
});

test('depositCentral banks what fits and grandfathers over-cap stores',()=>{
 const w=createWorld(data);
 const cap=storageCap(w,data,'food');
 w.resources.food=cap+5000;
 assert.equal(isOverCap(w,data,'food'),true);
 assert.equal(centralRoom(w,data,'food'),0);
 assert.deepEqual(depositCentral(w,data,'food',100),{banked:0,leftover:100});
 assert.equal(w.resources.food,cap+5000,'over-cap balance keeps every unit');
 w.resources.food=cap-40;
 const g0=w.gathered.food||0;
 const part=depositCentral(w,data,'food',100);
 assert.equal(part.banked,40);
 assert.equal(part.leftover,60);
 assert.equal(w.resources.food,cap);
 assert.equal(w.gathered.food,g0+40,'only banked units count toward objectives');
});

test('grant overflow waits in the ledgers and banks as room opens',()=>{
 const w=createWorld(data);
 const cap=storageCap(w,data,'gold');
 w.resources.gold=cap-10;
 grantCentral(w,data,'gold',25);
 assert.equal(w.resources.gold,cap);
 assert.equal(w.pendingRewards.gold,15,'the rest is held, never lost');
 assert.deepEqual(flushPending(w,data),{},'no room yet, nothing lands');
 w.resources.gold=0;
 assert.deepEqual(flushPending(w,data),{gold:15});
 assert.equal(w.resources.gold,15);
 assert.equal(w.pendingRewards.gold,undefined);
});

// ---- Production paths hold, never vanish ----

test('a full store holds the harvest on-site, then resumes after spending',()=>{
 const g=new Game(data);const b=g.world.buildings.find(b=>b.type==='farm');
 const cap=storageCap(g.world,data,'food');
 b.harvestBonus=100;g.world.resources.food=cap+1000;
 assert.equal(g.harvest(b.id),false,'over-cap stores take nothing');
 assert.equal(b.harvestBonus,100,'the reserve is untouched');
 g.world.resources.food=0;
 assert.equal(g.harvest(b.id),100);
 assert.equal(b.harvestBonus,0);
 assert.equal(g.world.resources.food,100);
});

test('collectAll reports full stores instead of draining reserves',()=>{
 const g=new Game(data);const b=g.world.buildings.find(b=>b.type==='farm');
 const cap=storageCap(g.world,data,'food');
 b.harvestBonus=30;g.world.resources.food=cap+1;
 assert.deepEqual(g.collectAll(),{});
 assert.equal(b.harvestBonus,30,'nothing leaves a full store');
 assert.match(g.message,/full/i);
});

test('collectors keep carried goods when the stores are full',()=>{
 const w=createWorld(data);const hall=w.buildings.find(b=>b.type==='hall');
 const u=w.troops.find(t=>t.type==='farmer');assert.ok(u,'the starting roster walks with a farmer');
 const at=center(hall,data);u.x=at.x;u.y=at.y;u.carry=40;u.phase='return';
 const cap=storageCap(w,data,'food');w.resources.food=cap+5;
 tickEconomy(w,data,.05);
 assert.equal(u.carry,40,'carried load survives a full store');
 assert.equal(u.phase,'return');
 w.resources.food=0;
 tickEconomy(w,data,.05);
 assert.equal(u.carry,0,'delivered once room opens');
 assert.equal(w.resources.food,40);
});

test('refiners never make what the stores cannot take',()=>{
 const w=createWorld(data);w.troops=[];
 const shop=makeBuilding('sawmill',2,2,data);w.buildings.push(shop);
 const hand=makeUnit('sawyer',data);hand.workplace=shop.id;w.troops.push(hand);
 w.resources.wood=500;
 w.resources.lumber=storageCap(w,data,'lumber');
 const made=tickRefine(w,data,10);
 assert.equal(made.lumber,undefined,'no lumber while the stacks are full');
 assert.equal(w.resources.wood,500,'the input waits, unspent');
 w.resources.lumber=100;
 const made2=tickRefine(w,data,10);
 assert.ok(made2.lumber>0,'lumber flows again once there is room');
 assert.ok(w.resources.wood<500);
});

// ---- Player-initiated rewards refuse before goods move ----

test('a trade that cannot fit is refused before the coin moves',()=>{
 const w=createWorld(data);
 const cap=storageCap(w,data,'gold');
 const d={...data,traders:[{id:'cap-test',trader:'Tess',minLevel:1,give:{wood:10},take:{gold:25}}]};
 const day=new Date('2026-09-29T12:00:00Z');
 const deal=dealsFor(d.traders,data.calendar,day,2)[0];
 assert.equal(deal.id,'cap-test');
 const state={world:w,home:null,mission:null,completed:[],unlocks:[],xp:0,vlevel:2,questsCompleted:[],tradeDay:null,tradesUsed:{}};
 w.resources.gold=cap-5;w.resources.wood=100;
 const res=performTrade(state,d,deal.id,day);
 assert.equal(res.ok,false);
 assert.match(res.error,/full/i);
 assert.equal(w.resources.wood,100,'nothing was paid');
 assert.equal(w.resources.gold,cap-5,'nothing landed');
 w.resources.gold=0;
 const res2=performTrade(state,d,deal.id,day);
 assert.equal(res2.ok,true);
 assert.equal(w.resources.gold,25);
 assert.equal(w.resources.wood,90);
});

// ---- Migration ----

test('v13 saves grandfather every resource and gain the reward ledger',()=>{
 const w=createWorld(data);w.resources.food=999999;
 const old={version:13,world:w,home:null,mission:null,completed:[],unlocks:[],questsCompleted:[],xp:0,vlevel:1};
 const out=migrateToLatest(old,data);
 assert.equal(out.version,VERSION);
 assert.equal(out.world.resources.food,999999,'over-cap stores survive migration');
 assert.deepEqual(out.world.pendingRewards,{});
});

// ---- Working indoors is a render read, not a sim rule ----

test('posted workers step inside once they reach the shop',()=>{
 const w=createWorld(data);
 const post=makeBuilding('sawmill',2,2,data);w.buildings.push(post);
 const hand=makeUnit('sawyer',data);hand.workplace=post.id;
 const at=center(post,data);hand.x=at.x;hand.y=at.y;
 assert.equal(insideWorkplace(w,data,hand),true,'at the bench, indoors');
 hand.x=at.x+5;
 assert.equal(insideWorkplace(w,data,hand),false,'still walking — visible');
 hand.x=at.x;hand.order={kind:'hold'};
 assert.equal(insideWorkplace(w,data,hand),false,'manual orders bring them out');
 hand.order=null;hand.emergency={kind:'shelter'};
 assert.equal(insideWorkplace(w,data,hand),false,'emergency duties bring them out');
 const farm=w.buildings.find(b=>b.type==='farm');
 const farmer=w.troops.find(t=>t.type==='farmer');farmer.workplace=farm.id;
 const fp=center(farm,data);farmer.x=fp.x;farmer.y=fp.y;
 assert.equal(insideWorkplace(w,data,farmer),false,'collectors stay visible on purpose');
});
