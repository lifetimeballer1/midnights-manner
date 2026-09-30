// Shared stores remain the authoritative inventory. Producer batches are
// reservations at their source until unloading, so collection, orders, raids,
// save/reload and destroyed destinations cannot lose or duplicate material.
// Store -> workshop runs carry supply signals against that shared balance;
// signals affect modest throughput, never mint/spend an inventory copy.
import {stats,center} from '../model.js';
import {hasTrait} from './villagers.js';
import {centralRoom,depositCentral,storageCap} from './storage.js';
import {recordTravel,trailMultiplier} from './trails.js';
import {roadAt,greatWorkTier} from './roads.js';
import {routeGraph,layoutSignature,accessTile,routeField,routeDistance,ROUTE_BUDGET} from './logistics-routes.js';
export const LOGISTICS_LIMITS=Object.freeze({jobs:24,carts:10,caravans:1,planningSeconds:2});
const states=new WeakMap(),assignments=new WeakMap();
export function haulFor(u){return assignments.get(u)||null;}
export function isHauling(u){return assignments.has(u);}
function live(b){return b&&b.hp>0&&b.remaining<=0;}
function state(w){let s=states.get(w);if(!s){s={jobs:[],clock:2,signature:null,graph:null,byId:new Map(),candidates:new Map(),crew:new Map(),units:new Set(),supply:new Map(),links:new Map(),caravans:[],collectorTargets:new WeakMap(),efficiencies:new Map(),serial:0,producerCursor:0,delivered:0,blocked:0};states.set(w,s);}return s;}
export function logisticsMetrics(w){const s=states.get(w);return {activeJobs:s?.jobs.length||0,visibleCarts:s?.jobs.filter(j=>j.cart).length||0,routeCache:s?.graph?.fields.size||0,pathCalculations:s?.graph?.calculations||0,intervalPathCalculations:s?.graph?ROUTE_BUDGET-s.graph.budget:0,delivered:s?.delivered||0,blocked:s?.blocked||0,roads:Object.keys(w.roads||{}).length,trails:Object.keys(w.trails||{}).length,caravans:s?.caravans.length||0};}
function canHaul(u,w,d){return u.hp>0&&!u.workplace&&!u.order&&!u.emergency&&!u.expedition&&!(u.carry>0)&&d.troops[u.type]?.role!=='combat'&&!(d.troops[u.type]?.role==='builder'&&w.buildings.some(b=>b.hp>0&&b.remaining>0));}
function index(w,d,s){const sig=layoutSignature(w,d);if(sig!==s.signature){s.signature=sig;s.graph=routeGraph(w,d);s.byId.clear();s.candidates.clear();s.links.clear();for(const b of w.buildings){s.byId.set(b.id,b);if(!live(b))continue;const spec=d.buildings[b.type],keys=new Set(Object.keys(spec.storage||{}));for(const r of spec.refine||[])for(const k of Object.keys(r.in||{}))keys.add(k);if(b.type==='hall')for(const k of Object.keys(d.world.storageBase||{}))keys.add(k);for(const key of keys){let arr=s.candidates.get(key);if(!arr)s.candidates.set(key,arr=[]);arr.push(b);}}}s.graph.budget=ROUTE_BUDGET;for(const id of s.supply.keys())if(!s.byId.has(id))s.supply.delete(id);s.units.clear();for(const u of w.troops)s.units.add(u);s.crew.clear();for(const u of w.troops)if(u.hp>0&&u.workplace&&!u.order&&!u.emergency&&!u.expedition)s.crew.set(u.workplace,(s.crew.get(u.workplace)||0)+1);}
function demand(b,d,key,s){if(!(s.crew.get(b.id)>0))return 0;let need=0;for(const r of d.buildings[b.type]?.refine||[])need+=(r.in?.[key]||0)*(r.perSec||0)*10;const token=s.supply.get(b.id)?.[key];return Math.max(0,need-(token&&s.now-token.at<30?token.amount:0));}
function hub(b,d,key){return b.type==='hall'||(d.buildings[b.type]?.storage?.[key]||0)>0;}
export function chooseDestination(w,d,source,key,{s=state(w),consumerOnly=false}={}){
 if(!s.graph)index(w,d,s);if(!(centralRoom(w,d,key)>0)&&!consumerOnly)return null;
 const from=accessTile(s.graph,source,d);if(!from)return null;let best=null,bestScore=Infinity;
 for(const b of s.candidates.get(key)||[]){if(b.id===source.id||!live(b))continue;const need=demand(b,d,key,s),isHub=hub(b,d,key);if(consumerOnly?!need:!isHub&&!need)continue;
  const point=accessTile(s.graph,b,d,from);if(!point)continue;const f=routeField(s.graph,w,point),distance=routeDistance(s.graph,f,from);if(!Number.isFinite(distance))continue;
  let busy=0;for(const j of s.jobs)if(j.destinationId===b.id)busy++;
  const preferred=b.type==='grand-granary'&&['food','flour','bread'].includes(key)?2:b.type==='market-square'?1:0;
  const score=distance+busy*3-Math.min(6,need*.25)-preferred;
  if(score<bestScore){bestScore=score;best={building:b,point,field:f,distance,need};}
 }
 return best;
}
function nearWork(w,d,s,point,key){let mult=1;for(const b of s.byId.values()){if(!live(b)||Math.hypot(center(b,d).x-point.x,center(b,d).y-point.y)>8)continue;if(b.type==='grand-granary'&&['food','flour','bread','rations'].includes(key))mult=Math.max(mult,1+.03*b.level);if(b.type==='forge-quarter'&&['wood','gold','lumber','plate','frostwood'].includes(key))mult=Math.max(mult,1+.025*b.level);if(b.type==='market-square')mult=Math.max(mult,1+.015*b.level);}return Math.min(1.2,mult);}
function cancel(s,j){if(j.unit)assignments.delete(j.unit);const i=s.jobs.indexOf(j);if(i>=0)s.jobs.splice(i,1);}
function createJob(w,d,s,source,key,kind='reserve',destination=null){
 if(s.jobs.length>=LOGISTICS_LIMITS.jobs||s.jobs.some(j=>j.sourceId===source.id&&j.resource===key&&j.kind===kind))return false;
 const dest=destination||chooseDestination(w,d,source,key,{s,consumerOnly:kind==='supply'});if(!dest)return false;
 const origin=accessTile(s.graph,source,d,dest.point);if(!origin)return false;const field=routeField(s.graph,w,origin);if(!field)return false;
 let unit=null,best=Infinity;for(const u of w.troops){if(!canHaul(u,w,d)||assignments.has(u))continue;const n=routeDistance(s.graph,field,u);if(n<best){best=n;unit=u;}}
 if(!unit)return false;const carry=24*(hasTrait(unit,'strong')?1.25:1),amount=Math.min(carry,kind==='reserve'?source.harvestBonus||0:w.resources[key]||0);if(amount<1)return false;
 const cart=amount>=18&&s.jobs.filter(j=>j.cart).length<LOGISTICS_LIMITS.carts;
 const j={id:++s.serial,kind,sourceId:source.id,destinationId:dest.building.id,source,destination:dest.building,resource:key,amount,unit,assignedUnit:unit.id,phase:'pickup',origin,target:dest.point,originField:field,targetField:dest.field,distance:dest.distance,cart,loaded:false,wheel:0,heading:0,pause:0,age:0,revision:s.signature};s.jobs.push(j);assignments.set(unit,j);s.links.set(source.id,{destinationId:dest.building.id,distance:dest.distance});return true;
}
function plan(w,d,s){index(w,d,s);s.blocked=0;s.efficiencies.clear();
 const count=w.buildings.length;for(let i=0;i<count;i++){const b=w.buildings[(s.producerCursor+i)%count];if(!live(b))continue;const key=d.buildings[b.type].production;if(key&&(b.harvestBonus||0)>=4){if(!createJob(w,d,s,b,key))s.blocked++;}}s.producerCursor=count?(s.producerCursor+7)%count:0;
 // Only one supply trip per workshop/key; crews keep their assigned posts.
 for(const b of w.buildings){if(!live(b)||!s.crew.get(b.id))continue;for(const r of d.buildings[b.type]?.refine||[])for(const key of Object.keys(r.in||{})){if(demand(b,d,key,s)<1||s.jobs.some(j=>j.kind==='supply'&&j.destinationId===b.id&&j.resource===key))continue;let source=null,min=Infinity;const to=center(b,d);for(const h of s.candidates.get(key)||[]){if(h.id===b.id||!hub(h,d,key)||!live(h))continue;const dist=Math.hypot(center(h,d).x-to.x,center(h,d).y-to.y);if(dist<min){min=dist;source=h;}}if(source){const origin=accessTile(s.graph,source,d),point=accessTile(s.graph,b,d,origin||to);if(!point||!origin)continue;const f=routeField(s.graph,w,point),distance=routeDistance(s.graph,f,origin);if(Number.isFinite(distance))createJob(w,d,s,source,key,'supply',{building:b,point,field:f,distance});}}}
}
function walk(w,d,s,j,target,field,dt){const u=j.unit,g=s.graph;if(!field)return false;let dx=target.x-u.x,dy=target.y-u.y;if(Math.hypot(dx,dy)<.12)return true;let waypoint=j.waypoint;
 if(!waypoint||Math.hypot(u.x-waypoint.x,u.y-waypoint.y)<.001){const k=Math.floor(u.y)*g.W+Math.floor(u.x),n=field.next[k];if(k===field.key)waypoint=target;else if(n>=0)waypoint={x:n%g.W+.5,y:Math.floor(n/g.W)+.5};else return false;j.waypoint=waypoint;}
 let tx=waypoint.x,ty=waypoint.y;
 dx=tx-u.x;dy=ty-u.y;const len=Math.hypot(dx,dy);if(len<1e-8)return false;let speed=stats(u,d).speed*trailMultiplier(w,u.x,u.y,true);if(j.cart&&roadAt(w,u.x,u.y))speed*=1+Math.min(.04,greatWorkTier(w,'stone-road')*.007);speed=Math.min(stats(u,d).speed*1.35,speed);const step=Math.min(len,speed*dt),oldX=u.x,oldY=u.y;u.x+=dx/len*step;u.y+=dy/len*step;j.heading=Math.atan2(dy,dx);j.wheel+=step/.085;recordTravel(w,d,oldX,oldY,u.x,u.y);return Math.hypot(u.x-target.x,u.y-target.y)<.12;}
function supply(s,b,key,n,now){let keys=s.supply.get(b.id);if(!keys)s.supply.set(b.id,keys={});keys[key]={amount:Math.min(96,(keys[key]?.amount||0)+n),at:now};}
export function tickLogistics(w,d,dt){if(!(dt>0)||!Number.isFinite(dt))return;const s=state(w);s.now=w.elapsed||0;s.clock+=dt;if(s.clock>=2||!s.graph||s.byId.size!==w.buildings.length||s.units.size!==w.troops.length){s.clock=0;plan(w,d,s);}
 const alarm=!!w.raidPending||(w.enemies||[]).some(e=>e.hp>0);
 for(let i=s.jobs.length-1;i>=0;i--){const j=s.jobs[i],u=j.unit;j.age+=dt;
  if(alarm||!s.units.has(u)||!canHaul(u,w,d)||!live(j.source)||!live(j.destination)||j.age>180){cancel(s,j);continue;}
  if(j.revision!==s.signature){cancel(s,j);continue;}
  if(j.phase==='pickup'){if(walk(w,d,s,j,j.origin,j.originField,dt)){j.phase='load';j.pause=.8;}}
  else if(j.phase==='load'){j.pause-=dt*(hasTrait(u,'hard_worker')?1.12:1)*nearWork(w,d,s,j.origin,j.resource);if(j.pause<=0){j.amount=Math.min(j.amount,j.kind==='reserve'?j.source.harvestBonus||0:w.resources[j.resource]||0);if(j.amount<1){cancel(s,j);continue;}j.loaded=true;j.phase='delivery';j.waypoint=null;}}
  else if(j.phase==='delivery'){if(walk(w,d,s,j,j.target,j.targetField,dt)){j.phase='unload';j.pause=.8;}}
  else{j.pause-=dt*(hasTrait(u,'hard_worker')?1.12:1)*nearWork(w,d,s,j.target,j.resource);if(j.pause>0)continue;
   if(j.kind==='reserve'){const amount=Math.min(j.amount,j.source.harvestBonus||0),result=depositCentral(w,d,j.resource,amount);j.source.harvestBonus=Math.max(0,(j.source.harvestBonus||0)-result.banked);s.delivered+=result.banked;if(result.banked>0)supply(s,j.destination,j.resource,result.banked,w.elapsed||0);}
   else supply(s,j.destination,j.resource,Math.min(j.amount,w.resources[j.resource]||0),w.elapsed||0);
   cancel(s,j);
  }
 }
 tickCaravans(w,d,s,dt,alarm);
}
export function refinementEfficiency(w,d,b){const s=states.get(w);if(!s?.graph)return 1;let distance=0,n=0,delivered=0;const cached=s.efficiencies.get(b.id);for(const r of d.buildings[b.type]?.refine||[])for(const key of Object.keys(r.in||{})){if(!cached){let min=Infinity;const p=center(b,d);for(const h of s.candidates.get(key)||[])if(h.id!==b.id&&hub(h,d,key)&&live(h)){const q=center(h,d);min=Math.min(min,Math.hypot(p.x-q.x,p.y-q.y));}if(Number.isFinite(min)){distance+=min;n++;}}const token=s.supply.get(b.id)?.[key];if(token&&(w.elapsed||0)-token.at<30&&token.amount>0)delivered++;}
 let base=cached;if(base===undefined){const dist=n?distance/n:0,benefit=nearWork(w,d,s,center(b,d),'wood')-1;base=1-Math.max(0,dist-8)*.005+benefit*.3;s.efficiencies.set(b.id,base);}return Math.max(.85,Math.min(1.15,base+(delivered?.06:0)));}
export function consumeSupply(w,b,inputs,runs){const keys=states.get(w)?.supply.get(b.id);if(keys)for(const [k,v] of Object.entries(inputs||{}))if(keys[k])keys[k].amount=Math.max(0,keys[k].amount-v*runs);}
export function buildingLogistics(w,d,b){const s=states.get(w),link=s?.links.get(b.id);let incoming=0,outgoing=0,total=0;for(const j of s?.jobs||[]){if(j.destinationId===b.id){incoming++;total+=j.distance;}if(j.sourceId===b.id)outgoing++;}const dest=link&&s.byId.get(link.destinationId);return {destination:dest?d.buildings[dest.type].name:null,distance:link?.distance||0,incoming,outgoing,average:incoming?total/incoming:0,efficiency:refinementEfficiency(w,d,b),reserve:b.harvestBonus||0};}
// Future Warfront consumers get values, never mutable runtime jobs/maps.
export function settlementTopology(w,d){const districts={industrial:[],food:[],residential:[],trade:[],military:[]},hubs=[],gates=[];for(const b of w.buildings){if(!live(b))continue;const spec=d.buildings[b.type];if(spec.storage)hubs.push(b.id);if(b.type==='gate')gates.push(b.id);const type=b.type;if(/mine|forge|smelt|armory|sawmill/.test(type))districts.industrial.push(b.id);if(/farm|mill|bakery|granary|pasture/.test(type))districts.food.push(b.id);if(/cottage|longhouse|chapel|gardens|hall/.test(type))districts.residential.push(b.id);if(/market/.test(type))districts.trade.push(b.id);if(/barrack|fletcher|shield|tower|gate/.test(type))districts.military.push(b.id);}
 const intersections=[],roads=Object.entries(w.roads||{}).map(([key,tier])=>({key,tier}));for(const r of roads){const [x,y]=r.key.split(',').map(Number);let neighbors=0;for(const k of [`${x+1},${y}`,`${x-1},${y}`,`${x},${y+1}`,`${x},${y-1}`])if(w.roads[k])neighbors++;if(neighbors>=3)intersections.push(r.key);}return {hubs,gates,districts,roads,intersections,primaryRoads:Object.entries(w.trails||{}).filter(([,e])=>e[0]>=45).map(([key,e])=>({key,wear:e[0],tier:w.roads?.[key]||0})),routes:(states.get(w)?.jobs||[]).map(j=>({sourceId:j.sourceId,destinationId:j.destinationId,resource:j.resource,distance:j.distance}))};}
export function visualHauls(w){return states.get(w)?.jobs||[];}
export function visualCaravans(w){return states.get(w)?.caravans||[];}
export function requestCaravan(w,d){const s=state(w);if(!s.graph)index(w,d,s);if(s.caravans.length>=1)return false;const market=w.buildings.find(b=>live(b)&&b.type==='market-square')||w.buildings.find(b=>live(b)&&b.type==='market');if(!market)return false;const target=accessTile(s.graph,market,d);if(!target)return false;const f=routeField(s.graph,w,target);if(!f)return false;let entry=null;for(let x=1;x<s.graph.W-1;x++){for(const y of [1,s.graph.H-2]){const p={x:x+.5,y:y+.5};if(Number.isFinite(routeDistance(s.graph,f,p))){entry=p;break;}}if(entry)break;}if(!entry)return false;s.caravans.push({unit:{...entry},entry,target,field:f,phase:'inbound',pause:2,loaded:true,wheel:0,heading:0,resource:'food',cart:true,revision:s.signature,age:0});return true;}
function tickCaravans(w,d,s,dt,alarm){
 for(let i=s.caravans.length-1;i>=0;i--){const c=s.caravans[i];c.age+=dt;
  if(alarm||c.revision!==s.signature||c.age>180){s.caravans.splice(i,1);continue;}
  if(c.phase==='unload'){c.pause-=dt*(1+.02*greatWorkTier(w,'market-square'));if(c.pause<=0){c.loaded=false;c.phase='outbound';c.field=routeField(s.graph,w,c.entry);c.waypoint=null;}continue;}
  const target=c.phase==='inbound'?c.target:c.entry,u=c.unit,g=s.graph;
  if(Math.hypot(u.x-target.x,u.y-target.y)<.12){if(c.phase==='inbound')c.phase='unload';else s.caravans.splice(i,1);continue;}
  if(!c.field){c.field=routeField(g,w,target);continue;}
  let wp=c.waypoint;if(!wp||Math.hypot(u.x-wp.x,u.y-wp.y)<.001){const k=Math.floor(u.y)*g.W+Math.floor(u.x),n=c.field.next[k];if(k===c.field.key)wp=target;else if(n>=0)wp={x:n%g.W+.5,y:Math.floor(n/g.W)+.5};else continue;c.waypoint=wp;}
  const dx=wp.x-u.x,dy=wp.y-u.y,len=Math.hypot(dx,dy),trade=greatWorkTier(w,'stone-road')>=5?1.03:1,step=Math.min(len,dt*1.2*trailMultiplier(w,u.x,u.y)*trade);
  if(len){const x=u.x,y=u.y;u.x+=dx/len*step;u.y+=dy/len*step;c.heading=Math.atan2(dy,dx);c.wheel+=step/.085;recordTravel(w,d,x,y,u.x,u.y);}
 }
}

// Existing collectors retain their gather/carry amounts; only their return hub
// changes, using the same bounded planner and manual/emergency priority.
export function collectorDestination(w,d,u,source,key){const s=states.get(w);if(!s?.graph)return null;let entry=s.collectorTargets.get(u);if(entry&&entry.revision===s.signature&&live(entry.building)&&entry.until>(w.elapsed||0))return entry.building;const dest=chooseDestination(w,d,source,key,{s});if(!dest)return null;entry={building:dest.building,until:(w.elapsed||0)+2,revision:s.signature};s.collectorTargets.set(u,entry);s.links.set(source.id,{destinationId:dest.building.id,distance:dest.distance});return entry.building;}
