import {buildingCost} from '../model.js';
import {constructionBuildReason,enqueueConstruction,plannedConstructionWorld,CONSTRUCTION_LIMIT} from './steward-construction.js';
const shelves=game=>Array.isArray(game.world.steward?.blueprints)?game.world.steward.blueprints.slice(0,4):[];
const sumCost=(out,cost)=>{for(const [k,n] of Object.entries(cost))out[k]=(out[k]||0)+n;};
export function captureBlueprint(game,name,buildingIds){
 if(game.state.mission)return {ok:false,error:'Blueprints wait at home'};
 const blueprints=shelves(game);if(blueprints.length>=4)return {ok:false,error:'Blueprint shelf is full (4)'};
 if(!Array.isArray(buildingIds)||!buildingIds.length||buildingIds.length>12)return {ok:false,error:'Choose 1–12 existing buildings'};
 const ids=[...new Set(buildingIds)],buildings=ids.map(id=>game.world.buildings.find(b=>b.id===id));
 if(buildings.some(b=>!b||b.type==='hall'||b.hp<=0||b.remaining>0))return {ok:false,error:'Select finished living buildings; the manor cannot be copied'};
 const x=Math.min(...buildings.map(b=>b.x)),y=Math.min(...buildings.map(b=>b.y));
 const id=globalThis.crypto?.randomUUID?.()||`blueprint-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const record={id,name:String(name||'Village plan').trim().slice(0,48)||'Village plan',entries:buildings.map(b=>({type:b.type,dx:b.x-x,dy:b.y-y,targetTier:b.level}))};
 if(!game.world.steward)game.world.steward={enabled:false,main:null,secondary:[],protectMeals:true,protectRepairs:true};
 game.world.steward.blueprints=[...blueprints,record];return {ok:true,id};
}
export function removeBlueprint(game,id){
 if(game.state.mission)return {ok:false,error:'Blueprints wait at home'};
 const before=shelves(game),after=before.filter(b=>b.id!==id);if(before.length===after.length)return {ok:false,error:'Blueprint not found'};
 game.world.steward.blueprints=after;return {ok:true};
}
export function blueprintSnapshot(game){return shelves(game).map(b=>({id:b.id,name:b.name,entries:b.entries.slice(0,12).map(e=>({type:e.type,dx:e.dx,dy:e.dy,targetTier:e.targetTier}))}));}
export function blueprintQuote(game,id,x,y){
 const b=shelves(game).find(b=>b.id===id),out={ok:false,id,x,y,entries:[],cost:{}};
 if(!b||!Array.isArray(b.entries)||!b.entries.length||b.entries.length>12)return {...out,error:'Blueprint not found or invalid'};
 if(!Number.isInteger(x)||!Number.isInteger(y))return {...out,error:'Choose an integer anchor tile'};
 // Shadow buildings preserve the existing overlap, breathing-gap and count rules.
 const projected=plannedConstructionWorld(game);
 for(const e of b.entries){
  const spec=game.data.buildings[e.type],target=e.targetTier??1,px=x+e.dx,py=y+e.dy;
  if(!spec||!Number.isInteger(e.dx)||!Number.isInteger(e.dy)||!Number.isInteger(target)||target<1||target>spec.tiers.length)return {...out,error:'Blueprint entry is invalid'};
  const reason=constructionBuildReason(game,e.type,px,py,projected);if(reason)return {...out,error:`${spec.name}: ${reason}`};
  const entry={type:e.type,x:px,y:py,targetTier:target};out.entries.push(entry);
  // These are an eventual full-plan quote, not an immediate payment.
  for(let tier=1;tier<=target;tier++)sumCost(out.cost,buildingCost(e.type,tier,game.world,game.data));
  projected.buildings.push({id:`preview:${out.entries.length}`,type:e.type,x:px,y:py,level:1,hp:1,remaining:1});
 }
 const planned=game.world.steward?.queue?.length||0;
 if(planned+out.entries.length>CONSTRUCTION_LIMIT)return {...out,error:'Not enough construction queue slots'};
 return {...out,ok:true};
}
export function applyBlueprint(game,id,x,y){
 if(game.state.mission)return {ok:false,error:'Blueprints wait at home'};
 const quote=blueprintQuote(game,id,x,y);if(!quote.ok)return quote;
 const config=game.world.steward,previous=Array.isArray(config.queue)?config.queue.map(e=>({...e})):[],queued=[];
 for(const entry of quote.entries){
  const result=enqueueConstruction(game,{kind:'build',...entry});
  if(!result.ok){config.queue=previous;return {ok:false,error:result.error};}
  queued.push(result.id);
 }
 return {ok:true,queued,cost:{...quote.cost}};
}
