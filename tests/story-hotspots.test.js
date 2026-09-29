import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {addEnvironmentScenery,hotspotAt} from '../src/environment-art.js';
import {createWorld} from '../src/model.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','expansion','biomes'].map(async n=>[
  n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))
 ])
));

const context=new Proxy({},{
 get:(t,k)=>t[k]||(()=>k.includes('Gradient')?{addColorStop(){}}:undefined),
 set:(t,k,v)=>(t[k]=v,true)
});

test('story hotspots: every hotspot is unique and sits on its named home landmark',()=>{
 const sites=data.world.hotspots||[];
 assert.equal(sites.length,10);
 assert.equal(new Set(sites.map(s=>s.id)).size,sites.length,'ids unique');
 assert.equal(new Set(sites.map(s=>s.x+','+s.y)).size,sites.length,'coordinates unique');
 for(const site of sites){
  const tile=data.world.tiles.find(t=>t.x===site.x&&t.y===site.y);
  assert.ok(tile,`${site.id} has a tile`);
  assert.equal(tile.landmark,site.name,`${site.id} title matches landmark`);
  assert.ok(site.text.length>=60,`${site.id} carries real lore`);
  assert.equal(hotspotAt(data.world,site.x,site.y)?.id,site.id);
 }
});

test('story hotspots: persistent home landmark mesh exposes a selectable site owner',()=>{
 const d=structuredClone(data),w=createWorld(d),site=d.world.hotspots.find(s=>s.id==='starwatch-ridge');
 const r=new Renderer({getContext:()=>context},d,{});
 r.resize(1200,820,1);r.cam.x=site.x+.5;r.cam.y=site.y+.5;r.cam.zoom=1.8;
 const s=new MeshScene(r);
 const drawn=addEnvironmentScenery(s,w,d);
 assert.ok(drawn>0);
 const faces=s.faces.filter(f=>f.owner?.kind==='site'&&f.owner.id===site.id);
 assert.ok(faces.length>0,'landmark geometry carries site hit owner');
 assert.ok(faces.every(f=>f.owner.name===site.name));
});

test('story hotspots: destination expedition landmarks never inherit home hotspot identity by local coordinate',()=>{
 const d=structuredClone(data),mission=d.missions.find(m=>m.id==='dawn'),w=createWorld(d,mission);
 const r=new Renderer({getContext:()=>context},d,{});
 r.resize(1000,760,1);r.cam.x=15.5;r.cam.y=12.5;r.cam.zoom=1.8;
 const s=new MeshScene(r);
 addEnvironmentScenery(s,w,d);
 assert.ok(w.tiles.some(t=>t.landmark==='Dawnfields'),'mission landmark exists');
 assert.equal(s.faces.some(f=>f.owner?.kind==='site'),false,'mission landmark is not home Timber Line lore');
});

test('story hotspots: lookup is read-only and unknown coordinates remain ordinary scenery',()=>{
 const before=JSON.stringify(data.world.hotspots);
 assert.equal(hotspotAt(data.world,51,43),null);
 assert.equal(hotspotAt(null,3,3),null);
 assert.equal(JSON.stringify(data.world.hotspots),before);
});
