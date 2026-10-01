import {buildingCost,buildingLimit,buildingCount,canPlace} from '../model.js';
import {buildingMaxHp,renownLimitBonus} from './endgame.js';
import {conquestLimitBonus} from './conquest.js';
import {canSpend} from './steward-budget.js';
import {isHauling} from './logistics.js';
export const CONSTRUCTION_LIMIT=12;
const queue=g=>Array.isArray(g.world.steward?.queue)?g.world.steward.queue.slice(0,CONSTRUCTION_LIMIT):[];
export function plannedConstructionWorld(game){
 const world={...game.world,buildings:[...game.world.buildings]};
 for(const e of queue(game))if(e.kind==='build'&&!e.buildingId&&game.data.buildings[e.type])world.buildings.push({id:`planned:${e.id}`,type:e.type,x:e.x,y:e.y,level:1,hp:1,remaining:1});
 return world;
}
export function constructionBuildReason(game,type,x,y,world=game.world){
 const d=game.data,spec=d.buildings[type];
 if(!spec||type==='hall')return 'Choose a buildable structure';
 if(game.locked(type))return 'Building unlock required';
 if((spec.minLevel||1)>(game.state.vlevel||1))return `Village level ${spec.minLevel} required`;
 const reqs=[...(Array.isArray(spec.requiresBuildings)?spec.requiresBuildings:[]),...(spec.requiresBuilding?[spec.requiresBuilding]:[])];
 for(const r of reqs)if(!world.buildings.some(b=>b.type===r.type&&b.hp>0&&b.level>=(r.level||1)))return `Requires tier ${r.level||1} ${d.buildings[r.type]?.name||r.type}`;
 if(spec.maxPerVillage&&world.buildings.some(b=>b.type===type&&b.hp>0))return 'Unique building already exists';
 const limit=buildingLimit(type,game.state.vlevel||1,d,renownLimitBonus(world,d)+conquestLimitBonus(world,d));
 if(buildingCount(world,type)>=limit)return 'Building limit reached';
 if(!canPlace(world,d,type,x,y))return 'Placement blocked or land unclaimed';
 return null;
}
function cleanEntry(game,input){
 if(input?.kind==='upgrade'){
  const b=game.world.buildings.find(b=>b.id===input.buildingId),spec=game.data.buildings[b?.type],target=input.targetTier??(b?.level||0)+1;
  if(!b||!spec||!Number.isInteger(target)||target<=b.level||target>spec.tiers.length)return null;
  return {kind:'upgrade',buildingId:b.id,targetTier:target};
 }
 if(input?.kind==='build'){
  const spec=game.data.buildings[input.type],target=input.targetTier??1;
  if(!spec||input.type==='hall'||!Number.isInteger(input.x)||!Number.isInteger(input.y)||!Number.isInteger(target)||target<1||target>spec.tiers.length)return null;
  if(!canPlace(plannedConstructionWorld(game),game.data,input.type,input.x,input.y))return null;
  return {kind:'build',type:input.type,x:input.x,y:input.y,targetTier:target};
 }
 return null;
}
export function enqueueConstruction(game,input){
 if(game.state.mission)return {ok:false,error:'Construction plans wait at home'};
 const list=queue(game),entry=cleanEntry(game,input);
 if(!entry)return {ok:false,error:'Choose a valid building upgrade or placement'};
 if(list.length>=CONSTRUCTION_LIMIT)return {ok:false,error:'Construction queue is full (12)'};
 if(list.some(e=>entry.kind==='upgrade'?e.buildingId===entry.buildingId:e.kind==='build'&&e.x===entry.x&&e.y===entry.y))return {ok:false,error:'That construction is already queued'};
 const id=globalThis.crypto?.randomUUID?.()||`queue-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 if(!game.world.steward)game.world.steward={enabled:false,main:null,secondary:[],protectMeals:true,protectRepairs:true};
 game.world.steward.queue=[...list,{id,...entry}];return {ok:true,id};
}
export function removeConstruction(game,id){
 if(game.state.mission)return {ok:false,error:'Construction plans wait at home'};
 const list=queue(game),i=list.findIndex(e=>e.id===id);if(i<0)return {ok:false,error:'Plan not found'};
 list.splice(i,1);game.world.steward.queue=list;return {ok:true};
}
export function moveConstruction(game,id,direction){
 if(game.state.mission||![-1,1].includes(direction))return {ok:false,error:'Choose an adjacent queue position'};
 const list=queue(game),i=list.findIndex(e=>e.id===id),next=i+direction;if(i<0||next<0||next>=list.length)return {ok:false,error:'Queue boundary'};
 [list[i],list[next]]=[list[next],list[i]];game.world.steward.queue=list;return {ok:true};
}
function quoteEntry(game,entry){
 const {world:w,data:d}=game,b=entry.buildingId?w.buildings.find(b=>b.id===entry.buildingId):null,spec=d.buildings[b?.type||entry.type];
 const out={id:entry.id,kind:entry.kind,buildingId:entry.buildingId,type:entry.type,x:entry.x,y:entry.y,targetTier:entry.targetTier,label:spec?`${spec.name} → tier ${entry.targetTier}`:'Unavailable building',status:'Ready',cost:{}};
 if(!spec){out.status='Building is missing';return out;}
 if(entry.buildingId){
  if(!b){out.status='Building is missing';return out;}
  if(b.hp<=0){out.status='Repair required';return out;}
  if(b.remaining>0){out.status='Construction in progress';return out;}
  if(b.level>=entry.targetTier){out.status='Complete';return out;}
  out.cost=b.type==='hall'?{wood:200*b.level,gold:150*b.level}:buildingCost(b.type,b.level+1,w,d);
  if(game.locked(b.type))out.status='Building unlock required';
  const gate=spec.tierGates?.[b.level+1];if(gate>(game.state.vlevel||1))out.status=`Village level ${gate} required`;
 }else{
  if(entry.kind!=='build'){out.status='Building is missing';return out;}
  out.cost=buildingCost(entry.type,1,w,d);out.status=constructionBuildReason(game,entry.type,entry.x,entry.y)||'Ready';
 }
 if(out.status==='Ready'&&Object.entries(out.cost).some(([k,n])=>(w.resources[k]||0)<n))out.status='Waiting for materials';
 return out;
}
export function constructionSnapshot(game){return queue(game).map(e=>quoteEntry(game,e));}
export function advanceConstruction(game){
 const {world:w,data:d}=game;
 if(game.paused||game.state.mission||!w.steward?.enabled||!w.steward.queueEnabled||w.raidPending||w.enemies.some(e=>e.hp>0))return {ok:false,error:'Queue paused'};
 const entries=queue(game);if(!entries.length)return {ok:false,error:'Queue empty'};
 const entry=entries[0],quote=quoteEntry(game,entry);
 if(quote.status==='Complete'){removeConstruction(game,entry.id);return {ok:true,completed:entry.id};}
 if(w.buildings.some(b=>b.remaining<=0&&b.hp<buildingMaxHp(b,d)))return {ok:false,error:'Repairs take priority'};
 if(w.buildings.some(b=>b.hp>0&&b.remaining>0))return {ok:false,error:'Finish active construction first'};
 if(!w.troops.some(u=>u.hp>0&&d.troops[u.type]?.role==='builder'&&!u.order&&!u.workplace&&!u.expedition&&!u.emergency&&!u.shelteredIn&&!isHauling(u)&&!(u.carry>0)))return {ok:false,error:'Waiting for an available builder'};
 if(quote.status!=='Ready')return {ok:false,error:quote.status};
 const goals=[w.steward.main,...(w.steward.secondary||[])];
 const ownGoal=entry.buildingId&&goals.some(g=>g?.buildingId===entry.buildingId&&g.action!=='repair'&&g.targetTier>(w.buildings.find(b=>b.id===entry.buildingId)?.level||0));
 const spending=ownGoal?{purpose:'upgrade',buildingId:entry.buildingId}:{purpose:'queue',buildingId:`queue:${entry.id}`};
 if(!canSpend(game,quote.cost,spending))return {ok:false,error:'Waiting for materials above protected reserves'};
 if(entry.buildingId){const b=w.buildings.find(b=>b.id===entry.buildingId),before=b.level;game.upgrade(b.id);return b.level>before?{ok:true,buildingId:b.id}:{ok:false,error:'Upgrade could not start'};}
 const built=game.build(entry.type,entry.x,entry.y);
 if(!built?.id)return {ok:false,error:'Construction could not start'};
 // Live shelf, not the detached queue view. Persist the created id on success.
 w.steward.queue.find(e=>e.id===entry.id).buildingId=built.id;
 return {ok:true,buildingId:built.id};
}
