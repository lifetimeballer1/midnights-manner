import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const data = Object.fromEntries(await Promise.all(['troops','buildings','missions','items'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));

test('extended content: 3 troops distinct, not reskins', ()=>{
  for (const id of ['warden','ranger','forager']) assert.ok(data.troops[id], id);
  const w = data.troops.warden, r = data.troops.ranger, f = data.troops.forager;
  assert.ok(w.base.hp > 150 && w.base.speed <= 1.1, 'warden is the slow tank');
  assert.ok(r.base.range >= 4.5 && r.base.hp < 90, 'ranger is the fragile sniper');
  assert.equal(f.role, 'collector');
  assert.equal(f.gatherFrom, 'grove');
  assert.notEqual(w.sprite, r.sprite);
  const sig = t => [t.base.hp, t.base.damage, t.base.speed, t.base.range].join('/');
  assert.ok(new Set([sig(w), sig(r), sig(f), sig(data.troops.warrior)]).size === 4, 'stat lines must differ');
  for (const [id, t] of Object.entries(data.troops)) assert.ok(data.items[t.defaultGear], `${id} gear resolves`);
});

test('extended content: grove + watchfire distinct roles', ()=>{
  assert.ok(data.buildings.grove && data.buildings.watchfire);
  assert.equal(data.buildings.grove.production, 'food');
  assert.equal(data.buildings.grove.workplace, 'forager');
  assert.ok(data.buildings.watchfire.tiers[0].damage > 0, 'watchfire defends');
  assert.ok(data.buildings.watchfire.tiers[0].range > data.buildings.tower.tiers[0].range, 'watchfire outranges the tower with less damage');
  assert.ok(data.buildings.watchfire.tiers[0].damage < data.buildings.tower.tiers[0].damage);
});

test('extended content: chapters 04-06 chain correctly', ()=>{
  for (const id of ['ember-road','moonwell','last-stand']) {
    const m = data.missions.find(m=>m.id===id);
    assert.ok(m, id);
    for (const b of m.map.buildings) assert.ok(data.buildings[b.type], `${id} building ${b.type}`);
    for (const t of m.map.troops) assert.ok(data.troops[t], `${id} troop ${t}`);
    for (const r of m.requires) assert.ok(data.missions.some(m=>m.id===r), `${id} prerequisite ${r}`);
  }
  const chain = ['long-night','ember-road','moonwell','last-stand'];
  for (let i=1;i<chain.length;i++) assert.ok(data.missions.find(m=>m.id===chain[i]).requires.includes(chain[i-1]));
  assert.equal(data.missions.length, 6);
});
