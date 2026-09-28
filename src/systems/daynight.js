// Phase 10 — Living world clock: day/night cycle, lamp lighting, weather.
// Pure functions over world.elapsed (seconds of village time), so the sky
// is fully derived: no save fields, no migration, no scumming. Old saves
// (no flags at all) read as a clear day; the game tick writes transient
// world.night / world.weather each tick for the sim to read. Everything
// tunable lives under data.world.daynight — logic never hardcodes a number
// the table already owns.
export const DAY_LENGTH = 300; // seconds of village time per full day

// spans are fractions of the day: dawn 24s, day 126s, dusk 24s, night 126s.
const PHASES = [
  {id: 'dawn', name: 'Dawn', icon: '🌅', span: 0.08, night: false, darkness: 0.25},
  {id: 'day', name: 'Day', icon: '☀️', span: 0.5, night: false, darkness: 0},
  {id: 'dusk', name: 'Dusk', icon: '🌇', span: 0.58, night: false, darkness: 0.3},
  {id: 'night', name: 'Night', icon: '🌙', span: 1, night: true, darkness: 1},
];

const LIGHTING = {
  dawn: {color: '#f2c96e', alpha: 0.06, glow: 0.35},
  day: {color: null, alpha: 0, glow: 0},
  dusk: {color: '#c05a4e', alpha: 0.08, glow: 0.65},
  night: {color: '#1a2c4e', alpha: 0.2, glow: 1},
};

const WEATHERS = {
  clear: {id: 'clear', name: 'Clear', icon: '🌤️', color: null, alpha: 0, streaks: false},
  rain: {id: 'rain', name: 'Rain', icon: '🌧', color: '#2e4a5a', alpha: 0.08, streaks: true},
  fog: {id: 'fog', name: 'Fog', icon: '🌫', color: '#9aa7b5', alpha: 0.14, streaks: false},
};

const DEFAULTS = {
  dayLength: DAY_LENGTH,
  rainChance: 25, // % of days, date-hash deterministic
  fogChance: 15, // % of days, after rain's share
  nightEnemyDamage: 0.1, // raiders hit +10% harder after dark
  fogEnemySpeed: -0.1, // fog slows raiders 10% — they cannot see either
  nightGather: -0.05, // uneasy hands gather a touch slower at night
  rainGather: 0.05, // soft earth gathers a touch faster in rain
  nightExpeditionRisk: 0.05, // ranging after dark adds +5% mishap risk
  fogExpeditionRisk: 0.03, // fog on the trail adds +3% mishap risk
  lightBlend: 0.04, // fraction of a day fanned into each phase's crossfade
  lines: {
    dawn: '🌅 Dawn breaks over the palisade. The night lets go.',
    day: '☀️ The sun climbs. Hammers ring across the village.',
    dusk: '🌇 Dusk settles. Lamps are lit along the paths.',
    night: '🌙 Night falls on the manor. Raiders grow bolder in the dark.',
    rain: '🌧 Rain drums on the roofs. The fields drink deep.',
    fog: '🌫 Fog crawls in from the treeline. Shapes move slow in it.',
    clear: '🌤️ The sky clears. Far ridges stand sharp again.',
  },
};

export function clockConfig(data) {
  const c = data?.world?.daynight;
  if (!c || typeof c !== 'object') return {...DEFAULTS, lines: {...DEFAULTS.lines}};
  return {...DEFAULTS, ...c, lines: {...DEFAULTS.lines, ...(c.lines || {})}};
}

function hash(n) {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^= x >>> 15) >>> 0;
}

function dayLengthOf(data) {
  const n = data?.world?.daynight?.dayLength;
  return Number.isFinite(n) && n > 60 ? n : DAY_LENGTH;
}

// Phase for a given elapsed time. Missing/NaN elapsed reads as high noon —
// old saves and fresh maps open on a bright field, never a black screen.
export function phaseAt(elapsed, data) {
  const len = dayLengthOf(data);
  const t = Number.isFinite(elapsed) && elapsed >= 0 ? (elapsed % len) / len : 0.2;
  for (const p of PHASES) {
    if (t < p.span) return {id: p.id, name: p.name, icon: p.icon, night: p.night, darkness: p.darkness, t};
  }
  return {id: 'night', name: 'Night', icon: '🌙', night: true, darkness: 1, t};
}

export function isNight(elapsed, data) {
  return phaseAt(elapsed, data).night;
}

// Renderer lighting for a phase id: overlay tint + lamp glow 0..1.
// Unknown ids read as day — a bad string never blacks the screen.
export function lightingFor(phaseId, data) {
  const base = LIGHTING[phaseId] || LIGHTING.day;
  const over = data?.world?.daynight?.lighting?.[phaseId];
  if (!over || typeof over !== 'object') return {...base};
  return {
    color: typeof over.color === 'string' || over.color === null ? over.color : base.color,
    alpha: Number.isFinite(over.alpha) ? Math.max(0, Math.min(0.35, over.alpha)) : base.alpha,
    glow: Number.isFinite(over.glow) ? Math.max(0, Math.min(1, over.glow)) : base.glow,
  };
}

// Phase 2 — mesh light per phase. Day is the legacy fixed-light formula
// (ambient .72 + key .26·max(0,N·L) + sky .12·max(0,N.z), L=(-0.4,-0.5,1)),
// pinned byte-for-byte by tests/lighting-baseline.test.js: the constants
// below (including the hand-written norm 1.187) exist so paint-time day
// output stays identical to the old construction-time baked shading.
// `dir` may stay unnormalized; `norm` divides the dot when present.
const SKIES = {
  dawn: {key: {dir: [-0.2, -0.6, 0.8], color: '#f2c96e', intensity: 0.24}, ambient: {color: '#a8b6cc', intensity: 0.6}, sky: 0.1, emissive: 0.25},
  day: {key: {dir: [-0.4, -0.5, 1], norm: 1.187, color: '#ffffff', intensity: 0.26}, ambient: {color: '#ffffff', intensity: 0.72}, sky: 0.12, emissive: 0},
  dusk: {key: {dir: [-0.6, -0.35, 0.75], color: '#e8a25e', intensity: 0.24}, ambient: {color: '#c9a68c', intensity: 0.58}, sky: 0.1, emissive: 0.22},
  night: {key: {dir: [0.45, -0.3, 0.85], color: '#9fb4e8', intensity: 0.16}, ambient: {color: '#4a5f8e', intensity: 0.4}, sky: 0.07, emissive: 0.6},
};
const LIGHT_BUCKETS = 192; // painted-color cache steps per day (~1.6s at 300s days)
const PHASE_ORDER = PHASES.map(p => p.id);
const PHASE_START = Object.fromEntries(PHASES.map((p, i) => [p.id, i ? PHASES[i - 1].span : 0]));

function hexRGB(hex, fallback) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return fallback;
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

function bounded(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

// One phase's light, merging optional data overrides. Every number is
// clamped so a bad data file can neither black the screen nor blow out the
// palette (same defensive contract as lightingFor's overlay clamps).
function skyFor(phaseId, data) {
  const base = SKIES[phaseId] || SKIES.day;
  const over = data?.world?.daynight?.lighting?.[phaseId];
  const ok = over && typeof over === 'object' ? over : {};
  const key = {...base.key, ...(ok.key && typeof ok.key === 'object' ? ok.key : {})};
  const ambient = {...base.ambient, ...(ok.ambient && typeof ok.ambient === 'object' ? ok.ambient : {})};
  const dir = Array.isArray(key.dir) && key.dir.length === 3 && key.dir.every(Number.isFinite) ? key.dir : base.key.dir;
  return {
    keyDir: dir,
    keyNorm: Number.isFinite(key.norm) && key.norm > 0 ? key.norm : (Math.hypot(...dir) || 1),
    keyRGB: hexRGB(key.color, hexRGB(base.key.color, [1, 1, 1])),
    keyI: bounded(key.intensity, base.key.intensity, 0, 1.5),
    ambRGB: hexRGB(ambient.color, hexRGB(base.ambient.color, [1, 1, 1])),
    ambI: bounded(ambient.intensity, base.ambient.intensity, 0, 1.5),
    sky: bounded(ok.sky, base.sky, 0, 0.5),
    emissive: bounded(ok.emissive, base.emissive, 0, 2),
  };
}

function mixSky(a, b, u) {
  if (u <= 0) return a;
  if (u >= 1) return b; // past the blend window: exact phase values, no alloc
  const mix = (x, y) => x + (y - x) * u;
  return {
    keyDir: a.keyDir.map((v, i) => mix(v, b.keyDir[i])),
    keyNorm: mix(a.keyNorm, b.keyNorm),
    keyRGB: a.keyRGB.map((v, i) => mix(v, b.keyRGB[i])),
    keyI: mix(a.keyI, b.keyI),
    ambRGB: a.ambRGB.map((v, i) => mix(v, b.ambRGB[i])),
    ambI: mix(a.ambI, b.ambI),
    sky: mix(a.sky, b.sky),
    emissive: mix(a.emissive, b.emissive),
  };
}

// Phase 2 — resolved light for scene meshes plus the overlay descriptor the
// renderer already used (one clock read, one source). Crossfades out of the
// previous phase over `lightBlend` of a day; calm players get a plain step.
// Pure over elapsed: same moment, same light, every load.
export function skyLightAt(elapsed, data, opts = {}) {
  const phase = phaseAt(elapsed, data);
  const start = PHASE_START[phase.id] ?? 0;
  let u = 1;
  if (!opts.calm) {
    const blend = bounded(clockConfig(data).lightBlend, DEFAULTS.lightBlend, 0.005, 0.25);
    u = Math.max(0, Math.min(1, (phase.t - start) / blend));
  }
  const prevId = PHASE_ORDER[(PHASE_ORDER.indexOf(phase.id) + PHASE_ORDER.length - 1) % PHASE_ORDER.length];
  const light = mixSky(skyFor(prevId, data), skyFor(phase.id, data), u);
  light.phase = phase;
  light.overlay = lightingFor(phase.id, data);
  light.key = phase.id + ':' + Math.round((phase.t || 0) * LIGHT_BUCKETS);
  return light;
}

// Weather is per sky-day, hashed from the day index: same elapsed, same
// weather, every load, every player. Missing tables mean clear skies.
export function weatherAt(elapsed, data) {
  const cfg = clockConfig(data);
  const len = dayLengthOf(data);
  const day = Number.isFinite(elapsed) && elapsed >= 0 ? Math.floor(elapsed / len) : 0;
  const seed = Number.isFinite(data?.world?.seed) ? data.world.seed : 7;
  const r = hash(day ^ Math.imul(seed, 0x9e3779b1)) % 100;
  const id = r < cfg.rainChance ? 'rain' : r < cfg.rainChance + cfg.fogChance ? 'fog' : 'clear';
  return {...WEATHERS[id]};
}

export function weatherMods(weatherId, data) {
  const cfg = clockConfig(data);
  const w = WEATHERS[weatherId] || WEATHERS.clear;
  return {
    id: w.id, name: w.name, icon: w.icon,
    gather: w.id === 'rain' ? cfg.rainGather : 0,
    enemySpeed: w.id === 'fog' ? cfg.fogEnemySpeed : 0,
  };
}

// Night deltas for the sim. Worlds without flags (old saves, direct
// subsystem ticks in tests) read as a clear day — zero behavior change.
export function enemyDamageMult(world, data) {
  if (world?.night !== true) return 1;
  return 1 + clockConfig(data).nightEnemyDamage;
}

export function enemySpeedMult(world, data) {
  if (world?.weather !== 'fog') return 1;
  return 1 + clockConfig(data).fogEnemySpeed;
}

export function skyGatherBonus(world, data) {
  const cfg = clockConfig(data);
  let bonus = 0;
  if (world?.night === true) bonus += cfg.nightGather;
  if (world?.weather === 'rain') bonus += cfg.rainGather;
  return bonus;
}

// One-line village-clock readout for panels: "🌙 Night · 🌧 Rain".
// Pure over elapsed — needs no tick state, safe to call from any panel.
export function describeClock(world, data) {
  const elapsed = world?.elapsed;
  const phase = phaseAt(elapsed, data);
  const weather = weatherAt(elapsed, data);
  const bits = [`${phase.icon} ${phase.name}`, `${weather.icon} ${weather.name}`];
  const hints = [];
  if (phase.night) hints.push('raiders hit harder in the dark');
  if (weather.id === 'rain') hints.push('gathering quickens in the rain');
  if (weather.id === 'fog') hints.push('raiders slow in the fog');
  if (phase.night && (world?.troops || []).some(u => u.hp > 0 && !u.workplace && !u.order && data?.troops?.[u.type]?.role !== 'combat' && data?.troops?.[u.type]?.role !== 'collector')) {
    hints.push('idle hands seek shelter');
  }
  return {phase: phase.id, weather: weather.id, line: bits.join(' · '), hint: hints.join('; ')};
}
