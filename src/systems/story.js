// Story-flavor helpers: deterministic picks from data tables.
// Pure functions — no DOM, no save state. Same calendar day yields the same
// pick for every player, which is what makes the notice board feel shared.
export function daySeed(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 86400000);
  return date.getFullYear() * 1000 + day;
}

function hash(n) {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^= x >>> 15) >>> 0;
}

export function pickRumor(rumors, seed) {
  if (!Array.isArray(rumors) || !rumors.length) return null;
  const bag = [];
  for (const r of rumors) {
    const w = Math.max(1, r.weight || 1);
    for (let i = 0; i < w; i++) bag.push(r);
  }
  return bag[hash(seed) % bag.length];
}

export function pickLegend(legends, seed) {
  if (!Array.isArray(legends) || !legends.length) return null;
  return legends[hash(seed ^ 0x9e3779b9) % legends.length];
}

// Trade-names for arriving villagers ("Wren the shepherd", "Bram Ash").
// All pools are original writing in data/names.json.
export function makeTradeName(names, rand = Math.random) {
  const given = names?.given, trade = names?.trade;
  if (!given?.length || !trade?.length) return null;
  return `${given[Math.floor(rand() * given.length)]} ${trade[Math.floor(rand() * trade.length)]}`;
}
