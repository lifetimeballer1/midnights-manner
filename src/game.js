import {startResearch,tickResearch,researchReason} from './systems/research.js';
import {tickEmergency} from './systems/emergency.js';
import {factionFor} from './systems/tactics.js';
import {ensureDirector,directorConfig,directorParty,scheduleRecovery} from './systems/raid-director.js';
import {resourceLabel,resourceInfo} from './resources.js';
import {wallRowQuote,wallLine,isWall} from './systems/walls.js';
import {nextStep,blocked} from './systems/pathfinding.js';
import {createWorld,makeBuilding,makeUnit,canPlace,inBounds,pay,afford,stats,buildingCost,center,assignmentValid,promotionOptions,housing} from './model.js';
import {buildTiles} from './systems/biomes.js';
import {claimCheck,setClaimed,claimRect,claimRegion,claimPreclaimed,regionFor} from './systems/expansion.js';
import {tickVillage,gainXp} from './systems/village.js';
import {ensureIdentity, tickVillagerJobs, autoAssign as autoAssignJobs, idleWithoutPosts, scorePost} from './systems/villagers.js';
import {tickEconomy} from './systems/economy.js';
import {tickExpeditions,startExpedition} from './systems/expeditions.js';
import {tickCombat,spawnRaid,activateAbility,raidSides} from './systems/combat.js';
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
   if(!Array.isArray(w.tiles)||!w.tiles.length)w.tiles=buildTiles(this.data.world,w.bounds);
   else claimRect(w,w.bounds?.w||this.data.world.width,w.bounds?.h||this.data.world.height);
   try{claimPreclaimed(w,this.data.expansion);}catch{}
  }
 }catch{}
 this.paused=false;this.message='Welcome home. Build a farm, equip your people, and prepare for the night.';this.dirty=true;this.saveTimer=0;}
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
 repair(id){const b=this.world.buildings.find(b=>b.id===id);if(!b)return;const max=this.data.buildings[b.type].tiers[b.level-1].hp;if(b.hp>=max)return;
  if(!pay(this.world.resources,{wood:Math.ceil((max-b.hp)/15)}))return this.notify('Gather more wood to repair.');b.hp=max;const cp=center(b,this.data);this.world.effects.push({x:cp.x,y:cp.y,tx:cp.x,ty:cp.y,kind:'heal',life:.3});sfx.repair();this.notify('Building repaired.');}
 repairAll(){const damaged=this.world.buildings.filter(b=>{const max=this.data.buildings[b.type].tiers[b.level-1].hp;return b.hp<max;});if(!damaged.length)return this.notify('Nothing needs repair.');
  const cost={wood:damaged.reduce((n,b)=>n+Math.ceil((this.data.buildings[b.type].tiers[b.level-1].hp-b.hp)/15),0)};
  if(!pay(this.world.resources,cost))return this.notify(`Repairs need ${cost.wood} wood. Gather more first.`);
  for(const b of damaged){b.hp=this.data.buildings[b.type].tiers[b.level-1].hp;const cp=center(b,this.data);this.world.effects.push({x:cp.x,y:cp.y,tx:cp.x,ty:cp.y,kind:'heal',life:.3});}
  sfx.repair();this.notify(`All buildings repaired for ${cost.wood} wood.`);}
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
 assign(unitId,buildingId){
  const u=this.world.troops.find(t=>t.id===unitId);if(!u)return this.notify('That villager is gone.');
  ensureIdentity(u,this.data,this.world.troops);
  // Phase 7 manual override: a hand-placed villager is never moved by
  // auto-assignment again. Releasing them back to rest clears the lock.
  if(!buildingId){u.workplace=null;u.order=null;u.manualPost=false;this.notify(`${u.name||this.data.troops[u.type].name} is available for work.`);return true;}
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
  const mission=this.data.missions.find(m=>m.id===this.state.mission?.id),limit=mission?mission.troopLimit||16:Math.max(16,housing(this.world,this.data).beds);
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
  if(placed&&!stuck.length)this.notify(`${placed} idle hand${placed>1?'s':''} found ${placed>1?'their posts':'a post'} — traits matched, locks respected.`);
  else if(placed)this.notify(`${placed} posted — traits matched, locks respected. ${stuck.length} still idle: no open post for their trade yet.`);
  else if(stuck.length){const needs=[...new Set(stuck.map(u=>this.data.buildings[this.data.troops[u.type]?.job?.workplace]?.name||this.data.troops[u.type]?.job?.workplace).filter(Boolean))];this.notify(`${stuck.length} idle hand${stuck.length>1?'s':''}, but no finished post fits ${stuck.length>1?'their trades':'their trade'}${needs.length?` — a finished ${needs.join(' or ')} would put them to work`:''}.`);}
  else this.notify('No idle hands need posts. Every worker is placed or resting by your order.');
  return placed;
 }
 level(id){const u=this.world.troops.find(t=>t.id===id);if(!u||u.level>=this.data.troops[u.type].maxLevel)return;const curve=u.level>=5?1.5:1;
  // Tam's tutoring (Act VII): hands posted at a teaching workplace train
  // cheaper — data `tutorDiscount` on the building spec, generic.
  let tutor=0;const post=u.workplace&&this.world.buildings.find(b=>b.id===u.workplace);
  if(post&&post.hp>0&&post.remaining<=0)tutor=this.data.buildings[post.type]?.tutorDiscount||0;
  const cost=Object.fromEntries(Object.entries(this.data.troops[u.type].levelCost).map(([k,v])=>[k,Math.ceil(v*u.level*curve*(1-tutor))]));if(!pay(this.world.resources,cost))return this.notify('Not enough food or gold to train.');u.level++;u.hp=stats(u,this.data).hp;this.notify(`Level ${u.level} reached${u.level%5===0?' — new ability unlocked!':'.'}`);}
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
 serviceArmor(){
  const yard=this.world.buildings.find(b=>this.data.buildings[b.type]?.serviceArmor&&b.hp>0&&b.remaining<=0);
  if(!yard)return this.notify('Raise a Shieldwall Yard first — worn plate needs a yard that knows it.');
  if(!pay(this.world.resources,{wood:20}))return this.notify('The yard needs 20 wood for oil and rivets.');
  for(const u of this.world.troops)u.armorWear=0;
  this.notify('The yard rang all day — every worn plate bright again, every strap true.');return true;
 }
 equip(id,itemId){const u=this.world.troops.find(t=>t.id===id),item=this.data.items[itemId];if(!u||!item||!item.roles.includes(u.type)||this.locked(itemId))return;
  // Roster-gated steel (Oathkeeper Armor): no oathbound Warden on the
  // rolls, no sale — the armor knows its own. Unit-gated mantle
  // (Regalia): only the named Moonwarden may wear it. Data, never ids.
  if(item.requiresOath&&!this.world.troops.some(t=>t.oath&&t.hp>0))return this.notify('Oathkeeper steel waits on an oathbound Warden in the roster. Swear the Last Watch first.');
  if(item.requiresName&&u.name!==item.requiresName)return this.notify(`Only ${item.requiresName} may wear that — the mantle knows its name.`);
  // Armor-slot pieces (Padded Coat onward, item.slot==='armor') ride a
  // second gear axis with their own owned list; everything else is main-hand.
  if(item.slot==='armor'){
   u.armorOwned=u.armorOwned||[];
   if(!u.armorOwned.includes(itemId)){if(!pay(this.world.resources,item.cost))return this.notify('Not enough resources for this armor.');u.armorOwned.push(itemId);}u.armor=itemId;this.notify(`${item.name} fitted as armor.`);return;
  }
  if(!u.owned.includes(itemId)){if(!pay(this.world.resources,item.cost))return this.notify('Not enough resources for this equipment.');u.owned.push(itemId);}u.gear=itemId;this.notify(`${item.name} equipped.`);}
 ability(id,ability){const u=this.world.troops.find(t=>t.id===id);if(u){const def=this.data.abilities[ability];const ok=activateAbility(this.world,this.data,u,ability);this.notify(ok?(def?.effect==='heal'?'Rallying light restores nearby allies.':`${def?.name||'Ability'} unleashed.`):'Ability is not ready.');}}
 commandMove(id,x,y){const u=this.world.troops.find(t=>t.id===id);if(!u||u.hp<=0||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=this.data.world.width||y>=this.data.world.height)return false;if(blocked(this.world,this.data,x,y,true)||!nextStep(this.world,this.data,u,{x:x+.5,y:y+.5},.65,false,true)){this.notify('No clear path. Choose open ground.');return false;}u.order={kind:'move',x:x+.5,y:y+.5};this.notify(`${this.data.troops[u.type].name} moving.`);return true;}
 commandAttack(id,enemyId){const u=this.world.troops.find(t=>t.id===id);if(!u||!enemyId)return false;if(this.data.troops[u.type].role!=='combat')return void this.notify('Only fighters take attack orders.'),false;u.order={kind:'attack',targetId:enemyId};this.notify(`${this.data.troops[u.type].name} attacking!`);return true;}
 commandHold(id){const u=this.world.troops.find(t=>t.id===id);if(!u)return false;u.order={kind:'hold'};this.notify(`${this.data.troops[u.type].name} holding position.`);return true;}
 // Woodland expeditions (Phase 3): any profession with data `expedition`
 // ranges the treeline through the generic handler — never a troop id here.
 sendExpedition(id){
  const u=this.world.troops.find(t=>t.id===id);if(!u)return false;
  if(u.expedition)return this.notify('They are already ranging — watch the inspector for their return.'),false;
  if(!this.data.troops[u.type]?.expedition)return this.notify('That calling does not range — foragers, woodcutters and wayfinders do.'),false;
  if(startExpedition(this.world,this.data,u)){this.notify(`${this.data.troops[u.type].name} ranging into the treeline.`);return true;}
  return this.notify('They cannot range right now.'),false;
 }
 clearOrder(id){const u=this.world.troops.find(t=>t.id===id);if(!u)return false;u.order=null;this.notify(`${this.data.troops[u.type].name} resuming duties.`);return true;}
 raid(count){if(this.state.mission)return this.notify('Campaign raids follow the mission timeline.');if(this.world.enemies.length||this.world.raidPending)return this.notify('A raid is already underway.');if(!this.world.buildings.some(b=>b.type==='hall'&&b.hp>0))return this.notify('Repair the manor before another raid.');
  const party=count??(this.world.wave===0?3:4+this.world.wave);this.world.raidPending={timer:3,count:party};this.world.raidKills=0;this.world.raidLoot=0;this.world.raidResult=null;sfx.horn();this.notify(`Scouts report ${party} raiders from ${raidSides(this.world.wave+1,party).join(" / ")} — 3 seconds to positions!`);}
 mission(id){const m=this.data.missions.find(m=>m.id===id);if(startMission(this.state,this.data,id))this.notify(`${m?.ceremony?.warning||'Expedition begun.'} Your home village is safely paused.`);else this.notify('Finish the current raid or unlock the previous chapter first.');}
 returnHome(){const m=this.data.missions.find(m=>m.id===this.state.mission?.id);const result=finishMission(this.state,this.data);if(result?.first)this.notify(`${m?.ceremony?.victory||'Victory!'} Rewards and unlocks delivered to your village.`);else if(result?.won)this.notify('Returned home. First-clear rewards can only be claimed once.');else this.notify(`${m?.ceremony?.defeat||'Expedition lost.'} Your home is safe.`);this.persist();}
 research(id){if(this.paused)return false;const reason=researchReason(this.state,this.data,id);if(reason){this.notify(reason);return false;}const ok=startResearch(this.state,this.data,id);if(ok){this.notify('Research begun. Your scholars are at work.');this.persist();}return ok;}
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
 harvest(id){const b=this.world.buildings.find(b=>b.id===id),spec=b&&this.data.buildings[b.type];if(this.paused||!b||!spec.production||b.hp<=0||b.remaining>0)return false;const amount=Math.floor(b.harvestBonus||0);if(amount<1)return false;b.harvestBonus-=amount;this.world.resources[spec.production]=(this.world.resources[spec.production]||0)+amount;this.world.gathered[spec.production]=(this.world.gathered[spec.production]||0)+amount;const at=center(b,this.data);this.world.effects.push({x:at.x,y:at.y,tx:at.x,ty:at.y,kind:'float',text:resourceLabel(spec.production,amount),color:resourceInfo(spec.production).color,life:.9});sfx.collect();this.notify(`Collected ${amount} ${spec.production}.`);return amount;}
 // One tap gathers every finished producer with a whole unit stored on-site.
 // Same guards as harvest; a single summary notice instead of one per site.
 collectAll(){if(this.paused)return {};const totals={};let sites=0;for(const b of this.world.buildings){const spec=b&&this.data.buildings[b.type];if(!b||!spec?.production||b.hp<=0||b.remaining>0)continue;const amount=Math.floor(b.harvestBonus||0);if(amount<1)continue;b.harvestBonus-=amount;this.world.resources[spec.production]=(this.world.resources[spec.production]||0)+amount;this.world.gathered[spec.production]=(this.world.gathered[spec.production]||0)+amount;totals[spec.production]=(totals[spec.production]||0)+amount;sites++;const at=center(b,this.data);this.world.effects.push({x:at.x,y:at.y,tx:at.x,ty:at.y,kind:'float',text:resourceLabel(spec.production,amount),color:resourceInfo(spec.production).color,life:.9});}if(!sites){this.notify('Nothing ready to collect — production buildings store output on-site as they work.');return totals;}sfx.collect();this.persist();this.notify(`Collected ${Object.entries(totals).map(([k,v])=>`${v} ${k}`).join(', ')} from ${sites} building${sites>1?'s':''}.`);return totals;}
 persist(){const ok=save(this.state);if(!ok)this.notify('Browser storage is unavailable. Progress cannot be saved here.');return ok;}
 importState(state){this.state=state;
 // Imported blobs predate tile grids the same way old saves do — build
 // from settled bounds so imports never gift the wilderness.
 // Region center is ensured on top; migration only adds claims.
 try{
  for(const w of [this.state.world,this.state.home]){
   if(!w)continue;
   if(!Array.isArray(w.tiles)||!w.tiles.length)w.tiles=buildTiles(this.data.world,w.bounds);
   else claimRect(w,w.bounds?.w||this.data.world.width,w.bounds?.h||this.data.world.height);
   try{claimPreclaimed(w,this.data.expansion);}catch{}
  }
 }catch{}
 this.paused=false;this.saveTimer=0;this.dirty=true;this.notify('Save restored. Welcome back to the village.');}
 tick(dt){if(this.paused||this.state.mission?.status&&this.state.mission.status!=='active')return;
  this.checkCalendar();
  const cfg=raidConfig(this.data);
  if(!this.state.mission)ensureDirector(this.world,this.data);
  if(!this.state.mission&&!this.world.enemies.length&&!this.world.raidPending){
   if(!Number.isFinite(this.world.nextRaidAt))this.world.nextRaidAt=this.world.elapsed+cfg.interval;
   // Scheduled horns: the frontier comes calling on its own. Gentle first
   // raid (a scouting pair) so new villages get five quiet minutes; the
   // test button still works for the impatient. Never during a mission.
   if(this.world.elapsed>=this.world.nextRaidAt&&this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)){
    const count=directorParty(this.state,this.data);
    cfg.warning=directorConfig(this.data).warning;
    this.world.raidPending={timer:cfg.warning,count,scheduled:true};this.world.raidKills=0;this.world.raidLoot=0;this.world.raidResult=null;sfx.horn();
    this.notify(fillLine(pickLine(cfg.warningLines,this.world.wave),{count,seconds:Math.ceil(cfg.warning),wave:this.world.wave+1}));
   }
  }
  if(this.world.raidPending&&!this.state.mission){this.world.raidPending.timer-=dt;
   if(this.world.raidPending.timer<=0){const {count,scheduled}=this.world.raidPending;this.world.raidPending=null;spawnRaid(this.world,count,null,this.data,factionFor(this.data,this.world.wave+1));
    this.notify(scheduled?fillLine(pickLine(cfg.attackLines,this.world.wave),{count,wave:this.world.wave}):`Wave ${this.world.wave} — ${count} raiders! Defend the manor!`);}}
  const raided=!this.state.mission&&(this.world.enemies.length>0||this.world.raidPending);
  // Phase 7 identity backfill: old saves and mission rosters gain names,
  // traits and job ledgers lazily — additive defaults, never a wipe.
  for(const w of [this.world,this.state.home]){if(!w)continue;for(const u of w.troops||[])ensureIdentity(u,this.data,w.troops);}
  this.world.elapsed+=dt;tickResearch(this.state,this.data,dt,m=>this.notify(m));tickEmergency(this.world,this.data,dt);tickVillagerJobs(this.world,this.data,dt);tickEconomy(this.world,this.data,dt);tickExpeditions(this.world,this.data,dt);tickCombat(this.world,this.data,dt);tickVillage(this.state,this.data,dt,m=>this.notify(m));const before=this.state.mission?.status;tickMission(this.state,this.data);
  if(raided&&!this.world.enemies.length&&!this.world.raidPending&&this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)){const kills=this.world.raidKills??0,loot=this.world.raidLoot??0;
   const damaged=this.world.buildings.filter(b=>b.hp<this.data.buildings[b.type].tiers[b.level-1].hp);
   const repairWood=damaged.reduce((n,b)=>n+Math.ceil((this.data.buildings[b.type].tiers[b.level-1].hp-b.hp)/15),0);
   this.world.raidResult={won:true,kills,loot,damaged:damaged.length,repairWood};sfx.win();
   scheduleRecovery(this.state,this.data,true);
   this.notify(`${fillLine(pickLine(cfg.victoryLines,this.world.wave),{kills,loot,wave:this.world.wave})}${damaged.length?` ${damaged.length} buildings need repair (${repairWood} wood).`:' All buildings stand strong.'}`);this.persist();}
  if(before!==this.state.mission?.status){const m=this.data.missions.find(m=>m.id===this.state.mission.id);this.notify(this.state.mission.status==='won'?`${m?.ceremony?.victory||'Mission complete!'} Return home to claim your rewards.`:`${m?.ceremony?.defeat||'Expedition lost.'} Return home and try a different layout.`);this.persist();}
  if(!this.state.mission&&!this.world.buildings.some(b=>b.type==='hall'&&b.hp>0)&&this.world.enemies.length){const kills=this.world.raidKills??0,loot=this.world.raidLoot??0;this.world.enemies=[];this.world.inRaid=false;this.world.raidLosses=0;this.world.resources.wood=Math.max(80,this.world.resources.wood);this.world.raidResult={won:false,kills,loot,damaged:this.world.buildings.filter(b=>b.hp<=0).length,repairWood:0};sfx.lose();scheduleRecovery(this.state,this.data,false);this.notify(fillLine(pickLine(cfg.defeatLines,this.world.wave),{kills,loot,wave:this.world.wave}));}
  this.saveTimer+=dt;if(this.saveTimer>5){this.saveTimer=0;this.persist();}
 }
}
