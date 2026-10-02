// Reviewed CC0 meshes converted offline to the existing flat-face renderer.
// No network loader, textures, animation framework or simulation dependency.
import {externalGeometry} from './external-geometry.js';

export function addExternalProp(s,id,x,y,z,height,yaw=0,nature=false){
 const mesh=externalGeometry[id],zoom=s.r.cam.zoom;
 if(!mesh||zoom<1.55||s.alpha!==1)return false;
 const p=s.r.project(x,y,z);
 if(p.x<-80||p.x>s.r.width+80||p.y<-100||p.y>s.r.height+80)return false;
 const key=nature?'externalNatureFaces':'externalPropFaces';
 const phone=s.r.width<600;
 const budget=nature?(phone?156:320):zoom>=2.2?(phone?1200:2400):(phone?800:1400);
 if((s[key]||0)+mesh.faces.length>budget)return false;
 s[key]=(s[key]||0)+mesh.faces.length;
 const co=Math.cos(yaw),si=Math.sin(yaw);
 const vertices=mesh.vertices.map(([a,b,c])=>[x+(a*co-b*si)*height,y+(a*si+b*co)*height,z+c*height]);
 for(const [indices,color] of mesh.faces)s.face(indices.map(i=>vertices[i]),color,false);
 return true;
}

// One themed addition per building supplements rather than hides tier art.
export function addExternalWorkplace(s,b,spec){
 if(b.id==null||b.hp<=0||b.remaining>0||s.r.cam.zoom<1.55)return;
 const n=spec.size,x=b.x,y=b.y,level=b.level;
 const fixture=s.fixture;s.fixture=true;
 if(['farm','pasture'].includes(b.type)&&level>=2)
  addExternalProp(s,'hay',x+n-.35,y+n-.4,.13,.33);
 else if(['mill','bakery','grand-granary'].includes(b.type))
  addExternalProp(s,'grain-sack',x+.42,y+n-.33,.13,.16);
 else if(['hall','longhouse','cottage','market-square','manor-gardens','manner-citadel'].includes(b.type)&&level>=(b.type==='manner-citadel'?4:2))
  addExternalProp(s,'bench',x+n*.5,y+n-.26,.13,.27);
 s.fixture=fixture;
}
