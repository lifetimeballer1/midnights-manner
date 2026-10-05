# Asset Rollout Readiness

Checkpoint: 2026-10-05. The tested **partial rollout** is approved for local commit/merge. No push or deployment was performed.

## Release Scope

- Building inventory: 62 families, 334 converted tiers; 59 families / 324 tiers enabled.
- Native gate, trap, and fire-trap rendering remains active for 10 tiers. Source files are reviewed candidates, not approved defensive-state replacements.
- Enabled additional meshes: one complete pine, two complete tree-cluster forms, one stone pile, and the staged sawmill lumber pile.
- Four complete larger clusters remain disabled at 339, 515, 565, and 791 polygons. Intact geometry is retained rather than fragmented to meet the 320-face nature limit.
- Farmer source experiment is removed from runtime; the previously verified labor body remains active.
- Character/equipment/terrain/remaining flora/resource-stage/prop/camp/landmark/animation integration remains queued or partial in the coverage ledger. This is not full expanded-catalog completion.

## Rights

The user confirmed ownership of the entire catalog and authorized public-repository redistribution on 2026-10-05. The source fingerprint and permission statement are retained in `data/external_assets.json` under `catalogSources.game-assets-mixar`. This is **user-attested ownership/permission**, not an independent CC0 finding. Registry entries and generated prop metadata reference that evidence. The normal build rejects unverified or missing/mismatched permission records; `build:preview` is the explicit local-only override.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | 1,351 passed, 0 failed |
| Python converter discovery | 19 passed |
| `npm run build` | Passed; `0.3.0-f0153a15f886a7cc`, 829 precached files |
| Real Edge browser smoke | Started; music, placement, collection, frame/living-detail checks observed, run exceeded harness timeout before final status; prior full pass had no runtime errors |
| Browser look capture | Seven desktop/phone sky/weather views; no page errors |
| Every-tier QA | 334 bodies in day/front and night/reverse contact sheets; 2,672 angle/device geometry checks |
| Additional mesh QA | All nine complete source meshes inspected, including four disabled candidates |
| Diff whitespace check | Passed |

Review images and measured geometry reports are generated under `artifacts/catalog-review/`; browser captures are under `artifacts/look-*.png`. These review artifacts are ignored by Git.

## Resolved Defects

- Flat/catalog admission rejects empty, malformed, nonfinite, and degenerate faces before partial drawing; null source-light entries reject safely.
- Successful asynchronous loads invalidate stale procedural and trail-light caches.
- Active/queued loads deduplicate; fetch/parse concurrency is capped at three on desktop and two on phones. Distinct scene demand is capped at the 32/16-entry parsed cache capacity to avoid visible LRU churn.
- Error reporters cannot strand pending promises or consume loader slots permanently.
- Build IDs hash all deployed content, including catalog files excluded from install precache.
- Unmapped native machinery is no longer duplicated at incorrect imported-body anchors. Native defense state/orientation is preserved rather than replaced with static catalog geometry.
- Nature/prop geometry preserves whole silhouettes. Vegetated building sites keep complete low geometry where global material reduction damaged crowns or barrel walls; over-budget scenes retain whole procedural fallbacks.
- Staged lumber geometry shares the existing 800/1,400-face prop budget and falls back on invalid/missing/disabled assets. Offscreen piles no longer consume the visible budget.
- Release approval requires strict public-redistribution permission plus per-derivative export lineage; unregistered catalog files are rejected. Precache-policy changes now change the build/cache ID.
- Converter texture provenance hashes the sampled image and rejects multi-image singular provenance. Capture assertions require actual drawn catalog faces, with explicit expected-fallback labels.

## Remaining Limits

- Headless Edge and mock Canvas checks are desktop software-rendered evidence, not physical iPhone/Safari testing or a 60fps certification. Dense benchmark scenes remain substantially slower than 60fps in this environment.
- Source-specific animated mechanisms, doors, and chimney anchors still require mapping. Existing simulation and screen-space work cues remain; new source animation is not claimed.
- Some adjacent source tiers have subtle changes rather than entirely new silhouettes. Further bespoke tier differentiation belongs to the remaining art workstream, not this partial rollout claim.
- Contact-sheet and sampled grounding checks do not certify every internal source joint as supported, watertight, or collision-free.
- The working tree contains pre-existing unrelated changes. Stage only the intended integration files after reviewing the final diff; do not include source GLBs, Blender authoring files, private paths, or generated review artifacts.
