import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {burnedRemains,visibleFrontierCamps,addEnvironmentScenery} from '../src/environment-art.js';
import {smokeSources} from '../src/atmosphere-art.js';
import {claimRegion,regionById} from '../src/systems/expansion.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','buildings','missions','expansion','biomes'].map(async n=>[
  n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))
 ])
));
const context=new Proxy({},{
 get:(t,k)=>t[k]||(()=>k.includes('Gradient')?{addColorStop(){}}:undefined),
 set:(t,k,v)=>(t[k]=v,true)
});
function rendererAt(zoom,x=48.5,y=14.5,calm=false){
 const r=new Renderer({getContext:()=>context},data,{});
 r.resize(1280,900,1);r.cam.x=x;r.cam.y=y;r.cam.zoom=zoom;r.calm=calm;
 return r;
}
function homeWorld(){
 const d=structuredClone(data),w=createWorld(d);
 w.wave=20;
 return {d,w};
}

test('G2: remains appear only when the clearedBy chapter is done and the region is unclaimed',()=>{
 const {d,w}=homeWorld();
 assert.deepEqual(burnedRemains(w,d),[],'no ledger, no remains');
 w.clearedCamps=['ix-whisper-snare'];
 assert.deepEqual(burnedRemains(w,d).map(c=>c.id),['thornband-whisper'],'the burned Cut-Camp leaves remains');
 assert.equal(visibleFrontierCamps(w,d).some(c=>c.id==='thornband-whisper'),false,'the live camp is gone while remains stand');
 assert.equal(visibleFrontierCamps(w,d).length,4,'only the burned camp drops from the live set');
 claimRegion(w,regionById(d.expansion,'whisperwood'));
 assert.deepEqual(burnedRemains(w,d),[],'claiming the region clears the remains too');
});

test('G2: remains are home-only, hidden on expedition sheets',()=>{
 const {d,w}=homeWorld();
 w.clearedCamps=['ix-whisper-snare'];
 assert.equal(burnedRemains(w,d).length,1,'home shows the marker');
 const mission=d.missions.find(m=>m.id==='ix-ashen-crown');
 const away=createWorld(d,mission);
 away.clearedCamps=['ix-whisper-snare'];
 assert.deepEqual(burnedRemains(away,d),[],'expedition sheets never show remains');
 const r=rendererAt(1.8),s=new MeshScene(r);
 addEnvironmentScenery(s,away,d);
 assert.ok(!s.faces.some(f=>f.owner?.kind==='burned-remains'),'no remains faces off-home');
});

test('G2: remains are calm-safe, zoom-gated and share the scenery budget',()=>{
 const {d,w}=homeWorld();
 w.clearedCamps=['ix-whisper-snare'];
 const near=rendererAt(1.8),sNear=new MeshScene(near);
 const drawnNear=addEnvironmentScenery(sNear,w,d);
 assert.ok(sNear.faces.some(f=>f.owner?.kind==='burned-remains'),'marker geometry present up close');
 assert.ok(sNear.faces.some(f=>f.owner?.kind==='burned-remains'&&/^#[0-9a-f]{6}$/i.test(f.color)),'marker faces carry plain albedo');
 const colors=new Set(sNear.faces.filter(f=>f.owner?.kind==='burned-remains').map(f=>f.color));
 assert.ok(!colors.has('#e5a458'),'no live cookfire flame in the remains');
 const far=rendererAt(0.6),sFar=new MeshScene(far);
 addEnvironmentScenery(sFar,w,d);
 assert.ok(!sFar.faces.some(f=>f.owner?.kind==='burned-remains'),'far overviews stay quiet');
 const calmR=rendererAt(1.8,48.5,14.5,true),sCalm=new MeshScene(calmR);
 addEnvironmentScenery(sCalm,w,d);
 const plain=rendererAt(1.8,48.5,14.5,false),sPlain=new MeshScene(plain);
 addEnvironmentScenery(sPlain,w,d);
 assert.deepEqual(sCalm.faces.map(f=>[f.color,f.points]),sPlain.faces.map(f=>[f.color,f.points]),'calm renders identical static geometry');
 assert.ok(drawnNear<=130,`shares the bounded budget: ${drawnNear}`);
});

test('G2: cleared camps leave no smoke and rendering mutates no save',()=>{
 const {d,w}=homeWorld();
 w.clearedCamps=['ix-whisper-snare'];
 assert.ok(!smokeSources(w,d).some(s=>s.id==='thornband-whisper'),'burned camp smoke stays off');
 const tilesBefore=JSON.stringify(w.tiles),dataBefore=JSON.stringify(d);
 const beforeKeys=Object.keys(w).sort();
 const r=rendererAt(1.8),s=new MeshScene(r);
 addEnvironmentScenery(s,w,d);
 assert.equal(JSON.stringify(w.tiles),tilesBefore,'render leaves tiles alone');
 assert.equal(JSON.stringify(d),dataBefore,'render leaves data alone');
 assert.deepEqual(Object.keys(w).sort(),beforeKeys,'no new save fields on the world');
});
