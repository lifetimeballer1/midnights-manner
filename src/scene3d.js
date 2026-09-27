// Original low-poly village geometry, projected by the shared orbit camera.
// The game simulation stays in ground tiles; meshes add height only for display.
import {cameraBasis,phaseSeed} from './camera.js';
import {isWall,wallNeighbors} from './building-art.js';
import {placementCells} from './systems/walls.js';
export function pointInPolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
function shade(hex,n){const value=parseInt(hex.slice(1),16),light=.72+.26*Math.max(0,(-n[0]*.4-n[1]*.5+n[2]) /1.187)+.12*Math.max(0,n[2]);return '#'+[value>>16,(value>>8)&255,value&255].map(v=>Math.min(255,Math.round(v*light)).toString(16).padStart(2,'0')).join('');}
export class MeshScene {
 constructor(r){this.r=r;this.faces=[];this.owner=null;this.alpha=1;this.basis=cameraBasis(r);}
 face(vertices,color,split=true){
  // Split broad roof/wall planes so chimneys and neighboring meshes occlude
  // correctly even at low camera angles (painter ordering uses face centers).
  if(split&&vertices.length===4){const [a,b,c,d]=vertices,dist=(u,v)=>Math.hypot(...u.map((n,i)=>n-v[i])),nx=Math.ceil(dist(a,b)/.4),ny=Math.ceil(dist(a,d)/.4);if(nx*ny>1){const point=(u,v)=>a.map((n,i)=>(1-v)*((1-u)*n+u*b[i])+v*((1-u)*d[i]+u*c[i]));for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)this.face([point(i/nx,j/ny),point((i+1)/nx,j/ny),point((i+1)/nx,(j+1)/ny),point(i/nx,(j+1)/ny)],color,false);return;}}

  const a=vertices[0],b=vertices[1],c=vertices[2],u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const len=Math.hypot(...n);if(len<1e-8)return;n=n.map(x=>x/len);
  const B=this.basis;if(n[0]*B.s*B.v+n[1]*B.c*B.v+n[2]*B.p<=.00001)return;
  const points=vertices.map(p=>this.r.project(...p));if(points.every(p=>p.x<-60)||points.every(p=>p.x>this.r.width+60)||points.every(p=>p.y<-80)||points.every(p=>p.y>this.r.height+60))return;
  this.faces.push({points,color:shade(color,n),depth:vertices.reduce((sum,p)=>sum+this.r.depth(...p),0)/vertices.length,owner:this.owner,alpha:this.alpha});
 }
 box(x,y,z,w,d,h,color){const p=[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]];for(const f of [[0,3,2,1],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]])this.face(f.map(i=>p[i]),color);}
 roof(x,y,z,w,d,h,color){const p=[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x+w/2,y,z+h],[x+w/2,y+d,z+h]];for(const f of [[0,4,5,3],[4,1,2,5],[0,1,4],[3,5,2]])this.face(f.map(i=>p[i]),color);}
 pyramid(x,y,z,radius,h,color,sides=4){const ring=Array.from({length:sides},(_,i)=>[x+Math.cos(i*Math.PI*2/sides)*radius,y+Math.sin(i*Math.PI*2/sides)*radius,z]);for(let i=0;i<sides;i++)this.face([ring[i],ring[(i+1)%sides],[x,y,z+h]],color);}
 paint(){const c=this.r.ctx;this.faces.sort((a,b)=>a.depth-b.depth);for(const f of this.faces){c.globalAlpha=f.alpha;c.fillStyle=f.color;c.beginPath();f.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();c.strokeStyle=f.color;c.lineWidth=.45;c.stroke();}c.globalAlpha=1;this.r.sceneFaces=this.faces;}
}
const stone='#b4beb2',timber='#b38a59',gold='#e5bd66';
function fence(s,x,y,w,d,color=timber){for(let i=0;i<=w;i+=.45){s.box(x+i,y,.05,.09,.09,.45,color);s.box(x+i,y+d-.09,.05,.09,.09,.45,color);}for(let j=.4;j<d;j+=.45){s.box(x,y+j,.05,.09,.09,.45,color);s.box(x+w-.09,y+j,.05,.09,.09,.45,color);}s.box(x,y,.23,w,.055,.07,color);s.box(x,y+d-.06,.23,w,.055,.07,color);s.box(x,y,.23,.055,d,.07,color);s.box(x+w-.06,y,.23,.055,d,.07,color);}
function pine(s,x,y,height=1.7,cold=false){s.box(x-.045,y-.045,0,.09,.09,height*.65,'#73543c');for(let i=0;i<3;i++)s.pyramid(x,y,height*(.23+i*.21),height*(.31-i*.055),height*.53,cold?['#598c83','#80b8ae','#b6ded0'][i]:['#315d43','#477953','#699358'][i],6);}
function tower(s,x,y,size,h,color=stone){s.box(x,y,.12,size,size,h,color);s.box(x-.08,y-.08,h+.1,size+.16,size+.16,.16,color);for(const [dx,dy]of[[0,0],[size-.16,0],[0,size-.16],[size-.16,size-.16]])s.box(x+dx-.025,y+dy-.025,h+.26,.21,.21,.23,color);s.box(x+size*.38,y+size+.006,h*.48,size*.2,.012,.27,'#324a41');s.box(x+size+.006,y+size*.38,h*.48,.012,size*.2,.27,'#324a41');}
function windows(s,x,y,w,d,h){for(const f of [.18,.72]){const z=h*.54,ww=Math.min(.18,w*.15);s.box(x+w*f,y+d+.008,z,ww,.024,.19,'#ffe6ab');s.box(x+w*f,y-.025,z,ww,.024,.19,'#ffe6ab');s.box(x-.025,y+d*f,z,.024,ww,.19,'#ffe6ab');s.box(x+w+.008,y+d*f,z,.024,ww,.19,'#ffe6ab');}s.box(x+w*.4,y+d+.01,.1,w*.22,.026,.48,'#5b4735');}
function hut(s,x,y,w,d,h,roofColor,level){s.box(x,y,.1,w,d,h,level===1?timber:stone);s.roof(x-.09,y-.09,h+.1,w+.18,d+.18,.35+level*.08,roofColor);windows(s,x,y,w,d,h);if(level>=2)s.box(x+w*.75,y+d*.2,h,.18,.18,.75,stone);if(level>=3){s.box(x+.1,y+.1,0,.16,.16,h+.1,gold);s.box(x+w-.26,y+d-.26,0,.16,.16,h+.1,gold);}}
export function buildingModel(s,b,spec,world){
 const x=b.x,y=b.y,n=spec.size,l=b.level,t=b.type;s.owner={kind:'building',id:b.id};s.alpha=b.hp<=0?.35:b.remaining>0?.6:1;
 s.box(x+.1,y+.1,0,n-.2,n-.2,.12,l>1?stone:'#9b8864');
 if(isWall(b)){const h=.38+l*.17+(t==='stonewall'?.15:0),color=l>1||t==='stonewall'?stone:timber;for(const [dx,dy]of wallNeighbors(b,world))s.box(x+.4+Math.min(0,dx*.5),y+.4+Math.min(0,dy*.5),.1,.2+Math.abs(dx)*.5,.2+Math.abs(dy)*.5,h-.13,color);s.box(x+.28,y+.28,.1,.44,.44,h,color);if(l===1&&t==='wall')s.pyramid(x+.5,y+.5,h+.1,.32,.2,color);else for(const [a,c]of[[.25,.25],[.6,.25],[.25,.6],[.6,.6]])s.box(x+a,y+c,h+.1,.16,.16,.18,l>=3?gold:color);return;}
 if(t.includes('trap')){s.box(x+.18,y+.18,.12,.64,.64,.08,'#665445');for(let i=0;i<3;i++)for(let j=0;j<3;j++)s.pyramid(x+.28+i*.21,y+.28+j*.21,.2,.09,.3,t==='fire-trap'?'#eb9a4f':'#c0cdcd');return;}
 if(['farm','pasture'].includes(t)){s.box(x+.2,y+.2,.12,n-.4,n-.4,.05,t==='farm'?'#72553b':'#8da964');if(t==='farm'){for(let i=.32;i<n-.2;i+=.28)for(let j=.32;j<n-.2;j+=.32){s.box(x+i,y+j,.17,.045,.045,.18+l*.03,'#799658');s.pyramid(x+i,y+j,.3,.085,.16,'#e1c776');}}else{for(const [a,c]of[[.6,.7],[1.3,1.1]]){s.box(x+a,y+c,.3,.36,.22,.2,'#eee5d0');s.box(x+a+.3,y+c,.28,.12,.14,.18,'#76674f');for(const k of [0,.26])s.box(x+a+k,y+c,.12,.05,.18,.2,'#5e5543');}}if(l>1||t==='pasture')fence(s,x+.13,y+.13,n-.26,n-.26);return;}
 if(['pond','deephole'].includes(t)){s.box(x+.18,y+.18,.13,n-.36,n-.36,.02,'#4e9aaa');for(let i=.22;i<n-.1;i+=.32)s.box(x+i,y+.14,.13,.22,.12,.1,stone);s.box(x+.2,y+n-.45,.16,n-.4,.23,.1,timber);s.box(x+.25,y+n-.45,.16,.08,.08,.65,timber);s.box(x+n-.35,y+n-.45,.16,.08,.08,.65,timber);return;}
 if(['grove','frostgrove'].includes(t)){for(const [a,c]of[[.5,.5],[1.35,.65],[.9,1.4]])pine(s,x+a,y+c,1.2+l*.15,t==='frostgrove');fence(s,x+.15,y+.15,n-.3,n-.3);return;}
 if(['lumber','timber_yard'].includes(t)){for(let i=0;i<3;i++)s.box(x+.18,y+.2+i*.19,.13,.62,.14,.14,timber);s.box(x+.28,y+.29,.27,.43,.14,.14,'#d4ae73');s.box(x+.17,y+.16,.13,.08,.08,.73,timber);s.box(x+.74,y+.16,.13,.08,.08,.73,timber);s.roof(x+.1,y+.1,.83,.8,.6,.18,'#60897b');return;}
 if(['mine','emberglass'].includes(t)){s.pyramid(x+.5,y+.5,.13,.55,.72,'#8b9690',6);s.box(x+.34,y+.76,.14,.32,.09,.4,'#2d3937');s.box(x+.27,y+.79,.14,.07,.12,.48,timber);s.box(x+.68,y+.79,.14,.07,.12,.48,timber);s.box(x+.27,y+.79,.62,.48,.12,.07,timber);s.pyramid(x+.26,y+.35,.62,.14,.26,t==='mine'?gold:'#9cd5d2');return;}
 if(['tower','bell-tower','bellcote','scout_post'].includes(t)){const width=n*.55,h=.85+l*.24;tower(s,x+(n-width)/2,y+(n-width)/2,width,h,l===1?timber:stone);if(t.includes('bell')){s.box(x+n*.4,y+n*.4,h+.3,n*.2,n*.2,.28,gold);s.roof(x+.15,y+.15,h+.7,n-.3,n-.3,.45,'#648b90');}return;}
 if(['watchfire','oathstone','moon-dial','cairnfield'].includes(t)){const spots=t==='cairnfield'?[[.5,.5],[1.3,.6],[.6,1.4],[1.35,1.35]]:[[n/2,n/2]];for(const [a,c]of spots){s.box(x+a-.18,y+c-.18,.13,.36,.36,.22,stone);if(t==='watchfire')s.pyramid(x+a,y+c,.36,.26,.55,'#f2b35c',5);else if(t==='moon-dial')s.pyramid(x+a,y+c,.35,.17,.55,gold);else s.box(x+a-.09,y+c-.06,.35,.18,.12,.6,t==='oathstone'?'#90b5b5':stone);}return;}
 if(t==='dawn-gate'){tower(s,x+.18,y+.35,.62,1.7,stone);tower(s,x+n-.8,y+.35,.62,1.7,stone);s.box(x+.8,y+.43,1.35,n-1.6,.46,.45,gold);s.roof(x+.05,y+.2,2,n-.1,.95,.32,'#638b92');return;}
 if(t==='market'){for(const [a,c,color]of[[.22,.24,'#b76053'],[1.7,.25,'#73956a'],[.6,1.75,'#ccac60']]){s.box(x+a,y+c,.14,1,.5,.35,timber);for(const dx of [0,.94])s.box(x+a+dx,y+c,.14,.06,.06,.95,timber);s.roof(x+a-.06,y+c-.12,1.02,1.12,.75,.12,color);}return;}
 const colors={hall:'#658d99',barracks:'#b96d5a',cottage:'#9ba061',longhouse:'#977851',chapel:'#8e8dae','sunken-chapel':'#679fa5',forge:'#976b54',smeltery:'#846f67',armory:'#667b91',workshop:'#789380',tannery:'#bd9a69',schoolroom:'#ba9369',scriptorium:'#798ca7',butchery:'#a75e54',fletcher:'#7c9868','shieldwall-yard':'#668a91',mason_yard:'#949b90'};
 hut(s,x+.22,y+.22,n-.44,n-.44,.42+l*.16,colors[t]||'#829a78',l);
 if(['forge','smeltery'].includes(t)){s.box(x+n-.55,y+.28,.1,.28,.28,1.5,stone);s.box(x+n-.57,y+.26,1.6,.32,.32,.12,'#4d514b');s.box(x+.3,y+n-.2,.2,.4,.024,.26,'#eea55d');}
 if(t.includes('chapel')){tower(s,x+.25,y+.25,.4,1.35,stone);s.pyramid(x+.45,y+.45,1.65,.33,.6,colors[t]);}
 if(t==='hall'&&l>=2)tower(s,x+n-.7,y+.25,.48,1.35,stone);
 if(['mason_yard','shieldwall-yard'].includes(t)){for(let i=0;i<3;i++)s.box(x+.25+i*.42,y+n-.15,.13,.28,.16,.3,stone);}
}
function person(s,u,data,time,enemy=false){if(u.hp<=0)return;s.owner={kind:enemy?'enemy':'unit',id:u.id};s.alpha=1;const spec=data.troops[u.type]||{},role=spec.role,base=enemy?'#a65c54':role==='combat'?'#557a86':role==='collector'?'#719b68':'#ae9568';const bob=s.r.calm?0:Math.sin(time/230+phaseSeed(u.id))*.018,x=u.x,y=u.y;
 for(const dx of [-.115,.04])s.box(x+dx,y-.08,.02,.085,.16,.24,'#514939');s.box(x-.15,y-.11,.25,.3,.22,.29,base);s.box(x-.1,y-.09,.57+bob,.2,.18,.19,'#e1ba88');s.box(x-.12,y-.11,.75+bob,.24,.22,.08,role==='combat'?'#a6bac4':enemy?'#6f5344':'#977c51');for(const dx of [-.22,.15])s.box(x+dx,y-.08,.29,.07,.13,.22,'#d5ae7d');s.box(x-.1,y+.095,.65+bob,.035,.012,.025,'#33443a');s.box(x+.045,y+.095,.65+bob,.035,.012,.025,'#33443a');
 const item=data.items[u.gear],anim=u.animation>0?Math.sin(u.animation*14)*.15:0;
 s.box(x+.22,y-.035,.22,.04,.04,.55+anim,timber);
 if(item){if(item.animation==='arrow'||/bow/.test(u.gear))s.box(x+.25,y-.09,.4,.04,.3,.45,timber);else if(item.animation==='slash')s.box(x+.2,y-.04,.7+anim,.09,.06,.3,'#d0d9d4');else s.box(x+.16,y-.05,.72+anim,.23,.09,.12,role==='combat'?'#aebfc3':'#97aaa2');}
 if(u.armor)s.box(x-.16,y-.13,.28,.32,.04,.25,'#aab7bd');if(u.carry>0)s.box(x-.14,y-.23,.32,.28,.14,.26,'#c5a363');
}
export function drawVillage3D(r,world,time){const s=new MeshScene(r),W=r.data.world.width,H=r.data.world.height;
 // Border trees share depth sorting with the village, including reverse views.
 for(let i=-1;i<W+2;i++){s.owner=null;if(i%2)pine(s,i,-1.5,1.4+(i%3)*.22);if(i%3===0)pine(s,-1.5,((i%H)+H)%H,1.5);if(i%3===1)pine(s,W+1,i%H,1.6);if(i%4===0)pine(s,i,H+3,1.5);}
 for(const b of world.buildings)buildingModel(s,b,r.data.buildings[b.type],world);
 for(const u of world.troops)person(s,u,r.data,time);for(const e of world.enemies)person(s,e,r.data,time,true);
 if(r.placing&&r.hover){const source=world.buildings.find(b=>b.id===r.moving),ghosts=placementCells(r).map(p=>({type:r.placing,...p,level:source?.level||1,hp:1,remaining:1,id:null})),preview={buildings:[...world.buildings.filter(b=>b.id!==r.moving),...ghosts]};for(const b of ghosts)buildingModel(s,b,r.data.buildings[b.type],preview);}
 s.paint();
}
