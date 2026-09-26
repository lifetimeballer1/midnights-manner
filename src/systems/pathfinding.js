// Breadth-first routing on a small grid. Walls obstruct units; raiders attack
// the first barrier when a completely enclosed target cannot be reached.
export function blocked(world,data,x,y) {
 return world.buildings.some(b=>b.hp>0&&b.type!=='trap'&&x>=b.x&&x<b.x+data.buildings[b.type].size&&y>=b.y&&y<b.y+data.buildings[b.type].size);
}
export function nextStep(world,data,actor,target,range=.9) {
 const sx=Math.floor(actor.x),sy=Math.floor(actor.y),width=data.world.width,height=data.world.height;
 const key=(x,y)=>y*width+x, queue=[[sx,sy]], seen=new Set([key(sx,sy)]),previous=new Map();let found;
 for(let i=0;i<queue.length;i++) {
  const [x,y]=queue[i];
  if(Math.hypot(x+.5-target.x,y+.5-target.y)<=range){found=[x,y];break;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
   const nx=x+dx,ny=y+dy,k=key(nx,ny);
   if(nx<0||ny<0||nx>=width||ny>=height||seen.has(k)||blocked(world,data,nx,ny)) continue;
   seen.add(k);previous.set(k,[x,y]);queue.push([nx,ny]);
  }
 }
 if(!found) return null;
 while(previous.has(key(...found))) {const prev=previous.get(key(...found));if(prev[0]===sx&&prev[1]===sy) break;found=prev;}
 return {x:found[0]+.5,y:found[1]+.5};
}
export function move(world,data,actor,target,speed,dt,range=.9) {
 if(Math.hypot(actor.x-target.x,actor.y-target.y)<=range) return true;
 const next=nextStep(world,data,actor,target,range);if(!next) return false;
 const dx=next.x-actor.x,dy=next.y-actor.y,d=Math.hypot(dx,dy),step=Math.min(d,speed*dt);
 if(d>.001){actor.x+=dx/d*step;actor.y+=dy/d*step;}return false;
}
