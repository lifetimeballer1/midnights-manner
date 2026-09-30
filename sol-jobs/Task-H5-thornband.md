# SOL TASK H5 — Conquest Tribe 2: Thornband (Whisperwood), chapters 18–20

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `data/conquest.json` (second tribe entry), `data/missions.json` (3 missions), `src/systems/conquest.js` + `src/systems/endgame` boss lookup ONLY as needed to register the leader (follow the ironshield-warden pattern exactly)
- `tests/phase8-conquest.test.js` (extend) or `tests/task-h5-thornband.test.js`
- README: append `### Grey Dawn H5`; note the chapter plan below

## Chapter plan (Muse-locked — tribes consume chapters, story finale moves)
Tribes take 3 chapters each: H5 → 18–20, H6 → 21–23, H7 → 24–26, H8 → 27–29. Story finale (H9–H12) becomes chapters 30–33 + final boss. Chapters are display labels; mission `requires` chains do the real gating.

## Precedent (Ironshield — mirror it)
- `data/conquest.json`: single `tribe` object with `id, name, color, text, require{vlevel, renown, barracksTier, troops}`, `preliminaries[2]{id,name,text}`, `assault`, `intel{leader, army, tactics, weakness, reward}`, plus `leaders[]` boss entry and `annex[]` (outpost/settlement/dismantle with supply baskets + flatAuras + limitBonus).
- Missions: `ironshield-patrol` ch15 requires `dawn` → `ironshield-watch` ch16 → `ironshield-keep` ch17, escalating rewards, keep pays the war-chest march cost and writes the first-clear ledger.
- Phase 8 tests pin: muster law gating, leader lookup without rotation bleed, war-chest payment/refusal, annex with storage overflow, old-save defaults (unscouted, empty ledger).

## Tribe 2 spec (Muse-locked)
- **Thornband**, Whisperwood forest. Raiders and fast scouts fiction. Color `#6a8a5a` (briar green).
- Muster law: `vlevel 10, renown 3, barracksTier 3, troops 10` (one step past Ironshield's 9/2/3/8).
- Prelims: `thornband-snares` ch18 requires `ironshield-keep` ("Cut the Snare Lines"); `thornband-camp` ch19 ("Burn the Briar Camp"). Assault: `thornband-hold` ch20 ("The Briar Hold").
- Leader: **Briar-Captain Vex** — raider boss riding the same boss machinery (`bossSpec` searches conquest leaders). Mechanics in the ironwarden style: slam + summon raiders + enrage, numbers slightly above Brannoc (hpBase ~1700, dmgBase ~60).
- Annex: same three shapes with supply upkeep (outpost: food/bread/plate/gold; settlement: food/lumber/gold), own flatAuras/limitBonus values comparable to Ironshield.
- Rewards escalate past Ironshield keep (2500 gold/1500 lumber/400 plate/200 frostwood): assault pays more (e.g., 3500 gold/2000 lumber/500 plate/300 frostwood); prelims pay intermediate baskets.

## Ledger rule (important)
`world.conquest` today holds one tribe's progress. Support TWO tribes without breaking Ironshield saves: keep every existing field/behavior for Ironshield byte-identical (old saves wake unscouted with an empty ledger and Ironshield ungated-beyond-its-law), and record Thornband separately (e.g., per-tribe ledger entries). If the current shape already supports it, just use it. Annex/supply tick (`tickTownSupply`, territory upkeep) must handle each annexed tribe; Ironshield-only saves behave exactly as before.

## Rules
- No new mechanics, currencies, aura keys, or save version bumps unless the ledger strictly needs an additive field (with safe defaults + tests).
- Old-save defaults and Ironshield behavior stay pinned by the existing tests — do not weaken them.
- After edits run `npm test` and `npm run build`. Report pass/fail plus files changed. Do not start H6.
