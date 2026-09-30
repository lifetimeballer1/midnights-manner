import {trackStride} from '../src/systems/footsteps.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel,drawVillage3D} from '../src/scene3d.js';
import {addLivingMechanisms,cartPose,wheelMesh,pivotMesh} from '../src/mechanical-art.js';
import {workPhase,workTiming,strikeLift} from '../src/work-motion.js';
import {WorkSync} from '../src/systems/worksync.js';
import {propFamily} from '../src/living-props.js';
import {gaitFor} from '../src/character-motion.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings','abilities','missions','quests','biomes'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const ctx=new Proxy({},{get:(o,k)=>o[k]||(()=>k==='measureText'?{width:40}:k.includes('Gradient')?{addColorStop(){}}:undefined),set:(o,k,v)=>(o[k]=v,true)});
function renderer(zoom=1.8,yaw=Math.PI/4,calm=false){const r=new Renderer({getContext:()=>ctx},data,{});r.resize(1280,900,1);r.cam.x=5;r.cam.y=5;r.cam.zoom=zoom;r.cam.yaw=yaw;r.calm=calm;return r;}
function world(type='mine',level=1){const b={id:'mechanism-'+type,type,x:4,y:4,level,hp:100,remaining:0,harvestBonus:0};return {buildings:[b],troops:[{id:'worker',type:'miner',x:4.5,y:5,hp:100,workplace:b.id,gear:'pick',animation:0}],enemies:[],effects:[],elapsed:400};}
const vertices=s=>s.faces.flatMap(f=>f.vertices);
test('living: the complete building roster has functional detail families',()=>{for(const type in data.buildings)assert.ok(propFamily(type),type);});
test('living: all tiers produce finite colored meshes at four orbit angles',()=>{for(const type in data.buildings)for(const level of [1,data.buildings[type].tiers.length])for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const w=world(type,level),s=new MeshScene(renderer(1.8,yaw));buildingModel(s,w.buildings[0],data.buildings[type],w);addLivingMechanisms(s,w,2200);assert.ok(s.faces.length>0,type);assert.ok(s.faces.every(f=>/^#[0-9a-f]{6}$/i.test(f.color)&&f.vertices.every(v=>v.every(Number.isFinite))),type);}});
test('living: cart wheels track travel distance on the rail centerline',()=>{const b=world().buildings[0];for(const t of [0,250,1200,3000,7500]){const p=cartPose(b,t);assert.equal(p.x,b.x+.49);assert.ok(p.y>=b.y+.97&&p.y<=b.y+1.29);assert.equal(p.angle,-p.travel/.085);}assert.notDeepEqual(cartPose(b,0),cartPose(b,250));});
test('living: wheel hub remains fixed while rim and spokes rotate',()=>{const a=new MeshScene(renderer()),b=new MeshScene(renderer());wheelMesh(a,5,5,.6,.38,0,true);wheelMesh(b,5,5,.6,.38,.4,true);assert.deepEqual(a.faces.filter(f=>f.color==='#a8b7b5').map(f=>f.vertices),b.faces.filter(f=>f.color==='#a8b7b5').map(f=>f.vertices));assert.notDeepEqual(vertices(a),vertices(b));});
test('living: shared audio wraps and visible contact align at every tier',()=>{for(const type of ['forge','mine','lumber','sawmill','mason_yard','mill'])for(const level of [1,3,6]){const b=world(type,level).buildings[0],channel={forge:'hammer',mine:'pick',lumber:'chop',sawmill:'saw',mason_yard:'chisel',mill:'creak'}[type],clock=workTiming(b,channel),contact=clock.period*2-clock.offset,sync=new WorkSync();sync.wrap(b.id,channel,contact-.01,clock.period,clock.offset);assert.equal(sync.wrap(b.id,channel,contact+.01,clock.period,clock.offset),true);assert.ok(workPhase(b,channel,contact+.001)<.00001);assert.equal(strikeLift(0),0);assert.equal(strikeLift(.72),1);}});
test('living: Calm freezes motion without losing recognizable machinery',()=>{for(const type of ['mine','mill','forge','sawmill','farm','pond']){const w=world(type),r=renderer(1.8,Math.PI/4,true),a=new MeshScene(r),b=new MeshScene(r);addLivingMechanisms(a,w,0);addLivingMechanisms(b,w,4000);assert.ok(a.faces.length>0,type);assert.deepEqual(vertices(a),vertices(b),type);}});
test('living: construction and ruins have no operating machinery',()=>{for(const field of [{hp:0},{remaining:10}]){const w=world();Object.assign(w.buildings[0],field);const s=new MeshScene(renderer());addLivingMechanisms(s,w,2000);assert.equal(s.faces.length,0);}});
test('living: standing does not advance gait and teleports reset it',()=>{const r=renderer(),u={id:'a',x:4,y:4};gaitFor(r,u,0);assert.equal(gaitFor(r,u,100).moving,false);u.x+=.1;const step=gaitFor(r,u,150);assert.equal(step.moving,true);u.x+=10;const tele=gaitFor(r,u,200);assert.equal(tele.distance,step.distance);assert.equal(tele.moving,false);r.calm=true;assert.equal(gaitFor(r,u,250).swing,0);});
test('living: transforming a tool keeps its hand pivot stationary',()=>{const s={faces:[],face(v){this.faces.push({vertices:v});}},p=[5,5,.4],proxy=pivotMesh(s,p,.8);proxy.face([[5,5,.4],[5.2,5,.4],[5,5,.6]],'#a8b7b5',false);assert.deepEqual(s.faces[0].vertices[0],p);});
test('living: clock motion leaves static village geometry cached',()=>{const w=world('mill'),r=renderer();drawVillage3D(r,w,100);const cache=r._meshStatic,first=r.sceneFaces.map(f=>f.vertices);drawVillage3D(r,w,700);assert.equal(r._meshStatic,cache);assert.notDeepEqual(r.sceneFaces.map(f=>f.vertices),first);});

test('living: render frames between simulation steps do not erase footstep distance',()=>{const strides=new Map(),u={id:'walker',x:0,y:0};trackStride(strides,u,0);let contacts=0;for(let i=1;i<=12;i++){u.x+=.05;if(trackStride(strides,u,i*50))contacts++;trackStride(strides,u,i*50+16);trackStride(strides,u,i*50+32);}assert.equal(contacts,1);trackStride(strides,u,1000);assert.equal(strides.get('uwalker').acc,0);});
