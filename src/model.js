import {hasTrait, jobLevelMult, CRAFT_SHOPS} from './systems/villagers.js';
import {artifactBonus} from './systems/artifacts.js';
import {skyGatherBonus} from './systems/daynight.js';
export const copy = value => structuredClone(value);
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
import {buildTiles, seedFor} from './systems/biomes.js';
import {isClaimed, claimPreclaimed, regionsOf} from './systems/expansion.js';
import {wellFedAuraEffects,supplyAuraEffects} from './systems/food.js';
import {warChestAuraEffects,warChestBonus} from './systems/warchest.js';
import {festivalAuraEffects} from './systems/festivals.js';
import {conquestAuraEffects} from './systems/conquest.js';
// New villages start small; the frontier opens as village XP grows (see village.js).
export const START_BOUNDS = {w:14,h:12};
export const XP_LEVELS = [0,100,220,380,580,830,1150,1500,2100,2400,2600];
export const EXPANSION = [{w:14,h:12},{w:16,h:13},{w:18,h:14},{w:20,h:16},{w:20,h:17}];
export function levelForXp(xp) {
  let level = 1;
  for (let i = 0; i < XP_LEVELS.length; i++) if (xp >= XP_LEVELS[i]) level = i + 1;
  return level;
}
export function unlockedAbilities(unit, data) {
  return Object.entries(data.troops[unit.type].abilities).filter(([level]) => unit.level >= +level).map(([,id]) => ({id,...data.abilities[id]}));
}
export function stats(unit,data) {
  const spec=data.troops[unit.type], gear=(unit.gear&&data.items[unit.gear]&&data.items[unit.gear].stats)||{};
  const result=Object.fromEntries(Object.entries(spec.base).map(([key,value])=>[key,value*(1+(spec.growth[key]||0)*(unit.level-1))]));
  // Prestige stars (Act VIII): each star is +5% all stats, max 3 — the
  // capped veteran's continuation. Role kits re-earn through levels, so
  // identity survives the ringing. Missing keys read zero for old saves.
  const stars=Math.max(0,Math.min(3,unit.prestigeStars||0));
  if(stars>0){const m=1+0.05*stars;result.hp*=m;result.damage*=m;result.speed*=m;}
  // The Last Watch (Act VIII): oathbound wardens hit 50% harder — the
  // price is paid on the other side of the raid, not here.
  if(unit.oath)result.damage*=1.5;
  result.damage*=gear.damage||1; result.range=gear.range||result.range;
  for (const a of unlockedAbilities(unit,data)) if(a.effect==='damage') result.damage*=1+a.value;
  // Worn bulk and active drills: armor-slot pieces can pad max HP or slow
  // feet (Padded Coat onward); 'buff'-effect abilities (Brace, Rally)
  // ride transient unit.buffs set by activateAbility. No current main-hand
  // gear carries hp/speed, so old stat lines are untouched.
  for (const gid of [unit.gear,unit.armor]) {
    const gs=(gid&&data.items[gid]&&data.items[gid].stats)||{};
    if(gs.hp) result.hp+=gs.hp;
    if(gs.speed) result.speed*=gs.speed;
  }
  // Ward-inked armor (Ember Ward onward): an armor-slot piece can hone
  // damage multiplicatively through the same generic axis. Main-hand damage
  // already rode the gear line above, so only the armor piece reads here —
  // no per-troop logic, old wardrobes multiply by nothing new.
  const ward=(unit.armor&&data.items[unit.armor]&&data.items[unit.armor].stats)||{};
  if(ward.damage) result.damage*=ward.damage;
  if(unit.buffs&&unit.buffs.damage) result.damage*=1+unit.buffs.damage.value;
  if(unit.buffs&&unit.buffs.range) result.range+=unit.buffs.range.value;
  // Phase 7 identity: traits that ride the body, not the job. Missing
  // traits (old saves) read as no bonus — never a wipe, never NaN.
  // Brave/Cowardly damage temperament lives in combat (raid-aware).
  if(hasTrait(unit,'strong')){result.damage*=1.1;result.hp*=1.1;}
  if(hasTrait(unit,'night_owl'))result.speed*=1.1;
  // Marksman: ranged fighters (long bows, drawn bows) hit 20% harder.
  // Base range identifies the line so gear swaps never change identity.
  if(hasTrait(unit,'marksman')&&(spec.base?.range||0)>2)result.damage*=1.2;
  return result;
}
export function makeUnit(type,data,index=0) {
  const s=data.troops[type];
  return {id:crypto.randomUUID(),type,level:1,hp:s.base.hp,gear:s.defaultGear,owned:[s.defaultGear],armor:null,armorOwned:[],prestigeStars:0,oath:false,x:8+index*.65,y:10.8,attackTimer:0,abilityTimer:0,carry:0,phase:'gather',animation:0,workplace:null,order:null};
}
// Armor-slot reduction (Padded Coat onward): main gear + armor piece stack
// multiplicatively, so no wardrobe ever breaks the combat caps alone.
export function gearArmor(unit,data) {
  // Worn plate (Shieldwall doctrine): armor dulls 1 raid at a time, and at
  // wear 3+ every piece guards at half — the yard keeps them bright. Wear
  // rides the unit, so old saves (no wear key) read full-bright via ?? 0.
  const worn=(unit.armorWear||0)>=3?0.5:1;
  const vals=[unit.gear,unit.armor].map(id=>(id&&data.items[id]&&data.items[id].stats&&data.items[id].stats.armor)||0);
  return 1-vals.reduce((m,v)=>m*(1-v*worn),1);
}
export function makeBuilding(type,x,y,data,level=1) {
  const spec = data.buildings[type];
  const b = {id:crypto.randomUUID(),type,x,y,level,hp:spec.tiers[level-1].hp,remaining:0,cooldown:0};
  if (spec.reserve) { b.reserve = spec.reserve; b.maxReserve = spec.reserve; }
  return b;
}
export function createWorld(data,layout=data.world) {
  const full = {w:data.world.width,h:data.world.height},missionMap=layout.map||null;
  // Campaign maps stay homestead-scale (data/expansion.json homestead,
  // 20x17 legacy): expeditions keep their designed raid walk distances
  // even as the persistent home frontier grows larger.
  const hs = data.expansion?.homestead;
  const missionSize = {w:Math.min(full.w,Number.isFinite(hs?.w)?hs.w:20),h:Math.min(full.h,Number.isFinite(hs?.h)?hs.h:17)};
  const bounds = copy(layout.bounds || (missionMap ? missionSize : START_BOUNDS));
  const cfg = data.world.homeRaids || {};
  // Mission maps own their visual tile sheet: they never inherit home
  // landmarks, and may declare map.biome/map.seed/map.tiles. Home worlds
  // keep the full data/world tile sheet and deterministic seed.
  const tileData=missionMap
    ? {...data.world,width:bounds.w,height:bounds.h,tiles:Array.isArray(missionMap.tiles)?missionMap.tiles:[],seed:missionMap.seed??layout.seed??data.world.seed,defaultBiome:missionMap.biome}
    : {...data.world,...layout,tiles:layout.tiles||data.world.tiles,seed:layout.seed??data.world.seed};
  let tiles = [];
  try { tiles = buildTiles(tileData, bounds); } catch { tiles = []; }
  // Region model: fresh home worlds claim only the pre-claimed hearth
  // region; all outer regions stay wild. Mission maps keep legacy bounds
  // claiming and never consult the persistent region partition.
  // Old saves never reach this path with existing tiles — migration in
  // game.js only ever adds claims, never removes them.
  try {
    if (!missionMap && regionsOf(data.expansion).length && Array.isArray(tiles)) {
      const pre = regionsOf(data.expansion).filter(r => r?.preclaimed && r.rect);
      const insidePre = (x, y) => pre.some(r => x >= r.rect.x && y >= r.rect.y && x < r.rect.x + r.rect.w && y < r.rect.y + r.rect.h);
      for (const t of tiles) {
        if (t.landmark) continue;
        t.claimed = insidePre(t.x, t.y);
      }
      claimPreclaimed({tiles}, data.expansion);
    }
  } catch {}
  return {resources:copy(layout.startingResources),bounds,survey:0,childTimer:0,tiles,biomeSeed:seedFor(tileData),buildings:(layout.buildings||missionMap.buildings).map(b=>makeBuilding(b.type,b.x,b.y,data,b.level||1)),troops:(layout.troops||missionMap.troops).map((t,i)=>makeUnit(t,data,i)),enemies:[],effects:[],elapsed:0,gathered:{wood:0,food:0,gold:0,frostwood:0,plate:0,lumber:0,flour:0,bread:0},wave:0,raidTimer:0,nextRaidAt:Number.isFinite(cfg.firstAt)?cfg.firstAt:300,wellFed:false,lastMealDay:0,wellSupplied:false,lastSupplyDay:0};
}
export function afford(resources,cost) { return Object.entries(cost).every(([k,v])=>resources[k]>=v); }
export function pay(resources,cost) {if(!afford(resources,cost)) return false; for(const [k,v] of Object.entries(cost)) resources[k]-=v; return true;}
// Villagers assigned to a matching finished workplace. Capacity: size 1 hosts 2, size 2 hosts 3.
export function workplaceCapacity(building, data) { return data.buildings[building.type].size + 1; }
export function assignedWorkers(world, buildingId) { return world.troops.filter(t => t.workplace === buildingId && t.hp > 0); }
export function assignmentValid(world, data, unit, building) {
  if (!unit || unit.hp <= 0 || !building || building.hp <= 0 || building.remaining > 0) return false;
  const job = data.troops[unit.type].job;
  // Host buildings (the Schoolroom onward) welcome listed professions
  // beside their own line — data `hosts`, same capacity law, so new
  // schools never need a posting-law exception.
  if (!job || (building.type !== job.workplace && !(data.buildings[building.type]?.hosts || []).includes(unit.type))) return false;
  if (unit.workplace === building.id) return true;
  return assignedWorkers(world, building.id).length < workplaceCapacity(building, data);
}
// Combined aura of every assigned keeper at a finished workplace. Caps keep numbers gentle.
export function auras(world, data) {
  const out = {damage:0,armor:0,gather:0,carry:0,build:0,discount:0,heal:0,xp:0,survey:0,food:0,plate:0,produce:0,beds:0,trade:0};
  // Keeper gear read-through lives beside the share helper: every bearer
  // read below goes through gearOf, so empty-stat tomes stay exactly put.
  const gearOf = u => (data.items[u.gear] && data.items[u.gear].stats) || {};
  // Attuned bearers ('aura'-effect abilities: attune, veteran-x) amplify
  // their own share of whatever their workplace provides — keeper auras
  // above and the smokehouse-pattern pour below read the same helper.
  // Promoted keepers (the master's touch) and % aura gear (Master's Ring)
  // ride the same share — both hands read, main and armor, no per-troop
  // logic anywhere.
  // Bell Tower resonance (Act VIII): where a finished prestige-aura tower
  // stands, starred veterans count double — the bell carries their voice.
  // Data flag, never a building id; old saves without stars read single.
  const bellUp = world.buildings.some(b => b.hp > 0 && b.remaining <= 0 && data.buildings[b.type]?.prestigeAura);
  const share = (u, b) => {
    let m = 1;
    try { for (const a of unlockedAbilities(u, data)) if (a.effect === 'aura') m += a.value; } catch {}
    if (u.promoted) m += 0.1;
    // Phase 7 identity: job skill sharpens every share (+8% per level past
    // the first); Hard Workers lend a little everywhere, Craftsmen extra
    // at smithing/workshop posts. Level-1 crews without traits read exactly
    // the pre-Phase-7 values — old saves are untouched until they train.
    m *= jobLevelMult(u);
    if (hasTrait(u, 'hard_worker')) m += 0.12;
    if (b && hasTrait(u, 'craftsman') && CRAFT_SHOPS.includes(b.type)) m += 0.25;
    if (bellUp && (u.prestigeStars || 0) > 0) m *= 2;
    m += gearOf(u).aura ?? 0;
    const ag = (u.armor && data.items[u.armor] && data.items[u.armor].stats) || {};
    m += ag.aura ?? 0;
    return m;
  };
  // Perf: single-pass indexes built once per call. postOf replaces a
  // buildings.find per troop; crewOf replaces an assignedWorkers filter
  // per workplace. Same membership, same order — just no re-scans.
  // (Posted units under emergency orders still pour: the workplace loop
  // below never excluded them; only the produce loop skips them.)
  const postOf = new Map();
  for (const b of world.buildings) postOf.set(b.id, b);
  const crewOf = new Map();
  for (const u of world.troops) {
    if (!u.workplace || u.hp <= 0) continue;
    const pb = postOf.get(u.workplace);
    if (!pb || pb.hp <= 0 || pb.remaining > 0) continue;
    let arr = crewOf.get(u.workplace);
    if (!arr) crewOf.set(u.workplace, arr = []);
    arr.push(u);
  }
  // Perf: share() is pure per (unit, post) within a call but was
  // recomputed per aura key. Memoize; units without ids skip the cache.
  const shareMemo = new Map();
  const shareCached = (u, b) => {
    if (u.id == null || b.id == null) return share(u, b);
    const k = u.id + '|' + b.id;
    let m = shareMemo.get(k);
    if (m === undefined) { m = share(u, b); shareMemo.set(k, m); }
    return m;
  };
  for (const b of world.buildings) {
    if (b.hp <= 0 || b.remaining > 0) continue;
    const spec = data.buildings[b.type];
    if (!spec.workplace) continue;
    // Hosted hands (Schoolroom apprentices onward) count as crew where
    // they stand, not only where their line was raised — same `hosts`.
    const crew = (crewOf.get(b.id) || []).filter(u => data.troops[u.type].job?.workplace === b.type || (spec.hosts || []).includes(u.type));
    if (!crew.length) continue;
    const n = crew.length, tier = spec.tiers[b.level - 1].rateMultiplier;
    // Keeper gear read-through: a posted keeper's equipped tool sharpens
    // their own share. stats.survey multiplies the bearer's surveyRate
    // share, stats.xpAura adds flat XP/s, and stats.<key>Aura adds flat
    // aura per bearer (damage/armor/gather/heal/carry). Empty stats (the
    // old keeper tomes) contribute exactly the pre-gear values.
    if (spec.damageAura) out.damage += spec.damageAura * tier * crew.reduce((s, u) => s + shareCached(u, b), 0);
    if (spec.armorAura) out.armor += spec.armorAura * tier * crew.reduce((s, u) => s + shareCached(u, b), 0);
    if (spec.gatherAura) out.gather += spec.gatherAura * tier * crew.reduce((s, u) => s + shareCached(u, b), 0);
    // Wild-market pattern, generalized: a workplace can carry a trade aura
    // the same way a forge carries a damage aura — posted keepers sharpen
    // their own share, tier multiplies, the cap below holds the ceiling.
    if (spec.tradeAura) out.trade += spec.tradeAura * tier * crew.reduce((s, u) => s + shareCached(u, b), 0);
    // Dual-aura pour (Act VIII Sunken Chapel): a workplace can carry food
    // the same way a forge carries damage — posted keepers sharpen their
    // share, tier multiplies. Existing key, new reader, same caps below.
    if (spec.foodAura) out.food += spec.foodAura * tier * crew.reduce((s, u) => s + shareCached(u, b), 0);
    if (spec.carryBonus) out.carry += spec.carryBonus * n;
    if (spec.buildAura) { out.build += spec.buildAura * n; out.discount += 0.05 * n; }
    // Flat-heal wardrobe (Choir Robe onward): a posted keeper's armor
    // piece can carry plain mending alongside the aura share — same crew,
    // same tick, no new keys.
    if (spec.healRate) out.heal += spec.healRate * tier * crew.reduce((s, u) => s + shareCached(u, b), 0)
      + crew.reduce((s, u) => s + (((u.armor && data.items[u.armor] && data.items[u.armor].stats) || {}).heal ?? 0), 0);
    // Primer ink (Tam's school onward): a posted keeper's tool can carry a
    // flat XP pour under the plain `xp` stat key — same channel as xpAura.
    // Armor-ink XP (Act VIII Envoy's Gift onward): a posted keeper's armor
    // piece can pour village XP beside the main-hand tool — same tick.
    const armorXp = u => { const ag = (u.armor && data.items[u.armor] && data.items[u.armor].stats) || {}; return (ag.xpAura ?? 0) + (ag.xp ?? 0); };
    if (spec.xpRate) out.xp += spec.xpRate * tier * crew.reduce((s, u) => s + shareCached(u, b) * (gearOf(u).xpMult ?? 1), 0)
      + crew.reduce((s, u) => s + (gearOf(u).xpAura ?? 0) + (gearOf(u).xp ?? 0) + armorXp(u), 0);
    if (spec.surveyRate) out.survey += spec.surveyRate * tier * crew.reduce((s, u) => s + shareCached(u, b) * (gearOf(u).survey ?? 1), 0);
    for (const [statKey, auraKey] of [['damageAura', 'damage'], ['armorAura', 'armor'], ['gatherAura', 'gather'], ['healAura', 'heal'], ['carryAura', 'carry'], ['tradeAura', 'trade'], ['foodAura', 'food']]) {
      const add = crew.reduce((s, u) => s + (gearOf(u)[statKey] ?? 0), 0);
      if (add) out[auraKey] += add;
    }
    // All-aura mantle (Act VIII Regalia): a bearer whose gear speaks
    // `allAura` lends a little to every key at once. Both hands read —
    // the only all-aura gear in the game, and still a small number.
    for (const u of crew) {
      let all = 0;
      for (const gid of [u.gear, u.armor]) {
        const gs = (gid && data.items[gid] && data.items[gid].stats) || {};
        if (Number.isFinite(gs.allAura)) all += gs.allAura;
      }
      if (all) for (const k of Object.keys(out)) out[k] += all;
    }
    // Welcoming hands (apprentices at cottages) raise cottage capacity:
    // +1 bed each, gear stacks, +3 total. Housing is the visible track.
    for (const u of crew) {
      const job = data.troops[u.type].job;
      if (job && job.effect === 'welcome') out.beds += 1 + (gearOf(u).beds ?? 0);
    }
  }
  // Assigned butchers smoke food directly; assigned collectors work their source 25% faster each.
  // Perf: world-order iteration preserved (identical float accumulation),
  // but the per-troop buildings.find is a postOf map lookup.
  for (const u of world.troops) {
    if (!u.workplace || u.hp <= 0 || u.emergency) continue;
    const b = postOf.get(u.workplace);
    if (!b || b.hp <= 0 || b.remaining > 0) continue;
    const job = data.troops[u.type].job;
    // Hosted hands pour where they stand: a tide-line keeper at hosted
    // water counts beside their own chapel (Phase-13 precedent).
    // Produce crews still pour only at their own line — law intact.
    if (!job) continue;
    if (job.workplace !== b.type && !(job.effect === 'tide' && (data.buildings[b.type]?.hosts || []).includes(u.type))) continue;
    // Smokehouse pattern, generalized: the job names its own resource
    // (the old shops smoke food, the new pour-house pours plate) and
    // attuned bearers ('aura'-effect abilities) quicken their own share.
    // Old crews carry no aura abilities, so their output is unchanged.
    if (job.effect === 'produce') {
      const key = job.resource || 'food';
      if (key in out) out[key] += (job.rate || 0.8) * spec_tier(b, data) * shareCached(u, b);
    }
    // Tide offices (Act VIII): tide-line keepers pour food wherever the water
    // lets them stand — their own chapel or hosted water. Same
    // share law as every pour, data rate, no new keys.
    if (job.effect === 'tide' && (job.workplace === b.type || (data.buildings[b.type]?.hosts || []).includes(u.type))) {
      out.food += (job.rate || 0.5) * shareCached(u, b);
    }
  }
  // Living-world sky: the day's season + modifier blessings ride here as a
  // transient world.calendarBonus set by game orchestration. Only known aura
  // keys merge, and the caps below still hold — the sky never breaks the sim.
  const sky = world.calendarBonus;
  if (sky && typeof sky === 'object') {
    for (const [k, v] of Object.entries(sky)) {
      if (k in out && Number.isFinite(v)) out[k] += v;
    }
  }
  // Well Fed (Phase 3): a covered town table lends a gentle hand — the
  // effects come from data.world.townMeal.wellFed.effects and only known
  // aura keys merge. Worlds without the flag read exactly the pre-meal
  // values; the caps below still hold the ceiling.
  if (world.wellFed === true) {
    for (const [k, v] of Object.entries(wellFedAuraEffects(data))) {
      if (k in out && Number.isFinite(v)) out[k] += v;
    }
  }
  for (const [k, v] of Object.entries(supplyAuraEffects(world, data))) {
    if (k in out && Number.isFinite(v)) out[k] += v;
  }
  // War Chest (Phase 6): while the chest is open, its combat stores lend
  // aura damage, armor and mending — data effects, known keys, caps hold.
  for (const [k, v] of Object.entries(warChestAuraEffects(world, data))) {
    if (k in out && Number.isFinite(v)) out[k] += v;
  }
  // Festivals (Phase 6): a live celebration warms the same table — data
  // effects, known keys, caps hold; no festival reads exactly zero.
  for (const [k, v] of Object.entries(festivalAuraEffects(world, data))) {
    if (k in out && Number.isFinite(v)) out[k] += v;
  }
  // Town projects (Phase 4): a finished grand work blesses the settlement
  // itself — data `flatAuras`, scaled by the building's tier, only known
  // keys. No crew and no workplace; the project stands, the town feels it.
  for (const b of world.buildings) {
    if (b.hp <= 0 || b.remaining > 0) continue;
    const spec = data.buildings[b.type];
    if (!spec?.flatAuras) continue;
    const tier = spec.tiers?.[Math.max(0, (b.level || 1) - 1)];
    const mult = Number.isFinite(tier?.rateMultiplier) ? tier.rateMultiplier : 1;
    for (const [k, v] of Object.entries(spec.flatAuras)) {
      if (k in out && Number.isFinite(v)) out[k] += v * mult;
    }
  }
  // Annexed land (Phase 8): the conquered keep pours its own blessing —
  // data flatAuras on the chosen annex, known keys, caps hold.
  for (const [k, v] of Object.entries(conquestAuraEffects(world, data))) {
    if (k in out && Number.isFinite(v)) out[k] += v;
  }
  // Moon Dial (Act VIII): a finished dial locks one season blessing in at
  // half strength — the season is data on the building, the effects come
  // from data/calendar.json, only known aura keys merge. One per village.
  for (const b of world.buildings) {
    if (b.hp <= 0 || b.remaining > 0 || !data.buildings[b.type]?.moonDial || !b.dialSeason) continue;
    const season = (data.calendar?.seasons || []).find(s => s.id === b.dialSeason);
    if (!season?.effects) continue;
    for (const [k, v] of Object.entries(season.effects)) {
      if (k in out && Number.isFinite(v)) out[k] += v * 0.5;
    }
  }
  // Living sky (Phase 10): night unease slows gathering a touch, rain
  // quickens it. Transient world.night / world.weather set by the game
  // tick; worlds without them (old saves, direct ticks) read exactly the
  // pre-Phase-10 values. The gather cap below still holds the ceiling.
  const living = skyGatherBonus(world, data);
  if (living) out.gather += living;
  // Dawn Gate (Act VIII): the everything engine — +0.05 every aura key,
  // village-wide, still held by the caps below. Data flag, one per village.
  if (world.buildings.some(b => b.hp > 0 && b.remaining <= 0 && data.buildings[b.type]?.dawnAura)) {
    const amt = Math.max(0, ...world.buildings.filter(b => b.hp > 0 && b.remaining <= 0 && data.buildings[b.type]?.dawnAura).map(b => data.buildings[b.type].dawnAura));
    for (const k of Object.keys(out)) out[k] += amt;
  }
  // Phase 11 — recovered artifacts pour onto the same table: permanent
  // village blessings, still held by the caps below. Worlds without a
  // shelf (old saves) add exactly nothing.
  for (const [k, v] of Object.entries(artifactBonus(world, data))) {
    if (k in out) out[k] += v;
  }
  out.damage = Math.min(.3, out.damage);
  out.armor = Math.min(.3, out.armor);
  out.gather = Math.min(.45, out.gather);
  out.build = Math.min(.75, out.build);
  out.discount = Math.min(.2, out.discount);
  out.trade = Math.min(.3, out.trade);
  out.beds = Math.min(3, out.beds);
  return out;
}
function spec_tier(b, data) { return data.buildings[b.type].tiers[b.level - 1].rateMultiplier; }
// Assigned collectors gather 25% faster at their matched source.
// Perf: optional postOf map avoids a buildings.find per collector.
export function gatherBonus(unit, world, data, postOf) {
  const job = data.troops[unit.type].job;
  if (!job || !unit.workplace) return 1;
  const b = postOf ? postOf.get(unit.workplace) : world.buildings.find(b => b.id === unit.workplace);
  if (!b || b.hp <= 0 || b.remaining > 0 || job.workplace !== b.type) return 1;
  return 1.25;
}
// Perf: optional preAura skips a second full auras() pass — tickEconomy
// computes one aura per tick and shares it here. Same object, same numbers.
export function builderBonuses(world,data,preAura) {
  const aura = preAura || auras(world, data);
  const crew=world.troops.filter(t=>data.troops[t.type].role==='builder'&&t.hp>0);
  // Wardrobe read-through, generalized: every builder's main gear and armor
  // piece both speak — 'discount' rides beside the old
  // 'costReduction' key, best piece wins, the 0.5 ceiling never moves.
  const price=gid=>{const s=(gid&&data.items[gid]&&data.items[gid].stats)||{};return s.discount||s.costReduction||0;};
  return {speed:1+aura.build+crew.reduce((n,t)=>n+(data.items[t.gear].stats.buildSpeed||1)-1,0),discount:Math.min(.5,aura.discount+Math.max(0,...crew.flatMap(t=>[price(t.gear),price(t.armor)])))};
}
export function housing(world, data) {
  let beds = 0;
  for (const b of world.buildings) {
    if (b.hp <= 0 || b.remaining > 0) continue;
    const h = data.buildings[b.type].housing;
    if (h) beds += h[Math.min(b.level, h.length) - 1];
  }
  beds += auras(world, data).beds;
  const used = world.troops.filter(t => t.hp >= 0).length;
  return {beds, used, free: Math.max(0, beds - used)};
}
export function buildingCost(type,level,world,data) {
  const discount=builderBonuses(world,data).discount;
  const spec=data.buildings[type];
  // Upper-tier curves (Phase 2): data `costCurve` names the multiplier for
  // every tier (index = level - 1, clamped at the last entry). Buildings
  // without one keep the legacy mid-game formula byte-for-byte (level ×
  // 1/1.5/2), so old content and pinned balances stay exactly put.
  const curve=Array.isArray(spec.costCurve)?spec.costCurve:[];
  const pick=curve.length?curve[Math.min(level,curve.length)-1]:null;
  const mult=curve.length&&Number.isFinite(+pick)?+pick:level*(level>=4?2:level>=3?1.5:1);
  // Forged and sawn goods join upper tiers (data `tierCosts`): extras are
  // flat per tier — the curve never scales them, they already name the
  // endgame price. The builder discount still trims them like coin.
  const extra=spec.tierCosts?.[level]||{};
  const out={};
  for(const [k,v] of Object.entries(spec.cost))out[k]=Math.ceil(v*mult*(1-discount));
  for(const [k,v] of Object.entries(extra))if(Number.isFinite(+v))out[k]=(out[k]||0)+Math.ceil(+v*(1-discount));
  return out;
}
// Building limits (Phase 2): a spec's `maxCount` is a flat number or a
// per-village-level array (clamped at the last entry, like housing). No
// field means no limit — walls and traps stay free for layouts. Standing
// buildings (scaffolds included) count; ruins never do, so a wrecked shop
// can always be repaired or replaced. `bonus` (Phase 5 renown) raises a
// finite cap; uncapped lines stay uncapped.
export function buildingLimit(type,vlevel,data,bonus=0) {
  const rule=data?.buildings?.[type]?.maxCount;
  const add=Number.isFinite(+bonus)&&+bonus>0?Math.floor(+bonus):0;
  if(typeof rule==='number'&&Number.isFinite(rule))return Math.max(0,Math.floor(rule))+add;
  if(Array.isArray(rule)&&rule.length){
    const lvl=Math.max(1,Math.floor(Number(vlevel)||1));
    const pick=rule[Math.min(lvl,rule.length)-1];
    if(!Number.isFinite(+pick))return Infinity;
    return Math.max(0,Math.floor(+pick))+add;
  }
  return Infinity;
}
export function buildingCount(world,type) {
  return (world?.buildings||[]).filter(b=>b&&b.type===type&&b.hp>0).length;
}
export function inBounds(world, data, type, x, y) {
  const size = data.buildings[type].size, b = world.bounds || {w:data.world.width,h:data.world.height};
  // Absolute grid margins always hold (1-tile shoreline + stream).
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  const W = data.world.width, H = data.world.height;
  if (x < 1 || y < 1 || x + size > W - 1 || y + size > H - 1) return false;
  // Settled bounds (XP growth) always allow placement, as before.
  if (x + size <= b.w - 1 && y + size <= b.h - 1) return true;
  // Frontier claims (Phase 2): a fully-claimed footprint outside the
  // settled bounds is buildable — paid wilderness, not wild rows.
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
    if (!isClaimed(world, x + dx, y + dy)) return false;
  }
  return true;
}
export function canPlace(world,data,type,x,y,ignoreId) {
  if (!inBounds(world, data, type, x, y)) return false;
  const size=data.buildings[type].size;
  for (const b of world.buildings) {
    if (b.id === ignoreId) continue;
    const osize = data.buildings[b.type].size;
    // Hard overlap never allowed.
    if (x < b.x + osize && x + size > b.x && y < b.y + osize && y + size > b.y) return false;
  }
  // Village, not clutter: roomy buildings keep a one-tile breathing gap from each
  // other (walls, traps and single-tile shops tuck in anywhere). Old saves are
  // grandfathered — this only gates new placements and moves.
  if (size >= 2 && type !== 'trap') {
    for (const b of world.buildings) {
      if (b.id === ignoreId || b.type === 'trap') continue;
      const osize = data.buildings[b.type].size;
      if (osize < 2) continue;
      if (x - 1 < b.x + osize && x + size + 1 > b.x && y - 1 < b.y + osize && y + size + 1 > b.y) return false;
    }
  }
  return true;
}
export function center(building,data) {const size=data.buildings[building.type].size;return {x:building.x+size/2,y:building.y+size/2};}
// Oathstone doctrine (Act VII): a finished monument lends armor to living
// troops standing near it — a proximity aura, not a workplace. Every field
// is data on the building spec; no building ids live here.
export function proximityArmor(unit, world, data) {
  let bonus = 0;
  for (const b of world.buildings) {
    if (b.hp <= 0 || b.remaining > 0) continue;
    const pa = data.buildings[b.type]?.proximityAura;
    if (!pa) continue;
    if (distance(unit, center(b, data)) <= (pa.radius ?? 3)) bonus += pa.armor ?? 0;
  }
  return bonus;
}
// Bellcote mercy (Act VII): the fallen rise at the best finished revive
// rate in the village — 30% on the cold ground, 50% under the bell.
// Rations (war chest, Phase 6) raise the field hospitals while the chest
// is open; the 80% ceiling keeps the ledger honest.
export function reviveFraction(world, data) {
  let f = 0.3;
  for (const b of world.buildings) {
    if (b.hp <= 0 || b.remaining > 0) continue;
    const r = data.buildings[b.type]?.reviveMult;
    if (Number.isFinite(r)) f = Math.max(f, r);
  }
  try { f += warChestBonus(world, data, 'revive'); } catch {}
  return Math.min(0.8, f);
}
// Siege-craft (Act VII): every living hand whose gear speaks `trapDamage`
// sharpens every defense in the village — the tongs teach the towers.
export function siegeBonus(world, data) {
  let bonus = 0;
  for (const u of world.troops) {
    if (u.hp <= 0) continue;
    const gs = (u.gear && data.items[u.gear] && data.items[u.gear].stats) || {};
    if (Number.isFinite(gs.trapDamage)) bonus += gs.trapDamage;
  }
  return bonus;
}
// Master & Apprentice (Act VII): a capped apprentice posted at a listed
// workplace may graduate into that line's keeper at level 5, keeping their
// kit and gaining the master's touch (+10% aura via `promoted`). The
// school must stand at tier 2 — the building-tier-gated second data point.
// Pure and data-driven: callers check locks, this checks the rest.
export function promotionOptions(world, data, unit) {
  const spec = data.troops[unit.type];
  if (!spec?.promotions || unit.hp <= 0) return [];
  const school = world.buildings.some(b => b.type === 'schoolroom' && b.hp > 0 && (b.level || 1) >= 2 && b.remaining <= 0);
  if (!school) return [];
  const post = unit.workplace && world.buildings.find(b => b.id === unit.workplace);
  if (!post || post.hp <= 0) return [];
  return Object.entries(spec.promotions)
    .filter(([type, p]) => data.troops[type] && unit.level >= (p.minLevel || 15) && (p.from || []).includes(post.type))
    .map(([type, p]) => ({type, text: p.text || ''}));
}
