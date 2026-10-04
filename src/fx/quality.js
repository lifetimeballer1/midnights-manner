// Quality presets + auto-degrade. Renderer-only, no save fields.
// Low/Med/High map to existing caches/LOD; Calm still wins for motion.
const PRESETS = {
  Low: { dprCap: 1, maxEffects: 20, hideDecalsBelow: 0.6, fullAnimAbove: 2.2, ambientCap: 6, lightCap: 18, shadowCap: 48, shadowPasses: 1, mistCap: 2, emberCap: 2, chimneyCap: 3, rayCap: 1, trailCap: 6, smokeCap: 4, rainCap: 3, glintCap: 4, cloudCap: 1 },
  Med: { dprCap: 1.5, maxEffects: 40, hideDecalsBelow: 0.6, fullAnimAbove: 1.5, ambientCap: 12, lightCap: 36, shadowCap: 96, shadowPasses: 2, mistCap: 3, emberCap: 6, chimneyCap: 5, rayCap: 3, trailCap: 10, smokeCap: 6, rainCap: 4, glintCap: 8, cloudCap: 2 },
  // High preserves the pre-power-pass visual ceilings on desktop.
  High: { dprCap: 2, maxEffects: 60, hideDecalsBelow: 0.6, fullAnimAbove: 1.5, ambientCap: 20, lightCap: 120, shadowCap: 180, shadowPasses: 3, mistCap: 5, emberCap: 12, chimneyCap: 8, rayCap: 5, trailCap: 12, smokeCap: 8, rainCap: 6, glintCap: 12, cloudCap: 3 },
};
const ORDER = ['Low', 'Med', 'High'];
function stored() {
  try { return localStorage.getItem('midnights-manner-quality'); } catch { return null; }
}
function store(v) {
  try { localStorage.setItem('midnights-manner-quality', v); } catch {}
}
function storedBattery() {
  try { return localStorage.getItem('midnights-manner-battery') === 'on'; } catch { return false; }
}
function storeBattery(on) {
  try { localStorage.setItem('midnights-manner-battery', on ? 'on' : 'off'); } catch {}
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
  const preferred = PRESETS[start] ? start : defaultQualityFor(width,coarse);
  renderer.powerSaver = storedBattery();
  renderer.quality = renderer.powerSaver ? 'Low' : preferred;
  renderer.qualityCfg = qualityPreset(renderer.quality);
  let hotSince = 0;

  const applyQuality = (name,persist=true) => {
    if (!PRESETS[name]) return renderer.quality;
    renderer.quality = name;
    renderer.qualityCfg = qualityPreset(name);
    if(persist) store(name);
    hotSince = 0;
    try {
      const dpr=typeof window!=='undefined'?(window.devicePixelRatio||1):(renderer.dpr||1);
      renderer.resize?.(renderer.width,renderer.height,dpr);
    } catch {}
    try {
      renderer.staticLayer = null; renderer.staticKey = '';
      renderer._meshStatic = null; renderer._trailStatic = null;
      renderer._pendingStaticKey = null;
    } catch {}
    return renderer.quality;
  };

  renderer.setPowerSaver = (enabled) => {
    const next=Boolean(enabled);
    if(next===renderer.powerSaver)return renderer.powerSaver;
    renderer.powerSaver=next;storeBattery(next);
    if(next)applyQuality('Low',false);
    else {
      const restore=stored();
      applyQuality(PRESETS[restore]?restore:defaultQualityFor(width,coarse),false);
    }
    return renderer.powerSaver;
  };

  renderer.setQuality = (name) => {
    if (!PRESETS[name]) return renderer.quality;
    if(renderer.powerSaver){renderer.powerSaver=false;storeBattery(false);}
    return applyQuality(name,true);
  };
  renderer.cycleQuality = () => {
    const next = ORDER[(ORDER.indexOf(renderer.quality) + 1) % ORDER.length];
    renderer.setQuality(next);
    return next;
  };
  renderer.autoDegrade = (avgMs, nowMs, renderAvgMs) => {
    if (!Number.isFinite(avgMs)) return renderer.quality;
    const hot = avgMs > 20 || (Number.isFinite(renderAvgMs) && renderAvgMs > 12);
    if (!hot) { hotSince = 0; return renderer.quality; }
    if (!hotSince) hotSince = nowMs;
    if (nowMs - hotSince < 3000) return renderer.quality;
    const i = ORDER.indexOf(renderer.quality);
    if (i > 0) {
      if(renderer.powerSaver)applyQuality(ORDER[i - 1],false);
      else renderer.setQuality(ORDER[i - 1]);
    }
    hotSince = 0;
    return renderer.quality;
  };
  return renderer;
}
