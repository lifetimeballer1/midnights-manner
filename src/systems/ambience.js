import {isMuted,sharedAudioContext,sharedAudioOutput} from './audio.js';
import {phaseAt,weatherAt} from './daynight.js';

// Sparse, synthesized ambience. No samples, timers, save fields or external assets.
// The frame loop calls tick(); this module only schedules a tiny cluster when the
// previous cluster has expired, so ambience stays cheap and easy to remove.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const random=(min,max)=>min+Math.random()*(max-min);

function standingBuildings(world){
 return Array.isArray(world?.buildings)?world.buildings.filter(b=>b&&b.hp>0&&!(b.remaining>0)).length:0;
}

export function ambienceProfile(world,data){
 const elapsed=Number.isFinite(world?.elapsed)?world.elapsed:0;
 const phase=phaseAt(elapsed,data);
 const weather=weatherAt(elapsed,data);
 return {
  phase:phase.id,
  night:Boolean(phase.night),
  weather:weather?.id||'clear',
  settlement:standingBuildings(world),
 };
}

function note(context,output,frequency,duration,{delay=0,volume=.018,type='sine',slide=0}={}){
 try{
  const start=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();
  osc.type=type;osc.frequency.setValueAtTime(Math.max(35,frequency),start);
  if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(35,frequency+slide),start+duration);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(Math.max(.001,volume),start+Math.min(.025,duration*.25));
  gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  osc.connect(gain).connect(output);osc.start(start);osc.stop(start+duration+.025);
 }catch{}
}

function bird(context,output){
 const root=random(920,1280);
 note(context,output,root,.11,{volume:.014,slide:root*.22});
 note(context,output,root*1.18,.09,{delay:.11,volume:.012,slide:-root*.08});
 if(Math.random()>.55)note(context,output,root*1.34,.07,{delay:.22,volume:.01,slide:root*.06});
}
function insects(context,output){
 const root=random(1650,2250);
 for(let i=0;i<3;i++)note(context,output,root+random(-90,90),.035,{delay:i*.075,volume:.006,type:'square',slide:80});
}
function rain(context,output){
 for(let i=0;i<4;i++)note(context,output,random(820,1550),random(.035,.075),{delay:i*random(.045,.11),volume:.005,type:'sine',slide:-random(180,420)});
}
function settlement(context,output){
 const root=random(115,155);
 note(context,output,root,.055,{volume:.011,type:'triangle',slide:-30});
 note(context,output,root*.82,.045,{delay:.11,volume:.008,type:'triangle',slide:-18});
}
function nightCall(context,output){
 const root=random(310,390);
 note(context,output,root,.3,{volume:.009,type:'sine',slide:-55});
 note(context,output,root*.88,.34,{delay:.34,volume:.007,type:'sine',slide:-45});
}

export class AmbiencePlayer{
 constructor(game){this.game=game;this.nextAt=0;this.enabled=true;this.lastProfile=null;}
 setEnabled(enabled){this.enabled=Boolean(enabled);if(!this.enabled)this.nextAt=0;}
 reset(){this.nextAt=0;this.lastProfile=null;}
 tick(){
  if(!this.enabled||isMuted())return;
  const context=sharedAudioContext(),output=sharedAudioOutput();if(!context||!output)return;
  if(context.currentTime<this.nextAt)return;
  const profile=ambienceProfile(this.game?.world,this.game?.data);this.lastProfile=profile;
  const roll=Math.random();
  if(profile.weather==='rain'){
   rain(context,output);
   this.nextAt=context.currentTime+random(.8,1.7);
   return;
  }
  if(profile.night){
   if(roll<.82)insects(context,output);else nightCall(context,output);
   this.nextAt=context.currentTime+random(2.4,5.2);
   return;
  }
  if(profile.phase==='dusk'&&roll<.58)insects(context,output);
  else if(profile.settlement>=3&&roll>.72)settlement(context,output);
  else bird(context,output);
  const density=clamp(profile.settlement/20,0,1);
  this.nextAt=context.currentTime+random(2.8-density*.6,6.4-density*1.2);
 }
}
