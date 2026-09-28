// One resource identity across the map, HUD, costs and collection feedback.
export const RESOURCES={
 wood:{label:'Wood',sprite:'resource-wood.svg',color:'#e5b575',paper:'#fff0d7',description:'Timber for buildings, repairs and upgrades.'},
 food:{label:'Food',sprite:'resource-food.svg',color:'#a9d889',paper:'#eff8df',description:'Feeds your village and recruits new people.'},
 gold:{label:'Gold',sprite:'resource-gold.svg',color:'#f3cf66',paper:'#fff6cc',description:'Pays for training, equipment and advanced buildings.'},
 frostwood:{label:'Frostwood',sprite:'resource-frostwood.svg',color:'#9bd6e6',paper:'#e4f6fa',description:'Rare timber for frontier crafts and upgrades.'},
 plate:{label:'Plate',sprite:'resource-plate.svg',color:'#b7c7dc',paper:'#edf0fa',description:'Forged metal for advanced armor and equipment.'},
 lumber:{label:'Lumber',sprite:'resource-wood.svg',color:'#d8a05e',paper:'#fff0d7',description:'Sawn planks from the Sawmill — master craftwork and fine blades are hungry for it.'},
 flour:{label:'Flour',sprite:'resource-food.svg',color:'#f0e0b0',paper:'#fbf6e6',description:'Milled grain from the Gristmill — bake it into bread.'},
 bread:{label:'Bread',sprite:'resource-food.svg',color:'#e8b34e',paper:'#fff2cf',description:'Hearty loaves. Each loaf feeds as 3 food when the pantry runs bare.'}
};
export const resourceInfo=key=>RESOURCES[key]||{label:String(key||'Resource'),sprite:'resource-gold.svg',color:'#f3cf66',paper:'#fff6cc',description:'Gathered by your village.'};
export const resourceLabel=(key,amount)=>`+${Math.floor(amount)} ${resourceInfo(key).label}`;
export const resourceSpriteNames=Object.values(RESOURCES).map(r=>r.sprite);
// Keep labels readable at the normal camera scale while letting the map breathe
// when players zoom out. Touch padding is added by the renderer separately.
export const collectionBubbleScale=zoom=>Math.max(.68,Math.min(1,Number(zoom)||1));
// Tap-reserve sizing (Jesce rebalance 2026-09-27): base capacity 500, badge
// around 150 (~30% of cap) so flags mean a real haul. Capacity grows with
// building tier, fully data-driven — tune it in buildings.json, no code:
//   harvest: { capacity: 500, notifyAt: 150, perTier: 500 }
//   - capacity: tier-1 cap (default 500)
//   - perTier (aka capacityPerTier / tierGrowth): added per tier above 1
//     (default: one full base capacity, so 500/1000/1500 — time-to-full
//     stays flat while rateMultiplier climbs 1x/2x/3x)
//   - capacities: optional explicit per-tier array, wins over perTier
//     (level beyond the array reads the last entry)
//   - notifyAt: tier-1 badge threshold (default ~30% of base cap); the
//     effective threshold scales proportionally with the tier cap so the
//     ~30% ratio holds at every tier. Taps always sweep any whole unit.
export const HARVEST_BASE_CAPACITY = 500;
export const HARVEST_NOTIFY_RATIO = 0.3;
export function reserveCapacity(spec, level = 1) {
  const h = spec?.harvest;
  const lvl = Number.isFinite(+level) ? Math.max(1, Math.floor(+level)) : 1;
  if (Array.isArray(h?.capacities) && h.capacities.length) {
    const pick = h.capacities[Math.min(lvl, h.capacities.length) - 1];
    if (Number.isFinite(+pick) && +pick >= 1) return Math.floor(+pick);
  }
  const base = Number.isFinite(+h?.capacity) && +h.capacity >= 1 ? Math.floor(+h.capacity) : HARVEST_BASE_CAPACITY;
  const stepRaw = h?.perTier ?? h?.capacityPerTier ?? h?.tierGrowth ?? h?.capacityGrowth ?? base;
  const step = Number.isFinite(+stepRaw) && +stepRaw >= 0 ? Math.floor(+stepRaw) : base;
  return base + step * (lvl - 1);
}
export function reserveNotifyAt(spec, level = 1) {
  const h = spec?.harvest;
  const baseCap = Array.isArray(h?.capacities) && h.capacities.length && Number.isFinite(+h.capacities[0])
    ? Math.max(1, Math.floor(+h.capacities[0]))
    : (Number.isFinite(+h?.capacity) && +h.capacity >= 1 ? Math.floor(+h.capacity) : HARVEST_BASE_CAPACITY);
  const baseNotify = Number.isFinite(+h?.notifyAt) && +h.notifyAt >= 1
    ? Math.floor(+h.notifyAt)
    : Math.ceil(baseCap * HARVEST_NOTIFY_RATIO);
  const cap = reserveCapacity(spec, level);
  const scaled = Math.floor(baseNotify * cap / Math.max(1, baseCap));
  return Math.max(1, scaled);
}
// Worth collecting by hand: any whole unit on a finished, living producer.
// Taps and Collect buttons use this so small drips are never stranded.
export function reserveCollectible(building,spec){
 return !!building && !!spec?.production && building.hp>0 && !(building.remaining>0) && Math.floor(building.harvestBonus||0)>=1;
}
// One predicate for every "ready" announcement: bubbles and badges only.
// Finished, living production buildings holding at least notifyAt.
export function reserveReady(building,spec){
 const lvl = Number.isFinite(+building?.level) ? +building.level : 1;
 return reserveCollectible(building,spec) && Math.floor(building.harvestBonus||0)>=reserveNotifyAt(spec, lvl);
}
export function collectionTotals(world,data){
 const totals={};
 for(const b of world.buildings){const key=data.buildings[b.type]?.production;if(!key||b.hp<=0||b.remaining>0)continue;const amount=Math.floor(b.harvestBonus||0);if(amount>0)totals[key]=(totals[key]||0)+amount;}
 return totals;
}
// Fixed CSS-pixel touch targets; shifting pills prevents dense villages hiding labels.
export function layoutCollectionBubbles(items,width,height,obstacles=[]){
 const placed=[];
 for(const item of [...items].sort((a,b)=>a.y-b.y||a.x-b.x)){
  if(item.x<-50||item.x>width+50||item.y<-50||item.y>height+50)continue;
  const w=Math.min(item.width,width-16),h=item.height||40;
  const fits=box=>![...placed,...obstacles].some(p=>box.x<p.x+p.w+4&&box.x+box.w+4>p.x&&box.y<p.y+p.h+4&&box.y+box.h+4>p.y);
  let box;
  for(const dy of [0,-44,44,-88,88,-132,132,-176,176])for(const dx of [0,-w-6,w+6]){
   const candidate={...item,x:Math.max(8,Math.min(width-w-8,item.x-w/2+dx)),y:Math.max(8,Math.min(height-h-8,item.y-h/2+dy)),w,h};
   if(!box&&fits(candidate))box=candidate;
  }
  // Keep every visible source represented even in a very dense village.
  placed.push(box||{...item,x:Math.max(8,Math.min(width-w-8,item.x-w/2)),y:Math.max(8,Math.min(height-h-8,item.y-h/2)),w,h});
 }
 return placed;
}
