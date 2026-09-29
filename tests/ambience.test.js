import test from 'node:test';
import assert from 'node:assert/strict';
import {AmbiencePlayer,ambienceProfile,soundtrackMood} from '../src/systems/ambience.js';

const data={world:{daynight:{dayLength:300,rainChance:0,fogChance:0}}};

test('ambience profile follows day night and standing settlement activity',()=>{
 const dawn=ambienceProfile({elapsed:0,buildings:[]},data);
 const day=ambienceProfile({elapsed:60,buildings:[
  {type:'lumber',hp:10,remaining:0},
  {type:'mine',hp:10,remaining:0},
  {type:'forge',hp:10,remaining:0},
  {type:'farm',hp:10,remaining:0},
  {type:'tower',hp:0,remaining:0},
  {type:'mill',hp:10,remaining:4},
 ]},data);
 const night=ambienceProfile({elapsed:240,buildings:[]},data);
 assert.equal(dawn.phase,'dawn');
 assert.equal(day.phase,'day');
 assert.equal(day.settlement,4);
 assert.deepEqual(new Set(day.work),new Set(['chop','pick','hammer','farm']));
 assert.equal(night.night,true);
});

test('soundtrack mood prioritizes raids warnings weather and night',()=>{
 assert.equal(soundtrackMood({elapsed:60,buildings:[],enemies:[{hp:5}]},data),'danger');
 assert.equal(soundtrackMood({elapsed:60,buildings:[],raidPending:{timer:5}},data),'tension');
 const rainy={world:{daynight:{dayLength:300,rainChance:100,fogChance:0}}};
 assert.equal(soundtrackMood({elapsed:60,buildings:[]},rainy),'weather');
 assert.equal(soundtrackMood({elapsed:240,buildings:[]},data),'night');
 assert.equal(soundtrackMood({elapsed:60,buildings:[]},data),'day');
});

test('ambience player is safe without browser audio',()=>{
 const previousWindow=globalThis.window;
 delete globalThis.window;
 try{
  const player=new AmbiencePlayer({world:{elapsed:60,buildings:[]},data});
  assert.doesNotThrow(()=>{player.tick();player.setEnabled(false);player.tick();player.reset();});
 }finally{if(previousWindow!==undefined)globalThis.window=previousWindow;}
});
