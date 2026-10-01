import {center} from './model.js';
import {visibleFrontierCamps} from './environment-art.js';
import {phaseSeed} from './camera.js';

const SMOKE_TYPES=new Set(['hall','cottage']);
export const ATMOSPHERE_LIMITS=Object.freeze({smokeSources:8,trailActors:12,rainSplashes:6});

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
 const {actor,enemy}=item,pool=r._freshFootprints??=new Map(),key=(enemy?'e':'u')+actor.id;
 let state=pool.get(key);if(!state){state={x:actor.x,y:actor.y,acc:0,marks:[],right:false};pool.set(key,state);}
 const dx=actor.x-state.x,dy=actor.y-state.y,d=Math.hypot(dx,dy);
 if(d>1e-8&&d<1){state.acc+=d;if(state.acc>=.22){state.acc%=.22;state.right=!state.right;const side=state.right?.045:-.045;state.marks.push({x:actor.x-dy/d*side,y:actor.y+dx/d*side,time});if(state.marks.length>3)state.marks.shift();}}
 else if(d>=1){state.acc=0;state.marks=[];}
 state.x=actor.x;state.y=actor.y;state.marks=state.marks.filter(m=>time-m.time<1600);
 const c=r.ctx;c.fillStyle=enemy?'#2c251f':'#3a3329';
 for(const mark of state.marks){c.globalAlpha=(1-(time-mark.time)/1600)*.34;c.beginPath();for(let i=0;i<=8;i++){const a=i*Math.PI/4,p=r.project(mark.x+Math.cos(a)*.035,mark.y+Math.sin(a)*.018,.017);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}c.fill();}c.globalAlpha=1;
 if(pool.size>96)for(const [id,s] of pool)if(!s.marks.length&&id!==key)pool.delete(id);
}
function rainSplashes(r,time){
 const c=r.ctx;c.strokeStyle='#a9ced8';c.lineWidth=Math.max(.7,r.cam.zoom*.45);c.globalAlpha=.22;
 for(let i=0;i<ATMOSPHERE_LIMITS.rainSplashes;i++){
  const x=(i*37.17+(time*.00035*(i%3+1)))%(r.data.world.width||52),y=(i*19.43+7)%(r.data.world.height||44),p=r.project(x+.5,y+.5,.014);
  if(p.x<0||p.x>r.width||p.y<0||p.y>r.height)continue;
  c.beginPath();c.ellipse(p.x,p.y,2.2*r.cam.zoom,.8*r.cam.zoom,0,0,Math.PI*2);c.stroke();
 }
 c.globalAlpha=1;
}
export function drawAtmosphere(r,world,time,weather,opts={}){
 if(!r||!world||r.calm||r.cam.zoom<.9)return {smoke:0,trails:0,rain:0};
 const smokeList=smokeSources(world,r.data).filter(s=>!opts.sceneChimneys||s.type!=='building'),trails=trailActors(world,r.data);
 for(const source of smokeList)smoke(r,source,time,!!weather?.streaks);
 const seen=new Set(trails.map(t=>t.actor.id));
 for(const actor of world.troops||[])if(trails.length<ATMOSPHERE_LIMITS.trailActors&&actor.hp>0&&!seen.has(actor.id))trails.push({actor});
 for(const item of trails)footprints(r,item,time);
 const rain=weather?.streaks?ATMOSPHERE_LIMITS.rainSplashes:0;if(rain)rainSplashes(r,time);
 return {smoke:smokeList.length,trails:trails.length,rain};
}
