import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {characterModel,enemyGearFor,workMotionFor} from '../src/character-art.js';

const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const r=new Renderer({getContext:()=>({})},data,{});
r.cam.x=0;r.cam.y=0;
function mesh(u,time=0,enemy=false){
 const s=new MeshScene(r);
 s.characterDetail=true;
 characterModel(s,u,data,time,enemy);
 return s.faces;
}
function valid(faces,id,kind='unit'){
 assert.ok(faces.length>0&&faces.length<160,`${id} bounded mesh cost (${faces.length})`);
 assert.ok(faces.every(f=>f.owner?.kind===kind&&f.owner?.id===id),`${id} selectable through owner tags`);
 assert.ok(faces.every(f=>/^#[0-9a-f]{6}$/i.test(f.color)&&Number.isFinite(f.depth)&&f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),`${id} keeps flat hex, finite geometry`);
}

test('every troop type renders valid bounded selectable geometry through a full orbit',()=>{
 r.calm=true;
 const before=JSON.stringify(data.troops);
 for(const zoom of [.6,1.65,2])for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  r.cam.zoom=zoom;r.cam.yaw=yaw;
  for(const [type,spec] of Object.entries(data.troops)){
   const u={id:`orbit-${type}`,type,hp:100,x:0,y:0,gear:spec.defaultGear};
   valid(mesh(u),u.id);
  }
 }
 assert.equal(JSON.stringify(data.troops),before,'renderer never mutates troop data');
});

test('hand tool pivot and carried cargo stay attached to the rebuilt body',()=>{
 r.calm=true;r.cam.zoom=2;r.cam.yaw=Math.PI/4;
 const farmer={id:'pivot-farmer',type:'farmer',hp:100,x:0,y:0,gear:''};
 const pivot=f=>Math.abs(f.center[0]-.24)<=.14&&Math.abs(f.center[1])<=.16&&f.center[2]>=.28&&f.center[2]<=.76;
 const bare=mesh(farmer).filter(pivot),armed=mesh({...farmer,gear:'sword'}).filter(pivot);
 assert.ok(armed.length>bare.length,'equipped tool adds geometry at the [x+.24,y,.34] pivot');
 assert.ok(armed.some(f=>f.color==='#b7c8ca'),'steel blade sits on the hand pivot');
 const empty=mesh({id:'haul-empty',type:'lumberjack',hp:100,x:0,y:0,gear:'',carry:0});
 const loaded=mesh({id:'haul-full',type:'lumberjack',hp:100,x:0,y:0,gear:'',carry:5});
 const cargo=f=>f.center[1]<-.2&&f.center[2]>=.25&&f.center[2]<=.62;
 assert.equal(empty.filter(cargo).length,0,'no cargo geometry without a carried load');
 assert.ok(loaded.filter(cargo).some(f=>f.color==='#9d744a'),'wood bundles attach behind the new torso');
 const moved=mesh({id:'haul-moved',type:'lumberjack',hp:100,x:3,y:2,gear:'',carry:5});
 assert.ok(moved.some(f=>f.color==='#9d744a'&&f.center[0]>2.7&&f.center[1]>1.4&&f.center[1]<1.9),'cargo follows the unit');
 const smith={id:'pivot-smith',type:'weaponsmith',hp:100,x:0,y:0,gear:'forgehammer',workplace:'forge',order:null};
 assert.equal(workMotionFor(smith,data.troops.weaponsmith,700,true),0,'calm pins the work lift');
 assert.ok([100,250,400,550,700,850].some(t=>workMotionFor(smith,data.troops.weaponsmith,t,false)!==0),'posted work still drives the hand lift');
});

test('calm mode keeps the rebuilt bodies frozen across time',()=>{
 r.calm=true;r.cam.zoom=2;r.cam.yaw=Math.PI/4;
 const cases=[
  {id:'calm-swing',type:'warrior',hp:100,x:0,y:0,gear:'sword',animation:.3},
  {id:'calm-haul',type:'lumberjack',hp:100,x:0,y:0,gear:'fellingaxe',carry:5,phase:'gather',workplace:'timber',order:null},
  {id:'calm-repair',type:'builder',hp:100,x:0,y:0,gear:'hammer',emergency:{kind:'repair'}},
 ];
 for(const u of cases)assert.deepEqual(mesh(u,100),mesh(u,3000),`${u.id} stays frozen under calm`);
 assert.equal(workMotionFor(cases[2],data.troops.builder,700,true),0,'calm freezes every work pose');
});

test('faction overlays stay present on the rebuilt enemy bodies',()=>{
 r.calm=true;r.cam.zoom=2;r.cam.yaw=Math.PI/4;
 assert.equal(enemyGearFor({role:'archer'}),'bow');
 assert.equal(enemyGearFor({role:'breaker'}),'warhammer');
 const markers={'pale-host':['#d8d3c2','#1c2226'],'pale-court':['#d8d3c2','#1c2226','#e8c673'],'thornband':['#4a5a3f'],'cinder-clan':['#3a3d3f'],'ember-legion':['#b6402e']};
 for(const faction of data.world.enemyFactions){
  const colors=new Set();
  for(const role of ['raider','scout','archer','breaker','ram','bombard']){
   const u={id:`${faction.id}-${role}`,hp:50,x:0,y:0,role,faction:faction.id};
   const faces=mesh(u,0,true);valid(faces,u.id,'enemy');faces.forEach(f=>colors.add(f.color));
  }
  for(const color of markers[faction.id])assert.ok(colors.has(color),`${faction.id} keeps its ${color} overlay`);
 }
 const cinder=new Set(mesh({id:'boss-cinder',hp:50,x:0,y:0,role:'boss',bossId:'cinder-maul',faction:'boss'},0,true).map(f=>f.color));
 const queen=new Set(mesh({id:'boss-queen',hp:50,x:0,y:0,role:'boss',bossId:'pale-queen',faction:'boss'},0,true).map(f=>f.color));
 assert.ok(cinder.has('#6b4637')&&queen.has('#d8ddea')&&queen.has('#dfba6a'),'bosses keep distinct silhouettes');
 assert.notDeepEqual([...cinder].sort(),[...queen].sort(),'the two bosses never collapse to one read');
});

test('profession landmarks read on the rebuilt bodies',()=>{
 r.calm=true;r.cam.zoom=2;r.cam.yaw=Math.PI/4;
 const faces=(type,extra={})=>mesh({id:`read-${type}`,type,hp:100,x:0,y:0,gear:data.troops[type].defaultGear,...extra});
 assert.ok(faces('farmer').some(f=>f.color==='#cbb176'),'farmer keeps the straw brim');
 assert.ok(faces('farmer').some(f=>f.color==='#987046'&&f.center[0]<=-.2&&f.center[2]<.5),'farmer keeps the hip basket');
 assert.ok(faces('miner').some(f=>f.color==='#f6df9a'&&f.emissive>0),'miner keeps the glowing lamp');
 assert.ok(faces('miner').some(f=>f.color==='#4a5560'&&f.center[2]<.12),'miner boots read at the feet');
 assert.ok(faces('builder').some(f=>f.color==='#8a6f4a'&&f.center[2]>.3),'builder vest');
 assert.ok(faces('builder').some(f=>f.color==='#dfba6a'),'builder belt buckle');
 assert.ok(faces('weaponsmith').some(f=>f.color==='#d3b58b'),'smith apron');
 assert.ok(faces('scholar').some(f=>f.color==='#7588b0'&&f.center[2]<.3),'scholar robe hem');
 assert.ok(faces('archer').some(f=>f.color==='#d9cda5'),'archer quiver fletching');
});
