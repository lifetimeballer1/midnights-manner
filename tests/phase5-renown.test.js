import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,makeUnit,auras,buildingLimit,housing} from '../src/model.js';
import {renownCost,renownTitle,renownLimitBonus,renownTroopBonus,renownUnlocksFor,renownRewardsUpTo} from '../src/systems/endgame.js';
const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame']
  .map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const home=()=>{const g=new Game(data);g.state={...g.state,world:createWorld(data),home:null,mission:null,vlevel:9};return g;};
const rich=g=>{g.world.resources={gold:999999,food:999999,wood:999999,flour:99999,lumber:99999,bread:99999,plate:99999,frostwood:99999};return g;};

// ---- The basket cost ----

test('phase5: renown asks the whole basket and climbs 35% a level',()=>{
 const c0=renownCost(data,0);
  assert.deepEqual(c0,{gold:4500,food:2000,wood:2400,flour:60,lumber:900,bread:120,plate:120,frostwood:240});
 const c1=renownCost(data,1);
 for(const k of Object.keys(c0))assert.ok(c1[k]>c0[k],`${k} climbs`);
  assert.equal(c1.gold,Math.ceil(4500*1.35));
 const c12=renownCost(data,12);
 assert.ok(c12.lumber>c1.lumber*20,'the ladder keeps climbing forever');
 assert.ok(c12.frostwood>c0.frostwood*20,'rare goods climb too');
 assert.ok(c12.gold>c12.plate,'coin carries the heaviest count');
});

test('phase5: a missing good refuses the purchase before anything is paid',()=>{
 const g=home();
 g.world.resources={gold:100000,food:100000,wood:100000,flour:1000,lumber:1000,bread:0,plate:1000,frostwood:1000};
 const before=structuredClone(g.world.resources);
 assert.equal(g.raiseRenown(),undefined);
 assert.deepEqual(g.world.resources,before,'nothing moved');
 assert.match(g.message,/bread/,'the refusal names the missing good');
 assert.equal(g.world.renown||0,0,'no level bought');
});

test('phase5: buying renown pays the basket exactly and speaks the milestone',()=>{
 const g=rich(home());
 const before=structuredClone(g.world.resources),cost=renownCost(data,0);
 assert.equal(g.raiseRenown(),true);
 for(const [k,v] of Object.entries(cost))assert.equal(g.world.resources[k],before[k]-v,`${k} paid exactly`);
 assert.ok(g.message.includes('Keeper of the Manner'),'the title is announced');
 assert.equal(g.world.renown,1);
});

test('phase5: milestone unlocks merge once and heal on the next purchase',()=>{
 const g=rich(home());
 while((g.world.renown||0)<4)assert.equal(g.raiseRenown(),true);
 assert.ok(g.state.unlocks.includes('banner-cloak-grey'),'level 4 unlocks the grey banner');
 assert.ok(!g.locked('banner-cloak-grey'),'the banner is earnable through renown');
 assert.ok(g.message.includes('Banner of the Manner'),'the milestone speaks');
 const count=g.state.unlocks.filter(id=>id==='banner-cloak-grey').length;
 rich(g);g.raiseRenown();
 assert.equal(g.state.unlocks.filter(id=>id==='banner-cloak-grey').length,count,'never double-listed');
});

// ---- Rewards are caps and cosmetics, never production ----

test('phase5: milestones grant titles, building room and muster room',()=>{
 const w={renown:0};
 assert.equal(renownTitle(w,data),null,'no renown, no title');
 const baseLimit=buildingLimit('farm',3,data);
 w.renown=1;
 assert.equal(renownTitle(w,data),'Keeper of the Manner');
 assert.equal(renownLimitBonus(w,data),1);
 assert.equal(buildingLimit('farm',3,data,renownLimitBonus(w,data)),baseLimit+1,'one more building stands');
 assert.equal(buildingLimit('wall',3,data,renownLimitBonus(w,data)),Infinity,'uncapped lines stay uncapped');
 assert.equal(renownTroopBonus(w,data),0);
 w.renown=6;
 assert.equal(renownTroopBonus(w,data),4,'two levels of two');
 w.renown=99;
 assert.equal(renownTitle(w,data),'The Everlasting');
 assert.equal(renownLimitBonus(w,data),4);
});

test('phase5: renown never moves a single production aura',()=>{
 const before=auras(createWorld(data),data);
 const w=createWorld(data);w.renown=10;
 const after=auras(w,data);
 assert.deepEqual(after,before,'the surplus cure seeds no new surplus');
});

test('phase5: the reward table is caps and cosmetics only by construction',()=>{
 const rewards=data.endgame.renown.rewards;
 assert.ok(Array.isArray(rewards)&&rewards.length>=10,'ten named milestones');
 const allowed=new Set(['level','title','text','unlocks','limitBonus','troopCap']);
 for(const r of rewards){
  assert.ok(Number.isFinite(+r.level),'every reward names its level');
  for(const k of Object.keys(r))assert.ok(allowed.has(k),`${k} is not a renown reward key`);
 }
 for(const id of renownUnlocksFor(data,99))assert.ok(data.items[id]||data.buildings[id]||data.troops[id],`unlock ${id} exists`);
 assert.equal(renownRewardsUpTo({renown:3},data).length,3,'milestones read by level');
});

// ---- Integration: the muster grows with renown ----

test('phase5: renown muster room raises the recruit cap above the beds',()=>{
 const g=home();
 for(let i=0;i<3;i++){const c=makeBuilding('cottage',2,5+i*3,data);g.world.buildings.push(c);}
 const beds=housing(g.world,data).beds;
 assert.equal(beds,18,'three cottages hold eighteen');
 g.world.troops=[];
 for(let i=0;i<beds;i++)g.world.troops.push(makeUnit('warrior',data));
 g.world.resources={food:999999,gold:999999};
 assert.equal(g.recruit('warrior'),undefined,'no muster room at the bed count');
 g.world.renown=6;
 const joined=g.recruit('warrior');
 assert.ok(joined&&joined.type==='warrior','renown opens four more places');
 assert.equal(g.world.troops.length,beds+1);
});
