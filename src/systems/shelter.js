import {recordTravel,trailMultiplier} from './trails.js';
// Runtime-only routes/occupancy. One obstacle/threat sheet per two seconds,
// at most four searches per emergency tick, and retained routes per civilian.
const sheets=new WeakMap(),routes=new WeakMap(),indexes=new WeakMap();
const viable=(b,data)=>!!b&&b.hp>0&&b.remaining<=0&&(b.type==='hall'||!!data.buildings[b.type]?.housing);
function buildingIndex(world){
 let c=indexes.get(world);
 if(!c||c.at!==world.elapsed||c.source!==world.buildings||c.count!==world.buildings.length){c={at:world.elapsed,source:world.buildings,count:world.buildings.length,ids:new Map(world.buildings.map(b=>[b.id,b]))};indexes.set(world,c);}
 return c.ids;
}
export function isSheltered(world,data,u){
 return !!u.shelteredIn&&u.hp>0&&!u.expedition&&data.troops[u.type]?.role!=='combat'&&viable(buildingIndex(world).get(u.shelteredIn),data);
}
export function shelterOccupants(world,bid){const b=buildingIndex(world).get(bid);return b?.hp>0&&b.remaining<=0?world.troops.filter(u=>u.hp>0&&u.shelteredIn===bid).length:0;}
export function releaseShelter(u){delete u.shelteredIn;routes.delete(u);}
export function beginShelterTick(world){const c=sheets.get(world);if(c){c.budget=4;c.checked=false;}}
function sheet(world,data){
 const now=world.elapsed||0,w=data.world.width,h=data.world.height;
 let c=sheets.get(world);
 if(c?.checked)return c;
 const signature=world.buildings.map(b=>`${b.id},${b.x},${b.y},${b.hp>0?1:0},${b.remaining<=0?1:0}`).join('|');
 if(c&&now<c.until&&c.signature===signature){c.checked=true;return c;}
 const solid=new Array(w*h).fill(null),foes=world.enemies.filter(e=>e.hp>0),doors=new Map(),live=world.buildings.filter(b=>b.hp>0);
 for(const b of live){if(b.type==='trap'||b.type==='gate')continue;const size=data.buildings[b.type].size;for(let y=Math.ceil(b.y);y<b.y+size;y++)for(let x=Math.ceil(b.x);x<b.x+size;x++)if(x>=0&&y>=0&&x<w&&y<h)solid[y*w+x]=b.id;}
 const hot=new Uint8Array(w*h);
 for(const e of foes)for(let y=Math.max(0,Math.floor(e.y-3));y<Math.min(h,Math.ceil(e.y+3));y++)for(let x=Math.max(0,Math.floor(e.x-3));x<Math.min(w,Math.ceil(e.x+3));x++)if(Math.hypot(x+.5-e.x,y+.5-e.y)<2.5)hot[y*w+x]=1;
 for(const b of live){if(!viable(b,data))continue;const size=data.buildings[b.type].size,cx=b.x+size/2,cy=b.y+size/2;if(foes.some(e=>Math.hypot(e.x-cx,e.y-cy)<4))continue;
  // Front doorway first; a blocked entrance can use another exterior door.
  for(const [x,y] of [[Math.floor(cx),Math.ceil(b.y+size)],[Math.floor(cx),Math.floor(b.y)-1],[Math.floor(b.x)-1,Math.floor(cy)],[Math.ceil(b.x+size),Math.floor(cy)]]){const k=y*w+x;if(x>=0&&y>=0&&x<w&&y<h&&!solid[k]&&!hot[k]){doors.set(k,b);break;}}
 }
 c={until:now+2,signature,checked:true,solid,hot,doors,w,h,budget:c?.budget??4};sheets.set(world,c);return c;
}
function plan(c,u){
 const sx=Math.floor(u.x),sy=Math.floor(u.y);if(sx<0||sy<0||sx>=c.w||sy>=c.h)return null;
 const start=sy*c.w+sx,origin=c.solid[start],prev=new Int32Array(c.w*c.h).fill(-2),queue=[start];prev[start]=-1;
 for(let i=0;i<queue.length;i++){const k=queue[i],b=c.doors.get(k);if(b){const path=[];for(let p=k;p!==start;p=prev[p])path.push(p);path.reverse();if(!path.length)path.push(start);return {b,path,index:0,origin};}
  const x=k%c.w,y=Math.floor(k/c.w);
  for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){if(nx<0||ny<0||nx>=c.w||ny>=c.h)continue;const n=ny*c.w+nx;if(prev[n]!==-2||c.hot[n]||(c.solid[n]&&c.solid[n]!==origin))continue;prev[n]=k;queue.push(n);}
 }
 return null;
}
export function shelterVillager(world,data,u,speed,dt){
 if(isSheltered(world,data,u)){u.emergency={kind:'shelter',target:u.shelteredIn};return;}
 if(u.shelteredIn)releaseShelter(u);
 const c=sheet(world,data),now=world.elapsed||0;let r=routes.get(u);
 if(r?.b&&(!viable(r.b,data)||r.b.x!==r.bx||r.b.y!==r.by||!c.doors.has(r.path[r.path.length-1]))){routes.delete(u);r=null;}
 if(r?.retry>now)return;
 if(!r||r.retry!==undefined){if(c.budget<=0)return;c.budget--;r=plan(c,u);if(!r){routes.set(u,{retry:now+2});return;}r.bx=r.b.x;r.by=r.b.y;routes.set(u,r);}
 u.emergency={kind:'shelter',target:r.b.id};
 if(r.index<r.path.length){const k=r.path[r.index],x=k%c.w+.5,y=Math.floor(k/c.w)+.5;
  if(c.hot[k]||(c.solid[k]&&c.solid[k]!==r.origin)){routes.delete(u);return;}
  const dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy),step=Math.min(d,speed*trailMultiplier(world,u.x,u.y,true)*dt),ox=u.x,oy=u.y;
  if(d>.001&&step>0){u.x+=dx/d*step;u.y+=dy/d*step;recordTravel(world,data,ox,oy,u.x,u.y);}if(d<=step+.001)r.index++;
 }
 if(r.index===r.path.length){u.shelteredIn=r.b.id;u.emergency={kind:'shelter',target:r.b.id};}
}
