// Building detail pass — props should make workplaces readable without menus,
// while staying renderer-only and cheap at distant zoom.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel} from '../src/scene3d.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])
));
const context=new Proxy({},{
 get:(t,k)=>t[k]||(()=>k==='measureText'?{width:40}:k.includes('Gradient')?{addColorStop(){}}:undefined),
 set:(t,k,v)=>(t[k]=v,true)
});

function model(type,level=1,zoom=1.8,overrides={}){
 const r=new Renderer({getContext:()=>context},data,{});
 r.resize(1280,900,1);r.cam.x=6;r.cam.y=6;r.cam.zoom=zoom;r.cam.yaw=Math.PI/4;
 const s=new MeshScene(r),b={id:`${type}-detail`,type,x:5,y:5,level,hp:100,remaining:0,...overrides};
 buildingModel(s,b,data.buildings[type],{buildings:[b]},0);
 return s.faces;
}
const has=(faces,color)=>faces.some(f=>f.color===color);

test('detail pass: military and production workplaces carry readable job props',()=>{
 const barracks=model('barracks',2),forge=model('forge',2),mine=model('mine',2);
 assert.ok(has(barracks,'#aebbbb'),'barracks has a spear on its training rack');
 assert.ok(has(barracks,'#9dadab'),'barracks has an axe/training tool');
 assert.ok(has(forge,'#9fd0d0'),'forge has a visible quench trough');
 assert.ok(has(forge,'#383b38'),'forge has a coal bin');
 assert.ok(has(mine,'#687170'),'mine has short yard rails');
 assert.ok(has(mine,'#414845'),'mine cart has dark wheels');
});

test('detail pass: field and trade props scale up with building tiers',()=>{
 const farm1=model('farm',1),farm3=model('farm',3),lumber1=model('lumber',1),lumber2=model('lumber',2);
 assert.ok(has(farm1,'#d5bf8f'),'farm tier 1 already has a seed sack');
 assert.ok(has(farm3,'#53544e'),'farm tier 3 gains the banded water barrel');
 assert.ok(!has(lumber1,'#b88a55'),'tier 1 lumber yard has no upgraded crate lid');
 assert.ok(has(lumber2,'#b88a55'),'tier 2 lumber yard gains a supply crate');
});

test('detail pass: fine props drop out when zoomed away',()=>{
 const near=model('farm',2,1.8),far=model('farm',2,1.1);
 assert.ok(near.length>far.length,`near view adds detail faces (${far.length} -> ${near.length})`);
 assert.ok(has(near,'#d5bf8f'),'near view keeps sacks');
 assert.ok(!has(far,'#d5bf8f'),'distant view drops the detail layer');
});

test('detail pass: ruins and construction do not show finished workplace clutter',()=>{
 const building=model('forge',2,1.8,{remaining:25}),ruin=model('forge',2,1.8,{hp:0});
 assert.ok(!has(building,'#9fd0d0'),'construction hides the finished quench trough');
 assert.ok(!has(ruin,'#9fd0d0'),'ruins hide the finished quench trough');
});
