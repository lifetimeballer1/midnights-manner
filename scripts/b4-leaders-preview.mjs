// Optional B4 visual QA with the actual baked bodies and gear loaded.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createCanvas} from '@napi-rs/canvas';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {characterModel} from '../src/character-art.js';

const root=new URL('../',import.meta.url);
const data=Object.fromEntries(await Promise.all(['world','troops','items','buildings','art-manifest','conquest','endgame'].map(async name=>[name,JSON.parse(await readFile(new URL(`data/${name}.json`,root)))])));
const meshes={};
for(const folder of ['baked','gear'])for(const file of await readdir(new URL(`assets/meshes/${folder}/`,root))){
 if(!file.endsWith('.json'))continue;
 meshes[(folder==='gear'?'gear-':'')+file.slice(0,-5)]=JSON.parse(await readFile(new URL(`assets/meshes/${folder}/${file}`,root)));
}
const bossIds=['ironshield-warden','thornband-vex','cinder-sorr','palehost-herald','ember-cindral','grey-sovereign','ashen-warlord','cinder-maul','pale-queen'];
const factions=['thornband','thornband','cinder-clan','pale-host','ember-legion','pale-court','ember-legion','cinder-clan','pale-court'];
const leaders=[...data.conquest.leaders,...data.endgame.bosses];
const canvas=createCanvas(1440,1000),c=canvas.getContext('2d'),r=new Renderer(canvas,data,{});
r.width=1440;r.height=1000;r.calm=true;r.cam.yaw=Math.PI/4;r.cam.zoom=4;r.cam.x=0;r.cam.y=0;r.meshes=meshes;
c.fillStyle='#20392f';c.fillRect(0,0,r.width,r.height);
c.fillStyle='#eadcb4';c.font='bold 26px sans-serif';c.fillText('B4 NAMED LEADERS - BAKED BODY SCALE',36,44);
c.font='16px sans-serif';c.fillText('Zoom 4 | Yaw pi/4 | Calm | Baked bodies + gear loaded',36,72);
bossIds.forEach((bossId,i)=>{
 const spec=leaders.find(leader=>leader.id===bossId);
 if(!spec)throw new Error(`Missing leader: ${bossId}`);
 r.cx=240+(i%3)*480;r.cy=325+Math.floor(i/3)*290;
 const s=new MeshScene(r);
 characterModel(s,{id:bossId,type:'enemy',bossId,role:'boss',faction:factions[i],x:0,y:0,hp:100},data,0,true);s.paint();
 c.fillStyle='#eadcb4';c.font='bold 18px sans-serif';c.textAlign='center';c.fillText(spec.name,r.cx,r.cy+38);
 c.font='14px sans-serif';c.fillText(bossId,r.cx,r.cy+62);
});
await writeFile(new URL('artifacts/b4-leaders.png',root),canvas.toBuffer('image/png'));
console.log('Rendered artifacts/b4-leaders.png');
