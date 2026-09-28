import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {characterModel} from '../src/character-art.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const r=new Renderer({getContext:()=>({})},data,{});r.cam.x=0;r.cam.y=0;
function mesh(u,time=0,enemy=false){const s=new MeshScene(r);characterModel(s,u,data,time,enemy);return s.faces;}
function valid(faces,id){
 assert.ok(faces.length>0&&faces.length<160,'bounded mesh cost');
 assert.ok(faces.every(f=>f.owner?.id===id&&/^#[0-9a-f]{6}$/i.test(f.color)&&Number.isFinite(f.depth)&&f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
}
test('every profession and equipped item renders valid selectable geometry through a full orbit',()=>{
 const villagers=Object.entries(data.troops).map(([type,spec])=>({id:type,type,hp:100,x:0,y:0,gear:spec.defaultGear}));
 villagers.push(...Object.entries(data.items).map(([id,item])=>({id,type:item.roles[0],hp:100,x:0,y:0,gear:item.slot==='armor'?'sword':id,armor:item.slot==='armor'?id:null})));
 const before=JSON.stringify(villagers);
 for(const zoom of [.6,2])for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  r.cam.zoom=zoom;r.cam.yaw=yaw;
  for(const u of villagers)valid(mesh(u),u.id);
 }
 assert.equal(JSON.stringify(villagers),before,'art never changes saved units or equipment');
});
test('reduced motion is stable, far zoom simplifies detail, and defeated villagers stay hidden',()=>{
 const u={id:'test',type:'warrior',hp:100,x:0,y:0,gear:'sword',armor:'steel-chain',animation:.2};
 r.cam.zoom=2;r.calm=true;
 assert.deepEqual(mesh(u,100),mesh(u,3000));
 const near=mesh(u).length;r.cam.zoom=.6;
 assert.ok(mesh(u).length<near);
 assert.equal(mesh({...u,hp:0}).length,0);
});
test('enemy role and faction silhouettes preserve enemy selection and emergency markers',()=>{
 r.cam.zoom=2;
 for(const faction of data.world.enemyFactions)for(const role of ['archer','breaker','scout','raider']){
  const u={id:role,hp:50,x:0,y:0,role,faction:faction.id};
  const faces=mesh(u,0,true);valid(faces,u.id);assert.ok(faces.every(f=>f.owner.kind==='enemy'));
 }
 const u={id:'healer',type:'healer',hp:100,x:0,y:0,gear:'chalice',emergency:{kind:'heal'},carry:10};
 valid(mesh(u),u.id);
});
test('crowded scenes reduce trim and offscreen characters create no faces',()=>{
 r.cam.zoom=3;
 const u={id:'archer',type:'archer',hp:100,x:0,y:0,gear:'bow'};
 const full=mesh(u),s=new MeshScene(r);s.characterDetail=false;characterModel(s,u,data,0);
 valid(s.faces,u.id);assert.ok(s.faces.length<full.length);
 assert.equal(mesh({...u,x:1000,y:1000}).length,0);
});
