# Midnights Manner — Story & Campaign

Main quest arc mapped onto the live data: **build → recruit → defend → expand → endure → name**.
Covers the village-path chain (`data/quests.json`, 22 steps) plus the campaign missions
(`data/missions.json`, 15 chapters). Quest-giver voice and reward cadence stay in JSON so
future missions can be added without touching game logic.

## Premise (5 lines)

The sun thinned and never came back, and the valleys live by moonlight now.
You hold a walled manner around one lamplit Manor Hall, and its bell is yours.
Raise farms and timber alongside hungry neighbors, train a small garrison,
and walk the western road through expeditions before the Long Night ends.
Every victory comes home: moonstone for the coffers, timber for the walls,
and one craft the village keeps. Nobody promises dawn — only that the Manner holds.

## Arc Shape

| Act | Shape word | Content | Content in data |
|-----|-----------|---------|-----------------|
| I — Hearth | BUILD | Farms, pond, cottage, workplaces | Quests: `second-field` → `every-hand` |
| II — Neighbors | RECRUIT | Population, levels, map rows | Quests: `new-blood` → `full-crew` |
| III — Road | DEFEND | Timed collection under raids | Missions: `first-harvest` → `long-night` |
| IV — Hollow | EXPAND | Dual objectives, branch finale | Missions: `ember-road` → `last-stand` |
| V — Depth | ENDURE | Frostwood, plate, deep water, school | Quests: `chart-the-dark` → `tam-s-school` |
| VI — Pale | NAME | Pale Host, banners, Longest Night, Dawn | Missions: `coin-and-cinder` → `dawn` |

The village path teaches; the campaign tests. Home is never at risk from expeditions —
rewards land only on explicit return, replays pay no first-clear twice, abandoning changes nothing at home.

## Tone (non-negotiable)

- Quiet frontier hope, not epic salvation.
- Nobody is evil; everybody is hungry, tired, or owed.
- Light steadies; it does not smite.
- Keep one light. Mend the rest.
- No returning sun as a plot win-condition. Dawn Gate is a *name* the village earns, not a restored star.

## Living voices

Keepers (see `KEEPERS.md` / `data/keepers.json`) and quest givers share one register:
short, concrete, neighborly. Notice-board rumors (`data/rumors.json`) should sound like
them — attributed when possible, never sermonizing.

| Voice | Role in the arc |
|-------|-----------------|
| Maro / Mara | Walls, stone, "the village means it" |
| Old Bell | Flocks, bells, three-clack warning |
| Issa (Second-Lantern) | Chart Log, seeds, beds before bodies |
| Tomm Waterwise | Water older than walls |
| Sarella | Honest steel, charcoal arithmetic |
| Fen the Wayfinder | Failed hearths, dry wells, the road |
| Wren | Still water, deep holes |
| Pella | Second lantern, lit windows |
| Mooncleric | Ransom, steadiness, no smiting |
| Sorrel | Pale Host watch, oaths |
| Rue | Turncloak terms, maps kept |
| Master Tam | School, apprentices |

## Chapter beats (campaign)

### Act III — Road
1. **The First Harvest** — Fill the granary before dusk; dust on the west road is only dust *this* time.
2. **Timber Line** — Wood under troop cap; the road that feeds the walls.
3. **Long Night** — Gold under pressure; the first true night watch.

### Act IV — Hollow
4. **Ember Road** — Charcoal and beams; Sarella's world.
5. **Moonwell** — Food and gold together; water and stone.
6. **Last Stand** — Three waves, skeleton crew; carve the name on the bell.

Branch after Last Stand: **Ashen Ford** / **Hollow Dam** — same debt, different ground.

### Act VI — Pale
- **Coin and Cinder** — Frostwood and gold; the pale economy.
- **The Pale Host** — Oath-line; Sorrel chalks names.
- **Red Banner / Grey Banner** — Branch choice of color, not of morality.
- **The Pale Court** → **The Longest Night** → **Dawn** — Hold until the chart says the Manner has earned its name.

## Village path (selected spine)

Early: second field, still water, first cast, roof, every hand, new blood, east field, full crew.
Mid: chart the dark, Tomm's flocks, open doors, Sarella's standard.
Deep: west of the chalk, first pour, down dark water, glass under stone.
Late: Rue's terms, voices in the dark, Tam's school, the bell remembers, what the water kept, **Dawn of the Manner**.

## Integration rules

- Ceremony lines (`warning` / `victory` / `defeat`) stay short enough for mobile toasts.
- Quest `flavor` may name keepers; `text` stays the task.
- Rumors may carry optional `source` ids for future filters; the board can ignore unknown fields.
- Soft reputation (`SOFT_REPUTATION.md`) may tint rumors later — do not require it for the board to work.

## Open story questions (leave open)

- Which Thinning account is true?
- What the Pale Host owes, and to whom?
- Whether the Dawn Gate is a door, a vow, or only a name chalked in gold?

*Keep one light. Mend the rest.*
