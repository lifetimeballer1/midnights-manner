# Ranked Feature & Content Additions — Lore Expansion Branch

All proposals respect the single-player, local-save, no-server contract. Ranked by leverage vs. implementation risk against the current vanilla-JS + JSON architecture.

## High Leverage / Low Risk (Data + Flavor + Light UI)

1. **Living Workplace Keepers**  
   Give each major profession a named senior NPC (Mara the mason, Old Bell, etc.) with one-line agenda and a small dialogue change after key events (raid survived, population threshold, mission return). Uses existing People panel + auras. Pure data + a few flavor strings.

2. **Notice Board Engine**  
   Already sketched in MMO_FEEL.md. Make it the primary lore delivery vehicle: rotating rumors, Grey Market prices, faction soft news, milestone prompts. Date-seeded + game-state driven. All text in JSON. Zero new systems logic beyond display.

3. **Manner Memory / Hall Book**  
   After major events (raid, mission return, level-up, first of a profession), append a short dated entry the player can re-read. Makes the village feel continuous. Simple array in the save + a small UI panel.

4. **Lunar / Seasonal Calendar (Local Date Math)**  
   Daily modifier and 28-day seasonal week (Sowing / Timber / Moonstone / Mending) that gently affects node refill, gather rates, or raid aggression. Pure local time seed. Already outlined in MMO_FEEL.md.

5. **Environmental Storytelling Hotspots**  
   Make a handful of existing map elements selectable (old terraces, bent clapper, tollman’s hat, Signal Watchfire, Maro’s sill mark). Yield short flavor text or tiny one-time bonuses. No new sprites required if using existing tiles.

6. **Expanded Quest Flavor**  
   Add `giver`, `flavor`, and `act` fields more richly across quests.json and missions.json. Conflicting accounts and “dog story” details. Already supported by the data format.

## Medium Leverage / Medium Risk

7. **Faction Soft Reputation (Local Only)**  
   Track simple counters (ransomed poachers, paid tolls, ignored warnings). Slightly alters raid composition, trader offers, or notice-board tone. Still pure local save. No other players involved.

8. **Campaign Fingerprints on Home Village**  
   First-clear mission rewards can permanently unlock a small cosmetic or functional improvement on the home map (extra row of terraces, a charcoal kiln pad, a new watchfire site). Requires careful save migration and map data flags.

9. **Charter / Guild Labels**  
   Workplaces with 3+ posted villagers earn a local charter name and a tiny passive. Cosmetic + small aura step. Already sketched.

10. **One New Profession + Workplace Pair**  
    Example: a true Moonwarden initiate or seasonal Grey Market factor. New troop entry, building tier, aura, and a short story beat. Follows existing extension guide.

## Lower Priority / Higher Scope (Later)

11. **Branching Mission Outcomes**  
    Different return states that leave different permanent marks. Needs careful design so the home village never becomes unplayable.

12. **Very Small Costly Ward System**  
    Explicit moonstone + material cost for temporary wall blessings or lamp charms. Must stay subordinate to work and never become a win button.

## Explicitly Out of Scope

- Real multiplayer, co-op, PvP, shared raids
- Cloud saves, cross-device sync, global leaderboards
- Server-pushed events or daily ops
- Anything that uploads player data
- Turning raiders into monsters or adding a dark-lord plot
- Returning the sun or ending the Long Dusk

---

**Recommended next implementation order on this branch:**
1. Finalize and review the expanded LORE.md (done).
2. Flesh living keepers + notice-board data tables.
3. Add Manner Memory log.
4. Wire the lightest calendar modifiers.
5. Environmental hotspots.

All of the above can ship as pure content + minimal UI without breaking the current mobile-first prototype or the no-server rule.
