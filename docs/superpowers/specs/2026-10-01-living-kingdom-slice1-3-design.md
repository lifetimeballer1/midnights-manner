# Living Kingdom Slice 1–3 — design (approved 20Q, 2026-10-01)

Architectural slice. No code until this spec is approved. Crew: Boss Muse Spark, Grunt DeepSeek V4.1 Flash (code only), Artist GPT 6.1 Sol Medium (visual only).

## Locked scope (20Q)
- Roads gated by Stone Road Network project; builders do roads idle-only after repairs/construction.
- One Settlement Policies screen in Stores; 11 categories with ON/OFF + max tier + priority + per-category % reserve.
- Project MVP: Stone Roads automation + Grand Granary food routing first. Lantern Rows activates existing lights only (later slice).
- Save-additive only. Hold 30k faces / 60 fx / 12 voices. Token-lean, ≤400-line files.

## Reuse (read-once)
- `src/systems/trails.js:3-21` desire paths (thresholds 3/15/45, bonuses, `recordTravel`, `trailMultiplier`).
- `src/systems/roads.js:4-25` formal roads (`ROAD_SPEED` 1/1.18/1.30, `roadQuote`/`buildRoad` gated by `greatWorkTier stone-road`, `busyRoutes` cached).
- `src/systems/automation.js:24,79-110` builder eligibility, `planBuilders` repairs→construction→autoUpgrade, 2s tick.
- `src/automation-ui.js:24-28` Stores automation card (per-type toggles, reserves).
- `src/systems/steward-budget.js:52-64` `spendingAvailable`/`canSpend` reserve gate.
- `src/systems/logistics.js:56,83` haul speed + `logisticsMetrics`/`busyRoutes` topology.
- `src/ui.js:260-261` Stores traffic/storage/logistics overlays + quoted road buttons.
- `data/buildings.json` `stone-road` minLevel 6 tierGates 3:9, `grand-granary` minLevel 5 food/flour/bread storage.
- `docs/LIVING-SETTLEMENT.md:11-17` hub preferences + road speed contract (extend, don't duplicate).

## Packets
### A — Builder road jobs (DeepSeek, code)
Extend `src/systems/automation.js:79-103` with idle-only road step after repairs/construction return. Source candidates from `busyRoutes` (`src/systems/roads.js:25`), validate via `roadQuote` (`:11-23`), spend via `canSpend` (`steward-budget.js:64`), execute via `buildRoad` (`roads.js:24`). New `builderTask.kind='road'` reuses `move()` loop (`automation.js:111-120`): choose → walk → work anim → consume → upgrade → continue nearby. Importance = traffic wear + haul/cart use + production→storage + homes→workplaces + gates/defenses + major buildings. No decay system.
Accept: 6-step visible loop; reserves never breached; raids pause; old saves load; tests: project-gated roads, road jobs, priorities.

### B — Settlement Policies (DeepSeek, code)
Extend `automationSettings` defaults (`automation.js:11`) + `automationStores` (`automation-ui.js:24-28`) to 11 categories: Walls, Gates, Towers, Farms, Mines, Lumber, Housing, Storage, Workshops, Military, Roads. Each: ON/OFF + max tier + priority + % reserve. Map types→categories in one table; reuse `autoUpgradeTypes`, `autoUpgradeMaxTier`, `reserves`. % reserve stored additive, enforced through `spendingAvailable`.
Accept: one screen replaces per-building clicks; per-category caps hold; additive migration; tests: categories, reserves, max-tier.

### C — Project integrations (DeepSeek, code)
Stone Roads: tier 1 unlocks formalize (`roadQuote` tier 1), tier 3 unlocks pave (tier 2) — already gated in `roads.js:12`; add automation controls + speed via `ROAD_SPEED`/`trailMultiplier` (no new multipliers). Grand Granary: prefer food trips + speed nearby food loading per `LIVING-SETTLEMENT.md:11`; routes become more important (weight, not % bonus). Visible behavior only.
Accept: gated formalize/pave test; granary food-route preference test; no balance drift.

### D — Road/project readability (GPT, visual only)
`src/ui.js:260-261` overlays, `src/logistics-art.js:12` road geometry, `src/systems/trails.js:50-71` trail meshes. Max 3 shots, ≤2 passes, Calm freezes motion, LOD far<0.6/near>1.5, static cache keys intact.
Accept: contact sheet shows desire→dirt→stone + granary hub emphasis; boss scores 90/100 on details/lighting.

## Clarifications (self-review 2026-10-01)
- `% reserve` = percent of `storageCap(world,data,resource)` per resource, stored as `automation.reservePct.{category}.{resource}`, enforced via `spendingAvailable` (never below floor). V1 default 0%.
- Road importance (v1 wear-only, cycle-safe) = deterministic cached wear score recomputed max once per 2s automation tick. Haul/hub/production→storage/workplace/gate weighting is a follow-up, not this slice.
- `Nearby` = within 12 half-tile cells of the just-completed road quote seed; builder continues only if `roadQuote` still validates.
- Per-category max tier clamps per-building `autoUpgradeMaxTier` (min of the two); category table maps `wall,gate,tower,farm,mine,lumber,cottage/longhouse,hall/storehouse/granary,workshops,barracks/defenses,roads`.
- `builderTask.kind='road'` target is `{seed, tier, cells}` (not buildingId); `move()` reuses existing builder travel loop; raids/missions clear it like repairs.

## Gates (every packet)
`npm test && npm run build` green · old saves load · orbit/pinch/grid/Motion intact · phone-first caps held · one commit per packet + ≤5-line summary · fetch + rebase, never force-push.
Heavy-scope notes (Q10/Q14/Q18): enemy valuable-targeting, full storm/night, full district ambience stay data-gated, Calm-safe, layered after A–C green.
