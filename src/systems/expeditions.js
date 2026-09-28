// Woodland expeditions (Phase 3): capable troops range into the treeline
// and haul back wild goods. Capability comes ONLY from data/troops.json
// `expedition: {yields, durationSec, risk}` — this handler never names a
// troop id; any present or future profession with the field just works.
// State machine per unit (u.expedition): out (walk to forest edge) ->
// gather (off-grid timer) -> back (walk home) -> deliver to
// world.resources. All timing rides dt; rng is injectable for tests.
import {move} from './pathfinding.js';
import {stats, center, makeUnit, housing} from '../model.js';
import {addResource, floatText} from './economy.js';
import {ensureIdentity} from './villagers.js';
import {factionFor} from './tactics.js';
import {sfx} from './audio.js';
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
export function startExpedition(world, data, unit, rng = Math.random) {
  if (!unit || unit.hp <= 0 || unit.expedition || !capable(data, unit)) return false;
  const spec = expeditionSpec(data, unit);
  const entry = forestEdge(world, unit);
  unit.expedition = {
    phase: 'out',
    timer: 0,
    entryX: entry.x,
    entryY: entry.y,
    homeX: homeOf(world, data).x,
    homeY: homeOf(world, data).y,
    duration: spec.durationSec,
    yields: {...spec.yields},
    risk: spec.risk || 0
  };
  unit.order = null;
  void rng;
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
    return `Back in ~${walk}s`;
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
  const mishap = risk > 0 && rng() < risk;
  const rescueType = rng() < chances.rescue * mult ? pickFrom(rescuePool(data), rng) : null;
  const artifactId = rng() < chances.artifact * mult ? pickArtifact(world, data, rng) : null;
  let intel = null;
  const t = findsTable(data);
  if (t && rng() < chances.intel * mult) {
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
      addResource(world, k, amount);
      floatText(world, at.x, at.y, `+${amount} ${k}${manifest.mishap ? ' (mishap)' : ''}`, manifest.mishap ? '#e08a8a' : '#ffe9a8');
    }
  }
  if (manifest.mishap) lines.push('a mishap on the trail halved the haul');
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
      addResource(world, 'food', 10);
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
