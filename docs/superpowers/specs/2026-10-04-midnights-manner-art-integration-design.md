# Midnights Manner Art Integration: Buildings, Characters, Environment

Date: 2026-10-04. Status: user-approved 2026-10-04.

## Goal

Turn the expanded Blender asset catalog into an integration-ready art source for the Midnights Manner game. Customize and reskin appropriate KayKit/source assets so they feel authored for the game's medieval miniature world, use modular pieces to create distinct building forms where direct matches are poor, upgrade character model coverage without losing role identity, add the missing building upgrade transition, and stage an environment-art pass across scenery and atmosphere.

The authoritative implementation checkout is the user-designated OneDrive `midnights-manner` repository. The separate sibling checkout is out of scope and must remain untouched. The current Blender authoring file is `purple_robe_archer_reskinned_v8_full_asset_catalog.blend`; its local location is not part of the public repository.

## User-Approved Direction

- Use offline Blender authoring and the existing Canvas renderer/export architecture; do not add a runtime GLB, texture, or skeletal-animation loader.
- Preserve and customize source assets non-destructively. Game derivatives may be reskinned, proportion-adjusted, recomposed from modules, or extended with original details so they do not look like untouched source models.
- Colors may be vivid and creative. Keep the medieval theme, readable value contrast at night, and use the game's shared palette rather than creating a parallel palette registry. Do not constrain the art to bland/desaturated colors.
- Retain distinct structural silhouettes across building types and authored tiers. Color alone is not a tier or type distinction.
- Include both building construction/upgrade transitions and selective ambient mechanisms. Reuse existing renderer behavior and add only verified gaps.
- Upgrade all existing character archetypes while retaining profession/faction color, equipment, role silhouette, gameplay behavior, LOD and procedural fallback.
- Stage environment work as biome/scenery first, atmosphere/weather second.
- Make no gameplay, economy, placement, collision, combat, or save-format changes.

## Current System And Scope Evidence

- The game is a vanilla JavaScript Canvas renderer. Building meshes, character poses, and scenery use game-owned flat-color geometry; source Blender scenes and rigs are authoring inputs, not runtime assets.
- `data/buildings.json`, `data/troops.json`, `data/biomes.json`, and the current manifests are authoritative for game coverage. The Blender catalog's count of 195 custom forms is a source-catalog count, not a substitute for enumerating game IDs and tiers.
- Existing project work already includes converted building modules, procedural building families, construction scaffolds/completion behavior, state-driven work mechanisms, character movement/work/attack poses and equipment, five deterministic biomes, converted scenery props, wind movement, weather, lighting, fog/mist, and bounded atmosphere.
- The v8 Blender catalog and the game's asset coverage are separate inventories. A coverage audit must reconcile every intended Blender source/model to an actual game building ID/tier, character archetype, or environment role before claiming it is integrated.
- Existing face/effect limits, cache invariants, Calm behavior, and tests remain binding. The 30,000-face threshold is a runaway guard, not a target allocation.

## Visual Language

Use the existing medieval miniature style as the foundation: broad readable forms, faceted geometry, grounded materials, practical sources of light, and silhouettes that read at ordinary gameplay zoom and at night. Allow rich roof, cloth, foliage, water, and faction colors: blue/teal, emerald, crimson, ochre/gold, slate, and other colors already supported by or deliberately added to `data/palette.json`.

Buildings are focal and may use stronger color. Characters retain profession/faction color and equipment accents. Terrain is lower contrast than buildings and units, but each biome must have a clear silhouette and color identity. Night lighting may cool/dim albedo naturally; roofs, plaster, or foliage must not be made emissive as a substitute for contrast.

Source models remain identifiable in provenance. Their game derivatives should visibly belong to Midnights Manner through the shared palette, material assignment, shape edits, and modular recomposition, without destroying recognizable job/building function or introducing visually foreign high-detail texture work.

## Workstreams

### 1. Source And Coverage Audit

Build a data-derived coverage map from the actual game registries. For each source and intended derivative, record:

- Source pack/model, creator, license evidence, source hash, and source file.
- Game role and IDs: building type/tier, character archetype/faction, or environment/biome prop.
- Applied material/palette changes, geometry edits, and module lineage.
- Output asset path and runtime manifest/consumer.
- Footprint/bounds, ground pivot, moving-part pivots, lighting/gear anchors, LODs, and per-LOD face counts.
- Fallback behavior and review state.

Report unmatched source models and game IDs explicitly. Do not treat a shared module reused by multiple assemblies as proof that every assembly has a unique, completed silhouette.

### 2. Buildings And Building Motion

Use family-based KayKit modules and appropriately colored source variants where they fit. Break suitable source models into reusable roof, wall, foundation, entrance, trim, and mechanism pieces. Compose or model new variants for forms with no good direct match. Maintain every building's existing footprint, collision, function, source-light anchors, authored stage count, and type/tier readability.

Keep static structure in the existing cached mesh path. Construction and upgrade transitions should derive from current build/upgrade progress and use bounded discrete assembly stages or overlays that do not rebuild the whole village each frame. Reuse existing work cues and moving mechanisms where they already express building activity. Keep Calm/reduced-motion and unfinished/ruined suppression consistent with current behavior. No new simulation timer or saved field is part of this design.

### 3. Characters And Character Motion

Use the existing offline pose-bake and runtime selection contracts to bring the Blender-source character models into every applicable existing role/faction archetype group. Map professions to distinct model/outfit/gear reads rather than creating one duplicate body per troop ID. If an imported body already matches a shipped body and adds no visual or animation value, document and reuse the shipped body instead of duplicating payload. Preserve profession-specific color, gear drawn by the equipment system, head/hand/chest/back anchors, hi/lo LODs, discrete stand/walk/work/attack poses, and procedural fallback. Do not replace the role mapping with one generic character or add a live skeletal runtime.

### 4. Environment, Stage One: Biomes And Scenery

Extend the five existing biome identities: plains, forest, water, hills, and unclaimed fringe. Keep deterministic tile placement, landmark priority, building-footprint exclusion, current claim/wild distinction, biome/gameplay data contracts, LOD, and scenery face caps.

Prioritize broad visual separation and reusable, reskinned forms: open/readable plains, layered forest silhouettes, a legible water surface/shoreline, stronger stone-hill value separation, and a frontier that reads rougher than ordinary forest. Preserve proper prop/material variation and avoid adding visual detail that competes with units, buildings, or collection indicators.

### 5. Environment, Stage Two: Atmosphere And Weather

After biome silhouettes and anchors are stable, refine the current wind, weather, lighting, fog/mist, smoke, rain, and atmospheric presentation. Reuse current systems and clocks. Preserve practical light-source identity, occlusion, caching, quality levels, Calm/reduced-motion behavior, and all existing effect/light limits. Do not add a second environment/weather renderer.

## Asset Flow

1. Preserve source `.blend` files and originals; create clearly named derived objects/collections for game variants and save Blender edits as a new version rather than overwriting v8.
2. Apply palette/material changes and necessary geometry edits in Blender. Keep source attribution and derivative notes with exported metadata.
3. Export static meshes or sampled character poses through the existing offline conversion/bake toolchain into the game's flat-color face JSON format.
4. Register files and enablement/provenance in `data/art-manifest.json`, `data/external_assets.json`, and asset credits where required.
5. Wire assets only through existing Canvas consumers and verify missing/disabled assets fall back safely.
6. Keep authoring files, source archives, unused geometry, Blender materials, and rigs out of runtime asset payloads.

Do not assume a KayKit pack's CC0 status covers every asset in the Desktop folder. Verify the applicable license and redistribution/adaptation evidence for each shipped derivative and preserve source hash and modification history.

## Verification And Acceptance

- **Coverage:** Every intended game type/tier/archetype/biome role has an explicit mapping, or is listed as not yet implemented. Counts derive from game data.
- **Geometry:** Exports are finite, grounded, correctly scaled/oriented, nondegenerate, and within documented per-asset LOD/face limits. Building footprints, character anchors, pivots, and light-source positions are verified.
- **Identity:** Building types and adjacent tiers remain structurally distinguishable; professions/factions retain distinct appearance, colors, and gear; biomes read by structure and color at gameplay scale and at night.
- **Behavior:** Test construction, upgrade, completion, Calm/Low quality, movement/work/attack pose selection, gear attachment, active/inactive mechanisms, lighting, missing-asset fallback, selection, and cache reuse. Preserve old saves and all gameplay state.
- **Visual review:** Inspect yaw 0/90/180/270, day/night/dawn, zoom 1.0/1.65/2.2, desktop and phone night, plus dense settlement/raid, Calm, and Low-quality views. Run a separate Judge review after captures; resolve findings before calling the content ready.
- **Performance:** Compare buildings, characters, scenery and dynamic overlays together on the same mature-village fixture. Keep existing face/effect/light caps and cache invariants. Use `?perf`/`frameReport()` and report only observed numbers. A sustained mobile 60fps statement requires an actual supported device test.
- **Release checks:** Add focused tests for changed contracts, then run `npm test`, `npm run build`, `npm run capture`, and `npm run test:browser` when the local browser is available. A failed required gate blocks release readiness.

## Tomorrow Checkpoint

The near-term checkpoint is a reliable route from Blender source to game content, a complete source-to-game coverage/gap map, and a visually reviewed, tested representative integration batch spanning a few building families, character roles, and all five biome identities. Remaining source forms should be organized into repeatable batches.

Full integration and independent visual/performance signoff for all 195 custom Blender forms is not promised as an overnight result. Do not describe the whole catalog as game-ready until its mappings, manifests, runtime behavior, visual review, and combined budgets have passed the acceptance checks above.

## Review And Delivery

Use available free agents for scoped, read-only design, geometry, and technical feedback; validate that each reviewer inspected the OneDrive checkout before accepting repo-specific claims. Use the project's configured Sol route where implementation/review work is delegated, never opencode-go. Run an independent Judge pass against actual game captures rather than treating a design-only review or a Blender viewport image as final approval.

This document specifies design only. It does not authorize replacing source files, overwriting the v8 Blender file, changing gameplay, committing, pushing, or claiming that any new content has been integrated. Implementation planning begins only after the user approves this written spec.
