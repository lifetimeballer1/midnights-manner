// Phase 10 — Living world clock: day/night phases, lamp lighting, weather,
// and the small sim hooks (bolder raiders, shelter-seeking idle hands).
// All pure over world.elapsed: same elapsed, same sky, every load.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeUnit, auras, center, distance} from '../src/model.js';
import {migrateToLatest, exportSave, importSaveBlob, VERSION} from '../src/storage.js';
import {Game} from '../src/game.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickCombat, spawnRaid} from '../src/systems/combat.js';
import {
  DAY_LENGTH, phaseAt, isNight, lightingFor, weatherAt, weatherMods,
  enemyDamageMult, enemySpeedMult, skyGatherBonus, describeClock, clockConfig,
} from '../src/systems/daynight.js';

const names = ['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'levels', 'rumors', 'names', 'legends', 'calendar', 'traders', 'biomes', 'expansion'];
const data = Object.fromEntries(await Promise.all(names.map(async n => {
  try { return [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))]; }
  catch { return [n, {}]; }
})));

const NIGHT_AT = DAY_LENGTH * 0.8; // deep in the night span
const DAY_AT = DAY_LENGTH * 0.3; // mid-morning

test('living sky: phases walk dawn, day, dusk, night across one day', () => {
  assert.equal(phaseAt(0).id, 'dawn');
  assert.equal(phaseAt(DAY_LENGTH * 0.079).id, 'dawn');
  assert.equal(phaseAt(DAY_LENGTH * 0.08).id, 'day');
  assert.equal(phaseAt(DAY_LENGTH * 0.3).id, 'day');
  assert.equal(phaseAt(DAY_LENGTH * 0.5).id, 'dusk');
  assert.equal(phaseAt(DAY_LENGTH * 0.579).id, 'dusk');
  assert.equal(phaseAt(DAY_LENGTH * 0.58).id, 'night');
  assert.equal(phaseAt(DAY_LENGTH * 0.99).id, 'night');
  assert.equal(phaseAt(DAY_LENGTH).id, 'dawn', 'the wheel comes back around');
  assert.equal(phaseAt(DAY_LENGTH + 10).id, phaseAt(10).id, 'same bell, same sky');
});

test('living sky: only night is night, and missing clocks read as day', () => {
  assert.equal(isNight(NIGHT_AT), true);
  assert.equal(isNight(DAY_AT), false);
  assert.equal(phaseAt(NIGHT_AT).night, true);
  assert.equal(phaseAt(DAY_AT).night, false);
  for (const bad of [undefined, null, NaN, -5]) {
    assert.equal(phaseAt(bad).night, false, `elapsed ${String(bad)} opens on a bright field`);
  }
  const custom = {world: {daynight: {dayLength: 600}}};
  assert.equal(phaseAt(200, custom).id, 'day', 'longer days stretch every span');
  assert.equal(phaseAt(NIGHT_AT, {world: {daynight: {dayLength: 30}}}).id, 'night', 'too-short days fall back to the default wheel');
});

test('living sky: every phase has lighting, and night lights the lamps', () => {
  for (const id of ['dawn', 'day', 'dusk', 'night']) {
    const l = lightingFor(id);
    assert.ok(Number.isFinite(l.alpha) && l.alpha >= 0 && l.alpha <= 0.35, `${id} overlay stays readable`);
    assert.ok(Number.isFinite(l.glow) && l.glow >= 0 && l.glow <= 1, `${id} glow is a fraction`);
  }
  assert.equal(lightingFor('day').glow, 0, 'no lamps at noon');
  assert.equal(lightingFor('night').glow, 1, 'every lamp burns at midnight');
  assert.ok(lightingFor('dusk').glow > lightingFor('dawn').glow, 'dusk glows warmer than dawn');
  assert.deepEqual(lightingFor('eclipse'), lightingFor('day'), 'unknown skies read as day');
  const hot = lightingFor('night', {world: {daynight: {lighting: {night: {alpha: 9, glow: 9}}}}});
  assert.ok(hot.alpha <= 0.35 && hot.glow <= 1, 'overrides clamp, never black the screen');
});

test('living sky: weather is deterministic per sky-day, and every sky arrives', () => {
  assert.deepEqual(weatherAt(10), weatherAt(10), 'same bell, same weather');
  assert.equal(weatherAt(10).id, weatherAt(DAY_LENGTH - 1).id, 'weather holds all day');
  const seen = new Set();
  for (let d = 0; d < 60; d++) seen.add(weatherAt(d * DAY_LENGTH + 5).id);
  for (const w of ['clear', 'rain', 'fog']) assert.ok(seen.has(w), `${w} falls within two months`);
  assert.ok(['clear', 'rain', 'fog'].includes(weatherAt(10, null).id), 'missing tables still read a real sky');
  assert.deepEqual(weatherAt(10, null), weatherAt(10, {}), 'missing tables stay deterministic');
  const soaked = {world: {seed: 7, daynight: {rainChance: 100, fogChance: 0}}};
  assert.equal(weatherAt(3 * DAY_LENGTH, soaked).id, 'rain', 'chances are honored');
});

test('living sky: sim hooks default to one, stay small, and honor config', () => {
  assert.equal(enemyDamageMult({}, data), 1, 'flagless worlds fight the old war');
  assert.equal(enemyDamageMult({night: true}, data), 1.1, 'raiders hit +10% after dark');
  assert.equal(enemySpeedMult({}, data), 1);
  assert.equal(enemySpeedMult({weather: 'fog'}, data), 0.9, 'fog slows the march');
  assert.equal(enemySpeedMult({weather: 'rain'}, data), 1, 'rain wets, never slows');
  assert.equal(skyGatherBonus({}, data), 0);
  assert.equal(skyGatherBonus({night: true}, data), -0.05, 'uneasy hands at night');
  assert.equal(skyGatherBonus({weather: 'rain'}, data), 0.05, 'soft earth in the rain');
  assert.equal(skyGatherBonus({night: true, weather: 'rain'}, data), 0, 'the sky nets out');
  const cfg = clockConfig({world: {daynight: {nightEnemyDamage: 0.2}}});
  assert.equal(cfg.nightEnemyDamage, 0.2);
  assert.equal(enemyDamageMult({night: true}, {world: {daynight: {nightEnemyDamage: 0.2}}}), 1.2);
  const mods = weatherMods('fog', data);
  assert.equal(mods.enemySpeed, -0.1);
  assert.equal(weatherMods('clear', data).gather, 0);
});

test('living sky: auras carry the sky but the caps still hold', () => {
  const w = createWorld(data);
  const base = auras(w, data).gather;
  w.night = true;
  assert.equal(auras(w, data).gather, base - 0.05, 'night unease rides the aura');
  delete w.night;
  w.weather = 'rain';
  assert.equal(auras(w, data).gather, base + 0.05, 'rain rides the aura');
  delete w.weather;
  assert.equal(auras(w, data).gather, base, 'flagless worlds play unchanged');
  w.night = true;
  w.weather = 'rain';
  w.calendarBonus = {gather: 10};
  assert.ok(auras(w, data).gather <= 0.45, 'the ceiling holds the whole sky');
  delete w.night;
  delete w.weather;
  delete w.calendarBonus;
});

test('living sky: combat ticks clean under every sky, and night draws blood', () => {
  for (const flags of [{}, {night: true}, {weather: 'rain'}, {weather: 'fog'}, {night: true, weather: 'fog'}]) {
    const w = createWorld(data);
    Object.assign(w, flags);
    spawnRaid(w, 4, null, data, null);
    tickCombat(w, data, 0.05);
    for (const e of w.enemies) assert.ok(Number.isFinite(e.hp), `raider hp finite under ${JSON.stringify(flags)}`);
    for (const t of w.troops) assert.ok(Number.isFinite(t.hp), `troop hp finite under ${JSON.stringify(flags)}`);
  }
  // Night courage, measured: the same raid against the same walls.
  const losses = flags => {
    const w = createWorld(data);
    Object.assign(w, flags);
    spawnRaid(w, 6, null, data, null);
    // Raiders at the walls on tick one: march them onto the hall's doorstep.
    const hall = w.buildings.find(b => b.type === 'hall');
    const c = center(hall, data);
    for (const e of w.enemies) { e.x = c.x + 0.5; e.y = c.y + 0.5; }
    const hp0 = hall.hp;
    for (let i = 0; i < 40; i++) tickCombat(w, data, 0.05);
    return hp0 - hall.hp;
  };
  const dayLoss = losses({}), nightLoss = losses({night: true});
  assert.ok(nightLoss >= dayLoss, `night raid (${nightLoss}) hits at least as hard as day (${dayLoss})`);
});

test('living sky: workless idle hands drift to the hall after dark', () => {
  const distToHall = w => {
    const hall = w.buildings.find(b => b.type === 'hall' && b.hp > 0);
    const u = w.troops[w.troops.length - 1];
    return distance(u, center(hall, data));
  };
  const setup = () => {
    const w = createWorld(data);
    const u = makeUnit('builder', data, 0);
    u.workplace = null;
    u.order = null;
    u.x = 2; u.y = 2; // far corner, far from the hall
    w.troops.push(u);
    return w;
  };
  const day = setup(), d0 = distToHall(day);
  for (let i = 0; i < 20; i++) tickEconomy(day, data, 0.05);
  assert.equal(distToHall(day), d0, 'daylight idles stand their ground');
  const night = setup(), n0 = distToHall(night);
  night.night = true;
  for (let i = 0; i < 20; i++) tickEconomy(night, data, 0.05);
  assert.ok(distToHall(night) < n0, 'night idles seek shelter');
  // Posted and ordered hands hold their ground even after dark.
  const posted = setup();
  posted.night = true;
  const shop = posted.buildings.find(b => b.hp > 0 && b.remaining <= 0 && data.buildings[b.type]?.workplace);
  posted.troops[posted.troops.length - 1].order = {kind: 'hold'};
  const p0 = distToHall(posted);
  for (let i = 0; i < 20; i++) tickEconomy(posted, data, 0.05);
  assert.equal(distToHall(posted), p0, 'ordered hands are never herded');
  assert.ok(shop, 'test sanity: a workplace stands');
});

test('living sky: the game clock rings transitions once, never on load', () => {
  const g = new Game(data);
  g.state.world = createWorld(data);
  g.paused = false;
  g.state.world.elapsed = DAY_AT;
  g.tick(0.05);
  assert.equal(g.state.world.night, false, 'morning is not night');
  assert.equal(g.state.world.weather, weatherAt(DAY_AT, data).id, 'weather rides along');
  const quiet = g.message;
  g.tick(0.05);
  assert.equal(g.message, quiet, 'no bell twice for the same sky');
  g.state.world.elapsed = NIGHT_AT;
  g.tick(0.05);
  assert.equal(g.state.world.night, true, 'the clock finds midnight');
  assert.match(g.message, /Night falls/, 'nightfall is announced');
  const once = g.message;
  g.tick(0.05);
  assert.equal(g.message, once, 'nightfall rings once');
});

test('living sky: old saves never heard of the sky and play unchanged', () => {
  const w = createWorld(data);
  assert.ok(!('night' in w) && !('weather' in w), 'fresh worlds carry no sky keys');
  const v1 = {version: 1, world: structuredClone(w), home: null, mission: null, completed: [], unlocks: ['tower'], xp: 0, questsCompleted: []};
  const m = migrateToLatest(structuredClone(v1), data);
  assert.equal(m.version, VERSION, 'ancient saves still migrate');
  assert.equal(enemyDamageMult(m.world, data), 1, 'unmigrated skies fight the old war');
  assert.equal(skyGatherBonus(m.world, data), 0);
  const g = new Game(data);
  g.state.world = createWorld(data);
  g.paused = false;
  g.tick(0.05); // first tick backfills transient flags, rings nothing
  assert.ok(typeof g.state.world.night === 'boolean' && typeof g.state.world.weather === 'string');
  const res = importSaveBlob(exportSave(g.state), data);
  assert.equal(res.ok, true, 'transient sky keys survive the blob round-trip');
});

test('living sky: the clock reads clean for panels', () => {
  const w = createWorld(data);
  w.elapsed = NIGHT_AT;
  const d = describeClock(w, data);
  assert.equal(d.phase, 'night');
  assert.match(d.line, /Night/);
  assert.match(d.hint, /raiders hit harder/, 'the danger is labeled');
  const morning = describeClock({...w, elapsed: DAY_AT}, data);
  assert.equal(morning.phase, 'day');
});
