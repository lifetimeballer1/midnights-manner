import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {tickAutomation,automationSettings,automationStatus,automationMaterialNeeds,automationConstructionNeeds} from '../src/systems/automation.js';
import {supplyPriorities} from '../src/systems/supply-priority.js';
import {tickCraft} from '../src/systems/crafting.js';
const data=Object.fromEntries(await Promise.all(['world','buildings','troops','items','abilities'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function fixture(){
 const w=createWorld(data);w.buildings=[];w.troops=[];w.enemies=[];w.raidPending=null;w.stock={};w.resources={wood:5000,gold:5000,lumber:5000,plate:5000,frostwood:5000};for(const t of w.tiles)t.claimed=true;
 const g={world:w,data,state:{mission:null,vlevel:20},locked:()=>false,upgrade(id){const b=w.buildings.find(b=>b.id===id);b.level++;b.remaining=10;w.resources.wood-=20;}};
 return {g,w};
}
function shop(w,type='forge'){const b=makeBuilding(type,4,4,data),u=makeUnit(type==='forge'?'weaponsmith':'armorer',data);b.craft=null;u.workplace=b.id;u.traits=[];w.buildings.push(b);w.troops.push(u);return b;}
function advance(g,n=1){for(let i=0;i<n;i++)tickAutomation(g,2);}
test('craft shortage signals include protected stores and disappear when the shop opts out',()=>{
 const {g,w}=fixture(),b=shop(w);w.troops.push(makeUnit('warrior',data));automationSettings(w).reserves.gold=5000;advance(g);
 assert.ok(automationMaterialNeeds(w).gold>w.resources.gold);assert.equal(supplyPriorities(w,data).get('gold').priority,75);
 const before=structuredClone(w.resources);b.autoCraft=false;advance(g);assert.deepEqual(automationMaterialNeeds(w),{});assert.deepEqual(w.resources,before);
});
test('unfunded opted-in upgrades publish construction needs without spending reserves',()=>{
 const {g,w}=fixture(),b=makeBuilding('farm',4,4,data);w.buildings.push(b);w.troops.push(makeUnit('builder',data));b.autoUpgrade=true;const cfg=automationSettings(w);cfg.autoUpgrade=true;cfg.reserves.wood=5000;advance(g);
 assert.ok(automationConstructionNeeds(w).wood>5000);assert.equal(supplyPriorities(w,data).get('wood').priority,80);assert.equal(b.remaining,0);assert.equal(w.resources.wood,5000);
});
test('staffed workshop chooses highest unlocked demanded gear; no downgrade when materials absent',()=>{
 const {g,w}=fixture(),b=shop(w);w.troops.push(makeUnit('warrior',data));g.locked=id=>id==='first-dawn-blade';advance(g);assert.equal(b.craft.item,'dawn-blade');
 b.craft=null;w.resources.frostwood=0;advance(g);assert.equal(b.craft,null);assert.match(automationStatus(g,b),/materials/);
});
test('staffing, opt out, material reserves and compatible demand gate automatic craft',()=>{
 const {g,w}=fixture(),b=shop(w);w.troops.push(makeUnit('warrior',data));automationSettings(w).reserves.gold=5000;advance(g);assert.equal(b.craft,null);
 w.automation.reserves={};b.autoCraft=false;advance(g);assert.equal(b.craft,null);b.autoCraft=true;w.troops[0].workplace=null;advance(g);assert.equal(b.craft,null);
 w.troops[0].workplace=b.id;w.troops.pop();advance(g);assert.equal(b.craft,null);
});
test('queues count toward demand and stock target prevents infinite production',()=>{
 const {g,w}=fixture(),b=shop(w),b2=shop(w),unit=makeUnit('warrior',data);w.troops.push(unit);unit.owned.push('first-dawn-blade');advance(g);
 assert.equal(w.buildings.filter(b=>b.craft).length,1);tickCraft(w,data,100);advance(g);assert.equal(b.craft,null);assert.equal(b2.craft,null);assert.equal(w.stock['first-dawn-blade'],1);
});
test('manual queued order is preserved, and armor demand uses armor ownership',()=>{
 const {g,w}=fixture(),b=shop(w,'armory'),unit=makeUnit('warrior',data);w.troops.push(unit);advance(g);assert.equal(b.craft.item,'aegis-of-dawn');
 b.craft={item:'levy-gambeson',remaining:5,total:5};advance(g);assert.equal(b.craft.item,'levy-gambeson');
});
test('builder reaches work, repairs hall before defenses and preserves wood reserves and manual orders',()=>{
 const {g,w}=fixture(),hall=makeBuilding('hall',4,4,data),wall=makeBuilding('wall',10,10,data),u=makeUnit('builder',data);w.buildings.push(wall,hall);w.troops.push(u);hall.hp-=60;wall.hp-=60;u.x=hall.x;u.y=hall.y;automationSettings(w).reserves.wood=4999;advance(g);
 assert.equal(u.builderTask.target,hall.id);for(let i=0;i<80;i++)tickAutomation(g,.1);assert.ok(hall.hp>data.buildings.hall.tiers[0].hp-60);assert.ok(w.resources.wood>=4999);assert.equal(wall.hp,data.buildings.wall.tiers[0].hp-60);
 u.order={kind:'hold'};const hp=hall.hp;advance(g);assert.equal(u.builderTask,undefined);assert.equal(hall.hp,hp);
});
test('auto upgrades opt in per building, wait for repairs/construction/raids, limit tier and start only one',()=>{
 const {g,w}=fixture(),a=makeBuilding('farm',4,4,data),b=makeBuilding('farm',10,4,data),u=makeUnit('builder',data);w.buildings.push(a,b);w.troops.push(u);a.autoUpgrade=b.autoUpgrade=true;advance(g);assert.equal(a.remaining,0);
 automationSettings(w).autoUpgrade=true;a.autoUpgradeMaxTier=1;advance(g);assert.equal(a.remaining,0);assert.equal(b.remaining,10);advance(g);assert.equal(a.remaining,0);
 b.remaining=0;b.autoUpgradeMaxTier=b.level;w.raidPending={seconds:10};a.autoUpgradeMaxTier=6;advance(g);assert.equal(a.remaining,0);w.raidPending=null;w.resources.wood=0;advance(g);assert.equal(a.remaining,0);
});
test('building-type auto upgrade applies to current and future buildings while legacy opt-ins still work',()=>{
 const {g,w}=fixture(),a=makeBuilding('farm',4,4,data),u=makeUnit('builder',data);w.buildings.push(a);w.troops.push(u);automationSettings(w).autoUpgrade=true;
 a.autoUpgrade=true;advance(g);assert.equal(a.remaining,10);
 a.remaining=0;a.level=1;a.autoUpgrade=false;w.automation.autoUpgradeTypes.farm=true;advance(g);assert.equal(a.remaining,10);
 a.remaining=0;a.level=1;const future=makeBuilding('farm',10,4,data);w.buildings.unshift(future);advance(g);assert.equal(future.remaining,10);
 future.remaining=0;future.level=1;w.automation.autoUpgradeTypes.farm=false;advance(g);assert.equal(future.remaining,0);assert.equal(a.remaining,0);
});

test('mission and status reads leave automation and jobs untouched',()=>{const {g,w}=fixture(),b=makeBuilding('farm',4,4,data);w.buildings.push(b);automationStatus(g,b);assert.equal(w.automation,undefined);g.state.mission={};advance(g);assert.equal(w.automation,undefined);});

test('raid warnings and sheltered workers pause new orders without losing manual queues',()=>{
 const {g,w}=fixture(),b=shop(w);w.troops.push(makeUnit('warrior',data));w.raidPending={seconds:10};advance(g);assert.equal(b.craft,null);
 w.raidPending=null;w.troops[0].shelteredIn='home';advance(g);assert.equal(b.craft,null);delete w.troops[0].shelteredIn;advance(g);assert.equal(b.craft.item,'first-dawn-blade');
 w.enemies=[{hp:10}];advance(g);assert.equal(b.craft.item,'first-dawn-blade');
 const remaining=b.craft.remaining;w.troops[0].emergency={kind:'shelter'};tickCraft(w,data,100);assert.equal(b.craft.remaining,remaining);delete w.troops[0].emergency;tickCraft(w,data,100);assert.equal(w.stock['first-dawn-blade'],1);
});

test('posted masons and smelters retain their workplace rather than taking builder tasks',()=>{
 const {g,w}=fixture(),hall=makeBuilding('hall',4,4,data);hall.hp-=20;w.buildings.push(hall);
 const u=makeUnit('smelter',data);u.workplace='manual-smeltery';u.manualPost=true;w.troops.push(u);advance(g);assert.equal(u.builderTask,undefined);assert.equal(u.workplace,'manual-smeltery');
});
