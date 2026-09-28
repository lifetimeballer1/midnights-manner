import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeUnit, makeBuilding} from '../src/model.js';
import {tickVillage} from '../src/systems/village.js';
import {VERSION} from '../src/storage.js';
import {daySeed, pickRumor, pickLegend, makeTradeName} from '../src/systems/story.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'rumors', 'names', 'legends']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const noop = () => {};
function freshState(d) {
  return {world: createWorld(d), home: null, mission: null, completed: [], unlocks: ['tower'], xp: 0, vlevel: 1, questsCompleted: []};
}

test('story item 1: every quest carries giver, flavor and act', () => {
  assert.equal(data.quests.length, 22, "twenty-two steps: sixteen shipped plus the three Act VII trials plus the three Act VIII legend trials");;
  for (const q of data.quests) {
    assert.ok(typeof q.giver === 'string' && q.giver.length > 0, `${q.id} giver`);
    assert.ok(typeof q.flavor === 'string' && q.flavor.length > 0, `${q.id} flavor`);
    assert.ok(['I', 'II', 'V', 'VI', 'VII', 'VIII'].includes(q.act), `${q.id} act`);
  }
  assert.deepEqual(data.quests.slice(0, 5).map(q => q.act), ['I', 'I', 'I', 'I', 'I']);
  assert.deepEqual(data.quests.slice(5, 8).map(q => q.act), ['II', 'II', 'II']);
  assert.equal(data.quests[8].id, 'chart-the-dark');
  assert.equal(data.quests[8].act, 'V');
  assert.equal(data.quests[9].id, 'tomm-s-flocks');
  assert.equal(data.quests[9].act, 'V');
  assert.equal(data.quests[10].id, 'open-doors');
  assert.equal(data.quests[10].act, 'V');
  assert.equal(data.quests[11].id, 'sarella-s-standard');
  assert.equal(data.quests[11].act, 'V');
  assert.equal(data.quests[12].id, 'west-of-the-chalk');
  assert.equal(data.quests[12].act, 'VI');
  assert.equal(data.quests[13].id, 'first-pour');
  assert.equal(data.quests[13].act, 'VI');
  assert.equal(data.quests[14].id, 'down-dark-water');
  assert.equal(data.quests[14].act, 'VI');
  assert.equal(data.quests[15].id, 'glass-under-stone');
  assert.equal(data.quests[15].act, 'VI');
  assert.equal(data.quests[19].id, 'the-bell-remembers');
  assert.equal(data.quests[19].act, 'VIII');
  assert.equal(data.quests[20].id, 'what-the-water-kept');
  assert.equal(data.quests[20].act, 'VIII');
  assert.equal(data.quests[21].id, 'dawn-of-the-manner');
  assert.equal(data.quests[21].act, 'VIII');
});

test('story item 1: every mission carries act, beat and ceremony lines', () => {
  assert.equal(data.missions.length, 15, "fifteen chapters: nine shipped plus the pale host and twin banners plus the pale court, longest night and dawn");;
  for (const m of data.missions) {
    assert.ok(['III', 'IV', 'V', 'VI', 'VII', 'VIII'].includes(m.act), `${m.id} act`);
    assert.ok(typeof m.beat === 'string' && m.beat.length > 0, `${m.id} beat`);
    for (const key of ['warning', 'victory', 'defeat'])
      assert.ok(typeof m.ceremony?.[key] === 'string' && m.ceremony[key].length > 0, `${m.id} ceremony.${key}`);
  }
});

test('story item 1: quests complete with or without the new flavor fields (no migration)', () => {
  for (const strip of [false, true]) {
    const d = structuredClone(data);
    if (strip) for (const q of d.quests) { delete q.giver; delete q.flavor; delete q.act; }
    const state = freshState(d);
    state.world.buildings.push(makeBuilding('farm', 2, 2, d)); // home starts with 1 farm; this is the 2nd
    tickVillage(state, d, 0.05, noop);
    assert.ok(state.questsCompleted.includes('second-field'), `quest completes (stripped=${strip})`);
    assert.equal(state.xp, 60);
  }
});

test('story item 2: rumors, names and legends tables load with shape', async () => {
  assert.ok(data.rumors.length >= 10, 'a full board of rumors');
  for (const r of data.rumors) assert.ok(r.id && typeof r.text === 'string' && r.text.length <= 140, r.id);
  assert.ok(data.names.given.length >= 10 && data.names.trade.length >= 10, 'name pools');
  assert.equal(data.legends.length, 6, 'one tale per legend');;
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
  assert.equal(makeTradeName(undefined), null);
  assert.equal(makeTradeName({given: [], trade: []}), null);
});

test('story item 2: every 10th arrival earns a trade-name; flavor needs no save keys', () => {
  const d = structuredClone(data);
  const state = freshState(d);
  state.world.buildings.push(makeBuilding('cottage', 2, 2, d), makeBuilding('cottage', 4, 4, d));
  state.world.buildings.push(makeBuilding('farm', 2, 6, d));
  state.world.troops = Array.from({length: 9}, (_, i) => makeUnit('farmer', d, i));
  state.world.resources.food = 100;
  state.world.childTimer = 74.9;
  const messages = [];
  tickVillage(state, d, 0.2, m => messages.push(m));
  assert.equal(state.world.troops.length, 10);
  const arrival = state.world.troops[9];
  assert.ok(typeof arrival.name === 'string' && arrival.name.includes(' '), 'named arrival');
  const [given, ...rest] = arrival.name.split(' ');
  assert.ok(d.names.given.includes(given), 'given name from the pool');
  assert.ok(d.names.trade.includes(rest.join(' ')), 'trade name from the pool');
  assert.ok(messages.some(m => m.includes(arrival.name)), 'village announces the name');
  // Flavor-only: no persisted state of its own. (The living-world layer
  // later added calendar/trade keys under save version 3, the raid
  // clock + unlock re-deal under save version 4, the armor wardrobe
  // under save version 5, prestige stars + the cairn roll under save
  // version 6, the phantom-null cleanup under save version 7, and the
  // tap-reserve clamp under save version 8, and the Phase-6 defense
  // cooldown normalization under save version 9.)
  assert.equal(VERSION, 9);
  for (const key of ['records', 'boardSeen', 'tradeDay', 'calendarDay', 'tradeNames'])
    assert.ok(!(key in state), `no save key ${key}`);
});
