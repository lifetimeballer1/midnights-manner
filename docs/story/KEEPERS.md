# Midnights Manner — Living Workplace Keepers

Production-ready character entries for the senior neighbors who give the village its face.  
All original. Written to the expanded LORE.md canon.  
These are **neighbors with jobs**, never classes or quest-givers in the classic sense.

Each keeper can be posted at their workplace. While posted they already grant the existing aura.  
The new layer is identity, memory, and a few lines that can change after major events.

---

## Design Rules (Non-Negotiable)

- Trade-names only. No titles, no chosen ones.
- Wants vs Needs always in tension.
- Dialogue stays short, concrete, and in the dry neighborly voice.
- They remember what the player does (raids survived, captives ransomed, missions returned, population milestones).
- They never break the hard rules: no resurrection talk, no sun-return hope, no dark-lord rhetoric.
- One entry per keeper. Explicit relationship links.

---

## The Keepers

### Mara the Mason
- **Workplace:** mason_yard
- **One-line:** Laid half the current walls and still complains about green timber.
- **Status:** Alive, posted or idle
- **Wants:** Straight courses and dry stone that will outlast her.
- **Needs:** To believe the walls she lays will still stand when she is gone.
- **Background:** Came with the second wave of settlers. Learned under Maro (whose chalk mark is still on the Manor sill). Lost a brother to a toll-gang raid in Dusk Year 41.
- **Relationships:** Respects Old Bell. Soft spot for any child who brings a straight nail. Grudging respect for the weaponsmith if the steel is true.
- **Recent events hooks:** After a successful wall defense → “The courses held. Good.” After green timber used → “That wood will twist before winter. I told you.”
- **Gameplay surface:** When posted, existing buildAura. Future: small chance to comment in the event log after builds or raids that touch walls.

### Old Bell
- **Workplace:** pasture (shepherd)
- **One-line:** Counts the flocks by bell, not by dog, and keeps the bent-clapper story alive.
- **Status:** Alive
- **Wants:** Every sheep accounted for at grey dawn.
- **Needs:** Someone younger to learn the three-clack warning before the owls go silent.
- **Background:** Oldest continuous voice in the Manner. Was a child when Pella rang the cracked field-bell. Still has the bent clapper on the market stall and charges children a button to touch it.
- **Relationships:** Treats every shepherd as an apprentice. Quietly fond of the mooncleric. Suspicious of anyone who does not answer a bell.
- **Dialogue hooks:** After a raid that reaches the pasture → “Three clacks and the owls went quiet. You heard it too.” After population growth → “New hands. Teach them the bells before the next dark.”
- **Gameplay surface:** Existing gatherAura / pasture. Future: can unlock a small “bell warning” flavor when a raid is incoming.

### Second-Lantern Issa
- **Workplace:** scriptorium (scholar) or farm seed-keeper line
- **One-line:** Keeps Sella’s old seed stories and the Chart Log.
- **Status:** Alive
- **Wants:** Every useful plant and every useful chart written down before it is forgotten.
- **Needs:** Proof that the Long Dusk is still a place where things can be saved, not only endured.
- **Background:** Descendant (or chosen heir) of the Second-Lantern line. The seed box story is hers to tell. Now also tends the Chart Log pages.
- **Relationships:** Works closely with the wayfinder. Gives Tomm’s name when speaking of pastures. Quiet ally of the mooncleric.
- **Dialogue hooks:** After a successful mission return → writes a new Chart Log page. After a failed harvest → “Sella carried worse through three dead manners. We can carry this.”
- **Gameplay surface:** XP / survey aura. Primary voice for the Hall Book / Chart Log feature.

### Tomm Waterwise (or Tomm the Herder)
- **Workplace:** pasture or pond lineage
- **One-line:** Grandson (or great-nephew) of the man who taught the valleys to pond fish instead of plowing everything.
- **Status:** Alive
- **Wants:** Full ponds and steady flocks.
- **Needs:** The village to remember that water is older than walls.
- **Background:** The family name is still spoken when the Stillwater is dug deeper. Soft-spoken, practical, hates waste.
- **Relationships:** Friendly rivalry with the fisherman crew. Defers to Old Bell on bells. Respects Mara’s walls because they keep the water in.
- **Dialogue hooks:** After pond upgrade → “Deeper. Good. The glimmerfish will notice.” After a dry stretch → “Rest the node. Land remembers overdrawing.”

### Sarella of the Forge
- **Workplace:** forge (weaponsmith)
- **One-line:** Keeps the Emberforge hot and the blades honest.
- **Status:** Alive
- **Wants:** Steel that does not fail the hand that holds it.
- **Needs:** Enough moonstone and charcoal that she never has to choose which warrior goes short.
- **Background:** Learned the trade on the Ember Road charcoal trails. Came to the Manner when the road grew too thin. Still smells of coal and hot iron.
- **Relationships:** Professional respect for the armorer. Will not suffer a blunt blade on a watch roster. Softens only for apprentices who stay late.
- **Dialogue hooks:** After a raid with low casualties → “The edges held. Bring me the notched ones.” After scarcity → “I can sharpen three more. After that we are choosing.”

### Old Maro’s Mark (the memory, not a living person)
- Not a living keeper, but a permanent environmental and narrative anchor.
- The chalk mark on the Manor sill is still visible.
- Any mason posted near the hall can “notice” it and add a line to the Hall Book.
- Keeps the founding generation present without resurrection.

### The Mooncleric (Keeper of the Chapel)
- **Workplace:** chapel
- **One-line:** Lights the ward-lantern and teaches that light steadies; it does not smite.
- **Status:** Alive
- **Wants:** Every watchfire and every cottage lamp kept trimmed.
- **Needs:** The village to understand that ransom and mercy are also forms of strength.
- **Background:** Trained in the scattered Moonwarden rites. Never claims to be a full Warden. The one who twice ransomed Ashwood captives with bread instead of chain — the act that taught some poachers to tap the Signal Watchfire twice before a raid.
- **Relationships:** Trusted by Old Bell. Watched carefully by the more hard-bitten warriors. Quiet correspondence (via notice board) with distant Moonwardens.
- **Dialogue hooks:** After a ransom choice → “They tapped the watchfire twice this time. The warning held.” After a brutal defense → “The light did its part. The rest was hands and timber.”

### The Wayfinder (Scout-Post Keeper)
- **Workplace:** scout_post
- **One-line:** Walks the Timber Line charts and marks the failed hearths so no one rebuilds on a dry well.
- **Status:** Alive
- **Wants:** Accurate charts and no more lost manners.
- **Needs:** The village to treat every new clearing as temporary until the water is proven.
- **Background:** Carries copies of the old Moonwarden survey that first brought the founders to Hob’s Cut. Speaks little, writes more.
- **Relationships:** Supplies Issa with new Chart Log material. Warns Mara about green timber stands. Knows which toll-gang is currently holding the western road.

---

## Implementation Notes for the Other Agent / Future Wiring

1. These entries are designed to live in `data/keepers.json` (or an extension of troops.json with a `keeper` flag and dialogue table).
2. Dialogue can be simple state keys: `default`, `afterRaid`, `afterRansom`, `afterMissionReturn`, `afterGrowth`, `afterScarcity`.
3. The Hall Book / Chart Log can pull short lines from Issa and the Mooncleric automatically.
4. No new systems logic is required for the first pass — pure data + flavor text in the People panel or a small “Talk” button is enough.
5. Leave room for the player to form attachments. Do not over-script.

---

*Keep one light. Mend the rest.*
