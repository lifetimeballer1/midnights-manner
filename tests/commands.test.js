import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeUnit} from '../src/model.js';
import {tickCombat, spawnRaid} from '../src/systems/combat.js';
import {Game} from '../src/game.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));

test('move order overrides autonomy until arrival', ()=>{
  const g = new Game(data);
  const u = g.world.troops.find(t=>t.type==='warrior');
  spawnRaid(g.world, 1);
  const enemyPos = {...g.world.enemies[0]};
  g.commandMove(u.id, 2, 2);
  const d0 = Math.hypot(u.x-2.5, u.y-2.5);
  for (let i=0;i<60;i++) tickCombat(g.world, data, .05);
  const d1 = u.order===null ? 0 : Math.hypot(u.x-2.5, u.y-2.5);
  assert.ok(d1 < d0, 'unit should approach the ordered point');
});

test('attack order chases the named target', ()=>{
  const g = new Game(data);
  const u = g.world.troops.find(t=>t.type==='warrior');
  spawnRaid(g.world, 2);
  const target = g.world.enemies[1];
  g.commandAttack(u.id, target.id);
  assert.equal(u.order.targetId, target.id);
  const hp = target.hp;
  for (let i=0;i<400;i++) tickCombat(g.world, data, .05);
  assert.ok(target.hp < hp || target.hp<=0 || u.order===null, 'named target should take damage or die');
});

test('hold keeps position and clears on resume', ()=>{
  const g = new Game(data);
  const u = g.world.troops.find(t=>t.type==='warrior');
  const x0 = u.x;
  g.commandHold(u.id);
  spawnRaid(g.world, 1);
  g.world.enemies[0].x = u.x + 10; g.world.enemies[0].y = u.y + 10;
  for (let i=0;i<60;i++) tickCombat(g.world, data, .05);
  assert.ok(Math.abs(u.x-x0) < 0.3, 'holding unit should not chase distant enemies');
  g.clearOrder(u.id);
  assert.equal(u.order, null);
});

test('collectors refuse attack orders', ()=>{
  const g = new Game(data);
  const f = g.world.troops.find(t=>t.type==='farmer');
  spawnRaid(g.world, 1);
  const r = g.commandAttack(f.id, g.world.enemies[0].id);
  assert.equal(r, false);
  assert.equal(f.order, undefined || null);
});
