import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit,center} from '../src/model.js';
import {eventRegionLabel} from '../src/systems/frontier-events.js';
import {setRally,tickDefensePosts,defensePlanningMetrics} from '../src/systems/defense-posts.js';
import {settlementHealth} from '../src/systems/dashboard.js';
import {tickLogistics,logisticsMetrics,districtGrid} from '../src/systems/logistics.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickAutomation} from '../src/systems/automation.js';
import {Game} from '../src/game.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','expansion','biomes'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('polish: region-less events label safely',()=>{
  assert.equal(eventRegionLabel({}),'frontier');
  assert.equal(eventRegionLabel({region:'ashfall-march'}),'ashfall-march');
});
test('polish: storage rally prefers the near-store post, bounded; balanced untouched',()=>{
  for(const [preset,want] of [['storage','near'],['balanced','far']]){
    const w=createWorld(data);w.buildings=[];w.troops=[];
    const far=makeBuilding('gate',15,5,data),near=makeBuilding('gate',5,5,data),store=makeBuilding('storehouse',6,5,data);
    w.buildings.push(far,near,store);
    const u=makeUnit('warrior',data,0);
    const a=center(near,data),b=center(far,data);
    u.x=(a.x+b.x)/2;u.y=(a.y+b.y)/2;
    w.troops.push(u);
    assert.equal(setRally(w,preset),true);
    tickDefensePosts(w,data,.05);
    const target=want==='near'?near.id:far.id;
    assert.equal(u.defensePost,target,`${preset} posts ${want==='near'?'beside the store':'the first tied gate'}`);
  }
});
test('polish: first tick seeds lastStormAt, no strike on old saves',()=>{
  const w=createWorld(data);
  w.elapsed=100560;
  const before=w.buildings.map(b=>b.hp);
  const g=new Game(data);g.state.world=w;g.paused=false;
  assert.equal(w.lastPhase,undefined);
  g.tickClock();
  assert.equal(w.lastStormAt,100560);
  assert.deepEqual(w.buildings.map(b=>b.hp),before);
});
test('polish: walls rally weights the grand-watchtower',()=>{
  for(const [preset,want] of [['balanced','hall'],['walls','grand-watchtower']]){
    const w=createWorld(data);w.buildings=[];w.troops=[];
    const wt=makeBuilding('grand-watchtower',5,5,data),hall=makeBuilding('hall',35,5,data);
    w.buildings.push(wt,hall);
    const u=makeUnit('warrior',data,0);
    const c=center(wt,data);u.x=c.x;u.y=c.y;
    w.troops.push(u);
    assert.equal(setRally(w,preset),true);
    tickDefensePosts(w,data,.05);
    assert.equal(u.defensePost,w.buildings.find(b=>b.type===want).id,preset);
  }
});
test('polish: settlement health buckets unknown tasks as other and clamps frac',()=>{
  const w=createWorld(data);w.buildings=[];w.troops=[];
  const wall=makeBuilding('wall',8,5,data);wall.hp=999999;w.buildings.push(wall);
  const scout=makeUnit('builder',data,0);scout.builderTask={kind:'scout',target:wall.id};
  const idle=makeUnit('builder',data,1);
  w.troops.push(scout,idle);
  const h=settlementHealth(w,data);
  assert.equal(h.builders.other,1);
  assert.equal(h.builders.idle,1);
  assert.ok(h.weakWall.frac<=1);
  assert.equal(h.weakWall.frac,1);
});
test('polish: roads district mirror equals the logistics district map',async ()=>{
  const entries=src=>{
    const m=src.match(/const DISTRICT_KINDS=\[(.*?)\];/s);
    assert.ok(m,'DISTRICT_KINDS literal found');
    return [...m[1].matchAll(/\['([\w-]+)',\/([^/]+)\/\]/g)].map(x=>[x[1],x[2]]);
  };
  const logSrc=await readFile(new URL('../src/systems/logistics.js',import.meta.url),'utf8');
  const roadSrc=await readFile(new URL('../src/systems/roads.js',import.meta.url),'utf8');
  assert.deepEqual(entries(roadSrc),entries(logSrc));
});
test('polish: soak keeps all planner work bounded over 200 full ticks',()=>{
  const w=createWorld(data);w.buildings=[];w.troops=[];
  for(const t of w.tiles)t.claimed=true;
  for(let i=0;i<48;i++){const b=makeBuilding('farm',2+i%12*4,2+Math.floor(i/12)*5,data);b.harvestBonus=200;w.buildings.push(b);}
  w.buildings.push(makeBuilding('storehouse',24,30,data));
  for(let i=0;i<150;i++){const u=makeUnit('builder',data);u.x=1.5;u.y=1.5+i%30;u.traits=[];w.troops.push(u);}
  w.elapsed=400;
  w.resources={wood:100,food:100,gold:100,lumber:100,flour:100,bread:0};
  const g=new Game(data);g.state.world=w;g.paused=false;
  let maxJobs=0,maxCarts=0;
  for(let i=0;i<200;i++){
    w.elapsed+=.05;
    tickEconomy(w,data,.05);
    tickAutomation(g,.05);
    tickLogistics(w,data,.05);
    tickDefensePosts(w,data,.05);
    const m=logisticsMetrics(w);
    maxJobs=Math.max(maxJobs,m.activeJobs);maxCarts=Math.max(maxCarts,m.visibleCarts);
  }
  const m=logisticsMetrics(w);
  assert.ok(maxJobs<=24,`jobs ${maxJobs}`);
  assert.ok(maxCarts<=10,`carts ${maxCarts}`);
  assert.ok(m.intervalPathCalculations<=8,`interval paths ${m.intervalPathCalculations}`);
  assert.ok(m.routeCache<=48,`route cache ${m.routeCache}`);
  assert.ok(defensePlanningMetrics(w).planningRuns<=12,`planning runs ${defensePlanningMetrics(w).planningRuns}`);
  assert.ok(districtGrid(w,data).cells.length<=w.buildings.length,'district cache bounded by buildings');
});
