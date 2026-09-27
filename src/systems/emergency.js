import {center,distance,stats} from '../model.js';
import {move} from './pathfinding.js';
import {retreat} from './tactics.js';
const danger=(world,p,r=3)=>world.enemies.some(e=>e.hp>0&&distance(e,p)<r);
// Orders, workplaces and carried goods are never overwritten. Emergency is a
// temporary overlay; normal duties resume as soon as the last threat passes.
export function tickEmergency(world,data,dt) {
 const active=!!world.raidPending||world.enemies.some(e=>e.hp>0);
 const shelters=world.buildings.filter(b=>b.hp>0&&b.remaining<=0&&(b.type==='hall'||data.buildings[b.type].housing));
 for(const u of world.troops){
  if(!active||u.hp<=0||u.expedition||data.troops[u.type].role==='combat'){delete u.emergency;continue;}
  u.emergency={kind:'shelter'};
  const s=stats(u,data),spec=data.troops[u.type];
  const nearest=world.enemies.filter(e=>e.hp>0).sort((a,b)=>distance(u,a)-distance(u,b))[0];
  if(nearest&&distance(u,nearest)<2.5){retreat(world,data,u,nearest,s.speed,dt);continue;}
  const job=spec.emergency;
  if(job==='repair'&&world.resources.wood>0){
   const b=world.buildings.filter(b=>b.hp>0&&b.remaining<=0&&(b.type==='wall'||b.type==='hall'||data.buildings[b.type].tiers[b.level-1].damage)&&b.hp<data.buildings[b.type].tiers[b.level-1].hp&&!danger(world,center(b,data),3.5)).sort((a,b)=>distance(u,center(a,data))-distance(u,center(b,data)))[0];
   if(b){u.emergency={kind:'repair',target:b.id};if(move(world,data,u,center(b,data),s.speed,dt,data.buildings[b.type].size/2+.7,true)){
    const hp=Math.min(6*dt,data.buildings[b.type].tiers[b.level-1].hp-b.hp,world.resources.wood*15);b.hp+=hp;world.resources.wood=Math.max(0,world.resources.wood-hp/15);
   }continue;}
  }
  if(job==='heal'){
   const ally=world.troops.filter(t=>t!==u&&t.hp>0&&!t.expedition&&t.hp<stats(t,data).hp&&!danger(world,t,3.5)).sort((a,b)=>a.hp/stats(a,data).hp-b.hp/stats(b,data).hp)[0];
   if(ally){u.emergency={kind:'heal',target:ally.id};if(move(world,data,u,ally,s.speed,dt,1.8,true))ally.hp=Math.min(stats(ally,data).hp,ally.hp+3*dt);continue;}
  }
  // Prefer the nearest safe living home; route around enemy positions.
  const shelter=shelters.filter(b=>!danger(world,center(b,data),4)).sort((a,b)=>distance(u,center(a,data))-distance(u,center(b,data)))[0];
  if(shelter){u.emergency.target=shelter.id;move(world,data,u,center(shelter,data),s.speed,dt,data.buildings[shelter.type].size/2+.7,true);}
 }
}
