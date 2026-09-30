import {reserveCapacity} from './resources.js';

import {seedOf} from './procedural-seed.js';
import {workPhase} from './work-motion.js';
export {seedOf};
export function buildingActivityState(building,spec,world,crewCounts=null){
 if(!building||!spec||building.hp<=0||building.remaining>0)return {active:false,crew:0,producer:false,workplace:false,stocking:false};
 let crew=crewCounts?.get(building.id)||0;
 if(!crewCounts)for(const u of world?.troops||[])if(u?.hp>0&&u.workplace===building.id&&!u.emergency&&!u.expedition&&!u.order)crew++;
 let producer=false;
 if(spec.production){
  const cap=Math.max(1,reserveCapacity(spec,Math.max(1,Math.floor(+building.level||1))));
  const held=Number.isFinite(+building.harvestBonus)?Math.max(0,+building.harvestBonus):0;
  producer=held<cap-.001;
 }
 const workplace=!!spec.workplace&&crew>0;
 const stocking=Number.isFinite(spec.stockRate)&&spec.stockRate>0&&(+building.stock||0)<1;
 return {active:producer||workplace||stocking,crew,producer,workplace,stocking};
}
export function hearthSmokeFor(b,spec){
 // Occupied homes breathe light chimney smoke even when no crew is posted:
 // the hut() geometry only builds a chimney at level 2+, so smoke follows
 // the same rule and never floats over a chimneyless cabin. Pure data over
 // building fields; calm handling stays with the draw call.
 if(!b||!spec||b.hp<=0||(b.remaining||0)>0)return 0;
 if((b.level||1)<2)return 0;
 switch(b.type){
  case 'cottage':return .35;
  case 'hall':return .5;
  case 'longhouse':return .6;
  case 'storehouse':return .3;
  case 'grand-granary':return .3;
  default:return 0;
 }
}
// Physical work lives in the depth-sorted mechanism mesh. These are bounded
// secondary water ripples originating at its visible fishing float.
export function drawBuildingActivity(r,world,time){
 if(!r||!world||r.calm||r.cam.zoom<1.05)return;const c=r.ctx;let count=0;c.save();
 for(const b of world.buildings||[]){
  if(count>=12)break;if(!['pond','deephole','blackwater-weir'].includes(b.type))continue;
  const spec=r.data.buildings[b.type];if(!buildingActivityState(b,spec,world).active)continue;
  const n=spec.size,p=r.project(b.x+n*.52,b.y+n*.48,.18);if(p.x<0||p.y<0||p.x>r.width||p.y>r.height)continue;
  const age=workPhase(b,'lap',time),rad=.035+age*.13;c.globalAlpha=(1-age)*.24;c.strokeStyle='#a8dde5';c.lineWidth=Math.max(.7,r.cam.zoom*.6);c.beginPath();
  for(let i=0;i<=16;i++){const a=i*Math.PI/8,q=r.project(b.x+n*.52+Math.cos(a)*rad,b.y+n*.48+Math.sin(a)*rad,.18);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);}c.stroke();count++;
 }c.restore();
}
