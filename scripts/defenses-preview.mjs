// Optional Phase 7 review sheet for connected walls, gate travel and trap state.
// Uses the real meshes and @napi-rs/canvas installed outside the game runtime:
//   npm install --no-save --no-package-lock @napi-rs/canvas
//   node scripts/defenses-preview.mjs
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel} from '../src/scene3d.js';
import {DAY_LENGTH,skyLightAt} from '../src/systems/daynight.js';
const {createCanvas}=await import(process.env.CANVAS_MODULE?pathToFileURL(process.env.CANVAS_MODULE).href:'@napi-rs/canvas');
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
await mkdir('artifacts',{recursive:true});
const canvas=createCanvas(1440,1080),c=canvas.getContext('2d'),r=new Renderer(canvas,data,{});
r.resize(1440,1080,1);r.calm=false;r.cam.zoom=2.25;r.cam.yaw=Math.PI/4;
c.fillStyle='#20392f';c.fillRect(0,0,1440,1080);
c.fillStyle='#eadcb4';c.font='bold 28px sans-serif';c.fillText('MIDNIGHTS MANNER - DEFENSE READABILITY - PHASE 7',36,42);
c.fillStyle='#b8c8b6';c.font='16px sans-serif';c.fillText('Actual game meshes · exposed wall caps · portcullis travel · armed and sprung traps',36,70);
function make(type,id,x,y,level=1,extra={}){return {id,type,x,y,level,hp:100,remaining:0,cooldown:0,...extra};}
function panel(x,y,w,h,label,build){
 c.fillStyle='#294537';c.fillRect(x,y,w,h);c.strokeStyle='#69836c';c.strokeRect(x,y,w,h);
 c.save();c.beginPath();c.rect(x,y,w,h-32);c.clip();
 r.cx=x+w/2;r.cy=y+(h-32)*.61;r.cam.x=1.5;r.cam.y=1.5;r.cam.zoom=2.15;
 for(let tx=-1;tx<4;tx++)for(let ty=-1;ty<4;ty++)r.diamond(tx,ty,(tx+ty)%2?'#6b845c':'#728e63');
 const {buildings,enemies=[],time=0,warmup=false}=build(),world={buildings,enemies,troops:[],elapsed:0};
 const gate=buildings.find(b=>b.type==='gate');
 if(warmup&&gate){const openWorld={...world,enemies:[]};buildingModel(new MeshScene(r),gate,data.buildings.gate,openWorld,0);buildingModel(new MeshScene(r),gate,data.buildings.gate,world,1000);}
 const s=new MeshScene(r);for(const b of buildings)buildingModel(s,b,data.buildings[b.type],world,time);s.light=skyLightAt(DAY_LENGTH*1.3,null);s.paint();
 c.restore();c.fillStyle='#20392f';c.fillRect(x+1,y+h-31,w-2,30);c.strokeStyle='#69836c';c.strokeRect(x,y,w,h);
 c.fillStyle='#eadcb4';c.font='bold 16px sans-serif';c.textAlign='center';c.fillText(label,x+w/2,y+h-15);c.textAlign='left';
}
const wall=(x,y,id)=>make('wall',id,x,y,1);
const wallCases=[
 ['Palisade - straight run',[wall(0,1,'a'),wall(1,1,'b'),wall(2,1,'c')]],
 ['Palisade - corner',[wall(0,1,'a'),wall(1,1,'b'),wall(1,2,'c')]],
 ['Palisade - T junction',[wall(0,1,'a'),wall(1,1,'b'),wall(2,1,'c'),wall(1,2,'d')]],
];
wallCases.forEach(([label,buildings],i)=>panel(36+i*456,92,432,236,label,()=>({buildings})));
function gateCase(id,axis,state){
 const gate=make('gate',id,1,1),walls=axis==='x'?[wall(0,1,id+'-w'),wall(2,1,id+'-e')]:[wall(1,0,id+'-n'),wall(1,2,id+'-s')];
 return {buildings:[...walls,gate],enemies:state==='raised'?[]:[{id:id+'-raider',x:1.5,y:1.5,hp:100}],time:state==='moving'?1120:0,warmup:state==='moving'};
}
panel(36,346,432,250,'Gate - raised / passage clear',()=>gateCase('gate-open','x','raised'));
panel(492,346,432,250,'Gate - lowering under pressure',()=>gateCase('gate-moving','y','moving'));
panel(948,346,432,250,'Gate - lowered / raider nearby',()=>gateCase('gate-down','x','lowered'));
const traps=[['Spike - armed','trap',0],['Spike - sprung','trap',5],['Fire trap - armed','fire-trap',0],['Fire trap - sprung','fire-trap',5]];
traps.forEach(([label,type,cooldown],i)=>panel(36+i*342,614,318,420,label,()=>({buildings:[make(type,`${type}-${i}`,1,1,1,{cooldown})]})));
await writeFile('artifacts/defenses-preview.png',canvas.toBuffer('image/png'));
console.log('Review sheet: artifacts/defenses-preview.png');
