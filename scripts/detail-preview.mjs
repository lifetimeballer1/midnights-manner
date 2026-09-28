// Optional visual QA using the actual orbit meshes; no runtime dependency.
// CANVAS_MODULE=/absolute/path/to/@napi-rs/canvas/index.js node scripts/detail-preview.mjs
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel} from '../src/scene3d.js';
import {characterModel} from '../src/character-art.js';
const {createCanvas}=await import(process.env.CANVAS_MODULE?pathToFileURL(process.env.CANVAS_MODULE).href:'@napi-rs/canvas');
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
await mkdir('artifacts',{recursive:true});
for(const [view,yaw] of [['front',Math.PI/4],['reverse',Math.PI*1.25]]){
 const canvas=createCanvas(1440,1050),c=canvas.getContext('2d'),r=new Renderer(canvas,data,{});
 r.width=1440;r.height=1050;r.calm=true;r.cam.yaw=yaw;
 c.fillStyle='#20392f';c.fillRect(0,0,1440,1050);
 c.fillStyle='#eadcb4';c.font='bold 28px sans-serif';c.fillText(`MIDNIGHTS MANNER · STRUCTURES & PEOPLE · ${view.toUpperCase()}`,36,48);
 c.font='16px sans-serif';c.fillStyle='#b8c8b6';c.fillText('Actual game meshes · structure zoom 3.6× · enlarged character samples',36,76);
 const structures=['cottage','hall','forge','barracks','armory','tannery','scriptorium','sawmill'];
 structures.forEach((type,i)=>{
  const spec=data.buildings[type],b={id:type,type,x:0,y:0,level:Math.min(2,spec.tiers.length),hp:100,remaining:0};
  r.cx=180+(i%4)*360;r.cy=278+Math.floor(i/4)*290;r.cam.x=spec.size/2;r.cam.y=spec.size/2;r.cam.zoom=3.6;
  for(let x=0;x<spec.size;x++)for(let y=0;y<spec.size;y++)r.diamond(x,y,(x+y)%2?'#6b845c':'#728e63');
  const s=new MeshScene(r);buildingModel(s,b,spec,{buildings:[b]});s.paint();
  c.fillStyle='#eadcb4';c.font='bold 18px sans-serif';c.textAlign='center';c.fillText(spec.name,r.cx,r.cy+85);
 });
 const people=['warrior','archer','farmer','miner','scholar','weaponsmith','pikewoman','healer'];
 people.forEach((type,i)=>{
  r.cx=90+i*180;r.cy=895;r.cam.x=0;r.cam.y=0;r.cam.zoom=5.5;
  const u={id:type,type,x:0,y:0,hp:100,gear:data.troops[type].defaultGear,armor:type==='warrior'?'kite-shield':null};
  const s=new MeshScene(r);characterModel(s,u,data,0);s.paint();
  c.fillStyle='#eadcb4';c.font='bold 16px sans-serif';c.fillText(data.troops[type].name,r.cx,960);
 });
 await writeFile(`artifacts/detail-${view}.png`,canvas.toBuffer('image/png'));
}
console.log('Review sheets: artifacts/detail-front.png, artifacts/detail-reverse.png');
