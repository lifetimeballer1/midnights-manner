// Straight, connected wall runs stop at gaps; corners never sweep a whole enclosure.
import {buildingCost} from '../model.js';
export const isWall=b=>b?.type==='wall'||b?.type==='stonewall';

export function wallRow(world,id,axis='x') {
 const start=world.buildings.find(b=>b.id===id);
 if(!isWall(start)||!['x','y'].includes(axis))return [];
 const other=axis==='x'?'y':'x',row=[start];
 for(const direction of [-1,1])for(let n=1;;n++){
  const next=world.buildings.find(b=>isWall(b)&&b[axis]===start[axis]+n*direction&&b[other]===start[other]);
  if(!next)break;
  row.push(next);
 }
 return row.sort((a,b)=>a[axis]-b[axis]);
}

export function wallRowQuote(world,data,id,axis,vlevel=1) {
 const row=wallRow(world,id,axis);
 const eligible=row.filter(b=>b.hp>0&&b.remaining<=0&&b.level<data.buildings[b.type].tiers.length&&
  (data.buildings[b.type].tierGates?.[b.level+1]||1)<=vlevel);
 const cost={};
 for(const b of eligible)for(const [resource,amount] of Object.entries(buildingCost(b.type,b.level+1,world,data)))cost[resource]=(cost[resource]||0)+amount;
 return {row,eligible,cost};
}

export function wallLine(start,end) {
 if(!end)return [];
 if(!start)return [end];
 if(![start.x,start.y,end.x,end.y].every(Number.isInteger))return [];
 const axis=Math.abs(end.x-start.x)>=Math.abs(end.y-start.y)?'x':'y';
 // Bound malformed or off-screen gestures; normal maps are much smaller.
 const length=Math.min(100,Math.abs(end[axis]-start[axis]));
 const direction=Math.sign(end[axis]-start[axis]);
 return Array.from({length:length+1},(_,i)=>({...start,[axis]:start[axis]+i*direction}));
}
export function placementCells(renderer) {
 return isWall({type:renderer.placing})&&!renderer.moving?wallLine(renderer.wallStart,renderer.hover):renderer.hover?[renderer.hover]:[];
}
