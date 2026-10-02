import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {externalGeometry} from '../src/external-geometry.js';
import {addExternalProp,addExternalWorkplace} from '../src/external-art.js';
import {MeshScene} from '../src/scene3d.js';
import {Renderer} from '../src/renderer.js';
const manifest=JSON.parse(await readFile(new URL('../data/external_assets.json',import.meta.url)));
const context=new Proxy({},{get:(t,k)=>t[k]||(()=>k==='measureText'?{width:40}:k.includes('Gradient')?{addColorStop(){}}:undefined),set:(t,k,v)=>(t[k]=v,true)});
function scene(zoom=1.8,yaw=Math.PI/4){const r=new Renderer({getContext:()=>context},{world:{width:20,height:16}},{});r.resize(800,600,1);r.cam={x:5,y:5,zoom,yaw,pitch:.7};return new MeshScene(r);}
test('external art: every shipped mesh has reviewed CC0 provenance and retained sources',async()=>{
 // Pack-level source records (e.g. rig-baked character sets) may exist without
 // a same-named geometry entry; every geometry entry must have provenance.
 for(const id of Object.keys(externalGeometry))assert.ok(manifest.assets.some(a=>a.id===id),id+' has provenance');
 for(const a of manifest.assets){assert.equal(a.license,'CC0-1.0');assert.ok(a.creator&&a.originalPage&&a.attribution&&a.modifications.length&&a.gameSystems.length);assert.ok((await stat(new URL('../'+a.sourceFile,import.meta.url))).size>0);for(const file of a.localFiles)await stat(new URL('../'+file,import.meta.url));}
});
test('external art: reduced meshes have ground pivots, finite convex faces and valid winding',()=>{
 for(const [id,m] of Object.entries(externalGeometry)){
  assert.ok(m.faces.length<=200,id+' model budget');assert.ok(m.faces.length<m.sourceTriangles,id+' reduced');
  assert.equal(Math.min(...m.vertices.map(p=>p[2])),0,id+' ground pivot');assert.equal(Math.max(...m.vertices.map(p=>p[2])),1,id+' normalized height');
  for(const [indices,color] of m.faces){assert.match(color,/^#[0-9a-f]{6}$/);assert.ok(indices.length>=3);const p=indices.map(i=>m.vertices[i]);assert.ok(p.every(v=>v?.length===3&&v.every(Number.isFinite)));const [a,b,c]=p,u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-8,id+' nondegenerate normal');}
 }
});
test('external art: overview/offscreen ghosts fall back and near props retain parent selection',()=>{
 for(const zoom of [.8,1.4])assert.equal(addExternalProp(scene(zoom),'crate',5,5,0,.22),false);
 const s=scene();assert.equal(addExternalProp(s,'crate',500,500,0,.22),false);s.alpha=.4;assert.equal(addExternalProp(s,'crate',5,5,0,.22),false);
 for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const s=scene(2,yaw);s.owner={kind:'building',id:'store'};assert.ok(addExternalProp(s,'crate',5,5,.13,.22));assert.ok(s.faces.length>0);assert.ok(s.faces.every(f=>f.owner.id==='store'&&f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));}
});
test('external art: shared prop and nature budgets bound crowded views independently',()=>{
 const s=scene();for(let i=0;i<100;i++)addExternalProp(s,'crate',5,5,.13,.22);assert.ok(s.externalPropFaces<=1400);assert.ok(s.externalPropFaces>1000);
 for(let i=0;i<100;i++)addExternalProp(s,'rock',5,5,0,.24,0,true);assert.ok(s.externalNatureFaces<=320);assert.ok(s.externalNatureFaces>0);
 const phone=scene();phone.r.resize(390,844,1);for(let i=0;i<100;i++)addExternalProp(phone,'crate',5,5,.13,.22);assert.ok(phone.externalPropFaces<=800);
});
test('external art: additions honor tiers, construction and ruin gates without mutating buildings',()=>{
 const b={id:'longhouse',type:'longhouse',x:5,y:5,level:1,hp:100,remaining:0},s=scene(),before=structuredClone(b);
 addExternalWorkplace(s,b,{size:3});assert.equal(s.faces.length,0);assert.deepEqual(b,before);
 b.level=2;addExternalWorkplace(s,b,{size:3});assert.ok(s.faces.length>0);
 for(const extra of [{remaining:1},{hp:0}]){const hidden=scene();addExternalWorkplace(hidden,{...b,...extra},{size:3});assert.equal(hidden.faces.length,0);}
});
