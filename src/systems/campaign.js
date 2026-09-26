import {createWorld} from '../model.js';
import {spawnRaid} from './combat.js';
// Branch reconvergence (coin-and-cinder onward): a mission may list
// `requiresAny` — an OR-gate of chapter ids, open when at least one is
// completed — beside the classic AND-gate `requires`. Both ride the same
// completed list; missions with neither gate stay open. No chapter ids
// live here: every gate is data on the mission object.
export function missionLocked(mission,completed) {
 if(!mission)return true;
 const andOk=(mission.requires||[]).every(id=>completed.includes(id));
 const orList=mission.requiresAny||[];
 const orOk=!orList.length||orList.some(id=>completed.includes(id));
 return !(andOk&&orOk);
}
export function startMission(game,data,id) {
 const mission=data.missions.find(m=>m.id===id);
 if(!mission||game.mission||game.world.enemies.length||missionLocked(mission,game.completed))return false;
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
 for(const [i,raid] of m.raids.entries())if(w.elapsed>=raid.at&&!game.mission.fired.includes(i)){spawnRaid(w,raid.count,m.scaling||raid.scaling||null,game.data);game.mission.fired.push(i);}
 const hall=w.buildings.find(b=>b.type==='hall');
 if(!hall||hall.hp<=0){game.mission.status='lost';return;}
 if(m.objectives.every(o=>w.gathered[o.resource]>=o.amount)&&game.mission.fired.length===m.raids.length&&w.enemies.length===0)game.mission.status='won';
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
 if(first){game.completed.push(mission.id);for(const [k,v] of Object.entries(mission.rewards))game.world.resources[k]+=v;game.unlocks=[...new Set([...game.unlocks,...mission.unlocks])];
  // Crowning (Act VIII finale): the mission names the eldest of the roster
  // — data `crowning`, oldest by roster order, unnamed hands only.
  if(mission.crowning&&game.world.troops.length){const eldest=game.world.troops[0];if(eldest&&!eldest.name)eldest.name=mission.crowning;}}
 game.mission=null;return {won,first};
}
