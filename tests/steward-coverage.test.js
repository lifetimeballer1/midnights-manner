import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {refreshCoverage,coverageSnapshot,COVERAGE_LIMITS} from '../src/systems/steward-coverage.js';
import {logisticsMetrics} from '../src/systems/logistics.js';
const data=Object.fromEntries(await Promise.all(['world','buildings','troops','items','abilities'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function fixture(){const world=createWorld(data);world.buildings=[];world.troops=[];return {world,data,state:{mission:null}};}
function add(g,type,x=4,y=4){const b=makeBuilding(type,x,y,data);g.world.buildings.push(b);return b;}
test('coverage uses ready tower ranges and identifies unguarded critical sites',()=>{
 const g=fixture(),near=add(g,'cottage'),far=add(g,'cottage',40,40);add(g,'tower',5,4);
 const s=refreshCoverage(g);assert.equal(s.protected,1);assert.equal(s.unguarded,1);assert.equal(s.gaps[0].buildingId,far.id);assert.match(s.gaps[0].detail,/Geometric/);assert.ok(s.geometric);
 g.world.buildings[2].remaining=10;assert.equal(refreshCoverage(g).protected,0);assert.ok(near.id);
});
test('available posted fighters add response coverage without changing manual locks or orders',()=>{
 const g=fixture(),gate=add(g,'gate'),home=add(g,'cottage',8,4),u=makeUnit('warrior',data);u.defensePost=gate.id;u.manualDefensePost=true;g.world.troops.push(u);
 let s=refreshCoverage(g);assert.equal(s.protected,2);assert.equal(u.manualDefensePost,true);assert.equal(u.defensePost,gate.id);
 u.order={kind:'hold'};s=refreshCoverage(g);assert.equal(s.protected,0);assert.deepEqual(u.order,{kind:'hold'});
 u.order=null;u.expedition={};assert.equal(refreshCoverage(g).protected,0);assert.ok(home.id);
});
test('coverage bounds sites, posts and gaps with no route searches or snapshot mutation',()=>{
 const g=fixture();for(let i=0;i<40;i++)add(g,'cottage',40,40);for(let i=0;i<40;i++)add(g,'tower',4,4);
 const before=JSON.stringify(g.world),m=logisticsMetrics(g.world),s=refreshCoverage(g);
 assert.equal(s.examined,COVERAGE_LIMITS.sites);assert.equal(s.posts,COVERAGE_LIMITS.posts);assert.equal(s.gaps.length,COVERAGE_LIMITS.gaps);assert.equal(s.unguarded,24);
 s.gaps[0].label='fake';assert.notEqual(coverageSnapshot(g).gaps[0].label,'fake');assert.equal(JSON.stringify(g.world),before);assert.deepEqual(logisticsMetrics(g.world),m);
});
test('snapshot reads never plan and campaign maps receive no home report',()=>{
 const g=fixture();add(g,'hall');assert.equal(coverageSnapshot(g).examined,0);assert.equal(refreshCoverage(g).examined,1);
 g.state.mission={};assert.equal(coverageSnapshot(g).examined,0);assert.equal(refreshCoverage(g).examined,0);
});
test('rotating coverage checks eventually visit critical sites beyond the first 24',()=>{
 const g=fixture();for(let i=0;i<30;i++)add(g,'cottage',40,40);add(g,'tower',4,4);
 const first=refreshCoverage(g);assert.equal(first.examined,24);assert.equal(first.totalSites,30);assert.equal(first.nextCursor,24);
 assert.ok(!first.gaps.some(gap=>g.world.buildings.slice(24).some(b=>b.id===gap.buildingId)));
 const second=refreshCoverage(g);assert.equal(second.examined,24);assert.equal(second.totalSites,30);assert.equal(second.posts,first.posts);
 assert.equal(second.nextCursor,18);
 for(const b of g.world.buildings.slice(24,30))assert.ok(second.gaps.some(gap=>gap.buildingId===b.id));
 const cursor=second.nextCursor;coverageSnapshot(g);assert.equal(coverageSnapshot(g).nextCursor,cursor);
});
