// Tiny original WebAudio synth: short blips only, no assets, cheap on CPU.
// Node-safe: every entry point no-ops without a browser AudioContext.
let ctx = null;
let output = null;
let muted = false;
const lastPlayed = {hit: 0, step: 0, work: 0, combat: 0};
try {
  muted = typeof localStorage !== 'undefined' && localStorage.getItem('midnights-manner-sound') === 'off';
} catch { muted = false; }

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('midnights-manner-sound', muted ? 'off' : 'on'); } catch {}
  const c = muted ? ctx : context();
  if (c && output) {
    output.gain.cancelScheduledValues(c.currentTime);
    output.gain.setTargetAtTime(muted ? 0 : 1, c.currentTime, 0.025);
  }
  return muted;
}
function context() {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (typeof AudioContext !== 'function') return null;
      const c = new AudioContext(), bus = c.createGain();
      bus.gain.value = muted ? 0 : 1;
      bus.connect(c.destination);
      ctx = c;
      output = bus;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
function ac() { return muted ? null : context(); }
export function sharedAudioContext() { return context(); }
export function sharedAudioOutput() { return context() ? output : null; }
export function unlock() { ac(); }
function clockNow() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
function ready(key, gap) {
  const now = clockNow();
  if (now - (lastPlayed[key] || 0) < gap) return false;
  lastPlayed[key] = now;
  return true;
}
function tone(freq, dur = 0.1, { type = 'sine', slide = 0, delay = 0, vol = 0.16 } = {}) {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(30, freq), t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(output);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch {}
}
export const sfx = {
  workChop() {
    if (!ready('work', 150)) return;
    tone(170, 0.065, { type: 'triangle', slide: -58, vol: 0.036 });
    tone(82, 0.09, { type: 'sine', delay: 0.025, slide: -18, vol: 0.022 });
  },
  workPick() {
    if (!ready('work', 150)) return;
    tone(1180, 0.035, { type: 'square', slide: -350, vol: 0.022 });
    tone(205, 0.075, { type: 'triangle', delay: 0.016, slide: -50, vol: 0.026 });
  },
  workHammer() {
    if (!ready('work', 150)) return;
    tone(720, 0.04, { type: 'square', slide: -150, vol: 0.024 });
    tone(220, 0.07, { type: 'triangle', delay: 0.02, slide: -38, vol: 0.028 });
  },
  arrow() {
    if (!ready('combat', 80)) return;
    tone(520, 0.055, { type: 'triangle', slide: 720, vol: 0.035 });
    tone(1260, 0.04, { type: 'sine', delay: 0.025, slide: -390, vol: 0.018 });
  },
  blade() {
    if (!ready('combat', 80)) return;
    tone(1360, 0.045, { type: 'triangle', slide: -470, vol: 0.028 });
    tone(310, 0.055, { type: 'square', delay: 0.025, slide: -70, vol: 0.018 });
  },
  footstep() {
    if (!ready('step', 125)) return;
    tone(82, 0.045, { type: 'triangle', slide: -24, vol: 0.018 });
  },
  gate() { tone(92, 0.22, { type: 'triangle', slide: -28, vol: 0.055 }); tone(145, 0.06, { type: 'square', delay: 0.16, slide: -50, vol: 0.018 }); },
  warning() { [196, 196, 147].forEach((f, i) => tone(f, 0.24, { type: 'sawtooth', delay: i * 0.21, vol: 0.045 })); },
  research() { [440, 554, 659, 880].forEach((f, i) => tone(f, 0.085, { type: 'sine', delay: i * 0.07, vol: 0.065 })); },
  fail() { tone(220, 0.09, { type: 'triangle', slide: -55, vol: 0.055 }); tone(165, 0.12, { type: 'triangle', delay: 0.08, slide: -35, vol: 0.045 }); },
  place() { tone(120, 0.14, { type: 'sine', slide: -70, vol: 0.22 }); tone(62, 0.16, { type: 'triangle', vol: 0.18 }); },
  collect() { tone(880, 0.07, { vol: 0.1 }); tone(1320, 0.09, { delay: 0.06, vol: 0.1 }); },
  // One quiet cue for the entire Collect Ready action, regardless of site count.
  collectBatch() { tone(880, 0.07, { vol: 0.07 }); tone(1320, 0.09, { delay: 0.06, vol: 0.07 }); },
  upgrade() { [523, 659, 784].forEach((f, i) => tone(f, 0.1, { type: 'triangle', delay: i * 0.08, vol: 0.14 })); },
  repair() { tone(440, 0.08, { type: 'triangle', vol: 0.12 }); tone(660, 0.1, { type: 'triangle', delay: 0.07, vol: 0.12 }); },
  buildDone() { [660, 880].forEach((f, i) => tone(f, 0.12, { type: 'triangle', delay: i * 0.09, vol: 0.12 })); },
  destroy() { tone(140, 0.25, { type: 'sawtooth', slide: -90, vol: 0.12 }); tone(70, 0.3, { type: 'triangle', vol: 0.14 }); },
  horn() { tone(196, 0.5, { type: 'sawtooth', vol: 0.1 }); tone(147, 0.6, { type: 'sawtooth', delay: 0.05, vol: 0.1 }); },
  bell() { tone(1046, 0.5, { type: 'sine', vol: 0.12 }); tone(784, 0.6, { type: 'sine', delay: 0.25, vol: 0.1 }); },
  hit() {
    if (!ready('hit', 90)) return;
    tone(210, 0.05, { type: 'square', slide: -80, vol: 0.045 });
    tone(96, 0.075, { type: 'triangle', delay: 0.012, slide: -25, vol: 0.03 });
  },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, { type: 'triangle', delay: i * 0.1, vol: 0.14 })); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.18, { type: 'triangle', delay: i * 0.13, vol: 0.12 })); },
  click() { tone(660, 0.04, { vol: 0.06 }); },
  splash() { tone(900, 0.08, { type: 'sine', slide: -500, vol: 0.07 }); tone(1400, 0.06, { delay: 0.05, vol: 0.05 }); },
  birth() { [660, 830, 990, 1320].forEach((f, i) => tone(f, 0.12, { type: 'triangle', delay: i * 0.09, vol: 0.12 })); },
  quest() { [523, 659, 784].forEach((f, i) => tone(f, 0.12, { type: 'triangle', delay: i * 0.07, vol: 0.13 })); tone(1046, 0.2, { type: 'triangle', delay: 0.22, vol: 0.12 }); },
  unlock() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, { type: 'triangle', delay: i * 0.08, vol: 0.12 })); },
};
