# Art Coverage

## Source And Rights

The actual building derivatives come from the user-provided `Game Assets.mixar / Midnights Manner - Reference Redesign` catalog. Source SHA-256: `3b9376e86a747414e3feded5d30b7e3a1e9e8446e3b8c832080f86b08e7b9e92`. The export GLB hashes are recorded in `data/art-manifest.json` and each mesh's `meta.sourceSHA256`. The user attested ownership of the entire catalog and authorized public-repository redistribution on 2026-10-05. Evidence is retained in `data/external_assets.json` under `catalogSources.game-assets-mixar`. This is user-attested permission, not an independently verified CC0 license.

## Game Buildings

Every current game building ID and its existing authored tier count maps to the matching `MMR | <id> | T<NN> Architecture` object. The runtime uses the actual flat-face conversion through the existing Canvas renderer. Model loads are on-demand by placed type/tier; disabled, missing, invalid, unfinished, and ruined assets keep the procedural fallback. Tier counts, footprints, collisions, simulation, and saves are unchanged.

| Game ID | Display name | Tiers | Converted source files | State |
| --- | --- | ---: | --- | --- |
| `hall` | Manor Hall | 6 | `mmr-hall-1.json`, `mmr-hall-2.json`, `mmr-hall-3.json`, `mmr-hall-4.json`, `mmr-hall-5.json`, `mmr-hall-6.json` | mapped |
| `farm` | Wheat Farm | 6 | `mmr-farm-1.json`, `mmr-farm-2.json`, `mmr-farm-3.json`, `mmr-farm-4.json`, `mmr-farm-5.json`, `mmr-farm-6.json` | mapped |
| `lumber` | Timber Yard | 6 | `mmr-lumber-1.json`, `mmr-lumber-2.json`, `mmr-lumber-3.json`, `mmr-lumber-4.json`, `mmr-lumber-5.json`, `mmr-lumber-6.json` | mapped |
| `timber_yard` | Timber Camp | 6 | `mmr-timber_yard-1.json`, `mmr-timber_yard-2.json`, `mmr-timber_yard-3.json`, `mmr-timber_yard-4.json`, `mmr-timber_yard-5.json`, `mmr-timber_yard-6.json` | mapped |
| `mine` | Moonstone Mine | 6 | `mmr-mine-1.json`, `mmr-mine-2.json`, `mmr-mine-3.json`, `mmr-mine-4.json`, `mmr-mine-5.json`, `mmr-mine-6.json` | mapped |
| `barracks` | Barracks | 6 | `mmr-barracks-1.json`, `mmr-barracks-2.json`, `mmr-barracks-3.json`, `mmr-barracks-4.json`, `mmr-barracks-5.json`, `mmr-barracks-6.json` | mapped |
| `wall` | Palisade | 6 | `mmr-wall-1.json`, `mmr-wall-2.json`, `mmr-wall-3.json`, `mmr-wall-4.json`, `mmr-wall-5.json`, `mmr-wall-6.json` | mapped |
| `stonewall` | Stone Wall | 6 | `mmr-stonewall-1.json`, `mmr-stonewall-2.json`, `mmr-stonewall-3.json`, `mmr-stonewall-4.json`, `mmr-stonewall-5.json`, `mmr-stonewall-6.json` | mapped |
| `gate` | Timber Gate | 6 | `mmr-gate-1.json`, `mmr-gate-2.json`, `mmr-gate-3.json`, `mmr-gate-4.json`, `mmr-gate-5.json`, `mmr-gate-6.json` | native state fallback |
| `rampart` | Earthen Rampart | 6 | `mmr-rampart-1.json`, `mmr-rampart-2.json`, `mmr-rampart-3.json`, `mmr-rampart-4.json`, `mmr-rampart-5.json`, `mmr-rampart-6.json` | mapped |
| `tower` | Watchtower | 6 | `mmr-tower-1.json`, `mmr-tower-2.json`, `mmr-tower-3.json`, `mmr-tower-4.json`, `mmr-tower-5.json`, `mmr-tower-6.json` | mapped |
| `archer_tower` | Archer Tower | 6 | `mmr-archer_tower-1.json`, `mmr-archer_tower-2.json`, `mmr-archer_tower-3.json`, `mmr-archer_tower-4.json`, `mmr-archer_tower-5.json`, `mmr-archer_tower-6.json` | mapped |
| `ballista` | Ballista Tower | 6 | `mmr-ballista-1.json`, `mmr-ballista-2.json`, `mmr-ballista-3.json`, `mmr-ballista-4.json`, `mmr-ballista-5.json`, `mmr-ballista-6.json` | mapped |
| `bastion` | Grand Bastion | 6 | `mmr-bastion-1.json`, `mmr-bastion-2.json`, `mmr-bastion-3.json`, `mmr-bastion-4.json`, `mmr-bastion-5.json`, `mmr-bastion-6.json` | mapped |
| `trap` | Spike Trap | 3 | `mmr-trap-1.json`, `mmr-trap-2.json`, `mmr-trap-3.json` | native state fallback |
| `cottage` | Moonlit Cottage | 6 | `mmr-cottage-1.json`, `mmr-cottage-2.json`, `mmr-cottage-3.json`, `mmr-cottage-4.json`, `mmr-cottage-5.json`, `mmr-cottage-6.json` | mapped |
| `longhouse` | Longhouse | 6 | `mmr-longhouse-1.json`, `mmr-longhouse-2.json`, `mmr-longhouse-3.json`, `mmr-longhouse-4.json`, `mmr-longhouse-5.json`, `mmr-longhouse-6.json` | mapped |
| `pond` | Stillwater Pond | 6 | `mmr-pond-1.json`, `mmr-pond-2.json`, `mmr-pond-3.json`, `mmr-pond-4.json`, `mmr-pond-5.json`, `mmr-pond-6.json` | mapped |
| `pasture` | Night Pasture | 6 | `mmr-pasture-1.json`, `mmr-pasture-2.json`, `mmr-pasture-3.json`, `mmr-pasture-4.json`, `mmr-pasture-5.json`, `mmr-pasture-6.json` | mapped |
| `butchery` | Smokehouse Butchery | 6 | `mmr-butchery-1.json`, `mmr-butchery-2.json`, `mmr-butchery-3.json`, `mmr-butchery-4.json`, `mmr-butchery-5.json`, `mmr-butchery-6.json` | mapped |
| `scriptorium` | Scriptorium | 6 | `mmr-scriptorium-1.json`, `mmr-scriptorium-2.json`, `mmr-scriptorium-3.json`, `mmr-scriptorium-4.json`, `mmr-scriptorium-5.json`, `mmr-scriptorium-6.json` | mapped |
| `scout_post` | Wayfinder Post | 6 | `mmr-scout_post-1.json`, `mmr-scout_post-2.json`, `mmr-scout_post-3.json`, `mmr-scout_post-4.json`, `mmr-scout_post-5.json`, `mmr-scout_post-6.json` | mapped |
| `chapel` | Moonchapel | 6 | `mmr-chapel-1.json`, `mmr-chapel-2.json`, `mmr-chapel-3.json`, `mmr-chapel-4.json`, `mmr-chapel-5.json`, `mmr-chapel-6.json` | mapped |
| `forge` | Emberforge | 6 | `mmr-forge-1.json`, `mmr-forge-2.json`, `mmr-forge-3.json`, `mmr-forge-4.json`, `mmr-forge-5.json`, `mmr-forge-6.json` | mapped |
| `armory` | Wardarmory | 6 | `mmr-armory-1.json`, `mmr-armory-2.json`, `mmr-armory-3.json`, `mmr-armory-4.json`, `mmr-armory-5.json`, `mmr-armory-6.json` | mapped |
| `workshop` | Tinker Workshop | 6 | `mmr-workshop-1.json`, `mmr-workshop-2.json`, `mmr-workshop-3.json`, `mmr-workshop-4.json`, `mmr-workshop-5.json`, `mmr-workshop-6.json` | mapped |
| `tannery` | Hide Tannery | 6 | `mmr-tannery-1.json`, `mmr-tannery-2.json`, `mmr-tannery-3.json`, `mmr-tannery-4.json`, `mmr-tannery-5.json`, `mmr-tannery-6.json` | mapped |
| `grove` | Moonberry Grove | 6 | `mmr-grove-1.json`, `mmr-grove-2.json`, `mmr-grove-3.json`, `mmr-grove-4.json`, `mmr-grove-5.json`, `mmr-grove-6.json` | mapped |
| `whisper-grove` | Whisper Grove | 6 | `mmr-whisper-grove-1.json`, `mmr-whisper-grove-2.json`, `mmr-whisper-grove-3.json`, `mmr-whisper-grove-4.json`, `mmr-whisper-grove-5.json`, `mmr-whisper-grove-6.json` | mapped |
| `watchfire` | Signal Watchfire | 6 | `mmr-watchfire-1.json`, `mmr-watchfire-2.json`, `mmr-watchfire-3.json`, `mmr-watchfire-4.json`, `mmr-watchfire-5.json`, `mmr-watchfire-6.json` | mapped |
| `mason_yard` | Mason Yard | 6 | `mmr-mason_yard-1.json`, `mmr-mason_yard-2.json`, `mmr-mason_yard-3.json`, `mmr-mason_yard-4.json`, `mmr-mason_yard-5.json`, `mmr-mason_yard-6.json` | mapped |
| `frostgrove` | Frostwood Grove | 6 | `mmr-frostgrove-1.json`, `mmr-frostgrove-2.json`, `mmr-frostgrove-3.json`, `mmr-frostgrove-4.json`, `mmr-frostgrove-5.json`, `mmr-frostgrove-6.json` | mapped |
| `smeltery` | Ember Smeltery | 6 | `mmr-smeltery-1.json`, `mmr-smeltery-2.json`, `mmr-smeltery-3.json`, `mmr-smeltery-4.json`, `mmr-smeltery-5.json`, `mmr-smeltery-6.json` | mapped |
| `deephole` | Deephole | 6 | `mmr-deephole-1.json`, `mmr-deephole-2.json`, `mmr-deephole-3.json`, `mmr-deephole-4.json`, `mmr-deephole-5.json`, `mmr-deephole-6.json` | mapped |
| `blackwater-weir` | Blackwater Weir | 6 | `mmr-blackwater-weir-1.json`, `mmr-blackwater-weir-2.json`, `mmr-blackwater-weir-3.json`, `mmr-blackwater-weir-4.json`, `mmr-blackwater-weir-5.json`, `mmr-blackwater-weir-6.json` | mapped |
| `emberglass` | Emberglass Mine | 6 | `mmr-emberglass-1.json`, `mmr-emberglass-2.json`, `mmr-emberglass-3.json`, `mmr-emberglass-4.json`, `mmr-emberglass-5.json`, `mmr-emberglass-6.json` | mapped |
| `market` | Wild Market | 6 | `mmr-market-1.json`, `mmr-market-2.json`, `mmr-market-3.json`, `mmr-market-4.json`, `mmr-market-5.json`, `mmr-market-6.json` | mapped |
| `oathstone` | Oathstone | 1 | `mmr-oathstone-1.json` | mapped |
| `fire-trap` | Fire Trap | 1 | `mmr-fire-trap-1.json` | native state fallback |
| `bellcote` | Bellcote | 1 | `mmr-bellcote-1.json` | mapped |
| `schoolroom` | Schoolroom | 6 | `mmr-schoolroom-1.json`, `mmr-schoolroom-2.json`, `mmr-schoolroom-3.json`, `mmr-schoolroom-4.json`, `mmr-schoolroom-5.json`, `mmr-schoolroom-6.json` | mapped |
| `fletcher` | Fletcher | 6 | `mmr-fletcher-1.json`, `mmr-fletcher-2.json`, `mmr-fletcher-3.json`, `mmr-fletcher-4.json`, `mmr-fletcher-5.json`, `mmr-fletcher-6.json` | mapped |
| `shieldwall-yard` | Shieldwall Yard | 6 | `mmr-shieldwall-yard-1.json`, `mmr-shieldwall-yard-2.json`, `mmr-shieldwall-yard-3.json`, `mmr-shieldwall-yard-4.json`, `mmr-shieldwall-yard-5.json`, `mmr-shieldwall-yard-6.json` | mapped |
| `moon-dial` | Moon Dial | 1 | `mmr-moon-dial-1.json` | mapped |
| `bell-tower` | Bell Tower | 6 | `mmr-bell-tower-1.json`, `mmr-bell-tower-2.json`, `mmr-bell-tower-3.json`, `mmr-bell-tower-4.json`, `mmr-bell-tower-5.json`, `mmr-bell-tower-6.json` | mapped |
| `sunken-chapel` | Sunken Chapel | 6 | `mmr-sunken-chapel-1.json`, `mmr-sunken-chapel-2.json`, `mmr-sunken-chapel-3.json`, `mmr-sunken-chapel-4.json`, `mmr-sunken-chapel-5.json`, `mmr-sunken-chapel-6.json` | mapped |
| `cairnfield` | Cairnfield | 1 | `mmr-cairnfield-1.json` | mapped |
| `dawn-gate` | Dawn Gate | 1 | `mmr-dawn-gate-1.json` | mapped |
| `sawmill` | Sawmill | 6 | `mmr-sawmill-1.json`, `mmr-sawmill-2.json`, `mmr-sawmill-3.json`, `mmr-sawmill-4.json`, `mmr-sawmill-5.json`, `mmr-sawmill-6.json` | mapped |
| `storehouse` | Storehouse | 6 | `mmr-storehouse-1.json`, `mmr-storehouse-2.json`, `mmr-storehouse-3.json`, `mmr-storehouse-4.json`, `mmr-storehouse-5.json`, `mmr-storehouse-6.json` | mapped |
| `mill` | Gristmill | 6 | `mmr-mill-1.json`, `mmr-mill-2.json`, `mmr-mill-3.json`, `mmr-mill-4.json`, `mmr-mill-5.json`, `mmr-mill-6.json` | mapped |
| `bakery` | Bakery | 6 | `mmr-bakery-1.json`, `mmr-bakery-2.json`, `mmr-bakery-3.json`, `mmr-bakery-4.json`, `mmr-bakery-5.json`, `mmr-bakery-6.json` | mapped |
| `market-square` | Grand Market Square | 6 | `mmr-market-square-1.json`, `mmr-market-square-2.json`, `mmr-market-square-3.json`, `mmr-market-square-4.json`, `mmr-market-square-5.json`, `mmr-market-square-6.json` | mapped |
| `grand-granary` | Grand Granary | 6 | `mmr-grand-granary-1.json`, `mmr-grand-granary-2.json`, `mmr-grand-granary-3.json`, `mmr-grand-granary-4.json`, `mmr-grand-granary-5.json`, `mmr-grand-granary-6.json` | mapped |
| `manor-gardens` | Manor Gardens | 6 | `mmr-manor-gardens-1.json`, `mmr-manor-gardens-2.json`, `mmr-manor-gardens-3.json`, `mmr-manor-gardens-4.json`, `mmr-manor-gardens-5.json`, `mmr-manor-gardens-6.json` | mapped |
| `stone-road` | Stone Road Network | 6 | `mmr-stone-road-1.json`, `mmr-stone-road-2.json`, `mmr-stone-road-3.json`, `mmr-stone-road-4.json`, `mmr-stone-road-5.json`, `mmr-stone-road-6.json` | mapped |
| `city-wall` | City Wall Project | 6 | `mmr-city-wall-1.json`, `mmr-city-wall-2.json`, `mmr-city-wall-3.json`, `mmr-city-wall-4.json`, `mmr-city-wall-5.json`, `mmr-city-wall-6.json` | mapped |
| `forge-quarter` | Royal Forge Quarter | 6 | `mmr-forge-quarter-1.json`, `mmr-forge-quarter-2.json`, `mmr-forge-quarter-3.json`, `mmr-forge-quarter-4.json`, `mmr-forge-quarter-5.json`, `mmr-forge-quarter-6.json` | mapped |
| `lantern-rows` | Lantern Rows | 6 | `mmr-lantern-rows-1.json`, `mmr-lantern-rows-2.json`, `mmr-lantern-rows-3.json`, `mmr-lantern-rows-4.json`, `mmr-lantern-rows-5.json`, `mmr-lantern-rows-6.json` | mapped |
| `monument` | Monument of the Manner | 6 | `mmr-monument-1.json`, `mmr-monument-2.json`, `mmr-monument-3.json`, `mmr-monument-4.json`, `mmr-monument-5.json`, `mmr-monument-6.json` | mapped |
| `manner-citadel` | The Manner Citadel | 4 | `mmr-manner-citadel-1.json`, `mmr-manner-citadel-2.json`, `mmr-manner-citadel-3.json`, `mmr-manner-citadel-4.json` | mapped |
| `grand-watchtower` | Grand Watchtower | 3 | `mmr-grand-watchtower-1.json`, `mmr-grand-watchtower-2.json`, `mmr-grand-watchtower-3.json` | mapped |

Coverage is enforced by `tests/art-coverage.test.js`; regenerate registrations with `node scripts/register-mixar-building-catalog.mjs`.

## Remaining Catalog Work

These source groups are queued or partially integrated. Their existing procedural, sprite, and previously reviewed CC0 paths remain active. Each row has a concrete integration gate; the catalog permission is user-attested; third-party source licenses are not inferred from appearance.

| Source group | Catalog count | State | Blocker before integration |
| --- | ---: | --- | --- |
| Characters | 73 variants / 37 game professions | queued | Map variants to all existing troop/enemy archetypes; validate rigs, clips, pivots, anchors, LOD budgets, and source rights. |
| Equipment | 88 forms | queued | Map item IDs to attachment anchors and ensure hand/back/chest silhouettes stay inside the baked-pose budgets. |
| Terrain blocks | 15 | queued | Match the five biome routes, ground heights, camera projection, phone caps, and deterministic tile ownership. |
| Vegetation and nature | 45 + 45 variants | partial | Seven tree meshes converted intact: `catalog-tree-single-a` and A-small/A-medium enabled; four larger clusters held over the 320-face budget. `catalog-resource-stone` supplies shore/path stones. Remaining biomes/forms and source-specific wind anchors are queued. |
| Props | 21 forms | queued | Map only useful forms to existing building/job consumers and check overlap with shipped props. |
| Resource piles | 40 stages | partial | `catalog-resource-lumber` supplies complete scale-stepped sawmill stacks; other resource keys and distinct authored stages remain queued. |
| Faction camps | 5 | queued | Map to existing faction camp definitions, preserve selection/lore, and stay inside scenery caps. |
| Landmarks | 10 | queued | Map to existing world hotspot IDs and preserve their selectable location/pivot. |
| Animation source collections | 6 | queued | Bake only verified named clips offline; no runtime skeletal-animation loader. |
