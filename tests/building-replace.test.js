// Modular architecture pass — the eight core families (hall, cottage,
// barracks, farm, lumber, mine, market, forge) rebuild from shared structural
// modules per tier band: timber/post-and-beam, plank walls with a stone
// footing, stone base with glazed windows and chimney stacks, then trim,
// bracing, metal bands and lantern posts. Geometry stays renderer-only:
// footprints, collision, saves and the existing source/chimney light anchors
// are untouched. Converted meshes are enabled only for pieces actually placed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel} from '../src/scene3d.js';

const FAMILIES=['hall','cottage','barracks','farm','lumber','mine','market','forge'];
const TIERS=[1,3,6];
const PLACED=['roof-gable','roof-window','shutters','wood-door','chimney','stairs-stone','overhang','town-lantern','lantern-wall','torch-metal'];
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
data['art-manifest']=JSON.parse(await readFile(new URL('../data/art-manifest.json',import.meta.url)));
const manifest=data['art-manifest'];
const meshes={};
for(const [id,entry] of Object.entries(manifest.meshes))if(entry.enabled)meshes[id]=JSON.parse(await readFile(new URL('../'+entry.file,import.meta.url)));
const context=new Proxy({},{get:(t,k)=>t[k]||(()=>k==='measureText'?{width:40}:k.includes('Gradient')?{addColorStop(){}}:undefined),set:(t,k,v)=>(t[k]=v,true)});

function renderer(yaw=Math.PI/4,zoom=1.65){
 const r=new Renderer({getContext:()=>context},data,{});
 r.resize(1280,900,1);r.cam.x=6;r.cam.y=6;r.cam.zoom=zoom;r.cam.yaw=yaw;r.meshes=meshes;
 return r;
}
function scene(type,level,extra={},opts={}){
 const r=renderer(opts.yaw??Math.PI/4,opts.zoom??1.65);
 const s=new MeshScene(r);
  const b={id:`${type}-t${level}`,type,x:5,y:5,level,hp:100,remaining:0,...extra};
 buildingModel(s,b,data.buildings[type],{buildings:[b],troops:[],enemies:[]},opts.time??0);
 return {s,b};
}
function valid(faces,id){
 assert.ok(faces.length>0,`${id} draws`);
 assert.ok(faces.length<600,`${id} stays inside the near-zoom face budget (${faces.length})`);
 assert.ok(faces.every(f=>f.owner?.kind==='building'&&f.owner?.id===id),`${id} selectable through owner tags`);
 assert.ok(faces.every(f=>/^#[0-9a-f]{6}$/i.test(f.color)&&Number.isFinite(f.depth)&&f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),`${id} keeps flat hex, finite geometry`);
 assert.ok(faces.every(f=>f.vertices.every(v=>v.every(Number.isFinite))),`${id} keeps finite vertices`);
}

test('the eight families render valid bounded selectable geometry at tiers 1/3/6 through a full orbit',()=>{
 for(const type of FAMILIES)for(const level of TIERS)for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const {s}=scene(type,level,{},{yaw});
  valid(s.faces,`${type}-t${level}`);
 }
});

test('tiers are structurally distinct, never a recolor',()=>{
 for(const type of FAMILIES){
  const structure=level=>{
   const {s}=scene(type,level);
   return s.faces.map(f=>f.vertices.map(v=>v.map(n=>Math.round(n*100)/100).join(',')).join(';')).sort().join('|');
  };
  const one=structure(1),three=structure(3),six=structure(6);
  assert.notEqual(one,three,`${type} tier 3 rebuilds the wall/roof modules`);
  assert.notEqual(three,six,`${type} tier 6 rebuilds the wall/roof modules`);
  assert.notEqual(one,six,`${type} tier 6 differs from tier 1`);
  const roof=level=>scene(type,level).s.faces.map(f=>f.vertices.map(v=>v.map(n=>Math.round(n*100)/100).join(',')).join(';')).sort().join('|');
  assert.notEqual(roof(1),roof(6),`${type} keeps a distinct top-tier roof form`);
 }
});

test('footprints stay bounded and rendering never mutates world or building data',()=>{
 const before=JSON.stringify(data.buildings);
 for(const type of FAMILIES){
  const spec=data.buildings[type],n=spec.size;
  const {s,b}=scene(type,6);
  const copy=structuredClone(b);
  assert.deepEqual(b,copy,`${type} never writes its building`);
  for(const f of s.faces)for(const [vx,vy,vz] of f.vertices){
   assert.ok(vx>=b.x-1&&vx<=b.x+n+1,`${type} stays near its footprint in x`);
   assert.ok(vy>=b.y-1&&vy<=b.y+n+1,`${type} stays near its footprint in y`);
   assert.ok(vz>=0&&vz<=4,`${type} stays grounded and height-bounded`);
  }
 }
 assert.equal(JSON.stringify(data.buildings),before,'renderer never mutates building data');
});

test('every family lights from existing source anchors and registers its chimney stack',()=>{
 for(const type of FAMILIES){
  const {s}=scene(type,3);
  assert.ok(s.sources.length>0,`${type} lights windows/lanterns/torches`);
  assert.ok(s.sources.every(x=>['window','lantern','torch','fire'].includes(x.profile)),`${type} reuses the existing light profiles`);
  assert.ok(s.sources.every(x=>x.position.every(Number.isFinite)&&Number.isFinite(x.phase)),`${type} keeps world-space anchors with precomputed phase`);
  assert.ok(s.chimneys.length>0,`${type} raises a chimney stack`);
  assert.ok(s.chimneys.every(c=>c.owner?.id===`${type}-t3`&&c.position.every(Number.isFinite)),`${type} chimneys attach to the building`);
 }
});

test('ruins and scaffolds stay clean: geometry only, no lights or smoke anchors',()=>{
 for(const type of FAMILIES)for(const extra of [{hp:0},{remaining:8}]){
  const {s}=scene(type,3,extra);
  assert.ok(s.faces.length>0,`${type} keeps its broken geometry`);
  assert.equal(s.sources.length,0,`${type} emits no light while broken`);
  assert.equal(s.chimneys.length,0,`${type} raises no smoke while broken`);
  assert.ok(s.faces.some(f=>f.alpha<1),`${type} keeps the broken alpha treatment`);
 }
});

test('converted meshes are enabled exactly for pieces the families place',()=>{
  const enabled=Object.entries(manifest.meshes).filter(([,e])=>e.enabled&&!['environment','production'].includes(e.domain)).map(([id])=>id).sort();
 assert.deepEqual(enabled,['barrel','book-stand','bush','chimney','crate','crate-apple','crate-carrot','dummy','fence','flower-purple','flower-red','flower-yellow','lantern-wall','lily-large','lily-small','log','log-stack','overhang','pennant','roof-gable','roof-window','rock-small-a','rock-small-d','shutters','stairs-stone','stone-small','torch-metal','town-lantern','weapon-stand','wood-door','workbench'].sort());
 for(const id of PLACED)assert.ok(enabled.includes(id),`${id} is placed by the family pass`);
 for(const id of ['anvil','tree-simple','bush-small'])assert.equal(manifest.meshes[id].enabled,false,`${id} stays disabled until something places it`);
});

test('family geometry is time-independent so Calm keeps it static',()=>{
 for(const type of FAMILIES){
  const a=scene(type,6,{},{time:0}),b=scene(type,6,{},{time:90000});
  assert.deepEqual(a.s.faces.map(f=>f.vertices),b.s.faces.map(f=>f.vertices),`${type} never animates its architecture`);
 }
});
