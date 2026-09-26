# Soft Reputation Design — Lore Expansion Branch

Local, reversible, human-scale reputation.  
Never a formal “Allied / At War” system.  
Never permanent. Never multiplayer.

## Design Goals

- Make existing faction relationships legible and slightly reactive.
- Express everything through keepers, notice-board rumors, raid composition, and trader offers.
- Stay 100 % data-driven and local-save only.
- Preserve the tone: nobody is evil; everybody is hungry, tired, or owed.

## Core Rules

1. Reputation is a simple integer per faction, stored in the local save.
2. Range is deliberately narrow: **-3 to +3** (or -5 to +5 if more granularity is wanted later).
3. Actions push the value; time and inaction slowly drift it toward 0.
4. Effects are small and flavorful — never make-or-break.
5. The player never sees a diplomacy screen. They only see consequences and hear the keepers talk about them.

## Data Shape

### 1. `data/factions.json` (static definition)

```json
{
  "ashwood": {
    "id": "ashwood",
    "name": "Ashwood Poachers",
    "summary": "Timber crews from two failed clearings. Not hate — arithmetic.",
    "min": -3,
    "max": 3,
    "driftPerDay": -0.05,
    "positiveActions": ["ransom", "leaveFood"],
    "negativeActions": ["killCaptives", "burnCamp"],
    "effects": {
      "+2": { "raidWarningChance": 0.35, "rumorPool": "ashwood-friendly" },
      "+1": { "raidWarningChance": 0.15 },
      "0":  { },
      "-1": { "raidAggression": 0.1 },
      "-2": { "raidAggression": 0.25, "rumorPool": "ashwood-hostile" },
      "-3": { "raidAggression": 0.4,  "extraRaiders": 1 }
    }
  },
  "tollgangs": {
    "id": "tollgangs",
    "name": "Westroad Toll-Gangs",
    "summary": "Kess Longaxe and Dren Salt share the Timber Line by uneasy rota.",
    "min": -3,
    "max": 3,
    "driftPerDay": -0.03,
    "positiveActions": ["payToll", "buyRoadNews"],
    "negativeActions": ["skipToll", "attackGang"],
    "effects": {
      "+2": { "traderDiscount": 0.1, "roadNewsChance": 0.4 },
      "+1": { "roadNewsChance": 0.2 },
      "0":  { },
      "-1": { "tollMarkup": 0.15 },
      "-2": { "tollMarkup": 0.3,  "probeChance": 0.2 },
      "-3": { "tollMarkup": 0.5,  "probeChance": 0.4 }
    }
  },
  "greymarket": {
    "id": "greymarket",
    "name": "Grey Market Caravans",
    "summary": "Traveling traders out of the Lantern Towns. Fair but sharp.",
    "min": -2,
    "max": 3,
    "driftPerDay": -0.02,
    "positiveActions": ["fairDeal", "payOnTime"],
    "negativeActions": ["refuseDeal", "insultTrader"],
    "effects": {
      "+2": { "offerQuality": 1, "visitChance": 0.3 },
      "+1": { "offerQuality": 0.5 },
      "0":  { },
      "-1": { "offerQuality": -0.5 },
      "-2": { "visitChance": -0.2 }
    }
  },
  "moonwardens": {
    "id": "moonwardens",
    "name": "Moonwardens",
    "summary": "Scattered wayfinders and moonclerics who keep the old charts.",
    "min": -1,
    "max": 3,
    "driftPerDay": 0,
    "positiveActions": ["completeChart", "followSurvey"],
    "negativeActions": ["ignoreSurvey"],
    "effects": {
      "+2": { "rareRumorChance": 0.15, "smallGiftChance": 0.05 },
      "+1": { "rareRumorChance": 0.08 },
      "0":  { },
      "-1": { }
    }
  }
}
```

### 2. Save-game shape (inside the existing versioned local save)

```json
"reputation": {
  "ashwood": 0,
  "tollgangs": 0,
  "greymarket": 1,
  "moonwardens": 0
}
```

Simple integers. Drift is applied on day rollover (same place the calendar already runs).

### 3. Action → reputation deltas (data-driven)

A tiny lookup table, either inside `factions.json` or a separate `reputation-actions.json`:

```json
{
  "ransom":           { "ashwood": +1 },
  "leaveFood":        { "ashwood": +1 },
  "killCaptives":     { "ashwood": -2 },
  "payToll":          { "tollgangs": +1 },
  "buyRoadNews":      { "tollgangs": +1 },
  "skipToll":         { "tollgangs": -1 },
  "attackGang":       { "tollgangs": -2 },
  "fairDeal":         { "greymarket": +1 },
  "refuseDeal":       { "greymarket": -1 },
  "completeChart":    { "moonwardens": +1 },
  "followSurvey":     { "moonwardens": +1 },
  "ignoreSurvey":     { "moonwardens": -1 }
}
```

The game only needs to fire a single `reputation.change(actionId)` call when the player does one of these things. Everything else is data.

### 4. How effects surface (no new UI required at first)

- **Raid composition / aggression** — already controlled by data in combat/campaign systems.
- **Notice-board rumors** — add optional `minRep` / `maxRep` / `faction` fields to rumor entries so the pool can filter.
- **Trader offers** — already have `minLevel`; add optional `minRep` / `faction`.
- **Keeper dialogue** — the keepers we already wrote can reference the current value with simple condition keys (`ashwood>=2`, `tollgangs<=-1`, etc.).

## Implementation Order (still on lore-expansion)

1. Ship `data/factions.json` + the action delta table (done in this commit).
2. Expand a few rumors and keeper lines with `minRep` / `faction` filters.
3. Document the exact save-field name so the other agent can wire the integer store + drift later.

## Hard Limits

- No formal alliance / war declarations.
- No permanent locks.
- No multiplayer or shared state.
- Effects stay small enough that a new player who ignores the system still has a fair game.

---

*Keep one light. Mend the rest.*
