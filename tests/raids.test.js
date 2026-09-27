import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {Game} from '../src/game.js';
import {migrateToLatest, VERSION} from '../src/storage.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));

test('unlock chain: all chapters grant something real, nothing dead or doubled', ()=>{
  assert.ok(data.missions.length >= 9, 'nine chapters shipped; Act VII grows the campaign');
  const granted = [];
  for (const m of data.missions) {
    assert.ok(Array.isArray(m.unlocks) && m.unlocks.length > 0, `${m.id} grants an unlock`);
    for (const id of m.unlocks) {
      assert.ok(data.buildings[id] || data.items[id] || data.troops[id], `${m.id} unlock ${id} resolves`);
      assert.ok(data.world.locked.includes(id), `${m.id} unlock ${id} is genuinely locked until earned`);
      granted.push(m.id + ':' + id);
    }
  }
  // Twin Banners doctrine (Act VII): red-banner and grey-banner deliberately
  // cross-grant the mirror troop + shared cloak — showcase and recruit
  // separated by design, stated on both mission cards. Every other unlock
  // in the game is still granted exactly once.
  const mirror = new Set(['red-banner:halberdier', 'grey-banner:halberdier', 'red-banner:longbowman', 'grey-banner:longbowman', 'red-banner:banner-cloak', 'grey-banner:banner-cloak']);
  const rest = granted.filter(g => !mirror.has(g));
  assert.equal(new Set(rest).size, rest.length, `no duplicate unlocks outside the twin banners: ${rest.join(', ')}`);
});

test('timber-line re-deal: the Moon axe, not a second spike trap', ()=>{
  const first = data.missions.find(m=>m.id==='first-harvest');
  const second = data.missions.find(m=>m.id==='timber-line');
  assert.ok(first.unlocks.includes('trap'));
  assert.ok(!second.unlocks.includes('trap'), 'duplicate trap is gone');
  assert.ok(second.unlocks.includes('axe'), 'chapter 2 teaches the Moon axe');
  // Warriors still start on the free sword; the axe is an earned step up.
  assert.equal(data.troops.warrior.defaultGear, 'sword');
  assert.ok(data.items.axe.roles.includes('warrior'));
});

test('finale pays a trophy: last-stand unlocks the master toolkit', ()=>{
  const last = data.missions.find(m=>m.id==='last-stand');
  assert.ok(last.unlocks.includes('toolkit'));
  assert.ok(data.items.toolkit.roles.includes('builder'));
  assert.equal(data.troops.builder.defaultGear, 'hammer');
});

test('first raid is gentle and patient: scouts, not a siege, after five quiet minutes', ()=>{
  const g = new Game(data);
  g.state.world = createWorld(data);
  const cfg = data.world.homeRaids;
  assert.equal(g.world.nextRaidAt, cfg.firstAt);
  assert.equal(cfg.firstAt, 300);
  assert.equal(cfg.firstCount, 2);
  // Four quiet minutes: no horns, no raiders.
  for (let i=0;i<2400;i++) g.tick(.1);
  assert.ok(!g.world.raidPending);
  assert.equal(g.world.enemies.length, 0);
});

test('scheduled horns: warning with countdown, then the raid, then a verdict', ()=>{
  const g = new Game(data);
  g.state.world = createWorld(data);
  const cfg = data.world.homeRaids;
  g.world.elapsed = cfg.firstAt;
  g.tick(.05);
  // The horn sounds with a real countdown, not the 3s test-button blare.
  assert.ok(g.world.raidPending, 'horn warning raised');
  assert.equal(g.world.raidPending.count, cfg.firstCount);
  assert.ok(g.world.raidPending.timer > 3, `countdown is ${g.world.raidPending.timer}s, not instant`);
  assert.match(g.message, /raiders|horn|walls|lamps/i, 'warning speaks frontier');
  // Countdown burns down, then raiders walk out of the west.
  g.world.raidPending.timer = .01;
  g.tick(.05);
  assert.equal(g.world.raidPending, null);
  assert.equal(g.world.enemies.length, cfg.firstCount);
  assert.match(g.message, /wave 1/i, 'attack line names the wave');
  // The village fights and wins: verdict with loot, next horn scheduled.
  for (const e of g.world.enemies) e.hp = 1;
  for (let i = 0; i < 3000 && g.world.enemies.length; i++) g.tick(.05);
  assert.equal(g.world.enemies.length, 0);
  assert.ok(g.world.raidResult && g.world.raidResult.won, 'verdict recorded');
  assert.ok(g.world.nextRaidAt > g.world.elapsed, 'next horn scheduled in the future');
  assert.match(g.message, /bell|stands|salvage/i, 'verdict speaks frontier');
});

test('test-button raids still work and also reschedule the horns', ()=>{
  const g = new Game(data);
  g.state.world = createWorld(data);
  g.raid(3);
  assert.equal(g.world.raidPending.count, 3);
  g.world.raidPending.timer = .01;
  g.tick(.05);
  assert.equal(g.world.enemies.length, 3);
  for (const e of g.world.enemies) e.hp = 1;
  for (let i = 0; i < 3000 && g.world.enemies.length; i++) g.tick(.05);
  assert.equal(g.world.enemies.length, 0);
  assert.ok(g.world.raidResult && g.world.raidResult.won);
  assert.ok(g.world.nextRaidAt > g.world.elapsed, 'manual raid pushes the next scheduled horn out');
});

test('migration v3->v6: fresh raid clock, earned unlocks healed, stores untouched', ()=>{
  assert.equal(VERSION, 7);
  const w = createWorld(data);
  delete w.nextRaidAt;
  w.elapsed = 900; // a veteran village, long past the first horn
  const wood = w.resources.wood, troops = w.troops.length;
  const old = {version: 3, world: structuredClone(w), home: null, mission: null,
    completed: ['first-harvest', 'timber-line', 'long-night', 'ember-road', 'moonwell', 'last-stand'],
    unlocks: ['tower', 'trap'], xp: 120, vlevel: 2, questsCompleted: [],
    tradeDay: null, tradesUsed: {}, calendarDay: '2026-09-26', gatheredAtBell: null};
  const out = migrateToLatest(structuredClone(old), data);
  assert.equal(out.version, VERSION);
  assert.deepEqual(out.world.fallen, [], 'the cairn roll starts empty');
  // One full interval of peace — never an instant horn on first load.
  assert.equal(out.world.nextRaidAt, 900 + data.world.homeRaids.interval);
  // Victories already won now pay what they always should have.
  for (const id of ['axe', 'warhammer', 'watchfire', 'grove', 'toolkit'])
    assert.ok(out.unlocks.includes(id), `healed unlock ${id}`);
  assert.equal(out.world.resources.wood, wood, 'stores untouched');
  assert.equal(out.world.troops.length, troops, 'people untouched');
  assert.equal(out.xp, 120, 'progress untouched');
});
