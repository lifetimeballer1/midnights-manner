import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {characterModel,workMotionFor} from '../src/character-art.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])
));
const context={};
const r=new Renderer({getContext:()=>context},data,{});
r.resize(900,700,1);r.cam.x=0;r.cam.y=0;r.cam.zoom=1.8;r.cam.yaw=Math.PI/4;
function faces(unit,time=700){
 const s=new MeshScene(r);characterModel(s,unit,data,time,false);return s.faces;
}
function colors(unit){return new Set(faces(unit).map(f=>f.color));}
function hasMotion(unit,type){
 const troop=data.troops[type];
 return [100,250,400,550,700,850].some(t=>Math.abs(workMotionFor(unit,troop,t,false))>.01);
}

test('working pose: posted trades and active collectors move their held tools',()=>{
 const smith={id:'smith',type:'weaponsmith',hp:100,gear:'forgehammer',workplace:'forge',order:null};
 const farmer={id:'farmer',type:'farmer',hp:100,gear:'sickle',workplace:'farm',phase:'gather',carry:4,order:null};
 assert.equal(hasMotion(smith,'weaponsmith'),true);
 assert.equal(hasMotion(farmer,'farmer'),true);
 assert.equal(hasMotion({...farmer,carry:0},'farmer'),false,'collector waits until it is actually gathering');
 assert.equal(hasMotion({...smith,order:{kind:'move'}},'weaponsmith'),false,'manual order suppresses work pose');
});

test('working pose: repair builders work, calm mode freezes every job pose',()=>{
 const builder={id:'builder',type:'builder',hp:100,gear:'hammer',emergency:{kind:'repair'}};
 assert.equal(hasMotion(builder,'builder'),true);
 assert.equal(workMotionFor(builder,data.troops.builder,700,true),0);
 const combat={id:'fighter',type:'warrior',hp:100,gear:'sword',animation:.2};
 assert.notEqual(workMotionFor(combat,data.troops.warrior,700,false),0,'combat animation still has priority');
});

test('carried loads identify wood, frostwood, ore and food at gameplay zoom',()=>{
 const wood=colors({id:'wood',type:'lumberjack',hp:100,x:0,y:0,gear:'fellingaxe',carry:5});
 const frost=colors({id:'frost',type:'woodward',hp:100,x:0,y:0,gear:'frostaxe',carry:5});
 const ore=colors({id:'ore',type:'miner',hp:100,x:0,y:0,gear:'pickaxe',carry:5});
 const grain=colors({id:'grain',type:'farmer',hp:100,x:0,y:0,gear:'sickle',carry:5});
 assert.ok(wood.has('#9d744a'),'wood uses warm log bundles');
 assert.ok(frost.has('#91b5bd'),'frostwood uses pale blue logs');
 assert.ok(ore.has('#d2bb73'),'moonstone load exposes gold ore');
 assert.ok(grain.has('#c9b37d'),'farm food uses a grain sack');
});

test('fisher cargo reads as a creel instead of a generic farm sack',()=>{
 const fish=colors({id:'fish',type:'fisherman',hp:100,x:0,y:0,gear:'rod',carry:5});
 assert.ok(fish.has('#8c704e'),'fisher carries a woven creel');
 assert.ok(fish.has('#8bc7d0'),'close-detail creel shows fish');
 assert.equal(fish.has('#c9b37d'),false,'fisher cargo does not reuse the grain sack');
});
