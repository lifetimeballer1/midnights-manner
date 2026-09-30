# SOL TASK H11 — Story Finale 3: chapter 32 (third of four)

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `data/missions.json` (ONE new story mission, spec below)
- `tests/task-h11-finale3.test.js` (new, H9/H10 style)
- README: append `### Grey Dawn H11`
- `src/` unchanged expected (data-only story mission; small fixes only if a test proves a gap)

## Chapter plan (Muse-locked — finale consumes 30–33 + final boss)
H9 → ch30 (DONE: `grey-dawn-gathers`), H10 → ch31 (DONE: `grey-dawn-muster`),
H11 → ch32, H12 → ch33 assault + final boss leader entry.
Chapters are display labels; mission `requires` chains do the real gating.
After this task: 33 missions, max chapter 32.

## Precedent (mirror it)
- H10 (`grey-dawn-muster`, ch31, in `data/missions.json` NOW): watch shape —
  `defeat 18 + survive 240`, `troopLimit 9`, `timeLimit 300`, 3 raids
  (`{40:6},{150:8},{240:9}`), plains `seed 3111`, watch yard + six starting
  professions, no `launchCost/log/conquest/tribe/destination/boss`, `unlocks: []`,
  scaling `{32, 6}`, rewards `{gold:5000, lumber:2700, plate:700, frostwood:450}`.
- H9/H10 tests pin: `requires` chain via `missionLockReason`, max-chapter pin,
  mission-count pin, git-show fingerprints proving earlier entries unchanged,
  byte-identical earlier-tribe outcomes, replay/loss writes nothing.

## Mission spec (Muse-locked)
- **id** `grey-dawn-road`, **name** "The Grey Road", **chapter** `"32"`, **act** `"X"`.
- **Fiction:** the drilled banners march out onto the Grey Road itself and hold it
  against the heaviest probing attack yet. Last muster-mission before the ch33 assault.
- **giver:** `Sorrel the watcher`.
- **requires:** `["grey-dawn-muster"]` (the finale chains 30 → 31 → 32 → 33).
- **beat/description:** three heavy waves on the Grey Road; hold the road, keep the
  oathstone standing, break the probe. (Concise ceremony copy in the H9/H10 voice:
  warning, victory, defeat — victory must name the road holding.)
- **Objectives:** `[{kind: defeat, amount: 24}, {kind: survive, seconds: 300}]`
  (watch shape, one step past H10).
- **Limits:** `timeLimit 360`, `troopLimit 10`.
- **startingResources:** `{wood: 340, food: 220, gold: 160}` (watch baseline, unchanged).
- **Map:** `biome: 'plains'`, `seed: 3211`, one claimed tile landmark `"Grey Road"`,
  buildings mirror the `ironshield-watch` yard, troops
  `[warrior, pikewoman, halberdier, archer, builder, miner]`.
- **Raids:** 3 waves (`{at: 40, count: 7}`, `{at: 150, count: 9}`, `{at: 250, count: 11}`),
  NO boss entry (boss is H12's).
- **Scaling:** `{hp: 34, damage: 6.5}` — one step past H10, below assault scale.
- **Rewards:** `{gold: 5500, lumber: 3000, plate: 800, frostwood: 500}` (Pale Court level —
  above H10, below the ch33 assault to come). Prelim-scale basket, `unlocks: []`.
- **No** `launchCost`, `log`, `conquest`, `tribe`, `destination` unless an existing
  story-mission test requires the field — check `tests/act7.test.js` and
  `tests/content.test.js` shape pins first.

## Tests (H9/H10 style, new file `tests/task-h11-finale3.test.js`, ~7 checks)
- Chain: ch32 `requires ["grey-dawn-muster"]`; locked without it (also with only
  `grey-dawn-gathers`), open with it (`missionLockReason`); max chapter is 32;
  mission count is 33.
- Data shape: plains biome throughout, no conquest/tribe/launchCost/boss keys, scaling +
  rewards exactly as spec'd, rewards above H10 and below `ember-throne` per key,
  victory ceremony names the road holding.
- Fingerprints: sha256 pins proving all 32 earlier missions + conquest data unchanged
  (compute from current HEAD data).
- Playthrough: win → first-clear pays rewards once (all four waves... three waves +
  both objectives gate victory); replay pays nothing new; loss (timeout AND fallen
  hall) writes no progress/rewards/ledger.
- Earlier outcomes byte-identical: all five tribes' scout/clear/annex/supply behavior
  unchanged (H9 legacy-comparison approach).
- Update ONLY pins that count missions/chapters (adventure, act7, H5–H10 fingerprint
  filters, raids story expectation) — same narrow set H10 touched.

## Rules
- No new mechanics, currencies, aura keys, tribes, leaders, annex options, or save
  version bumps. Additive data only.
- Earlier missions, tribes, leaders, and conquest behavior unchanged
  (fingerprint + legacy-comparison proofs).
- After edits run `npm test` and `npm run build` (on Windows use `npm.cmd` —
  `npm.ps1` is blocked). Report pass/fail plus files changed. Do not start H12.
