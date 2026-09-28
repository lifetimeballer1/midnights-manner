// Original low-poly village geometry, projected by the shared orbit camera.
// The game simulation stays in ground tiles; meshes add height only for display.
import {cameraBasis} from './camera.js';
import {characterModel} from './character-art.js';
import {isWall,wallNeighbors} from './building-art.js';
import {placementCells} from './systems/walls.js';
import {DAY_LENGTH,skyLightAt} from './systems/daynight.js';
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
export function shade(hex,n,light,emissive=0,depth01=0,ao=1){
 const value=parseInt(hex.slice(1),16);
 const key=Math.max(0,(n[0]*light.keyDir[0]+n[1]*light.keyDir[1]+n[2]*light.keyDir[2])/light.keyNorm)*light.keyI;
 const up=Math.max(0,n[2])*light.sky,glow=emissive*light.emissive,dim=(light.dim??1)*ao,fog=(light.fog??0)*depth01;
 const lit=[light.ambRGB[0]*light.ambI+light.keyRGB[0]*key+up+glow,light.ambRGB[1]*light.ambI+light.keyRGB[1]*key+up+glow,light.ambRGB[2]*light.ambI+light.keyRGB[2]*key+up+glow];
 return '#'+[value>>16,(value>>8)&255,value&255].map((v,i)=>{let c=Math.min(255,Math.round(v*lit[i]*dim));if(fog>0)c=Math.round(c+(light.fogRGB[i]*255-c)*fog);return c.toString(16).padStart(2,'0');}).join('');
}
export class MeshScene {
 constructor(r){this.r=r;this.faces=[];this.owner=null;this.alpha=1;this.depthBias=0;this.light=FALLBACK_LIGHT;this.emissive=0;this.basis=cameraBasis(r);}
 face(vertices,color,split=true){
  // Split broad roof/wall planes so chimneys and neighboring meshes occlude
  // correctly even at low camera angles (painter ordering uses face centers).
  if(split&&vertices.length===4){const [a,b,c,d]=vertices,dist=(u,v)=>Math.hypot(...u.map((n,i)=>n-v[i])),nx=Math.ceil(dist(a,b)/.4),ny=Math.ceil(dist(a,d)/.4);if(nx*ny>1){const point=(u,v)=>a.map((n,i)=>(1-v)*((1-u)*n+u*b[i])+v*((1-u)*d[i]+u*c[i]));for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)this.face([point(i/nx,j/ny),point((i+1)/nx,j/ny),point((i+1)/nx,(j+1)/ny),point(i/nx,(j+1)/ny)],color,false);return;}}

  const a=vertices[0],b=vertices[1],c=vertices[2],u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const len=Math.hypot(...n);if(len<1e-8)return;n=n.map(x=>x/len);
  const B=this.basis;if(n[0]*B.s*B.v+n[1]*B.c*B.v+n[2]*B.p<=.00001)return;
  const points=vertices.map(p=>this.r.project(...p));if(points.every(p=>p.x<-60)||points.every(p=>p.x>this.r.width+60)||points.every(p=>p.y<-80)||points.every(p=>p.y>this.r.height+60))return;
  const zAvg=vertices.reduce((sum,p)=>sum+p[2],0)/vertices.length;
  this.faces.push({points,color,normal:n,emissive:this.emissive,ao:Math.min(1,AO_MIN+(1-AO_MIN)*Math.max(0,zAvg/AO_HEIGHT)),depth:vertices.reduce((sum,p)=>sum+this.r.depth(...p),0)/vertices.length+this.depthBias,owner:this.owner,alpha:this.alpha});
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
  if(f.paintedKey!==key){f.painted=shade(f.color,f.normal,light,f.emissive,light.fog>0?(f.depth-dMin)/dSpan:0,f.ao);f.paintedKey=key;}
  c.globalAlpha=f.alpha;c.fillStyle=f.painted;c.beginPath();f.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();c.strokeStyle=f.painted;c.lineWidth=.45;c.stroke();}c.globalAlpha=1;this.r.sceneFaces=this.faces;}
}
const stone='#b4beb2',timber='#b38a59',gold='#e5bd66';
function fence(s,x,y,w,d,color=timber){for(let i=0;i<=w;i+=.45){s.box(x+i,y,.05,.09,.09,.45,color);s.box(x+i,y+d-.09,.05,.09,.09,.45,color);}for(let j=.4;j<d;j+=.45){s.box(x,y+j,.05,.09,.09,.45,color);s.box(x+w-.09,y+j,.05,.09,.09,.45,color);}s.box(x,y,.23,w,.055,.07,color);s.box(x,y+d-.06,.23,w,.055,.07,color);s.box(x,y,.23,.055,d,.07,color);s.box(x+w-.06,y,.23,.055,d,.07,color);}
function pine(s,x,y,height=1.7,cold=false){s.box(x-.045,y-.045,0,.09,.09,height*.65,'#73543c');for(let i=0;i<3;i++)s.pyramid(x,y,height*(.23+i*.21),height*(.31-i*.055),height*.53,cold?['#598c83','#80b8ae','#b6ded0'][i]:['#315d43','#477953','#699358'][i],6);}
function tower(s,x,y,size,h,color=stone){s.box(x,y,.12,size,size,h,color);s.box(x-.08,y-.08,h+.1,size+.16,size+.16,.16,color);for(const [dx,dy]of[[0,0],[size-.16,0],[0,size-.16],[size-.16,size-.16]])s.box(x+dx-.025,y+dy-.025,h+.26,.21,.21,.23,color);s.box(x+size*.38,y+size+.006,h*.48,size*.2,.012,.27,'#324a41');s.box(x+size+.006,y+size*.38,h*.48,.012,size*.2,.27,'#324a41');}
function windows(s,x,y,w,d,h){
 // Shallow facade pieces sit on broad wall faces. A small ordering offset
 // avoids their being cut up by the wall's face-center painter sort.
 const bias=s.depthBias;s.depthBias+=.12;
 // Lit windows are emissive: warm at midnight without any point lights yet.
 s.emissive=1;
 for(const f of [.18,.72]){const z=h*.54,ww=Math.min(.18,w*.15);s.box(x+w*f,y+d+.008,z,ww,.024,.19,'#ffe6ab');s.box(x+w*f,y-.025,z,ww,.024,.19,'#ffe6ab');s.box(x-.025,y+d*f,z,.024,ww,.19,'#ffe6ab');s.box(x+w+.008,y+d*f,z,.024,ww,.19,'#ffe6ab');}
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
  s.emissive=1;s.box(x+w*.44,y+w-.028,h+.2,.13,.05,.13,'#ffe6ab');s.emissive=0;
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
function buildingShape(s,b,spec,world){
 const x=b.x,y=b.y,n=spec.size,l=b.level,t=b.type;s.owner={kind:'building',id:b.id};s.alpha=b.hp<=0?.35:b.remaining>0?.6:1;
 s.box(x+.1,y+.1,0,n-.2,n-.2,.12,l>1?stone:'#9b8864');
 // Gatehouse: twin posts and a high lintel with the middle left open —
 // the hole reads as passage, the posts read as wall. Timber gates grow
 // stone posts, then gold-capped battlements, so upgrades loom larger.
 if(t==='gate'){const h=.55+l*.22,post=l===1?timber:stone;for(const [dx,dy]of wallNeighbors(b,world))s.box(x+.4+Math.min(0,dx*.5),y+.4+Math.min(0,dy*.5),.1,.2+Math.abs(dx)*.5,.2+Math.abs(dy)*.5,h-.15,post);
  for(const px of [.16,.72]){s.box(x+px,y+.16,.1,.12,.12,h,post);s.box(x+px-.02,y+.14,h+.12,.16,.16,.14,post);}
  s.box(x+.14,y+.14,h,.72,.72,.16,l>=3?gold:post);
  for(const px of [.2,.42,.64])s.box(x+px,y+.2,h+.16,.12,.12,.14,l>=3?gold:post);
  if(l>=2)s.box(x+.44,y+.42,h*.3,.12,.12,.3,'#324a41');
  if(l>=3){s.box(x+.47,y+.2,h+.3,.06,.06,.5,timber);s.box(x+.53,y+.2,h+.62,.2,.02,.12,'#b76053');}
  return;}
 if(isWall(b)){const ramp=t==='rampart',h=.38+l*.17+(t==='stonewall'?.15:0)+(ramp?.12:0),color=ramp?'#8a6f4d':l>1||t==='stonewall'?stone:timber;for(const [dx,dy]of wallNeighbors(b,world))s.box(x+.4+Math.min(0,dx*.5),y+.4+Math.min(0,dy*.5),.1,.2+Math.abs(dx)*.5,.2+Math.abs(dy)*.5,h-.13,color);s.box(x+.28,y+.28,.1,.44,.44,h,color);
  if(ramp){s.box(x+.2,y+.2,.1,.6,.6,.1,timber);s.box(x+.2,y+.2,h-.12,.6,.07,.07,'#6b543a');}
  if(l===1&&t==='wall')s.pyramid(x+.5,y+.5,h+.1,.32,.2,color);else for(const [a,c]of[[.25,.25],[.6,.25],[.25,.6],[.6,.6]])s.box(x+a,y+c,h+.1,.16,.16,.18,l>=3||ramp&&l>=2?gold:color);return;}
 if(t.includes('trap')){s.box(x+.18,y+.18,.12,.64,.64,.08,'#665445');for(let i=0;i<3;i++)for(let j=0;j<3;j++)s.pyramid(x+.28+i*.21,y+.28+j*.21,.2,.09,.3,t==='fire-trap'?'#eb9a4f':'#c0cdcd');return;}
 if(['farm','pasture'].includes(t)){s.box(x+.2,y+.2,.12,n-.4,n-.4,.05,t==='farm'?'#72553b':'#8da964');if(t==='farm'){for(let i=.32;i<n-.2;i+=.28)for(let j=.32;j<n-.2;j+=.32){s.box(x+i,y+j,.17,.045,.045,.18+l*.03,'#799658');s.pyramid(x+i,y+j,.3,.085,.16,'#e1c776');}}else{for(const [a,c]of[[.6,.7],[1.3,1.1]]){s.box(x+a,y+c,.3,.36,.22,.2,'#eee5d0');s.box(x+a+.3,y+c,.28,.12,.14,.18,'#76674f');for(const k of [0,.26])s.box(x+a+k,y+c,.12,.05,.18,.2,'#5e5543');}}if(l>1||t==='pasture')fence(s,x+.13,y+.13,n-.26,n-.26);return;}
 if(['pond','deephole'].includes(t)){s.box(x+.18,y+.18,.13,n-.36,n-.36,.02,'#4e9aaa');for(let i=.22;i<n-.1;i+=.32)s.box(x+i,y+.14,.13,.22,.12,.1,stone);s.box(x+.2,y+n-.45,.16,n-.4,.23,.1,timber);s.box(x+.25,y+n-.45,.16,.08,.08,.65,timber);s.box(x+n-.35,y+n-.45,.16,.08,.08,.65,timber);return;}
 if(['grove','frostgrove'].includes(t)){for(const [a,c]of[[.5,.5],[1.35,.65],[.9,1.4]])pine(s,x+a,y+c,1.2+l*.15,t==='frostgrove');fence(s,x+.15,y+.15,n-.3,n-.3);return;}
 if(['lumber','timber_yard'].includes(t)){for(let i=0;i<3;i++)s.box(x+.18,y+.2+i*.19,.13,.62,.14,.14,timber);s.box(x+.28,y+.29,.27,.43,.14,.14,'#d4ae73');s.box(x+.17,y+.16,.13,.08,.08,.73,timber);s.box(x+.74,y+.16,.13,.08,.08,.73,timber);s.roof(x+.1,y+.1,.83,.8,.6,.18,'#60897b');return;}
 if(['mine','emberglass'].includes(t)){s.pyramid(x+.5,y+.5,.13,.55,.72,'#8b9690',6);s.box(x+.34,y+.76,.14,.32,.09,.4,'#2d3937');s.box(x+.27,y+.79,.14,.07,.12,.48,timber);s.box(x+.68,y+.79,.14,.07,.12,.48,timber);s.box(x+.27,y+.79,.62,.48,.12,.07,timber);s.pyramid(x+.26,y+.35,.62,.14,.26,t==='mine'?gold:'#9cd5d2');return;}
 if(['tower','bell-tower','bellcote','scout_post','archer_tower','ballista'].includes(t)){const width=t==='archer_tower'?n*.45:t==='ballista'?n*.62:n*.55,h=t==='archer_tower'?1+l*.3:t==='ballista'?.62+l*.18:.85+l*.24;tower(s,x+(n-width)/2,y+(n-width)/2,width,h,l===1?timber:stone);if(t.includes('bell')){s.box(x+n*.4,y+n*.4,h+.3,n*.2,n*.2,.28,gold);s.roof(x+.15,y+.15,h+.7,n-.3,n-.3,.45,'#648b90');}
  // Archer tower: slim shaft, hooded crown and a level-2 pennant — the
  // longest reach on the wall, paid for in fragility.
  if(t==='archer_tower'){s.box(x+(n-width)/2-.06,y+(n-width)/2-.06,h+.12,width+.12,width+.12,.1,l>=3?gold:stone);if(l>=2){s.box(x+n*.47,y+n*.47,h+.2,.06,.06,.5,timber);s.box(x+n*.53,y+n*.47,h+.55,.22,.02,.14,l>=3?'#b76053':'#73956a');}}
  // Ballista: squat engine deck with a spanned crossbow on top — short
  // range, slow reload (data cooldown), the hardest single hit in town.
  if(t==='ballista'){s.box(x+.14,y+.14,h,width+.1,width+.1,.12,timber);s.box(x+n/2-.3,y+n/2-.03,h+.12,.6,.06,.06,stone);s.box(x+n/2-.03,y+n/2-.3,h+.12,.06,.6,.06,stone);s.box(x+n/2-.02,y+n/2-.02,h+.12,.04,.5,.05,gold);}
  return;}
 if(['watchfire','oathstone','moon-dial','cairnfield'].includes(t)){const spots=t==='cairnfield'?[[.5,.5],[1.3,.6],[.6,1.4],[1.35,1.35]]:[[n/2,n/2]];s.emissive=t==='watchfire'?1:0;for(const [a,c]of spots){s.box(x+a-.18,y+c-.18,.13,.36,.36,.22,stone);if(t==='watchfire')s.pyramid(x+a,y+c,.36,.26,.55,'#f2b35c',5);else if(t==='moon-dial')s.pyramid(x+a,y+c,.35,.17,.55,gold);else s.box(x+a-.09,y+c-.06,.35,.18,.12,.6,t==='oathstone'?'#90b5b5':stone);}s.emissive=0;return;}
 if(t==='dawn-gate'){tower(s,x+.18,y+.35,.62,1.7,stone);tower(s,x+n-.8,y+.35,.62,1.7,stone);s.box(x+.8,y+.43,1.35,n-1.6,.46,.45,gold);s.roof(x+.05,y+.2,2,n-.1,.95,.32,'#638b92');return;}
 if(t==='market'){for(const [a,c,color]of[[.22,.24,'#b76053'],[1.7,.25,'#73956a'],[.6,1.75,'#ccac60']]){s.box(x+a,y+c,.14,1,.5,.35,timber);for(const dx of [0,.94])s.box(x+a+dx,y+c,.14,.06,.06,.95,timber);s.roof(x+a-.06,y+c-.12,1.02,1.12,.75,.12,color);}return;}
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
 if(['forge','smeltery'].includes(t)){s.box(x+n-.55,y+.28,.1,.28,.28,1.5,stone);s.box(x+n-.57,y+.26,1.6,.32,.32,.12,'#4d514b');s.emissive=1;s.box(x+.3,y+n-.2,.2,.4,.024,.26,'#eea55d');s.emissive=0;}
 if(t.includes('chapel')){tower(s,x+.25,y+.25,.4,1.35,stone);s.pyramid(x+.45,y+.45,1.65,.33,.6,colors[t]);}
 if(t==='hall'&&l>=2)tower(s,x+n-.7,y+.25,.48,1.35,stone);
 if(['mason_yard','shieldwall-yard'].includes(t)){for(let i=0;i<3;i++)s.box(x+.25+i*.42,y+n-.15,.13,.28,.16,.3,stone);}
}
export function buildingModel(s,b,spec,world){
 buildingShape(s,b,spec,world);
 if(b.id==null)return; // placement previews already have a clear ghost treatment
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
}
export function drawVillage3D(r,world,time,light){const s=new MeshScene(r),W=r.data.world.width,H=r.data.world.height;
 // Phase 2/3/4 — one resolved sky per frame: mesh shading follows the clock,
 // and the static geometry cache below stays light-agnostic (clock is not a key).
 s.light=light||skyLightAt(world.elapsed,r.data,{calm:r.calm});
 // Large settlements keep outfit/weapon silhouettes but omit tiny face/trim meshes.
 s.characterDetail=world.troops.length+world.enemies.length<=64;
 // Project static meshes only when the camera, footprint, or building state changes.
 const key=JSON.stringify([r.width,r.height,r.cx,r.cy,r.cam,W,H,world.buildings.map(b=>[b.id,b.type,b.x,b.y,b.level,b.hp<=0,b.remaining>0])]);
 if(r._meshStatic?.key===key)s.faces=r._meshStatic.faces.slice();else{
 // Border trees share depth sorting with the village, including reverse views.
 for(let i=-1;i<W+2;i++){s.owner=null;if(i%2)pine(s,i,-1.5,1.4+(i%3)*.22);if(i%3===0)pine(s,-1.5,((i%H)+H)%H,1.5);if(i%3===1)pine(s,W+1,i%H,1.6);if(i%4===0)pine(s,i,H+3,1.5);}
 for(const b of world.buildings)buildingModel(s,b,r.data.buildings[b.type],world);
 r._meshStatic={key,faces:s.faces.slice()};
 }

 for(const u of world.troops)characterModel(s,u,r.data,time);for(const e of world.enemies)characterModel(s,e,r.data,time,true);
 if(r.placing&&r.hover){const source=world.buildings.find(b=>b.id===r.moving),ghosts=placementCells(r).map(p=>({type:r.placing,...p,level:source?.level||1,hp:1,remaining:1,id:null})),preview={buildings:[...world.buildings.filter(b=>b.id!==r.moving),...ghosts]};for(const b of ghosts)buildingModel(s,b,r.data.buildings[b.type],preview);}
 s.paint();
}
