import {isMuted, sharedAudioContext, sharedAudioOutput} from './systems/audio.js';

/**
 * Context-reactive Minecraft/C418-style ambient score engine.
 * Switches tracks by game state (peace, night, raid, victory/dawn).
 * Includes a rare "money_right" tribute easter egg during calm play.
 * Routes through the shared audio bus so the global mute control works.
 */
export class AmbientScoreEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.filter = null;
    this.delay = null;
    this.delayFeedback = null;
    this.delayFilter = null;

    this.data = null;
    this.currentTrackKey = 'peace_day';
    this.phraseIndex = 0;
    this.timer = null;
    this.isPlaying = false;
    this.started = false;

    // Easter egg: 25% roll after 5 minutes of calm, then every 2 minutes
    this.easterEggActive = false;
    this.rollTimer = null;
    this.firstRollTimer = null;
  }

  _ensureGraph() {
    const ctx = sharedAudioContext();
    const output = sharedAudioOutput();
    if (!ctx || !output) return false;

    if (this.ctx === ctx && this.masterGain) return true;

    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(isMuted() ? 0.0001 : 0.32, ctx.currentTime);
    this.masterGain.connect(output);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(1350, ctx.currentTime);
    this.filter.Q.setValueAtTime(0.707, ctx.currentTime);

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

    this.filter.connect(this.masterGain);
    this.filter.connect(this.delay);

    return true;
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

    if (this.filter && this.ctx) {
      const targetCutoff = this.data.tracks[trackKey].filterCutoff || 1350;
      this.filter.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 1.2);
    }
  }

  initTimerRolls() {
    this.clearRollTimers();

    // First check at exactly 5 minutes
    this.firstRollTimer = setTimeout(() => {
      this.attemptEasterEggRoll();
      // Recurring check every 2 minutes after that
      this.rollTimer = setInterval(() => this.attemptEasterEggRoll(), 120000);
    }, 300000);
  }

  clearRollTimers() {
    if (this.firstRollTimer) {
      clearTimeout(this.firstRollTimer);
      this.firstRollTimer = null;
    }
    if (this.rollTimer) {
      clearInterval(this.rollTimer);
      this.rollTimer = null;
    }
  }

  attemptEasterEggRoll() {
    // Only during calm base-building; never interrupt event tracks
    if (this.currentTrackKey !== 'peace_day' || this.easterEggActive) return;
    if (!this.data?.tracks?.money_right) return;
    if (Math.random() <= 0.25) {
      this.easterEggActive = true;
      this.setTrack('money_right');
    }
  }

  /**
   * Map live game flags to a score track.
   * Preserves money_right easter egg until it finishes or an event interrupts.
   */
  updateGameState(state = {}) {
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
    // else: stay on money_right until the cycle completes
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

  playVoice(freq, time, dur, vel, type = 'triangle', cutoff = 1350) {
    if (!this.ctx || !this.filter || isMuted()) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const voiceFilter = this.ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    voiceFilter.type = 'lowpass';
    voiceFilter.frequency.setValueAtTime(cutoff, time);

    const attack = type === 'sine' ? 0.15 : 0.025;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vel * 0.38), time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.95);

    osc.connect(voiceFilter);
    voiceFilter.connect(gain);
    gain.connect(this.filter);

    osc.start(time);
    osc.stop(time + dur + 0.15);
  }

  tick() {
    if (!this.isPlaying || !this.data?.tracks) return;
    if (!this._ensureGraph()) return;

    const target = isMuted() ? 0.0001 : 0.32;
    try {
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    } catch {}

    const track = this.data.tracks[this.currentTrackKey];
    if (!track?.phrases?.length) return;

    const phrase = track.phrases[this.phraseIndex];
    const beatSec = 60 / (track.tempo || 48);
    const now = this.ctx.currentTime + 0.05;

    if (phrase.bass) {
      this.playVoice(this.noteToFreq(phrase.bass), now, phrase.bars * 4 * beatSec * 0.9, 0.55, 'sine', 350);
    }

    if (Array.isArray(phrase.pad)) {
      phrase.pad.forEach(n => {
        this.playVoice(this.noteToFreq(n), now + 0.08, phrase.bars * 4 * beatSec * 0.85, 0.22, 'sine', 700);
      });
    }

    if (Array.isArray(phrase.melody)) {
      phrase.melody.forEach(m => {
        const noteTime = now + (m.beat - 1) * beatSec;
        const dur = (m.dur || 2.0) * beatSec;
        this.playVoice(this.noteToFreq(m.note), noteTime, dur, m.vel || 0.5, 'triangle', 1500);
      });
    }

    const totalPhraseSec = phrase.bars * 4 * beatSec;
    const restBars = track.restInterval ? track.restInterval[0] : 2;
    const restSec = restBars * 4 * beatSec;

    this.phraseIndex = (this.phraseIndex + 1) % track.phrases.length;

    // After one full cycle of the tribute, return to peace
    if (this.currentTrackKey === 'money_right' && this.phraseIndex === 0) {
      this.easterEggActive = false;
      this.setTrack('peace_day');
    }

    this.timer = setTimeout(() => this.tick(), (totalPhraseSec + restSec) * 1000);
  }

  start(scoreData = null) {
    if (scoreData) this.loadScore(scoreData);
    if (!this.data) return;

    this.started = true;
    if (isMuted()) {
      this.isPlaying = false;
      return;
    }

    if (!this._ensureGraph()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    if (this.isPlaying) return;
    this.isPlaying = true;
    this.initTimerRolls();
    this.tick();
  }

  setEnabled(enabled) {
    if (!this.started) return;
    if (enabled && !isMuted()) {
      if (!this.isPlaying) {
        this.isPlaying = true;
        this.initTimerRolls();
        this.tick();
      } else if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0.32, this.ctx.currentTime, 0.05);
      }
    } else {
      this.stop(false);
    }
  }

  stop(fullStop = true) {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.clearRollTimers();
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2);
      } catch {}
    }
    if (fullStop) {
      this.started = false;
      this.easterEggActive = false;
    }
  }
}
