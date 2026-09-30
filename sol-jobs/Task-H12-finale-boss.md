# SOL TASK H12 — Story Finale 4: chapter 33 assault + final boss (FINALE)

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `data/missions.json` (ONE assault-shape story mission, spec below)
- `data/conquest.json` (ONE new leader entry in `leaders[]` — 6th entry, additive)
- `src/` ONLY as needed for launchCost-on-story-mission (see payment note — read first)
- `tests/task-h12-finale-boss.test.js` (new, H-style)
- README: append `### Grey Dawn H12`
- After this task: 34 missions, max chapter 33, 6 leaders. THE FINALE IS DONE.

## Chapter plan (Muse-locked)
H9 → ch30, H10 → ch31, H11 → ch32 (all DONE), H12 → ch33 assault + final boss.
`requires: ["grey-dawn-road"]`. Chapters are display labels; `requires` gates.

## Precedent (mirror it)
- Assault shape (`ironshield-keep` ch17 / `ember-throne` ch29): 4 waves, objectives
  `defeat 30 + protect oathstone 1 + survive`, `troopLimit 10`, `timeLimit 420`,
  `launchCost` paid ONLY on successful departure (refusals: short stores, live raid,
  broken chain, dead hall — nothing charged), final raid names the boss + herald,
  biggest rewards to date.
- Boss shape (`conquest.json leaders[]`, H5–H8): `id/name/title/hpBase/hpPerWave/
  dmgBase/dmgPerWave/speed/range/wallDamage/mechanics{slam,summon,enrage}`,
  `bossSpec` lookup, wave 1–100 home-crown rotation exclusion (H8 check pattern).
- H9–H11 tests: chain via `missionLockReason`, count/max pins, sha256 fingerprints
  of earlier content, byte-identical earlier-tribe outcomes, replay/loss clean.

## Mission + boss spec (Muse-locked)
- **Mission** `grey-dawn-crown`, **name** "The Grey Dawn Crown", **chapter** `"33"`,
  **act** `"X"`, giver `Sorrel the watcher`, `requires: ["grey-dawn-road"]`.
- **Fiction:** the true Grey Dawn breaks on the Muster Fields at first light; the
  five banners hold one ridge while their Sovereign takes the field. Campaign finale.
- **Objectives:** `[{kind: defeat, amount: 30}, {kind: protect, type: oathstone, count: 1},
  {kind: survive, seconds: 360}]`. **Limits:** `timeLimit 420`, `troopLimit 10`.
- **startingResources:** `{wood: 380, food: 240, gold: 180}` (assault baseline).
- **launchCost:** `{food: 10000, bread: 2000, lumber: 6500, plate: 1000, gold: 6000}`
  — above `ember-throne` (8000/1600/5000/750/4500) on every key.
- **Map:** `biome: 'plains'`, `seed: 3311`, claimed tile landmark `"Crown Ridge"`,
  buildings mirror the keep yard (`hall, tower, archer_tower, ballista, 4x stonewall,
  oathstone, barracks`), troops `[oathsworn, halberdier, pikewoman, longbowman,
  archer, builder, miner]`.
- **Raids:** 4 waves (`{at: 60, count: 7}`, `{at: 150, count: 9}`, `{at: 230, count: 10}`,
  `{at: 300, count: 12, boss: "grey-sovereign", herald: "…SOVEREIGN…"}` — herald copy
  in the assault voice, must name the Sovereign in full caps).
- **Scaling:** `{hp: 36, damage: 7}` — above throne (28/5) and H11 (34/6.5).
- **Rewards:** `{gold: 8000, lumber: 4500, plate: 1200, frostwood: 800}` — biggest
  first-clear basket in the campaign.
- **No** `conquest`, `tribe`, `log`, `destination` — story finale, no ledger, no annex.
  **Unlocks:** `tests/raids.test.js` requires story missions to grant a resolving
  unlock OR carry the H9–H11 resource-only exemption — read that test first; if you
  extend the exemption to H12, say so in README. Prefer a real existing unlock if
  one fits the finale without new mechanics (check `data/world.json locked`).
- **Boss** (6th `leaders[]` entry): id `grey-sovereign`, name "The Grey Sovereign",
  title "Crown of the Grey Dawn", `hpBase 2700`, `hpPerWave 140`, `dmgBase 92`,
  `dmgPerWave 5.5`, `speed 0.6`, `range 1.4`, `wallDamage 4`,
  mechanics `slam {damage 72, radius 1.7, everySec 7}` + `summon {role breaker,
  count 2, everySec 20, cap 6}` + `enrage {hpFrac 0.3, dmgMult 1.5}`.
  Must NOT join the home crown rotation (wave 1–100 check, H8 pattern).

## Payment note — READ FIRST, then decide
H9 proved story departure charges no war chest. H12 NEEDS its `launchCost` charged
only on successful departure, exactly like assaults. FIRST read `src/game.js`
`mission()` + `assaultReason` (H8 cited ~449-454) and the `ember-throne` refusal
tests: if `launchCost` already flows through a generic departure path, just use it.
If it is tribe-assault-bound, add the MINIMAL generic support (any mission with
`launchCost` pays on departure under the same refusal rules; nothing else changes)
plus tests proving H9–H11 (no `launchCost`) still depart free. No ledger writes for
story missions either way — assert `world.conquest` stays undefined.

## Tests (`tests/task-h12-finale-boss.test.js`, ~8 checks)
- Chain: ch33 requires `grey-dawn-road`; locked before, open after; count 34; max 33.
- Data shape: plains, assault objectives/limits/map/seed/landmark, scaling + rewards
  exactly as spec'd, rewards above throne per key, no conquest/tribe/log/destination.
- Fingerprints: all 33 earlier missions + 5 earlier leaders + conquest tribes unchanged.
- Departure payment: launchCost deducted on success; six refusal cases (short each of
  ... pick short-bread + the H8 refusal set adapted: raid-live, chain-broken,
  hall-dead, plus short-plate) charge nothing and leave `mission/home` null.
- Boss: spawns at wave 4 with herald naming SOVEREIGN; `bossSpec` numbers;
  slam+summon+enrage fire; breaker summons appear; no home rotation 1–100.
- First-clear pays once (rewards land via storage caps + pending, H9 pattern);
  replay/defeat/timeout/fallen hall: no progress, no rewards, no ledger.
- All five tribes byte-identical (H9 approach). Earlier finale chapters (30–32)
  outcomes unchanged.

## Rules
- No new mechanics, currencies, aura keys, tribes, annex options, or save version
  bumps. One additive leader + one additive mission (+ minimal generic launchCost
  support ONLY if the read proves it necessary).
- After edits run `npm test` and `npm run build` (Windows: `npm.cmd`). Report
  pass/fail plus files changed. Do not start Great Works.
