import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,center} from '../src/model.js';
import {nextStep,move,movementMetrics} from '../src/systems/pathfinding.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])
));

test('friendly path reaches Manor Hall from a far map corner',()=>{
 const w=createWorld(data);
 const hall=w.buildings.find(b=>b.type==='hall');
 assert.ok(hall,'starting world has a Manor Hall');
 const goal=center(hall,data);
 const far={x:.5,y:data.world.height-1.5};
 const step=nextStep(w,data,far,goal,1.6,false,true);
 assert.ok(step,'friendly unit finds a step toward the hall from far away');
 assert.ok(
  Math.hypot(step.x-goal.x,step.y-goal.y)<Math.hypot(far.x-goal.x,far.y-goal.y),
  'step closes the distance to the hall'
 );
});

test('friendly worker walks home even when non-wall buildings crowd the map',()=>{
 const w=createWorld(data);
 const hall=w.buildings.find(b=>b.type==='hall');
 const goal=center(hall,data);
 // Pack farms around the hall so the strict solid grid is nearly full.
 for(let x=0;x<data.world.width;x+=2){
  for(let y=0;y<data.world.height;y+=2){
   if(x>=hall.x-1&&x<=hall.x+2&&y>=hall.y-1&&y<=hall.y+2)continue;
   if(w.buildings.some(b=>Math.abs(b.x-x)<2&&Math.abs(b.y-y)<2))continue;
   w.buildings.push(makeBuilding('farm',x,y,data));
  }
 }
 const u={x:.5,y:.5};
 let reached=false;
 for(let i=0;i<6000&&!reached;i++){
  reached=move(w,data,u,goal,2.5,.25,1.6,false,true);
 }
 assert.ok(reached,'worker reaches the Manor Hall from the far side of a dense village');
});

test('enemy routing still respects closed gates (passGates false)',()=>{
 const narrow={...data,world:{...data.world,width:8,height:1}};
 const w=createWorld(narrow);
 w.buildings=[];
 w.buildings.push(makeBuilding('gate',3,0,narrow));
 const u={x:.5,y:.5},target={x:7.5,y:.5};
 assert.equal(nextStep(w,narrow,u,target,.1,false,false),null,'enemies cannot pass a closed gate corridor');
 assert.ok(nextStep(w,narrow,u,target,.1,false,true),'friendlies walk through the gate');
});


test('friendlies sharing a start cell and goal reuse one cached route search',()=>{
 const w=createWorld(data);
 const hall=w.buildings.find(b=>b.type==='hall');
 const goal=center(hall,data);
 const a={id:'route-a',x:.5,y:.5},b={id:'route-b',x:.7,y:.6};
 const before=movementMetrics(w).movementSearches;
 assert.ok(nextStep(w,data,a,goal,.2,false,true,true));
 const afterFirst=movementMetrics(w).movementSearches;
 assert.ok(afterFirst>before,'first traveler computes a route');
 assert.ok(nextStep(w,data,b,goal,.2,false,true,true));
 const afterSecond=movementMetrics(w).movementSearches;
 assert.equal(afterSecond,afterFirst,'second traveler reuses the shared route');
});
