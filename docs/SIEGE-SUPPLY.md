# Siege and supply intelligence

## Battlefield intelligence

Home raids form at most four assault groups, inferred from their approach side.
They probe the exposed band of defenses, comparing travel, remaining wall health
and tower coverage. A shared target stays committed for four seconds. Scattered
groups muster for at most four seconds; newly broken defenses become approach
waypoints toward the interior. Existing movement and wall collision still apply.
Nearby defenders and taunts interrupt structural assaults. Bosses and campaign
maps retain their authored behavior. No damage, HP, reward or raid timing curves
change.

Posted fighters retain their local defense planner. Unposted melee reserves
screen nearby threatened archers. Army & People contains group commands for all,
melee or ranged fighters: **Hold**, **Defend post**, **Rally & hold**, and
**Resume group duties**. Defend intercepts within six tiles of the chosen post;
Rally sends fighters to separate open muster slots and then holds. These explicit
commands replace that group's orders, excluding expeditions and emergency duties.
Resume releases group orders only. An unavailable post releases its command.
Individual orders continue to take priority over automatic plans.

The battle HUD and People panel show each group's side, phase and intended target.
Raid results record assault groups, breach advances and a practical defense hint.
Plans live in WeakMaps, run once per second and never enter saves. Group orders use
the existing order schema; v15 saves remain compatible and restart transient plans.

## Working supply chains

The existing two-second haul planner now scores demand from the next town meal,
building recovery, Steward construction baskets, automatic upgrades, needed
equipment, production targets and protected reserves. Demands propagate backward
through up to four staffed recipe stages. Urgent producer batches favor useful
workshops; otherwise they go to compatible storage. Waiting jobs gain priority
over time, and workshop input trips choose a reachable hub using cached route
distance. Supply signals refresh before expiry when spare hands permit.

Inputs remain shared stores. Visits grant the existing modest throughput benefit;
they do not consume or create a second copy of resources. Real producer/workshop
outputs remain at their source until unloading. Collect Ready, cancellation,
raids, destruction and reload keep that accounting. Finished-output fallbacks
remain storage-gated. Full workshop output buffers stop unnecessary input trips.

Stores displays priority shortages, workshop status, and at most eight delivery
bottlenecks with View actions. Inspectors show missing inputs, missing workers or
blocked outputs. Existing Granary/Forge Quarter/Market Square handling benefits
are explained, including their radius and cap. Raid alarms stop new haul jobs;
manual orders, posted workers, builders and expeditions retain priority.

Limits remain 24 jobs, 10 carts, 48 route fields and eight new route calculations
per planner interval. Demands, aging, diagnostics and supply tokens are transient;
the save version remains 15 and no additional resource or building types are added.

## Verification

Focused tests cover coordinated targeting, coverage, breaches, bounded cadence,
taunt priority, screening, scoped commands, invalid posts, save round trips and
campaign isolation. Required full-suite and build checks run before publication;
browser verification is reported separately when completed. Supply tests cover
meal priority, recipe chains, cumulative budgets/protected reserves, destination
choice, busy hubs, workshop states, cancellation/accounting, detached readouts
and all existing planner caps. The Chromium smoke harness exercises the actual
phone commands, preserves selector choices after refresh, and checks supply UI.

`node scripts/intelligence-benchmark.mjs [comparison-repository-root]` runs full
Game.tick on a repeatable 150-villager / 72-building village without rendering.
In the container comparison, average peace/raid ticks were 3.40/4.74 ms versus
3.60/4.60 ms on the starting main; p95 was 4.70/9.31 ms versus 5.86/10.85 ms.
Single runs are noisy; these figures are neither phone FPS nor Safari validation.
The optional CPU Canvas benchmark retained fewer than 9,000 visible faces in
peace/warning/raid, below the existing 30,000-face limit.
