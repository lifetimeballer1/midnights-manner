# Living Kingdom Phase 8 — village health panel (design, 2026-10-01)

Crew: Boss Muse Spark, Grunt DeepSeek (code), Artist GPT (UI only).
20Q locked: Q15 Resources card, ~5s refresh; Q16 net-rates-only (no forecasts, no
traffic detail). §8 examples claimed ETA + traffic — those are forecasts/traffic and
stay deferred to Phase 9/10 (districts own routes; ETA needs demand history).

## Finding: nets exist, crew + walls don't
`renderResources` (`src/ui.js:260-277`) already shows net/day (dashboard.js:15-71),
sinks, wagons, storage cards. Missing current-state summaries: (a) builder breakdown
(building/repairing/roads/idle); (b) weakest wall section + side. Both are cheap
pure reads, not forecasts — inside Q16.

## Reuse (read-once)
- `src/systems/dashboard.js:15-71` pure-math pattern (extend, don't duplicate).
- `builderTask.kind` (construction/repair/road) + `eligible` shape (automation.js).
- `isWall` (walls.js), `buildingMaxHp` (endgame.js), `center` (model.js).
- `src/ui.js:260-277` Resources home (new card above storage cards).

## Rule
- New `settlementHealth(world,data)` in dashboard.js: `{builders:{construction,repair,road,idle}, weakWall:{id,type,side,frac}|null}`.
  Weakest = lowest hp/maxHp among living wall/gate/rampart; side = N/E/S/W by position
  vs map center. Idle = living builder-role, no task/order/emergency/expedition.
- Cached per world in module WeakMap, recomputed when elapsed crosses 5s (never per-frame).
- Card `SETTLEMENT HEALTH`: builders line + weak-wall line + one-line note pointing at
  existing net/day + routes cards. No ETA, no traffic detail (deferred).

## Packets
### A — Health snapshot (DeepSeek, code)
`settlementHealth` + 5s cache + tests (breakdown counts, weakest pick + side, cache
bucketing, empty-village nulls).
Accept: pure read-only; suite + build green.

### B — Health card (GPT, UI only)
Card in renderResources above storage cards, existing `resource-detail` classes.
Accept: reads on phone; suite green.

## Gates
`npm test && npm run build` green · old saves load · VERSION 15 · caps held · one
commit per packet · fetch + rebase, never force-push.
