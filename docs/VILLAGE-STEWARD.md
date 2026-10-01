# Village Steward — complete update

All fourteen phases are implemented. Open **Stores → Village Steward** to opt in. Existing villages retain their previous behavior until enabled. Production targets, equipment fitting and queued construction have separate controls; no automatic campaign or woodland departures are added.

| Phase | Implemented behavior |
| --- | --- |
| 1. Performance foundation | One three-second planner; runtime caches; bounded work and no extra path searches |
| 2. Diagnostics | Workers, zero recipe inputs, full buffers, damage, next meal shortages and waiting deliveries; Show problem selects its building |
| 3. Budgets | Shared meal, repair, goal and ordered construction allocations; automatic refining, crafting, upgrades and training respect them |
| 4. Goals | One main and two supporting housing, defense, project or named conquest goals with real costs, progress and prerequisites |
| 5. Production | Stock targets plus next-meal, goal and queue demand; up to three upstream recipe stages; staffed refiners stop at target including buffered output |
| 6. Equipment | Optional fitting of better unlocked compatible owned/stocked tools, weapons and armor; manual slot pins and temporary duties respected |
| 7. Construction | Ordered queue, reorder/remove controls, one build/upgrade/completion step per planner interval, current placement and unlock validation |
| 8. Districts | Named groups, exclusive membership, staffing/chains/damage summaries, supply and repair priorities |
| 9. Coverage | Rotating bounded critical-site sample with geometric tower/post coverage and map focus for gaps |
| 10. Recovery | Prioritized manor, meal, defense, housing, storage and staffing plan; existing builders repair before queued work |
| 11. Blueprints | Capture layouts, review proposed coordinates/tiers and eventual total costs, then queue all entries atomically |
| 12. Readiness | Actual campaign/conquest prerequisites and supplies, roster information, woodland availability/duration/yields/risk; manual departures |
| 13. Reports | Short edge-trigger history for shortages, recovery, goal completion, equipment changes and queue completion |
| 14. Integration | Bounded additive saves, phone controls, regression tests, reproducible performance benchmark and post-merge browser/deployment validation |

## Controls and behavior

Stores keeps advanced sections collapsed. Building inspectors can queue the next upgrade, save a single-building blueprint or change district membership. People exposes separate **keep current / automatic fitting** choices for tools/weapons and armor. A successful manual equipment choice pins that slot. Automatic fitting consumes existing stock or uses already owned items, never purchases gear, respects named/oath restrictions, and ranks rarity before same-rarity stat score. No new units, art, particles or rendering effects are required.

Construction execution is separately opt-in. New-build plans originate from blueprint confirmation; existing upgrades can be queued from the inspector. Plans pay nothing until their actual stage starts. Repairs and active construction take precedence; an available builder and peaceful home village are required. Ruins, locks, tier gates, building limits, changed obstacles, unclaimed land and resource shortages stop a stage safely. Existing automatic building upgrades skip queued targets so the queue owns their order.

District **supply** priority orders its refiners first when inputs are scarce. **Repair** priority orders repairs ahead of peers in the same existing importance class; manor and defense priorities remain intact. Districts grant no hidden production or combat bonuses and do not move manually assigned workers or defenders.

Blueprints contain up to twelve relative building positions and their captured tiers. Capture near the camera or save a selected building. Set an integer anchor, **Preview** the proposed entries and full eventual tier cost, then **Queue blueprint**. Confirmation revalidates the whole layout and queue capacity; either every entry is queued or none is. Placement still follows existing overlap, breathing-gap, terrain and building-limit rules. Each stage rechecks live costs when executed; future tier gates can delay an upgrade. The preview is a coordinate/tier list, not a new rendered ghost overlay.

## Shared budgets

Current stores are allocated once in this order: next town meal, existing repairs, main goal, supporting goals, then construction queue. Matching goal/queue costs are deduplicated. Planned costs and shortages stay visible even when stores cannot cover them; manual reserve floors overlap protections rather than double-counting them. An operation may consume its own allocation and lower-priority allocations while preserving higher priorities. Unrelated automatic work preserves every allocation. Existing synchronous payments prevent two workers or workshops spending the same stock. Manual purchases remain available.

Production targets take the greater of the player stock target and aggregated planned demand. Staffed refiners also count goods waiting in building output buffers, preserve shared input budgets and keep existing partial-run/storage rules. Derived raw-input needs are recommendations and targets, not another resource escrow. Producers and manually assigned workers continue their existing jobs. Changing targets does not place buildings, recruit workers or launch expeditions.

## Performance and interpretation

The home planner runs every three seconds without replaying missed intervals. It samples at most 24 diagnostic buildings and returns at most 12 issues; coverage rotates through up to 24 critical sites against at most 24 ready defense posts, with eight reported gaps. Equipment checks at most eight villagers per pass. Queues contain at most twelve entries, districts at most six groups of 24 buildings, blueprints at most four layouts of twelve entries, readiness at most twelve cards and history at most twelve events.

Roster indexing, repair totals and cached refiner ordering run once per interval. Recipe catalogues are cached by data identity. Per-tick refining uses cached quotas and scalar budget checks; it adds no scans for district sorting or route finding. Paused/campaign play does not execute the home planner. Diagnostics use observed logistics counters rather than claiming a fresh road search. Coverage is a geometric sample: walls, traversable routes and posts outside the sample are not checked. Campaigns use authored starting rosters, so home equipment/health information is advisory rather than an invented launch gate.

Optional version-15 settings contain only controls, goals, queue entries, districts, blueprints and production targets; troop equipment pins are optional booleans. Imports clamp values, validate identifiers/tiers/coordinates, enforce caps and deduplicate membership. Planner cursors, reports, budgets and derived readiness stay in WeakMaps and are never saved. Phone controls use 44-pixel targets and retain input focus and expanded details.

## Verification

The full benchmark script `scripts/steward-benchmark.mjs` compares disabled/enabled behavior using the same seed, 150 villagers, 72 buildings, 390×844 viewport and DPR 2. Enabled runs exercise production targets, stocked auto-fitting, twelve queued placements and three full districts. Raw simulation/render timings and bounded-planner/path counters are in `steward-benchmark.json`. CPU Canvas measurements are a regression check, not physical iPhone/Safari verification; timing variance must not be interpreted as a speedup.

The recorded complete-update comparison was:

| Scenario | Average full CPU Canvas frame, off → on | Simulation p95, off → on | Movement searches, off / on |
| --- | --- | --- | --- |
| Peaceful | 71.97 → 71.25 ms | 6.64 → 7.01 ms | 33 / 33 |
| Raid | 67.93 → 67.96 ms | 10.17 → 10.52 ms | 3865 / 3865 |

Average frame times were essentially unchanged; simulation tails increased about 0.35–0.37 ms. This is not a guaranteed device frame-rate result. All planner caps held with the complete features enabled.

Tests cover budget ownership/deduplication, production buffer quotas, supply order, fitting restrictions, construction progression/collisions, atomic blueprints, district exclusivity, rotating coverage, readiness/recovery/report transitions, saved controls and runtime-only caches. Browser smoke verifies phone layout, focus/details, inspector queue/layout actions, production controls, districts, preview/confirmation, equipment pins and reload persistence. GitHub Actions also builds offline assets, captures mature settlement views and deploys only main.
