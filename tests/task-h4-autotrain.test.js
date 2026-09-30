import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {UI} from '../src/ui.js';
import {createWorld,makeUnit,makeBuilding,stats} from '../src/model.js';
import {save,load,exportSave,importSaveBlob} from '../src/storage.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','expansion']
 .map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const state=()=>({world:createWorld(data),home:null,mission:null,completed:[],unlocks:[],xp:0,vlevel:1,questsCompleted:[]});
function game(){
 const g=Object.create(Game.prototype);
 Object.assign(g,{data,state:state(),paused:false,dirty:false,message:'Unchanged',saveTimer:0});
 g.world.autoTrain=true;
 g.world.troops=[makeUnit('warrior',data)];
 g.world.resources={wood:100000,food:100000,gold:100000};
 return g;
}

test('H4: fresh games default off; toggle persists and starts a fresh interval',()=>{
 const previous=globalThis.localStorage;
 const store=new Map();
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 try{
  const g=new Game(data);
  assert.equal(g.world.autoTrain,false);
  g.autoTrainTimer=4;
  g.toggleAutoTrain();
  assert.equal(g.world.autoTrain,true);
  assert.equal(g.autoTrainTimer,0);
  assert.equal(new Game(data).world.autoTrain,true);
  g.toggleAutoTrain();
  assert.equal(new Game(data).world.autoTrain,false);
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});

test('H4: local load and import default old/malformed fields off in both worlds',()=>{
 for(const value of [undefined,'on',1,null]){
  const s=state();s.home=createWorld(data);
  s.world.autoTrain=value;s.home.autoTrain=value;
  const before=structuredClone(s.world.resources);
  save(s);
  const local=load(data),imported=importSaveBlob(exportSave(s),data);
  assert.equal(imported.ok,true);
  for(const restored of [local,imported.state]){
   assert.equal(restored.world.autoTrain,false);
   assert.equal(restored.home.autoTrain,false);
   assert.deepEqual(restored.world.resources,before);
  }
 }
 const s=state();s.world.autoTrain=true;s.home=createWorld(data);s.home.autoTrain=true;
 const restored=importSaveBlob(exportSave(s),data).state;
 assert.equal(restored.world.autoTrain,true);
 assert.equal(restored.home.autoTrain,true);
});

test('H4: automatic payment and HP match manual levels, curve and positional tutoring exactly',()=>{
 const teaching=Object.keys(data.buildings).find(k=>data.buildings[k].tutorDiscount);
 for(const level of [1,4,5,9])for(const postState of ['none','ready','building','ruin']){
  const manual=game(),auto=game();
  manual.world.troops[0].level=level;
  if(postState!=='none'){
   const post=makeBuilding(teaching,6,6,data);
   post.remaining=postState==='building'?10:0;post.hp=postState==='ruin'?0:100;
   manual.world.buildings=[post];manual.world.troops[0].workplace=post.id;
  }
  auto.state=structuredClone(manual.state);
  manual.level(manual.world.troops[0].id);
  auto.tickAutoTrain(5);
  assert.deepEqual(auto.world.resources,manual.world.resources,`${level}/${postState}`);
  assert.deepEqual(auto.world.troops,manual.world.troops);
  assert.equal(auto.world.troops[0].hp,stats(auto.world.troops[0],data).hp);
  assert.equal(auto.message,'Unchanged');
  assert.match(manual.message,/Level/);
  assert.equal(auto.dirty,true);
 }
});

test('H4: a pass calls Game.level in roster order once per non-max troop',()=>{
 const g=game();g.world.troops=[makeUnit('warrior',data),makeUnit('archer',data),makeUnit('warrior',data)];
 g.world.troops[1].level=data.troops.archer.maxLevel;
 const calls=[],original=g.level;
 g.level=function(id,options){calls.push(id);return original.call(this,id,options);};
 g.tickAutoTrain(5);
 assert.deepEqual(calls,[g.world.troops[0].id,g.world.troops[2].id]);
 assert.deepEqual(g.world.troops.map(u=>u.level),[2,data.troops.archer.maxLevel,2]);
});

test('H4: unaffordable troops spend nothing and later cheaper troops still train silently',()=>{
 const g=game();const expensive=g.world.troops[0];expensive.level=5;
 const cheap=makeUnit('warrior',data);g.world.troops.push(cheap);
 g.world.resources={wood:0,...data.troops.warrior.levelCost};
 g.notify=()=>assert.fail('automatic training must stay silent');
 g.tickAutoTrain(5);
 assert.equal(expensive.level,5);assert.equal(cheap.level,2);
 for(const k of Object.keys(data.troops.warrior.levelCost))assert.equal(g.world.resources[k],0);
 g.tickAutoTrain(5);
 assert.equal(cheap.level,2);
});

test('H4: training never draws pending rewards, collector cargo or on-site reserves',()=>{
 for(const affordable of [false,true]){
  const g=game();
  g.world.pendingRewards={food:10000,gold:10000};
  g.world.troops[0].carry=1000;
  g.world.buildings[0].harvestBonus=1000;
  if(!affordable)g.world.resources={wood:0,food:0,gold:0};
  const rewards=structuredClone(g.world.pendingRewards),sites=structuredClone(g.world.buildings);
  g.tickAutoTrain(5);
  assert.equal(g.world.troops[0].level,affordable?2:1);
  assert.deepEqual(g.world.pendingRewards,rewards);
  assert.deepEqual(g.world.buildings,sites);
  assert.equal(g.world.troops[0].carry,1000);
 }
});

test('H4: real sim hook runs every five active home seconds, excluding pause and expeditions',()=>{
 const g=game();g.checkCalendar=()=>{};g.tickClock=()=>{};g.persist=()=>{};
 const calls=[];g.level=id=>calls.push(id);
 for(let i=0;i<99;i++)g.tick(.05);
 assert.equal(calls.length,0);
 g.paused=true;g.tick(60);assert.equal(calls.length,0);
 g.paused=false;g.state.mission={status:'won'};g.tick(60);assert.equal(calls.length,0);
 g.state.mission={status:'active'};g.tickAutoTrain(60);assert.equal(calls.length,0);
 g.state.mission=null;g.tick(.05);assert.equal(calls.length,1);
 for(let i=0;i<100;i++)g.tick(.05);
 assert.equal(calls.length,2);
 g.world.autoTrain=false;g.tick(5);assert.equal(calls.length,2);
});

test('H4: manual refusal and ability-level notifications remain unchanged',()=>{
 const g=game();g.world.resources={wood:0,food:0,gold:0};
 g.level(g.world.troops[0].id);
 assert.equal(g.message,'Not enough food or gold to train.');
 g.world.resources={wood:1000,food:1000,gold:1000};g.world.troops[0].level=4;
 g.level(g.world.troops[0].id);
 assert.equal(g.message,'Level 5 reached — new ability unlocked!');
});

test('H4: People toggle renders off/on, pressed state, 44px target and expedition gate',()=>{
 const g=game();g.world.troops=[];
 let html='';const ui={game:g,category:'all',search:'',setPanelHTML:s=>{html=s;}};
 for(const enabled of [false,true]){
  g.world.autoTrain=enabled;UI.prototype.renderTroops.call(ui);
  assert.match(html,new RegExp(`aria-pressed="${enabled}"`));
  assert.match(html,new RegExp(`Auto-train: ${enabled?'on':'off'}`));
  assert.match(html,/data-autotrain[^>]*min-height:44px/);
 }
 g.state.mission={status:'active'};UI.prototype.renderTroops.call(ui);
 assert.match(html,/data-autotrain[^>]*disabled/);
 g.toggleAutoTrain();assert.equal(g.world.autoTrain,true,'mission toggle cannot change home preferences');
});
