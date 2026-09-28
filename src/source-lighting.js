// Lights live in tile coordinates beside their visible flame/window geometry.
// Ground spill is painted BEFORE opaque meshes; it cannot cover roofs or people.
export function lightAt(point,normal,source){
 const delta=point.map((v,i)=>v-source.position[i]),distance=Math.hypot(...delta);
 if(distance>=source.radius)return 0;
 if(source.direction&&delta[0]*source.direction[0]+delta[1]*source.direction[1]<-.06)return 0;
 const facing=distance>.001?Math.max(0,-delta.reduce((sum,v,i)=>sum+v*normal[i],0)/distance):1;
 return source.power*(1-distance/source.radius)**2*(.22+.78*facing);
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
export function drawSourceSpill(scene){
 const strength=scene.light.overlay?.glow||0;if(!strength)return;
 const r=scene.r,c=r.ctx;
 for(const source of scene.sources){
  const [x,y]=source.position,d=source.direction,reach=source.radius*.78;
  const cx=x+(d?d[0]*reach*.36:0),cy=y+(d?d[1]*reach*.36:0);
  const p=r.project(cx,cy,.015),px=r.project(cx+reach,cy,.015),py=r.project(cx,cy+reach,.015);
  c.save();
  // An affine ground-plane gradient follows yaw, pitch, zoom and resize.
  c.transform(px.x-p.x,px.y-p.y,py.x-p.x,py.y-p.y,p.x,p.y);
  if(d){const start=-.36,side=[-d[1],d[0]];c.beginPath();
   for(const [i,[along,width]]of [[start,-.12],[start,.12],[.82,.58],[.82,-.58]].entries()){
    const u=d[0]*along+side[0]*width,v=d[1]*along+side[1]*width;i?c.lineTo(u,v):c.moveTo(u,v);
   }c.closePath();c.clip();}
  const glow=c.createRadialGradient(0,0,0,0,0,1);
  const alpha=Math.min(.3,source.power*.3)*strength;
  glow.addColorStop(0,`rgba(255,189,91,${alpha})`);
  glow.addColorStop(.35,`rgba(244,159,64,${alpha*.45})`);
  glow.addColorStop(1,'rgba(235,134,45,0)');
  c.fillStyle=glow;c.fillRect(-1,-1,2,2);c.restore();
 }
}
