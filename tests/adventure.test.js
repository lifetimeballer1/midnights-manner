// Phase 1 Adventure UI: DOM-free tests for src/adventure.js pure helpers.
// Presentation only — these tests pin section roster derivation and the
// Home next-action priority without touching saves or game logic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeUnit} from '../src/model.js';
import {startExpedition} from '../src/systems/expeditions.js';
import {claimRegion,regionById} from '../src/systems/expansion.js';
import {
  ADVENTURE_SECTIONS, campaignCards, computeNextAction, expeditionRoster,
  homeSummary, questCards, taskHint,
} from '../src/adventure.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests',
   'levels', 'rumors', 'names', 'legends', 'expansion', 'biomes']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));

function freshState() {
  const d = structuredClone(data);
  return {
    data: d,
    state: {
      world: createWorld(d), home: null, mission: null,
      completed: [], unlocks: ['tower'], xp: 0, vlevel: 1, questsCompleted: [],
    },
  };
}

test('adventure sections are the five phase-1 tabs; market stays a deep link', () => {
  assert.deepEqual(ADVENTURE_SECTIONS, ['home', 'quests', 'expeditions', 'chapters', 'lore']);
  assert.ok(!ADVENTURE_SECTIONS.includes('market'), 'trading lives in Home, not the tab bar');
});

test('questCards: first quest active, rest upcoming, progress always shaped', () => {
  const {data: d, state} = freshState();
  const cards = questCards(d, state);
  assert.equal(cards.length, 24);
  assert.equal(cards[0].status, 'active');
  assert.ok(cards.slice(1).every(c => c.status === 'upcoming'));
  for (const c of cards) {
    assert.ok(Number.isFinite(c.progress.have) && Number.isFinite(c.progress.need), `${c.id} progress`);
  }
  state.questsCompleted.push(cards[0].id);
  const next = questCards(d, state);
  assert.equal(next[0].status, 'done');
  assert.equal(next[1].status, 'active');
});

test('campaignCards: gates mirror missionLocked, incl. requiresAny branches', () => {
  const {data: d, state} = freshState();
  const cards = campaignCards(d, state);
  // 15 chapters through Act VIII; the Ironshield conquest arc (Phase 8)
  // adds chapters 15-17; H5 adds Thornband 18-20; H6 adds Cinder 21-23; H7 adds Pale Host 24-26; J1 crowns Act XI at chapter 34, J2 orders the arc 34-36 with the crown at 39, J3 branches at shared chapter 37, J4 reconverges at 38 — deliberate pin.
  assert.equal(cards.length, 41);
  assert.equal(cards[0].state, 'available', 'first chapter open');
  assert.ok(cards.slice(1).every(c => c.state === 'locked'));
  // Classic AND gate.
  state.completed.push('first-harvest');
  assert.equal(campaignCards(d, state).find(c => c.id === 'timber-line').state, 'available');
  // OR gate: one branch suffices.
  state.completed.push('ashen-ford');
  const coin = campaignCards(d, state).find(c => c.id === 'coin-and-cinder');
  assert.equal(coin.state, 'available');
  assert.deepEqual(coin.requiresAny, ['ashen-ford', 'hollow-dam']);
  // Completed + current states.
  state.completed.push('coin-and-cinder');
  state.mission = {id: 'coin-and-cinder', status: 'active'};
  const again = campaignCards(d, state);
  assert.equal(again.find(c => c.id === 'coin-and-cinder').state, 'current');
  assert.equal(again.find(c => c.id === 'first-harvest').state, 'completed');
});

test('campaign destination gates become the obvious frontier action', () => {
  const {data:d,state}=freshState();
  state.questsCompleted=d.quests.map(q=>q.id);
  state.completed=d.missions.filter(m=>!['the-pale-court','the-longest-night','dawn'].includes(m.id)).map(m=>m.id);
  let card=campaignCards(d,state).find(c=>c.id==='the-pale-court');
  assert.equal(card.prerequisitesMet,true,'banner prerequisites are already satisfied');
  assert.deepEqual(card.destination,{id:'southreach',name:'Southreach Crossing',claimed:false});
  assert.equal(card.state,'locked','wild destination holds the chapter shut');
  let next=computeNextAction(state,d);
  assert.equal(next.kind,'frontier');
  assert.equal(next.label,'Claim Southreach Crossing');
  assert.equal(next.missionId,'the-pale-court');
  claimRegion(state.world,regionById(d.expansion,'southreach'));
  card=campaignCards(d,state).find(c=>c.id==='the-pale-court');
  assert.equal(card.destination.claimed,true);
  assert.equal(card.state,'available');
  next=computeNextAction(state,d);
  assert.equal(next.kind,'chapter');
  assert.equal(next.missionId,'the-pale-court');
  assert.match(next.detail,/Southreach Crossing/);
});

test('expeditionRoster: capable idle hands listed, warriors excluded, out tracked', () => {
  const {data: d, state} = freshState();
  state.world.troops = [];
  const forage = makeUnit('forager', d, 0);
  const warrior = makeUnit('warrior', d, 1);
  state.world.troops.push(forage, warrior);
  let roster = expeditionRoster(state.world, d);
  assert.equal(roster.out.length, 0);
  assert.equal(roster.idle.length, 1);
  assert.equal(roster.idle[0].id, forage.id);
  assert.deepEqual(roster.idle[0].yields, {food: 25, wood: 15});
  assert.equal(roster.idle[0].durationSec, 60);
  assert.equal(roster.idle[0].risk, 0.1);
  assert.ok(startExpedition(state.world, d, forage, () => 0.999));
  roster = expeditionRoster(state.world, d);
  assert.equal(roster.out.length, 1);
  assert.equal(roster.idle.length, 0);
  assert.match(roster.out[0].status, /treeline|Gathering|Back/);
});

test('computeNextAction priority: away > quest > chapter > ranging > market', () => {
  const {data: d, state} = freshState();
  // Fresh village: current quest step.
  let n = computeNextAction(state, d);
  assert.equal(n.kind, 'quest');
  assert.equal(n.goto, 'quests');
  // Away on expedition beats everything.
  state.mission = {id: 'first-harvest', status: 'active'};
  n = computeNextAction(state, d);
  assert.equal(n.kind, 'mission');
  assert.equal(n.goto, 'chapters');
  state.mission = null;
  // Path walked, chapters open: next chapter named.
  state.questsCompleted = d.quests.map(q => q.id);
  n = computeNextAction(state, d);
  assert.equal(n.kind, 'chapter');
  assert.equal(n.missionId, 'first-harvest');
  assert.equal(n.goto, 'chapters');
  // Everything cleared, ranger idle: send them out.
  state.completed = d.missions.map(m => m.id);
  state.world.troops = [makeUnit('forager', d, 0)];
  n = computeNextAction(state, d);
  assert.equal(n.kind, 'expedition');
  assert.equal(n.goto, 'expeditions');
  assert.ok(n.unitId, 'names the unit to send');
  // Nothing left at all: Grey Market.
  state.world.troops = state.world.troops.filter(t => d.troops[t.type]?.expedition);
  state.world.troops = [];
  n = computeNextAction(state, d);
  assert.equal(n.kind, 'market');
  assert.equal(n.goto, 'market');
});

test('taskHint speaks plain words per quest kind', () => {
  const {data: d} = freshState();
  assert.match(taskHint({kind: 'build', type: 'farm', count: 2}, d), /Raise 2/);
  assert.match(taskHint({kind: 'gather', resource: 'wood', amount: 50}, d), /Gather 50 wood/);
  assert.match(taskHint({kind: 'level', level: 3}, d), /level 3/);
  assert.equal(taskHint(null, d), '');
  assert.equal(taskHint({kind: 'mystery'}, d), '');
});

test('homeSummary snapshots home without mutating state or saves', () => {
  const {data: d, state} = freshState();
  const before = JSON.stringify(state);
  const s = homeSummary(state, d);
  assert.equal(JSON.stringify(state), before, 'read-only: no new save keys, no drift');
  assert.equal(s.questsDone, 0);
  assert.equal(s.questsTotal, 24);
  assert.equal(s.chaptersTotal, 41);
  assert.equal(s.chaptersDone, 0);
  assert.equal(s.lvl, 1);
  assert.equal(s.nextLevel.level, 2);
  assert.deepEqual(s.nextLevel.rewards, {wood: 30});
  assert.equal(s.wave, 1);
  assert.equal(s.away, false);
  assert.ok(s.next && typeof s.next.label === 'string' && typeof s.next.goto === 'string');
  assert.ok(s.growth && Number.isFinite(s.growth.pct) && typeof s.growth.note === 'string');
});
