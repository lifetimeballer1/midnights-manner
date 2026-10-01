// Permanent half-tile infrastructure extends the existing sparse trail ledger.
import {trailWearAt,trailRevision} from './trails.js';
const revisions=new WeakMap(),routeLists=new WeakMap();
export const ROAD_SPEED=Object.freeze([1,1.18,1.30]);
export function roadRevision(w){return revisions.get(w)||0;}
export function roadAt(w,x,y){return w.roads?.[`${Math.floor(x*2)},${Math.floor(y*2)}`]||0;}
export function normalizeRoads(w,d){const out={};for(const [k,v] of Object.entries(w.roads||{})){if(!/^\d+,\d+$/.test(k)||![1,2].includes(v))continue;const [x,y]=k.split(',').map(Number);if(x<d.world.width*2&&y<d.world.height*2&&k===`${x},${y}`)out[k]=v;}w.roads=out;revisions.set(w,roadRevision(w)+1);return out;}
export function greatWorkTier(w,type){let tier=0;for(const b of w.buildings||[])if(b.type===type&&b.hp>0&&b.remaining<=0)tier=Math.max(tier,b.level||1);return tier;}
// Quotes select a connected, established route, never the whole town. No spend
// occurs during quoting. Each click revalidates the exact current quote.
export function roadQuote(w,d,seed,tier=1){
 const unlocked=greatWorkTier(w,'stone-road');if(!unlocked||tier===2&&unlocked<3)return {cells:[],cost:{},error:tier===2?'Stone paving needs Road Network tier 3.':'Build the Stone Road Network first.'};
 if(![1,2].includes(tier)||!/^\d+,\d+$/.test(seed||''))return {cells:[],cost:{},error:'Choose an established route.'};
 const cells=[],seen=new Set([seed]),queue=[seed],tiles=new Map((w.tiles||[]).map(t=>[`${t.x},${t.y}`,t.claimed])),allowed=k=>{
  const [ix,iy]=k.split(',').map(Number),x=(ix+.5)/2,y=(iy+.5)/2;
  if(ix<0||iy<0||ix>=d.world.width*2||iy>=d.world.height*2||!((tiles.get(`${Math.floor(x)},${Math.floor(y)}`)??true)))return false;
  if(w.buildings.some(b=>b.hp>0&&b.type!=='gate'&&b.type!=='trap'&&x>=b.x&&x<b.x+d.buildings[b.type].size&&y>=b.y&&y<b.y+d.buildings[b.type].size))return false;
  return (tier===2?(w.roads?.[k]||0)>=1:trailWearAt(w,x,y)>=15)&&(w.roads?.[k]||0)<tier;
 };
 for(let i=0;i<queue.length&&cells.length<64;i++){const k=queue[i];if(!allowed(k))continue;cells.push(k);const [x,y]=k.split(',').map(Number);for(const [a,b] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){const n=`${a},${b}`;if(!seen.has(n)){seen.add(n);queue.push(n);}}}
 const cost=tier===1?{wood:cells.length*2,gold:cells.length}:{lumber:cells.length*2,gold:cells.length*3};
 return {cells,cost,tier,seed,error:cells.length?null:'No eligible route here.'};
}
export function buildRoad(w,d,seed,tier=1){const q=roadQuote(w,d,seed,tier);if(q.error)return {ok:false,error:q.error};for(const [k,n] of Object.entries(q.cost))if((w.resources[k]||0)<n)return {ok:false,error:'Not enough stores for this road.'};for(const [k,n] of Object.entries(q.cost))w.resources[k]-=n;w.roads??={};for(const k of q.cells)w.roads[k]=tier;revisions.set(w,roadRevision(w)+1);return {ok:true,count:q.cells.length};}
// Living Kingdom slice 1: cached scorer for builder road jobs. Trail wear
// today; destination-choice weighting belongs to a later task.
export function roadImportance(w,d,key){const e=w.trails?.[key];return (e?.[0]||0);}
export function busyRoutes(w,limit=4,d=null){const rev=infrastructureRevision(w),cached=routeLists.get(w);if(cached&&cached.rev===rev&&cached.limit===limit)return cached.out;const candidates=[];for(const [key] of Object.entries(w.trails||{})){const wear=roadImportance(w,d,key);if(wear<15||(w.roads?.[key]||0)===2)continue;if(d){const [ix,iy]=key.split(',').map(Number),x=(ix+.5)/2,y=(iy+.5)/2;if(w.buildings.some(b=>b.hp>0&&b.type!=='gate'&&b.type!=='trap'&&x>=b.x&&x<b.x+d.buildings[b.type].size&&y>=b.y&&y<b.y+d.buildings[b.type].size))continue;}const row={key,wear,road:w.roads?.[key]||0};let i=0;while(i<candidates.length&&candidates[i].wear>=row.wear)i++;candidates.splice(i,0,row);if(candidates.length>64)candidates.pop();}const out=[];for(const row of candidates){const [x,y]=row.key.split(',').map(Number);if(out.some(r=>{const [a,b]=r.key.split(',').map(Number);return Math.hypot(x-a,y-b)<8;}))continue;if(d&&roadQuote(w,d,row.key,row.road?2:1).error)continue;out.push(row);if(out.length>=limit)break;}routeLists.set(w,{rev,limit,out});return out;}
export function infrastructureRevision(w){return `${trailRevision(w)}:${roadRevision(w)}`;}
