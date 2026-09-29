// Original low-poly village geometry, projected by the shared orbit camera.
// The game simulation stays in ground tiles; meshes add height only for display.
import {prepareSourceLighting,drawSourceSpill} from './source-lighting.js';
import {cameraBasis} from './camera.js';
import {characterModel} from './character-art.js';
import {isWall,wallNeighbors} from './building-art.js';
import {placementCells} from './systems/walls.js';
import {DAY_LENGTH,skyLightAt} from './systems/daynight.js';
import {reserveCapacity,reserveReady} from './resources.js';
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
 constructor(r){this.r=r;this.faces=[];this.sources=[];this.owner=null;this.alpha=1;this.depthBias=0;this.light=FALLBACK_LIGHT;this.emissive=0;this.fixture=false;this.basis=cameraBasis(r);}
 source(position,direction=null,radius=1.25,power=.7){
  if(this.alpha===1)this.sources.push({position,direction,radius,power,owner:this.owner});
 }
 face(vertices,color,split=true){
  // Split broad roof/wall planes so chimneys and neighboring meshes occlude
  // correctly even at low camera angles (painter ordering uses face centers).
  if(split&&vertices.length===4){const [a,b,c,d]=vertices,dist=(u,v)=>Math.hypot(...u.map((n,i)=>n-v[i])),nx=Math.ceil(dist(a,b)/.4),ny=Math.ceil(dist(a,d)/.4);if(nx*ny>1){const point=(u,v)=>a.map((n,i)=>(1-v)*((1-u)*n+u*b[i])+v*((1-u)*d[i]+u*c[i]));for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)this.face([point(i/nx,j/ny),point((i+1)/nx,j/ny),point((i+1)/nx,(j+1)/ny),point(i/nx,(j+1)/ny)],color,false);return;}}

  const a=vertices[0],b=vertices[1],c=vertices[2],u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const len=Math.hypot(...n);if(len<1e-8)return;n=n.map(x=>x/len);
  const B=this.basis;if(n[0]*B.s*B.v+n[1]*B.c*B.v+n[2]*B.p<=.00001)return;
  const points=vertices.map(p=>this.r.project(...p));if(points.every(p=>p.x<-60)||points.every(p=>p.x>this.r.width+60)||points.every(p=>p.y<-80)||points.every(p=>p.y>this.r.height+60))return;
  const zAvg=vertices.reduce((sum,p)=>sum+p[2],0)/vertices.length;
  this.faces.push({points,color,center:vertices[0].map((_,i)=>vertices.reduce((sum,p)=>sum+p[i],0)/vertices.length),normal:n,emissive:this.emissive,fixture:this.fixture,ao:Math.min(1,AO_MIN+(1-AO_MIN)*Math.max(0,zAvg/AO_HEIGHT)),depth:vertices.reduce((sum,p)=>sum+this.r.depth(...p),0)/vertices.length+this.depthBias,owner:this.owner,alpha:this.alpha});
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
function gateLiftStage(r,b,world,time){
 let threatened=false;if(b.hp>0&&!(b.remaining>0))for(const e of world.enemies||[])if(e.hp>0&&Math.hypot(e.x-b.x-.5,e.y-b.y-.5)<=1.4){threatened=true;break;}
 const target=threatened?0:GATE_STAGES;
 if(b.id==null)return target;
 const now=Number.isFinite(time)?time:0;
 let motions=r._gateMotion,motion=motions?.get(b.id);
 if(r.calm){if(motion){motion.stage=motion.from=motion.to=target;motion.started=now;}return target;}
 if(!motions)motions=r._gateMotion=new Map();
 motion=motions.get(b.id);
 if(!motion){motion={stage:target,from:target,to:target,started:now};motions.set(b.id,motion);}
 else if(motion.to!==target){motion.from=motion.stage;motion.to=target;motion.started=now;}
 const progress=Math.max(0,Math.min(1,(now-motion.started)/GATE_MOVE_MS));
 motion.stage=Math.round(motion.from+(motion.to-motion.from)*progress);
 return motion.stage;
}
function trapArmed(b){return b.hp>0&&!(b.remaining>0)&&!(Number.isFinite(+b.cooldown)&&+b.cooldown>0);}
function fence(s,x,y,w,d,color=timber){for(let i=0;i<=w;i+=.45){s.box(x+i,y,.05,.09,.09,.45,color);s.box(x+i,y+d-.09,.05,.09,.09,.45,color);}for(let j=.4;j<d;j+=.45){s.box(x,y+j,.05,.09,.09,.45,color);s.box(x+w-.09,y+j,.05,.09,.09,.45,color);}s.box(x,y,.23,w,.055,.07,color);s.box(x,y+d-.06,.23,w,.055,.07,color);s.box(x,y,.23,.055,d,.07,color);s.box(x+w-.06,y,.23,.055,d,.07,color);}
function torch(s,x,y,z,direction=null,radius=.95,power=.5){
 const dx=direction?.[0]||0,dy=direction?.[1]||0,fixture=s.fixture;s.fixture=true;
 s.box(x-.025-dx*.06,y-.025-dy*.06,z-.22,.05,.05,.23,'#594737');
 s.box(x-.04-dx*.02,y-.04-dy*.02,z-.03,.08,.08,.05,'#41372f');
 s.emissive=1;s.pyramid(x,y,z,.075,.16,'#f2b35c',5);s.emissive=0;s.fixture=fixture;
 s.source([x,y,z+.08],direction,radius,power);
}
function lanternPost(s,x,y,z=.72,radius=1.05,power=.46){
 const fixture=s.fixture;s.fixture=true;
 s.box(x-.035,y-.035,.12,.07,.07,Math.max(.18,z-.18),timber);
 s.box(x-.09,y-.09,z-.1,.18,.18,.08,'#4d514b');
 s.emissive=1;s.box(x-.05,y-.05,z-.025,.1,.1,.11,'#ffd58b');s.emissive=0;s.fixture=fixture;
 s.source([x,y,z+.035],null,radius,power);
}
function pine(s,x,y,height=1.7,cold=false){s.box(x-.045,y-.045,0,.09,.09,height*.65,'#73543c');for(let i=0;i<3;i++)s.pyramid(x,y,height*(.23+i*.21),height*(.31-i*.055),height*.53,cold?['#598c83','#80b8ae','#b6ded0'][i]:['#315d43','#477953','#699358'][i],6);}
function tower(s,x,y,size,h,color=stone){s.box(x,y,.12,size,size,h,color);s.box(x-.08,y-.08,h+.1,size+.16,size+.16,.16,color);for(const [dx,dy]of[[0,0],[size-.16,0],[0,size-.16],[size-.16,size-.16]])s.box(x+dx-.025,y+dy-.025,h+.26,.21,.21,.23,color);s.box(x+size*.38,y+size+.006,h*.48,size*.2,.012,.27,'#324a41');s.box(x+size+.006,y+size*.38,h*.48,.012,size*.2,.27,'#324a41');}
function windows(s,x,y,w,d,h){
 // Shallow facade pieces sit on broad wall faces. A small ordering offset
 // avoids their being cut up by the wall's face-center painter sort.
 const bias=s.depthBias;s.depthBias+=.12;
 // Register each pane at the same world position as its visible geometry.
 s.emissive=1;
 for(const f of [.18,.72]){const z=h*.54,ww=Math.min(.18,w*.15);s.source([x+w*f+ww/2,y+d+.05,z+.095],[0,1]);s.source([x+w*f+ww/2,y-.05,z+.095],[0,-1]);s.source([x-.05,y+d*f+ww/2,z+.095],[-1,0]);s.source([x+w+.05,y+d*f+ww/2,z+.095],[1,0]);s.box(x+w*f,y+d+.008,z,ww,.024,.19,'#ffe6ab');s.box(x+w*f,y-.025,z,ww,.024,.19,'#ffe6ab');s.box(x-.025,y+d*f,z,.024,ww,.19,'#ffe6ab');s.box(x+w+.008,y+d*f,z,.024,ww,.19,'#ffe6ab');}
 s.emissive=0;s.box(x+w*.4,y+d+.01,.1,w*.22,.026,.48,'#5b4735');
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
 if(chimney&&level>=2){s.box(x+w*.75,y+d*.2,h,.18,.18,.75,stone);s.box(x+w*.75-.025,y+d*.2-.025,h+.75,.23,.23,.065,'#786d5b');}
}

// Phase 5 — homes read by silhouette, not just paint. Cottages grow a loft
// gable with a rail (tier 2), then a porch over the door and a raised kitchen
// stack (tier 3); the longhouse is a meadhall — ridge beam, twin chimneys,
// banner and a veranda — so it out-silhouettes the cottage row at a glance.
function homeDetails(s,b,n,l){
 const x=b.x+.22,y=b.y+.22,w=n-.44,h=.42+l*.16;
 if(l>=2){
  // Loft window in the front gable, with a little rail under it.
  s.source([x+w*.44+.065,y+w+.03,h+.265],[0,1],.9,.45);s.emissive=1;s.box(x+w*.44,y+w-.028,h+.2,.13,.05,.13,'#ffe6ab');s.emissive=0;
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
  s.box(cx-.02,cy-.02,h+1.14,.22,.22,.06,'#786d5b');
 }
}

function longhouseShape(s,b,n){
 const x=b.x,y=b.y,h=.62,rise=.51,stone='#b4beb2';
 hut(s,x+.58,y+.32,n-1.15,n-.64,h,'#977851',2,false);
 // Ridge beam down the long axis ties the big roof together.
 const rx=x+.58+(n-1.15)/2;
 s.box(rx-.038,y+.34,h+.1+rise,.076,n-.68,.06,'#6b543a');
 // Twin stacks at both ends of the ridge: one would read cottage, two read hall.
 for(const cy of [y+.72,y+n-.82]){s.box(rx-.08,cy,h+.1,.16,.16,rise+.42,stone);s.box(rx-.11,cy-.03,h+.1+rise+.42,.22,.22,.06,'#786d5b');}
 // Banner over the door, then the veranda rail across the front gable.
 s.box(x+n*.5,y+n-.14,.1,.055,.055,.85,timber);s.box(x+n*.5+.05,y+n-.14,.62,.2,.025,.32,'#5e8c9b');
 for(let i=0;i<4;i++)s.box(x+.62+i*(n-1.2)/3,y+n-.16,.1,.05,.05,.4,timber);
 s.roof(x+.55,y+n-.66,.48,n-1.15,.6,.17,'#7d6142');
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
 const w=.28*scale,d=.24*scale,h=.22*scale;
 s.box(x,y,z,w,d,h,'#8d6844');
 s.box(x-.012,y-.012,z+h,w+.024,d+.024,.045,'#b88a55');
 s.box(x+w*.44,y-.018,z+.02,w*.12,d+.036,h+.06,'#604a39');
}
function detailBarrel(s,x,y,z=.12,scale=1){
 const w=.22*scale,d=.22*scale,h=.34*scale;
 s.box(x,y,z,w,d,h,'#8a6646');
 for(const dz of [.04,h-.075])s.box(x-.012,y-.012,z+dz,w+.024,d+.024,.035,'#53544e');
}
function detailSack(s,x,y,z=.12,scale=1){
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
 // Military yards: training gear should identify the job before the menu opens.
 if(t==='barracks'){
  detailRack(s,x+.18,front,.13,Math.min(.62,n-.36));
  detailTool(s,x+.26,front+.02,.18,'spear');detailTool(s,x+.48,front+.02,.18,'axe');
  const dx=x+n-.42,dy=y+.28;s.box(dx,dy,.12,.08,.08,.66,timber);s.box(dx-.12,dy-.04,.55,.32,.08,.08,'#8f7555');s.box(dx-.09,dy-.055,.35,.26,.11,.21,'#9a765a');
  if(l>=2)detailCrate(s,x+n-.48,front-.38,.12,.9);
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
  detailSack(s,x+n-.42,y+.28,.13,.9);if(l>=2)detailSack(s,x+n-.22,y+.42,.13,.82);
  if(l>=3)detailBarrel(s,x+.2,y+.25,.13,.95);
 }
 if(t==='pasture'){
  s.box(x+.28,front-.3,.13,.7,.24,.18,'#7f6445');s.box(x+.32,front-.26,.29,.62,.16,.035,'#b18b59');
  detailBarrel(s,x+n-.48,y+.28,.13,.9);
 }
 if(['lumber','timber_yard'].includes(t)){
  // Sawbuck plus a stump/axe keeps the yard readable even before its reserve pile grows.
  for(const dx of [.22,.58]){s.box(x+dx,y+n-.48,.13,.06,.3,.42,timber);s.box(x+dx-.08,y+n-.31,.35,.22,.06,.06,timber);}
  s.box(x+n-.38,y+.24,.13,.27,.27,.14,'#76593d');detailTool(s,x+n-.31,y+.3,.26,'axe');
  if(l>=2)detailCrate(s,x+.18,y+.24,.12,.9);
 }
 if(['mine','emberglass'].includes(t)){
  // Short rails and a loaded cart extend the mine entrance into the yard.
  for(const rx of [x+.33,x+.64])s.box(rx,y+.58,.13,.045,.65,.035,'#687170');
  for(let j=0;j<4;j++)s.box(x+.29,y+.62+j*.16,.125,.45,.055,.035,timber);
  s.box(x+.42,y+.34,.18,.38,.3,.24,'#6f6253');s.box(x+.46,y+.38,.41,.3,.22,.055,t==='emberglass'?'#8ecac7':'#8e846f');
  for(const wx of [x+.45,x+.7])s.box(wx,y+.62,.13,.08,.08,.12,'#414845');
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
 if(t==='market'&&fine){
  detailCrate(s,x+.28,y+n-.62,.13,.82);detailBarrel(s,x+n-.56,y+n-.58,.13,.82);detailSack(s,x+n*.5,y+n-.42,.13,.78);
 }
}

function buildingShape(s,b,spec,world,time){
 const x=b.x,y=b.y,n=spec.size,l=b.level,t=b.type;s.owner={kind:'building',id:b.id};s.alpha=b.hp<=0?.35:b.remaining>0?.6:1;
 s.box(x+.1,y+.1,0,n-.2,n-.2,.12,l>1?stone:'#9b8864');
 // Gatehouse: twin posts and a high lintel with the middle left open —
 // the hole reads as passage. Its portcullis rises at peace and lowers when
 // raiders press close; four cached stages avoid rebuilding it every frame.
 if(t==='gate'){const h=.55+l*.22,post=l===1?timber:stone,neighbors=wallNeighbors(b,world),axis=gateAxis(neighbors),lift=gateLiftStage(s.r,b,world,time)/GATE_STAGES;
  for(const [dx,dy]of neighbors){if(axis==='x'&&dx)s.box(x+(dx<0?-.1:.67),y+.4,.1,.43,.2,h-.15,post);else if(axis==='y'&&dy)s.box(x+.4,y+(dy<0?-.1:.67),.1,.2,.43,h-.15,post);}
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
  // Paired gate torches make the entrance readable from either approach.
  if(axis==='x'){torch(s,x+.26,y+.31,h*.74,[0,-1],1.08,.55);torch(s,x+.74,y+.69,h*.74,[0,1],1.08,.55);}
  else{torch(s,x+.31,y+.26,h*.74,[-1,0],1.08,.55);torch(s,x+.69,y+.74,h*.74,[1,0],1.08,.55);}
  return;}
 if(isWall(b)){const ramp=t==='rampart',h=.38+l*.17+(t==='stonewall'?.15:0)+(ramp?.12:0),color=ramp?'#8a6f4d':l>1||t==='stonewall'?stone:timber,neighbors=wallNeighbors(b,world);for(const [dx,dy]of neighbors.filter(([a,c])=>a+c<0))s.box(x+.4+Math.min(0,dx*.5),y+.4+Math.min(0,dy*.5),.1,.2+Math.abs(dx)*.5,.2+Math.abs(dy)*.5,h-.13,color);s.box(x+.28,y+.28,.1,.44,.44,h,color);
  if(ramp){s.box(x+.2,y+.2,.1,.6,.6,.1,timber);s.box(x+.2,y+.2,h-.12,.6,.07,.07,'#6b543a');}
   if(l===1&&t==='wall')s.pyramid(x+.5,y+.5,h+.1,.32,.2,color);else for(const [a,c]of[[.25,.25],[.6,.25],[.25,.6],[.6,.6]])s.box(x+a,y+c,h+.1,.16,.16,.18,l>=3||ramp&&l>=2?gold:color);
  for(const [dx,dy]of neighbors.filter(([a,c])=>a+c>=0))s.box(x+.4+Math.min(0,dx*.5),y+.4+Math.min(0,dy*.5),.1,.2+Math.abs(dx)*.5,.2+Math.abs(dy)*.5,h-.13,color);
  const cap=ramp?'#b89c70':l>1||t==='stonewall'?'#d3d9d0':WALL_CAP;
  for(const [dx,dy]of wallEnds(neighbors)){const alongX=!!dx,px=dx<0?.15:dx>0?.65:.37,py=dy<0?.15:dy>0?.65:.37,w=alongX?.2:.26,d=alongX?.26:.2;s.box(x+px,y+py,.1,w,d,h+.12,cap);}
  // One torch roughly every three wall tiles keeps long defenses legible
  // without turning every segment into an expensive light source.
  const torchSide=WALL_DIRECTIONS.find(([dx,dy])=>!neighbors.some(([nx,ny])=>nx===dx&&ny===dy));
  const torchSlot=((Math.floor(x)*31+Math.floor(y)*17)%3+3)%3;
  if(torchSide&&torchSlot===0){const [dx,dy]=torchSide;torch(s,x+.5+dx*.3,y+.5+dy*.3,h+.27,[dx,dy],1.02,.46);}
  return;}
  if(t.includes('trap')){const armed=trapArmed(b),fire=t==='fire-trap';s.box(x+.18,y+.18,.12,.64,.64,.08,'#665445');s.box(x+.25,y+.25,.2,.5,.5,.035,armed?(fire?'#815338':'#75664c'):'#4d4840');
   if(fire&&armed)s.emissive=.7;
   for(let i=0;i<3;i++)for(let j=0;j<3;j++)s.pyramid(x+.28+i*.21,y+.28+j*.21,armed?.2:.16,armed?.09:.055,armed?.3:.055,armed?(fire?'#eb9a4f':'#c0cdcd'):(fire?'#754330':'#665d52'));
   if(fire&&armed){s.source([x+.5,y+.5,.43],null,1.05,.7);s.pyramid(x+.5,y+.5,.21,.11,.2,'#f2ca6d',5);}
   s.emissive=0;return;}
 if(['farm','pasture'].includes(t)){s.box(x+.2,y+.2,.12,n-.4,n-.4,.05,t==='farm'?'#72553b':'#8da964');if(t==='farm'){for(let i=.32;i<n-.2;i+=.28)for(let j=.32;j<n-.2;j+=.32){s.box(x+i,y+j,.17,.045,.045,.18+l*.03,'#799658');s.pyramid(x+i,y+j,.3,.085,.16,'#e1c776');}}else{for(const [a,c]of[[.6,.7],[1.3,1.1]]){s.box(x+a,y+c,.3,.36,.22,.2,'#eee5d0');s.box(x+a+.3,y+c,.28,.12,.14,.18,'#76674f');for(const k of [0,.26])s.box(x+a+k,y+c,.12,.05,.18,.2,'#5e5543');}}if(l>1||t==='pasture')fence(s,x+.13,y+.13,n-.26,n-.26);lanternPost(s,x+n-.28,y+n-.28,.7+l*.04,1.12,.43);return;}
 if(['pond','deephole'].includes(t)){s.box(x+.18,y+.18,.13,n-.36,n-.36,.02,'#4e9aaa');for(let i=.22;i<n-.1;i+=.32)s.box(x+i,y+.14,.13,.22,.12,.1,stone);s.box(x+.2,y+n-.45,.16,n-.4,.23,.1,timber);s.box(x+.25,y+n-.45,.16,.08,.08,.65,timber);s.box(x+n-.35,y+n-.45,.16,.08,.08,.65,timber);lanternPost(s,x+n-.31,y+n-.39,.77,1.05,.42);return;}
 if(['grove','frostgrove'].includes(t)){for(const [a,c]of[[.5,.5],[1.35,.65],[.9,1.4]])pine(s,x+a,y+c,1.2+l*.15,t==='frostgrove');fence(s,x+.15,y+.15,n-.3,n-.3);lanternPost(s,x+n-.26,y+n-.26,.76,1.08,.42);return;}
 if(['lumber','timber_yard'].includes(t)){for(let i=0;i<3;i++)s.box(x+.18,y+.2+i*.19,.13,.62,.14,.14,timber);s.box(x+.28,y+.29,.27,.43,.14,.14,'#d4ae73');s.box(x+.17,y+.16,.13,.08,.08,.73,timber);s.box(x+.74,y+.16,.13,.08,.08,.73,timber);s.roof(x+.1,y+.1,.83,.8,.6,.18,'#60897b');lanternPost(s,x+.79,y+.22,.78,1,.42);return;}
 if(['mine','emberglass'].includes(t)){s.pyramid(x+.5,y+.5,.13,.55,.72,'#8b9690',6);s.box(x+.34,y+.76,.14,.32,.09,.4,'#2d3937');s.box(x+.27,y+.79,.14,.07,.12,.48,timber);s.box(x+.68,y+.79,.14,.07,.12,.48,timber);s.box(x+.27,y+.79,.62,.48,.12,.07,timber);s.pyramid(x+.26,y+.35,.62,.14,.26,t==='mine'?gold:'#9cd5d2');torch(s,x+.27,y+.84,.55,[0,1],.95,.47);torch(s,x+.73,y+.84,.55,[0,1],.95,.47);return;}
 if(['tower','bell-tower','bellcote','scout_post','archer_tower','ballista'].includes(t)){const width=t==='archer_tower'?n*.45:t==='ballista'?n*.62:n*.55,h=t==='archer_tower'?1+l*.3:t==='ballista'?.62+l*.18:.85+l*.24;tower(s,x+(n-width)/2,y+(n-width)/2,width,h,l===1?timber:stone);if(t.includes('bell')){s.box(x+n*.4,y+n*.4,h+.3,n*.2,n*.2,.28,gold);s.roof(x+.15,y+.15,h+.7,n-.3,n-.3,.45,'#648b90');}
  // Archer tower: slim shaft, hooded crown and a level-2 pennant — the
  // longest reach on the wall, paid for in fragility.
  if(t==='archer_tower'){s.box(x+(n-width)/2-.06,y+(n-width)/2-.06,h+.12,width+.12,width+.12,.1,l>=3?gold:stone);if(l>=2){s.box(x+n*.47,y+n*.47,h+.2,.06,.06,.5,timber);s.box(x+n*.53,y+n*.47,h+.55,.22,.02,.14,l>=3?'#b76053':'#73956a');}}
  // Ballista: squat engine deck with a spanned crossbow on top — short
  // range, slow reload (data cooldown), the hardest single hit in town.
  if(t==='ballista'){s.box(x+.14,y+.14,h,width+.1,width+.1,.12,timber);s.box(x+n/2-.3,y+n/2-.03,h+.12,.6,.06,.06,stone);s.box(x+n/2-.03,y+n/2-.3,h+.12,.06,.6,.06,stone);s.box(x+n/2-.02,y+n/2-.02,h+.12,.04,.5,.05,gold);}
  torch(s,x+n/2,y+(n+width)/2+.035,h*.58,[0,1],1.02,.45);
  return;}
 if(['watchfire','oathstone','moon-dial','cairnfield'].includes(t)){const spots=t==='cairnfield'?[[.5,.5],[1.3,.6],[.6,1.4],[1.35,1.35]]:[[n/2,n/2]];s.emissive=t==='watchfire'?1:0;for(const [a,c]of spots){s.box(x+a-.18,y+c-.18,.13,.36,.36,.22,stone);if(t==='watchfire'){s.source([x+a,y+c,.55],null,2.1,1);s.pyramid(x+a,y+c,.36,.26,.55,'#f2b35c',5);}else if(t==='moon-dial')s.pyramid(x+a,y+c,.35,.17,.55,gold);else s.box(x+a-.09,y+c-.06,.35,.18,.12,.6,t==='oathstone'?'#90b5b5':stone);}s.emissive=0;return;}
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
  s.box(x+.8,y+.86,.49,.07,.39,.29,stone); // upright blade
  for(let i=0;i<3;i++)s.box(x+.25,y+.3+i*.18,.13,.69,.13,.13,i===1?'#cba46d':timber);
  if(l>=2){s.box(x+n-.48,y+.42,.14,.18,.18,1.2,timber);s.box(x+n-.48,y+.42,1.2,.54,.12,.1,timber);s.box(x+n-.04,y+.42,.63,.04,.04,.58,'#6a6f65');}
  lanternPost(s,x+.24,y+n-.26,.82,1.06,.43);
  return;
 }
 if(t==='mill'){
  hut(s,x+.3,y+.3,n-.6,n-.6,.7+l*.13,'#aa7959',l);
  // A raised wheel, grain hopper, and flour sacks identify the gristmill.
  const z=.5,cx=x+n-.21,cy=y+n*.5;
  for(const dz of [-.36,.32])s.box(cx-.055,cy-.34,z+dz,.11,.68,.07,timber);
  for(const dy of [-.36,.32])s.box(cx-.055,cy+dy,z-.36,.11,.07,.75,timber);
  s.box(cx-.08,cy-.045,z-.39,.16,.09,.82,'#d9ba79');
  s.box(cx-.08,cy-.38,z-.045,.16,.76,.09,'#d9ba79');
  s.pyramid(x+.58,y+.54,1.15,.27,.38,'#d5b477');
  for(let i=0;i<2;i++)s.box(x+.19+i*.36,y+n-.42,.14,.3,.27,.24,'#decaa0');
  return;
 }
 if(t==='longhouse'){longhouseShape(s,b,n);return;}
 const colors={hall:'#658d99',barracks:'#b96d5a',cottage:'#9ba061',longhouse:'#977851',chapel:'#8e8dae','sunken-chapel':'#679fa5',forge:'#976b54',smeltery:'#846f67',armory:'#667b91',workshop:'#789380',tannery:'#bd9a69',schoolroom:'#ba9369',scriptorium:'#798ca7',butchery:'#a75e54',fletcher:'#7c9868','shieldwall-yard':'#668a91',mason_yard:'#949b90'};
 hut(s,x+.22,y+.22,n-.44,n-.44,.42+l*.16,colors[t]||'#829a78',l);
 workplaceDetails(s,b,n);
 if(spec.housing)homeDetails(s,b,n,l);
 if(['forge','smeltery'].includes(t)){s.box(x+n-.55,y+.28,.1,.28,.28,1.5,stone);s.box(x+n-.57,y+.26,1.6,.32,.32,.12,'#4d514b');s.source([x+.5,y+n-.15,.33],[0,1],1.65,1);s.emissive=1;s.box(x+.3,y+n-.2,.2,.4,.024,.26,'#eea55d');s.emissive=0;}
 if(t.includes('chapel')){tower(s,x+.25,y+.25,.4,1.35,stone);s.pyramid(x+.45,y+.45,1.65,.33,.6,colors[t]);}
 if(t==='hall'&&l>=2)tower(s,x+n-.7,y+.25,.48,1.35,stone);
 if(['mason_yard','shieldwall-yard'].includes(t)){for(let i=0;i<3;i++)s.box(x+.25+i*.42,y+n-.15,.13,.28,.16,.3,stone);}
}
export function buildingModel(s,b,spec,world,time=0){
 buildingShape(s,b,spec,world,time);
 if(b.id==null)return; // placement previews already have a clear ghost treatment
 buildingDetailLayer(s,b,spec);
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
 if(!spec?.production||b.hp<=0||b.remaining>0)return -1;
 const level=Math.max(1,Math.floor(+b.level||1));
 const cap=Math.max(1,reserveCapacity(spec,level));
 const held=Number.isFinite(+b.harvestBonus)?Math.max(0,+b.harvestBonus):0;
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
 const n=spec.size,px=b.x+n*.78,py=b.y+n*.82,pile=PILES[spec.production]||PILES.wood;
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
export function drawVillage3D(r,world,time,light){const s=new MeshScene(r),W=r.data.world.width,H=r.data.world.height;
 // Phase 2/3/4 — one resolved sky per frame: mesh shading follows the clock,
 // and the static geometry cache below stays light-agnostic (clock is not a key).
 s.light=light||skyLightAt(world.elapsed,r.data,{calm:r.calm});
 // Large settlements keep outfit/weapon silhouettes but omit tiny face/trim meshes.
 s.characterDetail=world.troops.length+world.enemies.length<=64;
  // Project static meshes only when the camera, footprint, building state or
  // visible defense/production stage changes; moving gates quantize to four
  // steps and traps key only their armed state, never every cooldown tick.
  const key=JSON.stringify([r.width,r.height,r.cx,r.cy,r.cam,W,H,world.buildings.map(b=>{const spec=r.data.buildings[b.type];return [b.id,b.type,b.x,b.y,b.level,b.hp<=0,b.remaining>0,productionStage(b,spec),spec?.production&&reserveReady(b,spec)?1:0,b.type==='gate'?gateLiftStage(r,b,world,time):0,b.type.includes('trap')?(trapArmed(b)?1:0):0];})]);
 if(r._meshStatic?.key===key){s.faces=r._meshStatic.faces.slice();s.sources=r._meshStatic.sources;}else{
 // Border trees share depth sorting with the village, including reverse views.
 for(let i=-1;i<W+2;i++){s.owner=null;if(i%2)pine(s,i,-1.5,1.4+(i%3)*.22);if(i%3===0)pine(s,-1.5,((i%H)+H)%H,1.5);if(i%3===1)pine(s,W+1,i%H,1.6);if(i%4===0)pine(s,i,H+3,1.5);}
  for(const b of world.buildings)buildingModel(s,b,r.data.buildings[b.type],world,time);
 prepareSourceLighting(s);
 r._meshStatic={key,faces:s.faces.slice(),sources:s.sources};
 }

 for(const u of world.troops)characterModel(s,u,r.data,time);for(const e of world.enemies)characterModel(s,e,r.data,time,true);
  if(r.placing&&r.hover){const source=world.buildings.find(b=>b.id===r.moving),ghosts=placementCells(r).map(p=>({type:r.placing,...p,level:source?.level||1,hp:1,remaining:1,id:null})),preview={buildings:[...world.buildings.filter(b=>b.id!==r.moving),...ghosts]};for(const b of ghosts)buildingModel(s,b,r.data.buildings[b.type],preview,time);}
 drawSourceSpill(s);
 s.paint();
}
