const KEY='midnights-manner-v2';
const OLD_KEY='midnights-manner-v1';
export const VERSION = 6;
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
// v2 -> v3: living-world layer (calendar + Grey Markets). Every new key is
// optional with a sane default; old saves load untouched and ring the night
// bell once on their next visit. Never wipes: unknown shapes fall back to
// defaults, resources/buildings/troops/progress are never touched.
function migrateV2toV3(value, data) {
  if (!value || typeof value !== 'object') return null;
  if (value.tradeDay === undefined) value.tradeDay = null;
  if (!value.tradesUsed || typeof value.tradesUsed !== 'object' || Array.isArray(value.tradesUsed)) value.tradesUsed = {};
  if (value.calendarDay === undefined) value.calendarDay = null;
  if (value.gatheredAtBell !== undefined && (typeof value.gatheredAtBell !== 'object' || value.gatheredAtBell === null)) value.gatheredAtBell = null;
  value.version = 3;
  return value;
}
// v3 -> v4: scheduled home raids + unlock re-deal. Old saves get a raid
// clock that starts fresh (one full interval of peace, never an instant
// horn), and anyone who already cleared timber-line / last-stand gains the
// new axe / toolkit unlocks their victories now earn. Additive only:
// resources, buildings, troops and progress are never touched or removed.
function migrateV3toV4(value, data) {
  if (!value || typeof value !== 'object') return null;
  const cfg = data.world.homeRaids || {};
  const firstAt = Number.isFinite(cfg.firstAt) ? cfg.firstAt : 300;
  const interval = Number.isFinite(cfg.interval) ? cfg.interval : 240;
  for (const key of ['world', 'home']) {
    const w = value[key];
    if (!w || typeof w !== 'object') continue;
    if (!Number.isFinite(w.nextRaidAt)) {
      const elapsed = Number.isFinite(w.elapsed) ? w.elapsed : 0;
      w.nextRaidAt = elapsed >= firstAt ? elapsed + interval : firstAt;
    }
  }
  if (Array.isArray(value.completed) && Array.isArray(data.missions)) {
    const earned = [];
    for (const id of value.completed) {
      const m = data.missions.find(m => m.id === id);
      if (m && Array.isArray(m.unlocks)) earned.push(...m.unlocks);
    }
    if (!Array.isArray(value.unlocks)) value.unlocks = [];
    value.unlocks = [...new Set([...value.unlocks, ...earned])];
  }
  value.version = 4;
  return value;
}
// v4 -> v5: armor-slot wardrobe (Act V). Every troop gains armor/armorOwned;
// old saves backfill empty wardrobes — gear, resources, progress untouched.
function migrateV4toV5(value, data) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['world', 'home']) {
    const w = value[key];
    if (!w || typeof w !== 'object') continue;
    for (const t of w.troops || []) {
      if (t.armor === undefined) t.armor = null;
      if (!Array.isArray(t.armorOwned)) t.armorOwned = [];
    }
  }
  value.version = 5;
  return value;
}
// v5 -> v6: Act VIII Legends (prestige stars, Last Watch oath, cairn roll,
// moon-dial season). Every new key backfills a quiet default; gear,
// resources, buildings, troops and progress are never touched or removed.
function migrateV5toV6(value, data) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['world', 'home']) {
    const w = value[key];
    if (!w || typeof w !== 'object') continue;
    for (const t of w.troops || []) {
      if (!Number.isFinite(t.prestigeStars)) t.prestigeStars = 0;
      if (t.oath === undefined) t.oath = false;
    }
    if (!Array.isArray(w.fallen)) w.fallen = [];
  }
  value.version = 6;
  return value;
}
// Versioned migration registry — add future steps here, never wipe saves.
// Each entry maps version N -> function upgrading to N+1.
const MIGRATIONS = {1: migrateV1toV2, 2: migrateV2toV3, 3: migrateV3toV4, 4: migrateV4toV5, 5: migrateV5toV6};
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
export function validateSave(value, data) {
  function valid(w){return w&&['wood','food','gold'].every(k=>Number.isFinite(w.resources?.[k])&&w.resources[k]>=0)&&Array.isArray(w.buildings)&&w.buildings.every(b=>data.buildings[b.type]&&Number.isInteger(b.level)&&b.level>=1&&b.level<=data.buildings[b.type].tiers.length&&Number.isFinite(b.hp)&&Number.isFinite(b.x)&&Number.isFinite(b.y))&&Array.isArray(w.troops)&&w.troops.every(t=>data.troops[t.type]&&data.items[t.gear]&&(!t.armor||data.items[t.armor])&&Number.isInteger(t.level)&&t.level>=1&&t.level<=data.troops[t.type].maxLevel&&Array.isArray(t.owned))&&Array.isArray(w.enemies)&&Array.isArray(w.effects);}
  if(!value||typeof value!=='object')return false;
  if(!valid(value.world)||!Array.isArray(value.completed)||!Array.isArray(value.unlocks))return false;
  if(value.mission&&(!valid(value.home)||!data.missions.some(m=>m.id===value.mission.id)))return false;
  if(!Array.isArray(value.questsCompleted)||!Number.isFinite(value.xp))return false;
  return true;
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
  if(!validateSave(value,data))return null;
  return value;
 }catch{return null;}
}
// Phase D: portable save blob for moving between devices. Never wipes:
// bad blobs fail with a readable message, and imports run the same
// versioned migrations as local loads.
export function exportSave(state) {
  try { return JSON.stringify({...state, version: VERSION}); }
  catch { return null; }
}
export function importSaveBlob(text, data) {
  let value = null;
  try { value = JSON.parse(text); }
  catch { return {ok:false, error:'That text is not a village save — import needs the exact text from Export.'}; }
  if (!value || typeof value !== 'object') return {ok:false, error:'That text is not a village save — import needs the exact text from Export.'};
  const v = value.version ?? 1;
  if (v > VERSION) return {ok:false, error:`This save is version ${v}, but this village reads up to version ${VERSION}. Update the game, then import again.`};
  if (v < VERSION) value = migrateToLatest(value, data);
  if (!value || value.version !== VERSION) return {ok:false, error:`Could not migrate this save (version ${v}) to version ${VERSION}. It may be from an incompatible build.`};
  if (!validateSave(value, data)) return {ok:false, error:'This save failed validation — a building, troop or mission in it is unknown. Nothing was changed.'};
  return {ok:true, state:value};
}
