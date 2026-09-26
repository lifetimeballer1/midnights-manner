// Village-sim systems: quest walkthrough + XP levels, housing/population,
// map expansion, and assigned-job trickles. All content from data/quests.json;
// numbers below are gentle pacing constants, not content.
import {levelForXp, EXPANSION, auras, housing, center, stats} from '../model.js';
import {sfx} from './audio.js';

const CHILD_SECONDS = 75;      // surplus + free bed grows a villager this fast
const UPKEEP_EACH = 0.03;      // food per second per villager
const SURVEY_FIND = 50;        // survey points that shake out a wild harvest
const WILD_HARVEST = 25;
const START_CHILD_TYPES = ['lumberjack', 'farmer', 'miner', 'fisherman'];

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
  return false;
}

export function currentQuest(state, data) {
  return (data.quests || []).find(q => !(state.questsCompleted || []).includes(q.id)) || null;
}

function completeQuest(state, data, quest, notify) {
  state.questsCompleted.push(quest.id);
  gainXp(state, quest.xp);
  for (const [k, v] of Object.entries(quest.rewards || {})) state.world.resources[k] = (state.world.resources[k] || 0) + v;
  const w = state.world, cp = {x:10, y:8};
  const hall = w.buildings.find(b => b.type === 'hall' && b.hp > 0);
  const at = hall ? center(hall, data) : cp;
  push(w, {x:at.x, y:at.y, tx:at.x, ty:at.y, kind:'fanfare', life:.8});
  push(w, {x:at.x, y:at.y, tx:at.x, ty:at.y - 1.1, kind:'float', text:`+${quest.xp} XP`, color:'#ffe9a8', life:.9});
  sfx.quest();
  const rewardText = Object.entries(quest.rewards || {}).map(([k, v]) => `+${v} ${k}`).join(', ');
  notify(`Quest complete: ${quest.name}! +${quest.xp} XP${rewardText ? ` · ${rewardText}` : ''}.`);
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
    w.childTimer = 0;
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
    const child = {id:crypto.randomUUID(), type, level:1, hp:s.base.hp, gear:s.defaultGear, owned:[s.defaultGear], x:8 + (existing % 5) * .65, y:10.8, attackTimer:0, abilityTimer:0, carry:0, phase:'gather', animation:0, workplace:null};
    w.troops.push(child);
    push(w, {x:child.x, y:child.y, tx:child.x, ty:child.y - 1.1, kind:'float', text:'+ new villager!', color:'#bfe3a8', life:1.2});
    push(w, {x:child.x, y:child.y, tx:child.x, ty:child.y, kind:'fanfare', life:.8});
    sfx.birth();
    notify(`A child has grown into a ${s.name}! Beds ${housing(w, data).used}/${housing(w, data).beds}.`);
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
    if (aura.food > 0) {
      w.resources.food += aura.food * dt;
      w.gathered.food += aura.food * dt;
    }
    if (aura.xp > 0) gainXp(state, aura.xp * dt);
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
    notify(`Village level ${now}! The frontier respects a growing village.`);
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
  return {have: 0, need: 1};
}
