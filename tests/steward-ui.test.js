import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld} from '../src/model.js';
import {refreshSteward} from '../src/systems/steward.js';
import {stewardStores,stewardBuilding,stewardChange,stewardClick} from '../src/steward-ui.js';
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
 const target={matches:()=>true,dataset:{stewardGoal:'1'},value:JSON.stringify({id:'project',buildingId:'a'})};
 assert.equal(stewardChange(g,{target}),true);assert.deepEqual(calls.pop(),[1,{id:'project',buildingId:'a'}]);
 target.value='';stewardChange(g,{target});assert.deepEqual(calls.pop(),['clear',1]);
 stewardClick(g,{dataset:{stewardToggle:'enabled',settingValue:'true'}});assert.deepEqual(calls.pop(),['enabled',true]);
});
