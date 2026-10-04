import test from 'node:test';
import assert from 'node:assert/strict';
import {qualityPreset} from '../src/fx/quality.js';
import {visibleLightBudget} from '../src/source-lighting.js';

test('mobile quality presets reduce expensive presentation budgets',()=>{
 const low=qualityPreset('Low'),med=qualityPreset('Med'),high=qualityPreset('High');
 for(const key of ['lightCap','shadowCap','mistCap','emberCap','chimneyCap','rayCap','trailCap','smokeCap','rainCap','glintCap','cloudCap']){
  assert.ok(low[key] <= med[key], key+' low <= med');
  assert.ok(med[key] <= high[key], key+' med <= high');
 }
 assert.equal(high.shadowCap,180);
 assert.equal(high.lightCap,120);
});

test('light budget respects quality without exceeding legacy view caps',()=>{
 const r={cam:{zoom:1.4},width:390,height:844,qualityCfg:qualityPreset('Med')};
 assert.equal(visibleLightBudget(r),36);
 r.qualityCfg=qualityPreset('Low');
 assert.equal(visibleLightBudget(r),18);
 r.qualityCfg=qualityPreset('High');
 assert.equal(visibleLightBudget(r),72);
});
