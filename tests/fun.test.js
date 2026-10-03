import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorld } from '../src/model.js';
import { Game } from '../src/game.js';
import { loadGuide, updateGuide } from '../src/systems/tutorial.js';
import { isMuted, toggleMute, sfx } from '../src/systems/audio.js';
const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'abilities', 'buildings', 'missions'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
test('guide walks place-collect-recruit-raid-survive without touching saves', () => {
  const g = new Game(data); g.state.world = createWorld(data);
  const guide = loadGuide(); guide.step = 0; guide.done = false; guide.farms = 0;
  let hint = updateGuide(guide, g); assert.equal(hint.index, 0);
  g.build('wall', 2, 2); hint = updateGuide(guide, g); assert.equal(hint.index, 1);
  g.world.gathered.food = guide.food + 20; hint = updateGuide(guide, g); assert.equal(hint.index, 2);
  g.recruit('warrior'); hint = updateGuide(guide, g); assert.equal(hint.index, 3);
  g.raid(2); assert.ok(g.world.raidPending); hint = updateGuide(guide, g); assert.equal(hint.index, 4);
  for (let i = 0; i < 70; i++) g.tick(.05);
  assert.equal(g.world.raidPending, null); assert.ok(g.world.enemies.length > 0);
  for (const e of g.world.enemies) e.hp = 1;
  for (let i = 0; i < 3000 && g.world.enemies.length; i++) g.tick(.05);
  assert.ok(g.world.raidResult && g.world.raidResult.won, 'raid resolves won through combat');
  assert.equal(updateGuide(guide, g), null); assert.equal(guide.done, true);
});
test('guide withholds the bonus when the raid is lost', () => {
  const g = new Game(data); g.state.world = createWorld(data);
  const guide = loadGuide(); guide.step = 4; guide.done = false;
  g.raid(2);
  for (let i = 0; i < 70; i++) g.tick(.05);
  assert.ok(g.world.enemies.length > 0);
  g.world.buildings.find(b => b.type === 'hall').hp = 0; g.tick(.05);
  assert.ok(g.world.raidResult && g.world.raidResult.won === false, 'defeat recorded');
  const hint = updateGuide(guide, g);
  assert.equal(guide.done, false); assert.equal(hint.index, 4);
});
test('raid warning spawns the party, tracks loot, and reports victory', () => {
  const g = new Game(data); g.state.world = createWorld(data);
  g.raid(3); assert.equal(g.world.raidPending.count, 3);
  for (let i = 0; i < 70; i++) g.tick(.05);
  assert.equal(g.world.enemies.length, 3); assert.equal(g.world.wave, 1);
  for (const e of g.world.enemies) e.hp = 1;
  for (let i = 0; i < 3000 && g.world.enemies.length; i++) g.tick(.05);
  assert.equal(g.world.enemies.length, 0);
  assert.ok(g.world.raidResult); assert.equal(g.world.raidResult.won, true);
});
test('repair-all charges wood per damage point and restores every building', () => {
  const g = new Game(data);
  const tower = g.world.buildings.find(b => b.type === 'tower'); tower.hp = 10;
  const before = g.world.resources.wood; g.repairAll();
  assert.ok(tower.hp > 10); assert.ok(g.world.resources.wood < before);
});
test('audio synth is Node-safe and mute toggles', () => {
  sfx.place(); sfx.win();
  const m = isMuted(); toggleMute();
  assert.equal(isMuted(), !m); toggleMute(); assert.equal(isMuted(), m);
});
