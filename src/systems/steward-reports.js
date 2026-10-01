// Interval-owned, read-only village intelligence. No routes, purchases or toasts.
import {stats} from '../model.js';
import {buildingMaxHp} from './endgame.js';
import {mealCost} from './food.js';
import {isWall} from './walls.js';
import {tribeList,readinessChecks,conquestState,preliminaryList,assaultReason} from './conquest.js';
import {missionLockReason} from './campaign.js';
import {capable,expeditionSpec,skyRisk,expeditionStatus} from './expeditions.js';
const runtime=new WeakMap();
export const REPORT_LIMITS=Object.freeze({recovery:8,tribes:4,missions:4,woodland:4,history:12});
const missing=(w,cost)=>Object.fromEntries(Object.entries(cost).map(([k,n])=>[k,Math.max(0,n-(w.resources?.[k]||0))]).filter(([,n])=>n>0));
const clone=x=>structuredClone(x);
const empty=()=>({recovery:{active:false,steps:[]},readiness:[],history:[]});
const defensive=(b,d)=>isWall(b)||d.buildings[b.type]?.tiers?.some(t=>t.damage>0);
function recovery(game){
 const {world:w,data:d}=game,steps=[],crew=new Map();
 for(const u of w.troops)if(u.hp>0&&u.workplace){let types=crew.get(u.workplace);if(!types)crew.set(u.workplace,types=new Set());types.add(u.type);}
 const add=step=>{if(steps.length<REPORT_LIMITS.recovery)steps.push({...step,missing:missing(w,step.cost||{})});};
 const damaged=w.buildings.filter(b=>d.buildings[b.type]&&b.remaining<=0&&b.hp<buildingMaxHp(b,d));
 const priority=b=>b.type==='hall'?0:defensive(b,d)?2:d.buildings[b.type].housing?3:d.buildings[b.type].storage?4:5;
 damaged.sort((a,b)=>priority(a)-priority(b)||(a.hp>0)-(b.hp>0)||String(a.id).localeCompare(String(b.id)));
 const repair=b=>add({id:`repair:${b.id}`,kind:'repair',buildingId:b.id,label:`Repair ${d.buildings[b.type].name}`,detail:b.hp<=0?'Restore this ruined building.':'Restore its missing health.',cost:{wood:Math.ceil((buildingMaxHp(b,d)-b.hp)/15)}});
 for(const b of damaged.filter(b=>b.type==='hall'))repair(b);
 const meal=mealCost(w,d),mealMissing=missing(w,meal);
 if(Object.keys(mealMissing).length)add({id:'meal',kind:'meal',label:'Restock the town meal',detail:'Fill the next food and bread basket.',cost:meal});
 for(const b of damaged.filter(b=>b.type!=='hall'))repair(b);
 // Staff recommendations follow repairs, never silently transfer a manual post.
 for(const b of w.buildings){
  const spec=d.buildings[b.type];if(!spec?.workplace||b.hp<=0||b.remaining>0)continue;
  const types=crew.get(b.id)||new Set(),compatible=type=>d.troops[type]?.job?.workplace===b.type||(spec.hosts||[]).includes(type);
  if([...types].some(compatible))continue;
  add({id:`staff:${b.id}`,kind:'staff',buildingId:b.id,label:`Staff ${spec.name}`,detail:'Assign an available matching worker when the village is safe.',cost:{}});
  if(steps.length>=REPORT_LIMITS.recovery)break;
 }
 const raid=!!w.raidPending||(w.enemies||[]).some(e=>e.hp>0),recovering=(w.director?.recoveryUntil||0)>(w.elapsed||0);
 return {active:raid||recovering||damaged.length>0,steps:raid||recovering||damaged.length>0?steps:[],phase:raid?'danger':recovering?'recovery':damaged.length?'repairs':'quiet'};
}
function roster(game){
 const out={living:0,away:0,hurt:0,equipped:0,armored:0,fighters:0};
 for(const u of game.world.troops){if(!(u.hp>0))continue;out.living++;if(u.expedition)out.away++;if(game.data.troops[u.type]?.role==='combat')out.fighters++;
  if(game.data.items?.[u.gear]?.roles?.includes(u.type))out.equipped++;
  if(game.data.items?.[u.armor]?.roles?.includes(u.type))out.armored++;
  if(game.data.troops[u.type]&&u.hp<stats(u,game.data).hp)out.hurt++;
 }
 return out;
}
function campaignReadiness(game,mission,extra=[]){
 const {world:w,data:d}=game,state={...game.state,world:w},cost={...(mission?.launchCost||{})},paid=Object.keys(cost).length>0;
 const gate=missionLockReason(mission,state.completed||[],w,d),requirements=[...extra,{label:gate||'Chapter prerequisites and destination',ok:!gate},{label:'Home village available',ok:!state.mission},{label:'Current raid finished',ok:!(w.enemies||[]).length}];
 if(paid){requirements.push({label:'Raid warning finished',ok:!w.raidPending},{label:'Manor standing',ok:w.buildings.some(b=>b.type==='hall'&&b.hp>0)});}
 const short=missing(w,cost);for(const [k,n] of Object.entries(cost))requirements.push({label:`${n} ${k} departure supplies`,ok:!short[k]});
 if(mission?.conquest==='assault'){const reason=assaultReason(state,d,mission.tribe);requirements.push({label:reason||'Tribal muster ready',ok:!reason});}
 return {ready:requirements.every(r=>r.ok),requirements,cost,missing:short};
}
function readiness(game,goals){
 const {world:w,data:d}=game,state={...game.state,world:w},people=roster(game),detail=`Home roster: ${people.living} living, ${people.away} away, ${people.hurt} injured, ${people.equipped} tools/weapons, ${people.armored} armor. Campaign chapters use their own starting crew.`;
 const tribes=tribeList(d),selected=(goals||[]).filter(g=>g.id==='conquest').map(g=>g.tribeId),ordered=[...tribes.filter(t=>selected.includes(t.id)),...tribes.filter(t=>!selected.includes(t.id))].slice(0,REPORT_LIMITS.tribes),out=[];
 for(const tribe of ordered){
  const c=conquestState(w,tribe.id),mission=d.missions?.find(m=>m.id===tribe.assault),checks=[...readinessChecks(state,d,tribe.id),{label:'Tribe scouted',ok:c.scouted},...preliminaryList(d,tribe.id).map(p=>({label:p.name,ok:c.preliminaries.includes(p.id)}))];
  out.push({id:`tribe:${tribe.id}`,label:`${tribe.name} stronghold`,kind:'conquest',tribeId:tribe.id,missionId:mission?.id,...campaignReadiness(game,mission,checks),detail,crew:people});
 }
 const completed=state.completed||[],missions=(d.missions||[]).filter(m=>!m.conquest&&!completed.includes(m.id));
 const orderedMissions=[...missions.filter(m=>!missionLockReason(m,completed,w,d)),...missions.filter(m=>missionLockReason(m,completed,w,d))].slice(0,REPORT_LIMITS.missions);
 for(const mission of orderedMissions)out.push({id:`mission:${mission.id}`,label:mission.name,kind:'campaign',missionId:mission.id,...campaignReadiness(game,mission),detail,crew:people});
 const rangers=w.troops.filter(u=>capable(d,u)).sort((a,b)=>Number(b.hp>0&&!b.expedition)-Number(a.hp>0&&!a.expedition)).slice(0,REPORT_LIMITS.woodland);
 for(const u of rangers){
  const spec=expeditionSpec(d,u),risk=Math.min(.9,(spec.risk||0)+skyRisk(w,d)),requirements=[{label:'Villager alive',ok:u.hp>0},{label:'Available at home',ok:!u.expedition},{label:'Capable of woodland ranging',ok:capable(d,u)}],ready=requirements.every(r=>r.ok);
  out.push({id:`woodland:${u.id}`,label:`${u.name||d.troops[u.type].name}: woodland ranging`,kind:'woodland',unitId:u.id,ready,requirements,cost:{},missing:{},duration:spec.durationSec,risk,yields:{...spec.yields},status:u.expedition?expeditionStatus(u,d):ready?'Ready — send manually':'Villager recovering',detail:`${spec.durationSec}s gathering; ${Math.round(risk*100)}% mishap risk in current light and weather. No departure cost.${u.order?' Sending clears the current order.':''}`});
 }
 return out;
}
const goalKey=g=>`${g.slot}:${g.id}:${g.buildingId||g.tribeId||''}:${g.targetTier||g.action||''}`;
export function refreshReports(game,{goals=[],issues=[],queue,queueCompleted}={}){
 const w=game.world;
 if(game.state.mission||!w.steward?.enabled){runtime.delete(w);return;}
 let c=runtime.get(w);if(!c){c={...empty(),sequence:0,goals:new Map(),shortages:new Set(),equipment:new Map(),queue:new Map(),completedQueue:new Set(),wasActive:false};runtime.set(w,c);}
 const emit=(label,detail,buildingId)=>{c.history.push({id:`report-${++c.sequence}`,at:Math.max(0,w.elapsed||0),label,detail,...(buildingId?{buildingId}:{})});if(c.history.length>REPORT_LIMITS.history)c.history.shift();};
 const nextRecovery=recovery(game);
 if(nextRecovery.active&&!c.wasActive)emit('Recovery plan opened','Restore the manor, town meal and damaged buildings in priority order.',nextRecovery.steps.find(s=>s.buildingId)?.buildingId);
 if(!nextRecovery.active&&c.wasActive)emit('Recovery complete','The village has no damaged buildings or active recovery window.');
 c.wasActive=nextRecovery.active;c.recovery=nextRecovery;c.readiness=readiness(game,goals);
 const nextGoals=new Map();for(const goal of goals.slice(0,3)){const key=goalKey(goal),complete=goal.status==='Complete';if(complete&&c.goals.get(key)===false)emit('Village goal completed',goal.label,goal.buildingId);nextGoals.set(key,complete);}c.goals=nextGoals;
 const shortages=new Set(),meal=missing(w,mealCost(w,game.data));
 for(const k of Object.keys(meal))shortages.add(`meal:${k}`);
 for(const issue of issues)if(issue.resource&&issue.id?.startsWith('input:')&&!(w.resources?.[issue.resource]>0))shortages.add(`input:${issue.resource}`);
 // Keep previously observed zero-input shortages across rotating diagnostic samples.
 for(const key of c.shortages)if(key.startsWith('input:')&&!(w.resources?.[key.slice(6)]>0))shortages.add(key);
 for(const key of shortages)if(!c.shortages.has(key))emit('New village shortage',`${key.startsWith('meal:')?'Next meal needs':'Workshop input exhausted:'} ${key.split(':')[1]}.`);
 c.shortages=shortages;
 let fitted=0;const equipment=new Map();for(const u of w.troops){const signature=`${u.gear||''}|${u.armor||''}`;if(c.equipment.has(u.id)&&c.equipment.get(u.id)!==signature&&(u.gear||u.armor))fitted++;equipment.set(u.id,signature);}c.equipment=equipment;
 if(fitted)emit('Equipment fitted',`${fitted} villager${fitted===1?'':'s'} changed equipped tools, weapons or armor.`);
 const completed=Array.isArray(queueCompleted)?queueCompleted:queueCompleted?[queueCompleted]:[];
 const logCompletion=entry=>{if(!entry?.id||c.completedQueue.has(entry.id))return;emit('Construction queue completed',entry.label||'A planned building stage finished.',entry.buildingId);c.completedQueue.add(entry.id);if(c.completedQueue.size>32)c.completedQueue.delete(c.completedQueue.values().next().value);};
 for(const item of completed){const id=typeof item==='string'?item:item.id;logCompletion({...c.queue.get(id),...(typeof item==='object'?item:{}),id});}
 const entries=Array.isArray(queue)?queue:queue?.entries||queue?.rows||[];const nextQueue=new Map();
 for(const entry of entries){const done=['complete','completed','done','Complete'].includes(entry.status);if(done&&c.queue.get(entry.id)?.done===false)logCompletion(entry);nextQueue.set(entry.id,{done,label:entry.label,buildingId:entry.buildingId});}c.queue=nextQueue;
}
export function reportsSnapshot(game){const c=game.world.steward?.enabled&&!game.state.mission?runtime.get(game.world):null;return clone(c?{recovery:c.recovery,readiness:c.readiness,history:c.history}:empty());}
