import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {makeBuilding} from '../src/model.js';
import {recordTravel} from '../src/systems/trails.js';
import {tickAutomation,automationSettings,autoUpgradeTypeEnabled} from '../src/systems/automation.js';
import {chooseDestination} from '../src/systems/logistics.js';
import {spendingAvailable} from '../src/systems/steward-budget.js';
import {storageCap} from '../src/systems/storage.js';
import {automationStores} from '../src/automation-ui.js';
const data=Object.fromEntries(await Promise.all(['world','buildings','troops','items','abilities','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('LK slice: idle builder takes gated road job, raids pause it',()=>{
  const g=new Game(data);g.state.vlevel=9;const w=g.state.world;
  w.buildings.push(makeBuilding('stone-road',18,15,data,3));
  for(let i=0;i<250;i++)recordTravel(w,data,2.25,8.25,8.25,8.25);
  w.resources={...w.resources,wood:1000,gold:1000,lumber:1000};
  const b=w.troops.find(u=>data.troops[u.type]?.role==='builder');
  assert.ok(b,'needs a builder');
  tickAutomation(g,0.1);
  assert.equal(typeof b.builderTask?.kind,'string');
  assert.equal(b.builderTask.kind,'road');
  w.raidPending={timer:3,count:2};
  tickAutomation(g,2.1);
  assert.equal(b.builderTask,undefined);
});
test('LK slice: policies gate categories with max-tier and pct reserve',()=>{
  const g=new Game(data);const w=g.state.world;
  automationSettings(w);
  const s=w.automation;assert.ok(s.policies.walls,'walls category exists');
  s.policies.walls={on:false,maxTier:4,priority:'high'};
  assert.equal(autoUpgradeTypeEnabled(w,'wall'),false);
});
test('LK slice: policies maxTier caps upgrades and pct reserve floors spending',()=>{
  const g=new Game(data);const w=g.state.world;
  const s=automationSettings(w);
  s.policies.farms={on:true,maxTier:2,priority:'normal'};
  assert.equal(autoUpgradeTypeEnabled(w,'farm',{level:2,autoUpgrade:true}),false);
  assert.equal(autoUpgradeTypeEnabled(w,'farm',{level:1,autoUpgrade:true}),true);
  s.reservePct={walls:{wood:10}};
  w.resources.wood=storageCap(w,data,'wood');
  const floor=storageCap(w,data,'wood')*10/100;
  assert.equal(spendingAvailable(g,'wood',{purpose:'walls'}),w.resources.wood-floor);
});
test('LK slice: stores panel lists one policy row per category',()=>{
  const g=new Game(data);
  automationSettings(g.state.world);
  const html=automationStores(g);
  for(const c of ['walls','gates','towers','farms','mines','lumber','housing','storage','workshops','military','roads'])assert.ok(html.includes(c),c+' row exists');
});
test('LK slice: finished granary attracts food trips',()=>{
  const g=new Game(data);const w=g.state.world;
  const farm=w.buildings.find(b=>b.type==='farm');
  const gran=makeBuilding('grand-granary',7,4,data);gran.level=1;gran.remaining=0;w.buildings.push(gran);
  const dest=chooseDestination(w,data,farm,'food');
  assert.equal(dest.building.id,gran.id);
});
test('LK slice: unfinished granary does not attract food trips',()=>{
  const g=new Game(data);const w=g.state.world;
  const farm=w.buildings.find(b=>b.type==='farm');
  const gran=makeBuilding('grand-granary',7,4,data);gran.level=1;gran.remaining=10;w.buildings.push(gran);
  const dest=chooseDestination(w,data,farm,'food');
  assert.notEqual(dest.building.id,gran.id);
});
