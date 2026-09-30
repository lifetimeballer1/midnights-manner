// Canvas atmospheric approximations, not a GPU volumetric/GI pipeline.
// All geometry, hit targets and simulation state remain owned by the game.
import {sourceFlicker,sourcePhase,sourceProfile,lightAt} from './source-lighting.js';
export const CINEMATIC_LIMITS=Object.freeze({casters:180,mist:12,bloom:32,embers:12});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function hull(points){
 const sorted=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
 if(sorted.length<3)return sorted;
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
 return half(sorted).slice(0,-1).concat(half(sorted.slice().reverse()).slice(0,-1));
}
// Save a small world-space envelope per visible structure/scenery cell once.
// Clock changes project these envelopes; they never rebuild village meshes.
export function shadowCasters(faces){
 const groups=new Map();
 for(const f of faces){
  if(f.alpha!==1||f.fixture||!f.vertices)continue;
  const key=f.owner?.id??`scenery:${Math.floor(f.center[0])},${Math.floor(f.center[1])}`;
  let b=groups.get(key);if(!b){b={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};groups.set(key,b);}
  for(const p of f.vertices)for(let i=0;i<3;i++){b.min[i]=Math.min(b.min[i],p[i]);b.max[i]=Math.max(b.max[i],p[i]);}
 }
 return [...groups.values()].filter(b=>b.max[2]>.22).map(b=>{
  // Use each group's bounds rather than retaining thousands of face vertices.
  const points=[];for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [0,b.max[2]])points.push([x,y,z]);
  return {points,x:(b.min[0]+b.max[0])/2,y:(b.min[1]+b.max[1])/2};
 });
}
export function projectShadow(r,caster,light){
 const [lx,ly,lz]=light.keyDir,alt=Math.max(.28,lz),scale=Math.min(2.4,1/alt);
 return hull(caster.points.map(([x,y,z])=>r.project(x-lx*z*scale,y-ly*z*scale,.018)));
}
function polygon(c,points){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();}
export function drawCelestialShadows(scene){
 const r=scene.r,c=r.ctx,sky=scene.light,cache=r._meshStatic;
 if(!cache||sky.keyI<=0)return 0;
 if(!cache.casters)cache.casters=shadowCasters(cache.faces);
 if(cache.shadowKey!==sky.key){
  cache.shadows=cache.casters.slice().sort((a,b)=>Math.hypot(a.x-r.cam.x,a.y-r.cam.y)-Math.hypot(b.x-r.cam.x,b.y-r.cam.y)).slice(0,CINEMATIC_LIMITS.casters).map(b=>projectShadow(r,b,sky));
  cache.shadowKey=sky.key;
 }
 c.save();
 const alpha=clamp(sky.keyI*.48,.035,.15)*(1-(sky.fog||0)*.65);
 // A faint expanded silhouette supplies the penumbra without Canvas blur.
 for(const pts of cache.shadows){
  if(pts.length<3)continue;
  const center=pts.reduce((a,p)=>({x:a.x+p.x/pts.length,y:a.y+p.y/pts.length}),{x:0,y:0});
  c.fillStyle=`rgba(12,20,35,${alpha*.28})`;
  polygon(c,pts.map(p=>({x:center.x+(p.x-center.x)*1.035,y:center.y+(p.y-center.y)*1.035})));c.fill();
  c.fillStyle=`rgba(12,20,35,${alpha})`;polygon(c,pts);c.fill();
 }
 c.restore();return cache.shadows.length;
}
export function drawGroundMist(scene,time){
 const r=scene.r,c=r.ctx,sky=scene.light,night=sky.overlay?.glow||0;
 const strength=.012+night*.038+(sky.fog||0)*.055;
 const t=r.calm?0:(Number.isFinite(time)?time:0)*.000018;
 const color=night>.7?'155,187,225':'244,214,165';
 c.save();
 // Grade only the ground; mesh faces retain the celestial directional model.
 c.fillStyle=night>.7?'rgba(26,49,89,.12)':'rgba(244,195,113,.025)';c.fillRect(0,0,r.width,r.height);
 for(let i=0;i<CINEMATIC_LIMITS.mist;i++){
  // Camera-local tile coordinates: a fixed budget even on the 52x44 frontier.
  const dx=(i%4-1.5)*3.4,dy=(Math.floor(i/4)-1)*3.6;
  const p=r.project(r.cam.x+dx+Math.sin(t+i*1.7)*.38,r.cam.y+dy+Math.cos(t*.7+i)*.24,.075);
  const radius=(62+(i%3)*19)*r.cam.zoom;
  if(p.x+radius<0||p.x-radius>r.width||p.y+radius*.28<0||p.y-radius*.28>r.height)continue;
  c.save();c.translate(p.x,p.y);c.scale(1,.28);
  const g=c.createRadialGradient(0,0,0,0,0,radius);g.addColorStop(0,`rgba(${color},${strength})`);g.addColorStop(.48,`rgba(${color},${strength*.6})`);g.addColorStop(1,`rgba(${color},0)`);
  c.fillStyle=g;c.fillRect(-radius,-radius,radius*2,radius*2);c.restore();
 }
 c.restore();return CINEMATIC_LIMITS.mist;
}
// Check the opaque painter stack at the actual source position: glow on a
// hidden rear window must never appear through its roof or another house.
export function visibleEmitter(source,faces,r){
 const p=r.project(...source.position);
 if(p.x<0||p.x>r.width||p.y<0||p.y>r.height)return null;
 for(let i=faces.length-1;i>=0;i--){
  const f=faces[i];if(f.bounds&&(p.x<f.bounds[0]||p.y<f.bounds[1]||p.x>f.bounds[2]||p.y>f.bounds[3]))continue;let inside=false;
  for(let a=0,b=f.points.length-1;a<f.points.length;b=a++){
   const u=f.points[a],v=f.points[b];if((u.y>p.y)!==(v.y>p.y)&&p.x<(v.x-u.x)*(p.y-u.y)/(v.y-u.y)+u.x)inside=!inside;
  }
  if(inside&&f.alpha===1)return f.owner?.id===source.owner?.id&&f.emissive>0?p:null;
 }
 return null;
}
export function drawPracticalBloom(scene,time){
 const r=scene.r,c=r.ctx,strength=scene.light.overlay?.glow||0;
 if(strength<=0||r.cam.zoom<.9)return {bloom:0,embers:0};
 let count=0,embers=0;c.save();
 // Small screen-space halos, anchored to a visible pane/flame, never giant blobs.
 for(const source of scene.sources){
  if(count>=CINEMATIC_LIMITS.bloom)break;
  const p=visibleEmitter(source,scene.faces,r);if(!p)continue;
  const window=source.profile==='window',profile=sourceProfile(source),flicker=sourceFlicker(source,time,r.calm);
  const radius=clamp((window?4:7)*r.cam.zoom,3,18),g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
  const alpha=(window?.12:.18)*strength*flicker;
  g.addColorStop(0,`rgba(${profile.inner},${alpha})`);g.addColorStop(.3,`rgba(${profile.mid},${alpha*.5})`);g.addColorStop(1,`rgba(${profile.edge},0)`);
  c.fillStyle=g;c.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);count++;
  if(!r.calm&&r.cam.zoom>=1.25&&['torch','fire','trap'].includes(source.profile)&&embers<CINEMATIC_LIMITS.embers){
   const age=((Number.isFinite(time)?time:0)*.00035+sourcePhase(source)/6.283)%1;
   // Embers remain tight to their visible fire; no persistent particle pool.
   c.globalAlpha=(1-age)*.48*strength;c.fillStyle='#ffd58b';
   c.fillRect(p.x+Math.sin(age*5+sourcePhase(source))*2*r.cam.zoom,p.y-age*10*r.cam.zoom,1.1,1.1);c.globalAlpha=1;embers++;
  }
 }
 c.restore();return {bloom:count,embers};
}
export function drawCelestialAir(r,sky){
 const c=r.ctx,night=(sky.overlay?.glow||0)>.8,color=night?'140,177,229':'247,204,139';
 c.save();
 // Atmospheric peripheral softness, preserving sharp map center and every HUD pixel.
 const g=c.createRadialGradient(r.width*.5,r.height*.48,Math.min(r.width,r.height)*.26,r.width*.5,r.height*.48,Math.max(r.width,r.height)*.65);
 g.addColorStop(0,`rgba(${color},0)`);g.addColorStop(.62,`rgba(${color},.012)`);g.addColorStop(1,`rgba(${color},${night?.065:.035})`);
 c.fillStyle=g;c.fillRect(0,0,r.width,r.height);c.restore();
}
// Segment/AABB test in the ground plane: intervening structures stop bounce.
export function blockedLight(start,end,buildings,data,ignoreIds=[]){
 for(const b of buildings){
  if(b.hp<=0||b.remaining>0||ignoreIds.includes(b.id))continue;
  const size=data.buildings[b.type]?.size;if(!size)continue;
  let near=0,far=1;
  for(let i=0;i<2;i++){
   const delta=end[i]-start[i],min=(i?b.y:b.x)+.08,max=min+size-.16;
   if(Math.abs(delta)<1e-8){if(start[i]<min||start[i]>max){near=2;break;}continue;}
   const a=(min-start[i])/delta,z=(max-start[i])/delta;
   near=Math.max(near,Math.min(a,z));far=Math.min(far,Math.max(a,z));
  }
  if(near<=far&&far>.02&&near<.98)return true;
 }
 return false;
}
export function prepareNearbyLight(scene,world){
 const grid=new Map(),sources=scene.sources.filter(s=>['torch','fire','lantern','trap'].includes(s.profile));
 for(const s of sources){
  const [x,y]=s.position;
  for(let a=Math.floor(x-s.radius);a<=Math.floor(x+s.radius);a++)for(let b=Math.floor(y-s.radius);b<=Math.floor(y+s.radius);b++){
   const key=a+','+b,list=grid.get(key)||[];list.push(s);grid.set(key,list);
  }
 }
 for(const f of scene.faces){
  let wash=0;
  for(const source of grid.get(Math.floor(f.center[0])+','+Math.floor(f.center[1]))||[]){
   if(source.owner?.id===f.owner?.id)continue;
   const value=lightAt(f.center,f.normal,source);
   if(value>.006&&!blockedLight(source.position,f.center,world.buildings,scene.r.data,[source.owner?.id,f.owner?.id]))wash+=value*.55;
  }
  f.localLight=Math.min(.85,(f.localLight||0)+Math.min(.24,wash));
 }
}
export function drawChimneyWisps(scene,time){
 const r=scene.r,c=r.ctx;if(r.cam.zoom<1.15)return 0;
 let count=0;c.save();
 for(const chimney of scene.chimneys||[]){
  if(count>=8)break;
  const [x,y,z]=chimney.position,phase=sourcePhase(chimney)/6.283;
  const base=r.calm?phase:((Number.isFinite(time)?time:0)*.00012+phase)%1;
  const origin=r.project(x,y,z);
  if(origin.x< -30||origin.x>r.width+30||origin.y< -30||origin.y>r.height+30)continue;
  for(let i=0;i<3;i++){
   const age=(base+i/3)%1,wx=x+age*.17,wy=y+age*.045,wz=z+age*.55;
   const p=r.project(wx,wy,wz),depth=r.depth(wx,wy,wz);
   // Backlit smoke remains behind foreground geometry, like its chimney.
   if(scene.faces.some(f=>f.depth>depth&&f.alpha===1&&f.bounds&&p.x>=f.bounds[0]&&p.x<=f.bounds[2]&&p.y>=f.bounds[1]&&p.y<=f.bounds[3]))continue;
   const radius=(2+age*3.5)*r.cam.zoom,g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
   const tint=scene.light.overlay?.glow>.8?'165,190,220':'231,220,199';
   g.addColorStop(0,`rgba(${tint},${(1-age)*.09})`);g.addColorStop(1,`rgba(${tint},0)`);
   c.fillStyle=g;c.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);
  }
  count++;
 }
 c.restore();return count;
}
