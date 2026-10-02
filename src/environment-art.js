import {hash2} from './systems/biomes.js';
import {regionById,isRegionClaimed} from './systems/expansion.js';
import {artEnabled,drawMesh} from './asset-art.js';
import {addExternalProp} from './external-art.js';
// Converted CC0 meshes replace or alternate with procedural props when their
// manifest entry is enabled and the mesh doc was preloaded (renderer.meshes).
// Missing/disabled meshes fall back to the original procedural geometry.
const NATIVE_MESH={shrub:'bush',log:'log',rock:'rock-small-a',stone:'stone-small'};
const FLOWERS=['flower-red','flower-yellow','flower-purple'],LILIES=['lily-small','lily-large'],ROCKS=['rock-small-a','rock-small-d'];
export function convertedId(s,item){
 const meshes=s.r?.meshes;
 if(!meshes||item.biome==='unclaimed-fringe'||(item.kind==='shrub'&&item.biome==='hills'))return null;
 let id=null;
 if(item.kind==='flowers')id=FLOWERS[hash2(item.x,item.y,7)%FLOWERS.length];
 else if(item.kind==='lilies')id=LILIES[hash2(item.x,item.y,13)%LILIES.length];
 else if(NATIVE_MESH[item.kind]){
  if(hash2(item.x,item.y,41)%2===0)return null; // alternate for variety
  id=item.kind==='rock'?ROCKS[hash2(item.x,item.y,53)%ROCKS.length]:NATIVE_MESH[item.kind];
 }
 return id&&meshes[id]?.faces?.length&&artEnabled(s.r?.data,id)?id:null;
}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function densityFor(config,claimed){
 const raw=claimed?config?.claimedDensity:config?.wildDensity;
 return clamp(Number.isFinite(raw)?raw:0,0,.5);
}
export function sceneryForTile(dataBiomes,tile,seed=0){
 if(!tile)return null;
 if(tile.landmark)return {kind:'landmark',landmark:tile.landmark,biome:tile.biome};
 const config=dataBiomes?.[tile.biome]?.scenery;
 const props=Array.isArray(config?.props)?config.props.filter(Boolean):[];
 if(!props.length)return null;
 const density=densityFor(config,tile.claimed===true);
 const roll=(hash2(tile.x,tile.y,seed+211)%10000)/10000;
 if(roll>=density)return null;
 const i=hash2(tile.x+37,tile.y-19,seed+977)%props.length;
 return {kind:props[i],biome:tile.biome};
}
export function hotspotAt(dataWorld,x,y){
 const sites=Array.isArray(dataWorld?.hotspots)?dataWorld.hotspots:[];
 return sites.find(site=>site?.x===x&&site?.y===y)||null;
}
 export function visibleFrontierCamps(world,data){
  if(!Array.isArray(world?.tiles)||world.tiles.length!==(data?.world?.width||0)*(data?.world?.height||0))return [];
  const camps=Array.isArray(data?.world?.frontierCamps)?data.world.frontierCamps:[];
  const cleared=Array.isArray(world?.clearedCamps)?world.clearedCamps:[];
  return camps.filter(camp=>{
   if((world.wave||0)<(camp.minWave||0))return false;
   // Act XI (J5): a burned camp stays down once its assault chapter is won.
   // Worlds without the additive ledger (old saves) show every camp.
   if(camp.clearedBy&&cleared.includes(camp.clearedBy))return false;
   const region=regionById(data?.expansion,camp.region);
   return !!region&&!isRegionClaimed(world,region);
  });
 }
function burnRemains(s,camp){
  // G2: cold spent-fire marker where a frontier camp burned. Stone ring +
  // ash bed + charred ends only — no tent, banner or flame (live camps keep
  // the cookfire pyramid). Static boxes, no time/anim (calm-safe).
  const x=camp.x+.5,y=camp.y+.5;
  s.box(x-.24,y-.2,.02,.48,.4,.05,'#6b6a66');
  s.box(x-.08,y-.07,.03,.16,.14,.04,'#575653');
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3,rx=x+Math.cos(a)*.3,ry=y+Math.sin(a)*.24;
    s.box(rx-.05,ry-.05,.03,.1,.1,.09,i%2?'#6f7270':'#8a8d88');
  }
  s.box(x-.22,y-.05,.04,.34,.09,.08,'#2f2b28');
  s.box(x-.05,y+.08,.04,.09,.3,.07,'#3a3532');
  s.box(x+.08,y-.16,.03,.12,.1,.12,'#4a4440');
}
export function burnedRemains(world,data){
  // G2: cleared home camps that leave a spent-fire marker. Mirrors the
  // visibleFrontierCamps filter inverted on the ledger: a camp qualifies
  // only once its assault chapter is won and while its region stays
  // unclaimed. Home sheet only (expeditions excluded by tile count);
  // worlds without the ledger (old saves) leave no remains.
  if(!Array.isArray(world?.tiles)||world.tiles.length!==(data?.world?.width||0)*(data?.world?.height||0))return [];
  const camps=Array.isArray(data?.world?.frontierCamps)?data.world.frontierCamps:[];
  const cleared=Array.isArray(world?.clearedCamps)?world.clearedCamps:[];
  if(!cleared.length)return [];
  return camps.filter(camp=>{
    if(!camp.clearedBy||!cleared.includes(camp.clearedBy))return false;
    if((world.wave||0)<(camp.minWave||0))return false;
    const region=regionById(data?.expansion,camp.region);
    return !!region&&!isRegionClaimed(world,region);
  });
}
export function occupiedTileKeys(world,data){
 const out=new Set();
 for(const b of world?.buildings||[]){
  const size=Math.max(1,Math.ceil(data?.buildings?.[b.type]?.size||1));
  const bx=Math.floor(b.x),by=Math.floor(b.y);
  for(let y=by;y<by+size;y++)for(let x=bx;x<bx+size;x++)out.add(x+','+y);
 }
 return out;
}
export function sceneryPlan(world,data){
 if(!Array.isArray(world?.tiles))return [];
 const occupied=occupiedTileKeys(world,data),seed=Number.isFinite(world?.biomeSeed)?world.biomeSeed:Number.isFinite(data?.world?.seed)?data.world.seed:0,out=[];
 for(const tile of world.tiles){
  if(occupied.has(tile.x+','+tile.y))continue;
  const prop=sceneryForTile(data.biomes,tile,seed);
  if(prop)out.push({...prop,x:tile.x,y:tile.y,claimed:tile.claimed===true});
 }
 // A few tree/log habitats own a shared 2x2 drift; each member still costs
 // one scenery slot and stays within its eligible, unoccupied tile.
 const tiles=new Map(world.tiles.map(t=>[t.x+','+t.y,t])),items=new Map(out.map(p=>[p.x+','+p.y,p])),groups=new Set();
 for(const anchor of [...out]){
  if(anchor.claimed||anchor.biome!=='unclaimed-fringe'||!['pine','log'].includes(anchor.kind))continue;
  const gx=Math.floor(anchor.x/2)*2,gy=Math.floor(anchor.y/2)*2,clusterSeed=hash2(gx,gy,seed+1291);
  if(clusterSeed%3||groups.has(gx+','+gy))continue;
  groups.add(gx+','+gy);
  for(let y=gy;y<gy+2;y++)for(let x=gx;x<gx+2;x++){
   const key=x+','+y,tile=tiles.get(key),existing=items.get(key);
   if(!tile||tile.claimed===true||tile.landmark||tile.biome!=='unclaimed-fringe'||occupied.has(key))continue;
   if(existing&&!['shrub','grass','rock','stone'].includes(existing.kind))continue;
   const item={x,y,kind:clusterSeed%2?'shrub':'rock',biome:tile.biome,claimed:false,clusterSeed,clusterX:gx+1,clusterY:gy+1};
   const member=existing||item;
   if(existing){Object.assign(existing,item);out.splice(out.indexOf(existing),1);}else items.set(key,item);
   out.splice(out.indexOf(anchor)+1,0,member);
  }
 }
 return out;
}
// G1 scorched-ridge: expedition-only ash theme for ix-ashen-crown.
// True only on expedition sheets (home frontier untouched) carrying the
// Ashen Crown landmark while data declares a scorched-ridge map theme.
// Pure read-only derivation — no sim, save, aura or combat touch.
export function isScorchedRidge(world,data){
 if(!Array.isArray(world?.tiles))return false;
 const W=data?.world?.width||0,H=data?.world?.height||0;
 if(W>0&&H>0&&world.tiles.length===W*H)return false;
 if(!world.tiles.some(t=>t?.landmark==='Ashen Crown'))return false;
 const missions=data?.missions;
 if(Array.isArray(missions)){
  return missions.some(m=>m?.map?.theme==='scorched-ridge'&&(m.map?.tiles||[]).some(t=>t?.landmark==='Ashen Crown'));
 }
 return true;
}
// Wilds silhouettes: biome reads come from structure first (conifer vs
// broadleaf, crag vs fieldstone, tuft vs reed vs lily pad) and palette
// second. Every prop stays a pure function of tile position + seed: no time,
// no save fields, flat hex albedo, grounded (z>=0) and tile-scale.
const broadleafAt=(x,y)=>hash2(x,y,991)%100<42;
function rock(s,x,y,scale=1,color='#899087',scorched=false,dark=false){
  if(!scorched&&!dark&&addExternalProp(s,'rock',x,y,.04,.24*scale,Math.PI*.23,true))return;
 // Craggy cluster: a tall shard over flanking slabs with a deterministic lean.
 const light=scorched?'#6a6a6e':dark?'#7d857c':'#adb0a5';
 const lean=((hash2(Math.round(x*7),Math.round(y*7),353)%100)/100-.5)*.12*scale;
 s.pyramid(x-.08*scale,y-.02*scale,.04,.2*scale,.36*scale,color,5);
 s.pyramid(x+.12*scale,y+.06*scale,.04,.14*scale,.22*scale,light,5);
 s.pyramid(x+.02*scale+lean,y-.14*scale,.04,.11*scale,.16*scale,color,4);
 s.box(x-.17*scale,y-.13*scale,.04,.2*scale,.18*scale,.08*scale,light);
 if(dark)s.pyramid(x-.15*scale,y+.15*scale,.04,.09*scale,.13*scale,light,5);
}
function shrub(s,x,y,scale=1,cold=false,scorched=false,dry=false,dark=false){
 if(dry&&!scorched){
  // Hills scrub: low wind-bitten mounds instead of a forest canopy.
  const a=dark?'#3c4d2f':'#5d6b42',b=dark?'#55663c':'#7a8757';
  s.pyramid(x-.1*scale,y,.03,.18*scale,.14*scale,a,5);
  s.pyramid(x+.12*scale,y+.05*scale,.03,.14*scale,.12*scale,b,5);
  s.pyramid(x,y-.1*scale,.03,.12*scale,.1*scale,a,5);
  if(dark)s.pyramid(x-.02*scale,y+.14*scale,.03,.1*scale,.09*scale,b,5);
  return;
 }
 const darkG=scorched?'#42372f':dark?'#2e4a31':cold?'#557a72':'#3f7046',light=scorched?'#6e6258':dark?'#476b41':cold?'#79a49a':'#65925b';
 s.pyramid(x-.08*scale,y,.04,.19*scale,.28*scale,darkG,6);
 s.pyramid(x+.11*scale,y+.04*scale,.04,.15*scale,.23*scale,light,6);
 if(dark)s.pyramid(x+.01*scale,y-.12*scale,.04,.12*scale,.18*scale,light,6);
}
function grass(s,x,y,scale=1,cold=false,dark=false){
 const a=dark?'#3f5a34':cold?'#6d8f70':'#78965b',b=dark?'#54713f':cold?'#84a884':'#8fae6a';
 const blades=[[-.1,0,.24],[.02,-.05,.3],[.11,.04,.2],[-.04,.08,.26],[.07,.09,.17]];
 if(dark)blades.push([-.13,.1,.15],[.14,-.07,.23]);
 for(const [dx,dy,h]of blades)s.box(x+dx*scale,y+dy*scale,.028,.024,.024,h*scale,(dx+dy)>0?b:a);
}
function flowers(s,x,y,scale=1,cold=false,dark=false){
 // Wildflower drift: a grass tuft under three staggered blossom heads.
 const petal=[['#c96a7a','#e9a0ac'],['#d9b04e','#f0d27e'],['#8f7ec0','#b7a8e0']][hash2(Math.round(x*2),Math.round(y*2),727)%3];
 const stem=dark?'#4c6a3f':cold?'#6d8f70':'#78965b';
 grass(s,x,y,scale*.9,cold,dark);
 for(const [dx,dy,h]of[[-.12,-.04,.3],[.02,.06,.36],[.12,-.02,.26]]){
  s.box(x+dx*scale,y+dy*scale,h*scale,.018,.018,.1*scale,stem);
  s.pyramid(x+dx*scale,y+dy*scale,h*scale+.1*scale,.06*scale,.08*scale,petal[0],5);
  s.pyramid(x+dx*scale,y+dy*scale,h*scale+.15*scale,.035*scale,.05*scale,petal[1],5);
 }
}
function stump(s,x,y,scale=1,dark=false){
 const wood=dark?'#4f3c2c':'#73543c',cut=dark?'#8a6a45':'#b48a59';
 s.box(x-.09*scale,y-.09*scale,.03,.18*scale,.18*scale,.19*scale,wood);
 s.box(x-.1*scale,y-.1*scale,.22*scale,.2*scale,.2*scale,.035,cut);
 if(dark)s.pyramid(x+.11*scale,y+.1*scale,.04,.07*scale,.09*scale,wood,4);
}
function fallenLog(s,x,y,scale=1,cold=false,dark=false){
 const wood=cold?'#79939a':dark?'#4f3c2c':'#77583e',cap=cold?'#adc6cb':dark?'#7d6247':'#b68b5d';
 s.box(x-.3*scale,y-.07*scale,.07,.6*scale,.14*scale,.14*scale,wood);
 s.box(x+.27*scale,y-.075*scale,.065,.035,.15*scale,.15*scale,cap);
 if(dark)s.box(x-.24*scale,y+.05*scale,.06,.2*scale,.12*scale,.11*scale,wood);
}
function pine(s,x,y,scale=1,cold=false,dark=false){
 // Layered-canopy conifer. BroadleafAt() deals the broadleaf form from
 // drawProp; this signature stays for existing callers.
 const trunk=cold?'#6c6254':dark?'#4f3c2c':'#73543c';
 const greens=cold?['#4f7773','#6d9a91','#8fb8b0']:dark?['#24402b','#315536','#436b3f']:['#2c563d','#3f7046','#5c8a55'];
 const layers=dark?4:3;
 s.box(x-.035*scale,y-.035*scale,.03,.07*scale,.07*scale,.5*scale,trunk);
 for(let i=0;i<layers;i++)s.pyramid(x,y,(.2+i*.16)*scale,(.32-.06*i)*scale,(.42-.05*i)*scale,greens[Math.min(i,2)],6);
}
function broadleaf(s,x,y,scale=1,cold=false,dark=false){
 // Round offset-crown broadleaf: the forest's second silhouette.
 const trunk=cold?'#6c6254':dark?'#4f3c2c':'#77583e';
 const crown=cold?['#5b8a7e','#7fb0a3']:dark?['#2e4a31','#41653a']:['#356b3c','#4f8a4a'];
 s.box(x-.04*scale,y-.04*scale,.03,.08*scale,.08*scale,.44*scale,trunk);
 s.pyramid(x-.1*scale,y,.28*scale,.22*scale,.22*scale,crown[0],5);
 s.pyramid(x+.12*scale,y+.04*scale,.32*scale,.2*scale,.2*scale,crown[1],5);
 s.pyramid(x,y-.1*scale,.44*scale,.18*scale,.18*scale,crown[0],5);
 s.pyramid(x+.02*scale,y+.06*scale,.56*scale,.14*scale,.16*scale,crown[1],5);
 if(dark)s.pyramid(x-.12*scale,y+.12*scale,.3*scale,.12*scale,.14*scale,crown[0],5);
}
function reeds(s,x,y,scale=1,cold=false,dark=false){
 const green=dark?'#4c6a3f':cold?'#6f8f6a':'#79975f',head=dark?'#8a7440':'#b69a55';
 const stalks=[[-.12,.02,.34],[0,-.05,.42],[.11,.03,.3],[.05,.12,.37],[-.05,.1,.28]];
 if(dark)stalks.push([.13,.1,.24],[-.14,-.06,.3]);
 for(const [dx,dy,h]of stalks){
  s.box(x+dx*scale,y+dy*scale,.02,.022,.022,h*scale,green);
  s.box(x+dx*scale-.015,y+dy*scale-.015,.02+h*scale,.052,.052,.07,head);
 }
}
function lilies(s,x,y,scale=1,cold=false,dark=false){
 // Lily pads sit almost flat at the waterline; one blossom rides a pad.
 const pad=dark?'#2f5a3e':cold?'#3f7a50':'#4a8a58',rim=dark?'#3f7048':cold?'#589a68':'#63a46e',bloom=dark?'#b98ba0':'#e0a7bd';
 for(const [dx,dy,r]of[[-.1,-.05,.17],[.12,.07,.14],[0,.14,.11]]){
  s.pyramid(x+dx*scale,y+dy*scale,.015,r*scale,.04,pad,7);
  s.pyramid(x+dx*scale,y+dy*scale,.03,r*scale*.62,.025,rim,7);
 }
 s.pyramid(x+.11*scale,y-.11*scale,.05,.05*scale,.07*scale,bloom,5);
}
function fieldstone(s,x,y,scale=1,cold=false,dark=false,scorched=false){
 const a=scorched?'#5d5d60':dark?'#5f655c':cold?'#7f8a86':'#9aa08f';
 const b=scorched?'#6a6a6e':dark?'#777d72':cold?'#9aa5a0':'#b7bcab';
 s.pyramid(x-.1*scale,y-.04*scale,.02,.16*scale,.13*scale,a,6);
 s.pyramid(x+.11*scale,y+.05*scale,.02,.12*scale,.11*scale,b,5);
 s.pyramid(x+.02*scale,y-.12*scale,.02,.09*scale,.08*scale,a,6);
 if(cold)s.pyramid(x-.12*scale,y+.13*scale,.015,.11*scale,.03*scale,b,6);
}
function cairn(s,x,y,scale=1,scorched=false){
 if(!scorched){
  s.box(x-.15*scale,y-.13*scale,.03,.3*scale,.26*scale,.11*scale,'#777d77');
  s.box(x-.11*scale,y-.1*scale,.14*scale,.22*scale,.2*scale,.1*scale,'#949b94');
  s.box(x-.06*scale,y-.055*scale,.24*scale,.12*scale,.11*scale,.09*scale,'#b5b8ab');
  s.pyramid(x+.02*scale,y-.01*scale,.33*scale,.07*scale,.1*scale,'#c4c6b8',5);
  return;
 }
 s.box(x-.15*scale,y-.13*scale,.03,.3*scale,.26*scale,.11*scale,'#4a4b4c');
 s.box(x-.11*scale,y-.1*scale,.14*scale,.22*scale,.2*scale,.1*scale,'#5e5f60');
 s.box(x-.06*scale,y-.055*scale,.24*scale,.12*scale,.11*scale,.09*scale,'#757678');
 s.pyramid(x+.02*scale,y-.01*scale,.33*scale,.07*scale,.1*scale,'#8a8b8d',5);
}
function charShard(s,x,y,scale=1){
 // Sparse char detail: two small static shards, no time/anim (calm-safe).
 s.box(x-.12*scale,y-.08*scale,.05,.1*scale,.08*scale,.16*scale,'#2f2b28');
 s.pyramid(x+.1*scale,y+.06*scale,.03,.08*scale,.14*scale,'#4a4440',4);
}
function landmark(s,item,scorched=false){
 const x=item.x+.5,y=item.y+.5,stone=scorched?'#6e6e70':'#aeb7ad',gold=scorched?'#c9a05a':'#e1bd65';
 s.box(x-.18,y-.18,.04,.36,.36,.13,scorched?'#3f3f41':'#6e756e');
 s.box(x-.12,y-.12,.17,.24,.24,.48,stone);
 s.pyramid(x,y,.65,.18,.3,gold,5);
 s.box(x-.025,y-.025,.94,.05,.05,.24,scorched?'#3a2f28':'#6c523b');
}
function frontierCamp(s,camp,faction){
 const x=camp.x+.5,y=camp.y+.5,cloth=faction?.color||'#8b765f',dark='#5a4b3b',wood='#73583f',pale='#c9b88c';
 // Two low canvas tents around a shared cookfire, plus a faction banner.
 for(const [dx,dy,rot]of[[-.3,-.12,0],[.2,.16,1]]){
  s.box(x+dx-.17,y+dy-.13,.03,.34,.26,.08,dark);
  s.pyramid(x+dx,y+dy,.1,.28,.34,cloth,4);
 }
 s.box(x-.025,y-.37,.04,.05,.05,.78,wood);
 s.box(x+.02,y-.37,.61,.34,.025,.18,cloth);
 s.box(x-.18,y+.34,.04,.36,.09,.09,wood);
 s.box(x-.13,y+.29,.1,.26,.2,.06,pale);
 // The cookfire is small enough to read as occupancy, not a new lighting system.
 s.pyramid(x,y+.02,.08,.11,.22,'#e5a458',5);
}
export function drawProp(s,item,seed,scorched=false,zoom=1.8){
 const grouped=item.clusterSeed!==undefined;
 const x=item.x+.5+(grouped?Math.sign(item.clusterX-item.x-.5)*.14:0),y=item.y+.5+(grouped?Math.sign(item.clusterY-item.y-.5)*.14:0),j=((item.clusterSeed??hash2(item.x+13,item.y+29,seed))%1000)/1000;
 const scale=.78+j*.35,cold=item.biome==='water',fringe=item.biome==='unclaimed-fringe';
 const ash=scorched===true&&item.biome==='hills',dark=fringe||ash;
 // Shared habitat members lean toward their common center, not tile centers.
 if(item.claimed===false&&['shrub','grass','reeds','rock','stone'].includes(item.kind)){
  const forms=grouped?[[0,0,1.1+j*.15],[-.1,-.08,.65+j*.1]]:[[-.1,-.12,1.05+j*.2],[.21,.13,.65+j*.18],[-.12,.24,.6+(1-j)*.15]];
  for(const [dx,dy,k]of forms){
   if(item.kind==='shrub')shrub(s,x+dx,y+dy,k,cold,ash,item.biome==='hills',dark);
   else if(item.kind==='grass')grass(s,x+dx,y+dy,k,cold,dark);
   else if(item.kind==='reeds')reeds(s,x+dx,y+dy,k,cold,dark);
   else if(item.kind==='rock')rock(s,x+dx,y+dy,k,ash?'#4f4f52':'#808881',ash,dark);
   else fieldstone(s,x+dx,y+dy,k,cold,dark,ash);
  }
  if(ash&&zoom>=1.2&&(item.kind==='shrub'||item.kind==='rock')&&(hash2(item.x-7,item.y+11,seed+813)%4===0))charShard(s,x,y,scale);
  return;
 }
 // Keep full procedural silhouettes at distance and preserve biome palettes.
 const conv=zoom>=1.2&&!ash?convertedId(s,item):null;
 if(conv){
  const mesh=s.r.meshes[conv],drift=item.kind==='flowers'||item.kind==='lilies';
  if(drift){
   const k=item.kind==='lilies'?.42:.8;
   const doc={faces:mesh.faces.map(f=>({...f,v:f.v.map(([vx,vy,vz])=>[vx*k,vy*k,vz*k]),
    c:item.kind==='lilies'?(f.c==='#29c9ab'?'#3f7a50':f.c==='#2ba6aa'?'#589a68':f.c):f.c}))};
   for(const [dx,dy]of[[-.17,-.08],[.14,.1],[-.02,.19]])drawMesh(s,doc,x+dx,y+dy);
  }else drawMesh(s,mesh,x,y);
  return;
 }
 // Missing P5 meshes still fall back to biome reads: flowers as wildflower
 // drifts, lilies as flat pads (not reeds).
 if(item.kind==='flowers'){flowers(s,x,y,scale,cold,dark);return;}
 if(item.kind==='lilies'){lilies(s,x,y,scale,cold,dark);return;}
 if(item.kind==='landmark')return landmark(s,item,scorched===true&&item.landmark==='Ashen Crown');
 if(item.kind==='pine')return broadleafAt(item.x,item.y)?broadleaf(s,x,y,scale,cold,dark):pine(s,x,y,scale,cold,dark);
 if(item.kind==='shrub'){shrub(s,x,y,scale,cold,ash,item.biome==='hills',dark);if(ash&&zoom>=1.2&&(hash2(item.x-7,item.y+11,seed+813)%4===0))charShard(s,x,y,scale);return;}
 if(item.kind==='grass')return grass(s,x,y,scale,cold,dark);
 if(item.kind==='stump')return stump(s,x,y,scale,dark);
 if(item.kind==='log')return fallenLog(s,x,y,scale,cold,dark);
 if(item.kind==='reeds')return reeds(s,x,y,scale,cold,dark);
 if(item.kind==='cairn'){cairn(s,x,y,scale,ash);if(ash&&zoom>=1.2&&(hash2(item.x-7,item.y+11,seed+813)%4===0))charShard(s,x,y,scale);return;}
 if(item.kind==='rock'){rock(s,x,y,scale,ash?'#4f4f52':'#808881',ash,dark);if(ash&&zoom>=1.2&&(hash2(item.x-7,item.y+11,seed+813)%4===0))charShard(s,x,y,scale);return;}
 if(item.kind==='stone')return fieldstone(s,x,y,scale*.9,cold,dark,ash);
}
export function scorchedThemeKey(world,data){
 return isScorchedRidge(world,data)?'scorched-ridge':'';
}
export function addEnvironmentScenery(scene,world,data){
 if(!scene?.r||!Array.isArray(world?.tiles))return 0;
 const r=scene.r,zoom=r.cam.zoom,seed=Number.isFinite(world?.biomeSeed)?world.biomeSeed:Number.isFinite(data?.world?.seed)?data.world.seed:0;
 const scorched=isScorchedRidge(world,data);
 const plan=sceneryPlan(world,data),oldOwner=scene.owner,oldAlpha=scene.alpha;
 r._livingScenery=plan;
 scene.owner=null;scene.alpha=1;
 let drawn=0,max=zoom<.75?50:zoom<1.2?85:130;
 for(const item of plan){
  if(drawn>=max)break;
  if(zoom<.75&&item.kind!=='landmark')continue;
  if(zoom<1.2&&item.kind!=='landmark'&&((item.clusterSeed??hash2(item.x,item.y,seed+401))&1))continue;
  const p=r.project(item.x+.5,item.y+.5);
  if(p.x<-100||p.x>r.width+100||p.y<-120||p.y>r.height+80)continue;
  const homeSheet=world.tiles.length===(data?.world?.width||0)*(data?.world?.height||0);
  const hotspot=homeSheet&&item.kind==='landmark'?hotspotAt(data?.world,item.x,item.y):null;
  scene.owner=hotspot?{kind:'site',id:hotspot.id,name:hotspot.name,x:item.x,y:item.y}:null;
  drawProp(scene,item,seed,scorched,zoom);drawn++;
 }
 for(const camp of visibleFrontierCamps(world,data)){
  if(drawn>=max)break;
  const p=r.project(camp.x+.5,camp.y+.5);
  if(p.x<-120||p.x>r.width+120||p.y<-140||p.y>r.height+100)continue;
  const faction=(data?.world?.enemyFactions||[]).find(f=>f.id===camp.faction);
  scene.owner={kind:'faction-camp',id:camp.id,name:camp.name,faction:camp.faction,x:camp.x,y:camp.y};
   frontierCamp(scene,camp,faction);drawn++;
  }
  // G2 burned remains: spent-fire markers on cleared tiles, sharing the
  // scenery budget and LOD gating (far overviews stay quiet). Mesh-keyed
  // via the clearedCamps ledger entry in scene3d, so a burn rebuilds once.
  for(const camp of burnedRemains(world,data)){
   if(drawn>=max)break;
   if(zoom<.75)continue;
   if(zoom<1.2&&(hash2(camp.x,camp.y,seed+613)&1))continue;
   const p=r.project(camp.x+.5,camp.y+.5);
   if(p.x<-120||p.x>r.width+120||p.y<-140||p.y>r.height+100)continue;
   scene.owner={kind:'burned-remains',id:camp.id,name:camp.name,faction:camp.faction,x:camp.x,y:camp.y};
   burnRemains(scene,camp);drawn++;
  }
  scene.owner=oldOwner;scene.alpha=oldAlpha;
 return drawn;
}
