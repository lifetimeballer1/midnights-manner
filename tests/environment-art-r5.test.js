import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {convertedId,drawProp} from '../src/environment-art.js';

const singleId='catalog-tree-single-a';
const shrubIds=['catalog-tree-a-small','catalog-tree-a-medium','catalog-tree-a-large','catalog-tree-b-small','catalog-tree-b-medium','catalog-tree-b-large'];
const specs=[
 {id:singleId,file:'tree-single-a.json',sourceObject:'tree_single_A.008'},
 ...shrubIds.map((id,index)=>({id,file:`tree-${['a-small','a-medium','a-large','b-small','b-medium','b-large'][index]}.json`,sourceObject:['trees_A_small.001','trees_A_medium.001','trees_A_large.001','trees_B_small.001','trees_B_medium.001','trees_B_large.001'][index]})),
 {id:'catalog-resource-stone',file:'resource-stone.json',sourceObject:'resource_stone.005'},
];
const data=Object.fromEntries(await Promise.all(['world','buildings','biomes','art-manifest'].map(async name=>
 [name,JSON.parse(await readFile(new URL(`../data/${name}.json`,import.meta.url)))])));
const sources=Object.fromEntries(await Promise.all(specs.map(async spec=>
 [spec.id,JSON.parse(await readFile(new URL(`../assets/meshes/catalog/${spec.file}`,import.meta.url)))])));

function renderer(d=data,meshes=sources,zoom=1.65){
 const r=new Renderer({getContext:()=>({})},d,{});r.resize(1280,900,1);r.cam.x=3;r.cam.y=4;r.cam.zoom=zoom;r.meshes=meshes;return r;
}

function draw(r,item){const s=new MeshScene(r);drawProp(s,item,0,false,r.cam.zoom);return s.faces;}

test('R5 local Mixar tree forms carry bounded geometry and exact source provenance',()=>{
 for(const spec of specs){
  const source=sources[spec.id],entry=data['art-manifest'].meshes?.[spec.id],points=source.faces.flatMap(face=>face.v);
   assert.equal(entry?.enabled,source.faces.length<=320,spec.id);
  assert.equal(entry?.domain,'environment',spec.id);
   assert.equal(entry?.releaseStatus,'approved-public',spec.id);
   assert.equal(entry?.rightsEvidence,'game-assets-mixar',spec.id);
  assert.equal(source.meta.format,'flat-face-v1',spec.id);
  assert.equal(source.meta.sourceObject,spec.sourceObject,spec.id);
  assert.equal(source.meta.sourceSHA256,entry.sourceSHA256,spec.id);
  assert.equal(source.meta.textureSHA256,entry.textureSHA256,spec.id);
   assert.ok(source.faces.length>0&&source.faces.length<=3000,spec.id);
  assert.equal(Math.min(...points.map(p=>p[2])),0,spec.id);
  assert.ok(Math.max(...points.map(p=>p[2]))<=1.6,spec.id);
  assert.ok(points.every(([x,y])=>Math.abs(x)<=.5&&Math.abs(y)<=.5),spec.id);
 }
});

test('R5 pine routing stays deterministic, close-only, tile-safe, and falls back',()=>{
 const item={x:3,y:4,kind:'pine',biome:'forest'},r=renderer();
 const selected=convertedId({r},item);
 assert.equal(selected,singleId);
 const faces=draw(r,item);
 assert.ok(faces.length>0&&faces.length<=sources[singleId].faces.length);
 assert.ok(faces.some(face=>face.color==='#315d43'),'source evergreen palette is visible');
 for(const face of faces)for(const [x,y,z]of face.vertices){
  assert.ok(x>=item.x&&x<=item.x+1&&y>=item.y&&y<=item.y+1&&z>=0,'converted tree stays in its tile');
 }
 assert.equal(convertedId({r},item),singleId,'same tile selects the same source mesh');
 assert.equal(convertedId({r},{...item,biome:'unclaimed-fringe'}),null,'rough fringe retains native variation');

 const shrubs=Array.from({length:256},(_,x)=>({x,y:7,kind:'shrub',biome:'forest'}));
 const used=new Set(shrubs.map(item=>convertedId({r},item)).filter(id=>shrubIds.includes(id)));
 assert.equal(used.size,2,'two complete cluster forms fit the per-model budget');
 const shrubItem=shrubs.find(item=>shrubIds.includes(convertedId({r},item)));
 const shrubId=convertedId({r},shrubItem),shrubFaces=draw(r,shrubItem);
 assert.ok(shrubFaces.length>0&&shrubFaces.length<=sources[shrubId].faces.length);
  for(const face of shrubFaces)for(const [x,y,z]of face.vertices){
   assert.ok(x>=shrubItem.x&&x<=shrubItem.x+1&&y>=shrubItem.y&&y<=shrubItem.y+1&&z>=0,'source shrub stays in its tile');
  }
 const stones=Array.from({length:256},(_,x)=>({x,y:9,kind:'stone',biome:'water'}));
 const stoneItem=stones.find(item=>convertedId({r},item)==='catalog-resource-stone');
 assert.ok(stoneItem,'shore stones select the local Mixar pile variant');
 const stoneFaces=draw(r,stoneItem);
 assert.ok(stoneFaces.some(face=>face.color==='#808881'||face.color==='#adb0a5'));

 const bare=renderer(data,{}),disabled=structuredClone(data);
 for(const spec of specs)disabled['art-manifest'].meshes[spec.id].enabled=false;
  assert.deepEqual(draw(renderer(disabled),item),draw(bare,item),'disabled source retains procedural pine');
  assert.deepEqual(draw(renderer(disabled),shrubItem),draw(bare,shrubItem),'disabled source retains procedural shrub');
  assert.deepEqual(draw(renderer(disabled),stoneItem),draw(bare,stoneItem),'disabled source retains procedural shore stone');
 assert.deepEqual(draw(renderer(data,sources,1),item),draw(renderer(data,{},1),item),'far zoom retains procedural pine');
});

test('R5 converted nature shares the existing 320/156-face scene budget',()=>{
 const item={x:3,y:4,kind:'pine',biome:'forest'},desktop=renderer(),near=new MeshScene(desktop);
 for(let i=0;i<12;i++)drawProp(near,item,0,false,desktop.cam.zoom);
 assert.equal(near.externalNatureFaces,Math.floor(320/sources[singleId].faces.length)*sources[singleId].faces.length);

 const phone=renderer();phone.resize(390,844,2);
 const close=new MeshScene(phone);
 for(let i=0;i<12;i++)drawProp(close,item,0,false,phone.cam.zoom);
 assert.equal(close.externalNatureFaces,Math.floor(156/sources[singleId].faces.length)*sources[singleId].faces.length,'phone cap keeps whole source meshes');
});
