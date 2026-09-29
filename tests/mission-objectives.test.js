import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding} from '../src/model.js';
import {
  missionObjectiveProgress, missionObjectivesComplete, startMission, tickMission,
} from '../src/systems/campaign.js';
import {claimRegion,regionById} from '../src/systems/expansion.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','expansion','biomes'].map(async n=>[
  n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))
 ])
));

test('mission objectives: legacy resource objects remain gather objectives',()=>{
 const w=createWorld(structuredClone(data));
 const objective={resource:'wood',amount:50};
 let p=missionObjectiveProgress(objective,w,data);
 assert.equal(p.kind,'gather');
 assert.equal(p.complete,false);
 assert.equal(p.progressText,'0 / 50 wood');
 w.gathered.wood=50;
 p=missionObjectiveProgress(objective,w,data);
 assert.equal(p.complete,true);
 assert.equal(missionObjectivesComplete({objectives:[objective]},w,data),true);
});

test('mission objectives: protect and build read finished living structures',()=>{
 const d=structuredClone(data),w=createWorld(d);
 const tower=makeBuilding('tower',4,4,d);tower.remaining=0;w.buildings.push(tower);
 let protect=missionObjectiveProgress({kind:'protect',type:'tower',count:1},w,d);
 assert.equal(protect.complete,true);
 assert.match(protect.label,/Keep 1 .*Tower standing/i);
 tower.hp=0;
 protect=missionObjectiveProgress({kind:'protect',type:'tower',count:1},w,d);
 assert.equal(protect.complete,false);
 const forge=makeBuilding('forge',6,6,d);forge.remaining=4;w.buildings.push(forge);
 assert.equal(missionObjectiveProgress({kind:'build',type:'forge',count:1},w,d).complete,false);
 forge.remaining=0;
 assert.equal(missionObjectiveProgress({kind:'build',type:'forge',count:1},w,d).complete,true);
});

test('mission objectives: survive and defeat expose bounded readable progress',()=>{
 const w={elapsed:75,raidKills:4,buildings:[],gathered:{}};
 const survive=missionObjectiveProgress({kind:'survive',seconds:120},w,data);
 assert.deepEqual([survive.have,survive.need,survive.complete],[75,120,false]);
 assert.equal(survive.progressText,'75 / 120s held');
 const defeat=missionObjectiveProgress({kind:'defeat',amount:4},w,data);
 assert.equal(defeat.complete,true);
 assert.equal(defeat.progressText,'4 / 4 raiders defeated');
 w.elapsed=999;
 assert.equal(missionObjectiveProgress({kind:'survive',seconds:120},w,data).have,120,'survive progress caps at target');
});

test('mission objectives: Longest Night cannot resolve with its Oathstone down',()=>{
 const d=structuredClone(data),state={
  world:createWorld(d),home:null,mission:null,
  completed:['the-pale-court','red-banner'],unlocks:[]
 };
 claimRegion(state.world,regionById(d.expansion,'starwatch-ridge'));
 assert.ok(startMission(state,d,'the-longest-night'));
 const m=d.missions.find(m=>m.id==='the-longest-night');
 state.mission.fired=m.raids.map((_,i)=>i);
 state.world.enemies=[];
 state.world.gathered.gold=350;
 state.world.elapsed=300;
 const oath=state.world.buildings.find(b=>b.type==='oathstone');
 assert.ok(oath,'mission map carries its protected Oathstone');
 oath.hp=0;
 tickMission(state,d);
 assert.equal(state.mission.status,'active','broken Oathstone blocks victory');
 oath.hp=d.buildings.oathstone.tiers[oath.level-1].hp;
 tickMission(state,d);
 assert.equal(state.mission.status,'won','restored Oathstone satisfies the final objective');
});

test('mission objectives: Dawn must hold through 360 seconds after the other goals are ready',()=>{
 const d=structuredClone(data),state={
  world:createWorld(d),home:null,mission:null,
  completed:['the-longest-night'],unlocks:[]
 };
 claimRegion(state.world,regionById(d.expansion,'dawnfields'));
 assert.ok(startMission(state,d,'dawn'));
 const m=d.missions.find(m=>m.id==='dawn');
 state.mission.fired=m.raids.map((_,i)=>i);
 state.world.enemies=[];
 state.world.gathered.gold=400;
 state.world.elapsed=350;
 assert.ok(state.world.buildings.some(b=>b.type==='oathstone'&&b.hp>0));
 tickMission(state,d);
 assert.equal(state.mission.status,'active','the field must still be held');
 state.world.elapsed=360;
 tickMission(state,d);
 assert.equal(state.mission.status,'won','the hold timer completes the finale');
});
