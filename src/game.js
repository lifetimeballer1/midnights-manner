import {createWorld,makeBuilding,makeUnit,canPlace,pay,stats,buildingCost} from './model.js';
import {tickEconomy} from './systems/economy.js';
import {tickCombat,spawnRaid,activateAbility} from './systems/combat.js';
import {startMission,tickMission,finishMission} from './systems/campaign.js';
import {load,save} from './storage.js';
export class Game {
 constructor(data){this.data=data;this.state=load(data)||{world:createWorld(data),home:null,mission:null,completed:[],unlocks:['tower']};this.paused=false;this.message='Welcome home. Build a farm, equip your people, and prepare for the night.';this.dirty=true;this.saveTimer=0;}
 get world(){return this.state.world;}
 notify(message){this.message=message;this.dirty=true;}
 locked(id){return this.data.world.locked.includes(id)&&!this.state.unlocks.includes(id);}
 build(type,x,y){
  if(this.paused)return this.notify('Resume the village to build.');
  if(this.locked(type))return this.notify('Complete campaign chapters to unlock this.');
  if(!canPlace(this.world,this.data,type,x,y))return this.notify('Choose an empty tile inside the village boundary.');
  if(!pay(this.world.resources,buildingCost(type,1,this.world,this.data)))return this.notify('Not enough resources. Let your village gather more.');
  const b=makeBuilding(type,x,y,this.data);b.remaining=this.data.buildings[type].buildSeconds;this.world.buildings.push(b);this.notify(`${this.data.buildings[type].name} construction started.`);return b;
 }
 upgrade(id){
  const b=this.world.buildings.find(b=>b.id===id);if(!b||b.hp<=0||b.remaining>0)return;
  if(b.level>=this.data.buildings[b.type].tiers.length)return this.notify('This building is at its highest tier.');
  const cost=b.type==='hall'?{wood:200*b.level,gold:150*b.level}:buildingCost(b.type,b.level+1,this.world,this.data);
  if(!pay(this.world.resources,cost))return this.notify('Not enough resources for this upgrade.');
  b.level++;b.hp=this.data.buildings[b.type].tiers[b.level-1].hp;b.remaining=8*b.level;this.notify('Upgrade started. Your builders are on it.');
 }
 repair(id){const b=this.world.buildings.find(b=>b.id===id);if(!b)return;const max=this.data.buildings[b.type].tiers[b.level-1].hp;if(b.hp>=max)return;
  if(!pay(this.world.resources,{wood:Math.ceil((max-b.hp)/15)}))return this.notify('Gather more wood to repair.');b.hp=max;this.notify('Building repaired.');}
 relocate(id,x,y){const b=this.world.buildings.find(b=>b.id===id);if(!b||this.world.enemies.length)return this.notify('Buildings cannot move during a raid.');if(!canPlace(this.world,this.data,b.type,x,y,b.id))return this.notify('That location is blocked.');b.x=x;b.y=y;this.notify('Building moved.');return true;}
 recruit(type){
  if(!this.world.buildings.some(b=>b.type==='barracks'&&b.hp>0&&b.remaining<=0))return this.notify('Build a barracks first.');
  const mission=this.data.missions.find(m=>m.id===this.state.mission?.id),limit=mission?.troopLimit||16;
  if(this.world.troops.length>=limit)return this.notify(`Your troop limit is ${limit}.`);
  if(!pay(this.world.resources,this.data.troops[type].recruitCost))return this.notify('Not enough food or gold.');
  this.world.troops.push(makeUnit(type,this.data,this.world.troops.length%5));this.notify(`${this.data.troops[type].name} recruited.`);
 }
 level(id){const u=this.world.troops.find(t=>t.id===id);if(!u||u.level>=this.data.troops[u.type].maxLevel)return;const cost=Object.fromEntries(Object.entries(this.data.troops[u.type].levelCost).map(([k,v])=>[k,Math.ceil(v*u.level)]));if(!pay(this.world.resources,cost))return this.notify('Not enough food or gold to train.');u.level++;u.hp=stats(u,this.data).hp;this.notify(`Level ${u.level} reached${u.level%5===0?' — new ability unlocked!':'.'}`);}
 equip(id,itemId){const u=this.world.troops.find(t=>t.id===id),item=this.data.items[itemId];if(!u||!item||!item.roles.includes(u.type)||this.locked(itemId))return;
  if(!u.owned.includes(itemId)){if(!pay(this.world.resources,item.cost))return this.notify('Not enough resources for this equipment.');u.owned.push(itemId);}u.gear=itemId;this.notify(`${item.name} equipped.`);}
 ability(id,ability){const u=this.world.troops.find(t=>t.id===id);if(u)this.notify(activateAbility(this.world,this.data,u,ability)?'Rallying light restores nearby allies.':'Ability is not ready.');}
 raid(){if(this.state.mission)return this.notify('Campaign raids follow the mission timeline.');if(this.world.enemies.length)return this.notify('A raid is already underway.');if(!this.world.buildings.some(b=>b.type==='hall'&&b.hp>0))return this.notify('Repair the manor before another raid.');spawnRaid(this.world,4+this.world.wave);this.notify('Raiders are approaching from the west!');}
 mission(id){if(startMission(this.state,this.data,id))this.notify('Expedition begun. Your home village is safely paused.');else this.notify('Finish the current raid or unlock the previous chapter first.');}
 returnHome(){const result=finishMission(this.state,this.data);this.notify(result?.first?'Victory! Rewards and unlocks delivered to your village.':'Returned home. First-clear rewards can only be claimed once.');this.persist();}
 persist(){const ok=save(this.state);if(!ok)this.notify('Browser storage is unavailable. Progress cannot be saved here.');return ok;}
 tick(dt){if(this.paused||this.state.mission?.status&&this.state.mission.status!=='active')return;
  this.world.elapsed+=dt;tickEconomy(this.world,this.data,dt);tickCombat(this.world,this.data,dt);const before=this.state.mission?.status;tickMission(this.state,this.data);
  if(before!==this.state.mission?.status){this.notify(this.state.mission.status==='won'?'Mission complete! Return home to claim your rewards.':'Expedition lost. Return home and try a different layout.');this.persist();}
  if(!this.state.mission&&!this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)&&this.world.enemies.length){this.world.enemies=[];this.world.resources.wood=Math.max(80,this.world.resources.wood);this.notify('The manor fell. Salvaged wood is available for repairs.');}
  this.saveTimer+=dt;if(this.saveTimer>5){this.saveTimer=0;this.persist();}
 }
}
