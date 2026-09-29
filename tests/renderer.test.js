import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {Renderer} from '../src/renderer.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));

// Absorbing 2d context: every method no-ops, gradients carry addColorStop,
// measureText reports a width, drawImage/getImageData stay silent.
function stubCtx() {
  const gradient = {addColorStop() {}};
  return new Proxy({}, {get(t, prop) {
    if (prop === 'measureText') return () => ({width: 42});
    if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => gradient;
    if (prop === 'getImageData') return () => ({data: []});
    if (typeof prop === 'string') return (...a) => t[prop] ?? undefined;
    return undefined;
  }, set(t, prop, v) { t[prop] = v; return true; }});
}
function boot() {
  const canvas = {width: 1100, height: 740, getContext: () => stubCtx()};
  const game = new Game(data);
  const images = Object.fromEntries([...game.world.buildings.flatMap(() => []), 'x'].map(n => [n, {naturalWidth: 32, naturalHeight: 32}]));
  const renderer = new Renderer(canvas, data, images);
  return {game, renderer};
}

test('visual pass: full frame renders in every UI state without errors', () => {
  const {game, renderer} = boot();
  const w = game.world;
  for (let i = 0; i < 40; i++) game.tick(.05);
  const b = w.buildings[0], u = w.troops[0];
  // Selection pills, hover ring, placement ghost, range preview.
  renderer.selection = b.id; renderer.hover = {x: b.x, y: b.y};
  assert.doesNotThrow(() => renderer.draw(w, 1000));
  renderer.selection = u.id; renderer.hover = {x: Math.floor(u.x), y: Math.floor(u.y)};
  u.order = {kind: 'move', x: 5, y: 5};
  assert.doesNotThrow(() => renderer.draw(w, 2000));
  renderer.selection = null; renderer.placing = 'farm'; renderer.grid = true;
  assert.doesNotThrow(() => renderer.draw(w, 3000));
  renderer.placing = null;
  // Raid banners, enemy march, damaged + ruined + constructing buildings.
  w.enemies.push({id: 900, x: 2.5, y: 7.5, hp: 40, maxHp: 60});
  w.raidPending = {count: 6, timer: 3};
  b.hp = 1; w.buildings[1].hp = 0; w.buildings[2].remaining = 3;
  assert.doesNotThrow(() => renderer.draw(w, 4000));
  w.raidPending = null;
  assert.doesNotThrow(() => renderer.draw(w, 5000));
});

test('visual pass: calm mode renders the same states without motion', () => {
  const {game, renderer} = boot();
  renderer.calm = true;
  renderer.selection = game.world.buildings[0].id;
  renderer.hover = {x: 9, y: 8};
  assert.doesNotThrow(() => renderer.draw(game.world, 1000));
  game.world.enemies.push({id: 901, x: 3.5, y: 6.5, hp: 20, maxHp: 60});
  assert.doesNotThrow(() => renderer.draw(game.world, 8000));
});

test('visual pass: renderer effects stay capped so juice never floods', () => {
  const {game, renderer} = boot();
  for (let i = 0; i < 200; i++) renderer.burst(game.world, 5, 5, 5, 5, 'sparkle', .4);
  assert.ok(game.world.effects.length <= 60);
});
