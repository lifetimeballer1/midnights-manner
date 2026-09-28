import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeUnit, auras, housing} from '../src/model.js';
import {makeBuilding} from '../src/model.js';
import {
  capable, startExpedition, tickExpeditions, rollReturn, applyReturn, skyRisk
} from '../src/systems/expeditions.js';
import {
  artifactList, artifactBonus, findChances, findsMult, pickArtifact, rescuePool
} from '../src/systems/artifacts.js';
import {TRAITS} from '../src/systems/villagers.js';
import {performTrade, dealsFor} from '../src/systems/calendar.js';
import {Game} from '../src/game.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'expansion', 'biomes', 'artifacts', 'names', 'calendar', 'traders'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])
));

// Scripted rng: returns the given values in order, looping. Every test
// below counts its own consumption against rollReturn's documented order:
// mishap, rescue roll, rescue pick, artifact roll, artifact pick, intel
// roll, intel template, intel detail, intel road, discovery pick.
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const lucky = () => 0.999;

function freshState() {
  const world = createWorld(structuredClone(data));
  world.resources = {wood: 100, gold: 100, food: 100, frostwood: 0, plate: 0};
  return {world, research: {points: 0, completed: [], active: null}};
}

function addUnit(world, type) {
  const u = makeUnit(type, data, world.troops.length % 5);
  u.hp = data.troops[type].base.hp;
  world.troops.push(u);
  return u;
}

function addCottage(world) {
  const c = makeBuilding('cottage', 4, 4, data);
  c.remaining = 0;
  world.buildings.push(c);
  return c;
}

function rangingUnit(world, type = 'forager') {
  const u = addUnit(world, type);
  assert.equal(startExpedition(world, data, u, lucky), true);
  u.x = u.expedition.entryX; u.y = u.expedition.entryY;
  tickExpeditions(world, data, 0.5, lucky);
  assert.equal(u.expedition.phase, 'gather');
  tickExpeditions(world, data, 500, lucky);
  assert.equal(u.expedition.phase, 'back');
  return u;
}

test('data table is valid: six artifacts, sane bonuses, rescue pool exists', () => {
  const list = artifactList(data);
  assert.equal(list.length, 6);
  for (const a of list) {
    assert.ok(a.name);
    for (const v of Object.values(a.bonus)) assert.ok(v > 0 && v <= 1, `${a.id} bonus sane`);
  }
  const pool = rescuePool(data);
  assert.ok(pool.length >= 4, 'rescue pool has workers');
  for (const t of pool) assert.ok(data.troops[t], `${t} is a real troop`);
  assert.deepEqual(findChances(data), {rescue: 0.15, artifact: 0.07, intel: 0.5});
});

test('scouts find more: finds multiplier reads the spec', () => {
  assert.equal(findsMult(data, {type: 'scout'}), 1.5);
  assert.equal(findsMult(data, {type: 'forager'}), 1);
  assert.equal(findsMult(data, {type: 'warrior'}), 1);
});

test('rollReturn is deterministic: scripted dice, full manifest', () => {
  const {world} = freshState();
  const u = addUnit(world, 'forager'); // risk 0.1, duration 60
  startExpedition(world, data, u, lucky);
  // mishap? no (0.5>0.1). rescue? yes (0.01<0.15), pick index 0.
  // artifact? yes (0.01<0.07), pick first unowned. intel? yes + firsts. discovery first.
  const m = rollReturn(world, data, u, seq(0.5, 0.01, 0.0, 0.01, 0.0, 0.01, 0.0, 0.0, 0.0, 0.0));
  assert.equal(m.mishap, false);
  assert.deepEqual(m.yields, {food: 25, wood: 15});
  assert.equal(m.salvage, 7, 'always-on insight: 4 + 60/20');
  assert.equal(m.rescueType, rescuePool(data)[0]);
  assert.equal(m.artifactId, 'cairn-compass', 'first unowned by weight order');
  assert.equal(m.intel.wave, 1);
  assert.match(m.intel.text, /Thornband|Raiders/);
  assert.equal(m.discovery, data.artifacts.discoveries[0]);
});

test('mishap halves the haul but never the finds', () => {
  const {world} = freshState();
  addCottage(world); addCottage(world); // room for the rescue: this test measures pure halving
  const u = addUnit(world, 'forager');
  startExpedition(world, data, u, lucky);
  const m = rollReturn(world, data, u, seq(0.0, 0.01, 0.0, 0.99, 0.01, 0.0, 0.0, 0.0, 0.0));
  assert.equal(m.mishap, true);
  assert.equal(m.rescueType, rescuePool(data)[0], 'finds survive the mishap');
  assert.equal(m.artifactId, null, '0.99 misses the artifact roll');
  const state = {research: {points: 0, completed: [], active: null}};
  const notes = [];
  const before = {...world.resources};
  applyReturn(world, state, data, u, m, n => notes.push(n));
  assert.equal(world.resources.food, before.food + 12, '25 halved, floored');
  assert.equal(world.resources.wood, before.wood + 7, '15 halved, floored');
  assert.equal(state.research.points, 7);
});

test('night and fog raise mishap risk; clear day reads zero', () => {
  const {world} = freshState();
  assert.equal(skyRisk(world, data), 0);
  world.night = true;
  assert.equal(skyRisk(world, data), 0.05);
  world.weather = 'fog';
  assert.equal(skyRisk(world, data), 0.08);
  // 0.12 clears the day risk (0.1) but not the night risk (0.15).
  const u = addUnit(world, 'forager');
  startExpedition(world, data, u, lucky);
  const calm = rollReturn({...world, night: false, weather: 'clear'}, data, u, seq(0.12, 0.99, 0.99, 0.99, 0.0));
  assert.equal(calm.mishap, false);
  const dark = rollReturn(world, data, u, seq(0.12, 0.99, 0.99, 0.99, 0.0));
  assert.equal(dark.mishap, true);
});

test('rescue joins the roster with a name and working traits', () => {
  const {world} = freshState();
  addCottage(world); addCottage(world);
  assert.ok(housing(world, data).free > 1);
  const u = rangingUnit(world, 'forager');
  const before = world.troops.length;
  const state = {research: {points: 0, completed: [], active: null}};
  const m = rollReturn(world, data, u, seq(0.5, 0.01, 0.0, 0.99, 0.99, 0.0));
  assert.ok(m.rescueType);
  const notes = [];
  const lines = applyReturn(world, state, data, u, m, n => notes.push(n));
  assert.equal(world.troops.length, before + 1);
  const saved = world.troops[world.troops.length - 1];
  assert.equal(saved.type, m.rescueType);
  assert.ok(saved.name && typeof saved.name === 'string', 'rescued folk arrive named');
  assert.ok(Array.isArray(saved.traits) && saved.traits.length > 0);
  for (const t of saved.traits) assert.ok(TRAITS[t], `trait ${t} does something`);
  assert.match(lines.join(' '), /rescued/);
  assert.match(notes[0], /is home from the treeline/);
});

test('no free bed: the rescued traveler moves on, leaving supplies', () => {
  const {world} = freshState();
  // No cottage in a fresh world: zero beds, zero room.
  assert.equal(housing(world, data).free, 0);
  const u = rangingUnit(world, 'forager');
  const before = world.troops.length;
  const food = world.resources.food;
  const state = {research: {points: 0, completed: [], active: null}};
  const m = rollReturn(world, data, u, seq(0.5, 0.01, 0.0, 0.99, 0.99, 0.0));
  assert.ok(m.rescueType);
  const lines = applyReturn(world, state, data, u, m, () => {});
  assert.equal(world.troops.length, before, 'nobody joins without a bed');
  assert.equal(world.resources.food, food + 25 + 10, 'full haul (no mishap) plus traveler supplies');
});

test('artifacts land on the shelf once each and bless through auras', () => {
  const {world} = freshState();
  assert.deepEqual(artifactBonus(world, data), {});
  world.artifacts = ['oath-ring'];
  const delta = auras(world, data).damage - auras({...world, artifacts: []}, data).damage;
  assert.ok(Math.abs(delta - 0.02) < 1e-9, `oath-ring pours +0.02 damage, got ${delta}`);
  // Duplicate recovery never double-counts.
  world.artifacts.push('oath-ring');
  const once = auras(world, data).damage - auras({...world, artifacts: []}, data).damage;
  assert.ok(Math.abs(once - 0.02) < 1e-9);
  // The picker only offers unowned relics; a full shelf reads null.
  world.artifacts = artifactList(data).map(a => a.id);
  assert.equal(pickArtifact(world, data, lucky), null);
  world.artifacts = [];
  assert.equal(pickArtifact(world, data, () => 0), 'cairn-compass');
});

test('intel names the next raid and banks warning time', () => {
  const {world} = freshState();
  const u = rangingUnit(world, 'forager');
  const state = {research: {points: 0, completed: [], active: null}};
  const m = rollReturn(world, data, u, seq(0.5, 0.99, 0.99, 0.01, 0.0, 0.0, 0.0, 0.0));
  assert.ok(m.intel, 'intel rolled');
  applyReturn(world, state, data, u, m, () => {});
  assert.equal(world.intelLog.length, 1);
  assert.equal(world.intelLog[0].wave, 1);
  assert.equal(world.scoutBonus, 5);
  // Banking caps at +15s across expeditions.
  world.scoutBonus = 14;
  applyReturn(world, state, data, u, {...m, yields: {}}, () => {});
  assert.equal(world.scoutBonus, 15);
  assert.ok(world.intelLog.length <= 8);
});

test('homecoming record: last-return card, chronicle page, fanfare', () => {
  const {world} = freshState();
  const u = rangingUnit(world, 'forager');
  const state = {research: {points: 0, completed: [], active: null}};
  const notes = [];
  const m = rollReturn(world, data, u, seq(0.5, 0.99, 0.99, 0.99, 0.0));
  applyReturn(world, state, data, u, m, n => notes.push(n));
  assert.ok(world.lastReturn, 'panel card data');
  assert.equal(world.lastReturn.ranger, u.name || 'Forager');
  assert.ok(world.lastReturn.lines.length > 0, 'salvage always writes a line');
  assert.equal(world.expeditionLog.length, 1);
  assert.match(world.expeditionLog[0].text, /insight/);
  assert.ok(world.effects.some(e => e.kind === 'fanfare'), 'celebration at the hall');
  assert.equal(notes.length, 1);
});

test('salvage respects the research cap and needs no state in isolation', () => {
  const {world} = freshState();
  const u = rangingUnit(world, 'scout'); // 90s -> 4 + 4 = 8
  const m = rollReturn(world, data, u, seq(0.5, 0.99, 0.99, 0.99, 0.0));
  assert.equal(m.salvage, 8);
  const state = {research: {points: 998, completed: [], active: null}};
  applyReturn(world, state, data, u, m, () => {});
  assert.equal(state.research.points, 1000);
  // Subsystem ticks without a state object never crash.
  const u2 = rangingUnit(world, 'forager');
  const m2 = rollReturn(world, data, u2, seq(0.5, 0.99, 0.99, 0.99, 0.0));
  applyReturn(world, undefined, data, u2, m2, () => {});
});

test('missing finds table: old saves and data-light callers stay safe', () => {
  const thin = structuredClone(data);
  delete thin.artifacts;
  const {world} = freshState();
  const u = addUnit(world, 'forager');
  assert.equal(startExpedition(world, thin, u, lucky), true);
  const m = rollReturn(world, thin, u, seq(0.5, 0.01, 0.01, 0.01, 0.0));
  assert.equal(m.mishap, false);
  assert.equal(m.rescueType, null);
  assert.equal(m.artifactId, null);
  assert.equal(m.intel, null);
  assert.equal(m.discovery, null);
  assert.ok(m.salvage > 0, 'insight needs no table');
  const notes = [];
  applyReturn(world, {research: {points: 0, completed: [], active: null}}, thin, u, m, n => notes.push(n));
  assert.equal(notes.length, 1);
});

test('ledger haggles at the market: trade blessing trims the take', () => {
  const now = new Date();
  const deals = dealsFor(data.traders, data.calendar, now, 5);
  assert.ok(deals.length > 0);
  const deal = deals[0];
  const give = Object.entries(deal.give || {})[0];
  assert.ok(give, 'deal takes something');
  const [res, amount] = give;
  const mkState = artifacts => ({
    tradeDay: null, tradesUsed: {}, vlevel: 5,
    world: {resources: {wood: 500, gold: 500, food: 500}, gathered: {}, buildings: [], troops: [], artifacts}
  });
  const plain = mkState([]);
  const r1 = performTrade(plain, data, deal.id, now);
  assert.equal(r1.ok, true);
  const shelf = mkState(['lantern-ledger']);
  const r2 = performTrade(shelf, data, deal.id, now);
  assert.equal(r2.ok, true);
  const expect = Math.ceil(amount * 0.96);
  assert.equal(shelf.world.resources[res], 500 - expect);
  assert.equal(r2.haggled, amount - expect);
  assert.equal(plain.world.resources[res], 500 - amount);
});

test('Game integration: ranging home fires the celebration toast', () => {
  const g = new Game(structuredClone(data));
  g.world.resources = {wood: 100, gold: 100, food: 100, frostwood: 0, plate: 0};
  const u = addUnit(g.world, 'forager');
  assert.equal(g.sendExpedition(u.id), true);
  u.x = u.expedition.entryX; u.y = u.expedition.entryY;
  const notes = [];
  tickExpeditions(g.world, g.data, 0.5, lucky, {state: g.state, notify: m => notes.push(m)});
  tickExpeditions(g.world, g.data, 500, lucky, {state: g.state, notify: m => notes.push(m)});
  assert.equal(u.expedition.phase, 'back');
  u.x = u.expedition.homeX; u.y = u.expedition.homeY;
  tickExpeditions(g.world, g.data, 0.5, lucky, {state: g.state, notify: m => notes.push(m)});
  assert.equal(u.expedition, null);
  assert.ok(notes.some(m => /is home from the treeline/.test(m)), 'homecoming toast fired');
  assert.ok(g.world.lastReturn, 'panel card written');
  assert.ok((g.state.research?.points || 0) > 0, 'salvage reached the research table');
});
