// Endgame doctrine (Phase 12): the late war. Everything here is gated off
// village level, so mid-game villages never see it — the ladder only opens
// at data/endgame.json `minLevel` (8). All tuning numbers live in data;
// this module is pure math + spawn helpers, never DOM.
import {distance, center} from '../model.js';

export function endgameConfig(data) {
  return data?.endgame || {};
}

// Escalating late-game threat ladder. Returns the highest tier whose
// minLevel the village has reached, or null below the gate — null means
// the classic curves run untouched.
export function threatTier(data, vlevel) {
  const cfg = endgameConfig(data);
  const ladder = cfg.threatLadder || [];
  let best = null;
  for (const tier of ladder) {
    if ((vlevel || 1) >= (tier.minLevel || Infinity) && (!best || tier.minLevel > best.minLevel)) best = tier;
  }
  return best;
}

// Multiplicative scaling the ladder lays over the classic 65+12N raid
// curve. Null-safe: no config or no tier reads exactly 1.
export function endgameScaling(data, vlevel) {
  const tier = threatTier(data, vlevel);
  if (!tier) return {hp: 1, damage: 1, partyBonus: 0, eliteChance: 0, siegeChance: 0};
  return {
    hp: tier.hpMult || 1,
    damage: tier.dmgMult || 1,
    partyBonus: tier.partyBonus || 0,
    eliteChance: tier.eliteChance || 0,
    siegeChance: tier.siegeChance || 0,
  };
}

// Boss waves are calendar, not chance: every Nth wave past the minimum,
// once the village is seasoned enough. Deterministic so the herald never
// lies and tests never flake.
export function isBossWave(data, vlevel, wave) {
  const rule = endgameConfig(data).bossRule;
  if (!rule) return false;
  return wave >= (rule.minWave || 10)
    && (vlevel || 1) >= (rule.minLevel || 9)
    && wave % (rule.every || 5) === 0;
}

// Boss rotation: eligible bosses in data order, cycling by boss-wave
// index so each boss-wave number always heralds the same crown.
export function bossFor(data, vlevel, wave) {
  const bosses = (endgameConfig(data).bosses || []).filter(b =>
    (vlevel || 1) >= (b.minLevel || 9) && wave >= (b.minWave || 10));
  if (!bosses.length || !isBossWave(data, vlevel, wave)) return null;
  const rule = endgameConfig(data).bossRule || {};
  const every = rule.every || 5, minWave = rule.minWave || 10;
  return bosses[Math.floor((wave - minWave) / every) % bosses.length];
}

export function bossStats(boss, wave) {
  return {
    hp: (boss.hpBase || 1000) + (boss.hpPerWave || 80) * wave,
    damage: (boss.dmgBase || 40) + (boss.dmgPerWave || 3) * wave,
  };
}

// Elite variants: veterans of a dozen raids, marked so the combat loop
// and the loot ledger can both read them. Returns the enemy for chaining.
export function applyElite(enemy, data, prefix) {
  const mod = endgameConfig(data).elites || {};
  enemy.elite = true;
  enemy.eliteName = prefix || (mod.prefixes || ['Elder'])[0];
  enemy.hp *= mod.hpMult || 2.2;
  enemy.maxHp = enemy.hp;
  enemy.damage *= mod.dmgMult || 1.4;
  return enemy;
}

export function eliteLootMult(data) {
  return endgameConfig(data).elites?.lootMult || 3;
}

// Mark a share of a fresh raid as elites. Bosses are never elites —
// the crown needs no prefix. Random is injectable for deterministic tests.
// Returns the number of elites marked.
export function markElites(world, data, chance, random = Math.random) {
  const prefixes = endgameConfig(data).elites?.prefixes || ['Elder'];
  let marked = 0;
  for (const e of world.enemies) {
    if (e.hp <= 0 || e.role === 'boss' || e.elite) continue;
    if (random() < chance) {
      applyElite(e, data, prefixes[Math.floor(random() * prefixes.length) % prefixes.length]);
      marked++;
    }
  }
  return marked;
}

// Spawn options for a home raid at this village level: null below the
// gate (the classic curves run untouched), scaling + elite marking above.
// Bosses are spawned separately by the herald so their entrance is staged.
export function endgameSpawnOpts(state, data) {
  const scaling = endgameScaling(data, state.vlevel || 1);
  if (!threatTier(data, state.vlevel || 1)) return null;
  return {scaling, eliteChance: scaling.eliteChance};
}

// Siege units pressure walls, not villagers: rams chew (wallDamage) and
// bombards shell from afar. A role is siege when data says so.
export function isSiegeRole(data, role) {
  return !!data?.world?.enemyRoles?.[role]?.siege;
}

// Spawn a boss onto a live raid. Wave-scaled from its data spec so the
// same crown keeps pace with the village that earned it.
export function spawnBoss(world, data, boss, wave) {
  const s = bossStats(boss, wave);
  const width = world.bounds?.w || data.world.width || 20;
  const height = world.bounds?.h || data.world.height || 17;
  const foe = {
    id: crypto.randomUUID(),
    x: width - 0.5, y: Math.min(height - 0.5, Math.floor(height / 2) + 0.5),
    hp: s.hp, maxHp: s.hp, damage: s.damage,
    role: 'boss', bossId: boss.id, bossName: boss.name,
    speed: boss.speed || 0.6, range: boss.range || 1.3,
    wallDamage: boss.wallDamage || 3, faction: 'boss',
    attackTimer: 0, animation: 0, summonTimer: 0, slamTimer: 0, enraged: false,
  };
  world.enemies.push(foe);
  return foe;
}

// Boss lookup, generalized (Phase 8): the home ladder lives in
// data/endgame.json `bosses`; conquest leaders live in data/conquest.json
// `leaders`. Same machinery, two shelves — no content ids in code.
export function bossSpec(data, id) {
  const own = (endgameConfig(data).bosses || []).find(b => b.id === id);
  if (own) return own;
  const extra = data?.conquest?.leaders;
  return Array.isArray(extra) ? extra.find(b => b?.id === id) || null : null;
}

// Distinct boss mechanics, ticked from combat for every living boss:
//  - war-slam: periodic AoE against nearby buildings (walls included)
//  - muster: summons capped adds on a timer
//  - enrage: below the data HP fraction, damage (and maybe speed) rise
//  - dread aura: allies inside the radius hit harder
// Returns an events list for heralds ({kind:'slam'|'summon'|'enrage'}).
export function bossTick(world, data, boss, dt) {
  const spec = bossSpec(data, boss.bossId);
  if (!spec || boss.hp <= 0) return [];
  const events = [];
  const mech = spec.mechanics || {};
  if (!boss.enraged && mech.enrage && boss.hp <= boss.maxHp * (mech.enrage.hpFrac || 0.3)) {
    boss.enraged = true;
    boss.damage *= mech.enrage.dmgMult || 1.5;
    if (mech.enrage.speedMult) boss.speed = (boss.speed || 0.6) * mech.enrage.speedMult;
    events.push({kind: 'enrage', boss});
  }
  if (mech.slam) {
    boss.slamTimer = (boss.slamTimer || 0) + dt;
    if (boss.slamTimer >= (mech.slam.everySec || 8)) {
      boss.slamTimer = 0;
      const radius = mech.slam.radius || 1.6;
      let hits = 0;
      for (const b of world.buildings) {
        if (b.hp <= 0) continue;
        if (distance(boss, center(b, data)) <= radius + (data.buildings[b.type]?.size || 1) / 2) {
          b.hp = Math.max(0, b.hp - (mech.slam.damage || 40));
          if (b.hp <= 0) world.raidLosses = (world.raidLosses || 0) + 1;
          hits++;
          if (world.effects.length < 140) world.effects.push({x: b.x, y: b.y, tx: b.x, ty: b.y, kind: 'slam', life: 0.4});
        }
      }
      if (hits) events.push({kind: 'slam', boss, hits});
    }
  }
  if (mech.summon) {
    boss.summonTimer = (boss.summonTimer || 0) + dt;
    if (boss.summonTimer >= (mech.summon.everySec || 20)) {
      boss.summonTimer = 0;
      const adds = world.enemies.filter(e => e.hp > 0 && e.summoned).length;
      const room = Math.max(0, (mech.summon.cap || 6) - adds);
      const n = Math.min(mech.summon.count || 2, room);
      const roleSpec = data.world.enemyRoles?.[mech.summon.role] || {};
      for (let i = 0; i < n; i++) {
        const hp = 65 + (world.wave || 1) * 12, dmg = 9 + (world.wave || 1) * 2;
        world.enemies.push({
          id: crypto.randomUUID(), x: boss.x + (i - n / 2) * 0.7, y: boss.y + 0.7,
          hp: hp * (roleSpec.hp || 1), maxHp: hp * (roleSpec.hp || 1),
          damage: dmg * (roleSpec.damage || 1), role: mech.summon.role,
          faction: 'boss', summoned: true, attackTimer: i * 0.2, animation: 0,
        });
      }
      if (n) events.push({kind: 'summon', boss, count: n});
    }
  }
  return events;
}

// Dread aura: troops facing a boss's court fight uphill — allies of a
// living boss inside its aura radius deal bonus damage. Read by combat
// before enemy strikes land.
export function bossAuraMult(world, data, enemy) {
  let mult = 1;
  for (const b of world.enemies) {
    if (b.hp <= 0 || b.role !== 'boss' || b.id === enemy.id) continue;
    const spec = bossSpec(data, b.bossId);
    const aura = spec?.mechanics?.aura;
    if (!aura) continue;
    if (distance(enemy, b) <= (aura.radius || 4)) mult *= aura.dmgMult || 1.3;
  }
  return mult;
}

// ---- Endless settlement improvement ----

// Manner Renown: repeatable settlement levels for maxed villages. Stored
// on the world (combat reads it live), costs escalate forever, every
// level sharpens defenses and sweetens salvage.
export function renownLevel(world) {
  return Math.max(0, world.renown || 0);
}

export function renownCost(data, level) {
  const cfg = endgameConfig(data).renown || {};
  const base = cfg.baseCost || {gold: 400, food: 300};
  const growth = Math.pow(cfg.costGrowth || 1.6, level || 0);
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.ceil(v * growth)]));
}

export function renownDamageMult(world, data) {
  const per = endgameConfig(data).renown?.damagePerLevel || 0.03;
  return 1 + per * renownLevel(world);
}

export function renownLootMult(world, data) {
  const per = endgameConfig(data).renown?.lootPerLevel || 0.05;
  return 1 + per * renownLevel(world);
}

export function renownAvailable(state, data) {
  const cfg = endgameConfig(data).renown || {};
  return (state.vlevel || 1) >= (cfg.minLevel || 9)
    && state.world.buildings.some(b => b.type === 'hall' && b.hp > 0 && b.remaining <= 0);
}

// ---- Renown rewards (Phase 5): the milestone table ----
// Data-driven and read live from world.renown — no new save fields, so old
// saves heal their milestones on the next read/purchase. Every entry is a
// title, a cosmetic, an unlock or a cap bump; never a production multiplier
// (the surplus cure must not seed a new surplus). Great Works and Town
// Projects can join this table as data once their phases land.
function renownRewardList(data) {
  const list = endgameConfig(data).renown?.rewards;
  return Array.isArray(list) ? list : [];
}
export function renownRewardsUpTo(world, data, level = renownLevel(world)) {
  return renownRewardList(data).filter(r => r && Number.isFinite(+r.level) && +r.level <= level);
}
export function renownTitle(world, data) {
  const earned = renownRewardsUpTo(world, data).filter(r => r.title);
  return earned.length ? earned[earned.length - 1].title : null;
}
function renownRewardSum(world, data, key) {
  let n = 0;
  for (const r of renownRewardsUpTo(world, data)) if (Number.isFinite(+r[key])) n += +r[key];
  return n;
}
// Building-limit bumps: added on top of the data `maxCount` (finite caps
// only — uncapped lines stay uncapped).
export function renownLimitBonus(world, data) {
  return renownRewardSum(world, data, 'limitBonus');
}
// Muster room: extra troop slots beyond the hall beds, home villages only.
export function renownTroopBonus(world, data) {
  return renownRewardSum(world, data, 'troopCap');
}
export function renownUnlocksFor(data, level) {
  const out = [];
  for (const r of renownRewardsUpTo({ renown: level }, data)) {
    if (Array.isArray(r.unlocks)) out.push(...r.unlocks);
  }
  return [...new Set(out)];
}

// Paragon reinforcement: max-tier fortifications improve forever. Each
// level thickens the walls (+HP now) and hones what shoots (+damage in
// combat). Upgrading tiers rebuilds the work — paragon resets.
export function paragonEligible(type, data) {
  return (endgameConfig(data).paragon?.eligible || []).includes(type);
}

export function buildingMaxHp(building, data) {
  const tier = data.buildings[building.type]?.tiers[building.level - 1];
  const base = tier?.hp || 1;
  const per = endgameConfig(data).paragon?.hpPerLevel || 0.12;
  return Math.round(base * (1 + per * Math.max(0, building.paragon || 0)));
}

export function paragonDamageMult(building, data) {
  const per = endgameConfig(data).paragon?.damagePerLevel || 0.1;
  return 1 + per * Math.max(0, building.paragon || 0);
}

export function paragonCost(type, level, world, data) {
  // Priced off the building's own base cost so a bastion always costs
  // bastion money and a palisade always costs palisade money.
  const growth = Math.pow(endgameConfig(data).paragon?.costGrowth || 2.5, level || 0);
  const base = data.buildings[type]?.cost || {wood: 50, gold: 25};
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.ceil(v * (1 + growth))]));
}

export function fillLine(line, vars) {
  return String(line || '').replace(/\{(\w+)\}/g, (_, k) => vars?.[k] ?? `{${k}}`);
}
