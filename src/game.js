import {refinePolicy} from './systems/steward-production.js';
import {enqueueConstruction,removeConstruction,moveConstruction} from './systems/steward-construction.js';
import {captureBlueprint,blueprintQuote,applyBlueprint,removeBlueprint} from './systems/steward-blueprints.js';
import {createDistrict,updateDistrict,removeDistrict} from './systems/steward-districts.js';
import {spendingAvailable,canSpend} from './systems/steward-budget.js';
import {tickSteward,refreshSteward} from './systems/steward.js';
import {setGoal,clearGoal} from './systems/steward-goals.js';
import {tickDefensePosts,assignDefensePost,defenseRaidSummary,setRally as setRallyPreset} from './systems/defense-posts.js';
import {tickAutomation,automationSettings} from './systems/automation.js';
import {bankOutput,outputAmount} from './systems/refiner-output.js';
import {tickLogistics,requestCaravan} from './systems/logistics.js';
import {buildRoad} from './systems/roads.js';
import {tickTrails} from './systems/trails.js';
import {startResearch,tickResearch,researchReason} from './systems/research.js';
import {tickEmergency} from './systems/emergency.js';
import {factionFor} from './systems/tactics.js';
import {ensureDirector,directorConfig,directorParty,directorPatrol,territoryPatrol,scheduleRecovery} from './systems/raid-director.js';
import {resourceLabel,resourceInfo} from './resources.js';
import {wallRowQuote,wallLine,isWall} from './systems/walls.js';
import {nextStep,blocked} from './systems/pathfinding.js';
import {createWorld,makeBuilding,makeUnit,canPlace,inBounds,pay,afford,stats,buildingCost,center,assignmentValid,promotionOptions,housing,buildingLimit,buildingCount} from './model.js';
import {buildTiles} from './systems/biomes.js';
import {claimCheck,setClaimed,claimRect,claimRegion,claimPreclaimed,regionFor} from './systems/expansion.js';
import {tickVillage,gainXp} from './systems/village.js';
import {tickTownMeal,tickTownSupply} from './systems/food.js';
import {ensureIdentity, tickVillagerJobs, tickTitles, autoAssign as autoAssignJobs, idleWithoutPosts, autoFillTick, scorePost} from './systems/villagers.js';
import {tickEconomy} from './systems/economy.js';
import {depositCentral} from './systems/storage.js';
import {tickRefine, tickCraft, startCraftOrder} from './systems/crafting.js';
import {tickExpeditions,startExpedition,recallExpedition,expeditionReason,expeditionQuote} from './systems/expeditions.js';
import {tickFrontierEvents,resolveFrontierEvent} from './systems/frontier-events.js';
import {tickCombat,spawnRaid,activateAbility,raidSides} from './systems/combat.js';
import {startMission,tickMission,finishMission,missionLockReason} from './systems/campaign.js';
import {load,save} from './storage.js';
import {ensureMultiplayer,validateUsername,randomCode,addFriend,removeFriend,giftReason,makeGift,speedupReason,makeSpeedup,applyInbox,pushActivity,publicSnapshot,stampCloud} from './multiplayer.js';
import {dayKey,seasonFor,modifierFor,calendarEffects,performTrade,marketOpen,describeDeal} from './systems/calendar.js';
import {phaseAt,weatherAt,clockConfig,tickStorm} from './systems/daynight.js';
import {bossFor,spawnBoss,endgameSpawnOpts,renownCost,renownAvailable,paragonEligible,paragonCost,buildingMaxHp,renownLimitBonus,renownTroopBonus,renownRewardsUpTo,renownUnlocksFor} from './systems/endgame.js';
import {warChestById,warChestLevel,warChestMax,warChestTotal,warChestOpenable,warChestArmed,warChestMinLevel,warChestRecovery,spendWarChest} from './systems/warchest.js';
import {beginFestival} from './systems/festivals.js';
import {beginScout,scoutReason,assaultReason,applyAnnex,conquestLimitBonus,tribeOf} from './systems/conquest.js';
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
    warningLines: Array.isArray(c.warningLines) && c.warningLines.length ? c.warningLines : ['Horns around the village — {count} raiders, {seconds} to the walls!'],
    attackLines: Array.isArray(c.attackLines) && c.attackLines.length ? c.attackLines : ['Wave {wave} — {count} raiders! Defend the manor!'],
    victoryLines: Array.isArray(c.victoryLines) && c.victoryLines.length ? c.victoryLines : ['Raid repelled! {kills} raiders fell · +{loot} gold loot.'],
    defeatLines: Array.isArray(c.defeatLines) && c.defeatLines.length ? c.defeatLines : ['The manor fell. Salvaged wood is available for repairs.']
  };
}
function pickLine(lines, wave) { return lines[Math.max(0, wave) % lines.length]; }
function fillLine(line, vars) { return String(line).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''); }
export class Game {
 constructor(data){this.data=data;this.state=load(data)||{world:createWorld(data),home:null,mission:null,completed:[],unlocks:['tower'],xp:0,vlevel:1,questsCompleted:[],tradeDay:null,tradesUsed:{},calendarDay:dayKey(new Date()),gatheredAtBell:null};
 // Frontier claims (Phase 2b): pre-expansion saves have no tile grid —
 // build it from the settled bounds so old villages keep every tile.
 // Region center is always ensured on top; migration only adds claims.
 try{
  for(const w of [this.state.world,this.state.home]){
   if(!w)continue;
   if(typeof w.autoTrain!=='boolean')w.autoTrain=false;
   if(!Array.isArray(w.tiles)||!w.tiles.length)w.tiles=buildTiles(this.data.world,w.bounds);
   else claimRect(w,w.bounds?.w||this.data.world.width,w.bounds?.h||this.data.world.height);
   try{claimPreclaimed(w,this.data.expansion);}catch{}
  }
 }catch{}
 this.paused=false;this.message='Welcome home. Build a farm, equip your people, and prepare for the night.';this.dirty=true;this.saveTimer=0;
 // Multiplayer shelf (v12): old saves backfill quietly; any help waiting
 // in the inbox lands on arrival — gifts in storage, hands on scaffolds.
  try{ensureMultiplayer(this.state);applyInbox(this.state,this.data);}catch{}}
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
  // Dual-building gates (data `requiresBuildings: [{type, level}]`): the
  // drowned chapel waits on a tier-3 chapel AND a tier-2 water line — AND-gate contrasting
  // the mission OR-gate. No per-building conditionals; the shop reads it.
  const reqs=spec&&spec.requiresBuildings;
  if(Array.isArray(reqs)&&reqs.length){
   const missing=reqs.filter(r=>!this.world.buildings.some(b=>b.type===r.type&&b.hp>0&&(b.level||1)>=(r.level||1)));
   if(missing.length){const names=missing.map(r=>`tier-${r.level||1} ${this.data.buildings[r.type]?.name||r.type}`).join(' and ');return this.notify(`The ${spec.name} needs ${names} first. Raise the old work before the new water.`);}
  }
  // Wonders stand alone (data `maxPerVillage: 1`): one Moon Dial, one Dawn
  // Gate per village — the sky gets one vote, dawn gets one door.
  if(spec&&spec.maxPerVillage&&this.world.buildings.some(b=>b.type===type&&b.hp>0))return this.notify(`The village holds only one ${spec.name}. It stands already.`);
  // Building limits (Phase 2, data `maxCount`): a number or a per-village-
  // level array. Over-limit villages keep every building — only new work
  // waits. Ruins do not count, so a wrecked shop can be repaired in place.
  const limit=buildingLimit(type,this.state.vlevel||1,this.data,renownLimitBonus(this.world,this.data)+conquestLimitBonus(this.world,this.data));
  if(Number.isFinite(limit)){
    const built=buildingCount(this.world,type);
    if(built>=limit)return this.notify(`The village supports ${limit} ${spec.name}${limit>1?'s':''}. Raise the village level for more room.`);
  }
  if(!inBounds(this.world,this.data,type,x,y))return this.notify('That land is still wild. Earn village XP (quests, scholars, surveys) to open new rows.');
  if(!canPlace(this.world,this.data,type,x,y))return this.notify('Too close — roomy buildings need a one-tile gap. Villages breathe; clutter burns.');
  if(!pay(this.world.resources,buildingCost(type,1,this.world,this.data)))return this.notify('Not enough resources. Let your village gather more.');
  const b=makeBuilding(type,x,y,this.data);b.remaining=this.data.buildings[type].buildSeconds;
  // The Dial locks its season the day it is raised — the sky that watched
  // the building is the blessing it keeps, at half strength, ever after.
  if(this.data.buildings[type]?.moonDial){try{const s=seasonFor(this.data.calendar,new Date());if(s?.season?.id)b.dialSeason=s.season.id;}catch{}}
  this.world.buildings.push(b);const cp=center(b,this.data);this.world.effects.push({x:cp.x,y:cp.y,tx:cp.x,ty:cp.y,kind:'place',life:.6});sfx.place();this.notify(`${this.data.buildings[type].name} construction started.`);return b;
 }
 buildWallRow(type,start,end){
  if(this.paused||!isWall({type})||this.locked(type))return false;
  const cells=wallLine(start,end),spec=this.data.buildings[type];
  if(!cells.length||(spec.minLevel||1)>(this.state.vlevel||1))return false;
  if(!cells.every(p=>canPlace(this.world,this.data,type,p.x,p.y))){this.notify('Wall row blocked. Choose a clear line inside your land.');return false;}
  const unitCost=buildingCost(type,1,this.world,this.data),cost=Object.fromEntries(Object.entries(unitCost).map(([k,v])=>[k,v*cells.length]));
  if(!afford(this.world.resources,cost)){this.notify('Not enough resources for this wall row.');return false;}
  for(const p of cells)this.build(type,p.x,p.y);
  this.notify(`${cells.length} wall segments under construction.`);return true;
 }
 upgradeWallRow(id,axis='x'){
  if(this.paused)return false;
  const quote=wallRowQuote(this.world,this.data,id,axis,this.state.vlevel||1);
  if(!quote.eligible.length){this.notify('No finished walls in this row are ready to upgrade.');return false;}
  // Preflight the entire price so insufficient funds never leave a partial row.
  if(!afford(this.world.resources,quote.cost)){this.notify('Not enough resources to upgrade this row.');return false;}
  for(const b of quote.eligible)this.upgrade(b.id);
  this.notify(`${quote.eligible.length} wall segments upgrading. ${quote.row.length-quote.eligible.length} unchanged (busy, ruined, gated or max tier).`);
  return true;
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
  // Fresh timber, fresh work: a higher tier rebuilds the reinforcement.
  b.paragon=0;
  // Building-completion unlocks (data `tierUnlocks: {tier: [ids]}`): the
  // tier itself teaches something new — the Bellcote waits on a tier-3
  // chapel the way troops wait on chapters. Earned, never bought.
  const tierWon=this.data.buildings[b.type].tierUnlocks?.[b.level]||[];
  this.state.unlocks=this.state.unlocks||[];
  for(const id of tierWon)if(!this.state.unlocks.includes(id))this.state.unlocks.push(id);
  if(tierWon.length)this.notify(`Tier ${b.level} ${this.data.buildings[b.type].name} complete — unlocks: ${tierWon.map(id=>this.data.buildings[id]?.name||this.data.items[id]?.name||this.data.troops[id]?.name||id).join(', ')}.`);
  // Mid-game pacing: upgrades after the first 5 minutes take 50% longer.
  // Early snappy builds (4-6s new construction, fast first upgrades) untouched.
  b.remaining=6*b.level*((this.world.elapsed||0)>300?1.5:1);const cp=center(b,this.data);this.world.effects.push({x:cp.x,y:cp.y,tx:cp.x,ty:cp.y,kind:'fanfare',life:.8});sfx.upgrade();this.notify('Upgrade started. Your builders are on it.');
 }
 repair(id){const b=this.world.buildings.find(b=>b.id===id);if(!b)return;const max=buildingMaxHp(b,this.data);if(b.hp>=max)return;
  if(!pay(this.world.resources,{wood:Math.ceil((max-b.hp)/15)}))return this.notify('Gather more wood to repair.');b.hp=max;const cp=center(b,this.data);this.world.effects.push({x:cp.x,y:cp.y,tx:cp.x,ty:cp.y,kind:'heal',life:.3});sfx.repair();this.notify('Building repaired.');}
 repairAll(){const damaged=this.world.buildings.filter(b=>{const max=buildingMaxHp(b,this.data);return b.hp<max;});if(!damaged.length)return this.notify('Nothing needs repair.');
  const cost={wood:damaged.reduce((n,b)=>n+Math.ceil((buildingMaxHp(b,this.data)-b.hp)/15),0)};
  if(!pay(this.world.resources,cost))return this.notify(`Repairs need ${cost.wood} wood. Gather more first.`);
  for(const b of damaged){b.hp=buildingMaxHp(b,this.data);const cp=center(b,this.data);this.world.effects.push({x:cp.x,y:cp.y,tx:cp.x,ty:cp.y,kind:'heal',life:.3});}
  sfx.repair();this.notify(`All buildings repaired for ${cost.wood} wood.`);}
 // Manner Renown (Phase 12): the endless sink for maxed villages. Each
 // level sharpens every defense and sweetens salvage, forever — the
 // price climbs, the glory compounds. Bought at a standing Manor Hall.
 raiseRenown(){
  if(!renownAvailable(this.state,this.data))return this.notify('Renown needs village level 9 and a standing Manor Hall. Grow first — legends later.');
  const level=Math.max(0,this.world.renown||0),cost=renownCost(this.data,level);
  if(!pay(this.world.resources,cost))return this.notify(`Renown level ${level+1} needs ${Object.entries(cost).map(([k,v])=>`${v} ${k}`).join(' + ')}. The manner must overflow first.`);
  this.world.renown=level+1;
  // Milestone rewards (Phase 5): the data table grants titles, cap bumps
  // and unlocks — never production. Unlocks for every earned level merge
  // here, so old saves heal their reward unlocks on the next purchase.
  const newly=[];
  for(const id of renownUnlocksFor(this.data,this.world.renown))if(!this.state.unlocks.includes(id)){this.state.unlocks.push(id);newly.push(id);}
  const reward=renownRewardsUpTo(this.world,this.data,this.world.renown).find(r=>+r.level===this.world.renown);
  const bits=[];
  if(reward?.title)bits.push(`🏅 ${reward.title}.`);
  if(reward?.text)bits.push(reward.text);
  if(newly.length)bits.push(`Unlocks: ${newly.map(id=>this.data.buildings[id]?.name||this.data.items[id]?.name||this.data.troops[id]?.name||id).join(', ')}.`);
  sfx.win();
  this.notify(`📜 Manner Renown ${level+1}! Every defense strikes harder (+${Math.round((level+1)*(this.data.endgame?.renown?.damagePerLevel||0.03)*100)}% damage) and salvage runs richer (+${Math.round((level+1)*(this.data.endgame?.renown?.lootPerLevel||0.05)*100)}% loot).${bits.length?' '+bits.join(' '):''} The frontier will remember this.`);
  this.persist();return true;
 }
 // Paragon reinforcement (Phase 12): max-tier fortifications improve
 // without end. Each level thickens the walls now and hones what shoots.
 reinforce(id){
  const b=this.world.buildings.find(b=>b.id===id);if(!b)return;
  if(b.hp<=0||b.remaining>0)return this.notify('Only finished, standing defenses can be reinforced.');
  if(!paragonEligible(b.type,this.data))return this.notify('Only fortifications take reinforcement — walls, gates, towers, traps, watchfires.');
  if(b.level<this.data.buildings[b.type].tiers.length)return this.notify('Raise it to its highest tier first — reinforcement crowns finished work.');
  const level=Math.max(0,b.paragon||0),cost=paragonCost(b.type,level,this.world,this.data);
  if(!pay(this.world.resources,cost))return this.notify(`Reinforcement ${level+1} needs ${Object.entries(cost).map(([k,v])=>`${v} ${k}`).join(' + ')}.`);
  const before=buildingMaxHp(b,this.data);
  b.paragon=level+1;
  b.hp=Math.min(buildingMaxHp(b,this.data),b.hp+(buildingMaxHp(b,this.data)-before));
  sfx.upgrade();
  this.notify(`🛡 ${this.data.buildings[b.type].name} reinforced to paragon ${b.paragon}! +${Math.round((this.data.endgame?.paragon?.hpPerLevel||0.12)*100)}% walls, +${Math.round((this.data.endgame?.paragon?.damagePerLevel||0.1)*100)}% shot — without end.`);
  this.persist();return true;
 }
 // War Chest (Phase 6): stock before the horn. Nothing burns unopened —
 // the chest is spent when a raid ends, win or lose, so easy raids cost
 // nothing and crown waves are worth the stores. Combat multipliers only.
 prepareWarChest(id){
  if(this.state.mission)return this.notify('The war chest waits at home.');
  const inv=warChestById(this.data,id);
  if(!inv)return this.notify('That is not a war-chest line.');
  if((this.state.vlevel||1)<warChestMinLevel(this.data))return this.notify(`The war chest opens at village level ${warChestMinLevel(this.data)}.`);
  const level=warChestLevel(this.world,id),max=warChestMax(inv);
  if(level>=max)return this.notify(`${inv.name} is fully stocked.`);
  const cost=inv.cost||{};
  if(!pay(this.world.resources,cost))return this.notify(`Stocking ${inv.name} needs ${Object.entries(cost).map(([k,v])=>`${v} ${k}`).join(' + ')}.`);
  this.world.warChest=this.world.warChest||{};this.world.warChest[id]=level+1;
  sfx.upgrade();
  this.notify(`${inv.icon||'📦'} ${inv.name} stocked ${level+1}/${max}. Open the chest when the horn sounds — it burns when the raid ends.`);
  this.persist();return true;
 }
 openWarChest(){
  if(this.state.mission)return this.notify('The war chest waits at home.');
  if(warChestArmed(this.world))return this.notify('The chest is already open.');
  if(!warChestOpenable(this.world,this.data))return this.notify('The chest is empty — stock it before the horn.');
  if(!this.world.raidPending&&!this.world.enemies.length)return this.notify('The chest opens when raiders are on the road.');
  this.world.warChestArmed=true;
  sfx.horn();
  this.notify(`🛡 The War Chest is open — ${warChestTotal(this.world,this.data)} stores go to the walls for this raid.`);
  this.persist();return true;
 }
 // Festivals (Phase 6): pay once, the whole town celebrates — timed auras,
 // growth and training warmth, and Founder's glory in village XP.
 holdFestival(id){
  const r=beginFestival(this.state,this.data,id);
  if(!r.ok)return this.notify(r.error);
  if(r.xp>0)gainXp(this.state,r.xp);
  const hall=this.world.buildings.find(b=>b.type==='hall'&&b.hp>0),at=hall?center(hall,this.data):{x:10,y:8};
  this.world.effects.push({x:at.x,y:at.y,tx:at.x,ty:at.y,kind:'fanfare',life:1});
  sfx.win();
  const secs=Math.max(0,Math.ceil(r.until-(this.world.elapsed||0)));
  this.notify(`🎉 The ${r.festival.name} begins! ${r.festival.text}${r.xp?` +${r.xp} village XP.`:''} It runs ${secs}s; the town rests ${r.festival.cooldown||0}s after.`);
  this.persist();return true;
 }
 // Tribal conquest (Phase 8): scout the frontier, then judge the fallen keep.
 scoutTribe(tribeId = 'ironshield'){
  const reason=scoutReason(this.state,this.data,tribeId);
  if(reason)return this.notify(reason);
  const r=beginScout(this.state,this.data,tribeId);
  if(r.ok){sfx.unlock();this.notify(`🔭 Scouts slip toward the ${r.tribe.name} line and return with charts — ${r.tribe.intel?.leader||'a shield-lord'} holds the stronghold. Adventure → Home carries the campaign.`);this.persist();}
  return r;
 }
 annex(id,tribeId = 'ironshield'){
  const r=applyAnnex(this.state,this.data,id,tribeId);
  if(!r.ok)return this.notify(r.error);
  sfx.win();
  this.notify(`🏳 ${r.annex.name}. ${r.annex.text||''}`);
  this.persist();return true;
 }
 relocate(id,x,y){const b=this.world.buildings.find(b=>b.id===id);if(!b||this.world.enemies.length||this.world.raidPending)return this.notify('Buildings cannot move during a raid.');if(!inBounds(this.world,this.data,b.type,x,y))return this.notify('That land is still wild. Earn village XP to open new rows.');if(!canPlace(this.world,this.data,b.type,x,y,b.id))return this.notify('Too close — roomy buildings need a one-tile gap.');b.x=x;b.y=y;this.notify('Building moved.');return true;}
 // Frontier claims (Phase 2b, Skylines-style): buy one whole unclaimed
 // region beside claimed land. Cost comes from data/expansion.json regions —
 // generic by coordinate, never per-region conditionals. Legacy maps
 // without regions keep the single-tile path.
 expandClaim(x,y){
  if(this.paused)return this.notify('Resume the village to claim land.'),false;
  if(this.state.mission)return this.notify('Expeditions hold no land — claim at home.'),false;
  const check=claimCheck(this.world,this.data.expansion,this.data.world,x,y);
  if(!check.ok){
   if(check.reason==='tribe')return this.notify(`Defeat the ${tribeOf(this.data,check.tribe)?.name||check.tribe} before claiming this land. Their stronghold still stands.`),false;
   if(check.reason==='claimed')return this.notify('That land is already claimed.'),false;
   if(check.reason==='adjacent')return this.notify('Claims must border your claimed land — push out from the edge.'),false;
   return this.notify('That land lies beyond the frontier.'),false;
  }
  const cost=check.cost||{};
  if(!pay(this.world.resources,cost))return this.notify(`Claiming needs ${Object.entries(cost).map(([k,v])=>`${v} ${k}`).join(' + ')}. Gather more first.`),false;
  setClaimed(this.world,x,y,true);
  this.world.effects.push({x:x+.5,y:y+.5,tx:x+.5,ty:y+.5,kind:'fanfare',life:.8});
  if(check.region){
   const region=regionFor(this.data.expansion,x,y);
   claimRegion(this.world,region);
   this.notify(`Claimed ${region?.name||'the region'} for the village — build on it.`);
   return true;
  }
  this.notify(`Claimed (${x}, ${y}) for the village — build on it.`);
  return true;
 }
 assignDefense(unitId,buildingId){
  if(this.state.mission||this.paused)return false;
  const u=this.world.troops.find(t=>t.id===unitId);
  if(buildingId==='auto'){if(!assignDefensePost(this.world,this.data,u,null,false))return false;u.order=null;this.persist();return true;}
  if(!u||!assignDefensePost(this.world,this.data,u,buildingId||null,true))return this.notify('No suitable defense opening.'),false;
  u.order=null;this.persist();this.notify(buildingId?'Defense post assigned.':'Fighter held in reserve.');return true;
  }
  setRally(id){
   if(this.state.mission||this.paused)return false;
   if(!setRallyPreset(this.world,id))return false;
   this.persist();this.notify(`Rally preset: ${id}.`);return true;
  }
 setSteward(key,value){
  if(this.state.mission||this.paused||!['enabled','protectMeals','protectRepairs','autoEquip','queueEnabled'].includes(key))return false;
  this.world.steward??={enabled:false,main:null,secondary:[],protectMeals:true,protectRepairs:true};
  this.world.steward[key]=!!value;refreshSteward(this);this.persist();return true;
 }
 setProductionTarget(resource,amount){
  if(this.state.mission||this.paused||!Object.hasOwn(this.world.resources,resource)||!Number.isFinite(Number(amount)))return false;
  this.world.steward??={enabled:false,main:null,secondary:[],protectMeals:true,protectRepairs:true};
  this.world.steward.productionTargets??={};this.world.steward.productionTargets[resource]=Math.max(0,Math.min(100000,Math.floor(Number(amount))));
  refreshSteward(this);this.persist();return true;
 }
 setEquipmentPin(unitId,slot,pinned){
  if(this.state.mission||this.paused||!['main','armor'].includes(slot))return false;
  const u=this.world.troops.find(t=>t.id===unitId);if(!u)return false;
  u[slot==='armor'?'manualArmor':'manualGear']=!!pinned;this.persist();return true;
 }
 enqueueConstruction(input){return this._stewardAction(enqueueConstruction,input);}
 removeConstruction(id){return this._stewardAction(removeConstruction,id);}
 moveConstruction(id,direction){return this._stewardAction(moveConstruction,id,direction);}
 createDistrict(input){return this._stewardAction(createDistrict,input);}
 updateDistrict(id,patch){return this._stewardAction(updateDistrict,id,patch);}
 removeDistrict(id){return this._stewardAction(removeDistrict,id);}
 captureBlueprint(name,buildingIds){return this._stewardAction(captureBlueprint,name,buildingIds);}
 previewBlueprint(id,x,y){return blueprintQuote(this,id,x,y);}
 applyBlueprint(id,x,y){return this._stewardAction(applyBlueprint,id,x,y);}
 removeBlueprint(id){return this._stewardAction(removeBlueprint,id);}
 _stewardAction(action,...args){
  if(this.state.mission||this.paused)return {ok:false,error:'Resume the home village to change its plans.'};
  const result=action(this,...args);if(!result.ok){if(result.error)this.notify(result.error);return result;}
  refreshSteward(this);this.persist();return result;
 }
 setStewardGoal(slot,goal){
  if(this.state.mission||this.paused)return false;
  const result=setGoal(this,slot,goal);if(!result.ok){this.notify(result.error);return false;}
  refreshSteward(this);this.persist();return true;
 }
 clearStewardGoal(slot){
  if(this.state.mission||this.paused||!clearGoal(this,slot).ok)return false;
  refreshSteward(this);this.persist();return true;
 }
 setAutomation(key,value){
  if(this.state.mission||this.paused)return false;
  const cfg=automationSettings(this.world);
  if(key==='autoUpgrade')cfg.autoUpgrade=!!value;
  else if(key==='stockTarget'&&Number.isFinite(Number(value)))cfg.stockTarget=Math.max(0,Math.min(5,Math.floor(Number(value))));
  else return false;
  this.persist();return true;
 }
 setAutomationReserve(resource,amount){
  if(this.state.mission||this.paused||!Object.hasOwn(this.world.resources,resource)||!Number.isFinite(Number(amount)))return false;
  automationSettings(this.world).reserves[resource]=Math.max(0,Math.min(1e9,Math.floor(Number(amount))));this.persist();return true;
 }
 setAutomationType(type,value){
  const spec=this.data.buildings[type];if(this.state.mission||this.paused||!spec||spec.tiers.length<2)return false;
  const enabled=!!value;automationSettings(this.world).autoUpgradeTypes[type]=enabled;
  for(const b of this.world.buildings)if(b.type===type)b.autoUpgrade=enabled;
  this.persist();return true;
 }
 configureBuilding(id,key,value){
  const b=this.world.buildings.find(b=>b.id===id);if(this.state.mission||this.paused||!b)return false;
  if(key==='autoCraft'||key==='autoUpgrade')b[key]=!!value;
  else if(key==='autoUpgradeMaxTier'&&Number.isFinite(Number(value)))b[key]=Math.max(1,Math.min(this.data.buildings[b.type].tiers.length,Math.floor(Number(value))));
  else return false;
  this.persist();return true;
 }
 assign(unitId,buildingId){
  const u=this.world.troops.find(t=>t.id===unitId);if(!u)return this.notify('That villager is gone.');
  ensureIdentity(u,this.data,this.world.troops);
  // Phase 7 manual override: a hand-placed villager is never moved by
  // auto-assignment again. Releasing them to look for work clears the lock.
  if(!buildingId){u.workplace=null;u.order=null;u.manualPost=false;this.notify(`${u.name||this.data.troops[u.type].name} is jobless and looking for an open job.`);return true;}
  const b=this.world.buildings.find(b=>b.id===buildingId);
  if(!b||!assignmentValid(this.world,this.data,u,b))return this.notify('That worker does not belong there — match each profession to its own workplace.');
  u.workplace=buildingId;u.order=null;u.manualPost=true;
  const job=this.data.troops[u.type].job;
  this.notify(`${this.data.troops[u.type].name} assigned to the ${this.data.buildings[b.type].name}. ${job?.text||''}`);
  return true;
 }
 recruit(type,workplaceId=null){
  if(!this.data.troops[type])return this.notify('Unknown calling.');
  if(this.locked(type))return this.notify('That calling is not yet earned — quests and campaign chapters unlock new people.');
  if(!this.world.buildings.some(b=>b.type==='barracks'&&b.hp>0&&b.remaining<=0))return this.notify('Build a barracks first.');
  const mission=this.data.missions.find(m=>m.id===this.state.mission?.id),limit=mission?mission.troopLimit||16:Math.max(16,housing(this.world,this.data).beds+renownTroopBonus(this.world,this.data));
  if(this.world.troops.length>=limit)return this.notify(`Your troop limit is ${limit}${mission?'':' — build homes to raise it'}.`);
  const unit=makeUnit(type,this.data,this.world.troops.length%5);
  // Phase 7: every hire arrives named and tempered, and finds the post
  // that suits them best (trait affinity, then nearest) — not just the
  // nearest door. An explicit hire keeps the player's choice as a manual
  // lock; an automatic hire stays free for later auto-assignment.
  ensureIdentity(unit,this.data,this.world.troops);
  const preferred=workplaceId?this.world.buildings.find(b=>b.id===workplaceId):null;
  if(workplaceId&&(!preferred||!assignmentValid(this.world,this.data,unit,preferred)))return this.notify('This workplace is full, unfinished, or unavailable. No resources spent.');
  const workplace=preferred||this.world.buildings.filter(b=>assignmentValid(this.world,this.data,unit,b)).sort((a,b)=>scorePost(unit,b,this.data,this.world)-scorePost(unit,a,this.data,this.world)||Math.hypot(a.x-unit.x,a.y-unit.y)-Math.hypot(b.x-unit.x,b.y-unit.y))[0];
  if(!pay(this.world.resources,this.data.troops[type].recruitCost))return this.notify('Not enough food or gold.');
  if(workplace){unit.workplace=workplace.id;unit.manualPost=!!workplaceId;}
  this.world.troops.push(unit);sfx.upgrade();this.notify(`${this.data.troops[type].name} hired${workplace?` and assigned to ${this.data.buildings[workplace.type].name}`:'. No matching job is open yet'}.`);return unit;
 }
 // Phase 7: one tap posts every idle hand where its traits shine. Manual
 // locks are never moved — the player always has the last word.
 autoAssignIdle(){
  const placed=autoAssignJobs(this.world,this.data,{onlyIdle:true});
  const stuck=idleWithoutPosts(this.world,this.data);
  if(placed&&!stuck.length)this.notify(`${placed} jobless worker${placed>1?'s':''} found ${placed>1?'their posts':'a post'} — traits matched, locks respected.`);
  else if(placed)this.notify(`${placed} posted — traits matched, locks respected. ${stuck.length} still looking for an open job matching their profession.`);
  else if(stuck.length){const needs=[...new Set(stuck.map(u=>this.data.buildings[this.data.troops[u.type]?.job?.workplace]?.name||this.data.troops[u.type]?.job?.workplace).filter(Boolean))];this.notify(`${stuck.length} jobless worker${stuck.length>1?'s':''}, but no finished post fits ${stuck.length>1?'their trades':'their trade'}${needs.length?` — a finished ${needs.join(' or ')} would put them to work`:''}.`);}
  else this.notify('No jobless workers are waiting. Workers are assigned or busy with orders.');
  return placed;
 }
 toggleAutoTrain(){
  if(this.state.mission)return;
  this.world.autoTrain=!this.world.autoTrain;this.autoTrainTimer=0;this.dirty=true;this.persist();
 }
 tickAutoTrain(dt){
  if(this.paused||this.state.mission)return;
  if(!this.world.autoTrain){this.autoTrainTimer=0;return;}
  this.autoTrainTimer=(this.autoTrainTimer||0)+dt;
  while(this.autoTrainTimer>=5-1e-9){
   this.autoTrainTimer=Math.max(0,this.autoTrainTimer-5);
   for(const u of this.world.troops){
    if(u.level<this.data.troops[u.type].maxLevel)this.level(u.id,{silent:true,automatic:true});
   }
  }
 }
 level(id,{silent=false,automatic=false}={}){const u=this.world.troops.find(t=>t.id===id);if(!u||u.level>=this.data.troops[u.type].maxLevel)return;const curve=u.level>=5?1.5:1;
  // Tam's tutoring (Act VII): hands posted at a teaching workplace train
  // cheaper — data `tutorDiscount` on the building spec, generic.
  let tutor=0;const post=u.workplace&&this.world.buildings.find(b=>b.id===u.workplace);
  if(post&&post.hp>0&&post.remaining<=0)tutor=this.data.buildings[post.type]?.tutorDiscount||0;
  const cost=Object.fromEntries(Object.entries(this.data.troops[u.type].levelCost).map(([k,v])=>[k,Math.ceil(v*u.level*curve*(1-tutor))]));if(automatic&&this.world.steward?.enabled&&!canSpend(this,cost,{purpose:'training'}))return;if(!pay(this.world.resources,cost)){if(!silent)this.notify('Not enough food or gold to train.');return;}u.level++;u.hp=stats(u,this.data).hp;this.dirty=true;if(!silent)this.notify(`Level ${u.level} reached${u.level%5===0?' — new ability unlocked!':'.'}`);}
 promote(id,targetType){
  const u=this.world.troops.find(t=>t.id===id);if(!u)return this.notify('That villager is gone.');
  const opts=promotionOptions(this.world,this.data,u);
  if(!opts.some(o=>o.type===targetType))return this.notify('The school is not ready for that graduation — cap the apprentice, post them true, and raise the Schoolroom to tier 2.');
  if(this.locked(targetType))return this.notify('That calling is not yet earned — quests and campaign chapters unlock new people.');
  const spec=this.data.troops[targetType];
  u.type=targetType;u.level=5;u.promoted=true;u.workplace=null;
  // Graduation keeps the old tool only when the new calling can hold it —
  // otherwise the school issues the calling's own gear, kit kept always.
  if(!this.data.items[u.gear]?.roles?.includes(targetType)){u.gear=spec.defaultGear;if(!u.owned.includes(u.gear))u.owned.push(u.gear);}
  u.hp=stats(u,this.data).hp;
  this.notify(`${spec.name} graduated with the master's touch — level 5, kit kept, aura keener. Tam chalked the name himself.`);return true;
 }
 prestige(id){
  const u=this.world.troops.find(t=>t.id===id);if(!u)return this.notify('That villager is gone.');
  const spec=this.data.troops[u.type];
  if(u.level<(spec.maxLevel||25))return this.notify('Only a capped veteran may be rung back — train them to the top first.');
  if((u.prestigeStars||0)>=3)return this.notify('Three stars is the sky itself. Even the bell cannot ring further.');
  if(!this.world.buildings.some(b=>b.hp>0&&b.remaining<=0&&this.data.buildings[b.type]?.prestigeAura))return this.notify('Raise the Bell Tower first — prestige needs a bell that remembers.');
  u.prestigeStars=(u.prestigeStars||0)+1;u.level=1;u.oath=false;u.hp=stats(u,this.data).hp;
  this.notify(`${'★'.repeat(u.prestigeStars)} ${spec.name} rung back to a recruit with honors kept — gear kept, kit kept, +${u.prestigeStars*5}% all stats. Old Bell chalked the name herself.`);return true;
 }
 takeOath(id){
  const u=this.world.troops.find(t=>t.id===id);if(!u)return this.notify('That villager is gone.');
  if(!this.data.troops[u.type]?.oathbound)return this.notify('Only a Warden may swear the Last Watch — the oath was written for their line.');
  if(u.level<20)return this.notify('The oath needs a tempered Warden — level 20 at least. The young may not swear away their mornings.');
  if(u.oath)return this.notify('That Warden already walks the Last Watch.');
  u.oath=true;
  this.notify('The Last Watch is sworn: +50% damage and armor, and if they fall, they fall forever. Sorrel chalked the name — the cairns will keep it.');return true;
 }
 reforge(unitId){
  const u=this.world.troops.find(t=>t.id===unitId);if(!u)return this.notify('That villager is gone.');
  const nextId='starforged-'+u.gear;
  const next=this.data.items[nextId];
  if(!next)return this.notify('That tool has no starforged line — only proven war-steel may be reforged.');
  if(this.locked(nextId))return this.notify('The starforged line is not yet earned — ring the bell first.');
  if((u.owned||[]).includes(nextId))return this.notify('That steel already sings starlit.');
  if(!pay(this.world.resources,next.cost))return this.notify('Reforging needs plate 5 and gold 500. The star-forge eats dear.');
  u.owned.push(nextId);u.gear=nextId;
  this.notify(`${next.name} fitted — +15% main stat, starlit and true. The Act VI economy finally sings.`);return true;
 }
 // Phase 8 smithy orders: queue a crafted tier piece at its forge —
 // posted smiths do the work, Craftsmen waste nothing (see crafting.js).
 startCraft(buildingId, itemId){
  const res = startCraftOrder(this.world, this.data, buildingId, itemId);
  if (res.error) { this.notify(res.error); return false; }
  this.notify(`${this.data.items[itemId]?.name || itemId} on the anvil — about ${Math.max(1, Math.ceil(res.duration))}s with the crew posted.`);
  return true;
 }
 serviceArmor(){
  const yard=this.world.buildings.find(b=>this.data.buildings[b.type]?.serviceArmor&&b.hp>0&&b.remaining<=0);
  if(!yard)return this.notify('Raise a Shieldwall Yard first — worn plate needs a yard that knows it.');
  if(!pay(this.world.resources,{wood:20}))return this.notify('The yard needs 20 wood for oil and rivets.');
  for(const u of this.world.troops)u.armorWear=0;
  this.notify('The yard rang all day — every worn plate bright again, every strap true.');return true;
 }
 equip(id,itemId,{automatic=false}={}){const u=this.world.troops.find(t=>t.id===id),item=this.data.items[itemId];if(!u||!item||!item.roles.includes(u.type)||this.locked(itemId))return;
  if(automatic&&(this.paused||this.state.mission||!this.world.steward?.enabled||!this.world.steward?.autoEquip||this.world.raidPending||this.world.enemies.some(e=>e.hp>0)||u.hp<=0||u.order||u.expedition||u.emergency||u.shelteredIn||u[item.slot==='armor'?'manualArmor':'manualGear']))return false;
  // Roster-gated steel (Oathkeeper Armor): no oathbound Warden on the
  // rolls, no sale — the armor knows its own. Unit-gated mantle
  // (Regalia): only the named Moonwarden may wear it. Data, never ids.
  if(item.requiresOath&&!this.world.troops.some(t=>t.oath&&t.hp>0))return this.notify('Oathkeeper steel waits on an oathbound Warden in the roster. Swear the Last Watch first.');
  if(item.requiresName&&u.name!==item.requiresName)return this.notify(`Only ${item.requiresName} may wear that — the mantle knows its name.`);
  // Armor-slot pieces (Padded Coat onward, item.slot==='armor') ride a
  // second gear axis with their own owned list; everything else is main-hand.
  // Phase 8 craft-only steel (Ashen Blade onward): forged pieces never
  // sell off the shelf — one comes out of the village stock, queued at
  // the smithy that knows it. Re-fitting owned kit stays free.
  const shopName = item.craft?.building ? (this.data.buildings[item.craft.building]?.name || 'the forge') : 'the forge';
  const takeStock = list => {
    if (list.includes(itemId)) return true;
    if (item.craftOnly || automatic) {
      if ((this.world.stock?.[itemId] || 0) <= 0) return false;
      this.world.stock[itemId]--;
    } else if (!pay(this.world.resources, item.cost)) return false;
    list.push(itemId);
    return true;
  };
  if(item.slot==='armor'){
   u.armorOwned=u.armorOwned||[];
   if(!u.armorOwned.includes(itemId)){if(!takeStock(u.armorOwned))return this.notify(item.craftOnly?`${item.name} must be forged at ${shopName} first — queue it there.`:'Not enough resources for this armor.');}u.armor=itemId;if(!automatic){u.manualArmor=true;this.notify(`${item.name} fitted as armor.`);}return true;
  }
  if(!u.owned.includes(itemId)){if(!takeStock(u.owned))return this.notify(item.craftOnly?`${item.name} must be forged at ${shopName} first — queue it there.`:'Not enough resources for this equipment.');}u.gear=itemId;if(!automatic){u.manualGear=true;this.notify(`${item.name} equipped.`);}return true;}
 ability(id,ability){const u=this.world.troops.find(t=>t.id===id);if(u){const def=this.data.abilities[ability];const ok=activateAbility(this.world,this.data,u,ability);this.notify(ok?(def?.effect==='heal'?'Rallying light restores nearby allies.':`${def?.name||'Ability'} unleashed.`):'Ability is not ready.');}}
 commandMove(id,x,y){const u=this.world.troops.find(t=>t.id===id);if(!u||u.hp<=0||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=this.data.world.width||y>=this.data.world.height)return false;if(blocked(this.world,this.data,x,y,true)||!nextStep(this.world,this.data,u,{x:x+.5,y:y+.5},.65,false,true)){this.notify('No clear path. Choose open ground.');return false;}u.order={kind:'move',x:x+.5,y:y+.5};this.notify(`${this.data.troops[u.type].name} moving.`);return true;}
 commandAttack(id,enemyId){const u=this.world.troops.find(t=>t.id===id);if(!u||!enemyId)return false;if(this.data.troops[u.type].role!=='combat')return void this.notify('Only fighters take attack orders.'),false;u.order={kind:'attack',targetId:enemyId};this.notify(`${this.data.troops[u.type].name} attacking!`);return true;}
 commandHold(id){const u=this.world.troops.find(t=>t.id===id);if(!u)return false;u.order={kind:'hold'};this.notify(`${this.data.troops[u.type].name} holding position.`);return true;}
 // Woodland expeditions (Phase 3): any profession with data `expedition`
 // ranges the treeline through the generic handler — never a troop id here.
 sendExpedition(id,planId='standard'){
  const u=this.world.troops.find(t=>t.id===id);if(!u)return false;
  if(this.state.mission)return this.notify('Ranging waits at home — finish the campaign first.'),false;
  const reason=expeditionReason(this.world,this.data,u);if(reason)return this.notify(reason),false;
  const quote=expeditionQuote(this.world,this.data,u,planId);
  if(startExpedition(this.world,this.data,u,Math.random,planId)){this.notify(`${u.name||this.data.troops[u.type].name} departed: ${quote.name}.`);return true;}
  return this.notify('They cannot range right now.'),false;
 }
 recallRanger(id){
  if(this.state.mission)return this.notify('Return home before recalling woodland rangers.'),false;
  const u=this.world.troops.find(t=>t.id===id);
  if(!recallExpedition(this.world,this.data,u))return false;
  this.notify(`${u.name||this.data.troops[u.type].name} recalled — completed gathering comes home; unfinished finds stay behind.`);return true;
 }
 clearOrder(id){const u=this.world.troops.find(t=>t.id===id);if(!u)return false;u.order=null;this.notify(`${this.data.troops[u.type].name} resuming duties.`);return true;}
 raid(count){if(this.state.mission)return this.notify('Campaign raids follow the mission timeline.');if(this.world.enemies.length||this.world.raidPending)return this.notify('A raid is already underway.');if(!this.world.buildings.some(b=>b.type==='hall'&&b.hp>0))return this.notify('Repair the manor before another raid.');
  const party=count??(this.world.wave===0?3:4+this.world.wave);this.world.raidPending={timer:3,count:party};this.world.raidKills=0;this.world.raidLoot=0;this.world.raidResult=null;sfx.horn();this.notify(`Scouts report ${party} raiders from ${raidSides(this.world.wave+1,party).join(" / ")} — 3 seconds to positions!`);return true;}
 mission(id){const m=this.data.missions.find(m=>m.id===id);const reason=missionLockReason(m,this.state.completed||[],this.state.world,this.data);if(reason)return this.notify(reason);
  // Tribal conquest (Phase 8): the stronghold asks the muster to be ready,
  // and the Campaign War Chest is paid only when the march actually starts.
  if(m?.conquest==='assault'){const short=assaultReason(this.state,this.data,m.tribe);if(short)return this.notify(short);}
  const muster=m?.launchCost&&Object.keys(m.launchCost).length?m.launchCost:null,home=this.world;
  if(muster&&home.raidPending)return this.notify('Finish the current raid before another expedition.');
  if(muster&&!home.buildings.some(b=>b.type==='hall'&&b.hp>0))return this.notify('Repair the manor before another expedition.');
  if(muster&&!afford(home.resources,muster))return this.notify(`The campaign needs ${Object.entries(muster).map(([k,v])=>`${v} ${k}`).join(' + ')} before it marches.`);
  if(startMission(this.state,this.data,id)){if(muster)pay(home.resources,muster);this.notify(`${m?.ceremony?.warning||'Expedition begun.'} Your home village is safely paused.`);}else this.notify('Finish the current raid before another expedition.');}
 returnHome(){const m=this.data.missions.find(m=>m.id===this.state.mission?.id);const result=finishMission(this.state,this.data);if(result?.first)this.notify(`${m?.ceremony?.victory||'Victory!'} Rewards and unlocks delivered to your village.`);else if(result?.won)this.notify('Returned home. First-clear rewards can only be claimed once.');else this.notify(`${m?.ceremony?.defeat||'Expedition lost.'} Your home is safe.`);this.persist();}
 frontierChoice(id){const r=resolveFrontierEvent(this.state,this.data,id);this.notify(r.ok?r.message:r.error);if(r.ok)this.persist();return r;}
 research(id){if(this.paused)return false;const reason=researchReason(this.state,this.data,id);if(reason){this.notify(reason);return false;}const ok=startResearch(this.state,this.data,id);if(ok){this.notify('Research begun. Your scholars are at work.');this.persist();}return ok;}
 road(seed,tier){if(this.paused||this.state.mission||this.world.raidPending||this.world.enemies.some(e=>e.hp>0))return this.notify('Road crews wait for a peaceful home village.');const r=buildRoad(this.world,this.data,seed,tier);this.notify(r.ok?`${r.count} road sections ${tier===2?'paved':'formalized'}.`:r.error);if(r.ok)this.persist();return r;}
 trade(id,date=new Date()){
  if(this.paused)return this.notify('Resume the village to trade.');
  if(this.state.mission)return this.notify('The traders wait at home — finish the expedition first.');
  if(!marketOpen(this.state))return this.notify('Dust on the Grey Road — no wagons yet. Grow the village to level 2 and the traders will find you.');
  const res=performTrade(this.state,this.data,id,date);
  if(!res.ok)return this.notify(res.error);
  requestCaravan(this.world,this.data);
  if(res.xp)gainXp(this.state,res.xp);
  sfx.collect();
  const left=res.left>0?` (${res.left} left today)`:' (that was the last one today)';
  this.notify(`Deal struck — ${describeDeal(res.deal)}${left}.${res.haggled>0?` The ledger haggled ${res.haggled} off the price.`:''} ${res.deal.flavor}`);
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
 // Living sky (Phase 10): the village clock. Phase and weather derive
 // purely from world.elapsed, so the sky needs no save fields and no
 // migration — old saves simply start reading the sky on their next tick.
 // Transient world.night / world.weather feed combat, economy and the
 // renderer; transitions ring once through the message line, never on load.
 tickClock(){
  const w=this.world,cfg=clockConfig(this.data);
  const phase=phaseAt(w.elapsed,this.data),weather=weatherAt(w.elapsed,this.data);
  w.night=phase.night;w.weather=weather.id;
  // First tick (Phase 10): old saves arrive with no clock flags and a huge
  // elapsed — seed the storm clock now so tick 1 never strikes the roofs.
  if(w.lastPhase===undefined&&w.lastWeather===undefined){w.lastPhase=phase.id;w.lastWeather=weather.id;w.lastStormAt=w.elapsed;return;}
  tickStorm(w,this.data);
  if(w.lastPhase!==phase.id){w.lastPhase=phase.id;const line=cfg.lines[phase.id];if(line)this.notify(line);}
  if(w.lastWeather!==weather.id){w.lastWeather=weather.id;const line=cfg.lines[weather.id];if(line)this.notify(line);}
 }
 harvest(id){
  const b=this.world.buildings.find(b=>b.id===id),spec=b&&this.data.buildings[b.type];
  if(this.paused||!b||b.hp<=0||b.remaining>0)return false;
  if(spec?.refine){const totals={};for(const key of Object.keys(b.outputReserve||{})){const {banked}=bankOutput(this.world,this.data,b,key,Math.floor(outputAmount(b,key)));if(banked>0)totals[key]=banked;}const amount=Object.values(totals).reduce((a,n)=>a+n,0);if(amount){sfx.collect();this.persist();this.notify(`Collected ${Object.entries(totals).map(([k,n])=>`${n} ${resourceInfo(k).label}`).join(', ')}.`);}else this.notify('Workshop goods are waiting for storage room.');return amount||false;}
  if(!spec?.production)return false;
  const amount=Math.floor(b.harvestBonus||0);if(amount<1)return false;
  const {banked,leftover}=depositCentral(this.world,this.data,spec.production,amount);
  const label=resourceInfo(spec.production).label;
  if(banked<=0){this.notify(`${label} storage full — ${amount} waiting here.`);return false;}
  b.harvestBonus-=banked;
  const at=center(b,this.data);this.world.effects.push({x:at.x,y:at.y,tx:at.x,ty:at.y,kind:'float',text:resourceLabel(spec.production,banked),color:resourceInfo(spec.production).color,life:.9});
  sfx.collect();this.notify(`Collected ${banked} ${label}.${leftover>=1?` ${label} storage full — ${Math.floor(b.harvestBonus)} waiting here.`:''}`);return banked;
 }
 // Reuse the storage gate: subtract only what actually banks, even fractional room.
 // Whole-unit reserves remain eligible just as in manual harvest.
 collectAll(){
  if(this.paused)return {};
  const totals={},waiting={};let sites=0;
  for(const b of this.world.buildings){
   const spec=b&&this.data.buildings[b.type];
   if(!b||!spec?.production||b.hp<=0||b.remaining>0)continue;
   const amount=Math.floor(b.harvestBonus||0);if(amount<1)continue;
   const {banked}=depositCentral(this.world,this.data,spec.production,amount);
   if(banked>0){
    b.harvestBonus-=banked;totals[spec.production]=(totals[spec.production]||0)+banked;sites++;
    // Keep batch feedback bounded without skipping any banking or reserve updates.
    if(this.world.effects.length<60){const at=center(b,this.data);this.world.effects.push({x:at.x,y:at.y,tx:at.x,ty:at.y,kind:'float',text:resourceLabel(spec.production,banked),color:resourceInfo(spec.production).color,life:.9});}
   }
   const held=Math.floor(b.harvestBonus||0);
   if(held>=1)waiting[spec.production]=(waiting[spec.production]||0)+held;
  }
  for(const b of this.world.buildings){if(b.hp<=0||b.remaining>0)continue;let collected=false;for(const key of Object.keys(b.outputReserve||{})){const {banked}=bankOutput(this.world,this.data,b,key,Math.floor(outputAmount(b,key)));if(banked>0){totals[key]=(totals[key]||0)+banked;collected=true;}const held=Math.floor(outputAmount(b,key));if(held>=1)waiting[key]=(waiting[key]||0)+held;}if(collected)sites++;}
  const fullNote=Object.entries(waiting).map(([k,v])=>`${resourceInfo(k).label} storage full — ${v} waiting here.`).join(' ');
  if(!sites){this.notify(fullNote||'Nothing ready to collect — production buildings store output on-site as they work.');return totals;}
  sfx.collectBatch();this.persist();
  this.notify(`Collected ${Object.entries(totals).map(([k,v])=>`${v} ${resourceInfo(k).label}`).join(', ')} from ${sites} building${sites>1?'s':''}.${fullNote?` ${fullNote}`:''}`);
  return totals;
 }
 persist(){const ok=save(this.state);if(!ok)this.notify('Browser storage is unavailable. Progress cannot be saved here.');return ok;}
 // Async multiplayer (visits + helping): all local-first. Cloud sync is
 // best-effort and never blocks play — without Supabase configured the
 // village simply keeps its friendships on this browser.
 mp(){return ensureMultiplayer(this.state);}
 setUsername(name){const v=validateUsername(name);if(!v.ok){this.notify(v.error);return v;}const mp=this.mp();const first=!mp.username;mp.username=v.name;if(!mp.friendCode)mp.friendCode=randomCode();pushActivity(mp,first?`${v.name} raised their banner — welcome to the roads.`:`Now known as ${v.name}.`);this.persist();this.notify(first?`Welcome, ${v.name}. Your friend code is ${mp.friendCode} — share it, never your email.`:`Village renamed to ${v.name}.`);return {ok:true,name:v.name};}
 addFriend(username,code){const r=addFriend(this.mp(),username,code);this.notify(r.ok?`${r.name} joined your travels.` :r.error);if(r.ok)this.persist();return r;}
 dropFriend(username){const r=removeFriend(this.mp(),username);if(r.ok){pushActivity(this.mp(),`Parted ways with ${username}.`);this.persist();this.notify(`Parted ways with ${username}.`);}return r;}
 sendGift(friendName,resource,amount){const mp=this.mp();const reason=giftReason(mp,this.world,friendName,resource,amount);if(reason){this.notify(reason);return {ok:false,error:reason};}const n=Math.floor(Number(amount));this.world.resources[resource]-=n;const gift=makeGift(mp,mp.username||'A neighbor',friendName,resource,n);mp.outbox.push(gift);pushActivity(mp,`Sent +${n} ${resource} to ${friendName}.`);this.persist();this.notify(`Packed +${n} ${resource} for ${friendName}. Safe travels.`);return {ok:true,gift};}
 sendHelp(friendName,buildingId){const mp=this.mp();const reason=speedupReason(mp,this.world,friendName,buildingId);if(reason){this.notify(reason);return {ok:false,error:reason};}const help=makeSpeedup(mp,mp.username||'A neighbor',friendName,buildingId);mp.outbox.push(help);pushActivity(mp,`Lent hands to ${friendName} (−${help.seconds}s on a build).`);this.persist();this.notify(`Your crew's echo travels to ${friendName} — a build finishes sooner.`);return {ok:true,help};}
 // Apply queued help waiting in the inbox (runs at boot and after sync).
 // Gifts pour into storage, speedups shorten rising scaffolds.
 collectHelp(){const landed=applyInbox(this.state,this.data);if(landed.length){this.persist();this.notify(landed.map(l=>l.text).join(' '));}return landed;}
 visitSnapshot(){return publicSnapshot(this.state);}
 // Best-effort cloud push: stamps + saves locally first, then tries the
 // shelf. Failures whisper — local play is never interrupted.
 async syncCloud(){stampCloud(this.state);this.persist();let cloud=null;try{cloud=await import('./cloud.js');}catch{return {ok:false,offline:true,local:true};}if(!cloud.configured())return {ok:false,offline:true,local:true};const session=cloud.getSession();if(!session?.user&&!session?.user?.id){return {ok:false,error:'Sign in first — then the village can travel to the cloud.'};}const userId=session.user?.id||session.user_id||session.sub;const snap=publicSnapshot(this.state);const r=await cloud.pushVillage(userId,{username:this.mp().username,friend_code:this.mp().friendCode,save:this.state,public:snap});if(!r.ok&&r.offline)return {ok:false,offline:true,local:true};return r;}
 importState(state){this.state=state;this.autoTrainTimer=0;
 // Imported blobs predate tile grids the same way old saves do — build
 // from settled bounds so imports never gift the wilderness.
 // Region center is ensured on top; migration only adds claims.
 try{
  for(const w of [this.state.world,this.state.home]){
   if(!w)continue;
   if(typeof w.autoTrain!=='boolean')w.autoTrain=false;
   if(!Array.isArray(w.tiles)||!w.tiles.length)w.tiles=buildTiles(this.data.world,w.bounds);
   else claimRect(w,w.bounds?.w||this.data.world.width,w.bounds?.h||this.data.world.height);
   try{claimPreclaimed(w,this.data.expansion);}catch{}
  }
 }catch{}
 this.paused=false;this.saveTimer=0;this.dirty=true;this.notify('Save restored. Welcome back to the village.');}
 tick(dt){if(this.paused||this.state.mission?.status&&this.state.mission.status!=='active')return;
  this.tickAutoTrain(dt);
  this.checkCalendar();
  const cfg=raidConfig(this.data);
  if(!this.state.mission)ensureDirector(this.world,this.data);
  if(!this.state.mission&&!this.world.enemies.length&&!this.world.raidPending){
   if(!Number.isFinite(this.world.nextRaidAt))this.world.nextRaidAt=this.world.elapsed+cfg.interval;
   // Scheduled horns: the frontier comes calling on its own. Gentle first
   // raid (a scouting pair) so new villages get five quiet minutes; the
   // test button still works for the impatient. Never during a mission.
   if(this.world.elapsed>=this.world.nextRaidAt&&this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)){
    let count=directorParty(this.state,this.data);
    cfg.warning=directorConfig(this.data).warning;
    const scout=Math.min(15,this.world.scoutBonus||0);this.world.scoutBonus=0;
    // Crowns of the late war (Phase 12): boss waves are telegraphed — a
    // longer warning and a named herald on the notice line, never a
    // surprise. The pin for the Chronicle goes up at muster, not at victory.
    let boss=null;
    try{boss=bossFor(this.data,this.state.vlevel||1,this.world.wave+1);}catch{}
    const patrol=boss?null:directorPatrol(this.state,this.data);
    if(patrol)count=Math.max(2,Math.min(4,count));
    const warning=cfg.warning+scout+(boss?(this.data.endgame?.bossRule?.warningBonus||20):0);
    this.world.raidPending={timer:warning,count,scheduled:true,boss:boss?.id||null};this.world.raidKills=0;this.world.raidLoot=0;this.world.raidResult=null;sfx.horn();sfx.warning();
    if(patrol)this.world.raidPending.patrol=patrol.tribe;
    if(boss){
     this.world.lastBoss={id:boss.id,name:boss.name,title:boss.title,wave:this.world.wave+1,won:null,elapsed:this.world.elapsed};
     this.notify(fillLine(boss.herald,{count,seconds:Math.ceil(warning),wave:this.world.wave+1}));
    }
    else if(patrol)this.notify(`Scouts report ${count} ${patrol.name} patrol fighters from ${patrol.region} — ${Math.ceil(warning)} seconds to positions!`);
    else this.notify(fillLine(pickLine(cfg.warningLines,this.world.wave),{count,seconds:Math.ceil(warning),wave:this.world.wave+1})+(scout>0?` Ranger word bought us +${scout}s.`:''));
   }
  }
  if(this.world.raidPending&&!this.state.mission){this.world.raidPending.timer-=dt;
   if(this.world.raidPending.timer<=0){const {count,scheduled,boss:bossId,patrol:patrolId}=this.world.raidPending;this.world.raidPending=null;
    const patrol=patrolId?territoryPatrol(this.world,this.data,patrolId,this.state.vlevel||1):null;
    // A saved warning cannot revive pressure from a defeated tribe.
    if(patrolId&&!patrol){this.world.nextRaidAt=this.world.elapsed+directorConfig(this.data).minQuiet;this.notify('The frontier patrol has withdrawn.');}
    else {
    let egOpts=null;
    try{egOpts=endgameSpawnOpts(this.state,this.data);}catch{}
    const faction=patrol?.faction||factionFor(this.data,this.world.wave+1,this.state.vlevel||1);
    spawnRaid(this.world,count,null,this.data,faction,patrol?{strictExclusion:true}:egOpts);
    let boss=null;
    if(bossId){try{
     boss=(this.data.endgame?.bosses||[]).find(b=>b.id===bossId)||null;
     if(boss)spawnBoss(this.world,this.data,boss,this.world.wave);
    }catch{}}
    if(boss)this.notify(fillLine(boss.attack,{count,wave:this.world.wave}));
    else if(patrol)this.notify(`${patrol.name} patrol from ${patrol.region} — defend the manor!`);
    else this.notify(scheduled?fillLine(pickLine(cfg.attackLines,this.world.wave),{count,wave:this.world.wave}):`Wave ${this.world.wave} — ${count} raiders! Defend the manor!`);}}}
  const raided=!this.state.mission&&(this.world.enemies.length>0||this.world.raidPending);
  // Phase 7 identity backfill: old saves and mission rosters gain names,
  // traits and job ledgers lazily — additive defaults, never a wipe.
  for(const w of [this.world,this.state.home]){if(!w)continue;for(const u of w.troops||[])ensureIdentity(u,this.data,w.troops);}
  this.world.elapsed+=dt;tickTrails(this.world);this.tickClock();if(!this.state.mission){tickTownMeal(this.world,this.data,m=>this.notify(m));tickTownSupply(this.world,this.data,m=>this.notify(m));}if(!this.state.mission)tickFrontierEvents(this.state,this.data,m=>this.notify(m));tickResearch(this.state,this.data,dt,m=>this.notify(m));if(!this.state.mission)tickDefensePosts(this.world,this.data,dt);if(!this.state.mission)tickSteward(this,dt);tickEmergency(this.world,this.data,dt);tickVillagerJobs(this.world,this.data,dt);tickTitles(this.world,this.data,m=>this.notify(m));const filled=autoFillTick(this.world,this.data,dt);if(filled&&(this.world.elapsed-(this.world.lastAutoFillNote||0)>60)){this.world.lastAutoFillNote=this.world.elapsed;this.notify(`${filled} jobless worker${filled>1?'s':''} took ${filled>1?'open posts':'an open post'} on their own — traits matched, locks respected.`);}tickEconomy(this.world,this.data,dt);if(!this.state.mission)tickAutomation(this,dt);if(!this.state.mission)tickLogistics(this.world,this.data,dt);tickRefine(this.world,this.data,dt,!this.state.mission,!this.state.mission&&this.world.steward?.enabled?(refinePolicy(this)||((k)=>spendingAvailable(this,k,{purpose:'refine'}))):null);for(const c of tickCraft(this.world,this.data,dt)){const name=this.data.items[c.item]?.name||c.item;this.notify(`${name} finished — fit it from the People panel.`);}tickExpeditions(this.world,this.data,dt,Math.random,{state:this.state,notify:m=>this.notify(m)});tickCombat(this.world,this.data,dt);tickVillage(this.state,this.data,dt,m=>this.notify(m));const before=this.state.mission?.status;tickMission(this.state,this.data);if(this.state.mission?.herald){this.notify(this.state.mission.herald);this.state.mission.herald=null;}
  if(raided&&!this.world.enemies.length&&!this.world.raidPending&&this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)){const recovered=warChestRecovery(this.world,this.data);spendWarChest(this.world);const kills=this.world.raidKills??0,loot=this.world.raidLoot??0;
   const damaged=this.world.buildings.filter(b=>b.hp<buildingMaxHp(b,this.data));
   const repairWood=damaged.reduce((n,b)=>n+Math.ceil((buildingMaxHp(b,this.data)-b.hp)/15),0);
   this.world.raidResult={won:true,kills,loot,damaged:damaged.length,repairWood,defense:defenseRaidSummary(this.world)};sfx.win();
   scheduleRecovery(this.state,this.data,true);
   // Crown settled (Phase 12): a slain boss gets its victory herald and a
   // won pin for the Chronicle; a fled crown is marked withdrawn, never won.
   // The crown line leads the single victory notice — one herald, never two.
   let crownLine='';
   if(this.world.lastBoss&&this.world.lastBoss.won==null&&this.world.lastBoss.wave===this.world.wave){
    const spec=(this.data.endgame?.bosses||[]).find(b=>b.id===this.world.lastBoss.id);
    if(this.world.bossSlain===this.world.lastBoss.id&&!this.world.raidFled){
     this.world.lastBoss.won=true;
     crownLine=fillLine(spec?.victory||`${this.world.lastBoss.name} has fallen! +{loot} gold.`,{kills,loot,wave:this.world.wave})+' ';
    }else if(this.world.raidFled){
     this.world.lastBoss.won=false;
     crownLine=`${this.world.lastBoss.name} withdrew into the dark — the crown endures. It will return. `;
    }
   }
   this.world.bossSlain=null;this.world.raidFled=false;
   this.notify(`${crownLine}${fillLine(pickLine(cfg.victoryLines,this.world.wave),{kills,loot,wave:this.world.wave})}${recovered?` ${recovered} restored by the repair wagons.`:''}${damaged.length?` ${damaged.length} buildings need repair (${repairWood} wood).`:' All buildings stand strong.'}`);this.persist();}
  if(before!==this.state.mission?.status){const m=this.data.missions.find(m=>m.id===this.state.mission.id);this.notify(this.state.mission.status==='won'?`${m?.ceremony?.victory||'Mission complete!'} Return home to claim your rewards.`:`${m?.ceremony?.defeat||'Expedition lost.'} Return home and try a different layout.`);this.persist();}
  if(!this.state.mission&&!this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)&&this.world.enemies.length){const recovered=warChestRecovery(this.world,this.data);spendWarChest(this.world);const kills=this.world.raidKills??0,loot=this.world.raidLoot??0;this.world.enemies=[];this.world.inRaid=false;this.world.raidLosses=0;this.world.resources.wood=Math.max(80,this.world.resources.wood);this.world.raidResult={won:false,kills,loot,damaged:this.world.buildings.filter(b=>b.hp<=0).length,repairWood:0,defense:defenseRaidSummary(this.world)};sfx.lose();scheduleRecovery(this.state,this.data,false);if(this.world.lastBoss&&this.world.lastBoss.won==null)this.world.lastBoss.won=false;this.notify(fillLine(pickLine(cfg.defeatLines,this.world.wave),{kills,loot,wave:this.world.wave})+(recovered?` ${recovered} restored by the repair wagons.`:''));}
  this.saveTimer+=dt;if(this.saveTimer>5){this.saveTimer=0;this.persist();}
 }
}
