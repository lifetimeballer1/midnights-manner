import {isMuted,sharedAudioContext,sharedAudioOutput,sfx,pumpScheduled} from './audio.js';
import {phaseAt,weatherAt} from './daynight.js';

// Sparse procedural ambience for the living village. Everything is synthesized
// through WebAudio so the game stays lightweight and carries no licensed audio.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const random=(min,max)=>min+Math.random()*(max-min);

const WORK_TYPES={
 chop:new Set(['lumber','timber_yard','sawmill','grove','frostgrove']),
 pick:new Set(['mine','deephole','mason_yard']),
  hammer:new Set(['forge','armory','workshop','smeltery','emberglass','fletcher','shieldwall-yard','tannery']),
  farm:new Set(['farm','pasture','mill','butchery','bakery','grove','frostgrove']),
};

function standingBuildings(world){
 return Array.isArray(world?.buildings)?world.buildings.filter(b=>b&&b.hp>0&&!(b.remaining>0)):[];
}
function workKinds(world){
 const kinds=[];
 for(const b of standingBuildings(world)){
  for(const [kind,types] of Object.entries(WORK_TYPES))if(types.has(b.type)){kinds.push(kind);break;}
 }
 return kinds;
}

export function ambienceProfile(world,data){
 const elapsed=Number.isFinite(world?.elapsed)?world.elapsed:0;
 const phase=phaseAt(elapsed,data);
 const weather=weatherAt(elapsed,data);
 const buildings=standingBuildings(world);
 return {
  phase:phase.id,
  night:Boolean(phase.night),
  weather:weather?.id||'clear',
  settlement:buildings.length,
  work:workKinds(world),
  raid:Boolean(world?.inRaid)||(Array.isArray(world?.enemies)&&world.enemies.some(e=>e&&e.hp>0)),
  warning:Boolean(world?.raidPending),
 };
}

export function soundtrackMood(world,data){
 const profile=ambienceProfile(world,data);
 if(profile.raid)return 'danger';
 if(profile.warning)return 'tension';
 if(profile.weather!=='clear')return 'weather';
 return profile.night?'night':'day';
}

function note(context,output,frequency,duration,{delay=0,volume=.012,type='sine',slide=0}={}){
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
 const root=random(930,1320);
 note(context,output,root,.1,{volume:.012,slide:root*.2});
 note(context,output,root*1.18,.085,{delay:.105,volume:.01,slide:-root*.07});
 if(Math.random()>.58)note(context,output,root*1.34,.065,{delay:.205,volume:.008,slide:root*.05});
}
function insects(context,output){
 const root=random(1680,2280);
 for(let i=0;i<3;i++)note(context,output,root+random(-85,85),.032,{delay:i*.078,volume:.0045,type:'square',slide:70});
}
function rain(context,output){
 for(let i=0;i<5;i++)note(context,output,random(760,1500),random(.03,.065),{delay:i*random(.045,.09),volume:.004,type:'sine',slide:-random(150,380)});
}
function fog(context,output){
 note(context,output,random(82,112),1.35,{volume:.0055,type:'sine',slide:-6});
 note(context,output,random(165,210),1.1,{delay:.18,volume:.0035,type:'triangle',slide:4});
}
function wind(context,output){
 note(context,output,random(105,145),.8,{volume:.0045,type:'sine',slide:random(-12,10)});
}
function settlement(context,output){
 const root=random(118,152);
 note(context,output,root,.05,{volume:.008,type:'triangle',slide:-25});
 note(context,output,root*.82,.045,{delay:.105,volume:.006,type:'triangle',slide:-16});
}
function farm(context,output){
 const root=random(430,540);
 note(context,output,root,.06,{volume:.006,type:'triangle',slide:-80});
 note(context,output,root*.7,.08,{delay:.11,volume:.0045,type:'sine',slide:-30});
}
function nightCall(context,output){
 const root=random(300,390);
 note(context,output,root,.28,{volume:.006,type:'sine',slide:-48});
 note(context,output,root*.87,.31,{delay:.32,volume:.005,type:'sine',slide:-38});
}
// Rare voices: sparse on purpose — silence between sounds matters more.
function raven(context,output){
 const root=random(520,640);
 note(context,output,root,.14,{volume:.008,type:'sawtooth',slide:-160});
 note(context,output,root*.92,.12,{delay:.17,volume:.007,type:'sawtooth',slide:-140});
}
function owl(context,output){
 const root=random(210,260);
 note(context,output,root,.32,{volume:.007,type:'sine',slide:-25});
 note(context,output,root*1.12,.4,{delay:.42,volume:.006,type:'sine',slide:-30});
}
function rooster(context,output){
 const root=random(620,720);
 note(context,output,root,.12,{volume:.009,type:'triangle',slide:120});
 note(context,output,root*1.25,.12,{delay:.14,volume:.009,type:'triangle',slide:140});
 note(context,output,root*1.5,.22,{delay:.28,volume:.008,type:'triangle',slide:-80});
}
function dog(context,output){
 const root=random(280,340);
 note(context,output,root,.09,{volume:.009,type:'square',slide:-120});
 note(context,output,root*.94,.09,{delay:.14,volume:.008,type:'square',slide:-110});
}
function livestock(context,output){
 const root=random(140,180);
 note(context,output,root,.5,{volume:.007,type:'sine',slide:35});
 note(context,output,root*.75,.4,{delay:.3,volume:.005,type:'sine',slide:-15});
}
function gust(context,output){
 note(context,output,random(150,190),1.6,{volume:.008,type:'sine',slide:random(-30,-14)});
 note(context,output,random(95,120),1.9,{delay:.3,volume:.006,type:'sine',slide:random(-18,-8)});
}

function playWork(kind,context,output){
 if(kind==='chop')sfx.workChop();
 else if(kind==='pick')sfx.workPick();
 else if(kind==='hammer')sfx.workHammer();
 else if(kind==='farm')farm(context,output);
 else settlement(context,output);
}

export class AmbiencePlayer{
 constructor(game){
  this.game=game;
  this.enabled=true;
  this.nextNatureAt=0;
  this.nextWorkAt=0;
  this.lastProfile=null;
 }
 setEnabled(enabled){this.enabled=Boolean(enabled);if(!this.enabled)this.reset();}
 reset(){this.nextNatureAt=0;this.nextWorkAt=0;this.lastProfile=null;}
  tick(){
   // Scheduled release/impact pairs drain first; muting drops them.
   pumpScheduled();
   if(!this.enabled||isMuted())return;
  const context=sharedAudioContext(),output=sharedAudioOutput();
  if(!context||!output)return;
  const profile=ambienceProfile(this.game?.world,this.game?.data);
  this.lastProfile=profile;

   if(context.currentTime>=this.nextNatureAt){
    if(profile.raid){
     wind(context,output);
     this.nextNatureAt=context.currentTime+random(5.5,9);
    }else if(profile.weather==='rain'){
     rain(context,output);
     // Occasional far thunder rolling behind the rain, never a crack.
     if(Math.random()<.1)try{sfx.gateThud({vol:.5,pitch:.45});}catch{}
     this.nextNatureAt=context.currentTime+random(.9,1.8);
    }else if(profile.weather==='fog'){
     if(Math.random()<.14)gust(context,output);else fog(context,output);
     this.nextNatureAt=context.currentTime+random(3.8,6.5);
    }else if(profile.night){
     const roll=Math.random();
     if(roll<.07)owl(context,output);
     else if(roll<.15&&profile.settlement>=3)dog(context,output);
     else if(roll<.86)insects(context,output);else nightCall(context,output);
     this.nextNatureAt=context.currentTime+random(2.7,5.6);
    }else if(profile.phase==='dawn'){
     if(Math.random()<.3)rooster(context,output);else bird(context,output);
     this.nextNatureAt=context.currentTime+random(3.4,6.4);
    }else{
     const roll=Math.random();
     if(roll<.05)raven(context,output);
     else if(roll<.1&&profile.settlement>=3)dog(context,output);
     else if(roll<.24)wind(context,output);else bird(context,output);
     this.nextNatureAt=context.currentTime+random(3.2,6.8);
    }
   }

   if(context.currentTime>=this.nextWorkAt){
    if(!profile.raid&&!profile.warning&&profile.settlement>=2){
     const kinds=profile.work,roll=Math.random();
     // Rare living-settlement voices between the work ticks: livestock
     // where herds graze, a far-off bark, an old timber settling.
     if(roll<.04&&kinds.includes('farm'))livestock(context,output);
     else if(roll<.06&&profile.settlement>=4)dog(context,output);
     else if(roll<.08&&profile.settlement>=5)try{sfx.creak({vol:.4,pitch:.7});}catch{}
     else if(kinds.length)playWork(kinds[Math.floor(Math.random()*kinds.length)],context,output);
     else if(profile.settlement>=5)settlement(context,output);
    }
   const density=clamp(profile.settlement/24,0,1);
   this.nextWorkAt=context.currentTime+random(3.8-density*.7,7.4-density*1.4);
  }
 }
}
