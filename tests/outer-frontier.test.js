import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {Game} from '../src/game.js';
import {regionFor,isRegionClaimed} from '../src/systems/expansion.js';
import {buildTiles} from '../src/systems/biomes.js';
import {migrate,VERSION} from '../src/storage.js';
import {recordAssault} from '../src/systems/conquest.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','expansion','biomes'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])
));
const inRect=(r,x,y)=>x>=r.rect.x&&y>=r.rect.y&&x<r.rect.x+r.rect.w&&y<r.rect.y+r.rect.h;

test('outer frontier expands the home grid to 52x44 with exactly one region per tile',()=>{
 assert.equal(data.world.width,52);assert.equal(data.world.height,44);
 assert.equal(data.expansion.regions.length,16);
 for(let y=0;y<data.world.height;y++)for(let x=0;x<data.world.width;x++){
  const matches=data.expansion.regions.filter(r=>inRect(r,x,y));
  assert.equal(matches.length,1,`tile ${x},${y} belongs to exactly one region`);
  assert.equal(regionFor(data.expansion,x,y)?.id,matches[0].id);
 }
});

test('fresh worlds contain the outer landmarks but do not gift their regions',()=>{
 const w=createWorld(structuredClone(data));
 assert.equal(w.tiles.length,52*44);
 for(const name of ['Starwatch Ridge','Whisperwood','Ashfall March','Blackwater Mouth','Southreach Crossing','Dawnfields','Pale Coast']){
  const t=w.tiles.find(t=>t.landmark===name);assert.ok(t,name);assert.equal(t.claimed,false,`${name} starts wild`);
 }
 assert.equal(isRegionClaimed(w,regionFor(data.expansion,10,10)),true,'old hearthlands stay preclaimed');
});

test('east outer regions unlock from the existing frontier without moving the village',()=>{
 const g=new Game(structuredClone(data));
 const hall=structuredClone(g.world.buildings.find(b=>b.type==='hall'));
 g.world.resources={...g.world.resources,wood:50000,food:50000,gold:50000,frostwood:5000,plate:1000};
 assert.equal(g.expandClaim(46,10),false,'Whisperwood is not reachable before Timber Deep');
 assert.equal(g.expandClaim(26,10),true,'Timber Deep still borders the hearthlands');
 recordAssault(g.world,'thornband');
 assert.equal(g.expandClaim(46,10),true,'Whisperwood opens from Timber Deep');
 assert.equal(isRegionClaimed(g.world,regionFor(data.expansion,46,10)),true);
 const after=g.world.buildings.find(b=>b.id===hall.id);assert.deepEqual(after,hall,'existing building coordinates and state stay untouched');
});

test('south outer regions continue the existing Southfield claim chain',()=>{
 const g=new Game(structuredClone(data));
 g.world.resources={...g.world.resources,wood:50000,food:50000,gold:50000,frostwood:5000,plate:1000};
 assert.equal(g.expandClaim(13,38),false,'Southreach begins beyond the current south edge');
 assert.equal(g.expandClaim(10,25),true,'Southfield Flats remains the bridge south');
 assert.equal(g.expandClaim(13,38),true,'Southreach opens after Southfield Flats');
 assert.equal(isRegionClaimed(g.world,regionFor(data.expansion,13,38)),true);
});

test('v12 tile-grid saves append only new unclaimed coordinates and preserve old tiles',()=>{
 const oldWorld={...data.world,width:40,height:34,tiles:data.world.tiles.filter(t=>t.x<40&&t.y<34)};
 const tiles=buildTiles(oldWorld,{w:0,h:0});
 const kept=tiles.find(t=>t.x===39&&t.y===33);kept.claimed=true;kept.note='keep-me';
 const oldFalse=tiles.find(t=>t.x===38&&t.y===33);oldFalse.claimed=false;
 const value={version:12,world:{tiles,buildings:[],troops:[],resources:{wood:1,food:1,gold:1},enemies:[],effects:[]},home:null,completed:[],unlocks:[],questsCompleted:[],xp:0};
 const migrated=migrate(structuredClone(value),data);
  assert.equal(migrated.version,VERSION);assert.equal(VERSION,15);
 assert.equal(migrated.world.tiles.length,52*44);
 const same=migrated.world.tiles.find(t=>t.x===39&&t.y===33);assert.equal(same.claimed,true);assert.equal(same.note,'keep-me');
 assert.equal(migrated.world.tiles.find(t=>t.x===38&&t.y===33).claimed,false);
 assert.equal(migrated.world.tiles.find(t=>t.x===51&&t.y===43).claimed,false,'new far corner is wild');
 assert.equal(migrated.world.tiles.find(t=>t.landmark==='Pale Coast').claimed,false,'new landmark is not gifted');
});

test('v12 tile-less vintage saves leave reconstruction to the established Game path',()=>{
 const value={version:12,world:{tiles:null},home:null};
 const migrated=migrate(structuredClone(value),data);
  assert.equal(migrated.version,15);assert.equal(migrated.world.tiles,null);
});
