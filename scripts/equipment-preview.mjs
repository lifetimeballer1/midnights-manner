// Optional Phase 8 review sheet at gameplay zoom; uses real character meshes.
// Install @napi-rs/canvas outside the game runtime, then run:
//   node scripts/equipment-preview.mjs
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {characterModel} from '../src/character-art.js';
import {DAY_LENGTH,skyLightAt} from '../src/systems/daynight.js';
const {createCanvas}=await import(process.env.CANVAS_MODULE?pathToFileURL(process.env.CANVAS_MODULE).href:'@napi-rs/canvas');
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
await mkdir('artifacts',{recursive:true});
const W=1680,COLS=8,CELL=210,TOP=98,ROW=248;
const equipment=[
 ['Sword','warrior','sword'],['Axe','warrior','axe'],['Warhammer','warrior','warhammer'],['Builder hammer','builder','hammer'],['Forgehammer','weaponsmith','forgehammer'],['Bow','archer','bow'],['Longbow','longbowman','longbow'],['Pike','pikewoman','pike'],
 ['Halberd','halberdier','halberd'],['Pickaxe','miner','pickaxe'],['Felling axe','lumberjack','fellingaxe'],['Cleaver','butcher','cleaver'],['Sickle','farmer','sickle'],['Scythe','farmer','scythe'],['Fishing rod','fisherman','rod'],['Crook','shepherd','crook'],
 ['Net','diver','net'],['Ore cart','miner','cart'],['Berry basket','forager','berry-basket'],['Tome','scholar','tome'],['Compass','scout','compass'],['Chalice','healer','chalice'],['Orrery','scholar','orrery'],['Scales','haggler','scales'],
 ['Tidebell','tidecaller','tidebell'],['Toolkit','builder','toolkit'],['Armor kit','armorer','armorkit'],['Tinker kit','toolsmith','tinkerkit'],['Awl','leatherworker','awl'],['Trowel','mason','trowel'],['Tongs','smelter','tongs'],['Oathblade','oathsworn','oathblade'],
];
const outfits=Object.keys(data.troops),H=TOP+ROW*Math.ceil((equipment.length+outfits.length)/COLS);
function sheet(yaw,view){
 const canvas=createCanvas(W,H),c=canvas.getContext('2d'),r=new Renderer(canvas,data,{});
 r.resize(W,H,1);r.calm=true;r.cam.zoom=1.65;r.cam.yaw=yaw;
 c.fillStyle='#20392f';c.fillRect(0,0,W,H);
 c.fillStyle='#eadcb4';c.font='bold 26px sans-serif';c.fillText(`MIDNIGHTS MANNER - EQUIPMENT SILHOUETTES - ${view.toUpperCase()}`,32,38);
 c.fillStyle='#b8c8b6';c.font='15px sans-serif';c.fillText('Actual gear and profession meshes at 1.65x gameplay zoom; detail-only trim is off.',32,63);
 function panel(i,label,type,gear){
  const col=i%COLS,row=Math.floor(i/COLS),x=col*CELL,y=TOP+row*ROW;
  c.fillStyle='#294537';c.fillRect(x+3,y+3,CELL-6,ROW-6);c.strokeStyle='#69836c';c.strokeRect(x+3,y+3,CELL-6,ROW-6);
  c.save();c.beginPath();c.rect(x+4,y+4,CELL-8,ROW-37);c.clip();
  r.cx=x+CELL/2;r.cy=y+164;r.cam.x=0;r.cam.y=0;
  r.diamond(-.5,-.5,'#6b845c');
  const s=new MeshScene(r),u={id:`preview-${i}`,type,x:0,y:0,hp:100,gear};
  characterModel(s,u,data,0);s.light=skyLightAt(DAY_LENGTH*1.3,null);s.paint();c.restore();
  c.fillStyle='#20392f';c.fillRect(x+4,y+ROW-36,CELL-8,32);
  c.fillStyle='#eadcb4';c.font='bold 14px sans-serif';c.textAlign='center';c.fillText(label,x+CELL/2,y+ROW-16);c.textAlign='left';
 }
 c.fillStyle='#d5e1be';c.font='bold 13px sans-serif';c.fillText('HELD EQUIPMENT',32,TOP-9);
 equipment.forEach(([label,type,gear],i)=>panel(i,label,type,gear));
  outfits.forEach((type,i)=>panel(equipment.length+i,`${data.troops[type].name} outfit`,type,data.troops[type].defaultGear));
 return canvas;
}
await writeFile('artifacts/equipment-front.png',sheet(Math.PI/4,'front').toBuffer('image/png'));
await writeFile('artifacts/equipment-reverse.png',sheet(Math.PI*1.25,'reverse').toBuffer('image/png'));
console.log('Review sheets: artifacts/equipment-front.png, artifacts/equipment-reverse.png');
