// Woodland expeditions (Phase 3): capable troops range into the treeline
// and haul back wild goods. Capability comes ONLY from data/troops.json
// `expedition: {yields, durationSec, risk}` — this handler never names a
// troop id; any present or future profession with the field just works.
// State machine per unit (u.expedition): out (walk to forest edge) ->
// gather (off-grid timer) -> back (walk home) -> deliver to
// world.resources. All timing rides dt; rng is injectable for tests.
import {move} from './pathfinding.js';
import {stats, center, makeUnit, housing} from '../model.js';
import {floatText} from './economy.js';
import {grantCentral} from './storage.js';
import {ensureIdentity} from './villagers.js';
import {factionFor} from './tactics.js';
import {sfx} from './audio.js';
import {isHauling} from './logistics.js';
import {
  findsTable, findChances, findsMult, pickArtifact, pickFrom, rescuePool,
  artifactList, MAX_INTEL_LOG, MAX_EXPEDITION_LOG, SCOUT_BONUS_CAP, SCOUT_BONUS_EACH
} from './artifacts.js';

export function expeditionSpec(data, unit) {
  return data?.troops?.[unit?.type]?.expedition || null;
}

export function capable(data, unit) {
  const s = expeditionSpec(data, unit);
  return !!s && Number.isFinite(s.durationSec) && s.durationSec > 0 && !!s.yields;
}

// Standard ranging retains the old numbers. Additional plans are content,
// not new professions; invalid entries never reach the dispatch controls.
export function rangingPlans(data) {
  const plans = [{id: 'standard', name: 'Woodland ranging', text: 'The familiar gathering trip.', durationMult: 1, yieldMult: 1, riskAdd: 0, intelMult: 1}];
  for (const [id, p] of Object.entries(data?.artifacts?.rangingPlans || {})) {
    if (id === 'standard' || !/^[a-z][a-z0-9-]*$/.test(id) || !p || typeof p.name !== 'string') continue;
    if (!Number.isFinite(p.durationMult) || p.durationMult < 1 || p.durationMult > 2 ||
        !Number.isFinite(p.yieldMult) || p.yieldMult <= 0 || p.yieldMult > p.durationMult ||
        !Number.isFinite(p.riskAdd) || p.riskAdd < 0 || p.riskAdd > 0.1 ||
        !Number.isFinite(p.intelMult) || p.intelMult < 1 || p.intelMult > p.durationMult) continue;
    plans.push({...p, id});
    if (plans.length >= 4) break;
  }
  return plans;
}

export function expeditionReason(world, data, unit) {
  if (!unit || unit.hp <= 0) return 'This ranger needs to recover.';
  if (!capable(data, unit)) return 'This profession does not range.';
  if (unit.expedition) return 'Already ranging.';
  if (world.raidPending || world.enemies?.some(e => e.hp > 0)) return 'Ranging waits until the raid is over.';
  if (unit.emergency || unit.shelteredIn) return 'On emergency duty.';
  if (unit.order) return 'Resume auto duties before dispatch.';
  if (unit.carry > 0 || isHauling(unit)) return 'Finish the current delivery first.';
  if (unit.builderTask) return 'Finish the current building task first.';
  return null;
}

// The preview and dispatch share one quote. Risk is current-sky risk;
// the sky at homecoming decides the actual mishap, as it always did.
export function expeditionQuote(world, data, unit, planId = 'standard') {
  const spec = expeditionSpec(data, unit);
  const plan = rangingPlans(data).find(p => p.id === planId);
  if (!spec || !plan) return null;
  const yields = Object.fromEntries(Object.entries(spec.yields || {}).map(([k, v]) => [k, Math.max(0, Math.floor(v * plan.yieldMult))]));
  return {planId, name: plan.name, text: plan.text, yields,
    durationSec: Math.ceil(spec.durationSec * plan.durationMult),
    baseRisk: Math.min(0.9, (spec.risk || 0) + plan.riskAdd),
    risk: Math.min(0.9, (spec.risk || 0) + plan.riskAdd + skyRisk(world, data)),
    intelMult: plan.intelMult,
    intelChance: Math.min(1, findChances(data).intel * findsMult(data, unit) * plan.intelMult),
    reason: expeditionReason(world, data, unit)};
}

// Nearest forest-biome tile center to the unit; falls back to the map
// edge when the grid has no forest (mission maps, odd seeds).
export function forestEdge(world, unit) {
  let best = null, bestD = Infinity;
  if (Array.isArray(world?.tiles)) {
    for (const t of world.tiles) {
      if (t.biome !== 'forest') continue;
      const d = Math.hypot((t.x + 0.5) - unit.x, (t.y + 0.5) - unit.y);
      if (d < bestD) { bestD = d; best = {x: t.x + 0.5, y: t.y + 0.5}; }
    }
  }
  if (best) return best;
  return {x: Math.max(0.5, (world?.bounds?.w || 14) - 1.5), y: Math.max(0.5, (world?.bounds?.h || 12) - 1.5)};
}

function homeOf(world, data) {
  const hall = world.buildings.find(b => b.type === 'hall' && b.hp > 0);
  if (hall) return center(hall, data);
  return {x: 9.5, y: 8.5};
}

// Send a capable idle unit ranging. Returns false for the incapable,
// the fallen, or those already out.
export function startExpedition(world, data, unit, rng = Math.random, planId = 'standard') {
  if (expeditionReason(world, data, unit)) return false;
  const quote = expeditionQuote(world, data, unit, planId);
  if (!quote) return false;
  const entry = forestEdge(world, unit);
  unit.expedition = {
    phase: 'out',
    timer: 0,
    entryX: entry.x,
    entryY: entry.y,
    homeX: homeOf(world, data).x,
    homeY: homeOf(world, data).y,
    duration: quote.durationSec,
    yields: {...quote.yields},
    risk: quote.baseRisk,
    planId,
    intelMult: quote.intelMult
  };
  unit.order = null;
  void rng;
  return true;
}

// Recall pays only for completed gathering. No tablets, artifacts, rescues
// or intel roll on an unfinished trip, and repeated recall cannot pay twice.
export function recallExpedition(world, data, unit) {
  const e = unit?.expedition;
  if (!e || !['out', 'gather'].includes(e.phase)) return false;
  const progress = e.phase === 'gather' && Number.isFinite(e.timer) && Number.isFinite(e.duration) && e.duration > 0 ? Math.max(0, Math.min(1, 1 - e.timer / e.duration)) : 0;
  e.yields = Object.fromEntries(Object.entries(e.yields || {}).map(([k, v]) => [k, Math.floor(v * progress)]));
  if (e.offgrid) { unit.x = e.entryX; unit.y = e.entryY; }
  const home = homeOf(world, data);
  e.homeX = home.x; e.homeY = home.y;
  e.phase = 'back'; e.offgrid = false; e.recalled = true;
  return true;
}

// Inspector line for the selected unit: null when idle.
export function expeditionStatus(unit, data) {
  const e = unit?.expedition;
  if (!e) return null;
  if (e.phase === 'out') return 'Out to the treeline';
  if (e.phase === 'gather') return `Gathering — ${Math.max(0, Math.ceil(e.timer))}s`;
  if (e.phase === 'back') {
    let walk = 5;
    try {
      const speed = stats(unit, data).speed;
      if (Number.isFinite(speed) && speed > 0) {
        walk = Math.max(1, Math.ceil(Math.hypot(e.homeX - unit.x, e.homeY - unit.y) / speed));
      }
    } catch {}
    return `${e.recalled ? 'Recalled · ' : ''}Back in ~${walk}s`;
  }
  return null;
}

// Phase 10 hook: ranging after dark or in fog is riskier. Worlds without
// sky flags (old saves, direct subsystem ticks in tests) read as a clear
// day — zero behavior change. Tunables live under data.world.daynight.
// The gather phase already rides dt, so weather never touches durations.
export function skyRisk(world, data) {
  const cfg = data?.world?.daynight || {};
  let r = 0;
  if (world?.night === true) r += Number.isFinite(cfg.nightExpeditionRisk) ? cfg.nightExpeditionRisk : 0.05;
  if (world?.weather === 'fog') r += Number.isFinite(cfg.fogExpeditionRisk) ? cfg.fogExpeditionRisk : 0.03;
  return r;
}

// Phase 11 — return manifest: everything a ranger brings home, rolled up
// front so tests can script it. rng call order is fixed and documented:
// mishap, rescue roll, rescue pick, artifact roll, artifact pick, intel
// roll, intel template, intel detail, intel road, discovery pick. A
// scripted rng of constant functions stays deterministic through all of it.
export function rollReturn(world, data, unit, rng = Math.random) {
  const e = unit?.expedition || {};
  const mult = findsMult(data, unit);
  const chances = findChances(data);
  const risk = Math.min(0.9, (e.risk || 0) + skyRisk(world, data));
  if (e.recalled) return {yields: {...(e.yields || {})}, mishap: Object.values(e.yields || {}).some(v => v > 0) && risk > 0 && rng() < risk, salvage: 0, rescueType: null, artifactId: null, intel: null, discovery: null, recalled: true};
  const mishap = risk > 0 && rng() < risk;
  const rescueType = rng() < chances.rescue * mult ? pickFrom(rescuePool(data), rng) : null;
  const artifactId = rng() < chances.artifact * mult ? pickArtifact(world, data, rng) : null;
  let intel = null;
  const t = findsTable(data);
  if (t && rng() < Math.min(1, chances.intel * mult * (e.intelMult || 1))) {
    const faction = factionFor(data, (world?.wave || 0) + 1)?.name || 'Raiders';
    const template = pickFrom(t?.intel, rng) || '{faction} sign on the {road} — {detail}';
    const detail = pickFrom(t?.intelDetails, rng) || 'they will come sooner than the last time.';
    const road = pickFrom(t?.roads, rng) || 'west road';
    intel = {wave: (world?.wave || 0) + 1, faction, text: template.split('{faction}').join(faction).split('{road}').join(road).split('{detail}').join(detail)};
  }
  const discovery = pickFrom(findsTable(data)?.discoveries, rng) || null;
  return {
    yields: {...(e.yields || {})},
    mishap,
    // Salvaged tablets always come home: insight for the research table.
    salvage: 4 + Math.floor((e.duration || 60) / 20),
    rescueType,
    artifactId,
    intel,
    discovery
  };
}

function rangerName(unit, data) {
  return unit?.name || data?.troops?.[unit?.type]?.name || unit?.type || 'A ranger';
}

// Applies a rolled manifest: yields, salvage, rescue, artifact, intel —
// then the homecoming moment (notice-board log, last-return card for the
// Expeditions panel, fanfare at the hall, celebration toast). Returns the
// summary lines for tests and callers. Save-compat is additive only:
// world.artifacts, world.intelLog, world.expeditionLog and world.lastReturn
// are created on first homecoming; old saves never see a migration.
export function applyReturn(world, state, data, unit, manifest, notify = () => {}) {
  const lines = [];
  const hall = world.buildings.find(b => b.type === 'hall' && b.hp > 0);
  const at = hall ? center(hall, data) : {x: unit.x, y: unit.y};
  const ranger = rangerName(unit, data);
  // Wild goods first — mishap halves the material haul, never the finds.
  for (const [k, v] of Object.entries(manifest.yields || {})) {
    let amount = Math.max(0, Math.floor(v));
    if (manifest.mishap) amount = Math.floor(amount / 2);
    if (amount > 0) {
      // Central storage caps (Phase 1): the haul banks what fits; the
      // rest waits on the ledgers (grants queue their overflow).
      grantCentral(world, data, k, amount, true);
      lines.push(`+${amount} ${k}`);
      floatText(world, at.x, at.y, `+${amount} ${k}${manifest.mishap ? ' (mishap)' : ''}`, manifest.mishap ? '#e08a8a' : '#ffe9a8');
    }
  }
  if (manifest.mishap) lines.push('a mishap on the trail halved the haul');
  if (manifest.recalled) lines.push('recalled early; unfinished finds were left in the woods');
  // Tech salvage feeds research progress, capped like the passive trickle.
  if (state && manifest.salvage > 0) {
    const r = state.research ??= {points: 0, completed: [], active: null};
    r.points = Math.min(1000, (r.points || 0) + manifest.salvage);
    lines.push(`salvaged tablets (+${manifest.salvage} insight)`);
  }
  // Rescued villagers join the roster with a name and traits (Phase 7
  // identity) — but only where a free bed waits. Without one they move
  // on, leaving supplies instead of vanishing into the math.
  if (manifest.rescueType && data?.troops?.[manifest.rescueType]) {
    const spec = data.troops[manifest.rescueType];
    if (housing(world, data).free > 0) {
      const saved = makeUnit(manifest.rescueType, data, world.troops.length % 5);
      saved.x = at.x; saved.y = at.y;
      ensureIdentity(saved, data, world.troops);
      world.troops.push(saved);
      floatText(world, at.x, at.y - 1, '+ new villager!', '#bfe3a8');
      try { sfx.birth(); } catch {}
      lines.push(`${saved.name} was rescued and joins as a ${spec.name}`);
    } else {
      grantCentral(world, data, 'food', 10, true);
      floatText(world, at.x, at.y, '+10 food (travelers\u2019 gifts)', '#ffe9a8');
      lines.push('a rescued traveler found no free bed and moved on, leaving supplies (+10 food)');
    }
  }
  // Recovered artifacts take their place on the shelf — permanent village
  // bonuses through the aura table. Duplicates never roll (the picker only
  // offers unowned), but the guard below keeps it true regardless.
  if (manifest.artifactId) {
    const shelf = world.artifacts ??= [];
    const known = artifactList(data).find(a => a.id === manifest.artifactId);
    if (known && !shelf.includes(known.id)) {
      shelf.push(known.id);
      floatText(world, at.x, at.y - 2, `Artifact: ${known.name}`, '#ffd97a');
      lines.push(`recovered ${known.name} — a permanent blessing on the village`);
    }
  }
  // Faction intel: what the treeline whispered about the next raid. The
  // log feeds the Chronicle; the warning itself buys the village time —
  // +5s on the next raid horn, banked up to +15s.
  if (manifest.intel) {
    const log = world.intelLog ??= [];
    log.push(manifest.intel);
    while (log.length > MAX_INTEL_LOG) log.shift();
    world.scoutBonus = Math.min(SCOUT_BONUS_CAP, (world.scoutBonus || 0) + SCOUT_BONUS_EACH);
    lines.push(`word of the enemy: ${manifest.intel.text} (next warning +${SCOUT_BONUS_EACH}s)`);
  }
  if (manifest.discovery) lines.push(`saw ${manifest.discovery.charAt(0).toLowerCase()}${manifest.discovery.slice(1)}`);
  // The homecoming record: last-return card for the Expeditions panel and
  // a page in the expedition log the Chronicle reads aloud.
  const day = Math.floor((world.elapsed || 0) / 180) + 1;
  const text = lines.length ? lines.join('; ') + '.' : 'returned empty-handed.';
  world.lastReturn = {ranger, day, lines: [...lines]};
  const pages = world.expeditionLog ??= [];
  pages.push({day, ranger, text});
  while (pages.length > MAX_EXPEDITION_LOG) pages.shift();
  world.effects.push({x: at.x, y: at.y, tx: at.x, ty: at.y, kind: 'fanfare', life: .8});
  try { sfx.collect(); } catch {}
  notify(`\u{1F389} ${ranger} is home from the treeline — ${text}`);
  unit.expedition = null;
  unit.phase = 'gather';
  unit.carry = 0;
  return lines;
}

function deliver(world, state, data, unit, rng, notify) {
  const manifest = rollReturn(world, data, unit, rng);
  applyReturn(world, state, data, unit, manifest, notify);
}

export function tickExpeditions(world, data, dt, rng = Math.random, opts = {}) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  if (!Array.isArray(world?.troops)) return;
  for (const u of world.troops) {
    const e = u.expedition;
    if (!e) continue;
    if (u.hp <= 0 || !capable(data, u)) { u.expedition = null; continue; }
    const speed = stats(u, data).speed;
    if (e.phase === 'out') {
      if (move(world, data, u, {x: e.entryX, y: e.entryY}, speed, dt, 0.6, false, true)) {
        e.phase = 'gather';
        e.timer = e.duration;
        e.offgrid = true;
      }
    } else if (e.phase === 'gather') {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.phase = 'back';
        e.offgrid = false;
        u.x = e.entryX; u.y = e.entryY;
      }
    } else if (e.phase === 'back') {
      if (move(world, data, u, {x: e.homeX, y: e.homeY}, speed, dt, 1.2, false, true)) {
        deliver(world, opts.state, data, u, rng, opts.notify);
      }
    } else {
      u.expedition = null;
    }
  }
}
