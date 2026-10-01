// Player-selected, read-only plans. No recruitment, purchases or departures.
import {buildingCost} from '../model.js';
import {buildingMaxHp} from './endgame.js';
import {isWall} from './walls.js';
import {tribeList,tribeOf,conquestState,preliminaryList,readinessChecks,assaultReason} from './conquest.js';
import {missionLockReason} from './campaign.js';

const slotIndex=slot=>slot==='main'?-1:slot==='secondary1'?0:slot==='secondary2'?1:Number.isInteger(slot)&&slot>=0&&slot<2?slot:null;
const defense=(b,d)=>isWall(b)||d.buildings[b.type]?.tiers?.some(t=>t.damage>0);
const missingCost=(w,cost)=>Object.fromEntries(Object.entries(cost).map(([k,n])=>[k,Math.max(0,n-(w.resources?.[k]||0))]).filter(([,n])=>n>0));
const goalKey=g=>g?.id==='conquest'?`conquest:${g.tribeId}`:g?.buildingId?`building:${g.buildingId}`:g?.id;
const settings=w=>w.steward||{};
const building=(g,id)=>g.world.buildings.find(b=>b.id===id);
const upgradeCandidate=(g,filter)=>g.world.buildings.find(b=>filter(b,g.data)&&b.hp>0&&b.remaining<=0&&b.level<g.data.buildings[b.type]?.tiers.length);
function normalizeGoal(game,input){
 const goal=typeof input==='string'?{id:input}:input;
 if(!goal||!['grow','fortify','conquest','project'].includes(goal.id))return null;
 if(goal.id==='conquest'){
  const tribes=tribeList(game.data),tribeId=goal.tribeId||(tribes.length===1?tribes[0].id:null);
  return tribeOf(game.data,tribeId)?{id:'conquest',tribeId}:null;
 }
 let b=goal.buildingId?building(game,goal.buildingId):null;
 if(goal.id==='grow'){
  if(b&&!game.data.buildings[b.type]?.housing)return null;
  b=b||upgradeCandidate(game,(x,d)=>!!d.buildings[x.type]?.housing);
 }else if(goal.id==='fortify'){
  if(b&&!defense(b,game.data))return null;
  b=b||game.world.buildings.find(x=>defense(x,game.data)&&x.remaining<=0&&x.hp<buildingMaxHp(x,game.data))||upgradeCandidate(game,defense);
 }
 if(!b||!game.data.buildings[b.type])return null;
 if(goal.id==='fortify'&&b.hp<buildingMaxHp(b,game.data))return {id:'fortify',buildingId:b.id,action:'repair',baseline:Math.max(0,b.hp)};
 const max=game.data.buildings[b.type].tiers.length,targetTier=goal.targetTier??b.level+1;
 if(!Number.isInteger(targetTier)||targetTier<=b.level||targetTier>max)return null;
 return {id:goal.id,buildingId:b.id,targetTier,baseline:b.level};
}
export function setGoal(game,slot,input){
 const index=slotIndex(slot);
 if(index===null||game.state.mission)return {ok:false,error:'Choose a home-village goal slot.'};
 const goal=normalizeGoal(game,input);
 if(!goal)return {ok:false,error:'Choose an existing upgradable building or a frontier tribe.'};
 const s=settings(game.world),entries=[s.main,...(Array.isArray(s.secondary)?s.secondary.slice(0,2):[])];
 const own=index===-1?0:index+1;
 if(entries.some((g,i)=>i!==own&&g&&goalKey(g)===goalKey(goal)))return {ok:false,error:'That target already has a goal.'};
 if(!game.world.steward)game.world.steward={enabled:false,main:null,secondary:[],protectMeals:true,protectRepairs:true};
 const config=game.world.steward;
 if(index===-1)config.main=goal;
 else{if(!Array.isArray(config.secondary))config.secondary=[];config.secondary[index]=goal;config.secondary=config.secondary.slice(0,2);}
 return {ok:true,goal:{...goal}};
}
export function clearGoal(game,slot){
 const index=slotIndex(slot);
 if(index===null||game.state.mission)return {ok:false,error:'Choose a home-village goal slot.'};
 const config=game.world.steward;
 if(!config)return {ok:true};
 if(index===-1)config.main=null;
 else if(Array.isArray(config.secondary))config.secondary[index]=null;
 return {ok:true};
}
export function goalChoices(game){
 const choices=[];
 for(const id of ['grow','fortify']){
  const goal=normalizeGoal(game,{id});
  if(goal)choices.push({...goal,label:id==='grow'?'Grow housing':'Fortify defenses'});
 }
 for(const tribe of tribeList(game.data))if(!conquestState(game.world,tribe.id).assaultWon)choices.push({id:'conquest',tribeId:tribe.id,label:`Prepare for ${tribe.name}`});
 for(const b of game.world.buildings){
  const spec=game.data.buildings[b.type];
  if(spec&&b.level<spec.tiers.length)choices.push({id:'project',buildingId:b.id,targetTier:b.level+1,label:`${spec.name} (${b.x}, ${b.y}) → tier ${b.level+1}`});
 }
 return choices;
}
function projectSnapshot(game,goal){
 const {world:w,data:d}=game,b=building(game,goal.buildingId),spec=d.buildings[b?.type];
 const out={...goal,label:goal.id==='grow'?'Grow housing':goal.id==='fortify'?'Fortify defenses':'Building project',current:0,total:1,progress:0,status:'Target building is missing',requirements:[],cost:{},missing:{}};
 if(!b||!spec)return out;
 if(goal.action==='repair'){
  const max=buildingMaxHp(b,d),base=Math.min(max,Number(goal.baseline)||0);
  out.label=`Repair ${spec.name} (${b.x}, ${b.y})`;out.current=Math.max(0,b.hp-base);out.total=Math.max(1,max-base);
  out.progress=Math.min(1,out.current/out.total);out.cost=b.hp>=max?{}:{wood:Math.ceil((max-b.hp)/15)};
  out.status=b.hp>=max?'Complete':b.remaining>0?'Waiting for construction':'Repair needed';
 }else{
  const target=goal.targetTier,base=Number(goal.baseline)||Math.max(1,target-1);
  out.label=`${goal.id==='grow'?'Grow housing: ':goal.id==='fortify'?'Fortify: ':''}${spec.name} (${b.x}, ${b.y}) → tier ${target}`;
  if(!Number.isInteger(target)||target>spec.tiers.length){out.status='Target tier is unavailable';return out;}
  out.current=Math.max(0,b.level-base-(b.remaining>0?1:0));out.total=Math.max(1,target-base);out.progress=Math.min(1,out.current/out.total);
  const complete=b.hp>0&&b.remaining<=0&&b.level>=target;
  // Quote only the next unpaid stage. Builder bonuses are live, never cached.
  if(!complete&&b.level<target)out.cost=b.type==='hall'?{wood:200*b.level,gold:150*b.level}:buildingCost(b.type,b.level+1,w,d);
  const gate=spec.tierGates?.[b.level+1];
  if(!complete&&gate)out.requirements.push({label:`Village level ${gate}`,ok:(game.state.vlevel||1)>=gate});
  if(!complete)out.requirements.push({label:'Building unlocked',ok:!game.locked?.(b.type)});
  out.status=complete?'Complete':b.hp<=0?'Repair the building first':b.remaining>0?'Construction in progress':out.requirements.some(r=>!r.ok)?'Village level or unlock required':'Ready for manual upgrade';
 }
 out.missing=missingCost(w,out.cost);
 if(Object.keys(out.missing).length&&['Ready for manual upgrade','Repair needed'].includes(out.status))out.status='Waiting for materials';
 return out;
}
function conquestSnapshot(game,goal){
 const {world:w,data:d}=game,tribe=tribeOf(d,goal.tribeId);
 const out={...goal,label:tribe?`Prepare for ${tribe.name}`:'Conquest plan',current:0,total:1,progress:0,status:'Tribe is unavailable',requirements:[],cost:{},missing:{}};
 if(!tribe)return out;
 const state=conquestState(w,tribe.id),m=d.missions?.find(m=>m.id===tribe.assault);
 if(state.assaultWon)return {...out,current:1,total:1,progress:1,status:'Complete'};
 out.cost={...(m?.launchCost||{})};out.missing=missingCost(w,out.cost);
 out.requirements=[...readinessChecks(game.state,d,tribe.id),{label:'Tribe scouted',ok:state.scouted},...preliminaryList(d,tribe.id).map(p=>({label:p.name,ok:state.preliminaries.includes(p.id)}))];
 const missionReason=missionLockReason(m,game.state.completed||[],w,d);
 out.requirements.push({label:'Campaign prerequisites and destination',ok:!missionReason});
 out.requirements.push({label:'Peaceful home village',ok:!game.state.mission&&!w.raidPending&&!(w.enemies||[]).some(e=>e.hp>0)});
 out.requirements.push({label:'Manor standing',ok:w.buildings.some(b=>b.type==='hall'&&b.hp>0)});
 for(const [resource,amount] of Object.entries(out.cost))out.requirements.push({label:`${amount} ${resource} departure supplies`,ok:!(out.missing[resource]>0)});
 out.current=out.requirements.filter(r=>r.ok).length;out.total=Math.max(1,out.requirements.length);out.progress=out.current/out.total;
 out.status=assaultReason(game.state,d,tribe.id)||missionReason||(Object.keys(out.missing).length?'Waiting for departure supplies':out.requirements.find(r=>!r.ok)?.label)||'Ready — depart manually';
 return out;
}
export function goalSnapshot(game){
 const config=settings(game.world),ordered=[{slot:'main',goal:config.main},...(Array.isArray(config.secondary)?config.secondary.slice(0,2):[]).map((goal,i)=>({slot:i,goal}))];
 return ordered.filter(x=>x.goal&&['grow','fortify','project','conquest'].includes(x.goal.id)).map(({slot,goal})=>{
  const record={id:goal.id};
  for(const key of ['buildingId','targetTier','tribeId','action','baseline'])if(['string','number'].includes(typeof goal[key]))record[key]=goal[key];
  return {...(record.id==='conquest'?conquestSnapshot(game,record):projectSnapshot(game,record)),slot};
 });
}
export const stewardGoalSnapshot=goalSnapshot;
