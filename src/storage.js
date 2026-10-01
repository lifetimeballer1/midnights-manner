import {normalizeOutputs} from './systems/refiner-output.js';
import {normalizeRoads} from './systems/roads.js';
import {normalizeTrails} from './systems/trails.js';
import {ensureIdentity} from './systems/villagers.js';
import {buildTiles} from './systems/biomes.js';
import {mealDay} from './systems/food.js';
const KEY='midnights-manner-v2';
const OLD_KEY='midnights-manner-v1';
export const VERSION = 15;
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
// Routes, interior occupancy and builder motion are recomputed after loading.
function managementReplacer(key,value){return ['shelteredIn','builderTask','defenseIntent'].includes(key)?undefined:value;}
function normalizeManagement(w,data){
 if(w.automation!==undefined){
  const c=w.automation&&typeof w.automation==='object'&&!Array.isArray(w.automation)?w.automation:{};
  const reserves={};for(const k of Object.keys(w.resources||{})){const n=c.reserves?.[k];if(Number.isFinite(n)&&n>=0)reserves[k]=Math.min(1e9,Math.floor(n));}
  w.automation={autoUpgrade:c.autoUpgrade===true,reserves,stockTarget:Number.isFinite(c.stockTarget)?Math.max(0,Math.min(5,Math.floor(c.stockTarget))):1};
 }
 const ids=new Set(w.buildings.map(b=>b.id));
 for(const b of w.buildings){
  for(const k of ['autoCraft','autoUpgrade'])if(b[k]!==undefined&&typeof b[k]!=='boolean')delete b[k];
  if(b.autoUpgradeMaxTier!==undefined){if(Number.isFinite(b.autoUpgradeMaxTier))b.autoUpgradeMaxTier=Math.max(1,Math.min(data.buildings[b.type].tiers.length,Math.floor(b.autoUpgradeMaxTier)));else delete b.autoUpgradeMaxTier;}
 }
 for(const u of w.troops){
  delete u.shelteredIn;delete u.builderTask;delete u.defenseIntent;
  if(u.defensePost!=null&&(!ids.has(u.defensePost)||data.troops[u.type].role!=='combat')){delete u.defensePost;delete u.manualDefensePost;}
  if(u.manualDefensePost!==undefined&&typeof u.manualDefensePost!=='boolean')delete u.manualDefensePost;
 }
}
export function save(game) {
  let payload = '';
  try { payload = JSON.stringify({...game, version: VERSION},managementReplacer); }
  catch { return false; }
  const where = storeSet(KEY, payload);
  return where !== 'none';
}
// v1 -> v2: village-sim pass. Fills every new field with safe defaults;
// existing resources, buildings, troops, unlocks and progress are untouched.
function migrateV1toV2(value, data) {
  if (!value || typeof value !== 'object') return null;
  // Frontier grid (Phase 2): veterans keep the homestead-scale bounds
  // (20x17 legacy, never the whole 40x34 grid) so settled land stays
  // claimed and the new wilderness waits to be bought, never gifted.
  const hs = data.expansion?.homestead;
  const legacyBounds = () => ({w: Math.min(data.world.width, Number.isFinite(hs?.w) ? hs.w : 20), h: Math.min(data.world.height, Number.isFinite(hs?.h) ? hs.h : 17)});
  const world = value.world;
  if (world) {
    if (!world.bounds) world.bounds = legacyBounds();
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
    if (!value.home.bounds) value.home.bounds = legacyBounds();
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
// v6 -> v7: phantom-null cleanup. Collector crews with no gather resource
// (the butcher) used to walk a gather loop and pour into resources[null],
// which the stores panel reads back as a "null" row. The loop and
// addResource are now guarded, and any banked phantom pays out once to
// gold, then the key is gone. Saves otherwise untouched.
function migrateV6toV7(value, data) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['world', 'home']) {
    const w = value[key];
    if (!w || typeof w !== 'object') continue;
    for (const bucket of [w.resources, w.gathered]) {
      if (!bucket || typeof bucket !== 'object') continue;
      const phantom = bucket['null'];
      if (Number.isFinite(phantom) && phantom !== 0) bucket.gold = (bucket.gold || 0) + phantom;
      delete bucket['null'];
    }
  }
  value.version = 7;
  return value;
}
// v7 -> v8: tap-reserve rebalance (Jesce 2026-09-27). Base capacity 40 -> 500
// with per-tier growth (data `harvest.perTier`, default one base per tier).
// Old reserves (<=40) already fit the new caps, so nothing is lost — this
// step only sanitizes: finite numbers, no negatives, clamped into the
// level-aware cap so hand-edited or very old saves can never overfill.
// Additive only: resources, buildings, troops and progress never touched.
function migrateV7toV8(value, data) {
  if (!value || typeof value !== 'object') return null;
  const capFor = (b) => {
    const spec = data?.buildings?.[b?.type];
    if (!spec?.production) return null;
    const h = spec.harvest || {};
    const lvl = Number.isInteger(b?.level) && b.level >= 1 ? b.level : 1;
    if (Array.isArray(h.capacities) && h.capacities.length) {
      const pick = h.capacities[Math.min(lvl, h.capacities.length) - 1];
      if (Number.isFinite(+pick) && +pick >= 1) return Math.floor(+pick);
    }
    const base = Number.isFinite(+h.capacity) && +h.capacity >= 1 ? Math.floor(+h.capacity) : 500;
    const stepRaw = h.perTier ?? h.capacityPerTier ?? h.tierGrowth ?? h.capacityGrowth ?? base;
    const step = Number.isFinite(+stepRaw) && +stepRaw >= 0 ? Math.floor(+stepRaw) : base;
    return base + step * (lvl - 1);
  };
  for (const key of ['world', 'home']) {
    const w = value[key];
    if (!w || typeof w !== 'object') continue;
    for (const b of w.buildings || []) {
      if (!Number.isFinite(+b.harvestBonus) || +b.harvestBonus < 0) { if (b.harvestBonus !== undefined) b.harvestBonus = Math.max(0, Number.isFinite(+b.harvestBonus) ? +b.harvestBonus : 0); continue; }
      const cap = capFor(b);
      if (cap != null) b.harvestBonus = Math.min(+b.harvestBonus, cap);
    }
  }
  value.version = 8;
  return value;
}
// v8 -> v9: Phase 6 defense expansion (gates, ramparts, archer/ballista
// towers). New buildings are data-driven unlocks, so old villages need no
// structural change — this step only normalizes live defense cooldowns
// (a missing cooldown reads NaN and would silence towers) and otherwise
// leaves resources, buildings, troops and progress untouched. Never wipes.
function migrateV8toV9(value, data) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['world', 'home']) {
    const w = value[key];
    if (!w || typeof w !== 'object') continue;
    for (const b of w.buildings || []) {
      if (!Number.isFinite(+b.cooldown)) b.cooldown = 0;
    }
  }
  value.version = 9;
  return value;
}
// v9 -> v10: Phase 7 villager identity (names, traits, job XP/levels,
// manual-post locks). Every new field backfills a safe default; nameless
// veterans are named from data/names.json, traitless crews roll one.
// Additive only: resources, buildings, posts, gear and progress untouched.
function migrateV9toV10(value, data) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['world', 'home']) {
    const w = value[key];
    if (!w || typeof w !== 'object') continue;
    for (const t of w.troops || []) {
      try { ensureIdentity(t, data, w.troops); } catch { /* identity never blocks a load */ }
    }
  }
  value.version = 10;
  return value;
}
// v10 -> v11: Phase 8 production chains and crafting (lumber/flour/bread
// stores, village craft stock, per-building craft orders). Every new key
// backfills a quiet default; gear, resources, buildings, troops and
// progress are never touched or removed. Never wipes.
function migrateV10toV11(value, data) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['world', 'home']) {
    const w = value[key];
    if (!w || typeof w !== 'object') continue;
    for (const bucket of [w.resources, w.gathered]) {
      if (!bucket || typeof bucket !== 'object') continue;
      for (const k of ['lumber', 'flour', 'bread']) {
        if (!Number.isFinite(bucket[k]) || bucket[k] < 0) bucket[k] = Math.max(0, Number.isFinite(bucket[k]) ? bucket[k] : 0);
      }
    }
    if (!w.stock || typeof w.stock !== 'object' || Array.isArray(w.stock)) w.stock = {};
    for (const b of w.buildings || []) {
      if (b && typeof b === 'object' && b.craft !== undefined && (b.craft === null || typeof b.craft !== 'object')) b.craft = null;
    }
  }
  value.version = 11;
  return value;
}
// v11 -> v12: async multiplayer (visits + helping). Backfills the social
// shelf — username, friend code, friend list, help inbox/outbox, activity
// feed and the cloud timestamp. Additive only: every world, resource,
// building, troop and progress key passes through untouched. Old saves
// load as local-only villages until a username is chosen.
function migrateV11toV12(value, data) {
  if (!value || typeof value !== 'object') return null;
  const mp = value.multiplayer && typeof value.multiplayer === 'object' ? value.multiplayer : {};
  value.multiplayer = {
    username: typeof mp.username === 'string' ? mp.username : null,
    friendCode: typeof mp.friendCode === 'string' ? mp.friendCode : null,
    friends: Array.isArray(mp.friends) ? mp.friends : [],
    inbox: Array.isArray(mp.inbox) ? mp.inbox : [],
    outbox: Array.isArray(mp.outbox) ? mp.outbox : [],
    activity: Array.isArray(mp.activity) ? mp.activity : [],
    giftsSentDay: mp.giftsSentDay ?? null,
    giftsSent: Number.isFinite(mp.giftsSent) ? mp.giftsSent : 0,
    helpsSentDay: mp.helpsSentDay ?? null,
    helpsSent: Number.isFinite(mp.helpsSent) ? mp.helpsSent : 0,
  };
  if (!Number.isFinite(value.cloudUpdatedAt)) value.cloudUpdatedAt = 0;
  value.version = 12;
  return value;
}
// v12 -> v13: Outer Frontier grid expansion. Existing tile records are
// copied onto the larger data-world grid exactly as saved; only coordinates
// that did not exist in the old save are appended and forced unclaimed.
// Tile-less vintage saves stay tile-less here so Game's established bounds
// reconstruction path can restore their old homestead footprint safely.
function migrateV12toV13(value, data) {
  if (!value || typeof value !== 'object') return null;
  const expand = w => {
    if (!w || !Array.isArray(w.tiles) || !w.tiles.length) return;
    const existing = new Map();
    for (const t of w.tiles) if (Number.isInteger(t?.x) && Number.isInteger(t?.y)) existing.set(t.x + ',' + t.y, t);
    let fresh = [];
    try { fresh = buildTiles(data.world, {w:0,h:0}); } catch { return; }
    for (const t of fresh) {
      const old = existing.get(t.x + ',' + t.y);
      if (old) Object.assign(t, old, {x:t.x, y:t.y});
      else t.claimed = false;
    }
    w.tiles = fresh;
  };
  expand(value.world);
  expand(value.home);
  value.version = 13;
  return value;
}
// v13 -> v14: central storage caps (Late-Game Economy Plan Phase 1).
// Purely additive: every existing resource is grandfathered exactly as
// saved (over-cap balances keep every unit and only block new inflow),
// and each world gains an empty pendingRewards shelf for grant overflow.
// Buildings, troops, gear and progress pass through untouched. Never wipes.
function migrateV13toV14(value, data) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['world', 'home']) {
    const w = value[key];
    if (!w || typeof w !== 'object') continue;
    if (!w.pendingRewards || typeof w.pendingRewards !== 'object' || Array.isArray(w.pendingRewards)) w.pendingRewards = {};
  }
  value.version = 14;
  return value;
}
// v14 -> v15: permanent roads and additive workshop output buffers. Hauls are runtime reservations;
// reserves and shared stores already save every real resource.
function migrateV14toV15(value,data){
 for(const w of [value.world,value.home])if(w){normalizeRoads(w,data);normalizeOutputs(w,data);}
 value.version=15;return value;
}
const MIGRATIONS = {1: migrateV1toV2, 2: migrateV2toV3, 3: migrateV3toV4, 4: migrateV4toV5, 5: migrateV5toV6, 6: migrateV6toV7, 7: migrateV7toV8, 8: migrateV8toV9, 9: migrateV9toV10, 10: migrateV10toV11, 11: migrateV11toV12, 12: migrateV12toV13, 13: migrateV13toV14, 14: migrateV14toV15};
export function migrate(value, data) {
  return migrateToLatest(value, data);
}
export function migrateToLatest(value, data) {
  if (!value || typeof value !== 'object') return null;
  let v = value.version || 1;
  if (v > VERSION) return null;
  let guard = 0;
  while (v < VERSION && guard++ < 16) {
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
  function valid(w){return w&&['wood','food','gold'].every(k=>Number.isFinite(w.resources?.[k])&&w.resources[k]>=0)&&Array.isArray(w.buildings)&&w.buildings.every(b=>data.buildings[b.type]&&(!b.outputReserve||(typeof b.outputReserve==='object'&&!Array.isArray(b.outputReserve)&&Object.entries(b.outputReserve).every(([k,n])=>data.buildings[b.type].refine?.some(r=>Object.hasOwn(r.out||{},k))&&Number.isFinite(n)&&n>=0)))&&Number.isInteger(b.level)&&b.level>=1&&b.level<=data.buildings[b.type].tiers.length&&Number.isFinite(b.hp)&&Number.isFinite(b.x)&&Number.isFinite(b.y))&&Array.isArray(w.troops)&&w.troops.every(t=>data.troops[t.type]&&data.items[t.gear]&&(!t.armor||data.items[t.armor])&&Number.isInteger(t.level)&&t.level>=1&&t.level<=data.troops[t.type].maxLevel&&Array.isArray(t.owned))&&Array.isArray(w.enemies)&&Array.isArray(w.effects);}
  if(!value||typeof value!=='object')return false;
  if(!valid(value.world)||!Array.isArray(value.completed)||!Array.isArray(value.unlocks))return false;
  if(value.mission&&(!valid(value.home)||!data.missions.some(m=>m.id===value.mission.id)))return false;
  if(!Array.isArray(value.questsCompleted)||!Number.isFinite(value.xp))return false;
  return true;
}
function supplyDefaults(value, data) {
  for (const w of [value.world, value.home]) {
    if (!w) continue;
    normalizeTrails(w,data);normalizeRoads(w,data);normalizeOutputs(w,data);normalizeManagement(w,data);
    if (typeof w.autoTrain !== 'boolean') w.autoTrain = false;
    if (typeof w.wellSupplied !== 'boolean') w.wellSupplied = false;
    if (!Number.isInteger(w.lastSupplyDay) || w.lastSupplyDay < 0) {
      w.lastSupplyDay = mealDay(w, data);
      w.wellSupplied = false;
    }
    if (w.conquest && typeof w.conquest === 'object' && typeof w.conquest.supplied !== 'boolean') w.conquest.supplied = false;
    for (const entry of Object.values(w.conquest?.tribes || {})) {
      if (entry && typeof entry === 'object' && typeof entry.supplied !== 'boolean') entry.supplied = false;
    }
  }
  return value;
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
  supplyDefaults(value, data);
  return value;
 }catch{return null;}
}
// Phase D: portable save blob for moving between devices. Never wipes:
// bad blobs fail with a readable message, and imports run the same
// versioned migrations as local loads.
export function exportSave(state) {
  try { return JSON.stringify({...state, version: VERSION},managementReplacer); }
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
  return {ok:true, state:supplyDefaults(value, data)};
}
