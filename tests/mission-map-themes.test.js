import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {buildTiles} from '../src/systems/biomes.js';
import {sceneryPlan} from '../src/environment-art.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','expansion','biomes'].map(async n=>[
  n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))
 ])
));

test('mission map themes: expedition tile sheets stay homestead-sized and do not inherit home landmarks',()=>{
 const d=structuredClone(data),m=d.missions.find(m=>m.id==='the-longest-night'),w=createWorld(d,m);
 assert.deepEqual(w.bounds,{w:20,h:17});
 assert.equal(w.tiles.length,20*17);
 assert.equal(w.tiles.some(t=>t.landmark==='Stillwater'||t.landmark==='Moonwell'||t.landmark==='Timber Line'),false);
});

test('mission map themes: destination chapters carry their own biome, landmark and scenery seed',()=>{
 const d=structuredClone(data);
 const expected={
  'the-pale-court':['plains','Southreach Crossing',1201],
  'the-longest-night':['hills','Starwatch Ridge',1307],
  dawn:['plains','Dawnfields',1411],
 };
 for(const [id,[biome,landmark,seed]] of Object.entries(expected)){
  const m=d.missions.find(m=>m.id===id),w=createWorld(d,m);
  const marked=w.tiles.find(t=>t.landmark===landmark);
  assert.ok(marked,`${id} shows ${landmark}`);
  assert.equal(marked.biome,biome);
  assert.equal(w.biomeSeed,seed);
  assert.ok(w.tiles.filter(t=>!t.landmark).every(t=>t.biome===biome),`${id} uses ${biome} as its base terrain`);
 }
});

test('mission map themes: home frontier keeps its full grid and original landmarks',()=>{
 const d=structuredClone(data),w=createWorld(d);
 assert.equal(w.tiles.length,d.world.width*d.world.height);
 for(const name of ['Stillwater','Timber Line','Moonwell','Starwatch Ridge','Southreach Crossing','Dawnfields'])
  assert.ok(w.tiles.some(t=>t.landmark===name),`home keeps ${name}`);
 assert.equal(w.biomeSeed,d.world.seed);
});

test('mission map themes: forced biome fill is generic and per-world scenery seeds affect prop plans',()=>{
 const forced=buildTiles({width:5,height:4,seed:99,defaultBiome:'hills',tiles:[]});
 assert.ok(forced.every(t=>t.biome==='hills'));
 const d={
  buildings:{},
  world:{seed:999},
  biomes:{plains:{scenery:{claimedDensity:.5,wildDensity:.5,props:['grass','stone','stump']}}}
 };
 const tiles=[];for(let y=0;y<4;y++)for(let x=0;x<8;x++)tiles.push({x,y,biome:'plains',claimed:true,landmark:null});
 const signatures=new Set();
 for(const seed of [1,2,3,4,5])signatures.add(JSON.stringify(sceneryPlan({tiles,buildings:[],biomeSeed:seed},d)));
 assert.ok(signatures.size>1,'mission scenery changes when its world seed changes');
});
