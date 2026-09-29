import {center} from './model.js';
import {visibleFrontierCamps} from './environment-art.js';
import {phaseSeed} from './camera.js';

const SMOKE_TYPES=new Set(['hall','cottage']);
export const ATMOSPHERE_LIMITS=Object.freeze({smokeSources:8,trailActors:12,rainSplashes:14});

function actorTarget(world,data,actor,enemy=false){
 if(enemy){
  const unit=world.troops?.find(u=>u.id===actor.targetId&&u.hp>0);
  if(unit)return {x:unit.x,y:unit.y};
  const building=world.buildings?.find(b=>b.id===actor.targetId&&b.hp>0);
  return building?center(building,data):null;
 }
 if(actor.order?.kind==='move'&&Number.isFinite(actor.order.x)&&Number.isFinite(actor.order.y))return {x:actor.order.x,y:actor.order.y};
 if(actor.order?.kind==='attack'){
  const target=world.enemies?.find(e=>e.id===actor.order.targetId&&e.hp>0);
  if(target)return {x:target.x,y:target.y};
 }
 const e=actor.expedition;
 if(e?.phase==='out')return {x:e.entryX,y:e.entryY};
 if(e?.phase==='back')return {x:e.homeX,y:e.homeY};
 return null;
}
export function trailActors(world,data){
 const out=[];
 for(const u of world?.troops||[]){
  if(u.hp<=0)continue;const target=actorTarget(world,data,u,false);if(target)out.push({actor:u,target});
  if(out.length>=ATMOSPHERE_LIMITS.trailActors)return out;
 }
 for(const e of world?.enemies||[]){
  if(e.hp<=0)continue;const target=actorTarget(world,data,e,true);if(target)out.push({actor:e,target,enemy:true});
  if(out.length>=ATMOSPHERE_LIMITS.trailActors)break;
 }
 return out;
}
export function smokeSources(world,data){
 const out=[];
 for(const b of world?.buildings||[]){
  if(out.length>=ATMOSPHERE_LIMITS.smokeSources)break;
  if(b.hp<=0||b.remaining>0||!SMOKE_TYPES.has(b.type))continue;
  const p=center(b,data);out.push({id:b.id,x:p.x,y:p.y,z:.72,type:'building'});
 }
 if(out.length<ATMOSPHERE_LIMITS.smokeSources)for(const camp of visibleFrontierCamps(world,data)){
  out.push({id:camp.id,x:camp.x+.5,y:camp.y+.52,z:.28,type:'camp'});
  if(out.length>=ATMOSPHERE_LIMITS.smokeSources)break;
 }
 return out;
}
function smoke(r,source,time,wet=false){
 const c=r.ctx,seed=phaseSeed(source.id),base=time*.00022+seed*6.28;
 for(let i=0;i<2;i++){
  const age=(base+i*.43)%1,p=r.project(source.x+.08*Math.sin(base*2+i),source.y-.06*age,source.z+.18+age*.65);
  c.globalAlpha=(1-age)*(wet?.09:.16);c.fillStyle=source.type==='camp'?'#b8b0a1':'#c4c0b4';
  c.beginPath();c.arc(p.x,p.y,(2.2+age*4.3)*r.cam.zoom,0,Math.PI*2);c.fill();
 }
 c.globalAlpha=1;
}
function footprints(r,item,time){
 const {actor,target,enemy}=item,dx=target.x-actor.x,dy=target.y-actor.y,len=Math.hypot(dx,dy);
 if(len<.05)return;
 const nx=dx/len,ny=dy/len,sx=-ny,sy=nx,phase=(time*.002+phaseSeed(actor.id)*5)%1;
 const c=r.ctx;c.fillStyle=enemy?'#2c251fcc':'#3a3329aa';c.globalAlpha=.34;
 for(let i=0;i<3;i++){
  const back=.16+i*.17+phase*.06,side=(i%2?.045:-.045),p=r.project(actor.x-nx*back+sx*side,actor.y-ny*back+sy*side,.012);
  c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(ny,nx)*.35);c.beginPath();c.ellipse(0,0,1.8*r.cam.zoom,.75*r.cam.zoom,0,0,Math.PI*2);c.fill();c.restore();
 }
 c.globalAlpha=1;
}
function rainSplashes(r,time){
 const c=r.ctx;c.strokeStyle='#a9ced8';c.lineWidth=Math.max(.7,r.cam.zoom*.45);c.globalAlpha=.22;
 for(let i=0;i<ATMOSPHERE_LIMITS.rainSplashes;i++){
  const x=(i*37.17+(time*.00035*(i%3+1)))%(r.data.world.width||52),y=(i*19.43+7)%(r.data.world.height||44),p=r.project(x+.5,y+.5,.014);
  c.beginPath();c.ellipse(p.x,p.y,2.2*r.cam.zoom,.8*r.cam.zoom,0,0,Math.PI*2);c.stroke();
 }
 c.globalAlpha=1;
}
export function drawAtmosphere(r,world,time,weather){
 if(!r||!world||r.calm||r.cam.zoom<.9)return {smoke:0,trails:0,rain:0};
 const smokeList=smokeSources(world,r.data),trails=trailActors(world,r.data);
 for(const source of smokeList)smoke(r,source,time,!!weather?.streaks);
 for(const item of trails)footprints(r,item,time);
 const rain=weather?.streaks?ATMOSPHERE_LIMITS.rainSplashes:0;if(rain)rainSplashes(r,time);
 return {smoke:smokeList.length,trails:trails.length,rain};
}
