import {reserveCapacity, resourceInfo} from '../resources.js';
import {OUTPUT_CAP} from './refiner-output.js';
import {mealConfig} from './food.js';
import {logisticsMetrics} from './logistics.js';
import {buildingMaxHp} from './endgame.js';

export const DIAGNOSTIC_LIMITS = Object.freeze({buildings: 24, issues: 12});
const clamp = (value, fallback, max) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : fallback;

// A rotating sample, not a fresh route search or a second logistics planner.
// Callers retain nextCursor in runtime state, never in the village save.
export function inspectSettlement(game, options = {}) {
  const {world: w, data: d} = game;
  const buildings = w.buildings || [], issues = [];
  const limit = clamp(options.buildingLimit, DIAGNOSTIC_LIMITS.buildings, DIAGNOSTIC_LIMITS.buildings);
  const issueLimit = clamp(options.issueLimit, DIAGNOSTIC_LIMITS.issues, DIAGNOSTIC_LIMITS.issues);
  const start = buildings.length ? clamp(options.start, 0, Number.MAX_SAFE_INTEGER) % buildings.length : 0;
  const crew = new Map();
  let mouths = 0;
  for (const u of w.troops || []) {
    if (!u) continue;
    if ((u.hp ?? 0) >= 0) mouths++;
    if (!(u.hp > 0) || !u.workplace) continue;
    let posted = crew.get(u.workplace);
    if (!posted) crew.set(u.workplace, posted = []);
    posted.push(u.type);
  }
  const seen = new Set();
  const add = issue => { if (issues.length < issueLimit && !seen.has(issue.id)) { seen.add(issue.id); issues.push(issue); } };
  const meal = mealConfig(d);
  for (const [resource, amount] of [['food', Math.ceil(mouths * meal.foodPerVillager)], ['bread', Math.ceil(mouths * meal.breadPerVillager)]]) {
    const missing = Math.max(0, amount - (w.resources?.[resource] || 0));
    if (missing > 0) add({id: `meal:${resource}`, label: 'Next meal shortfall', detail: `${Math.ceil(missing)} ${resourceInfo(resource).label} needed for the next village meal.`, resource, severity: 'warning'});
  }
  const blocked = logisticsMetrics(w).blocked;
  if (blocked > 0) add({id: 'deliveries', label: 'Deliveries waiting', detail: `${blocked} batches could not get a hauling job at the last logistics check. Check spare hands, storage room and access.`, severity: 'info'});

  const inspected = Math.min(limit, buildings.length);
  for (let i = 0; i < inspected; i++) {
    const b = buildings[(start + i) % buildings.length], spec = d.buildings?.[b?.type];
    if (!b || !spec) continue;
    const base = {buildingId: b.id};
    if (b.hp <= 0) {
      add({...base, id: `ruin:${b.id}`, label: `${spec.name} is ruined`, detail: 'Repair this building to restore its work.', severity: 'warning'});
      continue;
    }
    if (b.remaining > 0) continue;
    const maxHp = buildingMaxHp(b, d);
    if (Number.isFinite(maxHp) && b.hp < maxHp) add({...base, id: `repair:${b.id}`, label: `${spec.name} needs repairs`, detail: `${Math.ceil(maxHp - b.hp)} HP missing.`, severity: 'warning'});
    const staffed = (crew.get(b.id) || []).some(type => d.troops?.[type]?.job?.workplace === b.type || (spec.hosts || []).includes(type));
    if (spec.workplace && !staffed) add({...base, id: `staff:${b.id}`, label: `${spec.name} has no workers`, detail: 'Assign a matching profession in Workers.', severity: 'info'});
    if (spec.production && (b.harvestBonus || 0) >= reserveCapacity(spec, b.level || 1)) add({...base, id: `harvest:${b.id}`, label: `${spec.name} reserve full`, detail: `Collect or haul its ${resourceInfo(spec.production).label} to resume passive production.`, resource: spec.production, severity: 'info'});
    for (const [resource, amount] of Object.entries(b.outputReserve || {})) {
      if (amount >= OUTPUT_CAP) add({...base, id: `output:${b.id}:${resource}`, label: `${spec.name} output full`, detail: `${resourceInfo(resource).label} is waiting for collection or delivery.`, resource, severity: 'info'});
    }
    if (!staffed) continue;
    for (const recipe of spec.refine || []) {
      if (!(recipe.perSec > 0)) continue;
      for (const [resource, amount] of Object.entries(recipe.in || {})) {
        // Refiners permit fractional runs: a small positive stock is slow,
        // not stalled. Diagnose only the actual zero-input condition.
        if (amount > 0 && !(w.resources?.[resource] > 0)) add({...base, id: `input:${b.id}:${resource}`, label: `${spec.name} needs ${resourceInfo(resource).label}`, detail: 'This recipe has no input available in shared stores.', resource, severity: 'warning'});
      }
    }
  }
  return {issues, inspected, nextCursor: buildings.length ? (start + inspected) % buildings.length : 0};
}
