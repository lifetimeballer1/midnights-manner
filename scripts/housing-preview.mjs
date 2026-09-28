// Optional housing review sheet (presentation pass, Phase 5). Renders the
// actual cottage tiers and the longhouse from the real orbit meshes at day
// and night light from the real sky resolver. Uses @napi-rs/canvas installed
// outside this repo (no runtime dependency):
//   npm install --no-save --no-package-lock @napi-rs/canvas
//   node scripts/housing-preview.mjs
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel} from '../src/scene3d.js';
import {DAY_LENGTH,skyLightAt} from '../src/systems/daynight.js';
const {createCanvas}=await import(process.env.CANVAS_MODULE?pathToFileURL(process.env.CANVAS_MODULE).href:'@napi-rs/canvas');
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
await mkdir('artifacts',{recursive:true});
const cases=[['Cottage · Tier 1','cottage',1],['Cottage · Tier 2','cottage',2],['Cottage · Tier 3','cottage',3],['Longhouse','longhouse',1]];
for(const [view,elapsed] of [['day',DAY_LENGTH*1.3],['night',DAY_LENGTH*1.8]]){
 const canvas=createCanvas(1440,620),c=canvas.getContext('2d'),r=new Renderer(canvas,data,{});
 r.width=1440;r.height=620;r.calm=true;r.cam.yaw=Math.PI/4;r.cam.zoom=2.6;r.cy=380;
 c.fillStyle='#20392f';c.fillRect(0,0,1440,620);
 c.fillStyle='#eadcb4';c.font='bold 28px sans-serif';c.fillText(`MIDNIGHTS MANNER · HOUSING SILHOUETTES · ${view.toUpperCase()}`,36,48);
 c.font='16px sans-serif';c.fillStyle='#b8c8b6';c.fillText('Actual game meshes · real sky light: tier detail and the meadhall read by shape, not paint',36,76);
 cases.forEach(([label,type,level],i)=>{
  const spec=data.buildings[type],b={id:label,type,x:0,y:0,level,hp:100,remaining:0};
  r.cx=170+i*350;r.cam.x=spec.size/2;r.cam.y=spec.size/2;
  for(let x=-1;x<spec.size+1;x++)for(let y=-1;y<spec.size+1;y++)r.diamond(x,y,(x+y)%2?'#6b845c':'#728e63');
  const s=new MeshScene(r);buildingModel(s,b,spec,{buildings:[b]});s.light=skyLightAt(elapsed,null);s.paint();
  c.fillStyle='#eadcb4';c.font='bold 19px sans-serif';c.textAlign='center';c.fillText(label,r.cx,r.cy+150);
 });
 c.textAlign='left';
 await writeFile(`artifacts/housing-${view}.png`,canvas.toBuffer('image/png'));
}
console.log('Review sheets: artifacts/housing-day.png, artifacts/housing-night.png');
