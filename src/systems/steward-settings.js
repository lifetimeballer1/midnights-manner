// Additive bounded save records. Runtime caches never pass through this file.
export function stewardExtras(config,world,data){
 const out={},buildings=new Map(world.buildings.map(b=>[b.id,b]));
 const validId=id=>typeof id==='string'&&id.length>0&&id.length<=80;
 for(const key of ['autoEquip','queueEnabled'])if(config[key]!==undefined)out[key]=config[key]===true;
 if(config.productionTargets!==undefined){
  out.productionTargets={};
  for(const key of Object.keys(world.resources)){
   const n=config.productionTargets?.[key];
   if(Number.isFinite(n)&&n>=0)out.productionTargets[key]=Math.min(100000,Math.floor(n));
  }
 }
 if(config.queue!==undefined){
  out.queue=[];const ids=new Set(),targets=new Set();
  for(const e of (Array.isArray(config.queue)?config.queue:[]).slice(0,12)){
   if(!e||!validId(e.id)||ids.has(e.id)||!['build','upgrade'].includes(e.kind))continue;
   const b=buildings.get(e.buildingId),spec=data.buildings[b?.type||e.type];
   if(!spec||!Number.isInteger(e.targetTier)||e.targetTier<1||e.targetTier>spec.tiers.length)continue;
   if(e.kind==='upgrade'&&!b)continue;
   if(e.kind==='build'&&(!data.buildings[e.type]||e.type==='hall'||!Number.isInteger(e.x)||!Number.isInteger(e.y)||e.x<0||e.y<0||e.x>=data.world.width||e.y>=data.world.height))continue;
   if(e.buildingId&&(!b||e.kind==='build'&&b.type!==e.type))continue;
   const key=b?`building:${b.id}`:`tile:${e.x},${e.y}`;if(targets.has(key))continue;
   const row={id:e.id,kind:e.kind,targetTier:e.targetTier};
   if(b)row.buildingId=b.id;
   if(e.kind==='build')Object.assign(row,{type:e.type,x:e.x,y:e.y});
   out.queue.push(row);ids.add(e.id);targets.add(key);
  }
 }
 if(config.districts!==undefined){
  out.districts=[];const ids=new Set(),members=new Set();
  for(const d of (Array.isArray(config.districts)?config.districts:[]).slice(0,6)){
   if(!d||!validId(d.id)||ids.has(d.id)||!['food','industry','housing','defense','general'].includes(d.kind)||typeof d.name!=='string'||!d.name.trim())continue;
   const buildingIds=[];
   for(const id of (Array.isArray(d.buildingIds)?d.buildingIds:[]).slice(0,24))if(buildings.has(id)&&!members.has(id)){members.add(id);buildingIds.push(id);}
   out.districts.push({id:d.id,name:d.name.trim().slice(0,32),kind:d.kind,priority:['balanced','supply','repair'].includes(d.priority)?d.priority:'balanced',buildingIds});ids.add(d.id);
  }
 }
 if(config.blueprints!==undefined){
  out.blueprints=[];const ids=new Set();
  for(const b of (Array.isArray(config.blueprints)?config.blueprints:[]).slice(0,4)){
   if(!b||!validId(b.id)||ids.has(b.id)||!Array.isArray(b.entries)||!b.entries.length||b.entries.length>12)continue;
   const entries=[];
   for(const e of b.entries){
    const spec=data.buildings[e?.type];
    if(!spec||e.type==='hall'||!Number.isInteger(e.dx)||!Number.isInteger(e.dy)||e.dx<0||e.dy<0||e.dx>=data.world.width||e.dy>=data.world.height||!Number.isInteger(e.targetTier)||e.targetTier<1||e.targetTier>spec.tiers.length){entries.length=0;break;}
    entries.push({type:e.type,dx:e.dx,dy:e.dy,targetTier:e.targetTier});
   }
   if(entries.length){out.blueprints.push({id:b.id,name:typeof b.name==='string'?b.name.trim().slice(0,48)||'Village plan':'Village plan',entries});ids.add(b.id);}
  }
 }
 return out;
}
