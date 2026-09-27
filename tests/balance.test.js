import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, buildingCost} from '../src/model.js';
import {tickEconomy, midgameRate} from '../src/systems/economy.js';
import {Game} from '../src/game.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));

function tapAll(w){
  for(const b of w.buildings){const spec=data.buildings[b.type];if(!spec.production||b.hp<=0||b.remaining>0)continue;const amt=Math.floor(b.harvestBonus||0);if(amt<1)continue;b.harvestBonus-=amt;w.resources[spec.production]=(w.resources[spec.production]||0)+amt;w.gathered[spec.production]=(w.gathered[spec.production]||0)+amt;}
}
function simulateGather(missionId, seconds) {
  const m = data.missions.find(m=>m.id===missionId);
  const w = createWorld(data, m);
  w.elapsed = 0;
  for (let i=0;i<seconds*20;i++) { w.elapsed += .05; tickEconomy(w, data, .05); if(i%20===0)tapAll(w); }
  tapAll(w);
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

test('mid-game reserve fill slower than opening (economy note applied)', ()=>{
  const fill=elapsed=>{const w=createWorld(data);w.troops=[];w.elapsed=elapsed;const farm=w.buildings.find(b=>b.type==='farm');farm.harvestBonus=0;for(let i=0;i<20;i++){w.elapsed+=.05;tickEconomy(w,data,.05);}return farm.harvestBonus||0;};
  const earlyRate=fill(60),midRate=fill(600);
  assert.ok(midRate < earlyRate, `mid-game ${midRate.toFixed(2)}/s should trail opening ${earlyRate.toFixed(2)}/s`);
  assert.ok(midRate > earlyRate * 0.5, 'slowdown should bite, not starve');
  const rampRate=fill(450);
  assert.ok(rampRate < earlyRate && rampRate > midRate * 0.95, 'ramp should ease, not cliff');
});

test('midgameRate eases from 1 to floor without a cliff', ()=>{
  assert.equal(midgameRate(0), 1);
  assert.equal(midgameRate(300), 1);
  assert.equal(midgameRate(600, 0.75), 0.75);
  const mid = midgameRate(450, 0.75);
  assert.ok(Math.abs(mid - 0.875) < 0.01, '450s halfway');
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
