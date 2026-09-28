import {distance,center} from '../model.js';
import {blocked,move} from './pathfinding.js';
import {isWall} from './walls.js';
export function factionFor(data,wave,vlevel=1) {
 // Endgame courts only answer seasoned villages: a minLevel gate keeps
 // siege engines and pale courts out of mid-game raids entirely.
 const factions=(data.world.enemyFactions||[]).filter(f=>wave>=(f.minWave||1)&&(vlevel||1)>=(f.minLevel||1));
 return factions.length?factions[(wave-1)%factions.length]:null;
}
export function enemyRole(data,enemy){return data.world.enemyRoles?.[enemy.role]||{};}
// Respond to breaches and nearby attacks rather than chasing a distant scout.
// Perf: optional ctx {postOf, urgCache} memoizes the per-enemy urgency
// (targetIds are static during the troops loop) and skips buildings.find.
export function defenseTarget(world,data,unit,ctx) {
 let best=null,score=Infinity;
 for(const e of world.enemies){if(e.hp<=0)continue;
  let urgency;
  if(ctx?.urgCache && ctx.urgCache.has(e.id)) urgency=ctx.urgCache.get(e.id);
  else {
   const target=ctx?.postOf
    ? (e.targetId!=null?ctx.postOf.get(e.targetId):null)
    : world.buildings.find(b=>b.id===e.targetId&&b.hp>0);
   const live=target&&target.hp>0?target:null;
   // Soldiers answer an attacked gatehouse almost like a breached hall:
   // gates are the hinge every raid turns on.
   urgency=live?(live.type==='hall'?4:live.type==='gate'?3:2):0;
   if(ctx?.urgCache)ctx.urgCache.set(e.id,urgency);
  }
  const value=distance(unit,e)-urgency-(e.role==='breaker'?1:0);
  if(value<score){best=e;score=value;}
 }
 return best;
}
// One adjacent safe tile: bounded work and no retreat through an enemy group.
export function retreat(world,data,unit,enemy,speed,dt) {
 const options=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:Math.floor(unit.x)+x+.5,y:Math.floor(unit.y)+y+.5})).filter(p=>p.x>=0&&p.y>=0&&p.x<(world.bounds?.w||data.world.width)&&p.y<(world.bounds?.h||data.world.height)&&!blocked(world,data,Math.floor(p.x),Math.floor(p.y),true)&&distance(p,enemy)>distance(unit,enemy)&&!world.enemies.some(e=>e.hp>0&&distance(p,e)<1.2)).sort((a,b)=>distance(b,enemy)-distance(a,enemy));
 if(!options.length)return false;
 move(world,data,unit,options[0],speed,dt,.1,false,true);return true;
}
export function enemyBuildingTarget(world,data,enemy) {
 const role=enemyRole(data,enemy);
 // Perf: single min-scan with centers hoisted — was filter+sort with
 // center() recomputed per comparison. Strict < keeps the first minimal,
 // exactly what the stable sort's [0] returned.
 let best=null,bestScore=Infinity;
 for(const b of world.buildings){
  if(b.hp<=0||b.type==='trap')continue;
  const c=center(b,data);
  const s=distance(enemy,c)-(role.wallDamage>1&&isWall(b)?3:0)-(b.type==='gate'?2:0);
  if(s<bestScore){bestScore=s;best=b;}
 }
 return best;
}
