import {reserveCapacity} from './resources.js';

import {civicCueFor} from './source-lighting.js';
import {seedOf} from './procedural-seed.js';
import {workPhase} from './work-motion.js';
export {seedOf};
export function buildingActivityState(building,spec,world,crewCounts=null){
 if(!building||!spec||building.hp<=0||building.remaining>0)return {active:false,crew:0,producer:false,workplace:false,stocking:false,civic:false};
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
 // Great works hold no tap reserve, so finished + living is the whole signal:
 // the same finished/living gate as producers, with nothing to fill and pause on.
 const civic=!!civicCueFor(building.type);
 return {active:producer||workplace||stocking||civic,crew,producer,workplace,stocking,civic};
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
// Civic anchors mirror the V1 masterwork props (banner rack, beacon crown,
// wayline, patrol walk, forge mouth, first lantern head). World-space points;
// the draw call projects them, so cues track yaw/pitch/zoom/resize for free.
function civicAnchor(b,n){
 switch(b.type){
  case 'manner-citadel':return [b.x+n/2,b.y+n-.12,.62];
  case 'grand-watchtower':return [b.x+n/2,b.y+n/2,1.15];
  case 'stone-road':return [b.x+.3,b.y+n/2,.1];
  case 'city-wall':return [b.x+n*.3,b.y+n-.1,.75];
  case 'forge-quarter':return [b.x+.5,b.y+n-.15,.4];
  default:return [b.x+.28,b.y+.28,.72];
 }
}
// Physical work lives in the depth-sorted mechanism mesh. These are bounded
// secondary water ripples originating at its visible fishing float.
export function drawBuildingActivity(r,world,time){
 if(!r||!world||r.calm||r.cam.zoom<1.05)return;const c=r.ctx;let count=0;c.save();
 // One crew index per frame: every state check below reuses it instead of
 // rescanning the troop list per building.
 const crew=new Map();
 for(const u of world.troops||[])if(u?.hp>0&&u.workplace&&!u.emergency&&!u.expedition&&!u.order)crew.set(u.workplace,(crew.get(u.workplace)||0)+1);
 for(const b of world.buildings||[]){
  if(count>=12)break;if(!['pond','deephole','blackwater-weir'].includes(b.type))continue;
  const spec=r.data.buildings[b.type];if(!buildingActivityState(b,spec,world,crew).active)continue;
  const n=spec.size,p=r.project(b.x+n*.52,b.y+n*.48,.18);if(p.x<0||p.y<0||p.x>r.width||p.y>r.height)continue;
  const age=workPhase(b,'lap',time),rad=.035+age*.13;c.globalAlpha=(1-age)*.24;c.strokeStyle='#a8dde5';c.lineWidth=Math.max(.7,r.cam.zoom*.6);c.beginPath();
  for(let i=0;i<=16;i++){const a=i*Math.PI/8,q=r.project(b.x+n*.52+Math.cos(a)*rad,b.y+n*.48+Math.sin(a)*rad,.18);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);}c.stroke();count++;
 }
 // V2 — great-work cues: one bounded marker per finished, living civic
 // building, outside the static mesh cache. No smoke here: chimney wisps
 // already rise from real stacks in drawChimneyWisps.
 let civic=0;
 for(const b of world.buildings||[]){
  if(civic>=8)break;
  const cue=civicCueFor(b.type);if(!cue)continue;
  const spec=r.data.buildings[b.type];if(!spec)continue;
  if(!buildingActivityState(b,spec,world,crew).active)continue;
  const n=spec.size,[ax,ay,az]=civicAnchor(b,n),age=workPhase(b,cue.channel,time);
  // Drift/step cues travel a short world-space leg with their phase; embers rise.
  const dx=cue.kind==='drift'?age*.4:cue.kind==='step'&&age>=.5?.3:0,dz=cue.kind==='rise'?age*.3:0;
  const p=r.project(ax+dx,ay,az+dz);
  if(p.x<-24||p.y<-24||p.x>r.width+24||p.y>r.height+24)continue;
  c.globalAlpha=(1-age)*.5+.12;
  if(cue.kind==='pennant'){
   // Citadel colors: timber mast tick, gold pennant whose fly grows with phase.
   c.strokeStyle='#b38a59';c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x,p.y-7*r.cam.zoom);c.stroke();
   const fly=(2+age*3)*r.cam.zoom;c.fillStyle=`rgba(${cue.light},${(1-age)*.55+.15})`;
   c.beginPath();c.moveTo(p.x,p.y-7*r.cam.zoom);c.lineTo(p.x+fly,p.y-6*r.cam.zoom);c.lineTo(p.x,p.y-5*r.cam.zoom);c.closePath();c.fill();
  }else{
   const s=(cue.kind==='pulse'?2.2:1.6)*r.cam.zoom;c.fillStyle=`rgb(${cue.light})`;
   c.fillRect(p.x-s/2,p.y-s/2,s,s);
  }
  c.globalAlpha=1;civic++;
 }
 c.restore();
}
