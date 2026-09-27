// CSS-pixel camera math. Canvas backing pixels are handled separately by DPR.
export function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
export function screenToWorld(renderer,x,y){const c=renderer.camBase(),z=renderer.cam.zoom,bx=c.x+(x-renderer.cx)/z,by=c.y+(y-renderer.cy)/z;return {x:(bx-renderer.ox)/renderer.tw+(by-renderer.oy)/renderer.th,y:(by-renderer.oy)/renderer.th-(bx-renderer.ox)/renderer.tw};}
export function panPixels(renderer,dx,dy){const z=renderer.cam.zoom;renderer.pan(-dx/(renderer.tw*z)-dy/(renderer.th*z),dx/(renderer.tw*z)-dy/(renderer.th*z));}
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
