// Tiny original WebAudio synth: short blips only, no assets, cheap on CPU.
// Node-safe: every entry point no-ops without a browser AudioContext.
let ctx = null;
let muted = false;
let lastHit = 0;
try {
  muted = typeof localStorage !== 'undefined' && localStorage.getItem('midnights-manner-sound') === 'off';
} catch { muted = false; }

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('midnights-manner-sound', muted ? 'off' : 'on'); } catch {}
  return muted;
}
function ac() {
  if (muted || typeof window === 'undefined') return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
export function unlock() { ac(); }
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
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch {}
}
export const sfx = {
  place() { tone(120, 0.14, { type: 'sine', slide: -70, vol: 0.22 }); tone(62, 0.16, { type: 'triangle', vol: 0.18 }); },
  collect() { tone(880, 0.07, { vol: 0.1 }); tone(1320, 0.09, { delay: 0.06, vol: 0.1 }); },
  upgrade() { [523, 659, 784].forEach((f, i) => tone(f, 0.1, { type: 'triangle', delay: i * 0.08, vol: 0.14 })); },
  repair() { tone(440, 0.08, { type: 'triangle', vol: 0.12 }); tone(660, 0.1, { type: 'triangle', delay: 0.07, vol: 0.12 }); },
  horn() { tone(196, 0.5, { type: 'sawtooth', vol: 0.1 }); tone(147, 0.6, { type: 'sawtooth', delay: 0.05, vol: 0.1 }); },
  hit() {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - lastHit < 90) return;
    lastHit = now;
    tone(210, 0.05, { type: 'square', slide: -80, vol: 0.05 });
  },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, { type: 'triangle', delay: i * 0.1, vol: 0.14 })); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.18, { type: 'triangle', delay: i * 0.13, vol: 0.12 })); },
  click() { tone(660, 0.04, { vol: 0.06 }); },
};
