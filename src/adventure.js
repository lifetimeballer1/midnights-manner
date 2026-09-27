// Adventure drawer helpers (Phase 1): pure, DOM-free derivations for the
// restructured Adventure panel (Home / Quests / Expeditions / Campaign /
// Chronicle). No rendering, no state mutation, no save keys — presentation
// only. Safe to unit-test in Node.
import {currentQuest, questProgress, growthStatus} from './systems/village.js';
import {missionLocked} from './systems/campaign.js';
import {capable, expeditionSpec, expeditionStatus} from './systems/expeditions.js';
import {housing, XP_LEVELS} from './model.js';
import {threatOf} from './systems/raid-director.js';

// Five main sections. 'market' (Grey Market trading) is intentionally NOT a
// main tab — it stays reachable through the HOME trade-winds block and as a
// deep-link category so existing marketBlock() keeps working.
export const ADVENTURE_SECTIONS = ['home', 'quests', 'expeditions', 'chapters', 'lore'];
export const ADVENTURE_LABELS = {home: 'Home', quests: 'Quests', expeditions: 'Expeditions', chapters: 'Campaign', lore: 'Chronicle'};

// Village-path quest cards: done / active (first incomplete) / upcoming,
// each with have/need progress. Never mutates state.
export function questCards(data, state) {
  const done = state?.questsCompleted || [];
  const activeId = currentQuest(state, data)?.id || null;
  return (data?.quests || []).map(q => ({
    id: q.id,
    name: q.name,
    status: done.includes(q.id) ? 'done' : (q.id === activeId ? 'active' : 'upcoming'),
    progress: questProgress(q.task, state),
  }));
}

// Campaign chapter cards: current / completed / locked / available.
// Gate logic delegates to missionLocked() — requires + requiresAny.
export function campaignCards(data, state) {
  const completed = state?.completed || [];
  const currentId = state?.mission?.id || null;
  return (data?.missions || []).map(m => {
    const locked = missionLocked(m, completed);
    return {
      id: m.id,
      chapter: m.chapter,
      state: m.id === currentId ? 'current' : completed.includes(m.id) ? 'completed' : locked ? 'locked' : 'available',
      locked,
      requires: m.requires || [],
      requiresAny: m.requiresAny || [],
    };
  });
}

// Woodland ranging roster, split into units currently out vs capable idle
// hands that could be sent. Reads data/troops.json expedition fields only.
export function expeditionRoster(world, data) {
  const out = [], idle = [];
  for (const u of world?.troops || []) {
    if (!u || u.hp <= 0 || !capable(data, u)) continue;
    const name = u.name || data?.troops?.[u.type]?.name || u.type;
    if (u.expedition) {
      out.push({id: u.id, type: u.type, name, status: expeditionStatus(u, data)});
    } else {
      const spec = expeditionSpec(data, u) || {};
      idle.push({
        id: u.id, type: u.type, name,
        yields: {...(spec.yields || {})},
        durationSec: spec.durationSec || 0,
        risk: spec.risk || 0,
      });
    }
  }
  return {out, idle};
}

function rewardText(rewards) {
  return Object.entries(rewards || {}).map(([k, v]) => `+${v} ${k}`).join(' · ') || 'Honor alone';
}

// Plain-word hint for a quest task kind, for the Home next-action line.
export function taskHint(task, data) {
  if (!task) return '';
  const n = v => (v ?? 1);
  switch (task.kind) {
    case 'build': return `Raise ${n(task.count)} ${data?.buildings?.[task.type]?.name || task.type}`;
    case 'recruit': return `Recruit ${n(task.count)} ${data?.troops?.[task.type]?.name || task.type}`;
    case 'assign': return `Give ${n(task.count)} villagers a workplace`;
    case 'population': return `Grow to ${n(task.count)} villagers`;
    case 'level': return `Reach village level ${task.level}`;
    case 'gather': return `Gather ${task.amount} ${task.resource}`;
    case 'upgrade': {
      const types = Array.isArray(task.type) ? task.type : [task.type];
      return `Raise ${types.map(t => data?.buildings?.[t]?.name || t).join(' + ')} to tier ${task.level || 2}`;
    }
    case 'defeat': return 'Win a flawless defense, home or away';
    case 'prestige': return 'Ring a veteran back through the bell';
    case 'wonder': return `Raise the ${data?.buildings?.[task.type]?.name || task.type}`;
    default: return '';
  }
}

// The ONE obvious next action for Home, by priority:
// live expedition > current quest step > next open chapter > send ranging >
// Grey Market. Pure — the panel turns kind/goto/ids into buttons.
export function computeNextAction(state, data) {
  if (state?.mission) {
    const m = (data?.missions || []).find(m => m.id === state.mission.id);
    return {kind: 'mission', label: m ? `Return to ${m.name}` : 'Return to the expedition', detail: 'The expedition is live — your home village waits.', goto: 'chapters'};
  }
  const q = currentQuest(state, data);
  if (q) {
    const p = questProgress(q.task, state);
    return {kind: 'quest', label: q.name, detail: `${taskHint(q.task, data)} · ${Math.min(p.have, p.need)}/${p.need} · +${q.xp} XP`, goto: 'quests'};
  }
  const cards = campaignCards(data, state);
  const next = (data?.missions || []).find(m => cards.find(c => c.id === m.id)?.state === 'available');
  if (next) {
    return {kind: 'chapter', label: `Chapter ${next.chapter}: ${next.name}`, detail: `First-clear: ${rewardText(next.rewards)}`, goto: 'chapters', missionId: next.id};
  }
  const roster = expeditionRoster(state?.world, data);
  if (roster.idle.length) {
    const u = roster.idle[0];
    return {kind: 'expedition', label: `Send ${u.name} ranging`, detail: `Yields ${rewardText(u.yields)} · ~${u.durationSec}s`, goto: 'expeditions', unitId: u.id};
  }
  return {kind: 'market', label: 'Visit the Grey Market', detail: 'Three wagons trade each day, dawn to dawn.', goto: 'market'};
}

// Everything Home renders, in one snapshot: objective, survival,
// settlement goals, next action. Read-only.
export function homeSummary(state, data) {
  const w = state?.world || {};
  const quest = currentQuest(state, data);
  const progress = quest ? questProgress(quest.task, state) : null;
  const questsDone = (state?.questsCompleted || []).length;
  const questsTotal = (data?.quests || []).length;
  const lvl = state?.vlevel || 1;
  const xp = Math.floor(state?.xp || 0);
  const lo = XP_LEVELS[lvl - 1] ?? 0;
  const hi = XP_LEVELS[lvl] ?? (lo + 1);
  const nextLevel = (data?.levels || []).find(l => l.level === lvl + 1) || null;
  let beds = null;
  try { beds = housing(w, data); } catch { beds = null; }
  const income = w.foodIncome, upkeep = w.foodUpkeep;
  const foodBalance = Number.isFinite(income) && Number.isFinite(upkeep) ? income - upkeep : null;
  const growth = growthStatus(state, data);
  const raidIncoming = !!w.raidPending;
  const raidActive = (w.enemies || []).length > 0;
  // Raid director (Phase 2): threat band + quiet-until-next-horn for Home.
  let threat = null, nextRaidIn = null;
  try { threat = threatOf(w, state, data); } catch { threat = null; }
  if (!state?.mission && !raidIncoming && !raidActive && Number.isFinite(w.nextRaidAt) && Number.isFinite(w.elapsed))
    nextRaidIn = Math.max(0, Math.ceil(w.nextRaidAt - w.elapsed));
  const cards = campaignCards(data, state);
  const chaptersDone = cards.filter(c => c.state === 'completed').length;
  const roster = expeditionRoster(w, data);
  return {
    quest, progress, questsDone, questsTotal,
    lvl, xp, xpLo: lo, xpHi: hi, nextLevel,
    beds, foodBalance, growth,
    wave: (w.wave || 0) + 1, raidIncoming, raidActive, threat, nextRaidIn,
    raidCount: raidIncoming ? w.raidPending.count : raidActive ? w.enemies.length : 0,
    away: !!state?.mission,
    chaptersDone, chaptersTotal: cards.length,
    ranging: roster.out.length, idleRangers: roster.idle.length,
    next: computeNextAction(state, data),
  };
}
