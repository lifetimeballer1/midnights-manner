// Local QA only. Uses the optional Canvas module already used by art previews.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel} from '../src/scene3d.js';
import {drawCatalogBuilding,drawMesh,meshBounds,validFlatMesh} from '../src/asset-art.js';
import {skyLightAt,DAY_LENGTH} from '../src/systems/daynight.js';

const {createCanvas}=await import(process.env.CANVAS_MODULE?pathToFileURL(process.env.CANVAS_MODULE).href:'@napi-rs/canvas');
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings','art-manifest'].map(async name=>[name,JSON.parse(await readFile(`data/${name}.json`))])));
const manifest=data['art-manifest'],families=Object.entries(manifest.buildings),meshes={},records=[];
for(const [,entry]of families)for(const asset of Object.values(entry.tiers))meshes[asset.id]=JSON.parse(await readFile(asset.file));
for(const [id,entry]of Object.entries(manifest.meshes).filter(([id])=>id.startsWith('catalog-')))meshes[id]=JSON.parse(await readFile(entry.file));
await mkdir('artifacts/catalog-review',{recursive:true});

function render(mesh,{type=null,level=1,yaw=Math.PI/4,night=false,low=false}={}){
 const canvas=createCanvas(220,180),r=new Renderer(canvas,data,{});
 r.resize(220,180,1);r.width=low?390:1280;r.height=900;r.cx=110;r.cy=155;
 r.cam={x:type?data.buildings[type].size/2:0,y:type?data.buildings[type].size/2:0,yaw,pitch:.7,zoom:low?1:2.5};r.meshes=meshes;r.calm=true;
 const c=canvas.getContext('2d');c.fillStyle=night?'#182b33':'#314539';c.fillRect(0,0,220,180);
 const bounds=meshBounds(mesh),corners=[];
 for(const x of [bounds.x0,bounds.x1])for(const y of [bounds.y0,bounds.y1])for(const z of [bounds.z0,bounds.z1])corners.push(r.project(x+(type?r.cam.x:0),y+(type?r.cam.y:0),z));
 const x0=Math.min(...corners.map(p=>p.x)),x1=Math.max(...corners.map(p=>p.x)),y0=Math.min(...corners.map(p=>p.y)),y1=Math.max(...corners.map(p=>p.y));
 // Fit the contact sheet only; record gameplay-budget admission separately.
 const fit=Math.min(180/(x1-x0),135/(y1-y0));r.cam.zoom*=fit;
 r.cx=110+(110-(x0+x1)/2)*fit;r.cy=82+(155-(y0+y1)/2)*fit;
 const s=new MeshScene(r);s.light=skyLightAt(DAY_LENGTH*(night?.8:.3),data,{calm:true});
 if(type){
  const b={id:`${type}-${level}`,type,x:0,y:0,level,hp:100,remaining:0},spec=data.buildings[type];
  if(!manifest.buildings[type].enabled){
   s.owner={kind:'building',id:b.id};
   for(const f of mesh.faces){s.emissive=f.e;s.face(f.v.map(([x,y,z])=>[x+spec.size/2,y+spec.size/2,z]),f.c,true,f.d===true);}
  }else assert.equal(drawCatalogBuilding(s,b,spec),true,`${type} T${level} admission`);
 }else drawMesh(s,mesh,0,0);
 assert.ok(s.faces.length>0,'visible mesh');
 assert.ok(s.faces.length<30000,'render face guard');
 assert.ok(s.faces.every(f=>f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),'finite projections');
 s.faces.sort((a,b)=>a.depth-b.depth);s.paint();return {canvas,faces:s.faces.length};
}

for(const [view,yaw,night]of [['day-front',Math.PI/4,false],['night-reverse',Math.PI*1.25,true]]){
 for(let start=0;start<families.length;start+=10){
  const batch=families.slice(start,start+10),sheet=createCanvas(1320,batch.length*210+34),c=sheet.getContext('2d');
  c.fillStyle='#14261f';c.fillRect(0,0,sheet.width,sheet.height);c.font='16px sans-serif';c.fillStyle='#f0deb3';c.fillText(`MIXAR LOCAL QA | ${view} | exported source candidates; gates/traps retain native state`,12,23);
  for(const [row,[type,entry]]of batch.entries())for(const [tier,asset]of Object.entries(entry.tiers)){
   const result=render(meshes[asset.id],{type,level:+tier,yaw,night}),x=(+tier-1)*220,y=34+row*210;
   c.drawImage(result.canvas,x,y);c.fillStyle='#f0deb3';c.font='13px sans-serif';c.fillText(`${type} T${tier}${entry.enabled?'':' [held]'} | ${result.faces} faces`,x+8,y+197);
   records.push({id:asset.id,view,visibleFaces:result.faces,enabled:entry.enabled});
  }
  await writeFile(`artifacts/catalog-review/${view}-${String(start/10+1).padStart(2,'0')}.png`,sheet.toBuffer('image/png'));
 }
}
const local=Object.entries(manifest.meshes).filter(([id])=>id.startsWith('catalog-'));
const sheet=createCanvas(660,Math.ceil(local.length/3)*230),c=sheet.getContext('2d');c.fillStyle='#14261f';c.fillRect(0,0,sheet.width,sheet.height);
for(const [i,[id]]of local.entries()){
 assert.ok(validFlatMesh(meshes[id]),id);const result=render(meshes[id]),x=i%3*220,y=Math.floor(i/3)*230;
 c.drawImage(result.canvas,x,y);c.fillStyle='#f0deb3';c.font='13px sans-serif';c.fillText(id,x+8,y+201);
 c.fillText(`${meshes[id].faces.length} submitted / ${result.faces} visible`,x+8,y+219);
}
await writeFile('artifacts/catalog-review/nature-piles.png',sheet.toBuffer('image/png'));

// Gameplay-scale checks use the real phone/desktop budgets, no sheet fitting.
for(const [type,entry]of families)for(const [tier,asset]of Object.entries(entry.tiers))for(const width of [390,1280])for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
 const canvas=createCanvas(width,844),r=new Renderer(canvas,data,{});r.resize(width,844,1);r.cam={x:1,y:1,zoom:1.65,yaw,pitch:.7};r.meshes=meshes;r.calm=true;
 const s=new MeshScene(r),b={id:asset.id,type,x:0,y:0,level:+tier,hp:100,remaining:0};
 buildingModel(s,b,data.buildings[type],{buildings:[b],troops:[],enemies:[]});
 assert.ok(s.faces.length>0&&s.faces.length<30000,`${asset.id} gameplay geometry`);
 assert.ok((s.catalogFaces||0)<=(width<600?3000:6000),`${asset.id} catalog budget`);
}
await writeFile('artifacts/catalog-review/report.json',JSON.stringify({buildingMeshes:Object.keys(meshes).filter(id=>id.startsWith('mmr-')).length,localProps:local.length,gameplayChecks:records.length*4,records},null,2));
console.log(`Reviewed ${records.length/2} building meshes, ${local.length} props, 2672 gameplay angle/device checks; sheets in artifacts/catalog-review.`);
