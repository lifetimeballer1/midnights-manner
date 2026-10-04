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
// Longhouse recipe (housing art direction: green roof, white infill, timber
// gables): one saturated roof plane, warm-white plaster infill, dark timber
// edges and a stone base course. Longhouse-only; other types keep their own.
const LH_PLASTER='#eee7d6',LH_FRAME='#725039',LH_ROOF='#3f8a4a',LH_STONE='#b4beb2';
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
function tower(s,x,y,size,h,color=stone,level=1){const plaster='#eee7d6',frame='#725039',specStone='#9ca29a';s.box(x,y,.12,size,size,h,color);if(level>1&&color!==timber){s.box(x,y,h*.65,size,size,h*.35,plaster);for(const dx of[0,size-.08])for(const dy of[0,size-.08])s.box(x+dx,y+dy,.12,.08,.08,h,frame);}s.box(x-.08,y-.08,h+.1,size+.16,size+.16,.16,color);for(const [dx,dy]of[[0,0],[size-.16,0],[0,size-.16],[size-.16,size-.16]])s.box(x+dx-.025,y+dy-.025,h+.26,.21,.21,.23,level>=4?specStone:color);s.box(x+size*.38,y+size+.006,h*.48,size*.2,.012,.27,'#324a41');s.box(x+size+.006,y+size*.38,h*.48,.012,size*.2,.27,'#324a41');}
// Moon dial: a pale emissive plate, a three-sided needle and three phase pips.
// The plate and pips are flat and horizontal, so they survive every orbit
// angle and carry the dial once the sky clock dims. The needle drops from the
// old four-sided cone to a sharper three-sided one, which pays for the plate.
function moonDial(s,x,y){
 const z=.352;
 s.emissive=1;s.face(Array.from({length:8},(_,i)=>[x+Math.cos(i*Math.PI/4)*.16,y+Math.sin(i*Math.PI/4)*.16,z]),'#d8e3f2',false);s.emissive=0;
 s.pyramid(x,y,.35,.115,.55,gold,3);
 for(const a of[0,2.0944,4.1888]){s.emissive=1;s.face(Array.from({length:3},(_,i)=>[x+Math.cos(a)*.132+Math.cos(a+i*2*Math.PI/3)*.02,y+Math.sin(a)*.132+Math.sin(a+i*2*Math.PI/3)*.02,z+.008]),'#f4f7ff',false);s.emissive=0;}
}
// Cairnfield marker: one tall pale slab with a carved band where the fallen are
// cut, set on the central cairn. Faces are unsplit on purpose — the slab is the
// only vertical in the field, so its outline carries the silhouette on its own.
function cairnSlab(s,cx,cy){
  const z=.352,top=z+.93,hw=.13,hd=.05,pale='#c3c7b7';
  s.face([[cx+hw,cy+hd,z],[cx+hw,cy+hd,top],[cx+hw,cy-hd,top],[cx+hw,cy-hd,z]],pale,false);
  s.face([[cx-hw,cy+hd,z],[cx-hw,cy+hd,top],[cx+hw,cy+hd,top],[cx+hw,cy+hd,z]],pale,false);
  s.face([[cx-hw,cy-hd,top],[cx+hw,cy-hd,top],[cx+hw,cy+hd,top],[cx-hw,cy+hd,top]],pale,false);
  s.face([[cx-hw,cy+hd+.004,z+.34],[cx-hw,cy+hd+.004,z+.5],[cx+hw,cy+hd+.004,z+.5],[cx+hw,cy+hd+.004,z+.34]],'#5f6a63',false);
}
// Flat pebble circles laid around each cairn base, and the votive dot the living
// leave at the marker's foot — emissive, so it only reads once the sky clock dims.
function cairnRings(s,x,y,spots){
  const z=.352;
  for(const [a,c]of spots)s.face(Array.from({length:8},(_,i)=>[x+a+Math.cos(i*Math.PI/4)*.3,y+c+Math.sin(i*Math.PI/4)*.3,z]),'#cbd1c3',false);
  s.emissive=1;s.face([[x+.44,y+.7,z+.004],[x+.56,y+.7,z+.004],[x+.56,y+.78,z+.004],[x+.44,y+.78,z+.004]],'#ffd98a',false);s.emissive=0;
}
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
function hut(s,x,y,w,d,h,roofColor,level,chimney=true,materials={}){
  // Material grammar: warm plaster infill over dark timber frame. The frame
  // stays timber at every tier — gold is one small door accent, never a skin.
  const rise=.35+level*.08,plaster='#eee7d6',frame=materials.frame||'#725039';
  // Recess the walls beneath the eaves and omit their hidden top plane.
  s.box(x,y,.1,w,d,h-.1,level===1?timber:(materials.wall||plaster),false);
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
  const x=b.x,y=b.y,h=.62,rise=.51,stone=LH_STONE;
  const bx=x+.58,by=y+.32,bw=n-1.15,bd=n-.64;
  hut(s,bx,by,bw,bd,h,LH_ROOF,2,false,{wall:LH_PLASTER,frame:LH_FRAME});
  // Stone base course: four unsplit quads standing slightly proud of the
  // plaster, so the hall meets the dirt on masonry instead of paint.
  const o=.035,zt=.1,zc=.24;
  for(const yy of [by-o,by+bd+o]){const v=[[bx-o,yy,zt],[bx+bw+o,yy,zt],[bx+bw+o,yy,zc],[bx-o,yy,zc]];s.face(yy>by?v.reverse():v,stone,false);}
  for(const xx of [bx-o,bx+bw+o]){const v=[[xx,by-o,zt],[xx,by-o,zc],[xx,by+bd+o,zc],[xx,by+bd+o,zt]];s.face(xx>bx?v.reverse():v,stone,false);}
  // Ridge beam down the long axis ties the big roof together.
  const rx=x+.58+(n-1.15)/2;
  s.box(rx-.038,y+.34,h+.1+rise,.076,n-.68,.06,LH_FRAME);
  // Twin stacks at both ends of the ridge: one would read cottage, two read hall.
  for(const cy of [y+.72,y+n-.82]){s.box(rx-.08,cy,h+.1,.16,.16,rise+.42,stone);s.box(rx-.11,cy-.03,h+.1+rise+.42,.22,.22,.06,'#786d5b');s.chimneys.push({owner:s.owner,position:[rx,cy+.08,h+.1+rise+.48]});}
  // Banner over the door, then the veranda rail across the front gable.
  s.box(x+n*.5,y+n-.14,.1,.055,.055,.85,LH_FRAME);s.box(x+n*.5+.05,y+n-.14,.62,.2,.025,.32,'#5e8c9b');
  for(let i=0;i<4;i++)s.box(x+.62+i*(n-1.2)/3,y+n-.16,.1,.05,.05,.4,LH_FRAME);
  s.roof(x+.55,y+n-.66,.48,n-1.15,.6,.17,LH_ROOF);
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
 const x=b.x+.22,y=b.y+.22,w=n-.44,h=.42+l*.16,band=famBand(l),roof=['#327eaf','#3686b8','#307fb2','#3488bb','#2e82b6','#328bbe'];
 // Hall-only materials preserve the shared families and civic tier massing.
 const z=l===1?.2:.1,plaster='#eee7d6',frame='#725039',base='#9ca29a';
 famQuad(s,[[x,y+w,z],[x,y+w,h],[x+w,y+w,h],[x+w,y+w,z]],plaster);
 famQuad(s,[[x,y,z],[x+w,y,z],[x+w,y,h],[x,y,h]],plaster);
 famQuad(s,[[x+w,y,z],[x+w,y+w,z],[x+w,y+w,h],[x+w,y,h]],plaster);
 famQuad(s,[[x,y,z],[x,y,h],[x,y+w,h],[x,y+w,z]],plaster);
 if(l===1){
  famQuad(s,[[x,y+w,.1],[x,y+w,z],[x+w,y+w,z],[x+w,y+w,.1]],base);
  famQuad(s,[[x,y,.1],[x+w,y,.1],[x+w,y,z],[x,y,z]],base);
  famQuad(s,[[x+w,y,.1],[x+w,y+w,.1],[x+w,y+w,z],[x+w,y,z]],base);
  famQuad(s,[[x,y,.1],[x,y,z],[x,y+w,z],[x,y+w,.1]],base);
 }
 for(const [dx,dy] of [[0,0],[w-.08,0],[0,w-.08],[w-.08,w-.08]])s.box(x+dx-.012,y+dy-.012,.1,.09,.09,h,frame);
 if(l===1)s.box(x-.025,y-.025,h-.09,w+.05,.05,.06,frame);
 if(l>=2)s.box(x-.035,y-.035,.1,w+.07,w+.07,.15,base);
 if(l===2)for(const f of [.3,.55,.8]){s.box(x+w*f,y+w-.005,.15,.032,.025,h*.72,frame);s.box(x+w-.005,y+w*f,.15,.025,.032,h*.72,frame);}
 if(l>=3)s.box(x-.05,y-.05,.1,w+.1,w+.1,.26,base);
 if(l>=5)for(const dx of [.04,w-.12])famBrace(s,x+dx,y+w+.005,.22,h*.6,.1,'x');
 if(l>=6){s.box(x-.04,y-.04,h*.62,w+.08,.05,.05,frame);s.box(x-.04,y+w-.01,h*.62,w+.08,.05,.05,frame);}
 famRoof(s,x,y,h,w,w,band,roof[Math.min(l,6)-1],.4+l*.05);
 famPanes(s,x,y,w,w,h,4);
 famEntrance(s,x+w*.3,y+w,w*.32,h,l,true);
 famStack(s,x+w-.3,y+.16,h+.04,.18,.18,.7+l*.06);
 if(l>=3)tower(s,x+.04,y+.04,.5,1.2+l*.12,base);
 if(l>=4)for(const dx of [.3,.7])s.box(x+w*dx-.08,y+w+.02,h*.88,.16,.03,.26,dx<.5?'#ad6155':'#5e8c9b');
 if(l>=5){s.box(x-.16,y+.3,.1,.28,w*.6,h*.88,plaster);s.roof(x-.2,y+.26,h*.88,.36,w*.68,.14,roof[Math.min(l,6)-1]);lanternPost(s,x+w+.04,y+w-.22,.64,.95,.42);}
 if(l>=6){s.box(x+w*.3-.02,y+w+.01,h*1.02,.08,.08,.08,gold);s.box(x+w*.7-.02,y+w+.01,h*1.02,.08,.08,.08,gold);}
 if(l===4||l===5)famMesh(s,'stairs-stone',x+w*.32,y+w+.03,.1);
}
function cottageFamily(s,b,n,l){
 const x=b.x+.22,y=b.y+.22,w=n-.44,h=.42+l*.16,band=famBand(l),roof=['#448b58','#48935c','#428e57','#46965b','#40915a','#44995e'];
 // Cottage-only materials keep the other families on their authored palettes.
 const z=l===1?.2:.1,plaster='#eee7d6',frame='#725039',base='#9ca29a';
 famQuad(s,[[x,y+w,z],[x,y+w,h],[x+w,y+w,h],[x+w,y+w,z]],plaster);
 famQuad(s,[[x,y,z],[x+w,y,z],[x+w,y,h],[x,y,h]],plaster);
 famQuad(s,[[x+w,y,z],[x+w,y+w,z],[x+w,y+w,h],[x+w,y,h]],plaster);
 famQuad(s,[[x,y,z],[x,y,h],[x,y+w,h],[x,y+w,z]],plaster);
 if(l===1){
  famQuad(s,[[x,y+w,.1],[x,y+w,z],[x+w,y+w,z],[x+w,y+w,.1]],base);
  famQuad(s,[[x,y,.1],[x+w,y,.1],[x+w,y,z],[x,y,z]],base);
  famQuad(s,[[x+w,y,.1],[x+w,y+w,.1],[x+w,y+w,z],[x+w,y,z]],base);
  famQuad(s,[[x,y,.1],[x,y,z],[x,y+w,z],[x,y+w,.1]],base);
 }
 for(const [dx,dy] of [[0,0],[w-.08,0],[0,w-.08],[w-.08,w-.08]])s.box(x+dx-.012,y+dy-.012,.1,.09,.09,h,frame);
 if(l===1)s.box(x-.025,y-.025,h-.09,w+.05,.05,.06,frame);
 if(l>=2)s.box(x-.035,y-.035,.1,w+.07,w+.07,.15,base);
 if(l===2)for(const f of [.3,.55,.8]){s.box(x+w*f,y+w-.005,.15,.032,.025,h*.72,frame);s.box(x+w-.005,y+w*f,.15,.025,.032,h*.72,frame);}
 if(l>=3)s.box(x-.05,y-.05,.1,w+.1,w+.1,.26,base);
 if(l>=5)for(const dx of [.04,w-.12])famBrace(s,x+dx,y+w+.005,.22,h*.6,.1,'x');
 if(l>=6){s.box(x-.04,y-.04,h*.62,w+.08,.05,.05,frame);s.box(x-.04,y+w-.01,h*.62,w+.08,.05,.05,frame);}
 famRoof(s,x,y,h,w,w,band,roof[Math.min(l,6)-1],.36+l*.06);
 famPanes(s,x,y,w,w,h,8);
 famEntrance(s,x+w*.3,y+w,w*.32,h,l,false);
 famStack(s,x+w-.28,y+.18,h+.04,.15,.15,.6+l*.05);
 homeDetails(s,b,n,l);
 if(l===4||l===5)famMesh(s,'shutters',x+w*.3,y+w+.02,h*.6);
 if(l===5)famMesh(s,'roof-window',x+w*.45,y+w*.42,h+.02);
 if(l===6)famMesh(s,'town-lantern',x-.12,y+w-.42,.1);
}
function barracksFamily(s,b,n,l){
 const x=b.x+.22,y=b.y+.22,w=n-.44,h=.42+l*.16,band=famBand(l),roof=['#b93729','#c13d2d','#b93628','#c43e2d','#bb3526','#c53b29'][Math.min(l,6)-1];
 const plaster='#eee7d6',frame='#493021',base='#9ca29a',z=l===1?.28:.1,rise=.42+l*.06;
 famQuad(s,[[x,y+w,z],[x,y+w,h],[x+w,y+w,h],[x+w,y+w,z]],plaster);
 famQuad(s,[[x,y,z],[x+w,y,z],[x+w,y,h],[x,y,h]],plaster);
 famQuad(s,[[x+w,y,z],[x+w,y+w,z],[x+w,y+w,h],[x+w,y,h]],plaster);
 famQuad(s,[[x,y,z],[x,y,h],[x,y+w,h],[x,y+w,z]],plaster);
 if(l===1){
  famQuad(s,[[x,y+w,.1],[x,y+w,z],[x+w,y+w,z],[x+w,y+w,.1]],base);
  famQuad(s,[[x,y,.1],[x+w,y,.1],[x+w,y,z],[x,y,z]],base);
  famQuad(s,[[x+w,y,.1],[x+w,y+w,.1],[x+w,y+w,z],[x+w,y,z]],base);
  famQuad(s,[[x,y,.1],[x,y,z],[x,y+w,z],[x,y+w,.1]],base);
 }
 for(const [dx,dy] of [[0,0],[w-.08,0],[0,w-.08],[w-.08,w-.08]])s.box(x+dx-.012,y+dy-.012,.1,.09,.09,h,frame);
 if(l===1)s.box(x-.025,y-.025,h-.09,w+.05,.05,.06,frame);
 if(l>=2)s.box(x-.035,y-.035,.1,w+.07,w+.07,.23+l*.025,base);
 if(l===2)for(const f of [.3,.55,.8]){s.box(x+w*f,y+w-.005,.15,.075,.025,h*.72,frame);s.box(x+w-.005,y+w*f,.15,.025,.075,h*.72,frame);}
 if(l>=3)s.box(x-.05,y-.05,.1,w+.1,w+.1,.28+l*.025,base);
 // Broad flat bay posts and eaves keep the military frame readable without beam boxes.
 const a=w*.24,bay=.09;
 famQuad(s,[[x+a,y+w+.006,.25],[x+a,y+w+.006,h],[x+a+bay,y+w+.006,h],[x+a+bay,y+w+.006,.25]],frame);
 famQuad(s,[[x+a,y-.006,.25],[x+a+bay,y-.006,.25],[x+a+bay,y-.006,h],[x+a,y-.006,h]],frame);
 famQuad(s,[[x+w+.006,y+a,.25],[x+w+.006,y+a+bay,.25],[x+w+.006,y+a+bay,h],[x+w+.006,y+a,h]],frame);
 famQuad(s,[[x-.006,y+a,.25],[x-.006,y+a,h],[x-.006,y+a+bay,h],[x-.006,y+a+bay,.25]],frame);
 for(const yy of [y-.009,y+w+.009])famBrace(s,x+w*.68,yy,.29,Math.min(w*.24,h-.3),.065,'x');
 for(const xx of [x-.009,x+w+.009]){
  const yy=y+w*.68,len=Math.min(w*.24,h-.3),v=[[xx,yy,.29],[xx,yy+len,.29+len],[xx,yy+len,.225+len],[xx,yy,.225]];
  famQuad(s,xx>x?v.reverse():v,frame);
 }
 if(l>=5)for(const dx of [.04,w-.12])famBrace(s,x+dx,y+w+.005,.22,h*.6,.1,'x');
 if(l>=6){s.box(x-.04,y-.04,h*.62,w+.08,.05,.05,frame);s.box(x-.04,y+w-.01,h*.62,w+.08,.05,.05,frame);}
 if(band===0){famGable(s,x-.05,y-.05,h,w+.1,w+.1,rise,roof);s.box(x+w/2-.03,y-.08,h+rise-.03,.06,w+.16,.05,frame);}
 else if(band===1){famHip(s,x-.06,y-.06,h,w+.12,w+.12,rise,roof);s.box(x+w*.42,y+w*.4,h+rise-.14,.24,.24,.16,plaster);famGable(s,x+w*.38,y+w*.4,h+rise-.05,.32,.24,.12,roof);s.box(x+w/2-.035,y-.09,h+rise-.03,.07,w+.18,.05,frame);}
 else{famGable(s,x-.07,y-.07,h,w+.14,w+.14,rise,roof);famGable(s,x+w*.14,y+w*.08,h+rise*.48,w*.72,w*.82,rise*.55,roof);s.box(x+w/2-.03,y-.1,h+rise-.03,.06,w+.2,.05,frame);}
 const e=.075+band*.01;
 // Notched stone eaves reuse the four fascia faces instead of adding merlon boxes.
 for(const yy of [y-e,y+w+e]){
  const v=[[x-e,yy,h-.085],[x+w+e,yy,h-.085],[x+w+e,yy,h]];
  if(l>=4)for(let i=3;i>=0;i--){const px=x+w*i/4;v.push([px+w*.18,yy,h],[px+w*.18,yy,h+.045+(l-4)*.025],[px,yy,h+.045+(l-4)*.025],[px,yy,h]);}
  v.push([x-e,yy,h]);famQuad(s,yy>y?v.reverse():v,l>=4?base:frame);
 }
 for(const xx of [x-e,x+w+e]){
  const v=[[xx,y-e,h-.085],[xx,y-e,h]];
  if(l>=4)for(let i=0;i<4;i++){const py=y+w*i/4;v.push([xx,py,h],[xx,py,h+.045+(l-4)*.025],[xx,py+w*.18,h+.045+(l-4)*.025],[xx,py+w*.18,h]);}
  v.push([xx,y+w+e,h],[xx,y+w+e,h-.085]);famQuad(s,xx>x?v.reverse():v,l>=4?base:frame);
 }
 const bias=s.depthBias;s.depthBias+=.12;
 const slit=.055,pz=h*.54,pc=x+w*.42+.09,qc=y+w*.42+.09;
 for(const [v,position,direction] of [
  [[[pc-slit/2,y+w+.012,pz],[pc+slit/2,y+w+.012,pz],[pc+slit/2,y+w+.012,pz+.19],[pc-slit/2,y+w+.012,pz+.19]],[pc,y+w+.05,pz+.095],[0,1]],
  [[[pc-slit/2,y-.012,pz],[pc-slit/2,y-.012,pz+.19],[pc+slit/2,y-.012,pz+.19],[pc+slit/2,y-.012,pz]],[pc,y-.05,pz+.095],[0,-1]],
  [[[x-.012,qc-slit/2,pz],[x-.012,qc+slit/2,pz],[x-.012,qc+slit/2,pz+.19],[x-.012,qc-slit/2,pz+.19]],[x-.05,qc,pz+.095],[-1,0]],
  [[[x+w+.012,qc-slit/2,pz],[x+w+.012,qc-slit/2,pz+.19],[x+w+.012,qc+slit/2,pz+.19],[x+w+.012,qc+slit/2,pz]],[x+w+.05,qc,pz+.095],[1,0]]
 ]){s.emissive=1;famQuad(s,v.reverse(),'#ffe6ab');s.source(position,direction,1.25,.7,'window');}
 s.emissive=0;
 const gateX=x+w*.3,gateY=y+w+.045,gateW=w*.34,gateH=h-.13+l*.015;
 for(let i=0;i<2;i++){
  const dx=gateX+i*gateW/2+.012,dw=gateW/2-.024;
  famQuad(s,[[dx,gateY,.1],[dx,gateY,gateH],[dx+dw,gateY,gateH],[dx+dw,gateY,.1]],frame);
  for(const f of [.28,.72])famQuad(s,[[dx,gateY+.003,.1+(gateH-.1)*f],[dx+dw,gateY+.003,.1+(gateH-.1)*f],[dx+dw,gateY+.003,.15+(gateH-.1)*f],[dx,gateY+.003,.15+(gateH-.1)*f]].reverse(),'#626b70');
 }
 for(const dx of [gateX-.06,gateX+gateW])famQuad(s,[[dx,gateY,.1],[dx+.06,gateY,.1],[dx+.06,gateY,gateH+.07],[dx,gateY,gateH+.07]].reverse(),l>=3?base:frame);
 famQuad(s,[[gateX-.06,gateY,gateH],[gateX+gateW+.06,gateY,gateH],[gateX+gateW+.06,gateY,gateH+.07],[gateX-.06,gateY,gateH+.07]].reverse(),base);
 const sx=gateX+gateW/2,sz=gateH-.24;
 s.depthBias+=.2;
 famQuad(s,[[sx-.13,gateY+.005,sz+.2],[sx+.13,gateY+.005,sz+.2],[sx+.11,gateY+.005,sz+.06],[sx,gateY+.005,sz],[sx-.11,gateY+.005,sz+.06]],'#626b70');
 s.depthBias+=.025;
 famQuad(s,[[sx-.025,gateY+.008,sz+.17],[sx+.025,gateY+.008,sz+.17],[sx+.025,gateY+.008,sz+.06],[sx,gateY+.008,sz+.035],[sx-.025,gateY+.008,sz+.06]],gold);
 s.depthBias-=.225;
 const steps=l>=5?3:l>=3?2:1;
 for(let i=0;i<steps;i++)s.box(gateX-.05-i*.05,y+w+.04+i*.08,.1-i*.025,gateW+.1+i*.1,.11,.09,base);
 s.depthBias=bias;
 const rackY=y+w+.09,rackX=x+.05;
 for(const dx of [0,.27])famQuad(s,[[rackX+dx,rackY,.12],[rackX+dx,rackY,.52],[rackX+dx+.045,rackY,.52],[rackX+dx+.045,rackY,.12]],frame);
 famQuad(s,[[rackX,rackY+.003,.4],[rackX,rackY+.003,.46],[rackX+.315,rackY+.003,.46],[rackX+.315,rackY+.003,.4]],frame);
 for(const dx of [.09,.2]){
  famQuad(s,[[rackX+dx,rackY+.009,.16],[rackX+dx,rackY+.009,.56],[rackX+dx+.025,rackY+.009,.56],[rackX+dx+.025,rackY+.009,.16]],'#936747');
  famQuad(s,[[rackX+dx-.025,rackY+.009,.54],[rackX+dx+.0125,rackY+.009,.65],[rackX+dx+.05,rackY+.009,.54]],'#626b70');
 }
 famStack(s,x+w-.3,y+.16,h+.04,.16,.16,.66+l*.05);
 if(l>=3)tower(s,x+w-.66,y+.04,.46,1.05+l*.1,base);
 if(l>=4){s.box(x+w*.5-.03,y+w+.02,h*1.0,.06,.06,.58,frame);s.box(x+w*.5+.03,y+w+.02,h*1.0,.24,.02,.15,roof);}
 if(l>=5)famBrace(s,x+.24,y+w+.005,.22,h*.58,.1,'x');
 if(l>=6)s.box(x-.02,y-.02,h*.64,w+.04,.05,.05,'#6a6f65');
 if(l===5)famMesh(s,'torch-metal',x+w+.06,y+w*.5-.12,h*.5);
 if(l===4)famMesh(s,'wood-door',x-.08,y+w*.5-.4,.12);
}
function farmFamily(s,b,n,l){
 const x=b.x,y=b.y,band=famBand(l),roof=['#448b58','#48935c','#428e57','#46965b','#40915a','#44995e'][Math.min(l,6)-1],bw=1.28,bd=.82,bh=.4+l*.11,bx=x+.24,by=y+.24;
 const plaster='#eee7d6',frame='#725039',stone='#bcc0ad',rise=.28+l*.035;
  // Tier 6 reuses the ground slab; buried soil, footings and props add no silhouette.
  if(l!==6)s.box(x+.12,y+.12,.12,n-.24,n-.24,.07,'#b27a50');
 // Broad low barn and chunky exposed edging keep the field readable at night.
 for(let i=0;i<4;i++){
  const a=x+.12+i*(n-.24)/4,c=y+.12+i*(n-.24)/4,d=(n-.24)/4-.024,color=i%2?stone:'#d2c8ad';
  famQuad(s,[[a,y+n-.24,.25],[a+d,y+n-.24,.25],[a+d,y+n-.12,.25],[a,y+n-.12,.25]],color);
  famQuad(s,[[a,y+n-.12,.12],[a,y+n-.12,.25],[a+d,y+n-.12,.25],[a+d,y+n-.12,.12]],color);
  famQuad(s,[[x+n-.24,c,.25],[x+n-.12,c,.25],[x+n-.12,c+d,.25],[x+n-.24,c+d,.25]],color);
  famQuad(s,[[x+n-.12,c,.12],[x+n-.12,c+d,.12],[x+n-.12,c+d,.25],[x+n-.12,c,.25]],color);
 }
 if(l>=2){for(const dx of [.3,.95,1.6])s.box(x+dx,y+1.72,.12,.09,.09,.4,'#ce9b67');s.box(x+.3,y+1.73,.34,1.37,.07,.09,'#ce9b67');}
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){const px=x+.32+i*.53,py=y+1.16+j*.22;if(l!==6)s.box(px,py,.19,.06,.06,.15+l*.03,'#94aa63');s.pyramid(px,py,.29,.095,.15,'#e1c776',4);}
 famQuad(s,[[bx,by+bd,.1],[bx,by+bd,bh],[bx+bw,by+bd,bh],[bx+bw,by+bd,.1]],plaster);
 famQuad(s,[[bx,by,.1],[bx+bw,by,.1],[bx+bw,by,bh],[bx,by,bh]],plaster);
 famQuad(s,[[bx+bw,by,.1],[bx+bw,by+bd,.1],[bx+bw,by+bd,bh],[bx+bw,by,bh]],plaster);
 famQuad(s,[[bx,by,.1],[bx,by,bh],[bx,by+bd,bh],[bx,by+bd,.1]],plaster);
  for(const [dx,dy] of [[0,0],[bw-.08,0],[0,bd-.08],[bw-.08,bd-.08]]){
   if(l!==6)s.box(bx+dx-.012,by+dy-.012,.1,.09,.09,bh,frame);
   else{
    const xx=dx?bx+bw+.006:bx-.006,yy=dy?by+bd+.006:by-.006;
    const a=[[bx+dx,yy,.1],[bx+dx,yy,bh],[bx+dx+.08,yy,bh],[bx+dx+.08,yy,.1]];
    const c=[[xx,by+dy,.1],[xx,by+dy+.08,.1],[xx,by+dy+.08,bh],[xx,by+dy,bh]];
    famQuad(s,dy?a:a.reverse(),frame);famQuad(s,dx?c:c.reverse(),frame);
   }
  }
 if(l===1)s.box(bx-.025,by-.025,bh-.09,bw+.05,.05,.06,frame);
  if(l>=2&&l!==6)s.box(bx-.035,by-.035,.1,bw+.07,bd+.07,.15,stone);
 if(l===2)for(const f of [.3,.55,.8]){s.box(bx+bw*f,by+bd-.005,.15,.045,.025,bh*.72,frame);s.box(bx+bw-.005,by+bd*f,.15,.025,.045,bh*.72,frame);}
  if(l>=3)s.box(bx-.05,by-.05,.1,bw+.1,bd+.1,.26,stone,l!==6);
 if(l>=5)for(const dx of [.04,bw-.12])famBrace(s,bx+dx,by+bd+.005,.22,bh*.6,.1,'x');
  if(l>6){s.box(bx-.04,by-.04,bh*.62,bw+.08,.05,.05,frame);s.box(bx-.04,by+bd-.01,bh*.62,bw+.08,.05,.05,frame);}
 if(band===0){famGable(s,bx-.05,by-.05,bh,bw+.1,bd+.1,rise,roof);s.box(bx+bw/2-.03,by-.08,bh+rise-.03,.06,bd+.16,.05,frame);}
 else if(band===1){famHip(s,bx-.06,by-.06,bh,bw+.12,bd+.12,rise,roof);s.box(bx+bw*.42,by+bd*.4,bh+rise-.14,.24,.24,.16,plaster);famGable(s,bx+bw*.38,by+bd*.4,bh+rise-.05,.32,.24,.12,roof);s.box(bx+bw/2-.035,by-.09,bh+rise-.03,.07,bd+.18,.05,frame);}
  else{famGable(s,bx-.07,by-.07,bh,bw+.14,bd+.14,rise,roof);if(l!==6)famGable(s,bx+bw*.14,by+bd*.08,bh+rise*.48,bw*.72,bd*.82,rise*.55,roof);s.box(bx+bw/2-.03,by-.1,bh+rise-.03,.06,bd+.2,.05,frame);}
 const e=.05+band*.01;
 for(const yy of [by-e,by+bd+e]){const v=[[bx-e,yy,bh-.065],[bx+bw+e,yy,bh-.065],[bx+bw+e,yy,bh],[bx-e,yy,bh]];famQuad(s,yy>by?v.reverse():v,frame);}
 for(const xx of [bx-e,bx+bw+e]){const v=[[xx,by-e,bh-.065],[xx,by-e,bh],[xx,by+bd+e,bh],[xx,by+bd+e,bh-.065]];famQuad(s,xx>bx?v.reverse():v,frame);}
 famEntrance(s,bx+bw*.3,by+bd,bw*.34,bh,l,false);
 if(l===2)famMesh(s,'fence',x+.3,y+1.72,.12);
 if(l>=3){famPanes(s,bx,by,bw,bd,bh,4);famStack(s,bx+bw-.22,by+.12,bh+.04,.14,.14,.5);}
  if(l>=4&&l!==6){s.box(x+.5,y+.5,.13,.06,.06,.6,frame);s.box(x+.38,y+.5,.55,.3,.06,.06,frame);s.pyramid(x+.5,y+.5,.73,.12,.14,'#d5bf8f',6);}
  if(l>=5&&l!==6)s.box(x+.2,y+.2,.1,n-.4,.1,.06,'#4e9aaa');
 if(l===5)famMesh(s,'overhang',x+.24,y+n-.6,.5);
  if(l>=6){if(l!==6){s.box(x+n-.55,y+.15,.12,.3,.3,.4,plaster);s.roof(x+n-.6,y+.1,.52,.4,.4,.14,roof);}
   s.box(x+n-.68,y+.82,.12,.3,.3,.48+l*.03+(l===6?.25:0),stone);s.pyramid(x+n-.53,y+.97,.6+l*.03+(l===6?.25:0),.21,.18,roof,4);
   if(l===6){ // Mature-farm read: tall granary tower with a vertical windmill sail.
    const hub=x+n-.53,hubY=y+.97;
    s.box(hub-.03,hubY-.03,1.21,.06,.06,.25,'#725039');
    s.box(hub-.3,hubY-.02,1.2,.6,.04,.5,'#8a6a48');s.box(hub-.02,hubY-.3,1.2,.04,.6,.5,'#8a6a48');
    s.box(hub-.05,hubY-.05,1.42,.1,.1,.1,'#725039');
   }
   if(l!==6)s.box(x+n-.7,y+.8,.34,.05,.05,.16,'#6a6f65');}
  if(s.alpha===1&&l!==6){const fixture=s.fixture;s.fixture=true;
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
 const x=b.x,y=b.y,band=famBand(l),roof=['#edb735','#f3bf40','#edb12e'][band],plaster='#eee7d6',frame='#493021',base='#b9b9a8';
 for(const [a,c,color]of[[.22,.24,'#ed5940'],[n-1.1,.25,'#56b86a'],[.35,n-1.05,roof]]){
  // Unsplit counter faces fund merchandise and cloth panels instead of buried subdivisions.
  for(const yy of [y+c,y+c+.46]){const v=[[x+a,yy,.14],[x+a+.86,yy,.14],[x+a+.86,yy,.46],[x+a,yy,.46]];famQuad(s,yy>y+c?v.reverse():v,base);}
  for(const xx of [x+a,x+a+.86]){const v=[[xx,y+c,.14],[xx,y+c,.46],[xx,y+c+.46,.46],[xx,y+c+.46,.14]];famQuad(s,xx>x+a?v.reverse():v,base);}
  for(let i=0;i<3;i++){
   const px=x+a+i*.86/3,d=.86/3-.016;
   famQuad(s,[[px,y+c+.461,.14],[px,y+c+.461,.4],[px+d,y+c+.461,.4],[px+d,y+c+.461,.14]],i%2?'#9ca29a':'#d2cbb7');
  }
  for(const dx of [0,.775])s.box(x+a+dx,y+c,.14,.085,.085,.85,frame,false);
  for(const yy of [y+c-.12,y+c+.4]){const v=[[x+a-.06,yy,.855],[x+a+.94,yy,.855],[x+a+.94,yy,.9],[x+a-.06,yy,.9]];famQuad(s,yy>y+c?v.reverse():v,frame);}
  for(const xx of [x+a-.06,x+a+.94]){const v=[[xx,y+c-.12,.855],[xx,y+c-.12,.9],[xx,y+c+.4,.9],[xx,y+c+.4,.855]];famQuad(s,xx>x+a?v.reverse():v,frame);}
  famQuad(s,[[x+a,y+c,.515],[x+a+.86,y+c,.515],[x+a+.86,y+c+.46,.515],[x+a,y+c+.46,.515]],'#c68e50');
  famQuad(s,[[x+a,y+c+.462,.46],[x+a,y+c+.462,.515],[x+a+.86,y+c+.462,.515],[x+a+.86,y+c+.462,.46]],frame);
  const px=x+a+.04,py=y+c+.38;
  // Pull stock into the aisle; the shallow canopy leaves the display tops open.
  s.emissive=.55;
  for(const yy of [py,py+.34]){const v=[[px,yy,.515],[px+.78,yy,.515],[px+.78,yy,.62],[px,yy,.62]];famQuad(s,yy>py?v.reverse():v,'#b47c40');}
  for(const xx of [px,px+.78]){const v=[[xx,py,.515],[xx,py,.62],[xx,py+.34,.62],[xx,py+.34,.515]];famQuad(s,xx>px?v.reverse():v,'#d7a25b');}
  for(let i=0;i<3;i++)s.pyramid(x+a+.17+i*.26,y+c+.58,.61,.2,.23,['#b1d94b','#f36a3e','#ffce52'][i],4);
  for(let i=0;i<2;i++)s.box(x+a+.72-i*.025,y+c+.66,.14+i*.22,.21,.26,.21,i?'#d7a25b':'#b47c40',false);
  for(const dx of [.15,.72]){
   const v=[[x+a+dx-.055,y+c+.405,.855],[x+a+dx+.055,y+c+.405,.855],[x+a+dx+.095,y+c+.405,.71],[x+a+dx,y+c+.405,.63],[x+a+dx-.095,y+c+.405,.71]];
   famQuad(s,v,dx<.5?'#edb56a':'#e57a4d');famQuad(s,[...v].reverse(),dx<.5?'#edb56a':'#e57a4d');
  }
  s.emissive=0;
  const ax=x+a-.06,ay=y+c-.12,rise=band===0?.12:band===1?.15:.18;
  for(let i=0;i<4;i++){
   const t=i/4,u=(i+1)/4,cloth=i%2?'#fff1cc':color;
   if(band===1){
    for(const side of [0,1]){
      const ey=ay+side*.52,ry=ay+.26,left=q=>[ax+.39*q,ey+(ry-ey)*q,.9+rise*q],right=q=>[ax+1-.39*q,ey+(ry-ey)*q,.9+rise*q];
     const v=[left(t),right(t),right(u),left(u)];famQuad(s,side?v.reverse():v,cloth);
    }
   }else for(const side of [0,1]){
     const ex=ax+side,rx=ax+.5,v=[[ex,ay+t*.52,.9],[rx,ay+t*.52,.9+rise],[rx,ay+u*.52,.9+rise],[ex,ay+u*.52,.9]];famQuad(s,side?v.reverse():v,cloth);
   }
  }
  if(band===1){famQuad(s,[[ax+1,ay,.9],[ax+1,ay+.52,.9],[ax+.61,ay+.26,.9+rise]],color);famQuad(s,[[ax,ay+.52,.9],[ax,ay,.9],[ax+.39,ay+.26,.9+rise]],color);}
  else{famQuad(s,[[ax,ay,.9],[ax+1,ay,.9],[ax+.5,ay,.9+rise]],color);famQuad(s,[[ax,ay+.52,.9],[ax+.5,ay+.52,.9+rise],[ax+1,ay+.52,.9]],color);}
  if(band===2)famGable(s,x+a+.1,y+c+.06,1.02,.62,.34,.13,roof);
  s.emissive=1;
  const lamp=[[x+a+.06,y+c+.6,.7],[x+a+.14,y+c+.6,.7],[x+a+.14,y+c+.6,.8],[x+a+.06,y+c+.6,.8]];
  famQuad(s,lamp,'#ffd58b');famQuad(s,[...lamp].reverse(),'#ffd58b');s.emissive=0;
  s.source([x+a+.1,y+c+.6,.75],[0,1],1.15,.85,'lantern');
 }
 const hx=x+n*.46,hy=y+n*.46,hw=n*.34,hh=.42+l*.13;
 famQuad(s,[[hx,hy+hw,.1],[hx,hy+hw,hh],[hx+hw,hy+hw,hh],[hx+hw,hy+hw,.1]],plaster);
 famQuad(s,[[hx,hy,.1],[hx+hw,hy,.1],[hx+hw,hy,hh],[hx,hy,hh]],plaster);
 famQuad(s,[[hx+hw,hy,.1],[hx+hw,hy+hw,.1],[hx+hw,hy+hw,hh],[hx+hw,hy,hh]],plaster);
 famQuad(s,[[hx,hy,.1],[hx,hy,hh],[hx,hy+hw,hh],[hx,hy+hw,.1]],plaster);
 for(const [dx,dy] of [[0,0],[hw-.08,0],[0,hw-.08],[hw-.08,hw-.08]])s.box(hx+dx-.012,hy+dy-.012,.1,.09,.09,hh,frame);
 if(l===1)s.box(hx-.025,hy-.025,hh-.09,hw+.05,.05,.06,frame);
 if(l>=2)s.box(hx-.035,hy-.035,.1,hw+.07,hw+.07,.23,base);
 if(l===2)for(const f of [.3,.55,.8]){s.box(hx+hw*f,hy+hw-.005,.15,.065,.025,hh*.72,frame);s.box(hx+hw-.005,hy+hw*f,.15,.025,.065,hh*.72,frame);}
 if(l>=3)s.box(hx-.05,hy-.05,.1,hw+.1,hw+.1,.34,base);
 if(l>=5)for(const dx of [.04,hw-.12])famBrace(s,hx+dx,hy+hw+.005,.22,hh*.6,.1,'x');
 if(l>=6){s.box(hx-.04,hy-.04,hh*.62,hw+.08,.05,.05,frame);s.box(hx-.04,hy+hw-.01,hh*.62,hw+.08,.05,.05,frame);}
 famRoof(s,hx,hy,hh,hw,hw,band,roof,.32+l*.05);
 for(const yy of [hy-.05-band*.01,hy+hw+.05+band*.01]){const v=[[hx-.05,yy,hh-.08],[hx+hw+.05,yy,hh-.08],[hx+hw+.05,yy,hh],[hx-.05,yy,hh]];famQuad(s,yy>hy?v.reverse():v,frame);}
 famEntrance(s,hx+hw*.3,hy+hw,hw*.34,hh,l,false);
 if(l>=3){famPanes(s,hx,hy,hw,hw,hh,4);famStack(s,hx+hw-.2,hy+.1,hh+.04,.13,.13,.46);}
 if(l>=4)famMesh(s,'overhang',x+.16,y+n*.52,.5);
 if(l>=5){s.box(x+.2,y+.2,.06,.5,.5,.4,plaster);s.roof(x+.15,y+.15,.46,.6,.6,.14,roof);}
 if(l===5)famMesh(s,'pennant',x+n*.5,y+.12,1.4);
 lanternPost(s,x+.32,y+n-.32,.9,1.6,.8);
 lanternPost(s,x+n-.32,y+n-.32,.9,1.6,.8);
}
function forgeFamily(s,b,n,l){
 const x=b.x+.22,y=b.y+.22,w=n-.44,h=.42+l*.16,band=famBand(l),roof=['#b94e3e','#c15442','#b94b3b','#c35240','#b94d3d','#c65542'];
 // Forge-only materials leave shared families and hot-work light anchors intact.
 const z=l===1?.2:.1,plaster='#eee7d6',frame='#725039',base='#9ca29a';
 famQuad(s,[[x,y+w,z],[x,y+w,h],[x+w,y+w,h],[x+w,y+w,z]],plaster);
 famQuad(s,[[x,y,z],[x+w,y,z],[x+w,y,h],[x,y,h]],plaster);
 famQuad(s,[[x+w,y,z],[x+w,y+w,z],[x+w,y+w,h],[x+w,y,h]],plaster);
 famQuad(s,[[x,y,z],[x,y,h],[x,y+w,h],[x,y+w,z]],plaster);
 if(l===1){
  famQuad(s,[[x,y+w,.1],[x,y+w,z],[x+w,y+w,z],[x+w,y+w,.1]],base);
  famQuad(s,[[x,y,.1],[x+w,y,.1],[x+w,y,z],[x,y,z]],base);
  famQuad(s,[[x+w,y,.1],[x+w,y+w,.1],[x+w,y+w,z],[x+w,y,z]],base);
  famQuad(s,[[x,y,.1],[x,y,z],[x,y+w,z],[x,y+w,.1]],base);
 }
 for(const [dx,dy] of [[0,0],[w-.08,0],[0,w-.08],[w-.08,w-.08]])s.box(x+dx-.012,y+dy-.012,.1,.09,.09,h,frame);
 if(l===1)s.box(x-.025,y-.025,h-.09,w+.05,.05,.06,frame);
 if(l>=2)s.box(x-.035,y-.035,.1,w+.07,w+.07,.15,base);
 if(l===2)for(const f of [.3,.55,.8]){s.box(x+w*f,y+w-.005,.15,.032,.025,h*.72,frame);s.box(x+w-.005,y+w*f,.15,.025,.032,h*.72,frame);}
 if(l>=3)s.box(x-.05,y-.05,.1,w+.1,w+.1,.26,base);
 if(l>=5)for(const dx of [.04,w-.12])famBrace(s,x+dx,y+w+.005,.22,h*.6,.1,'x');
 if(l>=6){s.box(x-.04,y-.04,h*.62,w+.08,.05,.05,frame);s.box(x-.04,y+w-.01,h*.62,w+.08,.05,.05,frame);}
 famRoof(s,x,y,h,w,w,band,roof[Math.min(l,6)-1],.42+l*.06);
 famEntrance(s,x+w*.3,y+w,w*.34,h,l,false);
 if(l>=3)famPanes(s,x,y,w,w,h,4);
 s.box(x+w-.33,y+.16,.1,.28,.28,1.15+l*.08,base);s.box(x+w-.35,y+.14,1.25+l*.08,.32,.32,.12,'#4d514b');
 if(s.alpha===1)s.chimneys.push({owner:s.owner,position:[x+w-.19,y+.3,1.38+l*.08]});
 // Recessed soot and warm inner returns separate the coals from the stone mouth.
 const hearth=x-.025,front=y+w+.07,bias=s.depthBias;s.depthBias+=w*.5+.15;
  for(const [dx,dz,ww,hh] of [[0,.16,.07,.58],[.55,.16,.07,.58],[.07,.16,.48,.08],[.07,.67,.48,.07]])
   s.face([[hearth+dx,front,dz],[hearth+dx,front,dz+hh],[hearth+dx+ww,front,dz+hh],[hearth+dx+ww,front,dz]],dz===.16&&ww>.07?'#e9aa6b':base,false);
  s.face([[hearth+.07,front-.06,.24],[hearth+.07,front-.06,.67],[hearth+.55,front-.06,.67],[hearth+.55,front-.06,.24]],'#100e0d',false);
  s.face([[hearth+.07,front,.24],[hearth+.12,front-.06,.24],[hearth+.12,front-.06,.67],[hearth+.07,front,.67]],'#b96b39',false);
  s.face([[hearth+.5,front-.06,.24],[hearth+.55,front,.24],[hearth+.55,front,.67],[hearth+.5,front-.06,.67]],'#94532d',false);
  s.face([[hearth+.07,front,.67],[hearth+.12,front-.06,.63],[hearth+.5,front-.06,.63],[hearth+.55,front,.67]],'#42281b',false);
  s.face([[hearth,front,.24],[hearth+.62,front,.24],[hearth+.62,front+.1,.24],[hearth,front+.1,.24]],'#ffd18b',false);
  s.face([[hearth,front+.1,.16],[hearth,front+.1,.24],[hearth+.62,front+.1,.24],[hearth+.62,front+.1,.16]],'#e9944b',false);
  for(const dx of [0,.55])s.face([[hearth+dx,front+.002,.24],[hearth+dx,front+.002,.49],[hearth+dx+.07,front+.002,.43],[hearth+dx+.07,front+.002,.24]],'#eeb071',false);
 s.depthBias+=.02;s.emissive=1;
 s.face([[hearth+.06,front+.095,.245],[hearth+.06,front-.04,.245],[hearth+.56,front-.04,.245],[hearth+.56,front+.095,.245]],'#ff6920',false);
 s.face([[hearth+.07,front+.096,.245],[hearth+.07,front+.096,.285],[hearth+.18,front+.096,.3],[hearth+.27,front+.096,.275],[hearth+.39,front+.096,.3],[hearth+.55,front+.096,.28],[hearth+.55,front+.096,.245]],'#ff8728',false);
 s.face([[hearth+.09,front+.004,.27],[hearth+.12,front+.004,.46],[hearth+.2,front+.004,.35],[hearth+.3,front+.004,.51],[hearth+.36,front+.004,.37],[hearth+.49,front+.004,.48],[hearth+.53,front+.004,.27]],'#ff922b',false);
 s.depthBias+=.02;
  s.face([[hearth+.1,front+.006,.28],[hearth+.19,front+.006,.39],[hearth+.25,front+.006,.34],[hearth+.3,front+.006,.45],[hearth+.37,front+.006,.35],[hearth+.44,front+.006,.4],[hearth+.52,front+.006,.28]],'#fff3ad',false);
  s.face([[hearth+.08,front+.08,.247],[hearth+.1,front-.005,.247],[hearth+.52,front-.005,.247],[hearth+.54,front+.08,.247]],'#fff3ad',false);
 s.emissive=0;s.depthBias=bias;
 s.source([hearth+.31,front+.08,.3],[0,1],.95,1.3,'fire');
 if(l>=4){s.box(x+.35,y+.26,.1,.24,.24,1.5+l*.08,base);s.box(x+.33,y+.24,1.6+l*.08,.28,.28,.1,'#4d514b');}
 if(l>=5){s.box(x-.16,y+.3,.1,.3,w*.55,h*.88,plaster);s.roof(x-.2,y+.26,h*.88,.38,w*.62,.14,roof[Math.min(l,6)-1]);}
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
   for(const dx of [.12,n-.18])s.box(x+dx,front,.13,.06,.06,.65,'#513824');
   s.box(x+.12,front,.72,n-.25,.06,.065,'#513824');
   // A broad, lobed hide reads as leather rather than a house's front rail.
   for(const dy of [.032,.058]){
    const v=[[x+.23,front+dy,.69],[x+n-.24,front+dy,.69],[x+n-.2,front+dy,.6],[x+n-.28,front+dy,.54],[x+n-.25,front+dy,.36],[x+n*.5,front+dy,.4],[x+.25,front+dy,.33],[x+.28,front+dy,.53],[x+.2,front+dy,.6]];
    s.face(dy===.032?v:v.reverse(),'#d49b57',false);
   }
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
// Schoolroom trade props (schoolroom only — the scriptorium keeps its own
// look). A slate board on timber posts with chalk marks stages the yard as a
// classroom at tier 2; pupil benches join at tier 4 and a book stack at tier 5.
// Unsplit quads and flat boxes keep the whole set inside a few dozen faces.
function schoolroomProps(s,b,n,l){
 if(l<2)return;
 const x=b.x,y=b.y,boardY=y+n+.05,z0=.42;
 for(const dx of [.34,1.06])s.box(x+dx,boardY-.01,.13,.06,.07,.72,timber);
 s.face([[x+.4,boardY+.055,z0],[x+1,boardY+.055,z0],[x+1,boardY+.055,z0+.42],[x+.4,boardY+.055,z0+.42]],'#2b3033',false);
 s.face([[x+.4,boardY,z0],[x+.4,boardY,z0+.42],[x+1,boardY,z0+.42],[x+1,boardY,z0]],'#23272a',false);
 for(const [dx,dz,w,h]of[[.46,.08,.16,.03],[.5,.16,.3,.026],[.48,.24,.12,.024]])
  s.face([[x+dx,boardY+.063,z0+dz],[x+dx+w,boardY+.063,z0+dz],[x+dx+w,boardY+.063,z0+dz+h],[x+dx,boardY+.063,z0+dz+h]],'#e2e7e4',false);
 if(l>=4)for(const dx of [.26,1.12])s.box(x+dx,boardY+.2,.13,.5,.12,.16,timber);
  if(l>=5)for(const [dz,color]of[[0,'#8c5a52'],[.05,'#6b7a92'],[.1,'#7d8f6a']])s.box(x+1.3,boardY+.16,.13+dz,.18,.2,.045,color);
 }
 // Scriptorium trade props (scriptorium only). A writing desk with an open
 // book and inkpot anchors tier 2; a scroll rack joins at tier 4 and a candle
 // stand lights tier 6, its emissive flame dots carrying the night. Flat
 // boxes, unsplit page quads and 3-sided flame cones hold the set to a few
 // dozen faces.
 function scriptoriumProps(s,b,n,l){
  if(l<2)return;
  const x=b.x,y=b.y,restY=y+n*.55;
  // Writing desk: timber box, two white page quads, small dark inkpot.
  s.box(x+.24,restY,.12,.44,.26,.13,'#6e4f30');
  const py=restY+.04,pz=.255;
  s.face([[x+.3,py,pz],[x+.43,py,pz],[x+.43,py+.09,pz],[x+.3,py+.09,pz]],'#f2ede0',false);
  s.face([[x+.45,py,pz],[x+.58,py,pz],[x+.58,py+.09,pz],[x+.45,py+.09,pz]],'#e9e2d2',false);
  s.box(x+.6,restY+.02,.25,.055,.055,.05,'#23272a');
  // Scroll rack: two posts, one rail, three rolled scrolls.
  if(l>=4){
   const ry=restY-.1;
   for(const dx of [n-.42,n-.18])s.face([[x+dx,ry-.02,.12],[x+dx+.06,ry-.02,.12],[x+dx+.06,ry-.02,.62],[x+dx,ry-.02,.62]],timber,false);
   s.face([[x+n-.44,ry-.02,.56],[x+n-.12,ry-.02,.56],[x+n-.12,ry-.02,.61],[x+n-.44,ry-.02,.61]],timber,false);
   for(const [dz,color]of[[0,'#d9c9a3'],[.07,'#c4b191']])
    s.box(x+n-.43,restY-.085,.49+dz,.28,.055,.05,color);
  }
  // Candle stand: post, candle tray, emissive flame dots, one compact pool.
  if(l>=6){
   const cx=x+.16,cy=y+n-.3;
   s.box(cx,cy,.12,.06,.06,.44,timber,false);
   s.face([[cx-.09,cy-.09,.565],[cx+.15,cy-.09,.565],[cx+.15,cy+.15,.565],[cx-.09,cy+.15,.565]],'#8d6844',false);
   s.emissive=1;
   for(const [dx,dy]of[[.02,.06],[.02,-.03]])s.pyramid(cx+dx,cy+dy,.57,.028,.09,'#ffdf9e',3);
   s.emissive=0;
   s.source([cx+.02,cy+.02,.66],null,.62,.34,'lantern');
  }
 }
 // Chapel trade props (chapel and sunken-chapel only). Tier 4 raises a bellcote
// arch on the porch face with a brass bell in its dark recess, tier 5 sets a
// prayer bench outside the door, and tier 6 lights a votive stand whose candle
// dots carry the night. One polygon frame, a capped slab, small cones and
// unsplit quads hold the whole set inside the chapel's face budget.
function chapelTradeProps(s,b,n,l){
 const x=b.x,y=b.y,bias=s.depthBias;
 // Bellcote: an arched stone frame standing proud of the porch wall. The
 // polygon is traced outside and back inside, so the opening is a real hole;
 // a dark recess sits behind it and the brass bell hangs in the opening.
 const ax=x+n*.5,ay=y+n-.2,w=.24,z0=.44,z1=.74,head=.9;
 const outer=[[-w,z0],[-w,z1],[-w*.62,head],[0,head+.11],[w*.62,head],[w,z1],[w,z0]];
 const inner=[[w*.7,z0],[w*.7,z1],[w*.44,head-.05],[0,head+.04],[-w*.44,head-.05],[-w*.7,z1],[-w*.7,z0]];
 const ring=(pts,dy)=>pts.map(([dx,dz])=>[ax+dx,ay+dy,dz]);
 s.depthBias=bias+.12;
 s.face(ring([...outer,...inner],0),stone,false);
 s.face(ring([...outer,...inner],0).reverse(),'#7e8a80',false);
 s.face(ring(inner,.014),'#333a37',false);
 s.pyramid(ax,ay+.05,z0+.16,.085,.32,'#c9a24e',4);
 // Prayer bench: one capped slab facing the door with a plank back to the yard.
 if(l>=5){
  const bx=ax-.26,by=y+n-.235;
  s.box(bx,by,.13,.52,.18,.07,timber);
  const back=[[bx+.04,by+.184,.2],[bx+.48,by+.184,.2],[bx+.48,by+.184,.36],[bx+.04,by+.184,.36]];
  s.face(back,'#a8834f',false);s.face([...back].reverse(),'#8a6a48',false);
 }
 // Votive stand: an open post carrying a candle tray. The candle cones are
 // emissive, so they only read once the sky clock dims, and they light the
 // chapel with one compact pool.
 if(l>=6){
  const vx=x+n*.24,vy=y+n-.24;
  s.box(vx,vy,.12,.06,.06,.44,timber,false);
  s.face([[vx-.09,vy-.09,.565],[vx+.15,vy-.09,.565],[vx+.15,vy+.15,.565],[vx-.09,vy+.15,.565]],'#8d6844',false);
  s.emissive=1;
  for(const [dx,dy]of[[.02,.06],[.02,-.03]])s.pyramid(vx+dx,vy+dy,.57,.028,.09,'#ffdf9e',3);
  s.emissive=0;
  s.source([vx+.02,vy+.02,.66],null,.62,.34,'lantern');
 }
 s.depthBias=bias;
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
// Trade cask for the storehouse tiers: a dark stave drum closed by a rim disc,
// wearing two proud iron hoops. Unsplit hex rings keep a row of them affordable.
function bandedCask(s,x,y,z=.13,r=.1,h=.34){
 const ring=(rad,zz)=>Array.from({length:6},(_,i)=>{const a=i/6*Math.PI*2;return [x+Math.cos(a)*rad,y+Math.sin(a)*rad,zz];});
 const drum=ring(r,z),top=ring(r,z+h);
 for(let i=0;i<6;i++){const j=(i+1)%6;s.face([drum[i],drum[j],top[j],top[i]],'#4a4139');}
 s.face(top,'#3a332c',false);
 for(const zz of [z+.06,z+h-.09]){const lo=ring(r+.018,zz),hi=ring(r+.018,zz+.035);
  for(let i=0;i<6;i++){const j=(i+1)%6;s.face([lo[i],lo[j],hi[j],hi[i]],'#5c5a52');}}
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
// Outdoor hide rack: timber frame with hanging lobed hide quads, both
// faces painted (same reversed-winding trick as the storefront hide).
function detailHideRack(s,x,y,z=.13,width=.6,hides=2){
 s.box(x,y,z,.07,.07,.95,'#513824');
 s.box(x+width-.07,y,z,.07,.07,.95,'#513824');
 s.box(x,y,z+.85,width,.07,.07,'#513824');
 for(let i=0;i<hides;i++){
  const off=.06+i*(width-.32)/Math.max(1,hides-1);
  for(const dy of [.032,.062]){
   const v=[[x+off,y+dy,z+.84],[x+off+.26,y+dy,z+.84],[x+off+.23,y+dy,z+.58],[x+off+.13,y+dy,z+.52],[x+off+.03,y+dy,z+.58]];
   s.face(dy===.032?v:[...v].reverse(),'#d49b57',false);
  }
 }
}
// Open vat: stone ring walls with a dark inner pit and a liquid disc.
function detailVat(s,x,y,z=.13,r=.17){
 s.box(x,y,z,r*2,r*2,.16,stone);
 s.box(x+.035,y+.035,z+.13,r*2-.07,r*2-.07,.04,'#4c5250');
 const pts=[];for(let i=0;i<8;i++){const a=i/8*Math.PI*2;pts.push([x+r+Math.cos(a)*(r-.05),y+r+Math.sin(a)*(r-.05),z+.175]);}
 s.face(pts,'#5f9e8f',false);
 s.face([...pts].reverse(),'#74b3a4',false);
}
function detailStump(s,x,y,z=.13,r=.16,h=.2){
 const ring=[];for(let i=0;i<6;i++){const a=i/8*Math.PI*2;ring.push([x+Math.cos(a)*r,y+Math.sin(a)*r,z]);}
 for(let i=0;i<6;i++){const a=ring[i],b=ring[(i+1)%6];s.face([[a[0],a[1],z],[b[0],b[1],z],[b[0],b[1],z+h],[a[0],a[1],z+h]],'#9b7653');}
  const top=ring.map(p=>[p[0],p[1],z+h]);
  s.face(top,'#c19c6e',false);
}
// Forge-quarter yard props. The quench barrel is a dark stave drum with a
// still water disc painted both ways, the ingots are a three-high pyramid of
// cast bars, and the trade stack is a tall narrow flue that carries the
// quarter's smoke. Lower tiers leave the barrel top open to the water disc and
// the ingot tops hidden under the bar above, so those planes cost nothing.
function forgeQuenchBarrel(s,x,y,z=.13,r=.16,h=.34){
  const ring=[];for(let i=0;i<6;i++){const a=i/6*Math.PI*2;ring.push([x+Math.cos(a)*r,y+Math.sin(a)*r]);}
  for(let i=0;i<6;i++){const a=ring[i],b=ring[(i+1)%6];s.face([[a[0],a[1],z],[b[0],b[1],z],[b[0],b[1],z+h],[a[0],a[1],z+h]],'#4a4640');}
  const water=ring.map(p=>[p[0],p[1],z+h-.05]);
  s.face(water,'#3f6f7a',false);s.face([...water].reverse(),'#4d8290',false);
}
function forgeIngotStack(s,x,y,z=.13){
  for(const dx of[0,.15])s.box(x+dx,y,z,.13,.26,.08,'#8d8a80',false);
  s.box(x+.075,y+.02,z+.08,.13,.22,.08,'#a8a49a');
}
function forgeTradeStack(s,x,y,z,h){
  s.box(x,y,z,.16,.16,h,stone,false);
  s.face([[x-.02,y-.02,z+h],[x+.18,y-.02,z+h],[x+.18,y+.18,z+h],[x-.02,y+.18,z+h]],'#4d514b',false);
  if(s.alpha===1)s.chimneys.push({owner:s.owner,position:[x+.08,y+.08,z+h+.06]});
}
// Timber hook frame with hanging meat quads in deep reds, both faces painted.
function detailHookFrame(s,x,y,z=.13,width=.56,carcasses=2){
 s.box(x,y,z,.07,.07,.95,'#513824');
 s.box(x+width-.07,y,z,.07,.07,.95,'#513824');
 s.box(x,y,z+.85,width,.07,.07,'#513824');
 const reds=['#7e2626','#93302b','#6f1f1f'];
 for(let i=0;i<carcasses;i++){
  const off=.08+i*(width-.3)/Math.max(1,carcasses-1);
  for(const dy of [.032,.062]){
   const v=[[x+off,y+dy,z+.84],[x+off+.14,y+dy,z+.84],[x+off+.12,y+dy,z+.55],[x+off+.07,y+dy,z+.5],[x+off+.02,y+dy,z+.55]];
   s.face(dy===.032?v:[...v].reverse(),reds[i%reds.length],false);
  }
 }
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
   // Workshop tiers carry the toolsmith's own trade props instead of more
   // volume: a vise bench with parts, a pegboard tool wall and a parts crate
   // arrive as the shop is upgraded, each on the front face or front apron.
   if(t==='workshop'){
    s.box(x+.24,y+.7,.12,.38,.15,.13,'#a8794c');
    s.box(x+.27,y+.72,.25,.12,.1,.08,'#8b9a97');
    if(l>=2)s.box(x+.45,y+.74,.25,.09,.07,.07,'#b8c0bd');
    if(l>=3)s.box(x+.78,y+.76,.12,.2,.18,.18,'#8d6844');
    if(l>=4){const v=[[x+.3,y+.79,.72],[x+.56,y+.79,.72],[x+.56,y+.79,1.02],[x+.3,y+.79,1.02]];s.face(v,'#8a6a48',false);s.face([...v].reverse(),'#77593d',false);}
    if(l>=5){const v=[[x+.33,y+.78,.75],[x+.37,y+.78,.75],[x+.37,y+.78,.9],[x+.44,y+.78,.9],[x+.44,y+.78,.96],[x+.3,y+.78,.96],[x+.3,y+.78,.9],[x+.33,y+.78,.9]];s.face(v,'#9facaa',false);s.face([...v].reverse(),'#8e9b99',false);}
    if(l>=6){const v=[[x+.47,y+.78,.76],[x+.5,y+.78,.95],[x+.56,y+.78,.93],[x+.52,y+.78,.74]];s.face(v,'#a8794c',false);s.face([...v].reverse(),'#96693f',false);}
   }
  }
 if(['armory','fletcher','shieldwall-yard'].includes(t)){
  detailCrate(s,x+n-.52,y+.22,.12,.95);
   if(t==='fletcher'){
    for(let i=0;i<4;i++)s.box(x+n-.4+i*.045,y+.31,.2,.02,.02,.54,'#d5c59c');
    if(fine)s.box(x+n-.44,y+.27,.16,.24,.15,.08,'#80634a');
    // Outdoor target butt: round straw disc on a timber stand.
    if(l>=2){s.box(x+.14,front-.2,.12,.06,.06,.5,timber);const tx=x+.17,ty=front-.23;for(let o=0;o<2;o++){const pts=[];for(let i=0;i<8;i++){const a=i/8*Math.PI*2;pts.push([tx+Math.cos(a)*.26,ty+(o?-.012:.012),.58+Math.sin(a)*.26]);}s.face(o?pts:[...pts].reverse(),'#d8bd7a',false);}}
    // Arrow-shaft bundle and a bow-stave lean-to by the rack.
    if(fine){for(let i=0;i<2;i++)s.box(x+.34+i*.07,y+n-.34,.2,.02,.02,.5,'#d5c59c');}
    if(l>=3){const ly=y+n-.3;s.box(x+.62,ly,.12,.05,.05,.66,timber);s.box(x+.92,ly,.12,.05,.05,.66,timber);const q=[[x+.6,ly,.16],[x+.63,ly,.16],[x+.8,ly,.72],[x+.77,ly,.72]];s.face(q,'#8a6a48',false);s.face([...q].reverse(),'#7a5d3f',false);}
   }else{
    for(let i=0;i<(l>=2?3:2);i++){const px=x+n-.44+i*.12;s.box(px,y+.28,.18,.09,.035,.28,'#718e9b');if(fine)s.box(px+.03,y+.292,.23,.03,.012,.18,gold);}
   }
    if(t==='shieldwall-yard'){
     detailRack(s,x+.18,y+.68,.13,.6);
     for(let i=0;i<3;i++){const c=['#b76053','#5e8c9b','#c9a24e'][i],sx=x+.34+i*.22,sy=y+.71;for(const o of [0,1]){const pts=[];for(let j=0;j<8;j++){const a=j/8*Math.PI*2;pts.push([sx+Math.cos(a)*.105,sy+(o?-.012:.012),.5+Math.sin(a)*.105]);}s.face(o?pts:[...pts].reverse(),c,false);}}
     const bx=x+n-.62,by=y+.55;
     s.box(bx,by-.07,.13,.32,.28,.06,'#6b5541');
     for(let i=0;i<3;i++){const px=bx+.06+i*.1;s.face([[px,by,.2],[px+.03,by,.2],[px+.03,by,.78],[px,by,.78]],'#8a6a48',false);s.face([[px,by,.78],[px+.03,by,.78],[px+.015,by,.9]],'#aebbbb',false);}
     const dx=x+.58,dy=y+n-.44;
     s.box(dx,dy,.13,.055,.055,.48,timber);
     s.face([[dx-.07,dy+.055,.52],[dx+.13,dy+.055,.52],[dx+.13,dy+.055,.74],[dx-.07,dy+.055,.74]],'#d8bd7a',false);
     s.face([[dx-.07,dy+.055,.52],[dx-.07,dy+.055,.74],[dx-.02,dy+.11,.74],[dx-.02,dy+.11,.52]],'#b89b5d',false);
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
   s.box(x+n-.42,front-.05,.12,.28,.12,.22,'#513824');s.box(x+n-.4,front-.035,.31,.24,.09,.035,'#a27343');
  if(fine)detailBarrel(s,x+.18,y+.24,.13,.86);
 }
 if(['scriptorium','schoolroom'].includes(t)){
  detailCrate(s,x+n-.48,y+.22,.12,.84);
  if(fine){s.box(x+n-.43,y+.27,.37,.27,.18,.035,'#d7c9a4');s.box(x+n-.32,y+.27,.405,.035,.18,.018,'#765c4a');}
 }
 if(t==='butchery'){
  s.box(x+.18,front-.34,.13,.58,.3,.25,'#7f6042');s.box(x+.15,front-.37,.38,.64,.36,.055,'#c19c6e');
  s.box(x+n-.52,front-.4,.13,.34,.3,.34,'#7f6042');s.box(x+n-.53,front-.41,.47,.36,.32,.045,'#5e1f1f');
  detailStump(s,x+.62,front-.2,.13,.15,.24);
  s.box(x+.56,front-.24,.37,.12,.05,.012,'#b9c2c1');
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
   if(l>=5&&l!==6){s.box(x+.2,y+.5,.13,.5,.2,.14,'#8a6a48');for(const wx of [x+.28,x+.55])s.box(wx,y+.68,.11,.09,.09,.14,'#414845');}
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
   // Dressed ashlar stacked in two courses, and the grit spill raked beside it.
   s.box(x+n-.32,front-.4,.13,.3,.26,.11,'#c3c8bd',false);s.box(x+n-.29,front-.37,.24,.24,.2,.1,'#d2d5c9');
   s.pyramid(x+n-.5,front-.34,.13,.12,.09,'#a29074',4);
   if(l>=5){s.box(x+.2,front-.2,.13,.5,.14,.4,stone);s.roof(x+.15,front-.25,.53,.6,.24,.12,'#949b90');}
   // Carving banker: bench with a chisel laid out on the top (the mallet already
   // stands in the rack below), all inside the tile footprint.
   if(l>=5){s.box(x+n-.62,front-.08,.13,.38,.2,.1,'#7f6042');s.box(x+n-.55,front-.04,.23,.15,.04,.04,'#9aa7a5');}
   if(l>=6)s.box(x+n-.4,y+.3,.5,.2,.2,.5,'#e9dab2');
  }
  if(t==='tannery'){
   detailBarrel(s,x+side,y+.28,.13,.86);
    if(l>=5)s.box(x+.23,front+.03,.5,n-.47,.025,.2,'#b57537');
   if(l>=6)detailCrate(s,x+n-.5,y+.3,.12,.85);
  }
  if(t==='butchery'){
  detailBarrel(s,x+side,y+.25,.13,.82);
  if(l>=5){s.box(x+.18,front-.34,.3,.58,.3,.14,'#7f6042');}
  if(l>=6)lanternPost(s,x+.24,y+.3,.62,.9,.4);
  detailHookFrame(s,x+side,y+.55,.13,.56,2);
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
   // Weapon rack: timber frame standing a sword and spear upright.
   s.box(x+.14,y+.1,.13,.055,.055,.4,timber);s.box(x+.465,y+.1,.13,.055,.055,.4,timber);s.box(x+.14,y+.1,.475,.38,.055,.055,timber);
   s.box(x+.21,y+.14,.16,.028,.028,.38,'#aebbbb');s.box(x+.18,y+.14,.27,.085,.028,.036,'#8f7555');
   s.box(x+.42,y+.14,.16,.032,.032,.38,'#72533a');s.pyramid(x+.44,y+.16,.54,.045,.14,'#aebbbb');
   // Shield plaque: round disc with a central boss on the front wall.
   if(l>=5){const sx=x+.8,sy=front-.03;for(const o of [0,1]){const pts=[];for(let i=0;i<8;i++){const a=i/8*Math.PI*2;pts.push([sx+Math.cos(a)*.15,sy,.56+Math.sin(a)*.15]);}s.face(o?pts:[...pts].reverse(),'#8f7555',false);}s.box(sx-.035,sy-.05,.51,.07,.05,.11,'#aebbbb');}
   if(l>=5)detailCrate(s,x+side,y+.28,.12,.9);
   // Armor stand: post carrying a breastplate.
   if(l>=6){s.box(x+.18,y+.52,.13,.055,.055,.4,timber);s.box(x+.07,y+.5,.5,.2,.11,.24,'#9aa7a5');}
   if(l>=6&&fine){s.box(x+n-.4,y+.3,.13,.08,.08,.66,timber);s.box(x+n-.52,y+.34,.39,.32,.08,.08,'#8f7555');}
  }
   if(t==='fletcher'){
    for(let i=0;i<6;i++)s.box(x+.3+i*.045,y+.35,.2,.02,.02,.54,'#d5c59c');
    if(l>=5)detailCrate(s,x+side,y+.26,.12,.85);
    if(l>=6)lanternPost(s,x+n-.35,y+.3,.62,.9,.4);
    // Second arrow rack and a straw target butt stand at the upper tiers.
    if(l>=5){for(let i=0;i<1;i++)s.box(x+.3+i*.07,y+n-.3,.2,.02,.02,.5,'#d5c59c');}
    if(l>=6){s.box(x+n-.3,y+n-.34,.12,.05,.05,.44,timber);const tx=x+n-.27,ty=y+n-.37;for(let o=0;o<2;o++){const pts=[];for(let i=0;i<8;i++){const a=i/8*Math.PI*2;pts.push([tx+Math.cos(a)*.2,ty+(o?-.012:.012),.52+Math.sin(a)*.2]);}s.face(o?pts:[...pts].reverse(),'#d8bd7a',false);}}
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
     // Trade crown: brazier basket of iron ring and emissive coals, a hanging
     // manner banner and ladder rungs on the front face.
     const cx=x+n/2,cy=y+n/2,top=1.18;
     s.box(cx-.03,cy-.03,.98,.06,.06,.2,'#4d514b');
     for(const o of [0,1]){const pts=[];for(let i=0;i<8;i++){const a=i/8*Math.PI*2;pts.push([cx+Math.cos(a)*.13,cy+(o?-.012:.012),top+Math.sin(a)*.13]);}s.face(o?pts:[...pts].reverse(),'#3f4442',false);}
     s.emissive=1;s.pyramid(cx,cy,top,.1,.1,'#f2994a',5);s.emissive=0;s.source([cx,cy,top+.1],null,1.6,.8,'fire');
     s.box(x+n*.3,y+n-.34,1.06,.4,.03,.03,timber);
     const by=y+n-.325;for(const o of [0,1]){const pts=[[x+n*.32,by+(o?-.012:.012),1.03],[x+n*.68,by+(o?-.012:.012),1.03],[x+n*.66,by+(o?-.012:.012),.8],[x+n*.34,by+(o?-.012:.012),.8]];s.face(o?pts:[...pts].reverse(),'#b76053',false);}
     const lx=x+.62,ly=y+n-.325;for(let i=0;i<3;i++){const z=.3+i*.18;for(const o of [0,1]){const pts=[[lx,ly+(o?-.012:.012),z],[lx+.34,ly+(o?-.012:.012),z],[lx+.34,ly+(o?-.012:.012),z+.05],[lx,ly+(o?-.012:.012),z+.05]];s.face(o?pts:[...pts].reverse(),timber,false);}}
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
   chapelTradeProps(s,b,n,l);
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
    // Yard ladder: a quench barrel joins at tier 4, cast ingots at tier 5 and
    // the tall trade stack at tier 6, each on the open front apron.
    if(l>=4)forgeQuenchBarrel(s,x+.6,y+1.4);
    if(l>=5){detailBarrel(s,x+n-.48,y+.3,.12,.85);for(let i=0;i<3;i++)s.box(x+.72+i*.14,y+.4,.13,.11,.28,.07,i%2?'#b6c1bf':'#879493');forgeIngotStack(s,x+1.16,y+1.44);}
    if(l>=6){lanternPost(s,x+.28,y+.28,.7,1,.42);s.box(x+.2,front-.3,.13,.2,.2,.5,stone);forgeTradeStack(s,x+.46,y+1.58,1.62,.7);}
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
if(isWall(b)){const ramp=t==='rampart',specStone='#9ca29a',h=.38+l*.17+(t==='stonewall'?.15:0)+(ramp?.12:0),color=ramp?'#8a6f4d':l>1||t==='stonewall'?specStone:timber,neighbors=wallNeighbors(b,world),isGateAdjacent=neighbors.some(([dx,dy])=>world.buildings.some(bb=>bb.x===b.x+dx&&bb.y===b.y+dy&&bb.type==='gate')),footingW=l>=3?.3:.2;for(const [dx,dy]of neighbors.filter(([a,c])=>a+c<0))s.box(x+.4+Math.min(0,dx*.5),y+.4+Math.min(0,dy*.5),.1,footingW+Math.abs(dx)*.5,footingW+Math.abs(dy)*.5,h-.13,color);s.box(x+.28,y+.28,.1,.44,.44,h,color);
if(ramp){s.box(x+.2,y+.2,.1,.6,.6,.1,timber);s.box(x+.2,y+.2,h-.12,.6,.07,.07,'#6b543a');}
if(l===1&&t==='wall')s.pyramid(x+.5,y+.5,h+.1,.32,.2,color);else for(const [a,c]of[[.25,.25],[.6,.25],[.25,.6],[.6,.6]])s.box(x+a,y+c,h+.1,.16,.16,.18,isGateAdjacent?gold:specStone);
for(const [dx,dy]of neighbors.filter(([a,c])=>a+c>=0))s.box(x+.4+Math.min(0,dx*.5),y+.4+Math.min(0,dy*.5),.1,footingW+Math.abs(dx)*.5,footingW+Math.abs(dy)*.5,h-.13,color);
const cap=ramp?'#b89c70':l>1||t==='stonewall'?'#d3d9d0':WALL_CAP;
for(const [dx,dy]of wallEnds(neighbors)){const alongX=!!dx,px=dx<0?.15:dx>0?.65:.37,py=dy<0?.15:dy>0?.65:.37,w=alongX?.2:.26,d=alongX?.26:.2;s.box(x+px,y+py,.1,w,d,h+.12,cap);}
if(l>=5){for(const [a,c]of[[.25,.25],[.6,.25],[.25,.6],[.6,.6]])s.box(x+a-.02,y+c-.02,h+.12,.2,.2,.06,'#1a1a1a');}
if(l>=6)s.box(x+.42,y+.42,h+.2,.16,.16,.3,gold);
  // One torch roughly every three wall tiles keeps long defenses legible
  // without turning every segment into an expensive light source.
  const torchSide=WALL_DIRECTIONS.find(([dx,dy])=>!neighbors.some(([nx,ny])=>nx===dx&&ny===dy));
  const torchSlot=((Math.floor(x)*31+Math.floor(y)*17)%3+3)%3;
  if(torchSide&&torchSlot===0){const [dx,dy]=torchSide;torch(s,x+.5+dx*.3,y+.5+dy*.3,h+.27,[dx,dy],1.02,.46);}
  return;}
  if(t.includes('trap')){const armed=trapArmed(b),fire=t==='fire-trap',kerb='#9ca29a',frame='#725039';
   // A stone kerb ring grounds the pit and a dark timber frame caps it, so the
   // trap reads as built masonry instead of a raw plate. The pit floor stays
   // dark stone; only the flame carries emissive.
   s.box(x+.16,y+.16,.12,.68,.68,.08,'#3f443f');s.box(x+.25,y+.25,.2,.5,.5,.035,armed?(fire?'#5b5145':'#5f6259'):'#41453d');
   for(const [kx,ky,kw,kd]of[[.16,.16,.68,.1],[.16,.74,.68,.1],[.16,.26,.1,.48],[.74,.26,.1,.48]])s.box(x+kx,y+ky,.12,kw,kd,.17,kerb);
   for(const [px,py]of[[.2,.2],[.72,.2],[.2,.72],[.72,.72]])s.box(x+px,y+py,.12,.08,.08,.22,frame);
   for(const [ax,ay,aw,ad]of[[.24,.18,.56,.05],[.24,.77,.56,.05],[.18,.26,.05,.56],[.77,.26,.05,.56]])s.box(x+ax,y+ay,.29,aw,ad,.05,frame);
    if(fire){s.emissive=0;s.face(Array.from({length:8},(_,i)=>[x+.5+Math.cos(i*Math.PI/4)*.31,y+.5+Math.sin(i*Math.PI/4)*.31,.236]),'#454b46',false);}
    if(fire)s.face(Array.from({length:8},(_,i)=>[x+.5+Math.cos(i*Math.PI/4)*.21,y+.5+Math.sin(i*Math.PI/4)*.21,.239]),'#b64b24',false);
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(!fire||i!==1||j!==1)s.pyramid(x+.28+i*.21,y+.28+j*.21,armed?.2:.16,armed?.09:.055,armed?.3:.055,armed?(fire?'#eb9a4f':'#c0cdcd'):(fire?'#754330':'#665d52'));
    if(!fire){
     // Beast trap reads as a sprung jaw: two angled timber arms brace over the
     // pit, a steel tooth row fills the gap they leave, and the trip plate sits
     // at the mouth. Unsplit quads and three-sided cones keep the whole mechanism
     // to a handful of faces, and every normal points up so the orbit cull spares it.
     s.face([[x+.24,y+.44,.52],[x+.24,y+.24,.26],[x+.76,y+.24,.26],[x+.76,y+.44,.52]],'#8a6a48',false);
     s.face([[x+.24,y+.56,.52],[x+.76,y+.56,.52],[x+.76,y+.76,.26],[x+.24,y+.76,.26]],'#8a6a48',false);
     for(let i=0;i<3;i++)s.pyramid(x+.36+i*.14,y+.5,.26,.05,armed?.2:.07,armed?'#c9d4d6':'#7d7364',3);
     s.face([[x+.36,y+.82,.3],[x+.66,y+.82,.3],[x+.66,y+.94,.3],[x+.36,y+.94,.3]],armed?'#8e8a74':'#4d4840',false);
    }
   if(fire&&armed){s.source([x+.5,y+.5,.43],null,1.05,.7,'trap');s.emissive=1;s.pyramid(x+.5,y+.5,.21,.11,.2,'#f2ca6d',5);s.emissive=0;}
   s.emissive=0;return;}
 if(['farm','pasture'].includes(t)){s.box(x+.2,y+.2,.12,n-.4,n-.4,.05,t==='farm'?'#72553b':'#8da964');if(t==='farm'){for(let i=.32;i<n-.2;i+=.28)for(let j=.32;j<n-.2;j+=.32){s.box(x+i,y+j,.17,.045,.045,.18+l*.03,'#799658');s.pyramid(x+i,y+j,.3,.085,.16,'#e1c776');}}else{
   // Pasture reads as built ground: stone troughs, a stone path strip and the
   // fence. Tier shows as trough count, and from tier 3 a small timber shelter
   // roof shades the first trough.
   const specStone='#9ca29a',frame='#725039',spots=l>=6?[[.5,.44],[1.2,.66],[.5,1.18]]:l>=2?[[.5,.56],[1.2,1.12]]:[[.66,.7]];
   for(const [a,c]of spots){s.box(x+a-.03,y+c-.03,.12,.46,.32,.2,specStone);s.box(x+a+.03,y+c+.02,.32,.34,.24,.05,'#3f443f');}
   for(const py of [.36,.64,.92,1.2,1.48])s.box(x+.24,y+py,.11,.2,.22,.05,specStone);
   if(l>=3){const[sa,sc]=spots[0];s.box(x+sa-.09,y+sc-.07,.12,.05,.05,.5,frame);s.box(x+sa+.48,y+sc-.07,.12,.05,.05,.5,frame);s.roof(x+sa-.15,y+sc-.16,.6,.66,.48,.16,frame);}
  }if(l>1||t==='pasture')fence(s,x+.13,y+.13,n-.26,n-.26);lanternPost(s,x+n-.28,y+n-.28,.7+l*.04,1.12,.43);
  if(t==='farm'&&l>=4){s.box(x+.5,y+.5,.13,.06,.06,.6,timber);s.box(x+.38,y+.5,.55,.3,.06,.06,timber);s.pyramid(x+.5,y+.5,.73,.12,.14,'#d5bf8f',6);}
  if(t==='farm'&&l>=5){s.box(x+.2,y+.2,.1,n-.4,.1,.06,'#4e9aaa');}
  if(t==='farm'&&l>=6){s.box(x+n-.55,y+.15,.12,.3,.3,.4,timber);s.roof(x+n-.6,y+.1,.52,.4,.4,.14,'#8a6a48');}
  return;}
 if(['pond','deephole'].includes(t)){const specStone='#9ca29a',frame='#725039';
   // Solid stone kerb slabs bound the water instead of a brick-by-brick course,
   // and the U stays open on the dock side so the walkable deck is unobstructed.
   s.box(x+.18,y+.18,.13,n-.36,n-.36,.02,'#4e9aaa');
   for(const [kx,ky,kw,kd]of[[.16,.16,.12,n-.32],[n-.28,.16,.12,n-.32],[.16,.16,n-.32,.12]])s.box(x+kx,y+ky,.13,kw,kd,.15,specStone);
   s.box(x+.2,y+n-.45,.16,n-.4,.23,.1,frame);s.box(x+.25,y+n-.45,.16,.08,.08,.65,frame);s.box(x+n-.35,y+n-.45,.16,.08,.08,.65,frame);
   // Reeds are the only tier ladder here: at most three three-sided clumps.
   for(let i=0;i<Math.min(3,l-1);i++)s.pyramid(x+n*(.3+i*.2),y+n*(.4+(i%2)*.14),.15,.05,.24,'#699358',3);
   lanternPost(s,x+n-.31,y+n-.39,.77,1.05,.42);return;}
  if(t==='blackwater-weir'){
   const specStone='#9ca29a',race=l>=3?.4:.34;
   s.box(x+.14,y+.14,.13,.72,.72,.025,'#385f68');
   for(let i=0;i<5;i++)s.box(x+.2+i*.13,y+.3,.14,.035,.46,.28,timber);
   // Stone abutments take both ends of the race, a darker strip marks the
   // shaded spill below the crest, and tiers 3-6 only lengthen the channel
   // walls instead of hanging new parts off the weir.
   s.box(x+.16,y+.16,.13,.62,.11,.32,specStone);s.box(x+.16,y+.75,.13,.62,.11,.25,specStone);
   s.box(x+.2,y+.34,.15,.55,.07,.04,'#2c4b52');
   for(const wx of [.14,.77])s.box(x+wx,y+.3,.14,.09,race,.22,specStone);
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
 if(['tower','bell-tower','bellcote','scout_post','archer_tower','ballista'].includes(t)){const width=t==='archer_tower'?n*.45:t==='ballista'?n*.62:n*.55,h=t==='archer_tower'?1+l*.3:t==='ballista'?.62+l*.18:.85+l*.24;tower(s,x+(n-width)/2,y+(n-width)/2,width,h,l===1?timber:stone,l);if(t.includes('bell')){s.box(x+n*.4,y+n*.4,h+.3,n*.2,n*.2,.28,gold);s.roof(x+.15,y+.15,h+.7,n-.3,n-.3,.45,'#648b90');
   // Bellcote trade props only: the brass bell hangs in the belfry face on its
   // rope, and a votive shelf below carries candle dots that carry the night.
   // Bell-tower keeps its own path, so nothing else in this branch pays for it.
   // One unsplit rope quad, a three-sided cone, a clapper sliver and three shelf
   // quads hold the whole set inside the branch's face budget; the second candle
   // arrives with the top tier.
if(t==='bellcote'){
     const cx=x+n*.5,fy=y+n*.6+.012,zTop=h+.57,zCrown=zTop-.12,zSkirt=zCrown-.11;
     // Rope: a single quad dropped from the belfry lintel to the bell crown.
     s.face([[cx-.012,fy,zTop],[cx+.012,fy,zTop],[cx+.012,fy,zCrown],[cx-.012,fy,zCrown]],'#a08a63',false);
     // Bell: a cone flaring to its skirt, hung the way the chapel hangs its own,
     // with the clapper clearing the lip below.
     s.pyramid(cx,fy-.01,zSkirt,.085,.11,'#c9a24e',3);
     s.face([[cx-.018,fy,zSkirt+.012],[cx+.018,fy,zSkirt+.012],[cx+.018,fy,zSkirt-.028],[cx-.018,fy,zSkirt-.028]],'#6b5a3c',false);
     // Votive shelf: a slab on the shaft face, braced underneath from tier 3.
     if(l>=2){
      const sz=h*.5,sy=y+n-.225+.012;
      s.face([[x+.28,sy,sz],[x+.72,sy,sz],[x+.72,sy+.09,sz],[x+.28,sy+.09,sz]],'#8d6844',false);
      if(l>=3)s.face([[x+.4,sy,sz],[x+.46,sy,sz],[x+.46,sy,sz-.09],[x+.4,sy,sz-.09]],'#6f6253',false);
      // Candle dots are emissive, so they only read once the sky clock dims.
      if(l>=5){s.emissive=1;s.face([[x+.36,sy+.03,sz+.053],[x+.41,sy+.03,sz+.053],[x+.41,sy+.03,sz+.003],[x+.36,sy+.03,sz+.003]],'#ffdf9e',false);s.emissive=0;}
      if(l>=6){s.emissive=1;s.face([[x+.5,sy+.03,sz+.053],[x+.55,sy+.03,sz+.053],[x+.55,sy+.03,sz+.003],[x+.5,sy+.03,sz+.003]],'#ffdf9e',false);s.emissive=0;}
     }
     // Arched opening cue at belfry face (mass/color accent only)
     if(l>=3){s.box(cx-.06,fy+.01,zCrown-.08,.12,.02,.18,'#2a2a2a');}
    }
  }
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
   // Platform rail cue at tier>=4 (mass/color accent only)
   if(t==='ballista'&&l>=4){s.box(x+.1,y+.1,h+.13,width+.2,width+.2,.03,'#2a2a2a');}
  torch(s,x+n/2,y+(n+width)/2+.035,h*.58,[0,1],1.02,.45);
  return;}
  if(['watchfire','oathstone','moon-dial','cairnfield'].includes(t)){const spots=t==='cairnfield'?[[.5,.5],[1.3,.6],[.6,1.4],[1.35,1.35]]:[[n/2,n/2]];s.emissive=t==='watchfire'?1:0;for(const [a,c]of spots){s.box(x+a-.18,y+c-.18,.13,.36,.36,.22,stone);if(t==='watchfire'){s.source([x+a,y+c,.55],null,2.1,1,'fire');s.pyramid(x+a,y+c,.36,.26,.55,'#f2b35c',5);if(l>=4)s.pyramid(x+a,y+c,.2,.15,.3,'#e8883f',5);if(l>=5)for(const [ox,oy]of[[-.3,0],[.3,0],[0,-.3],[0,.3]])s.box(x+a+ox-.06,y+c+oy-.06,.13,.12,.12,.16,stone);if(l>=6){s.box(x+a-.05,y+c-.05,.13,.1,.1,.5,timber);s.box(x+a-.09,y+c-.09,.55,.18,.18,.08,'#4d514b');}}else if(t==='moon-dial')moonDial(s,x+a,y+c);else if(t==='cairnfield'&&a===.5)cairnSlab(s,x+a,y+c);else{s.box(x+a-.09,y+c-.06,.35,.18,.12,.6,t==='oathstone'?'#90b5b5':stone);if(t==='oathstone'){s.box(x+a-.1,y+c-.07,.52,.2,.14,.05,'#31413f');s.box(x+a-.1,y+c-.07,.72,.2,.14,.05,'#31413f');s.box(x+a+.06,y+c+.04,.35,.1,.1,.05,'#6e5a40');s.emissive=1;s.box(x+a+.085,y+c+.065,.4,.05,.05,.09,'#ffd98a');s.emissive=0;for(const [ox,oy]of[[-.14,0],[.14,0],[0,-.13],[0,.13]])s.box(x+a+ox-.025,y+c+oy-.025,.35,.05,.05,.06,'#7e837c');}}}if(t==='cairnfield')cairnRings(s,x,y,spots);s.emissive=0;return;}
 if(t==='dawn-gate'){const cx=x+n*.5,crest=y+.9;
   tower(s,x+.18,y+.35,.62,1.7,stone);tower(s,x+n-.8,y+.35,.62,1.7,stone);s.box(x+.8,y+.43,1.35,n-1.6,.46,.45,gold);s.roof(x+.05,y+.2,2,n-.1,.95,.32,'#638b92');torch(s,x+.68,y+.92,1.22,[0,1],1.25,.58);torch(s,x+n-.68,y+.92,1.22,[0,1],1.25,.58);
   for(const a of[-1.02,-.34,.34,1.02]){const rx=Math.sin(a),rz=Math.cos(a),len=.16,hub=.028,tip=.012;
    s.face([[cx+rz*hub,crest,1.83-rx*hub],[cx-rz*hub,crest,1.83+rx*hub],[cx+rx*len-rz*tip,crest,1.83+rz*len+rx*tip],[cx+rx*len+rz*tip,crest,1.83+rz*len-rx*tip]],gold,false);}
   for(const bx of[x+.42,x+n-.42]){s.face([[bx,y+1.35,.2],[bx+.2,y+1.35,.2],[bx,y+1.55,.2],[bx,y+1.15,.2]],'#6f6354',false);
    s.emissive=1;s.face([[bx+.06,y+1.35,.2],[bx-.06,y+1.35,.2],[bx,y+1.4,.56]],'#ffcf7c',false);s.emissive=0;}
   s.face([[x+.9,y+.97,.126],[x+n-.9,y+.97,.126],[x+n-.9,y+1.36,.126],[x+.9,y+1.36,.126]],'#cdc9bb',false);
   s.face([[x+1.02,y+1.36,.146],[x+n-1.02,y+1.36,.146],[x+n-1.02,y+1.66,.146],[x+1.02,y+1.66,.146]],'#bdb9aa',false);
   return;}
 if(t==='market'){for(const [a,c,color]of[[.22,.24,'#b76053'],[1.7,.25,'#73956a'],[.6,1.75,'#ccac60']]){s.box(x+a,y+c,.14,1,.5,.35,timber);for(const dx of [0,.94])s.box(x+a+dx,y+c,.14,.06,.06,.95,timber);s.roof(x+a-.06,y+c-.12,1.02,1.12,.75,.12,color);}lanternPost(s,x+.32,y+n-.32,.9,1.12,.44);lanternPost(s,x+n-.32,y+n-.32,.9,1.12,.44);return;}
 // The new production chain buildings need to read differently at map scale.
 // Keep the machinery stationary so the meshes can share the camera cache.
  if(t==='sawmill'){
   const h=.85+l*.12,frame='#967354',wood='#b8895c',steel='#edf2ef',trim='#ead5aa';
   for(const a of [.25,n-.35])for(const c of [.25,n-.35]){s.box(x+a-.06,y+c-.06,.12,.23,.23,.2,'#c6cabe');s.box(x+a,y+c,.32,.11,.11,h-.2,frame);}
   s.roof(x+.12,y+.12,h+.12,n-.24,.72,.26,'#448b58'); // open work bay
   // Unsplit narrow fascia and machinery profiles keep the open bay inexpensive.
   for(const cy of [.12,.84]){
    const v=[[x+.12,y+cy,h+.04],[x+n-.12,y+cy,h+.04],[x+n-.12,y+cy,h+.12],[x+.12,y+cy,h+.12]];s.face(cy===.12?v:v.reverse(),trim,false);
    for(const cx of [.12,n-.12]){const rake=[[x+cx,y+cy,h+.12],[x+n/2,y+cy,h+.38],[x+n/2,y+cy,h+.31],[x+cx,y+cy,h+.05]];s.face((cy===.12)===(cx===.12)?rake.reverse():rake,trim,false);}
   }
   for(const cx of [.12,n-.12]){const v=[[x+cx,y+.12,h+.12],[x+cx,y+.12,h+.04],[x+cx,y+.84,h+.04],[x+cx,y+.84,h+.12]];s.face(cx===.12?v.reverse():v,trim,false);}
   s.emissive=.12;
   s.box(x+.38,y+.8,.14,n-.76,.48,.27,'#c69a6d'); // sawing bench
   s.emissive=0;
   // Thin toothed disc stays exposed in front of the roof, above the feed bench.
   const rim=Array.from({length:16},(_,i)=>{const a=i*Math.PI/8,r=i%2?.4:.44;return [x+1.13+Math.cos(a)*r,.78+Math.sin(a)*r];});
   for(let i=0;i<16;i++){
    const [ax,az]=rim[i],[bx,bz]=rim[(i+1)%16],color=i%2?'#c7d8de':steel;
    s.emissive=.32;
    for(const cy of [1.08,1.12]){const v=[[x+1.13,y+cy,.78],[ax,y+cy,az],[bx,y+cy,bz]];s.face(cy===1.08?v.reverse():v,color,false);}
    s.emissive=.85;
    s.face([[ax,y+1.08,az],[bx,y+1.08,bz],[bx,y+1.12,bz],[ax,y+1.12,az]],'#d5f0ff',false);
    s.emissive=0;
   }
   // Restrained steel glints use the night boost without becoming light sources.
   s.emissive=.85;
   for(const [cx,cz]of [[1.1,1.18],[1.49,.91]])s.box(x+cx,y+1.075,cz,.065,.05,.045,'#d5f0ff');
   s.emissive=0;
   const log=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return [y+1.1+Math.cos(a)*.14,.56+Math.sin(a)*.14];});
   s.emissive=.12;
   for(let i=0;i<8;i++){const [ay,az]=log[i],[by,bz]=log[(i+1)%8];s.face([[x+.28,ay,az],[x+1.13,ay,az],[x+1.13,by,bz],[x+.28,by,bz]],i%2?'#b88b60':'#d5aa76',false);}
   s.emissive=.85;
   for(const cx of [.28,1.13]){const v=log.map(([cy,z])=>[x+cx,cy,z]);s.face(cx===.28?v.reverse():v,'#ffecc3',false);}
   s.emissive=.5;
   const contact=[[x+1.06,y+1.245,.57],[x+1.06,y+1.245,.65],[x+1.14,y+1.245,.65],[x+1.14,y+1.245,.57]];
   s.face(contact,'#fff0c8',false);s.face([...contact].reverse(),'#fff0c8',false);
   const drive=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return [x+1.68+Math.cos(a)*.24,y+1.26,.46+Math.sin(a)*.24];});
   s.emissive=.5;
   s.face(drive,'#d6e8ee',false);s.face([...drive].reverse(),'#d6e8ee',false);
   s.emissive=.15;
   const inset=drive.map(([cx,cy,cz])=>[x+1.68+(cx-x-1.68)*.72,cy+.008,.46+(cz-.46)*.72]);
   s.face(inset,'#7d959f',false);s.face([...inset].reverse(),'#7d959f',false);
   s.emissive=.85;s.box(x+1.63,y+1.27,.41,.1,.1,.1,'#d5f0ff');
   // Two belt runs meet the blade axle and the exposed lower drive wheel.
   s.emissive=.3;
   for(const [az,bz]of [[.87,.7],[.69,.22]]){const v=[[x+1.13,y+1.28,az],[x+1.68,y+1.28,bz],[x+1.68,y+1.28,bz+.035],[x+1.13,y+1.28,az+.035]];s.face(v,'#f0cf94',false);s.face([...v].reverse(),'#f0cf94',false);}
   s.emissive=0;
   s.box(x+1.08,y+1.12,.735,.1,.2,.09,trim);
   for(let i=0;i<3;i++)s.box(x+.25,y+.3+i*.18,.13,.69,.13,.13,i===1?'#cba46d':wood);
    if(l>=2){s.box(x+n-.48,y+.42,.14,.18,.18,1.2,frame);s.box(x+n-.48,y+.42,1.2,.54,.12,.1,trim);s.box(x+n-.06,y+.42,.55,.065,.065,.66,steel);}
    if(l>=4){for(let i=0;i<2;i++)s.box(x+.25,y+.3+i*.18,.26,.69,.13,.1,i%2?'#cba46d':wood);}
    if(l>=5){s.box(x+.12,y+.62,.13,.5,.12,.12,'#c79861');s.box(x+.16,y+.66,.25,.42,.08,.06,frame);}
    if(l>=6){s.box(x+n-.5,y+.2,.13,.07,.07,.9,frame);s.box(x+n-.5,y+.2,.9,.42,.07,.07,frame);lanternPost(s,x+.5,y+.3,.7,1,.42);}
   lanternPost(s,x+.24,y+n-.26,.82,2.2,1.4);
   return;
 }
  if(t==='mill'){
   const bx=x+.3,by=y+.3,w=n-.6,h=.7+l*.13,rise=.35+l*.08,frame='#604632',base='#c9cec1';
   s.emissive=.2;
   s.box(bx,by,.36,w,w,h-.36,'#fff3df',false);
   // Chunky footing joints and flat fascia replace detail with broad material contrast.
   s.emissive=.42;
   for(let i=0;i<3;i++){
    const a=bx+i*w/3,c=by+i*w/3,d=w/3-.024,color=i%2?'#aab6ab':base;
    s.face([[a,by-.025,.08],[a+d,by-.025,.08],[a+d,by-.025,.36],[a,by-.025,.36]],color,false);
    s.face([[a,by+w+.025,.08],[a,by+w+.025,.36],[a+d,by+w+.025,.36],[a+d,by+w+.025,.08]],color,false);
    s.face([[bx-.025,c,.08],[bx-.025,c,.36],[bx-.025,c+d,.36],[bx-.025,c+d,.08]],color,false);
    s.face([[bx+w+.025,c,.08],[bx+w+.025,c+d,.08],[bx+w+.025,c+d,.36],[bx+w+.025,c,.36]],color,false);
   }
   s.emissive=0;
   s.roof(bx-.09,by-.09,h+.1,w+.18,w+.18,rise,'#338b50');
   for(const yy of [by-.09,by+w+.09]){const v=[[bx-.09,yy,h],[bx+w+.09,yy,h],[bx+w+.09,yy,h+.1],[bx-.09,yy,h+.1]];s.face(yy===by-.09?v:v.reverse(),frame,false);}
   for(const xx of [bx-.09,bx+w+.09]){const v=[[xx,by-.09,h],[xx,by-.09,h+.1],[xx,by+w+.09,h+.1],[xx,by+w+.09,h]];s.face(xx===bx-.09?v:v.reverse(),frame,false);}
   windows(s,bx,by,w,w,h);
   s.box(bx+w/2-.035,by-.11,h+.1+rise,.07,w+.22,.055,frame);
   const frameBias=s.depthBias;s.depthBias+=.14;
   for(const dx of [0,w-.055])for(const dy of [0,w-.055])s.box(bx+dx-.012,by+dy-.012,.1,.09,.09,h-.1,frame,false);
   for(const yy of [by-.008,by+w+.008]){const v=[[bx+w*.5-.045,yy,.28],[bx+w*.5+.045,yy,.28],[bx+w*.5+.045,yy,h],[bx+w*.5-.045,yy,h]];s.face(yy<by?v:v.reverse(),frame,false);}
   for(const xx of [bx-.008,bx+w+.008]){const v=[[xx,by+w*.5-.045,.28],[xx,by+w*.5-.045,h],[xx,by+w*.5+.045,h],[xx,by+w*.5+.045,.28]];s.face(xx<bx?v:v.reverse(),frame,false);}
   s.depthBias=frameBias;
   s.box(bx+w*.36,by+w+.025,.1,w*.3,.13,.065,base);
   if(s.r.cam.zoom>=1.3){
    s.box(bx+w*.37,by+w+.027,.58,w*.28,.035,.055,frame);
    s.box(bx+w*.57,by+w+.042,.3,.025,.018,.04,gold);
    const bias=s.depthBias;s.depthBias+=.125;
    for(const f of [.18,.72]){const ww=Math.min(.18,w*.15);
     for(const dy of [-.032,w+.034])s.box(bx+w*f+ww*.45,by+dy,h*.54,.025,.016,.19,frame);
     for(const dx of [-.032,w+.034])s.box(bx+dx,by+w*f+ww*.45,h*.54,.016,.025,.19,frame);
    }
    s.depthBias=bias;
   }
   if(l>=2){s.box(bx+w*.75,by+w*.2,h,.18,.18,.75,base);s.box(bx+w*.75-.025,by+w*.2-.025,h+.75,.23,.23,.065,'#626b70');s.chimneys.push({owner:s.owner,position:[bx+w*.75+.09,by+w*.2+.09,h+.82]});}
   // Thicken inward so the wheel retains its outer envelope and open timber bays.
   const z=.73,cx=x+n+.08,cy=y+n*.5,radius=.58,inner=.36;
   s.emissive=.32;
   s.box(bx+w-.04,cy-.075,z-.075,cx-(bx+w)+.23,.15,.15,'#d5a366');
   s.emissive=.42;
   for(const dy of [-.3,.22])s.box(cx+.09,cy+dy,.08,.12,.12,z-.08,base);
   const p=(xx,r,a)=>[xx,cy+Math.cos(a)*r,z+Math.sin(a)*r];
   for(let i=0;i<8;i++){
    const a=i*Math.PI/4,b=a+Math.PI/4;
    s.emissive=.48;
    for(const xx of [cx-.13,cx+.13]){
     const rim=[p(xx,radius,a),p(xx,radius,b),p(xx,inner,b),p(xx,inner,a)];
     s.face(xx<cx?rim.reverse():rim,i%2?'#d7a469':'#bd824a',false);
     if(i%2===0){const spoke=[p(xx,.14,a-.5),p(xx,inner,a-.22),p(xx,inner,a+.22),p(xx,.14,a+.5)];s.face(xx<cx?spoke.reverse():spoke,'#e4b477',false);}
    }
    s.emissive=.28;
    s.face([p(cx-.13,inner,b),p(cx+.13,inner,b),p(cx+.13,inner,a),p(cx-.13,inner,a)],'#986035',false);
    s.emissive=.55;
    s.face([p(cx-.13,radius,a),p(cx+.13,radius,a),p(cx+.13,radius,b),p(cx-.13,radius,b)],'#e0b57e',false);
    s.emissive=.38;
    s.face([p(cx-.16,radius-.05,a-.23),p(cx+.16,radius-.05,a-.23),p(cx+.16,radius+.07,a-.23),p(cx-.16,radius+.07,a-.23)],'#d59a5b',false);
    s.face([p(cx-.16,radius+.07,a+.23),p(cx+.16,radius+.07,a+.23),p(cx+.16,radius-.05,a+.23),p(cx-.16,radius-.05,a+.23)],'#b67b43',false);
    s.emissive=.58;
    s.face([p(cx-.16,radius+.07,a-.23),p(cx+.16,radius+.07,a-.23),p(cx+.16,radius+.07,a+.23),p(cx-.16,radius+.07,a+.23)],'#e8ba7c',false);
   }
   s.emissive=.48;
   s.box(cx-.13,cy-.15,z-.15,.3,.3,.3,'#d6a064',false);
   s.emissive=0;
    s.pyramid(x+.58,y+.54,1.15,.27,.38,'#d5b477');
   for(let i=0;i<2;i++)s.box(x+.19+i*.36,y+n-.42,.14,.3,.27,.24,'#decaa0');
    if(l>=4){s.box(cx+.06,cy-.32,.08,.18,.64,.1,base);}
   if(l>=5){for(let i=0;i<3;i++)s.box(x+.19+i*.24,y+n-.42,.14,.2,.2,.2,'#decaa0');}
   if(l>=6){lanternPost(s,x+.3,y+.4,.7,1,.42);s.box(x+n*.4,y+.2,.9,.2,.06,.3,l>=3?gold:stone);}
   return;
 }
 if(t==='longhouse'){
  longhouseShape(s,b,n);
   if(l>=2){
    for(const side of [x+.53,x+n-.63])s.box(side,y+.46,.13,.085,n-.92,.55,l>=3?stone:LH_FRAME);
    s.box(x+n*.38,y+.42,.67,n*.24,.48,.55,stone);
    s.roof(x+n*.37,y+.4,1.22,n*.26,.53,.24,LH_ROOF);
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
     for(const side of [x+.3,x+n-.85]){s.box(side,y+.7,.12,.55,n-1.4,.5,stone);s.roof(side-.05,y+.65,.62,.65,n-1.3,.18,LH_ROOF);}
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
   s.box(x+.18,y+n-.72,.13,.26,.22,.18,'#d8c98f');
   s.box(x+.46,y+n-.7,.13,.22,.2,.16,'#cbb87e');
   s.box(x+n-.62,y+.5,.5,.3,.34,.08,'#8d6844');
   s.box(x+n-.62,y+.84,.24,.3,.34,.08,'#a1744a');
   s.box(x+.22,y+n-.46,.46,.42,.3,.09,timber);
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
   if(t==='tannery'){
    const srcBefore=s.sources.length;
    const bx=x+.1,by=y+.06,w=n-.2,d=.56,h=.5+l*.06,rise=.3+l*.05,frame='#513824',base='#b9b9a8';
    s.box(bx,by,.1,w,d,h-.1,'#eee7d6',false);
    // Unsplit footing blocks and fascia trade tiny post subdivisions for bold joins.
    for(let i=0;i<3;i++){
     const a=bx+i*w/3,c=by+i*d/3,ds=d/3-.018,color=i%2?'#9ca29a':base;
     s.face([[a,by-.018,.1],[a+ds,by-.018,.1],[a+ds,by-.018,.25],[a,by-.018,.25]],color,false);
     s.face([[a,by+d+.018,.1],[a,by+d+.018,.25],[a+ds,by+d+.018,.25],[a+ds,by+d+.018,.1]],color,false);
     s.face([[bx-.018,c,.1],[bx-.018,c,.25],[bx-.018,c+ds,.25],[bx-.018,c+ds,.1]],color,false);
     s.face([[bx+w+.018,c,.1],[bx+w+.018,c+ds,.1],[bx+w+.018,c+ds,.25],[bx+w+.018,c,.25]],color,false);
    }
    s.roof(bx-.09,by-.09,h+.1,w+.18,d+.18,rise,'#c58c28');
    for(const yy of [by-.09,by+d+.09]){const v=[[bx-.09,yy,h],[bx+w+.09,yy,h],[bx+w+.09,yy,h+.1],[bx-.09,yy,h+.1]];s.face(yy<by?v:v.reverse(),frame,false);}
    for(const xx of [bx-.09,bx+w+.09]){const v=[[xx,by-.09,h],[xx,by-.09,h+.1],[xx,by+d+.09,h+.1],[xx,by+d+.09,h]];s.face(xx<bx?v:v.reverse(),frame,false);}
    windows(s,bx,by,w,d,h);
    s.box(bx+w/2-.035,by-.11,h+.1+rise,.07,d+.22,.055,frame);
    const bias=s.depthBias;s.depthBias+=.14;
    for(const xx of [bx-.012,bx+w-.067])for(const yy of [by-.012,by+d-.067]){
     const p=[[xx,yy,.1],[xx+.075,yy,.1],[xx+.075,yy+.075,.1],[xx,yy+.075,.1],[xx,yy,h+.1],[xx+.075,yy,h+.1],[xx+.075,yy+.075,h+.1],[xx,yy+.075,h+.1]];
     for(const f of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]])s.face(f.map(i=>p[i]),frame,false);
    }
    s.depthBias=bias;
    s.box(bx+w*.36,by+d+.025,.1,w*.3,.13,.065,base);
    if(s.r.cam.zoom>=1.3){
     s.box(bx+w*.37,by+d+.027,.58,w*.28,.035,.055,frame);
     s.box(bx+w*.57,by+d+.042,.3,.025,.018,.04,gold);
     s.depthBias+=.125;
     for(const f of [.18,.72]){const ww=Math.min(.18,w*.15);
      for(const dy of [-.032,d+.034])s.box(bx+w*f+ww*.45,by+dy,h*.54,.024,.016,.19,frame);
      for(const dx of [-.032,w+.034])s.box(bx+dx,by+d*f+ww*.45,h*.54,.016,.024,.19,frame);
     }
     s.depthBias=bias;
    }
    if(l>=2){s.box(bx+w*.75,by+d*.2,h,.18,.18,.75,base);s.box(bx+w*.75-.025,by+d*.2-.025,h+.75,.23,.23,.065,'#626b70');s.chimneys.push({owner:s.owner,position:[bx+w*.75+.09,by+d*.2+.09,h+.82]});}
    // Tiers add yard equipment, not wall height: a widened, squat shop mass with
    // racks and vats filling the work yard out front.
    const yardY=by+d+.06;
    if(l>=1)detailVat(s,x+.62,yardY,.13,.17);
    if(l>=2)detailHideRack(s,x+.08,yardY+.02,.13,.5,2);
    if(l>=3)detailVat(s,x+.3,yardY+.05,.13,.15);
     if(l>=4)detailHideRack(s,x+.36,yardY-.02,.13,.48,3);
    // Soften the window spill wedges on this building only.
    for(const o of s.sources.slice(srcBefore)){o.radius*=.72;o.power*=.78;}
    workplaceDetails(s,b,n);
    return;
   }
   if(t==='bakery'){
    const bx=x+.22,by=y+.22,w=n-.44,h=.42+l*.16,rise=.35+l*.08,frame='#513824',base='#b9b9a8';
    const subdivision=s.subdivision;s.subdivision=.6;
    s.box(bx,by,.1,w,w,h-.1,'#eee7d6',false);s.subdivision=subdivision;
    // Broad footing blocks and unsplit joinery keep the oven inside the face budget.
    for(let i=0;i<2;i++){
     const a=bx+i*w/2,c=by+i*w/2,d=w/2-.018,color=i%2?'#9ca29a':base;
     s.face([[a,by-.018,.1],[a+d,by-.018,.1],[a+d,by-.018,.25],[a,by-.018,.25]],color,false);
     s.face([[a,by+w+.018,.1],[a,by+w+.018,.25],[a+d,by+w+.018,.25],[a+d,by+w+.018,.1]],color,false);
     s.face([[bx-.018,c,.1],[bx-.018,c,.25],[bx-.018,c+d,.25],[bx-.018,c+d,.1]],color,false);
     s.face([[bx+w+.018,c,.1],[bx+w+.018,c+d,.1],[bx+w+.018,c+d,.25],[bx+w+.018,c,.25]],color,false);
    }
    s.roof(bx-.09,by-.09,h+.1,w+.18,w+.18,rise,'#b94e3e');
    for(const yy of [by-.09,by+w+.09]){const v=[[bx-.09,yy,h],[bx+w+.09,yy,h],[bx+w+.09,yy,h+.1],[bx-.09,yy,h+.1]];s.face(yy<by?v:v.reverse(),frame,false);}
    for(const xx of [bx-.09,bx+w+.09]){const v=[[xx,by-.09,h],[xx,by-.09,h+.1],[xx,by+w+.09,h+.1],[xx,by+w+.09,h]];s.face(xx<bx?v:v.reverse(),frame,false);}
    windows(s,bx,by,w,w,h);
    const ridgeX=bx+w/2-.035,ridgeY=by-.11,ridgeZ=h+.1+rise;
    const ridge=[[ridgeX,ridgeY,ridgeZ],[ridgeX+.07,ridgeY,ridgeZ],[ridgeX+.07,ridgeY+w+.22,ridgeZ],[ridgeX,ridgeY+w+.22,ridgeZ],[ridgeX,ridgeY,ridgeZ+.055],[ridgeX+.07,ridgeY,ridgeZ+.055],[ridgeX+.07,ridgeY+w+.22,ridgeZ+.055],[ridgeX,ridgeY+w+.22,ridgeZ+.055]];
    for(const f of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]])s.face(f.map(i=>ridge[i]),frame,false);
    const bias=s.depthBias;s.depthBias+=.14;
    for(const xx of [bx-.012,bx+w-.067])for(const yy of [by-.012,by+w-.067]){
     const p=[[xx,yy,.1],[xx+.075,yy,.1],[xx+.075,yy+.075,.1],[xx,yy+.075,.1],[xx,yy,h+.1],[xx+.075,yy,h+.1],[xx+.075,yy+.075,h+.1],[xx,yy+.075,h+.1]];
     for(const f of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]])s.face(f.map(i=>p[i]),frame,false);
    }
    s.depthBias=bias;
    s.box(bx+w*.36,by+w+.025,.1,w*.3,.13,.065,base);
    if(s.r.cam.zoom>=1.3){
     s.box(bx+w*.37,by+w+.027,.58,w*.28,.035,.055,frame);
     s.depthBias+=.125;
     for(const f of [.18,.72]){const ww=Math.min(.18,w*.15);
      for(const dy of [-.032,w+.034])s.box(bx+w*f+ww*.45,by+dy,h*.54,.024,.016,.19,frame);
      for(const dx of [-.032,w+.034])s.box(bx+dx,by+w*f+ww*.45,h*.54,.016,.024,.19,frame);
     }
     s.depthBias=bias;
    }
    if(l>=2){s.box(bx+w*.75,by+w*.2,h,.18,.18,.75,base);s.box(bx+w*.75-.025,by+w*.2-.025,h+.75,.23,.23,.065,'#626b70');if(s.alpha===1)s.chimneys.push({owner:s.owner,position:[bx+w*.75+.09,by+w*.2+.09,h+.82]});}
    const ox=bx+w*.4-.035,oy=by+w+.045,ow=w*.22+.07;
    s.box(ox,oy,.17,ow,.17,.36,base);
    s.depthBias+=.15;
    s.face([[ox+.025,oy+.174,.2],[ox+ow-.025,oy+.174,.2],[ox+ow-.025,oy+.174,.43],[ox+ow*.75,oy+.174,.48],[ox+ow*.25,oy+.174,.48],[ox+.025,oy+.174,.43]].reverse(),'#30271f',false);
    s.emissive=s.alpha===1?1:0;
    s.depthBias+=.08;
    s.face([[ox+.045,oy+.178,.22],[ox+ow-.045,oy+.178,.22],[ox+ow-.045,oy+.178,.4],[ox+ow*.7,oy+.178,.45],[ox+ow*.3,oy+.178,.45],[ox+.045,oy+.178,.4]].reverse(),'#f39535',false);
    s.depthBias+=.08;
    s.face([[ox+.06,oy+.18,.22],[ox+ow-.06,oy+.18,.22],[ox+ow-.06,oy+.18,.29],[ox+.06,oy+.18,.29]].reverse(),'#ffe1a0',false);
    s.emissive=0;s.depthBias=bias;
    s.source([ox+ow/2,oy+.18,.34],[0,1],1.3,.7,'fire');
    const rx=bx+w*.73,ry=by+w+.055;
    for(const dx of [0,w*.23])s.box(rx+dx,ry,.13,.045,.045,.38,frame);
    for(const z of s.r.cam.zoom>=1.3?[.26,.46]:[.26]){
     s.box(rx,ry,z,w*.23+.045,.14,.035,frame);
     for(const dx of [w*.06,w*.17])s.pyramid(rx+dx,ry+.07,z+.035,.045,.065,'#d9a45e',5);
    }
    return;
   }
   // Civic works read as themselves, never dwellings: a lantern row is a
   // lamp-post curb with a keeper shelter, the road office stages curb
   // stones and survey stakes, the wall office raises a demonstration wall
   // run, and the citadel is a keep with wings and a crown.
   if(t==='lantern-rows'){
    const curb='#9ca29a',frame='#725039',fine=s.r.cam.zoom>=1.65;
    s.box(x+.2,y+.2,.12,n-.4,n-.4,.1,curb);
    const posts=l>=6?4:l>=4?3:2;
    for(let i=0;i<posts;i++){const px=x+.42+i*(n-.84)/Math.max(1,posts-1),pz=.5+l*.06;
     if(l>=6)lanternPost(s,px,y+n*.5,pz,1,.42);
     else{s.box(px-.035,y+n*.5-.035,.12,.07,.07,Math.max(.18,pz-.18),timber);s.box(px-.09,y+n*.5-.09,pz-.1,.18,.18,.08,'#4d514b');}
    }
    for(const [px,py]of[[x+n-.62,y+.1],[x+n-.2,y+.1],[x+n-.62,y+.66],[x+n-.2,y+.66]])s.box(px,py,.12,.06,.06,.5,frame);
    s.roof(x+n-.66,y+.04,.6,.62,.7,.12,'#8a6a48');
    if(l>=6&&fine)s.box(x+.42,y+n*.5-.03,.95,.06,.06,.06,gold);
    workplaceDetails(s,b,n);return;
   }
   if(t==='stone-road'){
    const curb='#9ca29a',frame='#725039',fine=s.r.cam.zoom>=1.65;
    s.face([[x+.2,y+.2,.13],[x+n-.2,y+.2,.13],[x+n-.2,y+n-.2,.13],[x+.2,y+n-.2,.13]],'#8a7354',false);
    const stacks=l>=5?3:l>=3?2:1;
    for(let i=0;i<stacks;i++){const sx=x+.3+i*.5;s.box(sx,y+.35,.13,.34,.3,.22+l*.04,curb);s.box(sx+.04,y+.39,.35+l*.04,.26,.22,.09,'#7d869e');}
    for(const [ax,ay]of[[.5,1.35],[1.5,.6]]){for(const o of[-.09,0,.09])s.box(x+ax+o,y+ay,.13,.05,.05,.7,frame);s.box(x+ax-.14,y+ay-.02,.6,.36,.04,.05,frame);}
    if(l>=4){s.box(x+.25,y+n-.5,.13,n-.5,.12,.1,curb);s.box(x+.25,y+.38,.13,n-.5,.12,.1,curb);}
    if(l>=6&&fine)s.box(x+n*.5-.04,y+n*.5-.04,.5,.08,.08,.3,gold);
    workplaceDetails(s,b,n);return;
   }
   if(t==='city-wall'){
    const specStone='#9ca29a',frame='#725039',fine=s.r.cam.zoom>=1.65,h=.5+l*.14;
    s.box(x+.3,y+.3,.1,n-.6,n-.6,.16,specStone);
    s.box(x+.55,y+.55,.12,.9,.9,h,l>=2?specStone:'#8a6f4d');
    for(let i=0;i<(l>=5?4:l>=3?3:2);i++)s.box(x+.55+i*.42,y+.55,h+.12,.2,.9,.2,l>=4?specStone:'#8a6f4d');
    for(const bx of [x+.4,x+n-.55]){s.box(bx,y+.7,.12,.12,.6,h*.7,frame);s.box(bx-.03,y+.68,h*.5,.18,.64,.08,frame);}
    if(l>=6&&fine)s.box(x+.9,y+.9,h+.2,.2,.2,.3,gold);
    workplaceDetails(s,b,n);return;
   }
   if(t==='manner-citadel'){
    const specStone='#9ca29a',frame='#725039',fine=s.r.cam.zoom>=1.65,kh=.9+l*.3;
    s.box(x+.2,y+.2,.1,n-.4,n-.4,.18,specStone);
    s.box(x+n*.32,y+n*.32,.12,n*.36,n*.36,kh,specStone);
    s.box(x+n*.32,y+n*.32,kh+.12,n*.36,n*.36,.22,l>=3?'#eee7d6':'#8a6f4d');
    for(const [ax,ay]of[[n*.32,n*.32],[n*.32+n*.36-.3,n*.32],[n*.32,n*.32+n*.36-.3],[n*.32+n*.36-.3,n*.32+n*.36-.3]])s.box(x+ax,y+ay,kh+.12,.3,.3,.3,specStone);
    s.box(x+n*.42,y+n-.28,.12,n*.16,.3,kh*.62,'#3a2f26');
    if(l>=2){for(const wx of [x+.14,x+n-.5]){s.box(wx,y+.5,.12,.36,n-1,.55,specStone);s.roof(wx-.04,y+.45,.67,.44,n-.9,.2,'#60897b');}}
    if(l>=4&&fine){s.box(x+n*.32,y+n*.32,kh+.42,n*.36,n*.36,.07,gold);s.box(x+n*.5-.04,y+n*.5-.04,kh+.49,.08,.08,.4,gold);}
    lanternPost(s,x+.3,y+.3,.7,1,.42);lanternPost(s,x+n-.3,y+n-.3,.7,1,.42);
    workplaceDetails(s,b,n);return;
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
  // Tier trade props, detail zoom only: a plank yard ramp, labeled crates in
  // the loading bay and a row of banded casks, so a far view stays cheap.
  if(l>=2&&s.r.cam.zoom>=1.2){
   const rx=x+n*.36,ry=y+n-.01,rw=n*.28;
   for(const [dy,zz] of [[0,.23],[.07,.19],[.13,.155]]){
    const z=zz+.012;
    s.face([[rx,ry+dy,z],[rx+rw,ry+dy,z],[rx+rw,ry+dy+.03,z-.018],[rx,ry+dy+.03,z-.018]],dy?'#7c5c39':timber,false);
   }
  }
  if(l>=3&&s.r.cam.zoom>=1.2){
   const bias=s.depthBias,bx=x+n*.34,by=y+n-.15;s.depthBias=bias+.05;
   for(const [i,tone] of ['#9c7449','#87613c','#a9824f'].entries()){
    const cx=bx+(i===1?.3:0),cz=i===2?.45:.23;
    s.box(cx,by,cz,.28,.2,.22,tone);
    s.face([[cx+.05,by+.202,cz+.055],[cx+.05,by+.202,cz+.145],[cx+.23,by+.202,cz+.145],[cx+.23,by+.202,cz+.055]],'#ded0ae',false);
   }
   s.depthBias=bias;
  }
  if(l>=4&&s.r.cam.zoom>=1.2)for(const cy of [y+n*.26,y+n*.38])bandedCask(s,x+n-.11,cy,.13);
 }
 workplaceDetails(s,b,n);
 if(spec.housing)homeDetails(s,b,n,l);
 if(['forge','smeltery'].includes(t)){s.box(x+n-.55,y+.28,.1,.28,.28,1.5,stone);s.box(x+n-.57,y+.26,1.6,.32,.32,.12,'#4d514b');s.chimneys.push({owner:s.owner,position:[x+n-.41,y+.42,1.73]});s.source([x+.5,y+n-.15,.33],[0,1],1.65,1,'fire');s.emissive=1;s.box(x+.3,y+n-.2,.2,.4,.024,.26,'#eea55d');s.emissive=0;}
 if(t==='smeltery'){
  const cy=y+n-.22,bias=s.depthBias;s.depthBias+=.12;
  s.box(x+.24,cy-.05,.18,.5,.1,.34,'#3a3430');
  s.emissive=1;
  s.face([[x+.28,cy+.051,.24],[x+.28,cy+.051,.44],[x+.68,cy+.051,.44],[x+.68,cy+.051,.24]],'#ff6a1a',false);
  s.face([[x+.34,cy+.055,.28],[x+.34,cy+.055,.38],[x+.62,cy+.055,.38],[x+.62,cy+.055,.28]],'#ffd23e',false);
  s.emissive=0;s.depthBias=bias;
  s.pyramid(x+1.55,y+.75,.12,.16,.18,'#7d766c',5);
  s.pyramid(x+1.72,y+.68,.12,.12,.14,'#8a5a3b',5);
  if(l>=4)s.pyramid(x+.35,y+.35,.12,.14,.16,'#6f675f',5);
  s.face([[x+.46,cy+.06,.12],[x+.54,cy+.06,.12],[x+.54,y+n-.05,.12],[x+.46,y+n-.05,.12]],'#5a524c',false);
  s.emissive=1;
  s.face([[x+.48,cy+.065,.125],[x+.52,cy+.065,.125],[x+.52,y+n-.07,.125],[x+.48,y+n-.07,.125]],'#ff8c2e',false);
  s.emissive=0;
 }
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
  if(t==='schoolroom')schoolroomProps(s,b,n,l);
  if(t==='scriptorium')scriptoriumProps(s,b,n,l);
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
 s.characterDetail=world.troops.length+world.enemies.length<=64&&r.cam.zoom>=(r.qualityCfg?.fullAnimAbove??1.5);
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
