import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel,drawVillage3D} from '../src/scene3d.js';
import {lightAt} from '../src/source-lighting.js';
import {skyLightAt,DAY_LENGTH} from '../src/systems/daynight.js';
const data=Object.fromEntries(await Promise.all(['world','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const ctx=new Proxy({}, {get:(t,k)=>t[k]||(()=>k.includes('Gradient')?{addColorStop(){}}:undefined),set:(t,k,v)=>(t[k]=v,true)});
const renderer=()=>new Renderer({getContext:()=>ctx},data,{});
const building=(type,extra={})=>({id:1,type,x:8,y:8,level:1,hp:100,remaining:0,...extra});
function mesh(type,extra={}){const r=renderer(),s=new MeshScene(r),b=building(type,extra);buildingModel(s,b,data.buildings[type],{buildings:[b]});return s;}
test('only finished luminous structures emit light; previews and ruins stay dark',()=>{
 for(const type of ['cottage','hall','forge','smeltery','watchfire']){
  assert.ok(mesh(type).sources.length>0,type);
  assert.equal(mesh(type,{hp:0}).sources.length,0);
  assert.equal(mesh(type,{remaining:10}).sources.length,0);
 }
 for(const type of ['wall','farm','mine','tower'])assert.equal(mesh(type).sources.length,0,type);
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
