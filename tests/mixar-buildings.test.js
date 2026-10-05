import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {drawCatalogBuilding} from '../src/asset-art.js';
import {MeshScene,buildingModel,drawVillage3D,pointInPolygon} from '../src/scene3d.js';
import {Renderer} from '../src/renderer.js';
import {addLivingMechanisms} from '../src/mechanical-art.js';
import * as catalogArt from '../src/asset-art.js';

const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const meshes={};
const entries={};
for(const type of ['hall','cottage','forge']){
 entries[type]={enabled:true,tiers:{}};
 for(let level=1;level<=6;level++){
  const id=`mmr-${type}-${level}`;
  meshes[id]=JSON.parse(await readFile(new URL(`../assets/meshes/${id}.json`,import.meta.url)));
  entries[type].tiers[level]={id,file:`assets/meshes/${id}.json`};
 }
}
data['art-manifest']={buildings:entries};
const context=new Proxy({},{get:(t,k)=>t[k]||(()=>k==='measureText'?{width:40}:k.includes('Gradient')?{addColorStop(){}}:undefined),set:(t,k,v)=>(t[k]=v,true)});
function setup(type='hall',level=3,extra={},zoom=2,yaw=Math.PI/4,width=1280){
 const r=new Renderer({getContext:()=>context},data,{});
 r.resize(width,900,1);r.cam.x=6;r.cam.y=6;r.cam.zoom=zoom;r.cam.yaw=yaw;r.meshes=meshes;
 const s=new MeshScene(r),b={id:`${type}-${level}`,type,x:5,y:5,level,hp:100,remaining:0,...extra};
 return {r,s,b,spec:data.buildings[type]};
}

test('all 18 files identify the actual exported source and preserve full geometry',()=>{
 for(const [id,m] of Object.entries(meshes)){
  assert.equal(m.meta.format,'mixar-building-v1',id);
  assert.match(m.meta.sourceObject,/^MMR \| (hall|cottage|forge) \| T0[1-6] Architecture$/);
  assert.match(m.meta.sourceSHA256,/^[0-9a-f]{64}$/);
  assert.equal(m.meta.complete,true);
  assert.equal(m.meta.faces,m.faces.length);
  assert.ok(m.lods.low.faces.length>100&&m.lods.low.faces.length<=1200);
  for(const f of [...m.faces,...m.lods.low.faces]){
   assert.match(f.c,/^#[a-f0-9]{6}$/);
   assert.ok(f.v.length>=3&&f.v.every(v=>v.length===3&&v.every(Number.isFinite)));
   assert.ok(f.v.every(([x,y,z])=>Math.abs(x)<1&&Math.abs(y)<1&&z>=0&&z<4));
  }
 }
});

test('complete actual models are selectable, lit and immutable throughout the orbit',()=>{
 for(const type of ['hall','cottage','forge'])for(const level of [1,3,6])for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const {s,b,spec}=setup(type,level,{},2,yaw),before=JSON.stringify([b,spec]);
  assert.equal(drawCatalogBuilding(s,b,spec),true);
  assert.ok(s.faces.length>50);
  assert.ok(s.faces.every(f=>f.owner?.kind==='building'&&f.owner.id===b.id));
  assert.ok(s.faces.some(f=>f.emissive>0));
  assert.ok(s.sources.length>0&&s.sources.every(p=>p.position.every(Number.isFinite)));
  assert.equal(JSON.stringify([b,spec]),before);
 }
});

test('double-sided source roof planes remain visible even with downward winding',()=>{
 const {r,s,b,spec}=setup();
 const face={v:[[-.8,-.8,1],[-.8,.8,1],[.8,.8,1],[.8,-.8,1]],c:'#3d6f9e',e:0,d:true};
 r.meshes={'mmr-hall-3':{...meshes['mmr-hall-3'],faces:[face],lods:{low:{faces:[face]}},sources:[]}};
 assert.equal(drawCatalogBuilding(s,b,spec),true);
 assert.ok(s.faces.length>0,'the source roof must not vanish through backface culling');
});

test('broad imported triangles subdivide so roof panels can occlude interior ceilings',()=>{
 const {r,s,b,spec}=setup();
 const face={v:[[-.8,-.8,1],[.8,-.8,1],[0,.8,1]],c:'#3d6f9e',e:0,d:false};
 r.meshes={'mmr-hall-3':{...meshes['mmr-hall-3'],faces:[face],lods:{low:{faces:[face]}},sources:[]}};
 assert.equal(drawCatalogBuilding(s,b,spec),true);
 assert.ok(s.faces.length>8,'large source triangles need depth-order subdivisions');
});

test('thin source roof sheets paint above the closely underlying gable mass',()=>{
 const {r,s,b,spec}=setup('forge',6,{},2.5);
 r.cam.x=10;r.cam.y=8;b.x=12;b.y=7;
 drawCatalogBuilding(s,b,spec);
 for(const [x,y] of [[782,448],[785,460]]){
  const hit=s.faces.filter(f=>pointInPolygon(x,y,f.points)).sort((a,b)=>a.depth-b.depth).at(-1);
  assert.ok(['#a34b40','#b9604f'].includes(hit?.color),'interior plaster must not stripe the red roof');
 }
 assert.equal(s.depthBias,0);
});

test('distant actual buildings draw the complete low mesh, never the first 12 faces',()=>{
 const {s,b,spec}=setup('hall',6,{},.5);
 assert.equal(drawCatalogBuilding(s,b,spec),true);
 assert.ok(s.faces.length>50);
 assert.equal(s.catalogFaces,meshes['mmr-hall-6'].lods.low.faces.length);
});

test('missing, disabled, mismatched and invalid models fall back before drawing anything',()=>{
 for(const change of [r=>{r.meshes={};},r=>{r.data={...data,'art-manifest':{buildings:{}}};},r=>{r.meshes={'mmr-hall-3':{...meshes['mmr-hall-3'],meta:{...meshes['mmr-hall-3'].meta,tier:5}}};},r=>{r.meshes={'mmr-hall-3':{...meshes['mmr-hall-3'],faces:[{v:[[NaN,0,0],[1,0,0],[0,1,0]],c:'#ffffff'}]}};}]){
  const {r,s,b,spec}=setup();change(r);
  assert.equal(drawCatalogBuilding(s,b,spec),false);
  assert.equal(s.faces.length,0);assert.equal(s.sources.length,0);
 }
});

test('catalog capture evidence distinguishes actual admitted faces from selectable fallbacks',()=>{
 for(const width of [390,1280])for(const outcome of ['drawn','invalid','budget','offscreen','margin','backface']){
  const {r,s,b,spec}=setup('hall',3,{},2,Math.PI/4,width);
  if(outcome==='invalid')r.meshes={'mmr-hall-3':{faces:[]}};
  if(outcome==='budget')s.catalogFaces=width<600?3000:6000;
  if(outcome==='offscreen'){r.cam.x=-100;r.cam.y=-100;}
  if(outcome==='margin'){
   const project=r.project.bind(r);r.project=(...v)=>{const p=project(...v);return {...p,x:p.x*.01-40};};
  }
  if(outcome==='backface'){
   const face={v:[[-.8,-.8,1],[-.8,.8,1],[.8,.8,1]],c:'#ffffff',e:0};
   r.meshes={'mmr-hall-3':{...meshes['mmr-hall-3'],faces:[face],lods:{low:{faces:[face]}},sources:[]}};
  }
  buildingModel(s,b,spec,{buildings:[b],troops:[],enemies:[]});
  r._meshStatic={faces:s.faces};r.sceneFaces=s.faces.slice().sort((a,b)=>a.depth-b.depth);
  // The payload remains cached even when validation or budget admission fails.
  assert.ok(r.meshes['mmr-hall-3']);
  const renders=catalogArt.catalogBuildingRenders(r);
  if(outcome==='drawn'){
   assert.equal(renders.length,1,'actual catalog drawing must publish capture evidence');
   assert.equal(renders[0].buildingId,b.id);assert.equal(renders[0].meshId,'mmr-hall-3');
   assert.ok(renders[0].faces>0);
  }else assert.deepEqual(renders,[],`${outcome} must not claim a visible catalog draw`);
  if(outcome==='margin')assert.ok(s.faces.some(f=>f.catalogMesh),'padded culling margin can emit catalog faces outside the viewport');
  if(outcome==='invalid'||outcome==='budget')assert.ok(s.faces.some(f=>{
   const x=f.points.reduce((n,p)=>n+p.x,0)/f.points.length,y=f.points.reduce((n,p)=>n+p.y,0)/f.points.length;
   return r.pick(x,y)?.id===b.id;
  }),'procedural fallback stays selectable without being catalog evidence');
 }
});

test('malformed source records and degenerate catalog geometry reject without throwing',()=>{
 for(const invalid of [{sources:[null]}, {faces:[{v:[[0,0,0],[0,0,0],[0,0,0]],c:'#ffffff',e:0,d:false}]}]){
  const {r,s,b,spec}=setup(),mesh={...meshes['mmr-hall-3'],...invalid};
  if(invalid.faces)mesh.lods={low:{faces:invalid.faces}};
  r.meshes={'mmr-hall-3':mesh};
  assert.equal(drawCatalogBuilding(s,b,spec),false);assert.equal(s.faces.length,0);
 }
});

test('enabled missing building tiers request their actual mesh while drawing fallback',()=>{
 const {r,s,b,spec}=setup();
 r.meshes={};
 const requested=[];r.requestCatalogBuilding=(type,tier)=>requested.push([type,tier]);
 assert.equal(drawCatalogBuilding(s,b,spec),false);
 assert.deepEqual(requested,[['hall',3]]);
 assert.equal(s.faces.length,0);
});

test('on-demand building mesh requests deduplicate and cache the response',async()=>{
 assert.equal(typeof catalogArt.createCatalogBuildingLoader,'function');
 const renderer={meshes:{}},mesh={faces:[]},calls=[];
 let finish;
 const manifest={buildings:{farm:{enabled:true,tiers:{4:{id:'mmr-farm-4',file:'assets/meshes/mmr-farm-4.json'}}}}};
 const load=catalogArt.createCatalogBuildingLoader(renderer,manifest,new URL('http://example.test/src/main.js'),url=>{
  calls.push(url.href);return new Promise(resolve=>{finish=resolve;});
 });
 const first=load('farm',4),second=load('farm',4);
 assert.equal(calls.length,1);
 assert.match(calls[0],/\/assets\/meshes\/mmr-farm-4\.json$/);
 finish({ok:true,json:async()=>mesh});
 assert.strictEqual(await first,mesh);
 assert.strictEqual(await second,mesh);
 assert.strictEqual(renderer.meshes['mmr-farm-4'],mesh);
});

test('disabled or missing building tiers do not issue requests',async()=>{
 assert.equal(typeof catalogArt.createCatalogBuildingLoader,'function');
 let calls=0;
 const manifest={buildings:{farm:{enabled:false,tiers:{1:{id:'mmr-farm-1',file:'assets/meshes/mmr-farm-1.json'}}}}};
 const load=catalogArt.createCatalogBuildingLoader({meshes:{}},manifest,new URL('http://example.test/src/main.js'),()=>{calls++;});
 assert.equal(await load('farm',1),null);
 assert.equal(await load('missing',1),null);
 assert.equal(calls,0);
});

test('parsed catalog meshes stay within the LRU limit and reload after eviction',async()=>{
 const renderer={width:1280,meshes:{}},mesh={faces:[]},entry={enabled:true,tiers:{}};
 for(let tier=1;tier<=3;tier++)entry.tiers[tier]={id:`mmr-farm-${tier}`,file:`assets/meshes/mmr-farm-${tier}.json`};
 let calls=0;
 const load=catalogArt.createCatalogBuildingLoader(renderer,{buildings:{farm:entry}},new URL('http://example.test/src/main.js'),async()=>{
  calls++;return {ok:true,json:async()=>mesh};
 },undefined,2);
 await load('farm',1);await load('farm',2);await load('farm',3);
 assert.deepEqual(Object.keys(renderer.meshes).sort(),['mmr-farm-2','mmr-farm-3']);
 await load('farm',2);await load('farm',1);
 assert.deepEqual(Object.keys(renderer.meshes).sort(),['mmr-farm-1','mmr-farm-2']);
 assert.equal(calls,4,'an evicted tier is fetched again when needed');
});

test('catalog fetch and parse concurrency is bounded and queued requests deduplicate',async()=>{
 for(const width of [390,1280]){
  const renderer={width,meshes:{},_meshStatic:{old:true}},entry={enabled:true,tiers:{}};
  for(let tier=1;tier<=8;tier++)entry.tiers[tier]={id:`mmr-farm-${tier}`,file:`assets/meshes/mmr-farm-${tier}.json`};
  const starts=[],finish=[];
  const load=catalogArt.createCatalogBuildingLoader(renderer,{buildings:{farm:entry}},new URL('http://example.test/src/main.js'),()=>{
   starts.push(starts.length);return new Promise(resolve=>finish.push(()=>resolve({ok:true,json:async()=>({faces:[]})})));
  });
  const requests=Array.from({length:8},(_,i)=>load('farm',i+1));
  assert.strictEqual(load('farm',8),requests[7]);
  assert.equal(starts.length,width<600?2:3);
  for(let i=0;i<8;i++){finish[i]();await requests[i];}
  assert.equal(starts.length,8);assert.equal(renderer._meshStatic,null);
 }
});

test('visible catalog demand never exceeds the parsed-cache capacity',()=>{
 for(const width of [390,1280]){
  const {r,s,b,spec}=setup('hall',3,{},1,Math.PI/4,width),tiers={};r.meshes={};
  for(let tier=1;tier<=60;tier++)tiers[tier]={id:`mmr-hall-${tier}`,file:`assets/meshes/mmr-hall-${tier}.json`};
  r.data={...data,'art-manifest':{buildings:{hall:{enabled:true,tiers}}}};
  const requested=[];r.requestCatalogBuilding=(type,tier)=>requested.push(tier);
  for(let tier=1;tier<=60;tier++)drawCatalogBuilding(s,{...b,level:tier},spec);
  assert.equal(requested.length,width<600?16:32);
 }
});

test('a throwing error reporter cannot strand queued loads', {timeout:2000},async()=>{
 const tiers=Object.fromEntries([1,2,3,4].map(t=>[t,{id:`mmr-farm-${t}`,file:`assets/meshes/mmr-farm-${t}.json`}]));
 const warn=console.warn;console.warn=()=>{};
 try{
  const load=catalogArt.createCatalogBuildingLoader({width:390,meshes:{}},{buildings:{farm:{enabled:true,tiers}}},new URL('http://example.test/src/main.js'),()=>Promise.reject(new Error('offline')),()=>{throw new Error('reporter failure');});
  assert.deepEqual(await Promise.all([1,2,3,4].map(t=>load('farm',t))),[null,null,null,null]);
 }finally{console.warn=warn;}
});

test('successful catalog load refreshes a procedural static cache without moving the camera',async()=>{
 const {r,b}=setup();r.calm=true;r.meshes={};
 const world={buildings:[b],troops:[],enemies:[],tiles:[],effects:[],wave:0,elapsed:90,bounds:{w:14,h:12}};
 let finish;
 r.requestCatalogBuilding=catalogArt.createCatalogBuildingLoader(r,data['art-manifest'],new URL('http://example.test/src/main.js'),()=>new Promise(resolve=>{finish=resolve;}));
 drawVillage3D(r,world,0);const old=r._meshStatic;
 finish({ok:true,json:async()=>meshes['mmr-hall-3']});await r.requestCatalogBuilding('hall',3);
 drawVillage3D(r,world,0);
 assert.notStrictEqual(r._meshStatic,old);assert.ok(r._meshStatic.catalogOwners.has(b.id));
 assert.equal(catalogArt.catalogBuildingRenders(r)[0]?.meshId,'mmr-hall-3','loaded body must actually enter the static geometry');
});

test('offscreen missing catalog buildings retain ownership without fetching',()=>{
 const {r,s,b,spec}=setup();r.meshes={};r.cam.x=-100;r.cam.y=-100;
 const requested=[];r.requestCatalogBuilding=(type,tier)=>requested.push([type,tier]);
 assert.equal(drawCatalogBuilding(s,b,spec),true);
 assert.equal(s.faces.length,0);assert.equal(s.owner.id,b.id);
 assert.deepEqual(requested,[]);
});

test('scaffolds, ruins and construction previews retain the native treatment',()=>{
 for(const extra of [{hp:0},{remaining:8},{id:null,remaining:1}]){
  const {s,b,spec}=setup('hall',3,extra);
  assert.equal(drawCatalogBuilding(s,b,spec),false);
  buildingModel(s,b,spec,{buildings:[b],troops:[],enemies:[]});
  assert.ok(s.faces.length);assert.equal(s.sources.length,0);assert.equal(s.chimneys.length,0);
 }
});

test('completed body replacement does not stack procedural architecture on top',()=>{
 const a=setup(),b=setup();
 drawCatalogBuilding(a.s,a.b,a.spec);
 buildingModel(b.s,b.b,b.spec,{buildings:[b.b],troops:[],enemies:[]});
 assert.deepEqual(b.s.faces.map(f=>f.vertices),a.s.faces.map(f=>f.vertices));
});

test('legacy forge mechanisms do not double-draw over the imported forge',()=>{
 const {s,b,spec}=setup('forge',3);
 drawCatalogBuilding(s,b,spec);const before=s.faces.length;
 addLivingMechanisms(s,{buildings:[b],troops:[],enemies:[]},1000);
 assert.equal(s.faces.length,before);
});

test('catalog buildings never receive unverified native machinery anchors',()=>{
 const {r,s,b}=setup('mill',1,{},1.8);
 r.calm=false;s.catalogOwners=new Set([b.id]);
 addLivingMechanisms(s,{buildings:[b],troops:[{hp:100,workplace:b.id}],night:false,elapsed:1000},1000);
  assert.equal(s.faces.length,0,'native wheel is not duplicated at an unmapped source anchor');
});

test('gate and trap catalog files cannot suppress native orientation and defense state',async()=>{
 for(const type of ['gate','trap','fire-trap']){
  const {r,s,b,spec}=setup(type,1);
  const id=`mmr-${type}-1`,mesh=JSON.parse(await readFile(new URL(`../assets/meshes/${id}.json`,import.meta.url)));
  r.meshes={[id]:mesh};r.data={...data,'art-manifest':{buildings:{[type]:{enabled:true,tiers:{1:{id,file:`assets/meshes/${id}.json`}}}}}};
  assert.equal(drawCatalogBuilding(s,b,spec),false,'stateful defenses retain the native renderer until source mapping is verified');
 }
});

test('offscreen catalog buildings preserve ownership without spending the visible budget',()=>{
 const {r,s,b,spec}=setup();r.cam.x=-100;r.cam.y=-100;
 assert.equal(drawCatalogBuilding(s,b,spec),true);
 assert.equal(s.faces.length,0);assert.equal(s.catalogFaces||0,0);
 assert.equal(s.owner.id,b.id);
});

test('phone and desktop body budgets downgrade whole meshes or fall back safely',()=>{
 for(const width of [390,1280]){
  const {s,b,spec}=setup('hall',6,{},2,Math.PI/4,width);
  for(let i=0;i<30;i++)drawCatalogBuilding(s,{...b,id:`body-${i}`},spec);
  assert.ok(s.catalogFaces<=(width<600?3000:6000));
  assert.ok(s.faces.length<30000);
 }
});

test('actual static geometry reuses the cache across clock ticks without save writes',()=>{
 const {r,b}=setup();r.calm=true;
 const world={buildings:[b],troops:[],enemies:[],tiles:[],effects:[],wave:0,elapsed:90,bounds:{w:14,h:12}};
 const before=JSON.stringify(world);
 drawVillage3D(r,world,0);const cached=r._meshStatic;
 const renders=catalogArt.catalogBuildingRenders(r);
 assert.equal(renders.length,1,'static draw publishes catalog evidence');
 drawVillage3D(r,world,1000);
 assert.equal(r._meshStatic,cached);assert.equal(JSON.stringify(world),before);
 assert.deepEqual(catalogArt.catalogBuildingRenders(r),renders,'clock-only reuse preserves draw evidence');
});
