// Motion pack — walk and work curves re-expressed through the renderer's
// procedural channels: passing-pose stride, run drive, anticipation wind-up,
// strike snap and the bow draw/release. Renderer-only: no saves or gameplay.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {characterModel,workMotionFor} from '../src/character-art.js';
import {addLivingMechanisms} from '../src/mechanical-art.js';
import {gaitFor} from '../src/character-motion.js';
import {workPhase,workTiming,strikeLift} from '../src/work-motion.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])
));
const ctx=new Proxy({},{get:(o,k)=>o[k]||(()=>k==='measureText'?{width:40}:k.includes('Gradient')?{addColorStop(){}}:undefined),set:(o,k,v)=>(o[k]=v,true)});
function renderer({calm=false,zoom=1.65,camX=4,camY=4}={}){
 const r=new Renderer({getContext:()=>ctx},data,{});r.resize(1280,900,1);
 r.cam.x=camX;r.cam.y=camY;r.cam.zoom=zoom;r.cam.yaw=Math.PI/4;r.calm=calm;return r;
}
// One trade per character work channel the renderer maps: pick, chop, hammer
// (forgehammer) and rustle (scythe).
const TRADES=[
 {type:'miner',gear:'pickaxe',post:'mine',channel:'pick',extra:{phase:'gather',carry:5}},
 {type:'lumberjack',gear:'fellingaxe',post:'lumber',channel:'chop',extra:{phase:'gather',carry:5}},
 {type:'weaponsmith',gear:'forgehammer',post:'forge',channel:'hammer',extra:{}},
 {type:'farmer',gear:'scythe',post:'farm',channel:'rustle',extra:{phase:'gather',carry:5}},
];
function postFor(trade,render){
 const size=data.buildings[trade.post].size,b={id:`motion-${trade.post}`,type:trade.post,x:4,y:4,level:1,hp:100,remaining:0};
 render._motionWorld={buildings:[b]};return {b,size};
}
function workerFor(trade,b,size){
 return {id:`motion-${trade.type}`,type:trade.type,hp:100,x:b.x+size/2,y:b.y+size/2,gear:trade.gear,workplace:b.id,order:null,...trade.extra};
}
function facesFor(render,unit,time,enemy=false){const s=new MeshScene(render);characterModel(s,unit,data,time,enemy);return s.faces;}
function gaitRun(speed,id='motion-walker',steps=40){
 const r={calm:false},u={id,x:5,y:5};
 gaitFor(r,u,0);
 const out=[];
 for(let i=1;i<=steps;i++){const t=i*50;u.x+=speed*.05;for(const off of [0,16,32])out.push(gaitFor(r,u,t+off));}
 return out;
}
const maxSwing=g=>Math.max(...g.map(s=>Math.abs(s.swing)));

test('motion pack: calm output is identically zero across channels and times',()=>{
 const r=renderer({calm:true});
 const u={id:'calm-probe',x:4,y:4,hp:100,type:'miner',gear:'pickaxe',workplace:'mine-1',phase:'gather',carry:5};
 gaitFor(r,u,0);
 for(const time of [0,100,700,2200,5000]){
  u.x+=.05;
  const g=gaitFor(r,u,time);
  assert.equal(g.moving,false,'calm never reports movement');
  assert.equal(g.swing,0,'calm swing is zero');
  assert.equal(g.bob,0,'calm bob is zero');
 }
 assert.equal(strikeLift(0),0,'the work envelope pins contact at zero lift');
 for(const trade of TRADES){
  const frozen=renderer({calm:true}),{b,size}=postFor(trade,frozen),w=workerFor(trade,b,size),troop=data.troops[trade.type];
  for(const time of [0,100,700,2200])assert.equal(workMotionFor(w,troop,time,true),0,`${trade.channel} calm lift stays zero`);
  assert.deepEqual(facesFor(frozen,w,100),facesFor(frozen,w,3000),`${trade.channel} calm mesh is frozen`);
 }
});

test('motion pack: walk stride and opposite arm swing stay readable and bounded at run pace',()=>{
 const walk=gaitRun(1),run=gaitRun(2.2);
 const walkMax=maxSwing(walk),runMax=maxSwing(run);
 assert.ok(walkMax>=.08,`the walk stride is visible at gameplay zoom (${walkMax})`);
 assert.ok(runMax>walkMax,`run pace drives a stronger swing (${walkMax} -> ${runMax})`);
 assert.ok(runMax<=.125,`arm and leg swing stay bounded (${runMax})`);
 for(const g of [...walk,...run]){
  assert.ok(Math.abs(g.swing)<=.125,'swing never leaves its bound');
  assert.ok(g.bob<=.06&&g.bob>=-.02,`bob stays bounded (${g.bob})`);
 }
 assert.ok(2*runMax>=.18&&2*runMax<=.25,`opposite feet separate across a full stride (${2*runMax})`);
 const contact=run.reduce((a,b)=>Math.abs(b.swing)>Math.abs(a.swing)?b:a),pass=run.reduce((a,b)=>Math.abs(b.swing)<Math.abs(a.swing)?b:a);
 assert.ok(pass.bob>contact.bob,'the body rides high at the passing pose and drops at contact');
 const nearPass=run.filter(s=>Math.abs(s.swing)<.25*runMax).length/run.length;
 assert.ok(nearPass<.12,`the passing pose crosses quickly (${nearPass})`);
 assert.ok(run.every(s=>s.moving),'render frames between simulation steps keep the gait live');
});

test('motion pack: work channels wind up, hold, then snap into contact',()=>{
 for(const channel of ['pick','chop','hammer','rustle']){
  const b={id:`shape-${channel}`,type:'mine',level:1,x:4,y:4},clock=workTiming(b,channel);
  assert.ok(clock,`${channel} keeps its shared visible/audio clock`);
  const contact=clock.period*2-clock.offset;
  assert.ok(workPhase(b,channel,contact+.001)<.00001,`${channel} contact is phase zero`);
  assert.ok(strikeLift(workPhase(b,channel,contact+.72*clock.period))>.999,`${channel} reaches full cock at phase .72`);
  assert.equal(strikeLift(0),0);
  assert.equal(strikeLift(.72),1);
  let prev=-1;
  for(let p=0;p<=.72;p+=.01){const lift=strikeLift(p);assert.ok(lift>=prev-1e-9,`${channel} wind-up is monotone`);prev=lift;}
  for(const p of [.6,.64,.68,.72])assert.ok(strikeLift(p)>=.9,`${channel} holds at the cock before the strike`);
  const crossUp=value=>{for(let p=0;p<=.72;p+=1e-4)if(strikeLift(p)>=value)return p;return .72;};
  const crossDown=value=>{for(let p=.72;p<=1;p+=1e-4)if(strikeLift(p)<=value)return p;return 1;};
  const raise=crossUp(.9)-crossUp(.1),fall=crossDown(.1)-crossDown(.9);
  assert.ok(fall<raise*.7,`${channel} strikes down faster than it winds up (${fall.toFixed(3)} vs ${raise.toFixed(3)})`);
  assert.ok(strikeLift(.995)<.25,`${channel} arrives at contact with the strike`);
 }
});

test('motion pack: trade tools track their channel and stay attached through full cycles',()=>{
 for(const [bt,channel,troopType] of [['mine','pick','miner'],['lumber','chop','lumberjack'],['forge','hammer','weaponsmith'],['farm','rustle','farmer']]){
  const r=renderer({zoom:1.8}),size=data.buildings[bt].size;
  const b={id:`rig-${bt}`,type:bt,x:4,y:4,level:1,hp:100,remaining:0,harvestBonus:0};
  const world={buildings:[b],troops:[{id:`crew-${bt}`,type:troopType,x:4+size/2,y:4+size/2,hp:100,workplace:b.id,gear:data.troops[troopType].defaultGear,animation:0}],enemies:[],effects:[],elapsed:400};
  const clock=workTiming(b,channel),contact=clock.period*2-clock.offset;
  const tool=time=>{const s=new MeshScene(r);addLivingMechanisms(s,world,time);const steel=s.faces.filter(f=>f.owner?.id===b.id&&f.color==='#a8b7b5');return {count:steel.length,sum:steel.map(f=>f.points.flatMap(p=>[p.x,p.y])).flat().reduce((a,c)=>a+c,0)};};
  const home=tool(contact),cock=tool(contact+.72*clock.period);
  assert.ok(home.count>0&&home.count<40,`${bt} operator carries a bounded tool`);
  assert.notEqual(home.sum,cock.sum,`${bt} tool visibly winds up and strikes on its channel`);
 }
 for(const trade of TRADES){
  const r=renderer(),{b,size}=postFor(trade,r),u=workerFor(trade,b,size),clock=workTiming(b,trade.channel),pivot=[u.x+.24,u.y,.34];
  for(let i=0;i<=24;i++){
   const steel=facesFor(r,u,clock.period*2*(i/24)).filter(f=>f.color==='#b7c8ca');
   assert.ok(steel.length>0,`${trade.channel} tool steel is present`);
   for(const f of steel){
    const reach=Math.hypot(f.center[0]-pivot[0],f.center[1]-pivot[1],f.center[2]-pivot[2]);
    assert.ok(reach<1,`${trade.channel} tool stays on the hand pivot (${reach})`);
   }
  }
 }
 const r=renderer(),hauler={id:'motion-haul',type:'lumberjack',hp:100,x:4,y:4,gear:'fellingaxe',carry:5};
 gaitFor(r,hauler,0);
 for(let i=1;i<=30;i++){
  const time=i*50;hauler.x+=.055;
  for(const off of [0,16,32]){
   const cargo=facesFor(r,hauler,time+off).filter(f=>f.color==='#9d744a');
   assert.ok(cargo.length>0,'the carried load stays visible while walking');
   for(const f of cargo){
    assert.ok(f.center[1]<hauler.y-.15,`cargo stays behind the carrier (${f.center[1]})`);
    assert.ok(Math.hypot(f.center[0]-hauler.x,f.center[1]-hauler.y)<.5,'cargo stays on the carrier through the stride');
   }
  }
 }
});

test('motion pack: the bow pulls to full draw and releases on the attack clock',()=>{
 const r=renderer({camX:0,camY:0});
 const stringFaces=attackTimer=>{
  const s=new MeshScene(r);
  characterModel(s,{id:'motion-bow',type:'archer',hp:100,x:0,y:0,gear:'bow',attackTimer,animation:.3},data,700);
  return s.faces.filter(f=>f.color==='#ddcfac');
 };
 const width=attackTimer=>{
  const faces=stringFaces(attackTimer),xs=faces.flatMap(f=>f.points.map(p=>p.x));
  assert.ok(faces.length>=5,'the bow string keeps geometry through the draw');
  return Math.max(...xs)-Math.min(...xs);
 };
 const full=width(.01),half=width(.09),early=width(.13),released=width(0),idle=width(.2);
 assert.ok(full>half&&half>early,`the string draws tighter as release nears (${early.toFixed(2)}, ${half.toFixed(2)}, ${full.toFixed(2)})`);
 assert.ok(full>released*2,'full draw reads far wider than the released string');
 assert.equal(released,idle,'outside the draw window the string is straight');
});

test('motion pack: per-unit gait and work phases stay deterministic and desynced',()=>{
 const swingSeq=id=>gaitRun(1.1,id,20).map(s=>+s.swing.toFixed(6));
 assert.deepEqual(swingSeq('motion-alpha'),swingSeq('motion-alpha'),'replaying a unit reproduces its gait exactly');
 assert.notDeepEqual(swingSeq('motion-alpha'),swingSeq('motion-beta'),'different units never march in lockstep');
 const a={id:'motion-post-a',level:1},b={id:'motion-post-b',level:1};
 assert.notEqual(workPhase(a,'pick',900),workPhase(b,'pick',900),'work phases desync per building');
 assert.equal(workPhase(a,'pick',900),workPhase(a,'pick',900),'work phase stays a pure clock');
});
