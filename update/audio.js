export class AmbientScoreEngine {
  constructor(audioContext = null) {
    this.ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(1350, this.ctx.currentTime);
    this.filter.Q.setValueAtTime(0.707, this.ctx.currentTime);

    this.delay = this.ctx.createDelay();
    this.delay.delayTime.setValueAtTime(0.44, this.ctx.currentTime);

    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.setValueAtTime(0.26, this.ctx.currentTime);

    this.delayFilter = this.ctx.createBiquadFilter();
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.setValueAtTime(800, this.ctx.currentTime);

    this.delay.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delayFilter.connect(this.masterGain);

    this.filter.connect(this.masterGain);
    this.filter.connect(this.delay);

    this.data = null;
    this.currentTrackKey = 'peace_day';
    this.phraseIndex = 0;
    this.timer = null;
    this.isPlaying = false;
  }

  loadScore(scoreJson) {
    this.data = scoreJson;
    if (scoreJson.defaultTrack && scoreJson.tracks[scoreJson.defaultTrack]) {
      this.currentTrackKey = scoreJson.defaultTrack;
    }
  }

  setTrack(trackKey) {
    if (!this.data || !this.data.tracks || !this.data.tracks[trackKey]) return;
    if (this.currentTrackKey === trackKey) return;

    this.currentTrackKey = trackKey;
    this.phraseIndex = 0;

    const track = this.data.tracks[trackKey];
    const targetCutoff = track.filterCutoff || 1350;
    this.filter.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 1.2);
  }

  updateGameState(state = {}) {
    if (state.inRaid || state.raidPending) {
      this.setTrack('raid_siege');
    } else if (state.isVictory || state.isDawn) {
      this.setTrack('victory_dawn');
    } else if (state.isNight) {
      this.setTrack('exploration_night');
    } else {
      this.setTrack('peace_day');
    }
  }

  noteToFreq(note) {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const match = String(note).match(/^([A-G][#b]?)([0-8])$/);
    if (!match) return 440;
    let [_, name, oct] = match;
    if (name.includes('b')) {
      const idx = (notes.indexOf(name[0]) - 1 + 12) % 12;
      name = notes[idx];
    }
    const key = notes.indexOf(name);
    const semitonesFromA4 = (key - 9) + (parseInt(oct, 10) - 4) * 12;
    return 440 * Math.pow(2, semitonesFromA4 / 12);
  }

  playVoice(freq, time, dur, vel, type = 'triangle', cutoff = 1350) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const voiceFilter = this.ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    voiceFilter.type = 'lowpass';
    voiceFilter.frequency.setValueAtTime(cutoff, time);

    const attack = type === 'sine' ? 0.15 : 0.025;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(vel * 0.38, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.95);

    osc.connect(voiceFilter);
    voiceFilter.connect(gain);
    gain.connect(this.filter);

    osc.start(time);
    osc.stop(time + dur + 0.15);
  }

  tick() {
    if (!this.isPlaying || !this.data || !this.data.tracks) return;
    const track = this.data.tracks[this.currentTrackKey];
    if (!track || !track.phrases || !track.phrases.length) return;

    const phrase = track.phrases[this.phraseIndex];
    const beatSec = 60 / (track.tempo || 48);
    const now = this.ctx.currentTime + 0.05;

    // Deep Sub-Bass
    if (phrase.bass) {
      this.playVoice(this.noteToFreq(phrase.bass), now, phrase.bars * 4 * beatSec * 0.9, 0.55, 'sine', 350);
    }

    // Breath Warm Pad
    if (phrase.pad && Array.isArray(phrase.pad)) {
      phrase.pad.forEach(n => {
        this.playVoice(this.noteToFreq(n), now + 0.08, phrase.bars * 4 * beatSec * 0.85, 0.22, 'sine', 700);
      });
    }

    // Felt Plucks & Motifs
    if (phrase.melody && Array.isArray(phrase.melody)) {
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
    this.timer = setTimeout(() => this.tick(), (totalPhraseSec + restSec) * 1000);
  }

  start(scoreData = null) {
    if (scoreData) this.loadScore(scoreData);
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.isPlaying = true;
    this.tick();
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) clearTimeout(this.timer);
    this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2);
  }
}
