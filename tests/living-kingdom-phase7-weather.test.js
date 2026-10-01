import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {mudMult,fogRangedMult,nightWatchMult,tickStorm,clockConfig} from '../src/systems/daynight.js';
import {tickCombat,spawnRaid} from '../src/systems/combat.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('weather: mud slows off-road, halves on trails, never on roads',()=>{
  const w=createWorld(data);w.weather='rain';
  assert.equal(mudMult(w,2.25,2.25),0.88);
  w.roads={'4,4':1};assert.equal(mudMult(w,2.25,2.25),1);
  w.weather='clear';delete w.roads['4,4'];assert.equal(mudMult(w,2.25,2.25),1);
  assert.equal(fogRangedMult({weather:'fog'},true),0.9);
});
test('weather: trails halve the mud penalty, roads still win',()=>{
  const w=createWorld(data);w.weather='rain';w.elapsed=100;
  w.trails={'4,4':[10,100]};
  assert.equal(mudMult(w,2.25,2.25),0.94);
  w.roads={'4,4':1};assert.equal(mudMult(w,2.25,2.25),1);
  w.weather='clear';assert.equal(mudMult(w,2.25,2.25),1);
});
test('weather: fog touches only ranged shot, never melee',()=>{
  assert.equal(fogRangedMult({weather:'fog'},false),1);
  assert.equal(fogRangedMult({weather:'clear'},true),1);
  assert.equal(fogRangedMult({},true),1);
});
test('weather: night watch bonus is posted-only',()=>{
  assert.equal(nightWatchMult({night:true},{defensePost:'post-1'},data),1.05);
  assert.equal(nightWatchMult({night:true},{}),1);
  assert.equal(nightWatchMult({},{defensePost:'post-1'}),1);
});
test('weather: storms strike capped, deterministic, and defaulted',()=>{
  const cfg=clockConfig(undefined);
  for (const [k,v] of [['mudOffRoad',.12],['mudTrail',.06],['fogRanged',.1],['nightWatch',.05],['stormDamage',.06],['stormInterval',120]]) assert.equal(cfg[k],v,`default ${k}`);
  const calm=createWorld(data);calm.weather='clear';calm.elapsed=1000;
  const hpBefore=calm.buildings.map(b=>b.hp);
  assert.equal(tickStorm(calm,data),null);
  assert.deepEqual(calm.buildings.map(b=>b.hp),hpBefore);
  assert.equal(calm.lastStormAt,undefined);
  // Find a striking slot: same elapsed must strike the same building.
  let slot=0;
  for (let e=120;e<20000&&!slot;e+=120){
    const probe=createWorld(data);probe.weather='rain';probe.elapsed=e;
    if (tickStorm(probe,data)) slot=e;
  }
  assert.ok(slot>0,'a storm slot exists');
  const a=createWorld(data);a.weather='rain';a.elapsed=slot;
  const b=createWorld(data);b.weather='rain';b.elapsed=slot;
  const hitA=tickStorm(a,data),hitB=tickStorm(b,data);
  assert.equal(a.lastStormAt,slot);
  assert.equal(hitA.type,hitB.type);
  assert.equal(hitA.x,hitB.x);
  assert.equal(hitA.hp,hitB.hp);
  const tier=data.buildings[hitA.type].tiers[(hitA.level||1)-1].hp;
  assert.equal(tier-hitA.hp,Math.round(tier*0.06));
  // No Math.random: repeated strikes never ruin — the cap holds at 1 hp.
  const w=createWorld(data);w.weather='rain';
  for (let e=120;e<120*400;e+=120){w.elapsed=e;tickStorm(w,data);}
  for (const bl of w.buildings) assert.ok(bl.hp>=1,'storms bruise, never ruin');
  // Missing data still reads defaults, never throws.
  const bare=createWorld(data);bare.weather='rain';bare.elapsed=slot;
  tickStorm(bare);
});
test('weather: combat ticks clean under every sky',()=>{
  for (const flags of [{},{night:true},{weather:'rain'},{weather:'fog'},{night:true,weather:'fog'}]){
    const w=createWorld(data);
    Object.assign(w,flags);
    spawnRaid(w,4,null,data,null);
    tickCombat(w,data,0.05);
    for (const e of w.enemies) assert.ok(Number.isFinite(e.hp));
    for (const t of w.troops) assert.ok(Number.isFinite(t.hp));
  }
});
