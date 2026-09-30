import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {Renderer} from '../src/renderer.js';
import {makeBuilding} from '../src/model.js';
import {sfx} from '../src/systems/audio.js';

const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','biomes','expansion'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function boot(width=390,height=844){
 const texts=[],gradient={addColorStop(){}};
 const ctx=new Proxy({measureText:text=>({width:text.length*6}),fillText:text=>texts.push(text)}, {
  get:(t,k)=>k in t?t[k]:(...args)=>{
   for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),`${k}: finite coordinate`);
   if(k==='createRadialGradient'||k==='createLinearGradient')return gradient;
  },set:(t,k,v)=>(t[k]=v,true)
 });
 const game=new Game(structuredClone(data)),r=new Renderer({getContext:()=>ctx},game.data,{});
 r.resize(width,height,2);r.fitVillage(game.world);r.collectionEdgeControl=true;
 return {game,r,texts};
}
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

test('Task G: portrait, landscape and desktop render developed meshes below the face guard',t=>{
 for(const [width,height] of [[390,844],[844,390],[1440,900]]){
  const {game,r}=boot(width,height),w=game.world;
  // Every building at its final tier, with ready stock and full central stores.
  w.buildings=Object.entries(game.data.buildings).map(([type,spec],i)=>{
   const b=makeBuilding(type,4+(i%9)*3,3+Math.floor(i/9)*3,game.data,spec.tiers.length);
   b.remaining=0;b.harvestBonus=10000;return b;
  });
  for(const key of Object.keys(w.resources))w.resources[key]=1e6;
  r.cam.x=17;r.cam.y=14;r.selection=w.buildings[0].id;
  let peakStatic=0,peakVisible=0;
  for(const zoom of [.75,1.65,2.5])for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   Object.assign(r.cam,{zoom,yaw});r.draw(w,1000);r.draw(w,1016);
   const report=r.frameReport();
   peakStatic=Math.max(peakStatic,report.staticFaces);peakVisible=Math.max(peakVisible,report.faces);
   assert.ok(report.staticFaces>0&&report.staticFaces<30000,`${width}x${height}: ${report.staticFaces} static faces`);
   assert.ok(report.faces<30000);
   assert.ok(r.sceneFaces.every(f=>f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
   for(const hit of r.hitAreas.filter(h=>h.kind==='harvest')){
    assert.equal(hit.w,44);assert.equal(hit.h,44);
    assert.ok(!r.collectionSceneObstacles.some(o=>overlaps(hit,o)));
   }
  }
  t.diagnostic(`${width}x${height}: peak static ${peakStatic}, visible ${peakVisible} faces (mock Canvas; no browser layout assertion)`);
 }
});

test('Task G: routine housing information collapses at overview and during danger',()=>{
 const {game,r,texts}=boot();
 const b=makeBuilding('cottage',8,8,game.data);b.remaining=0;game.world.buildings=[b];
 r.cam.zoom=1.65;r.draw(game.world,1000);
 assert.ok(texts.some(t=>t.startsWith('🛏')));
 texts.length=0;r.cam.zoom=.75;r.draw(game.world,1016);
 assert.ok(!texts.some(t=>t.startsWith('🛏')));
 texts.length=0;r.cam.zoom=1.65;game.world.raidPending={count:4,timer:20};r.draw(game.world,1032);
 assert.ok(!texts.some(t=>t.startsWith('🛏')));
});

test('Task G: collection placement respects danger, selection and quest obstacles at each viewport',()=>{
 for(const [width,height] of [[390,844],[844,390],[1440,900]]){
  const {game,r}=boot(width,height),b=makeBuilding('farm',5,5,game.data);
  b.remaining=0;b.harvestBonus=430;game.world.buildings=[b];
  r.cam.zoom=1.65;r.project=()=>({x:width/2,y:height/2});
  r.collectionObstacles=[{x:width/2-70,y:0,w:140,h:100}];
  r.collectionSceneObstacles=[{x:width/2-40,y:height/2-180,w:80,h:120}];
  r.drawCollections(game.world);
  assert.equal(r.hitAreas.length,1);
  for(const o of [...r.collectionObstacles,...r.collectionSceneObstacles])assert.ok(!overlaps(r.hitAreas[0],o));
  r.hitAreas=[];r.cam.zoom=.75;r.drawCollections(game.world);assert.equal(r.hitAreas.length,1);
  for(const o of [...r.collectionObstacles,...r.collectionSceneObstacles])assert.ok(!overlaps(r.hitAreas[0],o));
 }
});

test('Task G: large collection batches bank every site with short capped effects and one sound',()=>{
 const {game}=boot();game.world.buildings=[];game.world.resources.food=0;
 for(let i=0;i<100;i++){
  const b=makeBuilding('farm',5,5,game.data);b.remaining=0;b.harvestBonus=1;game.world.buildings.push(b);
 }
 let sounds=0;const original=sfx.collectBatch;sfx.collectBatch=()=>sounds++;
 try{
  assert.deepEqual(game.collectAll(),{food:100});assert.equal(sounds,1);
  assert.ok(game.world.buildings.every(b=>b.harvestBonus===0));
  assert.equal(game.world.effects.length,60);
  assert.ok(game.world.effects.every(e=>e.life<=.9));
  const collectionEffects=[...game.world.effects];
  game.tick(1);assert.ok(collectionEffects.every(e=>!game.world.effects.includes(e)),'all batch effects expire within one second');
 }finally{sfx.collectBatch=original;}
});
