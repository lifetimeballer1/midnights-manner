import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding} from '../src/model.js';
import {claimRegion,regionById} from '../src/systems/expansion.js';
import {ATMOSPHERE_LIMITS,trailActors,smokeSources,drawAtmosphere} from '../src/atmosphere-art.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','expansion','biomes'].map(async n=>[
  n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))
 ])
));

test('atmosphere: hard caps stay intentionally small for mobile',()=>{
 assert.deepEqual(ATMOSPHERE_LIMITS,{smokeSources:8,trailActors:12,rainSplashes:14});
});

test('atmosphere: smoke sources include finished village chimneys and visible wild camps only',()=>{
 const d=structuredClone(data),w=createWorld(d);
 w.wave=5;
 const cottage=makeBuilding('cottage',8,8,d);cottage.remaining=0;w.buildings.push(cottage);
 let sources=smokeSources(w,d);
 assert.ok(sources.some(s=>s.id===cottage.id&&s.type==='building'),'cottage chimney contributes ambient smoke');
 assert.ok(sources.some(s=>s.type==='camp'),'eligible wild faction camp contributes smoke');
 claimRegion(w,regionById(d.expansion,'whisperwood'));
 sources=smokeSources(w,d);
 assert.equal(sources.some(s=>s.id==='thornband-whisper'),false,'claimed-region camp smoke disappears');
 assert.ok(sources.length<=ATMOSPHERE_LIMITS.smokeSources);
});

test('atmosphere: trails follow orders, expeditions and enemy targets without confusing people for buildings',()=>{
 const d=structuredClone(data),w=createWorld(d);
 const mover=w.troops[0],ranger=w.troops[1],target=w.troops[2];
 mover.order={kind:'move',x:mover.x+2,y:mover.y+1};
 ranger.expedition={phase:'out',entryX:ranger.x+3,entryY:ranger.y+2};
 const enemy={id:'e1',x:target.x+2,y:target.y,hp:50,targetId:target.id,role:'raider'};
 w.enemies=[enemy];
 const trails=trailActors(w,d);
 assert.ok(trails.some(t=>t.actor.id===mover.id&&t.target.x===mover.order.x));
 assert.ok(trails.some(t=>t.actor.id===ranger.id&&t.target.x===ranger.expedition.entryX));
 const foe=trails.find(t=>t.actor.id==='e1');
 assert.deepEqual(foe.target,{x:target.x,y:target.y},'enemy can trail toward a troop target');
 assert.ok(trails.length<=ATMOSPHERE_LIMITS.trailActors);
});

test('atmosphere: Calm and distant zoom suppress every cue; rain stays capped when active',()=>{
 const d=structuredClone(data),w=createWorld(d);w.wave=5;
 w.troops[0].order={kind:'move',x:w.troops[0].x+2,y:w.troops[0].y};
 const ctx=new Proxy({}, {get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
 const base={ctx,data:d,cam:{zoom:1.8},calm:true,project:(x,y,z=0)=>({x:x*12-y*4,y:y*7-z*14})};
 assert.deepEqual(drawAtmosphere(base,w,1200,{streaks:true}),{smoke:0,trails:0,rain:0});
 base.calm=false;base.cam.zoom=.8;
 assert.deepEqual(drawAtmosphere(base,w,1200,{streaks:true}),{smoke:0,trails:0,rain:0});
 base.cam.zoom=1.8;
 const counts=drawAtmosphere(base,w,1200,{streaks:true});
 assert.ok(counts.smoke>0&&counts.smoke<=ATMOSPHERE_LIMITS.smokeSources);
 assert.ok(counts.trails>0&&counts.trails<=ATMOSPHERE_LIMITS.trailActors);
 assert.equal(counts.rain,ATMOSPHERE_LIMITS.rainSplashes);
});

test('atmosphere: drawing presentation never mutates the simulation world',()=>{
 const d=structuredClone(data),w=createWorld(d);
 w.troops[0].order={kind:'move',x:w.troops[0].x+1,y:w.troops[0].y+1};
 const before=structuredClone(w);
 const ctx=new Proxy({}, {get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
 const r={ctx,data:d,cam:{zoom:1.8},calm:false,project:(x,y,z=0)=>({x:x*10,y:y*6-z*10})};
 drawAtmosphere(r,w,2400,{streaks:false});
 assert.deepEqual(w,before);
});
