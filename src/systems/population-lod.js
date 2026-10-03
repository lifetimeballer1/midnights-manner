// Renderer-only population virtualization for large settlements.
// Every villager remains in simulation; this only decides which bodies are
// worth building into the Canvas mesh for the current frame.

function stableIdScore(id){
 const s=String(id??'');
 let h=2166136261;
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
 return h>>>0;
}

export function populationRenderBudget(width,zoom,count){
 const n=Math.max(0,Number(count)||0);
 if(n<96)return n;
 const phone=(Number(width)||0)<700,z=Number(zoom)||1;
 if(z>=1.85)return phone?140:220;
 if(z>=1.25)return phone?104:176;
 return phone?72:128;
}

export function selectPopulationRenderUnits(units,{
 project,
 width=1100,
 height=740,
 zoom=1,
 selectedId=null,
 important=null,
}={}){
 const source=Array.isArray(units)?units:[],z=Math.max(.1,Number(zoom)||1);
 const pad=50*z,onScreen=[];
 for(const u of source){
  if(!u||u.hp<=0)continue;
  const p=project?.(u);
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  if(p.x<-pad||p.x>width+pad||p.y<-pad||p.y>height+pad)continue;
  onScreen.push({u,p});
 }
 const budget=populationRenderBudget(width,z,onScreen.length);
 if(onScreen.length<=budget)return {
  units:onScreen.map(x=>x.u),
  stats:{eligible:source.length,onScreen:onScreen.length,rendered:onScreen.length,virtualized:0,budget},
 };

 const forced=[],rest=[];
 for(const row of onScreen){
  const u=row.u;
  if(u.id===selectedId||important?.(u))forced.push(row);
  else rest.push(row);
 }
 // Stable ordering prevents representatives from flickering when a dense crowd
 // holds still. Spatial buckets preserve the shape of the crowd instead of
 // simply keeping the first N villagers.
 rest.sort((a,b)=>stableIdScore(a.u.id)-stableIdScore(b.u.id));
 const cell=z<1.25?54:z<1.85?44:36;
 const perCell=z<1.25?2:z<1.85?3:4;
 const bucketUse=new Map(),picked=[];
 const target=Math.max(budget,forced.length);
 for(const row of rest){
  if(forced.length+picked.length>=target)break;
  const key=`${Math.floor(row.p.x/cell)},${Math.floor(row.p.y/cell)}`;
  const used=bucketUse.get(key)||0;
  if(used>=perCell)continue;
  bucketUse.set(key,used+1);picked.push(row);
 }
 // Sparse scenes can leave budget unused after bucket limits; fill remaining
 // slots deterministically so zooming never makes a settlement look empty.
 if(forced.length+picked.length<target){
  const chosen=new Set(picked.map(x=>x.u.id));
  for(const row of rest){
   if(forced.length+picked.length>=target)break;
   if(chosen.has(row.u.id))continue;
   chosen.add(row.u.id);picked.push(row);
  }
 }
 const rows=[...forced,...picked];
 rows.sort((a,b)=>a.p.y-b.p.y||a.p.x-b.p.x||stableIdScore(a.u.id)-stableIdScore(b.u.id));
 return {
  units:rows.map(x=>x.u),
  stats:{eligible:source.length,onScreen:onScreen.length,rendered:rows.length,virtualized:onScreen.length-rows.length,budget},
 };
}
