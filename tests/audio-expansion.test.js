import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {expandedMusicData,MusicPlayer} from '../src/music-plus.js';
import {ambience,sfx} from '../src/systems/audio.js';

test('live soundtrack expands the four core themes to ten original themes',async()=>{
 const data=JSON.parse(await readFile(new URL('../data/music.json',import.meta.url),'utf8'));
 assert.equal(data.themes.length,4,'core soundtrack remains four themes for backward compatibility');
 assert.equal(data.bonusThemes.length,6,'six optional themes extend the live soundtrack');
 const expanded=expandedMusicData(data);
 assert.equal(expanded.themes.length,10,'live game receives ten themes');
 const ids=new Set(expanded.themes.map(theme=>theme.id));
 for(const id of ['ember','grove','haze','lattice','dawn','hearth','road','slate','lanterns','firstlight'])assert.ok(ids.has(id),`theme ${id} is available`);
 const player=new MusicPlayer(data);
 assert.equal(player.themes.length,10,'expanded player loads all ten themes');
});

test('new audio hooks are Node-safe and ambience can stop without browser audio',()=>{
 const previousWindow=globalThis.window;
 delete globalThis.window;
 try{
  for(const name of ['workChop','workPick','workHammer','workFarm','workMill','bow','blade','shield','gate','footstep','warning','research','fail']){
   assert.equal(typeof sfx[name],'function',`${name} sound exists`);
   assert.doesNotThrow(()=>sfx[name](),`${name} no-ops safely outside a browser`);
  }
  assert.doesNotThrow(()=>ambience.update({night:false,weather:'clear',buildings:[]}));
  assert.doesNotThrow(()=>ambience.stop());
 }finally{if(previousWindow!==undefined)globalThis.window=previousWindow;}
});
