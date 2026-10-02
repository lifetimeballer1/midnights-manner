import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isMuted,sfx,toggleMute} from '../src/systems/audio.js';

class FakeParam{
 constructor(value=0){this.value=value;}
 setValueAtTime(value){this.value=value;}
 setTargetAtTime(value){this.value=value;}
 exponentialRampToValueAtTime(value){this.value=value;}
 cancelScheduledValues(){}
}
class FakeNode{
 constructor(kind){this.kind=kind;this.connections=[];this.gain=new FakeParam(1);this.frequency=new FakeParam();this.detune=new FakeParam();this.delayTime=new FakeParam();this.stops=0;this.failStops=0;}
 connect(node){this.connections.push(node);return node;}
 disconnect(){this.connections=[];}
 start(time){this.startAt=time;}
 stop(){this.stops++;if(this.failStops){this.failStops--;throw Error('injected stop failure');}}
}
class FakeAudioContext{
 constructor(){this.nodes=[];this.destination=new FakeNode('destination');this.currentTime=0;this.state='running';FakeAudioContext.last=this;}
 createGain(){const node=new FakeNode('gain');this.nodes.push(node);return node;}
 createOscillator(){const node=new FakeNode('oscillator');this.nodes.push(node);return node;}
 createDelay(){const node=new FakeNode('delay');this.nodes.push(node);return node;}
 resume(){return Promise.resolve();}
}

async function loadMusic(){
 const engine=await import('../src/music.js').catch(()=>null);
 assert.ok(engine,'music engine module loads');
 const data=await readFile(new URL('../data/music.json',import.meta.url),'utf8').then(JSON.parse).catch(()=>null);
 assert.ok(data,'music score data loads');
 const themes=engine.resolveThemes(data);
 assert.ok(themes.length>=1,'at least one theme resolves');
 const score=themes[0];
 return {engine,score,themes,data};
}

test('music player is safe without browser audio',async()=>{
 const {engine,score}=await loadMusic(),previousWindow=globalThis.window;
 delete globalThis.window;
 try{
  const player=new engine.MusicPlayer(score);
  assert.doesNotThrow(()=>{player.start({calm:true});player.setEnabled(true);player.setCalm(false);player.stop();});
 }finally{if(previousWindow!==undefined)globalThis.window=previousWindow;}
});

test('generated phrases stay in key, vary by phrase, and thin out under Calm',async()=>{
 const {engine,score}=await loadMusic(),full=engine.createPhrase(score,0,false),calm=engine.createPhrase(score,0,true);
 assert.deepEqual(full,engine.createPhrase(score,0,false),'a phrase index is reproducible');
 assert.notDeepEqual(full,engine.createPhrase(score,1,false),'later phrases vary');
 const melody=full.notes.filter(note=>note.voice==='pluck'),calmMelody=calm.notes.filter(note=>note.voice==='pluck');
 assert.ok(melody.length>=8,'full mode carries a clear melody');
 assert.ok(melody.every(note=>score.scale.includes((note.semitone%12+12)%12)),'melody stays in the configured mode');
 assert.ok(calmMelody.length<melody.length,'Calm mode uses fewer plucked notes');
 assert.ok(full.duration>0&&calm.duration===full.duration,'both arrangements loop on the same phrase boundary');
});

test('generated melodies keep adjacent plucks within a fifth',async()=>{
 const {engine,score}=await loadMusic();
 for(let phrase=0;phrase<8;phrase++){
  const line=engine.createPhrase(score,phrase,false).notes.filter(note=>note.voice==='pluck');
  for(let i=1;i<line.length;i++)assert.ok(Math.abs(line[i].semitone-line[i-1].semitone)<=7,`phrase ${phrase} has a leap wider than a fifth`);
 }
});

test('melody voice-leading stays within a fifth across phrase boundaries',async()=>{
 const {engine,score}=await loadMusic();let previous=31;
 for(let phrase=0;phrase<32;phrase++){
  const line=engine.createPhrase(score,phrase,false,previous).notes.filter(note=>note.voice==='pluck');
  assert.ok(Math.abs(line[0].semitone-previous)<=7,`phrase ${phrase} starts with an octave jump`);
  previous=line.at(-1).semitone;
 }
});

test('muting mid-phrase resumes from the last pluck that actually played',async()=>{
 const {engine,score}=await loadMusic(),previousWindow=globalThis.window,wasMuted=isMuted();let player=null;
 globalThis.window={AudioContext:FakeAudioContext};
 try{
  if(wasMuted)toggleMute();
  if(FakeAudioContext.last)FakeAudioContext.last.currentTime=0;
  player=new engine.MusicPlayer(score);player.phrase=4;player.start();
  const ctx=FakeAudioContext.last,played=engine.createPhrase(score,4,false,31).notes.find(note=>note.voice==='pluck').semitone;
  ctx.currentTime=.08;player.setEnabled(false);
  assert.equal(player.lastPitch,played,'muting records the last note that has begun, not a scheduled future note');
  const prior=ctx.nodes.length;player.setEnabled(true);
  const nextPitch=engine.createPhrase(score,5,false,played).notes.find(note=>note.voice==='pluck').semitone;
  const resumed=ctx.nodes.slice(prior).filter(node=>node.kind==='oscillator');
  assert.ok(resumed.some(node=>Math.abs(node.frequency.value-score.rootHz*2**(nextPitch/12))<.01),'the resumed phrase uses that played pitch for voice-leading');
 }finally{
  player?.stop();
  if(isMuted()!==wasMuted)toggleMute();
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
 }
});

test('a stop failure keeps a started voice tracked for retry',async()=>{
 const {engine,score}=await loadMusic(),previousWindow=globalThis.window,wasMuted=isMuted();let player=null,ctx=null,originalCreate=null;
 globalThis.window={AudioContext:FakeAudioContext};
 try{
  if(wasMuted)toggleMute();
  sfx.place();ctx=FakeAudioContext.last;const prior=ctx.nodes.length;originalCreate=ctx.createOscillator;
  const create=originalCreate.bind(ctx);let failFirst=true;
  ctx.createOscillator=()=>{const node=create();if(failFirst){node.failStops=3;failFirst=false;}return node;};
  player=new engine.MusicPlayer(score);player.start();
  const failed=ctx.nodes.slice(prior).find(node=>node.kind==='oscillator'&&node.stops>=2);
  assert.ok(failed&&player.sources.has(failed),'a started source remains owned after its first stop failure');
  player.stop();assert.ok(player.sources.has(failed)&&player.context,'a repeated failure retains the source and its context');
  player.stop();assert.ok(failed.stops>=4,'a later stop retries the source again');
 }finally{
  player?.stop();if(ctx&&originalCreate)ctx.createOscillator=originalCreate;
  if(isMuted()!==wasMuted)toggleMute();
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
 }
});

test('music notes route through the shared output and stop cleanly',async()=>{
 const {engine,score}=await loadMusic(),previousWindow=globalThis.window,wasMuted=isMuted();let player=null;
 globalThis.window={AudioContext:FakeAudioContext};
 try{
  if(wasMuted)toggleMute();
  const prior=FakeAudioContext.last?.nodes.length||0;player=new engine.MusicPlayer(score);player.start();
  const ctx=FakeAudioContext.last,created=ctx.nodes.slice(prior),master=ctx.nodes.find(node=>node.kind==='gain'&&node.connections.includes(ctx.destination));
  const output=created.find(node=>node.kind==='gain'&&node.connections.includes(master));
  assert.ok(output,'music has a local gain into the shared bus');
  player.stop();
  assert.equal(player.playing,false,'stop ends playback');
 }finally{
  player?.stop();
  if(isMuted()!==wasMuted)toggleMute();
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
 }
});

test('ended notes disconnect their envelopes and pluck partials',async()=>{
 const {engine,score}=await loadMusic(),previousWindow=globalThis.window,wasMuted=isMuted();
 let player=null;
 globalThis.window={AudioContext:FakeAudioContext};
 try{
  if(wasMuted)toggleMute();
  const prior=FakeAudioContext.last?.nodes.length||0;player=new engine.MusicPlayer(score);player.start();
  const ctx=FakeAudioContext.last,created=ctx.nodes.slice(prior),master=ctx.nodes.find(node=>node.kind==='gain'&&node.connections.includes(ctx.destination));
  const output=created.find(node=>node.kind==='gain'&&node.connections.includes(master));
  const envelopes=created.filter(node=>node.kind==='gain'&&node.connections.includes(output));
  const partials=created.filter(node=>node.kind==='gain'&&node.connections.some(target=>envelopes.includes(target)));
  const sources=created.filter(node=>node.kind==='oscillator');
  player.setEnabled(false);
  for(const source of sources)source.onended?.();
  assert.ok(envelopes.length>0&&envelopes.every(node=>node.connections.length===0),'ended voices release their envelope nodes');
  assert.ok(partials.length>0&&partials.every(node=>node.connections.length===0),'ended plucks release their harmonic nodes');
 }finally{
  player?.stop();
  if(isMuted()!==wasMuted)toggleMute();
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
 }
});

test('sound effects share a master output that the sound setting can mute',()=>{
 const previousWindow=globalThis.window,wasMuted=isMuted();
 globalThis.window={AudioContext:FakeAudioContext};
 try{
  if(wasMuted)toggleMute();
  const prior=FakeAudioContext.last?.nodes.length||0;
  sfx.place();
  const ctx=FakeAudioContext.last,created=ctx.nodes.slice(prior),outputs=ctx.nodes.filter(node=>node.kind==='gain'&&node.connections.includes(ctx.destination));
  assert.equal(outputs.length,1,'one master output connects to the device');
  const [master]=outputs;
  assert.ok(created.filter(node=>node.kind==='oscillator').every(node=>node.connections[0]?.connections.includes(master)),'all SFX route through the master output');
  toggleMute();assert.equal(master.gain.value,0,'sound off silences active audio');
  toggleMute();assert.equal(master.gain.value,1,'sound on restores audio');
 }finally{
  if(isMuted()!==wasMuted)toggleMute();
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
 }
});

test('multi-theme music resolves the battle soundtrack',async()=>{
  const {engine,themes}=await loadMusic();
  assert.ok(themes.length>=5,'five battle theme songs are available');
  const ids=themes.map(t=>t.id);
  assert.ok(ids.includes('iron_gate')&&ids.includes('midnight_walls')&&ids.includes('watchfire')&&ids.includes('aftermath')&&ids.includes('ashen-choir'),'battle, tension, aftermath and celebration themes present');
  for(const theme of themes){
   const phrase=engine.createPhrase(theme,0,false);
   assert.ok(phrase.notes.length>0&&phrase.duration>0,`theme ${theme.id} generates a playable phrase`);
   const melody=phrase.notes.filter(n=>n.voice==='pluck');
   assert.ok(melody.every(n=>theme.scale.includes((n.semitone%12+12)%12)),`theme ${theme.id} stays in its scale`);
   // J6 global-phone pass: every song thins under Calm and ships a sane mix —
   // voices inside the engine's 0.005-0.2 lane, master gain at or below 0.75.
   const calm=engine.createPhrase(theme,0,true).notes.filter(n=>n.voice==='pluck');
   assert.ok(calm.length<melody.length,`theme ${theme.id} thins its melody under Calm`);
   for(const [voice,level] of Object.entries(theme.voices||{}))
    assert.ok(level>=0.005&&level<=0.2,`theme ${theme.id} voice ${voice} stays mixable`);
   assert.ok(theme.gain>0&&theme.gain<=0.75,`theme ${theme.id} master gain stays unclipped`);
  }
});

test('MusicPlayer picks a random theme on start and can re-roll',async()=>{
 const {engine,data}=await loadMusic(),previousWindow=globalThis.window;
 delete globalThis.window;
 try{
  const player=new engine.MusicPlayer(data);
   assert.ok(player.themes.length>=5,'player loads the battle theme pool');
  player.start({calm:true});
  assert.ok(player.score&&player.score.id,'start selects a score');
  const first=player.themeIndex;
  player.pickTheme((first+1)%player.themes.length);
  assert.notEqual(player.themeIndex,first,'pickTheme can change the active song');
  player.stop();
 }finally{if(previousWindow!==undefined)globalThis.window=previousWindow;}
});


test('music mood selection stays inside matching theme groups',async()=>{
 const {engine,data}=await loadMusic(),previousWindow=globalThis.window;
 delete globalThis.window;
 try{
  const player=new engine.MusicPlayer(data);
  player.setMood('night');player.pickTheme();
  assert.ok(player.score.moods.includes('night'),'night mood selects a night-capable theme');
  player.setMood('danger');player.pickTheme();
  assert.ok(player.score.moods.includes('danger'),'danger mood selects a danger-capable theme');
   player.setMood('weather');player.pickTheme();
   assert.ok(player.score&&player.score.id,'weather mood falls back to a battle theme (keepers own the calm weather)');
   player.stop();
 }finally{if(previousWindow!==undefined)globalThis.window=previousWindow;}
});

 test('expanded SFX exposes workplace and combat cues',()=>{
  for(const name of ['workChop','workPick','workHammer','arrow','blade','footstep','gate','warning','research','fail'])
   assert.equal(typeof sfx[name],'function',name+' cue is available');
 });

 test('update celebration plays the choir, then settles to a quarter volume',async()=>{
  const {engine,data}=await loadMusic(),previousWindow=globalThis.window,wasMuted=isMuted();
  const {sharedAudioOutput}=await import('../src/systems/audio.js');
  let player=null;
  globalThis.window={AudioContext:FakeAudioContext};
  try{
   if(wasMuted)toggleMute();
   player=new engine.MusicPlayer(data);
   assert.equal(player.celebrate(30),true,'celebration queues before start');
   player.start();
   assert.equal(player.score.id,'ashen-choir','the update song takes the stage');
   assert.ok(player.playing&&player.output,'celebration is audible');
   assert.ok(player.output.connections.includes(sharedAudioOutput()),'celebration routes into the shared bus');
   await new Promise(resolve=>setTimeout(resolve,80));
   assert.ok(player.output,'celebration still holds the stage');
   assert.ok(Math.abs(player.output.gain.value-0.72*0.25)<0.001,`choir settles to 25% (got ${player.output.gain.value})`);
  }finally{
   player?.stop();
   if(isMuted()!==wasMuted)toggleMute();
   if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
  }
 });


test('felt piano 808 keeper suite keeps approved tracks and older originals',async()=>{
 const ambient=await readFile(new URL('../data/ambient-score.json',import.meta.url),'utf8').then(JSON.parse);
 const audio=await import('../src/audio.js');
 const added=['low_horizon','granular_rain','permafrost','cavern_beacon','daylight_dissolve'];
 const retained=['grassblock','orchestral','desert','honeyblock','nether'];
 assert.equal(ambient.defaultTrack,'low_horizon');
 assert.deepEqual(ambient.songGapSeconds,[22,48]);
 for(const key of added){
  const track=ambient.tracks[key];
  assert.ok(track,key+' exists');
  assert.equal(track.felt808,true,key+' keeps its 808 arrangement');
  assert.equal(track.tempo,66,key+' keeps the approved tempo');
  assert.equal(track.phrases.length,16,key+' keeps all sixteen bars');
  for(const phrase of track.phrases){
   assert.equal(phrase.bars,1);
   assert.match(phrase.bass,/^[A-G][#b]?\\d$/);
   assert.ok(Array.isArray(phrase.pad)&&phrase.pad.length>=3&&phrase.pad.length<=4);
   assert.ok(phrase.bassVel>0&&phrase.bassVel<1);
  }
 }
 for(const key of retained)assert.ok(ambient.tracks[key],key+' remains available');
 const picked=audio.pickKeeperTrack(ambient.tracks,'day','low_horizon',()=>0);
 assert.ok(picked&&picked!=='low_horizon','day rotation avoids an immediate repeat');
 assert.equal(audio.trackSupportsMood(ambient.tracks[picked],'day'),true,'rotated track supports the active mood');
});
