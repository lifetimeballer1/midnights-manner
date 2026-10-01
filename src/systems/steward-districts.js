import {buildingMaxHp} from './endgame.js';

export const DISTRICT_LIMITS=Object.freeze({districts:6,buildings:24});
const kinds=['food','industry','housing','defense','general'];
const priorities=['balanced','supply','repair'];
const summaries=new WeakMap();
const config=w=>Array.isArray(w.steward?.districts)?w.steward.districts.slice(0,6):[];
const detached=d=>({...d,buildingIds:[...d.buildingIds]});
function validate(game,input,id){
 if(game.state.mission)return {error:'Districts belong to the home village.'};
 const name=typeof input.name==='string'?input.name.trim().slice(0,32):'';
 if(!name||!kinds.includes(input.kind)||!priorities.includes(input.priority??'balanced'))return {error:'Choose a name, district type and valid priority.'};
 if(!Array.isArray(input.buildingIds)||input.buildingIds.length>24)return {error:'Choose at most 24 buildings.'};
 const ids=[...new Set(input.buildingIds)],existing=new Set(game.world.buildings.map(b=>b.id));
 const occupied=new Set(config(game.world).filter(d=>d.id!==id).flatMap(d=>d.buildingIds));
 if(ids.some(key=>!existing.has(key)||occupied.has(key)))return {error:'Each existing building can belong to only one district.'};
 return {district:{id,name,kind:input.kind,priority:input.priority??'balanced',buildingIds:ids}};
}
export function createDistrict(game,input){
 if(config(game.world).length>=6)return {ok:false,error:'Six districts is the village limit.'};
 const result=validate(game,input,crypto.randomUUID());if(result.error)return {ok:false,error:result.error};
 game.world.steward??={enabled:false,main:null,secondary:[],protectMeals:true,protectRepairs:true};
 game.world.steward.districts=[...config(game.world),result.district];
 return {ok:true,district:detached(result.district)};
}
export function updateDistrict(game,id,patch){
 const prior=config(game.world).find(d=>d.id===id);if(!prior)return {ok:false,error:'District not found.'};
 const result=validate(game,{...prior,...patch},id);if(result.error)return {ok:false,error:result.error};
 game.world.steward.districts=config(game.world).map(d=>d.id===id?result.district:d);return {ok:true,district:detached(result.district)};
}
export function removeDistrict(game,id){
 if(game.state.mission)return {ok:false,error:'Districts belong to the home village.'};
 if(!config(game.world).some(d=>d.id===id))return {ok:false,error:'District not found.'};
 game.world.steward.districts=config(game.world).filter(d=>d.id!==id);return {ok:true};
}
function category(b,d){
 const type=b.type;
 if(/farm|mill|bakery|granary|pasture/.test(type))return 'food';
 if(/mine|forge|smelt|armory|sawmill/.test(type))return 'industry';
 if(/barrack|fletcher|shield|tower|gate|wall|rampart/.test(type))return 'defense';
 if(d.buildings[type]?.housing||/cottage|longhouse|chapel|gardens|hall/.test(type))return 'housing';
 return 'general';
}
// Same building categories as settlement topology; roads/routes never enter
// this lightweight suggestion pass. Membership is always an explicit choice.
export function districtChoices(game){
 const groups=new Map(kinds.map(kind=>[kind,[]]));
 const occupied=new Set(config(game.world).flatMap(d=>d.buildingIds));
 for(const b of game.world.buildings){if(!b||b.hp<=0||b.remaining>0||occupied.has(b.id))continue;const list=groups.get(category(b,game.data));if(list.length<24)list.push(b.id);}
 return [...groups].filter(([,ids])=>ids.length).map(([kind,buildingIds])=>({kind,label:kind[0].toUpperCase()+kind.slice(1),buildingIds}));
}
export function refreshDistricts(game){
 if(game.state.mission)return [];
 const byId=new Map(game.world.buildings.map(b=>[b.id,b])),crew=new Map();
 for(const u of game.world.troops){if(!(u.hp>0)||!u.workplace)continue;let types=crew.get(u.workplace);if(!types)crew.set(u.workplace,types=[]);types.push(u.type);}
 const goals=[game.world.steward?.main,...(game.world.steward?.secondary||[]).slice(0,2)].filter(Boolean);
 const result=config(game.world).map(d=>{
  const summary={...detached(d),buildings:0,staffed:0,unstaffed:0,workers:0,damaged:0,ruined:0,inputs:[],outputs:[],goals:[]};
  const inputs=new Set(),outputs=new Set();
  for(const id of d.buildingIds.slice(0,24)){
   const b=byId.get(id),spec=game.data.buildings[b?.type];if(!spec)continue;summary.buildings++;
   if(b.hp<=0){summary.ruined++;summary.damaged++;continue;}
   if(b.hp<buildingMaxHp(b,game.data))summary.damaged++;
   if(b.remaining>0)continue;
   const workers=(crew.get(id)||[]).filter(type=>game.data.troops[type]?.job?.workplace===b.type||(spec.hosts||[]).includes(type)).length;
   summary.workers+=workers;if(spec.workplace){if(workers)summary.staffed++;else summary.unstaffed++;}
   if(spec.production)outputs.add(spec.production);
   for(const recipe of spec.refine||[]){for(const key of Object.keys(recipe.in||{}))inputs.add(key);for(const key of Object.keys(recipe.out||{}))outputs.add(key);}
  }
  summary.inputs=[...inputs];summary.outputs=[...outputs];summary.goals=goals.filter(g=>d.buildingIds.includes(g.buildingId)).map(g=>({...g}));return summary;
 });
 summaries.set(game.world,result);return districtSnapshot(game);
}
export function districtSnapshot(game){
 return (game.state.mission?[]:summaries.get(game.world)||[]).map(d=>({...detached(d),inputs:[...d.inputs],outputs:[...d.outputs],goals:d.goals.map(g=>({...g}))}));
}
