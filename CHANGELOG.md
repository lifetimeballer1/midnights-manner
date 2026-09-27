## 0.3.0 — A village from every angle

- Original low-poly buildings, connected walls, trees, villagers, raiders, and placement previews replace fixed-angle map sprites.
- Full 360° orbit, adjustable tilt, touch twist, desktop orbit controls, and three view presets.
- Ground placement, selection, and defense ranges follow the camera angle; saved villages remain compatible.
- Resource sounds play when collecting or when storage first fills, with simultaneous fills combined into one chime.

## 0.1.3 — Resource clarity and mobile finish

- Original wood, food, gold, frostwood and plate icons replace tool placeholders in the resource HUD; labels remain visible on phones.
- Collection bubbles and floating income name their resource. Touch targets stay a readable size and avoid overlap where space allows.
- Resource totals open a stores panel with per-building bonus collection.
- Build and People menus gain search; Adventure separates expeditions, quests, trading and lore.
- Polished HUD, cards, equipment rows, workplace controls, building inspector, settings, raid feedback, and portrait/landscape spacing.
- Includes the pending safe Home Screen update controls and the building-inspector merge fix.

## 0.1.2 — Home Screen updates

- Fixed a current-main merge regression that referenced wall-row controls before initialization and broke building selection; retained the Cairnfield memorial panel.
- Settings now includes Check for updates and Save & refresh, with a map notice when a build is ready.
- Refresh persists the village first and cancels on storage failure; updates wait for a player click.
- Built games check on resume and every five visible minutes, with offline/download failure feedback.
- Content-based, scope-specific service-worker caches detect code/data/art changes without manual version bumps and keep complete builds together.

## 0.1.1 — All-side raids and wall controls

- Home, test and campaign raids enter from rotating perimeter sides; four-or-more raiders cover all four sides. Countdown warnings list the sides.
- Dragging in wall build mode previews a connected straight row with a combined cost; confirmation builds the whole line or nothing.
- Build/Move previews slide with one finger; two fingers pan and zoom. Release never commits a build or move. Relocation previews preserve the current tier.
- Connected timber/stone wall rows can upgrade along either grid axis with a combined price and all-or-nothing affordability check. Gaps stop a row; unavailable segments are skipped.
- Unreachable defenders no longer keep raiders idle beside a wall; adjacent barriers can be breached.

# Midnights Manner — Extended Pass Changelog

## 20-phase: Act VIII Legends (2026-09-26)

Applies NEXT20_DESIGN.md Phases 16-20, the finale. Verify: `npm test` (see box output below), `npm run build` green - both on the free EC2 box per Jesce's standing rule (never on this PC). Save version 5 -> 6 (`migrateV5toV6` backfills prestigeStars 0, oath false, fallen [] on world+home; gear, resources, buildings, troops and progress untouched). NOTE: the contracting brief believed only Act VII phase 11 had landed; the working tree at 064239b already held phases 11-15 in full, so this act is phases 16-20 only.

- Ph16 Pale Court: Mission 12 `the-pale-court` (chapter 12, limit 8, 2 raids; `requiresAny: [red-banner, grey-banner]` - REUSES the Phase-10 generic OR-gate, no second mechanism) clearing unlocks the other banner mission path + Moon Dial + Envoy's Gift + grey Banner Cloak. Moon Dial (size 1, gold 150 + frostwood 80, `moonDial` + `maxPerVillage: 1` generic one-per-village flags; locks the raising day's calendar season at half strength via data/calendar.json effects, known aura keys only). Envoy's Gift (armor-slot, all keepers, armor 0.15 + armor-hand `xp` 0.03 pour read generically in auras). Pale Envoy giver with log quoting the new 6th legend (`pale-court` - first legends.json progression use, additive).
- Ph17 Prestige of the Bell: `Game.prestige()` (L25 troop -> L1, gear+kit kept, +1 star +5% all stats via `stats()`, max 3, oath cleared) + Bell Tower (size 2, wood 200 / gold 200 / plate 10, `minLevel: 9` - NEW village level 9 at 2100 XP with food/gold/plate payout; `prestigeAura` doubles starred veterans' aura share) + Starforged reforge line (`Game.reforge()`: oathblade/halberd/longbow -> starforged- prefix, +15% main stat, plate 5 + gold 500 - first vertical gear progression, generic prefix read off `data.items`, no per-weapon code). Quest 20 `the-bell-remembers` (new `prestige` task kind: one starred veteran; +160 XP -> 2290; Old Bell's farewell log). **[ADAPTED]** Dawnbringer costs gold 800 + plate 10 instead of consuming a starforged piece (no consume-reforge mechanic; the reforge line feeds it thematically through the plate sink).
- Ph18 Sunken Chapel: Tidecaller keeper (K1 scholarly kit attune/armor/mend/veteran-x/sage on handled effects only; `tide` job rate 0.5 pours food at its chapel or any `hosts` water - deephole + pond both declare `hosts: [tidecaller]`, Phase-13 shared-workplace pattern) + Sunken Chapel (size 2, wood 160 / gold 140 / plate 8, `requiresBuildings: [chapel-3, deephole-2]` - new generic AND-gate in `build()` + shop read-through, contrasting the mission OR-gate; dual-aura heal + `foodAura` 0.5 via existing keys, tier 2 doubles) + Tidebell (healAura 0.5 + foodAura 0.3) + Diver's Plate (armor 0.2, water-line plate sink). Quest 21 `what-the-water-kept` (deephole->2, +150 XP -> 2440; Wren's farewell). NEW level 10 at 2400 XP with food/gold/frostwood payout.
- Ph19 Warden-General: `Game.takeOath()` (L20+ warden-line troop via data `oathbound` flag: +50% damage in `stats()`, +0.25 armor in combat under the 0.8 ceiling) + opt-in permadeath carved in post-raid revive (oathbound fallen stay fallen, names go on `world.fallen`; the unsworn still rise) + Cairnfield (`cairn` flag monument, wood 60, lists the fallen on the map + inspector roll) + Oathkeeper Armor (`requiresOath` roster gate in `equip()`: best-in-slot armor 0.25 + damage 1.1, plate 12 + gold 800) + Squire's Blade + Squire (C1 kit brace/armor/rally/veteran/phalanx, recruit 30/15). Mission 13 `the-longest-night` (chapter 13, limit 9, 3 waves with scaling, requires pale-court AND one banner road; unlocks squire + blade + cairnfield + oathkeeper + dawn-gate build right). Sorrel payoff log. **[ADAPTED]** Dawn-gate *build right* arrives at M13 victory while Quest 22 still demands the *standing wonder* (earn the right, then pay the cost) - the quest gate stays arrival-impossible.
- Ph20 Dawn finale: Dawn Gate (size 3, one-of-everything cost, `dawnAura` 0.05 every key under existing caps, `maxPerVillage`) + Moonwarden's Regalia (`requiresName: Moonwarden` unit gate in `equip()`, all-keeper roles, armor 0.2 + `allAura` 0.02 read off both hands) + Dawnbringer (all-combat roles, damage 1.5). Quest 22 `dawn-of-the-manner` (new `wonder` task kind: dawn-gate built AND standing; +200 XP -> grand total 2640; giver roll-call of all 11 predecessors in text+log) + Mission 14 `dawn` (chapter 14, limit 10, 4-wave final siege, `crowning: Moonwarden` names the eldest unnamed roster hand on first victory - dual finale, either order). NEW level 11 at 2600 XP with credits + named NG+/prestige-village option payout.
- Test-fix judgment (mine): the box's 17 failures split 2 code-side, 15 test-side. Code earned: `deephole`/`primer` literals scrubbed from src comments (the act6/act7 no-hardcode guards scan comments too - data flags, never ids, even in prose). Tests owned: pre-war quest-total filters now exclude act VIII alongside VII (1690 pinned); story counts 19->22 / 12->15 / legends 5->6 + VIII index pins; troop 31->33 / mission 12->15 counts; migration asserts to v6; village quest-kind allowlist +`prestige`/`wonder`. New `tests/act8.test.js` (20 checks: OR-gate, dial lock-in + one-per-village, armor-ink pour, prestige flow/cap/tower-gate, reforge math, dual gate, hosted pour, oath gating + cairn roll, roster/unit gates, gate engine + caps, crowning, viii totals + guard + old-save quiet).
- Deferred with reasons: hard 11a/11b first-clear mutex (unchanged from Act VII - soft cross-grant + OR-gate pacing stands, nothing strands); armor paper-doll (pre-existing); trader-offer timer + market tier-2 (pre-existing, system-level); NG+/prestige-village loop itself (named as the level-11 payout, out of scope by design); Dawnbringer range is absolute 5.5 (spec sketched +0.5 - data-flat best-in-slot kept simple).
- Pitfalls per phase: P1 new SKUs only, all resolve + start locked (act8 suite pins every grant); P2 L9/L10/L11 ship payouts (tower access / chapel stores / credits + NG+ road); P3 prestige/wonder/flawless-adjacent gates read zero at arrival; P4 role kits only (K1/C1 reuse), no content ids in src (pinned, comments included); P5 Envoy/Old Bell/Wren/Sorrel/Issa logs persist, legends quoted, cairn roll on the map; P6 OR-gate merge + dual finale close the diamond.

## 20-phase: Act VII Oath (2026-09-26)

Applies NEXT20_DESIGN.md Phases 11-15. Verify: `npm test` 207/207, `npm run build` green (212 precached) - both on the free EC2 box per Jesce's standing rule (never on this PC). No save-version bump (still v5 - flawless/promoted/wear/stock/inRaid all tolerate missing keys, all changes additive or data-only). Merged over upstream's workplace-architecture-preview (one ui.js conflict, resolved by keeping both: worker-count assign button + yard service button).

- Ph11 War Band: Oathsworn (260/18, second C-kit: bulwark/armor-ii/oath/taunt-active/veteran/unbroken, recruit 60/45 - heaviest yet) + Oathstone (proximity armor aura 0.1/radius 3 via new generic `proximityArmor()`, NOT a workplace) + Oathblade (1.3/1.1) + Tower Shield (armor 0.2, speed stored 0.9 - the Act VI oilskin x1.1 precedent). Taunt pulls enemies generically in targeting; unbroken survives one killing blow per raid (flag resets on raid-end). Mission 10 `the-pale-host` (requires coin-and-cinder, `scaling: {hp 18, damage 3}` - new generic per-mission wave-steepening in `spawnRaid()`, home curve untouched; limit 8; Sorrel in all three ceremony lines; unlocks oathsworn+oathblade+tower-shield+oathstone).
- Ph12 Siege Engine: Fire Trap (60 damage + burn 4/3s via generic tier `burn`/`burnDuration`, first DoT) + Tower-4 (65/5.2, `tierGates {4: 8}`, tier-4 costs 2x via `buildingCost()`) + Watchfire-3 (30/6.5, gated 8) + Siege Tongs (buildSpeed 1.5, `trapDamage` 0.2 sharpening every defense via generic `siegeBonus()`) + Ashen Cloak (armor 0.12, burn-resist 1.0; troop-burn math live and pinned, no enemy source yet - documented like pre-market trade auras). Quest 17 `rue-s-terms` (new `defeat` task kind: flawless raid = zero building losses, home+away ledgers merged on return; +150 XP -> 1840). Level 8 at 1500 XP lands on Rue's terms and pays tier-4 access + food/gold cache. Rue + pale-host rumors open the notice board's first progression use.
- Ph13 Second Choir: Chorister (K1 full track, chapel/chorus job - shared workplaces stack generically in `auras()`, healer+chorister mend 3.0/s) + Chapel-3 (heal x3, `tierUnlocks: {3: [bellcote]}` - new generic building-completion unlock in `upgrade()`, 3rd unlock data point) + Bellcote (revive 50% via generic `reviveFraction()`, cold ground stays 30%) + Hymnal (healAura 0.8) + Choir Robe (armor 0.12, flat heal 10 read generically off armor-slot gear). Quest 18 `voices-in-the-dark` (assign 4, +140 XP -> 1980; Old Bell's log).
- Ph14 Master & Apprentice: `promotions` data on apprentice + `promotionOptions()` (cap 15, posted, tier-2 school) + `Game.promote()` (level 5 keeper, kit kept, gear reissued when the old tool doesn't fit, `promoted` flag = +10% aura share) + Schoolroom (xpRate 0.06, tutorDiscount 0.34) + Primer (flat `xp` 0.03 pours via auras) + Master's Ring (first % aura gear, 0.05, read off BOTH hands in `share()`). New generic `hosts` field (`assignmentValid()` + auras crew + both UI panels) lets apprentices post at the school - posting law intact, no exceptions. Quest 19 `tam-s-school` (recruit 3 apprentices - completable with zero Act VII content owned, the school's whole point; +150 XP -> 2130; Tam's log). **[ADAPTED]** Roads fork at the school (cottage->healer, schoolroom->healer/haggler), not at market/scriptorium postings - assignment law forbids those postings, so the graduate chooses at Tam's school instead.
- Ph15 Doctrine Fork: Halberdier (C1 reused end to end) + Longbowman (first C3: volley/passive-splash, keen, camouflage, arrowstorm/active-splash via new generic active-splash branch in `activateAbility()`) + Halberd/Longbow (longbow shared across 3 troops)/Banner Cloak + Fletcher (arrowBuff 0.15 damage for bows, one bundle per 120s, spent only when bows walk the map) + Shieldwall Yard (wear dulls armor 1/raid, halves at 3 via `gearArmor()`; manual `serviceArmor()` 20 wood + free auto-service on victorious returns). Missions 11a/11b `red-banner`/`grey-banner` (both require the-pale-host, limit 8, cross-grant mirror troop + shared cloak - showcase/recruit separated by design; NO permanent lock, the Phase-16 OR-gate formalizes the choice; raids-test dupes scoped to the documented pair).
- Test-fix judgment (mine): box-round failures split 4 code-side, 6 test-side. Code earned: `hosts` posting, armor-hand aura share, auras hosted-crew filter, no-waste Fletcher. Tests owned: oathblade baseline draws steel (stats assumes fitted gear), tower cost isolated from crew discount, chapel-stack strips hymnals, Fletcher starts via `g.mission()`, gearArmor returns the reduction (direction), returnHome needs a standing expedition. Old-suite allowlists extended, never frozen: quest kinds +`defeat`, handled effects +`taunt`/`unbroken`, workplace hosts-back rewritten for shared lines + hosts.
- Deferred with reasons: hard 11a/11b mutex (needs the Phase-16 OR-gate + re-unlock; soft cross-grant ships the pacing with nothing stranded); enemy burn source (Ashen math live, source doctrine later); armor paper-doll (pre-existing); trader-offer timer + market tier-2 (pre-existing, system-level).
- Pitfalls per phase: P1 new SKUs only, all 21 locked until earned (raids-test pins every grant); P2 L8 pays cache + tier-4, no map row (EXPANSION clamp holds 20x17); P3 flawless ledgers start at 0, arrival never auto-fires; P4 role kits only (C2/C3), no troop/item ids in src (pinned); P5 Rue/Old Bell/Tam logs persist; P6 both banners playable, nothing strands.

## 20-phase: Act VI Wilds (2026-09-26)

Applies NEXT20_DESIGN.md Phases 6–10 (docs/NEXT20_DESIGN.md now lives with the game). Verify: `npm test` 160/160, `npm run build` green (186 precached) — both on the free EC2 box per Jesce's standing rule (never on this PC; box recipe: `export PATH=$HOME/node-v22.17.0-linux-x64/bin:$PATH`). No save-version bump (still v5 — frostwood/plate tolerate missing keys, all changes additive or data-only).

- Ph6 Frostwood Treeline: Frostgrove (size 2, frostwood production, reserve 400, workplace woodward, 2 tiers, minLevel 6) + Woodward collector (120/10, frostwood, carry 14, frostaxe, G1 kit mapped to existing handlers) + Frostaxe + Winter Coat (armor-slot gather merges generically in the collector loop — main-hand-only reads would have left it a dead stat). Quest 13 `west-of-the-chalk` (150 frostwood, +150 XP → total 1280 = Level 7 through quests alone; unlocks woodward+frostaxe, else the recruit dead-locks). Sprites are frost-dusted variants, not reuses (the unique-name guard stays).
- Ph7 Hide & Plate: Smeltery (plate 0.6/s via `job.resource`-generalized produce, `requiresBuilding: {frostgrove, 2}` — new generic chain gate in `build()` + shop) + Smelter (B1 builder kit debut) + Iron Cap / Studded Vest / Knight's Plate (plate costs — the first plate sink). Quest 14 `first-pour` (plate 10, +140 XP → 1420). **[JUDGMENT]** Armor stays multiplicative via `gearArmor` under the existing 0.8 combat ceiling (the spec's 0.6 noted; the game already caps harder).
- Ph8 The Deep Pond: Deephole (food 2.2, reserve 350, requiresBuilding pond-2) + Diver (G1, job haul) + Pond Tier 3 + Weighted Net + Oilskin Coat (speed stored ×1.1 — `stats()` multiplies armor speed, so 0.1 would collapse it). Quest 15 `down-dark-water` (pond→3, +130 XP → 1550, Wren's arc continues).
- Ph9 Emberglass Mine: Emberglass (gold 2.4, reserve 500, requiresBuilding mine-2) + Sapper (G1, job cut) + Glasspick + Ember Ward (armor-slot damage read-through added generically in `stats()` — without it the 1.05 would be dead data). Quest 16 `glass-under-stone` (mine→3, +140 XP → 1690, Pella's blessing arc continues). **[ADAPTED]** Mine Tier 3 already existed in baseline (3 tiers + sprite on disk; the doc assumed two) — no edit, pinned by test instead.
- Ph10 The Wild Market: Market (size 3, workplace haggler, tradeAura, forge/armory pattern) + Haggler (K2 mercantile kit: haggle/appraise as `aura` 0.05 — no trade-offer handler exists, documented in-test) + new `trade` aura key (cap 0.3, min(.3) with the others) + Merchant Scales (tradeAura read-through via the pair list) + Coinmail (first discount armor; armor-slot discount reads generically in `builderBonuses()`, 0.5 ceiling intact). Mission 09 `coin-and-cinder` (`requiresAny: [ashen-ford, hollow-dam]` — new generic OR-gate in `missionLocked()`, the branch→diamond reconverges; gold 250 + frostwood 150, troop limit 7, Sarella named in all three ceremony lines).
- Test-fix judgment (mine): the box's 4 failures were all test-setup bugs — game code untouched. Chain-gate pin allowlists deephole/emberglass (2nd/3rd data points); pond/mine tests complete construction (`remaining = 0`) between stacked upgrades (`upgrade()` refuses stacked work by design); coinmail baseline sends the hammer-carrying starting roster home (its 0.05 was always real).
- Deferred with reasons: trader-offer timer + market tier-2 second offer (`traders.json` has no progression reader — system-level, Act VII/VIII); Emberglass 0.4× reserve floor (needs a data field + economy read, later); mission Unlock-line troop names render undefined (pre-existing cosmetic gap, pikewoman already had it).
- Pitfalls per phase: P1 new SKUs only (armors are shop-open but frostwood/plate-cost-gated — unbuyable before the treeline); P2 no levels touched (L7's Act V payout lands here through quest XP); P3 frostwood/plate banks start at 0, tier-3 costs are real walls; P4 role kits only (G1/B1/K2), generic read-throughs, no troop names in src/ (pinned by test); P5 Fen/Maro/Wren/Pella/Sarella logs persist; P6 Mission 09 closes the diamond.

## 20-phase: Act V Foundations (2026-09-26)

Applies NEXT20_DESIGN.md Phases 1–5 (docs/NEXT20_DESIGN.md now lives with the game). Jesce approved the full plan; where main had already moved past the doc baseline, the plan ADAPTED — never reverted. Verify: `npm test` 123/123, `npm run build` green (153 precached). Save version 4 → 5 (armor wardrobe backfill only).

- Ph1 Scriptorium's Due: world 20×16 → 20×17 with a 5th EXPANSION row (L6 payout); Scriptorium tier 3 observatory gated by `tierGates: {3: 7}` (new generic level-gated-tier mechanism in `upgrade()` + inspector); Scholar's Orrery (first keeper gear with real stats: survey ×1.25, +0.06 XP/s) earned via Quest 9 `chart-the-dark` (gather gold 400, +150 XP — quest XP total 860, L6 reachable through quests); quests gain generic `unlocks` (mirrors missions) and `log` (Chart Log panel in Tales of the Frontier — Issa's record, not a toast). Keeper-gear read-through in `auras()` (survey mult, xpAura/xpMult, aura-key flat adds; empty-stat tomes behave exactly as before).
- Ph2 The Second Trade: new `upgrade` task kind (`{kind, type|string|array, level}`) in `taskDone`/`questProgress`; Quest 10 `tomm-s-flocks` (pasture→2, +130 XP, unlocks Herding Crook + Berry Basket — buyable at scythe-band costs once earned); Tomm the herder graduates from flavor mention to giver + log. **[ADAPTED]** The doc assumed a 4-type growth monopoly; main already runs an 18-type rotation including shepherd/forager, so no growth change was needed.
- Ph3 Beds for Dozens: Apprentice troop (keeper, maxLevel 15 — first lower cap, cottage/welcome job) debuting the K1 kit (attune/aura-share, armor, mend/passive-regen; veteran-x + sage /xp-trickle/ defined for later K-tracks); `beds` aura key (+1/welcome hand, gear stacks, +3 cap) read in `housing()`; cottage tier 3 (16 beds) + `workplace: apprentice`; Longhouse (14 beds, `minLevel: 5` — new generic level-gated-building mechanism in `build()` + shop); Hearth Apron (beds+1); Padded Coat on a real second gear axis (`slot: armor`, `armor`/`armorOwned` unit fields, `gearArmor()` multiplicative helper, combat reads it under the 0.8 ceiling); Quest 11 `open-doors` (pop 10, unlocks apprentice; recruit() now honors locks). Save v5 backfills empty wardrobes. **[JUDGMENT]** Armor stacks additively into the existing reduction sum for now; the full multiplicative-capped-0.6 doctrine lands with Phase 7's armor economy. Armor pieces have no renderer paper-doll yet (deferred with reason — per-item draw fns needed).
- Ph4 Keeper's Tools: Quest 12 `sarella-s-standard` (forge-2 AND armory-2 via array upgrade task, +140 XP — total 1130, deliberately 20 short of L7) unlocks all five toolkit-band tools; the player's scarce gold picks the ONE (choice-by-scarcity, replay/counter-pick hook). **[JUDGMENT]** A modal choice dialog would be truer to "choice of one" but costs a UI flow; scarcity-choice preserves the design intent with zero new UI. Fixed a real find: main-hand `carry` stats (cart/awl) leaked into the global aura — gear→aura now uses distinct `carryAura` (oiled-awl), per-unit capacity untouched.
- Ph5 The Forked Road: M07 `ashen-ford` / M08 `hollow-dam` share `requires: [last-stand]` (first branch); showcase=unlock on both (ford pre-places stonewall→unlocks pikewoman+pike+kite-shield; dam fields pikewomen→unlocks stonewall; neither grants tower). Pikewoman debuts C1 (brace/range-drill, armor, rally/damage-drill, veteran, phalanx/guard-aura) on a new generic transient-buff system (`u.buffs`, `buff`/`guard` ability effects, UI casts any active); Pike + Kite Shield (armor 0.15, HP+20 — gear HP/speed read-through in `stats()`); Stone Wall 520/1040/1560 with data-driven `repeatPlace` (palisade converted to the same flag, behavior unchanged).
- Deferred with reasons: full Appendix-A migration of the 20 old troops to C/G/K/B kits (old kits are already role-differentiated; new troops debut new kits; migration stays optional polish, never a blocker); Q11 "branching" is gate-independence (the quest engine auto-claims in file order — pop-10 never depended on gold-400, which is the doc's actual requirement).
- Pitfalls per phase: P1 new SKUs only (no tower grants anywhere); P2 every touched level ships a payout (L5 Longhouse retroactive, L6 map row, L7 observatory); P3 no arrival-satisfiable gates (gold-400, tier-2s, pop-10, flawless-gated later); P4 no kit clones (C1/K1 debut); P5 persistent giver logs (Chart Log pages for Issa/Tomm/Old Bell/Sarella); P6 branch itself is the fix (shared prerequisite, either road qualifies).

## Progression fixes — DeepSeek review (2026-09-26)

Credit: the 7 findings below come from the DeepSeek progression review. Choice on #1 was payouts over re-tuning: thresholds stay put (market opens at L2, expansion rows, quest pacing and old saves untouched) and levels 5–7 now pay data-driven caches instead.

- 1. XP ladder: new `data/levels.json` (loaded in `main.js`, granted in `tickVillage`). L2 +30 wood, L3 +40 food, L4 +60 gold, L5 +100 wood/+80 gold, L6 +150 food/+120 gold, L7 +200 wood/+150 food/+200 gold. Quests total 710 XP (level 5); 6–7 are now earned through scholars, surveys, traders and growth, not empty. Multi-level jumps grant every skipped level. Old saves keep their level and claim nothing retroactively — no dupes, no migration.
- 2. Role kits (`data/troops.json`, 7 new `data/abilities.json` entries reusing existing effects only — no new handlers): combat = cleave/armor/heal/veteran/warlord; collectors = haste/ward/steady-hands/second-wind/harvest-master; keepers = second-wind/ward/heal/armor/focus; builders = ward/steady-hands/second-wind/haste/armor. No splash outside combat, no big damage outside combat. New abilities: ward (armor 0.15), second-wind (heal 12, 15s), steady-hands (gather 0.15), harvest-master (gather 0.35), warlord (damage 0.5), focus (damage 0.15). Combat keeps heal at 15 so the existing active-heal test still holds.
- 3. First reward: `first-harvest` now unlocks `trap` (was the free `tower`). One line; new players meet traps before the chapter-2 raids. `timber-line` still lists `trap` too (duplicate is harmless — unlocks merge by Set) — deliberately left for a later pass to re-deal chapter-2's unlock.
- 4. Unlock swap: `ember-road` (showcases a watchfire) now unlocks `watchfire`; `moonwell` (pre-places a grove + forager) now unlocks `grove`.
- 5. `east-field`: was `reach level 3` (auto-done at level 4). Now `gather 100 wood` — undone work with the same frontier-clearing teaching intent. `game.test.js` tower-unlock assertion updated to trap; quest-chain compat tests untouched.
- 6. Starvation no longer hard-resets `childTimer` to 0 — it decays at the same 0.5×/s as bed-blocking, so a short famine never wipes a nearly-grown villager. HUD: village strip shows `🌱 NN%` growth plus the plain-word stall reason (hungry / no free beds / food barely covers mouths / keeping a pantry first) and the next level cache (`🎁`) via new `growthStatus()` in `village.js`.
- 7. Growth rotation widened 4 → 18 (`START_CHILD_TYPES`): indices 0–7 stay food/wood/gold hands (pop-8/12 pacing safe — every birth counts toward population quests), builders/crafters join at 8+, healer at 12, archers/scouts/warriors/scholars after. Deterministic roster-size index, no save impact.
- Verify: `npm test` 93/93 green (7 new `tests/progression.test.js`), `npm run build` green (133 precached). No save-version bump (still v3, no migration — all changes additive or data-only). Balance numbers above are starting points; watch whether L5–L7 caches trivialize the mid-game slowdown before tuning further.

Running log for Jesce's extended autonomous pass. One entry per item. Judgment calls flagged with **[JUDGMENT]** for Jesce's review.

---

## Item 1 — BUG PASS (combat / pathfinding / economy edge cases)
- combat.js: guard `attackTimer`/`abilityTimer` init (`??= 0`) so hand-built or
  migrated units/enemies without timers can't produce NaN cooldowns; guard
  `activateAbility` against missing gear/ability data.
- combat.js: enclosed raiders now chew the adjacent blocking building instead of
  idling forever (fixes walled-in soft-lock; raiders damage the barrier they
  stand next to when `nextStep` returns null).
- combat.js: raid failsafe — `raidAge` tracked; if a raid drags past 240s the
  remaining raiders lose heart and flee (clears soft-locked waves, counts as
  repelled with loot kept, marked `fled:true`).
- economy.js: guard zero/NaN carry capacity (division-by-zero on empty carry
  loads) — capacity floors at 1, fill/room clamped finite; collectors with no
  valid source or hall idle safely instead of NaN-ing resources.
- pathfinding.js: clamp actor/target to grid, guard NaN inputs, return null
  safely when start equals target-in-range; `move` validates speed/dt finite.
- campaign.js: guard missing mission data, clamp elapsed, require `fired`
  array — prevents fixed-step-loop races double-firing raids.
- Regression tests: `tests/extended.test.js` — 4 new tests (barrier-chew,
  zero-carry, stuck-pathfinder, raid-failsafe).
- **[JUDGMENT]** Raid failsafe at 240s is generous on purpose — real raids last
  30-90s; 240s only triggers on genuine soft-locks, never on slow-but-fair
  fights. Flag if Jesce wants harsher (120s) or a loss instead of fled-win.

## Item 2 — SAVE SCHEMA (storage.js hardened, no version bump)
- Verified the village-sim pass already added a v1→v2 migration — extended it,
  did not duplicate. Migration is now a registry (`MIGRATIONS[1]`); future
  schema steps get added as `MIGRATIONS[2]`, etc., never a wipe.
- Unknown future versions now refuse to load (return null → fresh world) rather
  than corrupt saves. `peekVersion()` helper for debugging.
- `localStorage` missing (private mode/tests) or full (quota) falls back to an
  in-memory store so the session keeps working; `persist()` still warns via
  the existing status-strip path when the browser can't keep the save.
- Old troops without `order` migrate to `order:null`. No save bump — still v2,
  all existing player saves load untouched.
- Tests: `tests/storage.test.js` (registry upgrade, future-version refuse,
  fallback save).

## Item 3 — CAMERA + LARGER MAPS (renderer.js, main.js)
- Camera `{x, y, zoom}` (0.5–2x) with `pan`/`zoomBy`/`resetCam`. Projection is
  camera-relative but pixel-identical at defaults, so the 20×16 home map
  looks exactly as before.
- Tile diamonds and sprite sizes scale with zoom; ground loops, edge falloff,
  stream and treeline now derive from `data.world.width/height` instead of
  hardcoded 20×16.
- Input: mouse wheel zooms, WASD pans, +/- zoom, 0 resets. Arrow-key hover +
  Enter placement unchanged (keyboard nav consistent).
- Verified against a synthetic 40×30 world in `tests/camera.test.js` (corner-
  to-corner routing, wall-with-gap routing, project/unproject round-trips
  incl. panned+zoomed). Default `world.json` still ships 20×16 — no giant
  default map.

## Item 4 — TROOP COMMANDS (move-to / attack-target / hold)
- `unit.order = {kind:'move',x,y} | {kind:'attack',targetId} | {kind:'hold'} | null`.
  Orders override autonomy until arrival / target death / resume.
- Combat troops: move ignores enemies en route; attack chases the named raider;
  hold stands and strikes only in range. Collectors obey move/hold (pause
  gathering while displaced). Old saves migrate `order:null` — saves safe.
- UI: click/tap own troop to select (gold ring + order tag), click tile =
  move (dashed leader line), click raider = attack, H or Hold button = hold,
  Resume/Esc clears. Keyboard: arrows+Enter flow unchanged, extended to
  troops.
- Tests: `tests/commands.test.js` (move overrides, attack chases, hold stays,
  collectors refuse attack orders).

## Item 5 — CONTENT (data JSON only, no logic changes)
- Checked the village-sim pass first: 17 troops / 20 buildings / 3 missions on
  main. New content complements, nothing duplicated.
- 3 troops: **Warden** (slow tank, 210 HP, splash), **Ranger** (fragile
  sniper, 5.0 range, fastest), **Forager** (fast food collector bound to the
  Grove). Stat lines all differ — no reskins. Reuse existing gear
  (sword/bow/sickle with roles extended) so no new items needed.
- 2 buildings: **Moonberry Grove** (2×2 food + forager workplace) and **Signal
  Watchfire** (1×1 long-range light defense — outranges the tower at lower
  damage; distinct triangle: tower = damage, watchfire = reach, trap = burst).
- 3 missions: **Ember Road** (04, wood sprint + one late raid), **Moonwell
  Plenty** (05, dual food+gold), **The Last Stand** (06, 3 waves, 5-troop cap).
  Chain: long-night → ember-road → moonwell → last-stand. Grove/watchfire
  added to `locked` so missions meaningfully unlock them; existing saves
  unaffected (they simply haven't earned them yet).
- 7 original sprites via `scripts/content_sprites.py` (same outline/shade
  pass as the base set). Tests: `tests/content.test.js`.
- **[JUDGMENT]** Forager gathers ONLY from groves (`gatherFrom`). Without a
  grove it idles — intended pairing, but flag if Jesce wants a fallback food
  source.

## Item 6 — BALANCE PASS (simulated chapters 1-6, economy note applied)
- Simulated all 6 chapters' objectives in `tests/balance.test.js` — every
  target reachable inside its timer (no soft-locks, quick wins kept).
- Jesce's economy note applied to MID-GAME ONLY, opening preserved:
  passive income ×0.75 and collector fill ×0.85 once `elapsed > 300s`;
  upgrades after 5 min take ×1.5 longer; tier-3 costs ×1.5; troop training
  L6+ costs ×1.5. New construction (4–6s), tier-1/2 costs, L1–5 training and
  all mission targets untouched.
- **[JUDGMENT — TENSION FLAGGED]** The earlier fun pass sped up the first 5
  minutes on purpose; this pass slows everything after it. The 300s cliff is
  a step (full → 75%), not a curve — a sharp-eyed player may feel the
  downshift at minute 5. If Jesce wants, replace with a gradual ramp
  (e.g. lerp 1.0→0.75 over minutes 5–10). Chose the step for simplicity and
  testability; easy to smooth later.

## Item 7 — VISUAL/UI POLISH (time-boxed, gaps only)
- Checked main: prior visual passes + pro-art worker cover palette, density,
  chrome and phone layout. Filled two genuine gaps only, left the rest:
- Title screen (`index.html` overlay + styles + boot dismiss) — the game
  previously dropped players straight into the village with no landing.
  Cosmetic only; sim runs behind, no logic touched.
- Death poof particle on slain raiders + troop order markers (selection ring,
  move leader-line, ➤/⚔/✋ tags) supporting Item 4.
- NOT done (pro-art territory, deliberately untouched): final sprite art,
  phone-device screenshot check, audio expansion.


## Mobile-game conversion — September 26

- Replaced scrolling website chrome with a full-viewport game, edge HUD, quick fighter rail, large bottom actions and contextual selection controls.
- Added touch pan/pinch, zoom anchoring, high-DPI Canvas resize, precise sprite hit areas and responsive portrait/landscape overlay menus.
- Added preview/confirm placement to prevent accidental purchases; menu filters for economy, defense, village jobs, fighters and recruitment.
- Fixed UUID-based animation arithmetic producing NaN coordinates (invisible characters/smoke), and balanced Canvas save/restore around screen shake.
- Retained all professions, six missions, quests, assignments, population/expansion, revised sprites and existing save migration.
- Added capped tap-to-collect production bonuses, visible raid/quest progress, welcome pause, settings focus management, app icons and a standalone home-screen manifest.
- Added movement destination validation, blocked relocation during raid warning, corrected displayed high-level training costs and defeat repair totals.
- Extended real-browser tests to exercise actual pointer/touch input, portrait/landscape and save continuity.

## Item 8 — MOBILE COMPLETION (Phases A-E + 1-3 catch-up, 2026-09-26)

### Catch-up (Phases 1-3, were absent — verified by reading code, not assumed)
- `src/camera.js` (new): projection/pan/zoom math in CSS-px space, zoom ladder [0.55..3], focal-anchored `zoomAt`, `panPixels` inverts projection. Renderer delegates; old `Renderer.project/unproject/pan/resetCam` API kept so `tests/camera.test.js` still passes.
- `src/input.js` (new): `MapInput` Pointer Events, 7px drag-vs-tap threshold, one-finger pan, two-finger pinch, wheel zoom; a drag never becomes a build tap.
- `renderer.resize()` (new): canvas backing = CSS box x min(DPR,2), `cx=w/2, cy=h*.51`; boot + ResizeObserver + orientationchange. `cell()`/`cellAt()` pick in CSS px (DPR can no longer skew taps).
- Two-step placement (2b): first tap stages a ghost preview with zero spend (`Game.canBuild` pure pre-flight), second tap on the same tiles or `#confirm-place` commits exactly once. `browser-smoke.mjs` updated to pointer-event taps asserting preview-spends-nothing then builds-once, plus drag-pans and pinch-zooms assertions.
- Zoom ladder/ceiling (fixes the 3.6x-vs-docs drift): wheel/keys/fit snap to rungs; pinch clamps free. CHANGELOG Item 3's "0.5-2x" is superseded by 0.55-3x (honest ceiling for 32px art).

### Phase A — Performance
- Static isometric layer cached keyed by (cam.x, cam.y, zoom, width, height, grid, map, bounds); per frame the cached layer blits and only buildings/troops/enemies/effects/selection/ghost/overlays draw. Capture skips shaken frames so combat shake never bakes in; node/DOM-less contexts fall back to direct paint (`_noCache`).
- Integer sprite scaling: draw size snaps to 32*k (32/64/96/128) — no fractional shimmer under `image-rendering:pixelated`. UI sprite sizes snapped to whole multiples (build cards 64, people 48, gear 32).
- Hot path: DPR transform set once per frame, size-derived clear/vignette/banner/grade rects (no more 1100x740 constants), reused draw list (no spread-copy per frame), stream shimmer kept dynamic in one short loop, vignette/moon-glow baked into the static layer.
- `?perf` overlay + `renderer.frameReport()` (avg/p50/p95) + smoke writes `artifacts/frame-stats-390x844-dpr2.json`. **UNVERIFIED: no measured before/after numbers — no Chrome on this host; run `npm run test:browser` in CI and paste the JSON.**
- Outline-bug fix ported (immutable mask) into `generate_sprites.py`, `content_sprites.py`, `generate_village_sprites.py`. Did NOT run the two banned scripts; `generate_village_sprites.py` was read and fixed but NOT run (no Python on this host) — re-verify sprites before/after if run.
- `scripts/contact-sheet.mjs` (new, dependency-free): `artifacts/contact-sheet.html` + data<->file lockstep gate; `tests/art-lockstep.test.js` enforces distinct-silhouette-per-tier in CI. 95 sprites, 0 missing, 0 orphan at write time.

### Phase B — PWA
- `manifest.webmanifest` (standalone, theme #182d27, any + any-maskable icons), `assets/icon-192/512.png` (maskable-safe, full-bleed, crescent in safe zone) + `assets/icon-180.png` (opaque, iOS) via dependency-free `scripts/make-icons.mjs`.
- `build.mjs` generates versioned `dist/sw.js` (cache `midnights-manner-v0.1.0`, 125 files precached: shell + data + all sprites) with activate-time cleanup and runtime cache-population; registration is injected into `dist/index.html` only — repo root/`npm run dev` never serves or registers a worker.
- Display choice **[JUDGMENT]**: `standalone`, not `fullscreen` — fullscreen gains nothing on desktop and risks trapping iOS navigation; edge-to-edge still holds via viewport-fit + safe-area CSS.
- **UNVERIFIED: offline second-load boot + Lighthouse installability — no Chrome on this host; verify in CI/on device.**

### Phase C — Fonts/touch polish
- HUD font commits to `system-ui` stack (was `Arial,Helvetica` resolving 3 ways across Android/iOS/desktop); display serif stack unchanged.
- 44px minimum touch targets at <=760px, bottom `#dock` tab bar (Build/People/Story) with safe-area padding, `#panel` scroll regions, subtle drop-shadow on build-card sprites for the light drawer panel, landscape (max-height:500px) compact-chrome audit.
- Full `#drawer` overlay NOT built — dock + scrollable panel covers the same navigation on honest scope; say so if Jesce wants the overlay.

### Phase D — Persistence
- Export (clipboard + prompt fallback, version-labelled) / Import (prompt) in the village footer; `importSaveBlob` runs the versioned migration registry and fails with readable messages (garbage / future-version / failed-migration / failed-validation). No `MIGRATIONS[2]` — nothing persisted changed, so no wipe and no bump (still v2). `Game.importState` applies restores. Tests in `tests/save-blob.test.js`.

### Phase E — Accessibility
- Resource identity is shape + label + hue: wood=square, food=circle, gold=rotated-diamond (gold) via `data-res` + existing WOOD/FOOD/GOLD labels; low-stock restyle kept.
- `#status` is explicitly `aria-live=polite`; new visually-hidden `#event-log` live region announces every `game.notify` event (build/raid/save/import); `#grid` exposes `aria-pressed`.

### Verification on this host
- `npm test`: 65/65 pass (51 baseline + 14 new: art-lockstep 3, save-blob 6, camera-ladder 4, +1 model import check).
- `npm run build`: green, 125 files precached.
- `npm run test:browser`: NOT RUN (no Chrome) — smoke was updated but is CI-only until a headed host runs it. Screenshots at 320/390/430/landscape + frame-stats JSON are smoke outputs, not committed artifacts.
- No new npm dependencies (still zero), no framework, no mega-file, no force-push, original art only.

## Integration — mobile lines merged (2026-09-26)

Merged local 63fe75a into upstream c91af06/ab1d536 on work branch integrate-mobile (merge, upstream wins overlaps, no rebase, no force).
Upstream kept whole: full-screen mobile HUD/drawer/placement-confirm/harvest (index.html, ui.js, input.js, camera.js, main.js boot, buildings.json harvest fields, browser-smoke pointer/touch flow, 95 fixed sprites, generate_art_pass.py mask fix, README/CHANGELOG mobile entries).
Discarded local catch-up duplicates: camera.js/input.js/renderer two-step/canBuild/preview/MapInput-callback variant, old-chrome index/styles/ui placement, local smoke additions, tests/camera-ladder.test.js (tested the discarded camera API).
Re-applied genuinely-new A-E work on top: (A) static-ground canvas cache + integer 32k sprite scale + ?perf badge + frameReport + contact-sheet.mjs + art-lockstep test + immutable-mask fixes in generate_sprites.py/content_sprites.py/generate_village_sprites.py; (B) dist-only versioned sw.js + registration + make-icons.mjs icon set (180/192/512, maskable-safe) + manifest purposes; (C) system-ui font stack + resource shape CSS; (D) storage.js exportSave/importSaveBlob + pause-overlay Export/Import + Game.importState + save-blob tests, no migration bump (still v2, no wipe); (E) data-resource shape+label CSS + #event-log live region fed by UI.refresh.
Vignette/moon-glow/day-grade stay dynamic overlays (not baked) so the cached build looks identical to upstream; stream shimmer stays a one-loop dynamic pass.

## Story-in-game pass (quest flavor, rumors, names, legends)
- data/quests.json: additive `giver`, `flavor`, `act` (I/II) on all 8 steps; data/missions.json: additive `act` (III/IV), `beat`, `ceremony` (warning/victory/defeat) on all 6 chapters. Pure additions — old entries and old saves load unchanged, still v2, no migration.
- New flavor-only tables: data/rumors.json (14 notice-board lines), data/names.json (trade-name pools), data/legends.json (5 title-screen tales). Loaded via the existing main.js JSON path (relative URLs, Pages-safe).
- Wiring: quest list + completion toasts show giver/flavor; mission cards show act/beat/warning, result overlay and return-home toasts speak ceremony lines; notice board rotates daily in the story panel; legends rotate on the title screen; every 10th newborn arrival earns a trade-name shown in the People panel.
- Tests: tests/story.test.js (7 checks: field shape, stripped-data compat, deterministic picks, named arrival, no save keys). Next: calendar + traders (needs MIGRATIONS[2]), charters + records (needs UI surface) — design only.

