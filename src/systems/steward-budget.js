// Planning scans happen only on the shared steward interval. Spending reads the
// cached plan and current stores, so two workshops cannot spend the same funds.
import {mealCost} from './food.js';
import {buildingMaxHp} from './endgame.js';
const plans=new WeakMap();
const amount=n=>Number.isFinite(Number(n))?Math.max(0,Number(n)):0;
const manual=(w,k)=>amount(w.automation?.reserves?.[k]);
const costCopy=cost=>Object.fromEntries(Object.entries(cost||{}).map(([k,n])=>[k,amount(n)]).filter(([,n])=>n>0));
export function invalidateStewardBudget(world){plans.delete(world);}
export function refreshStewardBudget(game,goals=[],queue=[]){
 const {world:w,data:d}=game;
 if(!w.steward?.enabled){plans.delete(w);return;}
 const rows=[];
 if(w.steward.protectMeals!==false)rows.push({id:'meals',label:'Next town meal',purpose:'meal',cost:costCopy(mealCost(w,d))});
 if(w.steward.protectRepairs!==false){
  let wood=0;
  for(const b of w.buildings)if(b.remaining<=0)wood+=Math.max(0,buildingMaxHp(b,d)-b.hp)/15;
  rows.push({id:'repairs',label:'Building repairs',purpose:'repair',cost:wood>0?{wood:Math.ceil(wood)}:{}});
 }
 for(const g of goals.slice(0,3)){
  if(g.status==='Complete')continue;
  // A repair goal is already protected by the settlement repair basket.
  if(g.action==='repair'&&w.steward.protectRepairs!==false)continue;
  rows.push({id:`goal:${g.slot}`,label:g.label,purpose:g.action==='repair'?'repair':'upgrade',buildingId:g.buildingId,slot:g.slot,cost:costCopy(g.cost)});
 }
 for(const entry of queue.slice(0,12)){
  if(entry.status==='Complete'||!Object.keys(entry.cost||{}).length)continue;
  if(entry.buildingId&&goals.some(g=>g.status!=='Complete'&&g.action!=='repair'&&g.buildingId===entry.buildingId&&Object.keys(g.cost||{}).length))continue;
  rows.push({id:`queue:${entry.id}`,label:entry.label,purpose:'queue',buildingId:`queue:${entry.id}`,cost:costCopy(entry.cost)});
 }
 plans.set(w,rows);
}
function allocations(w){
 const remaining={...w.resources};
 return (plans.get(w)||[]).map(row=>{
  const protectedFunds={},missing={};
  for(const [k,n] of Object.entries(row.cost)){
   const held=Math.min(n,amount(remaining[k]));protectedFunds[k]=held;remaining[k]=amount(remaining[k])-held;
   if(n>held)missing[k]=n-held;
  }
  return {...row,cost:{...row.cost},protected:protectedFunds,missing};
 });
}
export function budgetSnapshot(game){
 const w=game.world||game,enabled=!!w.steward?.enabled,rows=enabled?allocations(w):[],resources={};
 for(const k of Object.keys(w.resources||{})){
  const planned=rows.reduce((n,r)=>n+(r.cost[k]||0),0),held=rows.reduce((n,r)=>n+(r.protected[k]||0),0),floor=manual(w,k);
  if(planned||floor)resources[k]={owned:amount(w.resources[k]),planned,protected:Math.max(held,Math.min(floor,amount(w.resources[k]))),manual:floor,available:Math.max(0,amount(w.resources[k])-Math.max(held,floor)),missing:Math.max(0,planned-amount(w.resources[k]))};
 }
 return {enabled,rows,resources};
}
export function spendingAvailable(gameOrWorld,resource,{purpose='craft',buildingId}={}){
 const w=gameOrWorld.world||gameOrWorld,owned=amount(w.resources?.[resource]),floor=manual(w,resource);
 if(!w.steward?.enabled)return Math.max(0,owned-floor);
 const rows=plans.get(w)||[];
 // An operation can use its own basket and lower-priority funds. Unrelated
 // automation must preserve every basket; manual purchases remain unchanged.
 const index=rows.findIndex(r=>r.purpose===purpose&&(purpose==='repair'?(!r.buildingId||r.buildingId===buildingId):r.buildingId===buildingId));
 let held=0;
 const end=index<0?rows.length:index;
 for(let i=0;i<end;i++)held+=Math.min(amount(rows[i].cost[resource]),Math.max(0,owned-held));
 return Math.max(0,owned-Math.max(floor,held));
}
export function canSpend(game,cost,options){return Object.entries(cost).every(([k,n])=>spendingAvailable(game,k,options)>=amount(n));}
