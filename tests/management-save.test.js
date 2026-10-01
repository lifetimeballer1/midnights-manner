import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {exportSave,importSaveBlob} from '../src/storage.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','expansion'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('management choices survive export/import while routes and occupancy restart',()=>{
 const g=new Game(data),w=g.world,b=w.buildings[0],u=w.troops.find(t=>data.troops[t.type].role==='combat');
 g.setAutomation('autoUpgrade',true);g.setAutomationReserve('wood',250);g.setAutomation('stockTarget',2);
 g.configureBuilding(b.id,'autoUpgrade',true);g.configureBuilding(b.id,'autoUpgradeMaxTier',2);
 u.defensePost=b.id;u.manualDefensePost=true;u.builderTask={kind:'repair'};u.shelteredIn=b.id;
 const result=importSaveBlob(exportSave(g.state),data);assert.equal(result.ok,true);
 assert.deepEqual(result.state.world.automation,{autoUpgrade:true,reserves:{wood:250},stockTarget:2});
 const saved=result.state.world.troops.find(t=>t.id===u.id);assert.equal(saved.defensePost,b.id);assert.equal(saved.manualDefensePost,true);assert.equal(saved.builderTask,undefined);assert.equal(saved.shelteredIn,undefined);
 assert.equal(result.state.world.buildings[0].autoUpgradeMaxTier,2);
});
test('import sanitizes malformed management values without changing inventories',()=>{
 const g=new Game(data),raw=structuredClone(g.state),before=structuredClone(raw.world.resources);
 raw.world.automation={autoUpgrade:'yes',stockTarget:999,reserves:{wood:-9,gold:Infinity}};
 raw.world.buildings[0].autoUpgrade='yes';raw.world.buildings[0].autoUpgradeMaxTier=999;
 raw.world.troops[0].defensePost='missing';raw.world.troops[0].manualDefensePost=true;
 const result=importSaveBlob(exportSave(raw),data);assert.equal(result.ok,true);assert.deepEqual(result.state.world.resources,before);
 assert.equal(result.state.world.automation.autoUpgrade,false);assert.equal(result.state.world.automation.stockTarget,5);
 assert.deepEqual(result.state.world.automation.reserves,{});assert.equal(result.state.world.buildings[0].autoUpgrade,undefined);assert.equal(result.state.world.troops[0].defensePost,undefined);
});
test('management controls refuse campaign changes and invalid reserve resources',()=>{
 const g=new Game(data);assert.equal(g.setAutomationReserve('__proto__',3),false);assert.equal(g.setAutomation('stockTarget',NaN),false);
 g.state.mission={id:'first-harvest'};assert.equal(g.setAutomation('autoUpgrade',true),false);assert.equal(g.configureBuilding(g.world.buildings[0].id,'autoUpgrade',true),false);
});
