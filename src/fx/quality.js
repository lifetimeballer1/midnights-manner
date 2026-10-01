// Quality presets + auto-degrade. Renderer-only, no save fields.
// Low/Med/High map to existing caches/LOD; Calm still wins for motion.
const PRESETS = {
  Low: { dprCap: 1, maxEffects: 20, hideDecalsBelow: 0.6, fullAnimAbove: 2.2, ambientCap: 6, lightCap: 16 },
  Med: { dprCap: 1.5, maxEffects: 40, hideDecalsBelow: 0.6, fullAnimAbove: 1.5, ambientCap: 12, lightCap: 28 },
  High: { dprCap: 2, maxEffects: 60, hideDecalsBelow: 0.6, fullAnimAbove: 1.5, ambientCap: 20, lightCap: 40 },
};
const ORDER = ['Low', 'Med', 'High'];
function stored() {
  try { return localStorage.getItem('midnights-manner-quality'); } catch { return null; }
}
function store(v) {
  try { localStorage.setItem('midnights-manner-quality', v); } catch {}
}
export function qualityPreset(name) {
  return PRESETS[name] || PRESETS.High;
}
export function lodBand(zoom) {
  if (zoom < 0.6) return 'far';
  if (zoom > 1.5) return 'near';
  return 'mid';
}
export function attachQuality(renderer) {
  const start = stored();
  renderer.quality = PRESETS[start] ? start : 'High';
  renderer.qualityCfg = qualityPreset(renderer.quality);
  let hotSince = 0;
  renderer.setQuality = (name) => {
    if (!PRESETS[name]) return;
    renderer.quality = name;
    renderer.qualityCfg = qualityPreset(name);
    store(name);
    hotSince = 0;
  };
  renderer.cycleQuality = () => {
    const next = ORDER[(ORDER.indexOf(renderer.quality) + 1) % ORDER.length];
    renderer.setQuality(next);
    return next;
  };
  // Called once per frame with the rolling avg; degrades High->Med->Low
  // after 3s above 20ms, never upgrades on its own. Calm is untouched.
  renderer.autoDegrade = (avgMs, nowMs) => {
    if (!Number.isFinite(avgMs)) return renderer.quality;
    if (avgMs <= 20) { hotSince = 0; return renderer.quality; }
    if (!hotSince) hotSince = nowMs;
    if (nowMs - hotSince < 3000) return renderer.quality;
    const i = ORDER.indexOf(renderer.quality);
    if (i > 0) renderer.setQuality(ORDER[i - 1]);
    hotSince = 0;
    return renderer.quality;
  };
  return renderer;
}
