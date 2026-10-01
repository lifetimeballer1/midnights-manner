import {RARITY_ORDER} from './crafting.js';
const runtime=new WeakMap(),catalogs=new WeakMap();
export const EQUIPMENT_LIMIT=8;
const rank=item=>Math.max(0,RARITY_ORDER.indexOf(item?.rarity||'common'));
const score=item=>Object.values(item?.stats||{}).reduce((n,v)=>n+(Number.isFinite(v)?v:0),0);
const better=(a,b)=>rank(a)>rank(b)||rank(a)===rank(b)&&score(a)>score(b);
function catalog(data){let list=catalogs.get(data);if(!list){list=Object.entries(data.items).filter(([,item])=>Array.isArray(item.roles)).sort((a,b)=>rank(b[1])-rank(a[1])||score(b[1])-score(a[1]));catalogs.set(data,list);}return list;}
export function fitEquipment(game){
 const {world:w,data:d}=game;if(!w.steward?.enabled||!w.steward.autoEquip||game.state.mission)return;
 let c=runtime.get(w);if(!c){c={cursor:0,checked:0,fitted:0,lastFitted:[]};runtime.set(w,c);}c.lastFitted=[];
 const count=Math.min(EQUIPMENT_LIMIT,w.troops.length),oath=w.troops.some(u=>u.oath&&u.hp>0),items=catalog(d);
 for(let n=0;n<count;n++){
  const u=w.troops[c.cursor%w.troops.length];c.cursor=(c.cursor+1)%w.troops.length;c.checked++;
  if(u.hp<=0||u.order||u.expedition||u.emergency||u.shelteredIn)continue;
  for(const slot of ['gear','armor']){
   if(u[slot==='armor'?'manualArmor':'manualGear'])continue;
   const owned=u[slot==='armor'?'armorOwned':'owned']||[],current=d.items[u[slot]];
   const candidate=items.find(([id,item])=>(item.slot==='armor')===(slot==='armor')&&item.roles.includes(u.type)&&id!==u[slot]&&better(item,current)&&!game.locked(id)&&(!item.requiresName||item.requiresName===u.name)&&(!item.requiresOath||oath)&&(owned.includes(id)||(w.stock?.[id]||0)>0));
   if(!candidate)continue;
   game.equip(u.id,candidate[0],{automatic:true});
   if(u[slot]===candidate[0]){c.fitted++;c.lastFitted.push({unitId:u.id,itemId:candidate[0],slot});}
  }
 }
}
export function equipmentSnapshot(game){const c=runtime.get(game.world);return {enabled:!!game.world.steward?.enabled&&!!game.world.steward.autoEquip,checked:c?.checked||0,fitted:c?.fitted||0,cursor:c?.cursor||0,lastFitted:(c?.lastFitted||[]).map(x=>({...x})),limit:EQUIPMENT_LIMIT};}
