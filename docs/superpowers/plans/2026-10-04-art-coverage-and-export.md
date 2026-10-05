# Art Coverage And Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Establish a verified source-to-game coverage ledger and a reproducible offline export path for customized Blender assets.

**Architecture:** Inspect Blender source models read-only, then author only in a new v9 copy. Export static assets as OBJ/MTL and reuse the game's offline conversion conventions to produce the existing flat-face JSON mesh schema; keep character GLBs on the existing pose-bake path. Game manifests remain the runtime registry.

**Tech Stack:** Blender 5.2.2; Python; existing `scripts/export-art.py`, `scripts/convert-external-assets.py`, `scripts/dev-rig/bake_poses.py`; JSON manifests; Node tests.

**Spec:** `docs/superpowers/specs/2026-10-04-midnights-manner-art-integration-design.md`

## Global Constraints

- Work only in the approved OneDrive checkout and preserve v8; output a new v9 Blender file.
- No runtime model/texture/rig loader and no runtime network dependency.
- Output static geometry as `{meta, faces:[{v:[[x,y,z],...], c:'#rrggbb'}]}` in tile units, centered on footprint and grounded at z=0.
- Use the existing shared palette and preserve largest-area-first LOD behavior.
- Record source creator, license evidence, source hash, modifications, and derivative lineage.
- Keep source packs and authoring files out of `dist/`; do not raise existing face caps.

## Task 1: Build The Coverage Ledger

**Files:**
- Create: `docs/ART_COVERAGE.md`
- Test: `tests/art-coverage.test.js`
- Read only: `data/buildings.json`, `data/troops.json`, `data/biomes.json`, `data/art-manifest.json`, `data/external_assets.json`, Blender v8 scenes

**Interfaces:**
- Consumes: existing game registries and the Blender asset library/catalog.
- Produces: a markdown matrix with source/model ID, target game IDs/roles, derivative decision, license evidence, output manifest ID, and state (`mapped`, `queued`, `rejected`).

- [ ] **Step 1: Write a failing ledger test.** Parse the ledger table and assert each non-empty manifest ID exists in `data/art-manifest.json`, every listed game building/type/biome key exists in its data file, each external source row has license/hash fields, and every `queued` row states a concrete blocker.
- [ ] **Step 2: Run `node --test tests/art-coverage.test.js`.** Expected: FAIL because the ledger does not yet exist.
- [ ] **Step 3: Inventory Blender v8 without modifying it.** Enumerate all source objects, existing catalog forms, custom/unmatched forms, character models/actions, pivots, and available materials. Reconcile the reported 195 custom forms against actual game IDs and authored tier counts; do not assume the counts are equal.
- [ ] **Step 4: Populate `docs/ART_COVERAGE.md`.** Record every candidate source/model and its intended game role. Mark no-match, rights-unverified, duplicate, or over-budget assets as queued/rejected instead of silently omitting them.
- [ ] **Step 5: Run the focused coverage test.** Expected: PASS with no dangling IDs or unqualified external source entries.

## Task 2: Add A Deterministic Blender OBJ Export Path

**Files:**
- Modify: `scripts/export-art.py`
- Create: `tests/fixtures/art-export/triangle.obj`, `tests/fixtures/art-export/triangle.mtl`
- Test: `tests/art-export.test.js`
- Outputs: reviewed per-asset files under `assets/meshes/`

**Interfaces:**
- Consumes: a static OBJ+MTL exported from Blender, explicit target height, output ID, and `data/palette.json`.
- Produces: tile-centered and grounded JSON `{meta, faces:[{v:[[x,y,z],...], c:'#rrggbb'}]}` with largest faces first; preserves the existing remote-archive invocation while adding the local-file mode.

- [ ] **Step 1: Add a local-fixture test.** Invoke the exporter through `child_process.spawnSync` with the fixture OBJ/MTL, an output path in `os.tmpdir()`, target height `1`, and a low face cap. Assert a zero exit status, finite three-dimensional points, valid hex colors, minimum z≈0, and normalized height≈1.
- [ ] **Step 2: Run `node --test tests/art-export.test.js`.** Expected: FAIL because local OBJ/MTL arguments are not supported.
- [ ] **Step 3: Refactor only the source-reading boundary.** Add a local OBJ/MTL input path that shares the existing normalization, triangulation, palette mapping, and face-budget logic. Keep the current archive-based CLI behavior unchanged.
- [ ] **Step 4: Use `data/palette.json` as the single color target.** Convert source material/texture colors to the nearest approved game palette entry; permit explicit reviewed per-asset role overrides without a second palette registry.
- [ ] **Step 5: Run the focused exporter test and existing asset tests.** Run `node --test tests/art-export.test.js tests/asset-art.test.js tests/external-art.test.js`. Expected: PASS; existing converters and generated geometry remain unchanged.
- [ ] **Step 6: Save Blender authoring work to v9 only.** Keep v8 unchanged; export selected static modules as OBJ/MTL and character rigs/poses as GLB inputs for `bake_poses.py`.

## Task 3: Register And Verify Outputs

**Files:**
- Modify per reviewed asset: `data/art-manifest.json`, `data/external_assets.json`, `docs/ASSET_CREDITS.md`
- Create: `assets/meshes/<reviewed-id>.json`
- Test: `tests/art-coverage.test.js`, `tests/asset-art.test.js`

- [ ] **Step 1: Keep every new manifest entry disabled until its workstream test passes.** Include an explicit output file, role/use, source, creator, license evidence, SHA-256, and transformation summary.
- [ ] **Step 2: Verify every output against the coverage ledger.** Ensure the mesh loads through the existing `src/main.js` manifest loop and the disabled/missing path retains procedural fallback.
- [ ] **Step 3: Enable only the assets consumed by reviewed workstream code.** Update the expected enabled-ID assertion in the focused test; do not enable unused inventory assets.
- [ ] **Step 4: Run `node --test tests/art-coverage.test.js tests/asset-art.test.js`.** Expected: PASS with no missing files, licenses, or runtime consumers.
