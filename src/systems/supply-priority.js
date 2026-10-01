import {mealCost} from './food.js';
import {buildingMaxHp} from './endgame.js';
import {budgetSnapshot} from './steward-budget.js';
import {automationMaterialNeeds,automationConstructionNeeds} from './automation.js';
import {centralRoom} from './storage.js';
import {OUTPUT_CAP,outputAmount} from './refiner-output.js';

// Read-only demand signals, recalculated on the existing two-second planner.
// These prioritize real batches; they never own or spend a second inventory.
export function supplyPriorities(w,d){
 const needs=new Map(),add=(key,target,priority,reason)=>{
  if(!(Number.isFinite(target)&&target>0))return;
  const missing=Math.max(0,target-(w.resources[key]||0));if(!missing)return;
  const old=needs.get(key);if(!old)needs.set(key,{resource:key,target,missing,priority,reasons:[reason]});
  else {old.target=Math.max(old.target,target);old.missing=Math.max(old.missing,missing);old.priority=Math.max(old.priority,priority);if(!old.reasons.includes(reason))old.reasons.push(reason);}
 };
 for(const [k,n] of Object.entries(mealCost(w,d)))add(k,n,100,'Town meal');
 let repairs=0;for(const b of w.buildings)if(b.remaining<=0)repairs+=Math.max(0,buildingMaxHp(b,d)-b.hp)/15;
 add('wood',Math.ceil(repairs),90,'Building recovery');
 const budget=budgetSnapshot(w);
 for(const row of budget.rows)for(const [k,n] of Object.entries(row.cost))add(k,n,row.purpose==='meal'?100:row.purpose==='repair'?90:80,row.label);
 for(const [k,n] of Object.entries(budget.resources))add(k,n.planned,80,'Steward planned basket');
 for(const [k,n] of Object.entries(automationConstructionNeeds(w)))add(k,n,80,'Automatic construction');
 for(const [k,n] of Object.entries(automationMaterialNeeds(w)))add(k,n,75,'Equipment crafting');
 if(w.steward?.enabled)for(const [k,n] of Object.entries(w.steward.productionTargets||{}))add(k,Number(n),65,'Production target');
 for(const [k,n] of Object.entries(w.automation?.reserves||{}))add(k,Number(n),50,'Protected reserve');
 // Pull demand backward through staffed production chains, up to four stages.
 // Food -> flour -> bread then outranks an unrelated surplus reserve.
 const posted=new Set(w.troops.filter(u=>u.hp>0&&u.workplace&&!u.order&&!u.expedition&&!u.emergency).map(u=>u.workplace));
 for(let pass=0;pass<4;pass++)for(const b of w.buildings){if(b.hp<=0||b.remaining>0||!posted.has(b.id))continue;
  for(const r of d.buildings[b.type]?.refine||[]){
   const downstream=Object.entries(r.out||{}).map(([k,v])=>({need:needs.get(k),v})).filter(x=>x.need&&x.v>0);
   if(!downstream.length)continue;
   const runs=Math.max(...downstream.map(x=>x.need.missing/x.v)),priority=Math.max(...downstream.map(x=>x.need.priority))-5;
   for(const [key,n] of Object.entries(r.in||{}))add(key,Math.ceil(runs*n),priority,'Workshop supply chain');
  }
 }
 return needs;
}
export function recipeHasRoom(w,d,b,r){return Object.entries(r.out||{}).every(([k,v])=>!(v>0)||(centralRoom(w,d,k)>0&&outputAmount(b,k)<OUTPUT_CAP));}
export function workshopSupplyStatus(w,d,b,crew){
 const recipes=d.buildings[b.type]?.refine||[];
 if(!recipes.length)return null;
 if(b.hp<=0||b.remaining>0)return {state:'unavailable',reason:'Repair or finish this workshop',missing:[]};
 if(!crew)return {state:'workers',reason:'Assign matching workers',missing:[]};
 const open=recipes.filter(r=>recipeHasRoom(w,d,b,r));
 if(!open.length)return {state:'output',reason:'Output buffer or shared storage full',missing:[]};
 const missing=[...new Set(open.flatMap(r=>Object.keys(r.in||{}).filter(k=>!(w.resources[k]>0))))];
 if(open.every(r=>Object.keys(r.in||{}).some(k=>!(w.resources[k]>0))))return {state:'materials',reason:'Waiting for raw materials',missing};
 return {state:'working',reason:'Inputs available; deliveries improve throughput',missing:[]};
}
