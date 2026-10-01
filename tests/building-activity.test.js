import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildingActivityState,hearthSmokeFor,drawBuildingActivity} from '../src/building-activity.js';
import {civicCueFor} from '../src/source-lighting.js';

const buildings=JSON.parse(await readFile(new URL('../data/buildings.json',import.meta.url)));

function world(building,troops=[]){return {buildings:[building],troops,resources:{wood:999,food:999,gold:999}};}

test('activity: passive producers work until their on-site reserve is full',()=>{
 const b={id:'farm-a',type:'farm',level:1,hp:100,remaining:0,harvestBonus:0};
 assert.equal(buildingActivityState(b,buildings.farm,world(b)).producer,true);
 assert.equal(buildingActivityState({...b,harvestBonus:500},buildings.farm,world({...b,harvestBonus:500})).active,false);
});

test('activity: staffed workshops wake only for an available posted worker',()=>{
 const b={id:'forge-a',type:'forge',level:1,hp:100,remaining:0};
 const worker={id:'smith',hp:100,workplace:b.id,order:null,emergency:null,expedition:null};
 assert.equal(buildingActivityState(b,buildings.forge,world(b,[worker])).workplace,true);
 assert.equal(buildingActivityState(b,buildings.forge,world(b,[{...worker,order:{kind:'move'}}])).active,false);
 assert.equal(buildingActivityState(b,buildings.forge,world(b,[{...worker,emergency:{kind:'repair'}}])).active,false);
});

test('activity: unfinished and ruined structures never animate',()=>{
 const base={id:'mine-a',type:'mine',level:1,hp:100,remaining:0,harvestBonus:0};
 assert.equal(buildingActivityState({...base,remaining:4},buildings.mine,world({...base,remaining:4})).active,false);
 assert.equal(buildingActivityState({...base,hp:0},buildings.mine,world({...base,hp:0})).active,false);
});

test('activity: occupied homes breathe chimney smoke scaled by hearth size',()=>{
  const cottage={id:'c',type:'cottage',level:2,hp:100,remaining:0};
  const hall={id:'h',type:'hall',level:3,hp:100,remaining:0};
  const longhouse={id:'l',type:'longhouse',level:4,hp:100,remaining:0};
  assert.equal(hearthSmokeFor({...cottage,level:1},buildings.cottage),0,'chimneyless cabins stay clear');
  assert.ok(hearthSmokeFor(cottage,buildings.cottage)>0,'cottages smoke lightly');
  assert.ok(hearthSmokeFor(longhouse,buildings.longhouse)>hearthSmokeFor(hall,buildings.hall),'the meadhall out-smokes the manor');
  assert.equal(hearthSmokeFor({...cottage,hp:0},buildings.cottage),0,'ruins go cold');
  assert.equal(hearthSmokeFor({...cottage,remaining:5},buildings.cottage),0,'scaffolds go cold');
  assert.equal(hearthSmokeFor({id:'f',type:'farm',level:3,hp:100,remaining:0},buildings.farm),0,'chimneys belong to homes, not fields');
});

test('activity: autonomous stocking can drive a work state without a posted crew',()=>{
 const b={id:'fletcher-a',type:'fletcher',level:1,hp:100,remaining:0,stock:0};
 assert.equal(buildingActivityState(b,buildings.fletcher,world(b)).stocking,true);
 assert.equal(buildingActivityState({...b,stock:1},buildings.fletcher,world({...b,stock:1})).active,false);
});

const CIVIC_TYPES=['manner-citadel','grand-watchtower','stone-road','city-wall','forge-quarter','lantern-rows'];

test('activity (V2): finished great works read as civic work without a posted crew',()=>{
 for(const type of CIVIC_TYPES){
  const b={id:`${type}-a`,type,x:5,y:5,level:4,hp:100,remaining:0};
  const st=buildingActivityState(b,buildings[type],world(b));
  assert.equal(st.civic,true,`${type} flags civic`);
  assert.equal(st.active,true,`${type} cues while lived in`);
  assert.equal(st.producer,false,`${type} holds no reserve`);
  assert.equal(st.workplace,false,`${type} posts no crew`);
 }
 assert.equal(buildingActivityState({id:'f',type:'farm',level:1,hp:100,remaining:0,harvestBonus:0},buildings.farm,world({id:'f',type:'farm',level:1,hp:100,remaining:0,harvestBonus:0})).civic,false,'fields stay non-civic');
});

test('activity (V2): unfinished and ruined great works stay quiet',()=>{
 for(const type of CIVIC_TYPES){
  const base={id:`${type}-q`,type,x:5,y:5,level:4,hp:100,remaining:0};
  assert.equal(buildingActivityState({...base,remaining:4},buildings[type],world({...base,remaining:4})).active,false,`${type} scaffold stays dark`);
  assert.equal(buildingActivityState({...base,hp:0},buildings[type],world({...base,hp:0})).active,false,`${type} ruin stays dark`);
 }
});

test('activity (V2): every civic type has a distinct light identity on a real motion channel',()=>{
 const seen=new Set();
 for(const type of CIVIC_TYPES){
  const cue=civicCueFor(type);
  assert.ok(cue,`${type} has a cue`);
  assert.match(cue.light,/^\d{1,3},\d{1,3},\d{1,3}$/,`${type} glows rgb`);
  assert.ok(['rustle','creak','cart','door','bellows','oven'].includes(cue.channel),`${type} rides a real work clock`);
  seen.add(cue.light);
 }
 assert.equal(seen.size,CIVIC_TYPES.length,'no two great works share a glow');
 assert.equal(civicCueFor('farm'),null,'fields keep no civic cue');
});

test('activity (V2): great-work stacks smoke only from real geometry, never hearth data',()=>{
 for(const type of CIVIC_TYPES)
  assert.equal(hearthSmokeFor({id:'x',type,x:5,y:5,level:6,hp:100,remaining:0},buildings[type]),0,`${type} adds no hearth smoke`);
});

function mockRig(overrides={}){
 const calls=[];
 const ctx=new Proxy({},{get:(t,k)=>k==='__calls'?calls:(...a)=>{calls.push([k,...a]);},set:(t,k,v)=>(t[k]=v,true)});
 const r={ctx,calls,data:{buildings},cam:{zoom:1.8},calm:false,width:1280,height:900,project:(x,y,z=0)=>({x:x*40+400,y:y*20-z*30+300}),...overrides};
 return r;
}

test('activity (V2): cues draw for lived-in great works, skip ruins/scaffolds, never mutate',()=>{
 const done={id:'citadel-a',type:'manner-citadel',x:5,y:5,level:4,hp:100,remaining:0};
 const ruin={id:'watch-a',type:'grand-watchtower',x:9,y:9,level:4,hp:0,remaining:0};
 const scaffold={id:'road-a',type:'stone-road',x:12,y:12,level:4,hp:100,remaining:4};
 const w={buildings:[done,ruin,scaffold],troops:[]},before=structuredClone(w);
 const r=mockRig();
 drawBuildingActivity(r,w,1000);
 assert.ok(r.calls.some(([k])=>k==='fill'||k==='fillRect'),'citadel pennant draws');
 assert.deepEqual(w,before,'cue drawing never writes sim state');
 r.calls.length=0;
 drawBuildingActivity(r,{buildings:[ruin,scaffold],troops:[]},1000);
 assert.ok(!r.calls.some(([k])=>k==='fill'||k==='fillRect'),'ruins and scaffolds draw no cue');
});

test('activity (V2): cues cost one bounded pass and freeze for calm and far zoom',()=>{
 const many={buildings:Array.from({length:20},(_,i)=>({id:`lamp-${i}`,type:'lantern-rows',x:2+i,y:3,level:6,hp:100,remaining:0})),troops:[{id:'u',hp:100,workplace:'lamp-0'}]};
 const r=mockRig();
 drawBuildingActivity(r,many,1000);
 assert.equal(r.calls.filter(([k])=>k==='fillRect').length,8,'civic cues cap at eight markers');
 r.calls.length=0;
 const still=mockRig({calm:true});
 drawBuildingActivity(still,many,1000);
 assert.equal(still.calls.length,0,'calm freezes every cue');
 const far=mockRig();far.cam.zoom=.8;
 drawBuildingActivity(far,many,1000);
 assert.equal(far.calls.length,0,'distant zoom draws no cue');
});
