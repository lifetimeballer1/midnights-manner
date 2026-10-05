import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('large catalog building tiers stay out of the service-worker install cache',async()=>{
 const {precacheFiles}=await import('../scripts/precache-files.mjs').catch(()=>({}));
 assert.equal(typeof precacheFiles,'function');
 const files=[
  './index.html',
  './assets/meshes/mmr-hall-1.json',
  './assets/meshes/mmr-cottage-6.json',
  './assets/meshes/baked/warrior-stand-hi.json',
  './assets/meshes/crate.json',
 ];
 assert.deepEqual(precacheFiles(files),[
  './index.html',
  './assets/meshes/baked/warrior-stand-hi.json',
  './assets/meshes/crate.json',
 ]);
});

test('release build refuses local-only catalog files even when their entries are disabled',async()=>{
 const {assertReleaseRights}=await import('../scripts/build-policy.mjs').catch(()=>({}));
 assert.equal(typeof assertReleaseRights,'function');
 const manifest={catalogSource:{license:'unverified',releaseStatus:'local-only'},meshes:{sample:{license:'UNVERIFIED',enabled:true,releaseStatus:'local-only'}}};
 assert.throws(()=>assertReleaseRights(manifest),/unverified.*local-preview/i);
 const disabled=structuredClone(manifest);
 for(const e of Object.values(disabled.meshes))e.enabled=false;
 assert.throws(()=>assertReleaseRights(disabled),/unverified.*local-preview/i);
 assert.doesNotThrow(()=>assertReleaseRights(manifest,true));
 assert.doesNotThrow(()=>assertReleaseRights({meshes:{crate:{license:'CC0',enabled:true}}}));
});

test('user-owned catalog release requires the matching retained permission record',async()=>{
 const {assertReleaseRights}=await import('../scripts/build-policy.mjs');
 const manifest=JSON.parse(await readFile(new URL('../data/art-manifest.json',import.meta.url))),external=JSON.parse(await readFile(new URL('../data/external_assets.json',import.meta.url)));
 assert.doesNotThrow(()=>assertReleaseRights(manifest,false,external));
 assert.throws(()=>assertReleaseRights(manifest),/evidence.*missing|missing.*evidence/i);
});

test('catalog building files cannot ship without their catalog permission record',async()=>{
 const {assertReleaseRights}=await import('../scripts/build-policy.mjs');
 assert.throws(()=>assertReleaseRights({buildings:{hall:{enabled:true}}}),/building catalog.*permission/i);
 const source='a'.repeat(64),manifest={catalogSource:{sourceSHA256:source,rightsEvidence:'catalog',releaseStatus:'approved-public'},buildings:{hall:{enabled:true}}};
 assert.throws(()=>assertReleaseRights(manifest,false,{catalogSources:{catalog:{sourceSHA256:'b'.repeat(64),publicRedistributionPermitted:true}}}),/mismatched.*evidence|evidence.*mismatched/i);
});

test('build hash includes on-demand catalog content without precaching it',async()=>{
 const {contentBuildId}=await import('../scripts/build-policy.mjs').catch(()=>({}));
 assert.equal(typeof contentBuildId,'function');
 const files=['./index.html','./assets/meshes/mmr-hall-1.json'],data={'./index.html':'page','./assets/meshes/mmr-hall-1.json':'old mesh'};
 const a=await contentBuildId('test-seed',files,async file=>data[file]);
 data[files[1]]='changed mesh';
 assert.notEqual(await contentBuildId('test-seed',files,async file=>data[file]),a);
 const {precacheFiles}=await import('../scripts/precache-files.mjs');
 assert.deepEqual(precacheFiles(files),['./index.html']);
});

test('precache-only policy changes produce a distinct build and cache identity',async()=>{
 const {contentBuildId}=await import('../scripts/build-policy.mjs');
 const files=['./index.html','./assets/meshes/mmr-hall-1.json'],read=async file=>file;
 const a=await contentBuildId('seed',files,read,['./index.html']);
 assert.notEqual(await contentBuildId('seed',files,read,files),a);
});

test('catalog approval requires strict permission and per-derivative export evidence',async()=>{
 const {assertReleaseRights}=await import('../scripts/build-policy.mjs');
 const manifest=JSON.parse(await readFile(new URL('../data/art-manifest.json',import.meta.url))),external=JSON.parse(await readFile(new URL('../data/external_assets.json',import.meta.url)));
 const badPermission=structuredClone(external);badPermission.catalogSources['game-assets-mixar'].publicRedistributionPermitted='false';
 assert.throws(()=>assertReleaseRights(manifest,false,badPermission),/permission|evidence/i);
 const missing=structuredClone(manifest);delete missing.meshes['catalog-resource-lumber'].rightsEvidence;
 assert.throws(()=>assertReleaseRights(missing,false,external),/evidence/i);
 const unknown=structuredClone(manifest);unknown.meshes['catalog-resource-lumber'].sourceSHA256='a'.repeat(64);
 assert.throws(()=>assertReleaseRights(unknown,false,external),/export|provenance/i);
 const badExports=structuredClone(manifest);badExports.catalogSource.exportSHA256=['a'.repeat(64)];
 assert.throws(()=>assertReleaseRights(badExports,false,external),/export|provenance/i);
});

test('release rejects unregistered catalog files and mesh metadata outside retained lineage',async()=>{
 const {assertCatalogProvenance}=await import('../scripts/build-policy.mjs');
 assert.equal(typeof assertCatalogProvenance,'function');
 const catalog='a'.repeat(64),exportHash='b'.repeat(64);
 const external={catalogSources:{catalog:{sourceSHA256:catalog,publicRedistributionPermitted:true,exportSHA256:[exportHash]}}};
 const manifest={catalogSource:{sourceSHA256:catalog,rightsEvidence:'catalog',releaseStatus:'approved-public',exportSHA256:[exportHash]},buildings:{hall:{tiers:{1:{file:'assets/meshes/mmr-hall-1.json'}}}}};
 const files=['./assets/meshes/mmr-hall-1.json'],mesh={meta:{format:'mixar-building-v1',type:'hall',tier:1,sourceSHA256:exportHash}};
 await assertCatalogProvenance(manifest,external,files,async()=>JSON.stringify(mesh));
 await assert.rejects(assertCatalogProvenance(manifest,external,[...files,'./assets/meshes/catalog/unregistered.json'],async()=>JSON.stringify(mesh)),/unregistered/i);
 mesh.meta.sourceSHA256='c'.repeat(64);
 await assert.rejects(assertCatalogProvenance(manifest,external,files,async()=>JSON.stringify(mesh)),/provenance|export/i);
});
