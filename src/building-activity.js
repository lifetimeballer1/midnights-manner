import {reserveCapacity} from './resources.js';

function seedOf(id){
 let h=2166136261;
 for(const ch of String(id||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
 return (h>>>0)/4294967296;
}
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
function point(r,x,y,z=0){return r.project(x,y,z);}
function line(c,a,b,width,color,alpha=1){
 c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.globalAlpha=1;
}
function smoke(r,b,n,t,intensity){
 const c=r.ctx,phase=t*.00055+seedOf(b.id)*7.3,x=b.x+n*.73,y=b.y+n*.28;
 c.save();
 for(let i=0;i<3;i++){
  const age=(phase+i*.29)%1,drift=(age-.5)*.12;
  const p=point(r,x+drift,y-drift,.92+age*.9);
  c.globalAlpha=(1-age)*(.1+.12*intensity);
  c.fillStyle='#c8c3b5';
  c.beginPath();c.arc(p.x,p.y,(3.2+age*5.5)*r.cam.zoom,0,Math.PI*2);c.fill();
 }
 c.restore();
}
function sparks(r,b,n,t,intensity){
 const c=r.ctx,base=seedOf(b.id),phase=r.calm?base*6.28:t*.008+base*6.28;
 c.save();
 for(let i=0;i<3;i++){
  const a=phase+i*2.05,life=(Math.sin(a*.7+i)+1)/2;
  const p=point(r,b.x+n*.48+Math.cos(a)*.08,b.y+n*.82+Math.sin(a)*.05,.34+life*.3);
  c.globalAlpha=(.22+.5*life)*intensity;c.fillStyle=i===1?'#ffe09b':'#e99b4b';
  c.fillRect(p.x-1.1*r.cam.zoom,p.y-1.1*r.cam.zoom,2.2*r.cam.zoom,2.2*r.cam.zoom);
 }
 c.restore();
}
function sawStroke(r,b,n,t,intensity){
 const swing=r.calm?0:Math.sin(t*.012+seedOf(b.id)*8)*.11;
 const a=point(r,b.x+n*.46+swing,b.y+n*.5,.55),d=point(r,b.x+n*.74+swing,b.y+n*.5,.55);
 line(r.ctx,a,d,Math.max(1,r.cam.zoom*1.2),'#d8e0dc',.45+.4*intensity);
}
function mineGlint(r,b,n,t,intensity){
 const u=r.calm?.45:(Math.sin(t*.003+seedOf(b.id)*9)+1)/2;
 const a={x:b.x+.34,y:b.y+.6},z={x:b.x+.34,y:b.y+1.08};
 const x=a.x+(z.x-a.x)*u,y=a.y+(z.y-a.y)*u,p=point(r,x,y,.19);
 const c=r.ctx;c.save();c.globalAlpha=.3+.45*intensity;c.fillStyle='#d9d2a7';c.beginPath();c.arc(p.x,p.y,2.4*r.cam.zoom,0,Math.PI*2);c.fill();c.restore();
}
function waterRipple(r,b,n,t,intensity){
 const phase=r.calm?.35:(t*.0007+seedOf(b.id))%1,p=point(r,b.x+n*.52,b.y+n*.48,.17),c=r.ctx;
 c.save();c.globalAlpha=(1-phase)*(.18+.28*intensity);c.strokeStyle='#a8dde5';c.lineWidth=Math.max(.8,r.cam.zoom*.65);
 c.beginPath();c.ellipse(p.x,p.y,(5+phase*11)*r.cam.zoom,(2.2+phase*5)*r.cam.zoom,0,0,Math.PI*2);c.stroke();c.restore();
}
function wheel(r,b,n,t,intensity){
 const c=r.ctx,p=point(r,b.x+n-.2,b.y+n*.5,.5),angle=r.calm?0:t*.0018+seedOf(b.id)*6.28,rad=10*r.cam.zoom;
 c.save();c.globalAlpha=.32+.42*intensity;c.strokeStyle='#d3b27e';c.lineWidth=Math.max(1,r.cam.zoom);
 c.beginPath();c.arc(p.x,p.y,rad,0,Math.PI*2);c.stroke();
 for(let i=0;i<4;i++){const a=angle+i*Math.PI/2;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+Math.cos(a)*rad,p.y+Math.sin(a)*rad);c.stroke();}
 c.restore();
}
function cropSweep(r,b,n,t,intensity){
 const phase=r.calm?0:Math.sin(t*.004+seedOf(b.id)*7),x=b.x+n*(.45+.08*phase),y=b.y+n*.62;
 const a=point(r,x-.08,y,.47),d=point(r,x+.1,y,.64);
 line(r.ctx,a,d,Math.max(1,r.cam.zoom),'#f0d98c',.25+.35*intensity);
}
function workGlint(r,b,n,t,intensity){
 const pulse=r.calm?.5:(Math.sin(t*.006+seedOf(b.id)*11)+1)/2,p=point(r,b.x+n*.28,b.y+n*.82,.48+pulse*.08),c=r.ctx;
 c.save();c.globalAlpha=.18+.38*pulse*intensity;c.fillStyle='#f1d58c';c.beginPath();c.arc(p.x,p.y,(1.5+1.3*pulse)*r.cam.zoom,0,Math.PI*2);c.fill();c.restore();
}
function dustTick(r,b,n,t,intensity){
 const phase=r.calm?.4:(t*.0011+seedOf(b.id))%1,p=point(r,b.x+n*.52,b.y+n*.78,.22+phase*.22),c=r.ctx;
 c.save();c.globalAlpha=(1-phase)*.24*intensity;c.fillStyle='#c9bea5';c.beginPath();c.arc(p.x,p.y,(2+phase*3)*r.cam.zoom,0,Math.PI*2);c.fill();c.restore();
}
export function drawBuildingActivity(r,world,time){
 if(!r||!world||r.cam.zoom<1.05)return;
 const crewCounts=new Map();
 for(const u of world.troops||[])if(u?.hp>0&&u.workplace&&!u.emergency&&!u.expedition&&!u.order)crewCounts.set(u.workplace,(crewCounts.get(u.workplace)||0)+1);
 for(const b of world.buildings||[]){
  const spec=r.data.buildings[b.type],state=buildingActivityState(b,spec,world,crewCounts);
  if(!state.active)continue;
  const n=spec.size||1,intensity=Math.min(1,.45+state.crew*.2);
  if(['forge','smeltery','workshop','butchery'].includes(b.type)){if(!r.calm)smoke(r,b,n,time,intensity);sparks(r,b,n,time,intensity);}
   if(['lumber','timber_yard','sawmill','whisper-grove'].includes(b.type))sawStroke(r,b,n,time,intensity);
  if(['mine','emberglass'].includes(b.type))mineGlint(r,b,n,time,intensity);
   if(['pond','deephole','blackwater-weir'].includes(b.type))waterRipple(r,b,n,time,intensity);
  if(b.type==='mill')wheel(r,b,n,time,intensity);
  if(['farm','pasture','grove','frostgrove'].includes(b.type))cropSweep(r,b,n,time,intensity);
  if(state.workplace&&['armory','fletcher','shieldwall-yard','tannery','scriptorium','schoolroom','scout_post'].includes(b.type))workGlint(r,b,n,time,intensity);
  if(state.workplace&&b.type==='mason_yard')dustTick(r,b,n,time,intensity);
  if(state.stocking&&b.type==='fletcher')workGlint(r,b,n,time,intensity);
 }
}
