import {addLogisticsMeshes,addRoadGeometry,drawLogisticsOverlay} from './logistics-art.js';
import {addConvertedAccents,addConvertedBuildingTiers,artEnabled,drawMesh,meshBounds} from './asset-art.js';
import {roadRevision} from './systems/roads.js';
import {addLivingMechanisms} from './mechanical-art.js';
import {addLivingProps} from './living-props.js';
import {addExternalProp,addExternalWorkplace} from './external-art.js';
import {addWindLife} from './wind-art.js';
import {addTrailGeometry,trailRevision} from './systems/trails.js';
// Original low-poly village geometry, projected by the shared orbit camera.
// The game simulation stays in ground tiles; meshes add height only for display.
import {prepareSourceLighting,drawSourceSpill,sourcePhase} from './source-lighting.js';
import {cameraBasis} from './camera.js';
import {characterModel} from './character-art.js';
import {isWall,wallNeighbors} from './building-art.js';
import {placementCells} from './systems/walls.js';
import {DAY_LENGTH,skyLightAt} from './systems/daynight.js';
import {reserveCapacity,reserveReady} from './resources.js';
import {drawBuildingActivity} from './building-activity.js';
import {addEnvironmentScenery,isScorchedRidge} from './environment-art.js';
import {insideWorkplace} from './systems/villagers.js';
import {isSheltered} from './systems/shelter.js';
import {sfx} from './systems/audio.js';
import {drawCelestialShadows,drawGroundMist,drawPracticalBloom,drawCelestialAir,drawChimneyWisps,prepareNearbyLight,drawGodRays} from './cinematic-lighting.js';
export function pointInPolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
const FALLBACK_LIGHT=skyLightAt(DAY_LENGTH*.3,null); // high noon, for bare MeshScene uses
// Phase 4 — ground-contact occlusion: faces near the dirt lose a slice of
// their light (foundations, wall feet, crop beds), roofs stay clean. This is
// a construction-time constant per face, not a clock value, so it never
// touches the paint cache.
const AO_MIN=.8,AO_HEIGHT=.7;
// Phase 2/3/4 — paint-time shading. Day defaults reproduce the legacy baked
// formula byte-for-byte (SKIES in systems/daynight.js is the tuning home);
// emissive faces (windows, flames) carry a warm boost of their own albedo so
// the village still reads at midnight. Weather lands here too: `dim` flattens
// the whole lit value and `fog` mixes far faces (depth01 = 0 near, 1 far)
// toward the weather veil. `ao` is the face's ground-contact occlusion.
// Normals stay in world space.
export function shade(hex,n,light,emissive=0,depth01=0,ao=1,local=0){
 const value=parseInt(hex.slice(1),16);
 const key=Math.max(0,(n[0]*light.keyDir[0]+n[1]*light.keyDir[1]+n[2]*light.keyDir[2])/light.keyNorm)*light.keyI;
 const up=Math.max(0,n[2])*light.sky,glow=emissive*light.emissive,dim=(light.dim??1)*ao,fog=(light.fog??0)*depth01;
 const lit=[light.ambRGB[0]*light.ambI+light.keyRGB[0]*key+up+glow,light.ambRGB[1]*light.ambI+light.keyRGB[1]*key+up+glow,light.ambRGB[2]*light.ambI+light.keyRGB[2]*key+up+glow];
 return '#'+[value>>16,(value>>8)&255,value&255].map((v,i)=>{let c=Math.min(255,Math.round(v*(lit[i]+local*[1,.57,.22][i])*dim));if(fog>0)c=Math.round(c+(light.fogRGB[i]*255-c)*fog);return c.toString(16).padStart(2,'0');}).join('');
}
export class MeshScene {
 constructor(r){this.r=r;this.faces=[];this.sources=[];this.chimneys=[];this.doors=[];this.owner=null;this.alpha=1;this.depthBias=0;this.light=FALLBACK_LIGHT;this.emissive=0;this.fixture=false;this.subdivision=.4;this.basis=cameraBasis(r);}
 source(position,direction=null,radius=1.25,power=.7,profile='generic'){
  if(this.alpha===1){const source={position,direction,radius,power,profile,owner:this.owner};source.phase=sourcePhase(source);this.sources.push(source);}
 }
 face(vertices,color,split=true){
  // Split broad roof/wall planes so chimneys and neighboring meshes occlude
  // correctly even at low camera angles (painter ordering uses face centers).
  if(split&&vertices.length===4){const [a,b,c,d]=vertices,dist=(u,v)=>Math.hypot(...u.map((n,i)=>n-v[i])),nx=Math.ceil(dist(a,b)/this.subdivision),ny=Math.ceil(dist(a,d)/this.subdivision);if(nx*ny>1){const point=(u,v)=>a.map((n,i)=>(1-v)*((1-u)*n+u*b[i])+v*((1-u)*d[i]+u*c[i]));for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)this.face([point(i/nx,j/ny),point((i+1)/nx,j/ny),point((i+1)/nx,(j+1)/ny),point(i/nx,(j+1)/ny)],color,false);return;}}

  const a=vertices[0],b=vertices[1],c=vertices[2],u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const len=Math.hypot(...n);if(len<1e-8)return;n=n.map(x=>x/len);
  const B=this.basis;if(n[0]*B.s*B.v+n[1]*B.c*B.v+n[2]*B.p<=.00001)return;
  const points=vertices.map(p=>this.r.project(...p));if(points.every(p=>p.x<-60)||points.every(p=>p.x>this.r.width+60)||points.every(p=>p.y<-80)||points.every(p=>p.y>this.r.height+60))return;
  const zAvg=vertices.reduce((sum,p)=>sum+p[2],0)/vertices.length;
  this.faces.push({points,vertices,bounds:[Math.min(...points.map(p=>p.x)),Math.min(...points.map(p=>p.y)),Math.max(...points.map(p=>p.x)),Math.max(...points.map(p=>p.y))],color,center:vertices[0].map((_,i)=>vertices.reduce((sum,p)=>sum+p[i],0)/vertices.length),normal:n,emissive:this.emissive,fixture:this.fixture,ao:Math.min(1,AO_MIN+(1-AO_MIN)*Math.max(0,zAvg/AO_HEIGHT)),depth:vertices.reduce((sum,p)=>sum+this.r.depth(...p),0)/vertices.length+this.depthBias,owner:this.owner,alpha:this.alpha});
 }
 box(x,y,z,w,d,h,color,cap=true){const p=[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]];for(const f of [[0,3,2,1],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],...(cap?[[4,5,6,7]]:[])])this.face(f.map(i=>p[i]),color);}
 roof(x,y,z,w,d,h,color){const p=[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x+w/2,y,z+h],[x+w/2,y+d,z+h]];for(const f of [[0,4,5,3],[4,1,2,5],[0,1,4],[3,5,2]])this.face(f.map(i=>p[i]),color);}
 pyramid(x,y,z,radius,h,color,sides=4){const ring=Array.from({length:sides},(_,i)=>[x+Math.cos(i*Math.PI*2/sides)*radius,y+Math.sin(i*Math.PI*2/sides)*radius,z]);for(let i=0;i<sides;i++)this.face([ring[i],ring[(i+1)%sides],[x,y,z+h]],color);}
 paint(){const c=this.r.ctx,light=this.light,key=light.key;this.faces.sort((a,b)=>a.depth-b.depth);
  // Fog needs the frame's depth range; clear/rain skies skip the scan.
  let dMin=0,dSpan=1;
  if(light.fog>0){dMin=Infinity;let dMax=-Infinity;for(const f of this.faces){if(f.depth<dMin)dMin=f.depth;if(f.depth>dMax)dMax=f.depth;}dSpan=(dMax-dMin)||1;}
  for(const f of this.faces){
  // Shade once per face per light bucket; every other frame reuses the paint.
  if(f.paintedKey!==key){f.painted=shade(f.color,f.normal,light,f.emissive,light.fog>0?(f.depth-dMin)/dSpan:0,f.ao,(f.localLight||0)*(light.overlay?.glow||0));f.paintedKey=key;}
  c.globalAlpha=f.alpha;c.fillStyle=f.painted;c.beginPath();f.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();c.strokeStyle=f.painted;c.lineWidth=.45;c.stroke();}c.globalAlpha=1;this.r.sceneFaces=this.faces;}
}
const stone='#b4beb2',timber='#b38a59',gold='#e5bd66';
const WALL_CAP='#c5a06a',GATE_STAGES=4,GATE_MOVE_MS=240;
const WALL_DIRECTIONS=[[0,-1],[-1,0],[1,0],[0,1]];
function wallEnds(neighbors){
 let x=false,y=false;for(const [dx,dy]of neighbors){if(dx)x=true;if(dy)y=true;}
 if(!x&&!y)return [[-1,0],[1,0]];
 return WALL_DIRECTIONS.filter(([dx,dy])=>(dx?x:y)&&!neighbors.some(([nx,ny])=>nx===dx&&ny===dy));
}
function gateAxis(neighbors){let x=0,y=0;for(const [dx,dy]of neighbors){if(dx)x++;if(dy)y++;}return x>=y?'x':'y';}
export function gateLiftStage(r,b,world,time){
 let threatened=false;if(b.hp>0&&!(b.remaining>0))for(const e of world.enemies||[])if(e.hp>0&&Math.hypot(e.x-b.x-.5,e.y-b.y-.5)<=1.4){threatened=true;break;}
 const target=threatened?0:GATE_STAGES;
 if(b.id==null)return target;
 const now=Number.isFinite(time)?time:0;
 let motions=r._gateMotion,motion=motions?.get(b.id);
 if(r.calm){if(motion){motion.stage=motion.from=motion.to=target;motion.started=now;}return target;}
 if(!motions)motions=r._gateMotion=new Map();
  motion=motions.get(b.id);
  if(!motion){motion={stage:target,from:target,to:target,started:now,settled:target};motions.set(b.id,motion);}
  else if(motion.to!==target){motion.from=motion.stage;motion.to=target;motion.started=now;motion.settled=null;}
  const progress=Math.max(0,Math.min(1,(now-motion.started)/GATE_MOVE_MS));
  motion.stage=Math.round(motion.from+(motion.to-motion.from)*progress);
  // The gate creaks while it travels (throttled in sfx) and falls silent
  // once seated. Calm snaps above, so no sound path reaches frozen digests.
  // Arrival lands: a heavy thud when the gate slams shut for a raid, a
  // softer settle when it swings back open.
  try{
   if(motion.from!==motion.to&&progress<1)sfx.gate();
   else if(motion.from!==motion.to&&progress>=1&&motion.settled!==motion.to){motion.settled=motion.to;sfx.gateThud(motion.to===0?{}:{vol:0.55});}
  }catch{}
  return motion.stage;
}
function trapArmed(b){return b.hp>0&&!(b.remaining>0)&&!(Number.isFinite(+b.cooldown)&&+b.cooldown>0);}
function fence(s,x,y,w,d,color=timber){for(let i=0;i<=w;i+=.45){s.box(x+i,y,.05,.09,.09,.45,color);s.box(x+i,y+d-.09,.05,.09,.09,.45,color);}for(let j=.4;j<d;j+=.45){s.box(x,y+j,.05,.09,.09,.45,color);s.box(x+w-.09,y+j,.05,.09,.09,.45,color);}s.box(x,y,.23,w,.055,.07,color);s.box(x,y+d-.06,.23,w,.055,.07,color);s.box(x,y,.23,.055,d,.07,color);s.box(x+w-.06,y,.23,.055,d,.07,color);}
function torch(s,x,y,z,direction=null,radius=.95,power=.5){
 const dx=direction?.[0]||0,dy=direction?.[1]||0,fixture=s.fixture;s.fixture=true;
 s.box(x-.035-dx*.06,y-.035-dy*.06,z-.33,.07,.07,.32,'#594737');
 s.box(x-.065-dx*.02,y-.065-dy*.02,z-.04,.13,.13,.075,'#41372f');
 s.emissive=1;s.pyramid(x,y,z,.095,.2,'#e8883f',5);s.pyramid(x,y,z+.05,.048,.15,'#ffe1a0',5);s.emissive=0;s.fixture=fixture;
 s.source([x,y,z+.08],direction,radius,power,'torch');
}
function lanternPost(s,x,y,z=.72,radius=1.05,power=.46){
 const fixture=s.fixture;s.fixture=true;
 s.box(x-.035,y-.035,.12,.07,.07,Math.max(.18,z-.18),timber);
 s.box(x-.09,y-.09,z-.1,.18,.18,.08,'#4d514b');
 s.emissive=1;s.box(x-.05,y-.05,z-.025,.1,.1,.11,'#ffd58b');s.emissive=0;s.fixture=fixture;
 s.source([x,y,z+.035],null,radius,power,'lantern');
}
function pine(s,x,y,height=1.7,cold=false){s.box(x-.045,y-.045,0,.09,.09,height*.65,'#73543c');for(let i=0;i<3;i++)s.pyramid(x,y,height*(.23+i*.21),height*(.31-i*.055),height*.53,cold?['#598c83','#80b8ae','#b6ded0'][i]:['#315d43','#477953','#699358'][i],6);}
function tower(s,x,y,size,h,color=stone){s.box(x,y,.12,size,size,h,color);s.box(x-.08,y-.08,h+.1,size+.16,size+.16,.16,color);for(const [dx,dy]of[[0,0],[size-.16,0],[0,size-.16],[size-.16,size-.16]])s.box(x+dx-.025,y+dy-.025,h+.26,.21,.21,.23,color);s.box(x+size*.38,y+size+.006,h*.48,size*.2,.012,.27,'#324a41');s.box(x+size+.006,y+size*.38,h*.48,.012,size*.2,.27,'#324a41');}
function windows(s,x,y,w,d,h){
 // Shallow facade pieces sit on broad wall faces. A small ordering offset
 // avoids their being cut up by the wall's face-center painter sort.
 const bias=s.depthBias;s.depthBias+=.12;
 // Register each pane at the same world position as its visible geometry.
 s.emissive=1;
 for(const f of [.18,.72]){const z=h*.54,ww=Math.min(.18,w*.15);s.source([x+w*f+ww/2,y+d+.05,z+.095],[0,1],1.25,.7,'window');s.source([x+w*f+ww/2,y-.05,z+.095],[0,-1],1.25,.7,'window');s.source([x-.05,y+d*f+ww/2,z+.095],[-1,0],1.25,.7,'window');s.source([x+w+.05,y+d*f+ww/2,z+.095],[1,0],1.25,.7,'window');s.box(x+w*f,y+d+.008,z,ww,.024,.19,'#ffe6ab');s.box(x+w*f,y-.025,z,ww,.024,.19,'#ffe6ab');s.box(x-.025,y+d*f,z,.024,ww,.19,'#ffe6ab');s.box(x+w+.008,y+d*f,z,.024,ww,.19,'#ffe6ab');}
 s.emissive=0;
 if(s.dynamicDoors){s.box(x+w*.4,y+d+.01,.1,w*.22,.026,.48,'#2f342d');s.doors.push({x:x+w*.4,y:y+d+.04,z:.1,w:w*.22,h:.48,owner:s.owner});}
 else s.box(x+w*.4,y+d+.01,.1,w*.22,.026,.48,'#5b4735');
 s.depthBias=bias;
}
function hut(s,x,y,w,d,h,roofColor,level,chimney=true){
 const rise=.35+level*.08,frame=level>=3?gold:'#73563d';
 // Recess the walls beneath the eaves and omit their hidden top plane.
 s.box(x,y,.1,w,d,h-.1,level===1?timber:stone,false);
 s.roof(x-.09,y-.09,h+.1,w+.18,d+.18,rise,roofColor);
 windows(s,x,y,w,d,h);
 // Ridge caps and exposed corner posts give timber cottages a framed silhouette.
 s.box(x+w/2-.035,y-.11,h+.1+rise,.07,d+.22,.055,frame);
 for(const dx of [0,w-.055])for(const dy of [0,d-.055])s.box(x+dx-.012,y+dy-.012,.1,.075,.075,h,frame);
 s.box(x+w*.36,y+d+.025,.1,w*.3,.13,.065,level>1?stone:timber);
 if(s.r.cam.zoom>=1.3){
  s.box(x+w*.37,y+d+.027,.58,w*.28,.035,.055,frame);
  s.box(x+w*.57,y+d+.042,.3,.025,.018,.04,gold);
  // The window bars remain on the facade, so they rotate with the building.
  const bias=s.depthBias;s.depthBias+=.125;
  for(const f of [.18,.72]){
   const ww=Math.min(.18,w*.15);
   for(const dy of [-.032,d+.034])s.box(x+w*f+ww*.45,y+dy,h*.54,.018,.016,.19,frame);
   for(const dx of [-.032,w+.034])s.box(x+dx,y+d*f+ww*.45,h*.54,.016,.018,.19,frame);
  }
  s.depthBias=bias;
 }
 if(chimney&&level>=2){s.box(x+w*.75,y+d*.2,h,.18,.18,.75,stone);s.box(x+w*.75-.025,y+d*.2-.025,h+.75,.23,.23,.065,'#786d5b');s.chimneys.push({owner:s.owner,position:[x+w*.75+.09,y+d*.2+.09,h+.82]});}
}

// Phase 5 — homes read by silhouette, not just paint. Cottages grow a loft
// gable with a rail (tier 2), then a porch over the door and a raised kitchen
// stack (tier 3); the longhouse is a meadhall — ridge beam, twin chimneys,
// banner and a veranda — so it out-silhouettes the cottage row at a glance.
function homeDetails(s,b,n,l){
 const x=b.x+.22,y=b.y+.22,w=n-.44,h=.42+l*.16;
 if(l>=2){
  // Loft window in the front gable, with a little rail under it.
  s.source([x+w*.44+.065,y+w+.03,h+.265],[0,1],.9,.45,'window');s.emissive=1;s.box(x+w*.44,y+w-.028,h+.2,.13,.05,.13,'#ffe6ab');s.emissive=0;
  for(const dx of [.34,.62])s.box(x+w*dx,y+w+.03,.1,.045,.045,h*.72,timber);
  s.box(x+w*.34,y+w+.03,.5,.3,.04,.045,timber);
 }
 if(l>=3){
  // Porch over the door: deck, posts, a low awning.
  s.box(x+w*.28,y+w+.03,.1,w*.46,.22,.05,timber);
  s.box(x+w*.3,y+w+.2,.1,.055,.055,.42,timber);
  s.box(x+w*.69,y+w+.2,.1,.055,.055,.42,timber);
  s.roof(x+w*.24,y+w-.04,.52,w*.54,.34,.16,'#8a6a48');
  // Raise the kitchen stack clear of the ridge line.
   const cx=x+w*.75,cy=y+w*.2;
   s.box(cx+.01,cy+.01,h+.8,.16,.16,.34,stone);
   s.box(cx-.02,cy-.02,h+1.14,.22,.22,.06,'#786d5b');const chimney=s.chimneys.findLast(p=>p.owner===s.owner);if(chimney)chimney.position[2]=h+1.2;
  }
  if(l>=4){
   // Prosperous: stone skirt around the base and a lantern by the door.
   s.box(x-.02,y-.02,.1,w+.04,.06,.14,stone);s.box(x-.02,y+w-.1,.1,w+.04,.06,.14,stone);
   lanternPost(s,x+w+.02,y+w+.12,.62,.95,.42);
  }
  if(l>=5){
   // Advanced: side lean-to with its own little roof.
   s.box(x-.3,y+.3,.1,.3,w*.5,.42,timber);
   s.roof(x-.34,y+.26,.52,.38,w*.58,.14,'#8a6a48');
  }
  if(l>=6){
   // Masterwork: gold finials on the porch posts and a flower box.
   s.box(x+w*.3-.01,y+w+.19,.52,.075,.075,.07,gold);s.box(x+w*.69-.01,y+w+.19,.52,.075,.075,.07,gold);
   s.box(x+w*.36,y+w+.05,.32,.24,.1,.12,'#6d5b3e');
   for(const dx of [.4,.48,.56])s.pyramid(x+w*dx,y+w+.1,.44,.05,.1,'#90a369');
  }
}

function longhouseShape(s,b,n){
 const x=b.x,y=b.y,h=.62,rise=.51,stone='#b4beb2';
 hut(s,x+.58,y+.32,n-1.15,n-.64,h,'#977851',2,false);
 // Ridge beam down the long axis ties the big roof together.
 const rx=x+.58+(n-1.15)/2;
 s.box(rx-.038,y+.34,h+.1+rise,.076,n-.68,.06,'#6b543a');
 // Twin stacks at both ends of the ridge: one would read cottage, two read hall.
 for(const cy of [y+.72,y+n-.82]){s.box(rx-.08,cy,h+.1,.16,.16,rise+.42,stone);s.box(rx-.11,cy-.03,h+.1+rise+.42,.22,.22,.06,'#786d5b');s.chimneys.push({owner:s.owner,position:[rx,cy+.08,h+.1+rise+.48]});}
 // Banner over the door, then the veranda rail across the front gable.
 s.box(x+n*.5,y+n-.14,.1,.055,.055,.85,timber);s.box(x+n*.5+.05,y+n-.14,.62,.2,.025,.32,'#5e8c9b');
 for(let i=0;i<4;i++)s.box(x+.62+i*(n-1.2)/3,y+n-.16,.1,.05,.05,.4,timber);
 s.roof(x+.55,y+n-.66,.48,n-1.15,.6,.17,'#7d6142');
}

// Modular architecture kit for the eight core families: shared wall, roof,
// entrance, stack and brace modules whose material and form climb the tier
// bands (1-2 timber/plank, 3-4 stone base + glazing, 5-6 bracing + metal).
// Renderer-only, static, and inside the existing footprints.
const FAMILY_TYPES=new Set(['hall','cottage','barracks','farm','lumber','mine','market','forge']);
const FAMILY_ROOF={
 hall:['#5b7f86','#52727d','#47636e'],
 cottage:['#9ba061','#8f9457','#7f854e'],
 barracks:['#b96d5a','#a95f4e','#94503f'],
 farm:['#8f7a4e','#836f46','#77633d'],
 lumber:['#60897b','#56796c','#4c6a5e'],
 mine:['#6d7873','#616b66','#555e59'],
 market:['#ccac60','#bd9d53','#a98b47'],
 forge:['#976b54','#8a6049','#7a543e']
};
function famBand(l){return l>=5?2:l>=3?1:0;}
function famQuad(s,points,color){s.face(points,color,false);}
function famMesh(s,id,x,y,z){
 if(s.alpha!==1||!artEnabled(s.r?.data,id))return 0;
 const doc=s.r?.meshes?.[id];if(!doc)return 0;
 const b=meshBounds(doc);
 return drawMesh(s,doc,0,0,{dx:x-b.x0,dy:y-b.y0,dz:z-b.z0});
}
function famGable(s,x,y,z,w,d,rise,color){
 const a=[x,y,z],b=[x+w,y,z],c=[x+w,y+d,z],e=[x,y+d,z],u=[x+w/2,y,z+rise],v=[x+w/2,y+d,z+rise];
 famQuad(s,[a,u,v,e],color);famQuad(s,[u,b,c,v],color);famQuad(s,[a,b,u],color);famQuad(s,[e,v,c],color);
}
function famHip(s,x,y,z,w,d,rise,color){
 const r=Math.min(w,d)*.22,a=[x,y,z],b=[x+w,y,z],c=[x+w,y+d,z],e=[x,y+d,z],u=[x+(w-r)/2,y+d/2,z+rise],v=[x+(w+r)/2,y+d/2,z+rise];
 famQuad(s,[a,b,v,u],color);famQuad(s,[c,e,u,v],color);famQuad(s,[b,c,v],color);famQuad(s,[e,a,u],color);
}
function famRoof(s,x,y,z,w,d,band,color,rise){
 if(band===0){famGable(s,x-.05,y-.05,z,w+.1,d+.1,rise,color);s.box(x+w/2-.03,y-.08,z+rise-.03,.06,d+.16,.05,'#8a6a48');}
 else if(band===1){
  famHip(s,x-.06,y-.06,z,w+.12,d+.12,rise,color);
  s.box(x+w*.42,y+d*.4,z+rise-.14,.24,.24,.16,'#8a6a48');famGable(s,x+w*.38,y+d*.4,z+rise-.05,.32,.24,.12,'#8a6a48');
  s.box(x+w/2-.035,y-.09,z+rise-.03,.07,d+.18,.05,'#e6ca8b');
 }else{
  famGable(s,x-.07,y-.07,z,w+.14,d+.14,rise,color);
  famGable(s,x+w*.14,y+d*.08,z+rise*.48,w*.72,d*.82,rise*.55,color);
  s.box(x+w/2-.03,y-.1,z+rise-.03,.06,d+.2,.05,'#e6ca8b');
 }
}
function famStack(s,x,y,z,w,d,h){
 s.box(x,y,z,w,d,h,'#b4beb2');s.box(x-.03,y-.03,z+h,w+.06,d+.06,.07,'#786d5b');
 if(s.alpha===1)s.chimneys.push({owner:s.owner,position:[x+w/2,y+d/2,z+h+.08]});
}
function famBrace(s,x,y,z,len,width,axis){
 if(axis==='x')famQuad(s,[[x,y,z],[x+len,y,z+len],[x+len,y,z+len-width],[x,y,z-width]],'#73563d');
 else famQuad(s,[[x,y,z],[x,y+len,z+len],[x,y+len,z+len-width],[x,y,z-width]],'#73563d');
}
function famWalls(s,x,y,w,d,h,l,body){
 famQuad(s,[[x,y+d,.1],[x,y+d,h],[x+w,y+d,h],[x+w,y+d,.1]],body);
 famQuad(s,[[x,y,.1],[x+w,y,.1],[x+w,y,h],[x,y,h]],body);
 famQuad(s,[[x+w,y,.1],[x+w,y+d,.1],[x+w,y+d,h],[x+w,y,h]],body);
 famQuad(s,[[x,y,.1],[x,y,h],[x,y+d,h],[x,y+d,.1]],body);
 const post=l>=3?'#9ba798':'#b38a59';
 for(const [dx,dy] of [[0,0],[w-.08,0],[0,d-.08],[w-.08,d-.08]])s.box(x+dx-.012,y+dy-.012,.1,.09,.09,h,post);
 if(l===1)s.box(x-.025,y-.025,h-.09,w+.05,.05,.06,'#b38a59');
 if(l>=2)s.box(x-.035,y-.035,.1,w+.07,d+.07,.15,'#a7aa91');
 if(l===2)for(const f of [.3,.55,.8]){s.box(x+w*f,y+d-.005,.15,.032,.025,h*.72,'#8a6a48');s.box(x+w-.005,y+d*f,.15,.025,.032,h*.72,'#8a6a48');}
 if(l>=3)s.box(x-.05,y-.05,.1,w+.1,d+.1,.26,'#a7aa91');
 if(l>=5)for(const dx of [.04,w-.12])famBrace(s,x+dx,y+d+.005,.22,h*.6,.1,'x');
 if(l>=6){s.box(x-.04,y-.04,h*.62,w+.08,.05,.05,'#6a6f65');s.box(x-.04,y+d-.01,h*.62,w+.08,.05,.05,'#6a6f65');}
}
function famPanes(s,x,y,w,d,h,count){
 const spots=count>=8?[.18,.72]:[.42];
 const bias=s.depthBias;s.depthBias+=.12;s.emissive=1;
 for(const f of spots){
  const ww=Math.min(.18,w*.15),z=h*.54;
  s.source([x+w*f+ww/2,y+d+.05,z+.095],[0,1],1.25,.7,'window');
  s.source([x+w*f+ww/2,y-.05,z+.095],[0,-1],1.25,.7,'window');
  s.source([x-.05,y+d*f+ww/2,z+.095],[-1,0],1.25,.7,'window');
  s.source([x+w+.05,y+d*f+ww/2,z+.095],[1,0],1.25,.7,'window');
  s.box(x+w*f,y+d+.008,z,ww,.024,.19,'#ffe6ab');
  s.box(x+w*f,y-.025,z,ww,.024,.19,'#ffe6ab');
  s.box(x-.025,y+d*f,z,.024,ww,.19,'#ffe6ab');
  s.box(x+w+.008,y+d*f,z,.024,ww,.19,'#ffe6ab');
 }
 s.emissive=0;s.depthBias=bias;
}
function famEntrance(s,x,y,w,h,l,torches=false){
 s.box(x-.055,y-.035,.1,.06,.05,h,'#73563d');
 s.box(x+w-.005,y-.035,.1,.06,.05,h,'#73563d');
 s.box(x-.055,y-.035,.1+h*.92,w+.1,.05,.09,l>=4?gold:'#73563d');
 if(s.dynamicDoors){s.box(x+.01,y+.01,.1,w-.02,.03,h-.14,'#2f342d');s.doors.push({x:x+.01,y:.05,z:.1,w:w-.02,h:h-.14,owner:s.owner});}
 else s.box(x+.01,y+.01,.1,w-.02,.03,h-.14,l>=3?'#5b4735':'#6a5032');
 const steps=l>=5?3:l>=3?2:1;
 for(let i=0;i<steps;i++)s.box(x-.05-i*.05,y+.04+i*.08,.1-i*.025,w+.1+i*.1,.11,.09,'#a7aa91');
 if(torches){torch(s,x-.16,y+.14,h*.6,[0,1],1.15,.53);torch(s,x+w+.16,y+.14,h*.6,[0,1],1.15,.53);}
}
function hallFamily(s,b,n,l){
 const x=b.x+.22,y=b.y+.22,w=n-.44,h=.42+l*.16,band=famBand(l),roof=FAMILY_ROOF.hall;
 famWalls(s,x,y,w,w,h,l,l===1?'#b38a59':l===2?'#c9a06a':'#c3c9bd');
 famRoof(s,x,y,h,w,w,band,roof[band],.4+l*.05);
 famPanes(s,x,y,w,w,h,4);
 famEntrance(s,x+w*.3,y+w,w*.32,h,l,true);
 famStack(s,x+w-.3,y+.16,h+.04,.18,.18,.7+l*.06);
 if(l>=3)tower(s,x+.04,y+.04,.5,1.2+l*.12,'#b4beb2');
 if(l>=4)for(const dx of [.3,.7])s.box(x+w*dx-.08,y+w+.02,h*.88,.16,.03,.26,dx<.5?'#ad6155':'#5e8c9b');
 if(l>=5){s.box(x-.16,y+.3,.1,.28,w*.6,h*.88,'#b38a59');s.roof(x-.2,y+.26,h*.88,.36,w*.68,.14,'#8a6a48');lanternPost(s,x+w+.04,y+w-.22,.64,.95,.42);}
 if(l>=6){s.box(x+w*.3-.02,y+w+.01,h*1.02,.08,.08,.08,gold);s.box(x+w*.7-.02,y+w+.01,h*1.02,.08,.08,.08,gold);}
 if(l===4||l===5)famMesh(s,'stairs-stone',x+w*.32,y+w+.03,.1);
}
function cottageFamily(s,b,n,l){
 const x=b.x+.22,y=b.y+.22,w=n-.44,h=.42+l*.16,band=famBand(l),roof=FAMILY_ROOF.cottage;
 famWalls(s,x,y,w,w,h,l,l===1?'#b38a59':l===2?'#c9a06a':'#c3c9bd');
 famRoof(s,x,y,h,w,w,band,roof[band],.36+l*.06);
 famPanes(s,x,y,w,w,h,8);
 famEntrance(s,x+w*.3,y+w,w*.32,h,l,false);
 famStack(s,x+w-.28,y+.18,h+.04,.15,.15,.6+l*.05);
 homeDetails(s,b,n,l);
 if(l===4||l===5)famMesh(s,'shutters',x+w*.3,y+w+.02,h*.6);
 if(l===5)famMesh(s,'roof-window',x+w*.45,y+w*.42,h+.02);
 if(l===6)famMesh(s,'town-lantern',x-.12,y+w-.42,.1);
}
function barracksFamily(s,b,n,l){
 const x=b.x+.22,y=b.y+.22,w=n-.44,h=.42+l*.16,band=famBand(l),roof=FAMILY_ROOF.barracks;
 famWalls(s,x,y,w,w,h,l,l===1?'#b38a59':l===2?'#c9a06a':'#c3c9bd');
 famRoof(s,x,y,h,w,w,band,roof[band],.42+l*.06);
 famPanes(s,x,y,w,w,h,4);
 famEntrance(s,x+w*.3,y+w,w*.34,h,l,false);
 famStack(s,x+w-.3,y+.16,h+.04,.16,.16,.66+l*.05);
 if(l>=3)tower(s,x+w-.66,y+.04,.46,1.05+l*.1,'#b4beb2');
 if(l>=4){s.box(x+w*.5-.03,y+w+.02,h*1.0,.06,.06,.58,'#b38a59');s.box(x+w*.5+.03,y+w+.02,h*1.0,.24,.02,.15,'#ad6155');}
 if(l>=5)famBrace(s,x+.24,y+w+.005,.22,h*.58,.1,'x');
 if(l>=6)s.box(x-.02,y-.02,h*.64,w+.04,.05,.05,'#6a6f65');
 if(l===5)famMesh(s,'torch-metal',x+w+.06,y+w*.5-.12,h*.5);
 if(l===4)famMesh(s,'wood-door',x-.08,y+w*.5-.4,.12);
}
function farmFamily(s,b,n,l){
 const x=b.x,y=b.y,band=famBand(l),roof=FAMILY_ROOF.farm,bw=.86,bh=.42+l*.16,bx=x+.24,by=y+.24;
 s.box(x+.2,y+.2,.12,n-.4,n-.4,.05,'#72553b');
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){const px=x+.38+i*.5,py=y+.38+j*.5;s.box(px,py,.17,.05,.05,.15+l*.03,'#799658');s.pyramid(px,py,.27,.085,.15,'#e1c776',4);}
 famWalls(s,bx,by,bw,bw,bh,l,l===1?'#b38a59':l===2?'#c9a06a':'#c3c9bd');
 famRoof(s,bx,by,bh,bw,bw,band,roof[band],.34+l*.05);
 famEntrance(s,bx+bw*.3,by+bw,bw*.34,bh,l,false);
 if(l===2)famMesh(s,'fence',x+.3,y+1.72,.12);
 if(l>=3){famPanes(s,bx,by,bw,bw,bh,4);famStack(s,bx+bw-.22,by+.12,bh+.04,.14,.14,.5);}
 if(l>=4){s.box(x+.5,y+.5,.13,.06,.06,.6,'#b38a59');s.box(x+.38,y+.5,.55,.3,.06,.06,'#b38a59');s.pyramid(x+.5,y+.5,.73,.12,.14,'#d5bf8f',6);}
 if(l>=5)s.box(x+.2,y+.2,.1,n-.4,.1,.06,'#4e9aaa');
 if(l===5)famMesh(s,'overhang',x+.24,y+n-.6,.5);
 if(l>=6){s.box(x+n-.55,y+.15,.12,.3,.3,.4,'#b38a59');s.roof(x+n-.6,y+.1,.52,.4,.4,.14,'#8a6a48');
  s.box(x+n-.68,y+.82,.12,.3,.3,.9+l*.06,'#b4beb2');s.pyramid(x+n-.53,y+.97,1.02+l*.06,.21,.24,'#8a6a48',4);
  s.box(x+n-.7,y+.8,.34,.05,.05,.16,'#6a6f65');}
 if(s.alpha===1){const fixture=s.fixture;s.fixture=true;
  s.box(x+n-.55,y+.26,.18,.34,.42,.18,'#d7af6d');s.roof(x+n-.57,y+.25,.36,.38,.44,.15,'#c49a59');
  s.fixture=fixture;}
 lanternPost(s,x+n-.28,y+n-.28,.7+l*.04,1.12,.43);
}
function lumberFamily(s,b,n,l){
 const x=b.x,y=b.y,band=famBand(l),roof=FAMILY_ROOF.lumber,sx=x+.06,sy=y+.06,sw=.56,sh=.36+l*.1;
 for(let i=0;i<3;i++)s.box(x+.18,y+.2+i*.19,.13,.62,.14,.14,'#b38a59');
 s.box(x+.28,y+.29,.27,.43,.14,.14,'#d4ae73');
 famWalls(s,sx,sy,sw,sw,sh,l,l===1?'#b38a59':l===2?'#c9a06a':'#c3c9bd');
 famRoof(s,sx,sy,sh,sw,sw,band,roof[band],.28+l*.04);
 famEntrance(s,sx+sw*.28,sy+sw,sw*.44,sh,l,false);
 famStack(s,sx+sw-.18,sy+.1,sh+.03,.12,.12,.4+l*.04);
 if(l>=3)famPanes(s,sx,sy,sw,sw,sh,4);
 if(l===4||l===5)famMesh(s,'roof-gable',x+.12,y+.5,.5);
 if(l>=4){s.box(x+.1,y+.62,.13,.5,.12,.12,'#c79861');s.box(x+.14,y+.66,.25,.42,.08,.06,'#b38a59');}
 if(l>=5){s.pyramid(x+.3,y+.7,.13,.16,.24,'#76593d',5);s.pyramid(x+.48,y+.7,.13,.13,.2,'#8a6a48',5);}
 if(l>=6){s.box(x+.62,y+.5,.13,.07,.07,.8,'#b38a59');s.box(x+.62,y+.5,.8,.4,.07,.07,'#b38a59');s.box(x+.95,y+.5,.3,.07,.07,.07,'#6a6f65');}
 if(l===5)famMesh(s,'town-lantern',x+.0,y+.06,.1);
 lanternPost(s,x+.79,y+.22,.78,1,.42);
}
function mineFamily(s,b,n,l){
 const x=b.x,y=b.y,band=famBand(l),roof=FAMILY_ROOF.mine;
 s.pyramid(x+.5,y+.5,.13,.55,.72,'#8b9690',6);
 s.box(x+.34,y+.76,.14,.32,.09,.4,'#2d3937');
 s.box(x+.27,y+.79,.14,.07,.12,.48,'#b38a59');
 s.box(x+.68,y+.79,.14,.07,.12,.48,'#b38a59');
 s.box(x+.27,y+.79,.62,.48,.12,.07,'#b38a59');
 s.pyramid(x+.26,y+.35,.62,.14,.26,'#e5bd66');
 torch(s,x+.27,y+.84,.55,[0,1],.95,.47);
 torch(s,x+.73,y+.84,.55,[0,1],.95,.47);
 s.box(x+.22,y+.16,.72,.1,.1,.95,'#b38a59');s.box(x+.68,y+.16,.72,.1,.1,.95,'#b38a59');
 famRoof(s,x+.16,y+.12,.88,.68,.56,band,roof[band],.22+l*.04);
 if(l>=3){s.box(x+.7,y+.26,.14,.22,.22,.54,'#a7aa91');famStack(s,x+.7,y+.26,.64,.12,.12,.34);famPanes(s,x+.7,y+.26,.22,.22,.54,4);}
 if(l>=4)for(const px of [.22,.73])s.box(x+px,y+.72,.14,.09,.09,.55,'#a7aa91');
 if(l>=5){s.box(x+.13,y+.3,.16,.3,.24,.2,'#6f6253');s.pyramid(x+.27,y+.41,.36,.09,.12,'#a29074',5);}
 if(l>=6){s.box(x+.44,y+.86,.14,.05,.05,.7,'#b38a59');s.box(x+.44,y+.86,.7,.34,.05,.05,'#b38a59');
  s.box(x+.2,y+.18,1.05,.09,.09,.5,'#b38a59');s.box(x+.7,y+.18,1.05,.09,.09,.5,'#b38a59');s.box(x+.18,y+.18,1.5,.62,.09,.08,'#b38a59');
  lanternPost(s,x+.5,y+.3,.6,.9,.4);}
 if(l===3||l===4||l===5)famMesh(s,'lantern-wall',x+.96,y+.55,.28);
}
function marketFamily(s,b,n,l){
 const x=b.x,y=b.y,band=famBand(l),roof=FAMILY_ROOF.market;
 for(const [a,c,color]of[[.22,.24,'#b76053'],[n-1.1,.25,'#73956a'],[.35,n-1.05,'#ccac60']]){
  s.box(x+a,y+c,.14,.86,.46,.32,'#b38a59');
  for(const dx of [0,.8])s.box(x+a+dx,y+c,.14,.06,.06,.85,'#b38a59');
  if(band===0)famGable(s,x+a-.06,y+c-.12,.9,1,.7,.12,color);
  else if(band===1)famHip(s,x+a-.06,y+c-.12,.9,1,.7,.15,color);
  else {famGable(s,x+a-.06,y+c-.12,.9,1,.7,.18,color);famGable(s,x+a+.1,y+c+.06,1.02,.62,.52,.13,roof[band]);}
 }
 const hx=x+n*.46,hy=y+n*.46,hw=n*.34,hh=.42+l*.13;
 famWalls(s,hx,hy,hw,hw,hh,l,l===1?'#b38a59':l===2?'#c9a06a':'#c3c9bd');
 famRoof(s,hx,hy,hh,hw,hw,band,roof[band],.32+l*.05);
 famEntrance(s,hx+hw*.3,hy+hw,hw*.34,hh,l,false);
 if(l>=3){famPanes(s,hx,hy,hw,hw,hh,4);famStack(s,hx+hw-.2,hy+.1,hh+.04,.13,.13,.46);}
 if(l>=4)famMesh(s,'overhang',x+.16,y+n*.52,.5);
 if(l>=5){s.box(x+.2,y+.2,.06,.5,.5,.4,'#b38a59');s.roof(x+.15,y+.15,.46,.6,.6,.14,'#ccac60');}
 if(l===5)famMesh(s,'pennant',x+n*.5,y+.12,1.4);
 lanternPost(s,x+.32,y+n-.32,.9,1.12,.44);
 lanternPost(s,x+n-.32,y+n-.32,.9,1.12,.44);
}
function forgeFamily(s,b,n,l){
 const x=b.x+.22,y=b.y+.22,w=n-.44,h=.42+l*.16,band=famBand(l),roof=FAMILY_ROOF.forge;
 famWalls(s,x,y,w,w,h,l,l===1?'#b38a59':l===2?'#c9a06a':'#c3c9bd');
 famRoof(s,x,y,h,w,w,band,roof[band],.42+l*.06);
 famEntrance(s,x+w*.3,y+w,w*.34,h,l,false);
 if(l>=3)famPanes(s,x,y,w,w,h,4);
 s.box(x+w-.33,y+.16,.1,.28,.28,1.15+l*.08,'#b4beb2');s.box(x+w-.35,y+.14,1.25+l*.08,.32,.32,.12,'#4d514b');
 if(s.alpha===1)s.chimneys.push({owner:s.owner,position:[x+w-.19,y+.3,1.38+l*.08]});
 s.source([x+.5,y+w-.15,.33],[0,1],1.65,1,'fire');
 s.emissive=1;s.box(x+.3,y+w-.2,.2,.4,.024,.26,'#eea55d');s.emissive=0;
 if(l>=4){s.box(x+.35,y+.26,.1,.24,.24,1.5+l*.08,'#b4beb2');s.box(x+.33,y+.24,1.6+l*.08,.28,.28,.1,'#4d514b');}
 if(l>=5){s.box(x-.16,y+.3,.1,.3,w*.55,h*.88,'#b38a59');s.roof(x-.2,y+.26,h*.88,.38,w*.62,.14,'#8a6a48');}
 if(l===5)famMesh(s,'town-lantern',x-.14,y+w-.44,.1);
 if(l>=6){s.box(x+w-.35,y+.14,1.68+l*.08,.32,.32,.07,gold);famMesh(s,'chimney',x+w-.42,y+.22,1.78+l*.08);}
 if(l>=2)famMesh(s,'overhang',x+.1,y+w*.5,.5);
}
function familyShape(s,b,spec){
 const n=spec.size,l=Math.max(1,Math.floor(+b.level||1)),t=b.type;
 if(t==='hall')hallFamily(s,b,n,l);
 else if(t==='cottage')cottageFamily(s,b,n,l);
 else if(t==='barracks')barracksFamily(s,b,n,l);
 else if(t==='farm')farmFamily(s,b,n,l);
 else if(t==='lumber')lumberFamily(s,b,n,l);
 else if(t==='mine')mineFamily(s,b,n,l);
 else if(t==='market')marketFamily(s,b,n,l);
 else forgeFamily(s,b,n,l);
}

function workplaceDetails(s,b,n){
 const {x,y,type:t,level:l}=b,z=.14,front=y+n-.16;
 if(['hall','barracks','longhouse'].includes(t)){
  const flag=t==='barracks'?'#ad6155':'#5e8c9b';
  for(const dx of [.32,n-.48]){
   s.box(x+dx,front,.2,.055,.055,.8,timber);
   s.box(x+dx+.05,front,.63,.2,.025,.32,flag);
   if(l>1)s.box(x+dx+.09,front+.027,.7,.1,.02,.05,gold);
  }
 }
 if(['forge','smeltery','workshop'].includes(t)){
  // Squat anvil, flared top and iron billet: readable even at village zoom.
  s.box(x+.18,front-.04,z,.28,.18,.13,'#655844');
  s.box(x+.26,front-.035,z+.13,.1,.15,.1,'#647375');
  s.box(x+.17,front-.07,z+.23,.32,.22,.09,'#a3b7b6');
 }
 if(['armory','fletcher','shieldwall-yard'].includes(t)){
  s.box(x+.15,front,.12,.06,.06,.65,timber);
  s.box(x+n-.22,front,.12,.06,.06,.65,timber);
  s.box(x+.15,front,.59,n-.31,.05,.07,timber);
  for(const dx of [.29,n-.39]){
   if(t==='fletcher'){s.box(x+dx,front,.2,.04,.04,.55,timber);s.box(x+dx-.045,front-.015,.72,.13,.07,.07,stone);}
   else{s.box(x+dx-.05,front+.055,.25,.17,.04,.25,'#718e9b');if(s.r.cam.zoom>=1.3)s.box(x+dx+.015,front+.096,.25,.035,.015,.25,gold);}
  }
 }
 if(t==='tannery'){
  for(const dx of [.12,n-.18])s.box(x+dx,front,.13,.05,.06,.65,timber);
  s.box(x+.12,front,.74,n-.25,.06,.045,timber);
  s.box(x+.23,front+.03,.33,n-.47,.025,.36,'#c79b6d');
 }
 if(['scriptorium','schoolroom'].includes(t)){
  s.box(x+.18,front-.04,.14,n-.36,.17,.2,timber);
  for(const [dx,color]of[[.22,'#7a7396'],[.34,'#ba895c'],[.46,'#7a927b']])s.box(x+dx,front-.025,.34,.075,.13,.19,color);
 }
 if(t==='cottage'&&l>=2){
  s.box(x+.28,front,.15,.35,.14,.13,timber);
  for(const dx of [.33,.46,.58])s.pyramid(x+dx,front+.07,.28,.07,.12,'#90a369');
 }
}

function detailCrate(s,x,y,z=.12,scale=1){
 if(addExternalProp(s,'crate',x+.14*scale,y+.12*scale,z,.22*scale))return;
 const w=.28*scale,d=.24*scale,h=.22*scale;
 s.box(x,y,z,w,d,h,'#8d6844');
 s.box(x-.012,y-.012,z+h,w+.024,d+.024,.045,'#b88a55');
 s.box(x+w*.44,y-.018,z+.02,w*.12,d+.036,h+.06,'#604a39');
}
function detailBarrel(s,x,y,z=.12,scale=1){
 if(addExternalProp(s,'barrel',x+.11*scale,y+.11*scale,z,.26*scale))return;
 const w=.22*scale,d=.22*scale,h=.34*scale;
 s.box(x,y,z,w,d,h,'#8a6646');
 for(const dz of [.04,h-.075])s.box(x-.012,y-.012,z+dz,w+.024,d+.024,.035,'#53544e');
}
function detailSack(s,x,y,z=.12,scale=1){
 if(addExternalProp(s,'bag',x,y,z,.11*scale))return;
 s.pyramid(x,y,z,.12*scale,.2*scale,'#d5bf8f',6);
 s.box(x-.035*scale,y-.035*scale,z+.17*scale,.07*scale,.07*scale,.04*scale,'#8d7654');
}
function detailRack(s,x,y,z=.12,width=.56){
 s.box(x,y,z,.055,.055,.62,timber);
 s.box(x+width-.055,y,z,.055,.055,.62,timber);
 s.box(x,y,z+.54,width,.055,.055,timber);
}
function detailTool(s,x,y,z=.18,kind='hammer'){
 s.box(x,y,z,.035,.035,.44,'#72533a');
 if(kind==='axe'){s.box(x-.07,y-.02,z+.32,.18,.07,.12,'#9dadab');return;}
 if(kind==='spear'){s.pyramid(x+.018,y+.018,z+.42,.045,.16,'#aebbbb');return;}
 s.box(x-.055,y-.025,z+.34,.145,.085,.09,'#9aa7a5');
}
function buildingDetailLayer(s,b,spec){
 if(s.r.cam.zoom<1.2||b.hp<=0||b.remaining>0)return;
 const {x,y,type:t,level:l}=b,n=spec.size,front=y+n-.16,fine=s.r.cam.zoom>=1.65;
 if(t==='storehouse'){
  // Cargo remains outside the door, readable from either side of the roof.
  detailCrate(s,x+.15,front-.22,.13,1.15);
  detailBarrel(s,x+n-.39,front-.17,.13,1.1);
  if(l>=2){detailCrate(s,x+.2,y+.16,.13,1.1);detailSack(s,x+n-.32,y+.22,.13,1.1);}
  if(l>=3){detailCrate(s,x+.48,front-.2,.13,.85);detailBarrel(s,x+.16,y+.43,.13,1.1);}
 }
 if(t==='longhouse'){
  detailBarrel(s,x+.18,front-.21,.13,1.15);
  if(l>=2){detailCrate(s,x+n-.5,front-.22,.13,1.1);detailRack(s,x+.17,y+.2,.13,.6);}
  if(l>=3){detailBarrel(s,x+n-.43,y+.22,.13,1.2);detailCrate(s,x+.2,y+.38,.13,1.05);}
 }
 if(t==='hall'){
  const fixture=s.fixture;s.fixture=true;
  detailCrate(s,x+n-.48,front-.24,.13,1.2);
  s.fixture=fixture;
 }
 // Military yards: training gear should identify the job before the menu opens.
 if(t==='barracks'){
  detailRack(s,x+.18,front,.13,Math.min(.62,n-.36));
  detailTool(s,x+.26,front+.02,.18,'spear');detailTool(s,x+.48,front+.02,.18,'axe');
  const dx=x+n-.42,dy=y+.28;s.box(dx,dy,.12,.08,.08,.66,timber);s.box(dx-.12,dy-.04,.55,.32,.08,.08,'#8f7555');s.box(dx-.09,dy-.055,.35,.26,.11,.21,'#9a765a');
 }
 if(['forge','smeltery','workshop'].includes(t)){
  // Coal/ore bin, quench trough and a tool rack around the active work bay.
  s.box(x+.18,y+.2,.12,.42,.34,.2,'#6b5541');s.box(x+.22,y+.24,.31,.34,.26,.06,t==='smeltery'?'#8d7770':'#383b38');
  s.box(x+n-.58,front-.34,.12,.42,.26,.23,'#66858a');s.box(x+n-.54,front-.3,.31,.34,.18,.035,'#9fd0d0');
  if(fine){detailRack(s,x+.2,front,.13,.58);detailTool(s,x+.28,front+.015,.18,'hammer');detailTool(s,x+.48,front+.015,.18,'axe');}
  if(l>=2){for(let i=0;i<3;i++)s.box(x+.72+i*.14,y+.22,.13,.11,.28,.07,i%2?'#b6c1bf':'#879493');}
 }
 if(['armory','fletcher','shieldwall-yard'].includes(t)){
  detailCrate(s,x+n-.52,y+.22,.12,.95);
  if(t==='fletcher'){
   for(let i=0;i<4;i++)s.box(x+n-.4+i*.045,y+.31,.2,.02,.02,.54,'#d5c59c');
   if(fine)s.box(x+n-.44,y+.27,.16,.24,.15,.08,'#80634a');
  }else{
   for(let i=0;i<(l>=2?3:2);i++){const px=x+n-.44+i*.12;s.box(px,y+.28,.18,.09,.035,.28,'#718e9b');if(fine)s.box(px+.03,y+.292,.23,.03,.012,.18,gold);}
  }
 }
 if(t==='farm'){
  // Hand tools, seed sacks and a water barrel sell the field as a workplace.
  detailRack(s,x+.18,front,.13,.5);detailTool(s,x+.27,front+.015,.18,'axe');
  detailSack(s,x+n-.42,y+.28,.13,.9);
  const fixture=s.fixture;s.fixture=true;
  s.box(x+n-.55,y+.26,.18,.34,.42,.18,'#d7af6d');s.roof(x+n-.57,y+.25,.36,.38,.44,.15,'#c49a59');
  s.fixture=fixture;
  if(l===3)detailBarrel(s,x+.2,y+.25,.13,.95);
 }
 if(t==='pasture'){
  s.box(x+.28,front-.3,.13,.7,.24,.18,'#7f6445');s.box(x+.32,front-.26,.29,.62,.16,.035,'#b18b59');
  detailBarrel(s,x+n-.48,y+.28,.13,.9);
 }
 if(['lumber','timber_yard'].includes(t)){
  // Sawbuck plus a stump/axe keeps the yard readable even before its reserve pile grows.
  for(const dx of [.22,.58]){s.box(x+dx,y+n-.48,.13,.06,.3,.42,timber);s.box(x+dx-.08,y+n-.31,.35,.22,.06,.06,timber);}
  s.box(x+n-.38,y+.24,.13,.27,.27,.14,'#76593d');detailTool(s,x+n-.31,y+.3,.26,'axe');
  const fixture=s.fixture;s.fixture=true;
  for(const dy of [n-.32,n-.18])s.box(x+.1,y+dy,.13,.55,.11,.12,'#c79861');
  s.fixture=fixture;
  if(l>=2)detailCrate(s,x+.18,y+.24,.12,.9);
 }
 if(['mine','emberglass'].includes(t)){
  // Short rails and a loaded cart extend the mine entrance into the yard.
  const fixture=s.fixture;s.fixture=true;
  s.box(x+.39,y+.86,.16,.22,.02,.31,'#252e2c');
  s.fixture=fixture;
  for(const rx of [x+.31,x+.67])s.box(rx,y+.82,.13,.045,.65,.035,'#687170');
  for(let j=0;j<4;j++)s.box(x+.29,y+.83+j*.16,.125,.45,.055,.035,timber);
  detailRack(s,x+.13,y+.25,.13,.45);detailTool(s,x+.19,y+.27,.18,'axe');
  s.fixture=true;
  for(const [dx,dy] of [[.13,.25],[.8,.38]])s.pyramid(x+dx,y+dy,.13,.13,.22,t==='mine'?'#a29074':'#96c5c2',5);
  s.fixture=fixture;
  if(l>=2)detailCrate(s,x+n-.42,y+.2,.12,.82);
 }
 if(t==='tannery'){
  s.box(x+n-.54,y+.24,.12,.38,.38,.22,'#846646');s.box(x+n-.5,y+.28,.31,.3,.3,.035,'#70584b');
  if(fine)detailBarrel(s,x+.18,y+.24,.13,.86);
 }
 if(['scriptorium','schoolroom'].includes(t)){
  detailCrate(s,x+n-.48,y+.22,.12,.84);
  if(fine){s.box(x+n-.43,y+.27,.37,.27,.18,.035,'#d7c9a4');s.box(x+n-.32,y+.27,.405,.035,.18,.018,'#765c4a');}
 }
 if(t==='butchery'){
  s.box(x+.18,front-.34,.13,.58,.3,.25,'#7f6042');s.box(x+.15,front-.37,.38,.64,.36,.055,'#c19c6e');
  if(fine){detailTool(s,x+.34,front-.24,.43,'axe');detailBarrel(s,x+n-.46,y+.25,.13,.82);}
 }
 if(t==='mason_yard'&&fine){
  detailRack(s,x+.18,front,.13,.52);detailTool(s,x+.27,front+.015,.18,'hammer');
  for(const [dx,dy,r]of[[.2,.24,.12],[.42,.3,.09],[.62,.22,.11]])s.pyramid(x+dx,y+dy,.13,r,.14,'#a8afa9',5);
 }
  masterworkDetails(s,b,spec,fine);
}
// Deterministic variant in {0,1,2}: repeated buildings of one type do not
// look cloned, and the choice never reshuffles between reloads.
function variantOf(b){
  const id=String(b.id??b.type??'');
  let h=0;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))>>>0;
  return h%3;
}
function masterworkDetails(s,b,spec,fine){
  const {x,y,type:t,level:l}=b,n=spec.size,front=y+n-.16,v=variantOf(b);
  if(l<4)return;
  const side=v===0?.18:v===1?n-.5:.3;
  if(t==='farm'){
   if(l>=5){s.box(x+.2,y+.5,.13,.5,.2,.14,'#8a6a48');for(const wx of [x+.28,x+.55])s.box(wx,y+.68,.11,.09,.09,.14,'#414845');}
   if(l>=6)lanternPost(s,x+n-.3,y+.3,.66,.95,.42);
  }
  if(t==='mine'||t==='emberglass'){
   s.pyramid(x+side,y+.3,.13,.13,.22,t==='mine'?'#a29074':'#96c5c2',5);
   if(l>=5&&t!=='mine')detailCrate(s,x+n-.42,y+.45,.12,.8);
   if(l>=6)lanternPost(s,x+.24,y+.3,.62,.9,.4);
  }
  if(t==='lumber'||t==='timber_yard'){
   for(let i=0;i<2;i++)s.box(x+.15+i*.16,y+.42,.13,.13,.4,.12,i%2?'#c79861':timber);
   if(l>=5){s.box(x+.12,y+.6,.13,.5,.12,.12,'#c79861');s.box(x+.16,y+.64,.25,.42,.08,.06,timber);}
   if(l>=6&&t!=='lumber')detailCrate(s,x+n-.5,y+.3,.12,.85);
  }
  if(t==='storehouse'){
   detailCrate(s,x+side,front-.24,.13,1);
   if(l>=5)detailBarrel(s,x+n-.4,y+.3,.13,1);
   if(l>=6)detailSack(s,x+.3,y+.4,.13,.9);
  }
  if(t==='barracks'){
   for(let i=0;i<3;i++)s.box(x+.3+i*.16,front+.02,.4,.09,.035,.28,i%2?'#718e9b':'#ad6155');
   if(l>=6&&fine){s.box(x+.2,front-.3,.13,.2,.2,.5,stone);s.box(x+.2,front-.3,.63,.24,.24,.07,gold);}
  }
  if(t==='forge'||t==='smeltery'||t==='workshop'){
   for(let i=0;i<3;i++)s.box(x+.72+i*.14,y+.4,.13,.11,.28,.07,i%2?'#b6c1bf':'#879493');
   if(l>=5){s.box(x+n-.58,front-.5,.12,.42,.26,.2,'#6b5541');s.box(x+n-.54,front-.46,.3,.34,.18,.03,'#383b38');}
   if(l>=6)lanternPost(s,x+.2,y+.3,.66,.95,.42);
  }
  if(t==='hall'||t==='longhouse'){
   for(let i=0;i<2;i++)s.box(x+n*.3+i*.4,front-.05,.5,.16,.03,.26,i%2?'#5e8c9b':'#ad6155');
   if(l>=5&&t!=='hall')detailBarrel(s,x+side,y+.3,.13,1.05);
   if(l>=6)lanternPost(s,x+n-.3,y+.3,.7,1.05,.44);
  }
  if(t==='cottage'){
   for(const dx of [.36,.5,.64])s.pyramid(x+side+dx-.3,front+.06,.26,.06,.1,'#90a369');
   if(l>=5){s.box(x+n-.55,y+.3,.13,.4,.2,.12,'#8a6a48');}
   if(l>=6)lanternPost(s,x+.24,y+.24,.62,.9,.4);
  }
  if(t==='sawmill'){
   for(let i=0;i<2;i++)s.box(x+.2+i*.16,y+.5,.13,.13,.4,.12,i%2?'#c79861':timber);
   if(l>=5)detailCrate(s,x+n-.5,y+.3,.12,.85);
   if(l>=6){s.box(x+.62,y+.55,.13,.06,.06,.7,timber);s.box(x+.62,y+.55,.7,.36,.06,.06,timber);}
  }
  if(t==='mill'){
   detailSack(s,x+side,y+.3,.13,.9);
   if(l>=5)detailSack(s,x+n-.4,y+.45,.13,.82);
   if(l>=6)detailBarrel(s,x+.2,y+.25,.13,.9);
  }
  if(t==='mason_yard'){
   for(const [dx,dy,r]of[[.2,.5,.12],[.42,.56,.09],[.62,.48,.11]])s.pyramid(x+dx,y+dy,.13,r,.14,'#a8afa9',5);
   if(l>=5){s.box(x+.2,front-.2,.13,.5,.14,.4,stone);s.roof(x+.15,front-.25,.53,.6,.24,.12,'#949b90');}
   if(l>=6)s.box(x+n-.4,y+.3,.5,.2,.2,.5,'#e9dab2');
  }
  if(t==='tannery'){
   detailBarrel(s,x+side,y+.28,.13,.86);
   if(l>=5)s.box(x+.23,front+.03,.5,n-.47,.025,.2,'#a87f52');
   if(l>=6)detailCrate(s,x+n-.5,y+.3,.12,.85);
  }
  if(t==='butchery'){
   detailBarrel(s,x+side,y+.25,.13,.82);
   if(l>=5){s.box(x+.18,front-.34,.3,.58,.3,.14,'#7f6042');}
   if(l>=6)lanternPost(s,x+.24,y+.3,.62,.9,.4);
  }
  if(t==='pasture'){
   detailBarrel(s,x+side,y+.28,.13,.9);
   if(l>=5)s.box(x+.32,front-.26,.45,.62,.16,.035,'#8a6a48');
   if(l>=6)lanternPost(s,x+n-.3,y+.3,.66,.95,.42);
  }
  if(t==='market'){
   if(l>=5){s.box(x+n*.4,y+n-.5,.13,.2,.2,.3,'#8d6844');s.box(x+n*.4-.012,y+n-.5-.012,.43,.224,.224,.045,'#b88a55');}
   if(l>=6)lanternPost(s,x+.3,y+.4,.7,1.05,.44);
  }
  if(t==='bakery'){
   s.box(x+n-.5,y+.3,.14,.3,.24,.22,'#c8a44e');s.box(x+n-.46,y+.34,.32,.22,.16,.05,'#8a6a48');
   if(l>=5)detailSack(s,x+side,y+.28,.13,.85);
   if(l>=6)lanternPost(s,x+.24,y+.24,.66,.95,.42);
  }
  if(t==='armory'){
   for(let i=0;i<3;i++){const px=x+.3+i*.16;s.box(px,front+.02,.4,.09,.035,.28,i%2?'#718e9b':'#ad6155');}
   if(l>=5)detailCrate(s,x+side,y+.28,.12,.9);
   if(l>=6&&fine){s.box(x+n-.4,y+.3,.13,.08,.08,.66,timber);s.box(x+n-.52,y+.34,.39,.32,.08,.08,'#8f7555');}
  }
  if(t==='fletcher'){
   for(let i=0;i<6;i++)s.box(x+.3+i*.045,y+.35,.2,.02,.02,.54,'#d5c59c');
   if(l>=5)detailCrate(s,x+side,y+.26,.12,.85);
   if(l>=6)lanternPost(s,x+n-.35,y+.3,.62,.9,.4);
  }
  if(t==='shieldwall-yard'){
   for(let i=0;i<3;i++)s.box(x+.3+i*.16,front+.02,.4,.09,.035,.3,'#5e8c9b');
   if(l>=5){s.box(x+n-.42,y+.28,.12,.08,.08,.66,timber);s.box(x+n-.54,y+.32,.39,.32,.08,.08,'#8f7555');}
   if(l>=6)detailBarrel(s,x+side,y+.3,.13,.9);
  }
  if(t==='bastion'){
   for(let i=0;i<2;i++)s.box(x+.32+i*.2,front+.02,.4,.1,.04,.3,i%2?'#ad6155':'#718e9b');
   if(l>=5)detailCrate(s,x+side,y+.28,.12,.88);
   if(l>=6){s.box(x+n-.4,y+.3,.13,.08,.08,.7,timber);s.box(x+n*.47,y+n*.47,.75,.22,.02,.14,'#b76053');}
  }
  if(t==='scout_post'){
   detailCrate(s,x+side,front-.24,.12,.85);
   if(l>=5)s.box(x+.3,front+.02,.4,.07,.03,.4,'#d5c59c');
   if(l>=6)lanternPost(s,x+n-.32,y+.3,.62,.9,.4);
  }
   if(t==='tower'||t==='archer_tower'||t==='ballista'){
    if(l>=5)detailCrate(s,x+side,y+.26,.12,.85);
    if(l>=6)detailBarrel(s,x+n-.45,y+.3,.12,.85);
   }
   if(t==='grand-watchtower'){
    // Signal post: braced supply rack at the stair foot, stores above.
    s.box(x+side,y+.3,.12,.08,.08,.66,timber);s.box(x+side-.12,y+.34,.39,.32,.08,.08,'#8f7555');
    if(l>=5)detailCrate(s,x+n-.48,y+.3,.12,.85);
    if(l>=6){detailBarrel(s,x+side,y+.5,.12,.85);lanternPost(s,x+n-.32,y+.3,.62,.9,.4);}
   }
   if(t==='manner-citadel'){
    // Seat of the manner: quartermaster crates and a banner rack by the
    // stair, stone braces and gilt trim closing in at fine zoom.
    detailCrate(s,x+side,front-.24,.13,1);
    for(let i=0;i<3;i++)s.box(x+.3+i*.16,front+.02,.4,.09,.035,.3,i%2?'#718e9b':'#ad6155');
    if(fine){s.box(x+.2,front-.3,.13,.2,.2,.5,stone);s.box(x+.2,front-.3,.63,.24,.24,.07,gold);}
    if(l>=5)detailBarrel(s,x+n-.42,y+.3,.13,.95);
    if(l>=6)lanternPost(s,x+n-.32,y+.3,.7,1,.42);
   }
  if(t==='watchfire'){
   if(l>=5)s.box(x+.2,y+.2,.12,.3,.2,.14,'#6b5541');
   if(l>=6)detailCrate(s,x+n-.48,y+.3,.12,.8);
  }
  if(t==='pond'||t==='deephole'){
   if(l>=4)detailCrate(s,x+side,y+.24,.12,.8);
   if(l>=5)s.box(x+.3,front-.2,.13,.4,.16,.18,timber);
   if(l>=6)lanternPost(s,x+n-.3,y+.3,.62,.9,.4);
  }
  if(t==='grove'||t==='frostgrove'||t==='whisper-grove'){
   if(l>=4)detailCrate(s,x+side,y+.24,.12,.82);
   if(l>=5){s.box(x+.24,y+1.2,.13,.07,.07,.7,timber);s.box(x+.24,y+1.2,.7,.36,.06,.045,timber);}
   if(l>=6)lanternPost(s,x+n-.3,y+.32,.66,.95,.42);
  }
  if(t==='blackwater-weir'){
   if(l>=4)detailBarrel(s,x+side,y+.3,.12,.85);
   if(l>=5)detailSack(s,x+n-.45,y+.4,.12,.8);
   if(l>=6)lanternPost(s,x+.3,y+.3,.62,.9,.4);
  }
  if(t==='chapel'||t==='sunken-chapel'){
   for(const dx of [.3,.7])s.box(x+n*dx-.08,y+n-.2,.85,.16,.03,.26,dx<.5?'#ad6155':'#5e8c9b');
   if(l>=5)detailBarrel(s,x+side,y+.28,.13,.9);
   if(l>=6)lanternPost(s,x+.26,y+.26,.7,1,.42);
  }
  if(t==='scriptorium'||t==='schoolroom'){
   if(l>=4)s.box(x+.2,front-.04,.14,n-.36,.17,.24,timber);
   if(l>=5)detailCrate(s,x+side,y+.26,.12,.82);
   if(l>=6)lanternPost(s,x+n-.32,y+.3,.62,.9,.4);
  }
  if(t==='market-square'){
   detailSack(s,x+side,y+n-.5,.13,.8);
   if(l>=5)detailBarrel(s,x+n-.5,y+n-.55,.13,.8);
   if(l>=6)lanternPost(s,x+n*.5,y+.25,.7,1,.42);
  }
  if(t==='grand-granary'){
   detailSack(s,x+side,front-.2,.13,.95);
   if(l>=5)detailSack(s,x+n-.4,y+.3,.13,.85);
   if(l>=6)detailBarrel(s,x+.2,y+.3,.13,.95);
  }
  if(t==='manor-gardens'){
   for(const dx of [.36,.5,.64])s.pyramid(x+side+dx-.3,front+.02,.2,.06,.1,'#90a369');
   if(l>=5)s.box(x+n*.4,y+n*.4,.2,.3,.3,.14,'#4e9aaa');
   if(l>=6)lanternPost(s,x+.28,y+.28,.66,.95,.42);
  }
  if(t==='monument'){
   if(l>=5)detailCrate(s,x+side,y+.26,.12,.82);
   if(l>=6){s.box(x+n*.43,y+n*.43,.5,.14,.14,.3,stone);s.pyramid(x+n*.5,y+n*.5,.8,.12,.16,gold,4);}
  }
   if(t==='stone-road'){
    detailCrate(s,x+side,y+.26,.12,.85);
    if(l>=5){detailBarrel(s,x+n-.48,y+.3,.12,.85);s.box(x+.2,front-.2,.13,.5,.14,.4,stone);}
    if(l>=6){lanternPost(s,x+.28,y+.28,.7,1,.42);s.box(x+.3,front+.02,.4,.09,.035,.28,'#718e9b');}
   }
   if(t==='city-wall'){
    detailCrate(s,x+side,y+.26,.12,.85);
    if(l>=5){detailBarrel(s,x+n-.48,y+.3,.12,.85);for(let i=0;i<2;i++)s.box(x+.32+i*.2,front+.02,.4,.1,.04,.3,i%2?'#ad6155':'#718e9b');}
    if(l>=6){lanternPost(s,x+.28,y+.28,.7,1,.42);if(fine)s.box(x+.2,front-.3,.63,.24,.24,.07,gold);}
   }
   if(t==='forge-quarter'){
    detailCrate(s,x+side,y+.26,.12,.85);
    if(l>=5){detailBarrel(s,x+n-.48,y+.3,.12,.85);for(let i=0;i<3;i++)s.box(x+.72+i*.14,y+.4,.13,.11,.28,.07,i%2?'#b6c1bf':'#879493');}
    if(l>=6){lanternPost(s,x+.28,y+.28,.7,1,.42);s.box(x+.2,front-.3,.13,.2,.2,.5,stone);}
   }
   if(t==='lantern-rows'){
    detailCrate(s,x+side,y+.26,.12,.85);
    if(l>=5)detailBarrel(s,x+n-.48,y+.3,.12,.85);
    if(l>=6){lanternPost(s,x+.28,y+.28,.7,1,.42);if(fine)lanternPost(s,x+n-.32,y+.5,.66,.95,.42);}
   }
  if(t==='bell-tower'){
   if(l>=5)s.box(x+n*.4,y+n*.4,1.5,.2,.2,.2,gold);
   if(l>=6)lanternPost(s,x+.28,y+.28,.7,1,.42);
  }
}

function buildingShape(s,b,spec,world,time){
 const x=b.x,y=b.y,n=spec.size,l=b.level,t=b.type;s.owner={kind:'building',id:b.id};s.alpha=b.hp<=0?.35:b.remaining>0?.6:1;
 s.box(x+.1,y+.1,0,n-.2,n-.2,.12,l>1?stone:'#9b8864');
 if(FAMILY_TYPES.has(t)){familyShape(s,b,spec);return;}
 // Gatehouse: twin posts and a high lintel with the middle left open —
 // the hole reads as passage. Its portcullis rises at peace and lowers when
 // raiders press close; four cached stages avoid rebuilding it every frame.
 if(t==='gate'){const h=.55+l*.22,post=l===1?timber:stone,neighbors=wallNeighbors(b,world),axis=gateAxis(neighbors),lift=gateLiftStage(s.r,b,world,time)/GATE_STAGES;
  for(const [dx,dy]of neighbors){if(axis==='x'&&dx)s.box(x+(dx<0?-.1:.67),y+.4,.1,.43,.2,h-.15,post);else if(axis==='y'&&dy)s.box(x+.4,y+(dy<0?-.1:.67),.1,.2,.43,h-.15,post);}
  for(const offset of [.28,.695]){const gx=x+(axis==='x'?offset:.42),gy=y+(axis==='x'?.42:offset);s.box(gx,gy,.12,.025,.025,h+1,'#687170');}
  const doorZ=.12+lift*(h+.1),door=l===1?'#785336':'#45525a';
  if(axis==='x'){
   s.box(x+.15,y+.36,.1,.18,.28,h+.18,post);s.box(x+.67,y+.36,.1,.18,.28,h+.18,post);
   s.box(x+.15,y+.36,h+.18,.7,.28,.16,l>=3?gold:post);s.box(x+.14,y+.44,.1,.72,.12,.07,post);
   for(const px of [.34,.42,.5,.58])s.box(x+px,y+.44,doorZ,.035,.12,.55,door);
   for(const z of [.09,.45])s.box(x+.32,y+.44,doorZ+z,.4,.12,.055,post);
   if(l>=2)s.box(x+.435,y+.38,h+.22,.13,.22,.07,'#324a41');
   if(l>=3){s.box(x+.74,y+.43,h+.36,.05,.05,.42,timber);s.box(x+.79,y+.43,h+.69,.2,.02,.12,'#b76053');}
  }else{
   s.box(x+.36,y+.15,.1,.28,.18,h+.18,post);s.box(x+.36,y+.67,.1,.28,.18,h+.18,post);
   s.box(x+.36,y+.15,h+.18,.28,.7,.16,l>=3?gold:post);s.box(x+.44,y+.14,.1,.12,.72,.07,post);
   for(const py of [.34,.42,.5,.58])s.box(x+.44,y+py,doorZ,.12,.035,.55,door);
   for(const z of [.09,.45])s.box(x+.44,y+.32,doorZ+z,.12,.4,.055,post);
   if(l>=2)s.box(x+.38,y+.435,h+.22,.22,.13,.07,'#324a41');
   if(l>=3){s.box(x+.43,y+.74,h+.36,.05,.05,.42,timber);s.box(x+.43,y+.79,h+.69,.02,.2,.12,'#b76053');}
  }
   for(const off of [.36,.61]){const gx=x+(axis==='x'?off:.5),gy=y+(axis==='x'?.5:off),top=h+.45,bottom=Math.min(top,doorZ+.5);if(top>bottom)s.box(gx,gy,bottom,.018,.018,top-bottom,'#687170');}
   // Paired gate torches make the entrance readable from either approach.
   if(axis==='x'){torch(s,x+.26,y+.31,h*.74,[0,-1],1.08,.55);torch(s,x+.74,y+.69,h*.74,[0,1],1.08,.55);}
   else{torch(s,x+.31,y+.26,h*.74,[-1,0],1.08,.55);torch(s,x+.69,y+.74,h*.74,[1,0],1.08,.55);}
   if(l>=6){lanternPost(s,x+.2,y+.2,h+.3,1,.42);lanternPost(s,x+.8,y+.8,h+.3,1,.42);}
   return;}
 if(isWall(b)){const ramp=t==='rampart',h=.38+l*.17+(t==='stonewall'?.15:0)+(ramp?.12:0),color=ramp?'#8a6f4d':l>1||t==='stonewall'?stone:timber,neighbors=wallNeighbors(b,world);for(const [dx,dy]of neighbors.filter(([a,c])=>a+c<0))s.box(x+.4+Math.min(0,dx*.5),y+.4+Math.min(0,dy*.5),.1,.2+Math.abs(dx)*.5,.2+Math.abs(dy)*.5,h-.13,color);s.box(x+.28,y+.28,.1,.44,.44,h,color);
  if(ramp){s.box(x+.2,y+.2,.1,.6,.6,.1,timber);s.box(x+.2,y+.2,h-.12,.6,.07,.07,'#6b543a');}
   if(l===1&&t==='wall')s.pyramid(x+.5,y+.5,h+.1,.32,.2,color);else for(const [a,c]of[[.25,.25],[.6,.25],[.25,.6],[.6,.6]])s.box(x+a,y+c,h+.1,.16,.16,.18,l>=3||ramp&&l>=2?gold:color);
  for(const [dx,dy]of neighbors.filter(([a,c])=>a+c>=0))s.box(x+.4+Math.min(0,dx*.5),y+.4+Math.min(0,dy*.5),.1,.2+Math.abs(dx)*.5,.2+Math.abs(dy)*.5,h-.13,color);
   const cap=ramp?'#b89c70':l>1||t==='stonewall'?'#d3d9d0':WALL_CAP;
   for(const [dx,dy]of wallEnds(neighbors)){const alongX=!!dx,px=dx<0?.15:dx>0?.65:.37,py=dy<0?.15:dy>0?.65:.37,w=alongX?.2:.26,d=alongX?.26:.2;s.box(x+px,y+py,.1,w,d,h+.12,cap);}
   if(l>=5)s.box(x+.2,y+.2,.04,.6,.6,.2,l>1||t==='stonewall'?stone:timber);
   if(l>=6)s.box(x+.42,y+.42,h+.2,.16,.16,.3,gold);
  // One torch roughly every three wall tiles keeps long defenses legible
  // without turning every segment into an expensive light source.
  const torchSide=WALL_DIRECTIONS.find(([dx,dy])=>!neighbors.some(([nx,ny])=>nx===dx&&ny===dy));
  const torchSlot=((Math.floor(x)*31+Math.floor(y)*17)%3+3)%3;
  if(torchSide&&torchSlot===0){const [dx,dy]=torchSide;torch(s,x+.5+dx*.3,y+.5+dy*.3,h+.27,[dx,dy],1.02,.46);}
  return;}
  if(t.includes('trap')){const armed=trapArmed(b),fire=t==='fire-trap';s.box(x+.18,y+.18,.12,.64,.64,.08,'#665445');s.box(x+.25,y+.25,.2,.5,.5,.035,armed?(fire?'#815338':'#75664c'):'#4d4840');
   if(fire&&armed)s.emissive=.7;
   for(let i=0;i<3;i++)for(let j=0;j<3;j++)s.pyramid(x+.28+i*.21,y+.28+j*.21,armed?.2:.16,armed?.09:.055,armed?.3:.055,armed?(fire?'#eb9a4f':'#c0cdcd'):(fire?'#754330':'#665d52'));
   if(fire&&armed){s.source([x+.5,y+.5,.43],null,1.05,.7,'trap');s.pyramid(x+.5,y+.5,.21,.11,.2,'#f2ca6d',5);}
   s.emissive=0;return;}
 if(['farm','pasture'].includes(t)){s.box(x+.2,y+.2,.12,n-.4,n-.4,.05,t==='farm'?'#72553b':'#8da964');if(t==='farm'){for(let i=.32;i<n-.2;i+=.28)for(let j=.32;j<n-.2;j+=.32){s.box(x+i,y+j,.17,.045,.045,.18+l*.03,'#799658');s.pyramid(x+i,y+j,.3,.085,.16,'#e1c776');}}else{for(const [a,c]of[[.6,.7],[1.3,1.1]]){s.box(x+a,y+c,.3,.36,.22,.2,'#eee5d0');s.box(x+a+.3,y+c,.28,.12,.14,.18,'#76674f');for(const k of [0,.26])s.box(x+a+k,y+c,.12,.05,.18,.2,'#5e5543');}}if(l>1||t==='pasture')fence(s,x+.13,y+.13,n-.26,n-.26);lanternPost(s,x+n-.28,y+n-.28,.7+l*.04,1.12,.43);
  if(t==='farm'&&l>=4){s.box(x+.5,y+.5,.13,.06,.06,.6,timber);s.box(x+.38,y+.5,.55,.3,.06,.06,timber);s.pyramid(x+.5,y+.5,.73,.12,.14,'#d5bf8f',6);}
  if(t==='farm'&&l>=5){s.box(x+.2,y+.2,.1,n-.4,.1,.06,'#4e9aaa');}
  if(t==='farm'&&l>=6){s.box(x+n-.55,y+.15,.12,.3,.3,.4,timber);s.roof(x+n-.6,y+.1,.52,.4,.4,.14,'#8a6a48');}
  return;}
 if(['pond','deephole'].includes(t)){s.box(x+.18,y+.18,.13,n-.36,n-.36,.02,'#4e9aaa');for(let i=.22;i<n-.1;i+=.32)s.box(x+i,y+.14,.13,.22,.12,.1,stone);s.box(x+.2,y+n-.45,.16,n-.4,.23,.1,timber);s.box(x+.25,y+n-.45,.16,.08,.08,.65,timber);s.box(x+n-.35,y+n-.45,.16,.08,.08,.65,timber);lanternPost(s,x+n-.31,y+n-.39,.77,1.05,.42);return;}
  if(t==='blackwater-weir'){
   s.box(x+.14,y+.14,.13,.72,.72,.025,'#385f68');
   for(let i=0;i<5;i++)s.box(x+.2+i*.13,y+.3,.14,.035,.46,.28,timber);
   s.box(x+.17,y+.28,.41,.61,.06,.045,'#d9c8a1');s.box(x+.18,y+.66,.16,.61,.15,.08,timber);
   s.box(x+.65,y+.21,.14,.08,.08,.58,timber);s.box(x+.64,y+.29,.55,.1,.025,.16,'#eee5d0');
   if(l>=2){for(const a of [.18,.51])s.box(x+a,y+.19,.14,.05,.05,.58,timber);s.box(x+.18,y+.19,.72,.38,.06,.045,timber);s.box(x+.24,y+.22,.39,.2,.025,.27,'#8d7654');s.box(x+.24,y+.71,.24,.24,.13,.18,'#8c704e');s.roof(x+.19,y+.67,.42,.34,.22,.09,'#60897b');}
   lanternPost(s,x+.81,y+.78,.64,.9,.4);return;
  }
  if(t==='whisper-grove'){
   for(const [a,c]of[[.5,.5],[1.35,.65]]){pine(s,x+a,y+c,1.35+l*.15);for(const z of [.28,.4])s.box(x+a-.09,y+c+.07,z,.18,.025,.04,'#d9c8a1');}
   fence(s,x+.15,y+.15,n-.3,n-.3);
   for(let i=0;i<l+1;i++)s.box(x+.35,y+1.35,.13+i*.13,.75,.14,.11,timber);
   if(l>=2){for(const a of [.28,1.24])s.box(x+a,y+1.25,.13,.07,.07,.76,timber);s.roof(x+.22,y+1.16,.89,1.16,.5,.16,'#60897b');s.box(x+1.4,y+1.2,.13,.08,.46,.35,timber);s.box(x+1.33,y+1.2,.46,.22,.46,.06,'#d4ae73');}
   lanternPost(s,x+n-.26,y+n-.26,.76,1.08,.42);return;
  }
  if(['grove','frostgrove'].includes(t)){for(const [a,c]of[[.5,.5],[1.35,.65],[.9,1.4]])pine(s,x+a,y+c,1.2+l*.15,t==='frostgrove');fence(s,x+.15,y+.15,n-.3,n-.3);lanternPost(s,x+n-.26,y+n-.26,.76,1.08,.42);
   if(l>=4)pine(s,x+.9,y+.5,.8+l*.1,t==='frostgrove');
   if(l>=5){s.box(x+.4,y+.4,.1,.5,.2,.3,timber);s.roof(x+.35,y+.35,.4,.6,.3,.12,'#60897b');}
   if(l>=6)s.box(x+.45,y+.45,.72,.4,.1,.06,gold);
   return;}
  if(['lumber','timber_yard'].includes(t)){for(let i=0;i<3;i++)s.box(x+.18,y+.2+i*.19,.13,.62,.14,.14,timber);s.box(x+.28,y+.29,.27,.43,.14,.14,'#d4ae73');s.box(x+.17,y+.16,.13,.08,.08,.73,timber);s.box(x+.74,y+.16,.13,.08,.08,.73,timber);s.roof(x+.1,y+.1,.83,.8,.6,.18,'#60897b');lanternPost(s,x+.79,y+.22,.78,1,.42);
   if(l>=4){s.box(x+.1,y+.62,.13,.5,.12,.12,'#c79861');s.box(x+.14,y+.66,.25,.42,.08,.06,timber);}
   if(l>=5){s.pyramid(x+.3,y+.7,.13,.16,.24,'#76593d',5);s.pyramid(x+.48,y+.7,.13,.13,.2,'#8a6a48',5);}
   if(l>=6){s.box(x+.62,y+.5,.13,.07,.07,.8,timber);s.box(x+.62,y+.5,.8,.4,.07,.07,timber);s.box(x+.95,y+.5,.3,.07,.07,.07,'#6a6f65');}
   return;}
  if(['mine','emberglass'].includes(t)){s.pyramid(x+.5,y+.5,.13,.55,.72,'#8b9690',6);s.box(x+.34,y+.76,.14,.32,.09,.4,'#2d3937');s.box(x+.27,y+.79,.14,.07,.12,.48,timber);s.box(x+.68,y+.79,.14,.07,.12,.48,timber);s.box(x+.27,y+.79,.62,.48,.12,.07,timber);s.pyramid(x+.26,y+.35,.62,.14,.26,t==='mine'?gold:'#9cd5d2');torch(s,x+.27,y+.84,.55,[0,1],.95,.47);torch(s,x+.73,y+.84,.55,[0,1],.95,.47);
   if(l>=4){for(const px of [.22,.73])s.box(x+px,y+.72,.14,.09,.09,.55,stone);}
   if(l>=5){s.box(x+.13,y+.3,.16,.3,.24,.2,'#6f6253');s.pyramid(x+.27,y+.41,.36,.09,.12,'#a29074',5);}
   if(l>=6){s.box(x+.44,y+.86,.14,.05,.05,.7,timber);s.box(x+.44,y+.86,.7,.34,.05,.05,timber);lanternPost(s,x+.5,y+.3,.6,.9,.4);}
   return;}
 if(['tower','bell-tower','bellcote','scout_post','archer_tower','ballista'].includes(t)){const width=t==='archer_tower'?n*.45:t==='ballista'?n*.62:n*.55,h=t==='archer_tower'?1+l*.3:t==='ballista'?.62+l*.18:.85+l*.24;tower(s,x+(n-width)/2,y+(n-width)/2,width,h,l===1?timber:stone);if(t.includes('bell')){s.box(x+n*.4,y+n*.4,h+.3,n*.2,n*.2,.28,gold);s.roof(x+.15,y+.15,h+.7,n-.3,n-.3,.45,'#648b90');}
  // Archer tower: slim shaft, hooded crown and a level-2 pennant — the
  // longest reach on the wall, paid for in fragility.
   if(t==='archer_tower'){s.box(x+(n-width)/2-.06,y+(n-width)/2-.06,h+.12,width+.12,width+.12,.1,l>=3?gold:stone);if(l>=2){s.box(x+n*.47,y+n*.47,h+.2,.06,.06,.5,timber);s.box(x+n*.53,y+n*.47,h+.55,.22,.02,.14,l>=3?'#b76053':'#73956a');}
    if(l>=5)s.box(x+(n-width)/2-.02,y+(n-width)/2-.02,.06,width+.04,width+.04,.2,stone);
    if(l>=6){s.box(x+n*.47,y+n*.47,h+.62,.06,.06,.4,timber);s.box(x+n*.31,y+n*.47,h+.9,.22,.02,.12,'#b76053');}}
   // Ballista: squat engine deck with a spanned crossbow on top — short
   // range, slow reload (data cooldown), the hardest single hit in town.
   if(t==='ballista'){s.box(x+.14,y+.14,h,width+.1,width+.1,.12,timber);s.box(x+n/2-.3,y+n/2-.03,h+.12,.6,.06,.06,stone);s.box(x+n/2-.03,y+n/2-.3,h+.12,.06,.6,.06,stone);s.box(x+n/2-.02,y+n/2-.02,h+.12,.04,.5,.05,gold);
    if(l>=4){s.box(x+.1,y+.4,h+.05,.06,.2,.3,timber);s.box(x+.84,y+.4,h+.05,.06,.2,.3,timber);}
    if(l>=6)s.box(x+n/2-.02,y+n/2-.02,h+.18,.04,.5,.05,gold);}
  torch(s,x+n/2,y+(n+width)/2+.035,h*.58,[0,1],1.02,.45);
  return;}
  if(['watchfire','oathstone','moon-dial','cairnfield'].includes(t)){const spots=t==='cairnfield'?[[.5,.5],[1.3,.6],[.6,1.4],[1.35,1.35]]:[[n/2,n/2]];s.emissive=t==='watchfire'?1:0;for(const [a,c]of spots){s.box(x+a-.18,y+c-.18,.13,.36,.36,.22,stone);if(t==='watchfire'){s.source([x+a,y+c,.55],null,2.1,1,'fire');s.pyramid(x+a,y+c,.36,.26,.55,'#f2b35c',5);if(l>=4)s.pyramid(x+a,y+c,.2,.15,.3,'#e8883f',5);if(l>=5)for(const [ox,oy]of[[-.3,0],[.3,0],[0,-.3],[0,.3]])s.box(x+a+ox-.06,y+c+oy-.06,.13,.12,.12,.16,stone);if(l>=6){s.box(x+a-.05,y+c-.05,.13,.1,.1,.5,timber);s.box(x+a-.09,y+c-.09,.55,.18,.18,.08,'#4d514b');}}else if(t==='moon-dial')s.pyramid(x+a,y+c,.35,.17,.55,gold);else s.box(x+a-.09,y+c-.06,.35,.18,.12,.6,t==='oathstone'?'#90b5b5':stone);}s.emissive=0;return;}
 if(t==='dawn-gate'){tower(s,x+.18,y+.35,.62,1.7,stone);tower(s,x+n-.8,y+.35,.62,1.7,stone);s.box(x+.8,y+.43,1.35,n-1.6,.46,.45,gold);s.roof(x+.05,y+.2,2,n-.1,.95,.32,'#638b92');torch(s,x+.68,y+.92,1.22,[0,1],1.25,.58);torch(s,x+n-.68,y+.92,1.22,[0,1],1.25,.58);return;}
 if(t==='market'){for(const [a,c,color]of[[.22,.24,'#b76053'],[1.7,.25,'#73956a'],[.6,1.75,'#ccac60']]){s.box(x+a,y+c,.14,1,.5,.35,timber);for(const dx of [0,.94])s.box(x+a+dx,y+c,.14,.06,.06,.95,timber);s.roof(x+a-.06,y+c-.12,1.02,1.12,.75,.12,color);}lanternPost(s,x+.32,y+n-.32,.9,1.12,.44);lanternPost(s,x+n-.32,y+n-.32,.9,1.12,.44);return;}
 // The new production chain buildings need to read differently at map scale.
 // Keep the machinery stationary so the meshes can share the camera cache.
 if(t==='sawmill'){
  const h=.85+l*.12;
  for(const a of [.25,n-.35])for(const c of [.25,n-.35])s.box(x+a,y+c,.12,.11,.11,h,timber);
  s.roof(x+.12,y+.12,h+.12,n-.24,.72,.26,'#5f8074'); // open work bay
  s.box(x+.38,y+.8,.14,n-.76,.48,.27,'#6b5945'); // sawing bench
  s.box(x+.44,y+.92,.42,n-.88,.1,.045,'#d3b27e');
  for(const dx of [.4,1.5])s.box(x+dx,y+1.08,.15,.07,.07,.45,timber); // attached saw guides
  for(let i=0;i<3;i++)s.box(x+.25,y+.3+i*.18,.13,.69,.13,.13,i===1?'#cba46d':timber);
   if(l>=2){s.box(x+n-.48,y+.42,.14,.18,.18,1.2,timber);s.box(x+n-.48,y+.42,1.2,.54,.12,.1,timber);s.box(x+n-.04,y+.42,.63,.04,.04,.58,'#6a6f65');}
   if(l>=4){for(let i=0;i<2;i++)s.box(x+.25,y+.3+i*.18,.26,.69,.13,.1,i%2?'#cba46d':'#8a6a48');}
   if(l>=5){s.box(x+.12,y+.62,.13,.5,.12,.12,'#c79861');s.box(x+.16,y+.66,.25,.42,.08,.06,timber);}
   if(l>=6){s.box(x+n-.5,y+.2,.13,.07,.07,.9,timber);s.box(x+n-.5,y+.2,.9,.42,.07,.07,timber);lanternPost(s,x+.5,y+.3,.7,1,.42);}
   lanternPost(s,x+.24,y+n-.26,.82,1.06,.43);
   return;
 }
 if(t==='mill'){
  hut(s,x+.3,y+.3,n-.6,n-.6,.7+l*.13,'#aa7959',l);
  // A raised wheel, grain hopper, and flour sacks identify the gristmill.
  const z=.5,cx=x+n-.21,cy=y+n*.5;
  s.box(cx-.08,cy-.045,z-.04,.3,.09,.09,timber);
  for(const dy of [-.24,.24])s.box(cx+.03,cy+dy,.12,.08,.08,.43,timber);
   s.pyramid(x+.58,y+.54,1.15,.27,.38,'#d5b477');
   for(let i=0;i<2;i++)s.box(x+.19+i*.36,y+n-.42,.14,.3,.27,.24,'#decaa0');
   if(l>=4){s.box(cx+.01,cy-.28,.12,.12,.56,.06,stone);}
   if(l>=5){for(let i=0;i<3;i++)s.box(x+.19+i*.24,y+n-.42,.14,.2,.2,.2,'#decaa0');}
   if(l>=6){lanternPost(s,x+.3,y+.4,.7,1,.42);s.box(x+n*.4,y+.2,.9,.2,.06,.3,l>=3?gold:stone);}
   return;
 }
 if(t==='longhouse'){
  longhouseShape(s,b,n);
  if(l>=2){
   for(const side of [x+.53,x+n-.63])s.box(side,y+.46,.13,.085,n-.92,.55,l>=3?stone:timber);
   s.box(x+n*.38,y+.42,.67,n*.24,.48,.55,stone);
   s.roof(x+n*.37,y+.4,1.22,n*.26,.53,.24,l>=3?'#5e8c9b':'#977851');
  }
   if(l>=3){
    for(const side of [x+.63,x+n-.72])s.box(side,y+n-.34,.13,.09,.09,1.23,stone);
    s.box(x+.53,y+n-.38,1.32,n-1.06,.09,.08,gold);
   }
   if(l>=4){
    // Prosperous: stone foundation skirt and shield row on the front gable.
    s.box(x+.5,y+.24,.08,n-1,.12,.2,stone);
    for(let i=0;i<3;i++)s.box(x+n*.32+i*.3,y+n-.2,.85,.16,.03,.24,i%2?'#ad6155':'#5e8c9b');
   }
   if(l>=5){
    // Advanced: side wings with low roofs broaden the meadhall footprint.
    for(const side of [x+.3,x+n-.85]){s.box(side,y+.7,.12,.55,n-1.4,.5,stone);s.roof(side-.05,y+.65,.62,.65,n-1.3,.18,'#977851');}
   }
   if(l>=6){
    // Masterwork: gold ridge caps and twin braziers flanking the door.
    const ridgeX=x+.58+(n-1.15)/2;
    s.box(ridgeX-.05,y+.34,1.2,.1,n-.68,.07,gold);
    for(const dx of [n*.32,n*.68]){s.box(x+dx-.09,y+n-.3,.12,.18,.18,.3,stone);s.emissive=1;s.pyramid(x+dx,y+n-.21,.42,.12,.24,'#f2b35c',5);s.emissive=0;s.source([x+dx,y+n-.21,.5],null,1.6,.8,'fire');}
   }
   torch(s,x+n*.3,y+n-.11,.73,[0,1],1.24,.56);
   torch(s,x+n*.7,y+n-.11,.73,[0,1],1.24,.56);
   return;
 }
 // Town projects (Phase 4): grand works read as themselves at map scale —
 // an open plaza of striped stalls, a grain hall with chute and sacks,
 // hedge-lined gardens with a fountain, and a plinth obelisk. Tier lifts
 // each silhouette (gold caps, arcades, taller stone).
 if(t==='market-square'){
  s.box(x+.1,y+.1,.05,n-.2,n-.2,.03,'#8a7354');
  for(const [a,c,color]of[[.18,.22,'#b76053'],[n-1.02,.25,'#73956a'],[.3,n-1.02,'#ccac60'],[n-1,.92,'#a26b7e']]){
   s.box(x+a,y+c,.1,.82,.44,.3,timber);
   for(const dx of [0,.76])s.box(x+a+dx,y+c,.1,.06,.06,.8,timber);
   s.roof(x+a-.05,y+c-.1,.86,1,.66,.12,color);
  }
   if(l>=2){s.box(x+n*.43,y+n*.43,.09,.14,.14,.52,stone);s.pyramid(x+n*.5,y+n*.5,.61,.26,.32,gold,4);}
   if(l>=3){s.box(x+.55,y+n-.26,.08,n-1.1,.13,.3,stone);s.box(x+n-1.45,y+.55,.08,.13,n-1.1,.3,stone);}
   if(l>=4){for(const [a,c]of[[.18,n-1.02],[n-1.02,n-1.02]])s.box(x+a,y+c,1.02,.12,.12,.14,gold);}
   if(l>=5){s.box(x+.2,y+.2,.06,.5,.5,.4,timber);s.roof(x+.15,y+.15,.46,.6,.6,.14,'#ccac60');}
   if(l>=6)lanternPost(s,x+n*.5,y+.2,.8,1.05,.44);
   return;
 }
 if(t==='grand-granary'){
  hut(s,x+.22,y+.22,n-.44,n-.44,.5+l*.16,l>=3?stone:timber,l);
  s.box(x+n-.6,y+.16,.32,.36,.32,.42,'#d8c98f');
  s.box(x+.24,y+n-.46,.14,.4,.3,.28,'#deca9f');
  s.box(x+.48,y+n-.46,.14,.4,.3,.32,'#deca9f');
   if(l>=3)for(const a of [.12,n-.34]){s.box(x+a,y+n*.42,.96,.18,.18,.8,'#e9dab2');s.pyramid(x+a+.09,y+n*.51,1.08,.15,.22,stone,4);}
   if(l>=4){s.box(x+.24,y+n-.5,.14,.5,.24,.2,'#8d6844');s.box(x+.28,y+n-.46,.34,.42,.16,.03,'#b88a55');}
   if(l>=5){s.box(x+n-.62,y+.14,1.5,.3,.3,.3,gold);}
   if(l>=6)lanternPost(s,x+.3,y+.3,.72,1,.42);
   return;
 }
 if(t==='manor-gardens'){
  s.box(x+.1,y+.1,.04,n-.2,n-.2,.05,'#547b60');
  for(const [a,c]of[[.42,.42],[n-.8,.5],[.5,n-.8]])pine(s,x+a,y+c,.6+l*.16,false);
   if(l>=2){s.box(x+n*.4,y+n*.4,.1,.34,.34,.12,stone);s.box(x+n*.43,y+n*.43,.14,.28,.28,.1,'#4e9aaa');}
   for(const [a,c]of[[.22,n*.5],[n-.36,n*.5],[n*.5,.22],[n*.5,n-.36]])s.pyramid(x+a,y+c,.08,.06,.15,l>=3?gold:'#a26b7e',4);
   if(l>=4){s.box(x+.2,y+.2,.06,n-.4,.08,.1,stone);s.box(x+.2,y+n-.28,.06,n-.4,.08,.1,stone);}
   if(l>=5)for(const [a,c]of[[.6,.6],[n-.7,.6],[.6,n-.7],[n-.7,n-.7]])s.pyramid(x+a,y+c,.3,.07,.14,'#90a369');
   if(l>=6){s.box(x+n*.4,y+n*.4,.5,.34,.34,.1,gold);lanternPost(s,x+.3,y+n-.3,.7,1,.42);}
   return;
 }
 if(t==='monument'){
  if(l>=2){s.box(x+n*.14,y+n*.14,.1,.72,.72,.1,stone);s.box(x+n*.2,y+n*.2,.16,.6,.6,.16,'#e9dab2');}
  s.box(x+n*.32,y+n*.32,.24,.36,.36,.5+l*.4,'#e9dab2');
  s.pyramid(x+n*.5,y+n*.5,.9+l*.4,.16,.22,l>=3?gold:stone,4);
   if(l>=3){s.box(x+n*.12,y+n*.12,.5,.16,.76,.09,stone);s.box(x+n*.12,y+n*.6,.5,.76,.16,.09,stone);}
   if(l>=4)for(const [a,c]of[[.3,.3],[n-.3,.3],[.3,n-.3],[n-.3,n-.3]])s.box(x+a-.06,y+c-.06,.12,.12,.12,.5,stone);
   if(l>=5)s.box(x+n*.32,y+n*.32,1.3,.36,.36,.12,gold);
   if(l>=6){for(const [a,c]of[[n*.2,n*.5],[n*.8,n*.5]])s.box(x+a-.08,y+c-.01,.9,.16,.03,.3,'#5e8c9b');lanternPost(s,x+.25,y+.25,.8,1,.42);}
   return;
 }
 const colors={hall:'#658d99',barracks:'#b96d5a',cottage:'#9ba061',longhouse:'#977851',chapel:'#8e8dae','sunken-chapel':'#679fa5',forge:'#976b54',smeltery:'#846f67',armory:'#667b91',workshop:'#789380',tannery:'#bd9a69',schoolroom:'#ba9369',scriptorium:'#798ca7',butchery:'#a75e54',fletcher:'#7c9868','shieldwall-yard':'#668a91',mason_yard:'#949b90'};
 hut(s,x+.22,y+.22,n-.44,n-.44,.42+l*.16,colors[t]||'#829a78',l);
 if(t==='hall'){
  torch(s,x+n*.3,y+n-.12,.66,[0,1],1.15,.53);
  torch(s,x+n*.7,y+n-.12,.66,[0,1],1.15,.53);
 }
 if(t==='storehouse'){
  // A raised loading canopy and reinforced door set stores apart from homes.
  s.box(x+n*.31,y+n-.15,.13,n*.38,.15,.1,timber);
  for(const dx of [x+n*.31,x+n*.68])s.box(dx,y+n-.13,.13,.055,.055,.62,l>=2?stone:timber);
  s.roof(x+n*.28,y+n-.24,.78,n*.44,.42,.19,l>=3?'#667d91':'#947052');
  if(l>=3){s.box(x+n*.43,y+.36,1.12,.28,.28,.54,stone);s.roof(x+n*.4,y+.32,1.68,.34,.36,.2,'#667d91');}
 }
 workplaceDetails(s,b,n);
 if(spec.housing)homeDetails(s,b,n,l);
 if(['forge','smeltery'].includes(t)){s.box(x+n-.55,y+.28,.1,.28,.28,1.5,stone);s.box(x+n-.57,y+.26,1.6,.32,.32,.12,'#4d514b');s.chimneys.push({owner:s.owner,position:[x+n-.41,y+.42,1.73]});s.source([x+.5,y+n-.15,.33],[0,1],1.65,1,'fire');s.emissive=1;s.box(x+.3,y+n-.2,.2,.4,.024,.26,'#eea55d');s.emissive=0;}
 if(t.includes('chapel')){tower(s,x+.25,y+.25,.4,1.35,stone);s.pyramid(x+.45,y+.45,1.65,.33,.6,colors[t]);}
  if(t==='hall'&&l>=2)tower(s,x+n-.7,y+.25,.48,1.35,stone);
  if(t==='hall'&&l>=4){tower(s,x+.22,y+.25,.48,1.35+l*.14,stone);for(const dx of [.32,.68])s.box(x+n*dx-.08,y+n-.2,.9,.16,.03,.26,dx<.5?'#ad6155':'#5e8c9b');}
  if(t==='hall'&&l>=6){for(const dx of [.3,.7]){s.box(x+n*dx-.09,y+n-.32,.12,.18,.18,.3,stone);s.emissive=1;s.pyramid(x+n*dx,y+n-.23,.42,.12,.24,'#f2b35c',5);s.emissive=0;s.source([x+n*dx,y+n-.23,.5],null,1.6,.8,'fire');}}
  if(t==='barracks'&&l>=4){for(let i=0;i<3;i++)s.box(x+.25+i*.42,y+.35,.12,.1,.1,.7,timber);s.box(x+.2,y+.3,.72,n-.4,.07,.07,timber);}
  if(t==='barracks'&&l>=6){s.box(x+n-.55,y+.3,.12,.3,.3,.9,stone);s.box(x+n-.62,y+.23,1.02,.44,.44,.1,stone);}
  if(t==='storehouse'&&l>=4){s.box(x+.2,y+.2,.12,.4,.3,.3,timber);s.roof(x+.15,y+.15,.54,.5,.4,.14,'#667d91');}
  if(t==='storehouse'&&l>=6){s.box(x+n*.43,y+.36,1.66,.28,.28,.2,gold);}
  if(['forge','smeltery'].includes(t)&&l>=4){s.box(x+.35,y+.28,.1,.24,.24,1.9,stone);s.box(x+.33,y+.26,2.0,.28,.28,.1,'#4d514b');}
  if(['forge','smeltery'].includes(t)&&l>=6){s.box(x+.33,y+.26,2.1,.28,.28,.07,gold);}
  if(['mason_yard','shieldwall-yard'].includes(t)){for(let i=0;i<3;i++)s.box(x+.25+i*.42,y+n-.15,.13,.28,.16,.3,stone);}
}
export function buildingModel(s,b,spec,world,time=0){
 buildingShape(s,b,spec,world,time);
 if(b.id==null)return; // placement previews already have a clear ghost treatment
 buildingDetailLayer(s,b,spec);
 addLivingProps(s,b,spec);
 addConvertedAccents(s,b,spec);
 addConvertedBuildingTiers(s,b,spec);
 addExternalWorkplace(s,b,spec);
 const x=b.x,y=b.y,n=spec.size;
 if(b.hp<=0){
  s.alpha=.95;
  for(const [dx,dy,w] of [[.17,.2,.28],[n-.51,.23,.34],[.28,n-.49,.3],[n-.5,n-.53,.32]])
   s.box(x+dx,y+dy,.12,w,w,.12,'#56534a');
  s.box(x+n*.42,y+n*.43,.12,n*.18,n*.13,.08,'#3f4742');
 }else if(b.remaining>0){
  s.alpha=.9;
  const h=.8+n*.12;
  for(const dx of [.13,n-.21])for(const dy of [.13,n-.21])s.box(x+dx,y+dy,.12,.08,.08,h,timber);
  for(const dy of [.13,n-.21])s.box(x+.13,y+dy,h*.57,n-.26,.07,.07,'#d0af79');
  s.box(x+.18,y+.21,.13,Math.min(.54,n-.36),.24,.17,'#c5a16e');
 }
 productionPile(s,b,spec);
}

// Phase 6 — the on-site haul is visible on the building itself: a stockpile
// grows in four steps as the tap reserve fills (harvest.capacity), and a gold
// pennant flies once the haul is worth collecting. Pure geometry over b
// fields; the static mesh cache keys on productionStage()/reserveReady() so
// it only repaints when a step or the badge flips, never per reserve unit.
export function productionStage(b,spec){
 if((!spec?.production&&!spec?.refine)||b.hp<=0||b.remaining>0)return -1;
 const level=Math.max(1,Math.floor(+b.level||1));
 const cap=spec.production?Math.max(1,reserveCapacity(spec,level)):96;
 const held=spec.production?(Number.isFinite(+b.harvestBonus)?Math.max(0,+b.harvestBonus):0):Object.values(b.outputReserve||{}).reduce((a,n)=>a+n,0);
 return Math.min(3,Math.floor((held/cap)*4));
}
const PILES={
 wood:{kind:'timber',a:'#8a6a48',b:'#b38a59'},
 lumber:{kind:'timber',a:'#c8a06a',b:'#d9b57e'},
 frostwood:{kind:'timber',a:'#7e9aa3',b:'#b6d4da'},
 food:{kind:'sacks',a:'#c8a44e',b:'#e1c776'},
 gold:{kind:'ore',a:'#8b8378',b:'#e5bd66'},
 plate:{kind:'bars',a:'#8b96a0',b:'#b7c7dc'},
};
function productionPile(s,b,spec){
 const stage=productionStage(b,spec);
 if(stage<=0)return;
 const n=spec.size,px=b.x+n*.78,py=b.y+n*.82,pile=PILES[spec.production||Object.keys(spec.refine?.[0]?.out||{})[0]]||PILES.food;
 if(pile){const {a,b:c}=pile;
  if(pile.kind==='timber'){
   for(let i=0;i<stage;i++)s.box(px-.26+i*.16,py-.2,.1,.13,.4,.12,i%2?c:a);
   if(stage>=3)s.box(px-.24,py-.08,.22,.42,.16,.1,c);
  }else if(pile.kind==='sacks'){
   for(let i=0;i<stage;i++)s.pyramid(px-.16+(i%2)*.3,py-.12+Math.floor(i/2)*.3,.02,.1,.17,i%2?c:a,5);
   if(stage>=3)s.box(px-.22,py-.1,.24,.36,.14,.12,c);
  }else if(pile.kind==='ore'){
   for(let i=0;i<stage;i++)s.pyramid(px-.14+(i%2)*.26,py-.1+Math.floor(i/2)*.26,.02,.09,.14,i%2?c:a,5);
   if(stage>=3)s.pyramid(px-.02,py+.02,.02,.3,.12,c,6);
  }else{
   for(let i=0;i<stage;i++)s.box(px-.3,py-.24+i*.16,.1,.12,.3,.07,i%2?c:a);
   if(stage>=3)s.box(px-.24,py-.2,.17,.42,.26,.06,a);
  }
 }
 if(reserveReady(b,spec)){s.box(b.x+.24,b.y+n-.14,.1,.05,.05,.52,timber);s.box(b.x+.29,b.y+n-.14,.58,.24,.03,.14,'#f2c96e');}
}
export function drawVillage3D(r,world,time,light,visibleUnits){const s=new MeshScene(r),W=r.data.world.width,H=r.data.world.height;
 // Phase 2/3/4 — one resolved sky per frame: mesh shading follows the clock,
 // and the static geometry cache below stays light-agnostic (clock is not a key).
 s.light=light||skyLightAt(world.elapsed,r.data,{calm:r.calm});
 // Large settlements keep outfit/weapon silhouettes but omit tiny face/trim meshes.
 s.characterDetail=world.troops.length+world.enemies.length<=64;
 // Dense phone overviews retain silhouettes while coarsening only coplanar
 // occlusion subdivisions. Close-up mechanisms/outfits stay unchanged.
 s.subdivision=r.width<600&&world.troops.length+world.enemies.length>=96&&r.cam.zoom<1.6?.8:.4;
 s.dynamicDoors=true;
  // Project static meshes only when the camera, footprint, building state or
  // visible defense/production stage changes; moving gates quantize to four
  // steps and traps key only their armed state, never every cooldown tick.
  // G1 scorched-ridge varies scenery geometry by theme/seed, so the key
  // carries both (expedition-only; home mesh unchanged).
  let scorchedFlag=0;try{scorchedFlag=isScorchedRidge(world,r.data)?1:0;}catch{scorchedFlag=0;}
  const key=JSON.stringify([r.width,r.height,r.cx,r.cy,r.cam,W,H,s.subdivision,r.claimedTileCount??-1,roadRevision(world),world.wave||0,(world.clearedCamps||[]).join(','),world.biomeSeed??-1,Array.isArray(world.tiles)?world.tiles.length:-1,scorchedFlag,world.buildings.map(b=>{const spec=r.data.buildings[b.type];return [b.id,b.type,b.x,b.y,b.level,b.hp<=0,b.remaining>0,productionStage(b,spec),spec?.production&&reserveReady(b,spec)?1:0,b.type==='gate'?gateLiftStage(r,b,world,time):0,b.type.includes('trap')?(trapArmed(b)?1:0):0];})]);
  if(r._meshStatic?.world===world&&r._meshStatic.key===key){s.faces=r._meshStatic.faces.slice();s.sources=r._meshStatic.sources;s.chimneys=r._meshStatic.chimneys;s.doors=r._meshStatic.doors||[];}else{
 // Border trees share depth sorting with the village, including reverse views.
 for(let i=-1;i<W+2;i++){s.owner=null;if(i%2)pine(s,i,-1.5,1.4+(i%3)*.22);if(i%3===0)pine(s,-1.5,((i%H)+H)%H,1.5);if(i%3===1)pine(s,W+1,i%H,1.6);if(i%4===0)pine(s,i,H+3,1.5);}
  addRoadGeometry(s,world);
  addEnvironmentScenery(s,world,r.data);
  for(const b of world.buildings)buildingModel(s,b,r.data.buildings[b.type],world,time);
 prepareSourceLighting(s);
 prepareNearbyLight(s,world);
 s.faces.sort((a,b)=>a.depth-b.depth);
 r._meshStatic={world,key,faces:s.faces.slice(),sources:s.sources,chimneys:s.chimneys,doors:s.doors};
 }

 // Trail growth rebuilds only its sparse ground layer, rather than every
 // roof, window and prop in a mature settlement. Source wash stays shared.
 const trailKey=key+'|'+trailRevision(world);
 if(r._trailStatic?.world!==world||r._trailStatic.key!==trailKey){const ground=new MeshScene(r);ground.light=s.light;ground.sources=s.sources;addTrailGeometry(ground,world);prepareSourceLighting(ground);prepareNearbyLight(ground,world);ground.faces.sort((a,b)=>a.depth-b.depth);r._trailStatic={world,key:trailKey,faces:ground.faces};}
 for(const face of r._trailStatic.faces)s.faces.push(face);

  r.sceneSources=s.sources; // Publish this frame before spill/bloom can return early.
  r._motionWorld=world;
  addLivingMechanisms(s,world,time);
  addWindLife(s,world,time);addLogisticsMeshes(s,world);
  for(const u of visibleUnits??world.troops)if(visibleUnits||(!isSheltered(world,r.data,u)&&!insideWorkplace(world,r.data,u)))characterModel(s,u,r.data,time);for(const e of world.enemies)characterModel(s,e,r.data,time,true);
  if(r.placing&&r.hover){const source=world.buildings.find(b=>b.id===r.moving),ghosts=placementCells(r).map(p=>({type:r.placing,...p,level:source?.level||1,hp:1,remaining:1,id:null})),preview={buildings:[...world.buildings.filter(b=>b.id!==r.moving),...ghosts]};for(const b of ghosts)buildingModel(s,b,r.data.buildings[b.type],preview,time);}
 drawCelestialShadows(s);
 drawGroundMist(s,time);
 drawSourceSpill(s,time);
 s.paint();
 drawPracticalBloom(s,time);
 drawChimneyWisps(s,time);
 drawCelestialAir(r,s.light);
 drawGodRays(r,s.light,time);
 drawBuildingActivity(r,world,time);drawLogisticsOverlay(r,world);
}
