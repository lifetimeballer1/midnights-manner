import {mealCost} from './food.js';
import {outputTotals} from './refiner-output.js';
import {spendingAvailable} from './steward-budget.js';
const runtime=new WeakMap(),catalogs=new WeakMap();
const positive=n=>Number.isFinite(+n)?Math.max(0,+n):0;
function catalog(data){let out=catalogs.get(data);if(out)return out;out=new Map();for(const [type,spec] of Object.entries(data.buildings))for(const recipe of spec.refine||[])for(const [resource,amount] of Object.entries(recipe.out||{}))if(amount>0&&!out.has(resource))out.set(resource,{type,recipe,amount});catalogs.set(data,out);return out;}
export function refreshProduction(game,goals=[]){
 const {world:w,data:d}=game;if(!w.steward?.enabled){runtime.delete(w);return;}
 const targets={},sources={};
 const demand=(k,n,label)=>{if(!(n>0)||!Object.hasOwn(w.resources,k))return;targets[k]=(targets[k]||0)+n;(sources[k]??=[]).push(label);};
 if(w.steward.protectMeals!==false)for(const [k,n] of Object.entries(mealCost(w,d)))demand(k,n,'Next town meal');
 for(const goal of goals.slice(0,15))if(goal.status!=='Complete')for(const [k,n] of Object.entries(goal.cost||{}))demand(k,n,goal.label);
 for(const [k,n] of Object.entries(w.steward.productionTargets||{}))if(Object.hasOwn(w.resources,k)){targets[k]=Math.max(targets[k]||0,positive(n));(sources[k]??=[]).push('Stock target');}
 const held=outputTotals(w),recipes=catalog(d),upstream={};
 // Three recipe levels are sufficient for existing chains; cycles and fanout
 // are bounded by the resource dictionary. Every stage protects its own stock.
 let frontier=Object.keys(targets);
 for(let depth=0;depth<3&&frontier.length;depth++){
  const next=[];
  for(const k of frontier){const spec=recipes.get(k),short=Math.max(0,targets[k]-positive(w.resources[k])-positive(held[k]));if(!spec||!short)continue;
   upstream[k]=Object.entries(spec.recipe.in||{}).map(([resource,n])=>({resource,amount:short*n/spec.amount}));
   for(const input of upstream[k])if(Object.hasOwn(w.resources,input.resource)){
    const prior=targets[input.resource]||0;targets[input.resource]=prior+input.amount;(sources[input.resource]??=[]).push(`Make ${k}`);if(!frontier.includes(input.resource))next.push(input.resource);
   }
  }
  frontier=[...new Set(next)];
 }
 // Supply districts receive first access to scarce shared inputs. Preserve
 // placement order within each group; refresh once, never sort every tick.
 const supplyIds=new Set((w.steward.districts||[]).slice(0,6).filter(d=>d.priority==='supply').flatMap(d=>(d.buildingIds||[]).slice(0,24)));
 const supply=[],other=[];for(const b of w.buildings)(supplyIds.has(b.id)?supply:other).push(b);
 const buildings=[...supply,...other];
 const previous=runtime.get(w);runtime.set(w,{targets,sources,upstream,buildings,plans:(previous?.plans||0)+1});
}
export function productionSnapshot(game){
 const w=game.world,c=runtime.get(w);
 if(!w.steward?.enabled||!c)return {enabled:false,targets:{},rows:[],metrics:{plans:c?.plans||0}};
 const held=outputTotals(w);
 const rows=Object.entries(c.targets).map(([resource,target])=>{const stored=positive(w.resources[resource]),buffer=positive(held[resource]),missing=Math.max(0,target-stored-buffer);return {resource,target,stored,held:buffer,missing,upstream:(c.upstream[resource]||[]).map(x=>({...x})),sources:[...(c.sources[resource]||[])],status:missing>0?'Below target':'Target stocked'};});
 return {enabled:true,targets:{...c.targets},rows,metrics:{plans:c.plans}};
}
export function refinePolicy(game){
 const w=game.world,c=runtime.get(w);if(!w.steward?.enabled||!c)return null;
 return {
  buildings:c.buildings.length===w.buildings.length?c.buildings:w.buildings,
  available:resource=>spendingAvailable(game,resource,{purpose:'production'}),
  limitRuns(building,recipe,runs,held={}){
   let cap=runs;
   for(const [k,n] of Object.entries(recipe.out||{}))if(n>0&&Object.hasOwn(c.targets,k))cap=Math.min(cap,Math.max(0,c.targets[k]-positive(w.resources[k])-positive(held[k]))/n);
   return cap;
  },
 };
}
