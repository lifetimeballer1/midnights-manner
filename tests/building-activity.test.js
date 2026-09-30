import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildingActivityState,hearthSmokeFor} from '../src/building-activity.js';

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
