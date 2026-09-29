// Guided opening: place → collect → recruit → raid → survive.
// Stored OUTSIDE the game save (separate localStorage key) so save schema never changes.
import {grantCentral} from './storage.js';
const KEY = 'midnights-manner-guide-v1';
export const STEPS = [
  { id: 'build', text: 'Raise a building — open BUILD, pick a card, tap an empty tile. A Watchtower or extra Farm is a fine start.' },
  { id: 'collect', text: 'Tap a farm (gold badge) or its +N bubble to gather 20 food into your stores.' },
  { id: 'recruit', text: 'Open PEOPLE and recruit a Warrior (+ Warrior). Needs a barracks and a little food + gold.' },
  { id: 'raid', text: 'Brave the night — tap TEST YOUR DEFENSES below the map. A small scouting party is coming.' },
  { id: 'survive', text: 'Hold the line! Towers and warriors fight on their own. Keep the manor standing.' },
];
function blank() { return { step: 0, done: false, farms: 0, troops: 0, food: 0 }; }
export function loadGuide() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return blank();
    const g = { ...blank(), ...JSON.parse(raw) };
    return g;
  } catch { return blank(); }
}
function store(g) {
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch {}
}
export function skipGuide(g) { g.done = true; g.step = STEPS.length; store(g); }
// Returns the current hint, advancing when conditions are met. Pure enough for tests.
export function updateGuide(g, game) {
  if (g.done) return null;
  const w = game.world;
  if (g.step === 0 && g.farms === 0) { g.farms = w.buildings.length; g.troops = w.troops.length; g.food = Math.floor(w.gathered.food); store(g); }
  if (g.step === 0 && w.buildings.length > g.farms) { g.step = 1; g.food = Math.floor(w.gathered.food); store(g); }
  else if (g.step === 1 && Math.floor(w.gathered.food) >= g.food + 20) { g.step = 2; g.troops = w.troops.length; store(g); }
  else if (g.step === 2 && w.troops.length > g.troops) { g.step = 3; store(g); }
  else if (g.step === 3 && (w.enemies.length > 0 || w.raidPending)) { g.step = 4; store(g); }
  else if (g.step === 4 && !w.enemies.length && !w.raidPending && w.wave > 0) {
    g.done = true; g.step = STEPS.length; store(g);
    const bonus = { wood: 50, food: 60, gold: 60 };
    for (const [k, v] of Object.entries(bonus)) grantCentral(w, game.data, k, v);
    game.notify('First raid survived! The frontier sends supplies (+50 wood, +60 food, +60 gold). Chapter 1 of the STORY awaits.');
    return null;
  }
  // Veterans who already did all of this: quietly retire the guide.
  if (g.step === 0 && w.buildings.length >= 8 && w.troops.length >= 4 && w.wave > 0) { g.done = true; store(g); return null; }
  if (g.done) return null;
  return { index: g.step, total: STEPS.length, text: STEPS[g.step].text };
}
