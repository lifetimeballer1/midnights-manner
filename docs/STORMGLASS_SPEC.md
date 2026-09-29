# Stormglass Folklore — visual design spec

Detail/re-theme pass over the existing game. Map expansion and post-Dawn
story are separate later programs. Dawn stays the original ending; the home
atlas stays persistent; campaign battle maps stay isolated.

## 1. Mood and non-goals

Mysterious frontier, not horror. Cool moonlight over the land, warm local
lights at windows, forges, torches and watchfires. Readability beats drama;
every choice stays legible at 1.65× gameplay zoom on a phone.

Non-goals: new troops/buildings/resources, map-size changes, economy or raid
rebalance, factions/events/quests/tech content, cast shadows between
structures, terrain tinting beyond the current biome wash.

## 2. Palette tokens (`src/kingdom.css:2`, `index.html` theme-color)

| token | value | use |
|---|---|---|
| `--night` | `#1a2c4e` | HUD chrome, night overlay tint, guide pill |
| `--brass` | `#f4cc73` | trim, active states, quest-chip edge |
| `--parchment` | `#eee4c9` | drawer cards |
| `--lamp` | `#ffb95b` | guide-pill edge, warm accents |
| `--moon` | `#f8d58b` | crest, headings (kept) |

Night overlay tint equals `--night` so chrome and sky agree.

## 3. Resource icons (8-for-8, `src/resources.js`)

wood `resource-wood.svg`, lumber `resource-lumber.svg` (sawn planks),
food `resource-food.svg`, flour `resource-flour.svg` (tied sack),
bread `resource-bread.svg` (loaves), gold `resource-gold.svg`,
frostwood `resource-frostwood.svg`, plate `resource-plate.svg`.
64px original inline SVG, `#344536` 1.4 stroke. Shape-first, color-second;
no palette-swap reuse. Contract: `RESOURCES.sprite` map only.

## 4. UI states

Bottom dock + drawers (Build/People/Adventure/Stores/Friends), search/filter,
safe-area, focus containment, live drawers during raids — all kept.
First-run hint: existing `src/systems/tutorial.js` (separate localStorage
key, saves untouched) renders into `#guide` — a Stormglass pill under the
quest chip on desktop, below the sky toast on phones; retires for veterans;
joins bubble-avoidance obstacles. Bubbles keep `+N Label` text and ≥40px
touch targets via `layoutCollectionBubbles`.

## 5. Motion budget (`src/renderer.js`)

Transient pool capped at 60 effects. Shake only in full-motion play;
calm/`prefers-reduced-motion` gets identical visuals with zero shake, snapped
gates/traps, pinned arcs and flicker multiplier exactly 1. Mid-frame shake
survives to the next frame (residue-only clear). Pennant at `reserveReady`,
tapered window spill, fire pools, torch flicker, vignette + moon glow kept.
Input: tap threshold 10px, delta-proportional wheel zoom anchored at the
pointer. Double-tap zoom deferred (fights tap-select).

## 6. Lighting (`src/systems/daynight.js`, `docs/LIGHTING.md`)

Day is byte-identical to the legacy formula (pinned). Stormglass retune:

| phase | key × I | ambient × I | emissive | vignette |
|---|---|---|---|---|
| dawn | `#f5c078` × 0.25 | `#b3bfd4` × 0.62 | 0.30 | 0.40 |
| day | `#ffffff` × 0.26 | `#ffffff` × 0.72 | 0 | 0.34 |
| dusk | `#e08a4e` × 0.25 | `#c2a088` × 0.60 | 0.28 | 0.46 |
| night | `#8fb0f0` × 0.17 | `#42578a` × 0.42 | 0.75 | 0.55 |

Fog veil cooler (`#8fa3bd`); dusk overlay deeper (`#b65448`, glow 0.7);
night overlay alpha 0.22. Arcs, clamps, calm stepping and data overrides
(`world.daynight.lighting/weather`) unchanged. Source profiles unchanged.

## 7. Review matrix

| row | check | gate |
|---|---|---|
| saves | old blobs load, additive fields only | save-blob/migration tests green |
| mobile | bubbles separated, hint clear of rail/dock, labels at 1.65× | `layoutCollectionBubbles` tests + phone capture |
| perf | pool ≤60, static cache quantized, no per-frame alloc growth | `frameReport()` + `lighting-baseline` cache test |
| art | 8 distinct icons, silhouette readability front/reverse | preview sheets to `artifacts/` (gitignored) |
| light | geometry/formula/day pins hold; night/dawn move deliberately | `lighting-baseline` + `lighting` tests |
| motion | shake only full-motion; pool capped | `stormglass-phaseC` tests |
| input | 9px taps select, 12px drags pan; smooth wheel | `stormglass-phaseD` tests |

Verify per phase: `npm test` → `npm run build` →
`CHROME_BIN=… npm run test:browser` → `npm run capture` (dawn/day/dusk/
night, day-rain, night-fog, phone-night) + mesh sheets, reviewed honestly.
Commit `Stormglass Phase X: …` → push `main` (deploys Pages). Never
force-push, never commit `artifacts/`/`dist/`.

## 8. Phase log

A icons (8-for-8) → B tokens + hint → C motion pool + calm parity →
D input feel → E lighting rework + this spec. All merged to `main`.
