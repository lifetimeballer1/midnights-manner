import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {addEnvironmentScenery,visibleFrontierCamps} from '../src/environment-art.js';
import {claimRegion,regionById} from '../src/systems/expansion.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','expansion','biomes'].map(async n=>[
  n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))
 ])
));
const context=new Proxy({},{
 get:(t,k)=>t[k]||(()=>k.includes('Gradient')?{addColorStop(){}}:undefined),
 set:(t,k,v)=>(t[k]=v,true)
});

test('frontier camps: data points at real factions and regions',()=>{
 const camps=data.world.frontierCamps||[];
 assert.equal(camps.length,5);
 assert.equal(new Set(camps.map(c=>c.id)).size,camps.length);
 for(const camp of camps){
  assert.ok(regionById(data.expansion,camp.region),`${camp.id} region resolves`);
  assert.ok(data.world.enemyFactions.some(f=>f.id===camp.faction),`${camp.id} faction resolves`);
  assert.ok(camp.text.length>=60,`${camp.id} carries readable context`);
 }
});

test('frontier camps: wave gates appear progressively and claimed land removes them',()=>{
 const d=structuredClone(data),w=createWorld(d);
 w.wave=1;
 let camps=visibleFrontierCamps(w,d);
 assert.deepEqual(camps.map(c=>c.id),['thornband-whisper']);
 w.wave=5;
 camps=visibleFrontierCamps(w,d);
 assert.ok(camps.some(c=>c.id==='pale-starwatch'));
 assert.ok(camps.some(c=>c.id==='cinder-ashfall'));
 assert.equal(camps.some(c=>c.id==='ember-ashfall'),false);
 claimRegion(w,regionById(d.expansion,'whisperwood'));
 assert.equal(visibleFrontierCamps(w,d).some(c=>c.id==='thornband-whisper'),false,'claiming Whisperwood clears the Thornband camp');
});

test('frontier camps: expedition maps never display persistent-home camps',()=>{
 const d=structuredClone(data),mission=d.missions.find(m=>m.id==='the-longest-night'),w=createWorld(d,mission);
 w.wave=20;
 assert.deepEqual(visibleFrontierCamps(w,d),[]);
});

test('frontier camps: visible camp mesh carries a tappable faction owner',()=>{
 const d=structuredClone(data),w=createWorld(d);w.wave=1;
 const camp=d.world.frontierCamps.find(c=>c.id==='thornband-whisper');
 const r=new Renderer({getContext:()=>context},d,{});
 r.resize(1200,820,1);r.cam.x=camp.x+.5;r.cam.y=camp.y+.5;r.cam.zoom=1.8;
 const s=new MeshScene(r);
 addEnvironmentScenery(s,w,d);
 const faces=s.faces.filter(f=>f.owner?.kind==='faction-camp'&&f.owner.id===camp.id);
 assert.ok(faces.length>0,'camp geometry is selectable');
 assert.ok(faces.every(f=>f.owner.faction==='thornband'));
});

test('frontier camps: high-wave world exposes late camps while keeping scenery bounded',()=>{
 const d=structuredClone(data),w=createWorld(d);w.wave=20;
 const visible=visibleFrontierCamps(w,d);
 assert.ok(visible.some(c=>c.faction==='ember-legion'));
 assert.ok(visible.some(c=>c.faction==='pale-court'));
 const r=new Renderer({getContext:()=>context},d,{});
 r.resize(1500,900,1);r.cam.x=46;r.cam.y=30;r.cam.zoom=1.8;
 const s=new MeshScene(r),drawn=addEnvironmentScenery(s,w,d);
 assert.ok(drawn<=130,'camp groups share the existing scenery budget');
});
