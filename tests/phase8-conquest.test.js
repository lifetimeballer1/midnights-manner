import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,makeUnit,auras,buildingLimit} from '../src/model.js';
import {spawnRaid,spawnExclusion} from '../src/systems/combat.js';
import {tickMission,finishMission} from '../src/systems/campaign.js';
import {bossSpec,bossTick} from '../src/systems/endgame.js';
import {
 conquestState,readinessChecks,readinessReason,scoutReason,assaultReason,
 applyAnnex,conquestLimitBonus,recordPreliminary,recordAssault,
} from '../src/systems/conquest.js';
const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest']
  .map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const fresh=(vlevel=1)=>{const g=new Game(data);g.state={...g.state,world:createWorld(data),home:null,mission:null,vlevel};return g;};
const rich=g=>{g.world.resources={wood:99999,food:99999,gold:99999,lumber:99999,plate:9999,frostwood:9999,flour:9999,bread:9999};return g;};
function prep(g){
 g.world.renown=2;
 const barracks=g.world.buildings.find(b=>b.type==='barracks');
 barracks.level=3;barracks.hp=data.buildings.barracks.tiers[2].hp;barracks.remaining=0;
 for(let i=0;i<8;i++)g.world.troops.push(makeUnit('warrior',data));
 g.scoutTribe();
 recordPreliminary(g.world,'ironshield-patrol');
 recordPreliminary(g.world,'ironshield-watch');
 g.state.completed=['dawn','ironshield-patrol','ironshield-watch'];
 return g;
}

// ---- Spawn protection ----

test('phase8: the spawn ring never touches the built-up town',()=>{
 const w=createWorld(data);
 const ex=spawnExclusion(w,data);
 assert.ok(ex.has('6,9')&&ex.has('4,7')&&ex.has('9,12'),'the farm footprint is padded by two');
 assert.ok(!ex.has('1,1'),'clear ground stays clear');
 assert.ok(!ex.has('10,13'),'beyond the buffer is clear ground');
 const loose=spawnExclusion(w,data,0);
 assert.ok(loose.has('6,9')&&!loose.has('4,9'),'buffer zero is the bare footprint');
});

test('phase8: raiders muster outside the settlement or beyond its edge',()=>{
 const w=createWorld(data);
 for(let y=1;y<11;y++)w.buildings.push(makeBuilding('wall',12,y,data));
 const ex=spawnExclusion(w,data);
 let covered=0;
 for(let y=1;y<11;y++)if(ex.has('13,'+y))covered++;
 assert.ok(covered>0,'the east edge ring is built up');
 w.wave=2; // next spawn lands on wave 3 — the east side
 spawnRaid(w,1,null,data);
 const foe=w.enemies.at(-1);
 assert.ok(foe&&foe.x>13.5,'the muster steps outward into the wild');
});

// ---- The tribe is data-shaped ----

test('phase8: the tribe, its outer works and its keep are data-shaped',()=>{
 const c=data.conquest;
 assert.equal(c.tribe.id,'ironshield');
 assert.equal(c.tribe.assault,'ironshield-keep');
 const mission=id=>data.missions.find(m=>m.id===id);
 for(const p of c.tribe.preliminaries){
  const m=mission(p.id);
  assert.ok(m,`${p.id} mission exists`);
  assert.equal(m.conquest,'preliminary',`${p.id} writes the ledger`);
  assert.ok(m.requires.length,`${p.id} is chained`);
 }
 const keep=mission(c.tribe.assault);
 assert.equal(keep.conquest,'assault');
 assert.ok(keep.launchCost&&Object.keys(keep.launchCost).length,'the campaign war chest is priced');
 assert.ok(keep.raids.some(r=>r.boss==='ironshield-warden'),'the leader rides the last wave');
 for(const a of c.annex)assert.ok(a.name&&a.text,`annex ${a.id} speaks`);
});

test('phase8: conquest leaders ride the boss machinery without joining the rotation',()=>{
 const spec=bossSpec(data,'ironshield-warden');
 assert.equal(spec.name,'Warden-Captain Brannoc');
 assert.equal(bossSpec(data,'cinder-maul').name,'Gorm the Cinder-Maul','home crowns still resolve');
 const w=createWorld(data);
 const foe={id:'b1',x:7.5,y:5.5,hp:900,maxHp:1000,damage:50,role:'boss',bossId:'ironshield-warden',attackTimer:0,animation:0,summonTimer:0,slamTimer:99};
 w.enemies.push(foe);
 const events=bossTick(w,data,foe,0.1);
 assert.ok(events.some(e=>e.kind==='slam'),'the shield-lord slams like any crown');
});

// ---- Scout, muster law, march ----

test('phase8: the muster law gates scouting and the march',()=>{
 const g=rich(fresh(9));
 assert.ok(readinessChecks(g.state,data).some(c=>!c.ok),'a fresh hall falls short');
 assert.match(String(readinessReason(g.state,data)),/muster falls short/);
 assert.match(String(scoutReason(g.state,data)),/muster falls short/,'even scouting waits');
 g.world.renown=2;
 const barracks=g.world.buildings.find(b=>b.type==='barracks');
 barracks.level=3;barracks.hp=data.buildings.barracks.tiers[2].hp;barracks.remaining=0;
 for(let i=0;i<8;i++)g.world.troops.push(makeUnit('warrior',data));
 assert.equal(readinessReason(g.state,data),null,'the muster stands ready');
 assert.equal(g.scoutTribe().ok,true,'scouts walk');
 assert.equal(conquestState(g.world).scouted,true);
 assert.match(g.message,/Ironshield/);
 assert.equal(g.scoutTribe(),undefined,'no second scouting');
 assert.match(String(assaultReason(g.state,data)),/outer works/,'the keep waits on the patrol and the watch');
 recordPreliminary(g.world,'ironshield-patrol');
 recordPreliminary(g.world,'ironshield-watch');
 assert.equal(assaultReason(g.state,data),null,'with the works broken, only the march remains');
 assert.equal(applyAnnex(g.state,data,'outpost').ok,false,'no keep, no land');
});

test('phase8: first-clears write the ledger and the keep pays the war chest',()=>{
 const g=prep(rich(fresh(9)));
 const before=structuredClone(g.world.resources);
 g.mission('ironshield-keep');
 assert.ok(g.state.mission,'the assault begins');
 const home=g.state.home,cost=data.missions.find(m=>m.id==='ironshield-keep').launchCost;
 for(const [k,v] of Object.entries(cost))assert.equal(home.resources[k],before[k]-v,`${k} mustered`);
 g.world.elapsed=300;g.world.raidKills=0;
 tickMission(g.state,data);
 assert.ok(g.world.enemies.some(e=>e.role==='boss'&&e.bossId==='ironshield-warden'),'Brannoc takes the field');
 assert.ok(String(g.state.mission.herald).includes('BRANNOC'),'the herald calls him by name');
 g.state.mission.status='won';
 finishMission(g.state,data);
 assert.equal(conquestState(g.world).assaultWon,true,'the keep is broken');
});

test('phase8: a thin chest refuses the march before anyone leaves',()=>{
 const g=prep(rich(fresh(9)));
 g.world.resources={wood:0,food:0,gold:0,lumber:0,plate:0,frostwood:0,flour:0,bread:0};
 g.state.home=g.world;
 g.mission('ironshield-keep');
 assert.equal(g.state.mission,null,'no stores, no march');
 assert.match(g.message,/campaign needs/);
});

// ---- Annex: one judgement, real coin ----

test('phase8: salvage lands through the storage gate and waits in the ledgers',()=>{
 const g=rich(fresh(9));
 const w=g.world;
 w.resources={wood:0,food:0,gold:0,lumber:0,plate:0,frostwood:0,flour:0,bread:0};
 recordAssault(w);
 const r=applyAnnex(g.state,data,'dismantle');
 assert.equal(r.ok,true);
 assert.equal(w.resources.lumber,1200,'salvage banks to the lumber cap');
 assert.equal(w.pendingRewards.lumber,2800,'the rest waits in the ledgers');
 assert.equal(w.resources.gold,3000,'coin lands under its ceiling');
 assert.equal(w.resources.plate,500);
 assert.equal(w.resources.frostwood,250);
 assert.equal(applyAnnex(g.state,data,'outpost').ok,false,'one judgement only');
});

test('phase8: an outpost lifts every building line and a settlement quickens hands',()=>{
 const g=rich(fresh(9));
 recordAssault(g.world);
 applyAnnex(g.state,data,'outpost');
 assert.equal(conquestLimitBonus(g.world,data),2);
 assert.equal(buildingLimit('farm',3,data,conquestLimitBonus(g.world,data)),buildingLimit('farm',3,data)+2,'two more of every line');
 assert.equal(buildingLimit('wall',3,data,conquestLimitBonus(g.world,data)),Infinity,'uncapped lines stay uncapped');
 const g2=rich(fresh(9));
 const base=auras(g2.world,data);
 recordAssault(g2.world);
 applyAnnex(g2.state,data,'settlement');
 const after=auras(g2.world,data);
 assert.ok(Math.abs(after.gather-base.gather-0.03)<1e-9,'the valley quickens hands');
 assert.ok(Math.abs(after.food-base.food-0.4)<1e-9,'and warms the hearth');
});

test('phase8: old saves wake unscouted with an empty ledger',()=>{
 const w=createWorld(data);
 delete w.conquest;
 const st=conquestState(w);
 assert.equal(st.scouted,false);
 assert.deepEqual(st.preliminaries,[]);
 assert.equal(st.assaultWon,false);
 assert.equal(st.annexed,null);
 assert.match(String(assaultReason({world:w,vlevel:9},data)),/Scout the tribe/);
});
