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

test('foot traffic makes a path only after movement and unused wear fades away', () => {
  const {game, renderer} = boot(), w = game.world, walker = w.troops[0];
  walker.x = 5.2; walker.y = 5.2;
  renderer.draw(w, 0);
  assert.equal(renderer.wornGround?.size, 0);
  walker.x = 5.45; w.elapsed = 1;
  renderer.draw(w, 1000);
  const first=renderer.wornGround?.get('5,5')?.strength;
  assert.ok(first>0);
  const second=w.troops[1];second.x=5.2;second.y=5.2;
  renderer.draw(w, 1100);
  second.x=5.45;w.elapsed=2;renderer.draw(w,1200);
  assert.ok(renderer.wornGround.get('5,5').strength>first,'repeated traffic deepens the wear');
  w.elapsed = 400;
  renderer.draw(w, 2000);
  assert.equal(renderer.wornGround.size, 0);
});

test('path memory stays bounded and resets when switching worlds', () => {
  const {game, renderer} = boot(), w = game.world, walker = w.troops[0];
  walker.x = 5.2; walker.y = 5.2;
  renderer.draw(w, 0);
  for(let i = 0; i < 300; i++) {
    walker.x = (i % 24) + .4; walker.y = Math.floor(i / 24) + .4;
    w.elapsed += .5;
    renderer.trackGroundWear(w);
  }
  assert.ok(renderer.wornGround.size <= 180);
  assert.ok(renderer.wornGround.size>0);
  renderer.draw({...w, troops: []}, 20000);
  assert.equal(renderer.wornGround.size, 0);
});

test('new villages have no prepainted road or checkerboard terrain', () => {
  const {game, renderer} = boot(), colors = new Map(), diamond = renderer.diamond.bind(renderer);
  renderer.diamond = (x,y,color,stroke) => {
    if(Number.isInteger(x)&&Number.isInteger(y)&&x>=5&&x<=10&&y>=5&&y<=10&&!colors.has(x+','+y))colors.set(x+','+y,color);
    assert.notEqual(color,'#a8895a','unwalked land must not show a fixed road');
    diamond(x,y,color,stroke);
  };
  renderer.draw(game.world, 0);
  const reds=[...colors.values()].map(color=>parseInt(color.slice(1,3),16));
  assert.ok(Math.max(...reds)-Math.min(...reds)<15,'nearby clear ground should vary gently, not alternate light/dark tiles');
});

test('worksite soil marks follow finished buildings without painting a fixed path', () => {
  const {game, renderer} = boot(), w=game.world;
  const count=renderer.drawWorkAreaGround(w);
  assert.ok(count>0);
  for(const b of w.buildings)b.hp=0;
  assert.equal(renderer.drawWorkAreaGround(w),0);
});

test('offscreen wear is not projected into ground polygons each frame', () => {
  const {game, renderer} = boot();let fills=0;
  renderer.ctx={beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){fills++;}};
  renderer.wornGround=new Map([['500,500',{strength:1,last:0,dx:1,dy:0}]]);
  renderer.drawGroundWear(game.world);
  assert.equal(fills,0);
});
