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

test('complete steward configuration round trips without saving runtime plans',()=>{
 const g=fresh(),hall=g.world.buildings.find(b=>b.type==='hall'),farm=g.world.buildings.find(b=>b.type==='farm'),unit=g.world.troops[0];
 assert.equal(g.setSteward('enabled',true),true);assert.equal(g.setSteward('autoEquip',true),true);assert.equal(g.setSteward('queueEnabled',true),true);assert.equal(g.setProductionTarget('bread',123),true);
 assert.equal(g.enqueueConstruction({kind:'upgrade',buildingId:hall.id,targetTier:2}).ok,true);
 assert.equal(g.createDistrict({name:'Fields',kind:'food',buildingIds:[farm.id],priority:'supply'}).ok,true);
 assert.equal(g.captureBlueprint('Fields',[farm.id]).ok,true);assert.equal(g.setEquipmentPin(unit.id,'main',true),true);
 const result=importSaveBlob(exportSave(g.state),data);assert.equal(result.ok,true);assert.deepEqual(result.state.world.steward,g.world.steward);assert.equal(result.state.world.troops.find(u=>u.id===unit.id).manualGear,true);
 assert.equal(result.state.world.steward.reports,undefined);assert.equal(result.state.world.steward.coverage,undefined);
 g.paused=true;assert.equal(g.enqueueConstruction({kind:'upgrade',buildingId:hall.id}).ok,false);assert.equal(g.setProductionTarget('bread',1),false);
});
test('imported advanced steward records enforce caps, references, numeric bounds and exclusive membership',()=>{
 const g=fresh(),hall=g.world.buildings.find(b=>b.type==='hall'),farm=g.world.buildings.find(b=>b.type==='farm');
 g.world.steward={enabled:true,autoEquip:'yes',queueEnabled:true,productionTargets:{bread:1e9,food:-1,unknown:15},queue:[{id:'valid',kind:'upgrade',buildingId:hall.id,targetTier:2},{id:'duplicate',kind:'upgrade',buildingId:hall.id,targetTier:3},{id:'bad',kind:'build',type:'farm',x:-1,y:0,targetTier:1}],districts:[{id:'a',name:'Fields',kind:'food',buildingIds:[farm.id,farm.id,'missing'],priority:'supply'},{id:'b',name:'Other',kind:'general',buildingIds:[farm.id,hall.id],priority:'bad'}],blueprints:[{id:'valid',name:'Farm',entries:[{type:'farm',dx:0,dy:0,targetTier:2}]},{id:'bad',entries:[{type:'hall',dx:0,dy:0,targetTier:1}]}],reports:{history:['stale']}};
 g.world.troops[0].manualArmor='yes';const result=importSaveBlob(exportSave(g.state),data);assert.equal(result.ok,true);const c=result.state.world.steward;
 assert.equal(c.autoEquip,false);assert.deepEqual(c.productionTargets,{bread:100000});assert.equal(c.queue.length,1);assert.equal(c.blueprints.length,1);
 assert.deepEqual(c.districts[0].buildingIds,[farm.id]);assert.deepEqual(c.districts[1].buildingIds,[hall.id]);assert.equal(c.districts[1].priority,'balanced');assert.equal(c.reports,undefined);assert.equal(result.state.world.troops[0].manualArmor,undefined);
});
test('automatic Game equipment consumes stock without purchasing and manual fitting pins the slot',()=>{
 const g=fresh(),u=g.world.troops[0];g.data={...g.data,items:{...g.data.items,'steward-stock-test':{name:'Stock test',roles:[u.type],cost:{gold:500},stats:{damage:2}}}};g.locked=()=>false;
 g.world.steward={enabled:true,autoEquip:true};g.world.stock={'steward-stock-test':1};const resources={...g.world.resources};
 assert.equal(g.equip(u.id,'steward-stock-test',{automatic:true}),true);assert.deepEqual(g.world.resources,resources);assert.equal(g.world.stock['steward-stock-test'],0);assert.notEqual(u.manualGear,true);
 assert.equal(g.equip(u.id,'steward-stock-test'),true);assert.equal(u.manualGear,true);assert.equal(g.setEquipmentPin(u.id,'main',false),true);assert.equal(u.manualGear,false);
});
test('automatic training respects goal budgets while a manual training choice remains available',async()=>{
 const {makeUnit}=await import('../src/model.js');const {refreshSteward}=await import('../src/systems/steward.js');
 const g=fresh(),u=makeUnit('warrior',data),hall=g.world.buildings.find(b=>b.type==='hall');g.world.troops=[u];g.world.resources={...g.world.resources,food:10000,gold:150,wood:200};g.world.autoTrain=true;
 g.world.steward={enabled:true,protectMeals:false,protectRepairs:false,main:{id:'project',buildingId:hall.id,targetTier:2,baseline:1}};refreshSteward(g);
 const level=u.level;g.tickAutoTrain(5);assert.equal(u.level,level);assert.equal(g.world.resources.gold,150);g.level(u.id);assert.equal(u.level,level+1);assert.ok(g.world.resources.gold<150);
});
