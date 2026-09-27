import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeUnit} from '../src/model.js';
import {capable, startExpedition, tickExpeditions, expeditionStatus, forestEdge} from '../src/systems/expeditions.js';
import {tickEconomy} from '../src/systems/economy.js';
import {Game} from '../src/game.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'expansion', 'biomes'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])
));

// Deterministic rng stand-ins: no wall-clock anywhere in the handler.
const lucky = () => 0.999;
const unlucky = () => 0;

function freshGame() {
  const g = new Game(structuredClone(data));
  g.world.resources = {wood: 100, gold: 100, food: 100, frostwood: 0, plate: 0};
  return g;
}

function addUnit(g, type) {
  const u = makeUnit(type, g.data, g.world.troops.length % 5);
  u.hp = g.data.troops[type].base.hp;
  g.world.troops.push(u);
  return u;
}

// Fast-forward a unit through walk phases by placing it where it is headed.
function arriveAtEntry(g, u) { u.x = u.expedition.entryX; u.y = u.expedition.entryY; }
function arriveHome(g, u) { u.x = u.expedition.homeX; u.y = u.expedition.homeY; }

test('capability reads data only: forager/scout/lumberjack range, warriors do not', () => {
  const g = freshGame();
  const forage = addUnit(g, 'forager');
  const scout = addUnit(g, 'scout');
  const jack = addUnit(g, 'lumberjack');
  const warrior = addUnit(g, 'warrior');
  assert.equal(capable(g.data, forage), true);
  assert.equal(capable(g.data, scout), true);
  assert.equal(capable(g.data, jack), true);
  assert.equal(capable(g.data, warrior), false);
  assert.equal(startExpedition(g.world, g.data, warrior, lucky), false);
  assert.equal(warrior.expedition, undefined);
});

test('start sends the unit out toward a forest edge', () => {
  const g = freshGame();
  const u = addUnit(g, 'forager');
  assert.equal(startExpedition(g.world, g.data, u, lucky), true);
  assert.equal(u.expedition.phase, 'out');
  assert.ok(Number.isFinite(u.expedition.entryX));
  assert.equal(expeditionStatus(u, g.data), 'Out to the treeline');
  // Already out: no double send.
  assert.equal(startExpedition(g.world, g.data, u, lucky), false);
});

test('full loop delivers yields to world resources (no mishap)', () => {
  const g = freshGame();
  const u = addUnit(g, 'forager'); // yields {food: 25, wood: 15}, 60s, risk 0.1
  startExpedition(g.world, g.data, u, lucky);
  arriveAtEntry(g, u);
  tickExpeditions(g.world, g.data, 0.5, lucky);
  assert.equal(u.expedition.phase, 'gather');
  assert.equal(u.expedition.offgrid, true);
  assert.match(expeditionStatus(u, g.data), /Gathering/);
  tickExpeditions(g.world, g.data, 30, lucky);
  assert.match(expeditionStatus(u, g.data), /Gathering/);
  tickExpeditions(g.world, g.data, 30, lucky);
  assert.equal(u.expedition.phase, 'back');
  assert.equal(u.expedition.offgrid, false);
  assert.match(expeditionStatus(u, g.data), /Back in/);
  const food = g.world.resources.food, wood = g.world.resources.wood;
  arriveHome(g, u);
  tickExpeditions(g.world, g.data, 0.5, lucky);
  assert.equal(u.expedition, null);
  assert.equal(g.world.resources.food, food + 25);
  assert.equal(g.world.resources.wood, wood + 15);
  assert.equal(expeditionStatus(u, g.data), null);
});

test('mishap halves the haul (risk path, seeded rng)', () => {
  const g = freshGame();
  const u = addUnit(g, 'lumberjack'); // yields {wood: 40}, risk 0.12
  startExpedition(g.world, g.data, u, unlucky);
  arriveAtEntry(g, u);
  tickExpeditions(g.world, g.data, 0.5, unlucky);
  tickExpeditions(g.world, g.data, 75, unlucky);
  assert.equal(u.expedition.phase, 'back');
  const wood = g.world.resources.wood;
  arriveHome(g, u);
  tickExpeditions(g.world, g.data, 0.5, unlucky);
  assert.equal(u.expedition, null);
  assert.equal(g.world.resources.wood, wood + 20, 'unlucky roll halves 40 to 20');
});

test('fallen or incapable units clear instead of hanging', () => {
  const g = freshGame();
  const u = addUnit(g, 'scout');
  startExpedition(g.world, g.data, u, lucky);
  u.hp = 0;
  tickExpeditions(g.world, g.data, 1, lucky);
  assert.equal(u.expedition, null);
});

test('economy loop leaves ranging hands alone', () => {
  const g = freshGame();
  const u = addUnit(g, 'forager');
  u.workplace = null;
  startExpedition(g.world, g.data, u, lucky);
  const x = u.x, y = u.y;
  // One economy tick must not drag the ranger back to a source.
  tickEconomy(g.world, g.data, 1);
  assert.equal(u.x, x);
  assert.equal(u.y, y);
  assert.ok(u.expedition, 'still ranging');
});

test('Game.sendExpedition + tick integration', () => {
  const g = freshGame();
  const u = addUnit(g, 'forager');
  assert.equal(g.sendExpedition(u.id), true);
  assert.equal(u.expedition.phase, 'out');
  assert.equal(g.sendExpedition(u.id), false, 'already out');
  const w = addUnit(g, 'warrior');
  assert.equal(g.sendExpedition(w.id), false, 'warriors do not range');
  // Game.tick advances the off-grid timer like any other system tick.
  arriveAtEntry(g, u);
  g.tick(0.1);
  assert.equal(u.expedition.phase, 'gather');
});
