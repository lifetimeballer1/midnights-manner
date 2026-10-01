import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CINEMATIC_LIMITS,shadowCacheKey,drawCelestialShadows,unitShadowVisible,drawPracticalBloom,drawGodRays,drawGroundMist,drawLayeredRain} from '../src/cinematic-lighting.js';
import {drawSourceSpill,visibleLightBudget} from '../src/source-lighting.js';
import {skyLightAt,lightingFor,weatherLightAt} from '../src/systems/daynight.js';
const data={world:JSON.parse(await readFile(new URL('../data/world.json',import.meta.url)))};
function renderer(width=390,zoom=1.65){
 const calls=[];const ctx=new Proxy({}, {get:(t,k)=>k in t?t[k]:(...args)=>{calls.push([k,...args]);return k.includes('Gradient')?{addColorStop(){}}:undefined;},set:(t,k,v)=>(t[k]=v,true)});
 return {width,height:844,ctx,cam:{x:0,y:0,zoom},calm:false,project:(x,y,z=0)=>({x:190+x*20,y:400+y*12-z*20}),calls};
}
const caster=(id,x=0)=>({id,points:[[x,0,0],[x+1,0,0],[x,1,0],[x+1,1,0],[x,0,2],[x+1,0,2],[x,1,2],[x+1,1,2]]});
const light={keyDir:[-.5,-.4,.8],keyI:.3,fog:0,weatherId:'clear',phase:{id:'day'},overlay:{glow:1}};
test('polish: authored intensities use the single existing clock resolver',()=>{
 for(const [id,key,ambient,glow] of [['dawn',.32,.58,.36],['day',.30,.68,0],['dusk',.31,.54,.72],['night',.20,.44,.92]]){
  const fraction={dawn:.04,day:.3,dusk:.54,night:.8}[id],sky=skyLightAt(300+fraction*300,data,{calm:true});
  assert.equal(sky.keyI,key);assert.equal(sky.ambI,ambient);assert.equal(lightingFor(id,data).glow,glow);
 }
 assert.equal(weatherLightAt('rain',data).fog,.12);assert.equal(weatherLightAt('fog',data).dim,.88);
});
test('polish: shadows cull full cast extents and reuse bounded world hulls across camera changes',()=>{
 const r=renderer();r._meshStatic={casters:[caster('home'),caster('outside',1000)]};const scene={r,light};
 assert.equal(drawCelestialShadows(scene),1);assert.equal(r.lightingStats.shadowCulled,1);assert.equal(r._shadowHullCache.size,1);
 const shape=r._shadowHullCache.values().next().value;r.project=(x,y)=>({x:200+x*20,y:410+y*12});
 drawCelestialShadows(scene);assert.equal(r._shadowHullCache.values().next().value,shape,'camera reprojection reuses world hull');
 assert.equal(r.lightingStats.penumbraPasses,3);r.cam.zoom=.7;drawCelestialShadows(scene);assert.equal(r.lightingStats.shadows,1);assert.equal(r.lightingStats.penumbraPasses,2);
 for(let i=0;i<700;i++){r._meshStatic.casters=[caster('id-'+i)];drawCelestialShadows(scene);}
 assert.equal(r._shadowHullCache.size,CINEMATIC_LIMITS.shadowCache);
 assert.notEqual(shadowCacheKey(caster('home'),light),shadowCacheKey(caster('home',1),light));
 assert.notEqual(shadowCacheKey(caster('home'),light),shadowCacheKey(caster('home'),{keyDir:[1,0,.5]}));
});
test('polish: 150 villagers cast zero overview shadows and visible units retain close shadows',()=>{
 const r=renderer(390,.7),units=Array.from({length:150},(_,id)=>({id,x:1,y:1,hp:100}));
 assert.equal(units.filter(u=>unitShadowVisible(r,u)).length,0);
 r.cam.zoom=1.65;assert.equal(units.filter(u=>unitShadowVisible(r,u)).length,150);
 assert.equal(unitShadowVisible(r,{x:10000,y:10000,hp:100}),false);
});
test('polish: stale daylight source lists are replaced before any early return; offscreen gradients are skipped',()=>{
 const r=renderer(),scene={r,light:{overlay:{glow:0}},sources:[]};r.sceneSources=[{position:[0,0,0]}];
 drawSourceSpill(scene);assert.equal(r.sceneSources,scene.sources);assert.equal(r.sceneSources.length,0);
 const outside={position:[10000,10000,1],radius:1,power:1,profile:'fire',owner:{id:1}};
 scene.sources=[outside];scene.light=light;scene.faces=[];
 drawSourceSpill(scene);assert.equal(drawPracticalBloom(scene,0).bloom,0);
 assert.equal(r.calls.filter(([k])=>k.includes('Gradient')).length,0);
 assert.equal(r.lightingStats.spillCulled,1);assert.equal(r.lightingStats.bloomCulled,1);
 assert.equal(visibleLightBudget(r),72);r.width=1200;assert.equal(visibleLightBudget(r),120);r.cam.zoom=.7;assert.equal(visibleLightBudget(r),48);
});
test('polish: phone/desktop ray and fog budgets; wet weather suppresses rays; reduced motion freezes rain and fog',()=>{
 const r=renderer();assert.equal(drawGodRays(r,light),3);r.width=1200;assert.equal(drawGodRays(r,light),5);
 for(const weatherId of ['rain','fog'])assert.equal(drawGodRays(r,{...light,weatherId}),0);
 r.width=390;assert.equal(drawGroundMist({r,light},0),4);r.width=1200;assert.equal(drawGroundMist({r,light},0),5);
 r.calm=true;r.calls.length=0;drawLayeredRain(r,100);const first=structuredClone(r.calls);r.calls.length=0;drawLayeredRain(r,99999);assert.deepEqual(r.calls,first);
 r.calls.length=0;drawGroundMist({r,light},100);const fog=structuredClone(r.calls);r.calls.length=0;drawGroundMist({r,light},99999);assert.deepEqual(r.calls,fog);
});

test('polish: mature settlement renders all four phases and weather without mutating saves',async()=>{
 const {Renderer}=await import('../src/renderer.js');const {createWorld,makeBuilding,makeUnit}=await import('../src/model.js');
 const full=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','biomes','expansion'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
 const world=createWorld(full);world.buildings=[];
 for(let i=0;i<60;i++){
  const type=['cottage','farm','mine','watchfire','storehouse'][i%5],b=makeBuilding(type,4+(i%10)*3,4+Math.floor(i/10)*3,full);
  b.remaining=0;b.harvestBonus=430;world.buildings.push(b);
 }
 world.troops=Array.from({length:150},(_,i)=>{const u=makeUnit('warrior',full);u.x=5+(i%15);u.y=5+Math.floor(i/15);return u;});
 const ctx=new Proxy({measureText:()=>({width:60})},{get:(t,k)=>k in t?t[k]:(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),k+' has finite coordinates');return k.includes('Gradient')?{addColorStop(){}}:undefined;},set:(t,k,v)=>(t[k]=v,true)});
 const r=new Renderer({getContext:()=>ctx},full,{});r.resize(390,844,1);r.cam.x=14;r.cam.y=10;r.calm=true;
 for(const elapsed of [312,390,462,540,90,840])for(const zoom of [.7,1.65]){
  world.elapsed=elapsed;r.cam.zoom=zoom;const saved=JSON.stringify(world);r.draw(world,1000);
  assert.equal(JSON.stringify(world),saved,'render never writes save data');assert.ok(r.lightingStats.shadowCache<=512);assert.ok(r.lightingStats.bloom<=72);
  if(zoom<1)assert.equal(r.lightingStats.unitShadows,0);else assert.ok(r.lightingStats.unitShadows>0);
  assert.ok(r.lightingStats.shadows>0,'building shadows remain');
 }
});
