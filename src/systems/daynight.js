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
