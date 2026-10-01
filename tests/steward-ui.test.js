import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld} from '../src/model.js';
import {refreshSteward} from '../src/systems/steward.js';
import {stewardStores,stewardBuilding,stewardChange,stewardClick,equipmentPins} from '../src/steward-ui.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest','expansion'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const fresh=()=>{const g=new Game(data);g.state.world=createWorld(data);g.state.mission=null;return g;};
test('steward UI preserves legacy saves until the player enables it',()=>{
 const g=fresh(),before=JSON.stringify(g.world);
 assert.match(stewardStores(g),/Steward: off/);assert.equal(stewardBuilding(g,g.world.buildings[0]),'');
 assert.equal(JSON.stringify(g.world),before);
 g.state.mission={};assert.equal(stewardStores(g),'');
});
test('steward UI gives three goal slots and distinguishes unpaid plans from payment',()=>{
 const g=fresh();g.world.steward={enabled:true,main:null,secondary:[],protectMeals:true,protectRepairs:true};refreshSteward(g);
 const before=JSON.stringify(g.world),html=stewardStores(g);
 assert.equal((html.match(/data-steward-goal=/g)||[]).length,3);
 assert.match(html,/Shared resource budget/);assert.match(html,/planned/);assert.match(html,/Manual purchases remain your choice/);
 assert.equal(JSON.stringify(g.world),before);
});
test('steward UI escapes data-driven goal labels',()=>{
 const g=fresh();g.world.steward={enabled:true};
 const hall=g.world.buildings.find(b=>b.type==='hall');g.data={...data,buildings:{...data.buildings,hall:{...data.buildings.hall,name:'<script>bad</script>'}}};
 refreshSteward(g);const html=stewardStores(g);
 assert.ok(hall);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('steward UI routes optional slot selection and clearing through game commands',()=>{
 const calls=[],g={world:{},setStewardGoal:(...a)=>calls.push(a),clearStewardGoal:s=>calls.push(['clear',s]),setSteward:(...a)=>calls.push(a),notify:()=>{}};
 const target={matches:selector=>selector==='[data-steward-goal]',dataset:{stewardGoal:'1'},value:JSON.stringify({id:'project',buildingId:'a'})};
 assert.equal(stewardChange(g,{target}),true);assert.deepEqual(calls.pop(),[1,{id:'project',buildingId:'a'}]);
 target.value='';stewardChange(g,{target});assert.deepEqual(calls.pop(),['clear',1]);
 stewardClick(g,{dataset:{stewardToggle:'enabled',settingValue:'true'}});assert.deepEqual(calls.pop(),['enabled',true]);
});

test('steward UI exposes advanced controls in existing Stores and preserves gear overrides',()=>{
 const g=fresh();g.world.steward={enabled:true,productionTargets:{bread:123},autoEquip:true};refreshSteward(g);
 const html=stewardStores(g);
 for(const id of ['production','queue','districts','coverage','blueprints','readiness','reports'])assert.ok(html.includes(`data-steward-details="${id}"`),id);
 assert.match(html,/data-steward-target="bread" value="123"/);assert.match(html,/sampled sites/);assert.match(html,/Geometric coverage estimate/);
 const unit=g.world.troops[0];unit.manualGear=true;unit.manualArmor=false;
 const pins=equipmentPins(g,unit);assert.match(pins,/Tool \/ weapon: keep current/);assert.match(pins,/Armor: automatic fitting/);
 g.state.mission={};assert.equal(equipmentPins(g,unit),'');
});
test('steward UI sends explicit queue and gear commands without launching background work',()=>{
 const calls=[],g={world:{buildings:[{id:'shop',level:2}]},setProductionTarget:(...a)=>calls.push(['stock',...a]),setEquipmentPin:(...a)=>calls.push(['pin',...a]),enqueueConstruction:e=>{calls.push(['queue',e]);return {ok:true};}};
 stewardChange(g,{target:{matches:s=>s==='[data-steward-target]',dataset:{stewardTarget:'bread'},value:'50'}});
 assert.deepEqual(calls.pop(),['stock','bread',50]);
 stewardClick(g,{dataset:{stewardPin:'unit',slot:'armor',settingValue:'true'}});
 assert.deepEqual(calls.pop(),['pin','unit','armor',true]);
 stewardClick(g,{dataset:{stewardQueueUpgrade:'shop'}});
 assert.deepEqual(calls.pop(),['queue',{kind:'upgrade',buildingId:'shop',targetTier:3}]);
});
test('steward blueprint draft edits invalidate a valid quote before explicit queueing',()=>{
 const calls=[],fields={id:{value:'layout'},x:{value:'5'},y:{value:'6'}};
 const box={querySelector(selector){return selector.endsWith('-id]')?fields.id:selector.endsWith('-x]')?fields.x:fields.y;}};
 const g={world:{},previewBlueprint:(id,x,y)=>({ok:true,id,x,y,entries:[],cost:{wood:5}}),applyBlueprint:(...args)=>{calls.push(args);return {ok:true};},notify:()=>{}};
 const preview={dataset:{stewardBlueprintPreview:''},closest:()=>box},apply={dataset:{stewardBlueprintApply:''}};
 stewardClick(g,preview);
 fields.x.value='9';
 const target={matches:s=>s==='[data-steward-blueprint-id],[data-steward-blueprint-x],[data-steward-blueprint-y]',closest:()=>box};
 assert.equal(stewardChange(g,{target}),true);
 stewardClick(g,apply);assert.deepEqual(calls,[],'stale valid quote cannot enqueue the old anchor');
 stewardClick(g,preview);stewardClick(g,apply);assert.deepEqual(calls,[['layout',9,6]],'new preview queues the edited anchor');
 stewardClick(g,preview);fields.id.value='other-layout';stewardChange(g,{target});stewardClick(g,apply);
 assert.equal(calls.length,1,'changing saved layout also requires a fresh preview');
});
