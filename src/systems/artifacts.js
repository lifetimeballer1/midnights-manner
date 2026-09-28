// Phase 11 — Expedition finds: recovered artifacts and their permanent
// village bonuses. Leaf module on purpose: model.js (auras), expeditions.js
// (returns) and calendar.js (trade reader) all import from here, so this
// module imports nothing from them (no cycles). Everything is data-driven
// off data/artifacts.json; a missing table reads as "no finds", never a
// crash — old saves and data-light tests keep working.
export const MAX_INTEL_LOG = 8;
export const MAX_EXPEDITION_LOG = 6;
export const SCOUT_BONUS_CAP = 15;
export const SCOUT_BONUS_EACH = 5;

export function findsTable(data) {
  const t = data?.artifacts;
  if (!t || typeof t !== 'object') return null;
  return t;
}

// Validated artifact list: id, name, text and a bonus object whose keys
// all exist on the auras() accumulator and whose values are sane finite
// fractions. Unknown keys and nonsense values are dropped, never applied.
const BONUS_KEYS = ['damage', 'armor', 'gather', 'carry', 'build', 'discount', 'heal', 'xp', 'survey', 'food', 'plate', 'produce', 'beds', 'trade'];
export function artifactList(data) {
  const t = findsTable(data);
  const raw = Array.isArray(t?.artifacts) ? t.artifacts : [];
  const out = [];
  for (const a of raw) {
    if (!a || typeof a.id !== 'string' || !a.id || typeof a.name !== 'string' || !a.name) continue;
    const bonus = {};
    for (const [k, v] of Object.entries(a.bonus || {})) {
      if (BONUS_KEYS.includes(k) && Number.isFinite(v) && v > 0 && v <= 1) bonus[k] = v;
    }
    if (!Object.keys(bonus).length) continue;
    out.push({id: a.id, name: a.name, text: typeof a.text === 'string' ? a.text : '', bonus, weight: Number.isFinite(a.weight) && a.weight > 0 ? a.weight : 1});
  }
  return out;
}

export function ownedIds(world) {
  const list = Array.isArray(world?.artifacts) ? world.artifacts : [];
  return list.filter(id => typeof id === 'string');
}

// Summed permanent bonus from every owned, still-valid artifact. Pure:
// same shelf, same numbers, every call.
export function artifactBonus(world, data) {
  const out = {};
  const owned = new Set(ownedIds(world));
  if (!owned.size) return out;
  for (const a of artifactList(data)) {
    if (!owned.has(a.id)) continue;
    for (const [k, v] of Object.entries(a.bonus)) out[k] = (out[k] || 0) + v;
  }
  return out;
}

export function findChances(data) {
  const c = findsTable(data)?.chances || {};
  const num = (v, d) => Number.isFinite(v) && v >= 0 && v <= 1 ? v : d;
  return {rescue: num(c.rescue, 0.15), artifact: num(c.artifact, 0.07), intel: num(c.intel, 0.5)};
}

// Per-ranger knack for finding things: troops.json expedition `finds`
// multiplies every find chance (scouts are keen-eyed). Missing reads 1.
export function findsMult(data, unit) {
  const m = data?.troops?.[unit?.type]?.expedition?.finds;
  return Number.isFinite(m) && m > 0 ? m : 1;
}

// Weighted pick of one unowned artifact id, or null when the shelf is
// complete. rng is injectable for deterministic tests.
export function pickArtifact(world, data, rng = Math.random) {
  const owned = new Set(ownedIds(world));
  const pool = artifactList(data).filter(a => !owned.has(a.id));
  if (!pool.length) return null;
  const total = pool.reduce((n, a) => n + a.weight, 0);
  let r = (rng() || 0) * total;
  for (const a of pool) {
    r -= a.weight;
    if (r <= 0) return a.id;
  }
  return pool[pool.length - 1].id;
}

export function pickFrom(list, rng = Math.random) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor((rng() || 0) * list.length) % list.length];
}

// Rescue candidates: pool types that exist in troops.json and are not
// combat roles — rescued folk arrive as workers, never soldiers.
export function rescuePool(data) {
  const t = findsTable(data);
  const raw = Array.isArray(t?.rescuePool) ? t.rescuePool : [];
  return raw.filter(type => typeof type === 'string' && data?.troops?.[type] && data.troops[type].role !== 'combat');
}
