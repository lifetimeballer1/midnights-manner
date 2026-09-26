import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeUnit, unlockedAbilities, levelForXp} from '../src/model.js';
import {tickVillage, gainXp, growthStatus, CHILD_SECONDS} from '../src/systems/village.js';
import {Game} from '../src/game.js';
const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'levels'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const noop = () => {};

test('1. XP ladder: every level 2-7 pays a data-driven cache; quest XP reaches level 5 with more to earn', () => {
  const total = data.quests.reduce((n, q) => n + q.xp, 0);
  assert.ok(total > 0);
  const reached = levelForXp(total);
  assert.ok(reached >= 5, `quests total ${total} XP should reach at least level 5 (got ${reached})`);
  for (let lvl = 2; lvl <= 7; lvl++) {
    const entry = data.levels.find(l => l.level === lvl);
    assert.ok(entry, `levels.json covers level ${lvl}`);
    assert.ok(entry.rewards && Object.keys(entry.rewards).length > 0, `level ${lvl} pays out`);
  }
  // Level-up actually grants the cache, even across a multi-level jump.
  const g = new Game(data);
  g.world.resources = {food: 500, wood: 500, gold: 500};
  const before = {...g.world.resources};
  gainXp(g.state, 600);
  g.tick(.05);
  assert.ok((g.state.vlevel || 1) >= 5);
  assert.ok(g.world.resources.wood > before.wood - 1 && g.world.resources.gold >= before.gold, 'caches landed');
  const l5 = data.levels.find(l => l.level === 5).rewards;
  assert.ok(g.world.resources.wood >= before.wood + (l5.wood || 0) - 5, 'level-5 wood cache granted');
});

test('2. role kits: combat cleaves, farmers never do; keepers mend, builders never splash', () => {
  const kit = id => { const u = makeUnit(id, data); u.level = 25; return unlockedAbilities(u, data).map(a => a.id); };
  for (const id of ['warrior', 'archer', 'warden', 'ranger']) assert.ok(kit(id).includes('cleave'), `${id} cleaves`);
  for (const id of ['farmer', 'miner', 'fisherman', 'shepherd', 'lumberjack', 'butcher', 'forager'])
    assert.ok(!kit(id).includes('cleave') && !kit(id).some(k => data.abilities[k].effect === 'splash'), `${id} never cleaves`);
  for (const id of ['builder', 'mason'])
    assert.ok(!kit(id).some(k => data.abilities[k].effect === 'splash'), `${id} never splashes`);
  for (const id of ['scholar', 'scout', 'healer', 'weaponsmith', 'armorer', 'toolsmith', 'leatherworker'])
    assert.ok(!kit(id).some(k => data.abilities[k].effect === 'splash'), `${id} never splashes`);
  // Four distinct kits, all effects from the pre-existing set.
  const sig = ids => kit(ids[0]).join(',');
  const kits = new Set([sig(['warrior']), sig(['miner']), sig(['scholar']), sig(['builder'])]);
  assert.equal(kits.size, 4, 'combat/collector/keeper/builder kits differ');
  for (const [id, t] of Object.entries(data.troops))
    for (const ab of Object.values(t.abilities)) {
      assert.ok(data.abilities[ab], `${id} ability ${ab} resolves`);
      assert.ok(['splash', 'armor', 'heal', 'damage', 'gather'].includes(data.abilities[ab].effect), `${ab} uses an existing effect`);
    }
});

test('3. first harvest unlocks a real defense (trap), not the free tower', () => {
  const m = data.missions.find(m => m.id === 'first-harvest');
  assert.ok(m.unlocks.includes('trap'), 'first clear teaches traps');
  assert.ok(!m.unlocks.includes('tower'), 'dead tower unlock is gone');
  assert.ok(data.world.locked.includes('trap'), 'trap is genuinely locked until earned');
});

test('4. ember-road unlocks the watchfire it showcases; moonwell unlocks the grove it plants', () => {
  const ember = data.missions.find(m => m.id === 'ember-road');
  const moon = data.missions.find(m => m.id === 'moonwell');
  assert.ok(ember.map.buildings.some(b => b.type === 'watchfire'));
  assert.ok(ember.unlocks.includes('watchfire'));
  assert.ok(moon.map.buildings.some(b => b.type === 'grove'));
  assert.ok(moon.map.troops.includes('forager'));
  assert.ok(moon.unlocks.includes('grove'));
});

test('5. east-field measures undone work, never auto-completes at level 4', () => {
  const q = data.quests.find(q => q.id === 'east-field');
  assert.notEqual(q.task.kind, 'level', 'no more reach-level-3 gate');
  assert.equal(q.task.kind, 'gather');
  // A mid-game village (440 XP = level 4, old gate would already be done)
  // still has east-field ahead of it with zero wood hauled.
  const g = new Game(data);
  g.state.xp = 440; g.state.vlevel = levelForXp(440);
  assert.ok(g.state.vlevel >= 4, 'mid-game level');
  g.world.gathered = {wood: 0, food: 0, gold: 0};
  const have = Math.floor(g.world.gathered[q.task.resource] || 0);
  assert.ok(have < q.task.amount, `0/${q.task.amount} wood hauled — real work remains`);
  assert.ok(!g.state.questsCompleted.includes('east-field'));
});

test('6. starvation decays growth progress like crowding; HUD surfaces it', () => {
  const g = new Game(data);
  g.world.resources = {food: 500, wood: 500, gold: 500};
  g.world.childTimer = 60;
  g.world.resources.food = 0;
  for (let i = 0; i < 20; i++) tickVillage(g.state, data, .05, noop);
  assert.ok(g.world.childTimer > 0 && g.world.childTimer < 60, `decays instead of resetting (got ${g.world.childTimer})`);
  const st = growthStatus(g.state, data);
  assert.ok(st.pct >= 0 && st.pct <= 100);
  assert.ok(typeof st.note === 'string' && st.note.length > 0, 'HUD has a plain-word reason');
  assert.equal(CHILD_SECONDS, 75);
});

test('7. growth rotation spans combat, keepers and healers past the early economy', () => {
  const g = new Game(data);
  g.world.resources = {food: 10000, wood: 10000, gold: 10000};
  const seen = new Set(g.world.troops.map(t => t.type));
  // Simulate 20 births by cycling the roster-size index the sim uses.
  const order = [];
  for (let n = 5; n < 25; n++) {
    const w = createWorld(data);
    for (let c = 0; c < 6; c++) w.buildings.push({id: 'c' + c, type: 'cottage', x: 2, y: 2, level: 1, hp: 200, remaining: 0});
    w.troops = Array.from({length: n}, (_, i) => makeUnit('farmer', data, i));
    w.resources = {food: 500, wood: 500, gold: 500};
    w.childTimer = CHILD_SECONDS - 0.01;
    tickVillage({world: w, xp: 600, vlevel: 5, questsCompleted: data.quests.map(q => q.id)}, data, 0.05, noop);
    const born = w.troops[w.troops.length - 1].type;
    order.push(born); seen.add(born);
  }
  assert.ok(order.slice(0, 3).every(t => ['lumberjack', 'farmer', 'miner', 'fisherman', 'shepherd'].includes(t)), 'early births stay on food and timber');
  assert.ok(seen.has('archer') || seen.has('warrior'), 'combat joins the rotation');
  assert.ok(seen.has('healer') || seen.has('scout') || seen.has('scholar'), 'keepers join the rotation');
  assert.ok(seen.size > 4, `rotation wider than 4 (saw ${seen.size})`);
});
