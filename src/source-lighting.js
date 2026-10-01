// Lights live in tile coordinates beside their visible flame/window geometry.
// Ground spill is painted BEFORE opaque meshes; it cannot cover roofs or people.
// Profiles only change presentation. Surface wash remains construction-time/cached.
export const SOURCE_PROFILES=Object.freeze({
 generic:{falloff:2,reach:.78,push:.36,alpha:.30,maxAlpha:.30,inner:'255,189,91',mid:'244,159,64',edge:'235,134,45',midStop:.35,midFade:.45,flicker:0,freq:.008,cone:[-.36,.12,.82,.58]},
 window:{falloff:2.35,reach:.82,push:.38,alpha:.23,maxAlpha:.23,inner:'255,218,157',mid:'249,181,93',edge:'226,139,52',midStop:.42,midFade:.42,flicker:.012,freq:.004,cone:[-.28,.09,.84,.48]},
 lantern:{falloff:2.15,reach:.68,push:0,alpha:.25,maxAlpha:.25,inner:'255,219,143',mid:'247,177,80',edge:'225,135,43',midStop:.38,midFade:.40,flicker:.025,freq:.006,cone:null},
 torch:{falloff:1.9,reach:.76,push:.31,alpha:.30,maxAlpha:.30,inner:'255,192,86',mid:'241,136,51',edge:'207,91,33',midStop:.32,midFade:.48,flicker:.10,freq:.010,cone:[-.24,.13,.77,.52]},
 fire:{falloff:1.7,reach:.88,push:.16,alpha:.34,maxAlpha:.34,inner:'255,178,70',mid:'235,113,40',edge:'190,70,31',midStop:.30,midFade:.52,flicker:.15,freq:.012,cone:null},
 trap:{falloff:1.85,reach:.70,push:0,alpha:.31,maxAlpha:.31,inner:'255,199,89',mid:'241,126,47',edge:'195,67,30',midStop:.27,midFade:.50,flicker:.18,freq:.014,cone:null}
});
export function sourceProfile(source){return SOURCE_PROFILES[source?.profile]||SOURCE_PROFILES.generic;}
export function sourcePhase(source){
 if(Number.isFinite(source?.phase))return source.phase;
 let h=2166136261;
 const key=String(source?.owner?.id??'')+'|'+(source?.position||[]).join(',');
 for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619);}
 return (h>>>0)/4294967296*Math.PI*2;
}
export function sourceFlicker(source,time=0,calm=false){
 const p=sourceProfile(source);
 if(calm||!p.flicker)return 1;
 const phase=sourcePhase(source),t=(Number.isFinite(time)?time:0)*p.freq;
 const wave=(Math.sin(t+phase)+.35*Math.sin(t*1.91+phase*1.73))/1.35;
 return 1+p.flicker*wave;
}
export function lightAt(point,normal,source){
 const delta=point.map((v,i)=>v-source.position[i]),distance=Math.hypot(...delta);
 if(distance>=source.radius)return 0;
 if(source.direction&&delta[0]*source.direction[0]+delta[1]*source.direction[1]<-.06)return 0;
 const facing=distance>.001?Math.max(0,-delta.reduce((sum,v,i)=>sum+v*normal[i],0)/distance):1;
 const falloff=sourceProfile(source).falloff;
 return source.power*(1-distance/source.radius)**falloff*(.22+.78*facing);
}
export function prepareSourceLighting(scene){
 const byOwner=new Map();
 for(const source of scene.sources){const id=source.owner?.id;if(!byOwner.has(id))byOwner.set(id,[]);byOwner.get(id).push(source);}
 for(const face of scene.faces){
  // Confine the inexpensive facade wash to its own structure. This avoids
  // leaking through adjoining walls without a costly per-frame shadow map.
  face.localLight=Math.min(.85,(byOwner.get(face.owner?.id)||[]).reduce((sum,source)=>sum+lightAt(face.center,face.normal,source),0));
 }
}
function clipDirectional(c,d,profile){
 const cone=profile.cone||SOURCE_PROFILES.generic.cone;
 if(!d||!cone)return;
 const start=cone[0],nearWidth=cone[1],end=cone[2],farWidth=cone[3],sx=-d[1],sy=d[0];
 c.beginPath();
 c.moveTo(d[0]*start-sx*nearWidth,d[1]*start-sy*nearWidth);
 c.lineTo(d[0]*start+sx*nearWidth,d[1]*start+sy*nearWidth);
 c.lineTo(d[0]*end+sx*farWidth,d[1]*end+sy*farWidth);
 c.lineTo(d[0]*end-sx*farWidth,d[1]*end-sy*farWidth);
 c.closePath();c.clip();
}
export function visibleLightBudget(r){return r.cam.zoom<1.05?48:Math.min(r.width,r.height)<=700?72:120;}
export function drawSourceSpill(scene,time=0){
 const r=scene.r,c=r.ctx;r.sceneSources=scene.sources;
 const stats=r.lightingStats??={};stats.spill=0;stats.spillCulled=0;
 const strength=scene.light.overlay?.glow||0;if(!strength)return;
 const cap=visibleLightBudget(r);
 for(const source of scene.sources){
  if(stats.spill>=cap)break;
  const profile=sourceProfile(source),flicker=sourceFlicker(source,time,r.calm);
  const [x,y]=source.position,d=source.direction,reach=source.radius*profile.reach;
  const push=d?profile.push*reach:0,cx=x+(d?d[0]*push:0),cy=y+(d?d[1]*push:0);
  const p=r.project(cx,cy,.015),px=r.project(cx+reach,cy,.015),py=r.project(cx,cy+reach,.015);
  const extent=Math.hypot(px.x-p.x,px.y-p.y)+Math.hypot(py.x-p.x,py.y-p.y);
  if(p.x+extent<0||p.x-extent>r.width||p.y+extent<0||p.y-extent>r.height){stats.spillCulled++;continue;}
  c.save();
  // An affine ground-plane gradient follows yaw, pitch, zoom and resize.
  // Directional sources clip that pool into a facade/torch spill; open flames
  // and lanterns stay compact radial pools centered on their visible source.
  c.transform(px.x-p.x,px.y-p.y,py.x-p.x,py.y-p.y,p.x,p.y);
  clipDirectional(c,d,profile);
  const glow=c.createRadialGradient(0,0,0,0,0,1);
  const alpha=Math.min(profile.maxAlpha,source.power*profile.alpha)*strength*flicker;
  glow.addColorStop(0,`rgba(${profile.inner},${alpha})`);
  glow.addColorStop(profile.midStop,`rgba(${profile.mid},${alpha*profile.midFade})`);
  glow.addColorStop(1,`rgba(${profile.edge},0)`);
  c.fillStyle=glow;c.fillRect(-1,-1,2,2);c.restore();stats.spill++;
 }
}
