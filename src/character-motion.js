// Renderer-local displacement-driven gait; not saved or used by simulation.
import {phaseSeed} from './camera.js';
const histories=new WeakMap();
export function gaitFor(r,u,time){
 let pool=histories.get(r);if(!pool){pool=new Map();histories.set(r,pool);}const key=u.id;let state=pool.get(key);
 if(!state){state={x:u.x,y:u.y,distance:0,last:-Infinity,dx:0,dy:1};pool.set(key,state);}
 const dx=u.x-state.x,dy=u.y-state.y,d=Math.hypot(dx,dy);
 if(d>1e-8&&d<1){state.distance+=d;state.last=time;state.dx=dx/d;state.dy=dy/d;}else if(d>=1)state.last=-Infinity;
 state.x=u.x;state.y=u.y;
 if(pool.size>256)for(const [id,s] of pool)if(time-s.last>10000&&id!==key)pool.delete(id);
 const moving=!r.calm&&time>=state.last&&time-state.last<180,swing=moving?Math.sin(state.distance/.55*Math.PI+phaseSeed(key))*.07:0;
 return {moving,swing,bob:moving?Math.abs(swing)*.19:0,dx:state.dx,dy:state.dy,distance:state.distance};
}
