import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene, buildingModel} from '../src/scene3d.js';
import {addConvertedBuildingTiers} from '../src/asset-art.js';
import {createHash} from 'node:crypto';

const families = ['hall','cottage','barracks','farm','lumber','mine','market','forge'];
const ids = ['fence','roof-gable'];
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','art-manifest'].map(async name =>
  [name, JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url)))])));
const meshes = {};
for (const id of ids) {
  const entry = data['art-manifest'].meshes[id];
  if (entry) meshes[id] = JSON.parse(await readFile(new URL('../'+entry.file, import.meta.url)));
}
const context = new Proxy({}, {get: (t,k) => t[k] || (() => k === 'measureText' ? {width:40} : k.includes('Gradient') ? {addColorStop(){}} : undefined)});
function model(type, level, {loaded=true, zoom=1.65, calm=false, time=0, overrides={}, disabled=false, yaw=Math.PI/4}={}) {
  const d = disabled ? {...data, 'art-manifest':{meshes:{}}} : data;
  const r = new Renderer({getContext:()=>context}, d, {});
  r.resize(1280,900,1); r.cam.x=6; r.cam.y=6; r.cam.zoom=zoom; r.cam.yaw=yaw; r.calm=calm;
  r.meshes=loaded ? meshes : {};
  const s = new MeshScene(r), raw=[];
  const face = s.face.bind(s);
  s.face=(v,c,split)=>{raw.push({v,c,emissive:s.emissive});face(v,c,split);};
  const b={id:type+'-r4',type,x:5,y:5,level,hp:100,remaining:0,...overrides};
  const spec=data.buildings[type], world={buildings:[b],troops:[],enemies:[]};
  const before=JSON.stringify({b,spec,world});
  buildingModel(s,b,spec,world,time);
  assert.equal(JSON.stringify({b,spec,world}),before,'rendering never changes footprint, collision or world data');
  return {raw, sources:s.sources, faces:s.faces};
}

test('r4 building pieces retain staged CC0 provenance and bounded flat geometry', async () => {
  let bytes=0;
  for (const id of ids) {
    const entry=data['art-manifest'].meshes[id];
    assert.ok(entry?.enabled, id+' is registered');
    assert.equal(entry.creator,'Kay Lousberg');
    assert.equal(entry.license,'CC0');
    assert.match(entry.sourceGlTF,/sources\/hexagon-buildings\//);
    assert.match(entry.sourceSHA256,/^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(await readFile(new URL('../'+entry.sourceGlTF,import.meta.url))).digest('hex'),entry.sourceSHA256,'staged source hash matches');
    assert.ok(meshes[id].faces.length>0 && meshes[id].faces.length<=100);
    for (const f of meshes[id].faces) {
      assert.match(f.c,/^#[a-f0-9]{6}$/i);
      assert.ok(f.v.length>=3 && f.v.every(p=>p.length===3 && p.every(Number.isFinite)));
    }
    bytes+=(await stat(new URL('../'+entry.file,import.meta.url))).size;
  }
  assert.ok(meshes.fence.variants.stone.faces.length>0 && meshes.fence.variants.stone.faces.length<=100);
  assert.notDeepEqual(meshes.fence.faces.map(f=>f.v),meshes.fence.variants.stone.faces.map(f=>f.v),'stone rail is not a recolor');
  assert.ok(bytes<50000,'three reusable modules stay under 50 KB');
});

test('r4 structural modules respect desktop and phone scene budgets', () => {
  for(const [width,budget] of [[1280,1400],[390,800]]) {
    const r=new Renderer({getContext:()=>context},data,{});
    r.resize(width,900,1);r.cam.zoom=1.65;r.meshes=meshes;
    const s=new MeshScene(r);
    for(let i=0;i<24;i++) {
      const type=families[i%families.length], b={id:'budget-'+i,type,x:5,y:5,level:6,hp:100,remaining:0};
      addConvertedBuildingTiers(s,b,data.buildings[type]);
      assert.ok(s.buildingArtFaces<=budget,'submitted imports never exceed the scene cap');
    }
    assert.ok(s.buildingArtFaces>budget-100,'test exercises budget exhaustion, not a missing mesh');
  }
});

for (const type of families) {
  test(`r4 ${type}: six structural tiers, imported pieces inside unchanged footprint`, () => {
    let previous;
    for (let level=1;level<=6;level++) {
      const full=model(type,level), fallback=model(type,level,{loaded:false});
      const shape=JSON.stringify(full.raw.map(f=>f.v));
      if(previous) assert.notEqual(shape,previous,'upgrade changes geometry, not just color');
      previous=shape;
      if(level>=2) {
        assert.ok(full.raw.length>fallback.raw.length,'converted structural modules actually render');
        const original=new Set(fallback.raw.map(f=>JSON.stringify(f.v)));
        for(const f of full.raw.filter(f=>!original.has(JSON.stringify(f.v)))) for(const [x,y] of f.v) {
          assert.ok(x>=5 && x<=5+data.buildings[type].size && y>=5 && y<=5+data.buildings[type].size,'import stays within collision footprint');
        }
      }
      assert.deepEqual(full.sources,fallback.sources,'modules do not invent or relocate existing light anchors');
      assert.deepEqual(model(type,level,{calm:true,time:0}).raw,model(type,level,{calm:true,time:1000}).raw,'Calm geometry is frozen');
    }
  });
}

test('r4 pieces fall back silently and suppress detail on ruins, scaffolds, ghosts and far views', () => {
  for(const type of families) {
    const fallback=model(type,6,{loaded:false});
    assert.deepEqual(model(type,6,{disabled:true}).raw,fallback.raw,'disabled modules keep procedural fallback');
    for(const overrides of [{hp:0},{remaining:25},{id:null,remaining:1}]) {
      const full=model(type,6,{overrides}), original=model(type,6,{overrides,loaded:false});
      assert.deepEqual(full.raw,original.raw,'unfinished and destroyed buildings have no imported clutter');
      assert.equal(full.sources.length,0,'unfinished and destroyed buildings emit no light');
    }
    assert.deepEqual(model(type,6,{zoom:1.1}).raw,model(type,6,{zoom:1.1,loaded:false}).raw,'far view uses cheap procedural silhouette');
    for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
      const full=model(type,6,{yaw});
      assert.ok(full.faces.every(f=>f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),'all orbit angles paint');
    }
  }
});
