import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {reserveCapacity} from '../src/resources.js';
import {inspectSettlement,DIAGNOSTIC_LIMITS} from '../src/systems/steward-diagnostics.js';
import {logisticsMetrics,tickLogistics} from '../src/systems/logistics.js';
import {buildingMaxHp} from '../src/systems/endgame.js';

const data=Object.fromEntries(await Promise.all(['world','buildings','troops','items','abilities'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function fixture(){const w=createWorld(data);w.buildings=[];w.troops=[];w.enemies=[];w.resources={food:100,bread:100,wood:100,gold:100,flour:100};return {world:w,data};}
function building(g,type){const b=makeBuilding(type,4,4,data);g.world.buildings.push(b);return b;}
function post(g,b,type){const u=makeUnit(type,data);u.workplace=b.id;g.world.troops.push(u);return u;}
const ids=g=>inspectSettlement(g).issues.map(i=>i.id);

test('diagnostics report missing matching staff but never invent vacancies for a working shop',()=>{
  const g=fixture(),b=building(g,'sawmill');
  assert.ok(ids(g).includes(`staff:${b.id}`));
  post(g,b,'warrior');assert.ok(ids(g).includes(`staff:${b.id}`));
  const u=post(g,b,'sawyer');assert.ok(!ids(g).includes(`staff:${b.id}`));
  u.hp=0;assert.ok(ids(g).includes(`staff:${b.id}`));
  b.remaining=10;assert.ok(!ids(g).some(id=>id.endsWith(b.id)));
});
test('actual zero recipe inputs stall; fractional stock and unstaffed recipes do not',()=>{
  const g=fixture(),b=building(g,'sawmill');g.world.resources.wood=0;
  assert.ok(!ids(g).includes(`input:${b.id}:wood`));post(g,b,'sawyer');
  assert.ok(ids(g).includes(`input:${b.id}:wood`));
  g.world.resources.wood=.01;assert.ok(!ids(g).includes(`input:${b.id}:wood`));
});
test('full on-site reserves and output buffers identify the source and resource',()=>{
  const g=fixture(),farm=building(g,'farm'),mill=building(g,'mill');
  farm.harvestBonus=reserveCapacity(data.buildings.farm,1);mill.outputReserve={bread:96};
  const list=inspectSettlement(g).issues;
  assert.ok(list.some(i=>i.id===`harvest:${farm.id}`&&i.resource==='food'&&i.buildingId===farm.id));
  assert.ok(list.some(i=>i.id===`output:${mill.id}:bread`&&i.resource==='bread'));
  farm.harvestBonus--;mill.outputReserve.bread--;assert.ok(!ids(g).some(id=>/^(harvest|output):/.test(id)));
});
test('next-meal diagnostics use the real meal basket including reviving villagers',()=>{
  const g=fixture();g.world.troops=[{hp:10},{hp:0},{hp:-1}];g.world.resources.food=0;g.world.resources.bread=0;
  const list=inspectSettlement(g).issues;
  assert.match(list.find(i=>i.id==='meal:food').detail,/10 Food/);
  assert.match(list.find(i=>i.id==='meal:bread').detail,/2 Bread/);
  g.world.resources.food=10;g.world.resources.bread=2;assert.equal(inspectSettlement(g).issues.length,0);
});
test('ruins and damage are accurate and repair diagnosis supersedes a ruined workplace',()=>{
  const g=fixture(),b=building(g,'sawmill');b.hp--;
  assert.ok(ids(g).includes(`repair:${b.id}`));b.hp=0;
  assert.deepEqual(ids(g),[`ruin:${b.id}`]);
});
test('paragon buildings use their actual higher maximum health',()=>{
  const g=fixture(),b=building(g,'tower');b.paragon=2;b.hp=buildingMaxHp(b,data);
  assert.ok(!ids(g).includes(`repair:${b.id}`));b.hp--;
  assert.match(inspectSettlement(g).issues.find(i=>i.id===`repair:${b.id}`).detail,/1 HP/);
});
test('sampling is bounded, rotates through every building, and handles empty or invalid limits',()=>{
  const g=fixture();for(let i=0;i<57;i++)building(g,'sawmill');
  let cursor=0;const found=new Set();
  for(let i=0;i<5;i++){const s=inspectSettlement(g,{start:cursor,buildingLimit:12,issueLimit:12});assert.equal(s.inspected,12);s.issues.forEach(v=>found.add(v.buildingId));cursor=s.nextCursor;}
  assert.equal(found.size,57);
  const s=inspectSettlement(g,{buildingLimit:1000,issueLimit:1000});assert.equal(s.inspected,DIAGNOSTIC_LIMITS.buildings);assert.equal(s.issues.length,DIAGNOSTIC_LIMITS.issues);
  assert.equal(inspectSettlement(g,{buildingLimit:0,issueLimit:0}).issues.length,0);
  assert.deepEqual(inspectSettlement(fixture()),{issues:[],inspected:0,nextCursor:0});
});
test('reads do not create logistics state, path searches, settings or save mutations; issues are detached',()=>{
  const g=fixture(),b=building(g,'farm');b.harvestBonus=500;
  const before=JSON.stringify(g.world),metrics=logisticsMetrics(g.world);
  const s=inspectSettlement(g);s.issues[0].detail='changed';s.issues.push({id:'fake'});
  assert.equal(JSON.stringify(g.world),before);assert.deepEqual(logisticsMetrics(g.world),metrics);
  assert.ok(!inspectSettlement(g).issues.some(i=>i.id==='fake'||i.detail==='changed'));
});
test('waiting deliveries describe observed hauling failures without asserting blocked paths',()=>{
  const g=fixture(),b=building(g,'farm');b.harvestBonus=50;
  tickLogistics(g.world,data,.05);const before=logisticsMetrics(g.world);
  const issue=inspectSettlement(g).issues.find(i=>i.id==='deliveries');
  assert.ok(issue);assert.match(issue.detail,/could not get a hauling job/);assert.equal(issue.buildingId,undefined);
  assert.deepEqual(logisticsMetrics(g.world),before);
});
