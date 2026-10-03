import test from 'node:test';
import assert from 'node:assert/strict';
import {populationRenderBudget,selectPopulationRenderUnits} from '../src/systems/population-lod.js';

const makeUnits=n=>Array.from({length:n},(_,i)=>({
 id:'u'+i,hp:10,
 sx:20+(i%20)*16,
 sy:20+Math.floor(i/20)*16,
}));

test('large phone crowds keep a bounded representative set',()=>{
 const units=makeUnits(400);
 const picked=selectPopulationRenderUnits(units,{
  width:390,height:844,zoom:1,
  project:u=>({x:u.sx,y:u.sy}),
 });
 assert.equal(populationRenderBudget(390,1,400),72);
 assert.equal(picked.units.length,72);
 assert.equal(picked.stats.onScreen,400);
 assert.equal(picked.stats.virtualized,328);
});

test('selected and important villagers survive crowd virtualization',()=>{
 const units=makeUnits(400);
 const selected=units[399],fighter=units[398];
 const picked=selectPopulationRenderUnits(units,{
  width:390,height:844,zoom:1,selectedId:selected.id,
  project:u=>({x:u.sx,y:u.sy}),
  important:u=>u.id===fighter.id,
 });
 assert.ok(picked.units.includes(selected));
 assert.ok(picked.units.includes(fighter));
 assert.equal(picked.units.length,72);
});

test('small populations render one-for-one and offscreen bodies cost nothing',()=>{
 const units=makeUnits(80);
 units[79].sx=5000;
 const picked=selectPopulationRenderUnits(units,{
  width:390,height:844,zoom:1,
  project:u=>({x:u.sx,y:u.sy}),
 });
 assert.equal(picked.stats.onScreen,79);
 assert.equal(picked.units.length,79);
 assert.equal(picked.stats.virtualized,0);
});
