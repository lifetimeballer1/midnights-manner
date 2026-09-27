import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding} from '../src/model.js';
import {tickEconomy} from '../src/systems/economy.js';
import {reserveReady,reserveCollectible,reserveNotifyAt} from '../src/resources.js';
import {sfx} from '../src/systems/audio.js';
import {Game} from '../src/game.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function muteCollect(){let n=0;const orig=sfx.collect;sfx.collect=()=>{n++;};return {calls:()=>n,restore:()=>{sfx.collect=orig;}};}
function farmWorld(){const w=createWorld(data);w.troops=[];return w;}

test('passive ticks pile output on the building: pool flat, no floaters, no ding',()=>{
 const w=farmWorld();const farm=w.buildings.find(b=>b.type==='farm');
 const pool=w.resources.food,fx=w.effects.length;
 const sfxTap=muteCollect();
 try{for(let i=0;i<100;i++)tickEconomy(w,data,.05);}finally{sfxTap.restore();}
 assert.equal(w.resources.food,pool,'nothing drips into the pool');
 assert.ok((farm.harvestBonus||0)>0,'output accumulated on the building');
 assert.equal(w.effects.length,fx,'no passive floaters');
 assert.equal(sfxTap.calls(),0,'no passive ding');
});

test('reserves stop at the data-driven capacity',()=>{
 const w=farmWorld();const farm=w.buildings.find(b=>b.type==='farm');
 const cap=data.buildings.farm.harvest.capacity;
 farm.harvestBonus=cap-0.1;
 for(let i=0;i<1200;i++)tickEconomy(w,data,.05);
 assert.ok(farm.harvestBonus<=cap,`reserve ${farm.harvestBonus} respects cap ${cap}`);
 assert.ok(farm.harvestBonus>=cap-1,'a full reserve stays full');
});

test('manual harvest pays pool and gathered with one floater and one ding, then empties',()=>{
 const g=new Game(data);const b=g.world.buildings.find(b=>b.type==='farm');
 b.harvestBonus=11.5;const stock=g.world.resources.food,got=g.world.gathered.food,fx=g.world.effects.length;
 const sfxTap=muteCollect();
 let paid;try{paid=g.harvest(b.id);}finally{sfxTap.restore();}
 assert.equal(paid,11);
 assert.equal(g.world.resources.food,stock+11,'pool paid');
 assert.equal(g.world.gathered.food,got+11,'counts toward objectives and quests');
 assert.equal(g.world.effects.length,fx+1,'exactly one floater');
 assert.equal(g.world.effects.at(-1).text,'+11 Food');
 assert.equal(sfxTap.calls(),1,'exactly one ding');
 assert.ok((b.harvestBonus||0)<1,'reserve emptied');
 const sfxTap2=muteCollect();
 try{assert.equal(g.harvest(b.id),false,'empty reserve cannot be claimed twice');}finally{sfxTap2.restore();}
 assert.equal(sfxTap2.calls(),0,'no ding on an empty tap');
});

test('ready badge waits for the data-driven threshold, taps still sweep drips',()=>{
 const spec=data.buildings.farm;
 const at=reserveNotifyAt(spec);
 assert.equal(at,spec.harvest.notifyAt,'threshold reads straight from buildings.json');
 const ready=makeBuilding('farm',2,2,data);
 assert.equal(reserveReady({...ready,harvestBonus:0},spec),false,'empty shows no badge');
 assert.equal(reserveReady({...ready,harvestBonus:at-1},spec),false,'drips below notifyAt show no badge and no bubble');
 assert.equal(reserveReady({...ready,harvestBonus:at},spec),true,'a reserve at notifyAt earns its badge');
 assert.equal(reserveReady({...ready,harvestBonus:at,remaining:3},spec),false,'construction is not announced');
 assert.equal(reserveReady({...ready,harvestBonus:at,hp:0},spec),false,'ruins are not announced');
 assert.equal(reserveReady({...ready,harvestBonus:at},data.buildings.hall),false,'the manor holds no reserve');
 // Taps ignore the threshold: whatever is banked can always be collected.
 assert.equal(reserveCollectible({...ready,harvestBonus:at-1},spec),true,'drips stay collectible');
 assert.equal(reserveCollectible({...ready,harvestBonus:0.9},spec),false,'fractions wait');
 const g=new Game(data);const b=g.world.buildings.find(b=>b.type==='farm');
 b.harvestBonus=at-1;const stock=g.world.resources.food;
 assert.equal(g.harvest(b.id),at-1,'a below-threshold tap still pays in full');
 assert.equal(g.world.resources.food,stock+at-1);
});

test('reserveNotifyAt falls back to a quarter of the cap without code',()=>{
 assert.equal(reserveNotifyAt({production:'food',harvest:{capacity:40}}),10);
 assert.equal(reserveNotifyAt({production:'food',harvest:{capacity:40,notifyAt:3}}),3,'per-building override wins');
 assert.equal(reserveNotifyAt({production:'food'}),10,'missing harvest block still silences drips');
});

test('reserve fill stays quiet; only manual collection chimes',()=>{
 const g=new Game(data);g.world.troops=[];const farms=g.world.buildings.filter(b=>data.buildings[b.type].production);for(const b of farms)b.harvestBonus=(data.buildings[b.type].harvest?.capacity??40)-.001;
 const sound=muteCollect();try{
  tickEconomy(g.world,data,.05);assert.equal(sound.calls(),0,'filling to capacity never chimes');
  for(let i=0;i<40;i++)tickEconomy(g.world,data,.05);assert.equal(sound.calls(),0,'full reserves stay quiet');
  g.harvest(farms[0].id);assert.equal(sound.calls(),1,'manual collection chimes once');
  farms[0].harvestBonus=data.buildings[farms[0].type].harvest.capacity-.001;tickEconomy(g.world,data,.05);assert.equal(sound.calls(),1,'refill does not chime');
 }finally{sound.restore();}
});
