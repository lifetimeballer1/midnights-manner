// Perf regression: heavy villages must tick fast AND deterministically.
// Same posts filled, same production, same combat — two identical villages
// ticked identically must stay identical, and a heavy raid tick must fit
// well inside a generous wall-clock budget (catches order-of-magnitude
// regressions like per-cell building scans or per-troop sorts).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeUnit, makeBuilding} from '../src/model.js';
import {tickVillagerJobs, autoAssign} from '../src/systems/villagers.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickCombat, spawnRaid} from '../src/systems/combat.js';
import {tickEmergency} from '../src/systems/emergency.js';
import {tickExpeditions} from '../src/systems/expeditions.js';
import {tickVillage} from '../src/systems/village.js';
import {tickResearch} from '../src/systems/research.js';
import {tickRefine, tickCraft} from '../src/systems/crafting.js';

const names = ['world','troops','items','abilities','buildings','missions','quests','levels','rumors','names','legends','calendar','traders','biomes','expansion'];
const data = Object.fromEntries(await Promise.all(names.map(async n => {
  try { return [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))]; }
  catch { return [n, {}]; }
})));

const WORKERS = ['farmer','miner','lumberjack','builder','scholar','fisherman','forager','mason','sawyer','miller'];
const SHOPS = [['farm',4,4],['mine',8,4],['lumber',12,4],['forge',4,8],['workshop',8,8],['barracks',12,8],['tower',6,6],['tower',10,10],['cottage',2,10],['pasture',14,10],['pond',16,6],['sawmill',6,12],['smeltery',10,12],['chapel',14,12],['market',16,10],['wall',3,3],['wall',3,4],['wall',3,5],['gate',3,6],['archer_tower',12,12]];

function heavyVillage(nTroops = 120, raid = false) {
  const w = createWorld(data);
  w.elapsed = 400;
  for (let i = 0; i < SHOPS.length; i++) {
    const [t, x, y] = SHOPS[i];
    try { w.buildings.push(makeBuilding(t, Math.min(data.world.width - 3, x), y, data)); } catch {}
  }
  const shops = w.buildings.filter(b => data.buildings[b.type]?.workplace);
  for (let i = 0; i < nTroops; i++) {
    const combat = i % 4 === 0;
    const type = combat ? (i % 8 === 0 ? 'archer' : 'warrior') : WORKERS[i % WORKERS.length];
    const u = makeUnit(type, data, i);
    u.level = 3 + (i % 8);
    u.x = 4 + (i % 20); u.y = 4 + (Math.floor(i / 20) % 10);
    u.name = 'Perf' + i; u.traits = ['hard_worker']; u.jobXp = 0; u.jobLevel = 1; u.manualPost = false;
    if (!combat && shops.length) {
      const job = data.troops[type]?.job;
      const site = shops.find(b => b.type === (job?.workplace || '###'));
      if (site && job) u.workplace = site.id;
    }
    w.troops.push(u);
  }
  if (raid) spawnRaid(w, 10, null, data, null);
  return w;
}

function fullTick(w, state) {
  tickResearch(state, data, 0.05, () => {});
  tickEmergency(w, data, 0.05);
  tickVillagerJobs(w, data, 0.05);
  tickEconomy(w, data, 0.05);
  tickRefine(w, data, 0.05);
  for (const c of tickCraft(w, data, 0.05)) void c;
  tickExpeditions(w, data, 0.05);
  tickCombat(w, data, 0.05);
  tickVillage(state, data, 0.05, () => {});
}

function stateFor(w) {
  return {world: w, mission: null, xp: 0, vlevel: 1, completed: [], questsCompleted: [], tradeDay: ''};
}

// IDs (randomUUIDs) and visual effects carry no gameplay meaning — project
// everything else with cross-references rewritten to stable indexes.
function project(w) {
  const ids = new Map();
  w.buildings.forEach((b, i) => ids.set(b.id, 'b' + i));
  w.troops.forEach((t, i) => ids.set(t.id, 't' + i));
  w.enemies.forEach((e, i) => ids.set(e.id, 'e' + i));
  const ref = id => id == null ? null : (ids.get(id) ?? 'ext');
  const clean = v => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, val] of Object.entries(v)) {
        if (k === 'id') continue;
        if (k === 'effects') continue;
        if (k === 'workplace' || k === 'target' || k === 'targetId') o[k] = ref(val);
        else o[k] = clean(val);
      }
      return o;
    }
    return v;
  };
  return clean({resources: w.resources, gathered: w.gathered, troops: w.troops, buildings: w.buildings, enemies: w.enemies, wave: w.wave, raidKills: w.raidKills, raidLoot: w.raidLoot, elapsed: w.elapsed});
}

test('perf: heavy raid ticks are deterministic (same outcomes every run)', () => {
  const a = heavyVillage(120, true), b = heavyVillage(120, true);
  // Construction is deterministic apart from UUIDs — align them positionally
  // so cross-references (workplaces, targets) resolve identically.
  const bIdMap = new Map();
  a.buildings.forEach((x, i) => { bIdMap.set(b.buildings[i].id, x.id); b.buildings[i].id = x.id; });
  a.troops.forEach((t, i) => { b.troops[i].id = t.id; });
  a.enemies.forEach((e, i) => { if (b.enemies[i]) b.enemies[i].id = e.id; });
  for (const t of b.troops) if (t.workplace != null && bIdMap.has(t.workplace)) t.workplace = bIdMap.get(t.workplace);
  const sa = stateFor(a), sb = stateFor(b);
  for (let i = 0; i < 30; i++) { fullTick(a, sa); fullTick(b, sb); }
  assert.deepEqual(project(a), project(b));
});

test('perf: heavy raid + peace ticks fit the time budget', () => {
  const w = heavyVillage(150, true), s = stateFor(w);
  const t0 = performance.now();
  for (let i = 0; i < 25; i++) fullTick(w, s);
  const raidMs = performance.now() - t0;
  const p = heavyVillage(150, false), ps = stateFor(p);
  const t1 = performance.now();
  for (let i = 0; i < 25; i++) fullTick(p, ps);
  const peaceMs = performance.now() - t1;
  assert.ok(raidMs < 6000, `25 heavy raid ticks took ${raidMs.toFixed(0)}ms (budget 6000ms)`);
  assert.ok(peaceMs < 6000, `25 heavy peace ticks took ${peaceMs.toFixed(0)}ms (budget 6000ms)`);
  for (const u of w.troops) assert.ok(Number.isFinite(u.hp), 'troop hp stays finite');
  for (const v of Object.values(w.resources)) assert.ok(Number.isFinite(v), 'resources stay finite');
});

test('perf: auto-assign fills the same posts with crew counts indexed', () => {
  const w = heavyVillage(60, false);
  for (const t of w.troops) { t.workplace = null; t.manualPost = false; }
  const placed = autoAssign(w, data);
  assert.ok(placed > 0, 'idle hands find posts');
  for (const t of w.troops) {
    if (!t.workplace) continue;
    assert.ok(w.buildings.some(b => b.id === t.workplace), 'every post is a real building');
  }
});
