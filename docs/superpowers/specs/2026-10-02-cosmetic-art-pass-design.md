# Cosmetic Art Pass — KayKit / Quaternius / Kenney (CC0) — Design

Date: 2026-10-02 · Repo: midnights-manner · Path: architectural
Status: approved Plan A — 3 parallel Sol-medium streams in one go

## 1. Goal
Renderer-only low-poly upgrade. Same game — same layout, UI, colors, cozy-day / threatening-night blend — with real model silhouettes (not boxy approximations) from CC0 free tiers. Zero save/gameplay/balance changes.

## 2. Source inventory (verified read-only 2026-10-02)
Local: `C:/Users/Bubs/OneDrive/Desktop/Assets/`
- `KayKit_Adventurers_2.0_FREE/` — Characters/fbx+gltf: Barbarian, Knight, Mage, Ranger, Rogue, Rogue_Hooded + textures, Animations/, License.txt CC0 verified
- `KayKit_Character_Animations_1.1/` — Animations/ + Mannequin
- `KayKit_Skeletons_1.1_FREE/` — characters/fbx+gltf: Warrior, Rogue, Minion, Mage + texture
- `KayKit_Medieval_Hexagon_Pack_1.0_FREE/` — Assets/fbx+gltf+obj hex tiles/roads/buildings + UserGuide
- `KayKit_Forest_Nature_Pack_1.0_FREE/` — Assets/ + Textures/
- PDFs: Asset Catalog + Asset Catalog 2 (13 + 12 CC0 packs: Kenney Fantasy Town 2.0, Castle, Hexagon, Medieval Town, Quaternius Medieval Village MegaKit, LowPoly Medieval Village, Modular Medieval, LowPoly RPG Characters, KayKit Adventurers/Animations, Survival Kit, Nature Kit 2.1, 3D Nature Pack; Enemies/Defense/Props/Environment second sheet)
Repo-pinned: `data/art-manifest.json` 10 baked R3 sets (hi260/lo110, 80 files, 1.31MB), `data/external_assets.json`, `scripts/dev-rig/bake_poses.py` + `REPORT.md` toolchain (FBX2glTF v0.9.7 + CPU skinning, no runtime loader).

Quaternius/Kenney zips not on Desktop — Sol downloads via URLs in PDFs/manifest with SHA-256 checks, or reuses repo-pinned sources. KayKit itch CLI is blocked — use Desktop locals only, no scraping.

## 3. Constraints (all streams)
- Renderer-only flat hex-color meshes; no runtime loaders/textures; keep every export/signature.
- Calm-mode output frozen; ruins/scaffolds/construction ghosts clean (no lights/props/cues).
- Missing/disabled meshes fall back silently to procedural.
- Provenance entries (pack, creator, CC0, URL) in `data/art-manifest.json` + `docs/ASSET_CREDITS.md` + `data/external_assets.json` where required.
- `tests/lighting-baseline.test.js` pins updated ONLY by recompute, each documented as deliberate.
- FORBIDDEN: gameplay/data-balance edits, force-push, merge without user approval. Fast-forward only. `npm test + npm run build` before any push.
- Perf floor: iPhone 12-class 60fps — LODs, density caps, quality tiers hold.

## 4. Stream 1 — CHARACTERS (rebake 10 baked sets)
Files only: `src/character-art.js`, `scripts/dev-rig/bake_poses.py`, `scripts/dev-rig/rebuild_baked_r3.py`, `assets/meshes/baked/`, `data/art-manifest.json`, `data/external_assets.json`, `docs/ASSET_CREDITS.md`.
Mapping: Barbarian→warrior/monk, Knight→warrior, Ranger→ranger, Rogue/Hooded→rogue, Mage→wizard/cleric, Skeletons→skeleton + thornband/cinder/ember tints via bake-time wash.
Targets: hi ~450 / lo ~180 faces, 4 poses each (stand/walk-a/walk-b/attack), under 4 MB total (targets, not hard fail).
Fixes: luminance floor (no cloth darker than ~#3a3f45 except eye pits), weld limbs for 1.65x zoom separation, weapons/tools anchored IN baked hands, miner lamp emissive, profession readability by silhouette.
Reuse `REPORT.md` + `bake_poses.py`; no re-deriving. Small diffs.
Test: add `tests/baked-r4-characters.test.js` only (luminance, seam, anchor, weight, fallback). Do not edit existing tests.

## 5. Stream 2 — BUILDINGS (8 core families)
Files only: `src/scene3d.js` (`masterworkDetails()`), `src/building-art.js`, `src/living-props.js`, `src/asset-art.js`, `src/source-lighting.js` (anchors only).
Families: hall, cottage, barracks, farm, lumber, mine, market, forge.
Use KayKit Medieval Hexagon + Quaternius MegaKit + Kenney Fantasy Town/Castle geometry: gable roofs, shutters, doors, chimneys, stairs, lanterns anchored to EXISTING light system.
Tiers differ structurally, never recolor-only. Footprints and collision identical.
Test: add `tests/building-r4-tiers.test.js` only (tier-structure diff, footprint, light anchors, calm/ruin suppression).

## 6. Stream 3 — TERRAIN (per-biome silhouettes)
Files only: `src/environment-art.js`, `src/wind-art.js`, `data/biomes.json`, `src/external-geometry.js` (converted-mesh path), `assets/meshes/tree-simple.json`, `bush.json`, `rock-small-*.json`, `flower-*.json`, `lily-*.json`, `log.json`.
Use Kenney Nature 2.1 / 3D Nature + KayKit Forest via existing converted-mesh path with procedural fallbacks.
Content: layered conifers + broadleaf, flower drifts, reeds + lily pads, craggy rocks + cairns, darker dense fringe. Keep density caps, LOD gating, calm-safe static geometry.
Test: add `tests/terrain-r4-biomes.test.js` only (biome routing, caps, fallback, calm).

## 7. Model routing (strict)
Muse coordinates, reviews, judges only. All heavy implementation through subagents on OpenAI connection using GPT 6.1 Sol at medium effort:
`opencode run -m opencode/gpt-6.1-sol --dir <repo> --title <task> "<one task brief>"`
Never use opencode-go credits. Fallback Muse via Zen if Sol exhausts. Batch 3 briefs in parallel; each agent forbidden from broad repo re-reads.

## 8. Token rules (strict)
Batch independent subagents in parallel; exact file lists above; reuse `REPORT.md` + `bake_poses.py`; small diffs; targeted test files first, ONE full `npm test` at end; no repeat captures (one day + one night close-up set).

## 9. Verify + DONE
Each stream: targeted suite green → then `npm test + npm run build + npm run capture + npm run test:browser` green (browser requires CHROME_BIN/Edge; failure blocks merge).
Muse screenshot review + independent visual judge scoring 90+ with equal 25/25/25/25 buildings/villagers/enemies/environment, full matrix (yaw 0/90/180/270, day/night/dawn, zoom 1.0/1.65/2.2, desktop + phone night), perf+calm bar. Below 90 loops with fix notes. Report per-stream: files changed, test counts, weight totals, changed pins.
DONE = all green + review + 90+ + green merge.
