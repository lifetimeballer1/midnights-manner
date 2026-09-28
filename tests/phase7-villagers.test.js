import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld, makeBuilding, makeUnit, stats, auras} from '../src/model.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickEmergency} from '../src/systems/emergency.js';
import {tickCombat} from '../src/systems/combat.js';
import {exportSave, importSaveBlob, VERSION} from '../src/storage.js';
import {TRAITS, ensureIdentity, hasTrait, jobLevelForXp, jobLevelMult, tickVillagerJobs, idleWorkers, idleWithoutPosts, autoFillTick, scorePost, autoAssign, towerCrewBonus, fleeRadius, fleeSpeedMult, raidDamageMult, CRAFT_SHOPS} from '../src/systems/villagers.js';

const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'names'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));

function setup() {
  const g = new Game(data);
  g.state = {...g.state, world: createWorld(data), home: null, mission: null, completed: [], vlevel: 1};
  g.world.resources = {wood: 10000, food: 10000, gold: 10000};
  g.world.buildings.push(makeBuilding('barracks', 3, 3, data));
  return g;
}
function recruit(g, type) {
  // Bypass randomness for determinism: identity is ensured inside recruit.
  return g.recruit(type);
}

test('phase7: every trait in the catalog names a real reader', () => {
  for (const [id, t] of Object.entries(TRAITS)) {
    assert.ok(t.name && t.desc && t.reader, `trait ${id} documented`);
    assert.ok(t.icon, `trait ${id} has a mobile chip icon`);
  }
  assert.ok(Object.keys(TRAITS).length >= 6, 'small trait set');
});

test('phase7: recruits arrive named with traits and a job ledger', () => {
  const g = setup();
  const a = recruit(g, 'farmer'), b = recruit(g, 'miner');
  assert.ok(a.name && typeof a.name === 'string', 'named');
  assert.ok(b.name && b.name !== a.name, 'unique names');
  assert.ok(Array.isArray(a.traits) && a.traits.length >= 1, 'rolled traits');
  assert.ok(a.traits.every(t => TRAITS[t]), 'all traits real');
  assert.equal(a.jobXp, 0);
  assert.equal(a.jobLevel, 1);
  assert.equal(a.manualPost, false);
});

test('phase7: strong backs haul more and hit harder; marksmen sharpen bows', () => {
  const g = setup();
  const jack = makeUnit('lumberjack', data, 0);
  jack.traits = ['strong'];
  const plain = makeUnit('lumberjack', data, 1);
  plain.traits = ['hard_worker'];
  assert.ok(stats(jack, data).damage > stats(plain, data).damage, 'strong +10% damage');
  const bow = makeUnit('archer', data, 2);
  bow.traits = ['marksman'];
  const bowPlain = makeUnit('archer', data, 3);
  bowPlain.traits = ['brave'];
  assert.equal(stats(bow, data).damage, stats(bowPlain, data).damage * 1.2, 'marksman +20% ranged');
  const sword = makeUnit('warrior', data, 4);
  sword.traits = ['marksman'];
  const swordPlain = makeUnit('warrior', data, 5);
  swordPlain.traits = ['brave'];
  assert.equal(stats(sword, data).damage, stats(swordPlain, data).damage, 'marksman does nothing for melee');
});

test('phase7: posted crews earn job XP; quick learners train faster; levels raise output', () => {
  const g = setup();
  const farm = makeBuilding('farm', 2, 6, data);
  farm.remaining = 0;
  g.world.buildings.push(farm);
  const a = makeUnit('farmer', data, 0);
  a.traits = ['hard_worker']; a.jobXp = 0; a.jobLevel = 1;
  const b = makeUnit('farmer', data, 1);
  b.traits = ['quick_learner']; b.jobXp = 0; b.jobLevel = 1;
  g.world.troops.push(a, b);
  g.assign(a.id, farm.id); g.assign(b.id, farm.id);
  tickVillagerJobs(g.world, data, 60);
  assert.equal(a.jobXp, 60);
  assert.equal(b.jobXp, 90, 'quick learner +50%');
  assert.equal(jobLevelForXp(60), 2);
  assert.equal(jobLevelForXp(600), 5);
  assert.equal(jobLevelMult({jobLevel: 1}), 1, 'level 1 reads exactly the old output');
  assert.equal(jobLevelMult({jobLevel: 5}), 1.32, 'level 5 is +32%');
});

test('phase7: craftsmen count extra at smithing posts; hard workers everywhere', () => {
  const g = setup();
  const forge = makeBuilding('forge', 2, 6, data);
  forge.remaining = 0;
  g.world.buildings.push(forge);
  assert.ok(CRAFT_SHOPS.includes('forge') && CRAFT_SHOPS.includes('workshop'), 'smithing/workshop line covered');
  const smith = makeUnit('weaponsmith', data, 0);
  smith.traits = ['craftsman']; smith.jobXp = 0; smith.jobLevel = 1;
  g.world.troops.push(smith);
  g.assign(smith.id, forge.id);
  const auraCraft = auras(g.world, data).damage;
  smith.traits = ['hard_worker'];
  const auraHard = auras(g.world, data).damage;
  smith.traits = [];
  smith.jobLevel = 1;
  const auraBase = auras(g.world, data).damage;
  assert.ok(auraCraft > auraHard, 'craftsman beats hard worker at the forge');
  assert.ok(auraHard > auraBase, 'hard worker beats nothing');
});

test('phase7: smart auto-assignment matches traits; manual locks never move', () => {
  const g = setup();
  // Strip the starting village: only our forge and farm stand open.
  g.world.buildings = g.world.buildings.filter(b => b.type === 'barracks');
  const forge = makeBuilding('forge', 2, 6, data);
  const farm = makeBuilding('farm', 6, 6, data);
  forge.remaining = 0; farm.remaining = 0;
  g.world.buildings.push(forge, farm);
  const smith = makeUnit('weaponsmith', data, 0);
  smith.traits = ['craftsman']; smith.jobXp = 0; smith.jobLevel = 1; smith.x = 2.5; smith.y = 6.5;
  const till = makeUnit('farmer', data, 1);
  till.traits = ['hard_worker']; till.jobXp = 0; till.jobLevel = 1; till.x = 6.5; till.y = 6.5;
  // Clear the starting muster: only our two hands are in the village.
  g.world.troops = [];
  g.world.troops.push(smith, till);
  const plain = makeUnit('weaponsmith', data, 9);
  plain.traits = ['hard_worker'];
  assert.ok(scorePost(smith, forge, data, g.world) > scorePost(plain, forge, data, g.world), 'craftsman affinity outscores a plain hand at the forge');
  const placed = autoAssign(g.world, data);
  assert.equal(placed, 2);
  assert.equal(smith.workplace, forge.id, 'craftsman finds the forge');
  // Manual assignments remain in place when other jobs are open.
  g.assign(smith.id, forge.id);
  const moved = autoAssign(g.world, data);
  assert.equal(smith.workplace, forge.id, 'manual assignment is never moved');
  assert.equal(moved, 0, 'posted hands and locked hands both stay put');
});

test('phase7: idle-worker detection lists posted gaps, never fighters or busy hands', () => {
  const g = setup();
  // Strip the starting village to barracks + one farm: the only open post.
  g.world.buildings = g.world.buildings.filter(b => b.type === 'barracks');
  const farm = makeBuilding('farm', 2, 6, data);
  farm.remaining = 0;
  g.world.buildings.push(farm);
  const a = makeUnit('farmer', data, 0);
  a.traits = ['brave']; a.jobXp = 0; a.jobLevel = 1;
  const f = makeUnit('warrior', data, 1);
  f.traits = ['brave']; f.jobXp = 0; f.jobLevel = 1;
  const b = makeUnit('farmer', data, 2);
  b.traits = ['brave']; b.jobXp = 0; b.jobLevel = 1;
  // Clear the starting muster: only our three hands are in the village.
  g.world.troops = [];
  g.world.troops.push(a, f, b);
  g.assign(b.id, farm.id);
  const idle = idleWorkers(g.world, data).map(u => u.id);
  assert.ok(idle.includes(a.id), 'unposted worker is idle');
  assert.ok(!idle.includes(f.id), 'fighters holding the line are not idle');
  assert.ok(!idle.includes(b.id), 'posted workers are not idle');
  assert.equal(g.autoAssignIdle(), 1, 'one tap posts the idle hand');
  assert.equal(a.workplace, farm.id);
  assert.deepEqual(idleWorkers(g.world, data), [], 'no idle hands left');
});

test('phase7: auto-assign names the missing post instead of claiming no hands idle', () => {
  const g = setup();
  // Barracks only: nowhere for a farmer to work.
  g.world.buildings = g.world.buildings.filter(b => b.type === 'barracks');
  const till = makeUnit('farmer', data, 0);
  till.traits = ['hard_worker']; till.jobXp = 0; till.jobLevel = 1;
  g.world.troops = [];
  g.world.troops.push(till);
  assert.deepEqual(idleWithoutPosts(g.world, data).map(u => u.id), [till.id], 'farmer idle with no post');
  assert.equal(g.autoAssignIdle(), 0, 'nothing placed');
  assert.match(g.message, /no finished post/i, 'button says what is missing');
  const farm = makeBuilding('farm', 2, 6, data);
  farm.remaining = 0;
  g.world.buildings.push(farm);
  assert.deepEqual(idleWithoutPosts(g.world, data), [], 'open post clears the stuck list');
  assert.equal(g.autoAssignIdle(), 1, 'tap posts once a post exists');
  assert.equal(till.workplace, farm.id);
});

test('phase7: open posts fill themselves — idle hands take matching work unasked', () => {
  const g = setup();
  g.world.buildings = g.world.buildings.filter(b => b.type === 'barracks');
  const farm = makeBuilding('farm', 2, 6, data);
  farm.remaining = 0;
  g.world.buildings.push(farm);
  const till = makeUnit('farmer', data, 0);
  till.traits = ['hard_worker']; till.jobXp = 0; till.jobLevel = 1;
  g.world.troops = [];
  g.world.troops.push(till);
  assert.equal(autoFillTick(g.world, data, 1), 0, 'small ticks only wind the timer');
  assert.equal(till.workplace, null, 'nobody moves before the interval');
  assert.equal(autoFillTick(g.world, data, 5), 1, 'open post fills on the interval');
  assert.equal(till.workplace, farm.id, 'idle hand takes the matching post');
});

test('phase7: jobless workers with old rest locks resume looking for work', () => {
  const g = setup();
  g.world.buildings = g.world.buildings.filter(b => b.type === 'barracks');
  const farm = makeBuilding('farm', 2, 6, data);
  farm.remaining = 0;
  g.world.buildings.push(farm);
  const rest = makeUnit('farmer', data, 0);
  rest.traits = ['hard_worker']; rest.jobXp = 0; rest.jobLevel = 1;
  rest.manualPost = true;
  g.world.troops = [];
  g.world.troops.push(rest);
  assert.equal(autoFillTick(g.world, data, 5), 1, 'old rest lock cannot strand a jobless worker');
  assert.equal(rest.workplace, farm.id);
  assert.equal(rest.manualPost, false);
});

test('phase7: emergency respects temperament — cowards flee early and fast, braves hold', () => {
  assert.equal(fleeRadius({traits: ['cowardly']}), 4);
  assert.equal(fleeRadius({traits: ['brave']}), 1.2);
  assert.equal(fleeRadius({traits: ['hard_worker']}), 2.5);
  assert.equal(fleeSpeedMult({traits: ['cowardly']}), 1.3);
  assert.equal(raidDamageMult({traits: ['brave']}, true), 1.1);
  assert.equal(raidDamageMult({traits: ['cowardly']}, true), 0.9);
  assert.equal(raidDamageMult({traits: ['brave']}, false), 1, 'no raid, no modifier');
  const g = setup();
  // A breached wall with raiders 3 tiles out: brave builders mend it,
  // timid ones shelter, cowardly healers run. Raiders at (12.5,10.5),
  // wall face at (9.5,10.5) — 3.0 tiles, inside timid range, outside brave.
  const wall = makeBuilding('wall', 9, 10, data);
  wall.remaining = 0; wall.hp = 10;
  g.world.buildings.push(wall);
  const coward = makeUnit('healer', data, 0);
  coward.traits = ['cowardly']; coward.jobXp = 0; coward.jobLevel = 1; coward.x = 8; coward.y = 10;
  const brave = makeUnit('builder', data, 1);
  brave.traits = ['brave']; brave.jobXp = 0; brave.jobLevel = 1; brave.x = 8; brave.y = 10;
  const timid = makeUnit('builder', data, 2);
  timid.traits = ['hard_worker']; timid.jobXp = 0; timid.jobLevel = 1; timid.x = 8; timid.y = 10;
  g.world.troops.push(coward, brave, timid);
  g.world.enemies.push({id: 'e1', x: 12.5, y: 10.5, hp: 50, maxHp: 50, damage: 5, attackTimer: 0, animation: 0});
  g.world.resources.wood = 100;
  tickEmergency(g.world, data, 0.05);
  assert.equal(coward.emergency?.kind, 'shelter', 'cowardly healer runs for shelter, never tends the field');
  assert.equal(brave.emergency?.kind, 'repair', 'brave builder mends close to the fighting');
  assert.equal(timid.emergency?.kind, 'shelter', 'timid builder keeps its distance');
});

test('phase7: living marksmen sharpen towers; craftsmen do not', () => {
  const g = setup();
  const tower = makeBuilding('archer_tower', 5, 5, data);
  tower.remaining = 0;
  g.world.buildings.push(tower);
  const eye = makeUnit('archer', data, 0);
  eye.traits = ['marksman']; eye.jobXp = 0; eye.jobLevel = 1; eye.x = 5.5; eye.y = 5.5;
  g.world.troops.push(eye);
  assert.equal(towerCrewBonus(g.world), 0.02, 'one marksman spots +2%');
  for (let i = 0; i < 20; i++) {
    const extra = makeUnit('archer', data, i + 1);
    extra.traits = ['marksman']; extra.jobXp = 0; extra.jobLevel = 1;
    g.world.troops.push(extra);
  }
  assert.equal(towerCrewBonus(g.world), 0.2, 'tower bonus caps at +20%');
  g.world.enemies.push({id: 'e1', x: 5.5, y: 5.6, hp: 10000, maxHp: 10000, damage: 1, attackTimer: 0, animation: 0});
  const hp = g.world.enemies[0].hp;
  tickCombat(g.world, data, 0.05);
  const dealt = hp - g.world.enemies[0].hp;
  const tier = data.buildings.archer_tower.tiers[0];
  assert.ok(dealt >= tier.damage * 1.19, `tower hits with the marksman bonus (dealt ${dealt})`);
});

test('phase7: old saves migrate with identity intact and progress untouched', () => {
  const g = setup();
  g.recruit('farmer');
  const raw = JSON.parse(exportSave(g.state));
  raw.version = 9;
  for (const t of raw.world.troops) delete t.name, delete t.traits, delete t.jobXp, delete t.jobLevel, delete t.manualPost;
  const out = importSaveBlob(JSON.stringify(raw), data);
  assert.ok(out.ok, `migrates cleanly: ${out.error}`);
  assert.equal(out.state.version, VERSION);
  for (const t of out.state.world.troops) {
    assert.ok(t.name && typeof t.name === 'string', 'veteran named');
    assert.ok(Array.isArray(t.traits) && t.traits.length && t.traits.every(x => TRAITS[x]), 'crew tempered');
    assert.equal(t.jobXp, 0);
    assert.equal(t.jobLevel, 1);
    assert.equal(t.manualPost, false);
  }
  // Phase-8 v11 adds chain stores with quiet defaults on top of the
  // v10 identity backfill — old food/gold/wood still read untouched.
  assert.deepEqual(out.state.world.resources, {...raw.world.resources, lumber: 0, flour: 0, bread: 0}, 'stores untouched');
  assert.equal(out.state.world.buildings.length, raw.world.buildings.length, 'roofs untouched');
});

test('phase7: strong carriers deliver visibly fuller baskets', () => {
  const g = setup();
  const farm = g.world.buildings.find(b => b.type === 'farm');
  farm.remaining = 0;
  const hauler = makeUnit('farmer', data, 0);
  hauler.traits = ['strong']; hauler.jobXp = 0; hauler.jobLevel = 1;
  hauler.workplace = farm.id;
  hauler.x = farm.x + 0.5; hauler.y = farm.y + 0.5;
  hauler.carry = 0; hauler.phase = 'gather';
  g.world.troops.push(hauler);
  // Work until the basket is full and the hauler turns for home: a strong
  // back fills past the old 10-carry line (12.5) before turning.
  let guard = 0;
  while (hauler.phase !== 'return' && guard++ < 2000) tickEconomy(g.world, data, 0.25);
  assert.equal(hauler.phase, 'return', 'basket filled');
  assert.ok(hauler.carry > 10, `strong basket fills past the old 10-carry line (carry ${hauler.carry})`);
});
