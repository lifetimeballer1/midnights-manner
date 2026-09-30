import {resourceInfo,formatShortAmount} from '../resources.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const HUD_DEFAULTS = Object.freeze({resources:true,army:true,camera:true,quest:true});
// UI preferences only. Storage may be absent, blocked, corrupt or full.
export function hudPreferences(storage) {
 let state = {...HUD_DEFAULTS};
 try {
  const saved = JSON.parse(storage?.getItem('mm.hud') || '{}');
  for (const key of Object.keys(state)) if (typeof saved?.[key] === 'boolean') state[key] = saved[key];
 } catch {}
 return {
  get: () => ({...state}),
  set(key, collapsed) {
   if (!(key in HUD_DEFAULTS)) return;
   state[key] = !!collapsed;
   try { storage?.setItem('mm.hud', JSON.stringify(state)); } catch {}
  }
 };
}
export function resourceSummary(resources = {}, visible = [], caps = {}, collapsed = true) {
 const full = visible.some(key => Number.isFinite(caps[key]) && (resources[key] || 0) >= caps[key]);
 const values = ['gold','food','wood'].map(key => {
  const r = resourceInfo(key);
  return `<span><img src="./assets/sprites/${r.sprite}" alt="${r.label}"><b>${formatShortAmount(resources[key])}</b></span>`;
 }).join('');
 const label = ['gold','food','wood'].map(key => `${Math.floor(resources[key] || 0)} ${resourceInfo(key).label}`).join(', ');
 return `<button id="resource-summary" class="hud-chip" aria-expanded="${!collapsed}" aria-label="Village resources — stored amounts and capacities: ${label}${full?' — stores full':''}. ${collapsed?'Expand':'Collapse'} resources">${values}${full?'<em>FULL</em>':''}</button>`;
}
export function armySummary(count = 0, selected = null) {
 const pip = selected ? `<span class="army-level">Lv ${escape(selected.level)}</span>` : '';
 return `<button id="army-summary" class="hud-chip" aria-label="Quick troop commands: Army ${count}${selected?`, selected unit level ${escape(selected.level)}`:''}. Open Army and people">Army ${count}${pip}</button>`;
}
export function cameraToggle(collapsed = true) {
 return `<button id="camera-toggle" class="hud-chip" aria-controls="camera-buttons" aria-expanded="${!collapsed}" aria-label="Map controls: ${collapsed?'Expand':'Collapse'} camera tools">⋯</button>`;
}
export function questDot(name) {
 return `<button id="quest-dot" class="hud-chip" aria-expanded="false" aria-controls="quest-chip" aria-label="Open current quest: ${escape(name)}">✦</button>`;
}
