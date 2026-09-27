// Phase 2 raid director: threat-driven randomized horns, scaled warnings,
// fair consequences (theft, recovery) with an early-game grace period.
// Pure-director tests are deterministic; integration reuses the Game harness.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {Game} from '../src/game.js';
import {homeSummary} from '../src/adventure.js';
import {
  threatOf, nextDelay, raidSize, warningFor, theftFor, applyTheft,
} from '../src/systems/raid-director.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests',
   'levels', 'rumors', 'names', 'legends', 'expansion', 'biomes', 'calendar', 'traders']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));

function freshState() {
  const d = structuredClone(data);
  return {
    data: d,
    state: {
      world: createWorld(d), home: null, mission: null,
      completed: [], unlocks: ['tower'], xp: 0, vlevel: 1, questsCompleted: [],
    },
  };
}

test('threat: a fresh village is QUIET, growth raises the band', () => {
  const {data: d, state} = freshState();
  const fresh = threatOf(state.world, state, d);
  assert.equal(fresh.band, 0);
  assert.equal(fresh.label, 'QUIET');
  // A rich, populous, victorious settlement menaces the treeline.
  state.world.resources.gold = 5000;
  state.world.resources.food = 3000;
  state.world.troops.push(...state.world.troops.map(t => structuredClone(t)));
  state.world.wave = 8;
  state.world.flawlessRaids = 5;
  state.vlevel = 6;
  const grown = threatOf(state.world, state, d);
  assert.ok(grown.band >= 2, `grown threat band ${grown.band} (${grown.label})`);
  assert.ok(grown.score > fresh.score);
});

test('schedule: randomized but bounded, never below the quiet floor', () => {
  const {data: d, state} = freshState();
  const cfg = d.world.homeRaids;
  for (const roll of [0, 0.25, 0.5, 0.75, 1]) {
    const delay = nextDelay(state.world, state, d, () => roll);
    assert.ok(delay >= cfg.minQuiet, `delay ${delay} respects minQuiet`);
    assert.ok(delay <= cfg.interval * 1.15 * 1.25 + 1e-9, `delay ${delay} bounded above`);
  }
  // Menace comes sooner than quiet, same dice.
  state.world.wave = 9;
  state.world.flawlessRaids = 6;
  state.world.resources.gold = 4000;
  const calm = nextDelay(freshState().state.world, freshState().state, d, () => 0.5);
  const menace = nextDelay(state.world, state, d, () => 0.5);
  assert.ok(menace < calm, `menace ${menace} sooner than calm ${calm}`);
});

test('size: first contact stays a pair, later parties grow and cap out', () => {
  const {data: d, state} = freshState();
  assert.equal(raidSize(state.world, state, d), d.world.homeRaids.firstCount);
  state.world.wave = 3;
  const mid = raidSize(state.world, state, d);
  assert.ok(mid >= d.world.homeRaids.baseCount + 3 * d.world.homeRaids.perWave - 1);
  state.world.wave = 40;
  assert.equal(raidSize(state.world, state, d), d.world.homeRaids.maxCount);
});

test('warnings: routine horns stay short, major assaults get the long horn', () => {
  const {data: d, state} = freshState();
  const routine = warningFor(3, 0, d);
  assert.equal(routine.major, false);
  assert.equal(routine.seconds, d.world.homeRaids.warning);
  const major = warningFor(d.world.homeRaids.majorAt, 1, d);
  assert.equal(major.major, true);
  assert.equal(major.seconds, d.world.homeRaids.majorWarning);
  assert.ok(major.seconds > routine.seconds, 'advance warning before major attacks');
  const menace = warningFor(2, 3, d);
  assert.equal(menace.major, true, 'MENACING threat earns the long horn even for small parties');
});

test('theft: grace through wave 1, capped cut only when roofs fall', () => {
  const {data: d, state} = freshState();
  const w = state.world;
  w.resources.gold = 1000;
  w.resources.food = 800;
  assert.equal(theftFor(w, d), null, 'grace: no theft at wave 0');
  w.wave = 3;
  assert.equal(theftFor(w, d), null, 'intact villages lose nothing');
  const shed = w.buildings.find(b => b.type !== 'trap');
  shed.hp = 0;
  const taken = theftFor(w, d);
  assert.ok(taken.gold > 0 && taken.food > 0, 'flattened buildings invite theft');
  assert.ok(taken.gold <= d.world.homeRaids.theft.cap, 'theft capped');
  const before = {gold: w.resources.gold, food: w.resources.food};
  const applied = applyTheft(w, d);
  assert.deepEqual(applied, taken);
  assert.equal(w.resources.gold, before.gold - taken.gold);
  assert.equal(w.resources.food, before.food - taken.food);
});

test('integration: first horn unchanged — pair, short warning, no major flag', () => {
  const {data: d, state} = freshState();
  const g = new Game(d);
  g.state = state;
  const cfg = d.world.homeRaids;
  g.world.elapsed = cfg.firstAt;
  g.tick(0.05);
  assert.ok(g.world.raidPending, 'horn raised');
  assert.equal(g.world.raidPending.count, cfg.firstCount);
  assert.equal(g.world.raidPending.major, false);
  assert.equal(Math.ceil(g.world.raidPending.timer), cfg.warning);
});

test('integration: reschedule is randomized within bounds, never instant', () => {
  const {data: d, state} = freshState();
  const g = new Game(d);
  g.state = state;
  const cfg = d.world.homeRaids;
  g.world.elapsed = cfg.firstAt;
  g.tick(0.05);
  g.world.raidPending.timer = 0.01;
  g.tick(0.05);
  for (const e of g.world.enemies) e.hp = 1;
  for (let i = 0; i < 3000 && g.world.enemies.length; i++) g.tick(0.05);
  assert.equal(g.world.enemies.length, 0);
  const wait = g.world.nextRaidAt - g.world.elapsed;
  assert.ok(wait >= cfg.minQuiet, `next horn ${wait}s out — room to rebuild`);
  assert.ok(wait <= cfg.interval * 1.15 * 1.25 + 1, `next horn ${wait}s bounded`);
  assert.ok(g.world.raidResult && g.world.raidResult.won);
  assert.equal(g.world.raidResult.recovering, 0, 'grace: first defense mends clean');
  assert.equal(g.world.raidResult.stolen, null, 'grace: first defense keeps its stores');
});

test('integration: a hard-won defense steals stores and lays villagers low', () => {
  const {data: d, state} = freshState();
  const g = new Game(d);
  g.state = state;
  g.world.wave = 2; // past the grace period
  g.world.resources.gold = 1000;
  g.world.resources.food = 800;
  g.world.elapsed = g.world.nextRaidAt;
  g.tick(0.05);
  assert.ok(g.world.raidPending, 'horn raised');
  g.world.raidPending.timer = 0.01;
  g.tick(0.05);
  assert.ok(g.world.enemies.length > 0, 'raiders walk');
  // A farm burns (never the manor — that would be defeat); a defender falls.
  const mill = g.world.buildings.find(b => b.type !== 'trap' && b.type !== 'hall' && b.hp > 0);
  mill.hp = 0;
  const fallen = g.world.troops.find(t => t.hp > 0);
  fallen.hp = 0;
  for (const e of g.world.enemies) e.hp = 1;
  for (let i = 0; i < 6000 && g.world.enemies.length; i++) g.tick(0.05);
  assert.equal(g.world.enemies.length, 0);
  const r = g.world.raidResult;
  assert.ok(r && r.won, 'defense holds');
  assert.ok(r.stolen && r.stolen.gold > 0, 'raiders stripped stores');
  assert.ok(g.world.resources.gold < 1000, 'theft deducted');
  assert.ok(r.recovering >= 1, 'fallen defenders recovering');
  const hurt = g.world.troops.find(t => Number.isFinite(t.injuredUntil));
  assert.ok(hurt && hurt.injuredUntil > g.world.elapsed, 'recovery timer set');
  const hp = hurt.hp;
  for (let i = 0; i < 20; i++) g.tick(0.05);
  assert.equal(hurt.hp, hp, 'the injured do not mend on their feet');
});

test('home summary carries threat band and quiet countdown', () => {
  const {data: d, state} = freshState();
  const s = homeSummary(state, d);
  assert.ok(s.threat && s.threat.label === 'QUIET', 'fresh threat shown');
  assert.ok(Number.isFinite(s.nextRaidIn) && s.nextRaidIn > 0, 'quiet countdown shown');
});
