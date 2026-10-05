# Actual Mixar Building Catalog

The conversion inventory contains actual architecture for **62 building IDs and 334 tiers**. The safe rollout enables **59 families / 324 tiers**; gate/trap/fire-trap retain native orientation and defensive state. Other source groups are queued or partial in [ART_COVERAGE.md](ART_COVERAGE.md).

## Source And Conversion

The verified exports are `mmr-building-catalog-part-1` (253 meshes) and `mmr-building-catalog-part-2` (81 meshes) in Mixar Exports. Both contain named architecture meshes and the embedded palette. Display pads are excluded; source catalog geometry is unchanged. The earlier `mmr-real-building-pilot` package remains a separate review export.

Each runtime JSON records the exact source object, full GLB SHA-256, original bounds, uniform fitting scale, nondegenerate source triangle count, and output count. The converter preserves source colors instead of substituting the old palette. Its verified image encoding is linear/Non-Color; output albedo is sRGB hex, emission a linear scalar. Geometry is right-handed Z-up, centered in XY, grounded at zero and uniformly fitted in XYZ inside the unchanged footprint.

Closed solids receive consistent outward winding. Open sheets retain two-sided material flags. Coplanar same-material triangles merge only into convex polygons. Near geometry retains all nondegenerate source surfaces. Most low geometry uses material-separated edge collapse; farm/grove/frostgrove/whisper-grove/manor-gardens retain complete geometry at both LODs because reduction erased crowns and barrel walls. A whole procedural body replaces an over-budget model. Complete buildings never use first-N-face slicing. Painter subdivisions and a small sheet ordering offset prevent ceiling bleed-through.

```sh
python scripts/convert-mixar-buildings.py <verified-export.glb> assets/meshes
# Optional: convert only listed ids from a larger verified GLB.
python scripts/convert-mixar-buildings.py <verified-export.glb> assets/meshes mmr-chapel-5 mmr-cottage-6
node scripts/register-mixar-building-catalog.mjs
node scripts/test-mixar-converter.mjs
node --test tests/art-coverage.test.js tests/mixar-buildings.test.js
```

Offline conversion/tests need `numpy`, `Pillow`, and `fast-simplification`, already used by the development art toolchain. They are not runtime dependencies or prerequisites for the normal Node game suite. Only flat JSON geometry ships; GLB, Blender source and texture stay outside the game payload.

## Runtime Contract

The manifest has a separate `buildings` registry. The loader deduplicates active and queued requests, permits at most three concurrent fetch/parse jobs (two on phones), and retains 32 parsed tiers (16 on phones). Distinct scene demand is bounded to that capacity to prevent visible-cache churn. Successful loads invalidate procedural and trail-light caches without camera movement. Catalog files stay out of service-worker install precache, but all deployed content contributes to the build hash. Validation rejects malformed, empty, degenerate, incompatible, or out-of-bounds geometry and invalid source-light records before drawing.

Ready buildings use the entire selected body. Disabled, missing, invalid, ruined, and unfinished buildings use native procedural rendering. Picking retains building IDs. Production overlays/gameplay are unchanged. Imported ownership travels with the cache; unmapped native machinery is suppressed on imported bodies rather than duplicated at incorrect anchors. Existing screen-space job cues remain; new source-specific moving machinery/door/chimney mappings are deferred.

Complete-body submitted-polygon budgets are 3,000 below 600 CSS pixels and 6,000 on larger viewports, separate from unchanged 800/1,400 embellishment limits. Near detail starts at zoom 2.4 on smaller viewports or 1.9 on larger ones. If a whole low mesh cannot fit, a complete procedural building remains. Submitted polygons differ from painted/subdivided faces and GPU triangles. Offscreen bodies do not consume visible budget.

Light anchors come from emitting geometry, are sorted deterministically and capped at 12 per building. Existing light profiles/night shading remain. No gameplay data, collision, footprint, tier count, simulation timer, save field or version changes.

## Review And Limits

The browser fixture isolates up to three actual tier meshes without villagers; it is not a player save or fully integrated maxed town. `MIXAR_CAPTURE=1 npm run capture` checks the fetched mesh IDs, picking, and browser exceptions. `MIXAR_TYPES=farm,mill,sawmill MIXAR_LABEL=works MIXAR_CAPTURE=1 npm run capture` selects other source-backed families; `MIXAR_TIER=1..6` chooses the requested tier (clamped to a family's existing tier count). Captures use `artifacts/mixar-<label>-t<tier>-*.png`.

All 334 converted bodies have day/front and night/reverse contact-sheet review, plus 2,672 angle/device geometry checks. The building JSON totals 57,165,477 bytes, 249,575 near faces, and 134,225 low-LOD faces before painter subdivisions. Dense scenes may use procedural fallback. Source permission is based on the user's ownership/redistribution attestation retained in the external-assets registry. This is not a Pages deployment or a mobile 60fps certification.

Tier-6 source grounding was sampled against catalog support pads for the original Hall, Cottage, and Forge pilot: zero measured penetration, all three checks passed. This does not verify every internal joint in the expanded catalog. `tests/art-coverage.test.js` validates all 334 files, metadata, bounds, and LODs; `tests/mixar-buildings.test.js` exercises orbit, picking ownership, immutable state, budgets, fallback, roof visibility/order, mechanism behavior, and static-cache reuse on representative models.

Verification commands: `npm test`, `python -B -m unittest discover -s scripts/tests -v`, `npm run build`, `npm run test:browser`, and `npm run capture`. `scripts/review-mixar-catalog.mjs` uses the optional `CANVAS_MODULE` development dependency to generate every-tier review sheets and gameplay checks. `scripts/rebuild-mixar-site-lods.py` accepts the two hash-matching source GLBs to reproduce complete vegetated-site LODs. Captures are software-rendered desktop evidence, not physical-phone FPS. Preview with `node scripts/serve-mixar-pilot.mjs` on its isolated localhost origin; existing saves there are never overwritten.
