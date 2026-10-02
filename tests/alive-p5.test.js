import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WorkSync} from '../src/systems/worksync.js';
import {soundtrackMood} from '../src/systems/ambience.js';
import {MusicPlayer, createPhrase} from '../src/music.js';
import {trackSupportsMood, pickKeeperTrack} from '../src/audio.js';
import {sfx, resetAudioPools, audioStats, toggleMute, isMuted} from '../src/systems/audio.js';

const music = JSON.parse(await readFile(new URL('../data/music.json', import.meta.url)));
const keepers = JSON.parse(await readFile(new URL('../data/ambient-score.json', import.meta.url)));
const clear = {world: {daynight: {dayLength: 300, rainChance: 0, fogChance: 0}}};
const buildings = n => Array.from({length: n}, (_, i) => ({type: 'cottage', hp: 9, remaining: 0, x: i, y: 0}));

 test('battle identities validate and phrase cleanly', () => {
  assert.equal(music.themes.length, 5);
  const ids = new Set(music.themes.map(t => t.id));
  assert.equal(ids.size, 5, 'theme ids stay unique');
  for (const id of ['watchfire', 'iron_gate', 'midnight_walls', 'aftermath', 'ashen-choir']) {
    const theme = music.themes.find(t => t.id === id);
    assert.ok(theme, `${id} exists`);
    const phrase = createPhrase(theme, 0, false);
    assert.ok(phrase.notes.length > 10, `${id} phrases real notes`);
    assert.ok(phrase.duration > 0 && phrase.duration < 60, `${id} phrase duration sane`);
  }
});

test('calm moods belong to keeper songs, battle moods to battle themes', () => {
  const supports = mood => music.themes.filter(t => Array.isArray(t.moods) && t.moods.includes(mood)).map(t => t.id);
  const keepersClaim = mood => Object.keys(keepers.tracks).filter(k => trackSupportsMood(keepers.tracks[k], mood));
  assert.deepEqual(keepersClaim('dawn'), ['desert', 'honeyblock', 'daylight_dissolve']);
  assert.deepEqual(keepersClaim('prosperous'), ['orchestral', 'honeyblock', 'low_horizon', 'daylight_dissolve']);
  assert.deepEqual(supports('aftermath'), ['aftermath']);
  assert.ok(supports('danger').includes('midnight_walls'), 'raid music gains urgency');
});

test('mood routing: dawn, prosperity, aftermath without breaking the old map', () => {
  assert.equal(soundtrackMood({elapsed: 5, buildings: []}, clear), 'dawn');
  assert.equal(soundtrackMood({elapsed: 60, buildings: buildings(14)}, clear, {vlevel: 8}), 'prosperous');
  assert.equal(soundtrackMood({elapsed: 240, buildings: buildings(14)}, clear, {vlevel: 9}), 'night', 'prosperous nights keep lantern intimacy');
  assert.equal(soundtrackMood({elapsed: 60, buildings: buildings(3)}, clear, {vlevel: 8}), 'day', 'small holds stay humble');
  const mem = {};
  assert.equal(soundtrackMood({elapsed: 60, buildings: [], enemies: [{hp: 4}]}, clear, {memory: mem}), 'danger');
  assert.equal(soundtrackMood({elapsed: 80, buildings: []}, clear, {memory: mem}), 'aftermath');
  assert.equal(soundtrackMood({elapsed: 155, buildings: []}, clear, {memory: mem}), 'day', 'aftermath fades');
  assert.equal(soundtrackMood({elapsed: 60, buildings: [], raidPending: {timer: 5}}, clear, {memory: mem}), 'tension', 'warnings beat aftermath');
  assert.equal(soundtrackMood({elapsed: 60, buildings: [], enemies: [{hp: 5}]}, clear), 'danger', 'old calls without memory still work');
});

test('eligible-only picks stay deterministic on narrow pools', () => {
  const player = new MusicPlayer(music);
  player.mood = 'aftermath';
  player.pickTheme();
  assert.equal(player.score.id, 'aftermath', 'aftermath has exactly one claimant');
  assert.equal(pickKeeperTrack(keepers.tracks, 'dawn', 'desert', () => 0), 'honeyblock', 'dawn rotates keepers without repeats');
});

test('mute round-trips without sticking', () => {
  const before = isMuted();
  toggleMute();
  assert.equal(isMuted(), !before);
  toggleMute();
  assert.equal(isMuted(), before);
});

test('destroyed and unfinished buildings never fire work cycles', () => {
  resetAudioPools();
  const sync = new WorkSync();
  const base = JSON.stringify(audioStats().pools);
  assert.equal(sync.fire({id: 'forge-x', type: 'forge', level: 6, hp: 0}, 0.5, 5000, 1, {random: () => 0}), null);
  assert.equal(sync.fire({id: 'mine-x', type: 'mine', level: 2, hp: 10, remaining: 4}, 0.5, 5000, 1, {random: () => 0}), null);
  assert.equal(JSON.stringify(audioStats().pools), base, 'ruins and scaffolds stay silent');
  sfx.workHammer();
  assert.notEqual(JSON.stringify(audioStats().pools), base, 'live buildings still ring');
});
