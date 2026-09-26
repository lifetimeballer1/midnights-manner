import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {createWorld, makeUnit, makeBuilding, canPlace, inBounds, auras, housing, assignmentValid, gatherBonus, levelForXp, START_BOUNDS} from '../src/model.js';
import {tickEconomy, reserveMult} from '../src/systems/economy.js';
import {tickVillage, currentQuest, questProgress, gainXp} from '../src/systems/village.js';
import {migrate} from '../src/storage.js';
import {Game} from '../src/game.js';
const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const noop = () => {};

test('village data: workplaces, jobs, gear and quest chain all resolve', async () => {
  assert.ok(data.quests.length >= 8);
  for (const q of data.quests) {
    assert.ok(q.id && q.name && q.text && Number.isFinite(q.xp));
    assert.ok(['build', 'recruit', 'assign', 'population', 'level', 'gather'].includes(q.task.kind), q.id);
    if (q.task.kind === 'build') assert.ok(data.buildings[q.task.type], q.id);
    if (q.task.kind === 'recruit') assert.ok(data.troops[q.task.type], q.id);
  }
  for (const [id, t] of Object.entries(data.troops)) {
    if (!t.job) continue;
    assert.ok(data.buildings[t.job.workplace], `${id} workplace`);
    assert.equal(data.buildings[t.job.workplace].workplace, id, `${id} workplace hosts back`);
    assert.ok(data.items[t.defaultGear], `${id} gear`);
  }
  const sprites = [];
  for (const b of Object.values(data.buildings)) for (const tier of b.tiers) sprites.push(tier.sprite);
  for (const t of Object.values(data.troops)) sprites.push(t.sprite);
  assert.equal(new Set(sprites).size, sprites.length);
  for (const name of sprites) await access(new URL(`../assets/sprites/${name}`, import.meta.url));
});

test('new villages start small; old saves keep the full map', () => {
  const w = createWorld(data);
  assert.deepEqual(w.bounds, START_BOUNDS);
  assert.equal(inBounds(w, data, 'farm', 2, 2), true);
  assert.equal(inBounds(w, data, 'farm', 13, 9), false);
  assert.equal(canPlace(w, data, 'farm', 13, 9), false);
});

test('roomy buildings keep a breathing gap; walls tuck in anywhere', () => {
  const w = createWorld(data); // hall sits at 9,7 (2x2)
  assert.equal(canPlace(w, data, 'farm', 11, 7), false); // hugs the hall
  assert.equal(canPlace(w, data, 'farm', 2, 2), true); // open grass
  assert.equal(canPlace(w, data, 'wall', 11, 7), true); // walls exempt
  assert.equal(canPlace(w, data, 'cottage', 9, 7), false); // overlap still rejected
});

test('job assignment validates profession, building state and capacity', () => {
  const g = new Game(data);
  g.world.resources = {food: 10000, wood: 10000, gold: 10000};
  const pond = g.build('pond', 2, 2);
  assert.ok(pond);
  for (let i = 0; i < 100; i++) g.tick(.05); // finish construction
  g.recruit('fisherman');
  g.recruit('miner');
  const fisher = g.world.troops.find(t => t.type === 'fisherman');
  const miner = g.world.troops.find(t => t.type === 'miner');
  assert.equal(g.assign(fisher.id, pond.id), true);
  assert.equal(fisher.workplace, pond.id);
  assert.equal(g.assign(miner.id, pond.id), undefined); // wrong profession refused
  assert.equal(miner.workplace, null);
  assert.equal(g.assign(fisher.id, null), true); // resting clears the post
  assert.equal(assignmentValid(g.world, data, fisher, pond), true);
  pond.hp = 0;
  assert.equal(assignmentValid(g.world, data, fisher, pond), false); // ruins hire nobody
});

test('assigned smiths sharpen and plate the whole village (capped)', () => {
  const w = createWorld(data);
  w.resources = {food: 10000, wood: 10000, gold: 10000};
  assert.equal(auras(w, data).damage, 0);
  const forge = makeBuilding('forge', 2, 2, data); forge.remaining = 0;
  const armory = makeBuilding('armory', 4, 2, data); armory.remaining = 0;
  w.buildings.push(forge, armory);
  const s1 = makeUnit('weaponsmith', data); s1.workplace = forge.id;
  const s2 = makeUnit('weaponsmith', data); s2.workplace = forge.id;
  const a1 = makeUnit('armorer', data); a1.workplace = armory.id;
  w.troops.push(s1, s2, a1);
  const a = auras(w, data);
  assert.ok(Math.abs(a.damage - 0.2) < 1e-9);
  assert.ok(Math.abs(a.armor - 0.1) < 1e-9);
});

test('fishermen need a pond; with one, catches land as food', () => {
  const w = createWorld(data);
  const fisher = makeUnit('fisherman', data);
  fisher.x = 9; fisher.y = 9; fisher.carry = 0;
  w.troops.push(fisher);
  const before = w.resources.food;
  for (let i = 0; i < 200; i++) tickEconomy(w, data, .05); // farms only
  const farmOnly = w.resources.food;
  assert.ok(farmOnly >= before);
  const pond = makeBuilding('pond', 2, 2, data); pond.remaining = 0;
  w.buildings.push(pond);
  fisher.workplace = pond.id;
  fisher.x = 3; fisher.y = 3;
  for (let i = 0; i < 1200; i++) tickEconomy(w, data, .05);
  assert.ok(w.resources.food > farmOnly + 20, 'pond catches should beat passive farm income');
});

test('quest walkthrough pays XP and rewards in order', () => {
  const g = new Game(data);
  g.world.resources = {food: 10000, wood: 10000, gold: 10000};
  assert.equal(currentQuest(g.state, data).id, 'second-field');
  const q0 = questProgress(currentQuest(g.state, data).task, g.state);
  assert.equal(q0.have, 1); // starting farm counts
  const farm = g.build('farm', 2, 2);
  assert.ok(farm);
  g.tick(.05);
  assert.ok(g.state.questsCompleted.includes('second-field'));
  assert.ok(g.state.xp >= 60);
  assert.equal(currentQuest(g.state, data).id, 'still-water');
});

test('village levels open new rows automatically', () => {
  const g = new Game(data);
  assert.deepEqual(g.world.bounds, START_BOUNDS);
  gainXp(g.state, 250);
  g.tick(.05);
  assert.ok((g.state.vlevel || 1) >= 3);
  assert.ok(g.world.bounds.w >= 18 && g.world.bounds.h >= 14);
  assert.equal(canPlace(g.world, data, 'farm', 15, 11), true);
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(100), 2);
});

test('spare food plus free beds grows a villager; hunger and crowding pause it', () => {
  const g = new Game(data);
  g.world.resources = {food: 500, wood: 500, gold: 500};
  const n0 = g.world.troops.length;
  for (let i = 0; i < 2400; i++) tickVillage(g.state, data, .05, noop); // 120s, no cottage
  assert.equal(g.world.troops.length, n0); // no beds, no kids
  const cottage = g.build('cottage', 11, 3);
  assert.ok(cottage);
  for (let i = 0; i < 200; i++) g.tick(.05); // raise the roof
  const {beds} = housing(g.world, data);
  assert.ok(beds >= 3);
  g.world.childTimer = 74.9;
  const n1 = g.world.troops.length;
  for (let i = 0; i < 6; i++) g.tick(.05); // cross the 75s line
  assert.equal(g.world.troops.length, n1 + 1);
  assert.ok(g.world.effects.some(e => e.kind === 'fanfare')), 'birth should be a celebration';
  for (let i = 0; i < 34; i++) g.tick(.05);
  // Starvation pauses growth.
  g.world.resources.food = 0;
  g.world.childTimer = 74;
  const n2 = g.world.troops.length;
  for (let i = 0; i < 40; i++) g.tick(.05);
  assert.equal(g.world.troops.length, n2);
});

test('nodes drain visibly as worked and breathe back when rested', () => {
  const w = createWorld(data);
  w.troops = [];
  const farm = w.buildings.find(b => b.type === 'farm');
  farm.remaining = 0;
  assert.equal(farm.reserve, 400);
  for (let i = 0; i < 100; i++) tickEconomy(w, data, .05); // 5s passive
  assert.ok(farm.reserve < 400, 'harvest should drain the node');
  assert.equal(reserveMult(farm) < 1, true);
  const tapped = makeBuilding('farm', 2, 2, data);
  tapped.remaining = 0; tapped.reserve = 1;
  const full = makeBuilding('farm', 13, 2, data);
  full.remaining = 0;
  const wt = createWorld(data); wt.troops = []; wt.buildings = [tapped, full];
  wt.buildings.push(makeBuilding('hall', 9, 7, data));
  const f0 = wt.resources.food;
  for (let i = 0; i < 20; i++) tickEconomy(wt, data, .05);
  assert.ok(tapped.reserve > 1, 'rested nodes regenerate');
  // A tapped node yields less than a full one over the same second.
  const a = createWorld(data); a.troops = []; a.buildings = [makeBuilding('farm', 2, 2, data), makeBuilding('hall', 9, 7, data)];
  a.buildings[0].remaining = 0; a.buildings[0].reserve = 1;
  const b = createWorld(data); b.troops = []; b.buildings = [makeBuilding('farm', 2, 2, data), makeBuilding('hall', 9, 7, data)];
  b.buildings[0].remaining = 0;
  const fa = a.resources.food, fb = b.resources.food;
  for (let i = 0; i < 20; i++) { tickEconomy(a, data, .05); tickEconomy(b, data, .05); }
  assert.ok(b.resources.food - fb > a.resources.food - fa, 'full nodes out-produce tapped ones');
});

test('v1 saves migrate to v2 with progress intact', () => {
  const w = createWorld(data);
  delete w.bounds; delete w.survey; delete w.childTimer;
  for (const b of w.buildings) { delete b.reserve; delete b.maxReserve; }
  for (const t of w.troops) delete t.workplace;
  const old = {version: 1, world: w, home: null, mission: null, completed: ['first-harvest'], unlocks: ['tower'], xp: undefined, questsCompleted: undefined};
  const wood = w.resources.wood, troops = w.troops.length;
  const out = migrate(structuredClone(old), data);
  assert.equal(out.version, 2);
  assert.deepEqual(out.bounds ?? out.world.bounds, {w: 20, h: 16}); // veterans keep the whole map
  assert.equal(out.world.resources.wood, wood);
  assert.equal(out.world.troops.length, troops);
  assert.deepEqual(out.completed, ['first-harvest']);
  assert.equal(out.xp, 0);
  assert.deepEqual(out.questsCompleted, []);
  assert.ok(out.world.buildings.every(b => !data.buildings[b.type].reserve || b.reserve > 0));
});

test('assigned collectors gather faster at their matched source', () => {
  const w = createWorld(data);
  const pond = makeBuilding('pond', 2, 2, data); pond.remaining = 0;
  w.buildings.push(pond);
  const free = makeUnit('fisherman', data);
  const posted = makeUnit('fisherman', data);
  posted.workplace = pond.id;
  assert.equal(gatherBonus(free, w, data), 1);
  assert.equal(gatherBonus(posted, w, data), 1.25);
});
