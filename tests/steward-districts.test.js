import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {createDistrict,updateDistrict,removeDistrict,districtChoices,districtSnapshot,refreshDistricts} from '../src/systems/steward-districts.js';
const data=Object.fromEntries(await Promise.all(['world','buildings','troops','items','abilities'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function fixture(){const world=createWorld(data);world.buildings=[];world.troops=[];return {world,data,state:{mission:null}};}
function add(g,type){const b=makeBuilding(type,4,4,data);g.world.buildings.push(b);return b;}
test('district creation validates membership, limits and independent returned values',()=>{
 const g=fixture(),b=add(g,'farm'),input={name:'Fields',kind:'food',buildingIds:[b.id,b.id]};
 const r=createDistrict(g,input);assert.ok(r.ok);assert.deepEqual(r.district.buildingIds,[b.id]);r.district.buildingIds.push('fake');assert.deepEqual(g.world.steward.districts[0].buildingIds,[b.id]);
 assert.equal(createDistrict(g,input).ok,false);assert.equal(createDistrict(g,{...input,buildingIds:['fake']}).ok,false);
 assert.equal(createDistrict(g,{...input,buildingIds:[],kind:'invalid'}).ok,false);
 assert.equal(createDistrict(g,{...input,buildingIds:Array(25).fill(b.id)}).ok,false);
 for(let i=1;i<6;i++)assert.ok(createDistrict(g,{name:`Empty ${i}`,kind:'general',buildingIds:[]}).ok);
 assert.equal(createDistrict(g,{name:'Seventh',kind:'general',buildingIds:[]}).ok,false);
});
test('updates preserve identity and require unique membership; removals free buildings',()=>{
 const g=fixture(),a=add(g,'farm'),b=add(g,'sawmill');
 const x=createDistrict(g,{name:'A',kind:'food',buildingIds:[a.id]}).district;
 const y=createDistrict(g,{name:'B',kind:'industry',buildingIds:[b.id]}).district;
 assert.equal(updateDistrict(g,y.id,{buildingIds:[a.id]}).ok,false);
 assert.ok(updateDistrict(g,x.id,{name:'Renamed',priority:'repair'}).ok);
 assert.equal(g.world.steward.districts[0].id,x.id);assert.equal(g.world.steward.districts[0].priority,'repair');
 assert.ok(removeDistrict(g,x.id).ok);assert.ok(updateDistrict(g,y.id,{buildingIds:[a.id,b.id]}).ok);
 g.state.mission={};assert.equal(removeDistrict(g,y.id).ok,false);assert.equal(updateDistrict(g,y.id,{name:'No'}).ok,false);assert.equal(createDistrict(g,{name:'No',kind:'general',buildingIds:[]}).ok,false);
});
test('snapshots show actual staffing, input/output chain, damage and attached goals without mutations',()=>{
 const g=fixture(),farm=add(g,'farm'),mill=add(g,'mill'),u=makeUnit('miller',data);u.workplace=mill.id;g.world.troops.push(u);mill.hp--;
 const district=createDistrict(g,{name:'Pantry',kind:'food',buildingIds:[farm.id,mill.id]}).district;
 g.world.steward.main={id:'project',buildingId:mill.id,targetTier:2};const before=JSON.stringify(g.world);
 const s=refreshDistricts(g)[0];assert.equal(s.id,district.id);assert.equal(s.workers,1);assert.equal(s.staffed,1);assert.equal(s.damaged,1);assert.ok(s.inputs.includes('food'));assert.ok(s.outputs.includes('bread'));assert.equal(s.goals.length,1);
 s.goals[0].targetTier=999;s.buildingIds.length=0;assert.equal(JSON.stringify(g.world),before);
});
test('district snapshot reads cache only and return detached arrays',()=>{
 const g=fixture(),b=add(g,'farm');createDistrict(g,{name:'Fields',kind:'food',buildingIds:[b.id]});assert.deepEqual(districtSnapshot(g),[]);
 refreshDistricts(g);const s=districtSnapshot(g);s[0].outputs.length=0;assert.ok(districtSnapshot(g)[0].outputs.length);
 g.state.mission={};assert.deepEqual(districtSnapshot(g),[]);
});
test('suggestions use existing ready unused buildings and bound each group',()=>{
 const g=fixture();for(let i=0;i<30;i++)add(g,'farm');const used=g.world.buildings[0],ruin=add(g,'tower');ruin.hp=0;
 createDistrict(g,{name:'Existing',kind:'food',buildingIds:[used.id]});const before=JSON.stringify(g.world);
 const choices=districtChoices(g),food=choices.find(c=>c.kind==='food');assert.equal(food.buildingIds.length,24);assert.ok(!food.buildingIds.includes(used.id));assert.ok(!choices.some(c=>c.buildingIds.includes(ruin.id)));assert.equal(JSON.stringify(g.world),before);
});
