import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, buildingCost} from '../src/model.js';
import {tickEconomy} from '../src/systems/economy.js';
import {Game} from '../src/game.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));

// Simulate a chapter: fresh mission world, run economy, check objective reachable.
function simulateGather(missionId, seconds) {
  const m = data.missions.find(m=>m.id===missionId);
  const w = createWorld(data, m);
  w.elapsed = 0;
  for (let i=0;i<seconds*20;i++) { w.elapsed += .05; tickEconomy(w, data, .05); }
  return {m, w};
}

test('chapter 1-3 objectives reachable within limits (quick wins kept)', ()=>{
  for (const id of ['first-harvest', 'timber-line', 'long-night']) {
    const limit = data.missions.find(m=>m.id===id).timeLimit;
    const {m, w} = simulateGather(id, limit);
    for (const o of m.objectives) {
      assert.ok(w.gathered[o.resource] >= o.amount, `${id}: ${o.resource} ${Math.floor(w.gathered[o.resource])}/${o.amount} in ${m.timeLimit}s`);
    }
  }
});

test('mid-game income slower than opening (economy note applied)', ()=>{
  const w1 = createWorld(data); w1.troops = []; w1.elapsed = 60;
  const f1 = w1.resources.food;
  for (let i=0;i<20;i++) { w1.elapsed += .05; tickEconomy(w1, data, .05); }
  const earlyRate = w1.resources.food - f1;
  const w2 = createWorld(data); w2.troops = []; w2.elapsed = 400;
  const f2 = w2.resources.food;
  for (let i=0;i<20;i++) { w2.elapsed += .05; tickEconomy(w2, data, .05); }
  const midRate = w2.resources.food - f2;
  assert.ok(midRate < earlyRate, `mid-game ${midRate.toFixed(2)}/s should trail opening ${earlyRate.toFixed(2)}/s`);
  assert.ok(midRate > earlyRate * 0.5, 'slowdown should bite, not starve');
});

test('upgrade pacing: early fast, mid-game slower, tier-3 costs hotter', ()=>{
  const g = new Game(data);
  g.world.elapsed = 60;
  g.world.resources = {food: 100000, wood: 100000, gold: 100000};
  const farm = g.world.buildings.find(b=>b.type==='farm');
  farm.remaining = 0;
  g.upgrade(farm.id);
  const earlyTime = farm.remaining;
  farm.remaining = 0; farm.level = 1; farm.hp = 160;
  g.world.elapsed = 400;
  g.upgrade(farm.id);
  const midTime = farm.remaining;
  assert.ok(midTime > earlyTime, `mid-game upgrade ${midTime}s should exceed early ${earlyTime}s`);
  const w = createWorld(data);
  const t2 = buildingCost('farm', 2, w, data).wood;
  const t3 = buildingCost('farm', 3, w, data).wood;
  assert.ok(t3 > t2 * 1.4, 'tier-3 should cost clearly more than linear');
});

test('new chapters 04-06 reachable (no soft-locks)', ()=>{
  for (const m of data.missions.filter(m=>['ember-road','moonwell','last-stand'].includes(m.id))) {
    const {w} = simulateGather(m.id, m.timeLimit);
    for (const o of m.objectives) {
      assert.ok(w.gathered[o.resource] >= o.amount, `${m.id}: ${o.resource} reachable`);
    }
  }
});
