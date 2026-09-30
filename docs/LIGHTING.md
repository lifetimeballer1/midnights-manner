# LIGHTING — sky shading, source profiles, weather and AO

Status: sky-light phases 2–4 plus source-light identity implemented 2026-09-28; Stormglass retune (dawn/dusk/night, fog veil) landed after Phase E with day byte-identical. Scope: scene mesh shading, the key-light arc, source-projected ground spill, weather response on meshes, per-face ground occlusion, contact shadows and the vignette. Terrain tinting and cast shadows between separate structures remain future work.

## Goal

The sky clock already tinted the screen (`lightingFor()`), but the geometry
was baked once with a fixed light and never noticed day or night. These phases
make the meshes follow the clock — sun and moon sweeping, weather touching the
village, shadows swinging, the frame breathing with the dark — data-driven,
with no save fields and no new save version.

## Model

Per face: `painted = albedo × dim × ao × (ambient + key·max(0, N·L) + sky·max(0, N·z) + emissive·G)`,
then the fog veil: `painted = mix(painted, fogColor, fog × depth01)`.

- `ambient`: `ambient.color` (0..1 rgb) × `ambient.intensity`.
- `key`: `key.color` × `key.intensity` × `max(0, N·L)`. `L` comes from the
  phase's directional light: `key.dir` (unnormalized allowed, `norm` divides
  the dot) or, when present, the phase's `key.arc` — see below.
- `sky`: fraction of `max(0, N·z)` — the old upward fill.
- `emissive`: per-face flag (windows, forge/watchfire flames and armed fire
  traps) × the phase's `emissive` boost. Keeps small warm faces readable at
  midnight.
- `ao`: per-face ground-contact occlusion, fixed at construction —
  `0.8 + 0.2 × clamp(average vertex height / 0.7, 0, 1)`. Tall faces split
  into a 3×3 grid, so their feet shade darker than their crowns. Roofs and
  anything above 0.7 tiles sit at 1.0.
- `dim`: weather's flat dimming of the lit value (rain 0.92).
- `fog` / `fogRGB`: weather veil; `depth01` is 0 for the nearest face of the
  frame and 1 for the farthest, computed in `paint()`.

Day defaults still reproduce the legacy fixed-light formula
(`ambient {#ffffff, 0.72}`, `key {#ffffff, 0.26}`, `sky 0.12`, `emissive 0`).
The exactness guarantee is pinned against a synthetic frozen light at flat AO
in `tests/lighting-baseline.test.js`; the sky's own look is pinned by
day/night/dawn digests.

## Sun and moon arcs

`key.arc` is `[fromDir, toDir]` sampled by the phase-local progress `p`
(0 at phase start, 1 at phase end). The day arc is
`[-0.9,-0.4,0.95] → [0.1,-0.6,1.05]`, whose midpoint is exactly the legacy
noon direction; the night arc `[0.75,-0.45,0.55] → [-0.6,-0.3,0.75]` sweeps
the moon back across the sky. Dawn and dusk arcs carry the low sunrise and
sunset light. Arc-sampled directions are normalized with their true
magnitude; a phase without `arc` uses its static `dir`/`norm` constants.

An explicit `key.dir` in data disables the base phase's arc (authors steering
direction beat the sweep); a bad override falls back to the base static dir.

## Shadows and the frame (Phase 4)

- **Contact shadows**: every building footprint throws a flat ink polygon and
  every standing unit a small ellipse, offset opposite the key direction —
  `.42 × min(1, keyI/0.26)` tiles — with alpha `max(.06, min(.22, keyI × .75))`.
  The offset swings with the sun/moon arc and fades after dark. One polygon
  per body per frame; never baked into the terrain cache, never blurred.
- **Vignette**: per-phase `vignette` (dawn 0.40, day 0.34, dusk 0.46, night
  0.55), crossfaded with the other light fields, clamped ≤ 0.7.
- **Moon glow**: the warm corner glow follows the key light's east–west
  component (`width × (.5 + .42 × clamp(keyDir.x))`), so the Phase 3 moon
  sweep is visible on screen; it fades with the overlay glow (day = none).

## Source lighting identity

Visible emitters register tile-space light sources beside their actual geometry. Each source now carries one renderer-only profile:

- **window** — pale warm light, fast falloff, narrow facade-directed spill, effectively steady.
- **lantern** — compact gold radial pool with only a trace of motion.
- **torch** — wider directional orange spill with restrained deterministic flicker.
- **fire** — forge and watchfire pools reach farther, run hotter, and flicker more than torches.
- **trap** — armed fire traps use a compact, sharper pulse so a trap never reads like a bonfire.

`prepareSourceLighting()` still computes the inexpensive warm wash on the source building once with cached geometry. Profile falloff can change that local contribution, but time/flicker never enters the static mesh cache. `drawSourceSpill(scene, time)` is the dynamic half: it projects each source onto the ground plane with the orbit camera, applies the profile's radial or clipped directional footprint, palette and deterministic pulse, and draws beneath opaque meshes. `prefers-reduced-motion`/Calm returns a flicker multiplier of exactly 1.

Profiles do not add save fields or simulation state. Unknown profile names fall back to `generic`.

## Where it lives

- `src/systems/daynight.js` — the only tuning home. `SKIES` holds the four
  phase descriptors; `WEATHERS[].mesh` holds each sky's mesh response;
  `skyLightAt(elapsed, data, {calm})` resolves phase, blends out of the
  previous phase over `daynight.lightBlend` (fraction of a day, default
  0.04), samples the arc, merges the weather and returns a flat object for
  `shade()`; `weatherLightAt(weatherId, data)` resolves and clamps the
  weather half alone. `calm` (prefers-reduced-motion) pins the arc at its
  midpoint and steps per phase instead of blending.
- `src/scene3d.js` — `shade(hex, normal, light, emissive, depth01, ao)`
  (exported, pure). `MeshScene` stores raw albedo, normal, emissive flag and
  face AO; `paint()` shades once per face per light bucket (`f.paintedKey`),
  scanning the depth range only when a fog veil is active. Windows,
  forge/smeltery flames, watchfires and armed fire traps are emissive.
  `drawVillage3D` accepts the frame's resolved sky so the renderer resolves it
  once.
- `src/renderer.js` — resolves the sky once per frame and feeds shadows, the vignette, overlay, glows and mesh shading.
- `src/source-lighting.js` — source profile table, cached local-surface attenuation, deterministic flicker and projected ground spill. Windows/torches may clip the radial gradient into directional footprints; lanterns/open fires stay radial. Calm freezes profile motion.

## Data (all optional, additive)

Everything lives under `world.daynight` in `data/world.json`:

```json
{"daynight": {
  "lightBlend": 0.04,
  "lighting": {"night": {
    "key": {"intensity": 0.2, "color": "#b9c9ff", "dir": [0.4, -0.3, 0.9]},
    "ambient": {"intensity": 0.45},
    "sky": 0.08,
    "emissive": 0.9,
    "vignette": 0.55
  }},
  "weather": {"fog": {"mesh": {"fog": 0.6, "dim": 0.85, "fogColor": "#aab5c2"}}}
}}
```

Fields not supplied keep their defaults; out-of-range values are clamped
(vignette ≤ 0.7, fog ≤ 0.85, dim 0.5–1.1, intensities ≤ 1.5, …) and bad
colors/dirs fall back. Worlds without a `daynight` block read the defaults —
at noon that is the pre-Phase-2 look.

## Sky values shipped

| phase | arc (from → to)              | key color × I    | ambient × I      | sky  | emissive | vignette |
|-------|------------------------------|------------------|------------------|------|----------|----------|
| dawn  | -0.55,-0.75,0.30 → -0.25,-0.60,0.85 | `#f5c078` × 0.25 | `#b3bfd4` × 0.62 | 0.10 | 0.30     | 0.40     |
| day   | -0.90,-0.40,0.95 → 0.10,-0.60,1.05  | `#ffffff` × 0.26 | `#ffffff` × 0.72 | 0.12 | 0        | 0.34     |
| dusk  | -0.60,-0.35,0.75 → 0.35,-0.55,0.50  | `#e08a4e` × 0.25 | `#c2a088` × 0.60 | 0.10 | 0.28     | 0.46     |
| night | 0.75,-0.45,0.55 → -0.60,-0.30,0.75  | `#8fb0f0` × 0.17 | `#42578a` × 0.42 | 0.07 | 0.75     | 0.55     |

| weather | fog  | dim  | veil      |
|---------|------|------|-----------|
| clear   | 0    | 1    | —         |
| rain    | 0    | 0.92 | —         |
| fog     | 0.5  | 0.9  | `#8fa3bd` |

Balanced-visuals rule: night keeps silhouettes readable (ambient ≥ 0.4) and
lamps/windows carry the warmth; the screen-space overlay still does the deep
darkening.

## Performance

- Lighting resolves once per frame in the renderer and is passed to
  `drawVillage3D`; `shade()` runs per face only when the light bucket changes
  (192 buckets/day ≈ 1.6 s at the default day; the bucket id folds in the
  weather, so a sky change repaints and a clock tick reuses).
- Face AO and emissive flags are construction-time constants — they never
  touch the cache key. Contact shadows cost one polygon per building and one
  ellipse per unit per frame. The fog depth scan is one extra pass over the
  face list only while a veil is active.
- Source positions/profiles and local face wash are cached with static geometry. Only the small ground-spill loop reads frame time for flicker; it does not rebuild or repaint mesh geometry, and Calm removes its time variation.
- No per-frame allocations in the face loop (the shadow loop allocates one
  projected-point array per building; 20–40 bodies in play). The clock still
  never rebuilds the mesh cache (pinned since Phase 1).
- Budget signal: `?perf` badge / `frameReport()` face counts + `npm run
  capture` writes seven views: dawn/day/dusk/night, day-rain, night-fog and
  phone night.

## Test map

- `tests/lighting.test.js` — resolver purity, bucketing (weather included),
  sun/moon sweeps and calm stepping, crossfade, weather merge/clamps,
  vignette ladder/clamps, the shade() fog/dim contract.
- `tests/lighting-baseline.test.js` — raw geometry digests, frozen-light
  formula equality at flat AO, day/night/dawn painted digests, ground-vs-roof
  AO, static-cache invariant.
- `tests/source-lighting.test.js` — emitter gating/placement, cache invariants, profile assignment, deterministic bounded flicker, Calm behavior, fallback and profile falloff.
- `tests/daynight.test.js` — unchanged: overlay pins (`lightingFor` keeps its
  contract; `skyLightAt().overlay` re-exports it).

## Cinematic Canvas layer

The renderer calls `drawCelestialShadows`, `drawGroundMist`, `drawSourceSpill`, opaque mesh painting, visible-source bloom, chimney wisps and peripheral air, then the existing building activity/readout pass. No CSS/HUD post-processing or simulation changes. Ground shadows reuse cached caster envelopes and reproject at the sky paint bucket; their conservative silhouettes are ground-only. Nearby practical wash is static-cache work, indexed by source radius in tile cells, with footprint blockers and a 0.24 additional-light ceiling. Existing albedo/geometry and frozen shading contracts remain pinned.

Bloom tests visibility against the opaque painter stack, uses 3–18px halos and is capped at 32 sources. Smoke uses real chimney coordinates and foreground bounds to suppress occluded wisps, with an eight-plume budget. Calm retains static atmosphere and bloom while suppressing embers; far zoom removes bloom/smoke details. This is approximate GI/volume/depth presentation in Canvas, not a replacement WebGL engine or an optical blur pass.
