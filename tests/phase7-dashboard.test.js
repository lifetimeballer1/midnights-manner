import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {economyDashboard} from '../src/systems/dashboard.js';
import {reserveCapacity} from '../src/resources.js';
import {mealConfig,supplyCost} from '../src/systems/food.js';
const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','calendar'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const row=(dash,key)=>dash.rows.find(r=>r.key===key);

test('phase7: passive output reads per second and scales with the mid-game',()=>{
 const w=createWorld(data);
 const d0=economyDashboard(w,data);
 assert.equal(d0.dayLength,mealConfig(data).secondsPerDay);
 assert.equal(row(d0,'food').prod,2,'one tier-1 farm drips two food a second');
 w.elapsed=600;
 const d1=economyDashboard(w,data);
 assert.ok(Math.abs(row(d1,'food').prod-1.5)<1e-9,'the mid-game throttle eases to 75%');
});

test('phase7: a full reserve pauses the drip, exactly like the sim',()=>{
 const w=createWorld(data);
 const farm=w.buildings.find(b=>b.type==='farm');
 farm.harvestBonus=reserveCapacity(data.buildings.farm,farm.level);
 assert.equal(row(economyDashboard(w,data),'food').prod,0,'full reserve reads zero output');
});

test('phase7: the town table is a real daily draw',()=>{
 const w=createWorld(data);
 const dash=economyDashboard(w,data),supply=supplyCost(w,data);
 assert.ok(Math.abs(row(dash,'food').use-(25+supply.food)/180)<1e-9,'five mouths eat 25 food a day');
 assert.ok(Math.abs(row(dash,'bread').use-(5+supply.bread)/180)<1e-9,'and five loaves');
 assert.ok(Math.abs(row(dash,'food').net-(2-(25+supply.food)/180))<1e-9,'net = produced − used');
});

test('phase7: crewed recipes report both sides of the exchange',()=>{
 const w=createWorld(data);w.troops=[];
 const shop=makeBuilding('sawmill',2,2,data);w.buildings.push(shop);
 const hand=makeUnit('sawyer',data);hand.workplace=shop.id;w.troops.push(hand);
 const dash=economyDashboard(w,data);
 assert.ok(Math.abs(row(dash,'lumber').prod-1)<1e-9,'one crewed sawmill makes one plank a second');
 assert.ok(Math.abs(row(dash,'wood').use-(1+supplyCost(w,data).wood/180))<1e-9,'and eats two timber the same way');
});

test('phase7: hearth trickles join the same ledger',()=>{
 const w=createWorld(data);
 w.calendarBonus={food:0.5};
 const dash=economyDashboard(w,data);
 assert.ok(Math.abs(row(dash,'food').prod-2.5)<1e-9,'trickle rides the aura table');
});

test('phase7: an empty village has an empty ledger',()=>{
 const w=createWorld(data);w.buildings=[];w.troops=[];
 assert.deepEqual(economyDashboard(w,data).rows,[]);
});
