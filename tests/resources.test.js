import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RESOURCES,resourceInfo,resourceLabel,layoutCollectionBubbles,collectionBubbleScale,collectionTotals,isCollectionCrowded,reserveReady} from '../src/resources.js';
import {Renderer} from '../src/renderer.js';
import {Game} from '../src/game.js';
import {makeBuilding} from '../src/model.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('all production resources have named, distinct original icons',async()=>{
 for(const key of new Set(Object.values(data.buildings).map(b=>b.production).filter(Boolean))){
  const r=RESOURCES[key];assert.ok(r,key);assert.ok((await readFile(new URL(`../assets/sprites/${r.sprite}`,import.meta.url),'utf8')).includes('<svg'));
  assert.equal(resourceLabel(key,40.9),`+40 ${r.label}`);
 }
  assert.equal(new Set(Object.values(RESOURCES).map(r=>r.sprite)).size,10);
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


test('collection density follows zoom while full storage keeps sparse markers',()=>{
 assert.equal(isCollectionCrowded(0,{},null,.7),false);
 assert.equal(isCollectionCrowded(1,{},null,.7),true);
 assert.equal(isCollectionCrowded(7,{},null,1.65),false);
 assert.equal(isCollectionCrowded(8,{},null,1.65),true);
 assert.equal(isCollectionCrowded(8,{},null,2.5),false);
 assert.equal(isCollectionCrowded(7,{},null,1.2),true);
 assert.equal(isCollectionCrowded(1,{gold:430},()=>0,1.65),false);
});

test('marker touch targets do not shrink with icon scale or overlap blocked space',()=>{
 const rows=layoutCollectionBubbles([{id:1,x:100,y:100,width:28,height:28}],390,844);
 assert.equal(rows[0].w,44);assert.equal(rows[0].h,44);
 assert.equal(layoutCollectionBubbles([{x:100,y:100,width:44}],390,844,[{x:0,y:0,w:390,h:844}]).length,0);
});

test('compact markers use SVG icons, reveal full-store amounts on tap and become quiet dots at overview',()=>{
 const texts=[],icons=[];
 const ctx=new Proxy({measureText:text=>({width:text.length*6}),fillText:text=>texts.push(text),drawImage:icon=>icons.push(icon)},
  {get:(target,key)=>key in target?target[key]:()=>{}});
 const icon={},r=new Renderer({getContext:()=>ctx},data,{'resource-gold.svg':icon});
 const b=makeBuilding('mine',5,5,data);b.harvestBonus=430;
 const world={buildings:[b],resources:{gold:1e9}};
 r.cam.zoom=1.65;r.project=()=>({x:180,y:400});r.width=390;r.height=844;
 r.drawCollections(world);
 assert.equal(r.collectionCrowded,false);assert.equal(r.hitAreas.length,1);
 const hit=r.hitAreas[0];assert.equal(hit.w,44);assert.equal(hit.h,44);
 assert.deepEqual(icons,[icon]);assert.deepEqual(texts,['!']);
 assert.equal(hit.label,'Gold storage full ? 430 waiting here.');
 assert.equal(r.pick(hit.x+22,hit.y+22).id,b.id);
 r.hitAreas=[];texts.length=0;r.drawCollections(world);
 assert.ok(texts.includes(hit.label));
 r.collectionDetail=null;r.cam.zoom=.7;r.hitAreas=[];texts.length=0;r.drawCollections(world);
 assert.equal(r.collectionCrowded,true);assert.equal(r.hitAreas.length,1);
 assert.deepEqual(texts,[]);assert.equal(r.hitAreas[0].w,44);assert.equal(r.hitAreas[0].h,44);
});

test('readiness keeps tier thresholds and excludes construction and ruins',()=>{
 const spec={production:'gold',harvest:{capacity:500,notifyAt:150,perTier:500}};
 const b={hp:100,remaining:0,level:2,harvestBonus:299};
 assert.equal(reserveReady(b,spec),false);b.harvestBonus=300;
 assert.equal(reserveReady(b,spec),true);b.remaining=1;
 assert.equal(reserveReady(b,spec),false);b.remaining=0;b.hp=0;
 assert.equal(reserveReady(b,spec),false);
});
