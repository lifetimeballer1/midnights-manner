import {resourceLabel, reserveCapacity} from '../resources.js';
import {builderBonuses,center,unlockedAbilities,stats,auras,gatherBonus} from '../model.js';
import {hasTrait, jobLevelMult} from './villagers.js';
import {move} from './pathfinding.js';
import {sfx} from './audio.js';
// Open resource maps: kept for non-production reward paths. Collector
// villagers no longer call this; their work is deposited into producer
// reserves and reaches settlement storage only through manual collection.
export function addResource(world,resource,amount) {if(!resource)return;world.resources[resource]=(world.resources[resource]||0)+amount;world.gathered[resource]=(world.gathered[resource]||0)+amount;}
// Clash-style reserves: production piles up on the building (capped by data
// `harvest.capacity` + `harvest.perTier`, see resources.js) and only lands
// in the pool when tapped. Passive ticks
// never spawn floaters; capacity-full is visual only — sound is player-driven.
let lastSplash=0;
function push(world,effect){if(world.effects.length<140)world.effects.push(effect);}
export function floatText(world,x,y,text,color){push(world,{x,y,tx:x,ty:y-1.1,kind:'float',text,color,life:.9});}
function sparkle(world,x,y){push(world,{x,y,tx:x,ty:y,kind:'sparkle',life:.4});}
function splash(world,x,y){push(world,{x,y,tx:x,ty:y,kind:'splash',life:.5});}
// Living resources: nodes drain as they are worked and refill slowly when rested.
// Output scales 25% (tapped out) to 100% (full); nothing ever depletes forever.
const REGEN_FRACTION = 0.005;
// Soft mid-game pacing: full rates until 5 min, then lerp down to the floor
// by 10 min. Avoids a hard cliff while still pushing collectors and taps.
export function midgameRate(elapsed, floor = 0.75, fullUntil = 300, rampEnd = 600) {
  const t = Number(elapsed) || 0;
  if (t <= fullUntil) return 1;
  if (t >= rampEnd) return floor;
  const u = (t - fullUntil) / (rampEnd - fullUntil);
  return 1 - u * (1 - floor);
}
export function reserveMult(building) {
  if (!building.maxReserve) return 1;
  return 0.25 + 0.75 * Math.max(0, Math.min(1, building.reserve / building.maxReserve));
}
function drain(building, amount) {
  if (!building.maxReserve) return;
  building.reserve = Math.max(0, building.reserve - amount);
}
function sourceFor(world, data, spec, unit, aliveByProd, postOf) {
  // Perf: aliveByProd/postOf are snapshots built once per tick AFTER the
  // construction countdowns above (the only hp/remaining writes this tick),
  // so they read exactly what the live scans would find.
  const alive = aliveByProd
    ? (aliveByProd.get(spec.gatherResource) || [])
    : world.buildings.filter(b => b.hp > 0 && b.remaining <= 0 && data.buildings[b.type].production === spec.gatherResource);
  if (!alive.length) return null;
  // Specialists work their own water/field first (fishermen need ponds, not wheat).
  if (spec.gatherFrom) {
    const home = alive.filter(b => b.type === spec.gatherFrom);
    if (home.length) {
      if (unit.workplace) {
        // Perf: O(1) membership check — fields unchanged since the snapshot.
        const assigned = postOf ? postOf.get(unit.workplace) : home.find(b => b.id === unit.workplace);
        if (assigned && assigned.hp > 0 && assigned.remaining <= 0 && assigned.type === spec.gatherFrom && data.buildings[assigned.type].production === spec.gatherResource) return assigned;
      }
      return home[0];
    }
    return null;
  }
  if (unit.workplace) {
    const assigned = postOf ? postOf.get(unit.workplace) : alive.find(b => b.id === unit.workplace);
    if (assigned && assigned.hp > 0 && assigned.remaining <= 0 && data.buildings[assigned.type].production === spec.gatherResource) return assigned;
  }
  return alive[0];
}
export function tickEconomy(world,data,dt) {
 if(!Number.isFinite(dt)||dt<=0)return;
 // Perf: one aura per tick shared with builderBonuses (was two full passes).
 const aura=auras(world,data);
 const bonus=builderBonuses(world,data,aura);
 for(const b of world.buildings) {
  if(b.hp<=0)continue;
  if(b.remaining>0&&(world.raidPending||world.enemies.some(e=>e.hp>0)))continue;
  if(b.remaining>0){b.remaining=Math.max(0,b.remaining-dt*bonus.speed);continue;}
  const spec=data.buildings[b.type];
  // Rested nodes breathe back; worked nodes visibly drain below.
  if (b.maxReserve && b.reserve < b.maxReserve) b.reserve = Math.min(b.maxReserve, b.reserve + b.maxReserve * REGEN_FRACTION * dt);
  if(spec.production) {
   const mult = reserveMult(b);
   // Mid-game pacing: full tilt for 5 minutes, then eases to 75% by 10 min
   // so expansion leans on taps, collectors, upgrades and new buildings.
   const mid = midgameRate(world.elapsed, 0.75);
   const made = spec.rate*spec.tiers[b.level-1].rateMultiplier*mult*mid*dt;
   drain(b, made);
   const cap = reserveCapacity(spec, b.level);
   const held = Number.isFinite(b.harvestBonus) ? Math.max(0, b.harvestBonus) : 0;
   b.harvestBonus = Math.min(cap, held + made);}
 }
 // Capacity-full is visual only; sound is player-initiated only.
 // Perf: indexes built once after the construction loop above (the only
 // hp/remaining writes this tick) — O(1) lookups below, same results.
 const postOf=new Map();
 for(const b of world.buildings)postOf.set(b.id,b);
 const aliveByProd=new Map();
 for(const b of world.buildings){
  if(b.hp<=0||b.remaining>0)continue;
  const prod=data.buildings[b.type].production;
  if(!prod)continue;
  let arr=aliveByProd.get(prod);if(!arr)aliveByProd.set(prod,arr=[]);
  arr.push(b);
 }
 const hall=world.buildings.find(b=>b.type==='hall'&&b.hp>0);if(!hall)return;
 for(const u of world.troops) {
  if(u.hp<=0||u.emergency)continue;
  const spec=data.troops[u.type];
  // Ranging hands (Phase 3 expeditions) walk their own road — the
  // expedition handler moves them, never the economy loop.
  if(u.expedition)continue;
  // Posted specialists physically travel to their workshop; collectors keep
  // their normal gather/deliver loop. Explicit player orders retain priority.
  if(spec.role!=='collector'){
   const workplace=u.workplace?postOf.get(u.workplace):null;
   if(workplace&&workplace.hp>0&&workplace.remaining<=0&&spec.role!=='combat'&&!u.order)move(world,data,u,center(workplace,data),stats(u,data).speed,dt,data.buildings[workplace.type].size/2+.6,false,true);
   // Living sky (Phase 10): after dark, workless idle hands drift home to
   // the hall instead of standing in the dark. Posted, ordered and combat
   // villagers hold their ground; worlds without the flag read day.
   else if(!workplace&&!u.order&&world.night===true&&spec.role!=='combat'&&hall)move(world,data,u,center(hall,data),stats(u,data).speed,dt,1.6,false,true);
   continue;
  }
  if(u.order&&u.order.kind==='move'&&Number.isFinite(u.order.x)){if(move(world,data,u,u.order,stats(u,data).speed,dt,.4,false,true))u.order=null;continue;}
  if(u.order&&u.order.kind==='hold')continue;
  if(u.expedition)continue;
  if(!spec.gatherResource)continue;
  const source=sourceFor(world,data,spec,u,aliveByProd,postOf);if(!source)continue;
  const gear=data.items[u.gear];if(!gear)continue;
  const item=gear.stats||{};
  // Armor-slot pieces (Winter Coat onward) can carry gather/carry stats:
  // gather multiplies onto the main hand, carry adds, same generic axis
  // as the hp/speed wardrobe read-through in stats(). No per-troop logic.
  const worn=(u.armor&&data.items[u.armor]&&data.items[u.armor].stats)||{};
  const gatherMult=(item.gather||1)*(worn.gather||1);
  let capacity=(item.carry||spec.carry||0)+(worn.carry||0)+(aura.carry||0);
  // Phase 7: Strong backs haul a quarter more. Old saves without traits read exactly the old capacity.
  if(hasTrait(u,'strong'))capacity*=1.25;
  if(!Number.isFinite(capacity)||capacity<=0)capacity=1;
  if(!Number.isFinite(u.carry)||u.carry<0)u.carry=0;
  if(u.carry>=capacity)u.phase='return';
  // Collectors now work the source and add their haul to that producer's
  // capped on-site buffer. They never bypass storage by pouring directly
  // into the shared resource pool.
  const target=source;
  const speed = stats(u,data).speed;
  if(move(world,data,u,center(target,data),speed,dt,1.6,false,true)) {
   if(u.phase==='return'){
    const srcSpec=data.buildings[source.type],cap=reserveCapacity(srcSpec,source.level);
    const held=Number.isFinite(source.harvestBonus)?Math.max(0,source.harvestBonus):0;
    const room=Math.max(0,cap-held),deposited=Math.min(room,u.carry);
    if(deposited>0)source.harvestBonus=held+deposited;
    u.carry=Math.max(0,u.carry-deposited);
    if(u.carry<.001){u.carry=0;u.phase='gather';}
   }
   else {
    const bonus=unlockedAbilities(u,data).filter(a=>a.effect==='gather').reduce((n,a)=>n+a.value,1);
    const midC = midgameRate(world.elapsed, 0.85);
    // Phase 7: job skill (+8%/level) and Hard Workers (+12%) quicken the hands. Level-1 crews read exactly the old rate.
    const rate = 3*gatherMult*bonus*(1+(aura.gather||0))*gatherBonus(u,world,data,postOf)*midC*jobLevelMult(u)*(hasTrait(u,'hard_worker')?1.12:1);
    const room = Math.max(0,capacity-u.carry);
    let fill=Math.min(room,rate*dt*reserveMult(source));
    if(!Number.isFinite(fill)||fill<0)fill=0;
    drain(source, fill);
    u.carry+=fill;
    // Assigned fishers make a visible splash while they work the pond.
    // The sound is throttled well below the visual rate: a creel of fishers
    // must never machine-gun the ding channel while nobody is looking.
    if (u.type === 'fisherman' && u.workplace === source.id && Math.random() < dt * 1.2) {
      splash(world, source.x + 1 + Math.random() * 0.4, source.y + 1 + Math.random() * 0.4);
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (now - lastSplash > 1500) { lastSplash = now; sfx.splash(); }
    }
   }
  }
 }
}
