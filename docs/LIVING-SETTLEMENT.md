# Living settlement intelligence

The existing shared resource balances remain authoritative. Finished producers now dispatch reserved batches to compatible hubs or demanding nearby workshops; unposted villagers walk cached, reachable routes, pause to load/unload, and show a resource-specific load/cart. Existing collectors can return to a useful nearby hub instead of always returning to the manor. Manual workplace assignments, orders, raids and expeditions take priority. Builders only borrow hauling work when no construction is waiting.

## Inventory and fallback contract

Producer jobs reserve, rather than subtract, `harvestBonus`. Unloading calls the existing capped `depositCentral`, then removes exactly the banked amount from the producer. Full or unreachable storage leaves the material at its source. Collection during a trip cannot duplicate resources. Destruction, relocation, commands, missing workers, alarms and a 180-second timeout cancel trips safely. Jobs are runtime state in WeakMaps: save/reload cancels trips while both inventories remain intact.

Storage and workshops still draw on the shared pool. Store-to-workshop trips carry bounded supply signals against that pool; they do **not** create a second inventory. Recent deliveries improve refinement throughput, while long hub distances reduce it gently. Refinement remains functional without haulers, with an 85% floor and 115% ceiling. Recipe prices, manual collection, crafted equipment and output accounting retain their established paths. Refiner outputs still bank centrally immediately; this update does not implement separate physical input/output inventories at every workshop.

Storage compatibility comes from the existing `storage` maps and recipe inputs. Shared capacity is checked by the existing storage system. Hubs do not have independently full inventories: total storage remains fungible. Congestion penalizes destinations with active incoming trips; distance and live recipe demand influence selection without global sorting. Grand Granary prefers food trips and speeds nearby food loading. Royal Forge Quarter improves industrial loading and modest workshop throughput. Grand Market Square improves unloading and serves as the preferred caravan destination. Existing Manor Gardens residential/recovery auras remain unchanged.

## Paths, roads and Great Works

Existing half-tile trails keep their thresholds, persistence and decay. Stone Road Network tier 1 unlocks player-purchased formal roads; tier 3 unlocks paving. Stores offers quoted connected routes (at most 64 half-tile sections per action), coordinates, a View action, and explicit construction buttons. No automatic spend occurs. Existing claims and standing building footprints constrain construction.

Dirt roads give 1.18x friendly movement; stone roads give 1.30x. These replace, rather than multiply, natural trail bonuses. Carts gain a restrained Road Network tier bonus, capped at 1.35x total terrain benefit. Enemies receive no road/trail bonus. Both road types persist without traffic. Higher Road Network tiers add bounded roadside signs/banners; Lantern Rows supplies practical road lanterns. Geometry is culled and details disappear at overview zoom.

Trade retains existing immediate prices, daily limits and rewards. A successful trade can request one visual caravan that enters, visits the market, pauses to unload and departs. Caravan animation does not resolve or repeat the economic transaction; alarms interrupt it safely. It is a representation of an existing trade, not a new trading game.

## Management

Stores contains Off, Traffic, Storage and Logistics overlays, preserving the five-action bottom dock and Collect Ready. Gold traffic marks identify established/high-use paths. Storage rings identify hubs. Logistics guide lines show active source/destination connections; they are not drawn route polylines. Building inspectors show current incoming/outgoing trips, latest producer destination, travel cost and workshop efficiency. Missing haulers/room/routes are reported as waiting producers.

`settlementTopology(world,data)` returns detached IDs/value records for hubs, gates, districts, formal/primary roads, intersections and active supply routes. It changes no raid targeting or balance. Districts derive from existing building types; no zoning rules or adjacency multipliers are imposed.

## Budgets and invalidation

- Planning every 2 simulated seconds; at most 24 active haul jobs, 10 haul carts and 1 caravan.
- At most 8 new reverse route fields per planning interval; 48 cached fields. Active trips can retain references to their own fields until completion.
- Grid Dijkstra uses deterministic neighbor order and road-weighted costs. Solid buildings obstruct logistics; friendly gates remain passable. Logistics never uses the legacy through-building fallback.
- Building layout/live state, road revision and territory count invalidate the logistics graph during planning; roster/building-count changes trigger earlier planning. Destinations and duties are checked during movement. Producers rotate through planning order to avoid permanently favoring the first entries.
- Supply entries are capped at 96 units per workshop/resource and pruned when buildings leave the world. Jobs, carts, guide lines and roadside detail have explicit bounds. Runtime caches never enter saves.
- Dense phone overviews coarsen coplanar mesh subdivisions (0.8 tiles instead of 0.4) for 96+ visible-roster villagers/enemies below 1.6x zoom; silhouettes and close-up geometry stay intact. Static face prefixes are cached in depth order. Formal surfaces replace covered natural-trail meshes, and wear under those roads does not invalidate unchanged geometry.
- Existing friendly movement now reuses computed paths across steps with a shared per-tick layout revision. Enemy routing retains its previous implementation. Friendly threat-avoidance reuses a route only while its next step remains outside live enemy danger.

## Saves and validation

Exactly one migration, v14 → v15, adds/sanitizes permanent `world.roads` and `home.roads`. Existing resource balances, building reserves, troops, campaign progress, trails, conquest and multiplayer records retain their existing migration paths. Old saves begin with no formal roads.

Run `npm test`, `npm run build`, `npm run test:browser`. Focused coverage lives in `tests/logistics.test.js`. The browser smoke includes a detached mature-settlement fixture and a real Stores-overlay interaction. It writes screenshots and `artifacts/settlement-browser-benchmark.json` for day, night, rain, warning and raid at 390×844, DPR 2, 150 villagers and 72 buildings.

For an optional CPU Canvas benchmark:

```sh
CANVAS_MODULE=/absolute/path/to/@napi-rs/canvas/index.js node scripts/settlement-benchmark.mjs
```

This optional tool is not a game dependency. Container CPU Canvas and desktop headless Chromium timings cannot establish physical iPhone performance. Heap deltas include garbage-collection effects and are not retained-memory measurements. The benchmark reports measured timings instead of asserting an arbitrary FPS threshold. Mobile acceptance requires browser/device review of those results.
