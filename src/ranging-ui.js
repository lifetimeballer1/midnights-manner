import {rangingPlans, expeditionQuote} from './systems/expeditions.js';
import {resourceInfo} from './resources.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selections = new WeakMap();
function choices(world) {
  let map = selections.get(world);
  if (!map) { map = new Map(); selections.set(world, map); }
  return map;
}
const basket = yields => Object.entries(yields || {}).filter(([,n]) => n > 0).map(([k,n]) => `+${n} ${resourceInfo(k).label}`).join(' · ') || 'No materials';

function cardContents(g, u) {
  const plans = rangingPlans(g.data), selected = choices(g.world).get(u.id) || 'standard';
  const q = expeditionQuote(g.world, g.data, u, selected) || expeditionQuote(g.world, g.data, u);
  if (!q) return '';
  return `<b>${esc(u.name || g.data.troops[u.type].name)}</b><small>${esc(g.data.troops[u.type].name)}</small>
    <div class="adv-row"><label for="ranging-${esc(u.id)}">Trip plan</label><select id="ranging-${esc(u.id)}" data-ranging-plan="${esc(u.id)}" ${q.reason ? 'disabled' : ''}>${plans.map(p => `<option value="${esc(p.id)}" ${p.id === q.planId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <p>${esc(q.text)}</p><p>${esc(basket(q.yields))}<br>${q.durationSec}s gathering + travel · ${Math.round(q.risk * 100)}% mishap now · ${Math.round(q.intelChance * 100)}% intel</p>
    ${q.reason ? `<p class="adv-note">${esc(q.reason)}</p>` : ''}<button class="adv-next-btn" data-expedition="${esc(u.id)}" data-ranging-dispatch="1" ${q.reason ? 'disabled' : ''}>Send ranger →</button>`;
}

export function rangingCards(g, roster) {
  const units = new Map(g.world.troops.map(u => [u.id, u]));
  const chosen = choices(g.world);
  for (const id of chosen.keys()) if (!units.has(id)) chosen.delete(id);
  const outHtml = roster.out.map(o => `<div class="adv-row"><span>${esc(o.name)}<small>${esc(o.status)} · ${esc(rangingPlans(g.data).find(p => p.id === o.planId)?.name || 'Woodland ranging')}</small></span>${o.canRecall ? `<button data-recall-ranger="${esc(o.id)}">Recall</button>` : '<b>RETURNING</b>'}</div>`).join('') || '<p class="adv-empty">No hands in the treeline. The woods keep their counsel.</p>';
  const idleHtml = roster.idle.map(o => `<article class="adv-card" data-ranging-card="${esc(o.id)}">${cardContents(g, units.get(o.id))}</article>`).join('') || '<p class="adv-empty">No idle rangers. Foragers, woodcutters and wayfinders range — fighters hold the walls.</p>';
  return {outHtml, idleHtml, ready: roster.idle.filter(u => !u.reason).length};
}

export function rangingChange(g, event) {
  const select = event.target.closest('select[data-ranging-plan]');
  if (!select) return false;
  if (!rangingPlans(g.data).some(p => p.id === select.value)) return true;
  choices(g.world).set(select.dataset.rangingPlan, select.value);
  const card = select.closest('[data-ranging-card]');
  const unit = g.world.troops.find(u => u.id === select.dataset.rangingPlan);
  // Update only this card, preserving the keyboard focus and sheet scroll.
  if (card && unit) { card.innerHTML = cardContents(g, unit); card.querySelector('select')?.focus({preventScroll:true}); }
  return true;
}

export function rangingClick(g, button) {
  if (button.dataset.recallRanger) { g.recallRanger(button.dataset.recallRanger); return true; }
  if (!button.dataset.expedition) return false;
  g.sendExpedition(button.dataset.expedition, button.dataset.rangingDispatch ? choices(g.world).get(button.dataset.expedition) || 'standard' : 'standard');
  return true;
}
