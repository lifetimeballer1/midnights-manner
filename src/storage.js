const KEY='midnights-manner-v2';
const OLD_KEY='midnights-manner-v1';
export const VERSION = 2;
// In-memory fallback when localStorage is missing (private mode, SSR, tests)
// or full (quota). Saves still work for the session; persist() warns.
const memFallback = new Map();
let lastSaveFallback = false;
export function saveUsedFallback() { return lastSaveFallback; }
function storeGet(k) {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(k);
  } catch { /* fall through to memory */ }
  return memFallback.has(k) ? memFallback.get(k) : null;
}
function storeSet(k, v) {
  try {
    if (typeof localStorage !== 'undefined') { localStorage.setItem(k, v); lastSaveFallback = false; return 'local'; }
  } catch { /* quota / denied — fall through */ }
  try { memFallback.set(k, v); lastSaveFallback = true; return 'memory'; }
  catch { lastSaveFallback = true; return 'none'; }
}
export function save(game) {
  let payload = '';
  try { payload = JSON.stringify({...game, version: VERSION}); }
  catch { return false; }
  const where = storeSet(KEY, payload);
  return where !== 'none';
}
// v1 -> v2: village-sim pass. Fills every new field with safe defaults;
// existing resources, buildings, troops, unlocks and progress are untouched.
function migrateV1toV2(value, data) {
  if (!value || typeof value !== 'object') return null;
  const world = value.world;
  if (world) {
    if (!world.bounds) world.bounds = {w:data.world.width,h:data.world.height};
    world.survey = world.survey ?? 0;
    world.childTimer = world.childTimer ?? 0;
    for (const b of world.buildings || []) {
      const spec = data.buildings[b.type];
      if (spec?.reserve && b.reserve == null) { b.reserve = spec.reserve; b.maxReserve = spec.reserve; }
    }
    for (const t of world.troops || []) {
      if (t.workplace === undefined) t.workplace = null;
      if (t.order === undefined) t.order = null;
    }
  }
  if (value.home) {
    for (const b of value.home.buildings || []) {
      const spec = data.buildings[b.type];
      if (spec?.reserve && b.reserve == null) { b.reserve = spec.reserve; b.maxReserve = spec.reserve; }
    }
    for (const t of value.home.troops || []) {
      if (t.workplace === undefined) t.workplace = null;
      if (t.order === undefined) t.order = null;
    }
    if (!value.home.bounds) value.home.bounds = {w:data.world.width,h:data.world.height};
    value.home.survey = value.home.survey ?? 0;
    value.home.childTimer = value.home.childTimer ?? 0;
  }
  if (!Array.isArray(value.questsCompleted)) value.questsCompleted = [];
  value.xp = Number.isFinite(value.xp) ? value.xp : 0;
  value.vlevel = Number.isFinite(value.vlevel) ? value.vlevel : 1;
  value.survey = value.survey ?? 0;
  value.version = 2;
  return value;
}
// Versioned migration registry — add future steps here, never wipe saves.
// Each entry maps version N -> function upgrading to N+1.
const MIGRATIONS = {1: migrateV1toV2};
export function migrate(value, data) {
  return migrateToLatest(value, data);
}
export function migrateToLatest(value, data) {
  if (!value || typeof value !== 'object') return null;
  let v = value.version || 1;
  if (v > VERSION) return null;
  let guard = 0;
  while (v < VERSION && guard++ < 10) {
    const step = MIGRATIONS[v];
    if (!step) return null; // unknown version — refuse rather than corrupt
    value = step(value, data);
    if (!value) return null;
    v = value.version;
  }
  return value;
}
export function peekVersion() {
  try {
    const raw = storeGet(KEY) || storeGet(OLD_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.version ?? 1;
  } catch { return null; }
}
export function load(data) {
 try {
  let raw = null;
  try { raw = storeGet(KEY) || storeGet(OLD_KEY); } catch { return null; }
  if (!raw) return null;
  let value = JSON.parse(raw);
  if (!value) return null;
  if ((value.version ?? 1) < VERSION) value = migrateToLatest(value, data);
  if (!value || value.version !== VERSION) return null;
  function valid(w){return w&&['wood','food','gold'].every(k=>Number.isFinite(w.resources?.[k])&&w.resources[k]>=0)&&Array.isArray(w.buildings)&&w.buildings.every(b=>data.buildings[b.type]&&Number.isInteger(b.level)&&b.level>=1&&b.level<=data.buildings[b.type].tiers.length&&Number.isFinite(b.hp)&&Number.isFinite(b.x)&&Number.isFinite(b.y))&&Array.isArray(w.troops)&&w.troops.every(t=>data.troops[t.type]&&data.items[t.gear]&&Number.isInteger(t.level)&&t.level>=1&&t.level<=data.troops[t.type].maxLevel&&Array.isArray(t.owned))&&Array.isArray(w.enemies)&&Array.isArray(w.effects);}
  if(!valid(value.world)||!Array.isArray(value.completed)||!Array.isArray(value.unlocks))return null;
  if(value.mission&&(!valid(value.home)||!data.missions.some(m=>m.id===value.mission.id)))return null;
  if(!Array.isArray(value.questsCompleted)||!Number.isFinite(value.xp))return null;
  return value;
 }catch{return null;}
}
