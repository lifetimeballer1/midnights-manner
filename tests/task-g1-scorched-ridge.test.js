import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {isScorchedRidge,scorchedThemeKey,sceneryPlan,addEnvironmentScenery} from '../src/environment-art.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','buildings','missions','expansion','biomes'].map(async n=>[
  n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))
 ])
));
const context=new Proxy({},{
 get:(t,k)=>t[k]||(()=>k.includes('Gradient')?{addColorStop(){}}:undefined),
 set:(t,k,v)=>(t[k]=v,true)
});
function rendererAt(zoom,x=12.5,y=5.5,calm=false){
 const r=new Renderer({getContext:()=>context},data,{});
 r.resize(1280,900,1);r.cam.x=x;r.cam.y=y;r.cam.zoom=zoom;r.calm=calm;
 return r;
}

test('G1: ix-ashen-crown declares scorched-ridge without a new biome key',()=>{
 const m=data.missions.find(m=>m.id==='ix-ashen-crown');
 assert.ok(m,'ix-ashen-crown ships');
 assert.equal(m.map.biome,'hills');
 assert.equal(m.map.seed,3401);
 assert.equal(m.map.theme,'scorched-ridge');
 assert.deepEqual(m.map.tiles,[{x:12,y:5,biome:'hills',landmark:'Ashen Crown',claimed:true}]);
 assert.deepEqual(Object.keys(data.biomes).sort(),['forest','hills','plains','unclaimed-fringe','water']);
 assert.deepEqual(data.biomes.hills.scenery.props,['rock','rock','cairn','shrub']);
});

test('G1: scorched theme is expedition-only, home frontier untouched',()=>{
 const d=structuredClone(data);
 const home=createWorld(d);
 assert.equal(isScorchedRidge(home,d),false);
 assert.equal(scorchedThemeKey(home,d),'');
 assert.equal(home.tiles.length,d.world.width*d.world.height);
 assert.ok(!home.tiles.some(t=>t.landmark==='Ashen Crown'));
 for(const name of ['Stillwater','Timber Line','Moonwell'])assert.ok(home.tiles.some(t=>t.landmark===name),`home keeps ${name}`);
 const mission=d.missions.find(m=>m.id==='ix-ashen-crown');
 const away=createWorld(d,mission);
 assert.equal(away.biomeSeed,3401);
 assert.equal(away.tiles.length,20*17);
 assert.ok(away.tiles.find(t=>t.landmark==='Ashen Crown'));
 assert.ok(away.tiles.filter(t=>!t.landmark).every(t=>t.biome==='hills'));
 assert.ok(!away.tiles.some(t=>['Stillwater','Moonwell','Timber Line'].includes(t.landmark)));
 assert.equal(isScorchedRidge(away,d),true);
 assert.equal(scorchedThemeKey(away,d),'scorched-ridge');
});

test('G1: ash tint is calm-safe, zoom-gated and bounded',()=>{
 const d=structuredClone(data),mission=d.missions.find(m=>m.id==='ix-ashen-crown');
 const away=createWorld(d,mission);
 const near=rendererAt(1.8),sNear=new MeshScene(near);
 const drawnNear=addEnvironmentScenery(sNear,away,d);
 assert.ok(drawnNear>0&&drawnNear<=130,`bounded near count: ${drawnNear}`);
 assert.ok(sNear.faces.length>0&&sNear.faces.every(f=>/^#[0-9a-f]{6}$/i.test(f.color)));
 const colors=new Set(sNear.faces.map(f=>f.color));
 assert.ok(colors.has('#4f4f52')||colors.has('#5e5f60')||colors.has('#42372f')||colors.has('#3f3f41'),'ash palette present up close');
 assert.ok(colors.has('#2f2b28')||colors.has('#4a4440'),'sparse char detail present up close');
 const far=rendererAt(0.6),sFar=new MeshScene(far);
 const drawnFar=addEnvironmentScenery(sFar,away,d);
 assert.ok(drawnFar<=50,`far overview stays quiet: ${drawnFar}`);
 assert.ok(!sFar.faces.some(f=>f.color==='#2f2b28'||f.color==='#4a4440'),'char shards gated to close zoom');
 const calmR=rendererAt(1.8,12.5,5.5,true),sCalm=new MeshScene(calmR);
 addEnvironmentScenery(sCalm,away,d);
 const plain=rendererAt(1.8,12.5,5.5,false),sPlain=new MeshScene(plain);
 addEnvironmentScenery(sPlain,away,d);
 assert.deepEqual(sCalm.faces.map(f=>[f.color,f.points]),sPlain.faces.map(f=>[f.color,f.points]),'calm renders identical static geometry');
 const home=createWorld(d),rHome=rendererAt(1.8,20,17),sHome=new MeshScene(rHome);
 addEnvironmentScenery(sHome,home,d);
 const homeColors=new Set(sHome.faces.map(f=>f.color));
 for(const c of ['#4f4f52','#5d5d60','#2f2b28','#4a4440','#3f3f41'])assert.ok(!homeColors.has(c),`home keeps its palette (${c} absent)`);
});

test('G1: scenery planning never mutates tiles, data or saves',()=>{
 const d=structuredClone(data),mission=d.missions.find(m=>m.id==='ix-ashen-crown');
 const away=createWorld(d,mission);
 const tilesBefore=JSON.stringify(away.tiles),dataBefore=JSON.stringify(d);
 const beforeKeys=Object.keys(away).sort();
 sceneryPlan(away,d);
 assert.equal(JSON.stringify(away.tiles),tilesBefore,'plan leaves tiles alone');
 const r=rendererAt(1.8),s=new MeshScene(r);
 addEnvironmentScenery(s,away,d);
 assert.equal(JSON.stringify(away.tiles),tilesBefore,'render leaves tiles alone');
 assert.equal(JSON.stringify(d),dataBefore,'render leaves data alone');
 assert.deepEqual(Object.keys(away).sort(),beforeKeys,'no new save fields on the world');
 assert.equal(away.theme,undefined,'theme stays data-side, never on the save');
});
