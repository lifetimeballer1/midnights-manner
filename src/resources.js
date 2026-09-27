// One resource identity across the map, HUD, costs and collection feedback.
export const RESOURCES={
 wood:{label:'Wood',sprite:'resource-wood.svg',color:'#e5b575',paper:'#fff0d7',description:'Timber for buildings, repairs and upgrades.'},
 food:{label:'Food',sprite:'resource-food.svg',color:'#a9d889',paper:'#eff8df',description:'Feeds your village and recruits new people.'},
 gold:{label:'Gold',sprite:'resource-gold.svg',color:'#f3cf66',paper:'#fff6cc',description:'Pays for training, equipment and advanced buildings.'},
 frostwood:{label:'Frostwood',sprite:'resource-frostwood.svg',color:'#9bd6e6',paper:'#e4f6fa',description:'Rare timber for frontier crafts and upgrades.'},
 plate:{label:'Plate',sprite:'resource-plate.svg',color:'#b7c7dc',paper:'#edf0fa',description:'Forged metal for advanced armor and equipment.'}
};
export const resourceInfo=key=>RESOURCES[key]||{label:String(key||'Resource'),sprite:'resource-gold.svg',color:'#f3cf66',paper:'#fff6cc',description:'Gathered by your village.'};
export const resourceLabel=(key,amount)=>`+${Math.floor(amount)} ${resourceInfo(key).label}`;
export const resourceSpriteNames=Object.values(RESOURCES).map(r=>r.sprite);
// Keep labels readable at the normal camera scale while letting the map breathe
// when players zoom out. Touch padding is added by the renderer separately.
export const collectionBubbleScale=zoom=>Math.max(.68,Math.min(1,Number(zoom)||1));
// Badge/bubble threshold: per-building `harvest.notifyAt`, falling back to a
// quarter of the reserve cap so future buildings stay quiet on drips too.
// Tune it in buildings.json — no code change needed.
export function reserveNotifyAt(spec){
 const cap=spec?.harvest?.capacity??40;
 const at=spec?.harvest?.notifyAt??Math.ceil(cap*0.25);
 return Math.max(1,Math.floor(at));
}
// Worth collecting by hand: any whole unit on a finished, living producer.
// Taps and Collect buttons use this so small drips are never stranded.
export function reserveCollectible(building,spec){
 return !!building && !!spec?.production && building.hp>0 && !(building.remaining>0) && Math.floor(building.harvestBonus||0)>=1;
}
// One predicate for every "ready" announcement: bubbles and badges only.
// Finished, living production buildings holding at least notifyAt.
export function reserveReady(building,spec){
 return reserveCollectible(building,spec) && Math.floor(building.harvestBonus||0)>=reserveNotifyAt(spec);
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
