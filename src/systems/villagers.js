// Phase 7 — Villager identity and job overhaul.
// Villagers are people now: generated names, a small trait set where every
// trait DOES something (no dead stats), per-villager job XP/levels that
// raise job output, smart auto-assignment with manual override, and
// idle-worker detection.
//
// Dependency-free on purpose: model.js, economy.js, combat.js,
// emergency.js and storage.js all import from here, so this module must
// import nothing from them (no cycles). All functions take plain
// (unit, world, data) args and read only data/names.json pools plus the
// FALLBACK pools below (tests and old saves may lack names.json).
export const FALLBACK_GIVEN = ['Bram', 'Wren', 'Fen', 'Issa', 'Pella', 'Maro', 'Sella', 'Tomm', 'Hob', 'Kess', 'Dren', 'Berra', 'Colm', 'Essie', 'Lark', 'Rill'];
export const FALLBACK_TRADE = ['Ash', 'Salt', 'Bell', 'Cutler', 'the mason', 'the smith', 'the thatcher', 'the tinker', 'the miller', 'the drover'];

// Every trait below is read somewhere real — the comment names the reader.
// No flavor-only traits: if it does nothing, it does not ship.
export const TRAITS = {
  hard_worker: {name: 'Hard Worker', icon: '⚒', desc: '+12% gather and produce output.', reader: 'economy gather rate, model produce/aura share'},
  strong: {name: 'Strong', icon: '💪', desc: '+25% carry, +10% damage.', reader: 'economy capacity, model stats damage'},
  brave: {name: 'Brave', icon: '🦁', desc: 'Holds ground: flees later, +10% damage while raiders walk.', reader: 'emergency flee radius, combat damage'},
  cowardly: {name: 'Cowardly', icon: '🐇', desc: 'Flees early and fast, −10% damage while raiders walk. Healers with this trait run for shelter instead of tending the field.', reader: 'emergency flee radius/speed/heal-skip, combat damage'},
  quick_learner: {name: 'Quick Learner', icon: '✎', desc: 'Earns job XP 50% faster.', reader: 'tickVillagerJobs'},
  marksman: {name: 'Marksman', icon: '🎯', desc: '+20% damage for ranged fighters; every living Marksman sharpens towers +2% (max +20%).', reader: 'model stats, combat tower branch'},
  craftsman: {name: 'Craftsman', icon: '⚙', desc: '+25% output at smithing/workshop posts (forge, workshop, armory, smeltery, mason yard).', reader: 'model aura share'},
  night_owl: {name: 'Night Owl', icon: '🌙', desc: 'Restless feet: +10% move speed, +15% flee speed.', reader: 'model stats speed, emergency flee speed'},
};
// Posts where a Craftsman counts double — the smithing/workshop line.
export const CRAFT_SHOPS = ['forge', 'workshop', 'armory', 'smeltery', 'mason_yard'];
// Job skill: XP thresholds for levels 1..5. Each level is +8% job output.
export const JOB_XP_LEVELS = [0, 60, 180, 360, 600];
export const JOB_XP_RATE = 1; // xp per second while posted at a live workplace
export const JOB_LEVEL_BONUS = 0.08;

export function hasTrait(unit, id) {
  return Array.isArray(unit?.traits) && unit.traits.includes(id);
}
// Cowardly and Brave never share a heart — re-roll the clash.
export function rollTraits(rand = Math.random) {
  const ids = Object.keys(TRAITS);
  const first = ids[Math.floor(rand() * ids.length)];
  const out = [first];
  if (rand() < 0.25) {
    let second = ids[Math.floor(rand() * ids.length)];
    if ((first === 'brave' && second === 'cowardly') || (first === 'cowardly' && second === 'brave')) second = 'hard_worker';
    if (second !== first) out.push(second);
  }
  return out;
}
export function makeName(roster, data, rand = Math.random) {
  const given = data?.names?.given?.length ? data.names.given : FALLBACK_GIVEN;
  const trade = data?.names?.trade?.length ? data.names.trade : FALLBACK_TRADE;
  const taken = new Set((roster || []).map(u => u.name).filter(Boolean));
  for (let tries = 0; tries < 12; tries++) {
    const base = given[Math.floor(rand() * given.length)];
    const name = rand() < 0.25 ? `${base} ${trade[Math.floor(rand() * trade.length)]}` : base;
    if (!taken.has(name)) return name;
    if (tries > 6) return `${base} ${tries}`;
  }
  return `${given[Math.floor(rand() * given.length)]} ${Date.now() % 1000}`;
}
// Save-compatible identity: fills every new field with a safe default and
// never touches anything already there. Old saves (no name/traits/jobXp)
// gain an identity on first tick/import — progress is never wiped.
export function ensureIdentity(unit, data, roster, rand = Math.random) {
  if (!unit || typeof unit !== 'object') return unit;
  if (!unit.name) unit.name = makeName(roster, data, rand);
  if (!Array.isArray(unit.traits) || !unit.traits.length) {
    const kept = (Array.isArray(unit.traits) ? unit.traits : []).filter(t => TRAITS[t]);
    unit.traits = kept.length ? kept : rollTraits(rand);
  }
  if (!Number.isFinite(unit.jobXp) || unit.jobXp < 0) unit.jobXp = 0;
  unit.jobXp = Math.min(JOB_XP_LEVELS[JOB_XP_LEVELS.length - 1], unit.jobXp);
  unit.jobLevel = jobLevelForXp(unit.jobXp);
  if (unit.manualPost === undefined) unit.manualPost = false;
  return unit;
}
export function jobLevelForXp(xp) {
  let level = 1;
  for (let i = 0; i < JOB_XP_LEVELS.length; i++) if ((xp || 0) >= JOB_XP_LEVELS[i]) level = i + 1;
  return Math.min(level, JOB_XP_LEVELS.length);
}
// +8% job output per level past the first. Pure: old saves at level 1 read exactly 1.
export function jobLevelMult(unit) {
  return 1 + JOB_LEVEL_BONUS * ((unit?.jobLevel || 1) - 1);
}
// Craft/shift output multiplier for a posted villager at a building type.
export function traitOutputMult(unit, buildingType) {
  let m = 1;
  if (hasTrait(unit, 'hard_worker')) m *= 1.12;
  if (hasTrait(unit, 'craftsman') && CRAFT_SHOPS.includes(buildingType)) m *= 1.25;
  return m;
}
// Posted crews train on the job. Quick Learners train 50% faster.
// Returns the list of villagers who leveled up (for notify/floaters).
export function tickVillagerJobs(world, data, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return [];
  // Perf: one id map per tick instead of a buildings.find per posted troop.
  const postOf = new Map();
  for (const b of world.buildings || []) postOf.set(b.id, b);
  const leveled = [];
  for (const u of world.troops || []) {
    if (!u || u.hp <= 0 || !u.workplace) continue;
    const b = postOf.get(u.workplace);
    if (!b || b.hp <= 0 || b.remaining > 0) continue;
    const rate = JOB_XP_RATE * (hasTrait(u, 'quick_learner') ? 1.5 : 1);
    const before = u.jobLevel || 1;
    u.jobXp = Math.min(JOB_XP_LEVELS[JOB_XP_LEVELS.length - 1], (Number.isFinite(u.jobXp) ? u.jobXp : 0) + rate * dt);
    u.jobLevel = jobLevelForXp(u.jobXp);
    if (u.jobLevel > before) leveled.push(u);
  }
  return leveled;
}
// Idle hands: living villagers with no post, no orders, no expedition.
// Fighters holding the line are not idle — this tracks worker shortage.
export function isIdle(u) {
  if (!u || u.hp <= 0) return false;
  if (u.workplace || u.order || u.expedition || u.emergency) return false;
  return true;
}
export function idleWorkers(world, data) {
  return (world.troops || []).filter(u => {
    if (!isIdle(u)) return false;
    const spec = data?.troops?.[u.type];
    if (!spec) return false;
    if (spec.role === 'combat') return false;
    return !!spec.job;
  });
}
function crewCount(world, buildingId, counts) {
  if (counts) return counts.get(buildingId) || 0;
  return (world.troops || []).filter(t => t.workplace === buildingId && t.hp > 0).length;
}
// Smart posting score: trait affinity first, then emptiest shop.
// Deterministic — same village, same answer, every tick.
export function scorePost(unit, building, data, world, counts) {
  const spec = data.buildings[building.type];
  let score = 1;
  if (hasTrait(unit, 'craftsman') && CRAFT_SHOPS.includes(building.type)) score += 1;
  if (hasTrait(unit, 'strong') && ['mine', 'lumber', 'frostgrove', 'emberglass'].includes(building.type)) score += 0.5;
  if (hasTrait(unit, 'hard_worker')) score += 0.25;
  if (hasTrait(unit, 'quick_learner') && ['scriptorium', 'schoolroom'].includes(building.type)) score += 0.5;
  if (hasTrait(unit, 'night_owl') && building.type === 'scout_post') score += 0.5;
  const cap = (spec?.size || 1) + 1;
  score += (1 - Math.min(1, crewCount(world, building.id, counts) / cap)) * 0.25;
  return score;
}
function postValid(world, data, unit, building, counts) {
  if (!unit || unit.hp <= 0 || !building || building.hp <= 0 || building.remaining > 0) return false;
  const job = data.troops[unit.type]?.job;
  if (!job) return false;
  if (building.type !== job.workplace && !(data.buildings[building.type]?.hosts || []).includes(unit.type)) return false;
  if (unit.workplace === building.id) return true;
  const cap = (data.buildings[building.type]?.size || 1) + 1;
  return crewCount(world, building.id, counts) < cap;
}
// Smart auto-assignment. Only idle hands move; manualPost villagers (placed
// by the player) are never touched — the override always wins.
export function autoAssign(world, data, {onlyIdle = true} = {}) {
  let placed = 0;
  const pool = (world.troops || []).filter(u => {
    if (!u || u.hp <= 0 || u.manualPost || u.expedition) return false;
    if (onlyIdle && !isIdle(u)) return false;
    if (!onlyIdle && u.workplace) return false;
    return !!data?.troops?.[u.type]?.job;
  });
  // Perf: crew counts computed once and kept live as placements land,
  // replacing a full troops filter per score/validity check.
  const counts = new Map();
  for (const t of world.troops || []) {
    if (t && t.workplace && t.hp > 0) counts.set(t.workplace, (counts.get(t.workplace) || 0) + 1);
  }
  for (const u of pool) {
    const options = (world.buildings || []).filter(b => postValid(world, data, u, b, counts));
    if (!options.length) continue;
    options.sort((a, b2) => {
      const s = scorePost(u, b2, data, world, counts) - scorePost(u, a, data, world, counts);
      if (s !== 0) return s;
      const ca = {x: a.x + 0.5, y: a.y + 0.5}, cb = {x: b2.x + 0.5, y: b2.y + 0.5};
      return Math.hypot(u.x - ca.x, u.y - ca.y) - Math.hypot(u.x - cb.x, u.y - cb.y);
    });
    u.workplace = options[0].id;
    counts.set(options[0].id, (counts.get(options[0].id) || 0) + 1);
    u.order = null;
    u.manualPost = false;
    placed++;
  }
  return placed;
}
// Open posts fill themselves: every few seconds of village time, idle
// hands with a trade take the post that fits them best — no tap needed.
// Same pool rules as the button, so manual locks are never moved.
export const AUTOFILL_EVERY = 5;
export function autoFillTick(world, data, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  world.autoFillTimer = (world.autoFillTimer || 0) + dt;
  if (world.autoFillTimer < AUTOFILL_EVERY) return 0;
  world.autoFillTimer = 0;
  return autoAssign(world, data, {onlyIdle: true});
}
// Idle hands with a trade but nowhere to practice it: no finished building
// fits their job. The auto-assign button names these instead of claiming
// no hands are idle — a tap that changes nothing must still tell the truth.
export function idleWithoutPosts(world, data) {
  return (world.troops || []).filter(u => {
    if (!u || u.hp <= 0 || u.manualPost || u.expedition) return false;
    if (!isIdle(u)) return false;
    if (!data?.troops?.[u.type]?.job) return false;
    return !(world.buildings || []).some(b => postValid(world, data, u, b));
  });
}
// Marksman tower doctrine: every living Marksman sharpens every tower +2%,
// capped at +20%. Readers: combat.js tower branch.
export function towerCrewBonus(world) {
  let n = 0;
  for (const u of world.troops || []) if (u.hp > 0 && hasTrait(u, 'marksman')) n++;
  return Math.min(0.2, 0.02 * n);
}
// Emergency temperament. Cowardly flees early and fast; Brave holds late.
export function fleeRadius(unit) {
  if (hasTrait(unit, 'cowardly')) return 4;
  if (hasTrait(unit, 'brave')) return 1.2;
  return 2.5;
}
export function fleeSpeedMult(unit) {
  let m = 1;
  if (hasTrait(unit, 'cowardly')) m *= 1.3;
  if (hasTrait(unit, 'night_owl')) m *= 1.15;
  return m;
}
// Melee temperament while raiders walk: Brave +10%, Cowardly −10%.
export function raidDamageMult(unit, raidActive) {
  if (!raidActive) return 1;
  if (hasTrait(unit, 'brave')) return 1.1;
  if (hasTrait(unit, 'cowardly')) return 0.9;
  return 1;
}
