import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel,drawVillage3D} from '../src/scene3d.js';

const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const context=new Proxy({}, {get:(t,k)=>t[k]||(()=>k==='measureText'?{width:40}:k.includes('Gradient')?{addColorStop(){}}:undefined),set:(t,k,v)=>(t[k]=v,true)});
function renderer(){const r=new Renderer({getContext:()=>context},data,{});r.resize(1280,900,1);r.cam.x=9;r.cam.y=9;r.cam.zoom=1.8;r.cam.yaw=Math.PI/4;return r;}
function building(type,id=type,x=5,y=5,fields={}){return {id,type,x,y,level:1,hp:100,remaining:0,cooldown:0,...fields};}
function world(buildings=[],enemies=[]){return {buildings,enemies,troops:[],elapsed:0};}
function mesh(r,b,w,time=0){const s=new MeshScene(r);buildingModel(s,b,data.buildings[b.type],w,time);return s.faces;}
function geometry(faces){return createHash('sha256').update(faces.map(f=>JSON.stringify([f.color,...f.points.flatMap(p=>[Math.round(p.x*100)/100,Math.round(p.y*100)/100])])).sort().join('|')).digest('hex').slice(0,16);}
class RecordingMeshScene extends MeshScene{
 constructor(r){super(r);this.boxes=[];}
 box(x,y,z,w,d,h,color,cap=true){this.boxes.push([x,y,z,w,d,h,color]);super.box(x,y,z,w,d,h,color,cap);}
}

test('walls cap exposed run ends, not connected through-arms',()=>{
 const render=neighbors=>{const b=building('wall','center'),buildings=[b,...neighbors.map(([dx,dy],i)=>building('wall',`n${i}`,5+dx,5+dy))];return mesh(renderer(),b,world(buildings));};
 const caps=faces=>faces.filter(f=>f.color==='#c5a06a').length;
 const through=render([[-1,0],[1,0]]),end=render([[1,0]]),corner=render([[1,0],[0,1]]),tee=render([[-1,0],[1,0],[0,1]]);
 assert.equal(caps(through),0,'a continuous run has no false end caps');
 assert.ok(caps(end)>0,'the free end of a run is capped');
 assert.ok(caps(corner)>caps(tee),'a corner exposes two ends while a tee exposes one');
});

test('wall end caps touch the wall body',()=>{
 const b=building('wall','end'),neighbor=building('wall','neighbor',6,5),s=new RecordingMeshScene(renderer());
 buildingModel(s,b,data.buildings.wall,world([b,neighbor]));
 const core=s.boxes.find(box=>box[0]===b.x+.28&&box[1]===b.y+.28&&box[2]===.1&&box[3]===.44&&box[4]===.44&&box[6]==='#b38a59');
 const cap=s.boxes.find(box=>box[6]==='#c5a06a');
 const overlapX=Math.min(core[0]+core[3],cap[0]+cap[3])-Math.max(core[0],cap[0]);
 const overlapY=Math.min(core[1]+core[4],cap[1]+cap[4])-Math.max(core[1],cap[1]);
 assert.ok(overlapX>0&&overlapY>0,'the end cap overlaps the structural core instead of floating beside it');
});

test('connected gate arms leave the raised portal clear',()=>{
 const cases=[['x',[building('wall','west',4,5),building('wall','east',6,5)]],['y',[building('wall','north',5,4),building('wall','south',5,6)]],['x',[building('wall','tee-west',4,5),building('wall','tee-east',6,5),building('wall','tee-north',5,4)]]];
 for(const [axis,neighbors]of cases){
  const r=renderer(),gate=building('gate',`gate-${axis}`),w=world([gate,...neighbors]),s=new RecordingMeshScene(r);r.calm=true;
  buildingModel(s,gate,data.buildings.gate,w);
  const door=s.boxes.find(box=>box[6]==='#785336');
  assert.ok(axis==='x'?door[3]<door[4]:door[4]<door[3],`${axis}-axis wall connections orient the portcullis to that run`);
  for(const b of neighbors)buildingModel(s,b,data.buildings[b.type],w);
  const minX=gate.x+(axis==='x'?.33:.15),maxX=gate.x+(axis==='x'?.67:.85),minY=gate.y+(axis==='x'?.15:.33),maxY=gate.y+(axis==='x'?.85:.67);
  const blocked=s.boxes.some(([x,y,z,width,depth,height])=>x<maxX&&x+width>minX&&y<maxY&&y+depth>minY&&z+height>.18&&z<.8);
  assert.equal(blocked,false,`${axis}-axis connections must leave the gate passage clear below the raised portcullis`);
 }
});

test('gate portcullis moves through cached stages under enemy pressure',()=>{
 const r=renderer(),gate=building('gate'),w=world([gate]);
 const raised=geometry(mesh(r,gate,w,0));
 w.enemies.push({id:'raider',x:5.5,y:5.5,hp:100});
 const transitionStart=geometry(mesh(r,gate,w,1000));
 const halfway=geometry(mesh(r,gate,w,1120));
 const lowered=geometry(mesh(r,gate,w,1240));
 assert.equal(transitionStart,raised,'the gate starts moving from its raised position');
 assert.notEqual(halfway,raised,'the portcullis passes through an intermediate position');
 assert.notEqual(lowered,halfway,'the gate completes its descent');

 const calm=renderer();calm.calm=true;
 const calmGate=building('gate','calm-gate'),calmWorld=world([calmGate]);
 const calmRaised=geometry(mesh(calm,calmGate,calmWorld));
 calmWorld.enemies.push({id:'raider',x:5.5,y:5.5,hp:100});
 assert.notEqual(geometry(mesh(calm,calmGate,calmWorld,16)),calmRaised,'reduced motion applies the state without tweening');
});

test('calm mode snaps and synchronizes an in-flight gate tween',()=>{
 const r=renderer(),gate=building('gate'),w=world([gate]);
 mesh(r,gate,w,0);w.enemies.push({id:'raider',x:5.5,y:5.5,hp:100});
 mesh(r,gate,w,1000);mesh(r,gate,w,1120);
 r.calm=true;const snapped=geometry(mesh(r,gate,w,1130));
 r.calm=false;
 assert.equal(geometry(mesh(r,gate,w,1140)),snapped,'turning calm off must not revive the pre-snap intermediate stage');
});

test('traps look different while sprung and cooling down',()=>{
 for(const type of ['trap','fire-trap']){
  const armed=building(type,`${type}-armed`),sprung={...armed,id:`${type}-sprung`,cooldown:4};
  assert.notEqual(geometry(mesh(renderer(),armed,world([armed]))),geometry(mesh(renderer(),sprung,world([sprung]))),`${type} exposes its cooldown state`);
 }
});

test('defense mesh cache changes only at gate/trap visual state boundaries',()=>{
 const r=renderer(),trap=building('trap'),trapWorld=world([trap]);r.calm=true;
 drawVillage3D(r,trapWorld,0);const armed=r._meshStatic;
 trap.cooldown=4;drawVillage3D(r,trapWorld,16);const sprung=r._meshStatic;
 assert.notStrictEqual(sprung,armed,'triggering a trap invalidates its mesh');
 trap.cooldown=2;drawVillage3D(r,trapWorld,32);
 assert.strictEqual(r._meshStatic,sprung,'cooldown ticks do not rebuild a sprung trap');
 trap.cooldown=0;drawVillage3D(r,trapWorld,48);
 assert.notStrictEqual(r._meshStatic,sprung,'rearming invalidates the trap mesh');

 const gate=building('gate','gate'),gateWorld=world([gate]),moving=renderer();moving.calm=false;
 drawVillage3D(moving,gateWorld,0);const raised=moving._meshStatic;
 gateWorld.enemies.push({id:'raider',x:5.5,y:5.5,hp:100});
 drawVillage3D(moving,gateWorld,1000);assert.strictEqual(moving._meshStatic,raised,'animation waits until its quantized stage changes');
 drawVillage3D(moving,gateWorld,1060);const movingMesh=moving._meshStatic;
 assert.notStrictEqual(movingMesh,raised,'each gate stage invalidates the mesh');
 drawVillage3D(moving,gateWorld,1070);
 assert.strictEqual(moving._meshStatic,movingMesh,'frames within one gate stage reuse the mesh');
});

test('gate and trap presentation never mutates the saved world',()=>{
 const r=renderer(),gate=building('gate'),trap=building('fire-trap','fire',{cooldown:4}),w=world([gate,trap],[{id:'raider',x:5.5,y:5.5,hp:100}]);
 const before=JSON.stringify(w);
 drawVillage3D(r,w,0);
 drawVillage3D(r,w,100);drawVillage3D(r,w,220);drawVillage3D(r,w,340);
 assert.equal(JSON.stringify(w),before);
});
