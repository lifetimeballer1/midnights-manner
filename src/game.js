import {nextStep,blocked} from './systems/pathfinding.js';
import {createWorld,makeBuilding,makeUnit,canPlace,inBounds,pay,stats,buildingCost,center,assignmentValid} from './model.js';
import {tickVillage,gainXp} from './systems/village.js';
import {tickEconomy} from './systems/economy.js';
import {tickCombat,spawnRaid,activateAbility} from './systems/combat.js';
import {startMission,tickMission,finishMission} from './systems/campaign.js';
import {load,save} from './storage.js';
import {dayKey,seasonFor,modifierFor,calendarEffects,performTrade,marketOpen,describeDeal} from './systems/calendar.js';
import {sfx} from './systems/audio.js';
// Scheduled home raids: all timing and ceremony lines come from
// data.world.homeRaids so balance and voice stay in JSON, not logic.
function raidConfig(data) {
  const c = data.world.homeRaids || {};
  return {
    firstAt: Number.isFinite(c.firstAt) ? c.firstAt : 300,
    interval: Number.isFinite(c.interval) ? c.interval : 240,
    warning: Number.isFinite(c.warning) ? c.warning : 15,
    firstCount: Number.isFinite(c.firstCount) ? c.firstCount : 2,
    baseCount: Number.isFinite(c.baseCount) ? c.baseCount : 3,
    perWave: Number.isFinite(c.perWave) ? c.perWave : 1,
    maxCount: Number.isFinite(c.maxCount) ? c.maxCount : 8,
    warningLines: Array.isArray(c.warningLines) && c.warningLines.length ? c.warningLines : ['Horns in the west — {count} raiders, {seconds} to the walls!'],
    attackLines: Array.isArray(c.attackLines) && c.attackLines.length ? c.attackLines : ['Wave {wave} — {count} raiders! Defend the manor!'],
    victoryLines: Array.isArray(c.victoryLines) && c.victoryLines.length ? c.victoryLines : ['Raid repelled! {kills} raiders fell · +{loot} gold loot.'],
    defeatLines: Array.isArray(c.defeatLines) && c.defeatLines.length ? c.defeatLines : ['The manor fell. Salvaged wood is available for repairs.']
  };
}
function pickLine(lines, wave) { return lines[Math.max(0, wave) % lines.length]; }
function fillLine(line, vars) { return String(line).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''); }
function scheduledCount(world, cfg) {
  if (world.wave === 0) return cfg.firstCount;
  return Math.min(cfg.maxCount, cfg.baseCount + world.wave * cfg.perWave);
}
export class Game {
 constructor(data){this.data=data;this.state=load(data)||{world:createWorld(data),home:null,mission:null,completed:[],unlocks:['tower'],xp:0,vlevel:1,questsCompleted:[],tradeDay:null,tradesUsed:{},calendarDay:dayKey(new Date()),gatheredAtBell:null};this.paused=false;this.message='Welcome home. Build a farm, equip your people, and prepare for the night.';this.dirty=true;this.saveTimer=0;}
 get world(){return this.state.world;}
 notify(message){this.message=message;this.dirty=true;}
 locked(id){return this.data.world.locked.includes(id)&&!this.state.unlocks.includes(id);}

 build(type,x,y){
  if(this.paused)return this.notify('Resume the village to build.');
  if(this.locked(type))return this.notify('Complete campaign chapters to unlock this.');
  const spec=this.data.buildings[type];
  if(spec&&(spec.minLevel||1)>(this.state.vlevel||1))return this.notify(`The ${spec.name} needs village level ${spec.minLevel}. Earn XP — quests, scholars, surveys.`);
  // Building-chain gates (data `requiresBuilding: {type, level}`): the new
  // work waits on the old work at tier — first the pour-house behind a
  // tier-2 cold grove, later wonders the same generic way. No per-building
  // conditionals; the shop panel reads the same field.
  const req=spec&&spec.requiresBuilding;
  if(req&&req.type){
   const need=req.level||1;
   const ready=this.world.buildings.some(b=>b.type===req.type&&b.hp>0&&(b.level||1)>=need);
   if(!ready){const rn=this.data.buildings[req.type]?.name||req.type;return this.notify(`The ${spec.name} needs a tier-${need} ${rn} first. Raise the old work before the new fire.`);}
  }
  if(!inBounds(this.world,this.data,type,x,y))return this.notify('That land is still wild. Earn village XP (quests, scholars, surveys) to open new rows.');
  if(!canPlace(this.world,this.data,type,x,y))return this.notify('Too close — roomy buildings need a one-tile gap. Villages breathe; clutter burns.');
  if(!pay(this.world.resources,buildingCost(type,1,this.world,this.data)))return this.notify('Not enough resources. Let your village gather more.');
  const b=makeBuilding(type,x,y,this.data);b.remaining=this.data.buildings[type].buildSeconds;this.world.buildings.push(b);const cp=center(b,this.data);this.world.effects.push({x:cp.x,y:cp.y,tx:cp.x,ty:cp.y,kind:'place',life:.6});sfx.place();this.notify(`${this.data.buildings[type].name} construction started.`);return b;
 }
 upgrade(id){
  const b=this.world.buildings.find(b=>b.id===id);if(!b||b.hp<=0||b.remaining>0)return;
  if(b.level>=this.data.buildings[b.type].tiers.length)return this.notify('This building is at its highest tier.');
  // Level-gated tiers (data/buildings.json `tierGates: {tier: vlevel}`):
  // the Scriptorium observatory waits for village level 7, and later
  // wonders gate the same generic way. No building-specific conditionals.
  const gate=this.data.buildings[b.type].tierGates?.[b.level+1];
  if(gate&&(this.state.vlevel||1)<gate)return this.notify(`A tier-${b.level+1} ${this.data.buildings[b.type].name} needs village level ${gate}. Earn XP — quests, scholars, surveys.`);
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
  if(!buildingId){u.workplace=null;u.order=null;this.notify(`${this.data.troops[u.type].name} is available for work.`);return true;}
  const b=this.world.buildings.find(b=>b.id===buildingId);
  if(!b||!assignmentValid(this.world,this.data,u,b))return this.notify('That worker does not belong there — match each profession to its own workplace.');
  u.workplace=buildingId;u.order=null;
  const job=this.data.troops[u.type].job;
  this.notify(`${this.data.troops[u.type].name} assigned to the ${this.data.buildings[b.type].name}. ${job?.text||''}`);
  return true;
 }
 recruit(type,workplaceId=null){
  if(!this.data.troops[type])return this.notify('Unknown calling.');
  if(this.locked(type))return this.notify('That calling is not yet earned — quests and campaign chapters unlock new people.');
  if(!this.world.buildings.some(b=>b.type==='barracks'&&b.hp>0&&b.remaining<=0))return this.notify('Build a barracks first.');
  const mission=this.data.missions.find(m=>m.id===this.state.mission?.id),limit=mission?.troopLimit||16;
  if(this.world.troops.length>=limit)return this.notify(`Your troop limit is ${limit}.`);
  const unit=makeUnit(type,this.data,this.world.troops.length%5);
  const preferred=workplaceId?this.world.buildings.find(b=>b.id===workplaceId):null;
  if(workplaceId&&(!preferred||!assignmentValid(this.world,this.data,unit,preferred)))return this.notify('This workplace is full, unfinished, or unavailable. No resources spent.');
  const workplace=preferred||this.world.buildings.filter(b=>assignmentValid(this.world,this.data,unit,b)).sort((a,b)=>Math.hypot(a.x-unit.x,a.y-unit.y)-Math.hypot(b.x-unit.x,b.y-unit.y))[0];
  if(!pay(this.world.resources,this.data.troops[type].recruitCost))return this.notify('Not enough food or gold.');
  if(workplace)unit.workplace=workplace.id;
  this.world.troops.push(unit);sfx.upgrade();this.notify(`${this.data.troops[type].name} hired${workplace?` and assigned to ${this.data.buildings[workplace.type].name}`:'. No matching job is open yet'}.`);return unit;
 }
 level(id){const u=this.world.troops.find(t=>t.id===id);if(!u||u.level>=this.data.troops[u.type].maxLevel)return;const curve=u.level>=5?1.5:1;const cost=Object.fromEntries(Object.entries(this.data.troops[u.type].levelCost).map(([k,v])=>[k,Math.ceil(v*u.level*curve)]));if(!pay(this.world.resources,cost))return this.notify('Not enough food or gold to train.');u.level++;u.hp=stats(u,this.data).hp;this.notify(`Level ${u.level} reached${u.level%5===0?' — new ability unlocked!':'.'}`);}
 equip(id,itemId){const u=this.world.troops.find(t=>t.id===id),item=this.data.items[itemId];if(!u||!item||!item.roles.includes(u.type)||this.locked(itemId))return;
  // Armor-slot pieces (Padded Coat onward, item.slot==='armor') ride a
  // second gear axis with their own owned list; everything else is main-hand.
  if(item.slot==='armor'){
   u.armorOwned=u.armorOwned||[];
   if(!u.armorOwned.includes(itemId)){if(!pay(this.world.resources,item.cost))return this.notify('Not enough resources for this armor.');u.armorOwned.push(itemId);}u.armor=itemId;this.notify(`${item.name} fitted as armor.`);return;
  }
  if(!u.owned.includes(itemId)){if(!pay(this.world.resources,item.cost))return this.notify('Not enough resources for this equipment.');u.owned.push(itemId);}u.gear=itemId;this.notify(`${item.name} equipped.`);}
 ability(id,ability){const u=this.world.troops.find(t=>t.id===id);if(u){const def=this.data.abilities[ability];const ok=activateAbility(this.world,this.data,u,ability);this.notify(ok?(def?.effect==='heal'?'Rallying light restores nearby allies.':`${def?.name||'Ability'} unleashed.`):'Ability is not ready.');}}
 commandMove(id,x,y){const u=this.world.troops.find(t=>t.id===id);if(!u||u.hp<=0||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=this.data.world.width||y>=this.data.world.height)return false;if(blocked(this.world,this.data,x,y)||!nextStep(this.world,this.data,u,{x:x+.5,y:y+.5},.65)){this.notify('No clear path. Choose open ground.');return false;}u.order={kind:'move',x:x+.5,y:y+.5};this.notify(`${this.data.troops[u.type].name} moving.`);return true;}
 commandAttack(id,enemyId){const u=this.world.troops.find(t=>t.id===id);if(!u||!enemyId)return false;if(this.data.troops[u.type].role!=='combat')return void this.notify('Only fighters take attack orders.'),false;u.order={kind:'attack',targetId:enemyId};this.notify(`${this.data.troops[u.type].name} attacking!`);return true;}
 commandHold(id){const u=this.world.troops.find(t=>t.id===id);if(!u)return false;u.order={kind:'hold'};this.notify(`${this.data.troops[u.type].name} holding position.`);return true;}
 clearOrder(id){const u=this.world.troops.find(t=>t.id===id);if(!u)return false;u.order=null;this.notify(`${this.data.troops[u.type].name} resuming duties.`);return true;}
 raid(count){if(this.state.mission)return this.notify('Campaign raids follow the mission timeline.');if(this.world.enemies.length||this.world.raidPending)return this.notify('A raid is already underway.');if(!this.world.buildings.some(b=>b.type==='hall'&&b.hp>0))return this.notify('Repair the manor before another raid.');
  const party=count??(this.world.wave===0?3:4+this.world.wave);this.world.raidPending={timer:3,count:party};this.world.raidKills=0;this.world.raidLoot=0;this.world.raidResult=null;sfx.horn();this.notify(`Scouts report ${party} raiders from the west — 3 seconds to positions!`);}
 mission(id){const m=this.data.missions.find(m=>m.id===id);if(startMission(this.state,this.data,id))this.notify(`${m?.ceremony?.warning||'Expedition begun.'} Your home village is safely paused.`);else this.notify('Finish the current raid or unlock the previous chapter first.');}
 returnHome(){const m=this.data.missions.find(m=>m.id===this.state.mission?.id);const result=finishMission(this.state,this.data);if(result?.first)this.notify(`${m?.ceremony?.victory||'Victory!'} Rewards and unlocks delivered to your village.`);else if(result?.won)this.notify('Returned home. First-clear rewards can only be claimed once.');else this.notify(`${m?.ceremony?.defeat||'Expedition lost.'} Your home is safe.`);this.persist();}
 trade(id,date=new Date()){
  if(this.paused)return this.notify('Resume the village to trade.');
  if(this.state.mission)return this.notify('The traders wait at home — finish the expedition first.');
  if(!marketOpen(this.state))return this.notify('Dust on the Grey Road — no wagons yet. Grow the village to level 2 and the traders will find you.');
  const res=performTrade(this.state,this.data,id,date);
  if(!res.ok)return this.notify(res.error);
  if(res.xp)gainXp(this.state,res.xp);
  sfx.collect();
  const left=res.left>0?` (${res.left} left today)`:' (that was the last one today)';
  this.notify(`Deal struck — ${describeDeal(res.deal)}${left}. ${res.deal.flavor}`);
  this.persist();
  return true;
 }
 // Nightly bell: first touch each calendar day rolls the world over — fresh
 // trader caps, yesterday's harvest read aloud, today's sky announced. Old
 // saves (calendarDay null) ring once on their next visit; brand-new games
 // start on today so the welcome message stands.
 checkCalendar(date=new Date()){
  const key=dayKey(date);
  this.world.calendarBonus=calendarEffects(this.data.calendar,date);
  if(this.state.calendarDay===key)return false;
  const g=this.world.gathered||{wood:0,food:0,gold:0,frostwood:0,plate:0};
  const prev=this.state.gatheredAtBell;
  this.state.calendarDay=key;
  this.state.tradeDay=key;
  this.state.tradesUsed={};
  this.state.gatheredAtBell={wood:g.wood||0,food:g.food||0,gold:g.gold||0,frostwood:g.frostwood||0,plate:g.plate||0};
  const s=seasonFor(this.data.calendar,date),m=modifierFor(this.data.calendar,date);
  let line=`🔔 The night bell rings. ${s?`${s.season.name}, day ${s.dayOfCycle} of 28. `:''}${m?`${m.name}: ${m.text}`:'A quiet night on the frontier.'}`;
  if(prev){
   const dw=Math.max(0,Math.floor(g.wood-(prev.wood||0))),df=Math.max(0,Math.floor(g.food-(prev.food||0))),dg=Math.max(0,Math.floor(g.gold-(prev.gold||0)));
   line+=` Yesterday the village raised ${dw} wood, ${df} food and ${dg} gold. The wagons have set out fresh deals.`;
  }else line+=` The wagons have set out fresh deals.`;
  sfx.bell();
  this.notify(line);
  this.persist();
  return true;
 }
 harvest(id){const b=this.world.buildings.find(b=>b.id===id),spec=b&&this.data.buildings[b.type];if(this.paused||!b||!spec.production||b.hp<=0||b.remaining>0)return false;const amount=Math.floor(b.harvestBonus||0);if(amount<1)return false;b.harvestBonus-=amount;this.world.resources[spec.production]=(this.world.resources[spec.production]||0)+amount;this.world.gathered[spec.production]=(this.world.gathered[spec.production]||0)+amount;const at=center(b,this.data);this.world.effects.push({x:at.x,y:at.y,tx:at.x,ty:at.y,kind:'float',text:`+${amount} ${spec.production}`,color:'#ffe595',life:.9});sfx.collect();this.notify(`Collected ${amount} bonus ${spec.production}.`);return amount;}
 persist(){const ok=save(this.state);if(!ok)this.notify('Browser storage is unavailable. Progress cannot be saved here.');return ok;}
 importState(state){this.state=state;this.paused=false;this.saveTimer=0;this.dirty=true;this.notify('Save restored. Welcome back to the village.');}
 tick(dt){if(this.paused||this.state.mission?.status&&this.state.mission.status!=='active')return;
  this.checkCalendar();
  const cfg=raidConfig(this.data);
  if(!this.state.mission&&!this.world.enemies.length&&!this.world.raidPending){
   if(!Number.isFinite(this.world.nextRaidAt))this.world.nextRaidAt=this.world.elapsed+cfg.interval;
   // Scheduled horns: the frontier comes calling on its own. Gentle first
   // raid (a scouting pair) so new villages get five quiet minutes; the
   // test button still works for the impatient. Never during a mission.
   if(this.world.elapsed>=this.world.nextRaidAt&&this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)){
    const count=scheduledCount(this.world,cfg);
    this.world.raidPending={timer:cfg.warning,count,scheduled:true};this.world.raidKills=0;this.world.raidLoot=0;this.world.raidResult=null;sfx.horn();
    this.notify(fillLine(pickLine(cfg.warningLines,this.world.wave),{count,seconds:Math.ceil(cfg.warning),wave:this.world.wave+1}));
   }
  }
  if(this.world.raidPending&&!this.state.mission){this.world.raidPending.timer-=dt;
   if(this.world.raidPending.timer<=0){const {count,scheduled}=this.world.raidPending;this.world.raidPending=null;spawnRaid(this.world,count);
    this.notify(scheduled?fillLine(pickLine(cfg.attackLines,this.world.wave),{count,wave:this.world.wave}):`Wave ${this.world.wave} — ${count} raiders! Defend the manor!`);}}
  const raided=!this.state.mission&&(this.world.enemies.length>0||this.world.raidPending);
  for(const b of this.world.buildings){const spec=this.data.buildings[b.type];if(spec.harvest&&b.hp>0&&b.remaining<=0)b.harvestBonus=Math.min(spec.harvest.capacity,Math.max(0,Number.isFinite(b.harvestBonus)?b.harvestBonus:0)+spec.harvest.bonusRate*b.level*dt);}
  this.world.elapsed+=dt;tickEconomy(this.world,this.data,dt);tickCombat(this.world,this.data,dt);tickVillage(this.state,this.data,dt,m=>this.notify(m));const before=this.state.mission?.status;tickMission(this.state,this.data);
  if(raided&&!this.world.enemies.length&&!this.world.raidPending&&this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)){const kills=this.world.raidKills??0,loot=this.world.raidLoot??0;
   const damaged=this.world.buildings.filter(b=>b.hp<this.data.buildings[b.type].tiers[b.level-1].hp);
   const repairWood=damaged.reduce((n,b)=>n+Math.ceil((this.data.buildings[b.type].tiers[b.level-1].hp-b.hp)/15),0);
   this.world.raidResult={won:true,kills,loot,damaged:damaged.length,repairWood};sfx.win();
   this.world.nextRaidAt=this.world.elapsed+cfg.interval;
   this.notify(`${fillLine(pickLine(cfg.victoryLines,this.world.wave),{kills,loot,wave:this.world.wave})}${damaged.length?` ${damaged.length} buildings need repair (${repairWood} wood).`:' All buildings stand strong.'}`);this.persist();}
  if(before!==this.state.mission?.status){const m=this.data.missions.find(m=>m.id===this.state.mission.id);this.notify(this.state.mission.status==='won'?`${m?.ceremony?.victory||'Mission complete!'} Return home to claim your rewards.`:`${m?.ceremony?.defeat||'Expedition lost.'} Return home and try a different layout.`);this.persist();}
  if(!this.state.mission&&!this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)&&this.world.enemies.length){const kills=this.world.raidKills??0,loot=this.world.raidLoot??0;this.world.enemies=[];this.world.resources.wood=Math.max(80,this.world.resources.wood);this.world.raidResult={won:false,kills,loot,damaged:this.world.buildings.filter(b=>b.hp<=0).length,repairWood:0};sfx.lose();this.world.nextRaidAt=this.world.elapsed+cfg.interval;this.notify(fillLine(pickLine(cfg.defeatLines,this.world.wave),{kills,loot,wave:this.world.wave}));}
  this.saveTimer+=dt;if(this.saveTimer>5){this.saveTimer=0;this.persist();}
 }
}
