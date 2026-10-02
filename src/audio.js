import {isMuted, sharedAudioContext, sharedAudioOutput, unlock} from './systems/audio.js';

/**
 * High-performance procedural ambient score engine.
 * Voice pooling, lookahead scheduling, procedural wind/rain, game-reactive tracks.
 * Uses the shared audio bus so global mute still works.
 *
 * Keeper soundtrack: calm moods rotate through mood-tagged ambient tracks,
 * including the felt-piano + 808 suite; battle moods are handled by the legacy
 * generative engine (see main.js mood routing). Per-track `groove` selects a
 * drum pattern from grooveHits; `box`/`strings`/`choir` select the lead and
 * pad voices. Calm mode (setCalm) drops the drums, keeps the harmony.
 */

/** Note name (C4..B8, sharps/flats) to frequency. Pure: no AudioContext needed. */
export function noteToFreq(note) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const match = String(note).match(/^([A-G][#b]?)([0-8])$/);
  if (!match) return 440;
  let [, name, oct] = match;
  if (name.includes('b')) {
    const idx = (notes.indexOf(name[0]) - 1 + 12) % 12;
    name = notes[idx];
  }
  const key = notes.indexOf(name);
  const semitonesFromA4 = (key - 9) + (parseInt(oct, 10) - 4) * 12;
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

/**
 * Drum pattern for a groove across totalBeats (1-indexed beats).
 * Pure: returns [{type:'kick'|'snare'|'clap'|'hat', beat, vol}].
 * Hats never land denser than quarter notes — no ticking.
 */
export function grooveHits(groove, totalBeats) {
  const beats = Math.max(1, Math.floor(Number(totalBeats) || 8));
  const patterns = {
    boom: {
      kick: [[1, 0.9], [4, 0.9], [6.5, 0.9]],
      snare: [[2, 0.5], [4, 0.5], [6, 0.5], [8, 0.5]],
      hatStep: 1,
    },
    lush: {
      kick: [[1, 0.7], [5, 0.7]],
      snare: [[2, 0.35], [4, 0.35], [6, 0.35], [8, 0.35]],
      hatStep: 2,
    },
    calm: {
      kick: [[1, 0.5], [9, 0.5]],
      snare: [[5, 0.22], [13, 0.22]],
      hatStep: 4,
    },
    soulcalm: {
      kick: [[1, 0.55], [10.6, 0.55]],
      snare: [[5, 0.28], [13, 0.28]],
      hatStep: 4,
    },
  };
  const pattern = patterns[groove] || patterns.boom;
  const span = groove === 'boom' || groove === 'lush' ? 8 : 16;
  const hits = [];
  for (let base = 0; base < beats; base += span) {
    for (const [beat, vol] of pattern.kick) {
      if (base + beat <= beats + 1e-9) hits.push({type: 'kick', beat: base + beat, vol});
    }
    for (const [beat, vol] of pattern.snare) {
      if (base + beat <= beats + 1e-9) hits.push({type: 'snare', beat: base + beat, vol});
    }
    for (let beat = 1; beat <= Math.min(span, beats - base) + 1e-9; beat += pattern.hatStep) {
      hits.push({type: 'hat', beat: base + beat, vol: 0.1});
    }
  }
  return hits.sort((a, b) => a.beat - b.beat);
}

/** A keeper track claims a mood when its moods list is empty or includes it. */
export function trackSupportsMood(track, mood) {
  const moods = Array.isArray(track?.moods) ? track.moods.filter(m => typeof m === 'string') : [];
  return !moods.length || moods.includes(mood);
}

/**
 * Pick a keeper track key for a mood, avoiding an immediate repeat.
 * Pure apart from the rand source (injectable for tests).
 */
export function pickKeeperTrack(tracks, mood, excludeKey, rand = Math.random) {
  const keys = tracks && typeof tracks === 'object' ? Object.keys(tracks) : [];
  if (!keys.length) return null;
  const eligible = keys.filter(k => trackSupportsMood(tracks[k], mood));
  const pool = eligible.length ? eligible : keys;
  const candidates = pool.length > 1 ? pool.filter(k => k !== excludeKey) : pool;
  const finalists = candidates.length ? candidates : pool;
  const roll = typeof rand === 'function' ? rand() : Math.random();
  return finalists[Math.floor(roll * finalists.length) % finalists.length];
}

export class AmbientScoreEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.feltFilter = null;
    this.delay = null;
    this.delayFeedback = null;
    this.delayFilter = null;

    this.poolSize = 22;
    this.voicePool = [];
    this.poolReady = false;

    this.ambiance = null;
    this.noiseSrc = null;

    this.data = null;
    this.currentTrackKey = 'low_horizon';
    this.phraseIndex = 0;
    this.mood = 'day';
    this.isPlaying = false;
    this.started = false;
    this.calm = false;
    this.schedulerTimer = null;
    this.nextPhraseTime = 0;

    this.easterEggActive = false;
    this.preEggKey = null;
    this.rollInterval = null;
    this.firstRollTimer = null;
  }

  _ensureGraph() {
    unlock();
    const ctx = sharedAudioContext();
    const output = sharedAudioOutput();
    if (!ctx || !output) return false;

    if (this.ctx === ctx && this.masterGain && this.poolReady) return true;

    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(isMuted() ? 0.0001 : 0.32, ctx.currentTime);
    this.masterGain.connect(output);

    this.feltFilter = ctx.createBiquadFilter();
    this.feltFilter.type = 'lowpass';
    this.feltFilter.frequency.setValueAtTime(1300, ctx.currentTime);
    this.feltFilter.Q.setValueAtTime(0.707, ctx.currentTime);

    this.delay = ctx.createDelay();
    this.delay.delayTime.setValueAtTime(0.44, ctx.currentTime);
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.setValueAtTime(0.26, ctx.currentTime);
    this.delayFilter = ctx.createBiquadFilter();
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.setValueAtTime(800, ctx.currentTime);

    this.delay.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delayFilter.connect(this.masterGain);
    this.feltFilter.connect(this.masterGain);
    this.feltFilter.connect(this.delay);

    this._initVoicePool();
    this._initProceduralAmbiance();
    this.poolReady = true;
    return true;
  }

  _initVoicePool() {
    this.voicePool = [];
    for (let i = 0; i < this.poolSize; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.feltFilter);

      try { osc.start(); } catch {}

      this.voicePool.push({ osc, gain, filter, busyUntil: 0 });
    }
  }

  obtainVoice(time, duration) {
    for (const v of this.voicePool) {
      if (v.busyUntil <= time) {
        v.busyUntil = time + duration + 0.05;
        return v;
      }
    }
    const oldest = this.voicePool.reduce((a, b) => (a.busyUntil < b.busyUntil ? a : b));
    oldest.busyUntil = time + duration + 0.05;
    return oldest;
  }

  _initProceduralAmbiance() {
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, sampleRate * 2, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = buffer;
    noiseSrc.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.setValueAtTime(2400, this.ctx.currentTime);
    rainFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);
    const rainGain = this.ctx.createGain();
    rainGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    noiseSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.masterGain);
    noiseSrc.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(this.masterGain);

    try { noiseSrc.start(); } catch {}
    this.noiseSrc = noiseSrc;
    this.ambiance = { windFilter, windGain, rainFilter, rainGain };
  }

  loadScore(scoreJson) {
    this.data = scoreJson;
    if (scoreJson?.defaultTrack && scoreJson.tracks?.[scoreJson.defaultTrack]) {
      this.currentTrackKey = scoreJson.defaultTrack;
    }
  }

  setTrack(trackKey) {
    if (!this.data?.tracks?.[trackKey]) return;
    if (this.currentTrackKey === trackKey) return;

    this.currentTrackKey = trackKey;
    this.phraseIndex = 0;

    if (this.feltFilter && this.ctx) {
      const targetCutoff = this.data.tracks[trackKey].filterCutoff || 1300;
      this.feltFilter.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 1.2);
    }
  }

  setCalm(calm) {
    this.calm = Boolean(calm);
  }

  /** Prefer money_right; fall back to frontier_fortune if that key is all that exists. */
  easterEggKey() {
    if (this.data?.tracks?.money_right) return 'money_right';
    if (this.data?.tracks?.frontier_fortune) return 'frontier_fortune';
    return null;
  }

  initEasterEggDirector() {
    this.clearRollTimers();
    this.firstRollTimer = setTimeout(() => {
      this.attemptRoll();
      this.rollInterval = setInterval(() => this.attemptRoll(), 120000);
    }, 300000);
    this.firstRollTimer?.unref?.();
    this.rollInterval?.unref?.();
  }

  clearRollTimers() {
    if (this.firstRollTimer) { clearTimeout(this.firstRollTimer); this.firstRollTimer = null; }
    if (this.rollInterval) { clearInterval(this.rollInterval); this.rollInterval = null; }
  }

  attemptRoll() {
    if (!this.isPlaying) return;
    if (this.easterEggActive) return;
    const key = this.easterEggKey();
    if (!key || this.currentTrackKey === key) return;
    if (Math.random() <= 0.25) {
      this.easterEggActive = true;
      this.preEggKey = this.currentTrackKey;
      this.setTrack(key);
    }
  }

  updateGameState(state = {}) {
    if (!this.ctx || !this.ambiance) return;
    const now = this.ctx.currentTime;

    if (state.weather === 'rain') {
      this.ambiance.rainGain.gain.setTargetAtTime(0.07, now, 1.0);
      this.ambiance.windFilter.frequency.setTargetAtTime(450, now, 1.5);
    } else {
      this.ambiance.rainGain.gain.setTargetAtTime(0.0001, now, 1.5);
      const windTarget = state.isNight ? 160 : 220;
      this.ambiance.windFilter.frequency.setTargetAtTime(windTarget, now, 2.0);
    }

    // Calm rotation across mood-tagged keeper tracks. Battle moods are served
    // by the legacy generative engine (main.js routes those away from here),
    // so only switch when the current keeper does not claim this mood.
    const mood = typeof state.mood === 'string' && state.mood ? state.mood : 'day';
    this.mood = mood;
    const current = this.data?.tracks?.[this.currentTrackKey];
    if (current && trackSupportsMood(current, mood)) return;
    const pick = pickKeeperTrack(this.data?.tracks, mood, this.currentTrackKey);
    if (pick && pick !== this.currentTrackKey) {
      if (this.currentTrackKey !== this.easterEggKey()) this.easterEggActive = false;
      this.setTrack(pick);
    }
  }

  noteToFreq(note) {
    return noteToFreq(note);
  }

  playPooledVoice(freq, time, dur, vel, type = 'triangle', cutoff = 1350, attack, slideTo) {
    if (!this.poolReady || isMuted()) return;
    const voice = this.obtainVoice(time, dur);
    const { osc, gain, filter } = voice;

    try {
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      if (Number.isFinite(slideTo)) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), time + Math.min(0.25, dur));
      }
      filter.frequency.setValueAtTime(cutoff, time);

      const attackTime = Number.isFinite(attack) ? attack : (type === 'sine' ? 0.12 : 0.025);
      gain.gain.cancelScheduledValues(time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vel * 0.35), time + attackTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.95);
    } catch {}
  }

  play808(freq, targetFreq, time, dur, vel = 0.44) {
    if (!this.poolReady || isMuted()) return;
    const voice = this.obtainVoice(time, dur);
    const { osc, gain, filter } = voice;
    const end = time + dur;
    const glideStart = time + dur * 0.72;
    try {
      osc.type = 'sine';
      osc.frequency.cancelScheduledValues(time);
      osc.frequency.setValueAtTime(freq * 1.035, time);
      osc.frequency.exponentialRampToValueAtTime(freq, time + Math.min(0.09, dur * 0.08));
      osc.frequency.setValueAtTime(freq, glideStart);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, targetFreq || freq), time + dur * 0.98);
      filter.frequency.setValueAtTime(420, time);

      gain.gain.cancelScheduledValues(time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vel * 0.35), time + 0.045);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vel * 0.17), time + dur * 0.74);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
    } catch {}
  }

  playDrumHit(hit, time) {
    if (hit.type === 'kick') {
      this.playPooledVoice(120, time, 0.26, hit.vol, 'sine', 500, 0.005, 40);
    } else if (hit.type === 'snare') {
      this.playPooledVoice(190, time, 0.16, hit.vol, 'triangle', 1400);
    } else if (hit.type === 'clap') {
      for (const offset of [0, 0.02, 0.035]) {
        this.playPooledVoice(1400, time + offset, 0.08, 0.12, 'square', 3000);
      }
    } else if (hit.type === 'hat') {
      this.playPooledVoice(6000, time, 0.04, hit.vol, 'triangle', 4000);
    }
  }

  schedule() {
    if (!this.isPlaying || !this.data?.tracks) return;
    if (!this._ensureGraph()) {
      this.schedulerTimer = setTimeout(() => this.schedule(), 250);
      this.schedulerTimer?.unref?.();
      return;
    }

    const target = isMuted() ? 0.0001 : 0.32;
    try { this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05); } catch {}

    const track = this.data.tracks[this.currentTrackKey];
    if (!track?.phrases?.length) return;

    const phrase = track.phrases[this.phraseIndex];
    const beatSec = 60 / (track.tempo || 48);
    const startTime = Math.max(this.nextPhraseTime, this.ctx.currentTime + 0.05);

    const phraseDuration = phrase.bars * 4 * beatSec;
    if (phrase.bass) {
      if (track.felt808) {
        const nextPhrase = track.phrases[(this.phraseIndex + 1) % track.phrases.length];
        const nextBass = nextPhrase?.bass ? noteToFreq(nextPhrase.bass) : noteToFreq(phrase.bass);
        this.play808(
          noteToFreq(phrase.bass),
          nextBass,
          startTime,
          phraseDuration * 0.95,
          Number.isFinite(phrase.bassVel) ? phrase.bassVel : 0.44,
        );
      } else {
        this.playPooledVoice(noteToFreq(phrase.bass), startTime, phraseDuration * 0.9, 0.55, 'sine', 350);
      }
    }
    if (Array.isArray(phrase.pad)) {
      if (track.felt808) {
        phrase.pad.forEach((n, index) => {
          this.playPooledVoice(
            noteToFreq(n),
            startTime + 0.04 * index,
            phraseDuration * 1.08,
            Number.isFinite(phrase.pianoVel) ? phrase.pianoVel : 0.28,
            'triangle',
            track.filterCutoff || 920,
            0.03,
          );
        });
      } else if (track.strings) {
        for (const n of phrase.pad) {
          const f = noteToFreq(n);
          const dur = phrase.bars * 4 * beatSec * 0.85;
          this.playPooledVoice(f, startTime + 0.06, dur, 0.16, 'sawtooth', 1200, 0.5);
          this.playPooledVoice(f / 2, startTime + 0.06, dur, 0.1, 'triangle', 800, 0.4);
        }
      } else if (track.choir) {
        for (const n of phrase.pad) {
          const f = noteToFreq(n);
          const dur = phrase.bars * 4 * beatSec * 0.85;
          for (const iv of [0, 4, 7]) {
            this.playPooledVoice(f * Math.pow(2, iv / 12), startTime + 0.08, dur, 0.08, 'triangle', 1800, 0.3);
          }
        }
      } else {
        phrase.pad.forEach(n => {
          this.playPooledVoice(noteToFreq(n), startTime + 0.06, phrase.bars * 4 * beatSec * 0.85, 0.22, 'sine', 650);
        });
      }
    }
    if (Array.isArray(phrase.melody)) {
      phrase.melody.forEach(m => {
        const noteTime = startTime + (m.beat - 1) * beatSec;
        const dur = (m.dur || 2.0) * beatSec;
        if (track.box) {
          this.playPooledVoice(noteToFreq(m.note), noteTime, dur * 1.4, (m.vel || 0.5) * 0.8, 'sine', 2200, 0.01);
        } else {
          this.playPooledVoice(noteToFreq(m.note), noteTime, dur, m.vel || 0.5, 'triangle', 1400);
        }
      });
    }
    if (track.felt808 && Array.isArray(phrase.chime)) {
      phrase.chime.forEach(chime => {
        const noteTime = startTime + (chime.beat - 1) * beatSec;
        this.playPooledVoice(
          noteToFreq(chime.note),
          noteTime,
          (chime.dur || 3.3) * beatSec,
          Number.isFinite(chime.vel) ? chime.vel : 0.11,
          'sine',
          2200,
          0.01,
        );
      });
    }
    if (!this.calm && !track.felt808) {
      for (const hit of grooveHits(track.groove || 'boom', phrase.bars * 4)) {
        this.playDrumHit(hit, startTime + (hit.beat - 1) * beatSec);
      }
    }

    const restBars = track.restInterval ? track.restInterval[0] : 2;
    const restDuration = restBars * 4 * beatSec;

    this.nextPhraseTime = startTime + phraseDuration + restDuration;
    this.phraseIndex = (this.phraseIndex + 1) % track.phrases.length;
    const wrapped = this.phraseIndex === 0;

    const egg = this.easterEggKey();
    if (egg && this.easterEggActive && this.currentTrackKey === egg && wrapped) {
      this.easterEggActive = false;
      const back = this.preEggKey && this.data.tracks[this.preEggKey] ? this.preEggKey : this.data.defaultTrack;
      this.preEggKey = null;
      if (back) this.setTrack(back);
    } else if (wrapped) {
      const pick = pickKeeperTrack(this.data.tracks, this.mood, this.currentTrackKey);
      if (pick && pick !== this.currentTrackKey) {
        this.setTrack(pick);
        const gap = Array.isArray(this.data.songGapSeconds) ? this.data.songGapSeconds : [22, 48];
        const minGap = Math.max(0, Number(gap[0]) || 0);
        const maxGap = Math.max(minGap, Number(gap[1]) || minGap);
        this.nextPhraseTime += minGap + Math.random() * (maxGap - minGap);
      }
    }

    const delayUntilNext = (this.nextPhraseTime - this.ctx.currentTime - 0.5) * 1000;
    this.schedulerTimer = setTimeout(() => this.schedule(), Math.max(delayUntilNext, 100));
    this.schedulerTimer?.unref?.();
  }

  /** @returns {boolean} true if playback is running */
  start(scoreData = null) {
    if (scoreData) this.loadScore(scoreData);
    if (!this.data) return false;

    this.started = true;
    unlock();

    if (isMuted()) {
      this.isPlaying = false;
      return false;
    }

    if (this.isPlaying) return true;
    this.isPlaying = true;
    this.nextPhraseTime = 0;
    this.initEasterEggDirector();
    this.schedule();
    return true;
  }

  setEnabled(enabled) {
    if (!this.started) return;
    if (enabled && !isMuted()) {
      if (!this.isPlaying) {
        this.isPlaying = true;
        this.initEasterEggDirector();
        this.schedule();
      } else if (this.masterGain && this.ctx) {
        try { this.masterGain.gain.setTargetAtTime(0.32, this.ctx.currentTime, 0.05); } catch {}
      }
    } else {
      this.stop(false);
    }
  }

  stop(fullStop = true) {
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.clearRollTimers();
    if (this.masterGain && this.ctx) {
      try { this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2); } catch {}
    }
    if (fullStop) {
      this.started = false;
      this.easterEggActive = false;
      this.preEggKey = null;
    }
  }
}
