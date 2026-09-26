import {builderBonuses,center,unlockedAbilities,stats} from '../model.js';
import {move} from './pathfinding.js';
import {sfx} from './audio.js';
export function addResource(world,resource,amount) {world.resources[resource]+=amount;world.gathered[resource]+=amount;}
const GLYPH={wood:'▰',food:'♧',gold:'◆'};
function push(world,effect){if(world.effects.length<140)world.effects.push(effect);}
export function floatText(world,x,y,text,color){push(world,{x,y,tx:x,ty:y-1.1,kind:'float',text,color,life:.9});}
function sparkle(world,x,y){push(world,{x,y,tx:x,ty:y,kind:'sparkle',life:.4});}
export function tickEconomy(world,data,dt) {
 const bonus=builderBonuses(world,data);
 for(const b of world.buildings) {
  if(b.hp<=0)continue;
  if(b.remaining>0){b.remaining=Math.max(0,b.remaining-dt*bonus.speed);continue;}
  const spec=data.buildings[b.type];
  if(spec.production) {addResource(world,spec.production,spec.rate*spec.tiers[b.level-1].rateMultiplier*dt);
   // Batch passive income into visible +N popups on the producing building.
   world._incAcc=world._incAcc||{};const key=spec.production;
   world._incAcc[key]=(world._incAcc[key]||0)+spec.rate*spec.tiers[b.level-1].rateMultiplier*dt;
   if(world._incAcc[key]>=5){const shown=Math.floor(world._incAcc[key]);world._incAcc[key]-=shown;const cp=center(b,data);floatText(world,cp.x,cp.y,`+${shown} ${GLYPH[key]}`,key==='food'?'#bfe3a8':key==='wood'?'#e8c98a':'#f2d878');}}
 }
 const hall=world.buildings.find(b=>b.type==='hall'&&b.hp>0);if(!hall)return;
 for(const u of world.troops) {
  if(u.hp<=0)continue;
  const spec=data.troops[u.type];if(spec.role!=='collector')continue;
  const source=world.buildings.find(b=>b.hp>0&&b.remaining<=0&&data.buildings[b.type].production===spec.gatherResource);if(!source)continue;
  const item=data.items[u.gear].stats,capacity=item.carry||spec.carry;
  if(u.carry>=capacity)u.phase='return';
  const target=u.phase==='return'?hall:source;
  if(move(world,data,u,center(target,data),stats(u,data).speed,dt,1.6)) {
   if(u.phase==='return'){addResource(world,spec.gatherResource,u.carry);const cp=center(hall,data);floatText(world,cp.x,cp.y,`+${Math.floor(u.carry)} ${GLYPH[spec.gatherResource]}`,'#ffe9a8');sparkle(world,cp.x,cp.y);sfx.collect();u.carry=0;u.phase='gather';}
   else {const bonus=unlockedAbilities(u,data).filter(a=>a.effect==='gather').reduce((n,a)=>n+a.value,1);u.carry=Math.min(capacity,u.carry+3*(item.gather||1)*bonus*dt);}
  }
 }
}
