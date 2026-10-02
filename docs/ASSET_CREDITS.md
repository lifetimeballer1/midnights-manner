# Free low-poly asset pass

All seven integrated models are **Quaternius, CC0 1.0**, individually verified on Poly Pizza on 2026-10-01. Attribution is voluntary. Public repository distribution, commercial game use and adaptation are permitted by CC0. Exact pages, download URLs, local files, modifications and consumers are retained in `data/external_assets.json`.

| Asset | Original page | Uses | Source triangles → Canvas faces |
| --- | --- | --- | --- |
| Barrel | https://poly.pizza/m/zjCQP1TAci | Water/cargo props at farms, trade, Longhouse and upgraded workplaces | 1,312 → 173 |
| Crate | https://poly.pizza/m/3OEFd1AWfa | Storehouse, mine, lumber, workshops, military and masterwork supplies | 784 → 193 |
| Bag | https://poly.pizza/m/VRfAODZ0Xk | Seed/supply sacks at existing workplace attachment points | 304 → 83 |
| Bag Open | https://poly.pizza/m/rJuZexcuhU | Mill, bakery and Granary grain | 280 → 129 |
| Hay | https://poly.pizza/m/Yu8TOERkpw | Farm/pasture supplies from tier 2 | 488 → 85 |
| Bench | https://poly.pizza/m/jLxjFxFRpw | Tier 2+ Longhouse, hall, cottage, Market Square, Gardens; Citadel tier 4 | 376 → 84 |
| Rock | https://poly.pizza/m/aCtxEoSLEZ | Temperate frontier stone scenery; scorched scenery keeps its own palette | 108 → 78 |

Six props share Quaternius's Medieval Village Pack visual language. The rock uses the same artist's simple faceted style. Buildings retain their original tier silhouettes, chimneys, source lights, moving doors and working mechanisms. No downloaded character rig, static cart or complete building replaces those systems.

## Baked rigged characters (R3)

Ten offline-baked pose sets from three **Quaternius, CC0 1.0** packs supply the R3 real-geometry pass. Each set is stand / walk-a / walk-b / attack at two face budgets (hi 260, lo 110), written to `assets/meshes/baked/<set>-<pose>-<hi|lo>.json` (80 files, 1.31 MiB). They render through the existing flat-face Canvas path; no runtime glTF, texture, skin or animation loader is added. Weapon mesh nodes are excluded at bake time because the game's gear system draws held tools; enemy sets receive a flat faction tint wash in the baker. The procedural body remains the automatic fallback when a set is disabled, missing, unknown or beyond the lo LOD. Provenance, source zip SHA-256 values and the exact clip/fraction choices live in `data/external_assets.json`.

| Set | Pack (CC0 1.0) | Clips baked (fraction) | Poses × LODs | In-game consumers |
| --- | --- | --- | --- | --- |
| Warrior | LowPoly RPG Characters | Idle 0.0, Walk 0.0, Walk 0.5, Sword_Attack 0.45 | 4 × 2 | fighters: warrior, warden, pikewoman, halberdier, oathsworn, squire |
| Ranger | LowPoly RPG Characters | Idle 0.0, Walk 0.0, Walk 0.5, Bow_Attack_Shoot 0.45 | 4 × 2 | archers/rangers: archer, ranger, longbowman |
| Rogue | LowPoly RPG Characters | Idle 0.0, Walk 0.0, Walk 0.5, Dagger_Attack 0.45 | 4 × 2 | scouts/light: scout |
| Wizard | LowPoly RPG Characters | Idle 0.0, Walk 0.0, Walk 0.5, Staff_Attack 0.45 | 4 × 2 | scholars/robes: scholar, chorister, tidecaller |
| Cleric | LowPoly RPG Characters | Idle 0.0, Walk 0.0, Walk 0.5, Staff_Attack 0.45 | 4 × 2 | healers: healer |
| Monk | LowPoly RPG Characters | Idle 0.0, Walk 0.0, Walk 0.5, Attack 0.45 | 4 × 2 | builders/labor: builders, collectors and trade keepers |
| Skeleton | Animated Monster Pack | Skeleton_Idle 0.0, Skeleton_Running 0.0/0.5, Skeleton_Attack 0.45 | 4 × 2 | Pale Host and Pale Court enemies (pale-bone tint) |
| Human — Thornband | Animated Human Low Poly | Idle 0.0, Walk 0.0/0.5, Punch 0.4 | 4 × 2 | Thornband enemies (moss tint) |
| Human — Cinder | Animated Human Low Poly | Idle 0.0, Walk 0.0/0.5, Punch 0.4 | 4 × 2 | Cinder Clan enemies (soot tint) |
| Human — Ember | Animated Human Low Poly | Idle 0.0, Walk 0.0/0.5, Punch 0.4 | 4 × 2 | Ember Legion enemies (ember tint) |

Reproduce from the repository root with Python and development-only dependencies:

```sh
python -m pip install --user numpy Pillow fast-simplification
python scripts/dev-rig/rebuild_baked_r3.py
```

The toolchain downloads FBX2glTF v0.9.7 and the three pack zips with SHA-256 checks, converts each FBX rig to GLB, and bakes the poses. The 10.5 MB converter and the pack zips stay outside the repository and the Pages build; `scripts/build.mjs` ships public files only. CC0 license texts are retained under `scripts/dev-rig/sources/`.

## Audit inventory and routing

The current game projects Z-up flat-colored 3D faces onto Canvas, with `MeshScene` face culling/depth ordering, owner-based selection, cached static structures, existing lighting/AO and separate moving mechanisms. It has no runtime GLB, texture, skin or skeletal-animation pipeline. Sprites remain in inventory/build cards. Asset conversion must happen offline rather than introducing another renderer.

| Existing categories | Current home | Pass treatment |
| --- | --- | --- |
| Villagers, soldiers, builders, farmers, miners, lumber workers, crafters, merchants, special professions, enemies | `character-art.js`, `character-motion.js`, `work-motion.js` | Preserve job silhouettes, held equipment and existing poses |
| Animals | Procedural pasture/environment geometry | Preserve existing silhouettes |
| Houses, Longhouse, farms, mines, lumber, workshops, smithies, storage, military and research buildings, Great Works, decorations | `scene3d.js`, data-defined tiers | Supplement with function-specific supplies/seating; retain structures and upgrade progression |
| Walls, gates, towers and defenses | `scene3d.js`, `mechanical-art.js` | Preserve existing torches, moving gates, defense cues and silhouettes |
| Trees, rocks, bushes, grass, crops, mushrooms and flowers | `environment-art.js` and procedural scenery | Selective rock replacement; preserve themed flora and existing density/culling |
| Logs, barrels, crates, sacks, market/mining/farming/crafting props and furniture | `scene3d.js`, `living-props.js` | Replace eligible crate/barrel/sack helpers; add grain, hay and seating |
| Carts, wagons, wheels, tools, weapons and shields | `mechanical-art.js`, `character-art.js`, workplace meshes | Preserve existing work/attack/carry motion and correct pivots |

## Conversion and budgets

Original GLBs live under `scripts/asset-sources/`; they are repository review inputs and are not copied to the Pages build. Only flat geometry in `src/external-geometry.js` is used at runtime. The manifest is shipped with the data.

Reproduce from the repository root with Python and development-only dependencies:

```sh
python3 -m pip install numpy Pillow fast-simplification
python3 scripts/convert-external-assets.py
```

The converter bakes node transforms, preserves winding, changes Y-up to Z-up, places pivots at ground/footprint center, normalizes height, converts linear material factors to sRGB, matches the existing palette, simplifies each material independently, clusters vertices and merges adjacent convex coplanar faces. Normals, textures, PBR properties and unused data are removed. Unsupported skins, animations and required extensions reject conversion. No executable content is loaded from downloaded packs.

The seven source meshes total **3,652 triangles**, reduced to **825 Canvas polygons** (polygon counts are not equivalent to GPU triangle counts). Runtime geometry is roughly 36 KB uncompressed. Close views start at 1.55× zoom. Imported prop faces are capped at 1,400 per scene (2,400 at 2.2× and closer), with a separate 320-face nature allowance. Phones use tighter 800/1,200 prop and 156 nature face caps. These caps apply before backface/offscreen culling. If a cap is reached, existing props remain; building detail is never silently removed. Offscreen additions do not consume the budget. No per-frame imports or network requests occur; geometry shares the static scene cache.

`scripts/external-art-review.mjs` renders the actual village and isolated prop lineup at day/night, reverse orbit and phone size with optional `CANVAS_MODULE`. `BENCH_ZOOM=1.65` enables a close-view run of the mature-settlement benchmark.

## Rejected or deferred

- **RG Poly Small Props Pack (itch.io):** the page says CC0, but the downloaded `License.txt` prohibits making assets available as standalone downloads and introduces authorization requirements. This contradicts an unrestricted public-domain grant; no files from the pack are included.
- **Worn barrel variant:** rejected in visual review for an unsuitable damaged silhouette; the final barrel comes from the Medieval Village Pack.
- **Quaternius Tree:** 1,366 source triangles, unsuitable crown and more cost than the existing procedural trees.
- **Complete buildings:** require new import architecture and risk losing authored tier behavior. Keep the established procedural structures.
- **Rigged characters (runtime import):** a live glTF/skin loader is still rejected; the R3 pass instead bakes discrete pose sets offline (see above) and keeps the procedural body as the automatic fallback, so no authored job/tool behavior is lost.
- **Quaternius static cart:** would weaken existing animated wheels, correct pivots and loaded-state cues.

This pass implements the reusable environment/prop wave and applies it to resource, settlement and late-game workplaces. Full building/character replacements remain deferred until they offer a clear gain within the existing renderer.

## Verification

- Full Node suite: 1,208 passing checks, including five asset-specific provenance/geometry/orbit/budget/tier checks.
- Pages static build passed; generated geometry and manifest are precached, review-only GLB sources are excluded.
- Actual renderer inspected at day/night, reverse orbit and 390×844 phone size. Reviewed images are under `docs/previews/external-*`.
- Mature-settlement diagnostic: 72 buildings, 150 villagers, phone viewport at 1.65×; +303 visible faces in each day/night/rain/warning/raid scenario. This is roughly 4.5% in the quiet scene. Full before/after timings and environment limits are in `external-art-benchmark.json`; CPU Canvas timings are not phone FPS claims.
- Real Chromium smoke/console/mobile interaction checks run in the PR workflow. Local Chromium download was unavailable, so no local browser result is claimed here.
