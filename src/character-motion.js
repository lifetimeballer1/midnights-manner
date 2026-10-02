// Renderer-local displacement-driven gait; not saved or used by simulation.
import {phaseSeed} from './camera.js';
const histories=new WeakMap();
const WALK_CYCLE=.55;  // world units per full stride cycle at a walk
const RUN_PACE=.0022;  // world units per ms (~2.2 tiles/s) reads as a run
export function gaitFor(r,u,time){
 let pool=histories.get(r);if(!pool){pool=new Map();histories.set(r,pool);}const key=u.id;let state=pool.get(key);
 if(!state){state={x:u.x,y:u.y,distance:0,last:-Infinity,dx:0,dy:1,cycle:0,pace:0,win:0,winAt:time};pool.set(key,state);}
 const dx=u.x-state.x,dy=u.y-state.y,d=Math.hypot(dx,dy);
 if(d>1e-8&&d<1){
  if(time-state.winAt>200){state.winAt=time;state.win=0;}
  state.win+=d;state.distance+=d;state.last=time;state.dx=dx/d;state.dy=dy/d;
 }else if(d>=1){state.last=-Infinity;state.pace=0;state.win=0;state.winAt=time;}
 state.x=u.x;state.y=u.y;
 // Average displacement over a short window so render frames between fixed
 // simulation steps (and lag spikes) still read true walking speed.
 if(time-state.winAt>=150){state.pace=state.win/(time-state.winAt);state.win=0;state.winAt=time;}
 if(pool.size>256)for(const [id,s] of pool)if(time-s.last>10000&&id!==key)pool.delete(id);
 if(r.calm||!(time>=state.last&&time-state.last<180))return {moving:false,swing:0,bob:0,dx:state.dx,dy:state.dy,distance:state.distance};
 const drive=Math.min(1,state.pace/RUN_PACE);
 // Stride cycle integrates per step so cadence can tighten at a run without
 // phase jumps when speed changes. The warped sine holds the stride extremes
 // longer and crosses the passing pose quickly, so opposite arms and legs
 // read at gameplay zoom instead of blurring together.
 state.cycle+=d/(WALK_CYCLE*(1+.22*drive));
 const wave=Math.sin(state.cycle*Math.PI+phaseSeed(key));
 const shaped=Math.sign(wave)*Math.pow(Math.abs(wave),.72);
 const swing=shaped*(.072+.048*drive);
 // Body rides high when the legs pass and drops at contact, with a small
 // forward crouch at run pace — the renderer's available lean channel.
 const pass=1-Math.abs(shaped);
 const bob=pass*(.028+.02*drive)-.014*drive;
 return {moving:true,swing,bob,dx:state.dx,dy:state.dy,distance:state.distance};
}
