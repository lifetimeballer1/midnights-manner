import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel,drawVillage3D} from '../src/scene3d.js';
import {lightAt,sourceFlicker,sourceProfile,SOURCE_PROFILES} from '../src/source-lighting.js';
import {skyLightAt,DAY_LENGTH} from '../src/systems/daynight.js';
const data=Object.fromEntries(await Promise.all(['world','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const ctx=new Proxy({}, {get:(t,k)=>t[k]||(()=>k.includes('Gradient')?{addColorStop(){}}:undefined),set:(t,k,v)=>(t[k]=v,true)});
const renderer=()=>new Renderer({getContext:()=>ctx},data,{});
const building=(type,extra={})=>({id:1,type,x:8,y:8,level:1,hp:100,remaining:0,...extra});
function mesh(type,extra={}){const r=renderer(),s=new MeshScene(r),b=building(type,extra);buildingModel(s,b,data.buildings[type],{buildings:[b]});return s;}
test('only finished luminous structures emit light; previews and ruins stay dark',()=>{
 for(const type of ['cottage','hall','forge','smeltery','watchfire','gate','farm','pasture','mine','tower','sawmill','market']){
  assert.ok(mesh(type).sources.length>0,type);
  assert.equal(mesh(type,{hp:0}).sources.length,0);
  assert.equal(mesh(type,{remaining:10}).sources.length,0);
 }
 for(const type of ['oathstone','moon-dial','cairnfield'])assert.equal(mesh(type).sources.length,0,type);
});
test('wall torches are spaced instead of turning every segment into a light source',()=>{
 assert.ok(mesh('wall',{x:8,y:8}).sources.length>0);
 assert.equal(mesh('wall',{x:9,y:8}).sources.length,0);
 assert.equal(mesh('wall',{x:8,y:8,hp:0}).sources.length,0);
});
test('window emitters move with the panes and point out of all four facades',()=>{
 const s=mesh('cottage'),moved=mesh('cottage',{x:11,y:6});
 assert.equal(s.sources.length,8);
 assert.deepEqual(new Set(s.sources.map(l=>l.direction.join(','))),new Set(['0,1','0,-1','1,0','-1,0']));
 s.sources.forEach((l,i)=>l.position.forEach((v,j)=>assert.ok(Math.abs(moved.sources[i].position[j]-v-[3,-2,0][j])<1e-9)));
});
test('surface light attenuates, favors facing surfaces and never lights behind a window',()=>{
 const l={position:[0,0,.5],direction:[0,1],radius:2,power:1};
 assert.ok(lightAt([0,.2,.5],[0,-1,0],l)>lightAt([0,1,.5],[0,-1,0],l));
 assert.ok(lightAt([0,.2,.5],[0,-1,0],l)>lightAt([0,.2,.5],[0,1,0],l));
 assert.equal(lightAt([0,-.2,.5],[0,1,0],l),0);
 assert.equal(lightAt([0,3,.5],[0,-1,0],l),0);
});
test('clock reuses source geometry; moving or destroying a building refreshes it',()=>{
 const r=renderer(),b=building('cottage'),w={buildings:[b],troops:[],enemies:[],elapsed:0};
 drawVillage3D(r,w,0,skyLightAt(DAY_LENGTH*.3,null));const cache=r._meshStatic;
 drawVillage3D(r,w,0,skyLightAt(DAY_LENGTH*.8,null));assert.equal(r._meshStatic,cache);
 assert.ok(cache.faces.some(f=>f.localLight>0));
 b.x++;drawVillage3D(r,w,0);assert.notEqual(r._meshStatic,cache);
 b.hp=0;drawVillage3D(r,w,0);assert.equal(r._meshStatic.sources.length,0);
});


test('source profiles tag windows, lanterns, torches and open fires by identity',()=>{
 const cottage=mesh('cottage'),farm=mesh('farm'),wall=mesh('wall',{x:8,y:8}),forge=mesh('forge'),watch=mesh('watchfire'),trap=mesh('fire-trap');
 assert.ok(cottage.sources.every(s=>s.profile==='window'),'cottage panes use window profile');
 assert.ok(farm.sources.some(s=>s.profile==='lantern'),'farm post uses lantern profile');
 assert.ok(wall.sources.some(s=>s.profile==='torch'),'wall flame uses torch profile');
 assert.ok(forge.sources.some(s=>s.profile==='fire'),'forge mouth uses open-fire profile');
 assert.ok(watch.sources.some(s=>s.profile==='fire'),'watchfire uses open-fire profile');
 assert.ok(trap.sources.some(s=>s.profile==='trap'),'armed fire trap uses compact trap profile');
 for(const scene of [cottage,farm,wall,forge,watch,trap])assert.ok(scene.sources.every(s=>Number.isFinite(s.phase)),'static source geometry precomputes flicker phase');
});

test('source flicker is deterministic, bounded and frozen by calm mode',()=>{
 const source={position:[1,2,.5],owner:{id:'fire-a'},profile:'fire',radius:2,power:1};
 const a=sourceFlicker(source,1000,false),again=sourceFlicker(source,1000,false),b=sourceFlicker(source,1600,false);
 assert.equal(a,again,'same source and time produces the same flicker');
 assert.notEqual(a,b,'open fire varies across time');
 assert.ok(a>.8&&a<1.2&&b>.8&&b<1.2,'fire pulse stays restrained');
 assert.equal(sourceFlicker(source,1000,true),1,'calm freezes fire');
 assert.equal(sourceFlicker({...source,profile:'window'},1000,true),1,'calm freezes windows too');
});

test('source profile resolver keeps safe generic fallback and distinct falloff',()=>{
 assert.equal(sourceProfile({profile:'not-a-profile'}),SOURCE_PROFILES.generic);
 const base={position:[0,0,.5],radius:2,power:1},point=[0,.8,.5],normal=[0,-1,0];
 const generic=lightAt(point,normal,{...base,profile:'generic'});
 const fire=lightAt(point,normal,{...base,profile:'fire'});
 const window=lightAt(point,normal,{...base,profile:'window'});
 assert.ok(fire>generic,'open fire carries farther through its pool');
 assert.ok(window<generic,'window spill falls off faster away from its pane');
});
