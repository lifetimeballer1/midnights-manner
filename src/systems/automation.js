// Home automation: plans every two seconds; movement uses existing route caches.
import {center,stats,buildingCost} from '../model.js';
import {buildingMaxHp} from './endgame.js';
import {move} from './pathfinding.js';
import {isWall} from './walls.js';
import {isHauling} from './logistics.js';
import {supplyBonus} from './food.js';
import {canSpend,spendingAvailable} from './steward-budget.js';
import {RARITY_ORDER,refinerCrew,craftCost,startCraftOrder,stockCount} from './crafting.js';
const runtime=new WeakMap(),recipes=new WeakMap();
const defaults=()=>({autoUpgrade:false,autoUpgradeTypes:{},reserves:{},stockTarget:1});
export function automationSettings(world){
 if(!world.automation)world.automation=defaults();
 if(!world.automation.autoUpgradeTypes||typeof world.automation.autoUpgradeTypes!=='object'||Array.isArray(world.automation.autoUpgradeTypes))world.automation.autoUpgradeTypes={};
 return world.automation;
}
const settings=w=>w.automation||defaults();
export function autoUpgradeTypeEnabled(world,type,building=null){
 const byType=settings(world).autoUpgradeTypes;
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
    if(!canSpend(game,craftCost(it,crew),{purpose:'craft'})){note='Waiting for materials or reserves';continue;}
    const result=startCraftOrder(w,d,b.id,id);
    if(result.ok){need.set(id,need.get(id)-1);note=`Crafting ${it.name}`;break;}
    note=result.error;
   }
  }
  cache.status.set(b.id,note);
 }
}
const priority=(b,d)=>b.type==='hall'?0:isWall(b)||d.buildings[b.type]?.tiers[b.level-1]?.damage?1:2;
function planBuilders(game,cache){
 const {world:w,data:d}=game,builders=w.troops.filter(u=>eligible(u,d));
 for(const u of w.troops)delete u.builderTask;
 if(activeRaid(w))return;
 const repairs=w.buildings.filter(b=>b.remaining<=0&&b.hp<buildingMaxHp(b,d)).sort((a,b)=>priority(a,d)-priority(b,d)+(priority(a,d)===priority(b,d)?Number(!!w.steward?.enabled&&w.steward.districts?.some(x=>x.priority==='repair'&&x.buildingIds.includes(b.id)))-Number(!!w.steward?.enabled&&w.steward.districts?.some(x=>x.priority==='repair'&&x.buildingIds.includes(a.id))):0));
 const construction=w.buildings.filter(b=>b.hp>0&&b.remaining>0);
 for(const b of repairs)if(spendingAvailable(game,'wood',{purpose:'repair',buildingId:b.id})<=0)cache.status.set(b.id,'Waiting for wood above reserve');
 const target=repairs.find(b=>spendingAvailable(game,'wood',{purpose:'repair',buildingId:b.id})>0)||construction[0];
 if(target){for(const u of builders)u.builderTask={kind:target.remaining>0?'construction':'repair',target:target.id,working:false};return;}
 if(!settings(w).autoUpgrade||!builders.length||repairs.length||construction.length)return;
 for(const b of w.buildings){
  if(!autoUpgradeTypeEnabled(w,b.type,b)||w.steward?.enabled&&w.steward.queue?.some(e=>e.buildingId===b.id))continue;
  const spec=d.buildings[b.type],limit=Math.min(spec.tiers.length,b.autoUpgradeMaxTier||spec.tiers.length);
  let note='Waiting for upgrade';
  if(b.hp<=0||b.remaining>0)note='Building unfinished';
  else if(b.level>=limit)note='At chosen tier';
  else if(game.locked(b.type)||spec.tierGates?.[b.level+1]>(game.state.vlevel||1))note='Village level or unlock required';
  else{
   const cost=b.type==='hall'?{wood:200*b.level,gold:150*b.level}:buildingCost(b.type,b.level+1,w,d);
   if(!canSpend(game,cost,{purpose:'upgrade',buildingId:b.id}))note='Waiting for materials or reserves';
   else{game.upgrade(b.id);if(b.remaining>0){note='Builders upgrading';for(const u of builders)u.builderTask={kind:'construction',target:b.id,working:false};cache.status.set(b.id,note);break;}}
  }
  cache.status.set(b.id,note);
 }
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
