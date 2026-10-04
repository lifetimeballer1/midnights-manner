import test from 'node:test';
import assert from 'node:assert/strict';
import {attachQuality,defaultQualityFor,qualityPreset} from '../src/fx/quality.js';

test('mobile defaults to medium quality while desktop stays high',()=>{
  assert.equal(defaultQualityFor(390,true),'Med');
  assert.equal(defaultQualityFor(650,false),'Med');
  assert.equal(defaultQualityFor(1200,false),'High');
});

test('quality change reapplies DPR cap immediately',()=>{
  const calls=[];
  const renderer={width:390,height:844,dpr:2,staticLayer:{},staticKey:'x',_meshStatic:{},_trailStatic:{},_pendingStaticKey:'x',
    resize(w,h,dpr){calls.push([w,h,dpr]);this.dpr=Math.min(dpr,this.qualityCfg.dprCap);}
  };
  attachQuality(renderer);
  renderer.setQuality('Low');
  assert.equal(renderer.quality,'Low');
  assert.equal(renderer.qualityCfg.dprCap,qualityPreset('Low').dprCap);
  assert.equal(calls.length,1);
  assert.equal(renderer.dpr,1);
});
