# Village Steward — first playable release

Implements phases 1–4 of the expanded update. Open **Stores → Village Steward** to enable it, protect meal and repair supplies, and select one main goal plus up to two secondary goals. Existing saves keep the feature off until selected.

The steward reports missing workers, zero recipe inputs, full production buffers, damaged buildings, meal shortages and deliveries waiting for hauling. **Show problem** centers and selects the affected building. Delivery warnings reflect the existing logistics planner; they do not claim a fresh route search proved a road unreachable. Diagnostics rotate through up to 24 buildings per pass, so larger villages may need multiple passes to show a particular site.

Goals cover an existing housing upgrade, a selected defense repair/upgrade, a building project, or preparation for a named frontier tribe. They display actual next-stage costs, unlock gates, progress and missing resources. Conquest readiness never launches an expedition. Goal selection does not enable a building's automatic upgrades; use the existing master and building controls to opt in. New building placement remains manual.

Shared budgets allocate current stores in this order: next town meal, existing building repairs, main goal, then secondary goals. Planned amounts and shortages remain visible even when stores cannot cover them. Manual reserve floors overlap these protections rather than adding the same protection twice. Automatic refining, equipment crafting and unrelated building upgrades preserve the allocations. A matching repair or upgrade may use its own allocation and lower-priority allocations, while protecting higher priorities. Costs are paid by existing synchronous transactions, so two workshops cannot spend the same stock. Manual purchases and actions remain available. Production priorities and demand coordination belong to the next release.

## Performance and saves

A runtime-only planner runs once every three seconds, samples at most 24 buildings for at most 12 diagnostics. It indexes the roster and aggregates repair costs once per interval, quotes at most three selected goals, shares one cached budget plan, reuses existing logistics metrics and starts no route searches. Paused/campaign play does not run the home steward. Disabling it restores previous automation reserve behavior. No new units, particles, rendering effects or simulation substeps are added.

Optional version-15 save settings contain only enabled/protection flags and selected goal records. Imported goals are bounded, validated and deduplicated. Planner state, diagnostic cursors and budget caches are WeakMaps and are never saved. Stores retains focused input controls and expanded details; controls use touch-sized targets.

The deterministic benchmark uses full simulation plus CPU Canvas rendering at 390×844, DPR 2, with 150 villagers and 72 buildings. CPU results and planner/path counters are in `steward-benchmark.json`. These measurements are a regression check, not physical iPhone verification. Browser smoke covers controls and reload persistence; existing project checks cover simulation and offline build behavior.

### Recorded sample

| Scenario | Simulation p95, off → on | Movement searches, off / on |
| --- | --- | --- |
| Peaceful | 7.34 → 6.27 ms | 32 / 32 |
| Raid | 9.61 → 9.05 ms | 3865 / 3865 |

Six enabled planner passes each inspected 24 diagnostic buildings. This sample showed no slowdown; normal timing variance means the lower numbers are not a claimed speedup. Budget protections intentionally change production output, so rendered face counts can differ. Tests also verify disabled/campaign inactivity, invalid-step handling, no planner catch-up loops and no new paths.

## Remaining releases

| Release | Phases | Work |
| --- | --- | --- |
| This release | 1–4 | Performance foundation, diagnostics, budgets, selected goals |
| Coordination | 5–7 | Production priorities, equipment fitting, construction queue |
| Village organization | 8–11 | Districts, defense coverage, recovery plans, blueprints |
| Readiness and reporting | 12–14 | Expedition readiness, village reports, integrated release validation |

Each later release must preserve manual overrides, bounded planning and iPhone controls, and pass tests, browser smoke and post-merge deployment checks.
