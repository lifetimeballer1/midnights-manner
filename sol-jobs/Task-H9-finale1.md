# SOL TASK H9 — Story Finale 1: chapter 30 (first of four)

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `data/missions.json` (ONE new story mission, spec below)
- `tests/task-h9-finale1.test.js` (new, H8 style)
- README: append `### Grey Dawn H9`
- `src/` unchanged expected (data-only story mission; small fixes only if a test proves a gap)

## Chapter plan (Muse-locked — finale consumes 30–33 + final boss)
H9 → ch30, H10 → ch31, H11 → ch32, H12 → ch33 assault + final boss leader entry.
Chapters are display labels; mission `requires` chains do the real gating.
After this task: 31 missions, max chapter 30.

## Precedent (mirror it)
- Story missions ride the `dawn` (ch14) shape: `id, name, chapter, act, beat, giver, description, timeLimit, troopLimit, objectives, startingResources, map{biome,seed,tiles,buildings,troops}, raids, scaling, rewards, unlocks, ceremony{warning,victory,defeat}, requires, destination?`.
- Conquest prelims ride 2-wave `defeat + gold/resource` objectives, `troopLimit 8`, `timeLimit 240` (see `ember-vanguard` ch27).
- H5–H8 tests pin: `requires` chain gating via `missionLockReason`, max-chapter pin, mission-count pin, git-show fingerprints proving earlier entries unchanged, byte-identical earlier-tribe outcomes.
- NO conquest flags on this mission: no `conquest`, no `tribe`, no `launchCost`, no boss raid, no annex, no ledger writes. Story only.

## Mission spec (Muse-locked)
- **id** `grey-dawn-gathers`, **name** "The Grey Dawn Gathers", **chapter** `"30"`, **act** `"X"`.
- **Fiction:** the five territories fallen, their banners muster at the Manner against the true Grey Dawn. First muster-mission of the finale.
- **giver:** `Sorrel the watcher`.
- **requires:** `["ember-throne"]` (the finale starts where the Ember Throne ends).
- **beat/description:** two waves of grey-dawn scouts testing the mustered banners on the home fields before the true assault. (Write concise ceremony copy in the `dawn`/conquest voice: warning, victory, defeat.)
- **Objectives:** `[{kind: defeat, amount: 12}, {resource: gold, amount: 200}]` (prelim shape).
- **Limits:** `timeLimit 240`, `troopLimit 8`.
- **startingResources:** `{wood: 300, food: 200, gold: 140}` (prelim baseline).
- **Map:** `biome: 'plains'` (home ground — deliberate contrast to conquest hills/water/forest), `seed: 3011`, one claimed tile with landmark `"Muster Fields"`, buildings mirror the prelim yard (`hall, tower, 2x stonewall, barracks`), troops `[warrior, pikewoman, archer, builder, miner]`.
- **Raids:** 2 waves (`{at: 40, count: 5}`, `{at: 140, count: 7}`), NO boss entry (boss is H12's).
- **Scaling:** `{hp: 30, damage: 5.5}` — one step past Ember prelims, below throne assault scale.
- **Rewards:** `{gold: 4000, lumber: 2200, plate: 550, frostwood: 350}` — between ember-redoubt and ember-throne (6500/3500/1000/650). Prelim-scale basket, no `unlocks` (or empty array).
- **No** `launchCost`, `log`, `conquest`, `tribe`, `destination` unless an existing story-mission test requires the field — check `tests/act7.test.js` and `tests/content.test.js` shape pins first.

## Tests (H8 style, new file `tests/task-h9-finale1.test.js`)
- Chain: ch30 `requires ["ember-throne"]`; locked without it, open with it (`missionLockReason`); max chapter is 30; mission count is 31.
- Data shape: plains biome throughout (map + every tile), no conquest/tribe/launchCost/boss keys, scaling + rewards exactly as spec'd, rewards above ember-redoubt and below ember-throne.
- Fingerprints: sha256 pins (git-show style, as H8 did) proving all 30 earlier missions + conquest data unchanged. Compute from current HEAD data.
- Playthrough: `Game.mission('grey-dawn-gathers')` → win → `finishMission` first-clear pays rewards once; replay pays nothing new; loss writes no ledger/progress.
- Earlier outcomes byte-identical: run the H8 legacy-comparison approach (or reuse its helpers) so all five tribes' scout/clear/annex/supply behavior is unchanged.

## Rules
- No new mechanics, currencies, aura keys, tribes, leaders, annex options, or save version bumps. Additive data only.
- Earlier missions, tribes, leaders, and conquest behavior unchanged (fingerprint + legacy-comparison proofs).
- After edits run `npm test` and `npm run build` (on Windows use `npm.cmd` — `npm.ps1` is blocked). Report pass/fail plus files changed. Do not start H10.
