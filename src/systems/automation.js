// Home automation: plans every two seconds; movement uses existing route caches.
import {center,stats,buildingCost} from '../model.js';
import {buildingMaxHp} from './endgame.js';
import {move} from './pathfinding.js';
import {isWall} from './walls.js';
import {isHauling} from './logistics.js';
import {greatWorkTier,busyRoutes,roadQuote,buildRoad} from './roads.js';
import {supplyBonus} from './food.js';
import {canSpend,spendingAvailable} from './steward-budget.js';
import {RARITY_ORDER,refinerCrew,craftCost,startCraftOrder,stockCount} from './crafting.js';
const runtime=new WeakMap(),recipes=new WeakMap();
// Living Kingdom slice 2: settlement policies. Eleven automation categories;
// old saves gain them default-on through automationSettings (additive only).
export const POLICY_CATEGORIES=['walls','gates','towers','farms','mines','lumber','housing','storage','workshops','military','roads'];
export const CATEGORY_OF={wall:'walls',gate:'gates',tower:'towers',archer_tower:'towers',ballista:'towers',farm:'farms',mine:'mines',lumber:'lumber',timber_yard:'lumber',sawmill:'lumber',cottage:'housing',longhouse:'housing',hall:'storage',storehouse:'storage','grand-granary':'storage',forge:'workshops',workshop:'workshops',smeltery:'workshops',barracks:'military'};
export const POLICY_PRIORITIES=['low','normal','high'];
const defaultPolicy=()=>({on:true,maxTier:6,priority:'normal'});
const defaultPolicies=()=>Object.fromEntries(POLICY_CATEGORIES.map(c=>[c,defaultPolicy()]));
export function sanitizePolicies(input){
 const src=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const out={};
 for(const c of POLICY_CATEGORIES){
  const p=src[c];
  if(!p||typeof p!=='object'||Array.isArray(p)){out[c]=defaultPolicy();continue;}
  const on=typeof p.on==='boolean'?p.on:true;
  let t=Math.floor(Number(p.maxTier));
  if(!Number.isFinite(t))t=6;
  t=Math.max(1,Math.min(6,t));
  const priority=POLICY_PRIORITIES.includes(p.priority)?p.priority:'normal';
  out[c]={on,maxTier:t,priority};
 }
 return out;
}
export function sanitizeReservePct(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return {};
 const out={};
 for(const [cat,bucket] of Object.entries(input)){
  if(cat==='__proto__'||cat==='constructor'||cat==='prototype')continue;
  if(!bucket||typeof bucket!=='object'||Array.isArray(bucket))continue;
  const clean={};
  for(const [res,raw] of Object.entries(bucket)){
   if(res==='__proto__'||res==='constructor'||res==='prototype')continue;
   const n=Math.floor(Number(raw));
   if(!Number.isFinite(n))continue;
   clean[res]=Math.max(0,Math.min(100,n));
  }
  if(Object.keys(clean).length)out[cat]=clean;
 }
 return out;
}
const defaults=()=>({autoUpgrade:false,autoUpgradeTypes:{},reserves:{},stockTarget:1,policies:defaultPolicies(),reservePct:{}});
export function automationSettings(world){
 if(!world.automation)world.automation=defaults();
 const a=world.automation;
 if(!a.autoUpgradeTypes||typeof a.autoUpgradeTypes!=='object'||Array.isArray(a.autoUpgradeTypes))a.autoUpgradeTypes={};
 a.policies=sanitizePolicies(a.policies);
 a.reservePct=sanitizeReservePct(a.reservePct);
 return a;
}
const settings=w=>w.automation||defaults();
export function autoUpgradeTypeEnabled(world,type,building=null){
 const s=settings(world),cat=CATEGORY_OF[type];
 if(cat){
  const pol=s.policies?.[cat];
  if(pol===false)return false;
  if(pol&&typeof pol==='object'){
   if(pol.on===false)return false;
   const max=Number(pol.maxTier);
   if(building&&Number.isFinite(max)&&building.level>=max)return false;
  }
 }
 const byType=s.autoUpgradeTypes;
 if(byType&&Object.hasOwn(byType,type))return !!byType[type];
 return !!building?.autoUpgrade;
}
const activeRaid=w=>!!w.raidPending||(w.enemies||[]).some(e=>e.hp>0);
const eligible=(u,d)=>u.hp>0&&d.troops[u.type]?.role==='builder'&&!u.workplace&&!u.order&&!u.expedition&&!u.emergency&&!u.shelteredIn&&!isHauling(u)&&!(u.carry>0);
function recipeList(data){
 let list=recipes.get(data);if(list)return list;
 list=Object.entries(data.items).filter(([,it])=>it.craft&&Array.isArray(it.roles)).sort((a,b)=>RARITY_ORDER.indexOf(b[1].rarity||'common')-RARITY_ORDER.indexOf(a[1].rarity||'common'));
 recipes.set(data,list);return list;
}
// Choose highest unlocked gear per compatible villager and slot. Stock includes
// all live queues, so separate shops cannot duplicate the same requested piece.
function demands(game){
 const {world:w,data:d}=game,need=new Map(),spares=new Set(),list=recipeList(d);
 for(const u of w.troops){
  if(u.hp<=0||u.expedition)continue;
  const chosen=new Set();
  for(const [id,it] of list){
   if(game.locked(id)||!it.roles.includes(u.type)||it.requiresName&&it.requiresName!==u.name||it.requiresOath&&!w.troops.some(t=>t.oath&&t.hp>0))continue;
   const key=`${it.craft.building}:${it.slot||'main'}`;if(chosen.has(key))continue;chosen.add(key);
   spares.add(id);
   const owned=it.slot==='armor'?u.armorOwned:u.owned;
   const current=d.items[it.slot==='armor'?u.armor:u.gear];
   if((owned||[]).includes(id)||current&&RARITY_ORDER.indexOf(current.rarity||'common')>RARITY_ORDER.indexOf(it.rarity||'common'))continue;
   need.set(id,(need.get(id)||0)+1);
  }
 }
 const spare=Math.max(0,Math.min(5,Math.floor(Number(settings(w).stockTarget??1))||0));
 for(const id of spares)need.set(id,(need.get(id)||0)+spare);
 for(const [id,n] of need){
  const queued=w.buildings.reduce((sum,b)=>sum+(b.craft?.item===id?1:0),0);
  need.set(id,Math.max(0,n-stockCount(w,id)-queued));
 }
 return need;
}
function planCraft(game,cache){
 const {world:w,data:d}=game,need=demands(game);
 cache.materialNeeds={};
 for(const b of w.buildings){
  if(!recipeList(d).some(([,it])=>it.craft.building===b.type))continue;
  let note='No equipment needed';
  if(b.autoCraft===false)note='Auto craft off';
  else if(b.hp<=0||b.remaining>0)note='Workshop unfinished';
  else if(b.craft)note='Crafting equipment';
  else if(activeRaid(w))note='Crafting paused during raid';
  else{
   const crew=refinerCrew(w,d,b).filter(u=>!u.emergency&&!u.shelteredIn&&!u.expedition);
   if(!crew.length)note='Waiting for workers';
   else for(const [id,it] of recipeList(d)){
    if(it.craft.building!==b.type||!(need.get(id)>0))continue;
    if(!canSpend(game,craftCost(it,crew),{purpose:'craft'})){note='Waiting for materials or reserves';for(const [k,n] of Object.entries(craftCost(it,crew)))cache.materialNeeds[k]=Math.max(cache.materialNeeds[k]||0,(w.resources[k]||0)+Math.max(0,n-spendingAvailable(game,k,{purpose:'craft'})));continue;}
    const result=startCraftOrder(w,d,b.id,id);
    if(result.ok){need.set(id,need.get(id)-1);note=`Crafting ${it.name}`;break;}
    note=result.error;
   }
  }
  cache.status.set(b.id,note);
 }
}
export function automationMaterialNeeds(world){return {...runtime.get(world)?.materialNeeds};}
export function automationConstructionNeeds(world){return {...runtime.get(world)?.constructionNeeds};}
const priority=(b,d)=>b.type==='hall'?0:isWall(b)||d.buildings[b.type]?.tiers[b.level-1]?.damage?1:2;
const builderCrewCap=(b,d)=>{
 const size=Math.max(1,Number(d.buildings[b.type]?.size)||1);
 if(b.type==='hall'||size>=3)return 3;
 if(size>=2)return 2;
 return 1;
};
const sameTask=(a,b)=>!!a&&!!b&&a.kind===b.kind&&(a.kind==='road'?a.seed===b.seed:a.target===b.target);
const jobPoint=(job,w,d)=>{
 if(job.task.kind==='road'){
  const [x,y]=String(job.task.seed||'').split(',').map(Number);
  return {x:(x+.5)/2,y:(y+.5)/2};
 }
 const b=w.buildings.find(x=>x.id===job.task.target);
 return b?center(b,d):{x:0,y:0};
};
function dispatchBuilders(builders,jobs,w,d){
 const free=new Set(builders),prepared=jobs.map(job=>({...job,point:jobPoint(job,w,d)}));
 let round=0;
 while(free.size&&prepared.some(job=>round<job.slots)){
  for(const job of prepared){
   if(!free.size)break;
   if(round>=job.slots)continue;
   let pick=null,best=Infinity;
   for(const u of free){
    const distance=Math.hypot(u.x-job.point.x,u.y-job.point.y);
    const score=distance+(sameTask(u.builderTask,job.task)?-1000:0);
    if(score<best){best=score;pick=u;}
   }
   if(!pick)continue;
   const prev=pick.builderTask;
   pick.builderTask={...job.task,working:sameTask(prev,job.task)?!!prev.working:false};
   free.delete(pick);
  }
  round++;
 }
 for(const u of free)delete u.builderTask;
 return [...free];
}
function planBuilders(game,cache){
 const {world:w,data:d}=game,builders=w.troops.filter(u=>eligible(u,d));
 cache.constructionNeeds={};
 if(activeRaid(w)){for(const u of builders)delete u.builderTask;return;}
 const repairs=w.buildings.filter(b=>b.remaining<=0&&b.hp<buildingMaxHp(b,d)).sort((a,b)=>priority(a,d)-priority(b,d)+(priority(a,d)===priority(b,d)?Number(!!w.steward?.enabled&&w.steward.districts?.some(x=>x.priority==='repair'&&x.buildingIds.includes(b.id)))-Number(!!w.steward?.enabled&&w.steward.districts?.some(x=>x.priority==='repair'&&x.buildingIds.includes(a.id))):0));
 const construction=w.buildings.filter(b=>b.hp>0&&b.remaining>0);
 const fundedRepairs=[];
 for(const b of repairs){
  if(spendingAvailable(game,'wood',{purpose:'repair',buildingId:b.id})<=0)cache.status.set(b.id,'Waiting for wood above reserve');
  else fundedRepairs.push(b);
 }
 if(repairs.length||construction.length){
  const jobs=[
   ...fundedRepairs.map(b=>({task:{kind:'repair',target:b.id},slots:builderCrewCap(b,d)})),
   ...construction.map(b=>({task:{kind:'construction',target:b.id},slots:builderCrewCap(b,d)})),
  ];
  dispatchBuilders(builders,jobs,w,d);
  return;
 }

 // Only one automatic upgrade starts per planning pass, preserving the
 // existing resource pacing. The dispatcher gives it a small crew and lets
 // spare builders take road work instead of forming one long train.
 let upgradeJob=null;
 if(settings(w).autoUpgrade&&builders.length){
  for(const b of w.buildings){
   if(!autoUpgradeTypeEnabled(w,b.type,b)||w.steward?.enabled&&w.steward.queue?.some(e=>e.buildingId===b.id))continue;
   const spec=d.buildings[b.type],limit=Math.min(spec.tiers.length,b.autoUpgradeMaxTier||spec.tiers.length);
   let note='Waiting for upgrade';
   if(b.hp<=0||b.remaining>0)note='Building unfinished';
   else if(b.level>=limit)note='At chosen tier';
   else if(game.locked(b.type)||spec.tierGates?.[b.level+1]>(game.state.vlevel||1))note='Village level or unlock required';
   else{
    const cost=b.type==='hall'?{wood:200*b.level,gold:150*b.level}:buildingCost(b.type,b.level+1,w,d);
    if(!canSpend(game,cost,{purpose:'upgrade',buildingId:b.id})){
     note='Waiting for materials or reserves';
     for(const [k,n] of Object.entries(cost))cache.constructionNeeds[k]=Math.max(cache.constructionNeeds[k]||0,(w.resources[k]||0)+Math.max(0,n-spendingAvailable(game,k,{purpose:'upgrade',buildingId:b.id})));
    }else{
     game.upgrade(b.id);
     if(b.remaining>0){note='Builders upgrading';upgradeJob={task:{kind:'construction',target:b.id},slots:builderCrewCap(b,d)};cache.status.set(b.id,note);break;}
    }
   }
   cache.status.set(b.id,note);
  }
 }

 // Permanent-road work is deliberately one builder per route. Distinct busy
 // routes make the workforce spread through town instead of marching in a
 // single file to the same half-tile.
 const roadJobs=[];
 const roadsPol=settings(w).policies?.roads;
 if(!(roadsPol===false||roadsPol?.on===false)){
  const net=greatWorkTier(w,'stone-road');
  if(net)for(const row of busyRoutes(w,Math.min(12,Math.max(4,builders.length)),d)){
   const tier=row.road?2:1;if(tier===2&&net<3)continue;
   const q=roadQuote(w,d,row.key,tier);if(q.error)continue;
   if(!canSpend(game,q.cost,{purpose:'road'}))continue;
   roadJobs.push({task:{kind:'road',seed:row.key,tier,cells:q.cells},slots:1});
  }
 }
 dispatchBuilders(builders,[...(upgradeJob?[upgradeJob]:[]),...roadJobs],w,d);
}
export function tickAutomation(game,dt){
 if(!Number.isFinite(dt)||dt<=0||game.state.mission)return;
 const {world:w,data:d}=game;let cache=runtime.get(w);
 if(!cache){cache={timer:2,status:new Map(),byId:new Map()};runtime.set(w,cache);}
 cache.timer+=dt;
 if(cache.timer>=2){cache.timer=0;cache.status.clear();cache.byId=new Map(w.buildings.map(b=>[b.id,b]));planCraft(game,cache);planBuilders(game,cache);}
 const byId=cache.byId,raiding=activeRaid(w);
   for(const u of w.troops){
    if(!u.builderTask)continue;
    if(u.builderTask.kind==='road'){
     const roadsPol=settings(w).policies?.roads;
     if(roadsPol===false||roadsPol?.on===false){delete u.builderTask;continue;}
     if(raiding||!eligible(u,d)){delete u.builderTask;continue;}
    const [sx,sy]=String(u.builderTask.seed||'').split(',').map(Number);
    if(!Number.isFinite(sx)||!Number.isFinite(sy)){delete u.builderTask;continue;}
    const arrived=move(w,d,u,{x:(sx+.5)/2,y:(sy+.5)/2},stats(u,d).speed,dt,.7,false,true);
    u.builderTask.working=arrived;
    if(!arrived)continue;
    const arrivalQuote=roadQuote(w,d,u.builderTask.seed,u.builderTask.tier);
    if(arrivalQuote.error||!canSpend(game,arrivalQuote.cost,{purpose:'road'})){delete u.builderTask;continue;}
    const done=buildRoad(w,d,u.builderTask.seed,u.builderTask.tier);
    let next=null;
    const chainPol=settings(w).policies?.roads;
    if(done.ok&&!(chainPol===false||chainPol?.on===false))for(const row of busyRoutes(w,4,d)){
     const [ax,ay]=row.key.split(',').map(Number);
     if(Math.hypot(ax-sx,ay-sy)>12)continue;
     const tier=row.road?2:1,net=greatWorkTier(w,'stone-road');
     if(tier===2&&net<3)continue;
     const q=roadQuote(w,d,row.key,tier);
     if(q.error||!canSpend(game,q.cost,{purpose:'road'}))continue;
     next={kind:'road',seed:row.key,tier,cells:q.cells,working:false};break;
    }
    if(next)u.builderTask=next;else delete u.builderTask;
    continue;
   }
   const b=byId.get(u.builderTask.target);
  if(raiding||!eligible(u,d)||!b||u.builderTask.kind==='repair'&&b.hp>=buildingMaxHp(b,d)||u.builderTask.kind==='construction'&&!(b.remaining>0)){delete u.builderTask;continue;}
  const arrived=move(w,d,u,center(b,d),stats(u,d).speed,dt,d.buildings[b.type].size/2+.7,false,true);
  u.builderTask.working=arrived;
  if(!arrived||u.builderTask.kind!=='repair')continue;
  const hp=Math.min(6*(1+supplyBonus(w,d,'repair'))*dt,buildingMaxHp(b,d)-b.hp,spendingAvailable(game,'wood',{purpose:'repair',buildingId:b.id})*15);
  if(hp>0){b.hp+=hp;w.resources.wood-=hp/15;cache.status.set(b.id,'Builders repairing');}
 }
}
export function automationStatus(game,b){
 if(game.state.mission)return 'Manual control on expeditions';
 if(b.craft)return `Crafting ${game.data.items[b.craft.item]?.name||'equipment'}`;
 if(b.autoCraft===false&&recipeList(game.data).some(([,it])=>it.craft.building===b.type))return 'Auto craft off';
 const task=game.world.troops.find(u=>u.builderTask?.target===b.id);
 if(task)return task.builderTask.working?'Builders '+(task.builderTask.kind==='repair'?'repairing':'constructing'):'Builders travelling';
 if(autoUpgradeTypeEnabled(game.world,b.type,b)&&!settings(game.world).autoUpgrade)return 'Auto upgrades paused';
 return runtime.get(game.world)?.status.get(b.id)||'';
}
