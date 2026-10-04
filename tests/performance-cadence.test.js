import test from 'node:test';
import assert from 'node:assert/strict';
import {takeCadence,resetCadence} from '../src/systems/performance.js';

test('cadence batches fixed ticks without losing elapsed time',()=>{
  const owner={};let emitted=0,fires=0;
  for(let i=0;i<20;i++){const dt=takeCadence(owner,'slow',.05,.25);if(dt){emitted+=dt;fires++;}}
  assert.equal(fires,4);
  assert.ok(Math.abs(emitted-1)<1e-9);
});

test('cadence keys are independent and resettable',()=>{
  const owner={};
  assert.equal(takeCadence(owner,'a',.2,.25),0);
  assert.equal(takeCadence(owner,'b',.25,.25),.25);
  assert.equal(takeCadence(owner,'a',.05,.25),.25);
  resetCadence(owner);
  assert.equal(takeCadence(owner,'a',.05,.25),0);
});
