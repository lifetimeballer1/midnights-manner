import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {convertedId,drawProp,sceneryForTile,sceneryPlan,addEnvironmentScenery} from '../src/environment-art.js';
import {addWindLife} from '../src/wind-art.js';
import {drawMesh} from '../src/asset-art.js';

const data=Object.fromEntries(await Promise.all(['world','buildings','biomes','art-manifest'].map(async id=>
 [id,JSON.parse(await readFile(new URL(`../data/${id}.json`,import.meta.url)))])));
const ids=['tree-simple','bush','rock-small-a','rock-small-d','flower-red','flower-yellow','flower-purple','lily-small','lily-large','log'];
const meshes=Object.fromEntries(await Promise.all(ids.map(async id=>
 [id,JSON.parse(await readFile(new URL(`../assets/meshes/${id}.json`,import.meta.url)))])));
function renderer(d=data,m=meshes){
 const r=new Renderer({getContext:()=>({})},d,{});
 r.resize(1280,900,1);r.cam.x=3;r.cam.y=4;r.cam.zoom=1.65;r.meshes=m;
 return r;
}
function draw(r,kind,biome='plains',scorched=false){
 const s=new MeshScene(r);
 drawProp(s,{x:3,y:4,kind,biome},0,scorched,r.cam.zoom);
 return s;
}

test('r4 biome profiles route all silhouettes and fringe is densest',()=>{
 for(const [biome,kinds] of Object.entries({plains:['grass','flowers'],forest:['pine','shrub','log'],water:['reeds','lilies'],hills:['rock','cairn'],'unclaimed-fringe':['pine','shrub','rock']})){
  const seen=new Set();let count=0;
  for(let y=0;y<80;y++)for(let x=0;x<80;x++){
   const p=sceneryForTile(data.biomes,{x,y,biome,claimed:false},9);
   if(p){seen.add(p.kind);count++;}
  }
  for(const kind of kinds)assert.ok(seen.has(kind),`${biome} routes ${kind}`);
  assert.ok(count>0&&count<3200,'density remains below the hard .5 ceiling');
 }
 assert.ok(data.biomes['unclaimed-fringe'].scenery.wildDensity>data.biomes.forest.scenery.wildDensity);
});

test('r4 converted flowers and lilies form bounded close-view drifts',()=>{
 const r=renderer();
 for(const kind of ['flowers','lilies']){
  const id=convertedId({r},{x:3,y:4,kind}),s=draw(r,kind,kind==='lilies'?'water':'plains');
  const single=new MeshScene(r);drawMesh(single,meshes[id],3.5,4.5);
  assert.ok(s.faces.length>single.faces.length,`${kind} has multiple converted plants`);
  assert.ok(s.faces.length<=180,`${kind} stays within three small meshes`);
  for(const f of s.faces)for(const [x,y,z] of f.vertices){
   assert.ok(x>=3&&x<=4&&y>=4&&y<=5&&z>=0,'drift stays grounded inside its tile');
  }
 }
});

test('r4 rock routing uses both reviewed converted silhouettes',()=>{
 const r=renderer(),seen=new Set();
 for(let x=0;x<60;x++){
  const id=convertedId({r},{x,y:5,kind:'rock',biome:'hills'});
  if(id)seen.add(id);
 }
 assert.deepEqual([...seen].sort(),['rock-small-a','rock-small-d']);
});

test('r4 loaded meshes cannot erase dark fringe, hills scrub or scorched rock',()=>{
 const loaded=renderer(),bare=renderer(data,{});
 for(const [kind,biome,scorched] of [['shrub','hills',false],['rock','hills',true],['shrub','unclaimed-fringe',false],['log','unclaimed-fringe',false],['flowers','unclaimed-fringe',false]]){
  assert.deepEqual(draw(loaded,kind,biome,scorched).faces,draw(bare,kind,biome,scorched).faces,`${biome} ${kind} retains authored palette and structure`);
 }
 assert.ok(draw(loaded,'rock','unclaimed-fringe').faces.some(f=>f.color==='#7d857c'),'fringe crags retain the dark flanking slabs');
});

test('r4 missing, disabled and empty meshes use identical procedural fallback',()=>{
 const disabled=structuredClone(data);
 for(const entry of Object.values(disabled['art-manifest'].meshes))entry.enabled=false;
 for(const kind of ['pine','shrub','rock','flowers','lilies','log']){
  const expected=draw(renderer(data,{}),kind).faces;
  assert.ok(expected.length>0);
  assert.deepEqual(draw(renderer(disabled),kind).faces,expected);
  assert.deepEqual(draw(renderer(data,Object.fromEntries(ids.map(id=>[id,{faces:[]}]))),kind).faces,expected);
 }
});

test('r4 distant views retain complete procedural silhouettes instead of partial converted faces',()=>{
 const loaded=renderer(),bare=renderer(data,{});loaded.cam.zoom=bare.cam.zoom=1;
 for(const kind of ['flowers','lilies','shrub','rock'])assert.deepEqual(draw(loaded,kind).faces,draw(bare,kind).faces);
});

test('r4 wind follows converted flower heads rather than floating above them',()=>{
 const r=renderer();r._livingScenery=[{x:3,y:4,kind:'flowers',biome:'plains'}];
 const s=new MeshScene(r);addWindLife(s,{buildings:[],weather:'clear'},1000);
 assert.ok(s.faces.length>0);
 const points=s.faces.flatMap(f=>f.vertices);
 assert.ok(Math.min(...points.map(v=>v[2]))<.25,'beam starts at the .24-tile converted blossom');
 assert.ok(points.every(([x,y])=>x<3.45&&y<4.5),'beam follows the first offset blossom');
});

test('r4 static terrain is calm-safe and shares the unchanged scene caps',()=>{
 const tiles=[];
 for(let y=0;y<44;y++)for(let x=0;x<52;x++)tiles.push({x,y,biome:'unclaimed-fringe',claimed:false,landmark:x===3&&y===4?'Marker':null});
 const world={tiles,buildings:[],biomeSeed:11},before=JSON.stringify(world),r=renderer();r.cam.x=26;r.cam.y=22;
 for(const [zoom,cap] of [[.6,50],[1,85],[1.65,130]]){
  r.cam.zoom=zoom;r.calm=false;const normal=new MeshScene(r),owner={kind:'probe'};normal.owner=owner;normal.alpha=.5;
  const n=addEnvironmentScenery(normal,world,data);
  assert.ok(n>0&&n<=cap);assert.equal(normal.owner,owner);assert.equal(normal.alpha,.5);
  r.calm=true;const calm=new MeshScene(r);calm.owner=owner;calm.alpha=.5;
  assert.equal(addEnvironmentScenery(calm,world,data),n);assert.deepEqual(calm.faces,normal.faces);
  const wind=new MeshScene(r);addWindLife(wind,world,1000);addWindLife(wind,world,9000);assert.equal(wind.faces.length,0);
 }
 assert.equal(JSON.stringify(world),before,'terrain does not alter saves or gameplay');
});

test('r4 unclaimed fringe shares habitat drifts across neighboring eligible tiles',()=>{
 const tiles=[];
 for(let y=0;y<12;y++)for(let x=0;x<12;x++)tiles.push({x,y,biome:'unclaimed-fringe',claimed:x===5&&y===5});
 const world={tiles,buildings:[{type:'cottage',x:6,y:6}],biomeSeed:11},before=JSON.stringify(world);
 const plan=sceneryPlan(world,data),groups=new Map();
 for(const item of plan.filter(p=>p.clusterSeed!==undefined)){
  const key=item.clusterSeed;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(item);
  assert.ok(!item.claimed&&!(item.x===5&&item.y===5),'claimed route stays open');
  assert.ok(!(item.x>=6&&item.x<6+data.buildings.cottage.size&&item.y>=6&&item.y<6+data.buildings.cottage.size),'footprint excluded');
 }
 const cluster=[...groups.values()].find(g=>g.some(a=>g.some(b=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1)));
 assert.ok(cluster,'a shared seed produces neighboring habitat patches');
 const r=renderer();
 for(const item of cluster){
  const s=new MeshScene(r);drawProp(s,item,11,false,1.65);
  assert.ok(s.faces.length>0);
  assert.ok(s.faces.flatMap(f=>f.vertices).every(([x,y])=>x>=item.x&&x<=item.x+1&&y>=item.y&&y<=item.y+1),'members remain in eligible tiles');
 }
 assert.deepEqual(sceneryPlan(world,data),plan,'static seed stability');
 assert.equal(JSON.stringify(world),before);
});
