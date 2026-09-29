import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,canPlace} from '../src/model.js';
import {spawnRaid,raidSides,tickCombat} from '../src/systems/combat.js';
import {wallRowQuote,wallLine} from '../src/systems/walls.js';
import {MapInput} from '../src/input.js';
const data=Object.fromEntries(await Promise.all(['world','buildings','troops','items','abilities','missions','quests','levels','calendar','traders'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function game(){const g=new Game(data);g.state.world=createWorld(data);g.world.buildings=[];g.world.troops=[];g.world.resources={wood:10000,gold:10000,food:10000};return g;}
function wall(g,x,y,type='wall',level=1){const b=makeBuilding(type,x,y,g.data,level);g.world.buildings.push(b);return b;}

test('tile-less legacy raids cover all four sides, rotate small waves and stay on authored bounds',()=>{
 const w=createWorld(data);w.bounds={w:12,h:10};w.tiles=[];
 spawnRaid(w,8,null,data);
 assert.equal(w.enemies.length,8);
 for(const e of w.enemies)assert.ok(e.x>=0&&e.x<12&&e.y>=0&&e.y<10);
 for(const side of ['west','north','east','south'])assert.equal(w.enemies.filter(e=>side==='west'?e.x===.5:side==='east'?e.x===11.5:side==='north'?e.y===.5:e.y===9.5).length,2);
 const points=new Set(w.enemies.map(e=>`${e.x},${e.y}`));assert.equal(points.size,8);
 assert.deepEqual([1,2,3,4].map(wave=>raidSides(wave,1)[0]),['west','north','east','south']);
});
test('all four raid fronts can reach and damage a central building',()=>{
 for(const wave of [0,1,2,3]){
  const g=game();const hall=makeBuilding('hall',6,5,data);g.world.buildings=[hall];g.world.wave=wave;
  spawnRaid(g.world,1,null,data);const initial=hall.hp;
  for(let i=0;i<600&&hall.hp===initial;i++)tickCombat(g.world,data,.05);
  assert.ok(hall.hp<initial,`wave ${wave+1} reaches target`);
 }
});
test('raiders break adjacent walls when a defender behind them is unreachable',()=>{
 const g=game();for(let y=0;y<data.world.height;y++)wall(g,5,y);
 const u=structuredClone(createWorld(data).troops.find(t=>t.type==='farmer'));u.x=6.1;u.y=5.5;g.world.troops=[u];
 spawnRaid(g.world,1,null,data);Object.assign(g.world.enemies[0],{x:4.9,y:5.5,attackTimer:0});
 const barrier=g.world.buildings.find(b=>b.y===5),hp=barrier.hp;tickCombat(g.world,data,.1);assert.ok(barrier.hp<hp);
});
test('building previews can hug a wall but cannot overlap it',()=>{
 const g=game();wall(g,4,2);assert.equal(canPlace(g.world,data,'farm',2,2),true);assert.equal(canPlace(g.world,data,'farm',3,2),false);
 const farm=g.build('farm',1,5);assert.equal(g.relocate(farm.id,2,2),true);
});
test('row quote follows mixed walls, stops at gaps and never turns corners',()=>{
 const g=game(),a=wall(g,2,2);wall(g,3,2,'stonewall');wall(g,4,2);wall(g,4,3);wall(g,6,2);
 const q=wallRowQuote(g.world,data,a.id,'x');assert.equal(q.row.length,3);assert.deepEqual(q.cost,{wood:108,gold:50});
 assert.equal(g.upgradeWallRow(a.id,'x'),true);assert.deepEqual(g.world.buildings.map(b=>b.level),[2,2,2,1,1]);assert.equal(g.world.resources.wood,9892);assert.equal(g.world.resources.gold,9950);
});
test('row upgrade rejects insufficient total funds without partial upgrades',()=>{
 const g=game(),a=wall(g,2,2);wall(g,3,2);g.world.resources.wood=30;
 assert.equal(g.upgradeWallRow(a.id,'x'),false);assert.equal(g.world.resources.wood,30);assert.deepEqual(g.world.buildings.map(b=>b.level),[1,1]);
});
test('row skips max, busy, ruined and gated segments, with no double spend',()=>{
 const g=game(),a=wall(g,2,2);wall(g,3,2,'wall',3);wall(g,4,2).remaining=5;wall(g,5,2).hp=0;
 g.data=structuredClone(data);g.data.buildings.stonewall.tierGates={2:5};wall(g,6,2,'stonewall');
 assert.equal(g.upgradeWallRow(a.id,'x'),true);assert.equal(g.world.resources.wood,9976);assert.deepEqual(g.world.buildings.map(b=>b.level),[2,3,1,1,1]);
 assert.equal(g.upgradeWallRow(a.id,'x'),false);assert.equal(g.world.resources.wood,9976);
});
test('wall drag snaps to a straight axis and builds all or nothing',()=>{
 const g=game();assert.deepEqual(wallLine({x:2,y:2},{x:4,y:3}),[{x:2,y:2},{x:3,y:2},{x:4,y:2}]);
 assert.equal(g.buildWallRow('wall',{x:2,y:2},{x:4,y:2}),true);assert.equal(g.world.buildings.length,3);assert.equal(g.world.resources.wood,9964);
 const stock=g.world.resources.wood;assert.equal(g.buildWallRow('wall',{x:4,y:1},{x:4,y:3}),false);assert.equal(g.world.resources.wood,stock);assert.equal(g.world.buildings.length,3);
 g.world.resources.wood=12;assert.equal(g.buildWallRow('wall',{x:7,y:2},{x:9,y:2}),false);assert.equal(g.world.resources.wood,12);
 g.paused=true;assert.equal(g.buildWallRow('wall',{x:7,y:2},{x:7,y:2}),false);
});
function input(placing=null){
 const handlers={},calls={pan:0,zoom:0,hint:0,select:0};
 const c={addEventListener:(name,fn)=>handlers[name]=fn,getBoundingClientRect:()=>({left:0,top:0})};
 const r={placing,cell:e=>({x:Math.floor(e.clientX/10),y:Math.floor(e.clientY/10)}),panPixels:()=>calls.pan++,zoomAt:()=>calls.zoom++,pick:()=>null};
 const ui={blocked:()=>false,placementHint:()=>calls.hint++,selectCell:()=>calls.select++};
 new MapInput(c,r,ui);
 const send=(type,id,x,y)=>handlers[type]({pointerId:id,clientX:x,clientY:y,pointerType:'touch'});
 return {r,calls,send};
}
test('one-finger building slide previews without panning or committing; normal drag pans',()=>{
 for(const type of ['farm',null]){const {r,calls,send}=input(type);send('pointerdown',1,20,20);send('pointermove',1,60,40);send('pointerup',1,60,40);assert.equal(calls.select,0);assert.equal(calls.pan,type?0:1);if(type)assert.deepEqual(r.hover,{x:6,y:4});}
});
test('wall sliding retains a start tile; moving one wall never creates a row',()=>{
 for(const moving of [null,'existing']){const {r,send}=input('wall');r.moving=moving;send('pointerdown',1,20,20);send('pointermove',1,60,40);send('pointerup',1,60,40);assert.deepEqual(r.wallStart,moving?null:{x:2,y:2});}
});
test('pinch pans/zooms in placement mode and never changes or commits the preview',()=>{
 const {r,calls,send}=input('wall');r.hover={x:3,y:3};send('pointerdown',1,20,20);send('pointerdown',2,70,20);send('pointermove',2,90,30);send('pointerup',2,90,30);send('pointermove',1,50,50);send('pointerup',1,50,50);
 assert.deepEqual(r.hover,{x:3,y:3});assert.equal(calls.select,0);assert.ok(calls.pan>0&&calls.zoom>0);
});
