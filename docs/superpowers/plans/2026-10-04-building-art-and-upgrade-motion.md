# Building Art And Upgrade Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Integrate customized modular building geometry across the mapped game types/tiers and add a cache-safe visual upgrade assembly transition.

**Architecture:** Keep authored procedural buildings as the dependable base and use mapped flat-face modules for reviewed variants. During construction/upgrades, render bounded discrete assembly states derived from existing `level` and `remaining`; include the discrete stage in the static-cache key so clock ticks do not rebuild geometry.

**Tech Stack:** `src/scene3d.js`, `src/asset-art.js`, `src/fx/building-fx.js`, offline exported JSON meshes, `data/art-manifest.json`, Node tests.

**Spec:** `docs/superpowers/specs/2026-10-04-midnights-manner-art-integration-design.md`

## Global Constraints

- Keep each footprint, collision, building ID, tier count, game rule, and save schema unchanged.
- Preserve source-light positions and chimney/window/flame anchors when geometry changes.
- Structural tier changes must not be palette-only; use shared modules only when each resulting type/tier remains legible.
- Missing or disabled modules use the existing procedural model.
- Keep unfinished/ruined/placement treatment, Calm, static-cache reuse, mobile LOD, and current 800/1400 `buildingArtFaces` caps.
- Blender changes go to a new v9 file, never over v8.

## Task 1: Map And Integrate Building Modules

**Files:**
- Modify: `src/asset-art.js`, `src/scene3d.js`
- Modify: `data/art-manifest.json`, `data/external_assets.json`, `docs/ART_COVERAGE.md`, `docs/ASSET_CREDITS.md`
- Create: reviewed `assets/meshes/<building-module>.json`
- Test: `tests/building-art-r5.test.js`

**Interfaces:**
- Consumes: coverage ledger entries and game meshes preloaded as `renderer.meshes[id]` by `src/main.js`.
- Produces: a data-driven mapping from building type/tier to placed modules; `buildingModel(s,b,spec,world,time)` remains the entry point and missing assets silently fall back.

- [ ] **Step 1: Write the failing mapping/geometry test.** For each mapped type/tier assert the manifest entry resolves, geometry changes at intended structural bands, module vertices stay inside the existing footprint, and rendering leaves `b`, `world`, and `spec` byte-identical.
- [ ] **Step 2: Run `node --test tests/building-art-r5.test.js`.** Expected: FAIL because the R5 mapping/test does not exist.
- [ ] **Step 3: Select module families from the coverage ledger.** Use color variants only where form/function match; compose roof, wall, foundation, entrance, trim, and work modules for unmatched silhouettes. Preserve proprietary/source provenance and do not include unused modules in the runtime manifest.
- [ ] **Step 4: Extend the existing family/tier module mapping.** Reuse `BUILDING_ROOFS`/`addConvertedBuildingTiers` patterns where valid; add bounded data entries for additional mapped forms rather than branching on unrelated rendering state.
- [ ] **Step 5: Add the focused R5 test cases.** Verify structural delta, unchanged footprint, all four yaw angles, loaded/missing/disabled fallback, ruin/construction suppression, source-light identity, and both phone/desktop face ceilings.
- [ ] **Step 6: Run `node --test tests/building-art-r5.test.js tests/building-r4-tiers.test.js tests/building-replace.test.js`.** Expected: PASS.

## Task 2: Add The Upgrade Assembly Transition

**Files:**
- Modify: `src/scene3d.js`, `src/game.js` only if a pure render-progress helper must be exported without changing simulation output
- Modify: `tests/building-art-r5.test.js`, `tests/orbit.test.js`

**Interfaces:**
- Consumes: current building fields `level`, `remaining`, `hp`, current game upgrade timing, and existing static mesh cache.
- Produces: a pure discrete assembly-stage function. Contract: stage 0 is the completed target tier (or an ordinary non-upgrading building); an in-progress upgrade uses stages 1-3; no writes to building/world/save objects.

- [ ] **Step 1: Pin the current upgrade contract in the test.** Assert `Game.upgrade()` increments `level`, sets `remaining = 6 * level * (elapsed > 300 ? 1.5 : 1)`, and leaves the upgraded tier active in game state. No simulation behavior changes are permitted.
- [ ] **Step 2: Add failing rendering tests for old-tier, assembly, target-tier, completion, and cache reuse.** Include an upgrade with `level >= 2` and a level-1 new construction so they select different visual paths.
- [ ] **Step 3: Implement a pure stage function from `b.level` and `b.remaining`.** Return stage 0 when complete; treat level 1 unfinished buildings as existing scaffold construction; for upgrades return stage 1 when `remaining > 8`, stage 2 when `remaining > 4`, otherwise stage 3. This avoids storing an extra start-time/save field.
- [ ] **Step 4: Render the previous tier plus scaffold at stage 1, the previous tier with partial target modules at stage 2, and the target tier under final scaffold at stage 3.** Use the target tier at stage 0, temporary render-only objects throughout, and never mutate the simulation object.
- [ ] **Step 5: Add the assembly stage to the static mesh cache key.** It must rebuild only when a threshold is crossed, not every simulation/render frame.
- [ ] **Step 6: Run focused tests.** Run `node --test tests/building-art-r5.test.js tests/orbit.test.js tests/steward-construction.test.js`. Expected: PASS; Calm affects only decorative motion, while simulation progress still advances normally.
- [ ] **Step 7: Recheck normal mechanisms rather than duplicating them.** Existing movement/work mechanisms remain state-driven; add no second machinery clock or duplicate ambient effect.
