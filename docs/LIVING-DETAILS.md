# Living detail and persistent paths

This pass preserves the existing Canvas/MeshScene art, camera, simulation, economy, combat numbers, Town Projects and save version (14). It supplements the existing building detail/masterwork layers rather than replacing the building roster.

## Audit and implementation map

The audit covered building-activity, character-art, scene3d, environment-art, atmosphere-art, cinematic-lighting, source-lighting, renderer, WorkSync, audio, footsteps, pathfinding, economy, combat, emergency, villagers, model, storage and the buildings/items/troops catalogs. Repository-wide animation, trigonometry, time, machinery, particle and movement searches identified these systems:

| System | Result |
| --- | --- |
| Mine carts, picks, rail activity | Open carts, four circular wheels, axles, visible ore, aligned rails and eased travel; distance-driven wheels; contact-driven pick and dust |
| Mill | Fixed mounting/axle, circular rim, hub, spokes and paddles; shared creak phase |
| Forge, smeltery, workshop, armory | Anvil/hammer contact, bellows compression, hot stock and bounded contact sparks |
| Lumber, timber yard, sawmill, whisper grove | Physical axe, chopping block, log, toothed reciprocating saw and cut-point dust |
| Farms, groves, pasture | Independently phased crop tips, sickle operator and produce containers |
| Ponds, Deephole, Blackwater Weir | Rod, line, bobber and expanding ripples at the bobber |
| Mason, bakery, fletcher, tannery, butchery | Tool-specific operators, bread tray/flour contact, shafts/feathers, hides and work stock |
| Doors and gates | Hinged residential doors; existing four-stage gate lift preserved with exterior tracks/chains and clear portal |
| Character walking, idle, equipment, cargo | Distance-driven alternating limbs, restrained bob, opposite arm swing, hand pivots, responsive loads and circular equipment-cart wheels; existing breathing retained |
| Combat weapons, missiles, damage, death | Hand-pivot swings, bow draw/string, traveling arrows/bolts, enemy recoil; existing damage/destruction/strike effects preserved |
| Fresh footprints and footsteps | Actual displacement contacts; limited retained fresh prints; stride accumulation survives intervening render frames |
| Fire, smoke, windows, lanterns, embers | Existing cinematic/source lighting retained; small flames agree with registered sources; forge smoke starts at its stack |
| Banners, trees, crops | Shared restrained wind with deterministic offsets and attached geometry |
| Rain/splashes, butterflies, fireflies, mist | Existing atmosphere and reduced-motion handling retained |
| Construction, completion, ruins, emergency effects | Existing systems preserved; supplemental work disabled for construction/destruction |
| Work, water, hearth and building ambient audio | Existing zoom-aware soundstage retained; physical motion and WorkSync use the same clock; calm suppresses work events |

All 62 building types have a checked prop-family mapping. Existing unique geometry remains; close detail supplements it with purposeful supplies, food, books, masonry, weapons, timber, hides and tools. Levels 3–6 progressively add rack capacity, supports, braces and metal reinforcement. The roster/tier test covers every building and four rotations.

## Desire paths

`world.trails` is an optional sparse half-tile map: canonical `ix,iy` keys contain `[wear,lastActiveElapsed]`. Wear is clamped to 100 and gains 0.4 per tile of actual travel. Exact segment/cell intersections make accumulation independent of frame subdivision. Standing, visual bobbing and enemy movement contribute nothing.

| Wear | Appearance | Friendly speed multiplier |
| --- | --- | --- |
| below 3 | unchanged terrain | 1.000 |
| 3–14.999 | faint trampled trail | 1.025 |
| 15–44.999 | earth path | 1.070 |
| 45–100 | packed earth, ruts and stones | 1.110 |

The multiplier composes with the caller's effective speed, without modifying stats or routes. Friendly workers, collectors, orders, builders, emergencies and soldiers share `move`; enemies do not receive the bonus. Walls, gates and navigation are unchanged. Stone Road Network carry/trade bonuses remain separate and unchanged.

Faint trails recover at 0.00008 wear per active simulation second, with cleanup at most once per minute. Dirt and packed paths persist indefinitely. Save/import normalizes malformed records safely, defaults missing data to an empty map, and preserves both campaign and home trails. No village reset or save-version bump is required.

Paths are ground-projected irregular connected patches/strips, with directional ruts and near-zoom stones. They rotate with the camera, carry no placement/hit owner and stay beneath fresh footprints. A renderer revision changes only on visual tier transitions, so accumulated traffic does not rebuild terrain every frame.

## Performance and validation

No dependencies or external graphics framework were added. Static supplies and path geometry use the existing mesh cache. Machinery is viewport-culled and capped at 48; moving doors at 24; wind foliage at 18, banners at 12 and flame details at 16. Small supplies require zoom 1.35, contact dust requires close zoom, and calm freezes decorative motion. Main wheel/cart geometry remains recognizable when still.

Local full suite: **921 tests pass**. Build passes. Focused tests cover distance wear, stillness, clamping, decay/persistence, malformed/legacy saves, local/export reload, speed composition/enemy exclusion, navigation and real campaign/home transitions; mechanical tests cover pivot/hub correctness, sound clocks, gait, tiers, rotations, inactive/calm behavior and cache reuse.

`scripts/living-review.mjs` optionally uses installed `@napi-rs/canvas` to produce contact sheets and a mature 62-building village at desktop/phone sizes, multiple angles, near/far zoom, calm and raid settings. These software-rendered views were inspected. An alternating 20-frame comparison against the parent on the same fixture measured median desktop 83.5→99.9 ms, phone 46.3→52.5 ms and far 83.9→90.3 ms. These are software-renderer measurements, not real-device frame rates. Phone faces increased 3,683→4,546; all fixture views remain below the existing 30,000-face budget.

The browser smoke suite also renders those six mature-village views on actual Chromium, checks trail save roundtrip/speed, retains existing gathering/raid/mission/UI/save checks, asserts no console errors, and writes screenshots into the CI artifact. Local Chrome is unavailable; the PR's existing Ubuntu CI must verify that browser suite.

Intentional limits: no new physics, continuous animal simulation, per-building quench scheduler, bespoke architectural replacement for every tier, or new sound assets. Existing unique roster detail remains the foundation. Real low-end phone performance and subjective in-game listening still warrant hands-on review; no deployment or merge is performed by this change.
