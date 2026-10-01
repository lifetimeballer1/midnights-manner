# Living Kingdom Phase 4 — earned titles (design, 2026-10-01)

Architectural mini-slice. Crew: Boss Muse Spark, Grunt DeepSeek (code), Artist GPT (UI text only).
20Q locked: Q7 name+trait+title persist, home/workplace read live; Q8 bonuses ≤5%.

## Finding: identity exists, titles don't
Phase 7 shipped names, 8 functional traits, job XP/levels (+8%/level), auto-assign
(`src/systems/villagers.js:1-261`), chips/cards (`src/ui.js:294-298,519,524`), save
migration v9→v10. No `u.title` anywhere (only renown/boss/quest titles). Phase 4 =
earned titles only. No life sim.

## Reuse (read-once)
- `src/systems/villagers.js:33-36,99-107,118-136` JOB_XP_LEVELS (5 levels), jobLevelMult, tickVillagerJobs (returns leveled[], no notify).
- `src/systems/villagers.js:86-98` ensureIdentity (additive defaults, never wipes).
- `src/model.js:158` + `src/systems/crafting.js:62` + `src/systems/economy.js:174` jobLevelMult readers.
- `src/game.js:723` tick call site (ignores return); notify pattern `tickTownMeal(w,d,notify)`.
- `src/ui.js:294-298,519,524` title display spots; `src/storage.js` troops serialize wholesale (plain string field persists free).
- Troop levels rise via train for every role (`src/game.js:430-435`); abilities unlock every 5 levels.

## Rule (awards without new counters)
- Posted trades at jobLevel 5 → trade title. builder/combat have no job/posts, so:
  builder + combat roles at troop level ≥15 (third ability milestone, same seniority).
- TITLES table in villagers.js (dependency-free module stays import-free):
  builder→Master Builder; weaponsmith/toolsmith/armorer→Master Smith;
  miner→Master Miner; warrior/archer/warden/pikewoman/halberdier/longbowman→Veteran Guard.
- `u.title` persisted string, earned never revoked; veterans backfill on next tick.
- Bonus: jobLevelMult ×1.05 when titled (one line; all 3 readers; ≤5% per Q8).

## Packets
### A — Title awards + bonus + tests (DeepSeek, code)
New `tickTitles(world,data,notify=null)` in villagers.js: one pass, posted jobLevel-5
match + level-15 builder/combat match, sets `u.title`, notifies once each via optional
callback (backward compatible). Wire into game.js:723 with notify. ensureIdentity:
`title===undefined→null`, never overwrite. jobLevelMult ×1.05 titled.
Accept: award posted + level paths; notify once (no re-notify); bonus exactly 1.05;
round-trip persistence; old saves backfill; `npm test && npm run build` green.

### B — Title display (GPT, visual/UI text only)
`src/ui.js:294-298` (person-card h3 + jobLine), `:519` (workplace row), `:524`
(inspector): `🏅 Title` chip reusing `.trait` style. No sim/save/behavior.
Accept: title reads in all 4 spots; no other UI change; suite green.

## Gates (every packet)
`npm test && npm run build` green · old saves load · VERSION stays 15 · phone caps
held · one commit per packet + ≤5-line summary · fetch + rebase, never force-push.
