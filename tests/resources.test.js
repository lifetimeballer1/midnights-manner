import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RESOURCES,resourceInfo,resourceLabel,layoutCollectionBubbles,collectionBubbleScale,collectionTotals} from '../src/resources.js';
import {Game} from '../src/game.js';
import {makeBuilding} from '../src/model.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('all production resources have named, distinct original icons',async()=>{
 for(const key of new Set(Object.values(data.buildings).map(b=>b.production).filter(Boolean))){
  const r=RESOURCES[key];assert.ok(r,key);assert.ok((await readFile(new URL(`../assets/sprites/${r.sprite}`,import.meta.url),'utf8')).includes('<svg'));
  assert.equal(resourceLabel(key,40.9),`+40 ${r.label}`);
 }
 assert.equal(new Set(Object.values(RESOURCES).map(r=>r.sprite)).size,8);
 assert.equal(resourceInfo('new-resource').label,'new-resource');
});
test('zoomed-out collection labels scale without losing readable targets',()=>{
 assert.equal(collectionBubbleScale(1.65),1);assert.ok(collectionBubbleScale(.7)<1);assert.ok(collectionBubbleScale(.7)>=.68);
});
test('dense collection labels stay separated and inside a phone viewport',()=>{
 const rows=layoutCollectionBubbles(Array.from({length:5},(_,i)=>({id:i,x:195+i*4,y:400,width:120})),390,844);
 assert.equal(rows.length,5);
 for(let i=0;i<rows.length;i++){
  const a=rows[i];assert.ok(a.x>=0&&a.x+a.w<=390&&a.y>=0&&a.y+a.h<=844);assert.ok(a.h>=40);
  for(const b of rows.slice(i+1))assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y));
 }
});
test('resource overview counts only collectable bonuses and collection feedback names them',()=>{
 const g=new Game(data);g.world.buildings=[];
 for(const [type,bonus,hp,remaining] of [['farm',8.9,100,0],['farm',5,0,0],['lumber',12,100,3],['mine',4.8,100,0]]){
  const b=makeBuilding(type,2,2,data);Object.assign(b,{harvestBonus:bonus,hp,remaining});g.world.buildings.push(b);
 }
 assert.deepEqual(collectionTotals(g.world,data),{food:8,gold:4});
 assert.equal(g.harvest(g.world.buildings[0].id),8);assert.equal(g.world.effects.at(-1).text,'+8 Food');
 assert.deepEqual(collectionTotals(g.world,data),{gold:4});
});

test('collection labels avoid HUD controls',()=>{
 const hud={x:260,y:0,w:130,h:400};
 const rows=layoutCollectionBubbles([{id:1,x:330,y:290,width:110}],390,844,[hud]);
 assert.equal(rows.length,1);
 for(const a of rows)assert.ok(!(a.x<hud.x+hud.w&&a.x+a.w>hud.x&&a.y<hud.y+hud.h&&a.y+a.h>hud.y));
});
