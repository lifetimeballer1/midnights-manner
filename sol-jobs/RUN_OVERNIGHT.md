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
- [ ] V1 building detail (90m). NEXT: src/scene3d.js:385-555 add citadel + grand-watchtower branches + richer infra tiers. Guards: l<4 return, ghosts/ruins off, zoom<1.2 off, calm freeze. Verify: node scripts/architecture-preview.mjs + living-review.mjs, update building-detail-pass + lighting-baseline digests deliberately.
- [ ] V2 work cues + light identity (90m). NEXT: src/building-activity.js:39 + src/source-lighting.js, state-derived only, outside static cache, zoom<1.05 off. Verify: production-preview.mjs + npm run capture dawn/day/dusk/night+phone.
- [ ] P1 balance + clutter/perf (90m). NEXT: docs/BALANCE_ECONOMY_TARGETS.md pins (T1=base T2=2x T3 8-10x T4 20-24x Project 8x Renown +35% settling 0.01+0.02), CROWDED_READY_THRESHOLD=8 src/resources.js:35, faces<30k effects<=60 voices<=12. Verify: POLISH_CAPTURE=1 GUI_CAPTURE=1 npm run capture + settlement-benchmark.mjs.
- [ ] S1 ship (30m). NEXT: npm.cmd test + npm.cmd run build + browser smoke + CHANGELOG 0.4.1 polish entry. Leave unmerged with evidence.

## Sol briefs (paste ONE at a time to Codex; fallback: same brief here)
### SOL-V1 (paste to Sol)
Add close-zoom detail in src/scene3d.js masterworkDetails() 385-555 for manner-citadel + grand-watchtower + richer stone-road/city-wall/forge-quarter/lantern-rows tiers. Tier-growing props only, existing palette, no sim/save/aura change. Suppress ghosts/unfinished/ruins, zoom<1.2 off, calm freeze. Run node scripts/architecture-preview.mjs, update tests/building-detail-pass.test.js + lighting-baseline digests deliberately, npm.cmd test + npm.cmd run build green, commit.
### SOL-V2 / SOL-P1 in queue — boss releases after V1 green.
