import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {phaseSeed} from '../src/camera.js';
import {Game} from '../src/game.js';
import {reserveCapacity} from '../src/resources.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const gradient={addColorStop(){}};
function context(){return new Proxy({},{get:(t,k)=>t[k]||((...args)=>{if(k==='measureText')return {width:50};if(k==='createRadialGradient'||k==='createLinearGradient')return gradient;for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),`${k}: non-finite render coordinate`);}),set:(t,k,v)=>(t[k]=v,true)});}
function renderer(){const c={width:1100,height:740,getContext:()=>context(),getBoundingClientRect:()=>({left:0,top:0,width:390,height:844})};const imgs=Object.fromEntries([...Object.values(data.troops).map(t=>t.sprite),...Object.values(data.items).map(t=>t.sprite),...Object.values(data.buildings).flatMap(t=>t.tiers.map(t=>t.sprite)),'raider.png'].map(s=>[s,{naturalWidth:32,naturalHeight:32}]));return new Renderer(c,data,imgs);}
test('UUID animation seeds are finite and stable',()=>{const id=crypto.randomUUID();assert.ok(Number.isFinite(phaseSeed(id)));assert.equal(phaseSeed(id),phaseSeed(id));});
test('phone DPR and zoom preserve placement coordinates',()=>{const r=renderer();r.resize(390,844,2);r.cam={x:10,y:8,zoom:1.6};const p=r.project(7.5,5.5);assert.deepEqual(r.cell({clientX:p.x,clientY:p.y}),{x:7,y:5});assert.equal(r.canvas.width,780);});
test('pinch stays anchored to the world point under fingers',()=>{const r=renderer();r.resize(390,844,2);const before=r.worldPoint(200,400);r.zoomAt(1.3,200,400);const after=r.worldPoint(200,400);assert.ok(Math.abs(before.x-after.x)<1e-9);assert.ok(Math.abs(before.y-after.y)<1e-9);});
test('every rendered primitive receives finite coordinates with real UUIDs',()=>{const g=new Game(data),r=renderer();r.resize(390,844,2);r.fitVillage(g.world);for(const b of g.world.buildings)b.harvestBonus=200;for(const time of [1000,2500,6000])assert.doesNotThrow(()=>r.draw(g.world,time));assert.ok(r.hitAreas.some(h=>h.kind==='unit'));assert.ok(r.hitAreas.some(h=>h.kind==='harvest'));});
test('bonus harvest is capped, explicit, and cannot be claimed twice',()=>{const g=new Game(data),b=g.world.buildings.find(b=>b.type==='farm');b.harvestBonus=11.5;const stock=g.world.resources.food;assert.equal(g.harvest(b.id),11);assert.equal(g.world.resources.food,stock+11);assert.equal(g.harvest(b.id),false);b.harvestBonus=100;g.tick(.05);assert.ok(b.harvestBonus<=reserveCapacity(data.buildings.farm,b.level));g.paused=true;assert.equal(g.harvest(b.id),false);});
test('move orders reject blocked and off-map destinations',()=>{const g=new Game(data),u=g.world.troops[0];assert.equal(g.commandMove(u.id,-1,5),false);assert.equal(g.commandMove(u.id,9,7),false);assert.equal(u.order,null);});
