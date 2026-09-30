import test from 'node:test';
import assert from 'node:assert/strict';
import {CINEMATIC_LIMITS,shadowCasters,projectShadow,blockedLight,visibleEmitter,drawPracticalBloom,prepareNearbyLight} from '../src/cinematic-lighting.js';
const r={cam:{zoom:1.65},width:400,height:300,calm:true,project:(x,y,z=0)=>({x:x*30+100,y:y*20+100-z*25})};
const square=(id,emissive=0)=>({owner:{id},alpha:1,emissive,points:[{x:90,y:90},{x:120,y:90},{x:120,y:120},{x:90,y:120}]});
test('celestial shadows follow key direction, stretch at low altitude and leave input intact',()=>{
 const caster={points:[[0,0,0],[1,1,2],[1,0,2],[0,1,0]]},before=structuredClone(caster);
 const east=projectShadow(r,caster,{keyDir:[1,0,.4]}),west=projectShadow(r,caster,{keyDir:[-1,0,.4]});
 assert.ok(Math.min(...east.map(p=>p.x))<100);assert.ok(Math.max(...west.map(p=>p.x))>130);
 assert.deepEqual(caster,before);
 const faces=[{alpha:1,fixture:false,owner:{id:1},center:[0,0,1],vertices:[[0,0,0],[1,1,2]]}];
 assert.equal(shadowCasters(faces).length,1);
 assert.equal(shadowCasters([{...faces[0],alpha:.5}]).length,0,'ghosts never cast shadows');
});
test('practical bloom requires a visible emissive surface and respects foreground occlusion',()=>{
 const source={position:[0,0,0],owner:{id:'home'}};
 assert.ok(visibleEmitter(source,[square('home',1)],r));
 assert.equal(visibleEmitter(source,[square('home',1),square('front-house')],r),null);
 assert.equal(visibleEmitter(source,[square('home')],r),null,'unlit walls cannot bloom');
 assert.equal(visibleEmitter({...source,position:[900,900,0]},[],r),null);
});
test('neighbor fire wash is blocked by intervening structures and never crosses interior walls',()=>{
 const data={buildings:{wall:{size:1}}},b={id:'wall',type:'wall',x:1,y:0,hp:10,remaining:0};
 assert.equal(blockedLight([0,.5,.5],[3,.5,.5],[b],data),true);
 assert.equal(blockedLight([0,2,.5],[3,2,.5],[b],data),false);
 assert.equal(blockedLight([0,.5,.5],[3,.5,.5],[{...b,hp:0}],data),false);
 const f={owner:{id:'house'},center:[.6,.5,.5],normal:[-1,0,0],localLight:0};
 const source={owner:{id:'fire'},position:[0,.5,.5],power:1,radius:2,profile:'fire'};
 const scene={r:{data},sources:[source],faces:[f]};
 prepareNearbyLight(scene,{buildings:[]});assert.ok(f.localLight>0&&f.localLight<=.24);
 f.localLight=0;prepareNearbyLight(scene,{buildings:[{...b,x:.2}]});assert.equal(f.localLight,0);
});
test('effect budgets are bounded and Calm retains bloom without moving embers',()=>{
 let gradients=0;
 const ctx=new Proxy({}, {get:(t,k)=>t[k]||(()=>k.includes('Gradient')?(gradients++,{addColorStop(){}}):undefined),set:(t,k,v)=>(t[k]=v,true)});
 const source={position:[0,0,0],owner:{id:'home'},profile:'fire',power:1,radius:1};
 const scene={r:{...r,ctx},light:{overlay:{glow:1}},faces:[square('home',1)],sources:Array(100).fill(source)};
 assert.deepEqual(drawPracticalBloom(scene,2000),{bloom:CINEMATIC_LIMITS.bloom,embers:0});
 assert.equal(gradients,CINEMATIC_LIMITS.bloom);
 scene.r.calm=false;assert.equal(drawPracticalBloom(scene,2000).embers,CINEMATIC_LIMITS.embers);
 scene.r.cam={zoom:.7};assert.deepEqual(drawPracticalBloom(scene,2000),{bloom:0,embers:0});
});
