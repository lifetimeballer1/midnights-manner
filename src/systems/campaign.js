import {createWorld} from '../model.js';
import {spawnRaid} from './combat.js';
import {isRegionClaimed} from './expansion.js';
import {grantCentral} from './storage.js';
import {spawnBoss,bossSpec,fillLine} from './endgame.js';
import {recordPreliminary,recordAssault} from './conquest.js';
// Campaign gates are data-driven: `requires` is an AND-gate, `requiresAny`
// is an OR-gate, and optional `destination.region` requires that named home
// frontier region to be claimed before the first departure. No chapter or
// region ids live in this system. Completed chapters remain replayable even
// if destination gates are added later.
export function missionDestination(mission,data) {
 const id=mission?.destination?.region;
 if(!id)return null;
 const region=data?.expansion?.regions?.find(r=>r.id===id)||null;
 return {id,name:mission.destination.name||region?.landmark?.name||region?.name||id,region};
}
export function missionRegionClaimed(mission,world,data) {
 const destination=missionDestination(mission,data);
 if(!destination)return true;
 return !!destination.region&&!!world&&isRegionClaimed(world,destination.region);
}
export function missionLockReason(mission,completed,world=null,data=null) {
 if(!mission)return 'Chapter not found.';
 // A chapter cleared before destination gates existed stays replayable.
 // New geography can gate future progress, never revoke old victories.
 if(completed.includes(mission.id))return null;
 const missing=(mission.requires||[]).filter(id=>!completed.includes(id));
 if(missing.length)return 'Complete the previous chapter first.';
 const orList=mission.requiresAny||[];
 if(orList.length&&!orList.some(id=>completed.includes(id)))return 'Complete one of the required branch chapters first.';
 const destination=missionDestination(mission,data);
 if(destination&&!missionRegionClaimed(mission,world,data))return `Claim ${destination.name} in the Outer Frontier first.`;
 return null;
}
export function missionLocked(mission,completed,world=null,data=null) {
 return !!missionLockReason(mission,completed,world,data);
}
export function missionObjectiveProgress(objective,world,data) {
 const o=objective||{},kind=o.kind||(o.resource?'gather':'unknown');
 let have=0,need=1,label='Complete the objective',progressText='0 / 1';
 if(kind==='gather'){
  need=Math.max(0,Number(o.amount)||0);have=Math.max(0,Number(world?.gathered?.[o.resource])||0);
  label=`Collect ${need} ${o.resource}`;progressText=`${Math.floor(have)} / ${need} ${o.resource}`;
 }else if(kind==='protect'||kind==='build'){
  need=Math.max(1,Math.floor(Number(o.count)||1));
  const name=data?.buildings?.[o.type]?.name||o.type||'structure';
  have=(world?.buildings||[]).filter(b=>b.type===o.type&&b.hp>0&&(b.remaining||0)<=0).length;
  label=kind==='protect'?`Keep ${need} ${name} standing`:`Raise ${need} ${name}`;
  progressText=`${Math.min(have,need)} / ${need} ${name} ${kind==='protect'?'standing':'ready'}`;
 }else if(kind==='survive'){
  need=Math.max(1,Number(o.seconds??o.amount)||1);have=Math.min(need,Math.max(0,Number(world?.elapsed)||0));
  label=`Hold for ${need}s`;progressText=`${Math.floor(have)} / ${need}s held`;
 }else if(kind==='defeat'){
  need=Math.max(1,Math.floor(Number(o.amount??o.count)||1));have=Math.max(0,Number(world?.raidKills)||0);
  label=`Defeat ${need} raiders`;progressText=`${Math.floor(have)} / ${need} raiders defeated`;
 }
 return {kind,have,need,complete:have>=need,label,progressText};
}
export function missionObjectivesComplete(mission,world,data) {
 return (mission?.objectives||[]).every(o=>missionObjectiveProgress(o,world,data).complete);
}

export function startMission(game,data,id) {
 const mission=data.missions.find(m=>m.id===id);
 if(!mission||game.mission||game.world.enemies.length||missionLocked(mission,game.completed,game.world,data))return false;
 // Fletcher's bundles (Act VII): a stocked craft-only building at home
 // spends one bundle to sharpen the expedition's bows for the whole
 // mission. Data `arrowBuff` names the roles, stat and value — no troop
 // ids live here, only the roles the data lists.
 // No bows on the expedition, no bundle spent — the quiver waits for an
 // archer's war. Generic on the data roles: stocked craft buildings name
 // their roles, the map names its walkers.
 const stocked=[];
 for(const b of game.world.buildings){
  const buff=data.buildings[b.type]?.arrowBuff;
  if(!buff||b.hp<=0||b.remaining>0||!(b.stock>=1))continue;
  stocked.push({building:b,buff});
 }
 const walkers=(mission?.map?.troops||[]);
 let bundle=stocked.find(s=>(s.buff.roles||[]).some(t=>walkers.includes(t)))||null;
 game.home=game.world;game.world=createWorld(data,mission);game.mission={id,fired:[],status:'active'};
 if(bundle){
  bundle.building.stock=0;
  for(const u of game.world.troops){
   if(!bundle.buff.roles||!bundle.buff.roles.includes(u.type))continue;
   u.buffs=u.buffs||{};
   u.buffs[bundle.buff.stat||'damage']={value:bundle.buff.value||0.15,timer:mission.timeLimit||300};
  }
  game.world.arrowBundles=true;
 }
 return true;
}
export function tickMission(game,data) {
 if(!game.mission||game.mission.status!=='active')return;
 const m=data.missions.find(m=>m.id===game.mission.id),w=game.world;
 if(!m||!w)return;
 game.mission.fired=game.mission.fired||[];
 if(!Number.isFinite(w.elapsed)||w.elapsed<0)w.elapsed=0;
 for(const [i,raid] of m.raids.entries())if(w.elapsed>=raid.at&&!game.mission.fired.includes(i)){
  spawnRaid(w,raid.count,m.scaling||raid.scaling||null,data);
  // Tribal leaders (Phase 8): a raid may name a crown from data/conquest
  // `leaders` — the same boss machinery, no new combat code. The herald
  // waits on the mission for the Game tick to speak (state has no notify).
  if(raid.boss){
   const spec=bossSpec(data,raid.boss);
   if(spec){spawnBoss(w,data,spec,w.wave);game.mission.herald=raid.herald?fillLine(raid.herald,{wave:w.wave}):`${spec.name} takes the field!`;}
  }
  game.mission.fired.push(i);
 }
 const hall=w.buildings.find(b=>b.type==='hall');
 if(!hall||hall.hp<=0){game.mission.status='lost';return;}
 if(missionObjectivesComplete(m,w,data)&&game.mission.fired.length===m.raids.length&&w.enemies.length===0)game.mission.status='won';
 else if(w.elapsed>=m.timeLimit)game.mission.status='lost';
}
export function finishMission(game,data) {
 if(!game.mission)return;
 const mission=data.missions.find(m=>m.id===game.mission.id);
 const won=game.mission.status==='won',first=won&&!game.completed.includes(mission.id);
 // Rue's ledger comes home: flawless raids won away count toward the
 // village's flawless record — the quest reads home + away either way.
 const awayFlawless=game.world?.flawlessRaids||0;
 game.world=game.home;game.home=null;
 if(awayFlawless>0)game.world.flawlessRaids=(game.world.flawlessRaids||0)+awayFlawless;
 // Shieldwall doctrine: after a victorious expedition, a finished yard
 // works the night — every worn home plate bright again, free, between
 // missions. Manual service (Game.serviceArmor) covers the long home
 // stretches in between. Data flag, never a building id.
 if(won&&game.world.buildings.some(b=>b.hp>0&&b.remaining<=0&&data.buildings[b.type]?.serviceArmor))
  for(const u of game.world.troops)u.armorWear=0;
 if(first){game.completed.push(mission.id);for(const [k,v] of Object.entries(mission.rewards))grantCentral(game.world,data,k,v);game.unlocks=[...new Set([...game.unlocks,...mission.unlocks])];
  // Tribal conquest (Phase 8): first-clears write the ledger — outer
  // works broken, or the stronghold itself fallen (the annex gate).
  if(mission.conquest==='preliminary')recordPreliminary(game.world,mission.id);
  if(mission.conquest==='assault')recordAssault(game.world);
  // Crowning (Act VIII finale): the mission names the eldest of the roster
  // — data `crowning`, oldest by roster order, unnamed hands only.
  if(mission.crowning&&game.world.troops.length){const eldest=game.world.troops[0];if(eldest&&!eldest.name)eldest.name=mission.crowning;}}
 game.mission=null;return {won,first};
}
