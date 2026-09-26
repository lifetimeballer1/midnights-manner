export const copy = value => structuredClone(value);
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
// New villages start small; the frontier opens as village XP grows (see village.js).
export const START_BOUNDS = {w:14,h:12};
export const XP_LEVELS = [0,100,220,380,580,830,1150];
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
  const spec=data.troops[unit.type], gear=data.items[unit.gear].stats;
  const result=Object.fromEntries(Object.entries(spec.base).map(([key,value])=>[key,value*(1+(spec.growth[key]||0)*(unit.level-1))]));
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
  if(unit.buffs&&unit.buffs.damage) result.damage*=1+unit.buffs.damage.value;
  if(unit.buffs&&unit.buffs.range) result.range+=unit.buffs.range.value;
  return result;
}
export function makeUnit(type,data,index=0) {
  const s=data.troops[type];
  return {id:crypto.randomUUID(),type,level:1,hp:s.base.hp,gear:s.defaultGear,owned:[s.defaultGear],armor:null,armorOwned:[],x:8+index*.65,y:10.8,attackTimer:0,abilityTimer:0,carry:0,phase:'gather',animation:0,workplace:null,order:null};
}
// Armor-slot reduction (Padded Coat onward): main gear + armor piece stack
// multiplicatively, so no wardrobe ever breaks the combat caps alone.
export function gearArmor(unit,data) {
  const vals=[unit.gear,unit.armor].map(id=>(id&&data.items[id]&&data.items[id].stats&&data.items[id].stats.armor)||0);
  return 1-vals.reduce((m,v)=>m*(1-v),1);
}
export function makeBuilding(type,x,y,data,level=1) {
  const spec = data.buildings[type];
  const b = {id:crypto.randomUUID(),type,x,y,level,hp:spec.tiers[level-1].hp,remaining:0,cooldown:0};
  if (spec.reserve) { b.reserve = spec.reserve; b.maxReserve = spec.reserve; }
  return b;
}
export function createWorld(data,layout=data.world) {
  const full = {w:data.world.width,h:data.world.height};
  const bounds = copy(layout.bounds || (layout.map ? full : START_BOUNDS));
  const cfg = data.world.homeRaids || {};
  return {resources:copy(layout.startingResources),bounds,survey:0,childTimer:0,buildings:(layout.buildings||layout.map.buildings).map(b=>makeBuilding(b.type,b.x,b.y,data,b.level||1)),troops:(layout.troops||layout.map.troops).map((t,i)=>makeUnit(t,data,i)),enemies:[],effects:[],elapsed:0,gathered:{wood:0,food:0,gold:0},wave:0,raidTimer:0,nextRaidAt:Number.isFinite(cfg.firstAt)?cfg.firstAt:300};
}
export function afford(resources,cost) { return Object.entries(cost).every(([k,v])=>resources[k]>=v); }
export function pay(resources,cost) {if(!afford(resources,cost)) return false; for(const [k,v] of Object.entries(cost)) resources[k]-=v; return true;}
// Villagers assigned to a matching finished workplace. Capacity: size 1 hosts 2, size 2 hosts 3.
export function workplaceCapacity(building, data) { return data.buildings[building.type].size + 1; }
export function assignedWorkers(world, buildingId) { return world.troops.filter(t => t.workplace === buildingId && t.hp > 0); }
export function assignmentValid(world, data, unit, building) {
  if (!unit || !building || building.hp <= 0 || building.remaining > 0) return false;
  const job = data.troops[unit.type].job;
  if (!job || building.type !== job.workplace) return false;
  if (unit.workplace === building.id) return true;
  return assignedWorkers(world, building.id).length < workplaceCapacity(building, data);
}
// Combined aura of every assigned keeper at a finished workplace. Caps keep numbers gentle.
export function auras(world, data) {
  const out = {damage:0,armor:0,gather:0,carry:0,build:0,discount:0,heal:0,xp:0,survey:0,food:0,produce:0,beds:0};
  for (const b of world.buildings) {
    if (b.hp <= 0 || b.remaining > 0) continue;
    const spec = data.buildings[b.type];
    if (!spec.workplace) continue;
    const crew = assignedWorkers(world, b.id).filter(u => data.troops[u.type].job?.workplace === b.type);
    if (!crew.length) continue;
    const n = crew.length, tier = spec.tiers[b.level - 1].rateMultiplier;
    // Keeper gear read-through: a posted keeper's equipped tool sharpens
    // their own share. stats.survey multiplies the bearer's surveyRate
    // share, stats.xpAura adds flat XP/s, and stats.<key>Aura adds flat
    // aura per bearer (damage/armor/gather/heal/carry). Empty stats (the
    // old keeper tomes) contribute exactly the pre-gear values.
    const gearOf = u => (data.items[u.gear] && data.items[u.gear].stats) || {};
    // Attuned bearers ('aura'-effect abilities: attune, veteran-x)
    // amplify their own share of whatever this workplace provides.
    const share = u => {
      let m = 1;
      try { for (const a of unlockedAbilities(u, data)) if (a.effect === 'aura') m += a.value; } catch {}
      return m;
    };
    if (spec.damageAura) out.damage += spec.damageAura * tier * crew.reduce((s, u) => s + share(u), 0);
    if (spec.armorAura) out.armor += spec.armorAura * tier * crew.reduce((s, u) => s + share(u), 0);
    if (spec.gatherAura) out.gather += spec.gatherAura * tier * crew.reduce((s, u) => s + share(u), 0);
    if (spec.carryBonus) out.carry += spec.carryBonus * n;
    if (spec.buildAura) { out.build += spec.buildAura * n; out.discount += 0.05 * n; }
    if (spec.healRate) out.heal += spec.healRate * tier * crew.reduce((s, u) => s + share(u), 0);
    if (spec.xpRate) out.xp += spec.xpRate * tier * crew.reduce((s, u) => s + share(u) * (gearOf(u).xpMult ?? 1), 0)
      + crew.reduce((s, u) => s + (gearOf(u).xpAura ?? 0), 0);
    if (spec.surveyRate) out.survey += spec.surveyRate * tier * crew.reduce((s, u) => s + share(u) * (gearOf(u).survey ?? 1), 0);
    for (const [statKey, auraKey] of [['damageAura', 'damage'], ['armorAura', 'armor'], ['gatherAura', 'gather'], ['healAura', 'heal'], ['carryAura', 'carry']]) {
      const add = crew.reduce((s, u) => s + (gearOf(u)[statKey] ?? 0), 0);
      if (add) out[auraKey] += add;
    }
    // Welcoming hands (apprentices at cottages) raise cottage capacity:
    // +1 bed each, gear stacks, +3 total. Housing is the visible track.
    for (const u of crew) {
      const job = data.troops[u.type].job;
      if (job && job.effect === 'welcome') out.beds += 1 + (gearOf(u).beds ?? 0);
    }
  }
  // Assigned butchers smoke food directly; assigned collectors work their source 25% faster each.
  for (const u of world.troops) {
    if (!u.workplace || u.hp <= 0) continue;
    const b = world.buildings.find(b => b.id === u.workplace);
    if (!b || b.hp <= 0 || b.remaining > 0) continue;
    const job = data.troops[u.type].job;
    if (!job || job.workplace !== b.type) continue;
    if (job.effect === 'produce') out.food += (job.rate || 0.8) * spec_tier(b, data);
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
  out.damage = Math.min(.3, out.damage);
  out.armor = Math.min(.3, out.armor);
  out.gather = Math.min(.45, out.gather);
  out.build = Math.min(.75, out.build);
  out.discount = Math.min(.2, out.discount);
  out.beds = Math.min(3, out.beds);
  return out;
}
function spec_tier(b, data) { return data.buildings[b.type].tiers[b.level - 1].rateMultiplier; }
// Assigned collectors gather 25% faster at their matched source.
export function gatherBonus(unit, world, data) {
  const job = data.troops[unit.type].job;
  if (!job || !unit.workplace) return 1;
  const b = world.buildings.find(b => b.id === unit.workplace);
  if (!b || b.hp <= 0 || b.remaining > 0 || job.workplace !== b.type) return 1;
  return 1.25;
}
export function builderBonuses(world,data) {
  const aura = auras(world, data);
  const crew=world.troops.filter(t=>data.troops[t.type].role==='builder'&&t.hp>0);
  return {speed:1+aura.build+crew.reduce((n,t)=>n+(data.items[t.gear].stats.buildSpeed||1)-1,0),discount:Math.min(.5,aura.discount+Math.max(0,...crew.map(t=>data.items[t.gear].stats.costReduction||0)))};
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
  // Mid-game pacing: tier-3 price tags run 50% hot. Tier 1-2 (the snappy
  // opening) and 2-tier buildings are untouched.
  const tier3 = level>=3 ? 1.5 : 1;
  return Object.fromEntries(Object.entries(data.buildings[type].cost).map(([k,v])=>[k,Math.ceil(v*level*tier3*(1-discount))]));
}
export function inBounds(world, data, type, x, y) {
  const size = data.buildings[type].size, b = world.bounds || {w:data.world.width,h:data.world.height};
  return Number.isInteger(x) && Number.isInteger(y) && x >= 1 && y >= 1 && x + size <= b.w - 1 && y + size <= b.h - 1;
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
