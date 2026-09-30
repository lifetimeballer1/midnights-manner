// Work synchronization: impact sounds fire exactly on visible work moments.
// Every visual driver below mirrors a sine in building-activity.js with the
// SAME rate/seed math, so the CLANG lands on the hammer's peak, the chop on
// the axe fall, the pick on the strike — derived, never simulated. The sim
// is untouched; this only listens. Higher levels work faster, never louder
// than the mix allows.
import {sfx} from './audio.js';
import {hashId} from './footsteps.js';

// Visual-driver mirrors (building-activity.js):
//   workGlint pulse  sin(t*.006 + seed*11)  -> forge hammer peak at sin=1
//   sawStroke swing  sin(t*.012 + seed*8)   -> saw extremes at sin=+/-1
export const HAMMER_PERIOD = Math.PI * 2 / 0.006;
export const SAW_HALF_PERIOD = Math.PI / 0.012;

// Offset aligning a wrap() cycle to a target sine phase.
export function phaseOffset(seed01, mult, rate, phase) {
  return (seed01 * mult - phase) / rate;
}

export function buildingPitch(id) {
  return 0.94 + ((hashId(id) % 1000) / 1000) * 0.12;
}

function rateFor(level) {
  return 1 - 0.05 * Math.max(0, Math.min(5, (Number(level) || 1) - 1));
}

export class WorkSync {
  constructor() { this.last = new Map(); }
  reset() { this.last.clear(); }
  // True exactly once per cycle wrap. First sighting only arms, never fires.
  wrap(id, channel, t, period, offset = 0) {
    if (!(period > 0) || !Number.isFinite(t)) return false;
    const k = id + '|' + channel;
    const idx = Math.floor((t + offset) / period);
    const prev = this.last.get(k);
    this.last.set(k, idx);
    return prev !== undefined && idx > prev;
  }
  prune(alive) {
    for (const k of this.last.keys()) {
      const bar = k.indexOf('|');
      if (!alive.has(bar < 0 ? k : k.slice(0, bar))) this.last.delete(k);
    }
  }
  // One frame of listening for a single crewed, nearby, active building.
  // Returns the fired channel name or null. R injects randomness in tests.
  fire(b, seed01, t, vol, R = Math) {
    if (!b || b.id == null || !(vol > 0)) return null;
    const id = 'w' + b.id, pitch = buildingPitch(b.id), rate = rateFor(b.level);
    const rnd = typeof R?.random === 'function' ? () => R.random() : Math.random;
    switch (b.type) {
      case 'forge':
      case 'smeltery':
      case 'workshop': {
        const soft = b.type === 'forge' ? 1 : 0.6;
        if (this.wrap(id, 'bellows', t, 6300 * rate, phaseOffset(seed01, 5, 0.001, 0))) {
          sfx.bellows({vol: vol * 0.9, pitch});
          sfx.crackle({vol: vol * 0.5 * soft, pitch: pitch * 0.9});
          return 'bellows';
        }
        if (this.wrap(id, 'hammer', t, HAMMER_PERIOD * rate, phaseOffset(seed01, 11, 0.006, Math.PI / 2))) {
          sfx.workHammer({vol: vol * soft, pitch});
          if (rnd() < 0.12) sfx.crackle({vol: vol * 0.4, pitch: pitch * 1.6});
          return 'hammer';
        }
        return null;
      }
      case 'mine':
      case 'emberglass': {
        if (this.wrap(id, 'cart', t, 7800 * rate, phaseOffset(seed01, 7, 0.001, 0))) {
          sfx.wallWood({vol: vol * 0.7, pitch: pitch * 0.7});
          return 'cart';
        }
        if (this.wrap(id, 'pick', t, (1250 + seed01 * 350) * rate, phaseOffset(seed01, 9, 0.005, Math.PI / 2))) {
          sfx.workPick({vol, pitch: pitch * (0.96 + seed01 * 0.08)});
          return 'pick';
        }
        return null;
      }
      case 'lumber':
      case 'timber_yard': {
        if (this.wrap(id, 'log', t, 7500 * rate, phaseOffset(seed01, 4, 0.001, 0))) {
          sfx.wallWood({vol: vol * 0.8, pitch: pitch * 0.6});
          return 'log';
        }
        if (this.wrap(id, 'chop', t, (1500 + seed01 * 350) * rate, phaseOffset(seed01, 6, 0.004, Math.PI / 2))) {
          sfx.workChop({vol, pitch});
          return 'chop';
        }
        return null;
      }
      case 'sawmill': {
        if (this.wrap(id, 'feed', t, 6900 * rate, phaseOffset(seed01, 4, 0.001, 0))) {
          sfx.wallWood({vol: vol * 0.6, pitch: pitch * 0.8});
          return 'feed';
        }
        if (this.wrap(id, 'saw', t, SAW_HALF_PERIOD * rate, phaseOffset(seed01, 8, 0.012, Math.PI / 2))) {
          sfx.saw({vol: vol * 0.8, pitch});
          return 'saw';
        }
        return null;
      }
      default:
        return null;
    }
  }
}
