# SOL TASK H10 — Story Finale 2: chapter 31 (second of four)

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `data/missions.json` (ONE new story mission, spec below)
- `tests/task-h10-finale2.test.js` (new, H9 style)
- README: append `### Grey Dawn H10`
- `src/` unchanged expected (data-only story mission; small fixes only if a test proves a gap)

## Chapter plan (Muse-locked — finale consumes 30–33 + final boss)
H9 → ch30 (DONE: `grey-dawn-gathers`), H10 → ch31, H11 → ch32,
H12 → ch33 assault + final boss leader entry.
Chapters are display labels; mission `requires` chains do the real gating.
After this task: 32 missions, max chapter 31.

## Precedent (mirror it)
- H9 (`grey-dawn-gathers`, ch30, in `data/missions.json` NOW): story prelim shape —
  2-wave `defeat + gold` objectives, `troopLimit 8`, `timeLimit 240`, plains `seed 3011`,
  no `launchCost/log/conquest/tribe/destination/boss`, `unlocks: []`, scaling `{30, 5.5}`,
  rewards `{gold:4000, lumber:2200, plate:550, frostwood:350}`.
- `ironshield-watch` (ch16): the watch shape — `defeat 18 + survive 240`, `troopLimit 9`,
  `timeLimit 300`, 3 raids, yard with `archer_tower` + 3 walls, troops
  `[warrior, pikewoman, halberdier, archer, builder, miner]`.
- H9 tests pin: `requires` chain via `missionLockReason`, max-chapter pin,
  mission-count pin, git-show fingerprints proving earlier entries unchanged,
  byte-identical earlier-tribe outcomes, replay/loss writes nothing.

## Mission spec (Muse-locked)
- **id** `grey-dawn-muster`, **name** "Muster of the Five Banners", **chapter** `"31"`, **act** `"X"`.
- **Fiction:** the five fallen territories' banners drill together on the Banner Field
  while grey-dawn outriders probe the lines. Second muster-mission of the finale.
- **giver:** `Sorrel the watcher`.
- **requires:** `["grey-dawn-gathers"]` (the finale chains 30 → 31 → 32 → 33).
- **beat/description:** three probing waves against the mustered banners; hold the field
  and keep the oathstone standing. (Concise ceremony copy in the H9 voice: warning,
  victory, defeat — victory must name the banners holding.)
- **Objectives:** `[{kind: defeat, amount: 18}, {kind: survive, seconds: 240}]` (watch shape).
- **Limits:** `timeLimit 300`, `troopLimit 9`.
- **startingResources:** `{wood: 340, food: 220, gold: 160}` (watch baseline).
- **Map:** `biome: 'plains'`, `seed: 3111`, one claimed tile landmark `"Banner Field"`,
  buildings mirror the `ironshield-watch` yard, troops
  `[warrior, pikewoman, halberdier, archer, builder, miner]`.
- **Raids:** 3 waves (`{at: 40, count: 6}`, `{at: 150, count: 8}`, `{at: 240, count: 9}`),
  NO boss entry (boss is H12's).
- **Scaling:** `{hp: 32, damage: 6}` — one step past H9, below assault scale.
- **Rewards:** `{gold: 5000, lumber: 2700, plate: 700, frostwood: 450}` (Redoubt level —
  above H9, below the ch33 assault to come). Prelim-scale basket, `unlocks: []`.
- **No** `launchCost`, `log`, `conquest`, `tribe`, `destination` unless an existing
  story-mission test requires the field — check `tests/act7.test.js` and
  `tests/content.test.js` shape pins first.

## Tests (H9 style, new file `tests/task-h10-finale2.test.js`, ~7 checks)
- Chain: ch31 `requires ["grey-dawn-gathers"]`; locked without it (also with only
  `ember-throne`), open with it (`missionLockReason`); max chapter is 31; mission count is 32.
- Data shape: plains biome throughout, no conquest/tribe/launchCost/boss keys, scaling +
  rewards exactly as spec'd, rewards above H9 and below `ember-throne` per key.
- Fingerprints: sha256 pins proving all 31 earlier missions + conquest data unchanged
  (compute from current HEAD data).
- Playthrough: win → first-clear pays rewards once; replay pays nothing new; loss
  (timeout AND fallen hall) writes no progress/rewards/ledger.
- Earlier outcomes byte-identical: all five tribes' scout/clear/annex/supply behavior
  unchanged (H9 legacy-comparison approach).
- Update ONLY pins that count missions/chapters (adventure, act7, H5–H9 fingerprint
  filters, raids story expectation) — same narrow set H9 touched.

## Rules
- No new mechanics, currencies, aura keys, tribes, leaders, annex options, or save
  version bumps. Additive data only.
- Earlier missions, tribes, leaders, and conquest behavior unchanged
  (fingerprint + legacy-comparison proofs).
- After edits run `npm test` and `npm run build` (on Windows use `npm.cmd` —
  `npm.ps1` is blocked). Report pass/fail plus files changed. Do not start H11.
