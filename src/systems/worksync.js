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
  // Returns the fired channel name or null. R injects randomness in tests;
  // opts carries ambience context ({night}) for residential hush.
  fire(b, seed01, t, vol, R = Math, opts = {}) {
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
      case 'farm':
      case 'pasture':
      case 'grove':
      case 'frostgrove': {
        // Crop sweeps breathe on sin(t*.004+seed*7); rustle every fourth
        // extreme so fields whisper instead of chattering.
        if (this.wrap(id, 'rustle', t, (Math.PI / 0.004) * 2 * rate, phaseOffset(seed01, 7, 0.004, Math.PI / 2))) {
          sfx.rustle({vol: vol * 0.9, pitch});
          return 'rustle';
        }
        return null;
      }
      case 'mill': {
        // The wheel turns on angle=t*.0018+seed*6.28; wooden creaks twice
        // per revolution with a soft grind riding along.
        if (this.wrap(id, 'creak', t, (Math.PI / 0.0018) * rate, phaseOffset(seed01, 6.28, 0.0018, 0))) {
          sfx.creak({vol, pitch});
          return 'creak';
        }
        return null;
      }
      case 'bakery': {
        if (this.wrap(id, 'clatter', t, 8300 * rate, phaseOffset(seed01, 3, 0.001, 0))) {
          sfx.wallWood({vol: vol * 0.4, pitch: pitch * 1.6});
          return 'clatter';
        }
        if (this.wrap(id, 'oven', t, 4100 * rate, phaseOffset(seed01, 5, 0.0015, Math.PI / 2))) {
          sfx.crackle({vol: vol * 0.6, pitch: pitch * 0.8});
          return 'oven';
        }
        return null;
      }
      case 'mason_yard': {
        if (this.wrap(id, 'block', t, 9100 * rate, phaseOffset(seed01, 4, 0.001, 0))) {
          sfx.wallStone({vol: vol * 0.5, pitch: pitch * 0.8});
          return 'block';
        }
        if (this.wrap(id, 'chisel', t, (1700 + seed01 * 400) * rate, phaseOffset(seed01, 6, 0.004, Math.PI / 2))) {
          sfx.workPick({vol: vol * 0.8, pitch: pitch * 0.6});
          return 'chisel';
        }
        return null;
      }
      case 'fletcher': {
        if (this.wrap(id, 'twang', t, 7400 * rate, phaseOffset(seed01, 3, 0.001, 0))) {
          sfx.arrow({vol: vol * 0.4, pitch: pitch * 0.9});
          return 'twang';
        }
        if (this.wrap(id, 'shave', t, (2100 + seed01 * 400) * rate, phaseOffset(seed01, 6, 0.004, Math.PI / 2))) {
          sfx.saw({vol: vol * 0.5, pitch: pitch * 0.7});
          return 'shave';
        }
        return null;
      }
      case 'tannery': {
        if (this.wrap(id, 'bucket', t, 8800 * rate, phaseOffset(seed01, 3, 0.001, 0))) {
          sfx.splash({vol: vol * 0.35, pitch: pitch * 0.8});
          return 'bucket';
        }
        if (this.wrap(id, 'scrape', t, (2400 + seed01 * 400) * rate, phaseOffset(seed01, 6, 0.003, Math.PI / 2))) {
          sfx.saw({vol: vol * 0.5, pitch: pitch * 0.5});
          return 'scrape';
        }
        return null;
      }
      case 'butchery': {
        // Chopping-board work, never the forge hammer.
        if (this.wrap(id, 'board', t, (1900 + seed01 * 400) * rate, phaseOffset(seed01, 6, 0.004, Math.PI / 2))) {
          sfx.workChop({vol: vol * 0.7, pitch: pitch * 0.7});
          return 'board';
        }
        return null;
      }
      case 'pond':
      case 'blackwater-weir':
      case 'deephole': {
        if (this.wrap(id, 'lap', t, (3600 + seed01 * 800) * rate, phaseOffset(seed01, 5, 0.0012, Math.PI / 2))) {
          sfx.splash({vol: vol * 0.5, pitch: pitch * 1.1});
          return 'lap';
        }
        return null;
      }
      case 'market':
      case 'market-square': {
        if (this.wrap(id, 'coin', t, 6800 * rate, phaseOffset(seed01, 3, 0.001, 0))) {
          sfx.coin({vol: vol * 0.8, pitch});
          return 'coin';
        }
        if (this.wrap(id, 'murmur', t, 11500 * rate, phaseOffset(seed01, 5, 0.0008, 0))) {
          sfx.murmur({vol: vol * 0.8, pitch});
          return 'murmur';
        }
        return null;
      }
      case 'cottage':
      case 'hall':
      case 'longhouse':
      case 'storehouse':
      case 'grand-granary': {
        // Homes hush: hearth crackle after dark, a rare door creak by day.
        // Never workshop noise.
        if (opts.night) {
          if (this.wrap(id, 'hearth', t, (5200 + seed01 * 900) * rate, phaseOffset(seed01, 5, 0.001, Math.PI / 2))) {
            sfx.crackle({vol: vol * 0.5, pitch: pitch * 0.85});
            return 'hearth';
          }
        } else if (this.wrap(id, 'door', t, 14800 * rate, phaseOffset(seed01, 3, 0.0007, 0))) {
          sfx.creak({vol: vol * 0.5, pitch: pitch * 1.1});
          return 'door';
        }
        return null;
      }
      case 'barracks': {
        if (this.wrap(id, 'drill', t, (2600 + seed01 * 500) * rate, phaseOffset(seed01, 6, 0.003, Math.PI / 2))) {
          if (rnd() < 0.25) sfx.arrow({vol: vol * 0.4, pitch});
          else sfx.blade({vol: vol * 0.5, pitch: pitch * (0.9 + seed01 * 0.2)});
          return 'drill';
        }
        if (this.wrap(id, 'shield', t, 7900 * rate, phaseOffset(seed01, 3, 0.001, 0))) {
          sfx.hit({vol: vol * 0.5, pitch: pitch * 0.7});
          return 'shield';
        }
        return null;
      }
      default:
        return null;
    }
  }
}
