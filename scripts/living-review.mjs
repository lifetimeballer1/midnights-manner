// Optional offline review: original orbit meshes, motion samples and crowded village.
// CANVAS_MODULE=/absolute/path/to/@napi-rs/canvas/index.js node scripts/living-review.mjs
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel} from '../src/scene3d.js';
import {addLivingMechanisms} from '../src/mechanical-art.js';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {recordTravel} from '../src/systems/trails.js';
const {createCanvas}=await import(process.env.CANVAS_MODULE?pathToFileURL(process.env.CANVAS_MODULE).href:'@napi-rs/canvas');
const names=['world','troops','items','buildings','abilities','quests','missions','biomes','expansion'];
const data=Object.fromEntries(await Promise.all(names.map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
await mkdir('artifacts',{recursive:true});
for(const [tag,yaw] of [['front',Math.PI/4],['reverse',Math.PI*1.25],['side',Math.PI/2]]){
 const canvas=createCanvas(1440,1100),c=canvas.getContext('2d'),r=new Renderer(canvas,data,{});r.width=1440;r.height=1100;r.cam.yaw=yaw;
 c.fillStyle='#243b32';c.fillRect(0,0,1440,1100);c.fillStyle='#eadcb4';c.font='bold 25px sans-serif';c.fillText('Physical work mechanisms · '+tag,30,40);
 ['mine','mill','forge','sawmill','lumber','farm','pond','mason_yard','bakery','tannery','fletcher','barracks'].forEach((type,i)=>{
  const spec=data.buildings[type],b={id:'review-'+type,type,x:0,y:0,level:3,hp:100,remaining:0,harvestBonus:0},world={buildings:[b],troops:[{id:'worker-'+type,hp:100,workplace:b.id}],enemies:[],elapsed:400};
  r.cx=180+(i%4)*360;r.cy=255+Math.floor(i/4)*325;r.cam.x=spec.size/2;r.cam.y=spec.size/2;r.cam.zoom=4;
  for(let x=0;x<spec.size;x++)for(let y=0;y<spec.size;y++)r.diamond(x,y,(x+y)%2?'#6b845c':'#728e63');
  const s=new MeshScene(r);buildingModel(s,b,spec,world);addLivingMechanisms(s,world,2200);s.paint();c.fillStyle='#eadcb4';c.font='bold 18px sans-serif';c.textAlign='center';c.fillText(spec.name,r.cx,r.cy+110);
 });await writeFile(`artifacts/living-${tag}.png`,canvas.toBuffer('image/png'));
}
const world=createWorld(data);world.elapsed=400;world.buildings=[];world.troops=[];
let i=0;for(const type of Object.keys(data.buildings)){
 const x=2+(i%10)*4,y=2+Math.floor(i/10)*4,b=makeBuilding(type,x,y,data,Math.min(6,data.buildings[type].tiers.length));b.id='stress-'+i;b.remaining=0;world.buildings.push(b);const troop=data.buildings[type].workplace;
 if(troop&&data.troops[troop]){const u=makeUnit(troop,data,i);u.id='stress-unit-'+i;u.x=x+data.buildings[type].size/2;u.y=y+data.buildings[type].size;u.workplace=b.id;world.troops.push(u);}i++;
}
for(let i=0;i<300;i++){recordTravel(world,data,4.25,4.25,28.25,4.25);recordTravel(world,data,10.25,4.25,10.25,24.25);}
await writeFile('/tmp/living-review-world.json',JSON.stringify(world));
for(const [w,h,yaw,zoom,tag,calm,raid] of [[1280,900,Math.PI/4,1.65,'desktop',false,false],[390,844,Math.PI/4,1.65,'phone',false,false],[1280,900,Math.PI*1.25,2.4,'reverse-close',false,false],[1280,900,Math.PI/2,.65,'far',false,false],[390,844,Math.PI/4,1.65,'calm',true,false],[1280,900,Math.PI/4,1.65,'raid',false,true]]){
 const canvas=createCanvas(w,h),r=new Renderer(canvas,data,{});r.resize(w,h,1);r.cam={x:16,y:12,zoom,yaw,pitch:.8};r.calm=calm;world.enemies=raid?Array.from({length:16},(_,i)=>({id:'raider-'+i,hp:100,maxHp:100,x:8+i*.3,y:8,type:'enemy',role:i%2?'archer':'raider',animation:.2})):[];
 r.draw(world,2200);await writeFile(`artifacts/living-village-${tag}.png`,canvas.toBuffer('image/png'));
 const times=[];for(let i=0;i<12;i++){const start=performance.now();r.draw(world,2200+i*50);times.push(performance.now()-start);}times.sort((a,b)=>a-b);console.log(tag,JSON.stringify({medianMs:+times[6].toFixed(1),p95Ms:+times[11].toFixed(1),faces:r.sceneFaces.length,staticFaces:r._meshStatic.faces.length}));
}
