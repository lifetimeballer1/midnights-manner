# Village Buildings Art Direction

Date: 2026-10-02. Status: design proposal, not implemented or performance-certified.

## Scope And Intent

Restyle the 62 existing procedural building types toward the requested medieval miniature look: warm-white plaster infill, dark exposed timber, saturated faction-colored roofs, and grounded stone bases. Keep original procedural construction, structural tier progression, job silhouettes, free orbit, and the existing Canvas lighting model. This document authorizes no implementation, asset import, gameplay changes, or save migration.

The 62 types are not 62 identical six-tier houses. `docs/visual-plan.md` inventories 53 six-tier types, three-tier trap and Grand Watchtower, four-stage Manner Citadel, and six single-stage wonders. Actual `data/buildings.json` tier arrays remain authoritative. Do not invent upgrades for wonders or turn staged projects into ordinary homes.

No Desktop Assets access was attempted. References are only the staged files under `.superpowers/sdd/2026-10-02-cosmetic-art-pass/sources/hexagon-buildings/`. Other contributors' current character/mesh changes are outside this document's scope.

## Evidence And Boundaries

| Source inspected | Relevant finding | Design consequence |
| --- | --- | --- |
| `README.md`, including original brief and extension contracts | Vanilla-JS Canvas; data-defined tiers; distinct silhouettes, not palette-swapped progression; visual changes must preserve saves and gameplay | Restyle renderer materials and existing forms; preserve IDs, footprints, costs, tier counts, stats, placement and collision |
| `src/building-art.js`, targeted function/palette/level grep only | Three wood/stone/fortified wall palettes; `wallNeighbors`, `drawWall`, `drawFoundation`, `drawArchitecture`; level-gated foundations, roof/chimney additions | Keep connected-wall and fallback architecture legible; do not mistake this fixed-view helper for the full orbit renderer |
| `src/scene3d.js`, targeted patterns and family helper excerpt | Eight core families: hall, cottage, barracks, farm, lumber, mine, market, forge; `FAMILY_ROOF`; bands 1-2 / 3-4 / 5-6; `famWalls`, `famRoof`, `famPanes`, `famStack`, `famEntrance` | Begin with shared family materials and existing modules, then extend the same grammar to remaining types; no second rendering pipeline |
| `data/buildings.json`, three samples | Hall: size 2, six tiers and storage; Farm: size 2, six tiers, food production and farmer workplace; Lumber: size 1, six tiers, wood production and lumberjack workplace | A civic building, an open producer and a compact work yard must not collapse into the same cottage silhouette |
| `docs/visual-plan.md` | 43x22 tile, default zoom 1.65, free yaw/pitch; phone 60fps goal; 30k guard; far <0.6 / near >1.5 | Design for normal phone zoom first, all sides second, close decoration last |
| `docs/LIGHTING.md` | Raw albedo plus directional sky shading, AO, emissive flags, weather veil; cached source wash and dynamic ground spill | Do not paint lighting into materials or brighten the entire night scene to rescue weak silhouettes |

The staged set contains blue/green/red/yellow variants of home A/B, castle, church, barracks, archery range, blacksmith, lumbermill, market, mine, tavern, well, watermill, windmill and tower forms. Neutral files include stone/wood fences, walls/gates, scaffolding, destroyed and staged structures. These are reference archetypes, not a one-to-one replacement list.

The inspected `blue/hexagons_medieval.png` is a color atlas, not a rendered building contact sheet: it supplies strong blues, greens, reds, ochres, pale plaster-like neutrals and brown/gray ramps. The home and blacksmith glTF metadata points to that atlas and separate binary geometry (index counts 3,033 and 7,230 respectively). Raw imports are not assumed to fit Canvas budgets. No model render was produced during this design-only task; proportions below are authored targets, not claimed measurements of the staged geometry.

Use broad material contrast and archetype cues from the staged sources, not their hexagonal ground plates, texture atlas, exact topology or camera presentation. No external geometry, texture or converted derivative should ship without verified redistribution rights and the required provenance entry in `data/external_assets.json`; staging alone is not license verification. Original procedural restyling is the recommended path.

## Chosen Approach

**Recommended: procedural material-and-shape refinement.** Reuse current roof planes, wall infill, corner posts, foundation bands, braces, doors and chimneys. Spend geometry only when an existing type or tier lacks a readable structural distinction. This preserves fallback behavior and gives the village a coherent look without multiplying mesh cost.

Palette-only recoloring is cheaper but insufficient: timber framing, roof hierarchy and tier silhouettes must remain visible. Full staged-model substitution offers closer source fidelity but introduces topology, licensing, footprint, source-anchor and LOD work; it is not part of this spec. No runtime glTF loader, runtime textures, WebGL conversion or new architecture framework is proposed.

## Material Grammar

The visual hierarchy is roof first, plaster mass second, timber rhythm third, stone grounding fourth, one job cue fifth. Broad planes should survive a quarter-size squint test. Avoid thin tile grooves, individual masonry blocks, ornamental beam lattices and dozens of tiny props.

| Material role | Proposed unlit albedo | Treatment |
| --- | --- | --- |
| Plaster | Main `#eee7d6`; secondary `#d9d0bb` | Warm off-white, never pure white; broad quiet infill on inhabited/covered volumes |
| Timber | Main `#725039`; end/trim `#936747` | Dark structural frame against plaster; keep doors legible as larger brown panels |
| Stone | Main `#9ca29a`; cap `#b9b9a8` | Neutral gray-green bases, steps and defense masses; contact darkening comes from AO |
| Metal | `#626b70` | Small brackets, machinery and tier-6 reinforcement; not a whole-building dark wash |
| Brass | `#c59b4c` | Sparse civic/masterwork trim; existing gold resource-ready pennants keep priority |
| Window/lantern | Retain existing warm source albedos, e.g. window `#ffe6ab` | Emissive only where actual pane/flame geometry exists |

These swatches are proposed material values, not edits to a palette file. Resolve them through the repository's shared palette conventions where available; do not introduce a duplicate palette registry. Side-facing surfaces use the same material albedo as front-facing surfaces. Normals and the existing lighting resolver provide directional shading; do not copy the legacy `left/right/top` baked-light palette into orbit meshes.

For enclosed civilian volumes, target roughly two-thirds plaster to one-third combined timber/stone in the wall silhouette. Stone bases occupy about the lower 15-25% of the visible wall height; keep current overall height and foundation anchors unless a deliberate silhouette revision is approved. Frame corners, eaves and one clear bay division before adding diagonals. Use framing widths around 5-8% of a facade bay, then assess projected readability at 1.65 zoom. Simplify a subpixel brace instead of enlarging the entire structure.

Roof overhang should read as a clean ledge, typically 0.05-0.08 tile where the existing mesh already permits it. Preserve footprint/placement extents and established adjacency clearances. Doors remain dark, windows warm, chimneys neutral stone with dark openings. Do not make plaster, roof ridges, brass or ordinary banners emissive.

## Roof And Faction Color

Use one saturated roof hue per visual allegiance/theme, with a restrained variation across tiers. Saturation communicates identity, not building strength. Roof hue must never be the only distinction between different types or tiers.

| Accent family | Proposed roof albedo | Intended visual use |
| --- | --- | --- |
| Blue | `#327eaf` | Home civic identity, hall and scholarly roof accents |
| Green | `#448b58` | Rural homes, farming and woodland roofs/canopies |
| Red | `#b94e3e` | Barracks and hot-work industrial roofs; distinguish via roof shape and chimney/job cue |
| Yellow | `#caa044` | Trade roofs and market awnings, kept more ochre than collection-marker gold |
| Neutral | `#687980` | Stone defenses, cold/underground works and small utility caps |

This is an art-role mapping for existing player buildings, not a new faction ownership system. The staged color directories do not establish an enemy-faction mapping. If an existing renderer context already supplies faction colors, use that identity on roofs/cloth while leaving plaster, timber and stone consistent; otherwise use the role mapping above. Do not infer allegiance from save IDs, randomize faction hue, or add saved faction fields.

Allow deterministic instance variation in secondary plaster tone, shutter placement and small trim, using existing building identity. Keep primary hue and job silhouette stable. Across tier bands, retain the same hue and avoid the current progressively muddy impression: vary material quality and form rather than darkening every roof. Weather and moonlight may reduce perceived saturation naturally; do not compensate with emissive roofs.

## Structural Tier Ladder

Keep the six named progression stages and existing family bands. The common vocabulary below guides each type; it is not permission to add all listed features to every building.

| Tier | Architectural read | Low-cost change to prioritize |
| --- | --- | --- |
| 1: Frontier | Small, simple and hand-built | Single gable or open shelter, coarse corner frame, sparse plaster infill, low rubble/stone footing; retain exposed wood for camps |
| 2: Established | Weatherproof and settled | More complete infill, continuous stone sill, porch/lean-to or clearer entrance; silhouette must differ from tier 1 |
| 3: Professional | Purpose-built workplace | Existing hip/cross-gable or raised working bay, masonry plinth, framed glazing and a larger profession cue |
| 4: Prosperous | Organized compound | Existing annex, dormer, entrance canopy or wider work bay; one additional large volume rather than many miniature objects |
| 5: Advanced | Engineered structure | Existing layered roof, braces, taller chimney/tower or defined service wing; metal confined to functional parts |
| 6: Masterwork | Composed landmark | Strong roof hierarchy and distinctive crown/second wing, selective brass/metal, resolved entrance; not a blanket castle skin |

Adjacent tiers need a visible contour or massing change at 1.65 zoom, including in monochrome and at night. Reuse authored changes before inventing new ones. Near-only decorative props cannot be the sole upgrade signal. In far/Low LOD, at least one coarse contour difference between adjacent tiers must remain, even if an annex is represented by a simpler mass.

Three-/four-stage projects follow their authored clearing/foundations/building/crown sequence. Single-stage wonders retain their unique shape. Ruins retain recognizable base material masses but suppress emissive panes, source spill, job props and work cues. Construction and placement ghosts remain subdued, clean and non-emitting.

## Family Treatments

| Family or category | Restyle direction | Identity that must survive |
| --- | --- | --- |
| Hall / civic housing | Blue roof, broad plaster bays, dark corner frame, generous stone entrance; upper tiers keep their annex/turret hierarchy | Hall is a civic compound, not a scaled cottage |
| Cottage / longhouse | Green roof, white infill, timber gables; porch and chimney progression; longhouse keeps long ridge and twin stacks | Beds read as inhabited homes, with compact vs elongated massing |
| Barracks / military shops | Red roofs, framed plaster quarters over more substantial stone feet; reuse racks, shields and training-yard silhouette | Barracks compound, fletcher/armory work cue and actual defense shapes remain distinct |
| Farm / pasture / groves | Green roof on existing shelter only; white infill where an enclosed shed exists; dark posts and restrained stone sill | Crops, animal yard, troughs and vegetation remain the main volume; do not roof over production plots |
| Lumber / sawmill | Green canopy or roof, exposed timber work structure, plaster only on an actual enclosed service bay | Log stacks, sawbuck or mill mechanism dominate; the sampled size-1 Lumber stays compact |
| Mine / cold-resource works | Neutral cap, stone portal, dark supporting timber; small pale office bay only where already present | Tunnel mouth, cart/rail and resource-specific machinery, not a white cube |
| Forge / smeltery / bakery | Red roof, plaster service walls, stone furnace/chimney, dark open working bay | Forge fire and anvil vs smelter furnace vs bakery oven; retain anchored stacks and existing work readout |
| Market / trade / storage | Yellow awnings/roofs, pale end walls, dark open stall supports, stone platform | Market stays an open canopy with cargo; storehouses remain enclosed bulk-storage masses |
| School / scriptorium / healing / ritual | Blue or context-authored accent, restrained pale plaster with stone steps, timber or stone framing as appropriate | Books, observatory, chapel or ritual silhouettes remain distinct; no new supernatural glow |
| Walls / gates / towers | Timber palisades stay timber, stone walls stay predominantly stone; faction cloth/roof caps accent only existing sheltered portions | Neighbor-driven arms, exposed end caps, gate axis, clear portcullis passage and tier crenellation |
| Traps / wells / docks / open utilities | Apply stone/timber/metal grammar to existing pieces; colored cap/cloth only when structurally plausible | Armed/cooldown trap silhouette, water opening and walkable dock remain unobstructed |
| Wonders / Great Works / Town Projects | Reuse authored stone monuments, landscaped/open stages and landmark roof hierarchy; plaster only on actual occupied buildings | Oathstone, Moon-dial, Cairnfield, Dawn-gate and other non-house forms never become generic framed cottages |

All 62 types must be assigned to an applicable treatment during later implementation review, deriving the list from data rather than maintaining a second hardcoded inventory. Exceptions follow the existing structure's purpose. A plaster-first village does not imply plaster-first walls, mines, machinery or monuments.

## Night Lighting Contract

Keep the current model: albedo is multiplied by weather dimming, contact AO and ambient/key/sky lighting plus the per-face emissive contribution, then fog mixes toward its veil color. Broad pale plaster supplies moonlit facade separation without changing `world.daynight` settings. The shipped night table in `LIGHTING.md` uses cool key `#8fb0f0` at 0.17, ambient `#42578a` at 0.42, sky 0.07 and emissive 0.75; this spec does not retune those values or the synthetic frozen-day shading contract.

- Preserve window panes as steady pale-warm emissive geometry, aligned with facade-directed window sources. Keep frame/mullion faces non-emissive.
- Retain compact gold lantern pools, directional orange torches, hotter forge/watchfire pools and compact armed-trap pulses. Changing roof hue must not recolor source profiles.
- Reposition pane, flame, lamp and chimney anchors together with any geometry revision, in world coordinates for all orbit angles. Never leave source spill or smoke at the old position.
- Do not add lights merely because a tier adds windows. Reuse existing source counts and group decorative pane clusters under an existing appropriate source where practical; decorative unlit glazing may remain non-emissive. Do not create bloom-only pretend emitters.
- Cache source positions, profiles and local wash with static geometry. Time affects only existing dynamic ground-spill flicker and bounded effect layers, never mesh topology, material identity or cache keys.
- Keep source wash bounded, including the documented 0.24 nearby-light ceiling and footprint blockers. Preserve source visibility/occlusion, ground-under-mesh ordering and actual chimney coordinates.
- Calm/reduced-motion freezes flicker and atmospheric motion through existing paths; construction ghosts, unfinished buildings and ruins emit no source light. Do not add independent decorative animation.

At night, the read should be cool pale wall planes beneath colored roof silhouettes, separated by dark timber, with small warm windows and practical fires. Reject uniformly glowing plaster, black roofs with no contour separation, detached ground pools and saturation boosted by emission.

## Geometry, LOD And Phone Budget

The performance target is 60fps on iPhone 12-class Safari, not a result established by this document. A 30,000-face runaway guard is a whole-scene ceiling, not a building allocation or an operating target. Both cached/static and painted/visible face metrics must stay below the guard, including units, props, terrain/scenery and AO-generated subdivisions. Raw glTF triangle counts are not equivalent to final Canvas face counts.

Default cost policy: material substitutions add zero faces. For a geometry revision, record the before/after face counts of that type/tier at each LOD; keep total restyled-building faces no higher than the same baseline scene at that LOD, trading obsolete trim/duplicate boxes for stronger framing or roof masses. Any increase requires a separately reviewed budget, not an assumption that spare capacity under 30k is free. In a scene with concurrent character upgrades, measure the combined scene rather than spending the same headroom twice.

| View / zoom | Required read | Geometry discipline |
| --- | --- | --- |
| Far, <0.6 | Roof hue, building type, coarse tier contour, base silhouette | Coarse wall/roof masses only; remove shutters, diagonal trim, individual roof detail and small job clutter |
| Medium, 0.6-1.5 | Plaster/timber contrast, entry, base, large profession cue | Keep existing detail cutoff below 1.2; favor broad framing faces and existing props, not more full boxes |
| Near, >1.5; normal play 1.65 | Framing, source panes, authored tier differences and work cue | Add only existing/approved detail; retain the current fine-detail gate at 1.65 where applicable |
| Close, through 3.6 | Clean joins and anchor placement | No unbounded subdivisions, roof tiles, brick-by-brick stonework or new loops per tier |

The visual plan's far/near thresholds are design targets; observed existing details also gate at 1.2 and 1.65. Reconcile within the existing quality/LOD policy during implementation, without silently moving those runtime gates. Low quality must preserve the same material hierarchy and coarse tier distinction with fewer details.

Use flat framing strips or existing corner-post faces where possible. Do not add coplanar facade overlays that z-fight when orbiting; use established face bias or small geometry offsets. Do not duplicate opaque internal faces, attach thick beam boxes to every panel, or add hidden interior rooms. Account for tall-face AO subdivision before accepting a supposedly cheap new facade.

Maintain backface/frustum culling, static/chunk caching and deterministic instance variation. Existing orbit rebuild behavior remains allowed; a clock tick must not rebuild meshes. No runtime atlas fetches, blur/filter passes, new per-frame mesh allocations or new simulation dependencies.

For practical lights, the visual plan's approximately 40 culled lights is a conservative design target, while current `LIGHTING.md` documents visible spill/bloom caps of 48 overview, 72 small viewport and 120 larger screen. Do not raise any cap. Design to the conservative target and preserve existing culling/caps in crowded scenes; these are not per-building allowances. Keep smoke/trail/splash caps at 8/12/14 and other existing atmosphere budgets unchanged.

## Later Review And Acceptance

This section defines evidence required for a future implementation, not work performed by this design-only task.

1. Review the eight core families first: one contact sheet per family with all authored tiers at default 1.65 zoom. Compare with staged archetypes without bundling their atlas or geometry. Refine no more than twice per family before a focused design decision.
2. Extend the approved material grammar to every remaining data-derived type/tier. Review adjacent tiers in color and monochrome at quarter scale; type/job and upgrade contour must remain readable. Include project stages, wonders, ruins and connected defenses.
3. Check yaw 0/90/180/270 and low/default/overhead pitch for joins, rear framing, roof normals, pane/source alignment, chimney origins, gate clearance and visual overhang. Preserve building selection, placement preview, pan/pinch/orbit and grid alignment.
4. Check deterministic day and night sheets, plus dawn/dusk and fog through the existing capture fixtures. At least one phone-night view must demonstrate plaster separation, roof identity, source occlusion and uncluttered collection markers. Keep capture batches limited; do not produce a rendered sheet for every possible combination.
5. Compare before/after telemetry on the same mature village, including crowded defenses, high-tier producers, active raid units, latest character art, zoom 0.5/1.0/1.65/2.2, Calm and Low quality. Require both face metrics below 30k, no building-face growth without review, existing source/effect caps intact and static-cache reuse under clock advancement.
6. Measure actual phone Safari sustained frame pacing for the 60fps goal; use `?perf` / `frameReport()` and the documented <8ms desktop rendering target as supporting signals. Headless capture or desktop speed alone is not phone certification. Existing quality auto-degrade (>20ms for 3s per visual plan) must remain available.
7. Run `npm test` and `npm run build`; run applicable browser/capture checks and load an old save before proposing a merge or push. Recompute changed geometry/albedo image pins deliberately with documented rationale; never weaken cache, emissive, source-anchor or frozen-light assertions to hide a regression.

Acceptance means a visibly cohesive white-plaster/timber village with saturated roof accents and stone grounding, while each workplace, authored tier and exceptional structure still reads as itself. No new game rule, saved field, asset dependency, light-budget increase or unverified deployment claim is part of acceptance.

## Delivery Status

Only this Markdown specification was authored. No runtime code, building data, meshes, sprites, manifests or lighting settings were changed by this task. No tests, builds, captures, model renders or device benchmarks were run; the performance and visual checks above are requirements for future implementation, not verified outcomes.
