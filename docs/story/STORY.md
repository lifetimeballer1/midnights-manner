# Midnights Manner — Story & Campaign

Main quest arc mapped onto the existing campaign shape: **build → recruit →
defend → expand**. Covers the 8-step village-path chain (`data/quests.json`)
plus the 6 campaign missions (`data/missions.json`). Quest-giver voice and
reward cadence defined so future missions can be added without touching game
logic.

## Premise (5 lines)

The sun thinned and never came back, and the valleys live by moonlight now.
You hold a walled manner around one lamplit Manor Hall, and its bell is yours.
Raise farms and timber alongside hungry neighbors, train a small garrison,
and hold the western road through six expeditions before the Long Night ends.
Every victory comes home: moonstone for the coffers, timber for the walls,
and one new craft the village keeps forever.

## Arc Shape

| Act | Shape word | Content | Missions |
|-----|-----------|---------|----------|
| I — Hearth | BUILD | Learn the loop: farms, pond, cottage, workplaces | Village-path quests 1–5 (`second-field` → `every-hand`) |
| II — Neighbors | RECRUIT | Population growth, village levels, map rows open | Village-path quests 6–8 (`new-blood` → `full-crew`) |
| III — Road | DEFEND | Timed collection under raids, troop caps | Campaign 01–03 (`first-harvest` → `long-night`) |
| IV — Hollow | EXPAND | Dual objectives, new lands, three-wave finale | Campaign 04–06 (`ember-road` → `last-stand`) |

The village path teaches; the campaign tests. Home village is never at risk
from expeditions — rewards land only on explicit return, replays pay no
first-clear twice, abandoning changes nothing at home.

## Chapter Beats

### Village path (home, 8 steps — existing)

1. **A Second Field** (`second-field`, build 2nd farm, 60 XP, +40 wood) —
   *"One farm feeds a few. Two farms feed a future."* Beat: the first
   decision that is strategy, not tutorial.
2. **Still Water** (`still-water`, build pond, 60 XP, +30 food) — beat:
   the map gains its mirror; glimmerfish rumor planted.
3. **First Cast** (`first-cast`, recruit fisherman, 60 XP, +30 gold) — beat:
   first specialist; People panel moment.
4. **A Roof for the Night** (`roof-for-night`, build cottage, 80 XP,
   +40 food) — beat: shelter before strangers; beds-before-bodies rule taught.
5. **A Place for Every Hand** (`every-hand`, assign 2, 80 XP, +30 gold) —
   beat: workplaces and auras click; idle hands → full bellies.
6. **New Blood** (`new-blood`, population 8, 100 XP, +60 gold) — beat: the
   village grows *on its own*; surplus + beds payoff.
7. **Clearing the East Field** (`east-field`, reach level 3, 120 XP,
   +80 wood) — beat: the treeline retreats; new rows = visible progress.
8. **A Full Crew** (`full-crew`, population 12, 150 XP, +100 gold/+60 food) —
   beat: twelve souls under one moon; frontier truly yours.

### Campaign (expeditions, 6 chapters — existing)

- **01 · The First Harvest** (`first-harvest`, 180s, 5 troops, 100 food,
  no raids) — *"A village begins with a full granary."* Beat: pure build
  sprint; reward +140 wood/+90 gold; unlocks the **tower**. The village
  learns it can *finish* something.
- **02 · Hold the Timber Line** (`timber-line`, 210s, 6 troops, 150 wood,
  raids at 35s/85s) — *"Raiders have found the road."* Beat: first blood;
  gather under pressure; reward +180 gold/+150 food; unlocks the **trap**.
- **03 · The Long Night** (`long-night`, 240s, 5 troops, 180 gold, raids at
  25s/90s) — *"Secure moonstone before dawn."* Beat: small garrison, two
  raids, moonstone hunger; reward +300 gold/+250 wood/+200 food; unlocks
  the **warhammer**. End of Act III: the village endures.
- **04 · The Ember Road** (`ember-road`, 200s, 6 troops, 200 wood, one late
  raid at 120s) — *"A forge-fire needs feeding."* Beat: tight clock, a long quiet stretch, then one late raid where the
  watchfire earns its keep; reward +200 wood/+150 gold;
  unlocks the **grove**.
- **05 · Moonwell Plenty** (`moonwell`, 260s, 7 troops, 150 food + 200 gold,
  raids at 60s/150s) — *"Two hungers at once."* Beat: split economy,
  foragers earn their keep; reward +200 food/+250 gold; unlocks the
  **watchfire**.
- **06 · The Last Stand** (`last-stand`, 300s, 5 troops, 250 gold, three
  waves at 40s/130s/220s) — *"Hold the manor… and prove the village
  endures."* Beat: skeleton crew, three waves before dawn, finale. Reward
  +400 gold/+300 wood/+250 food; unlocks nothing — the pay is bulk goods
  and your name on the bell.

## Quest Text Style

- Voice: a Moonwarden field-note or a neighbor at the door. Plain speech,
  one concrete image, one instruction. Two sentences max for `text`.
- Present tense, second person or imperative: *"Raise…"*, *"Keep…"*,
  *"Dig…"*. Never lore-dump in quest text — rumor goes in flavor fields.
- Numbers live in objectives, not prose. Text says "before dawn";
  `timeLimit` says 240.
- Example template: `[Image of the work]. [The thing to do].`
  *"Fish shine like fallen stars in the dark. Dig a Stillwater Pond."*

## XP / Reward Cadence

Village path totals 710 XP across 8 quests (60/60/60/80/80/100/120/150):
early steps pay 60 to move fast, mid steps 80 as assignments begin, growth
milestones 100–150. Material rewards alternate wood → food → gold so no step
starves the next. Campaign rewards escalate per chapter length and raid
count; each chapter unlocks exactly one thing (tower → trap → warhammer →
grove → watchfire → nothing, the finale pays bulk instead). One-time
first-clear rewards only — a replay pays nothing twice. Future missions:
keep one unlock per chapter, keep timers 180–300s, keep troop caps 5–7, keep
dual objectives for chapters 5+.
