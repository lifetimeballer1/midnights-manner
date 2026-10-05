# Midnights Manner Art Integration Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Deliver customized, game-ready building, character, and environment art from the approved Blender sources through Midnights Manner's existing Canvas asset pipeline.

**Architecture:** First establish a source-to-game coverage ledger and reproducible offline conversion contract. Then execute the building, character, and environment plans as disjoint workstreams; finish with combined visual/performance verification and an independent Judge review. Runtime remains vanilla Canvas with procedural fallbacks.

**Tech Stack:** Blender 5.2.2 authoring; Python offline OBJ/GLB conversion and pose baking; vanilla JavaScript Canvas; Node `node:test`; JSON data/manifests; existing browser/capture harnesses.

**Spec:** `docs/superpowers/specs/2026-10-04-midnights-manner-art-integration-design.md`

## Global Constraints

- Work only in the user-designated OneDrive `midnights-manner` checkout; leave the separate sibling checkout untouched.
- Preserve `purple_robe_archer_reskinned_v8_full_asset_catalog.blend`; save authored changes to a new v9 file outside the public repository.
- Keep the existing Canvas renderer; no runtime GLB, texture, or skeletal-animation loader.
- Preserve footprints, gameplay state, collision, saves, role identities, fallback behavior, cache contracts, and Calm/reduced-motion behavior.
- Use vivid medieval color where useful through `data/palette.json`; type/tier identity must remain structural, not recolor-only.
- Verify source license/adaptation rights and keep provenance, hashes, and derivative notes for every shipped external asset.
- 30,000 faces is a whole-scene runaway ceiling, not an allocation target; preserve all existing per-system caps.
- Do not claim 60fps on mobile without a real-device measurement. Do not commit, push, or deploy without explicit user authorization.

## Plan Bundle And Order

This sequence composes four focused plans:

1. `2026-10-04-art-coverage-and-export.md` is the prerequisite for the art workstreams.
2. `2026-10-04-building-art-and-upgrade-motion.md` integrates building modules and the missing upgrade assembly transition.
3. `2026-10-04-character-models-and-motion.md` audits and upgrades the existing role/faction pose groups.
4. `2026-10-04-environment-art.md` stages biome/scenery first and atmosphere/weather second.
5. Run the final integration gate below after the representative workstreams are ready, then repeat the workstream batches until every approved source form is integrated or explicitly rejected for fit/rights/budget.

The building, character, and environment plans may proceed in parallel after the coverage/export contract is accepted, provided file ownership stays disjoint. Blender writes remain serial and are performed by the session owner only. Free agents provide bounded review/drafting; the configured Sol route is used for delegated implementation as the project instructions require. Validate each worker's checkout before accepting repo-specific results. Never use opencode-go.

## Final Integration Gate

**Files:**
- Modify only if required by a focused failing gate: `tests/asset-art.test.js`, `tests/building-art-r5.test.js`, `tests/baked-r5-characters.test.js`, `tests/environment-art-r5.test.js`, `tests/environment-motion-r5.test.js`
- Review: `docs/ART_COVERAGE.md`, `docs/ASSET_CREDITS.md`, `data/art-manifest.json`, `data/external_assets.json`
- Captures: `artifacts/look-*.png` and scoped visual review sheets

- [ ] **Step 1: Verify coverage and provenance.** Confirm every shipped manifest entry resolves to its mesh/pose file, has its verified source/license/hash record, has a game consumer, and falls back when disabled or missing. Confirm unmatched items remain explicitly listed.
- [ ] **Step 2: Run focused regression suites.** Run `node --test tests/asset-art.test.js tests/building-art-r5.test.js tests/baked-r5-characters.test.js tests/environment-art-r5.test.js tests/environment-motion-r5.test.js`. Expected: all assertions pass, including coverage, footprint/anchor, LOD, Calm, fallback, and scene-budget checks.
- [ ] **Step 3: Run the complete project gates.** Run `npm test`, `npm run build`, `npm run capture`, and `npm run test:browser` when the configured browser is available. Expected: all local gates pass; if browser is unavailable, report it as unverified, not passed.
- [ ] **Step 4: Review the same combined fixture.** Inspect the mature village with buildings, characters, and scenery together at yaw 0/90/180/270; day/night/dawn; zoom 1.0/1.65/2.2; desktop and phone-night; raid, Calm, and Low-quality conditions. Compare `frameReport()` and asset payload size against the same pre-change fixture.
- [ ] **Step 5: Request independent Judge feedback.** Provide captures plus coverage, face-count, file-size, and test evidence. Score buildings, villagers, enemies, and environment equally at 25 points each; require at least 90/100 and resolve all blocking findings before widening the batch.
- [ ] **Step 6: Close the coverage loop.** Repeat the building, character, and environment batches until every approved source form is integrated, or is explicitly rejected with a rights, fit, or budget reason and user-visible disposition. A nonempty eligible queue is not full-catalog readiness.
- [ ] **Step 7: Report actual readiness.** Separate integrated assets from queued/rejected source models. State exact tested counts, file sizes, face counts, test output, browser/device limitations, and remaining gaps. No commit/push/deploy is included in this plan.

## Tomorrow Checkpoint

The first checkpoint is a validated coverage ledger and export path plus a reviewed, tested representative batch across buildings, characters, and all five biome identities. The full Blender source list is completed in repeatable batches; overnight completion of every custom form is not a release promise.
