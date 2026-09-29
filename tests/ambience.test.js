import test from 'node:test';
import assert from 'node:assert/strict';
import {ambienceProfile,AmbiencePlayer} from '../src/systems/ambience.js';

const data={world:{daynight:{dayLength:300,rainChance:0,fogChance:0}}};

test('ambience profile follows the living world clock',()=>{
 const dawn=ambienceProfile({elapsed:0,buildings:[]},data);
 const day=ambienceProfile({elapsed:60,buildings:[{hp:10,remaining:0}]},data);
 const night=ambienceProfile({elapsed:240,buildings:[]},data);
 assert.equal(dawn.phase,'dawn');
 assert.equal(day.phase,'day');
 assert.equal(day.settlement,1);
 assert.equal(night.phase,'night');
 assert.equal(night.night,true);
});

test('unfinished and ruined buildings do not add settlement ambience density',()=>{
 const profile=ambienceProfile({elapsed:60,buildings:[
  {hp:10,remaining:0},
  {hp:10,remaining:4},
  {hp:0,remaining:0},
 ]},data);
 assert.equal(profile.settlement,1);
});

test('ambience player is Node-safe without browser audio',()=>{
 const previousWindow=globalThis.window;
 delete globalThis.window;
 try{
  const player=new AmbiencePlayer({world:{elapsed:60,buildings:[]},data});
  assert.doesNotThrow(()=>{player.tick();player.setEnabled(false);player.tick();player.reset();});
 }finally{if(previousWindow!==undefined)globalThis.window=previousWindow;}
});
