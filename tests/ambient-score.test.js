import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AmbientScoreEngine} from '../src/audio.js';

const ambient = JSON.parse(await readFile(new URL('../data/ambient-score.json', import.meta.url), 'utf8'));
const legacy = JSON.parse(await readFile(new URL('../data/music.json', import.meta.url), 'utf8'));
const source = await readFile(new URL('../src/audio.js', import.meta.url), 'utf8');
const updateSource = await readFile(new URL('../update/audio.js', import.meta.url), 'utf8');
const updateScore = JSON.parse(await readFile(new URL('../update/music.json', import.meta.url), 'utf8'));

test('ambient score keeps reactive tracks while legacy fallback stays separate', () => {
  assert.equal(ambient.defaultTrack, 'peace_day');
  for (const key of ['peace_day', 'exploration_night', 'raid_siege', 'victory_dawn', 'frontier_fortune']) {
    assert.ok(ambient.tracks[key], `missing ambient track: ${key}`);
    assert.ok(Array.isArray(ambient.tracks[key].phrases));
    assert.ok(ambient.tracks[key].phrases.length > 0);
  }
  assert.equal(ambient.tracks.money_right, undefined);
  assert.ok(Array.isArray(legacy.themes));
  assert.equal(legacy.tracks, undefined);
});

test('active and update soundtrack data stay in sync', () => {
  assert.deepEqual(updateScore, ambient);
});

test('archival audio engine mirrors active shared-bus implementation', () => {
  assert.equal(updateSource, source);
  assert.match(source, /sharedAudioContext/);
  assert.match(source, /sharedAudioOutput/);
  assert.match(source, /frontier_fortune/);
  assert.doesNotMatch(source, /money_right/);
});

test('note conversion remains usable without creating a browser AudioContext', () => {
  const engine = new AmbientScoreEngine();
  assert.ok(Math.abs(engine.noteToFreq('A4') - 440) < 0.001);
  assert.ok(Math.abs(engine.noteToFreq('Bb4') - 466.1637615) < 0.01);
});
