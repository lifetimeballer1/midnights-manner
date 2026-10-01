import {center,distance,stats} from '../model.js';
import {buildingMaxHp} from './endgame.js';
import {isWall} from './walls.js';
import {blocked} from './pathfinding.js';

// Home-only, transient battlefield plans. Campaign authors keep their rules.
export const SIEGE_LIMITS=Object.freeze({groups:4,planningSeconds:1,commitSeconds:4});
const plans=new WeakMap();
const SIDES=['west','north','east','south'];
function sideOf(e,w,d){const edges=[e.x,e.y,(w.bounds?.w||d.world.width)-e.x,(w.bounds?.h||d.world.height)-e.y];return SIDES[edges.indexOf(Math.min(...edges))];}
function live(b){return b.hp>0&&b.remaining<=0;}
function depth(p,side,d){return side==='west'?p.x:side==='east'?d.world.width-p.x:side==='north'?p.y:d.world.height-p.y;}
function pressure(b,d,defenses){const c=center(b,d);let n=0;for(const other of defenses){const t=d.buildings[other.type].tiers[other.level-1];if(distance(c,center(other,d))<=(t.range||0)+1)n+=t.damage||0;}return Math.min(12,n/8);}
function selectTarget(w,d,g,p){
 const living=w.buildings.filter(live),barriers=living.filter(isWall),defenses=living.filter(b=>d.buildings[b.type].tiers[b.level-1]?.damage);
 // Only the exposed band is probed; no beeline toward a sheltered rear wall.
 const edge=barriers.length?Math.min(...barriers.map(b=>depth(center(b,d),g.side,d))):Infinity;
 const candidates=barriers.filter(b=>depth(center(b,d),g.side,d)<=edge+3);
 let breach=null,breachScore=Infinity;
 for(const b of w.buildings){if(b.hp>0||!p.standing.has(b.id))continue;const c=center(b,d),score=distance(g.point,c);if(score<breachScore){breach=b;breachScore=score;}}
 let best=null,score=Infinity;
 for(const b of candidates.length&&!breach?candidates:living.filter(b=>!isWall(b))){
  const c=center(b,d),s=distance(g.point,c)+pressure(b,d,defenses)+(isWall(b)?8*b.hp/buildingMaxHp(b,d):b.type==='hall'?-4:0);
  if(s<score){score=s;best=b;}
 }
 return {target:best,breach};
}
export function tickSiege(w,d,dt){
 if(!(dt>0)||!Number.isFinite(dt))return;
 let p=plans.get(w);if(!p){p={clock:0,next:0,runs:0,active:false,members:new Map(),screens:new Map(),groups:[],standing:new Set(),breaches:new Set(),pressures:new Set(),exploits:0};plans.set(w,p);}
 p.clock+=dt;const enemies=w.enemies.filter(e=>e.hp>0&&e.role!=='boss');
 if(!w.enemies.some(e=>e.hp>0)){p.active=false;p.groups=[];p.members.clear();p.screens.clear();return;}
 if(!p.active){p.active=true;p.standing=new Set(w.buildings.filter(b=>live(b)&&isWall(b)).map(b=>b.id));p.breaches.clear();p.pressures.clear();p.exploits=0;p.next=0;}
 if(p.clock<p.next)return;p.next=p.clock+SIEGE_LIMITS.planningSeconds;p.runs++;
 for(const b of w.buildings)if(b.hp<=0&&p.standing.has(b.id))p.breaches.add(b.id);
 const old=new Map(p.groups.map(g=>[g.side,g]));p.groups=[];
 const ids=new Set(enemies.map(e=>e.id));for(const id of p.members.keys())if(!ids.has(id))p.members.delete(id);
 for(const e of enemies)if(!p.members.has(e.id))p.members.set(e.id,sideOf(e,w,d));
 for(const side of SIDES){const crew=enemies.filter(e=>p.members.get(e.id)===side);if(!crew.length)continue;
  const point={x:crew.reduce((n,e)=>n+e.x,0)/crew.length,y:crew.reduce((n,e)=>n+e.y,0)/crew.length},prev=old.get(side);
  const g={side,crew,point,since:prev?.since??p.clock,until:prev?.until||0,target:prev?.target,breach:prev?.breach};
  if(!g.target||!live(g.target)||p.clock>=g.until||p.breaches.size){const next=selectTarget(w,d,g,p);g.target=next.target;g.breach=next.breach;g.until=p.clock+SIEGE_LIMITS.commitSeconds;}
  if(g.target)p.pressures.add(g.target.id);
  g.phase=g.breach?'breach':crew.length>1&&p.clock-g.since<4&&crew.some(e=>distance(e,point)>2)?'muster':'assault';
  if(g.phase==='breach'&&prev?.phase!=='breach')p.exploits++;
  p.groups.push(g);
 }
 // Screening is planned at the same bounded cadence, never rescanned per tick.
 p.screens.clear();const ranged=[],melee=[];
 for(const u of w.troops){if(u.hp<=0||u.expedition||u.order||u.emergency||d.troops[u.type]?.role!=='combat')continue;(stats(u,d).range>2?ranged:melee).push(u);}
 for(const u of melee){if(u.defensePost)continue;let best=null,score=Infinity;
  for(const ally of ranged){if(distance(u,ally)>6)continue;for(const e of w.enemies){if(e.hp<=0||distance(e,ally)>3)continue;const s=distance(u,e);if(s<score){score=s;best=e;}}}
  if(best)p.screens.set(u.id,best);
 }
}
export function siegeOrder(w,e,d){
 const p=plans.get(w);if(!p?.active||e.role==='boss')return null;
 const g=p.groups.find(g=>g.side===p.members.get(e.id));if(!g?.target||!live(g.target))return null;
 let point=null,range=.8;
 if(g.phase==='muster')point=g.point;
 else if(g.breach&&distance(e,center(g.breach,d))>1.5&&depth(e,g.side,d)<depth(center(g.breach,d),g.side,d))point=center(g.breach,d);
 return {target:g.target,point,range,phase:g.phase};
}
// Unposted melee reserves screen nearby archers instead of chasing scouts.
export function screenTarget(w,d,u){
 const p=plans.get(w),e=p?.screens.get(u.id);return p?.active&&!u.defensePost&&e?.hp>0?e:null;
}
export function battlefieldStatus(w,d){const p=plans.get(w);return {planningRuns:p?.runs||0,groups:(p?.groups||[]).map(g=>({side:g.side,count:g.crew.filter(e=>e.hp>0).length,phase:g.phase,targetId:g.target?.id,target:d.buildings[g.target?.type]?.name||'village'}))};}
export function siegeSummary(w,d){const p=plans.get(w);return {groups:p?.groups.length||0,pressures:p?.pressures.size||0,exploits:p?.exploits||0,lesson:p?.exploits?'Raiders used a breach. Keep a reserve near vulnerable gates.':p?.pressures.size?'Assault groups probed your outer defenses. Overlapping tower coverage protects weak walls.':'No coordinated assault was recorded.'};}
export function commandGroup(w,d,kind,scope='all',buildingId=null){
 if(!['hold','defend','rally','auto'].includes(kind)||!['all','melee','ranged'].includes(scope))return {ok:false,count:0};
 const b=w.buildings.find(b=>b.id===buildingId&&live(b));if(['defend','rally'].includes(kind)&&!b)return {ok:false,count:0};
 const units=w.troops.filter(u=>u.hp>0&&!u.expedition&&!u.emergency&&d.troops[u.type]?.role==='combat'&&(scope==='all'||(stats(u,d).range>2)===(scope==='ranged')));
 let count=0;
 for(const u of units){
  if(kind==='auto'){if(u.order?.group){u.order=null;count++;}continue;}
  if(kind==='hold')u.order={kind:'hold',group:true};
  else {const c=center(b,d),size=d.buildings[b.type].size;let point=null;
   // Distinct reachable muster slots around the chosen post, bounded search.
   const slots=[];for(let y=b.y-2;y<b.y+size+2;y++)for(let x=b.x-2;x<b.x+size+2;x++)if(x>=0&&y>=0&&x<d.world.width&&y<d.world.height&&!blocked(w,d,x,y,true))slots.push({x:x+.5,y:y+.5});
   slots.sort((a,z)=>distance(a,c)-distance(z,c)||a.y-z.y||a.x-z.x);point=slots[count%Math.max(1,slots.length)];if(!point)continue;
   u.order={kind:kind==='rally'?'rally':'defend',group:true,buildingId:b.id,x:point.x,y:point.y};
  }count++;
 }return {ok:count>0,count};
}
