import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {characterModel} from '../src/character-art.js';
import {RARITY_INFO} from '../src/systems/crafting.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const r=new Renderer({getContext:()=>({})},data,{});r.cam.x=0;r.cam.y=0;
function mesh(u,time=0,enemy=false){const s=new MeshScene(r);characterModel(s,u,data,time,enemy);return s.faces;}
function valid(faces,id){
 assert.ok(faces.length>0&&faces.length<160,'bounded mesh cost');
 assert.ok(faces.every(f=>f.owner?.id===id&&/^#[0-9a-f]{6}$/i.test(f.color)&&Number.isFinite(f.depth)&&f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
}
function silhouette(gear){return createHash('sha256').update(mesh({id:'tool-'+gear,type:'warrior',hp:100,x:0,y:0,gear}).map(f=>JSON.stringify(f.points.flatMap(p=>[Math.round(p.x*100)/100,Math.round(p.y*100)/100]))).sort().join('|')).digest('hex').slice(0,16);}
function appearance(type){return createHash('sha256').update(mesh({id:'outfit-probe',type,hp:100,x:0,y:0,gear:''}).map(f=>JSON.stringify([f.color,...f.points.flatMap(p=>[Math.round(p.x*100)/100,Math.round(p.y*100)/100])])).sort().join('|')).digest('hex').slice(0,16);}
function outfitShape(type){return createHash('sha256').update(mesh({id:'outfit-probe',type,hp:100,x:0,y:0,gear:''}).map(f=>JSON.stringify(f.points.flatMap(p=>[Math.round(p.x*100)/100,Math.round(p.y*100)/100]))).sort().join('|')).digest('hex').slice(0,16);}
function coatColor(type){const counts=new Map(),professionColor=data.troops[type].color;for(const face of mesh({id:'outfit-probe',type,hp:100,x:0,y:0,gear:''}))if(Math.abs(face.center[0])<=.15&&Math.abs(face.center[1])<=.115&&face.center[2]>=.25&&face.center[2]<=.56&&face.color!==professionColor)counts.set(face.color,(counts.get(face.color)||0)+1);return [...counts].sort((a,b)=>b[1]-a[1])[0][0];}
test('every profession and equipped item renders valid selectable geometry through a full orbit',()=>{
 const villagers=Object.entries(data.troops).map(([type,spec])=>({id:type,type,hp:100,x:0,y:0,gear:spec.defaultGear}));
 villagers.push(...Object.entries(data.items).map(([id,item])=>({id,type:item.roles[0],hp:100,x:0,y:0,gear:item.slot==='armor'?'sword':id,armor:item.slot==='armor'?id:null})));
 const before=JSON.stringify(villagers);
  for(const zoom of [.6,1.65,2])for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
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
test('held tool archetypes keep distinct silhouettes at gameplay zoom',()=>{
 r.cam.zoom=1.65;r.cam.yaw=Math.PI/4;r.calm=true;
 const gear=['sword','axe','warhammer','hammer','forgehammer','bow','longbow','pike','halberd','pickaxe','fellingaxe','cleaver','sickle','scythe','rod','crook','net','cart','berry-basket','tome','compass','chalice','orrery','scales','tidebell','toolkit','armorkit','tinkerkit','awl','trowel','tongs'];
 const byGear=new Map(gear.map(id=>[id,silhouette(id)])),groups=new Map();
 for(const [id,shape]of byGear){const group=groups.get(shape)||[];group.push(id);groups.set(shape,group);}
 assert.deepEqual([...groups.values()].filter(group=>group.length>1),[],'weapon and profession-tool silhouettes should not collapse to the same mesh');
 for(const [variant,base]of[['frontier_sword','sword'],['oathblade','sword'],['starforged-oathblade','sword'],['squires-blade','sword'],['frontier_axe','axe'],['frostaxe','axe'],['woodcutteraxe','axe'],['frontier_warhammer','warhammer'],['frontier_hammer','hammer'],['runed-forgehammer','forgehammer'],['frontier_pickaxe','pickaxe'],['glasspick','pickaxe'],['frontier_sickle','sickle'],['herding-crook','crook'],['brass-chalice','chalice'],['siege-tongs','tongs'],['starforged-halberd','halberd'],['starforged-longbow','longbow'],['hymnal','tome'],['primer','tome']])assert.equal(silhouette(variant),byGear.get(base),`${variant} keeps the ${base} archetype`);
});
test('relic and workshop gear avoid per-frame pyramid tessellation',()=>{
 r.cam.zoom=1.65;r.cam.yaw=Math.PI/4;r.calm=true;
 const pyramids=gear=>{const s=new MeshScene(r),pyramid=s.pyramid;let calls=0;s.pyramid=(...args)=>{calls++;return pyramid.apply(s,args);};characterModel(s,{id:gear||'plain',type:'warrior',hp:100,x:0,y:0,gear},data,0);return calls;};
 for(const gear of ['compass','orrery','tidebell','awl','trowel'])assert.equal(pyramids(gear),pyramids(''),`${gear} should use box primitives without tessellating a pyramid`);
});
test('net lattice is deferred until close character detail',()=>{
 r.cam.yaw=Math.PI/4;r.calm=true;
 const count=(gear,zoom)=>{r.cam.zoom=zoom;return mesh({id:'net-detail',type:'diver',hp:100,x:0,y:0,gear}).length;};
 const gameDetail=count('net',1.65)-count('',1.65),closeDetail=count('net',2)-count('',2);
 assert.ok(closeDetail>gameDetail,'the gameplay-scale net keeps its frame but defers lattice strings');
});
test('bows keep a visible string when detail trim is off',()=>{
 r.cam.zoom=1.65;r.cam.yaw=Math.PI/4;r.calm=true;
 for(const gear of ['bow','longbow'])assert.ok(mesh({id:gear,type:'archer',hp:100,x:0,y:0,gear}).some(face=>face.color==='#ddcfac'),`${gear} string stays visible at gameplay zoom`);
});
test('profession outfits remain distinct at gameplay zoom',()=>{
 r.cam.zoom=1.65;r.cam.yaw=Math.PI/4;r.calm=true;
 const types=Object.keys(data.troops),styles=types.map(appearance);
 assert.equal(new Set(styles).size,types.length,'each profession keeps a readable outfit signature without fine trim');
 const color=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),[a,b]=[color(coatColor('archer')),color(coatColor('longbowman'))];
 assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])>=40,'the two hooded archer callings need distinct coat colors at gameplay zoom');
});
test('profession accents use troop colors without adding mesh faces',()=>{
 r.cam.zoom=1.65;r.cam.yaw=Math.PI/4;r.calm=true;
 for(const [type,spec]of Object.entries(data.troops)){
  const unit={id:'profession-'+type,type,hp:100,x:0,y:0,gear:''},faces=mesh(unit);
  assert.ok(faces.some(face=>face.color===spec.color),`${type} displays its data color`);
  const withoutColor={...data,troops:{...data.troops,[type]:{...spec,color:null}}},plain=new MeshScene(r);
  characterModel(plain,unit,withoutColor,0);
  assert.equal(faces.length,plain.faces.length,`${type} accent should reuse existing mesh faces`);
 }
});
test('crafted gear and armor display every data-driven rarity color',()=>{
 r.cam.zoom=1.65;r.cam.yaw=Math.PI/4;r.calm=true;
 const items=Object.entries(data.items).filter(([,item])=>item.rarity);
 assert.deepEqual([...new Set(items.map(([,item])=>item.rarity))].sort(),Object.keys(RARITY_INFO).sort(),'crafted item data covers the rarity ladder');
 for(const [id,item]of items){
  const armor=item.slot==='armor',faces=mesh({id:'rarity-'+id,type:item.roles[0],hp:100,x:0,y:0,gear:armor?'':id,armor:armor?id:null});
  assert.ok(faces.some(face=>face.color===RARITY_INFO[item.rarity].color),`${id} displays ${item.rarity} trim`);
 }
});
test('unknown rarity keys stay valid mesh colors for gear and armor',()=>{
 r.cam.zoom=1.65;r.cam.yaw=Math.PI/4;r.calm=true;
 const items={...data.items,'ash-blade':{...data.items['ash-blade'],rarity:'constructor'},'levy-gambeson':{...data.items['levy-gambeson'],rarity:'__proto__'}},invalidData={...data,items};
 for(const [id,unit]of[['ash-blade',{id:'unknown-gear',type:'warrior',hp:100,x:0,y:0,gear:'ash-blade'}],['levy-gambeson',{id:'unknown-armor',type:'warrior',hp:100,x:0,y:0,gear:'sword',armor:'levy-gambeson'}]]){
  const s=new MeshScene(r);characterModel(s,unit,invalidData,0);
  assert.ok(s.faces.every(face=>/^#[0-9a-f]{6}$/i.test(face.color)),`${id} keeps every face color paintable`);
 }
});
test('professions sharing an outfit shape keep clear coat-color contrast',()=>{
 r.cam.zoom=1.65;r.cam.yaw=Math.PI/4;r.calm=true;
 const appearances=Object.keys(data.troops).map(type=>({type,shape:outfitShape(type),color:coatColor(type)})),groups=new Map();
 for(const outfit of appearances){const group=groups.get(outfit.shape)||[];group.push(outfit);groups.set(outfit.shape,group);}
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 for(const group of groups.values())for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
  const a=rgb(group[i].color),b=rgb(group[j].color),distance=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  assert.ok(distance>=40,`${group[i].type}/${group[j].type} need distinct coat colors at gameplay zoom (got ${distance.toFixed(1)})`);
 }
});
test('professions with the same headwear get a visible garment cue',()=>{
 r.cam.zoom=1.65;r.cam.yaw=Math.PI/4;r.calm=true;
 for(const [a,b]of[['archer','forager'],['builder','haggler'],['warrior','warden'],['lumberjack','sawyer'],['sawyer','weaponsmith']])assert.notEqual(outfitShape(a),outfitShape(b),`${a} and ${b} need distinguishable game-scale clothing shapes`);
 const color=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),[a,b]=[color(coatColor('weaponsmith')),color(coatColor('smelter'))];
 assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])>=40,'smelter and weaponsmith aprons need distinct coat colors');
});
test('sawyer goggles do not duplicate lens faces at close detail',()=>{
 r.cam.zoom=2;r.cam.yaw=Math.PI/4;r.calm=true;
 const lenses=mesh({id:'sawyer',type:'sawyer',hp:100,x:0,y:0,gear:''}).filter(face=>face.color==='#c7d6d6');
 const geometry=face=>JSON.stringify(face.points.flatMap(p=>[Math.round(p.x*100)/100,Math.round(p.y*100)/100]));
 assert.ok(lenses.length>0,'both goggle lenses remain visible');
 assert.equal(new Set(lenses.map(geometry)).size,lenses.length,'each visible lens face is emitted once');
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
