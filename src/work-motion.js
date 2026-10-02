// Shared visible/audio clocks. Contact is phase zero; timing survives levels.
import {seedOf} from './procedural-seed.js';
export function workRate(level){return 1-.05*Math.max(0,Math.min(5,(Number(level)||1)-1));}
export function workTiming(b,channel){
 const seed=seedOf(b.id),rate=workRate(b.level);
 const cfg={door:[14800,3,.0007,0],hammer:[Math.PI*2/.006,11,.006,Math.PI/2],saw:[Math.PI/.012,8,.012,Math.PI/2],pick:[1250+seed*350,9,.005,Math.PI/2],chop:[1500+seed*350,6,.004,Math.PI/2],chisel:[1700+seed*400,6,.004,Math.PI/2],creak:[Math.PI/.0018,6.28,.0018,0],cart:[7800,7,.001,0],bellows:[6300,5,.001,0],rustle:[Math.PI/.004*2,7,.004,Math.PI/2],lap:[3600+seed*800,5,.0012,Math.PI/2],oven:[4100,5,.0015,Math.PI/2],board:[1900+seed*400,6,.004,Math.PI/2],shave:[2100+seed*400,6,.004,Math.PI/2],scrape:[2400+seed*400,6,.003,Math.PI/2],drill:[2600+seed*500,6,.003,Math.PI/2]}[channel];
 return cfg?{period:cfg[0]*rate,offset:(seed*cfg[1]-cfg[3])/cfg[2]}:null;
}
export function workPhase(b,channel,time){const c=workTiming(b,channel);return c?((time+c.offset)/c.period%1+1)%1:0;}
// Work-swing envelope with contact at phase zero: recover off the strike,
// wind the tool back up with a short anticipation hold at the cock, then
// accelerate through the strike snap so the tool arrives fast. Pinned at
// strikeLift(0)=0 and strikeLift(.72)=1 for the shared contact clocks.
export function strikeLift(phase){
 if(phase<.16)return phase/.16*.12;
 if(phase<.58){const t=(phase-.16)/.42;return .12+t*t*.84;}
 if(phase<.72){const t=(phase-.58)/.14;return .96+t*.04;}
 return Math.pow((1-phase)/.28,.62);
}
