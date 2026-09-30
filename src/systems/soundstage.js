// Zoom-gated detail mixer: pure, Node-safe helpers shared by every later
// alive-village phase. Audio stays quiet and broad when zoomed out and gains
// individual sources as the camera closes in — never twenty at once.
export const ZOOM_BANDS = [
  {id: 'far', max: 1.05},
  {id: 'village', max: 1.3},
  {id: 'near', max: 1.65},
  {id: 'close', max: 2.2},
  {id: 'intimate', max: Infinity},
];

export function zoomBand(zoom) {
  const z = Number.isFinite(zoom) ? zoom : 1;
  for (const band of ZOOM_BANDS) if (z < band.max) return band.id;
  return 'intimate';
}

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// 0 below `from`, 1 above `to`, smooth in between — no hard audio cuts.
export function zoomFade(zoom, from, to) {
  if (!(to > from)) return Number.isFinite(zoom) && zoom >= to ? 1 : 0;
  if (!Number.isFinite(zoom)) return 0;
  if (zoom <= from) return 0;
  if (zoom >= to) return 1;
  return smoothstep((zoom - from) / (to - from));
}

const clamp01 = n => Math.max(0, Math.min(1, n));

// Nearest-first emitter pick: at most `max` sources within `range` tiles of
// the camera center, each with a distance attenuation 1→0. Caps simultaneous
// close-up voices; callers scale their volume by `vol`.
export function pickEmitters(items, cx, cy, max = 5, range = 12) {
  if (!Array.isArray(items) || !(max > 0) || !(range > 0)) return [];
  const out = [];
  for (const item of items) {
    if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y)) continue;
    const d = Math.hypot(item.x - cx, item.y - cy);
    if (d > range) continue;
    out.push({item, dist: d, vol: clamp01(1 - d / range)});
  }
  out.sort((a, b) => a.dist - b.dist);
  return out.slice(0, Math.floor(max));
}

// Detail gain per band for a sound class: 0 = silent here, 1 = full.
// Broad layers (music/weather/birds) ignore this; close-up detail obeys it.
export function bandGain(band, kind) {
  const intimate = {footstep: 1, work: 1, combat: 1, machine: 1, fire: 1, water: 1};
  const close = {footstep: 0.8, work: 0.9, combat: 1, machine: 0.9, fire: 0.9, water: 0.8};
  const near = {footstep: 0.25, work: 0.5, combat: 0.9, machine: 0.45, fire: 0.5, water: 0.4};
  const village = {footstep: 0, work: 0.18, combat: 0.7, machine: 0.12, fire: 0.15, water: 0.12};
  const far = {footstep: 0, work: 0, combat: 0.45, machine: 0, fire: 0, water: 0};
  const table = band === 'intimate' ? intimate : band === 'close' ? close : band === 'near' ? near : band === 'village' ? village : far;
  return table[kind] ?? 0;
}
