// Capture before editing, then compose after using the same direct character renderer.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {Renderer} from '../../src/renderer.js';
import {MeshScene} from '../../src/scene3d.js';
import {characterModel} from '../../src/character-art.js';
import {workTiming} from '../../src/work-motion.js';
const root=new URL('../../',import.meta.url);
const before='C:/Users/Bubs/AppData/Local/Temp/opencode/b5-before.png';
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings','art-manifest'].map(async n=>[n,JSON.parse(await readFile(new URL(`data/${n}.json`,root)))])));
const meshes={};
for(const dir of ['baked','gear'])for(const file of await readdir(new URL(`assets/meshes/${dir}/`,root))){
 if(file.endsWith('.json'))meshes[(dir==='gear'?'gear-':'')+file.slice(0,-5)]=JSON.parse(await readFile(new URL(`assets/meshes/${dir}/${file}`,root)));
}
const cases=[['miner','mine','pick','Grip-local pickaxe / full-cycle sync'],['butcher','butchery','board','Cleaver follows chopping-board clock'],['sawyer','sawmill','saw','Default axe follows sawmill clock']];
const canvas=createCanvas(1500,950),ctx=canvas.getContext('2d');
ctx.fillStyle='#20332f';ctx.fillRect(0,0,1500,950);
ctx.fillStyle='#eddfbb';ctx.font='bold 25px sans-serif';ctx.fillText('B5 WORK-MOTION SYNC | baked bodies + gear meshes',28,40);
const after=process.argv[2]==='after';
if(after)ctx.drawImage(await loadImage(before),0,0);
for(let i=0;i<cases.length;i++){
 const [type,building,channel,label]=cases[i],row=after?1:0;
 const r=new Renderer(canvas,data,{});r.meshes=meshes;r.width=1500;r.height=950;r.calm=false;
 r.cam.x=0;r.cam.y=0;r.cam.yaw=Math.PI/4;r.cam.zoom=5;
 r.cx=250+i*500;r.cy=390+row*440;
 const post={id:'b5-post',type:building,x:-1,y:-1,level:3,hp:100,remaining:0};
 r._motionWorld={buildings:[post]};
 const clock=workTiming(post,channel),time=clock.period*(Math.ceil(clock.offset/clock.period)+.72)-clock.offset;
 const unit={id:'b5-'+type,type,gear:data.troops[type].defaultGear,hp:100,x:0,y:0,workplace:post.id,phase:'gather',carry:1};
 const s=new MeshScene(r);characterModel(s,unit,data,time);s.paint();
 ctx.textAlign='center';ctx.fillStyle='#eddfbb';ctx.font='bold 20px sans-serif';ctx.fillText(`${after?'AFTER':'BEFORE'} | ${type} / ${unit.gear}`,r.cx,100+row*440);
 ctx.font='16px sans-serif';ctx.fillText(label,r.cx,425+row*440);ctx.fillText(`${channel} phase 0.72 | level 3 | t=${time.toFixed(1)} ms`,r.cx,451+row*440);
}
await writeFile(after?new URL('artifacts/b5-sync.png',root):before,canvas.toBuffer('image/png'));
console.log(after?'wrote artifacts/b5-sync.png':'captured baseline '+before);
