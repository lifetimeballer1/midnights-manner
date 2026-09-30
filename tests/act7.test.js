import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {levelForXp, makeBuilding, makeUnit, createWorld, gearArmor, gatherBonus, unlockedAbilities, stats, auras, builderBonuses, proximityArmor, reviveFraction, siegeBonus, promotionOptions, distance} from '../src/model.js';
import {tickVillage, questProgress} from '../src/systems/village.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickCombat, spawnRaid, activateAbility} from '../src/systems/combat.js';
import {Game} from '../src/game.js';
import {missionLocked, startMission, finishMission} from '../src/systems/campaign.js';
import {validateSave} from '../src/storage.js';

// Act VII — Oath, Song & Siege-Craft. Three phases (11 war band, 12 siege
// engine, 13 second choir), one schoolhouse (14) that pays the pattern off,
// and the doctrine fork (15). Every new behavior rides an existing handler
// or one generic data field — no troop/item ids in src, pinned below.
const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'levels']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const noop = () => {};
function richState(d) {
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000, plate: 100000, lumber: 100000};
  return g;
}

// Act VII Phase 11 — The War Band Grows Up: the Oathsworn, second C-kit,
// first proximity aura, heaviest recruit yet.
test('ph11: the Oathsworn is the second C-kit at the heaviest recruit yet', () => {
  assert.equal(Object.keys(data.troops).length, 37);
  const o = data.troops.oathsworn;
  assert.equal(o.role, 'combat');
  assert.deepEqual([o.base.hp, o.base.damage], [260, 18]);
  assert.equal(o.defaultGear, 'oathblade');
  assert.deepEqual(o.abilities, {5: 'bulwark', 10: 'armor-ii', 15: 'oath', 20: 'veteran', 25: 'unbroken'});
  assert.deepEqual(o.recruitCost, {food: 60, gold: 45});
  assert.ok(data.world.locked.includes('oathsworn'), 'earned past the pale host');
});

test('ph11: C2 abilities ride existing handlers plus two generic effects', () => {
  const handled = ['splash', 'armor', 'heal', 'damage', 'gather', 'aura', 'xp', 'buff', 'guard'];
  for (const id of ['bulwark', 'armor-ii', 'veteran']) {
    assert.ok(handled.includes(data.abilities[id].effect), `${id} uses handled effect`);
  }
  assert.equal(data.abilities.oath.effect, 'taunt');
  assert.ok(data.abilities.oath.active, 'oath is a castable');
  assert.equal(data.abilities.unbroken.effect, 'unbroken');
  const u = makeUnit('oathsworn', data);
  u.level = 25;
  assert.deepEqual(Object.values(data.troops.oathsworn.abilities), ['bulwark', 'armor-ii', 'oath', 'veteran', 'unbroken']);
  const eff = unlockedAbilities(u, data).map(a => a.effect);
  assert.ok(eff.includes('armor') && eff.includes('damage'));
});

test('ph11: Oathcall pulls raiders off their path', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  w.troops = [];
  const sworn = makeUnit('oathsworn', d, 0);
  sworn.level = 15; sworn.x = 9; sworn.y = 9;
  const bait = makeUnit('miner', d, 1);
  bait.x = 7.5; bait.y = 7.5; // closer to the raider, and edible
  w.troops.push(sworn, bait);
  w.enemies.push({id: 'r1', x: 8, y: 8, hp: 200, maxHp: 200, damage: 5, attackTimer: 0, animation: 0});
  assert.ok(activateAbility(w, d, sworn, 'oath'), 'the oath is sworn');
  assert.ok(sworn.taunt && sworn.taunt.timer > 0, 'challenge planted');
  const ex = w.enemies[0].x, ey = w.enemies[0].y;
  tickCombat(w, d, 0.05);
  // Without the oath the raider would close on the nearer miner; sworn, it
  // climbs toward the oathbound instead.
  assert.ok(distance(w.enemies[0], sworn) < distance({x: ex, y: ey}, sworn), 'raider turns on the oathbound');
});

test('ph11: Unbroken survives one killing blow per raid, then spends', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  const sworn = makeUnit('oathsworn', d, 0);
  sworn.level = 25; sworn.x = 5; sworn.y = 5;
  w.troops.push(sworn);
  spawnRaid(w, 1);
  w.enemies[0].x = 5.2; w.enemies[0].y = 5.2;
  w.enemies[0].hp = 10000; w.enemies[0].maxHp = 10000;
  w.enemies[0].damage = 10000;
  w.enemies[0].attackTimer = 0;
  tickCombat(w, d, 0.05);
  assert.equal(sworn.hp, 1, 'the killing blow leaves 1 HP');
  assert.ok(sworn.unbrokenUsed, 'the oath is spent');
  w.enemies[0].attackTimer = 0;
  tickCombat(w, d, 0.05);
  assert.equal(sworn.hp, 0, 'the second killing blow lands');
  w.raidKills = 1; // the ledger counts the kill; the sim counts the raid
  for (const e of w.enemies) e.hp = 0;
  tickCombat(w, d, 0.05);
  assert.ok(!sworn.unbrokenUsed, 'a new raid means a new oath');
  assert.equal(w.flawlessRaids || 0, 1, 'no building fell — Rue counts it');
});

test('ph11: the Oathstone lends armor to nearby troops, not a workplace', () => {
  const s = data.buildings.oathstone;
  assert.deepEqual(s.proximityAura, {armor: 0.1, radius: 3});
  assert.ok(!s.workplace, 'no workplace — proximity, not posting');
  assert.ok(data.world.locked.includes('oathstone'), 'earned past the pale host');
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  const stone = makeBuilding('oathstone', 5, 5, d);
  stone.remaining = 0;
  w.buildings.push(stone);
  const near = makeUnit('warrior', d, 0); near.x = 6; near.y = 6;
  const far = makeUnit('warrior', d, 1); far.x = 20; far.y = 20;
  assert.equal(proximityArmor(near, w, d), 0.1, 'stone-ground guards the near');
  assert.equal(proximityArmor(far, w, d), 0, 'the far stand alone');
  stone.hp = 0;
  assert.equal(proximityArmor(near, w, d), 0, 'ruins lend nothing');
});

test('ph11: Oathblade and Tower Shield price the heavy guard', () => {
  const b = data.items.oathblade;
  assert.deepEqual(b.roles, ['oathsworn']);
  // Stored {damage: 1.3, range: 1.1} read as multipliers by stats(), the
  // Act VI oilskin-coat ×1.1 precedent — never additive.
  assert.deepEqual([b.stats.damage, b.stats.range], [1.3, 1.1]);
  assert.equal(b.animation, 'oath');
  const t = data.items['tower-shield'];
  assert.equal(t.slot, 'armor');
  assert.ok(t.roles.includes('oathsworn') && t.roles.includes('warrior'));
  // Stored speed 0.9 is the multiplier itself (10% slower), same precedent.
  assert.deepEqual([t.stats.armor, t.stats.speed], [0.2, 0.9]);
  const u = makeUnit('oathsworn', data);
  u.gear = 'oathblade';
  // stats() assumes a fitted tool (makeUnit always issues one), so the
  // baseline draws plain steel rather than bare hands.
  const plain = makeUnit('oathsworn', data);
  plain.gear = 'sword';
  assert.ok(stats(u, data).damage > stats(plain, data).damage, 'the blade multiplies the blow');
});

test('ph11: the Pale Host debuts wave-scaling with Sorrel holding the line', () => {
  const m = data.missions.find(m => m.id === 'the-pale-host');
  assert.ok(m, 'chapter 10 exists');
  assert.equal(m.chapter, '10');
  assert.equal(m.act, 'VII');
  assert.deepEqual(m.requires, ['coin-and-cinder']);
  assert.deepEqual(m.scaling, {hp: 18, damage: 3});
  assert.equal(m.troopLimit, 8);
  assert.deepEqual(m.unlocks, ['oathsworn', 'oathblade', 'tower-shield', 'oathstone']);
  assert.ok(m.map.troops.includes('oathsworn'), 'the showcase walks the map');
  assert.ok(m.map.buildings.some(b => b.type === 'oathstone'), 'the stone stands on the map');
  for (const key of ['warning', 'victory', 'defeat'])
    assert.ok(m.ceremony?.[key]?.includes('Sorrel'), `ceremony.${key} names Sorrel`);
  // 15 chapters crowned Act VIII; the Ironshield conquest arc (Phase 8)
  // adds chapters 15-17 on top — a deliberate pin update.
  assert.equal(data.missions.length, 18);
});

test('ph11: wave-scaling steepens spawns; home raids ride the classic curve', () => {
  const d = structuredClone(data);
  const w = createWorld(d);
  spawnRaid(w, 3, {hp: 18, damage: 3});
  assert.equal(w.enemies[0].hp, 65 + 18, 'scaled wave-1 hp');
  assert.equal(w.enemies[0].damage, 9 + 3, 'scaled wave-1 damage');
  const w2 = createWorld(d);
  spawnRaid(w2, 3);
  assert.equal(w2.enemies[0].hp, 65 + 12, 'classic wave-1 hp untouched');
  assert.equal(w2.enemies[0].damage, 9 + 2, 'classic wave-1 damage untouched');
});

test('ph11: the pale host waits on coin-and-cinder', () => {
  const m = data.missions.find(m => m.id === 'the-pale-host');
  assert.ok(missionLocked(m, []), 'locked at the start');
  assert.ok(!missionLocked(m, ['coin-and-cinder']), 'open after the finale');
});

// Act VII Phase 12 — The Siege Engine: fire traps, tower-4, Rue's terms,
// and level 8 (1500) paying tier-4 access.
test('ph12: the Fire Trap is burn damage with a quest gate', () => {
  const f = data.buildings['fire-trap'];
  assert.equal(f.tiers.length, 1, 'doctrine piece, single tier');
  assert.equal(f.tiers[0].damage, 60);
  assert.equal(f.tiers[0].burn, 4);
  assert.equal(f.tiers[0].burnDuration, 3);
  assert.ok(data.world.locked.includes('fire-trap'), 'earned on Rue terms');
});

test('ph12: lit raiders smolder each second', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  w.troops = [];
  spawnRaid(w, 1);
  const e = w.enemies[0];
  e.burn = {dps: 4, timer: 3};
  const hp = e.hp;
  tickCombat(w, d, 1);
  assert.ok(Math.abs(e.hp - (hp - 4)) < 0.001, `burn ticks 4/s, got ${hp - e.hp}`);
});

test('ph12/phase2: tower tier 4 rides the endgame curve and waits on level 8', async () => {
  const t = data.buildings.tower;
  assert.equal(t.tiers.length, 4);
  assert.deepEqual([t.tiers[3].damage, t.tiers[3].range], [65, 5.2]);
  assert.deepEqual(t.tierGates, {4: 8});
  const {buildingCost: bc} = await import('../src/model.js');
  const d = structuredClone(data);
  const w = createWorld(d);
  const base = d.buildings.tower.cost;
  // A bare world (no crew discount) isolates the tier curve itself.
  const c4 = bc('tower', 4, {...w, troops: []}, d);
  assert.equal(c4.wood, base.wood * 24, 'tier-4 rides the Phase 2 endgame curve');
  assert.equal(c4.gold, base.gold * 24, 'on both coin and timber');
  assert.equal(c4.plate, 20, 'the high tower asks for forged plate');
  assert.equal(c4.lumber, 30, 'and sawn lumber');
  const g = richState(d);
  g.state.vlevel = 7;
  const tw = makeBuilding('tower', 3, 3, d);
  tw.remaining = 0; tw.level = 3;
  g.world.buildings.push(tw);
  const messages = [];
  g.notify = m => messages.push(m);
  g.upgrade(tw.id);
  assert.equal(tw.level, 3, 'no tier-4 below village level 8');
  assert.ok(messages.some(m => m.includes('village level 8')), 'the gate speaks plainly');
  g.state.vlevel = 8;
  g.upgrade(tw.id);
  assert.equal(tw.level, 4, 'level 8 opens the high tower');
});

test('ph12: watchfire tier 3 joins the level-8 sky', () => {
  const f = data.buildings.watchfire;
  assert.equal(f.tiers.length, 3);
  assert.deepEqual([f.tiers[2].damage, f.tiers[2].range], [30, 6.5]);
  assert.deepEqual(f.tierGates, {3: 8});
});

test('ph12: siege tongs teach every tower', () => {
  const t = data.items['siege-tongs'];
  assert.deepEqual(t.roles, ['builder', 'mason']);
  assert.deepEqual([t.stats.buildSpeed, t.stats.trapDamage], [1.5, 0.2]);
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  const tw = makeBuilding('tower', 5, 5, d);
  tw.remaining = 0; tw.cooldown = 0;
  w.buildings.push(tw);
  const crew = makeUnit('builder', d, 0);
  crew.gear = 'siege-tongs';
  w.troops.push(crew);
  assert.equal(siegeBonus(w, d), 0.2, 'one pair of tongs, +20%');
  spawnRaid(w, 1);
  const e = w.enemies[0];
  e.x = 5.5; e.y = 5.5; e.hp = 1000;
  tickCombat(w, d, 0.05);
  assert.ok(e.hp < 1000 - 15, `tower hits above its 15 base with tongs, dealt ${1000 - e.hp}`);
});

test('ph12: the Ashen Cloak wards the next fire', () => {
  const c = data.items['ashen-cloak'];
  assert.equal(c.slot, 'armor');
  assert.ok(c.roles.includes('builder') && c.roles.includes('healer'));
  assert.equal(c.stats.burnResist, 1, 'full ward, stored 0-1');
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  const bare = makeUnit('builder', d, 0);
  const clad = makeUnit('builder', d, 1);
  clad.armor = 'ashen-cloak';
  clad.armorOwned = ['ashen-cloak'];
  bare.burn = {dps: 10, timer: 2};
  clad.burn = {dps: 10, timer: 2};
  w.troops.push(bare, clad);
  spawnRaid(w, 1); // raiders present so off-raid regen stays out of the math
  const hb = bare.hp, hc = clad.hp;
  tickCombat(w, d, 1);
  assert.ok(Math.abs(bare.hp - (hb - 10)) < 0.01, 'bare hands burn');
  assert.ok(Math.abs(clad.hp - hc) < 0.01, 'the cloak holds the fire off');
});

test('ph12: Rue terms — a flawless raid opens the siege-craft', () => {
  const q = data.quests.find(q => q.id === 'rue-s-terms');
  assert.ok(q, 'quest 17 exists');
  assert.deepEqual(q.task, {kind: 'defeat', count: 1});
  assert.equal(q.xp, 150);
  assert.deepEqual(q.unlocks, ['fire-trap', 'siege-tongs', 'ashen-cloak']);
  assert.equal(q.giver, 'Rue the turncloak');
  assert.ok(q.log && q.log.length > 0, 'Rue leaves a log page');
  const d = structuredClone(data);
  const g = new Game(d);
  g.state.questsCompleted = d.quests.filter(q => !['rue-s-terms', 'voices-in-the-dark', 'tam-s-school'].includes(q.id)).map(q => q.id);
  g.state.xp = 1690; g.state.vlevel = 7;
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('rue-s-terms'), 'arrival: no flawless raids, gate holds');
  g.world.flawlessRaids = 1;
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(g.state.questsCompleted.includes('rue-s-terms'), 'one clean defense pays');
  assert.equal(g.state.xp, 1840, 'running total after Quest 17');
  assert.ok(g.state.unlocks.includes('fire-trap'), 'the trap is earned');
});

test('ph12: level 8 lands on Rue terms and pays the high towers', () => {
  assert.equal(levelForXp(1499), 7, 'one short of the siege-craft');
  assert.equal(levelForXp(1500), 8, 'level 8 at 1500');
  assert.equal(levelForXp(1840), 8, 'Quest 17 lands level 8 through quests alone');
  const l8 = data.levels.find(l => l.level === 8);
  assert.ok(l8, 'level 8 carries a cache');
  assert.deepEqual(l8.rewards, {food: 150, gold: 150});
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources.food = 0; g.world.resources.gold = 0;
  // Level-up payout path: quest completion paying XP across the line.
  g.state.questsCompleted = d.quests.filter(q => !['rue-s-terms', 'voices-in-the-dark', 'tam-s-school'].includes(q.id)).map(q => q.id);
  g.state.xp = 1690; g.state.vlevel = 7;
  g.world.flawlessRaids = 1;
  tickVillage(g.state, d, 0.05, noop);
  assert.equal(g.state.vlevel, 8, 'the bell rings level 8');
  assert.ok(g.world.resources.food >= 150 && g.world.resources.gold >= 150, 'the cache lands');
});

test('ph12: Rue chalked the bands on the notice board', async () => {
  const rumors = JSON.parse(await readFile(new URL('../data/rumors.json', import.meta.url)));
  assert.ok(rumors.some(r => r.id === 'pale-host'), 'the pale host rides the board');
  assert.ok(rumors.some(r => r.id === 'rue-band'), 'Rue old band drinks too loud');
});

// Act VII Phase 13 — The Second Choir: choristers, chapel-3, the Bellcote.
test('ph13: the Chorister sings the chapel whole', () => {
  const c = data.troops.chorister;
  assert.equal(c.role, 'keeper');
  assert.equal(c.job.workplace, 'chapel');
  assert.equal(c.job.effect, 'chorus');
  assert.deepEqual([c.base.hp, c.base.damage], [85, 6]);
  assert.equal(c.defaultGear, 'hymnal');
  assert.deepEqual(c.abilities, {5: 'attune', 10: 'armor', 15: 'mend', 20: 'veteran-x', 25: 'sage'});
  assert.ok(data.world.locked.includes('chorister'), 'earned with four voices');
});

test('ph13: a shared workplace stacks — healer and chorister mend as one', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  const ch = makeBuilding('chapel', 5, 5, d);
  ch.remaining = 0;
  w.buildings.push(ch);
  const h = makeUnit('healer', d, 0); h.level = 1; h.gear = null;
  const c = makeUnit('chorister', d, 1); c.level = 1; c.gear = null;
  // Phase 7: posting rolls no surprises here — neutral temperaments pin
  // the stacking math (Hard Worker would quicken the shares).
  h.traits = ['brave']; c.traits = ['brave'];
  w.troops.push(h, c);
  g.assign(h.id, ch.id);
  g.assign(c.id, ch.id);
  // Chapel 1.5/s × tier 1 × two level-1 shares — the second choir doubles
  // it. Bare hands here: hymnal and robe ride their own test below.
  assert.equal(auras(w, d).heal, 3, 'two voices, twice the mending');
});

test('ph13: chapel tier 3 teaches the Bellcote itself', () => {
  const ch = data.buildings.chapel;
  assert.equal(ch.tiers.length, 3);
  assert.equal(ch.tiers[2].rateMultiplier, 3);
  assert.deepEqual(ch.tierUnlocks, {3: ['bellcote']});
  const d = structuredClone(data);
  const g = richState(d);
  g.state.vlevel = 8;
  const c = makeBuilding('chapel', 3, 3, d);
  c.remaining = 0;
  g.world.buildings.push(c);
  assert.ok(!g.state.unlocks.includes('bellcote'), 'the bell is unearned');
  g.upgrade(c.id);
  c.remaining = 0;
  g.upgrade(c.id);
  assert.equal(c.level, 3, 'the chapel stands three high');
  assert.ok(g.state.unlocks.includes('bellcote'), 'tier 3 teaches the bell');
  assert.ok(data.world.locked.includes('bellcote'), 'locked until the chapel teaches it');
});

test('ph13: Bellcote mercy raises the fallen at half', () => {
  const b = data.buildings.bellcote;
  assert.equal(b.reviveMult, 0.5);
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  assert.equal(reviveFraction(w, d), 0.3, 'cold ground: 30%');
  const bell = makeBuilding('bellcote', 5, 5, d);
  bell.remaining = 0;
  w.buildings.push(bell);
  assert.equal(reviveFraction(w, d), 0.5, 'under the bell: 50%');
  const f = makeUnit('warrior', d, 0);
  const max = stats(f, d).hp;
  f.hp = 0;
  w.troops.push(f);
  spawnRaid(w, 1);
  for (const e of w.enemies) e.hp = 0;
  tickCombat(w, d, 0.05);
  assert.equal(f.hp, max * 0.5, 'the fallen rise at half under the bell');
});

test('ph13: hymnal and robe dress the choir', () => {
  const h = data.items.hymnal;
  assert.deepEqual(h.roles, ['chorister']);
  assert.equal(h.stats.healAura, 0.8);
  const r = data.items['choir-robe'];
  assert.equal(r.slot, 'armor');
  assert.deepEqual([r.stats.armor, r.stats.heal], [0.12, 10]);
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  const ch = makeBuilding('chapel', 5, 5, d);
  ch.remaining = 0;
  w.buildings.push(ch);
  const c = makeUnit('chorister', d, 0);
  c.level = 1; c.gear = 'hymnal'; c.owned = ['hymnal'];
  c.armor = 'choir-robe'; c.armorOwned = ['choir-robe'];
  c.traits = ['brave']; // Phase 7: neutral temperament pins the wardrobe math.
  w.troops.push(c);
  g.assign(c.id, ch.id);
  // 1.5 base share + 0.8 hymnal aura + 10 robe mending, one posted voice.
  assert.equal(auras(w, d).heal, 1.5 + 0.8 + 10, 'robe and hymnal ride the same tick');
});

test('ph13: four posted hands find the choir voice', () => {
  const q = data.quests.find(q => q.id === 'voices-in-the-dark');
  assert.deepEqual(q.task, {kind: 'assign', count: 4});
  assert.equal(q.xp, 140);
  assert.deepEqual(q.unlocks, ['chorister', 'hymnal', 'choir-robe']);
  assert.equal(q.giver, 'Old Bell');
  assert.ok(q.log && q.log.length > 0, 'Old Bell leaves a log page');
  const d = structuredClone(data);
  const g = richState(d);
  g.state.questsCompleted = d.quests.filter(q => !['voices-in-the-dark', 'tam-s-school'].includes(q.id)).map(q => q.id);
  g.state.xp = 1840; g.state.vlevel = 8;
  const post = (type, btype) => {
    const u = g.world.troops.find(t => t.type === type && !t.workplace);
    const b = g.world.buildings.find(b => b.type === btype && b.hp > 0 && b.remaining <= 0);
    if (u && b) g.assign(u.id, b.id);
  };
  post('miner', 'mine');
  post('farmer', 'farm');
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('voices-in-the-dark'), 'two posted hands are not four');
  g.recruit('lumberjack');
  g.recruit('miner');
  post('lumberjack', 'lumber');
  post('miner', 'mine');
  const posted = g.world.troops.filter(t => t.workplace).length;
  assert.equal(posted, 4, 'four hands at their workplaces');
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(g.state.questsCompleted.includes('voices-in-the-dark'), 'the choir finds its voice');
  assert.equal(g.state.xp, 1980, 'running total after Quest 18');
  assert.ok(g.state.unlocks.includes('chorister') && g.state.unlocks.includes('hymnal'), 'the choir is earned');
});

// Act VII Phase 14 — Master & Apprentice: graduation, tutoring, the school.
test('ph14: graduation is gated on cap, posting, and a tier-2 school', () => {
  assert.deepEqual(Object.keys(data.troops.apprentice.promotions), ['healer', 'haggler']);
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  const a = makeUnit('apprentice', d, 0);
  a.level = 15;
  w.troops.push(a);
  assert.deepEqual(promotionOptions(w, d, a), [], 'no school, no graduation');
  const school = makeBuilding('schoolroom', 3, 3, d);
  school.remaining = 0; school.level = 1;
  const cottage = makeBuilding('cottage', 6, 6, d);
  cottage.remaining = 0;
  w.buildings.push(school, cottage);
  g.assign(a.id, cottage.id);
  assert.deepEqual(promotionOptions(w, d, a), [], 'a tier-1 school teaches letters, not graduations');
  school.level = 2;
  const opts = promotionOptions(w, d, a);
  assert.equal(opts.length, 1, 'one road from the cottage');
  assert.equal(opts[0].type, 'healer', 'cottage apprentices take the chapel vows');
  // The roads fork at the school: cottage hands take the vows, schoolroom
  // hands choose between vows and weights (the market itself takes no
  // apprentices — assignment law, not school law).
  g.assign(a.id, school.id);
  const opts2 = promotionOptions(w, d, a);
  assert.ok(opts2.some(o => o.type === 'healer'), 'schoolroom hands may take the vows');
  assert.ok(opts2.some(o => o.type === 'haggler'), 'schoolroom hands may learn the true weights');
});

test('ph14: Tam graduates a keeper at level 5 with the master touch', () => {
  const d = structuredClone(data);
  const g = richState(d);
  g.state.unlocks.push('healer');
  const w = g.world;
  const school = makeBuilding('schoolroom', 3, 3, d);
  school.remaining = 0; school.level = 2;
  const cottage = makeBuilding('cottage', 6, 6, d);
  cottage.remaining = 0;
  w.buildings.push(school, cottage);
  const a = makeUnit('apprentice', d, 0);
  a.level = 15;
  w.troops.push(a);
  g.assign(a.id, cottage.id);
  assert.ok(g.promote(a.id, 'healer'), 'graduation day');
  assert.equal(a.type, 'healer', 'the vows are taken');
  assert.equal(a.level, 5, 'a keeper at level 5, never a novice');
  assert.ok(a.promoted, 'the master touch');
  assert.equal(a.workplace, null, 'the graduate rests before new duties');
  assert.equal(a.gear, 'chalice', 'the apron cannot hold chapel work — the school issues the chalice');
  assert.ok(a.owned.includes('chalice'), 'issued, not bought');
  assert.deepEqual(Object.values(data.troops.healer.abilities).slice(0, 3), ['second-wind', 'ward', 'heal'], 'the keeper kit arrives whole');
  // Locked callings refuse: the school cannot graduate what the village
  // has not earned.
  const a2 = makeUnit('apprentice', d, 1);
  a2.level = 15;
  w.troops.push(a2);
  g.assign(a2.id, cottage.id);
  g.state.unlocks = g.state.unlocks.filter(id => id !== 'haggler');
  g.assign(a2.id, school.id);
  g.promote(a2.id, 'haggler');
  assert.equal(a2.type, 'apprentice', 'unearned callings stay unearned');
});

test('ph14: the master touch keens every aura the graduate lends', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  const ch = makeBuilding('chapel', 5, 5, d);
  ch.remaining = 0;
  w.buildings.push(ch);
  const h = makeUnit('healer', d, 0); h.level = 1;
  const p = makeUnit('healer', d, 1); p.level = 1; p.promoted = true;
  // Phase 7: neutral temperaments pin the share math.
  h.traits = ['brave']; p.traits = ['brave'];
  w.troops.push(h, p);
  g.assign(h.id, ch.id);
  g.assign(p.id, ch.id);
  // 1.5/s × (1 plain share + 1.1 master share) — ten percent keener.
  assert.ok(Math.abs(auras(w, d).heal - 1.5 * 2.1) < 0.0001, 'the touch rides the share');
});

test('ph14: the Schoolroom trickles XP and teaches cheaper', () => {
  const s = data.buildings.schoolroom;
  assert.equal(s.workplace, 'apprentice');
  assert.equal(s.xpRate, 0.06);
  assert.equal(s.tutorDiscount, 0.34);
  assert.equal(s.tiers.length, 2);
  assert.ok(data.world.locked.includes('schoolroom'), 'earned with three new stools');
  const d = structuredClone(data);
  const g = richState(d);
  const w = g.world;
  w.buildings = [];
  const school = makeBuilding('schoolroom', 3, 3, d);
  school.remaining = 0;
  w.buildings.push(school);
  const a = makeUnit('apprentice', d, 0);
  a.level = 1;
  w.troops.push(a);
  g.assign(a.id, school.id);
  const before = {...w.resources};
  g.level(a.id);
  assert.equal(a.level, 2, 'the lesson lands');
  // Apprentice levelCost {gold 15, food 10} × level 1 × (1 − 0.34), rounded up.
  assert.equal(before.gold - w.resources.gold, Math.ceil(15 * 0.66), 'tutoring discounts the gold');
  assert.equal(before.food - w.resources.food, Math.ceil(10 * 0.66), 'tutoring discounts the food');
});

test('ph14: primer ink and the Master Ring ride existing channels', () => {
  const p = data.items.primer;
  assert.deepEqual(p.roles, ['apprentice']);
  assert.equal(p.stats.xp, 0.03);
  const r = data.items['masters-ring'];
  assert.equal(r.slot, 'armor');
  assert.equal(r.stats.aura, 0.05, 'the first % aura gear');
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  const school = makeBuilding('schoolroom', 3, 3, d);
  school.remaining = 0;
  const forge = makeBuilding('forge', 6, 6, d);
  forge.remaining = 0;
  w.buildings.push(school, forge);
  const a = makeUnit('apprentice', d, 0);
  a.level = 1; a.gear = 'primer'; a.owned = ['primer'];
  const s = makeUnit('weaponsmith', d, 1);
  s.level = 1; s.armor = 'masters-ring'; s.armorOwned = ['masters-ring'];
  // Phase 7: neutral temperaments pin the share math (a Craftsman would
  // outshine the ring at the forge, a Hard Worker would hurry the school).
  a.traits = ['brave']; s.traits = ['brave'];
  w.troops.push(a, s);
  g.assign(a.id, school.id);
  g.assign(s.id, forge.id);
  // Schoolroom 0.06 × share + 0.03 primer pour.
  assert.ok(Math.abs(auras(w, d).xp - 0.09) < 0.0001, 'the primer pours alongside the school');
  // Forge 0.1 × 1.05 ringed share.
  assert.ok(Math.abs(auras(w, d).damage - 0.105) < 0.0001, 'the ring keens the share');
});

test('ph14: three new stools open the school', () => {
  const q = data.quests.find(q => q.id === 'tam-s-school');
  assert.deepEqual(q.task, {kind: 'recruit', type: 'apprentice', count: 3});
  assert.equal(q.xp, 150);
  assert.deepEqual(q.unlocks, ['schoolroom', 'primer', 'masters-ring']);
  assert.equal(q.giver, 'Master Tam');
  assert.ok(q.log && q.log.length > 0, 'Tam chalks the roll himself');
  const d = structuredClone(data);
  const g = richState(d);
  g.state.questsCompleted = d.quests.filter(q => q.id !== 'tam-s-school').map(q => q.id);
  g.state.xp = 1980; g.state.vlevel = 8;
  g.state.unlocks.push('apprentice');
  // Apprentices are recruitable since Act V open-doors: zero Act VII
  // content owned, the gate still opens — the school's whole point.
  assert.ok(!g.locked('apprentice'), 'apprentices walk in on an older key');
  g.recruit('apprentice');
  g.recruit('apprentice');
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('tam-s-school'), 'two stools are not three');
  g.recruit('apprentice');
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(g.state.questsCompleted.includes('tam-s-school'), 'three stools filled');
  assert.equal(g.state.xp, 2130, 'running total after Quest 19');
  assert.ok(g.state.unlocks.includes('schoolroom') && g.state.unlocks.includes('primer'), 'the school is earned');
});

// Act VII Phase 15 — The Doctrine Fork: one C-kit reused, one C-kit new,
// craft-only buildings, and twin banners with no permanent lock.
test('ph15: the Halberdier reuses C1 end to end', () => {
  const h = data.troops.halberdier;
  assert.equal(h.role, 'combat');
  assert.deepEqual([h.base.hp, h.base.damage, h.base.range], [170, 20, 1.9]);
  assert.equal(h.defaultGear, 'halberd');
  assert.deepEqual(h.abilities, data.troops.pikewoman.abilities, 'C1 rides again, identical kit');
  assert.deepEqual(data.items.halberd.stats, {damage: 1.35, range: 1.9});
  assert.equal(data.items.halberd.animation, 'sweep');
  assert.ok(data.world.locked.includes('halberdier'), 'earned under red');
});

test('ph15: the Longbowman is the first C3 kit and shares its bow', () => {
  const l = data.troops.longbowman;
  assert.equal(l.role, 'combat');
  assert.deepEqual([l.base.hp, l.base.damage, l.base.range], [75, 22, 5.5]);
  assert.equal(l.defaultGear, 'longbow');
  assert.deepEqual(l.abilities, {5: 'volley', 10: 'keen', 15: 'camouflage', 20: 'veteran', 25: 'arrowstorm'});
  assert.deepEqual(data.items.longbow.roles, ['longbowman', 'ranger', 'archer']);
  assert.ok(data.world.locked.includes('longbowman'), 'earned under grey');
});

test('ph15: volleys splash passively, the storm is cast', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const w = g.world;
  w.buildings = [];
  w.troops = [];
  const lb = makeUnit('longbowman', d, 0);
  lb.level = 25; lb.x = 5; lb.y = 5;
  w.troops.push(lb);
  spawnRaid(w, 2);
  w.enemies[0].x = 5.5; w.enemies[0].y = 5.5;
  w.enemies[1].x = 6.2; w.enemies[1].y = 5.5;
  for (const e of w.enemies) { e.hp = 1000; e.maxHp = 1000; }
  w.enemies[0].attackTimer = 99;
  w.enemies[1].attackTimer = 99;
  tickCombat(w, d, 0.05);
  // The bowman's arrows land on the first raider; the volley carries half
  // to the second. Both bled without a cast.
  assert.ok(w.enemies[0].hp < 1000, 'arrows land');
  assert.ok(w.enemies[1].hp < 1000, 'the volley carries');
  const before = w.enemies[1].hp;
  assert.ok(activateAbility(w, d, lb, 'arrowstorm'), 'the sky darkens');
  assert.ok(w.enemies[1].hp < before, 'the storm falls wide');
  assert.ok(lb.abilityTimer > 0, 'thirty seconds to restring');
});

test('ph15: the Banner Cloak is cosmetic-plus, priced to move', () => {
  const c = data.items['banner-cloak'];
  assert.equal(c.slot, 'armor');
  assert.equal(c.stats.armor, 0.1);
  assert.deepEqual(c.cost, {gold: 60, wood: 30});
  assert.ok(data.world.locked.includes('banner-cloak'), 'earned under either banner');
});

test('ph15: the Fletcher piles bundles; expeditions spend them', () => {
  const f = data.buildings.fletcher;
  assert.deepEqual(f.arrowBuff, {roles: ['archer', 'ranger', 'longbowman'], stat: 'damage', value: 0.15});
  assert.ok(f.stockRate > 0, 'bundles pile over time');
  assert.ok(data.world.locked.includes('fletcher'), 'earned under red');
  const d = structuredClone(data);
  const g = richState(d);
  g.state.completed = ['coin-and-cinder', 'the-pale-host'];
  const fl = makeBuilding('fletcher', 3, 3, d);
  fl.remaining = 0;
  g.world.buildings.push(fl);
  tickVillage(g.state, d, 150, noop);
  assert.equal(fl.stock, 1, 'one bundle piled, capped at one');
  g.mission('grey-banner');
  assert.equal(g.state.mission?.id, 'grey-banner', 'the grey road opens');
  assert.equal(fl.stock, 0, 'the expedition spends the bundle');
  const bows = g.world.troops.filter(t => ['archer', 'ranger', 'longbowman'].includes(t.type));
  assert.ok(bows.length > 0, 'bows walk the grey map');
  for (const u of bows) assert.equal(u.buffs?.damage?.value, 0.15, `${u.type} draws a bundled string`);
  const others = g.world.troops.filter(t => !['archer', 'ranger', 'longbowman'].includes(t.type));
  for (const u of others) assert.ok(!u.buffs?.damage, `${u.type} draws plain`);
  // No bows, no spend: a foot expedition leaves the quiver full.
  const g2 = richState(d);
  const fl2 = makeBuilding('fletcher', 3, 3, d);
  fl2.remaining = 0; fl2.stock = 1;
  g2.world.buildings.push(fl2);
  g2.mission('first-harvest');
  assert.equal(g2.state.mission?.id, 'first-harvest', 'the foot road opens');
  assert.equal(fl2.stock, 1, 'no bows on the map, no bundle spent');
});

test('ph15: worn plate dulls, the yard keeps it bright', () => {
  assert.ok(data.buildings['shieldwall-yard'].serviceArmor, 'the yard knows plate');
  assert.ok(data.world.locked.includes('shieldwall-yard'), 'earned under grey');
  const fresh = makeUnit('warrior', data, 0);
  fresh.armor = 'kite-shield';
  const worn = makeUnit('warrior', data, 1);
  worn.armor = 'kite-shield';
  worn.armorWear = 3;
  // gearArmor returns the reduction itself: 0.15 fresh, ~0.075 worn.
  // Damage taken runs 0.85 fresh against 0.925 worn — plate at half.
  assert.ok(gearArmor(fresh, data) > gearArmor(worn, data), 'worn plate guards at half');
  const d = structuredClone(data);
  const g = richState(d);
  const w = g.world;
  w.buildings = [];
  const v = makeUnit('warrior', d, 0);
  v.armor = 'kite-shield'; v.armorWear = 0;
  w.troops.push(v);
  spawnRaid(w, 1);
  w.raidKills = 1;
  for (const e of w.enemies) e.hp = 0;
  tickCombat(w, d, 0.05);
  assert.equal(v.armorWear, 1, 'one survived raid, one notch of wear');
  const yard = makeBuilding('shieldwall-yard', 3, 3, d);
  yard.remaining = 0;
  w.buildings.push(yard);
  assert.ok(g.serviceArmor(), 'the yard rings all day');
  assert.equal(v.armorWear, 0, 'every plate bright again');
  v.armorWear = 5;
  w.buildings = [];
  g.serviceArmor();
  assert.equal(v.armorWear, 5, 'no yard, no service');
});

test('ph15: victorious expeditions come home to bright plate', () => {
  const d = structuredClone(data);
  const g = richState(d);
  g.state.completed = ['first-harvest'];
  const yard = makeBuilding('shieldwall-yard', 3, 3, d);
  yard.remaining = 0;
  g.world.buildings.push(yard);
  const v = makeUnit('warrior', d, 0);
  v.armor = 'kite-shield'; v.armorWear = 3;
  g.world.troops.push(v);
  // A standing expedition: the away world is the home world here — the
  // test cares about the yard's night work, not the road itself.
  g.state.home = g.state.world;
  g.state.mission = {id: 'first-harvest', fired: [0], status: 'won'};
  g.returnHome();
  assert.equal(v.armorWear, 0, 'the yard worked the night');
});

test('ph15: twin banners — both roads open, the mirror recruitable either way', () => {
  const red = data.missions.find(m => m.id === 'red-banner');
  const grey = data.missions.find(m => m.id === 'grey-banner');
  assert.equal(red.chapter, '11');
  assert.equal(grey.chapter, '11');
  assert.deepEqual(red.requires, ['the-pale-host']);
  assert.deepEqual(grey.requires, ['the-pale-host']);
  assert.equal(red.troopLimit, 8);
  assert.equal(grey.troopLimit, 8);
  assert.deepEqual(red.unlocks, ['halberdier', 'halberd', 'fletcher', 'banner-cloak', 'longbowman']);
  assert.deepEqual(grey.unlocks, ['longbowman', 'longbow', 'shieldwall-yard', 'banner-cloak', 'halberdier']);
  // No permanent lock: after the pale host, BOTH banners are playable.
  // The exclusivity is pacing (showcase vs recruit), and the Phase-16
  // OR-gate will formalize the doctrine choice. Nothing strands.
  assert.ok(missionLocked(red, []), 'neither road before the pale host');
  assert.ok(!missionLocked(red, ['coin-and-cinder', 'the-pale-host']), 'red opens after');
  assert.ok(!missionLocked(grey, ['coin-and-cinder', 'the-pale-host']), 'grey opens after');
  assert.ok(red.map.troops.includes('halberdier') && grey.map.troops.includes('longbowman'), 'each showcase walks its own map');
});

// Act VII cross-cutting: totals, chains, conditionals, saves.
test('viii: frontier legend counts — 37 people, 18 chapters, 24 steps, 2640 XP', () => {
  assert.equal(Object.keys(data.troops).length, 37);
  assert.equal(data.missions.length, 18);
  assert.equal(data.quests.length, 24);
  assert.equal(data.quests.reduce((n, x) => n + x.xp, 0), 2640);
  assert.equal(levelForXp(2640), 11);
});

test('vii: every new unlock resolves and starts locked', () => {
  const vii = ['the-pale-host', 'red-banner', 'grey-banner'];
  for (const id of vii) {
    const m = data.missions.find(m => m.id === id);
    assert.ok(Array.isArray(m.unlocks) && m.unlocks.length > 0, `${id} grants`);
    for (const u of m.unlocks) {
      assert.ok(data.buildings[u] || data.items[u] || data.troops[u], `${id} unlock ${u} resolves`);
      assert.ok(data.world.locked.includes(u), `${id} unlock ${u} genuinely locked`);
    }
  }
  for (const q of data.quests.filter(q => q.act === 'VII')) {
    for (const u of q.unlocks || []) {
      assert.ok(data.buildings[u] || data.items[u] || data.troops[u], `${q.id} unlock ${u} resolves`);
      assert.ok(data.world.locked.includes(u), `${q.id} unlock ${u} genuinely locked`);
    }
  }
  assert.ok(data.world.locked.includes('bellcote'), 'the bell waits on the chapel, never the shop');
});

test('vii: no troop-specific or item-specific conditionals in the sim', async () => {
  // Building-type reads (hall, trap, schoolroom-as-school) follow the
  // established convention; troops and gear never appear by id.
  const banned = ['oathsworn', 'chorister', 'halberdier', 'longbowman', 'oathblade', 'tower-shield', 'siege-tongs', 'ashen-cloak', 'hymnal', 'choir-robe', 'primer', 'masters-ring', 'halberd', 'longbow', 'banner-cloak'];
  const files = ['model.js', 'game.js', 'ui.js', 'systems/economy.js', 'systems/village.js', 'systems/combat.js', 'systems/campaign.js'];
  for (const f of files) {
    const src = await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    for (const id of banned) assert.ok(!src.includes(id), `src/${f} never names ${id}`);
  }
});

test('vii: old saves arrive safely — missing keys read zero, never crash', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  // A veteran save predates every Act VII key: no flawless ledger, no
  // raid flag, no promotions, no wear, no quiver stock.
  assert.equal(g.world.flawlessRaids || 0, 0, 'no ledger, no flawless');
  assert.equal(g.world.inRaid || false, false, 'no flag, no raid');
  const state = {version: 5, world: g.world, home: null, mission: null, completed: [], unlocks: ['tower'], xp: 0, vlevel: 1, questsCompleted: []};
  assert.ok(validateSave(state, d), 'the old shape still validates');
  tickVillage(g.state, d, 1, noop);
  tickCombat(g.world, d, 1);
  assert.ok(questProgress({kind: 'defeat', count: 1}, g.state).have === 0, 'Rue waits on real raids');
});
