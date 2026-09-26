// Optional review artifact. Uses @napi-rs/canvas installed outside this repo;
// supply CANVAS_MODULE with its absolute index.js path. No game dependency.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {drawWall,drawFoundation,drawArchitecture} from '../src/building-art.js';
const {createCanvas,loadImage}=await import(process.env.CANVAS_MODULE?pathToFileURL(process.env.CANVAS_MODULE).href:'@napi-rs/canvas');
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const names=Object.values(data.buildings).flatMap(b=>b.tiers.map(t=>t.sprite));
const images=Object.fromEntries(await Promise.all(names.map(async n=>[n,await loadImage(new URL(`../assets/sprites/${n}`,import.meta.url).pathname)])));
const canvas=createCanvas(1200,900),c=canvas.getContext('2d'),r=new Renderer(canvas,data,images);
c.fillStyle='#203b2a';c.fillRect(0,0,1200,900);c.fillStyle='#f7dfab';c.font='bold 30px sans-serif';c.fillText('MIDNIGHTS MANNER · ARCHITECTURE PREVIEW',36,48);c.fillStyle='#c9d9b6';c.font='17px sans-serif';c.fillText('Actual Canvas artwork · connected defenses and raised foundations',36,80);
r.cam={x:0,y:0,zoom:2};
for(let level=1;level<=3;level++){
 r.cx=200+(level-1)*400;r.cy=190;
 c.fillStyle='#d5e1be';c.font='bold 20px sans-serif';c.fillText(['TIMBER PALISADE','STONE BATTLEMENT','FORTIFIED WALL'][level-1],r.cx-150,132);
 const world={buildings:[]};for(let y=0;y<4;y++)for(let x=0;x<4;x++){r.diamond(x,y,(x+y)%2?'#70964e':'#648a43');if(x===0||y===3)world.buildings.push({type:'wall',x,y,hp:100,level,remaining:0});}
 world.buildings.sort((a,b)=>a.x+a.y-b.x-b.y).forEach(b=>drawWall(r,b,world));
}
for(let i=0;i<6;i++){
 const type=['hall','hall','hall','farm','tower','barracks'][i],level=i<3?i+1:Math.min(3,data.buildings[type].tiers.length),spec=data.buildings[type];
 r.cx=180+(i%3)*400;r.cy=510+Math.floor(i/3)*220;
 c.fillStyle='#d5e1be';c.font='bold 18px sans-serif';c.fillText(`${spec.name} · Tier ${level}`,r.cx-140,r.cy-90);
 for(let y=-1;y<spec.size+1;y++)for(let x=-1;x<spec.size+1;x++)r.diamond(x,y,(x+y)%2?'#70964e':'#648a43');
 const b={type,x:0,y:0,level,hp:100};drawFoundation(r,b,spec);if(!drawArchitecture(r,b,spec))r.sprite(spec.tiers[level-1].sprite,spec.size/2,spec.size/2,spec.size===2?79:51);
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/architecture-preview.png',canvas.toBuffer('image/png'));
console.log('artifacts/architecture-preview.png');
