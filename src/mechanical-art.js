// Original low-poly mechanisms with world-space attachment points and pivots.
import {buildingActivityState} from './building-activity.js';
import {workPhase,workTiming,strikeLift} from './work-motion.js';
import {seedOf} from './procedural-seed.js';
const wood='#987046',steel='#a8b7b5';
export function beam(s,a,b,width,color){
 const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d);if(len<1e-6)return;
 const n=d.map(v=>v/len),ref=Math.abs(n[2])>.9?[1,0,0]:[0,0,1],u=[n[1]*ref[2]-n[2]*ref[1],n[2]*ref[0]-n[0]*ref[2],n[0]*ref[1]-n[1]*ref[0]],ul=Math.hypot(...u),v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];
 const vertices=[a,b].flatMap(p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>p.map((x,k)=>x+width*.5*(i*u[k]/ul+j*v[k]/ul))));
 for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])s.face(f.map(i=>vertices[i]),color,false);
}
export function wheelMesh(s,x,y,z,r,angle=0,paddles=false){
 const sides=12,thick=.06,inner=r*.77;
 for(let i=0;i<sides;i++){
  const a=angle+i*Math.PI*2/sides,b=angle+(i+1)*Math.PI*2/sides,p=(xx,rr,t)=>[xx,y+Math.cos(t)*rr,z+Math.sin(t)*rr];
  for(const xx of [x-thick/2,x+thick/2]){const face=[p(xx,r,a),p(xx,r,b),p(xx,inner,b),p(xx,inner,a)];if(xx<x)face.reverse();s.face(face,wood,false);}
  s.face([p(x-thick/2,r,a),p(x+thick/2,r,a),p(x+thick/2,r,b),p(x-thick/2,r,b)],'#604c39',false);
  if(i%3===0)beam(s,[x,y,z],p(x,inner,a),.035,'#c09a67');
  if(paddles&&i%2===0)beam(s,p(x-.1,r,a),p(x+.1,r,a),.07,'#c09a67');
 }
 s.box(x-.055,y-.055,z-.055,.11,.11,.11,steel);
}
export function cartPose(b,time,active=true){const phase=active?workPhase(b,'cart',time):0,travel=.32*(1-Math.cos(phase*Math.PI*2))/2;return {x:b.x+.49,y:b.y+.97+travel,z:.25,travel,angle:-travel/.085,loaded:phase>=.5||!active};}
export function cartMesh(s,p,ore='#a29074'){
 const {x,y,z,angle,loaded}=p;s.box(x-.145,y-.15,z,.29,.3,.035,wood);
 for(const dx of [-.145,.12])s.box(x+dx,y-.15,z+.035,.025,.3,.16,'#766452');
 for(const dy of [-.15,.125])s.box(x-.145,y+dy,z+.035,.29,.025,.16,'#766452');
 for(const dy of [-.1,.1]){beam(s,[x-.2,y+dy,z-.035],[x+.2,y+dy,z-.035],.025,steel);for(const dx of [-.18,.18])wheelMesh(s,x+dx,y+dy,z-.035,.085,angle);}
 if(loaded)for(const [dx,dy] of [[-.07,-.06],[.055,.04],[0,.07]])s.pyramid(x+dx,y+dy,z+.1,.075,.14,ore,5);
}
export function pivotMesh(s,pivot,angle){
 if(!angle)return s;const proxy=Object.create(s),co=Math.cos(angle),si=Math.sin(angle);
 proxy.face=(vertices,color,split=true)=>s.face(vertices.map(([x,y,z])=>{const dx=x-pivot[0],dz=z-pivot[2];return [pivot[0]+dx*co-dz*si,y,pivot[2]+dx*si+dz*co];}),color,split);return proxy;
}
function operator(s,x,y,z,coat='#826f56'){for(const dx of [-.37,-.29])s.box(x+dx,y-.04,.12,.05,.09,Math.max(.025,z-.24),'#624b37');s.box(x-.38,y-.065,z-.12,.16,.13,.26,coat);s.box(x-.36,y-.05,z+.15,.12,.1,.12,'#c8a37c');s.box(x-.38,y-.07,z+.27,.16,.14,.035,coat);}
function strikeTool(s,x,y,z,phase,kind){
 const angle=.98+strikeLift(phase)*2,hand=[x-.19,y,z+.19],tip=[hand[0]+Math.sin(angle)*.34,y,hand[2]-Math.cos(angle)*.34];
 beam(s,[x-.3,y,z+.27],hand,.055,'#826f56');s.box(hand[0]-.025,y-.025,hand[2]-.025,.05,.05,.05,'#c8a37c');beam(s,hand,tip,.035,wood);
 if(kind==='scraper'||kind==='cleaver')beam(s,tip,[tip[0]+.12,tip[1],tip[2]-.035],kind==='cleaver'?.09:.035,steel);
 else if(kind==='sickle')beam(s,tip,[tip[0]+.12,tip[1]+.07,tip[2]-.055],.035,steel);
 else beam(s,[tip[0]-.09*Math.cos(angle),y,tip[2]-.09*Math.sin(angle)],[tip[0]+.09*Math.cos(angle),y,tip[2]+.09*Math.sin(angle)],kind==='pick'?.035:.075,steel);
}
function contactDust(s,x,y,z,phase,color,calm){if(calm||phase>.1||s.r.cam.zoom<1.65)return;for(let i=0;i<2;i++)s.pyramid(x+(i?-.04:.04)+phase*(i?-.35:.35),y+.03*i,z+phase*.8,.012,.02,color,4);}
export function addLivingMechanisms(s,world,time){
 if(s.r.cam.zoom<.35)return 0;
 const crew=new Map();for(const u of world.troops||[])if(u.hp>0&&u.workplace&&!u.order&&!u.emergency&&!u.expedition)crew.set(u.workplace,(crew.get(u.workplace)||0)+1);
 const old=s.owner;let count=0,doorMoves=0;
 for(const door of s.doors||[]){
  const b=world.buildings.find(b=>b.id===door.owner?.id),p=s.r.project(door.x,door.y,.3);if(p.x<-50||p.y<-50||p.x>s.r.width+50||p.y>s.r.height+50)continue;
  const allowed=b&&b.hp>0&&b.remaining<=0&&!s.r.calm&&!world.night&&world.troops.length>0&&doorMoves<24&&s.r.cam.zoom>=1.2;
  const phase=allowed?workPhase(b,'door',time):.5,open=phase<.035?phase/.035:phase<.085?1:phase<.12?(.12-phase)/.035:0,angle=open*1.2;
  const proxy=Object.create(s),co=Math.cos(angle),si=Math.sin(angle);proxy.face=(vertices,color,split)=>s.face(vertices.map(([x,y,z])=>{const dx=x-door.x,dy=y-door.y;return [door.x+dx*co-dy*si,door.y+dx*si+dy*co,z];}),color,split);
  s.owner=door.owner;proxy.box(door.x,door.y,door.z,door.w,.026,door.h,'#5b4735');proxy.box(door.x+door.w*.78,door.y+.028,door.z+.2,.025,.018,.03,'#c5a06a');if(allowed)doorMoves++;
 }
 for(const b of world.buildings){
  if(count>=48)break;if(b.hp<=0||b.remaining>0)continue;
  const spec=s.r.data.buildings[b.type],n=spec.size,p=s.r.project(b.x+n/2,b.y+n/2);if(p.x<-80||p.y<-100||p.x>s.r.width+80||p.y>s.r.height+100)continue;
  const state=buildingActivityState(b,spec,world,crew),active=state.active&&!s.r.calm,t=active?time:0,x=b.x,y=b.y,type=b.type,phase=ch=>active?workPhase(b,ch,t):0;
  s.owner={kind:'building',id:b.id};
  if(type==='mill'){
   const clock=workTiming(b,'creak'),angle=active?(time+clock.offset)/clock.period*Math.PI:0;wheelMesh(s,x+n-.15,y+n*.5,.55,.38,angle,true);s.box(x+n-.4,y+n*.5-.045,.505,.48,.09,.09,wood);if(active)contactDust(s,x+.58,y+.54,.8,phase('creak'),'#d5c7a0',false);count++;continue;
  }
  if(['mine','emberglass'].includes(type)){
   cartMesh(s,cartPose(b,t,active),type==='mine'?'#a29074':'#96c5c2');if(s.r.cam.zoom>=1.2&&state.crew>0){operator(s,x+.81,y+.73,.33,'#747f88');strikeTool(s,x+.81,y+.73,.33,phase('pick'),'pick');contactDust(s,x+.9,y+.73,.35,phase('pick'),'#c1b498',!active);}count++;continue;
  }
  if(s.r.cam.zoom<1.2)continue;
  if(['forge','smeltery','workshop','armory'].includes(type)){
   const px=x+.47,py=y+n-.075;s.box(px-.09,py-.07,.13,.18,.14,.19,'#505b5c');s.box(px-.16,py-.08,.32,.34,.16,.06,steel);
   if(state.crew>0){operator(s,px,py,.38,'#7f4939');strikeTool(s,px,py,.38,phase('hammer'),'hammer');}
   if(active){s.emissive=.65;s.box(px+.035,py-.025,.383,.08,.05,.025,'#e8a164');s.emissive=0;contactDust(s,px+.07,py,.4,phase('hammer'),'#ffd39a',false);}
   const compression=active?(1-Math.cos(phase('bellows')*Math.PI*2))*.025:0;s.box(x+.14,y+n-.15,.26,.18,.12,.07-compression,'#705441');s.box(x+.13,y+n-.16,.33-compression,.2,.14,.02,wood);count++;continue;
  }
  if(type==='sawmill'){
   const clock=workTiming(b,'saw'),shift=active?Math.cos((time+clock.offset)/clock.period*Math.PI)*.11:0;s.box(x+.46,y+.94,.46,n-.92,.14,.12,wood);s.box(x+.67+shift,y+.96,.52,.55,.025,.1,steel);
   for(let i=0;i<6;i++){const px=x+.71+shift+i*.075,teeth=[[px,y+.972,.53],[px+.045,y+.972,.53],[px+.022,y+.972,.505]];s.face(teeth,steel,false);s.face([...teeth].reverse(),steel,false);}s.box(x+.64+shift,y+.93,.52,.06,.08,.14,'#5f4735');contactDust(s,x+.86,y+.98,.5,phase('saw'),'#ccb38a',!active);count++;continue;
  }
  if(['lumber','timber_yard','whisper-grove'].includes(type)){
   const px=x+n-.3,py=y+.7;s.box(px-.09,py-.08,.12,.18,.16,.18,wood);if(state.crew>0){operator(s,px,py,.31,'#725235');strikeTool(s,px,py,.31,phase('chop'),'axe');}contactDust(s,px+.1,py,.33,phase('chop'),'#ccb38a',!active);count++;continue;
  }
  if(['farm','pasture','grove','frostgrove'].includes(type)){
   const wind=s.r.calm?0:Math.sin(time*.0018+seedOf(b.id)*7)*.028;for(let i=0;i<4;i++){const px=x+.4+(i%2)*.38,py=y+.5+Math.floor(i/2)*.34;beam(s,[px,py,.18],[px+wind*Math.cos(i),py,.45],.025,'#7d9955');s.pyramid(px+wind*Math.cos(i),py,.43,.045,.065,'#cfbd79',4);}
   if(state.crew>0){operator(s,x+n*.5,y+n-.21,.22,'#6b853b');strikeTool(s,x+n*.5,y+n-.21,.22,phase('rustle'),'sickle');}count++;continue;
  }
  if(['pond','deephole','blackwater-weir'].includes(type)){
   const px=x+n*.52,py=y+n*.48,bob=active?Math.sin(phase('lap')*Math.PI*2)*.012:0;s.box(px-.025,py-.025,.18+bob,.05,.05,.035,'#c66448');beam(s,[x+.18,y+n-.2,.24],[x+.25,y+n*.5,.73],.025,wood);beam(s,[x+.25,y+n*.5,.73],[px,py,.2+bob],.008,'#c0b795');count++;continue;
  }
  if(['mason_yard','butchery','fletcher','tannery'].includes(type)){
   const px=x+.4,py=y+n-.13,ch={mason_yard:'chisel',butchery:'board',fletcher:'shave',tannery:'scrape'}[type];s.box(px-.18,py-.12,.13,.4,.24,.22,wood);if(state.crew>0){operator(s,px,py,.37);strikeTool(s,px,py,.37,phase(ch),type==='mason_yard'?'pick':type==='butchery'?'cleaver':'scraper');}contactDust(s,px+.1,py,.39,phase(ch),'#c9bea5',!active);count++;continue;
  }
  if(type==='bakery'){s.box(x+.32,y+n-.19,.3,.38,.14,.035,wood);for(let i=0;i<3;i++)s.pyramid(x+.39+i*.1,y+n-.12,.335,.045,.055,'#d9a45e',5);contactDust(s,x+.5,y+n-.12,.39,phase('oven'),'#ded3b7',!active);count++;}
 }
 s.owner=old;return count;
}
