const KEY='midnights-manner-v2';
const OLD_KEY='midnights-manner-v1';
export const VERSION = 2;
export function save(game) {try{localStorage.setItem(KEY,JSON.stringify({...game,version:2}));return true;}catch{return false;}}
// v1 -> v2: village-sim pass. Fills every new field with safe defaults;
// existing resources, buildings, troops, unlocks and progress are untouched.
export function migrate(value, data) {
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
    for (const t of world.troops || []) if (t.workplace === undefined) t.workplace = null;
  }
  if (value.home) {
    for (const b of value.home.buildings || []) {
      const spec = data.buildings[b.type];
      if (spec?.reserve && b.reserve == null) { b.reserve = spec.reserve; b.maxReserve = spec.reserve; }
    }
    for (const t of value.home.troops || []) if (t.workplace === undefined) t.workplace = null;
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
export function load(data) {
 try {
  let raw = null;
  try { raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY); } catch { return null; }
  if (!raw) return null;
  let value = JSON.parse(raw);
  if (!value) return null;
  if (value.version === 1 || !value.version) value = migrate(value, data);
  if (!value || value.version !== 2) return null;
  function valid(w){return w&&['wood','food','gold'].every(k=>Number.isFinite(w.resources?.[k])&&w.resources[k]>=0)&&Array.isArray(w.buildings)&&w.buildings.every(b=>data.buildings[b.type]&&Number.isInteger(b.level)&&b.level>=1&&b.level<=data.buildings[b.type].tiers.length&&Number.isFinite(b.hp)&&Number.isFinite(b.x)&&Number.isFinite(b.y))&&Array.isArray(w.troops)&&w.troops.every(t=>data.troops[t.type]&&data.items[t.gear]&&Number.isInteger(t.level)&&t.level>=1&&t.level<=data.troops[t.type].maxLevel&&Array.isArray(t.owned))&&Array.isArray(w.enemies)&&Array.isArray(w.effects);}
  if(!valid(value.world)||!Array.isArray(value.completed)||!Array.isArray(value.unlocks))return null;
  if(value.mission&&(!valid(value.home)||!data.missions.some(m=>m.id===value.mission.id)))return null;
  if(!Array.isArray(value.questsCompleted)||!Number.isFinite(value.xp))return null;
  return value;
 }catch{return null;}
}
