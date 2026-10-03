// B1 monk QA: 3-pose lineup (stand, work-a, attack) with baked meshes loaded.
// CANVAS_MODULE=... node scripts/dev-rig/b1-monk-preview.mjs
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../../src/renderer.js';
import {MeshScene} from '../../src/scene3d.js';
import {characterModel,workMotionFor} from '../../src/character-art.js';
const {createCanvas}=await import(process.env.CANVAS_MODULE?pathToFileURL(process.env.CANVAS_MODULE).href:'@napi-rs/canvas');
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings','art-manifest'].map(async n=>[n,JSON.parse(await readFile(new URL(`../../data/${n}.json`,import.meta.url)))])));
await mkdir(new URL('../../artifacts/',import.meta.url),{recursive:true});
const meshes={};
for(const key of ['stand-hi','work-a-hi','attack-hi','walk-a-hi']){
 meshes[`monk-${key}`]=JSON.parse(await readFile(new URL(`../../assets/meshes/baked/monk-${key}.json`,import.meta.url)));
}
const canvas=createCanvas(1200,520),c=canvas.getContext('2d'),r=new Renderer(canvas,data,{});
r.meshes=meshes;r.width=1200;r.height=520;r.cam.yaw=Math.PI/4;
c.fillStyle='#20392f';c.fillRect(0,0,1200,520);
c.fillStyle='#eadcb4';c.font='bold 24px sans-serif';c.fillText('B1 MONK LINEUP - STAND / WORK-A / ATTACK',30,42);
const base={id:'b1',type:'builder',hp:100,gear:'hammer'};
let workTime=0;
for(let t=0;t<450;t+=5){if(workMotionFor({...base,workplace:'w1'},data.troops.builder,t,false)>.13){workTime=t;break;}}
const slots=[
 {label:'stand',u:{...base,x:0,y:0,id:'b1a'},t:0},
 {label:'work-a',u:{...base,x:0,y:0,id:'b1b',workplace:'w1'},t:workTime},
 {label:'attack',u:{...base,x:0,y:0,id:'b1c',attackTimer:1,animation:.1},t:0},
];
slots.forEach((slot,i)=>{
 r.cx=220+i*380;r.cy=430;r.cam.x=0;r.cam.y=0;r.cam.zoom=5.5;
 const s=new MeshScene(r);characterModel(s,slot.u,data,slot.t);s.paint();
 c.fillStyle='#eadcb4';c.font='bold 18px sans-serif';c.textAlign='center';c.fillText(slot.label,r.cx,490);
});
await writeFile(new URL('../../artifacts/b1-monk.png',import.meta.url),canvas.toBuffer('image/png'));
console.log('wrote artifacts/b1-monk.png  workTime='+workTime);
