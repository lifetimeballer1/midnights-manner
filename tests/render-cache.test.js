import test from 'node:test';
import assert from 'node:assert/strict';
import {insideWorkplace} from '../src/systems/villagers.js';

test('insideWorkplace accepts a frame building index without rescanning world buildings',()=>{
 const b={id:'shop',type:'forge',x:4,y:4,hp:10,remaining:0};
 const unit={id:'u',type:'smith',x:4.5,y:4.5,hp:10,workplace:'shop'};
 const world={buildings:[]};
 const data={troops:{smith:{role:'worker'}},buildings:{forge:{size:1}}};
 assert.equal(insideWorkplace(world,data,unit,new Map([['shop',b]])),true);
 assert.equal(insideWorkplace(world,data,unit),false);
});
