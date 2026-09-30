import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld} from '../src/model.js';
import {spawnRaid, tickCombat} from '../src/systems/combat.js';
import {factionFor} from '../src/systems/tactics.js';
import {directorParty} from '../src/systems/raid-director.js';
import {
  threatTier, endgameScaling, isBossWave, bossFor, bossStats,
  applyElite, markElites, eliteLootMult, isSiegeRole, spawnBoss,
  bossTick, bossAuraMult, endgameSpawnOpts,
  renownLevel, renownCost, renownDamageMult, renownLootMult, renownAvailable,
  paragonEligible, paragonCost, paragonDamageMult, buildingMaxHp,
} from '../src/systems/endgame.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'levels', 'calendar', 'traders', 'endgame']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));

function game(vlevel = 1) {
  const g = new Game(data);
  g.state = {...g.state, world: createWorld(data), home: null, mission: null, completed: [], vlevel};
  return g;
}

// ---- Threat ladder: gated off village level, mid-game never sees it ----

test('threat ladder stays dormant below village level 8', () => {
  assert.equal(threatTier(data, 1), null);
  assert.equal(threatTier(data, 7), null);
  assert.deepEqual(endgameScaling(data, 7), {hp: 1, damage: 1, partyBonus: 0, eliteChance: 0, siegeChance: 0});
  assert.equal(endgameSpawnOpts({vlevel: 7, world: {}}, data), null);
});

test('threat ladder escalates with village level', () => {
  assert.equal(threatTier(data, 8).id, 'ember-watch');
  assert.equal(threatTier(data, 9).id, 'ember-watch');
  assert.equal(threatTier(data, 10).id, 'storm-siege');
  assert.equal(threatTier(data, 11).id, 'eclipse');
  assert.equal(threatTier(data, 99).id, 'eclipse');
  const s = endgameScaling(data, 11);
  assert.equal(s.hp, 1.5);
  assert.equal(s.damage, 1.35);
  assert.equal(s.partyBonus, 3);
  assert.ok(s.eliteChance > endgameScaling(data, 8).eliteChance);
});

test('endgame helpers survive missing config (old saves, other tests)', () => {
  assert.equal(threatTier({}, 11), null);
  assert.equal(isBossWave({}, 11, 10), false);
  assert.equal(bossFor({}, 11, 10), null);
  assert.equal(isSiegeRole({}, 'ram'), false);
  assert.equal(renownAvailable({vlevel: 11, world: {buildings: []}}, {}), false);
});

// ---- Boss calendar: deterministic waves, rotating crowns ----

test('boss waves fall on every fifth wave past wave 10 at level 9+', () => {
  assert.equal(isBossWave(data, 9, 10), true);
  assert.equal(isBossWave(data, 9, 15), true);
  assert.equal(isBossWave(data, 8, 10), false);
  assert.equal(isBossWave(data, 9, 9), false);
  assert.equal(isBossWave(data, 9, 11), false);
  assert.equal(isBossWave(data, 9, 5), false);
});

test('boss rotation heralds the same crown for the same wave', () => {
  assert.equal(bossFor(data, 9, 10).id, 'cinder-maul');
  assert.equal(bossFor(data, 10, 15).id, 'pale-queen');
  assert.equal(bossFor(data, 11, 20).id, 'cinder-maul');
  assert.equal(bossFor(data, 9, 15).id, 'cinder-maul'); // queen needs level 10 — the maul answers again
  assert.equal(bossFor(data, 9, 11), null); // not a boss wave
});

test('boss stats scale off the wave that earned them', () => {
  const s10 = bossStats(bossFor(data, 9, 10), 10);
  const s15 = bossStats(bossFor(data, 9, 10), 15);
  assert.equal(s10.hp, 1200 + 90 * 10);
  assert.equal(s10.damage, 45 + 3 * 10);
  assert.ok(s15.hp > s10.hp && s15.damage > s10.damage);
});

// ---- Elites and siege units ----

test('elites hit harder, endure longer, and pay bounty', () => {
  const e = {hp: 100, maxHp: 100, damage: 10, role: 'raider'};
  applyElite(e, data, 'Iron');
  assert.equal(e.elite, true);
  assert.ok(Math.abs(e.hp - 220) < 1e-9);
  assert.ok(Math.abs(e.maxHp - 220) < 1e-9);
  assert.ok(Math.abs(e.damage - 14) < 1e-9);
  assert.equal(eliteLootMult(data), 3);
});

test('markElites never crowns a boss and stays deterministic', () => {
  const world = {enemies: [
    {id: 'a', hp: 10, role: 'raider'},
    {id: 'b', hp: 10, role: 'boss', bossId: 'cinder-maul'},
    {id: 'c', hp: 10, role: 'ram'},
  ]};
  const n = markElites(world, data, 1, () => 0);
  assert.equal(n, 2);
  assert.equal(world.enemies[0].elite, true);
  assert.equal(world.enemies[1].elite, undefined);
  assert.equal(world.enemies[2].elite, true);
  assert.equal(markElites({enemies: [{id: 'x', hp: 10, role: 'raider'}]}, data, 0, () => 0.99), 0);
});

test('siege roles pressure walls and read from data', () => {
  assert.equal(isSiegeRole(data, 'ram'), true);
  assert.equal(isSiegeRole(data, 'bombard'), true);
  assert.equal(isSiegeRole(data, 'raider'), false);
  assert.ok(data.world.enemyRoles.ram.wallDamage >= 4);
  assert.ok(data.world.enemyRoles.bombard.range >= 4);
});

// ---- Faction identity flavors the endgame roster, gated by level ----

test('endgame courts muster only for seasoned villages', () => {
  assert.ok(data.world.enemyFactions.some(f => f.id === 'ember-legion' && f.minLevel === 8));
  assert.ok(data.world.enemyFactions.some(f => f.id === 'pale-court' && f.minLevel === 10));
  assert.equal(factionFor(data, 8, 7).id, 'pale-host');
  assert.equal(factionFor(data, 8, 8).id, 'ember-legion');
  assert.equal(factionFor(data, 4, 11).id, 'pale-host'); // early waves keep old rotation
});

test('raid director answers high villages with heavier parties', () => {
  const low = game(7), high = game(11);
  high.world.wave = low.world.wave = 1;
  assert.ok(directorParty(high.state, data) >= directorParty(low.state, data) + 2);
});

// ---- Classic curve untouched without endgame opts ----

test('spawnRaid keeps the classic curve unless the ladder opts in', () => {
  const plain = createWorld(data);
  spawnRaid(plain, 2, null, data, null);
  assert.equal(plain.enemies[0].hp, 65 + 1 * 12);
  const eg = createWorld(data);
  spawnRaid(eg, 2, null, data, null, {scaling: {hp: 1.3, damage: 1.2}});
  assert.ok(Math.abs(eg.enemies[0].hp - (65 + 1 * 12) * 1.3) < 1e-9);
  assert.ok(eg.enemies.every(e => !e.elite));
  const egElite = createWorld(data);
  spawnRaid(egElite, 2, null, data, null, {scaling: {hp: 1.3, damage: 1.2}, eliteChance: 1, random: () => 0});
  assert.ok(egElite.enemies.every(e => e.elite));
});

// ---- Boss mechanics: slam, muster, enrage, dread ----

function bossWorld() {
  const w = createWorld(data);
  const boss = bossFor(data, 10, 15);
  spawnBoss(w, data, boss, 15);
  return {w, foe: w.enemies[w.enemies.length - 1]};
}

test('spawnBoss fields a scaled crown', () => {
  const {foe} = bossWorld();
  assert.equal(foe.role, 'boss');
  assert.equal(foe.bossId, 'pale-queen');
  assert.equal(foe.hp, 1800 + 120 * 15);
  assert.equal(foe.enraged, false);
});

test('boss enrages below its data HP fraction', () => {
  const {w, foe} = bossWorld();
  const before = foe.damage;
  foe.hp = foe.maxHp * 0.2;
  const events = bossTick(w, data, foe, 0.1);
  assert.equal(foe.enraged, true);
  assert.equal(foe.damage, before * 1.5);
  assert.ok(events.some(e => e.kind === 'enrage'));
  assert.equal(bossTick(w, data, foe, 0.1).filter(e => e.kind === 'enrage').length, 0); // once
});

test('boss musters capped adds on its timer', () => {
  const {w, foe} = bossWorld();
  const events = bossTick(w, data, foe, 25);
  const adds = w.enemies.filter(e => e.summoned);
  assert.equal(adds.length, 2);
  assert.ok(events.some(e => e.kind === 'summon' && e.count === 2));
  for (let i = 0; i < 10; i++) {
    w.enemies.push({id: `add${i}`, hp: 10, role: 'archer', summoned: true, x: 1, y: 1, damage: 1, attackTimer: 0, animation: 0});
  }
  const n = w.enemies.length;
  bossTick(w, data, foe, 25);
  assert.equal(w.enemies.length, n); // cap holds
});

test('cinder-maul slam chews nearby buildings', () => {
  const w = createWorld(data);
  const boss = bossFor(data, 9, 10);
  spawnBoss(w, data, boss, 10);
  const foe = w.enemies[w.enemies.length - 1];
  const wall = w.buildings.find(b => b.type === 'wall');
  foe.x = wall.x + 0.5; foe.y = wall.y + 0.5;
  foe.slamTimer = 7.9;
  const hp = wall.hp;
  bossTick(w, data, foe, 0.2);
  assert.ok(wall.hp < hp);
});

test('dread aura sharpens the court near its queen', () => {
  const {w, foe} = bossWorld();
  const near = {x: foe.x + 1, y: foe.y, role: 'archer'};
  const far = {x: foe.x + 30, y: foe.y + 30, role: 'archer'};
  assert.equal(bossAuraMult(w, data, near), 1.3);
  assert.equal(bossAuraMult(w, data, far), 1);
  assert.equal(bossAuraMult(w, data, foe), 1); // the crown needs no aura
});

// ---- Fortifications: new tiers, siegebane answers ----

test('late-game fortification tiers exist and gate off village level', () => {
  assert.equal(data.buildings.stonewall.tiers.length, 4);
  assert.equal(data.buildings.stonewall.tierGates['4'], 10);
  assert.equal(data.buildings.rampart.tiers.length, 4);
  assert.equal(data.buildings.rampart.tierGates['4'], 11);
  assert.equal(data.buildings.gate.tiers.length, 4);
  assert.equal(data.buildings.ballista.tiers.length, 3);
  assert.ok(data.buildings.ballista.tiers[2].siegebane > 0);
  const bastion = data.buildings.bastion;
  assert.equal(bastion.minLevel, 10);
  assert.deepEqual(bastion.tiers[0].prefer, ['boss', 'siege']);
  assert.ok(bastion.tiers[0].siegebane > 0);
});

test('siegebane bastions shred engines', () => {
  const g = game(11);
  const w = g.world;
  w.buildings.push({id: 'bastion1', type: 'bastion', x: 30, y: 25, level: 1, hp: 600, remaining: 0, cooldown: 0});
  const mk = role => ({id: role, x: 31.5, y: 25.5, hp: 500, maxHp: 500, damage: 1, role, attackTimer: 5, animation: 0});
  const ram = mk('ram');
  w.enemies.push(ram);
  tickCombat(w, data, 0.05);
  // 70 base x2 siegebane = 140 on the first volley (only the bastion is in range)
  assert.ok(ram.hp <= 500 - 139, `ram took too little: ${ram.hp}`);
});

// ---- Endless sinks: renown + paragon ----

test('renown costs climb forever and sharpen the village', () => {
  const c0 = renownCost(data, 0);
  const c1 = renownCost(data, 1);
  const c5 = renownCost(data, 5);
  assert.ok(c1.gold > c0.gold && c5.gold > c1.gold);
  assert.equal(renownLevel({renown: 3}), 3);
  assert.equal(renownLevel({}), 0);
  assert.ok(Math.abs(renownDamageMult({renown: 10}, data) - 1.3) < 1e-9);
  assert.ok(Math.abs(renownLootMult({renown: 4}, data) - 1.2) < 1e-9);
  assert.equal(renownAvailable({vlevel: 8, world: {buildings: []}}, data), false);
});

test('renown buys at a standing hall and compounds', () => {
  const g = game(9);
  g.world.resources.gold = 100000;
  g.world.resources.food = 100000;
  g.world.resources.wood = 100000;
  g.world.resources.flour = 1000;
  g.world.resources.plate = 1000;
  g.world.resources.lumber = 10000;
  g.world.resources.bread = 1000;
  g.world.resources.frostwood = 1000;
  assert.equal(g.raiseRenown(), true);
  assert.equal(g.world.renown, 1);
  const again = renownCost(data, 1);
  assert.ok(again.gold > renownCost(data, 0).gold);
  assert.equal(g.raiseRenown(), true);
  assert.equal(g.world.renown, 2);
  const poor = game(9);
  assert.equal(poor.raiseRenown(), undefined); // cannot afford
  assert.equal(game(8).raiseRenown(), undefined); // too green
});

test('paragon reinforces max-tier fortifications without end', () => {
  assert.ok(paragonEligible('stonewall', data));
  assert.ok(paragonEligible('bastion', data));
  assert.equal(paragonEligible('farm', data), false);
  const p0 = paragonCost('stonewall', 0, {}, data);
  const p1 = paragonCost('stonewall', 1, {}, data);
  assert.ok(p1.wood > p0.wood);
  assert.equal(buildingMaxHp({type: 'wall', level: 3, paragon: 0}, data), 690);
  assert.equal(buildingMaxHp({type: 'wall', level: 3, paragon: 2}, data), Math.round(690 * 1.24));
  assert.ok(Math.abs(paragonDamageMult({paragon: 3}, data) - 1.3) < 1e-9);
});

test('reinforce crowns finished work; upgrades rebuild it', () => {
  const g = game(11);
  g.world.resources.wood = 100000;
  g.world.resources.gold = 100000;
  g.world.resources.plate = 1000;
  g.world.resources.lumber = 1000;
  const wall = g.world.buildings.find(b => b.type === 'wall');
  wall.level = 3; wall.hp = 690; wall.remaining = 0;
  assert.equal(g.reinforce(wall.id), true);
  assert.equal(wall.paragon, 1);
  assert.equal(wall.hp, Math.round(690 * 1.12));
  const farm = g.world.buildings.find(b => b.type === 'farm');
  assert.equal(g.reinforce(farm.id), undefined);
  const tower = g.world.buildings.find(b => b.type === 'tower');
  tower.level = 3; tower.paragon = 2; tower.remaining = 0;
  g.upgrade(tower.id);
  assert.equal(tower.level, 4);
  assert.equal(tower.paragon, 0);
});

// ---- Full herald flow: telegraphed, fought, remembered ----

test('boss waves are heralded, fought, and pinned to the Chronicle', () => {
  const g = game(9);
  g.world.wave = 9;
  g.world.elapsed = 1000;
  g.world.nextRaidAt = 1000;
  g.tick(0.05);
  assert.equal(g.world.raidPending.boss, 'cinder-maul');
  assert.ok(Math.abs(g.world.raidPending.timer - 45) < 0.1); // 25 warning + 20 crown courtesy, already ticking
  assert.ok(bossFor(data, 9, 10).herald.includes('GORM')); // the herald names the crown
  assert.equal(g.world.lastBoss.wave, 10);
  assert.equal(g.world.lastBoss.won, null);
  g.world.raidPending.timer = 0;
  g.tick(0.05);
  assert.ok(g.world.enemies.some(e => e.role === 'boss'));
  assert.ok(bossFor(data, 9, 10).attack.includes('Cinder-Maul')); // muster herald names the crown
  for (const e of g.world.enemies) e.hp = 0;
  g.tick(0.05);
  assert.equal(g.world.lastBoss.won, true);
  assert.ok(g.message.includes('Cinder-Maul'));
});

test('elite bounty and renown sweeten salvage', () => {
  const g = game(11);
  const w = g.world;
  w.enemies.push({id: 'e1', x: 8.5, y: 10.5, hp: 1, maxHp: 200, damage: 1, role: 'raider', elite: true, attackTimer: 5, animation: 0});
  const before = w.resources.gold;
  tickCombat(w, data, 1);
  assert.equal(w.raidLoot - 0, 15); // 5 x3 elite bounty, no renown yet
  assert.equal(w.resources.gold - before, 15);
});
