import {recordTravel,trailMultiplier} from './trails.js';
import {roadRevision} from './roads.js';
const movementCaches=new WeakMap(),actorRoutes=new WeakMap(),searchCounters=new WeakMap();
export function movementMetrics(world){const c=searchCounters.get(world);return {movementSearches:c?.total||0,movementIntervalSearches:c?.interval===Math.floor((world.elapsed||0)/2)?c.count:0};}
function countSearch(world){let c=searchCounters.get(world);if(!c){c={total:0,count:0,interval:-1};searchCounters.set(world,c);}const interval=Math.floor((world.elapsed||0)/2);if(c.interval!==interval){c.interval=interval;c.count=0;}c.total++;c.count++;}
function movementRevision(world,data){let c=movementCaches.get(world);const now=world.elapsed||0;if(c&&c.now===now&&c.count===world.buildings.length&&c.road===roadRevision(world))return c.signature;let signature=`${data.world.width},${data.world.height}|${roadRevision(world)}|`;for(const b of world.buildings)signature+=`${b.id},${b.type},${b.x},${b.y},${b.hp>0?1:0};`;c={now,count:world.buildings.length,road:roadRevision(world),signature};movementCaches.set(world,c);return signature;}
// Breadth-first routing on a small grid. Walls obstruct units; raiders attack
// the first barrier when a completely enclosed target cannot be reached.
// Gates read as walls for row-building, barriers and art, but friendly
// villagers walk through a standing gate while raiders must break it.
// passGates=true is the friendly doctrine (troops, builders, orders);
// enemies and spawn checks use the default and stay walled out.
//
// Friendlies (passGates) always make progress toward reachable goals such as
// the Manor Hall: if a full route is blocked, a softer path is tried, then a
// direct step so distance alone never strands a villager.
export function blocked(world,data,x,y,passGates=false) {
 return world.buildings.some(b=>b.hp>0&&b.type!=='trap'&&!(passGates&&b.type==='gate')&&x>=b.x&&x<b.x+data.buildings[b.type].size&&y>=b.y&&y<b.y+data.buildings[b.type].size);
}

function wallShut(world,data,width,passGates){
 // Only walls (and gates for enemies) block. Other buildings are walkable so
 // workers can still thread home when the village footprint is dense.
 const shut=new Set();
 for(const b of world.buildings){
  if(b.hp<=0)continue;
  const isWall=b.type==='wall'||b.type==='gate';
  if(!isWall)continue;
  if(passGates&&b.type==='gate')continue;
  const size=data.buildings[b.type]?.size||1;
  const x0=Math.ceil(b.x),y0=Math.ceil(b.y);
  for(let yy=y0;yy<b.y+size;yy++)for(let xx=x0;xx<b.x+size;xx++)shut.add(yy*width+xx);
 }
 return shut;
}

function fullShut(world,data,width,passGates){
 const shut=new Set();
 for(const b of world.buildings){
  if(b.hp<=0||b.type==='trap'||(passGates&&b.type==='gate'))continue;
  const size=data.buildings[b.type].size;
  const x0=Math.ceil(b.x),y0=Math.ceil(b.y);
  for(let yy=y0;yy<b.y+size;yy++)for(let xx=x0;xx<b.x+size;xx++)shut.add(yy*width+xx);
 }
 return shut;
}

function bfs(world,data,sx,sy,target,range,shut,avoidThreats,keepRoute=false){
 countSearch(world);
 const width=data.world.width,height=data.world.height;
 const foes=avoidThreats?world.enemies.filter(e=>e.hp>0):null;
 const key=(x,y)=>y*width+x,queue=[[sx,sy]],seen=new Set([key(sx,sy)]),previous=new Map();
 let found;
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];
  if(Math.hypot(x+.5-target.x,y+.5-target.y)<=range){found=[x,y];break;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=x+dx,ny=y+dy,k=key(nx,ny);
   if(nx<0||ny<0||nx>=width||ny>=height||seen.has(k)||shut.has(k))continue;
   if(foes){let hot=false;for(const e of foes){if(Math.hypot(nx+.5-e.x,ny+.5-e.y)<2.5){hot=true;break;}}if(hot)continue;}
   seen.add(k);previous.set(k,[x,y]);queue.push([nx,ny]);
  }
 }
 if(!found)return null;
 if(keepRoute){const path=[{x:found[0]+.5,y:found[1]+.5}];let cell=found;while(previous.has(key(...cell))){cell=previous.get(key(...cell));path.push({x:cell[0]+.5,y:cell[1]+.5});}path.reverse();const first=path[1]||path[0];return {...first,path};}
 while(previous.has(key(...found))){const prev=previous.get(key(...found));if(prev[0]===sx&&prev[1]===sy)break;found=prev;}
 return {x:found[0]+.5,y:found[1]+.5};
}

export function nextStep(world,data,actor,target,range=.9,avoidThreats=false,passGates=false,cacheRoutes=false) {
 if(!actor||!target||!Number.isFinite(actor.x)||!Number.isFinite(actor.y)||!Number.isFinite(target.x)||!Number.isFinite(target.y))return null;
 if(!Number.isFinite(range)||range<0)range=.9;
 const width=data.world.width,height=data.world.height;
 let sx=Math.floor(actor.x),sy=Math.floor(actor.y);
 sx=Math.max(0,Math.min(width-1,sx));sy=Math.max(0,Math.min(height-1,sy));
 if(Math.hypot(sx+.5-target.x,sy+.5-target.y)<=range)return {x:sx+.5,y:sy+.5};

 const cacheable=cacheRoutes&&passGates,revision=cacheable?movementRevision(world,data):null,goal=cacheable?`${target.x},${target.y},${range},${avoidThreats}`:null;
 if(cacheable){const cached=actorRoutes.get(actor);if(cached&&cached.world===world&&cached.revision===revision&&cached.goal===goal){let i=cached.index;while(i<cached.path.length-1&&Math.floor(cached.path[i+1].x)===sx&&Math.floor(cached.path[i+1].y)===sy)i++;cached.index=i;if(Math.floor(cached.path[i].x)===sx&&Math.floor(cached.path[i].y)===sy){const step=cached.path[Math.min(i+1,cached.path.length-1)];if(!avoidThreats||!world.enemies.some(e=>e.hp>0&&Math.hypot(step.x-e.x,step.y-e.y)<2.5))return step;}}}
 const remember=step=>{if(cacheable&&step?.path)actorRoutes.set(actor,{world,revision,goal,path:step.path,index:0});return step?{x:step.x,y:step.y}:step;};
 // Primary route: all solid buildings block (gates open for friendlies).
 let step=bfs(world,data,sx,sy,target,range,fullShut(world,data,width,passGates),avoidThreats,cacheable);
 if(step)return remember(step);

 // Friendly fallback: only walls (not farms, halls, etc.) block so a dense
 // village footprint cannot trap a worker far from the Manor Hall.
 if(passGates){
  step=bfs(world,data,sx,sy,target,range,wallShut(world,data,width,true),false,cacheable);
  if(step)return remember(step);
  // Last resort: one grid step that reduces distance. Distance alone never
  // prevents returning to the hall — the unit always edges closer.
  const tx=target.x,ty=target.y;
  let best=null,bestD=Math.hypot(sx+.5-tx,sy+.5-ty);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const nx=sx+dx,ny=sy+dy;
   if(nx<0||ny<0||nx>=width||ny>=height)continue;
   const d=Math.hypot(nx+.5-tx,ny+.5-ty);
   if(d<bestD){bestD=d;best={x:nx+.5,y:ny+.5};}
  }
  if(best)return best;
 }
 return null;
}

export function move(world,data,actor,target,speed,dt,range=.9,avoidThreats=false,passGates=false) {
 if(!actor||!target||!Number.isFinite(actor.x)||!Number.isFinite(target.x))return false;
 if(!Number.isFinite(speed)||speed<=0||!Number.isFinite(dt)||dt<=0)return false;
 if(Math.hypot(actor.x-target.x,actor.y-target.y)<=range) return true;
 const oldX=actor.x,oldY=actor.y;
 const friendly=passGates&&!(world.enemies||[]).includes(actor);
 speed*=trailMultiplier(world,actor.x,actor.y,friendly);
 const commit=()=>{if(friendly)recordTravel(world,data,oldX,oldY,actor.x,actor.y);};
 const next=nextStep(world,data,actor,target,range,avoidThreats,passGates,true);
 if(next){
  const dx=next.x-actor.x,dy=next.y-actor.y,d=Math.hypot(dx,dy),step=Math.min(d,speed*dt);
  if(d>.001){actor.x+=dx/d*step;actor.y+=dy/d*step;}
  commit();
  return Math.hypot(actor.x-target.x,actor.y-target.y)<=range;
 }
 // Friendly ultimate fallback: straight-line progress toward the goal so a
 // villager can always reach the Manor Hall from anywhere on the map.
 if(passGates){
  const width=data.world.width,height=data.world.height;
  const dx=target.x-actor.x,dy=target.y-actor.y,d=Math.hypot(dx,dy);
  if(d>.001){
   const step=Math.min(d,speed*dt);
   actor.x=Math.max(.25,Math.min(width-.25,actor.x+dx/d*step));
   actor.y=Math.max(.25,Math.min(height-.25,actor.y+dy/d*step));
  }
  commit();
  return Math.hypot(actor.x-target.x,actor.y-target.y)<=range;
 }
 return false;
}
