// Optional production-state review sheet (presentation pass, Phase 6).
// Renders the actual producer meshes at each stockpile step, from the real
// orbit meshes and the real day sky. Uses @napi-rs/canvas installed outside
// this repo (no runtime dependency):
//   npm install --no-save --no-package-lock @napi-rs/canvas
//   node scripts/production-preview.mjs
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel} from '../src/scene3d.js';
import {reserveCapacity} from '../src/resources.js';
import {DAY_LENGTH,skyLightAt} from '../src/systems/daynight.js';
const {createCanvas}=await import(process.env.CANVAS_MODULE?pathToFileURL(process.env.CANVAS_MODULE).href:'@napi-rs/canvas');
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
await mkdir('artifacts',{recursive:true});
const rows=[['Farm','farm','food'],['Timber yard','lumber','wood'],['Mine','mine','gold'],['Smeltery','smeltery','plate'],['Frostgrove','frostgrove','frostwood']];
const canvas=createCanvas(1440,1560),c=canvas.getContext('2d'),r=new Renderer(canvas,data,{});
r.width=1440;r.height=1560;r.calm=true;r.cam.yaw=Math.PI/4;r.cam.zoom=2.3;
c.fillStyle='#20392f';c.fillRect(0,0,1440,1560);
c.fillStyle='#eadcb4';c.font='bold 28px sans-serif';c.fillText('MIDNIGHTS MANNER · PRODUCTION STATE ON THE MESHES',36,48);
c.font='16px sans-serif';c.fillStyle='#b8c8b6';c.fillText('Actual game meshes · stockpiles grow in four steps with the on-site reserve · gold pennant = haul ready',36,76);
c.fillStyle='#d5e1be';c.font='bold 19px sans-serif';
for(const [i,label] of ['Early fill · 10%','Ready · 50%','Nearly full · 90%'].entries())c.fillText(label,250+i*430-110,120);
rows.forEach(([name,type,res],row)=>{
 const spec=data.buildings[type];
 c.fillStyle='#eadcb4';c.font='bold 18px sans-serif';c.textAlign='left';c.fillText(`${name} · ${res}`,36,190+row*270);
 for(const [col,frac] of [0.1,0.5,0.9].entries()){
  const b={id:type,type,x:0,y:0,level:1,hp:100,remaining:0,harvestBonus:Math.ceil(reserveCapacity(spec,1)*frac)};
  r.cx=250+col*430;r.cy=215+row*270;r.cam.x=spec.size/2;r.cam.y=spec.size/2;
  for(let x=-1;x<spec.size+1;x++)for(let y=-1;y<spec.size+1;y++)r.diamond(x,y,(x+y)%2?'#6b845c':'#728e63');
  const s=new MeshScene(r);buildingModel(s,b,spec,{buildings:[b]});s.light=skyLightAt(DAY_LENGTH*1.3,null);s.paint();
 }
});
c.textAlign='left';
await writeFile('artifacts/production-preview.png',canvas.toBuffer('image/png'));
console.log('Review sheet: artifacts/production-preview.png');
