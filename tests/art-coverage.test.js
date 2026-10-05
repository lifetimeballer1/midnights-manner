import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));

test('every game building tier maps to its complete actual Mixar source mesh',async()=>{
 const buildings=await json('../data/buildings.json');
 const manifest=await json('../data/art-manifest.json');
 const coverage=await readFile(new URL('../docs/ART_COVERAGE.md',import.meta.url),'utf8');
 assert.deepEqual(Object.keys(manifest.buildings).sort(),Object.keys(buildings).sort());
  assert.equal(manifest.catalogSource?.rightsEvidence,'game-assets-mixar');
  assert.equal(manifest.catalogSource?.releaseStatus,'approved-public');
 assert.match(manifest.catalogSource?.sourceSHA256,/^[0-9a-f]{64}$/);
 let count=0;
 for(const [type,spec] of Object.entries(buildings)){
  const entry=manifest.buildings[type];
  assert.ok(coverage.includes(`| \`${type}\` | ${spec.name} |`),`${type} coverage row`);
   assert.equal(entry.enabled,!['gate','trap','fire-trap'].includes(type),`${type} rollout preserves verified defensive state`);
  assert.equal(Object.keys(entry.tiers).length,spec.tiers.length,`${type} tier count`);
  for(let tier=1;tier<=spec.tiers.length;tier++){
   const map=entry.tiers[tier],id=`mmr-${type}-${tier}`;
   assert.equal(map?.id,id,`${type} tier ${tier} id`);
   assert.equal(map?.file,`assets/meshes/${id}.json`,`${type} tier ${tier} file`);
   const mesh=await json(`../${map.file}`),meta=mesh.meta;
   assert.equal(meta.format,'mixar-building-v1',id);
   assert.equal(meta.sourceObject,`MMR | ${type} | T${String(tier).padStart(2,'0')} Architecture`,id);
   assert.equal(meta.type,type,id);
   assert.equal(meta.tier,tier,id);
   assert.equal(meta.footprint,spec.size,id);
   assert.equal(meta.complete,true,id);
   assert.match(meta.sourceSHA256,/^[0-9a-f]{64}$/,id);
   assert.equal(meta.faces,mesh.faces.length,id);
   assert.ok(mesh.faces.length>0&&mesh.faces.length<=3000,id);
   assert.ok(mesh.lods?.low?.faces.length>0&&mesh.lods.low.faces.length<=3000,id);
   for(const face of [...mesh.faces,...mesh.lods.low.faces]){
    assert.match(face.c,/^#[0-9a-f]{6}$/i,id);
    assert.ok(Array.isArray(face.v)&&face.v.length>=3,id);
    for(const [x,y,z] of face.v){
     assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z),id);
     assert.ok(Math.abs(x)<=spec.size/2&&Math.abs(y)<=spec.size/2&&z>=0&&z<=4,id);
    }
   }
   count++;
  }
 }
 assert.equal(count,334);
  const pending=coverage.split('\n').filter(line=>/^\| .* \| (?:queued|partial) \|/.test(line));
  assert.ok(pending.length>=8,'remaining source groups stay explicitly queued or partial');
  assert.ok(pending.every(line=>line.split('|').length>=6&&line.split('|')[4].trim().length>0),'each pending group names its blocker');
});

test('user-owned Mixar sources retain permission evidence and honest partial coverage',async()=>{
 const manifest=await json('../data/art-manifest.json');
 const external=await json('../data/external_assets.json');
 const coverage=await readFile(new URL('../docs/ART_COVERAGE.md',import.meta.url),'utf8');
 const ids=['catalog-tree-single-a','catalog-tree-a-small','catalog-tree-a-medium','catalog-tree-a-large','catalog-tree-b-small','catalog-tree-b-medium','catalog-tree-b-large','catalog-resource-stone','catalog-resource-lumber'];
 for(const id of ids){
  const entry=manifest.meshes?.[id];
  assert.equal(entry?.domain,id==='catalog-resource-lumber'?'production':'environment',id);
   assert.equal(entry?.rightsEvidence,'game-assets-mixar',id);
   assert.equal(entry?.releaseStatus,'approved-public',id);
   assert.equal(external.assets.some(asset=>asset.id===id),false,id+' is not advertised as CC0');
 }
 const vegetation=coverage.split('\n').find(line=>line.startsWith('| Vegetation and nature |'));
 assert.match(vegetation, /\| partial \|/);
 assert.match(vegetation, /catalog-tree-single-a/);
 assert.match(vegetation, /Seven tree meshes/);
 const piles=coverage.split('\n').find(line=>line.startsWith('| Resource piles |'));
 assert.match(piles, /\| partial \|/);
 assert.match(piles, /catalog-resource-lumber/);
 assert.equal(external.catalogSources['game-assets-mixar'].publicRedistributionPermitted,true);
 assert.equal(external.catalogSources['game-assets-mixar'].evidenceType,'user-attestation');
 assert.equal(external.catalogSources['game-assets-mixar'].sourceSHA256,manifest.catalogSource.sourceSHA256);
});
