import {hash2} from './systems/biomes.js';
import {regionById,isRegionClaimed} from './systems/expansion.js';

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
function rock(s,x,y,scale=1,color='#899087',scorched=false){
 s.pyramid(x,y,.04,.18*scale,.24*scale,color,5);
 if(scale>.95)s.pyramid(x+.14*scale,y-.08*scale,.04,.11*scale,.15*scale,scorched?'#6a6a6e':'#adb0a5',5);
}
function shrub(s,x,y,scale=1,cold=false,scorched=false){
 const dark=scorched?'#42372f':cold?'#557a72':'#3f7046',light=scorched?'#6e6258':cold?'#79a49a':'#65925b';
 s.pyramid(x-.08*scale,y,.04,.19*scale,.28*scale,dark,6);
 s.pyramid(x+.11*scale,y+.04*scale,.04,.15*scale,.23*scale,light,6);
}
function grass(s,x,y,scale=1){
 for(const [dx,dy,h]of[[-.08,0,.22],[.03,-.04,.27],[.1,.05,.18]])s.box(x+dx*scale,y+dy*scale,.03,.025,.025,h*scale,'#78965b');
}
function stump(s,x,y,scale=1){
 s.box(x-.09*scale,y-.09*scale,.03,.18*scale,.18*scale,.19*scale,'#73543c');
 s.box(x-.1*scale,y-.1*scale,.22*scale,.2*scale,.2*scale,.035,'#b48a59');
}
function fallenLog(s,x,y,scale=1,cold=false){
 const wood=cold?'#79939a':'#77583e',cap=cold?'#adc6cb':'#b68b5d';
 s.box(x-.3*scale,y-.07*scale,.07,.6*scale,.14*scale,.14*scale,wood);
 s.box(x+.27*scale,y-.075*scale,.065,.035,.15*scale,.15*scale,cap);
}
function pine(s,x,y,scale=1,cold=false){
 const trunk=cold?'#6c6254':'#73543c',greens=cold?['#4f7773','#6d9a91']:['#315d43','#4c7b4e'];
 s.box(x-.035*scale,y-.035*scale,.03,.07*scale,.07*scale,.5*scale,trunk);
 s.pyramid(x,y,.25*scale,.28*scale,.55*scale,greens[0],6);
 s.pyramid(x,y,.48*scale,.22*scale,.45*scale,greens[1],6);
}
function reeds(s,x,y,scale=1){
 for(const [dx,dy,h]of[[-.09,.02,.32],[0,-.04,.4],[.1,.03,.28],[.05,.11,.35]]){
  s.box(x+dx*scale,y+dy*scale,.02,.022,.022,h*scale,'#79975f');
  s.box(x+dx*scale-.015,y+dy*scale-.015,.02+h*scale,.052,.052,.07,'#b69a55');
 }
}
function cairn(s,x,y,scale=1,scorched=false){
 if(!scorched){
  s.box(x-.15*scale,y-.13*scale,.03,.3*scale,.26*scale,.11*scale,'#777d77');
  s.box(x-.11*scale,y-.1*scale,.14*scale,.22*scale,.2*scale,.1*scale,'#949b94');
  s.box(x-.06*scale,y-.055*scale,.24*scale,.12*scale,.11*scale,.09*scale,'#b5b8ab');
  return;
 }
 s.box(x-.15*scale,y-.13*scale,.03,.3*scale,.26*scale,.11*scale,'#4a4b4c');
 s.box(x-.11*scale,y-.1*scale,.14*scale,.22*scale,.2*scale,.1*scale,'#5e5f60');
 s.box(x-.06*scale,y-.055*scale,.24*scale,.12*scale,.11*scale,.09*scale,'#757678');
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
function drawProp(s,item,seed,scorched=false,zoom=1.8){
 const x=item.x+.5,y=item.y+.5,j=(hash2(item.x+13,item.y+29,seed)%1000)/1000;
 const scale=.78+j*.35,cold=item.biome==='water'||item.biome==='unclaimed-fringe';
 const ash=scorched===true&&item.biome==='hills';
 if(item.kind==='landmark')return landmark(s,item,scorched===true&&item.landmark==='Ashen Crown');
 if(item.kind==='pine')return pine(s,x,y,scale,cold);
 if(item.kind==='shrub'){shrub(s,x,y,scale,cold,ash);if(ash&&zoom>=1.2&&(hash2(item.x-7,item.y+11,seed+813)%4===0))charShard(s,x,y,scale);return;}
 if(item.kind==='grass')return grass(s,x,y,scale);
 if(item.kind==='stump')return stump(s,x,y,scale);
 if(item.kind==='log')return fallenLog(s,x,y,scale,cold);
 if(item.kind==='reeds')return reeds(s,x,y,scale);
 if(item.kind==='cairn'){cairn(s,x,y,scale,ash);if(ash&&zoom>=1.2&&(hash2(item.x-7,item.y+11,seed+813)%4===0))charShard(s,x,y,scale);return;}
 if(item.kind==='rock'){rock(s,x,y,scale,ash?'#4f4f52':'#808881',ash);if(ash&&zoom>=1.2&&(hash2(item.x-7,item.y+11,seed+813)%4===0))charShard(s,x,y,scale);return;}
 if(item.kind==='stone')return rock(s,x,y,scale*.75,ash?'#5d5d60':'#92988d',ash);
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
  if(zoom<1.2&&item.kind!=='landmark'&&(hash2(item.x,item.y,seed+401)&1))continue;
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
 scene.owner=oldOwner;scene.alpha=oldAlpha;
 return drawn;
}
