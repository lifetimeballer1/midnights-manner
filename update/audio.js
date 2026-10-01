import {isMuted, sharedAudioContext, sharedAudioOutput, unlock} from './systems/audio.js';

/**
 * High-performance procedural ambient score engine.
 * Voice pooling, lookahead scheduling, procedural wind/rain, game-reactive tracks.
 * Uses the shared audio bus so global mute still works.
 */
export class AmbientScoreEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.feltFilter = null;
    this.delay = null;
    this.delayFeedback = null;
    this.delayFilter = null;

    this.poolSize = 14;
    this.voicePool = [];
    this.poolReady = false;

    this.ambiance = null;
    this.noiseSrc = null;

    this.data = null;
    this.currentTrackKey = 'peace_day';
    this.phraseIndex = 0;
    this.isPlaying = false;
    this.started = false;
    this.schedulerTimer = null;
    this.nextPhraseTime = 0;

    this.easterEggActive = false;
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

  initEasterEggDirector() {
    this.clearRollTimers();
    this.firstRollTimer = setTimeout(() => {
      this.attemptRoll();
      this.rollInterval = setInterval(() => this.attemptRoll(), 120000);
    }, 300000);
  }

  clearRollTimers() {
    if (this.firstRollTimer) { clearTimeout(this.firstRollTimer); this.firstRollTimer = null; }
    if (this.rollInterval) { clearInterval(this.rollInterval); this.rollInterval = null; }
  }

  attemptRoll() {
    if (this.currentTrackKey !== 'peace_day' || this.easterEggActive) return;
    if (!this.data?.tracks?.frontier_fortune) return;
    if (Math.random() <= 0.25) {
      this.easterEggActive = true;
      this.setTrack('frontier_fortune');
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

    if (state.inRaid || state.raidPending) {
      this.easterEggActive = false;
      this.setTrack('raid_siege');
    } else if (state.isVictory || state.isDawn) {
      this.easterEggActive = false;
      this.setTrack('victory_dawn');
    } else if (state.isNight) {
      this.easterEggActive = false;
      this.setTrack('exploration_night');
    } else if (!this.easterEggActive) {
      this.setTrack('peace_day');
    }
  }

  noteToFreq(note) {
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

  playPooledVoice(freq, time, dur, vel, type = 'triangle', cutoff = 1350) {
    if (!this.poolReady || isMuted()) return;
    const voice = this.obtainVoice(time, dur);
    const { osc, gain, filter } = voice;

    try {
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      filter.frequency.setValueAtTime(cutoff, time);

      const attack = type === 'sine' ? 0.12 : 0.025;
      gain.gain.cancelScheduledValues(time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vel * 0.35), time + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.95);
    } catch {}
  }

  schedule() {
    if (!this.isPlaying || !this.data?.tracks) return;
    if (!this._ensureGraph()) {
      this.schedulerTimer = setTimeout(() => this.schedule(), 250);
      return;
    }

    const target = isMuted() ? 0.0001 : 0.32;
    try { this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05); } catch {}

    const track = this.data.tracks[this.currentTrackKey];
    if (!track?.phrases?.length) return;

    const phrase = track.phrases[this.phraseIndex];
    const beatSec = 60 / (track.tempo || 48);
    const startTime = Math.max(this.nextPhraseTime, this.ctx.currentTime + 0.05);

    if (phrase.bass) {
      this.playPooledVoice(this.noteToFreq(phrase.bass), startTime, phrase.bars * 4 * beatSec * 0.9, 0.55, 'sine', 350);
    }
    if (Array.isArray(phrase.pad)) {
      phrase.pad.forEach(n => {
        this.playPooledVoice(this.noteToFreq(n), startTime + 0.06, phrase.bars * 4 * beatSec * 0.85, 0.22, 'sine', 650);
      });
    }
    if (Array.isArray(phrase.melody)) {
      phrase.melody.forEach(m => {
        const noteTime = startTime + (m.beat - 1) * beatSec;
        const dur = (m.dur || 2.0) * beatSec;
        this.playPooledVoice(this.noteToFreq(m.note), noteTime, dur, m.vel || 0.5, 'triangle', 1400);
      });
    }

    const phraseDuration = phrase.bars * 4 * beatSec;
    const restBars = track.restInterval ? track.restInterval[0] : 2;
    const restDuration = restBars * 4 * beatSec;

    this.nextPhraseTime = startTime + phraseDuration + restDuration;
    this.phraseIndex = (this.phraseIndex + 1) % track.phrases.length;

    if (this.currentTrackKey === 'frontier_fortune' && this.phraseIndex === 0) {
      this.easterEggActive = false;
      this.setTrack('peace_day');
    }

    const delayUntilNext = (phraseDuration + restDuration - 0.5) * 1000;
    this.schedulerTimer = setTimeout(() => this.schedule(), Math.max(delayUntilNext, 100));
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
    }
  }
}
