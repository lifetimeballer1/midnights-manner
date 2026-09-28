import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {tickVillage} from '../src/systems/village.js';
import {daySeed,pickRumor,pickLegend,makeTradeName} from '../src/systems/story.js';

const data = Object.fromEntries(await Promise.all(
  ['world','troops','items','abilities','buildings','missions','quests','rumors','names','legends'].map(async n =>
    [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))]
  )
));

const noop = () => {};
function freshState(d) {
  return {
    world: createWorld(d),
    home: null,
    mission: null,
    completed: [],
    unlocks: ['tower'],
    xp: 0,
    vlevel: 1,
    questsCompleted: [],
    tradeDay: null,
    tradesUsed: {},
    calendarDay: null,
    gatheredAtBell: null,
  };
}

test('story item 1: every quest carries giver, flavor and act', () => {
  for (const q of data.quests) {
    assert.ok(q.giver, q.id);
    assert.ok(q.flavor, q.id);
    assert.ok(q.act, q.id);
  }
});

test('story item 1: every mission carries act, beat and ceremony lines', () => {
  for (const m of data.missions) {
    assert.ok(m.ceremony && m.ceremony.warning && m.ceremony.victory && m.ceremony.defeat, m.id);
  }
});

test('story item 1: quests complete with or without the new flavor fields (no migration)', () => {
  for (const strip of [false, true]) {
    const d = structuredClone(data);
    if (strip) for (const q of d.quests) { delete q.giver; delete q.flavor; delete q.act; }
    const state = freshState(d);
    state.world.buildings.push(makeBuilding('farm', 2, 2, d));
    tickVillage(state, d, 0.05, noop);
    assert.ok(state.questsCompleted.includes('second-field'), `quest completes (stripped=${strip})`);
    assert.equal(state.xp, 60);
  }
});

test('story item 2: rumors, names and legends tables load with shape', async () => {
  assert.ok(data.rumors.length >= 10, 'a full board of rumors');
  for (const r of data.rumors) assert.ok(r.id && typeof r.text === 'string' && r.text.length <= 140, r.id);
  assert.ok(data.names.given.length >= 10 && data.names.trade.length >= 10, 'name pools');
  assert.ok(data.legends.length >= 6, 'at least a hearth of legends');
  for (const l of data.legends) assert.ok(l.id && l.title && l.text, l.id);
});

test('story item 2: board and title picks are deterministic per day', () => {
  const seed = daySeed(new Date(2026, 8, 26));
  assert.equal(pickRumor(data.rumors, seed)?.id, pickRumor(data.rumors, seed)?.id);
  assert.equal(pickLegend(data.legends, seed)?.id, pickLegend(data.legends, seed)?.id);
  assert.ok(data.rumors.some(r => r.id === pickRumor(data.rumors, seed).id));
  assert.equal(pickRumor([], seed), null);
  assert.equal(pickLegend(null, seed), null);
});

test('story item 2: trade-names combine a given name with a trade', () => {
  assert.equal(makeTradeName(data.names, () => 0), `${data.names.given[0]} ${data.names.trade[0]}`);
});
