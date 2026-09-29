import {isMuted,sharedAudioContext,sharedAudioOutput} from './systems/audio.js';

const DEFAULT_SCALE=[0,2,3,5,7,9,10];
const DEFAULT_PROGRESSION=[[0,3,7,10],[5,9,12,14],[-2,2,5,9],[-5,0,2,5]];
const mod12=n=>((n%12)+12)%12;
const bounded=(value,fallback,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
function notes(values,fallback,min=-24,max=24){
 const valid=Array.isArray(values)?values.filter(n=>Number.isInteger(n)&&n>=min&&n<=max):[];
 return [...new Set(valid.length?valid:fallback)];
}
function scoreData(score){
 const scale=notes(score?.scale,DEFAULT_SCALE,0,11),progression=Array.isArray(score?.progression)?score.progression
  .map(chord=>notes(chord,[], -24,24)).filter(chord=>chord.length>=3):[];
 return {
  bpm:bounded(score?.bpm,72,48,96),rootHz:bounded(score?.rootHz,73.416,40,180),
  bars:Math.round(bounded(score?.bars,4,1,8)),pulsesPerBar:Math.round(bounded(score?.pulsesPerBar,6,3,8)),
  scale,progression:progression.length?progression:DEFAULT_PROGRESSION,
  melodySlots:notes(score?.melodySlots,[0,2,5],0,7),calmMelodySlots:notes(score?.calmMelodySlots,[0],0,7),
  voices:score?.voices&&typeof score.voices==='object'?score.voices:{},
  gain:bounded(score?.gain,.7,0,1),echo:score?.echo&&typeof score.echo==='object'?score.echo:{},
 };
}

function pickTone(chord,scale,phrase,bar,slot,previous){
 const tones=chord.filter(n=>scale.includes(mod12(n))),choices=[...new Set((tones.length?tones:scale).map(n=>{
  let pitch=n+24;while(pitch<22)pitch+=12;while(pitch>34)pitch-=12;return pitch;
 }))];
 const near=choices.filter(pitch=>pitch!==previous&&Math.abs(pitch-previous)<=5);
 const closest=Math.min(...choices.map(pitch=>Math.abs(pitch-previous)));
 const candidates=near.length?near:choices.filter(pitch=>Math.abs(pitch-previous)===closest);
 let seed=(Math.imul(phrase+1,0x9e3779b1)^Math.imul(bar+1,0x85ebca6b)^Math.imul(slot+1,0xc2b2ae35))|0;
 seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
 return candidates[(seed>>>0)%candidates.length];
}

export function createPhrase(score,phraseIndex=0,calm=false,previousPitch=31){
 const config=scoreData(score),phrase=Math.max(0,Math.trunc(Number(phraseIndex)||0));
 const pulseSeconds=30/config.bpm,barSeconds=pulseSeconds*config.pulsesPerBar,notes=[];let previous=Math.round(bounded(previousPitch,31,22,34));
 const add=(voice,semitone,time,duration)=>notes.push({voice,semitone,time,duration,frequency:config.rootHz*2**(semitone/12)});
 for(let bar=0;bar<config.bars;bar++){
  const chord=config.progression[(phrase+bar)%config.progression.length],time=bar*barSeconds;
  for(const semitone of chord.slice(0,3))add('pad',semitone+12,time,barSeconds+.22);
  add('bass',chord[0],time,barSeconds*.86);
  const slots=(calm?config.calmMelodySlots:config.melodySlots).filter(slot=>slot<config.pulsesPerBar);
  for(const slot of slots){previous=pickTone(chord,config.scale,phrase,bar,slot,previous);add('pluck',previous,time+slot*pulseSeconds,calm?barSeconds*.58:pulseSeconds*1.65);}
 }
 return {duration:barSeconds*config.bars,notes,lastPitch:previous};
}

function voiceLevel(score,voice,fallback){return bounded(score?.voices?.[voice],fallback,0.005,.2);}
function disconnect(node){try{node?.disconnect();}catch{}}

export class MusicPlayer{
 constructor(score){this.score=score||{};this.entered=false;this.enabled=false;this.playing=false;this.calm=false;this.phrase=0;this.lastPitch=31;this.activePhrase=null;this.timer=null;this.sources=new Set();this.context=null;this.output=null;this.delay=null;this.echo=null;}
 start({calm=false}={}){this.entered=true;this.calm=Boolean(calm);this.setEnabled(!isMuted());}
 setEnabled(enabled){this.enabled=Boolean(enabled)&&!isMuted();if(!this.enabled){this.stopPlayback();return;}if(this.entered&&!this.playing)this.play();}
 setCalm(calm){this.calm=Boolean(calm);}
 stop(){this.entered=false;this.enabled=false;this.stopPlayback();}
 play(){
  const context=sharedAudioContext(),destination=sharedAudioOutput();if(!context||!destination)return;
  this.context=context;this.output=context.createGain();this.output.gain.value=bounded(this.score?.gain,.7,0,1);this.output.connect(destination);
  this.delay=context.createDelay(.6);this.delay.delayTime.value=bounded(this.score?.echo?.seconds,.24,.08,.5);
  this.echo=context.createGain();this.echo.gain.value=bounded(this.score?.echo?.gain,.12,0,.3);
  this.output.connect(this.delay);this.delay.connect(this.echo).connect(destination);
  this.playing=true;this.schedulePhrase(context.currentTime+.06);
 }
 schedulePhrase(start){
  if(!this.playing)return;
  const phrase=createPhrase(this.score,this.phrase++,this.calm,this.lastPitch),context=this.context;this.activePhrase={...phrase,start};
  for(const note of phrase.notes)this.playNote(note,start+note.time);
  const next=start+phrase.duration;
  this.timer=setTimeout(()=>{if(!this.playing)return;this.lastPitch=phrase.lastPitch;this.activePhrase=null;this.schedulePhrase(Math.max(next,context.currentTime+.05));},Math.max(20,(next-context.currentTime)*1000));
 }
 playNote(note,when){
  const context=this.context,env=context.createGain(),start=Math.max(when,context.currentTime+.01),end=start+note.duration;
  const level=voiceLevel(this.score,note.voice,note.voice==='pluck'?.105:note.voice==='pad'?.085:.08);
  const attack=note.voice==='pad'?.65:note.voice==='bass'?.07:.025;
  env.gain.setValueAtTime(.0001,start);env.gain.exponentialRampToValueAtTime(level,start+attack);
  if(note.voice==='pad')env.gain.setValueAtTime(level*.82,Math.max(start+attack,end-.4));
  env.gain.exponentialRampToValueAtTime(.0001,end);env.connect(this.output);
  const partials=[];let remaining=1;
  if(note.voice==='pluck'){
   const partial=context.createGain();partial.gain.value=.14;partial.connect(env);partials.push(partial);remaining++;
  }
  const cleanup=()=>{if(--remaining===0){disconnect(env);for(const partial of partials)disconnect(partial);}};
  const source=context.createOscillator();source.type=note.voice==='pad'?'triangle':'sine';source.frequency.setValueAtTime(note.frequency,start);source.connect(env);this.track(source,start,end,cleanup);
  if(partials.length){const overtone=context.createOscillator();overtone.type='sine';overtone.frequency.setValueAtTime(note.frequency*2,start);overtone.connect(partials[0]);this.track(overtone,start,end,cleanup);}
 }
 track(source,start,end,onended){
  let finished=false;const finish=()=>{if(finished)return;finished=true;this.sources.delete(source);disconnect(source);onended();if(!this.playing&&!this.sources.size)this.context=null;};
  source.onended=finish;this.sources.add(source);
  try{source.start(start);}catch{finish();return;}
  try{source.stop(end+.035);}catch{try{source.stop(this.context.currentTime+.12);}catch{}}
 }
 stopPlayback(){
  if(this.timer!==null)clearTimeout(this.timer);this.timer=null;
  const context=this.context,output=this.output,delay=this.delay,echo=this.echo;
  if(context&&this.activePhrase){const elapsed=context.currentTime-this.activePhrase.start,heard=this.activePhrase.notes.filter(note=>note.voice==='pluck'&&note.time<=elapsed).at(-1);if(heard)this.lastPitch=heard.semitone;}
  this.activePhrase=null;
  if(context){const now=context.currentTime;
   if(output){try{output.gain.cancelScheduledValues(now);output.gain.setTargetAtTime(0,now,.035);}catch{}
    setTimeout(()=>{disconnect(output);disconnect(delay);disconnect(echo);},350);
   }
   for(const source of this.sources)try{source.stop(now+.12);}catch{}
  }
  this.context=this.sources.size?context:null;this.output=null;this.delay=null;this.echo=null;this.playing=false;
 }
}
