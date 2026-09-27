import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {Game} from '../src/game.js';
import {buildingModel,MeshScene,pointInPolygon} from '../src/scene3d.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const context=new Proxy({},{get:(t,k)=>t[k]||(()=>k==='measureText'?{width:40}:k.includes('Gradient')?{addColorStop(){}}:undefined),set:(t,k,v)=>(t[k]=v,true)});
const renderer=()=>new Renderer({getContext:()=>context},data,{});
test('ground picking and anchored zoom are exact around a full orbit at every elevation',()=>{
 const r=renderer();r.resize(390,844,2);r.cam.x=15;r.cam.y=15;
 for(const pitch of [20,31,60,83])for(let deg=0;deg<360;deg+=15){r.cam.yaw=deg*Math.PI/180;r.cam.pitch=pitch*Math.PI/180;r.cam.zoom=1.8;const p=r.project(17.5,16.5);assert.deepEqual(r.unproject(p.x,p.y),{x:17,y:16});const before=r.worldPoint(240,420);r.zoomAt(1.1,240,420);const after=r.worldPoint(240,420);assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<1e-9);}
});
test('screen-relative panning follows drag at all headings and orbit clamps tilt',()=>{
 const r=renderer();r.cam.x=15;r.cam.y=15;for(let deg=0;deg<360;deg+=30){r.cam.yaw=deg*Math.PI/180;const a=r.project(15,15);r.panPixels(20,-12);const b=r.project(15,15);assert.ok(Math.abs(b.x-a.x-20)<1e-9&&Math.abs(b.y-a.y+12)<1e-9);}
 r.orbit(200,-100);assert.ok(r.cam.yaw>=0&&r.cam.yaw<Math.PI*2);assert.equal(r.cam.pitch,Math.PI/9);r.orbit(0,100);assert.equal(r.cam.pitch,Math.PI*.46);
});
test('every building and tier produces finite 3D faces from four camera sides',()=>{
 const r=renderer();r.resize(1200,900,1);r.cam.x=5;r.cam.y=5;
 for(const [type,spec]of Object.entries(data.buildings))for(let level=1;level<=spec.tiers.length;level++)for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  r.cam.yaw=yaw;const s=new MeshScene(r),b={id:type,type,x:5,y:5,level,hp:100,remaining:0};buildingModel(s,b,spec,{buildings:[b]});assert.ok(s.faces.length>0,`${type} tier ${level}`);assert.ok(s.faces.every(f=>f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
 }
});
test('face picking follows the visible 3D building rather than its old sprite rectangle',()=>{
 const r=renderer();r.resize(900,700,1);const g=new Game(data),b=g.world.buildings.find(b=>b.type==='hall');g.world.buildings=[b];g.world.troops=[];r.fitVillage(g.world);
 for(const yaw of [0,1.2,2.8,4.3,5.9]){r.cam.yaw=yaw;r.draw(g.world,1000);const face=r.sceneFaces.filter(f=>f.owner?.id===b.id).at(-1);assert.ok(face);const p={x:face.points.reduce((n,p)=>n+p.x,0)/face.points.length,y:face.points.reduce((n,p)=>n+p.y,0)/face.points.length};assert.ok(pointInPolygon(p.x,p.y,face.points));assert.equal(r.pick(p.x,p.y)?.id,b.id);}
});
test('camera rotation invalidates terrain cache and model rendering never changes saves',()=>{
 const r=renderer(),g=new Game(data);r.calm=true;const state=JSON.stringify(g.state),key=r.staticCacheKey(g.world);r.orbit(.3,.1);assert.notEqual(r.staticCacheKey(g.world),key);r.draw(g.world,1000);assert.equal(JSON.stringify(g.state),state);
});
test('static mesh cache refreshes for camera, upgrade, construction and ruin changes',()=>{
 const r=renderer(),g=new Game(data);r.draw(g.world,1000);let cached=r._meshStatic;r.draw(g.world,1016);assert.equal(r._meshStatic,cached);
 const b=g.world.buildings.find(b=>b.type==='hall');for(const change of [()=>r.orbit(.2),()=>b.level++,()=>b.remaining=10,()=>b.remaining=0,()=>b.hp=0,()=>b.x++]){cached=r._meshStatic;change();r.draw(g.world,1032);assert.notEqual(r._meshStatic,cached);}
});
