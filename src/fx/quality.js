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
export function defaultQualityFor(width=1024,coarse=false) {
  return coarse || width < 700 ? 'Med' : 'High';
}
export function attachQuality(renderer) {
  const start = stored();
  let coarse=false,width=renderer?.width||1024;
  try{coarse=window.matchMedia?.('(pointer: coarse)').matches||navigator.maxTouchPoints>0;width=window.innerWidth||width;}catch{}
  renderer.quality = PRESETS[start] ? start : defaultQualityFor(width,coarse);
  renderer.qualityCfg = qualityPreset(renderer.quality);
  let hotSince = 0;
  renderer.setQuality = (name) => {
    if (!PRESETS[name]) return;
    renderer.quality = name;
    renderer.qualityCfg = qualityPreset(name);
    store(name);
    hotSince = 0;
    // Apply the new DPR cap immediately; waiting for orientation/resize kept
    // iPhones painting the previous high-resolution backing store.
    try {
      const dpr=typeof window!=='undefined'?(window.devicePixelRatio||1):(renderer.dpr||1);
      renderer.resize?.(renderer.width,renderer.height,dpr);
    } catch {}
    // New art must take effect immediately: drop cached layers so the next
    // frame rebuilds at the new pixel density and detail limits.
    try {
      renderer.staticLayer = null; renderer.staticKey = '';
      renderer._meshStatic = null; renderer._trailStatic = null;
      renderer._pendingStaticKey = null;
    } catch {}
  };
  renderer.cycleQuality = () => {
    const next = ORDER[(ORDER.indexOf(renderer.quality) + 1) % ORDER.length];
    renderer.setQuality(next);
    return next;
  };
  // Called once per frame with the rolling avg; degrades High->Med->Low
  // after 3s above 20ms, never upgrades on its own. Calm is untouched.
  // renderAvgMs (draw cost, no rAF gaps) also triggers a step-down after 3s
  // above 12ms so heavy meshes degrade even when the frame interval looks fine.
  renderer.autoDegrade = (avgMs, nowMs, renderAvgMs) => {
    if (!Number.isFinite(avgMs)) return renderer.quality;
    const hot = avgMs > 20 || (Number.isFinite(renderAvgMs) && renderAvgMs > 12);
    if (!hot) { hotSince = 0; return renderer.quality; }
    if (!hotSince) hotSince = nowMs;
    if (nowMs - hotSince < 3000) return renderer.quality;
    const i = ORDER.indexOf(renderer.quality);
    if (i > 0) renderer.setQuality(ORDER[i - 1]);
    hotSince = 0;
    return renderer.quality;
  };
  return renderer;
}
