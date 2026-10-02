import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {sceneryForTile,occupiedTileKeys,sceneryPlan,addEnvironmentScenery,drawProp} from '../src/environment-art.js';

const data=Object.fromEntries(await Promise.all(
 ['world','buildings','biomes'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])
));
const tile=(x,y,biome='forest',claimed=true,landmark=null)=>({x,y,biome,claimed,landmark});

test('biome scenery is deterministic and landmarks always win',()=>{
 const a=sceneryForTile(data.biomes,tile(12,9,'forest',false),data.world.seed);
 const b=sceneryForTile(data.biomes,tile(12,9,'forest',false),data.world.seed);
 assert.deepEqual(a,b);
 assert.deepEqual(sceneryForTile(data.biomes,tile(12,9,'forest',false,'Old Cairn'),data.world.seed),{kind:'landmark',landmark:'Old Cairn',biome:'forest'});
});

test('wild biome profiles are a denser superset of claimed clutter',()=>{
 let claimed=0,wild=0;
 for(let y=0;y<34;y++)for(let x=0;x<40;x++){
  if(sceneryForTile(data.biomes,tile(x,y,'forest',true),data.world.seed))claimed++;
  if(sceneryForTile(data.biomes,tile(x,y,'forest',false),data.world.seed))wild++;
 }
 assert.ok(claimed>0,'claimed forest still has sparse detail');
 assert.ok(wild>claimed,`wild forest should be denser (${claimed} -> ${wild})`);
});

test('building footprints suppress decorative scenery without changing tiles',()=>{
 const hall={id:'hall',type:'hall',x:5,y:5,level:1,hp:100,remaining:0},size=Math.ceil(data.buildings.hall.size);
 const tiles=[];
 for(let y=4;y<9;y++)for(let x=4;x<9;x++)tiles.push(tile(x,y,'forest',true,x===5&&y===5?'Buried Marker':null));
 const world={tiles,buildings:[hall]},before=JSON.stringify(tiles),occupied=occupiedTileKeys(world,data);
 for(let y=5;y<5+size;y++)for(let x=5;x<5+size;x++)assert.ok(occupied.has(x+','+y));
 assert.ok(!sceneryPlan(world,data).some(p=>p.x===5&&p.y===5),'landmark under the hall stays visually suppressed');
 assert.equal(JSON.stringify(tiles),before,'planning scenery never mutates world tile data');
});

test('scenery renderer stays bounded, paintable and restores scene ownership',()=>{
 const ctx=new Proxy({}, {get:(t,k)=>t[k]||(()=>k.includes('Gradient')?{addColorStop(){}}:undefined),set:(t,k,v)=>(t[k]=v,true)});
 const r=new Renderer({getContext:()=>ctx},data,{});r.resize(1280,900,1);r.cam.x=20;r.cam.y=17;r.cam.zoom=1.8;
 const tiles=[];for(let y=0;y<34;y++)for(let x=0;x<40;x++)tiles.push(tile(x,y,['plains','forest','water','hills'][(x+y)%4],(x+y)%3!==0,(x===16&&y===4)?'Moonwell':null));
 const s=new MeshScene(r);s.owner={kind:'probe',id:'before'};const old=s.owner;
 const drawn=addEnvironmentScenery(s,{tiles,buildings:[]},data);
 assert.ok(drawn>0&&drawn<=130,`bounded scenery count: ${drawn}`);
 assert.equal(s.owner,old,'scene owner restored');
 assert.ok(s.faces.length>0&&s.faces.every(f=>/^#[0-9a-f]{6}$/i.test(f.color)&&f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
});

test('terrain cache exposes claim count so mesh scenery refreshes after expansion',()=>{
 const ctx=new Proxy({}, {get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
 const r=new Renderer({getContext:()=>ctx},data,{});
 const world={bounds:{w:20,h:17},tiles:[tile(1,1,'plains',true),tile(2,1,'plains',false)]};
 const a=r.staticCacheKey(world);assert.equal(r.claimedTileCount,1);
 world.tiles[1].claimed=true;const b=r.staticCacheKey(world);
 assert.equal(r.claimedTileCount,2);assert.notEqual(a,b);
});

test('wild small props form bounded static masses while claimed props stay sparse',()=>{
 const r=new Renderer({getContext:()=>({})},data,{});r.resize(1280,900,1);r.cam.zoom=1.65;
 for(const [kind,biome] of [['shrub','forest'],['grass','plains'],['reeds','water'],['rock','hills'],['stone','plains']]){
  for(const x of [3,7,12]){
   const item={x,y:4,kind,biome},render=claimed=>{
    const s=new MeshScene(r);drawProp(s,{...item,claimed},11,false,r.cam.zoom);return s.faces;
   };
   const claimed=render(true),wild=render(false);
   assert.ok(wild.length>claimed.length&&wild.length<=180,`${kind} has a bounded local group`);
   assert.ok(Math.max(...wild.flatMap(f=>f.vertices.map(v=>v[2])))>Math.max(...claimed.flatMap(f=>f.vertices.map(v=>v[2]))),`${kind} main form is more visible`);
   for(const f of wild)for(const [vx,vy,vz] of f.vertices)assert.ok(vx>=x&&vx<=x+1&&vy>=4&&vy<=5&&vz>=0,`${kind} stays inside its unoccupied tile`);
   r.calm=true;r.anim=9000;assert.deepEqual(render(false),wild);r.calm=false;
   assert.deepEqual(render(true),claimed,'claimed center geometry is unchanged');
  }
 }
});
