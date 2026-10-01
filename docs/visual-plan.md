# Visual plan — one page (Phase 0 entry)

Status: measured 2026-10-01. Adapts `visual-upgrade-spec.md` to the shipped 3D stack. No gameplay/balance/save change.

## 1. Measured tile
- `tw=43, th=22` (`src/renderer.js:31`), ~2:1 diamond. Projection orthographic `scale=tw/SQRT2` (`src/camera.js:5`).
- Play zoom `1.65x` (`src/renderer.js:45`), limits `.3-3.6` big grid / `.55-3.6` small (`src/camera.js:17`). Grid `52x44` (`data/world.json`).
- Pixel rule for 3D: albedo texel matches tile scale; faces snap to whole device pixels idle; `dpr=min(dpr,2)`.

## 2. Orbit / rotation
- Free 360° yaw (wrap `0-2PI`) + pitch clamp `PI/9-PI*.46`, defaults `YAW=PI/4, PITCH=asin(22/43)` (`src/camera.js:3-11`).
- True low-poly `MeshScene.face/box/roof/pyramid` (`src/scene3d.js:43-69`), painter sort, backface+frustum cull. Static-mesh key includes yaw/pitch — rotate rebuilds mesh+terrain.
- Verdict: no 4-view art, no billboards. Sun/moon azimuth rotates with camera via `key.arc` (`src/systems/daynight.js`, `docs/LIGHTING.md:40-51`).

## 3. Sprite/mesh list — derived, never hardcoded
Generators read `Object.keys()` at build time; names below are counts only:
- Buildings: 62 types via `data/buildings.json` — 53x6-tier, `trap` 3, `grand-watchtower` 3, `manner-citadel` 4, 6x1-tier wonders (`oathstone,fire-trap,bellcote,moon-dial,cairnfield,dawn-gate`). Sizes: 27x1-tile, 30x2-tile, 5x3-tile. Walls: pillar + 4 arms (NE/SE/SW/NW) + gate per tier, mask from `wallNeighbors` (`src/building-art.js`).
- Troops: 37 via `data/troops.json` — combat 9, collector 12, builder 3, keeper 13. Gear overlays from `data/items.json` (88 items: slash 10, sweep 16, slam 4, arrow 3, tap 46, roll/brace/oath 5, unlabelled 5).
- Env: 5 biomes (`data/biomes.json`), 4 grass variants by seed hash, pond/reeds/shore, 4 tree species x2 sizes (split canopy/trunk), rocks/bushes/stumps/logs, forest ring + fog + vignette, ambient cap ~20.
- Light/weather: phases dawn/day/dusk/night + rain/fog (`data/world.json:daynight`), deterministic from day number, no saved state.

## 4. Decisions (approved)
Extend 3D meshes (not Pillow atlas); full 62x6 scope; `data/palette.json` 40 colors drives meshes+previews; per-face emissive flag (no parallel atlas, no `ctx.filter`); true 3D rotation; 8-pose weapons + anchor JSON; pillar+4 walls; chunked ground/mesh cache; unsaved wear cap 180 (`src/renderer.js:52-73`); split-canopy wind sway; offset-poly shadows; per-face shade + spill pools; day-seeded weather; pooled typed-array particles 150-200; CSS `border-image` wood over `kingdom.css`; Quality in Display panel + auto-degrade >20ms/3s; reuse `preview.mjs` + `look-capture.mjs` sheets (max 3 shots/phase); sequential 0-5 one commit each.
Fallback: artist = GPT 6.1 Sol Medium (OpenAI conn); grunt = DeepSeek V4.1 Flash (opencode-go conn). If GPT usage exhausts, boss (Muse Spark) fills art — never DeepSeek.

## 5. Budgets
Token: read-once file list, grep-first, contact sheets only, max 2 refinements/family, ≤400 lines/file, ≤5-line phase summary. Phone: 60fps iPhone Safari, static/chunk cache, 30k-face guard, LOD far<0.6/near>1.5, caps 8/12/14 smoke/trail/splash, ~40 lights culled, Calm freezes motion. Gate every phase: sheet review, squint 1/4, old-save load, `npm test && npm run build`, `?perf` <8ms desktop / Low 60fps mobile, orbit/pinch/grid/Motion intact.
