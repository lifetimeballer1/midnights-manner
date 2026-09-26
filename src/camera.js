// CSS-pixel camera math. Canvas backing pixels are handled separately by DPR.
export function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
export function screenToWorld(renderer,x,y){const c=renderer.camBase(),z=renderer.cam.zoom,bx=c.x+(x-renderer.cx)/z,by=c.y+(y-renderer.cy)/z;return {x:(bx-renderer.ox)/renderer.tw+(by-renderer.oy)/renderer.th,y:(by-renderer.oy)/renderer.th-(bx-renderer.ox)/renderer.tw};}
export function panPixels(renderer,dx,dy){const z=renderer.cam.zoom;renderer.pan(-dx/(renderer.tw*z)-dy/(renderer.th*z),dx/(renderer.tw*z)-dy/(renderer.th*z));}
export function zoomAt(renderer,factor,x,y){const before=screenToWorld(renderer,x,y);renderer.zoomBy(factor);const after=screenToWorld(renderer,x,y);renderer.pan(before.x-after.x,before.y-after.y);}
export function phaseSeed(id){let hash=0;for(const c of String(id))hash=(hash*31+c.charCodeAt(0))>>>0;return hash%10000;}
