# LIGHTING — Phase 2: midnight lighting core (shade() / paint())

Status: implemented with the presentation pass, Phase 2 (2026-09-28).
Scope: scene mesh shading only. Point lights/lanterns, weather response, AO,
vignette rework and terrain tinting are Phases 3–4 and stay out of this doc.

## Goal

Mesh shading today is a fixed formula baked into every face at construction
(`shade()` in `src/scene3d.js`). The sky clock already tints the screen
(`lightingFor()` in `src/systems/daynight.js`) but the geometry itself never
notices day or night. Phase 2 makes the meshes respond to the existing clock,
data-driven, with no save fields and no new save version.

## Model

Per face: `painted = albedo × (ambient + key·max(0, N·L) + sky·max(0, N·z) + emissive·G)`

- `ambient`: `ambient.color` (0..1 rgb) × `ambient.intensity`.
- `key`: `key.color` × `key.intensity` × `max(0, N·L)` where `L` is
  `key.dir` (unnormalized is allowed; `norm` divides the dot when present).
- `sky`: fraction of `max(0, N·z)` — the old upward-facing fill.
- `emissive`: per-face flag (windows, forge/watchfire flames) × the phase's
  `emissive` boost. Keeps small warm faces readable at midnight.

Day defaults reproduce the legacy formula byte-for-byte:
`ambient {#ffffff, 0.72}`, `key {#ffffff, 0.26, dir[-0.4,-0.5,1], norm 1.187}`,
`sky 0.12`, `emissive 0`. `tests/lighting-baseline.test.js` pins this by
comparing paint-time day output against digests frozen before Phase 2.

## Where it lives

- `src/systems/daynight.js` — the only tuning home. `SKIES` table holds the
  four phase descriptors; `skyLightAt(elapsed, data, {calm})` resolves the
  phase (via `phaseAt`), crossfades between the previous and current phase over
  `daynight.lightBlend` (fraction of a day, default 0.04) and returns a flat
  object that `shade()` can consume without re-parsing colors per face:
  `{phase, keyDir, keyNorm, keyRGB, keyI, ambRGB, ambI, sky, emissive, key}`.
  `key` is a bucket id (`phase:0..191`) used for painted-color caching.
- `src/scene3d.js` — `shade(hex, normal, light, emissive)` (exported, pure).
  `MeshScene` stores raw albedo, the face normal and the emissive flag; it no
  longer stores a shaded color. `paint()` shades once per face per light bucket
  (`f.paintedKey`), then fills/strokes with the painted color.
- `src/renderer.js` — the sky overlay now reads `skyLightAt(...).overlay`
  (identical to the old `lightingFor(phase.id)` result) so screen tint and mesh
  light share one clock read per frame.

## Data (all optional, additive)

World authors can override any phase under `data/world.json` →
`world.daynight.lighting.<phase>`:

```json
{"daynight": {"lighting": {"night": {
  "key": {"intensity": 0.2, "color": "#b9c9ff"},
  "ambient": {"intensity": 0.45},
  "sky": 0.08,
  "emissive": 0.9
}}}}
```

Fields not supplied keep their defaults; out-of-range values are clamped the
same way `lightingFor()` already clamps overlay values. Worlds without a
`daynight` block (every existing save/data file) read the defaults — at noon
that is exactly the pre-Phase-2 look.

## Sky values shipped

| phase | key dir           | key color × I      | ambient × I        | sky  | emissive |
|-------|-------------------|--------------------|--------------------|------|----------|
| dawn  | [-0.2,-0.6,0.8]   | `#f2c96e` × 0.24   | `#a8b6cc` × 0.60   | 0.10 | 0.35     |
| day   | [-0.4,-0.5,1]     | `#ffffff` × 0.26   | `#ffffff` × 0.72   | 0.12 | 0        |
| dusk  | [-0.6,-0.35,0.75] | `#e8a25e` × 0.24   | `#c9a68c` × 0.58   | 0.10 | 0.30     |
| night | [0.45,-0.3,0.85]  | `#9fb4e8` × 0.16   | `#4a5f8e` × 0.40   | 0.07 | 1.00     |

Balanced-visuals rule: night keeps silhouettes readable (ambient ≥ 0.4) and
lamps/windows carry the warmth; the screen-space overlay still does the deep
darkening. `calm` (prefers-reduced-motion) skips the crossfade and steps per
phase.

## Performance

- Lighting resolves once per `drawVillage3D` call; `shade()` runs per face only
  when the light bucket changes (192 buckets/day → ~1.6 s at the default day).
  Every other frame the loop only reads `f.painted`.
- Faces are painted every frame already (painter's algorithm); no new geometry,
  no per-frame allocations in the face loop, no change to the static mesh cache
  key — the clock never rebuilds geometry (pinned since Phase 1).
- Budget signal: `?perf` badge / `frameReport()` face counts + `npm run capture`
  screenshots at dawn/day/dusk/night.

## Test map

- `tests/lighting.test.js` — sky resolution, day byte-exactness, data overrides
  and clamps, calm stepping, emissive behavior, cross-phase luminance order.
- `tests/lighting-baseline.test.js` — geometry+albedo digests, legacy day
  digest equality (paint-time), night painted digests, static-cache invariant.
- `tests/daynight.test.js` — unchanged: overlay pins (`lightingFor` keeps its
  contract; `skyLightAt().overlay` re-exports it).
