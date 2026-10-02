import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  AmbientScoreEngine,
  noteToFreq,
  grooveHits,
  trackSupportsMood,
  pickKeeperTrack,
} from '../src/audio.js';

const ambient = JSON.parse(await readFile(new URL('../data/ambient-score.json', import.meta.url), 'utf8'));
const legacy = JSON.parse(await readFile(new URL('../data/music.json', import.meta.url), 'utf8'));
const NOTE_RE = /^([A-G][#b]?)([0-8])$/;

test('keeper soundtrack ships retained originals plus the felt piano 808 suite', () => {
  const keys = Object.keys(ambient.tracks || {});
  assert.deepEqual(keys, [
    'money_right', 'grassblock', 'orchestral', 'desert', 'honeyblock', 'nether',
    'low_horizon', 'granular_rain', 'permafrost', 'cavern_beacon', 'daylight_dissolve',
  ]);
  assert.equal(ambient.defaultTrack, 'low_horizon');
  assert.deepEqual(ambient.songGapSeconds, [22, 48]);
  assert.ok(ambient.tracks[ambient.defaultTrack], 'default track exists');
  for (const [key, track] of Object.entries(ambient.tracks)) {
    assert.ok(track.title, `${key} has a title`);
    assert.ok(track.tempo >= 60 && track.tempo <= 100, `${key} tempo sane`);
    assert.ok(Array.isArray(track.phrases) && track.phrases.length > 0, `${key} has phrases`);
    for (const [i, phrase] of track.phrases.entries()) {
      assert.ok(phrase.bars >= 1 && phrase.bars <= 8, `${key} phrase ${i} bars sane`);
      const lastBeat = phrase.bars * 4;
      for (const n of [phrase.bass, ...(phrase.pad || [])]) {
        assert.match(String(n), NOTE_RE, `${key} phrase ${i} note ${n} parses`);
        const f = noteToFreq(n);
        assert.ok(f >= 30 && f <= 1300, `${key} phrase ${i} note ${n} in range`);
      }
      for (const m of phrase.melody || []) {
        assert.match(String(m.note), NOTE_RE, `${key} phrase ${i} melody ${m.note} parses`);
        assert.ok(m.beat >= 1 && m.beat <= lastBeat + 1, `${key} phrase ${i} beat in phrase`);
        assert.ok(m.dur > 0 && m.vel > 0 && m.vel <= 1, `${key} phrase ${i} dur/vel sane`);
      }
      for (const chime of phrase.chime || []) {
        assert.match(String(chime.note), NOTE_RE, `${key} phrase ${i} chime ${chime.note} parses`);
        assert.ok(chime.beat >= 1 && chime.beat <= lastBeat + 1, `${key} phrase ${i} chime beat in phrase`);
        assert.ok(chime.dur > 0 && chime.vel > 0 && chime.vel <= 1, `${key} phrase ${i} chime mix sane`);
      }
    }
  }
  for (const key of ['low_horizon', 'granular_rain', 'permafrost', 'cavern_beacon', 'daylight_dissolve']) {
    const track = ambient.tracks[key];
    assert.equal(track.felt808, true, `${key} keeps the approved 808 arrangement`);
    assert.equal(track.tempo, 66, `${key} keeps the approved tempo`);
    assert.equal(track.phrases.length, 16, `${key} keeps all sixteen bars`);
  }
});

test('keeper moods cover every calm moment', () => {
  const claims = mood => Object.keys(ambient.tracks).filter(k => trackSupportsMood(ambient.tracks[k], mood));
  for (const mood of ['day', 'night', 'dawn', 'weather', 'prosperous']) {
    assert.ok(claims(mood).length >= 1, `${mood} has a keeper`);
  }
  assert.deepEqual(claims('dawn'), ['desert', 'honeyblock', 'daylight_dissolve']);
  assert.deepEqual(claims('weather'), ['nether', 'granular_rain', 'cavern_beacon']);
  assert.equal(trackSupportsMood({}, 'day'), true, 'missing moods claim everything');
  assert.equal(trackSupportsMood({moods: []}, 'night'), true);
});

test('keeper rotation avoids immediate repeats and falls back to all', () => {
  const tracks = ambient.tracks;
  assert.equal(pickKeeperTrack(tracks, 'dawn', 'desert', () => 0), 'honeyblock');
  assert.equal(pickKeeperTrack(tracks, 'day', 'money_right', () => 0), 'orchestral');
  assert.equal(pickKeeperTrack(tracks, 'upbeat', 'money_right', () => 0), 'grassblock');
  assert.equal(pickKeeperTrack({}, 'day', null, () => 0), null);
});

test('drum grooves stay sparse: hats never denser than quarters', () => {
  const boom = grooveHits('boom', 8);
  assert.deepEqual(boom.filter(h => h.type === 'kick').map(h => h.beat), [1, 4, 6.5]);
  assert.deepEqual(boom.filter(h => h.type === 'snare').map(h => h.beat), [2, 4, 6, 8]);
  const calm = grooveHits('calm', 16);
  assert.deepEqual(calm.filter(h => h.type === 'kick').map(h => h.beat), [1, 9]);
  assert.deepEqual(calm.filter(h => h.type === 'snare').map(h => h.beat), [5, 13]);
  for (const [groove, beats] of [['boom', 8], ['lush', 8], ['calm', 16], ['soulcalm', 16]]) {
    const hats = grooveHits(groove, beats).filter(h => h.type === 'hat').map(h => h.beat).sort((a, b) => a - b);
    assert.ok(hats.length > 0, `${groove} has hats`);
    for (let i = 1; i < hats.length; i++) {
      assert.ok(hats[i] - hats[i - 1] >= 1 - 1e-9, `${groove} hats stay quarter-or-sparser`);
    }
  }
  assert.deepEqual(grooveHits('nope', 8).map(h => `${h.type}@${h.beat}`), grooveHits('boom', 8).map(h => `${h.type}@${h.beat}`));
});

test('engine stays Node-safe: no AudioContext needed for data paths', () => {
  const engine = new AmbientScoreEngine();
  assert.ok(Math.abs(engine.noteToFreq('A4') - 440) < 0.001);
  assert.ok(Math.abs(engine.noteToFreq('Bb4') - 466.1637615) < 0.01);
  assert.doesNotThrow(() => {
    engine.loadScore(ambient);
    engine.setTrack('nether');
    engine.setTrack('nope');
    engine.setCalm(true);
    engine.updateGameState({mood: 'night'});
    engine.attemptRoll();
    engine.stop();
  });
  assert.equal(engine.currentTrackKey, 'nether');
  assert.equal(engine.calm, true);
});

test('legacy soundtrack keeps only battle themes; keepers replace the calm set', () => {
  assert.deepEqual(legacy.themes.map(t => t.id), ['watchfire', 'iron_gate', 'midnight_walls', 'aftermath', 'ashen-choir']);
  assert.equal(legacy.tracks, undefined);
  assert.ok(!legacy.themes.some(t => t.id === 'money_right'), 'generative Money Right tribute is superseded by the fixed keeper');
});
