// Optional local rendering review. No runtime dependency; use CANVAS_MODULE.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {Game} from '../src/game.js';
const {createCanvas,loadImage}=await import(pathToFileURL(process.env.CANVAS_MODULE).href);
const names=['world','troops','items','abilities','buildings','missions','quests','biomes'];
const data=Object.fromEntries(await Promise.all(names.map(async n=>[n,JSON.parse(await readFile(`data/${n}.json`))])));
const sprites=[...Object.values(data.troops).map(t=>t.sprite),...Object.values(data.items).map(t=>t.sprite),...Object.values(data.buildings).flatMap(b=>b.tiers.map(t=>t.sprite)),'raider.png','resource-food.svg','resource-wood.svg','resource-gold.svg'];
const images=Object.fromEntries(await Promise.all([...new Set(sprites)].map(async name=>[name,await loadImage('assets/sprites/'+name)])));
const game=new Game(data);game.world.buildings.forEach(b=>{b.level=Math.min(2,data.buildings[b.type].tiers.length);});
await mkdir('artifacts',{recursive:true});
for(const [name,yaw,pitch] of [['village',45,31],['reverse',225,31],['low',135,22],['overhead',315,78]]){
 const canvas=createCanvas(1000,800),r=new Renderer(canvas,data,images);r.resize(1000,800,1);r.fitVillage(game.world);r.cam.zoom=2.3;r.cam.yaw=yaw*Math.PI/180;r.cam.pitch=pitch*Math.PI/180;r.calm=true;r.draw(game.world,1000);
 await writeFile('artifacts/orbit-'+name+'.png',canvas.toBuffer('image/png'));
}
