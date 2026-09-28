import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {isWall,isGate,wallRow} from '../src/systems/walls.js';
import {blocked,nextStep} from '../src/systems/pathfinding.js';
import {tickCombat} from '../src/systems/combat.js';
import {defenseTarget,enemyBuildingTarget} from '../src/systems/tactics.js';
import {tickEmergency} from '../src/systems/emergency.js';
import {settlementThreat,defenseValue} from '../src/systems/raid-director.js';
import {startResearch,tickResearch} from '../src/systems/research.js';
import {exportSave,importSaveBlob,VERSION} from '../src/storage.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function world(){const w=createWorld(data);w.troops=[];w.enemies=[];return w;}

test('phase6: four new defenses exist with distinct tier sprites and roles',()=>{
 for(const id of ['gate','rampart','archer_tower','ballista'])assert.ok(data.buildings[id],id);
 for(const [id,b] of Object.entries(data.buildings)){
  if(!['gate','rampart','archer_tower','ballista'].includes(id))continue;
  const sprites=b.tiers.map(t=>t.sprite);
  assert.equal(new Set(sprites).size,sprites.length,`${id} reuses a tier sprite`);
 }
 assert.ok(data.buildings.gate.gate===true,'gate flagged for doctrine');
 assert.ok(data.buildings.gate.repeatPlace&&data.buildings.rampart.repeatPlace,'wall lines drag-build');
 assert.ok(data.buildings.rampart.tiers[0].hp>data.buildings.stonewall.tiers[0].hp,'rampart out-muscles stone');
 assert.ok(data.buildings.gate.tiers[0].hp>data.buildings.wall.tiers[0].hp,'gate holds better than palisade');
 assert.ok(data.buildings.archer_tower.tiers[0].range>data.buildings.watchfire.tiers[0].range,'archer tower is the range king');
 assert.ok(data.buildings.archer_tower.tiers[0].damage<data.buildings.tower.tiers[0].damage,'range paid for in damage');
 assert.ok(data.buildings.ballista.tiers[0].damage>data.buildings.tower.tiers[2].damage,'ballista hits hardest per shot');
 assert.equal(data.buildings.ballista.tiers[0].cooldown,2.6,'heavy engine reloads slowly');
});

test('phase6: new defenses start locked behind existing research, never new nodes',()=>{
 assert.equal(new Set(data.world.technologies.map(n=>n.branch)).size,6);
 assert.equal(data.world.technologies.length,12);
 for(const id of ['gate','rampart','archer_tower','ballista'])assert.ok(data.world.locked.includes(id),`${id} locked`);
 const tech=id=>data.world.technologies.find(n=>n.id===id);
 assert.ok(tech('masonry').unlocks.includes('gate')&&tech('masonry').unlocks.includes('rampart'));
 assert.ok(tech('fieldcraft').unlocks.includes('archer_tower'));
 assert.ok(tech('watchfires').unlocks.includes('ballista'));
 const s={world:createWorld(data),home:null,mission:null,completed:[],questsCompleted:[],xp:0,unlocks:[],research:{points:100,completed:[],active:null},vlevel:1};
 s.world.resources={wood:1000,gold:1000,food:100};
 assert.equal(startResearch(s,data,'masonry'),true);
 tickResearch(s,data,60);
 assert.ok(s.unlocks.includes('gate')&&s.unlocks.includes('rampart'),'masonry opens the gatehouse');
});

test('phase6: gates and ramparts join wall rows, gaps and corners still stop',()=>{
 const w=world();
 const a=makeBuilding('wall',2,2,data),g=makeBuilding('gate',3,2,data),r=makeBuilding('rampart',4,2,data);
 w.buildings.push(a,g,r,makeBuilding('wall',4,3,data),makeBuilding('wall',6,2,data));
 assert.ok(isWall(g)&&isWall(r)&&isGate(g)&&!isGate(a));
 assert.equal(wallRow(w,a.id,'x').length,3,'row runs wall-gate-rampart');
 assert.equal(wallRow(w,g.id,'x').length,3,'row starts from the gate too');
});

test('phase6: friendlies walk through gates, raiders stay walled out',()=>{
 const w=world();
 w.buildings.push(makeBuilding('gate',5,5,data));
 assert.equal(blocked(w,data,5,5),true,'enemies face a wall');
 assert.equal(blocked(w,data,5,5,true),false,'friends walk through');
 const from={x:4.5,y:5.5},to={x:6.5,y:5.5};
 assert.equal(nextStep(w,data,from,to,.9,false,false),null,'raider path stops at the gate');
 assert.ok(nextStep(w,data,from,to,.9,false,true),'villager path crosses the gate');
 const g=new Game(data);
 g.state.world=createWorld(data);g.world.troops=[makeUnit('warrior',data,0)];g.world.enemies=[];
 const gate=makeBuilding('gate',9,9,data);gate.remaining=0;g.world.buildings.push(gate);
 const u=g.world.troops[0];u.x=8.5;u.y=9.5;
 assert.equal(g.commandMove(u.id,9,9),true,'orders accept the gate tile');
 assert.deepEqual(u.order,{kind:'move',x:9.5,y:9.5});
});

test('phase6: raiders chew a blocking gate and prefer gates over farther halls',()=>{
 const w=world();
 for(let y=0;y<data.world.height;y++)w.buildings.push(makeBuilding('gate',5,y,data));
 const hall=makeBuilding('hall',6,5,data);w.buildings.push(hall);
 w.enemies=[{id:'e',x:4.5,y:5.5,hp:100,damage:10,attackTimer:0}];
 const gate=w.buildings.find(b=>b.type==='gate'&&b.y===5),hp=gate.hp;
 tickCombat(w,data,.1);
 assert.ok(gate.hp<hp,'blocked raider breaks the gate');
 const open=world();
 const far=makeBuilding('gate',8,5,data);far.remaining=0;
 const near=makeBuilding('farm',4,5,data);near.remaining=0;
 open.buildings.push(far,near);
 assert.equal(enemyBuildingTarget(open,data,{x:5.5,y:5.5,hp:50}).type,'gate','breach-seekers pick the gate over nearer roofs');
});

test('phase6: defenders answer an attacked gatehouse before a closer scout',()=>{
 const w=world();
 const gate=makeBuilding('gate',9,5,data);w.buildings.push(gate);
 const u={x:5,y:5};
 w.enemies=[{id:'scout',hp:30,x:6,y:5},{id:'breach',hp:30,x:8,y:5,targetId:gate.id}];
 assert.equal(defenseTarget(w,data,u).id,'breach');
});

test('phase6: builders mend gates and ramparts with wood, never ruins',()=>{
 const w=createWorld(data);
 const u=makeUnit('builder',data,0);u.x=4.5;u.y=5.5;w.troops=[u];w.enemies=[];
 const gate=makeBuilding('gate',5,5,data);gate.hp-=40;w.buildings=[gate];
 const hp=gate.hp,wood=w.resources.wood;
 w.raidPending={timer:25};tickEmergency(w,data,1);
 assert.equal(gate.hp,hp+6,'gate repaired');
 assert.ok(Math.abs(w.resources.wood-(wood-.4))<1e-8,'wood paid');
 const ramp=makeBuilding('rampart',6,5,data);ramp.hp-=40;w.buildings=[ramp];
 const rhp=ramp.hp;tickEmergency(w,data,1);
 assert.equal(ramp.hp,rhp+6,'rampart repaired');
});

test('phase6: archer tower outranges the watchtower, ballista reloads slow',()=>{
 const w=world();
 const archer=makeBuilding('archer_tower',10,10,data);archer.remaining=0;w.buildings.push(archer);
 w.enemies=[{id:'e',x:10.5,y:16.5,hp:1000,damage:5,attackTimer:0}];
 tickCombat(w,data,.05);
 assert.equal(w.enemies[0].hp,988,'archer tower lands at six tiles');
 assert.equal(archer.cooldown,1.2,'light tower keeps the classic cadence');
 const w2=world();
 const watch=makeBuilding('tower',10,10,data);watch.remaining=0;w2.buildings.push(watch);
 w2.enemies=[{id:'e',x:10.5,y:16.5,hp:1000,damage:5,attackTimer:0}];
 tickCombat(w2,data,.05);
 assert.equal(w2.enemies[0].hp,1000,'watchtower cannot reach six tiles');
 const w3=world();
 const bal=makeBuilding('ballista',10,10,data);bal.remaining=0;w3.buildings.push(bal);
 w3.enemies=[{id:'e',x:10.5,y:12.5,hp:1000,damage:5,attackTimer:0}];
 tickCombat(w3,data,.05);
 assert.equal(w3.enemies[0].hp,955,'ballista heavy hit lands');
 assert.equal(bal.cooldown,2.6,'heavy engine reloads slowly');
 const hp=w3.enemies[0].hp;
 tickCombat(w3,data,.05);
 assert.equal(w3.enemies[0].hp,hp,'still reloading — no second hit yet');
});

test('phase6: threat counts new defenses and still caps at 100',()=>{
 const g=new Game(data);
 g.state={...g.state,world:createWorld(data),home:null,mission:null,completed:[],vlevel:1};
 const low=settlementThreat(g.state).score;
 assert.equal(defenseValue(g.state.world),0,'starting town fields no phase-6 defenses');
 for(let i=0;i<12;i++){const b=makeBuilding(i%2?'rampart':'gate',1+(i%10),1,data);b.remaining=0;g.world.buildings.push(b);}
 assert.equal(defenseValue(g.state.world),12);
 assert.equal(settlementThreat(g.state).factors.defenses,10,'defense factor caps at ten');
 assert.ok(settlementThreat(g.state).score>low,'heavier walls draw heavier attention');
 g.world.resources.gold=100000;g.state.vlevel=20;g.world.wave=100;
 assert.ok(settlementThreat(g.state).score<=100,'score never breaks the cap');
});

test('phase6: old saves migrate with content intact and live cooldowns',()=>{
 const g=new Game(data);
 g.state={...g.state,world:createWorld(data),home:null,mission:null,completed:[],vlevel:1};
 const raw=JSON.parse(exportSave(g.state));
 raw.version=8;
 for(const b of raw.world.buildings)delete b.cooldown;
 const out=importSaveBlob(JSON.stringify(raw),data);
 assert.ok(out.ok,`migrates cleanly: ${out.error}`);
 assert.equal(out.state.version,VERSION);
 assert.equal(out.state.world.buildings.length,raw.world.buildings.length);
 assert.ok(out.state.world.buildings.every(b=>Number.isFinite(b.cooldown)),'cooldowns normalized');
 assert.deepEqual(out.state.world.resources,raw.world.resources);
});
