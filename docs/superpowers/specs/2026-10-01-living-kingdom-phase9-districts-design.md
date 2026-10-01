# Living Kingdom Phase 9 — emergent districts (design, 2026-10-01)

Crew: Boss Muse Spark, Grunt DeepSeek (code), Artist GPT (UI only).
20Q locked: Q17 cached 30s concentration grid, no manual painting; Q18 full use
(road priority, logistics, ambience, event placement, readability).

## Finding: type buckets exist, space doesn't
`settlementTopology` (logistics.js:83) returns living-ID buckets
industrial/food/residential/trade/military (only test consumes `industrial`).
Manual Steward districts are player-painted (steward-districts.js) — separate system,
untouched. Missing: spatial concentration grid, Civic/Market kinds, any consumer.

## Reuse (read-once)
- logistics.js:83 bucket regexes (keep all 5 keys byte-identical — pinned test).
- `src/systems/ambience.js:9-25` WORK_TYPES + workKinds (sort-first = district voice).
- roadImportance wear-only (slice 1-3) — gains district bonus now (unparks ruling).
- eventAnchor tie-break (frontier-events.js) — prefers matching district.
- Stores logistics card (ui.js:264-265) — district readout home.

## Rule
- New `districtGrid(world,data)` in logistics.js: 6×6-tile cells, living buildings
  only; cell kind = majority kind with ≥2 buildings else null. Kinds (ordered,
  first-match): farming, industrial, military, market, residential, civic.
  market = market/market-square/storehouse/grand-granary; civic = chapel/schoolroom/
  scriptorium/scout_post/bell-tower/bellcote/dawn-gate/monument/oathstone/moon-dial/
  cairnfield/hall; residential = cottage/longhouse/gardens/manor-gardens; farming +=
  grove/frostgrove/pond/deephole/blackwater-weir; industrial += lumber/timber_yard/
  mason_yard/tannery/butchery/workshop/emberglass; military += wall/rampart/ballista/
  grand-watchtower/archer_tower.
- Cached 30s per world (WeakMap, elapsed bucket), never per-frame/tick. Pure + detached.
- settlementTopology gains `cells` + `civic:[]` + `market:[]` (trade kept as alias).
- Consumers: road scorer +2 wear-equiv on industrial/market/farming cells; eventAnchor
  tie-breaks toward the `place.near` type's district; ambienceProfile.work sorts the
  district-dominant kind first (no filtering — quiet districts still sound).
  Logistics tick/graph/refinement deliberately untouched — "logistics use" in this
  slice means topology + readout + anchor only; deeper hooks belong to Phase 10.
- Readability: Stores logistics card lists districts with counts (B).

## Packets
### A — Inference + cache (DeepSeek, code)
`districtKindOf(type)`, `districtGrid` + 30s cache, topology extension.
Accept: cells correct on fixture; cache bucketing; old keys identical; suite green.
### B — Consumers (DeepSeek, code)
Road bonus, anchor tie-break, ambience sort-first. Tests each.
Accept: roads prefer work districts; anchors break ties; dominant kind first; suite green.
### C — District readout (GPT, UI only)
Stores logistics card district list. Accept: readable, suite green.

## Gates
`npm test && npm run build` green · old saves load · VERSION 15 · caps held · one
commit per packet · fetch + rebase, never force-push.
