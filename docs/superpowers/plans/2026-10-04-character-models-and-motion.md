# Character Models And Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring reviewed Blender-source character models into every applicable game role/faction archetype while preserving profession identity, equipment, and existing gameplay motion.

**Architecture:** Use the existing offline `bake_poses.py` pipeline and `art-manifest.baked` registry. Map Blender-source bodies into current shared sets, rebake only when the source adds a meaningful model/pose improvement, and retain role-specific outfits, equipment overlays, LOD, and procedural fallback.

**Tech Stack:** Blender/GLB offline inputs; `scripts/dev-rig/bake_poses.py`, `scripts/dev-rig/rebuild_baked_r3.py`; `assets/meshes/baked/`; `src/character-art.js`; JSON manifests; Node tests.

**Spec:** `docs/superpowers/specs/2026-10-04-midnights-manner-art-integration-design.md`

## Global Constraints

- Do not add runtime skinning or a runtime animation loader.
- Preserve all troop/faction identifiers, stats, equipment behavior, and saves.
- Keep discrete stand/walk/work/attack poses; maintain grounded pivots and head/hand/chest/back anchors.
- Keep profession/faction colors, per-role silhouette cues, and gear sub-meshes.
- Preserve current LOD thresholds, procedural fallback, baked-pose budgets (hi 450 / lo 180) and total baked size below 4 MiB unless a separately reviewed measurement authorizes a change.
- Verify CC0/adaptation evidence, license files, source/texture hashes, and transformation metadata.

## Task 1: Audit Character Coverage And Select New Bodies

**Files:**
- Modify: `docs/ART_COVERAGE.md`
- Read only: `data/troops.json`, `src/character-art.js`, `data/art-manifest.json`, current baked assets, v8 character library/actions

**Interfaces:**
- Consumes: current `bakedSetId(u,troop,enemy)`, `bakedPoseFor(u,gait,zoom,detail,time,lift)`, and character manifest mapping.
- Produces: explicit source-to-role/faction mapping with body, pose clips/fractions, tint/outfit, gear anchors, license state, and reuse/new-bake decision.

- [ ] **Step 1: List every game troop and enemy faction from data.** Map each to the current baked set and procedural fallback; compare to every character body/action in Blender v8.
- [ ] **Step 2: Assign a concrete source model or existing-body reuse decision to every applicable set.** Reject unlicensed, redundant, missing-anchor, or over-budget bodies and state why in the coverage ledger.
- [ ] **Step 3: Run `node --test tests/baked-r3.test.js tests/baked-r4-characters.test.js`.** Expected: current baseline passes before rebaking.

## Task 2: Bake And Register Reviewed Character Sets

**Files:**
- Modify: `scripts/dev-rig/rebuild_baked_r3.py`, `scripts/dev-rig/bake_poses.py` only for verified missing clip/anchor support
- Modify: `src/character-art.js`, `data/art-manifest.json`, `data/external_assets.json`, `docs/ASSET_CREDITS.md`, `docs/ART_COVERAGE.md`
- Create/update: `assets/meshes/baked/<set>-<pose>-<hi|lo>.json`
- Test: `tests/baked-r5-characters.test.js`

**Interfaces:**
- Consumes: source model/clip mapping from Task 1 and existing CPU-skinning/palette/anchor baker.
- Produces: the same `<set>-<pose>-<lod>` runtime keys loaded by `src/main.js`, with metadata for creator/license/source hash/clip/fraction/anchors.

- [ ] **Step 1: Write a failing R5 test for set/pose coverage.** Require every `bakedSetId` result to resolve enabled stand, walk-a, walk-b, and attack hi/lo files; require grounded finite meshes, in-body hand/head anchors, valid provenance, existing fallback, and total size under 4 MiB.
- [ ] **Step 2: Run `node --test tests/baked-r5-characters.test.js`.** Expected: FAIL for any missing R5 set/pose/provenance contract.
- [ ] **Step 3: Export source rigs/clips to local GLB without changing v8.** Use the project-pinned converter/toolchain and verify source/texture hashes before baking.
- [ ] **Step 4: Bake the mapped pose set.** Use discrete samples from verified clips, a shared per-set palette with vivid medieval faction/profession colors, matched hi/lo height, preserved anchors, and explicit `--max-faces` budgets.
- [ ] **Step 5: Keep role/faction differences in the existing runtime mapping.** Update `src/character-art.js` only for mappings, tint/outfit selection, or pose gaps demonstrated by the coverage audit; do not duplicate bodies per troop ID.
- [ ] **Step 6: Add manifest, license, and credit records.** Keep unused/rejected source bodies disabled or out of runtime assets.
- [ ] **Step 7: Run `node --test tests/baked-r5-characters.test.js tests/baked-r3.test.js tests/baked-r4-characters.test.js tests/character-art.test.js`.** Expected: PASS, with current role, gear, and fallback contracts intact.
