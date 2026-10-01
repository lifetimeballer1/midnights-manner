# RUN_OVERNIGHT — Boss ledger (5h visual + polish)
Branch: feature/act-xi-ashen-crown | Save: v15 | Missions: 41
Boss: Muse Spark. Implementers: Sol (GPT-6.1 via Codex, one task at a time) + Muse agents.
Rule: commit per task. If usage runs out, next session runs: git log -3, git diff --stat, npm.cmd test (summary only), then continue NEXT line.

## Baseline 2026-10-01
- 977 tests, 976 pass, 1 fail: tests/ambient-score.test.js:78 `engine stays Node-safe` expected 'nether' got 'money_right' (tribute churn d4369de/af773a2).
- Dirty: M data/ambient-score.json, data/music.json, src/audio.js, src/main.js, tests/alive-p5, ambient-score, music + ?? update/preview-all-6.html
- Thin visuals: manner-citadel MISSING in masterworkDetails() src/scene3d.js:385-555, grand-watchtower MISSING (only base tower:494-497), stone-road/city-wall/forge-quarter/lantern-rows THIN generic (546-550).

## Queue
- [x] HOTFIX ambient-score fail DONE: attemptRoll no-op unless playing; 977 pass 0 fail, nether stays Node-safe.
 - [x] V1 building detail DONE: src/scene3d.js:385-555 citadel + grand-watchtower branches + richer infra tiers (per-type stone-road/city-wall/forge-quarter/lantern-rows). Guards kept. Verify: architecture/living previews need canvas (unavailable, skipped); building-detail-pass + lighting-baseline (6 new pins) green, 978 pass 0 fail, build green. Commit `V1 citadel/watchtower/infra detail`.
 - [x] V2 work cues + light identity DONE: src/building-activity.js civic state + bounded cues (1 crew index/frame, zoom<1.05 off, calm off, smoke from real stacks only) + src/source-lighting.js CIVIC_CUES identity; production-preview needs canvas (skipped, headless geometry green); building-activity +6 tests, lighting digests held deliberate, 984 pass 0 fail, build green. Commit `V2 citadel/watchtower work cues`.
- [ ] P1 balance + clutter/perf (90m). NEXT: docs/BALANCE_ECONOMY_TARGETS.md pins (T1=base T2=2x T3 8-10x T4 20-24x Project 8x Renown +35% settling 0.01+0.02), CROWDED_READY_THRESHOLD=8 src/resources.js:35, faces<30k effects<=60 voices<=12. Verify: POLISH_CAPTURE=1 GUI_CAPTURE=1 npm run capture + settlement-benchmark.mjs.
- [ ] S1 ship (30m). NEXT: npm.cmd test + npm.cmd run build + browser smoke + CHANGELOG 0.4.1 polish entry. Leave unmerged with evidence.

## Sol briefs (paste ONE at a time to Codex; fallback: same brief here)
### SOL-V1 (paste to Sol)
Add close-zoom detail in src/scene3d.js masterworkDetails() 385-555 for manner-citadel + grand-watchtower + richer stone-road/city-wall/forge-quarter/lantern-rows tiers. Tier-growing props only, existing palette, no sim/save/aura change. Suppress ghosts/unfinished/ruins, zoom<1.2 off, calm freeze. Run node scripts/architecture-preview.mjs, update tests/building-detail-pass.test.js + lighting-baseline digests deliberately, npm.cmd test + npm.cmd run build green, commit.
### SOL-V2 / SOL-P1 in queue — boss releases after V1 green.
