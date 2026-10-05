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


test('battery saver forces low quality and restores the preferred profile',()=>{
  const oldStorage=globalThis.localStorage;
  const values=new Map([['midnights-manner-quality','High']]);
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};
  try{
    const renderer={width:390,height:844,dpr:2,resize(w,h,dpr){this.dpr=Math.min(dpr,this.qualityCfg.dprCap);}};
    attachQuality(renderer);
    assert.equal(renderer.quality,'High');
    renderer.setPowerSaver(true);
    assert.equal(renderer.powerSaver,true);
    assert.equal(renderer.quality,'Low');
    assert.equal(renderer.dpr,1);
    assert.equal(values.get('midnights-manner-battery'),'on');
    renderer.setPowerSaver(false);
    assert.equal(renderer.powerSaver,false);
    assert.equal(renderer.quality,'High');
    assert.equal(values.get('midnights-manner-battery'),'off');
  }finally{
    if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;
  }
});

test('persisted battery saver boots directly into low quality',()=>{
  const oldStorage=globalThis.localStorage;
  const values=new Map([['midnights-manner-quality','High'],['midnights-manner-battery','on']]);
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};
  try{
    const renderer={width:390,height:844,dpr:2};
    attachQuality(renderer);
    assert.equal(renderer.powerSaver,true);
    assert.equal(renderer.quality,'Low');
  }finally{
    if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;
  }
});
