// Village-sim systems: quest walkthrough + XP levels, housing/population,
// map expansion, and assigned-job trickles. All content from data/quests.json;
// numbers below are gentle pacing constants, not content.
import {levelForXp, EXPANSION, auras, housing, center, stats, unlockedAbilities} from '../model.js';
import {sfx} from './audio.js';
import {makeTradeName} from './story.js';

export const CHILD_SECONDS = 75;      // surplus + free bed grows a villager this fast
const UPKEEP_EACH = 0.03;      // food per second per villager
const SURVEY_FIND = 50;        // survey points that shake out a wild harvest
const WILD_HARVEST = 25;
// Growth rotation: first 8 arrivals are food/wood/gold hands so the
// pop-8 and pop-12 quests never stall; combat, keepers and crafters join
// once the village can feed them. Indexed by roster size, deterministic.
const START_CHILD_TYPES = ['lumberjack', 'farmer', 'miner', 'fisherman', 'shepherd', 'lumberjack', 'farmer', 'miner', 'butcher', 'builder', 'shepherd', 'forager', 'healer', 'archer', 'mason', 'scout', 'warrior', 'scholar'];
// Visible growth state for the HUD: percent toward the next arrival plus
// the reason when progress is paused (never a silent stall).

function push(world, effect) { if (world.effects.length < 140) world.effects.push(effect); }
export function gainXp(state, amount) { state.xp = Math.max(0, (state.xp || 0) + amount); }

function taskDone(task, state, data) {
  const w = state.world;
  if (task.kind === 'build') return w.buildings.filter(b => b.type === task.type && b.hp > 0).length >= task.count;
  if (task.kind === 'recruit') return w.troops.filter(t => t.type === task.type).length >= task.count;
  if (task.kind === 'assign') return w.troops.filter(t => !!t.workplace).length >= task.count;
  if (task.kind === 'population') return w.troops.length >= task.count;
  if (task.kind === 'level') return (state.vlevel || 1) >= task.level;
  if (task.kind === 'gather') return (w.gathered[task.resource] || 0) >= task.amount;
  // Flawless defenses (Act VII, Rue's terms): a raid won with zero
  // building losses, home or away — arrival ledgers read zero by
  // construction, so this gate can never auto-fire. Missions merge their
  // ledgers home on return (campaign.js), so either road counts.
  if (task.kind === 'defeat') return ((w.flawlessRaids || 0) + (state.home?.flawlessRaids || 0)) >= (task.count || 1);
  // Prestige roll (Act VIII, the bell remembers): starred veterans on the
  // rolls. Arrival rosters read zero stars by construction — never auto.
  if (task.kind === 'prestige') return w.troops.filter(t => (t.prestigeStars || 0) >= (task.stars || 1)).length >= (task.count || 1);
  // Wonder standing (Act VIII finale): the named wonder built AND standing
  // — ruins and scaffolds do not count. Arrival has no gate to stand on.
  if (task.kind === 'wonder') return w.buildings.some(b => b.type === task.type && b.hp > 0 && b.remaining <= 0);
  // Upgrade gates (Act V+): every listed building type stands at the
  // tier — rewards preparation, never arrival arithmetic.
  if (task.kind === 'upgrade') {
    const types = Array.isArray(task.type) ? task.type : [task.type];
    const level = task.level || 2;
    return types.every(t => w.buildings.some(b => b.type === t && b.hp > 0 && b.level >= level));
  }
  return false;
}

export function currentQuest(state, data) {
  return (data.quests || []).find(q => !(state.questsCompleted || []).includes(q.id)) || null;
}

function completeQuest(state, data, quest, notify) {
  state.questsCompleted.push(quest.id);
  gainXp(state, quest.xp);
  for (const [k, v] of Object.entries(quest.rewards || {})) state.world.resources[k] = (state.world.resources[k] || 0) + v;
  // Quest-gated unlocks (data/quests.json `unlocks`, mirroring missions):
  // earned, never bought — old saves with the quest already done keep
  // their state; only a fresh completion grants.
  const unlocked = [];
  state.unlocks = state.unlocks || [];
  for (const id of quest.unlocks || []) {
    if (!state.unlocks.includes(id)) { state.unlocks.push(id); unlocked.push(id); }
  }
  const w = state.world, cp = {x:10, y:8};
  const hall = w.buildings.find(b => b.type === 'hall' && b.hp > 0);
  const at = hall ? center(hall, data) : cp;
  push(w, {x:at.x, y:at.y, tx:at.x, ty:at.y, kind:'fanfare', life:.8});
  push(w, {x:at.x, y:at.y, tx:at.x, ty:at.y - 1.1, kind:'float', text:`+${quest.xp} XP`, color:'#ffe9a8', life:.9});
  sfx.quest();
  const rewardText = Object.entries(quest.rewards || {}).map(([k, v]) => `+${v} ${k}`).join(', ');
  const unlockText = unlocked.map(id => data.buildings[id]?.name || data.items[id]?.name || data.troops[id]?.name || id).join(', ');
  // Optional flavor fields (data/quests.json): old entries without them read unchanged.
  const flavor = quest.flavor ? ` ${quest.flavor}` : '';
  notify(`Quest complete: ${quest.name}! +${quest.xp} XP${rewardText ? ` · ${rewardText}` : ''}${unlockText ? ` · Unlocks: ${unlockText}` : ''}.${flavor}`);
}

function applyExpansion(state, data, notify) {
  const w = state.world;
  const target = EXPANSION[Math.min(state.vlevel - 1, EXPANSION.length - 1)];
  if (w.bounds.w >= target.w && w.bounds.h >= target.h) return;
  w.bounds = {...target};
  push(w, {x:target.w - 1, y:target.h - 1, tx:target.w - 1, ty:target.h - 1, kind:'fanfare', life:.8});
  sfx.unlock();
  notify(`The treeline retreats! New rows are open — the village now spans ${target.w}×${target.h}.`);
}

function tickPopulation(state, data, dt, notify) {
  const w = state.world;
  if (state.mission) return; // expeditions don't grow families
  const {beds, free} = housing(w, data);
  const mouths = w.troops.filter(t => t.hp >= 0).length;
  const upkeep = mouths * UPKEEP_EACH;
  // Passive food income as the surplus signal (collectors only hurry it along).
  let income = 0;
  for (const b of w.buildings) {
    if (b.hp <= 0 || b.remaining > 0) continue;
    const spec = data.buildings[b.type];
    if (spec.production === 'food') income += spec.rate * spec.tiers[b.level - 1].rateMultiplier;
  }
  income += auras(w, data).food;
  w.foodIncome = income; w.foodUpkeep = upkeep;
  const starving = w.resources.food <= 0.5;
  if (starving) {
    // Hunger stalls growth the same gentle way crowding does — progress
    // decays instead of snapping to zero, so a short famine never wipes
    // a nearly-grown villager.
    w.childTimer = Math.max(0, w.childTimer - dt * 0.5);
    w._starveWarn = (w._starveWarn || 0) + dt;
    if (w._starveWarn > 30) {
      w._starveWarn = 0;
      notify('Your people are hungry! Grow more food before the village can grow.');
    }
    return;
  }
  w._starveWarn = 0;
  if (beds === 0 || free <= 0 || income <= upkeep) {
    w.childTimer = Math.max(0, w.childTimer - dt * 0.5);
    return;
  }
  if (w.resources.food < 20) return; // keep a pantry before growing
  w.childTimer += dt;
  if (w.childTimer >= CHILD_SECONDS) {
    w.childTimer = 0;
    const type = START_CHILD_TYPES[w.troops.length % START_CHILD_TYPES.length];
    if (!data.troops[type]) return;
    const existing = w.troops.length;
    const s = data.troops[type];
    const child = {id:crypto.randomUUID(), type, level:1, hp:s.base.hp, gear:s.defaultGear, owned:[s.defaultGear], armor:null, armorOwned:[], x:8 + (existing % 5) * .65, y:10.8, attackTimer:0, abilityTimer:0, carry:0, phase:'gather', animation:0, workplace:null};
    // Every 10th arrival comes down the road with a trade-name (data/names.json).
    if ((existing + 1) % 10 === 0) {
      const tradeName = makeTradeName(data.names);
      if (tradeName) child.name = tradeName;
    }
    w.troops.push(child);
    push(w, {x:child.x, y:child.y, tx:child.x, ty:child.y - 1.1, kind:'float', text:'+ new villager!', color:'#bfe3a8', life:1.2});
    push(w, {x:child.x, y:child.y, tx:child.x, ty:child.y, kind:'fanfare', life:.8});
    sfx.birth();
    if (child.name) notify(`${child.name} has come down the road, tools in hand! Beds ${housing(w, data).used}/${housing(w, data).beds}.`);
    else notify(`A child has grown into a ${s.name}! Beds ${housing(w, data).used}/${housing(w, data).beds}.`);
  }
}

export function tickVillage(state, data, dt, notify) {
  const w = state.world;
  const aura = auras(w, data);
  if (!state.mission) {
    // Moonchapel mending: slow, visible, capped at each villager's full health.
    if (aura.heal > 0) {
      for (const u of w.troops) {
        if (u.hp <= 0) continue;
        u.hp = Math.min(u.hp + aura.heal * dt, stats(u, data).hp);
      }
    }
    // Hearth trickles, generalized: posted crews pour straight into the
    // stores through the same channel (the old shops smoke food, the new
    // pour-house pours plate). Future shop-resources ride this list.
    for (const key of ['food', 'plate']) {
      if ((aura[key] || 0) > 0) {
        w.resources[key] = (w.resources[key] || 0) + aura[key] * dt;
        w.gathered[key] = (w.gathered[key] || 0) + aura[key] * dt;
      }
    }
    if (aura.xp > 0) gainXp(state, aura.xp * dt);
    // Sage wisdom: 'xp'-effect abilities (the K1/K2 capstone) trickle
    // village XP from the bearer, posted or not, home village only.
    for (const u of w.troops) {
      if (u.hp <= 0) continue;
      try {
        for (const a of unlockedAbilities(u, data)) if (a.effect === 'xp' && a.value > 0) gainXp(state, a.value * dt);
      } catch {}
    }
    // Fletcher's stock (Act VII): craft-only buildings pile one arrow
    // bundle at a time from data `stockRate` — expeditions spend it, the
    // home sim only ever fills the quiver. Capped at one per building.
    for (const b of w.buildings) {
      const rate = data.buildings[b.type]?.stockRate;
      if (!rate || b.hp <= 0 || b.remaining > 0) continue;
      b.stock = Math.min(1, (Number.isFinite(b.stock) ? b.stock : 0) + rate * dt);
    }
    if (aura.survey > 0) {
      w.survey += aura.survey * dt;
      gainXp(state, aura.survey * 0.05 * dt);
      if (w.survey >= SURVEY_FIND) {
        w.survey -= SURVEY_FIND;
        w.resources.food += WILD_HARVEST; w.gathered.food += WILD_HARVEST;
        const post = w.buildings.find(b => b.type === 'scout_post' && b.hp > 0);
        const at = post ? center(post, data) : {x:10, y:8};
        push(w, {x:at.x, y:at.y, tx:at.x, ty:at.y - 1.1, kind:'float', text:`Wild harvest +${WILD_HARVEST} food`, color:'#bfe3a8', life:.9});
        sfx.collect();
      }
    }
  }
  // Quest walkthrough: exactly one active step, auto-claimed with fanfare.
  if (!state.mission) {
    const q = currentQuest(state, data);
    if (q && taskDone(q.task, state, data)) completeQuest(state, data, q, notify);
  }
  // Village levels from XP; each new level can open new rows.
  const before = state.vlevel || 1;
  const now = levelForXp(state.xp || 0);
  if (now > before) {
    state.vlevel = now;
    sfx.win();
    // Level rewards are data (data/levels.json), one grant per level even
    // when a big XP drop skips several. Old saves keep their level and
    // claim nothing retroactively — no duplicate payouts, no migration.
    const notes = [];
    for (let lvl = before + 1; lvl <= now; lvl++) {
      const entry = (data.levels || []).find(l => l.level === lvl);
      const rewards = entry?.rewards || {};
      for (const [k, v] of Object.entries(rewards)) w.resources[k] = (w.resources[k] || 0) + v;
      const text = Object.entries(rewards).map(([k, v]) => `+${v} ${k}`).join(', ');
      if (text) notes.push(`Lvl ${lvl} (${text})`);
    }
    notify(`Village level ${now}! The frontier respects a growing village.${notes.length ? ` Cache: ${notes.join(' · ')}.` : ''}`);
  }
  if (!state.mission) applyExpansion(state, data, notify);
  tickPopulation(state, data, dt, notify);
}

export function questProgress(task, state) {
  const w = state.world;
  if (task.kind === 'build') return {have: w.buildings.filter(b => b.type === task.type && b.hp > 0).length, need: task.count};
  if (task.kind === 'recruit') return {have: w.troops.filter(t => t.type === task.type).length, need: task.count};
  if (task.kind === 'assign') return {have: w.troops.filter(t => !!t.workplace).length, need: task.count};
  if (task.kind === 'population') return {have: w.troops.length, need: task.count};
  if (task.kind === 'level') return {have: state.vlevel || 1, need: task.level};
  if (task.kind === 'gather') return {have: Math.floor(w.gathered[task.resource] || 0), need: task.amount};
  if (task.kind === 'defeat') return {have: (w.flawlessRaids || 0) + (state.home?.flawlessRaids || 0), need: task.count || 1};
  if (task.kind === 'prestige') return {have: w.troops.filter(t => (t.prestigeStars || 0) >= (task.stars || 1)).length, need: task.count || 1};
  if (task.kind === 'wonder') return {have: w.buildings.some(b => b.type === task.type && b.hp > 0 && b.remaining <= 0) ? 1 : 0, need: 1};
  if (task.kind === 'upgrade') {
    const types = Array.isArray(task.type) ? task.type : [task.type];
    const level = task.level || 2;
    const have = types.filter(t => w.buildings.some(b => b.type === t && b.hp > 0 && b.level >= level)).length;
    return {have, need: types.length};
  }
  return {have: 0, need: 1};
}

// HUD-facing growth state: percent toward the next villager plus the
// plain-word reason when progress is paused. Keeps the glimmer of growth
// visible instead of a silent timer.
export function growthStatus(state, data) {
  const w = state.world;
  const pct = Math.max(0, Math.min(100, Math.floor(((w.childTimer || 0) / CHILD_SECONDS) * 100)));
  if (state.mission) return {pct: 0, note: 'expeditions raise no families'};
  if ((w.resources.food || 0) <= 0.5) return {pct, note: 'hungry — grow food'};
  const {beds, free} = housing(w, data);
  if (beds === 0 || free <= 0) return {pct, note: 'no free beds'};
  let income = 0;
  for (const b of w.buildings) {
    if (b.hp <= 0 || b.remaining > 0) continue;
    const spec = data.buildings[b.type];
    if (spec.production === 'food') income += spec.rate * spec.tiers[b.level - 1].rateMultiplier;
  }
  income += auras(w, data).food;
  const mouths = w.troops.filter(t => t.hp >= 0).length;
  if (income <= mouths * UPKEEP_EACH) return {pct, note: 'food barely covers mouths'};
  if ((w.resources.food || 0) < 20) return {pct, note: 'keeping a pantry first'};
  return {pct, note: pct >= 100 ? 'a new villager any moment' : 'growing'};
}
