// Footsteps tied to real walking: renderer-local stride accumulators (never
// in saves) convert position deltas into left/right ground contacts. Only
// audible when zoomed in; pitch varies per villager so crowds don't unison.
import {sfx} from './audio.js';
import {zoomBand, bandGain} from './soundstage.js';

export const STRIDE_LEN = 0.55;

export function hashId(id) {
  const s = String(id ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

export function unitPitch(id, right) {
  const h = (hashId(id) % 1000) / 1000;
  return (0.9 + h * 0.25) * (right ? 1.04 : 0.96);
}

const STONE = new Set(['stone-road']);
const WATER = new Set(['pond', 'blackwater-weir']);
const FROST = new Set(['frostgrove']);

// Lightweight surface read: only building footprints, only on step fire.
export function surfaceAt(world, data, x, y) {
  if (!world || !Array.isArray(world.buildings)) return 'dirt';
  for (const b of world.buildings) {
    if (!b || b.hp <= 0 || b.remaining > 0) continue;
    const size = Number(data?.buildings?.[b.type]?.size) || 1;
    if (x < b.x - 0.5 || x > b.x + size + 0.5 || y < b.y - 0.5 || y > b.y + size + 0.5) continue;
    if (STONE.has(b.type)) return 'stone';
    if (WATER.has(b.type)) return 'water';
    if (FROST.has(b.type)) return 'frost';
  }
  return 'dirt';
}

const SURFACE_TONE = {
  stone: {pitch: 1.5, vol: 0.8},
  water: {pitch: 0.62, vol: 0.7},
  frost: {pitch: 0.85, vol: 0.9},
  dirt: {pitch: 1, vol: 1},
};

// Accumulate travel; returns 'left'/'right' on ground contact, else null.
// Standing still bleeds the accumulator so idle sway never earns a step.
export function trackStride(strides, u, time = null) {
  const key = 'u' + u.id;
  let s = strides.get(key);
  if (!s) { strides.set(key, {x: u.x, y: u.y, acc: 0, side: false, movedAt: Number.isFinite(time) ? time : 0}); return null; }
  const d = Math.hypot(u.x - s.x, u.y - s.y);
  s.x = u.x; s.y = u.y;
  if (d >= 1) { s.acc = 0; return null; }
  if (!(d > 0.00001)) {
    if (!Number.isFinite(time) || time - s.movedAt > 180) s.acc = 0;
    return null;
  }
  if (Number.isFinite(time)) s.movedAt = time;
  s.acc += d;
  if (s.acc >= STRIDE_LEN) { s.acc %= STRIDE_LEN; s.side = !s.side; return s.side ? 'right' : 'left'; }
  return null;
}

export function footstepFor(u, side, surface, zoom) {
  const gain = bandGain(zoomBand(zoom), 'footstep');
  if (!(gain > 0)) return false;
  const tone = SURFACE_TONE[surface] || SURFACE_TONE.dirt;
  sfx.footstep({vol: gain * tone.vol, pitch: unitPitch(u.id, side === 'right') * tone.pitch});
  return true;
}
