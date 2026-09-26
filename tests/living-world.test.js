import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {auras} from '../src/model.js';
import {migrateToLatest, exportSave, importSaveBlob, VERSION} from '../src/storage.js';
import {Game} from '../src/game.js';
import {
  dayNumber, dayKey, seasonFor, modifierFor, calendarEffects, dealsFor,
  performTrade, marketOpen, tradeCap, describeDeal, validEffectKeys, TRADE_CAP,
} from '../src/systems/calendar.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'calendar', 'traders']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))]))); // data tables incl. calendar + traders
const D = d => new Date(Date.UTC(2026, 8, d)); // fixed UTC dates: Sep 2026
function freshState(d = data) {
  return {world: createWorld(d), home: null, mission: null, completed: [], unlocks: ['tower'], xp: 0, vlevel: 1, questsCompleted: [], tradeDay: null, tradesUsed: {}, calendarDay: null, gatheredAtBell: null};
}

test('living world: calendar tables have shape and only real aura keys', () => {
  assert.equal(data.calendar.seasonLength, 7);
  assert.equal(data.calendar.seasons.length, 4);
  assert.equal(data.calendar.seasonLength * data.calendar.seasons.length, 28);
  const valid = new Set(validEffectKeys());
  for (const s of data.calendar.seasons) {
    assert.ok(s.id && s.name && s.text, s.id);
    for (const k of Object.keys(s.effects || {})) assert.ok(valid.has(k), `season ${s.id} effect ${k}`);
  }
  assert.ok(data.calendar.daily.length >= 5, 'a full week of skies');
  for (const m of data.calendar.daily) {
    assert.ok(m.id && m.name && m.text, m.id);
    assert.ok(Object.keys(m.effects || {}).length > 0, `${m.id} does something readable`);
    for (const k of Object.keys(m.effects)) assert.ok(valid.has(k), `daily ${m.id} effect ${k}`);
  }
});

test('living world: trader tables have shape and honest prices', () => {
  assert.ok(data.traders.length >= 6, 'enough wagons to rotate');
  const ids = new Set();
  for (const t of data.traders) {
    assert.ok(t.id && !ids.has(t.id), `unique deal ${t.id}`);
    ids.add(t.id);
    assert.ok(t.flavor && t.flavor.length > 10, `${t.id} carries a tale`);
    assert.ok((t.minLevel || 1) >= 1, `${t.id} minLevel`);
    if (t.season) assert.ok(data.calendar.seasons.some(s => s.id === t.season), `${t.id} season resolves`);
    for (const basket of [t.give, t.take]) {
      assert.ok(basket && Object.keys(basket).length > 0, `${t.id} has both sides`);
      for (const [k, v] of Object.entries(basket)) {
        assert.ok(['wood', 'food', 'gold', 'xp'].includes(k), `${t.id} trades real goods (${k})`);
        assert.ok(Number.isFinite(v) && v > 0, `${t.id} positive amounts`);
      }
    }
  }
});

test('living world: seasons cycle every 28 days, same date same sky', () => {
  const a = seasonFor(data.calendar, D(1)), b = seasonFor(data.calendar, D(1));
  assert.deepEqual(a, b);
  const c = seasonFor(data.calendar, new Date(Date.UTC(2026, 8, 1) + 28 * 86400000));
  assert.equal(c.season.id, a.season.id, 'the wheel comes back around');
  assert.equal(modifierFor(data.calendar, D(5))?.id, modifierFor(data.calendar, D(5))?.id);
  const seen = new Set(Array.from({length: 28}, (_, i) => seasonFor(data.calendar, D(1 + i)).season.id));
  assert.equal(seen.size, 4, 'all four seasons pass in a cycle');
  assert.equal(seasonFor(null, D(1)), null, 'missing tables mean a quiet night');
  assert.equal(modifierFor({}, D(1)), null);
  assert.deepEqual(calendarEffects(null, D(1)), {});
});

test('living world: three date-seeded deals a day, gated by level and season', () => {
  const day = D(10);
  const a = dealsFor(data.traders, data.calendar, day, 5);
  const b = dealsFor(data.traders, data.calendar, day, 5);
  assert.deepEqual(a.map(d => d.id), b.map(d => d.id), 'same day, same wagons');
  assert.ok(a.length === 3, 'three wagons a day');
  const low = dealsFor(data.traders, data.calendar, day, 2);
  assert.ok(low.every(d => (d.minLevel || 1) <= 2), 'young villages see humbler deals');
  assert.ok(low.length > 0, 'level 2 still sees wagons');
  assert.deepEqual(dealsFor(data.traders, data.calendar, day, 1), [], 'level 1 is too small for traders');
  // seasonal wagons only roll in their own week
  const seasonal = data.traders.filter(t => t.season);
  assert.ok(seasonal.length > 0);
  for (const t of seasonal) {
    let found = false;
    for (let d = 1; d <= 60 && !found; d++) {
      const date = new Date(Date.UTC(2026, 0, d));
      if (seasonFor(data.calendar, date)?.season?.id !== t.season) continue;
      if (dealsFor(data.traders, data.calendar, date, 9).some(x => x.id === t.id)) found = true;
    }
    assert.ok(found, `${t.id} appears in ${t.season}`);
  }
});

test('living world: market opens at village level 2', () => {
  assert.equal(marketOpen({vlevel: 1}), false);
  assert.equal(marketOpen({vlevel: 2}), true);
  assert.equal(marketOpen({}), false);
});

test('living world: trades settle instantly with per-day caps', () => {
  const state = freshState();
  state.vlevel = 3;
  state.world.resources = {wood: 1000, food: 1000, gold: 1000};
  const day = D(12);
  const [deal] = dealsFor(data.traders, data.calendar, day, 3);
  const before = {...state.world.resources};
  const r1 = performTrade(state, data, deal.id, day);
  assert.equal(r1.ok, true);
  for (const [k, v] of Object.entries(deal.give)) assert.equal(state.world.resources[k], before[k] - v);
  let ok = 0;
  for (let i = 0; i < 5; i++) if (performTrade(state, data, deal.id, day).ok) ok++;
  assert.equal(ok, TRADE_CAP - 1, `cap of ${TRADE_CAP} per deal per day`);
  const refused = performTrade(state, data, deal.id, day);
  assert.equal(refused.ok, false);
  assert.match(refused.error, /tomorrow/i);
  // a stranger's deal is not on today's row
  const offBoard = data.traders.map(t => t.id).find(id => !dealsFor(data.traders, data.calendar, day, 3).some(d => d.id === id));
  if (offBoard) assert.equal(performTrade(state, data, offBoard, day).ok, false);
  // next bell, fresh row
  const next = new Date(day.getTime() + 86400000);
  const again = performTrade(state, data, dealsFor(data.traders, data.calendar, next, 3)[0].id, next);
  assert.equal(again.ok, true, 'caps reset with the day');
});

test('living world: poor villages are turned away kindly', () => {
  const state = freshState();
  state.vlevel = 3;
  state.world.resources = {wood: 0, food: 0, gold: 0};
  const day = D(12);
  const [deal] = dealsFor(data.traders, data.calendar, day, 3);
  const res = performTrade(state, data, deal.id, day);
  assert.equal(res.ok, false);
  assert.match(res.error, /stores fall short/i);
});

test('living world: sky blessings reach the sim through auras, capped', () => {
  const w = createWorld(data);
  assert.equal(auras(w, data).gather, 0);
  w.calendarBonus = {gather: 0.1};
  assert.equal(auras(w, data).gather, 0.1, 'Bright Moon hurries collectors');
  w.calendarBonus = {gather: 10, build: 10, damage: 10, nope: 5};
  const a = auras(w, data);
  assert.ok(a.gather <= 0.45 && a.build <= 0.75 && a.damage <= 0.3, 'caps still hold the sky');
  assert.ok(!('nope' in a), 'unknown keys never enter the sim');
  delete w.calendarBonus;
  assert.equal(auras(w, data).gather, 0, 'old saves without the sky play unchanged');
});

test('living world: game.trade gates, settles and narrates', () => {
  const g = new Game(data);
  g.state.world = createWorld(data);
  g.paused = false;
  g.state.vlevel = 1;
  g.trade('lantern-timber', D(12));
  assert.match(g.message, /level 2/i, 'too-small villages are gated');
  g.state.vlevel = 3;
  g.state.world.resources = {wood: 1000, food: 1000, gold: 1000};
  const [deal] = dealsFor(data.traders, data.calendar, D(12), 3);
  assert.equal(g.trade(deal.id, D(12)), true);
  assert.match(g.message, /Deal struck/, 'the handshake is announced');
  assert.match(g.message, new RegExp(deal.flavor.slice(0, 20)), 'the tale travels with the deal');
});

test('living world: nightly bell rings on day rollover, never on the same day', () => {
  const g = new Game(data);
  g.state.world = createWorld(data);
  g.paused = false;
  g.state.calendarDay = dayKey(D(12));
  g.state.gatheredAtBell = {wood: 10, food: 10, gold: 10};
  g.state.world.gathered = {wood: 60, food: 40, gold: 30};
  assert.equal(g.checkCalendar(D(12)), false, 'same day, no bell');
  assert.equal(g.checkCalendar(D(13)), true, 'new day, the bell rings');
  assert.match(g.message, /night bell/i);
  assert.match(g.message, /50 wood, 30 food and 20 gold/i, "yesterday's harvest is read aloud");
  assert.equal(g.state.calendarDay, dayKey(D(13)));
  assert.deepEqual(g.state.tradesUsed, {}, 'caps wash clean overnight');
});

test('living world: MIGRATIONS[2] backfills old saves, touches nothing else', () => {
  const w = createWorld(data);
  const wood = w.resources.wood, troops = w.troops.length;
  const v1 = {version: 1, world: structuredClone(w), home: null, mission: null, completed: ['x'], unlocks: ['tower'], xp: 42, questsCompleted: []};
  const a = migrateToLatest(structuredClone(v1), data);
  assert.equal(a.version, VERSION);
  assert.equal(a.version, 4);
  assert.equal(a.tradeDay, null, 'last-claimed day defaults sanely');
  assert.deepEqual(a.tradesUsed, {});
  assert.equal(a.calendarDay, null, 'the bell will ring once on return');
  assert.ok(Number.isFinite(a.world.nextRaidAt), 'a fresh raid clock starts');
  assert.equal(a.world.resources.wood, wood, 'stores untouched');
  assert.equal(a.world.troops.length, troops, 'people untouched');
  assert.equal(a.xp, 42, 'progress untouched');
  const v2 = {version: 2, world: structuredClone(w), home: null, mission: null, completed: [], unlocks: [], xp: 1, vlevel: 1, questsCompleted: [], survey: 0};
  const b = migrateToLatest(structuredClone(v2), data);
  assert.equal(b.version, 4);
  assert.deepEqual(b.tradesUsed, {});
  // unknown futures still refuse to load
  assert.equal(migrateToLatest({version: 99, world: w}, data), null);
});

test('living world: export/import blob carries the new keys through the same registry', () => {
  const g = new Game(data);
  g.state.world = createWorld(data);
  g.state.vlevel = 3;
  g.state.tradeDay = dayKey(D(12));
  g.state.tradesUsed = {'lantern-timber': 1};
  g.state.calendarDay = dayKey(D(12));
  const res = importSaveBlob(exportSave(g.state), data);
  assert.equal(res.ok, true);
  assert.equal(res.state.version, VERSION);
  assert.deepEqual(res.state.tradesUsed, {'lantern-timber': 1});
  const old = importSaveBlob(JSON.stringify({version: 2, world: createWorld(data), home: null, mission: null, completed: [], unlocks: [], xp: 0, vlevel: 1, questsCompleted: []}), data);
  assert.equal(old.ok, true);
  assert.equal(old.state.version, 4, 'blobs migrate like local loads');
});

test('living world: deal lines read clean', () => {
  const [deal] = data.traders;
  assert.match(describeDeal(deal), /\d+ \w+ for \d+ \w+/);
  assert.equal(tradeCap({}), TRADE_CAP);
  assert.equal(tradeCap({cap: 1}), 1);
});
