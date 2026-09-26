import {builderBonuses,center,unlockedAbilities,stats} from '../model.js';
import {move} from './pathfinding.js';
export function addResource(world,resource,amount) {world.resources[resource]+=amount;world.gathered[resource]+=amount;}
export function tickEconomy(world,data,dt) {
 const bonus=builderBonuses(world,data);
 for(const b of world.buildings) {
  if(b.hp<=0)continue;
  if(b.remaining>0){b.remaining=Math.max(0,b.remaining-dt*bonus.speed);continue;}
  const spec=data.buildings[b.type];
  if(spec.production) addResource(world,spec.production,spec.rate*spec.tiers[b.level-1].rateMultiplier*dt);
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
   if(u.phase==='return'){addResource(world,spec.gatherResource,u.carry);u.carry=0;u.phase='gather';}
   else {const bonus=unlockedAbilities(u,data).filter(a=>a.effect==='gather').reduce((n,a)=>n+a.value,1);u.carry=Math.min(capacity,u.carry+3*(item.gather||1)*bonus*dt);}
  }
 }
}
