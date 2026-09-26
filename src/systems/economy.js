import {builderBonuses,center,unlockedAbilities,stats,auras,gatherBonus} from '../model.js';
import {move} from './pathfinding.js';
import {sfx} from './audio.js';
// Open resource maps: new keys (frostwood onward) ride without a schema
// change, and pre-frostwood saves (no frostwood key yet) haul without NaN-ing.
export function addResource(world,resource,amount) {world.resources[resource]=(world.resources[resource]||0)+amount;world.gathered[resource]=(world.gathered[resource]||0)+amount;}
const GLYPH={wood:'▰',food:'♧',gold:'◆',frostwood:'❄',plate:'▣'};
const INK={wood:'#e8c98a',food:'#bfe3a8',gold:'#f2d878',frostwood:'#cfe6f5',plate:'#e8a87c'};
function push(world,effect){if(world.effects.length<140)world.effects.push(effect);}
export function floatText(world,x,y,text,color){push(world,{x,y,tx:x,ty:y-1.1,kind:'float',text,color,life:.9});}
function sparkle(world,x,y){push(world,{x,y,tx:x,ty:y,kind:'sparkle',life:.4});}
function splash(world,x,y){push(world,{x,y,tx:x,ty:y,kind:'splash',life:.5});}
// Living resources: nodes drain as they are worked and refill slowly when rested.
// Output scales 25% (tapped out) to 100% (full); nothing ever depletes forever.
const REGEN_FRACTION = 0.005;
export function reserveMult(building) {
  if (!building.maxReserve) return 1;
  return 0.25 + 0.75 * Math.max(0, Math.min(1, building.reserve / building.maxReserve));
}
function drain(building, amount) {
  if (!building.maxReserve) return;
  building.reserve = Math.max(0, building.reserve - amount);
}
function sourceFor(world, data, spec, unit) {
  const alive = world.buildings.filter(b => b.hp > 0 && b.remaining <= 0 && data.buildings[b.type].production === spec.gatherResource);
  if (!alive.length) return null;
  // Specialists work their own water/field first (fishermen need ponds, not wheat).
  if (spec.gatherFrom) {
    const home = alive.filter(b => b.type === spec.gatherFrom);
    if (home.length) {
      if (unit.workplace) {
        const assigned = home.find(b => b.id === unit.workplace);
        if (assigned) return assigned;
      }
      return home[0];
    }
    return null;
  }
  if (unit.workplace) {
    const assigned = alive.find(b => b.id === unit.workplace);
    if (assigned) return assigned;
  }
  return alive[0];
}
export function tickEconomy(world,data,dt) {
 if(!Number.isFinite(dt)||dt<=0)return;
 const bonus=builderBonuses(world,data);
 const aura=auras(world,data);
 for(const b of world.buildings) {
  if(b.hp<=0)continue;
  if(b.remaining>0){b.remaining=Math.max(0,b.remaining-dt*bonus.speed);continue;}
  const spec=data.buildings[b.type];
  // Rested nodes breathe back; worked nodes visibly drain below.
  if (b.maxReserve && b.reserve < b.maxReserve) b.reserve = Math.min(b.maxReserve, b.reserve + b.maxReserve * REGEN_FRACTION * dt);
  if(spec.production) {
   const mult = reserveMult(b);
   // Mid-game pacing: first 5 minutes run full tilt (snappy opening);
   // after that passive nodes yield 75% so expansion must come from
   // collectors, upgrades and new buildings instead of idle income.
   const mid = (world.elapsed||0) > 300 ? 0.75 : 1;
   const made = spec.rate*spec.tiers[b.level-1].rateMultiplier*mult*mid*dt;
   drain(b, made);
   addResource(world,spec.production,made);
   // Batch passive income into visible +N popups on the producing building.
   world._incAcc=world._incAcc||{};const key=spec.production;
   world._incAcc[key]=(world._incAcc[key]||0)+made;
   // Unknown future keys still pop a glyph instead of 'undefined'.
   if(world._incAcc[key]>=5){const shown=Math.floor(world._incAcc[key]);world._incAcc[key]-=shown;const cp=center(b,data);floatText(world,cp.x,cp.y,`+${shown} ${GLYPH[key]||'◈'}`,INK[key]||'#f2d878');}}
 }
 const hall=world.buildings.find(b=>b.type==='hall'&&b.hp>0);if(!hall)return;
 for(const u of world.troops) {
  if(u.hp<=0)continue;
  const spec=data.troops[u.type];
  // Posted specialists physically travel to their workshop; collectors keep
  // their normal gather/deliver loop. Explicit player orders retain priority.
  if(spec.role!=='collector'){
   const workplace=world.buildings.find(b=>b.id===u.workplace&&b.hp>0&&b.remaining<=0);
   if(workplace&&spec.role!=='combat'&&!u.order)move(world,data,u,center(workplace,data),stats(u,data).speed,dt,data.buildings[workplace.type].size/2+.6);
   continue;
  }
  if(u.order&&u.order.kind==='move'&&Number.isFinite(u.order.x)){if(move(world,data,u,u.order,stats(u,data).speed,dt,.4))u.order=null;continue;}
  if(u.order&&u.order.kind==='hold')continue;
  const source=sourceFor(world,data,spec,u);if(!source)continue;
  const gear=data.items[u.gear];if(!gear)continue;
  const item=gear.stats||{};
  // Armor-slot pieces (Winter Coat onward) can carry gather/carry stats:
  // gather multiplies onto the main hand, carry adds, same generic axis
  // as the hp/speed wardrobe read-through in stats(). No per-troop logic.
  const worn=(u.armor&&data.items[u.armor]&&data.items[u.armor].stats)||{};
  const gatherMult=(item.gather||1)*(worn.gather||1);
  let capacity=(item.carry||spec.carry||0)+(worn.carry||0)+(aura.carry||0);
  if(!Number.isFinite(capacity)||capacity<=0)capacity=1;
  if(!Number.isFinite(u.carry)||u.carry<0)u.carry=0;
  if(u.carry>=capacity)u.phase='return';
  const target=u.phase==='return'?hall:source;
  const speed = stats(u,data).speed;
  if(move(world,data,u,center(target,data),speed,dt,1.6)) {
   if(u.phase==='return'){addResource(world,spec.gatherResource,u.carry);const cp=center(hall,data);floatText(world,cp.x,cp.y,`+${Math.floor(u.carry)} ${GLYPH[spec.gatherResource]}`,'#ffe9a8');sparkle(world,cp.x,cp.y);sfx.collect();u.carry=0;u.phase='gather';}
   else {
    const bonus=unlockedAbilities(u,data).filter(a=>a.effect==='gather').reduce((n,a)=>n+a.value,1);
    const midC = (world.elapsed||0) > 300 ? 0.85 : 1;
    const rate = 3*gatherMult*bonus*(1+(aura.gather||0))*gatherBonus(u,world,data)*midC;
    const room = Math.max(0,capacity-u.carry);
    let fill=Math.min(room,rate*dt*reserveMult(source));
    if(!Number.isFinite(fill)||fill<0)fill=0;
    drain(source, fill);
    u.carry+=fill;
    // Assigned fishers make a visible splash while they work the pond.
    if (u.type === 'fisherman' && u.workplace === source.id && Math.random() < dt * 1.2) {
      splash(world, source.x + 1 + Math.random() * 0.4, source.y + 1 + Math.random() * 0.4);
      sfx.splash();
    }
   }
  }
 }
}
