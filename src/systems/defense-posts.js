import {center,distance,stats} from '../model.js';
import {move} from './pathfinding.js';
import {isWall} from './walls.js';

// Home-only planner; transient routes, targets and clocks never enter saves.
const plans=new WeakMap();
const capacities={hall:3,gate:2,tower:2,archer_tower:2,'grand-watchtower':2};
export function defensePostCapacity(b,data){
 return b&&b.hp>0&&!(b.remaining>0)&&data.buildings[b.type]?capacities[b.type]||0:0;
}
export function defenseOccupants(world,bid){return world.troops.filter(u=>u.defensePost===bid&&u.hp>0&&!u.expedition);}
export function assignDefensePost(world,data,unit,buildingId,manual=true){
 if(!unit||unit.hp<=0||unit.expedition||data.troops[unit.type]?.role!=='combat')return false;
 if(buildingId!=null){const b=world.buildings.find(b=>b.id===buildingId);
  if(!defensePostCapacity(b,data)||defenseOccupants(world,buildingId).filter(u=>u!==unit).length>=defensePostCapacity(b,data))return false;
 }
 unit.defensePost=buildingId??null;unit.manualDefensePost=!!manual;
 const p=plans.get(world);if(p)p.planAt=0;
 return true;
}
function free(u,data){return u.hp>0&&!u.expedition&&!u.order&&!u.emergency&&data.troops[u.type]?.role==='combat';}
function autoFill(world,data,p){
 const posts=world.buildings.filter(b=>defensePostCapacity(b,data));
 const occupied=new Map();
 for(const u of world.troops){
  const post=p.buildings.get(u.defensePost);
  if(u.defensePost&&(!post||(!u.manualDefensePost&&!world.raidPending&&!world.enemies.some(e=>e.hp>0)&&!defensePostCapacity(post,data)))){u.defensePost=null;u.manualDefensePost=false;}
  if(u.defensePost&&u.hp>0&&!u.expedition)occupied.set(u.defensePost,(occupied.get(u.defensePost)||0)+1);
 }
 for(const u of world.troops){
  if(!free(u,data)||u.defensePost||u.manualDefensePost)continue;
  const ranged=stats(u,data).range>2;let best=null,bestScore=Infinity;
  for(const b of posts){if((occupied.get(b.id)||0)>=defensePostCapacity(b,data))continue;
   const preferred=ranged?b.type.includes('tower'):b.type==='gate';
   const score=(preferred?0:b.type==='hall'?40:80)+distance(u,center(b,data));
   if(score<bestScore){best=b;bestScore=score;}
  }
  if(best){u.defensePost=best.id;u.manualDefensePost=false;occupied.set(best.id,(occupied.get(best.id)||0)+1);}
 }
}
function plan(world,data,p){
 p.buildings=new Map(world.buildings.map(b=>[b.id,b]));
 p.enemies=new Map(world.enemies.filter(e=>e.hp>0).map(e=>[e.id,e]));
 const breaches=world.buildings.filter(b=>isWall(b)&&b.hp<=0);
 if(p.raidActive)for(const b of breaches)if(p.standing.has(b.id))p.breached.add(b.id);
 const counts=new Map();const next=new Map();p.reinforcing=new Set();
 for(const u of world.troops){
  if(!free(u,data)||!u.defensePost)continue;
  const b=p.buildings.get(u.defensePost);if(!b)continue;
  const home=center(b,data),reserve=b.type==='hall'||b.hp<=0;
  // Reserve response is local to an actual breach, never a global army pull.
  let breach=null,bd=10;
  if(reserve)for(const broken of breaches){const c=center(broken,data),d=distance(home,c);if(d<bd&&world.enemies.some(e=>e.hp>0&&distance(e,c)<5)){bd=d;breach=c;}}
  const anchor=breach||home,radius=reserve?7:6;
  const eligible=e=>e.hp>0&&distance(e,anchor)<=radius&&distance(u,e)<=radius+3;
  let chosen=p.enemies.get(p.targets.get(u.id));
  if(!chosen||!eligible(chosen))chosen=null;
  // Keep committed targets for two seconds; other squads receive unclaimed foes.
  if(chosen&&(p.commitUntil.get(u.id)||0)>p.clock){next.set(u.id,chosen.id);counts.set(chosen.id,(counts.get(chosen.id)||0)+1);if(breach)p.reinforcing.add(u.id);continue;}
  let score=Infinity;chosen=null;
  for(const e of p.enemies.values()){if(!eligible(e))continue;
   const target=p.buildings.get(e.targetId),urgent=target?.hp>0?(target.type==='hall'?3:target.type==='gate'?2:1):0;
   const s=distance(u,e)+(counts.get(e.id)||0)*3-urgent-(e.role==='breaker'?1:0);
   if(s<score){score=s;chosen=e;}
  }
  if(chosen){next.set(u.id,chosen.id);counts.set(chosen.id,(counts.get(chosen.id)||0)+1);p.commitUntil.set(u.id,p.clock+2);if(breach)p.reinforcing.add(u.id);}
  else p.commitUntil.delete(u.id);
 }
 for(const id of p.commitUntil.keys())if(!next.has(id))p.commitUntil.delete(id);
 p.targets=next;p.planAt=p.enemies.size?p.clock+.5:Infinity;p.planningRuns++;
 if(p.raidActive)for(const id of p.reinforcing)p.responders.add(id);
}
export function plannedDefenseTarget(world,unit){
 const p=plans.get(world);if(!p||!unit.defensePost)return undefined;
 const e=p.enemies.get(p.targets.get(unit.id));return e?.hp>0?e:null;
}
export function defenseStatus(world,data,unit){
 if(!unit?.defensePost)return unit?.manualDefensePost?'Defense post released':'Available for defense';
 const b=world.buildings.find(b=>b.id===unit.defensePost),p=plans.get(world),name=data.buildings[b?.type]?.name||'post';
 if(unit.order)return 'Following your order';
 if(p?.reinforcing.has(unit.id))return 'Reinforcing a breach';
 if(plannedDefenseTarget(world,unit))return `Intercepting near ${name}`;
 return `${world.raidPending?'Mustering at':'Holding'} ${name}`;
}
export function defensePlanningMetrics(world){const p=plans.get(world);return {planningRuns:p?.planningRuns||0};}
export function defenseRaidSummary(world){const p=plans.get(world);if(p)for(const b of world.buildings)if(b.hp<=0&&p.standing.has(b.id))p.breached.add(b.id);return {breaches:p?.breached?.size||0,responders:p?.responders?.size||0};}
export function tickDefensePosts(world,data,dt){
 if(!(dt>0)||!Number.isFinite(dt))return;
 let p=plans.get(world);
 if(!p){p={clock:0,planAt:0,fillAt:0,planningRuns:0,buildings:new Map(),enemies:new Map(),targets:new Map(),commitUntil:new Map(),reinforcing:new Set(),raidActive:false,standing:new Set(),breached:new Set(),responders:new Set()};plans.set(world,p);}
 p.clock+=dt;
 const active=world.enemies.some(e=>e.hp>0);
 if(active!==p.raidActive){p.planAt=0;if(!active)for(const b of world.buildings)if(b.hp<=0&&p.standing.has(b.id))p.breached.add(b.id);if(active){p.standing=new Set(world.buildings.filter(b=>b.hp>0&&isWall(b)).map(b=>b.id));p.breached.clear();p.responders.clear();}p.raidActive=active;}
 if(p.clock>=p.fillAt){p.buildings=new Map(world.buildings.map(b=>[b.id,b]));autoFill(world,data,p);p.fillAt=p.clock+5;p.planAt=0;}
 if(p.clock>=p.planAt)plan(world,data,p);
 for(const u of world.troops){if(!free(u,data)||!u.defensePost||plannedDefenseTarget(world,u))continue;
  const b=p.buildings.get(u.defensePost);if(!defensePostCapacity(b,data))continue;
  // Stable building goal uses the shared movement route cache.
  move(world,data,u,center(b,data),stats(u,data).speed,dt,data.buildings[b.type].size/2+.8,false,true);
 }
}
