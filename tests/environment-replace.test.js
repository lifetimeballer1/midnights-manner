// Wilds silhouette replacement pass — biome reads are structural, not
// recolors. Renderer-only: planning stays pure, props stay grounded and
// tile-scale, converted meshes keep replacing procedural geometry when
// enabled, and every missing mesh falls back to a procedural silhouette.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {sceneryForTile,sceneryPlan,drawProp,convertedId,addEnvironmentScenery} from '../src/environment-art.js';
import {addWindLife} from '../src/wind-art.js';
import {hash2} from '../src/systems/biomes.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','buildings','biomes','missions','expansion'].map(async n=>[
  n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))
 ])
));
data['art-manifest']=JSON.parse(await readFile(new URL('../data/art-manifest.json',import.meta.url)));
const manifest=data['art-manifest'];
const KINDS=['pine','shrub','grass','stump','log','reeds','cairn','rock','stone','flowers','lilies'];
async function meshDoc(id){return JSON.parse(await readFile(new URL('../'+manifest.meshes[id].file,import.meta.url)));}
function renderer(meshes){
 const r=new Renderer({getContext:()=>({})},data,{});
 r.resize(1280,900,1);r.cam.x=0;r.cam.y=0;r.cam.zoom=1.2;r.cam.yaw=Math.PI/4;
 r.meshes=meshes;
 return r;
}
function draw(r,kind,x=3,y=4,biome='plains',scorched=false){
 r.cam.x=x;r.cam.y=y;
 const s=new MeshScene(r);
 drawProp(s,{x,y,kind,biome},0,scorched,r.cam.zoom);
 return s;
}
// Raw geometry recorder: mirrors MeshScene's box/pyramid primitives but skips
// projection and backface culling, so silhouette comparisons stay
// view-independent (culling would drop different faces at different scales).
class RecordScene{
 constructor(r){this.r=r;this.faces=[];this.owner=null;this.alpha=1;}
 face(vertices,color,primitive){this.faces.push({vertices:vertices.map(v=>[...v]),color,primitive});}
 box(x,y,z,w,d,h,color,cap=true){const p=[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]];for(const f of [[0,3,2,1],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],...(cap?[[4,5,6,7]]:[])])this.face(f.map(i=>p[i]),color,'box');}
 pyramid(x,y,z,radius,h,color,sides=4){const ring=Array.from({length:sides},(_,i)=>[x+Math.cos(i*Math.PI*2/sides)*radius,y+Math.sin(i*Math.PI*2/sides)*radius,z]);for(let i=0;i<sides;i++)this.face([ring[i],ring[(i+1)%sides],[x,y,z+h]],color,'pyramid-'+sides);}
}
function record(kind,x=3,y=4,biome='plains',scorched=false){
 const s=new RecordScene({cam:{zoom:1.2},data});
 drawProp(s,{x,y,kind,biome},0,scorched,1.2);
 return s;
}
function composition(s){
 const parts={};
 for(const f of s.faces)parts[f.primitive]=(parts[f.primitive]||0)+1;
 return JSON.stringify(parts);
}
// Translation-free geometry signature: colors and positions are stripped,
// so only the silhouette structure is compared.
function structure(s,x,y){
 return s.faces.map(f=>f.vertices.map(v=>[
  Math.round((v[0]-x-.5)*1000)/1000,Math.round((v[1]-y-.5)*1000)/1000,Math.round(v[2]*1000)/1000
 ].join(',')).join(';')).sort().join('|');
}

test('each biome keeps a structurally distinct silhouette set (not a recolor)',()=>{
 const signature=biome=>{
  const props=[...new Set(data.biomes[biome].scenery.props)],shapes=new Set();
  for(const kind of props)for(const [x,y] of [[2,3],[5,6],[8,2],[3,9]])shapes.add(structure(record(kind,x,y,biome),x,y));
  return JSON.stringify([...shapes].sort());
 };
 const seen=Object.fromEntries(Object.keys(data.biomes).map(b=>[b,signature(b)]));
 const ids=Object.keys(seen);
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)
  assert.notEqual(seen[ids[i]],seen[ids[j]],`${ids[i]} vs ${ids[j]} silhouettes collapse`);
});

test('shared prop kinds rebuild per biome instead of only recoloring',()=>{
 const at=(kind,biome)=>structure(record(kind,4,7,biome),4,7);
 assert.notEqual(at('pine','forest'),at('pine','unclaimed-fringe'),'fringe conifers add a canopy tier');
 assert.notEqual(at('shrub','forest'),at('shrub','hills'),'hills scrub is not a forest shrub');
 assert.notEqual(at('grass','plains'),at('grass','unclaimed-fringe'),'fringe tufts are denser');
 assert.notEqual(at('stone','plains'),at('stone','water'),'shore stones add a wet slab');
});

test('forest deals layered conifers and broadleaf variants by tile hash',()=>{
 const jOf=(x,y)=>hash2(x+13,y+29,0)%1000;
 const conifer=[],broad=[];
 for(let x=0;x<40;x++)for(let y=0;y<34;y++){
  (hash2(x,y,991)%100<42?broad:conifer).push({x,y,j:jOf(x,y)});
 }
 assert.ok(conifer.length>0&&broad.length>0,`both forms dealt (${conifer.length} conifer / ${broad.length} broadleaf)`);
 // Same tile hash, same scale: the two forms must differ as raw geometry.
 const match=conifer.find(a=>broad.some(b=>b.j===a.j));
 const leaf=broad.find(b=>b.j===match.j);
 assert.notEqual(structure(record('pine',match.x,match.y,'forest'),match.x,match.y),
  structure(record('pine',leaf.x,leaf.y,'forest'),leaf.x,leaf.y),'conifer and broadleaf differ structurally at equal scale');
 // Primitive composition is constant per form: 3 stacked six-sided canopy
 // tiers over one trunk vs 4 offset five-sided crown blobs.
 const coniferParts=composition(record('pine',conifer[0].x,conifer[0].y,'forest'));
 const broadParts=composition(record('pine',broad[0].x,broad[0].y,'forest'));
 assert.equal(coniferParts,composition(record('pine',conifer.at(-1).x,conifer.at(-1).y,'forest')),'every conifer shares one layered form');
 assert.equal(broadParts,composition(record('pine',broad.at(-1).x,broad.at(-1).y,'forest')),'every broadleaf shares one crown form');
 assert.notEqual(coniferParts,broadParts);
 assert.match(coniferParts,/"pyramid-6":18/,'conifer grows three six-sided canopy tiers');
 assert.match(broadParts,/"pyramid-5":20/,'broadleaf grows four five-sided crown blobs');
});

test('every prop kind stays grounded, tile-scale and never steals taps',()=>{
 for(const biome of Object.keys(data.biomes))for(const kind of [...new Set(data.biomes[biome].scenery.props)]){
  const x=3,y=4,r=renderer(),s=new MeshScene(r);
  s.owner={kind:'probe',id:'before'};
  drawProp(s,{x,y,kind,biome},0,false,1.2);
  const tag=`${biome}/${kind}`;
  assert.ok(s.faces.length>0,`${tag} draws geometry`);
  assert.equal(s.owner?.id,'before',`${tag} leaves scene ownership alone`);
  for(const f of s.faces){
   assert.match(f.color,/^#[0-9a-f]{6}$/i,`${tag} keeps flat hex albedo`);
   for(const [vx,vy,vz] of f.vertices){
    assert.ok(Number.isFinite(vx)&&Number.isFinite(vy)&&Number.isFinite(vz),`${tag} finite vertices`);
    assert.ok(vz>=0,`${tag} grounded (z ${vz})`);
    assert.ok(vz<=1.6,`${tag} height-bounded (z ${vz})`);
    assert.ok(vx>=x-.5&&vx<=x+1.5,`${tag} tile-scale x (${vx})`);
    assert.ok(vy>=y-.5&&vy<=y+1.5,`${tag} tile-scale y (${vy})`);
   }
  }
 }
});

test('density caps and LOD gating hold at every zoom band',()=>{
 const biomes=Object.keys(data.biomes),tiles=[];
 for(let y=0;y<44;y++)for(let x=0;x<52;x++)tiles.push({
  x,y,biome:biomes[(x*7+y*3)%biomes.length],claimed:(x+y)%3===0,
  landmark:(x===10&&y===10)||(x===40&&y===30)?'Moonwell':null
 });
 const world={tiles,buildings:[],biomeSeed:5},plan=sceneryPlan(world,data);
 assert.ok(plan.length>130,`dense wild plan (${plan.length})`);
 const counts={};
 for(const [zoom,cap] of [[1.8,130],[1.0,85],[0.6,50]]){
  const r=renderer();r.cam.zoom=zoom;r.cam.x=26;r.cam.y=22;
  const s=new MeshScene(r),drawn=addEnvironmentScenery(s,world,data);
  assert.ok(drawn<=cap,`zoom ${zoom} stays inside the ${cap} cap (${drawn})`);
  assert.equal(r._livingScenery.length,plan.length,'wind keeps the full plan at every zoom');
  counts[zoom]=drawn;
 }
 assert.ok(counts[1.8]>counts[0.6],`close views keep more detail (${counts[1.8]} vs ${counts[0.6]})`);
 const bare={tiles:tiles.map(t=>({...t,landmark:null})),buildings:[],biomeSeed:5};
 const far=renderer();far.cam.zoom=.6;far.cam.x=26;far.cam.y=22;
 assert.equal(addEnvironmentScenery(new MeshScene(far),bare,data),0,'far overviews drop every non-landmark prop');
});

test('planning and rendering never mutate tiles, world or data',()=>{
 const tiles=[];
 for(let y=0;y<10;y++)for(let x=0;x<12;x++)tiles.push({x,y,biome:'forest',claimed:(x+y)%2===0,landmark:null});
 const world={tiles,buildings:[],biomeSeed:11};
 const tilesBefore=JSON.stringify(tiles),dataBefore=JSON.stringify(data),keysBefore=Object.keys(world).sort();
 const plan=sceneryPlan(world,data);
 assert.ok(plan.length>0,'plan produces scenery');
 assert.equal(JSON.stringify(tiles),tilesBefore,'planning leaves tiles alone');
 const r=renderer();r.cam.zoom=1.8;r.cam.x=6;r.cam.y=5;
 addEnvironmentScenery(new MeshScene(r),world,data);
 assert.equal(JSON.stringify(tiles),tilesBefore,'rendering leaves tiles alone');
 assert.equal(JSON.stringify(data),dataBefore,'rendering leaves data alone');
 assert.deepEqual(Object.keys(world).sort(),keysBefore,'no new save fields appear');
});

test('converted meshes keep alternating; missing meshes fall back procedurally',async()=>{
 const meshes={bush:await meshDoc('bush'),log:await meshDoc('log'),'rock-small-a':await meshDoc('rock-small-a'),'stone-small':await meshDoc('stone-small'),
  'flower-red':await meshDoc('flower-red'),'flower-yellow':await meshDoc('flower-yellow'),'flower-purple':await meshDoc('flower-purple'),
  'lily-small':await meshDoc('lily-small'),'lily-large':await meshDoc('lily-large')};
 const r=renderer(meshes);
 let converted=0,procedural=0,hit=null;
 for(let x=0;x<30;x++){
  const id=convertedId({r},{x,y:5,kind:'shrub'});
  if(id){converted++;assert.equal(id,'bush');if(hit===null)hit=x;}else procedural++;
 }
 assert.ok(converted>0&&procedural>0,'shrub alternates converted and procedural tiles');
 const s=new MeshScene(r);
 drawProp(s,{x:hit,y:5,kind:'shrub',biome:'forest'},0,false,1.65);
 assert.ok(s.faces.length>12,`converted bush replaces the procedural shrub (${s.faces.length})`);
 for(const kind of ['flowers','lilies'])assert.ok(convertedId({r},{x:3,y:4,kind}),`${kind} converts when its mesh is preloaded`);
 const bare=renderer();
 for(const kind of KINDS){
  const s2=new MeshScene(bare);
  drawProp(s2,{x:3,y:4,kind,biome:'water'},0,false,1.2);
  assert.ok(s2.faces.length>0,`${kind} procedural fallback draws`);
 }
 assert.ok(draw(bare,'lilies',3,4,'water').faces.some(f=>f.color==='#3f7a50'),'lily fallback keeps a flat pad');
 const petals=['#c96a7a','#e9a0ac','#d9b04e','#f0d27e','#8f7ec0','#b7a8e0'];
 assert.ok(draw(bare,'flowers',3,4,'plains').faces.some(f=>petals.includes(f.color)),'flower fallback keeps blossom heads');
});

test('wind beams follow the rebuilt silhouettes and stay calm-gated',()=>{
 const r=renderer();r.cam.zoom=1.8;r.cam.x=3;r.cam.y=3;
 r._livingScenery=[{x:3,y:3,kind:'pine',biome:'forest'},{x:4,y:3,kind:'lilies',biome:'water'},{x:5,y:3,kind:'grass',biome:'unclaimed-fringe'}];
 const s=new MeshScene(r);
 addWindLife(s,{weather:'clear',buildings:[]},1000);
 assert.ok(s.faces.length>=3,'living props sway');
 r.calm=true;
 const calm=new MeshScene(r);
 addWindLife(calm,{weather:'clear',buildings:[]},1000);
 assert.equal(calm.faces.length,0,'calm keeps the terrain static');
});
