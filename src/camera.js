// CSS-pixel camera math. Canvas backing pixels are handled separately by DPR.
export function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
export const DEFAULT_YAW=Math.PI/4;
export const DEFAULT_PITCH=Math.asin(22/43);
export function cameraBasis(r){const yaw=r.cam.yaw??DEFAULT_YAW,pitch=r.cam.pitch??DEFAULT_PITCH;return {c:Math.cos(yaw),s:Math.sin(yaw),p:Math.sin(pitch),v:Math.cos(pitch),scale:r.tw/Math.SQRT2};}
// Orthographic 3D camera: x/y are ground tiles, height is in tile units.
export function project3D(r,x,y,height=0){const {c,s,p,v,scale}=cameraBasis(r),dx=x-r.cam.x,dy=y-r.cam.y,z=r.cam.zoom;return {x:r.cx+(dx*c-dy*s)*scale*z,y:r.cy+((dx*s+dy*c)*p-height*v)*scale*z};}
export function cameraDepth(r,x,y,height=0){const {s,c,p,v}=cameraBasis(r);return (x*s+y*c)*v+height*p;}
export function screenToWorld(r,x,y){const {c,s,p,scale}=cameraBasis(r),z=r.cam.zoom,u=(x-r.cx)/(scale*z),v=(y-r.cy)/(scale*z*p);return {x:r.cam.x+u*c+v*s,y:r.cam.y-u*s+v*c};}
export function panPixels(r,dx,dy){const before=screenToWorld(r,r.cx,r.cy),after=screenToWorld(r,r.cx-dx,r.cy-dy);r.pan(after.x-before.x,after.y-before.y);}
export function orbitCamera(r,yawDelta,pitchDelta=0){const turn=Math.PI*2;r.cam.yaw=(((r.cam.yaw??DEFAULT_YAW)+yawDelta)%turn+turn)%turn;r.cam.pitch=clamp((r.cam.pitch??DEFAULT_PITCH)+pitchDelta,Math.PI/9,Math.PI* .46);}
export function zoomAt(renderer,factor,x,y){const before=screenToWorld(renderer,x,y);renderer.zoomBy(factor);const after=screenToWorld(renderer,x,y);renderer.pan(before.x-after.x,before.y-after.y);}
export function phaseSeed(id){let hash=0;for(const c of String(id))hash=(hash*31+c.charCodeAt(0))>>>0;return hash%10000;}
// Frontier camera (Phase 2): big grids (40x34) pan/zoom wider so the
// whole frontier stays reachable. Small maps keep the exact old limits.
export function isBigGrid(dataWorld){return (dataWorld?.width||20)>20||(dataWorld?.height||17)>17;}
export function zoomLimits(dataWorld){return isBigGrid(dataWorld)?{min:.3,max:3.6}:{min:.55,max:3.6};}
export function panLimits(dataWorld){
 if(!isBigGrid(dataWorld))return {minX:0,maxX:dataWorld?.width||20,minY:0,maxY:dataWorld?.height||17};
 const W=dataWorld?.width||40,H=dataWorld?.height||34;
 return {minX:-2,maxX:W+2,minY:-2,maxY:H+2};
}
