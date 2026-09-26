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
 game.home=game.world;game.world=createWorld(data,mission);game.mission={id,fired:[],status:'active'};return true;
}
export function tickMission(game,data) {
 if(!game.mission||game.mission.status!=='active')return;
 const m=data.missions.find(m=>m.id===game.mission.id),w=game.world;
 if(!m||!w)return;
 game.mission.fired=game.mission.fired||[];
 if(!Number.isFinite(w.elapsed)||w.elapsed<0)w.elapsed=0;
 for(const [i,raid] of m.raids.entries())if(w.elapsed>=raid.at&&!game.mission.fired.includes(i)){spawnRaid(w,raid.count);game.mission.fired.push(i);}
 const hall=w.buildings.find(b=>b.type==='hall');
 if(!hall||hall.hp<=0){game.mission.status='lost';return;}
 if(m.objectives.every(o=>w.gathered[o.resource]>=o.amount)&&game.mission.fired.length===m.raids.length&&w.enemies.length===0)game.mission.status='won';
 else if(w.elapsed>=m.timeLimit)game.mission.status='lost';
}
export function finishMission(game,data) {
 if(!game.mission)return;
 const mission=data.missions.find(m=>m.id===game.mission.id);
 const won=game.mission.status==='won',first=won&&!game.completed.includes(mission.id);
 game.world=game.home;game.home=null;
 if(first){game.completed.push(mission.id);for(const [k,v] of Object.entries(mission.rewards))game.world.resources[k]+=v;game.unlocks=[...new Set([...game.unlocks,...mission.unlocks])];}
 game.mission=null;return {won,first};
}
