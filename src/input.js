import {isWall} from './systems/walls.js';
// Pointer Events unify mouse, pen and touch. Sliding previews never spend resources.
export class MapInput {
 constructor(canvas,renderer,ui){this.canvas=canvas;this.renderer=renderer;this.ui=ui;this.pointers=new Map();this.dragged=false;this.multiGesture=false;this.lastDistance=0;this.bind();}
 point(e){const rect=this.canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};}
 bind(){const c=this.canvas,r=this.renderer;
 c.addEventListener('pointerdown',e=>{if(this.ui.blocked())return;const p=this.point(e);c.setPointerCapture?.(e.pointerId);this.pointers.set(e.pointerId,{...p,startX:p.x,startY:p.y});if(this.pointers.size===1){this.dragged=false;this.multiGesture=false;this.wallAnchor=isWall({type:r.placing})&&!r.moving?r.cell(e):null;}if(this.pointers.size===2){this.dragged=true;this.multiGesture=true;this.lastDistance=this.distance();}});
 c.addEventListener('pointermove',e=>{const p=this.point(e),old=this.pointers.get(e.pointerId);if(!old){if(e.pointerType==='mouse'&&!r.placing)r.hover=r.cell(e);return;}const dx=p.x-old.x,dy=p.y-old.y;this.pointers.set(e.pointerId,{...old,...p});
  if(this.ui.blocked()){this.dragged=true;return;}
  if(this.pointers.size>=2){r.panPixels(dx/this.pointers.size,dy/this.pointers.size);const dist=this.distance(),points=[...this.pointers.values()];if(this.lastDistance>0)r.zoomAt(dist/this.lastDistance,(points[0].x+points[1].x)/2,(points[0].y+points[1].y)/2);this.lastDistance=dist;this.dragged=true;}
  else if(this.dragged||Math.hypot(p.x-old.startX,p.y-old.startY)>7){this.dragged=true;if(r.placing&&!this.multiGesture){r.wallStart=this.wallAnchor;r.hover=r.cell(e);this.ui.placementHint();}else if(!this.multiGesture)r.panPixels(dx,dy);}
 });
 c.addEventListener('pointerup',e=>{const wasTracked=this.pointers.has(e.pointerId),p=this.point(e);this.pointers.delete(e.pointerId);if(wasTracked&&!this.dragged&&!this.ui.blocked()){const cell=r.cell(e);r.wallStart=null;r.hover=cell;this.ui.selectCell(cell,r.pick(p.x,p.y));}if(this.pointers.size===0){this.lastDistance=0;this.multiGesture=false;}});
 c.addEventListener('pointercancel',e=>{this.pointers.delete(e.pointerId);this.dragged=true;});
 c.addEventListener('wheel',e=>{if(this.ui.blocked())return;e.preventDefault();const p=this.point(e);r.zoomAt(e.deltaY>0?.9:1.1,p.x,p.y);},{passive:false});
 c.addEventListener('keydown',e=>{if(this.ui.blocked())return;const arrow={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(arrow){e.preventDefault();const p=r.hover||{x:9,y:8};r.hover={x:Math.max(1,Math.min(r.data.world.width-2,p.x+arrow[0])),y:Math.max(1,Math.min(r.data.world.height-2,p.y+arrow[1]))};r.grid=true;this.ui.placementHint();}if(e.key==='Enter'){e.preventDefault();this.ui.selectCell(r.hover||{x:9,y:8});}const pan={w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[e.key.toLowerCase()];if(pan){e.preventDefault();r.pan(...pan);}if(e.key==='+'||e.key==='=')r.zoomBy(1.12);if(e.key==='-')r.zoomBy(.9);if(e.key==='0')r.fitVillage(this.ui.game.world);if(e.key.toLowerCase()==='h'&&this.ui.selectedTroop){this.ui.game.commandHold(this.ui.selectedTroop);this.ui.refresh();}});
 }
 distance(){const [a,b]=this.pointers.values();return Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));}
}
