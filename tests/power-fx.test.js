import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleLightBudget} from '../src/source-lighting.js';

test('source lighting obeys quality power budget',()=>{
  const base={cam:{zoom:1.2},width:390,height:844};
  assert.equal(visibleLightBudget({...base,qualityCfg:{lightCap:16}}),16);
  assert.equal(visibleLightBudget({...base,qualityCfg:{lightCap:28}}),28);
  assert.equal(visibleLightBudget({...base,qualityCfg:{lightCap:40}}),40);
});

test('source lighting keeps legacy budget without a quality profile',()=>{
  assert.equal(visibleLightBudget({cam:{zoom:1.2},width:390,height:844}),72);
});
