# NEXT 20 PHASES — Midnights Manner Content Roadmap (Design Draft)

> DRAFT ONLY — design doc. No repo source files are edited by this document.
> Grounded in repo state at `repo/` + `PROGRESSION_REVIEW.md` + `RESET_HANDOFF.md`.
> Companion patch-set (`PATCH_SET.md` + `fix-*.diff`) is untouched; this design assumes
> current repo state *plus the review's recommended fixes* as its baseline where noted.

## Baseline (what exists today)

- **Troops:** 21 entries in `data/troops.json` (warrior, archer, warden, ranger = combat;
  miner, farmer, fisherman, shepherd, lumberjack, butcher, forager = collectors;
  scholar, scout, healer, weaponsmith, armorer, toolsmith, leatherworker = keepers;
  builder, mason = builders). All `maxLevel: 25`, all share one 5-step ability kit
  (`abilities.json`: cleave/armor/heal/veteran/haste).
- **Buildings:** 22 entries in `data/buildings.json`. Only `cottage` has `housing`.
  `hall` has no housing. Map caps at 20×16 (`data/world.json`).
- **Gear:** `data/items.json` — combat/gatherer gear has stats; **all keeper gear
  (`tome`, `compass`, `chalice`, `forgehammer`, `armorkit`, `tinkerkit`) has empty
  `stats: {}`**. No armor-slot items exist anywhere.
- **Progression:** `XP_LEVELS = [0,100,220,380,580,830,1150]` (`src/model.js`), 4-entry
  `EXPANSION` (caps at level 4 = 20×16); levels 5–7 pay nothing. 8 quests (710 XP total,
  lands on level 5), 6 missions in a strict linear `requires` chain.
- **Village sim:** `src/systems/village.js` — `START_CHILD_TYPES` = 4 collectors,
  `CHILD_SECONDS = 75`, starvation zeroes `childTimer`, `taskDone` supports
  build/recruit/assign/population/level/gather kinds.

## The 4 known pitfalls (checked per phase)

Every phase below ends with a pitfall check against:

1. **P1 — Dead unlocks** (reward grants something already available, cf. `first-harvest`→`tower`).
2. **P2 — Cosmetic levels** (level/XP with no payout, cf. XP levels 5–7).
3. **P3 — No-op quest gates** (gate auto-satisfied on arrival, cf. `east-field` level 3).
4. **P4 — Shared ability kits** (new troop reuses the identical 5-step kit).

Plus two from the review's §8 worth enforcing: **P5 — giver/flavor toast-only**
(new characters must appear in a log/panel, not just a toast) and
**P6 — linear-chain-only `requires`** (new missions should exercise branching).

## Act map

- **Act V — Foundations (Phases 1–5):** make existing systems pay out before adding width.
- **Act VI — The Wilds (Phases 6–10):** new biome/resource, new collectors, armor gear.
- **Act VII — War & Craft (Phases 11–15):** new combat roles, mission branch, keeper depth.
- **Act VIII — Legends (Phases 16–20):** endgame, prestige, finale.

---

## Phase 1 — Scriptorium's Due (Act V)
**Theme:** make XP levels 5–7 pay out (fixes review §1 head-on) and give the Scholar a real identity.

- **Characters/troops:** no new troop. Returning character: **Issa the chart-keeper**
  (giver of quest 5 `every-hand`) becomes the Act V narrator — her existing flavor
  ("The Moonwarden chart says so") is promoted into a readable Chart Log panel entry.
- **Buildings/builds:** **Scriptorium Tier 3** (new tier on existing `scriptorium`:
  `buildings.json` currently caps it at 2 tiers; tier 3 = `rateMultiplier: 3`,
  `xpRate` scales with tier via `auras()` in `model.js`, so no sim change needed).
  Cost guideline: `buildingCost()` already multiplies tier-3 by 1.5× (`model.js`).
- **Weapons/armor/gear:** **Scholar's Orrery** (new `items.json` entry, roles:
  `["scholar"]`, stats: `{survey: +25%, xpAura: +0.06}` — first keeper gear with
  non-empty stats; keeper gear today is all `stats: {}`). Earned, not bought.
- **Unlock cadence:** quest-gated. New **Quest 9 `chart-the-dark`** (task:
  `{kind: gather, resource: gold, amount: 400}` — a *new* task kind/resource combo,
  not a level gate) → rewards Orrery + 150 XP. 150 XP on top of the existing 710
  quest total = 860 → **level 6 (830) becomes reachable through quest play**,
  and level 6 must grant something (see below).
- **Builds on existing systems:** `levelForXp`/`XP_LEVELS` (`model.js`), quest
  auto-claim loop (`village.js` `tickVillage`), `auras().xp` stacking. Level 6
  payout: **map row +1 via a 5th `EXPANSION` entry `{w:20,h:17}`** — requires
  raising `world.json` height 16→17 first (one-field change, flagged for impl).
  Level 7 (1150): Scriptorium tier 3 unlock (level-gated building tier — a new
  gate type, but implemented as a shop availability check).
- **Pitfalls:** P1 — Orrery is a new item, not pre-available. P2 — levels 6/7 get
  named payouts (map row / tier unlock), the core fix. P3 — gather-400-gold is
  unachievable at quest arrival (requires active mining), never auto-complete.
  P4 — no new troop, no kit cloned. P5 — Issa's Chart Log is a persistent panel
  entry, not a toast.

## Phase 2 — The Second Trade (Act V)
**Theme:** break the 4-type growth monopoly — the village's children learn new trades.

- **Characters/troops:** no new troop *recruit*; instead **growth-pool expansion**:
  `START_CHILD_TYPES` (`village.js`) grows from 4 to 6 with **`shepherd` +
  `forager`** (both existing `troops.json` collectors with `job.workplace`s
  already wired: `pasture`, `grove`). New character: **Tomm the herder** (named in
  `still-water` flavor as Wren's grandfather — promote him to giver of new Quest 10).
- **Buildings/builds:** **Pasture Tier 2 build quest** — `pasture` already has 2 tiers
  in `buildings.json`; the phase's build goal is upgrading pasture→2 + grove→2,
  teaching tier upgrades on food buildings (untouched by the 8 existing quests,
  which only count *buildings*, never tiers — `taskDone` `build` kind; needs a new
  `upgrade` task kind, flagged for impl).
- **Weapons/armor/gear:** **Herding Crook** (roles: `["shepherd"]`, stats:
  `{gather: 1.5, carry: 16}`) and **Berry Basket** (roles: `["forager"]`, stats:
  `{gather: 1.4, carry: 18}`) — mirrors the existing `scythe`/`cart` upgrade-gear
  pattern (`items.json`), same cost band (gold 70–80 + wood 30–50).
- **Unlock cadence:** quest-gated. New **Quest 10 `tomm-s-flocks`** (task: new `upgrade`
  kind, pasture tier 2) → +130 XP + Herding Crook. Quest XP running total:
  710 + 150 + 130 = 990 — still short of level 7 (1150), keeping Scriptorium play
  relevant (review §1: parked-scholar XP stays meaningful).
- **Builds on existing systems:** `job.effect` tend/pick pipeline, `gatherBonus`
  1.25× assigned-collector bonus (`model.js`), `harvest.bonusRate` on both buildings.
  Directly addresses review §7 (4-of-18 growth) without touching mission balance.
- **Pitfalls:** P1 — both gear items are new. P2 — no level touched. P3 — upgrade
  task is strictly future work (no tier-2 food building exists at quest arrival
  unless the player pre-built one — acceptable: rewards preparation, doesn't
  auto-fire from quest-XP arithmetic like `east-field`). P4 — no new kit. P5 —
  Tomm graduates from flavor-text mention to quest giver with a log entry.

## Phase 3 — Beds for Dozens (Act V)
**Theme:** housing is the hidden wall (review §6) — make it a visible, designed track.

- **Characters/troops:** new keeper-aspirant troop: **`Apprentice`** (role: keeper,
  base hp 75 / dmg 5, `maxLevel: 15` — the first troop with a *lower* cap, a deliberate
  cadence tool). Job: `{workplace: "cottage", effect: "welcome"}` — assigned
  apprentices *raise cottage capacity by +1 each* (new aura key `beds`, capped +3;
  impl flag: `housing()` in `model.js` reads `auras().beds`). Kit: NEW keeper track
  (see Appendix A row K1) — never the shared kit.
- **Buildings/builds:** **Cottage Tier 3** (`housing: [6, 10, 16]`, hp 640) +
  **Longhouse** (new building: size 3, cost wood 180 gold 90, `housing: [14]`,
  single tier, requires village level 5 — first level-gated building, giving level 5
  a *retroactive* payout to join level 6/7 from Phase 1).
- **Weapons/armor/gear:** **Hearth Apron** (roles: `["apprentice"]`, stats:
  `{beds: +1}` — gear that stacks with the job aura, capped the same way) +
  first **armor-slot item in the game: `Padded Coat`** (slot: armor, all roles,
  `{armor: 0.1}` — `stats()` currently applies no armor from gear; impl flag).
- **Unlock cadence:** level-gated (Longhouse at vlevel 5) + recruit-gated (Apprentice
  from new Quest 11 `open-doors`, task `{kind: population, count: 10}` — measures
  the cottage-tier-2 road, unreachable at arrival since growth needs beds).
- **Builds on existing systems:** `housing()` beds math, `CHILD_SECONDS` loop,
  cottage `housing` array indexing (`h[Math.min(b.level, h.length)-1]` already
  supports 3 entries — no code change for tier 3 beds). Makes review §6's hidden
  wall an explicit progression track with UI (beds counter already exists in notify).
- **Pitfalls:** P1 — Longhouse/Apprentice/Apron/Coat are all new. P2 — level 5
  gains the Longhouse gate (no more dead mid-rung). P3 — pop-10 requires real
  growth time under the 75s timer. P4 — Apprentice debuts the K1 keeper kit.
  P6 — Quest 11 branches: completable before or after Quest 9/10 (no chain).

## Phase 4 — Keeper's Tools (Act V)
**Theme:** fill the empty keeper-gear stat blocks — every keeper's tool becomes a real item.

- **Characters/troops:** no new troop. Spotlight on the **four aura keepers**
  (`weaponsmith`, `armorer`, `toolsmith`, `leatherworker` — `troops.json` jobs:
  sharpen/plate/tinker/pack) + **healer/scout/scholar**. New character: **Sarella
  Emberwright**, master of the forge, giver of Quest 12.
- **Buildings/builds:** **Forge Tier 2 + Armory Tier 2 paired build** (both exist as
  2-tier buildings; the quest wants *both* at tier 2 — first quest demanding two
  different upgrades, uses the Phase-2 `upgrade` task kind twice). No new building;
  depth on existing ones.
- **Weapons/armor/gear:** **five upgraded keeper tools**, one per aura keeper +
  healer/scout share the spotlight via trinkets:
  `runed-forgehammer` (weaponsmith: `{damageAura: +0.1}`), `etched-armorkit`
  (armorer: `{armorAura: +0.1}`), `fine-tinkerkit` (toolsmith: `{gatherAura: +0.1}`),
  `oiled-awl` (leatherworker: `{carry: +10}`), `brass-chalice` (healer:
  `{healAura: +1.0}`). Cost band mirrors `toolkit` (gold 90/wood 30). These are
  the first gear pieces that buff *auras* — `builderBonuses()` reads
  `items[gear].stats.buildSpeed/costReduction` today; aura-stats need the same
  read-through (impl flag, same pattern).
- **Unlock cadence:** Quest 12 `sarella-s-standard` (task: forge tier 2 AND armory
  tier 2) → +140 XP + choice of ONE of the five tools (first **player-choice
  reward** — replay/counter-pick hook). Running quest-XP total:
  990 + 140 = 1130 — deliberately 20 short of level 7 (1150), so the finale of
  Act V is one Scriptorium session or one survey away. Tension by arithmetic.
- **Builds on existing systems:** `auras()` per-workplace stacking with tier
  multipliers, `assignmentValid`/`workplaceCapacity` (forge/armory are size 2/1 →
  3/2 crew). Turns the "assign keepers" mid-game into a gear chase.
- **Pitfalls:** P1 — all five tools are new SKUs. P2 — no level touched. P3 — two
  tier-2 upgrades cost thousands of gold at `buildingCost()` tier scaling; weeks
  away at arrival. P4 — no troop, no kit. P5 — Sarella persists as forge vendor
  (ties into Phase 10 market).

## Phase 5 — The Forked Road (Act V)
**Theme:** the campaign branches for the first time (review §8: `requires` supports
  multiple parents — use it). Act V finale, two missions, player picks a road.

- **Characters/troops:** new combat troop: **`Pikewoman`** (role: combat, hp 150 /
  dmg 14 / range 1.6, `defaultGear: pike`, recruit food 40 gold 25). Kit: NEW
  melee-control track (Appendix A row C1: 5: `brace`, 10: `armor`, 15: `rally`,
  20: `veteran`, 25: `phalanx`) — shares only the *slot positions* 10/20 with the
  old kit, effects differ per-troop from here on (see Appendix A).
- **Buildings/builds:** **Stone Wall** (new building: size 1, cost wood 30 gold 25,
  hp 520/1040/1560 across 3 tiers — strictly above `wall` 230/460/690; doesn't
  obsolete it: Palisade stays the cheap fast answer, Stone Wall the slow dear one).
  Pre-placed on one branch map, unlockable on the other (see below).
- **Weapons/armor/gear:** **Pike** (roles: `["pikewoman"]`, `{damage: 1.0, range:
  1.6}`, animation `brace`) + **Kite Shield** (armor slot, combat roles,
  `{armor: 0.15, hp: +20}`). Armor slot grows to a real second gear axis.
- **Unlock cadence — THE BRANCH:** new Mission 07 `ashen-ford` and Mission 08
  `hollow-dam` BOTH list `"requires": ["last-stand"]` (first use of shared
  prerequisite). Each grants the other's showcase: `ashen-ford` pre-places a
  Stone Wall and unlocks **`pikewoman`**; `hollow-dam` fields Pikewomen in its
  starting troops and unlocks **`stonewall`**. Completing either re-locks nothing —
  the player finishes the Act having *seen both, earned both*, but the ORDER and
  the mission experience differ (rush-defense vs. escort-economy). Fixes the
  ember-road/moonwell showcase-unlock inversion (review §4) structurally: showcase
  and unlock now arrive in the SAME mission, on both branches.
- **Builds on existing systems:** mission `map`/`raids`/`troopLimit` schema,
  `locked()`/`unlocks` flow (`src/game.js`), ceremony win/lose text. Troop limits:
  6 and 7 respectively (up from last-stand's 5 — the squeeze loosens as reward).
- **Pitfalls:** P1 — both unlocks are new content; NEITHER branch grants `tower`
  (the dead-unlock pattern is banned by name in the phase spec). P2 — no level
  touched. P3 — N/A (missions, not quests; objectives are gather/defend with real
  raid clocks). P4 — Pikewoman debuts kit C1. P6 — the branch itself is the fix.

## Phase 6 — Frostwood Treeline (Act VI)
**Theme:** a second wilds biome west of the village — new wood type, new gatherer fantasy.

- **Characters/troops:** new collector: **`Woodward`** (role: collector, hp 120 /
  dmg 10, `gatherResource: wood`, `gatherFrom: frostgrove`, carry 14,
  `defaultGear: frostaxe`). Job: `{workplace: "frostgrove", effect: "split"}`.
  Kit: NEW collector track (Appendix A row G1: 5: `swift`, 10: `sturdy`, 15:
  `rich`, 20: `veteran-x` (gather variant), 25: `master`). Giver: **Fen the
  wayfinder** returns (giver of quest 7 `east-field`) — his chalk map finally opens.
- **Buildings/builds:** **Frostgrove** (new production building: size 2, cost wood
  90 food 30, production `frostwood` — a NEW resource key, 4th after wood/food/gold;
  `reserve: 400`, `workplace: woodward`, tiers 2). Frostwood spends only on Act VI+
  buildings/gear (sinks, not inflation). Requires village level 6 (level gates
  stay meaningful post-Phase-1).
- **Weapons/armor/gear:** **Frostaxe** (roles: `["woodward"]`, `{gather: 1.4,
  carry: 14}`) + **Winter Coat** (armor slot, collectors, `{armor: 0.1, gather:
  1.1}` — first dual-stat armor).
- **Unlock cadence:** level-gated building (Frostgrove at vlevel 6) + Quest 13
  `west-of-the-chalk` (task: `{kind: gather, resource: frostwood...}` — needs a
  gather-kind extension to the new resource; arrival bank = 0 by construction).
  +150 XP → running total 1280: **level 7 (1150) lands mid-Act VI through quests
  alone**, and level 7 pays Scriptorium tier 3 (Phase 1) — the ladder's old dead
  top now resolves inside the story.
- **Builds on existing systems:** production/reserve/harvest pipeline
  (`buildings.json` schema), `gatherBonus` assigned-collector bonus, `inBounds`
  on the Phase-1 20×17 map. New resource key flows through `resources`/`gathered`
  objects (both are open maps — no schema change).
- **Pitfalls:** P1 — Frostgrove/Woodward/Frostaxe all new. P2 — level 7's payout
  (Phase 1) fires here. P3 — frostwood bank is 0 at quest arrival (can't pre-farm
  an unbuilt building's resource). P4 — G1 kit debut. P5 — Fen's log entry updates.

## Phase 7 — Hide & Plate (Act VI)
**Theme:** armor becomes a craft, not a buff — the Armory earns its name.

- **Characters/troops:** new keeper: **`Tanner-Knight`**? No — keep roles clean:
  new builder-track troop **`Smelter`** (role: builder, hp 115 / dmg 9,
  `defaultGear: tongs`). Job: `{workplace: "smeltery", effect: "smelt"}` (see
  below). Kit: NEW builder track (Appendix A row B1: 5: ` brisk`, 10: `sturdy`,
  15: `discount`, 20: `foreman`, 25: `master-builder`) — builders finally diverge
  from collectors. Giver: **Maro the mason** (quests 1-voice + `full-crew`).
- **Buildings/builds:** **Smeltery** (new building: size 2, cost wood 120 gold 80
  frostwood 40, `workplace: smelter`, converts frostwood→**plate** (2nd new resource,
  armor-craft only) at `produce`-style rate 0.6/s — mirrors `butchery`'s
  `job.effect: produce` pattern in `troops.json`). Tier 2 doubles rate.
- **Weapons/armor/gear:** **THREE armor-slot pieces** (the armor axis goes wide):
  `Iron Cap` (all roles, `{armor: 0.1}`, cheap: gold 40), `Studded Vest` (collectors
  + builders, `{armor: 0.15, carry: +4}`), `Knight's Plate` (combat, `{armor: 0.25}`,
  costs plate ×8 — first plate sink). All stack with the `armor` *ability* (different
  multipliers: gear reduces incoming, ability is the same channel — impl must
  decide additive vs multiplicative; spec: multiplicative, capped 0.6 total).
- **Unlock cadence:** building-gated chain: Smeltery requires Frostgrove tier 2
  (first building-requires-building gate; impl flag) → Smelter recruitable → Quest
  14 `first-pour` (task: `{kind: gather, resource: plate, amount: 10}`) → +140 XP
  + Iron Cap. Running total 1420.
- **Builds on existing systems:** `butchery` produce-pattern, `buildingCost()`
  scaling, armor math in combat (`armor` effect today is ability-only 0.25).
- **Pitfalls:** P1 — all new. P2 — untouched. P3 — plate bank is 0 at arrival.
  P4 — B1 kit debut; armor pieces are gear, not kit. P5 — Maro's log grows.

## Phase 8 — The Deep Pond (Act VI)
**Theme:** water gets its second act — the pond chain grows down, not out.

- **Characters/troops:** new collector: **`Diver`** (role: collector, hp 95 / dmg 7,
  `gatherResource: food`, `gatherFrom: deephole`, carry 14, `defaultGear: net`).
  Job: `{workplace: "deephole", effect: "haul"}`. Kit: G1 collector track
  (shared WITH Woodward — deliberate: collectors share a *role* kit, but it is a
  NEW kit distinct from the old universal one; role kits are the Appendix A rule).
  Giver: **Wren Waterwise** (quest 2 `still-water` giver — her pond chain continues).
- **Buildings/builds:** **Deephole** (new building: size 1, cost wood 70 food 40,
  production food rate 2.2, `reserve: 350`, `workplace: diver`, tiers 2).
  Requires `pond` tier 2 adjacent-ish (same building-requires-building gate as
  Phase 7; pattern reuse, second data point). Plus **Pond Tier 3** (rate ×3).
- **Weapons/armor/gear:** **Weighted Net** (roles: `["diver"]`, `{gather: 1.6,
  carry: 18}`) + **Oilskin Coat** (armor slot, collectors, `{armor: 0.12, speed:
  +0.1}` — first speed armor; speed math lives in `stats()` growth — impl flag).
- **Unlock cadence:** Quest 15 `down-dark-water` (task: `upgrade` pond→3) → +130 XP
  + Weighted Net. Running total 1550. Deephole itself unlocks at pond-3 completion
  (quest-completion unlock — first of its kind; impl: `unlocks` on quests, mirroring
  missions' field).
- **Builds on existing systems:** pond/fisherman pipeline, `harvest` bonus
  overrides, food-income vs `UPKEEP_EACH` surplus math (more food → faster
  `childTimer` → ties water into growth).
- **Pitfalls:** P1 — new SKUs only. P2 — untouched. P3 — pond-3 costs ~thousands
  (tier-3 1.5× rule); arrival bank can't cover it. P4 — G1 role kit, not clone.
  P5 — Wren's log entry.

## Phase 9 — Emberglass Mine (Act VI)
**Theme:** gold gets its second act — and the mine finally has a rival.

- **Characters/troops:** new collector: **`Sapper`** (role: collector, hp 125 /
  dmg 11, `gatherResource: gold`, `gatherFrom: emberglass`, carry 12,
  `defaultGear: glasspick`). Job: `{workplace: "emberglass", effect: "cut"}`.
  Kit: G1 collector track. Giver: **Pella Second-Lantern** (quest 4 giver — her
  blessing arc continues; flavor callback to "bless the door").
- **Buildings/builds:** **Emberglass Mine** (new building: size 1, cost wood 110
  food 40 frostwood 30, production gold rate 2.4, `reserve: 500`, `workplace:
  sapper`, tiers 2). Requires `mine` tier 2 (same gate pattern, third data point —
  by now it's a system, not a hack). Plus **Mine Tier 3**.
- **Weapons/armor/gear:** **Glasspick** (`["sapper"]`, `{gather: 1.6, carry: 16}`)
  + **Ember Ward** (armor slot, all roles, `{armor: 0.12, damage: 1.05}` — first
  armor with an offensive stat; prices in gold+plate so combat players feel the
  Phase-7 economy).
- **Unlock cadence:** Quest 16 `glass-under-stone` (task: `upgrade` mine→3) →
  +140 XP + Glasspick. Running total 1690. Emberglass unlocks on quest completion
  (same quest-unlock mechanism as Phase 8 — second data point).
- **Builds on existing systems:** mine/miner pipeline, `reserve` drain floor
  (RESET_HANDOFF note: 0.25× floor — Emberglass gets a *kinder* 0.4× floor as its
  identity: "the mine that doesn't run dry"), raid-loot gold economy (loot stays
  trivial; mining stays the gold path — deliberate).
- **Pitfalls:** P1 — new. P2 — untouched. P3 — mine-3 cost wall. P4 — G1 role kit.
  P5 — Pella's log.

## Phase 10 — The Wild Market (Act VI)
**Theme:** Act VI finale — the traders (`data/traders.json` exists and is unused by
  progression!) become a system. Sarella's forge connects to the road.

- **Characters/troops:** new keeper: **`Haggler`** (role: keeper, hp 80 / dmg 5,
  `defaultGear: scales`). Job: `{workplace: "market", effect: "trade"}` —
  assigned hagglers improve trader exchange rates by 10% each (new aura key
  `trade`, cap 0.3; impl flag in `auras()`). Kit: NEW keeper track K2 (haggler +
  future Phase-14 apprentice-master share K2 — keepers split into *scholarly* K1
  vs *mercantile* K2). Giver: **Sarella Emberwright** (Phase-4 vendor — payoff).
- **Buildings/builds:** **Market** (new building: size 3, cost wood 150 gold 120
  frostwood 60, `workplace: haggler`, tiers 2; tier 2 unlocks a second concurrent
  trader offer). Market spawns trader offers on a timer (reads `traders.json` —
  first progression use of that file).
- **Weapons/armor/gear:** **Merchant Scales** (`["haggler"]`, `{trade: +0.1}` —
  first gear that buffs a new aura key) + **Coinmail** (armor slot, keepers +
  builders, `{armor: 0.15, discount: 0.05}` — first discount armor; discount math
  lives in `builderBonuses()` — impl flag).
- **Unlock cadence:** Mission 09 `coin-and-cinder` (requires ONE of
  `ashen-ford`/`hollow-dam` — branch re-converges; either road qualifies) →
  unlocks **`market`** + `haggler` recruit. Showcase=unlock same-mission rule kept.
  Troop limit 7, timed dual-objective (gold + frostwood) — first III-resource mission.
- **Builds on existing systems:** `traders.json`, mission schema, branch
  reconvergence (P6 advanced: branch → merge, the full diamond). Quest XP total
  stays 1690 through this phase (mission phase — quests rest).
- **Pitfalls:** P1 — market/haggler new. P2 — untouched. P3 — N/A (mission).
  P4 — K2 debut. P5 — Sarella vendor log persists. P6 — diamond complete.

## Phase 11 — Oathsworn (Act VII)
**Theme:** the war band grows up — an oath-bound heavy who answers the mid-game raid
  curve (RESET_HANDOFF: raids go trivial vs L25 warrior ~79 dps; this phase starts
  the enemy answer too — see Mission 10).

- **Characters/troops:** new combat: **`Oathsworn`** (role: combat, hp 260 / dmg 18
  / speed 0.9 / range 1.0, `defaultGear: oathblade`, recruit food 60 gold 45 —
  priciest recruit yet). Kit: NEW heavy track C2 (5: `bulwark`, 10: `armor-ii`,
  15: `oath` (active taunt — first aggro ability; impl flag in combat), 20:
  `veteran`, 25: `unbroken`). Giver-character: **Bell-Captain Sorrel** (Old Bell's
  successor — generational handoff, log entry).
- **Buildings/builds:** **Oathstone** (new building: size 1, cost stone... no —
  cost wood 100 gold 100 plate 6; aura: assigned Oathsworn nearby gain +0.1 armor
  — first *troop-proximity* aura rather than workplace aura; impl flag, capped).
  Single tier (monument pattern — see Phase 18 for the second).
- **Weapons/armor/gear:** **Oathblade** (`["oathsworn"]`, `{damage: 1.3, range:
  1.1}`, animation `oath`) + **Tower Shield** (armor slot, combat,
  `{armor: 0.2, speed: -0.1}` — first tradeoff armor; speed penalty is a new
  stat sign, impl reads it in `stats()`).
- **Unlock cadence:** Mission 10 `the-pale-host` (requires `coin-and-cinder`) —
  first mission with **wave-scaled enemies** (`hp 65+12N` curve steepened per
  RESET_HANDOFF note; mission JSON gains optional `scaling` field, impl flag).
  Rewards: unlock **`oathsworn`** + Oathblade. Troop limit 8 (new high).
- **Builds on existing systems:** enemy scaling formula, raid `count`/`at` schema,
  recruit-cost economy (60/45 vs troop-training thousands — still the cheap end;
  the *leveling* is the sink, per review §8).
- **Pitfalls:** P1 — new troop/building/gear. P2 — untouched. P3 — N/A (mission;
  survival-gated). P4 — C2 debut. P5 — Sorrel log.

## Phase 12 — Siegeworks (Act VII)
**Theme:** defense becomes a doctrine — traps grow up and towers learn new tricks.

- **Characters/troops:** no new troop. Spotlight: **builder + mason** (siege crew
  fantasy). New character: **Sapper-Captain Rue** (a *reformed raider* — first
  enemy-side defector, ties to `rumors.json` which names raider bands; first
  progression use of that file).
- **Buildings/builds:** **Trap Tier 4**? No — tiers cap at 3 across the game.
  Instead: **Fire Trap** (new building: size 1, cost wood 40 gold 40 frostwood 20,
  damage 60 + burn 4/s for 3s — first damage-over-time building; impl flag in
  combat tick) + **Tower Tier 4** (damage 65, range 5.2 — first tier-4 in the game;
  `buildingCost()` tier-3 1.5× rule extends: tier-4 2×, impl flag). Watchfire Tier 3
  (damage 30, range 6.5).
- **Weapons/armor/gear:** **Siege Tongs** (roles: `["builder", "mason"]`,
  `{buildSpeed: 1.5, trapDamage: +0.2}` — first gear buffing *buildings'* damage;
  impl reads in siege tick) + **Ashen Cloak** (armor slot, builders + keepers,
  `{armor: 0.12, burn-resist: 1.0}` — burn immunity; pairs with Fire Trap doctrine:
  your crew walks through your own fire).
- **Unlock cadence:** Quest 17 `rue-s-terms` (task: new kind `defeat` — win any
  raid with 0 building losses; arrival-state: impossible retroactively, must be
  *newly* earned — the strongest P3-proof gate in the doc) → +150 XP (total 1840)
  + Fire Trap unlock. Tower-4/Watchfire-3 unlock at **village level 8** (NEW LEVEL
  — see below).
- **Builds on existing systems:** trap/tower/watchfire tier schema, raid win
  detection (already exists for ceremony victory), `buildingCost` tier multiplier.
  **Level 8 (new, 1500 XP):** within reach at 1840 total — payout = tier-4 access.
  XP ladder grows *because content pays for it* (anti-P2 rule demonstrated).
- **Pitfalls:** P1 — Fire Trap/tower-4 new. P2 — level 8 ships WITH its payout.
  P3 — `defeat`-flawless gate can't auto-fire. P4 — no troop. P5 — Rue log +
  rumors callback. P6 — Quest 17 branches off the main quest line (optional
  order with Quest 18).

## Phase 13 — The Choir (Act VII)
**Theme:** the healers get a doctrine — Moonchapel stops being a passive trickle.

- **Characters/troops:** new keeper: **`Chorister`** (role: keeper, hp 85 / dmg 6,
  `defaultGear: hymnal`). Job: `{workplace: "chapel", effect: "chorus"}` —
  assigned choristers multiply chapel `healRate` (stacks with healer's flat mending
  via existing `auras().heal` sum — no new key needed, second crew type on the
  SAME workplace: first shared-workplace troop; `assignmentValid` already allows
  any matching `job.workplace` — no code change). Kit: K1 scholarly track (shared
  with Apprentice — keepers share *role* kits per the Appendix A rule).
- **Buildings/builds:** **Chapel Tier 3** (heal ×3) + **Bellcote** (new building:
  size 1, cost wood 90 gold 70, aura: village-wide revive-to-50% instead of 30%
  after raids — answers RESET_HANDOFF's "dead troops revive at 30%, zero stakes"
  note from the *player-power* side while Phase 19 answers it from the stakes side).
- **Weapons/armor/gear:** **Hymnal** (`["chorister"]`, `{healAura: +0.8}`) +
  **Choir Robe** (armor slot, keepers, `{armor: 0.12, heal: +10}` — first gear
  with a flat-heal stat; impl reads in chapel tick).
- **Unlock cadence:** Quest 18 `voices-in-the-dark` (task: `{kind: assign, count:
  4}` — double the existing quest-5 assign-2; counts *any* workplaces, reachable
  but effortful) → +140 XP (total 1980) + Hymnal. Bellcote unlocks at Chapel-3
  completion (quest/building-completion unlock, 3rd data point — now a system).
- **Builds on existing systems:** `auras().heal` stacking, chapel `healRate`,
  post-raid revive rule, assign-task kind. Shared-workplace precedent set here is
  reused in Phase 14 (forge) and Phase 16 (scriptorium).
- **Pitfalls:** P1 — new. P2 — untouched. P3 — assign-4 needs 4 staffed workplaces
  (mid-game roster stretch). P4 — K1 role kit. P5 — Chorister-choir log; the
  "choir" appears as a village panel entry.

## Phase 14 — Master & Apprentice (Act VII)
**Theme:** keepers grow their own — the Apprentice (Phase 3) graduates into a career.

- **Characters/troops:** Apprentice **promotion path**: at level 15 (its cap), an
  Apprentice assigned to a workplace may **promote** into that workplace's keeper
  type at level 5 (first class-change system; impl flag in barracks/people UI).
  Promoted keepers keep kit K1/K2 and gain +10% aura (the "master's touch" —
  one-line aura bonus keyed on `unit.promoted`, impl flag). New character:
  **Master Tam**, head of the school — giver, log, vendor of apprentice gear.
- **Buildings/builds:** **Schoolroom** (new building: size 2, cost wood 120 gold
  100, `workplace: apprentice`, XP trickle 0.06/s — half scriptorium; apprentices
  posted here level 50% faster (new effect `tutor`; impl flag)). Tier 2 doubles both.
- **Weapons/armor/gear:** **Primer** (`["apprentice"]`, `{xp: +0.03}` — gear that
  speeds *village* XP; stacks with aura) + **Master's Ring** (armor... no —
  trinket slot? Keep scope: armor slot, keepers only, `{armor: 0.1, aura: +0.05}`
  — first % aura gear; impl in `auras()`).
- **Unlock cadence:** Quest 19 `tam-s-school` (task: `{kind: recruit, type:
  "apprentice", count: 3}` — recruit-kind reuse with the Phase-3 troop; needs
  beds for 3 (ties back to Phase-3 housing track)) → +150 XP (total 2130) +
  Schoolroom unlock + Primer. Promotion itself unlocks at Schoolroom tier 2
  (building-tier-gated system — 2nd data point after Phase-1 scriptorium-3).
- **Builds on existing systems:** recruit/population tasks, `xpRate` aura stacking,
  `START_CHILD_TYPES` untouched (apprentices are recruited/promoted, never grown —
  growth-pool discipline kept). Haggler K2 note: mercantile apprentices promote
  into Hagglers (K2 path); cottage/scriptorium ones into K1 — the two keeper
  lines made legible.
- **Pitfalls:** P1 — all new. P2 — untouched. P3 — recruit-3-apprentices needs
  barracks spend + beds (real cost). P4 — K1/K2 role kits; promotion preserves
  kits (anti-clone rule enforced across class change). P5 — Master Tam log +
  school roster panel.

## Phase 15 — Twin Banners (Act VII)
**Theme:** Act VII finale — the second great branch, this time on *doctrine*: shield
  wall vs. arrow storm. The campaign's first mutually-exclusive choice (with a
  catch-up — see pitfalls).

- **Characters/troops:** TWO new combat troops (one per banner): **`Halberdier`**
  (hp 170 / dmg 20 / range 1.9, `defaultGear: halberd`, kit C1 melee-control) for
  the **Red Banner** (melee doctrine) and **`Longbowman`** (hp 75 / dmg 22 /
  range 5.5, `defaultGear: longbow`, kit NEW skirmish track C3: 5: `volley`, 10:
  `keen`, 15: `camouflage`, 20: `veteran`, 25: `arrowstorm`) for the **Grey Banner**
  (ranged doctrine). Both recruitable post-mission regardless of banner (see P1).
- **Buildings/builds:** **Fletcher** (new building: size 1, cost wood 100 gold 60,
  `workplace: none` — first *craft-only* building: outputs arrows, a consumable
  that buffs archers/rangers/longbowmen +15% for one mission; consumable system
  impl flag) on Grey path; **Shieldwall Yard** (size 2, repairs armor-slot items
  between missions — first durability-adjacent system; armor items gain wear 1/mission,
  yard resets it; impl flag) on Red path.
- **Weapons/armor/gear:** **Halberd** (`["halberdier"]`, `{damage: 1.35, range:
  1.9}`, animation `sweep`) + **Longbow** (`["longbowman", "ranger", "archer"]`,
  `{damage: 1.3, range: 5.5}` — first gear shared across THREE troops; rangers'
  identity preserved via kit C-old vs C3) + **Banner Cloak** (armor slot, combat,
  banner-colored cosmetic + `{armor: 0.1}` — first cosmetic+stat armor).
- **Unlock cadence:** Missions 11a `red-banner` / 11b `grey-banner`, both
  `"requires": ["the-pale-host"]`, **mutually exclusive on first clear** (second
  locks until BOTH... no — cleaner: first clear locks the other for *that cycle*;
  the unchosen mission unlocks after the Act VIII opener (Phase 16). No content
  ever permanently missed — exclusivity is pacing, not punishment. Each unlocks
  its troop + building + weapon; the *other* troop becomes recruitable (not
  showcase-unlockable) immediately — showcase and recruit separated deliberately
  here and stated in the mission text.
- **Builds on existing systems:** mission requires/branching, gear `roles` arrays
  (3-troop longbow is just a longer array), troop limits 8v8 mirrored missions
  (same map, mirrored raids — melee-favored vs ranged-favored tuning).
- **Pitfalls:** P1 — handled explicitly: unchosen troop is recruitable same-day,
  only its *showcase mission* waits one phase. Nothing granted is pre-owned. P2 —
  untouched. P3 — N/A (missions). P4 — C1 reuse is role-kit sharing (allowed);
  C3 debuts. P6 — branch-with-delayed-merge, the advanced pattern.

## Phase 16 — The Pale Court (Act VIII)
**Theme:** Act VIII opener — the unchosen banner returns, and the sky gets a vote
  (`data/calendar.json` exists; the sky-blessing hook `world.calendarBonus` is
  already read in `auras()` — time to aim content at it).

- **Characters/troops:** no new troop. The **unchosen Phase-15 mission unlocks**
  here (delayed merge fires on Mission 12 clear). New character: **The Pale
  Envoy** — first non-human giver (a moon-pale stranger; `names.json`+
  `legends.json` tie-in: she quotes a legend, first progression use of legends).
- **Buildings/builds:** **Moon Dial** (new building: size 1, cost gold 150
  frostwood 80; reads the calendar season and *locks in* one sky blessing
  permanently at 50% strength — `calendarBonus` becomes partially player-chosen;
  impl flag in game orchestration). Single tier, placement-limited 1/village.
- **Weapons/armor/gear:** **Envoy's Gift** (armor slot, any keeper, `{armor: 0.15,
  xp: +0.03}`) — mission reward, not purchase. Plus **second Banner Cloak color**
  (the merge: wear either, own both).
- **Unlock cadence:** Mission 12 `the-pale-court` (requires whichever of 11a/11b
  was cleared — `"requires"` with OR semantics: impl flag, first OR-gate; until
  then, requires can only express AND... note: mission `requires: ["red-banner"]`
  would strand grey-choosers, so the OR-gate is load-bearing for this phase).
  Clear → unlocks the *other* banner mission + Moon Dial build. Troop limit 8.
- **Builds on existing systems:** `calendarBonus` merge in `auras()`, mission
  requires, legends/rumors flavor files, branch-merge pattern from Phase 10.
- **Pitfalls:** P1 — Moon Dial/Gift new; unchosen mission is *new to the player*.
  P2 — untouched. P3 — N/A. P4 — no troop. P5 — Envoy log + legend quotation
  stored. P6 — OR-requires debuts (documented as load-bearing).

## Phase 17 — Prestige of the Bell (Act VIII)
**Theme:** the endgame loop — capped troops (all `maxLevel: 25`) get somewhere to go.

- **Characters/troops:** no new troop. **Prestige system**: any level-25 troop may
  **prestige** (reset to level 1, keep gear, gain one permanent prestige star ★;
  stars: +5% all stats each, max 3; impl flag in `stats()`). Prestiged units keep
  their role kit (P4-safe by construction). New character: **Old Bell herself**
  rings the prestige bell — her log arc closes (she gave quests 3 + 6).
- **Buildings/builds:** **Bell Tower** (new building: size 2, cost wood 200 gold
  200 plate 10; required to prestige — the loop has a building home; aura:
  prestiged units assigned anywhere gain +1 crew-count worth of aura — impl flag).
  Single tier monument (2nd monument after Oathstone).
- **Weapons/armor/gear:** **Starforged** upgrade line: any max-tier weapon may be
  **reforged** once (prefix `starforged-`, +15% main stat, costs plate 5 + gold
  500 — the plate sink that justifies the whole Act VI economy). First vertical
  gear progression (not sidegrades).
- **Unlock cadence:** Quest 20 `the-bell-remembers` (task: new kind `prestige`,
  prestige ONE troop — arrival-impossible by construction) → +160 XP (total 2290)
  + Bell Tower unlock... no — Bell Tower must EXIST to prestige (circular). Fix:
  Bell Tower unlocks at **village level 9** (new, 2100 XP — reachable: total is
  2290 by now, so level 9 lands *during* Act VIII quest play); Quest 20 then
  spends it. Level 9 payout = prestige access. The ladder grows only with content.
- **Builds on existing systems:** `stats()` growth formula (stars multiply in),
  `unlockedAbilities` (re-earned through kits — replay value WITH role identity),
  `buildingCost()`, level ladder. Direct answer to review §8's "8,000 gold to max
  a troop" note: prestige gives that spend a *continuation*.
- **Pitfalls:** P1 — prestige/stars/reforge/Bell Tower all new. P2 — level 9
  ships with the prestige payout. P3 — prestige-one-troop needs a L25 + tower
  (months of play; never auto-fires). P4 — kits preserved across prestige. P5 —
  Old Bell's farewell log.

## Phase 18 — The Sunken Chapel (Act VIII)
**Theme:** the builders' monument — water, stone, and faith in one building.

- **Characters/troops:** new keeper: **`Tidecaller`** (role: keeper, hp 90 / dmg 7,
  `defaultGear: tidebell`). Job: `{workplace: "sunken", effect: "tide"}` —
  Tidecallers raise Deephole + Pond output (SECOND shared-workplace pair after
  Phase 13's chapel; pattern confirmed). Kit: K1 scholarly. Giver: **Wren
  Waterwise**, closing her pond-chain arc (quests 2 → 15 → now).
- **Buildings/builds:** **Sunken Chapel** (new building: size 2, cost wood 160 gold
  140 plate 8, `workplace: tidecaller`, aura: `heal` +1.0 AND food +0.5/s — first
  DUAL-aura building; both keys already exist in `auras()` output — no new key).
  Requires Chapel tier 3 AND Deephole tier 2 (first dual-building gate).
- **Weapons/armor/gear:** **Tidebell** (`["tidecaller"]`, `{healAura: +0.5,
  food: +0.3}` — mirrors the dual building) + **Diver's Plate** (armor slot,
  collectors, `{armor: 0.2}` — plate-cost armor for the water line).
- **Unlock cadence:** Quest 21 `what-the-water-kept` (task: `upgrade` deephole→2)
  → +150 XP (total 2440) + Sunken Chapel unlock + Tidebell. Level 10 check:
  propose **level 10 at 2400 XP** — lands on THIS quest's completion (fanfare
  moment engineered); payout = Sunken Chapel tier 2 (heal +2.0 / food +1.0).
- **Builds on existing systems:** dual-aura output shape, building-gate pattern
  (now with two parents — AND-gate, contrasting Phase 16's OR-gate),
  shared-workplace precedent, water-line economy.
- **Pitfalls:** P1 — new. P2 — level 10 ships with chapel-2 payout. P3 —
  deephole-2 needs the Phase-8 line built out. P4 — K1 role kit. P5 — Wren's
  farewell log; water arc closed.

## Phase 19 — Warden-General (Act VIII)
**Theme:** the stakes answer — from RESET_HANDOFF's "zero lasting stakes" note,
  the penultimate phase gives raids teeth *by player consent*.

- **Characters/troops:** new combat: **`Warden-General`**? No — new SYSTEM on an
  old friend: any level-20+ **Warden** (`troops.json`: hp 210, the tank) may take
  the **`Last Watch` oath** (voluntary flag: +50% damage, +50% armor, but falls
  permanently if it falls — first **opt-in permadeath**; impl flag in post-raid
  revive logic which today revives everyone at 30%). Plus new troop **`Squire`**
  (role: combat, hp 100 / dmg 10, kit C1; the Warden pipeline: Squires assigned
  near Wardens level 25% faster — `tutor`-adjacent effect, impl flag). Giver:
  **Bell-Captain Sorrel** (Phase-11 arc payoff).
- **Buildings/builds:** **Cairnfield** (new building: size 2, monument; lists every
  fallen oathbound by name — reads the death record the oath system must now
  keep; the P5 anti-toast rule made physical: the fallen persist ON THE MAP).
  Cost: wood 60 only (grief should be cheap; the oath is the price).
- **Weapons/armor/gear:** **Oathkeeper Armor** (armor slot, combat, `{armor: 0.25,
  damage: 1.1}` — best-in-slot, costs plate 12 + gold 800; requires an oathbound
  Warden in the roster to purchase — first roster-gated gear) + **Squire's Blade**
  (`["squire"]`, `{damage: 1.1}`, cheap starter).
- **Unlock cadence:** Mission 13 `the-longest-night` (requires `the-pale-court` +
  one banner mission — AND-gate reuse) — hardest raid in the game (3 waves,
  steep `scaling`, troop limit 9 — new high). Victory → unlocks **`squire`** +
  oath system + Cairnfield. Defeat ceremony names the design intent ("the night
  outlasted" callbacks to `long-night`).
- **Builds on existing systems:** revive-at-30% rule (oath carves the exception),
  wave scaling (Phase 11), troop limits, ceremony text, warden tank stats.
- **Pitfalls:** P1 — new. P2 — untouched. P3 — N/A (survival mission). P4 — Squire
  takes C1 role kit (melee-control); the oath is a flag, not a kit. P5 — Cairnfield
  IS the persistent record; Sorrel log.

## Phase 20 — Dawn of the Manner (Act VIII)
**Theme:** the finale — every system in the doc fires at once, and the village
  earns its name. Dawn breaks over the Manner.

- **Characters/troops:** no new troop. **Every giver returns**: Issa, Tomm, Maro,
  Sarella, Fen, Wren, Pella, Sorrel, Rue, Tam, Old Bell, the Pale Envoy — the
  final quest text is a roll-call (each gets one line; their log entries link).
  The player's **oldest villager** (by roster index) is named **Moonwarden** in
  ceremony (reads roster order — no new data).
- **Buildings/builds:** **Dawn Gate** (new building: size 3, cost one of EVERYTHING
  incl. frostwood 100 + plate 20 + gold 1000 — the whole-economy sink; aura:
  village-wide +0.05 every aura key — the "everything engine," capped by the
  existing `auras()` caps so it can never break the sim). Placement: center map
  (ceremonial; impl suggests reserving (9,7)-adjacent at 20×17+ map).
- **Weapons/armor/gear:** **Moonwarden's Regalia** (armor slot, any role,
  `{armor: 0.2, all-auras: +0.02}` — the only all-aura gear; equippable ONLY by
  the named Moonwarden — first unit-gated gear) + **Dawnbringer** (weapon, any
  combat role, `{damage: 1.5, range: +0.5}` — best-in-slot, costs starforged +
  plate 10: the reforge line (Phase 17) feeds the finale).
- **Unlock cadence:** Quest 22 `dawn-of-the-manner` (task: new kind `wonder` —
  Dawn Gate built AND standing; arrival-impossible) + Mission 14 `dawn` (requires
  `the-longest-night`; final 4-wave siege, troop limit 10, all raid tech on) —
  **quest and mission complete together** (first dual-finale; either order counts,
  combined ceremony). Rewards: Regalia + Dawnbringer + credits ceremony. Quest XP
  +200 → grand total 2640; **level 11 at 2600** proposed with payout = the
  credits + New-Game+/prestige-village option (impl-flagged, out of scope but
  named so the ladder's top rung is never cosmetic again).
- **Builds on existing systems:** everything — auras caps, starforged line, oath
  record (oathbound dead are honored in ceremony), calendar (finale occurs at
  "dawn" season if the Dial is set — crossover), trader/rumor/legend flavor.
- **Pitfalls:** P1 — all new. P2 — level 11 ships with its payout (NG+ option).
  P3 — `wonder` + final siege can't auto-fire. P4 — no troop. P5 — the roll-call
  IS the log payoff. P6 — dual-finale (quest+mission) is the last new shape.

## Appendix A — New ability table (proposed)
Role kits replace the single universal kit. Rule: **troops share kits only within
their role** (C=combat, G=collector/gatherer, K=keeper/scholarly+mercantile, B=builder).
Slot positions (5/10/15/20/25) stay — `unlockedAbilities()` in `model.js` reads
`troops[type].abilities` generically, so new ability IDs only need `abilities.json`
entries + combat/economy handler support (impl flags marked *).

| Kit | Role | L5 | L10 | L15 | L20 | L25 | First used |
|-----|------|----|-----|-----|-----|-----|------------|
| C1 | melee-control | brace* (spear-wall: +range 1 rnd) | armor | rally* (nearby +10% dmg) | veteran | phalanx* (adjacent allies +armor) | Ph5 Pikewoman |
| C2 | heavy | bulwark* (taunt-resist) | armor-ii* (0.35) | oath* (active taunt) | veteran | unbroken* (once-per-raid 1hp survive) | Ph11 Oathsworn |
| C3 | skirmish | volley* (splash like cleave, ranged) | keen* (+crit 15%) | camouflage* (first-strike bonus) | veteran | arrowstorm* (volley ×3, 30s cd) | Ph15 Longbowman |
| G1 | gatherer | swift (+speed) | sturdy (+hp) | rich* (+carry) | harvest-lord* (+gather 0.3) | master* (+workplace aura) | Ph6 Woodward |
| K1 | scholarly | focus* (+workplace aura 0.05) | armor | mend* (passive small heal) | veteran-x* (+aura 0.05) | sage* (+xp trickle) | Ph3 Apprentice |
| K2 | mercantile | haggle* (+trade 0.05) | armor | appraise* (trader offers improve) | veteran-x* | monopolist* (market 2nd offer) | Ph10 Haggler |
| B1 | builder | brisk (+build speed) | sturdy (+hp) | discount* (-cost 0.05) | foreman* (+crew speed) | master-builder* (+tier-4 access assist) | Ph7 Smelter |

Old-kit mapping (existing 21 troops): combat keeps cleave→volley-equivalents via C1
(warrior/archer/warden/ranger migrate to C1/C3 by range), collectors→G1, keepers→K1
(scholar/scout/healer/smiths) except haggler-line→K2, builders→B1. Migration is a
data edit to `troops.json` `abilities` fields (draft-stage; impl does it with the
PATCH_SET ability-table patch as baseline).

## Appendix B — Unlock cadence summary
| Phase | Gate type | Gate | Unlocks granted | XP Δ | Quest-XP total |
|-------|-----------|------|-----------------|-----|---------------|
| 1 | quest (gather) | Q9 gold 400 | Orrery, L6 map row, L7 scriptorium-3 | +150 | 860 |
| 2 | quest (upgrade) | Q10 pasture-2 | Crook, Basket, growth +2 types | +130 | 990 |
| 3 | level + quest (pop) | L5 / Q11 pop-10 | Longhouse, Apprentice, Apron, Coat | — | 990 |
| 4 | quest (double upgrade) | Q12 forge-2 + armory-2 | 1-of-5 keeper tools (choice) | +140 | 1130 |
| 5 | mission branch | M07 xor M08 (requires: last-stand) | pikewoman ⟷ stonewall | — | 1130 |
| 6 | level + quest | L6 / Q13 frostwood | Frostgrove, Woodward, Frostaxe (L7 lands) | +150 | 1280 |
| 7 | building-chain + quest | smeltery←frostgrove-2 / Q14 plate 10 | Smeltery, Smelter, 3 armors | +140 | 1420 |
| 8 | quest (upgrade) + quest-unlock | Q15 pond-3 | Deephole, Diver, Net, Oilskin | +130 | 1550 |
| 9 | quest (upgrade) + quest-unlock | Q16 mine-3 | Emberglass, Sapper, Glasspick, Ward | +140 | 1690 |
| 10 | mission (converge) | M09 (requires: 07 xor 08) | market, haggler | — | 1690 |
| 11 | mission | M10 (scaling debut) | oathsworn, Oathblade, Tower Shield | — | 1690 |
| 12 | quest (defeat-flawless) + level | Q17 / L8 (1500) | Fire Trap, tower-4, watchfire-3 | +150 | 1840 |
| 13 | quest (assign) + completion-unlock | Q18 assign-4 | Chorister, Hymnal, Choir Robe, Bellcote | +140 | 1980 |
| 14 | quest (recruit) + tier-gate | Q19 3×apprentice / school-2 | Schoolroom, Primer, promotion, Master's Ring | +150 | 2130 |
| 15 | mission branch (doctrine) | M11a xor M11b (delayed merge) | halberdier+halberd+fletcher ⟷ longbowman+longbow+yard | — | 2130 |
| 16 | mission (OR-gate) | M12 (requires: 11a OR 11b) | other banner mission, Moon Dial, Envoy's Gift | — | 2130 |
| 17 | level + quest (prestige) | L9 (2100) / Q20 prestige-×1 | Bell Tower, prestige, starforged reforge | +160 | 2290 |
| 18 | quest (upgrade) + level | Q21 deephole-2 / L10 (2400) | Sunken Chapel (+2), Tidecaller, Tidebell | +150 | 2440 |
| 19 | mission (stakes) | M13 (requires: pale-court + banner) | squire, oath system, Cairnfield, Oathkeeper | — | 2440 |
| 20 | dual finale | Q22 wonder + M14 dawn | Dawn Gate, Regalia, Dawnbringer, L11 (2600, NG+) | +200 | 2640 |

Gate-type rotation: no gate type fires more than twice in a row; every level
ships with a named payout; every mission showcases what it unlocks (same-mission
rule from Phase 5 on); no quest gate is satisfiable from arrival-state arithmetic.
