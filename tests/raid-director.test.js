import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld} from '../src/model.js';
import {ensureDirector,scheduleRecovery,settlementThreat,directorParty} from '../src/systems/raid-director.js';
import {exportSave,importSaveBlob} from '../src/storage.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function game(){const g=new Game(data);g.state={...g.state,world:createWorld(data),home:null,mission:null,completed:[],vlevel:1};return g;}
test('director backfills overdue legacy clocks without changing inventory or future warnings',()=>{
 const g=game(),w=g.world;w.elapsed=900;w.nextRaidAt=300;const before=structuredClone(w.resources);ensureDirector(w,data);assert.equal(w.nextRaidAt,1140);assert.deepEqual(w.resources,before);w.nextRaidAt=1000;ensureDirector(w,data);assert.equal(w.nextRaidAt,1000);
});
test('threat rises with settlement prosperity, while first scouts and party cap remain safe',()=>{
 const g=game(),low=settlementThreat(g.state).score;g.world.resources.gold=100000;g.state.vlevel=20;g.state.completed=data.missions.map(m=>m.id);assert.ok(settlementThreat(g.state).score>low);assert.equal(directorParty(g.state,data),2);g.world.wave=100;assert.equal(directorParty(g.state,data),8);assert.ok(settlementThreat(g.state).score<=100);
});
test('quiet deadlines vary once, survive save round-trip, and respect recovery minimum',()=>{
 const g=game();g.world.elapsed=600;scheduleRecovery(g.state,data,true,()=>0);const early=g.world.nextRaidAt;scheduleRecovery(g.state,data,true,()=>1);assert.ok(g.world.nextRaidAt>early);assert.ok(g.world.nextRaidAt<=1080);const out=importSaveBlob(exportSave(g.state),data);assert.ok(out.ok);assert.equal(out.state.world.nextRaidAt,g.world.nextRaidAt);assert.deepEqual(out.state.world.director,g.world.director);scheduleRecovery(g.state,data,false,()=>0);assert.ok(g.world.nextRaidAt>=960);assert.equal(g.world.director.lastOutcome,'defeat');
});
test('defeat grants a saved recovery window and does not retrigger while manor is ruined',()=>{
 const g=game();g.raid();g.world.raidPending.timer=0;g.tick(.05);g.world.buildings.find(b=>b.type==='hall').hp=0;g.tick(.05);assert.equal(g.world.raidResult.won,false);assert.equal(g.world.director.lastOutcome,'defeat');assert.ok(g.world.nextRaidAt-g.world.elapsed>=360);assert.ok(g.world.resources.wood>=80);g.world.elapsed=g.world.nextRaidAt+1;g.tick(.05);assert.equal(g.world.raidPending,null);
});
test('campaign keeps scheduled timelines and leaves home director paused',()=>{
 const g=game();ensureDirector(g.world,data);const before=structuredClone(g.world.director);g.mission(data.missions[0].id);assert.ok(g.state.mission);g.tick(.05);assert.deepEqual(g.state.home.director,before);assert.equal(g.world.director,undefined);
});
