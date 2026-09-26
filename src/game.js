import {nextStep,blocked} from './systems/pathfinding.js';
import {createWorld,makeBuilding,makeUnit,canPlace,inBounds,pay,stats,buildingCost,center,assignmentValid} from './model.js';
import {tickVillage} from './systems/village.js';
import {tickEconomy} from './systems/economy.js';
import {tickCombat,spawnRaid,activateAbility} from './systems/combat.js';
import {startMission,tickMission,finishMission} from './systems/campaign.js';
import {load,save} from './storage.js';
import {sfx} from './systems/audio.js';
export class Game {
 constructor(data){this.data=data;this.state=load(data)||{world:createWorld(data),home:null,mission:null,completed:[],unlocks:['tower'],xp:0,vlevel:1,questsCompleted:[]};this.paused=false;this.message='Welcome home. Build a farm, equip your people, and prepare for the night.';this.dirty=true;this.saveTimer=0;}
 get world(){return this.state.world;}
 notify(message){this.message=message;this.dirty=true;}
 locked(id){return this.data.world.locked.includes(id)&&!this.state.unlocks.includes(id);}
 build(type,x,y){
  if(this.paused)return this.notify('Resume the village to build.');
  if(this.locked(type))return this.notify('Complete campaign chapters to unlock this.');
  if(!inBounds(this.world,this.data,type,x,y))return this.notify('That land is still wild. Earn village XP (quests, scholars, surveys) to open new rows.');
  if(!canPlace(this.world,this.data,type,x,y))return this.notify('Too close — roomy buildings need a one-tile gap. Villages breathe; clutter burns.');
  if(!pay(this.world.resources,buildingCost(type,1,this.world,this.data)))return this.notify('Not enough resources. Let your village gather more.');
  const b=makeBuilding(type,x,y,this.data);b.remaining=this.data.buildings[type].buildSeconds;this.world.buildings.push(b);const cp=center(b,this.data);this.world.effects.push({x:cp.x,y:cp.y,tx:cp.x,ty:cp.y,kind:'place',life:.6});sfx.place();this.notify(`${this.data.buildings[type].name} construction started.`);return b;
 }
 upgrade(id){
  const b=this.world.buildings.find(b=>b.id===id);if(!b||b.hp<=0||b.remaining>0)return;
  if(b.level>=this.data.buildings[b.type].tiers.length)return this.notify('This building is at its highest tier.');
  const cost=b.type==='hall'?{wood:200*b.level,gold:150*b.level}:buildingCost(b.type,b.level+1,this.world,this.data);
  if(!pay(this.world.resources,cost))return this.notify('Not enough resources for this upgrade.');
  b.level++;b.hp=this.data.buildings[b.type].tiers[b.level-1].hp;
  // Mid-game pacing: upgrades after the first 5 minutes take 50% longer.
  // Early snappy builds (4-6s new construction, fast first upgrades) untouched.
  b.remaining=6*b.level*((this.world.elapsed||0)>300?1.5:1);const cp=center(b,this.data);this.world.effects.push({x:cp.x,y:cp.y,tx:cp.x,ty:cp.y,kind:'fanfare',life:.8});sfx.upgrade();this.notify('Upgrade started. Your builders are on it.');
 }
 repair(id){const b=this.world.buildings.find(b=>b.id===id);if(!b)return;const max=this.data.buildings[b.type].tiers[b.level-1].hp;if(b.hp>=max)return;
  if(!pay(this.world.resources,{wood:Math.ceil((max-b.hp)/15)}))return this.notify('Gather more wood to repair.');b.hp=max;const cp=center(b,this.data);this.world.effects.push({x:cp.x,y:cp.y,tx:cp.x,ty:cp.y,kind:'heal',life:.3});sfx.repair();this.notify('Building repaired.');}
 repairAll(){const damaged=this.world.buildings.filter(b=>{const max=this.data.buildings[b.type].tiers[b.level-1].hp;return b.hp<max;});if(!damaged.length)return this.notify('Nothing needs repair.');
  const cost={wood:damaged.reduce((n,b)=>n+Math.ceil((this.data.buildings[b.type].tiers[b.level-1].hp-b.hp)/15),0)};
  if(!pay(this.world.resources,cost))return this.notify(`Repairs need ${cost.wood} wood. Gather more first.`);
  for(const b of damaged){b.hp=this.data.buildings[b.type].tiers[b.level-1].hp;const cp=center(b,this.data);this.world.effects.push({x:cp.x,y:cp.y,tx:cp.x,ty:cp.y,kind:'heal',life:.3});}
  sfx.repair();this.notify(`All buildings repaired for ${cost.wood} wood.`);}
 relocate(id,x,y){const b=this.world.buildings.find(b=>b.id===id);if(!b||this.world.enemies.length||this.world.raidPending)return this.notify('Buildings cannot move during a raid.');if(!inBounds(this.world,this.data,b.type,x,y))return this.notify('That land is still wild. Earn village XP to open new rows.');if(!canPlace(this.world,this.data,b.type,x,y,b.id))return this.notify('Too close — roomy buildings need a one-tile gap.');b.x=x;b.y=y;this.notify('Building moved.');return true;}
 assign(unitId,buildingId){
  const u=this.world.troops.find(t=>t.id===unitId);if(!u)return this.notify('That villager is gone.');
  if(!buildingId){u.workplace=null;this.notify(`${this.data.troops[u.type].name} is resting.`);return true;}
  const b=this.world.buildings.find(b=>b.id===buildingId);
  if(!b||!assignmentValid(this.world,this.data,u,b))return this.notify('That worker does not belong there — match each profession to its own workplace.');
  u.workplace=buildingId;
  const job=this.data.troops[u.type].job;
  this.notify(`${this.data.troops[u.type].name} assigned to the ${this.data.buildings[b.type].name}. ${job?.text||''}`);
  return true;
 }
 recruit(type){
  if(!this.data.troops[type])return this.notify('Unknown calling.');
  if(!this.world.buildings.some(b=>b.type==='barracks'&&b.hp>0&&b.remaining<=0))return this.notify('Build a barracks first.');
  const mission=this.data.missions.find(m=>m.id===this.state.mission?.id),limit=mission?.troopLimit||16;
  if(this.world.troops.length>=limit)return this.notify(`Your troop limit is ${limit}.`);
  if(!pay(this.world.resources,this.data.troops[type].recruitCost))return this.notify('Not enough food or gold.');
  this.world.troops.push(makeUnit(type,this.data,this.world.troops.length%5));sfx.upgrade();this.notify(`${this.data.troops[type].name} recruited.`);
 }
 level(id){const u=this.world.troops.find(t=>t.id===id);if(!u||u.level>=this.data.troops[u.type].maxLevel)return;const curve=u.level>=5?1.5:1;const cost=Object.fromEntries(Object.entries(this.data.troops[u.type].levelCost).map(([k,v])=>[k,Math.ceil(v*u.level*curve)]));if(!pay(this.world.resources,cost))return this.notify('Not enough food or gold to train.');u.level++;u.hp=stats(u,this.data).hp;this.notify(`Level ${u.level} reached${u.level%5===0?' — new ability unlocked!':'.'}`);}
 equip(id,itemId){const u=this.world.troops.find(t=>t.id===id),item=this.data.items[itemId];if(!u||!item||!item.roles.includes(u.type)||this.locked(itemId))return;
  if(!u.owned.includes(itemId)){if(!pay(this.world.resources,item.cost))return this.notify('Not enough resources for this equipment.');u.owned.push(itemId);}u.gear=itemId;this.notify(`${item.name} equipped.`);}
 ability(id,ability){const u=this.world.troops.find(t=>t.id===id);if(u)this.notify(activateAbility(this.world,this.data,u,ability)?'Rallying light restores nearby allies.':'Ability is not ready.');}
 commandMove(id,x,y){const u=this.world.troops.find(t=>t.id===id);if(!u||u.hp<=0||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=this.data.world.width||y>=this.data.world.height)return false;if(blocked(this.world,this.data,x,y)||!nextStep(this.world,this.data,u,{x:x+.5,y:y+.5},.65)){this.notify('No clear path. Choose open ground.');return false;}u.order={kind:'move',x:x+.5,y:y+.5};this.notify(`${this.data.troops[u.type].name} moving.`);return true;}
 commandAttack(id,enemyId){const u=this.world.troops.find(t=>t.id===id);if(!u||!enemyId)return false;if(this.data.troops[u.type].role!=='combat')return void this.notify('Only fighters take attack orders.'),false;u.order={kind:'attack',targetId:enemyId};this.notify(`${this.data.troops[u.type].name} attacking!`);return true;}
 commandHold(id){const u=this.world.troops.find(t=>t.id===id);if(!u)return false;u.order={kind:'hold'};this.notify(`${this.data.troops[u.type].name} holding position.`);return true;}
 clearOrder(id){const u=this.world.troops.find(t=>t.id===id);if(!u)return false;u.order=null;this.notify(`${this.data.troops[u.type].name} resuming duties.`);return true;}
 raid(count){if(this.state.mission)return this.notify('Campaign raids follow the mission timeline.');if(this.world.enemies.length||this.world.raidPending)return this.notify('A raid is already underway.');if(!this.world.buildings.some(b=>b.type==='hall'&&b.hp>0))return this.notify('Repair the manor before another raid.');
  const party=count??(this.world.wave===0?3:4+this.world.wave);this.world.raidPending={timer:3,count:party};this.world.raidKills=0;this.world.raidLoot=0;this.world.raidResult=null;sfx.horn();this.notify(`Scouts report ${party} raiders from the west — 3 seconds to positions!`);}
 mission(id){if(startMission(this.state,this.data,id))this.notify('Expedition begun. Your home village is safely paused.');else this.notify('Finish the current raid or unlock the previous chapter first.');}
 returnHome(){const result=finishMission(this.state,this.data);this.notify(result?.first?'Victory! Rewards and unlocks delivered to your village.':'Returned home. First-clear rewards can only be claimed once.');this.persist();}
 harvest(id){const b=this.world.buildings.find(b=>b.id===id),spec=b&&this.data.buildings[b.type];if(this.paused||!b||!spec.production||b.hp<=0||b.remaining>0)return false;const amount=Math.floor(b.harvestBonus||0);if(amount<1)return false;b.harvestBonus-=amount;this.world.resources[spec.production]+=amount;this.world.gathered[spec.production]+=amount;const at=center(b,this.data);this.world.effects.push({x:at.x,y:at.y,tx:at.x,ty:at.y,kind:'float',text:`+${amount} ${spec.production}`,color:'#ffe595',life:.9});sfx.collect();this.notify(`Collected ${amount} bonus ${spec.production}.`);return amount;}
 persist(){const ok=save(this.state);if(!ok)this.notify('Browser storage is unavailable. Progress cannot be saved here.');return ok;}
 tick(dt){if(this.paused||this.state.mission?.status&&this.state.mission.status!=='active')return;
  if(this.world.raidPending&&!this.state.mission){this.world.raidPending.timer-=dt;
   if(this.world.raidPending.timer<=0){const {count}=this.world.raidPending;this.world.raidPending=null;spawnRaid(this.world,count);this.notify(`Wave ${this.world.wave} — ${count} raiders! Defend the manor!`);}}
  const raided=!this.state.mission&&(this.world.enemies.length>0||this.world.raidPending);
  for(const b of this.world.buildings){const spec=this.data.buildings[b.type];if(spec.harvest&&b.hp>0&&b.remaining<=0)b.harvestBonus=Math.min(spec.harvest.capacity,Math.max(0,Number.isFinite(b.harvestBonus)?b.harvestBonus:0)+spec.harvest.bonusRate*b.level*dt);}
  this.world.elapsed+=dt;tickEconomy(this.world,this.data,dt);tickCombat(this.world,this.data,dt);tickVillage(this.state,this.data,dt,m=>this.notify(m));const before=this.state.mission?.status;tickMission(this.state,this.data);
  if(raided&&!this.world.enemies.length&&!this.world.raidPending&&this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)){const kills=this.world.raidKills??0,loot=this.world.raidLoot??0;
   const damaged=this.world.buildings.filter(b=>b.hp<this.data.buildings[b.type].tiers[b.level-1].hp);
   const repairWood=damaged.reduce((n,b)=>n+Math.ceil((this.data.buildings[b.type].tiers[b.level-1].hp-b.hp)/15),0);
   this.world.raidResult={won:true,kills,loot,damaged:damaged.length,repairWood};sfx.win();
   this.notify(`Raid repelled! ${kills} raiders fell · +${loot} gold loot${damaged.length?` · ${damaged.length} buildings need repair (${repairWood} wood)`:'. All buildings stand strong.'}`);this.persist();}
  if(before!==this.state.mission?.status){this.notify(this.state.mission.status==='won'?'Mission complete! Return home to claim your rewards.':'Expedition lost. Return home and try a different layout.');this.persist();}
  if(!this.state.mission&&!this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)&&this.world.enemies.length){const kills=this.world.raidKills??0,loot=this.world.raidLoot??0;this.world.enemies=[];this.world.resources.wood=Math.max(80,this.world.resources.wood);this.world.raidResult={won:false,kills,loot,damaged:this.world.buildings.filter(b=>b.hp<=0).length,repairWood:0};sfx.lose();this.notify('The manor fell. Salvaged wood is available for repairs.');}
  this.saveTimer+=dt;if(this.saveTimer>5){this.saveTimer=0;this.persist();}
 }
}
