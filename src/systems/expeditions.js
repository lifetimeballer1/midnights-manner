// Woodland expeditions (Phase 3): capable troops range into the treeline
// and haul back wild goods. Capability comes ONLY from data/troops.json
// `expedition: {yields, durationSec, risk}` — this handler never names a
// troop id; any present or future profession with the field just works.
// State machine per unit (u.expedition): out (walk to forest edge) ->
// gather (off-grid timer) -> back (walk home) -> deliver to
// world.resources. All timing rides dt; rng is injectable for tests.
import {move} from './pathfinding.js';
import {stats, center} from '../model.js';
import {addResource, floatText} from './economy.js';

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

function deliver(world, data, unit, rng) {
  const e = unit.expedition;
  const mishap = (e.risk > 0) && rng() < e.risk;
  const hall = world.buildings.find(b => b.type === 'hall' && b.hp > 0);
  const at = hall ? center(hall, data) : {x: unit.x, y: unit.y};
  for (const [k, v] of Object.entries(e.yields || {})) {
    let amount = Math.max(0, Math.floor(v));
    if (mishap) amount = Math.floor(amount / 2);
    if (amount > 0) {
      addResource(world, k, amount);
      floatText(world, at.x, at.y, `+${amount} ${k}${mishap ? ' (mishap)' : ''}`, mishap ? '#e08a8a' : '#ffe9a8');
    }
  }
  unit.expedition = null;
  unit.phase = 'gather';
  unit.carry = 0;
}

export function tickExpeditions(world, data, dt, rng = Math.random) {
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
        deliver(world, data, u, rng);
      }
    } else {
      u.expedition = null;
    }
  }
}
