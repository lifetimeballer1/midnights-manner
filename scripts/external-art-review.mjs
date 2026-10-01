// Actual game renderer review; optional development-only Canvas module.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {createWorld,makeBuilding} from '../src/model.js';
import {MeshScene} from '../src/scene3d.js';
import {addExternalProp} from '../src/external-art.js';
import {externalGeometry} from '../src/external-geometry.js';
const {createCanvas}=await import(pathToFileURL(process.env.CANVAS_MODULE).href);
const names=['world','troops','items','abilities','buildings','missions','quests','biomes','expansion'];
const data=Object.fromEntries(await Promise.all(names.map(async n=>[n,JSON.parse(await readFile(`data/${n}.json`))])));
await mkdir('artifacts',{recursive:true});
const sheet=createCanvas(1050,400),ctx=sheet.getContext('2d');ctx.fillStyle='#243c35';ctx.fillRect(0,0,1050,400);
for(const [i,id] of Object.keys(externalGeometry).entries()){
 const tile=createCanvas(150,360),r=new Renderer(tile,data,{});r.resize(150,360,1);r.cam={x:0,y:0,zoom:6,yaw:Math.PI/4,pitch:.6};
 const s=new MeshScene(r);addExternalProp(s,id,0,0,0,id==='bag'?.28:id==='grain-sack'?.35:.65);s.paint();
 ctx.drawImage(tile,i*150,0);ctx.fillStyle='#e3d1ac';ctx.font='14px sans-serif';ctx.fillText(id,i*150+15,335);
}
await writeFile('artifacts/external-props.png',sheet.toBuffer('image/png'));
const world=createWorld(data);world.buildings=[];world.troops=[];world.enemies=[];world.elapsed=400;world.bounds={w:data.world.width,h:data.world.height};
for(const t of world.tiles)t.claimed=true;
const types=['hall','storehouse','longhouse','farm','pasture','mine','lumber','forge','mill','bakery','grand-granary','market-square','manner-citadel','manor-gardens','sawmill','cottage'];
for(const [i,type] of types.entries()){
 const b=makeBuilding(type,3+(i%4)*4,3+Math.floor(i/4)*4,data,Math.min(3,data.buildings[type].tiers.length));b.remaining=0;b.id='art-'+i;world.buildings.push(b);
}
for(const [name,width,height,yaw,pitch,time] of [['day',1000,850,45,42,400],['reverse',1000,850,225,42,400],['night',1000,850,135,42,960],['phone',390,844,45,42,400]]){
 const canvas=createCanvas(width,height),r=new Renderer(canvas,data,{});r.resize(width,height,1);r.cam={x:11,y:10,zoom:width<600?1.65:2.2,yaw:yaw*Math.PI/180,pitch:pitch*Math.PI/180};r.calm=true;world.elapsed=time;r.draw(world,1000);
 await writeFile(`artifacts/external-village-${name}.png`,canvas.toBuffer('image/png'));
 console.log(name,r.sceneFaces.length,'visible faces');
}
