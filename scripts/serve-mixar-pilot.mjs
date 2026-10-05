// Local review server. Its own localhost origin keeps real player saves separate.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,extname} from 'node:path';
import {createWorld,makeBuilding} from '../src/model.js';
import {VERSION} from '../src/storage.js';

const root=resolve('dist'),port=Number(process.env.PREVIEW_PORT||4199);
const data=Object.fromEntries(await Promise.all(['world','buildings','troops','items','abilities','quests','expansion','biomes'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const world=createWorld(data);
world.bounds={w:20,h:17};world.nextRaidAt=1e9;world.nextFrontierEventAt=1e9;world.troops=[];
world.buildings=[['cottage',6,7],['hall',9,7],['forge',12,7]].map(([type,x,y])=>makeBuilding(type,x,y,data,6));
for(const key of Object.keys(world.resources))world.resources[key]=5000;
const state={version:VERSION,world,home:null,mission:null,completed:[],unlocks:data.world.locked,xp:2640,vlevel:11,questsCompleted:data.quests.map(q=>q.id)};
const seed=`<script>if(!localStorage.getItem('midnights-manner-v2')){localStorage.setItem('midnights-manner-v2',${JSON.stringify(JSON.stringify(state))});localStorage.setItem('midnights-manner-guide-v1','{"done":true}');}document.addEventListener('DOMContentLoaded',()=>{document.title='Actual Mixar Buildings - Local Pilot';document.querySelector('#begin').addEventListener('click',()=>setTimeout(()=>{document.querySelector('#news-close')?.click();window.midnightsManner?.setCamera({x:10,y:8,zoom:2.5});},600));});</script>`;
createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+(path==='/'?'/index.html':path)),rel=relative(root,file);
  if(rel.startsWith('..')||isAbsolute(rel)){res.writeHead(403);res.end('Forbidden');return;}
  let content=await readFile(file);
  if(rel==='index.html')content=Buffer.from(content.toString().replace('<body>',seed+'<body>'));
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Actual-model review: http://127.0.0.1:${port}/ (local pilot, isolated saves)`));
