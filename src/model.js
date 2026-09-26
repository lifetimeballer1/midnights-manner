export const copy = value => structuredClone(value);
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export function unlockedAbilities(unit, data) {
  return Object.entries(data.troops[unit.type].abilities).filter(([level]) => unit.level >= +level).map(([,id]) => ({id,...data.abilities[id]}));
}
export function stats(unit,data) {
  const spec=data.troops[unit.type], gear=data.items[unit.gear].stats;
  const result=Object.fromEntries(Object.entries(spec.base).map(([key,value])=>[key,value*(1+(spec.growth[key]||0)*(unit.level-1))]));
  result.damage*=gear.damage||1; result.range=gear.range||result.range;
  for (const a of unlockedAbilities(unit,data)) if(a.effect==='damage') result.damage*=1+a.value;
  return result;
}
export function makeUnit(type,data,index=0) {
  const s=data.troops[type];
  return {id:crypto.randomUUID(),type,level:1,hp:s.base.hp,gear:s.defaultGear,owned:[s.defaultGear],x:8+index*.65,y:10.8,attackTimer:0,abilityTimer:0,carry:0,phase:'gather',animation:0};
}
export function makeBuilding(type,x,y,data,level=1) {
  return {id:crypto.randomUUID(),type,x,y,level,hp:data.buildings[type].tiers[level-1].hp,remaining:0,cooldown:0};
}
export function createWorld(data,layout=data.world) {
  return {resources:copy(layout.startingResources),buildings:(layout.buildings||layout.map.buildings).map(b=>makeBuilding(b.type,b.x,b.y,data,b.level||1)),troops:(layout.troops||layout.map.troops).map((t,i)=>makeUnit(t,data,i)),enemies:[],effects:[],elapsed:0,gathered:{wood:0,food:0,gold:0},wave:0,raidTimer:0};
}
export function afford(resources,cost) { return Object.entries(cost).every(([k,v])=>resources[k]>=v); }
export function pay(resources,cost) {if(!afford(resources,cost)) return false; for(const [k,v] of Object.entries(cost)) resources[k]-=v; return true;}
export function builderBonuses(world,data) {
  const crew=world.troops.filter(t=>data.troops[t.type].role==='builder'&&t.hp>0);
  return {speed:1+crew.reduce((n,t)=>n+(data.items[t.gear].stats.buildSpeed||1)-1,0),discount:Math.min(.5,Math.max(0,...crew.map(t=>data.items[t.gear].stats.costReduction||0)))};
}
export function buildingCost(type,level,world,data) {
  const discount=builderBonuses(world,data).discount;
  return Object.fromEntries(Object.entries(data.buildings[type].cost).map(([k,v])=>[k,Math.ceil(v*level*(1-discount))]));
}
export function canPlace(world,data,type,x,y,ignoreId) {
  const size=data.buildings[type].size;
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<1||y<1||x+size>data.world.width-1||y+size>data.world.height-1) return false;
  return !world.buildings.some(b=>b.id!==ignoreId&& x<b.x+data.buildings[b.type].size&&x+size>b.x&&y<b.y+data.buildings[b.type].size&&y+size>b.y);
}
export function center(building,data) {const size=data.buildings[building.type].size;return {x:building.x+size/2,y:building.y+size/2};}
