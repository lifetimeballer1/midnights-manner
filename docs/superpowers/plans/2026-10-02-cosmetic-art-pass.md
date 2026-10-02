# Cosmetic Art Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renderer-only KayKit/Quaternius/Kenney CC0 art upgrade across characters, buildings, terrain with zero gameplay change.

**Architecture:** Three parallel Sol-medium streams with disjoint file ownership; offline bake/convert then src wiring; Muse merges, verifies, judges to 90+.

**Tech Stack:** Vanilla JS Canvas flat-face renderer, Python offline bakers (numpy/Pillow/fast-simplification, FBX2glTF v0.9.7), Node --test, static build + look-capture.

**Spec:** `docs/superpowers/specs/2026-10-02-cosmetic-art-pass-design.md`

## Global Constraints

- Renderer-only flat hex-color meshes; no runtime loaders/textures; keep every export/signature.
- Calm-mode output frozen; ruins/scaffolds/ghosts clean.
- Missing/disabled meshes fall back silently.
- Provenance in `data/art-manifest.json` + `docs/ASSET_CREDITS.md` (+ `data/external_assets.json` where required).
- `tests/lighting-baseline.test.js` pins updated ONLY by recompute, each documented deliberate.
- FORBIDDEN: gameplay/data-balance edits, force-push, merge without user approval. Fast-forward only. `npm test + npm run build` before any push.
- Perf floor iPhone 12-class 60fps; LODs/density caps hold.
- Sol routing only: `opencode run -m opencode/gpt-6.1-sol --dir <repo> --title <task> "<brief>"`. Never opencode-go. Zen fallback if Sol exhausts.
- Each stream adds its own test file; never edit existing tests. Targeted green first, ONE full suite at end. One day + one night close-up capture set.

---

### Task 1: CHARACTERS — rebake 10 sets via KayKit locals

**Files:**
- Modify: `src/character-art.js`
- Modify: `scripts/dev-rig/bake_poses.py` (only if needed for KayKit GLB + luminance clamp)
- Modify: `scripts/dev-rig/rebuild_baked_r3.py` (paths to Desktop locals)
- Create: `assets/meshes/baked/<set>-<pose>-<hi|lo>.json` (rebaked, hi~450/lo~180 target, <4MB total target)
- Modify: `data/art-manifest.json`, `data/external_assets.json`, `docs/ASSET_CREDITS.md`
- Test: `tests/baked-r4-characters.test.js`

**Interfaces:**
- Consumes: Desktop `KayKit_Adventurers_2.0_FREE/Characters/gltf/*.glb`, `KayKit_Skeletons_1.1_FREE/characters/gltf/*.glb`, `KayKit_Character_Animations_1.1/Animations/`; existing `bakedSetId()`, `bakedPoseFor()`, `characterModel()` signatures unchanged.
- Produces: Same pose file paths; same manifest schema; same renderer API.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
const bakedFiles = (await readdir(new URL('../assets/meshes/baked/', import.meta.url))).filter(f => f.endsWith('.json'));
test('r4 luminance floor holds', async () => {
  for (const f of bakedFiles) {
    const m = JSON.parse(await readFile(new URL('../assets/meshes/baked/' + f, import.meta.url), 'utf8'));
    for (const face of m.faces) {
      const v = parseInt(face.c.slice(1), 16);
      const r = v >> 16, g = (v >> 8) & 255, b = v & 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      assert.ok(lum >= 52 || face.eyePit === true, `${f} ${face.c} below floor`);
    }
  }
});
test('r4 weight target holds', async () => {
  let total = 0;
  for (const f of bakedFiles) total += (await stat(new URL('../assets/meshes/baked/' + f, import.meta.url))).size;
  assert.ok(total < 4 * 1024 * 1024, `baked weight ${(total/1048576).toFixed(2)}MB`);
});
```

- [ ] **Step 2: Run test to verify current gaps**

Run: `node --test tests/baked-r4-characters.test.js`
Expected: FAIL (file missing or luminance/seam gaps on old bakes)

- [ ] **Step 3: Rebake via Sol-medium (Muse does not bake)**

Run (one brief, medium effort):
`opencode run -m opencode/gpt-6.1-sol --dir C:\Users\Bubs\OneDrive\Documents\midnights-manner --title "R4 characters rebake" "Rebake 10 sets from Desktop KayKit locals via scripts/dev-rig/bake_poses.py. Map Barbarian/Knight->warrior/monk, Ranger->ranger, Rogue/Hooded->rogue, Mage->wizard/cleric, Skeletons->skeleton+thorn/cinder/ember tints. Clamp cloth >=#3a3f45, weld limbs, anchor weapons in hands, miner lamp emissive. Touch ONLY src/character-art.js, scripts/dev-rig/bake_poses.py, rebuild_baked_r3.py, assets/meshes/baked/, data/art-manifest.json, data/external_assets.json, docs/ASSET_CREDITS.md + new test. Small diffs. Targeted test green before commit."`

- [ ] **Step 4: Run targeted tests**

Run: `node --test tests/baked-r4-characters.test.js tests/baked-r3.test.js tests/character-art.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/character-art.js scripts/dev-rig/bake_poses.py scripts/dev-rig/rebuild_baked_r3.py assets/meshes/baked/ data/art-manifest.json data/external_assets.json docs/ASSET_CREDITS.md tests/baked-r4-characters.test.js
git commit -m "art(r4): KayKit character rebake + luminance/seam fixes"
```

### Task 2: BUILDINGS — 8-family modular tiers

**Files:**
- Modify: `src/scene3d.js`, `src/building-art.js`, `src/living-props.js`, `src/asset-art.js`, `src/source-lighting.js` (anchors only)
- Modify: `assets/meshes/*.json` (converted Hexagon/MegaKit/Town pieces only), `data/art-manifest.json`, `docs/ASSET_CREDITS.md`
- Test: `tests/building-r4-tiers.test.js`

**Interfaces:**
- Consumes: Desktop `KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/` + `obj/`; existing `buildingModel()`, tier, footprint, light-anchor APIs unchanged.
- Produces: Same building type/level/footprint/collision; structural tier deltas only.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
test('r4 tiers differ structurally', async () => {
  const {readFile} = await import('node:fs/promises');
  const data = JSON.parse(await readFile(new URL('../data/buildings.json', import.meta.url), 'utf8'));
  for (const fam of ['hall','cottage','barracks','farm','lumber','mine','market','forge']) {
    assert.ok(data.buildings?.[fam] || data[fam], fam + ' family present');
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/building-r4-tiers.test.js`
Expected: FAIL (file missing or tier-shape gaps)

- [ ] **Step 3: Implement via Sol-medium**

Run:
`opencode run -m opencode/gpt-6.1-sol --dir C:\Users\Bubs\OneDrive\Documents\midnights-manner --title "R4 building tiers" "Build 8-family modular tiers from Desktop KayKit_Medieval_Hexagon locals + Quaternius/Kenney URLs. Gable roofs, shutters, doors, chimneys, stairs, lanterns anchored to EXISTING light system. Structural not recolor. Footprints identical. Touch ONLY src/scene3d.js, src/building-art.js, src/living-props.js, src/asset-art.js, src/source-lighting.js, assets/meshes/, data/art-manifest.json, docs/ASSET_CREDITS.md + new test. Calm/ruins clean. Targeted green before commit."`

- [ ] **Step 4: Run targeted tests**

Run: `node --test tests/building-r4-tiers.test.js tests/building-silhouette.test.js tests/building-detail-pass.test.js`
Expected: PASS (lighting-baseline repinned ONLY by recompute with note)

- [ ] **Step 5: Commit**

```bash
git add src/scene3d.js src/building-art.js src/living-props.js src/asset-art.js src/source-lighting.js assets/meshes/ data/art-manifest.json docs/ASSET_CREDITS.md tests/building-r4-tiers.test.js
git commit -m "art(r4): modular building tiers (8 families)"
```

### Task 3: TERRAIN — per-biome silhouettes

**Files:**
- Modify: `src/environment-art.js`, `src/wind-art.js`, `data/biomes.json`, `src/external-geometry.js`
- Modify: `assets/meshes/tree-simple.json`, `bush.json`, `rock-small-*.json`, `flower-*.json`, `lily-*.json`, `log.json` (converted only)
- Test: `tests/terrain-r4-biomes.test.js`

**Interfaces:**
- Consumes: Desktop `KayKit_Forest_Nature_Pack_1.0_FREE/Assets/` + Kenney Nature URLs; existing converted-mesh path + procedural fallback; same density/LOD/calm API.
- Produces: Same biome keys, same caps, same exports.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
test('r4 biome routing holds', async () => {
  const {readFile} = await import('node:fs/promises');
  const b = JSON.parse(await readFile(new URL('../data/biomes.json', import.meta.url), 'utf8'));
  for (const k of ['plains','forest','water','hills','unclaimed-fringe']) assert.ok(b[k], k + ' biome present');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/terrain-r4-biomes.test.js`
Expected: FAIL (file missing or silhouette gaps)

- [ ] **Step 3: Implement via Sol-medium**

Run:
`opencode run -m opencode/gpt-6.1-sol --dir C:\Users\Bubs\OneDrive\Documents\midnights-manner --title "R4 terrain biomes" "Per-biome silhouettes via converted-mesh path + procedural fallback from Desktop KayKit_Forest locals + Kenney Nature. Layered conifers+broadleaf, flower drifts, reeds+lily, craggy rocks+cairns, dense fringe. Touch ONLY src/environment-art.js, src/wind-art.js, data/biomes.json, src/external-geometry.js, listed assets/meshes + new test. Density/LOD/calm-safe held. Targeted green before commit."`

- [ ] **Step 4: Run targeted tests**

Run: `node --test tests/terrain-r4-biomes.test.js tests/biomes.test.js tests/environment-art.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/environment-art.js src/wind-art.js data/biomes.json src/external-geometry.js assets/meshes/ tests/terrain-r4-biomes.test.js
git commit -m "art(r4): per-biome terrain silhouettes"
```

### Task 4: Integration — green merge + judge 90+ loop

**Files:** `tests/lighting-baseline.test.js` (recompute only), `artifacts/look-*.png`

- [ ] **Step 1: ONE full suite + build + capture + browser**

Run: `npm test`
Expected: PASS (all suites)
Run: `npm run build`
Expected: PASS
Run: `npm run capture`
Expected: `artifacts/look-*.png` day+night close-up set written (single set, no repeats)
Run: `npm run test:browser`
Expected: PASS (needs CHROME_BIN/Edge; failure blocks merge)

- [ ] **Step 2: Muse screenshot review + independent judge**

Score equal 25/25/25/25 buildings/villagers/enemies/environment across full matrix (yaw 0/90/180/270, day/night/dawn, zoom 1.0/1.65/2.2, desktop + phone night). Below 90 → Sol fix notes, re-verify, loop till 90+.

- [ ] **Step 3: Report + merge**

Report per-stream: files changed, test counts, weight totals, changed pins. Fast-forward merge only after user approval. Never force-push.
