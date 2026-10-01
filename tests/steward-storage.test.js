import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld} from '../src/model.js';
import {exportSave,importSaveBlob} from '../src/storage.js';
const dir=new URL('../data/',import.meta.url),files=(await readdir(dir)).filter(f=>f.endsWith('.json'));
const data=Object.fromEntries(await Promise.all(files.map(async f=>[f.slice(0,-5),JSON.parse(await readFile(new URL(f,dir)))])));
const fresh=()=>{const g=new Game(data);g.state.world=createWorld(data);g.paused=false;g.persist=()=>true;g.notify=()=>{};return g;};
test('steward settings preserve legacy saves and sanitize optional imported plans',()=>{
 const g=fresh();let imported=importSaveBlob(exportSave(g.state),data);assert.equal(imported.ok,true);assert.equal(imported.state.world.steward,undefined);
 const hall=g.world.buildings.find(b=>b.type==='hall');
 g.world.steward={enabled:true,protectMeals:false,protectRepairs:'yes',main:{id:'project',buildingId:hall.id,targetTier:2,baseline:1},secondary:[{id:'project',buildingId:hall.id,targetTier:3},{id:'conquest',tribeId:'bogus'},{id:'grow'}],runtime:{huge:true}};
 imported=importSaveBlob(exportSave(g.state),data);assert.equal(imported.ok,true);
 assert.deepEqual(imported.state.world.steward,{enabled:true,protectMeals:false,protectRepairs:true,main:{id:'project',buildingId:hall.id,targetTier:2,baseline:1},secondary:[null,null]});
});
test('steward Game controls persist valid goals and respect pause/campaign guards',()=>{
 const g=fresh(),hall=g.world.buildings.find(b=>b.type==='hall');let saves=0;g.persist=()=>{saves++;return true;};
 assert.equal(g.setStewardGoal('main',{id:'project',buildingId:hall.id}),true);assert.equal(g.setSteward('enabled',true),true);assert.equal(saves,2);
 let imported=importSaveBlob(exportSave(g.state),data);assert.equal(imported.ok,true);assert.equal(imported.state.world.steward.main.buildingId,hall.id);
 g.paused=true;assert.equal(g.clearStewardGoal('main'),false);assert.equal(g.setSteward('enabled',false),false);
 g.paused=false;g.state.mission={};assert.equal(g.setStewardGoal('main',{id:'grow'}),false);
 g.state.mission=null;assert.equal(g.clearStewardGoal('main'),true);assert.equal(g.world.steward.main,null);
});
