# Environment Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Improve Midnights Manner's biome scenery and ground readability, then refine atmosphere/weather presentation without adding a parallel environment system.

**Architecture:** Stage 1 updates the existing deterministic biome/scenery and ground renderer with reviewed reskinned meshes/materials. Stage 2 calibrates current wind, lighting, weather, fog/mist, smoke, and rain using their existing caches, clocks, caps, and Calm behavior.

**Tech Stack:** `src/environment-art.js`, `src/wind-art.js`, `src/renderer.js`, `src/atmosphere-art.js`, `src/source-lighting.js`, `data/biomes.json`, `data/palette.json`, offline flat-mesh exports, Node tests/captures.

**Spec:** `docs/superpowers/specs/2026-10-04-midnights-manner-art-integration-design.md`

## Global Constraints

- Keep all five biome keys and deterministic tile/seed behavior.
- Scenery is visual-only: no collision, yield, pathfinding, resource, or save fields.
- Keep landmarks selectable and prioritized; keep scenery out of occupied footprints.
- Preserve scenery 50/85/130 zoom caps, converted-mesh caps, wind 18/12/16 caps, existing light/effect caps, static-cache invariants, and Calm/reduced-motion behavior.
- Use vivid medieval color through `data/palette.json`; do not create a second palette or time-varying static mesh.
- Keep external-source license, hash, and derivative records. Use procedural fallback for absent/disabled assets.

## Stage 1: Biomes, Ground, And Scenery

**Files:**
- Modify: `data/biomes.json`, `data/palette.json`, `src/environment-art.js`, `src/renderer.js`, `src/wind-art.js` only when anchor alignment requires it
- Modify: `data/art-manifest.json`, `data/external_assets.json`, `docs/ART_COVERAGE.md`, `docs/ASSET_CREDITS.md`
- Create: reviewed `assets/meshes/<nature-id>.json`
- Test: `tests/environment-art-r5.test.js`

**Interfaces:**
- Consumes: `sceneryForTile`, `sceneryPlan`, `convertedId`, `drawProp`, `addEnvironmentScenery`, `addWindLife`.
- Produces: the same renderer API with data-driven palette/material choices and reviewed geometry per biome; missing meshes preserve current procedural forms.

- [ ] **Step 1: Write failing R5 tests for all five biome palettes/routes.** For deterministic seeds, assert expected signature kinds/colors, landmark/occupied-tile exclusions, unchanged world state, converted/procedural parity on missing assets, and existing scenery caps.
- [ ] **Step 2: Run `node --test tests/environment-art-r5.test.js`.** Expected: FAIL because R5 palette/material coverage assertions do not exist.
- [ ] **Step 3: Make a baseline capture.** Run `npm run capture`; record the five biome read at 1.0 and 1.65 zoom, including phone-night before edits.
- [ ] **Step 4: Author/convert the Stage 1 meshes.** Prioritize readable water surface/shoreline, forest layered silhouettes, cool stone hills, visibly rougher frontier, and open plains. Reskin to the game palette; keep each prop grounded and tile-safe.
- [ ] **Step 5: Route palettes/material variants through `data/palette.json` and biome data.** Do not duplicate deterministic hashes or change biome gameplay/yield weights.
- [ ] **Step 6: Update wind anchors whenever a converted silhouette changes crown/blossom height.** Assert in the test that sway contacts the intended mesh and never enters Calm/far-zoom passes.
- [ ] **Step 7: Run `node --test tests/environment-art-r5.test.js tests/terrain-r4-biomes.test.js tests/terrain-p5.test.js tests/environment-art.test.js tests/environment-replace.test.js`.** Expected: PASS with deterministic placement, fallback, anchor, and cap contracts intact.

## Stage 2: Atmosphere And Weather

**Files:**
- Modify only as justified by Stage 1 captures: `src/wind-art.js`, `src/atmosphere-art.js`, `src/source-lighting.js`, `src/systems/daynight.js`, `docs/LIGHTING.md`
- Test: `tests/environment-motion-r5.test.js`, existing lighting/source-lighting/atmosphere tests

**Interfaces:**
- Consumes: existing `weatherAt`, `skyLightAt`, source profiles, `addWindLife`, `drawAtmosphere`, `drawSourceSpill`, and Calm/quality flags.
- Produces: tuned or minimally extended existing effect passes; no second environment renderer and no new saved state.

- [ ] **Step 1: Write failing tests for any selected motion/weather change.** Pin deterministic output, Calm freeze, reduced-motion, source occlusion/anchor, per-system caps, and no mutation of world/save fields.
- [ ] **Step 2: Run `node --test tests/environment-motion-r5.test.js`.** Expected: FAIL for the specifically selected behavior before implementation.
- [ ] **Step 3: Change only the current effect owner.** Keep static geometry out of time-dependent caches; ensure moving overlays are bounded and viewport/zoom culled.
- [ ] **Step 4: Re-run focused tests.** Run `node --test tests/environment-motion-r5.test.js tests/fx-environment.test.js tests/atmosphere-art.test.js tests/cinematic-lighting.test.js tests/lighting.test.js tests/source-lighting.test.js tests/lighting-polish.test.js`. Expected: PASS with all existing caps unchanged.
- [ ] **Step 5: Run `npm run capture` once after the final change.** Review all sky/weather views and phone-night; recompute frozen lighting baselines only when the intended visual geometry/albedo change requires it and document the deliberate update.
