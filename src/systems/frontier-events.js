import {hash2} from './biomes.js';
import {isRegionClaimed,regionById} from './expansion.js';
import {centralRoom} from './storage.js';
import {districtGrid,districtKindOf} from './logistics.js';
import {housing,center as buildingCenter} from '../model.js';

const resources = value => value && typeof value==='object' ? value : {};

export function frontierEventById(data,id){
 return (data?.world?.frontierEvents||[]).find(e=>e.id===id)||null;
}

export function frontierEventDelay(world,data){
 const cfg=data?.world?.frontierEventTiming||{},min=Math.max(60,Number(cfg.minDelay)||300),jitter=Math.max(0,Math.floor(Number(cfg.jitter)||0));
 if(!jitter)return min;
 const count=Math.max(0,Math.floor(world?.frontierEventCount||0)),wave=Math.max(0,Math.floor(world?.wave||0)),seed=Number.isFinite(data?.world?.seed)?data.world.seed:0;
 return min+(hash2(count+17,wave+31,seed+503)%jitter);
}

export function frontierEventEligible(event,state,data){
 const world=state?.world;
 if(!event||!world||state?.mission)return false;
 if((state.vlevel||1)<(event.minLevel||1))return false;
 if(event.region){
  const region=regionById(data?.expansion,event.region);
  if(!region||!isRegionClaimed(world,region))return false;
 }
 if(!eventConditionsMet(event,state,data))return false;
 const cooldown=Math.max(0,Number(event.cooldown)||0);
 if(cooldown>0){
  const seen=world.frontierEventSeen?.[event.id];
  if(Number.isFinite(seen)&&(world.elapsed||0)-seen<cooldown)return false;
 }
 return true;
}

export function eligibleFrontierEvents(state,data){
 return (data?.world?.frontierEvents||[]).filter(e=>frontierEventEligible(e,state,data));
}

// Village gates (Phase 6): every `when` clause must hold. Events without
// `when` read exactly as before — the original nine carry no gates.
export function eventConditionsMet(event,state,data){
 const when=event?.when;
 if(!when||typeof when!=='object')return true;
 const world=state?.world;
 if(!world)return false;
 if(when.building){
  const raised=(world.buildings||[]).some(b=>b&&b.type===when.building&&b.hp>0&&!(b.remaining>0));
  if(!raised)return false;
 }
 if(Number.isFinite(+when.freeBeds)){
  const h=housing(world,data);
  if(h.beds-h.used<+when.freeBeds)return false;
 }
 if(when.resourceBelow&&typeof when.resourceBelow==='object'){
  const rb=when.resourceBelow;
  const pairs=('key' in rb||'resource' in rb)?[[rb.key??rb.resource,rb.amount]]:Object.entries(rb);
  for(const [key,amount] of pairs)if(!((world.resources?.[key]||0)<amount))return false;
 }
 if(Number.isFinite(+when.minWave)){
  if((world.wave||0)<+when.minWave)return false;
 }
 return true;
}

// Placement anchor (Phase 6): the living finished `place.near` building
// closest to the village center, or the first candidate when no center
// reads. Events without `place.near` anchor on the first living finished
// building; a village with none standing anchors nowhere.
// Phase 9B: nearest-first stays primary; exact ties break toward the
// candidate standing in the `place.near` type's district kind.
export function eventAnchor(world,data,event){
 const alive=(world?.buildings||[]).filter(b=>b&&b.hp>0&&!(b.remaining>0));
 if(!alive.length)return null;
 const near=event?.place?.near;
 const pool=near?alive.filter(b=>b.type===near):alive;
 if(!pool.length)return null;
 if(pool.length===1)return pool[0];
 const bounds=world?.bounds;
 const c=bounds&&Number.isFinite(bounds.w)&&Number.isFinite(bounds.h)?{x:bounds.w/2,y:bounds.h/2}:null;
 if(!c)return pool[0];
 let want=null,cellOf=null;
 try{
  want=near?districtKindOf(near):null;
  if(want)cellOf=new Map(districtGrid(world,data).cells.map(cl=>[cl.cy*4096+cl.cx,cl.kind]));
 }catch{want=null;cellOf=null;}
 let best=pool[0],bd=Infinity;
 for(const b of pool){
  let p;
  try{p=buildingCenter(b,data);}catch{p={x:b.x,y:b.y};}
  const d=Math.hypot(p.x-c.x,p.y-c.y);
  if(d<bd-1e-9){bd=d;best=b;}
  else if(cellOf&&Math.abs(d-bd)<=1e-9){
   const cur=cellOf.get(Math.floor(best.y/6)*4096+Math.floor(best.x/6))??null;
   const cand=cellOf.get(Math.floor(b.y/6)*4096+Math.floor(b.x/6))??null;
   if(cand===want&&cur!==want)best=b;
  }
 }
 return best;
}

function schedule(world,data,delay=null){
 const d=Number.isFinite(delay)?delay:frontierEventDelay(world,data);
 world.nextFrontierEventAt=(world.elapsed||0)+Math.max(1,d);
 return world.nextFrontierEventAt;
}

export function ensureFrontierEventClock(state,data){
 const world=state?.world;
 if(!world||state?.mission)return null;
 if(world.frontierEvent)return null;
 if(!Number.isFinite(world.nextFrontierEventAt))return schedule(world,data);
 return world.nextFrontierEventAt;
}

export function tickFrontierEvents(state,data,notify=()=>{}){
 const world=state?.world;
 if(!world||state?.mission||world.frontierEvent)return null;
 if(world.enemies?.length||world.raidPending)return null;
 // Do not open a choice card immediately before scheduled horns.
 if(Number.isFinite(world.nextRaidAt)&&world.nextRaidAt-(world.elapsed||0)<60)return null;
 const at=ensureFrontierEventClock(state,data);
 if(!Number.isFinite(at)||(world.elapsed||0)<at)return null;
 const choices=eligibleFrontierEvents(state,data);
 if(!choices.length){
  const retry=Math.max(30,Number(data?.world?.frontierEventTiming?.retryDelay)||90);
  schedule(world,data,retry);
  return null;
 }
 const seed=Number.isFinite(data?.world?.seed)?data.world.seed:0,count=Math.max(0,Math.floor(world.frontierEventCount||0));
 let index=hash2(count+7,Math.floor((world.elapsed||0)/60)+11,seed+907)%choices.length;
 if(choices.length>1&&choices[index].id===world.lastFrontierEventId)index=(index+1)%choices.length;
 const event=choices[index];
 world.frontierEvent={id:event.id,at:world.elapsed||0};
 world.nextFrontierEventAt=null;
 notify(`${event.title} — ${event.text} Open Adventure to respond.`);
 return event;
}

export function resolveFrontierEvent(state,data,choiceId){
 const world=state?.world,active=world?.frontierEvent;
 if(!world||!active)return {ok:false,error:'No frontier event is waiting.'};
 if(state?.mission||world.enemies?.length||world.raidPending)return {ok:false,error:'Deal with the current expedition or raid first.'};
 const event=frontierEventById(data,active.id);
 if(!event){world.frontierEvent=null;schedule(world,data,60);return {ok:false,error:'That frontier event is no longer available.'};}
 const choice=(event.choices||[]).find(c=>c.id===choiceId);
 if(!choice)return {ok:false,error:'Choose one of the available responses.'};
 const cost=resources(choice.cost),reward=resources(choice.reward);
 for(const [key,value] of Object.entries(cost))if((world.resources?.[key]||0)<value)return {ok:false,error:`Need ${value} ${key} for that response.`};
 // Central storage caps (Phase 1): a reward with nowhere to land is
 // refused up front — the cost is never paid for goods that would spill.
 for(const [key,value] of Object.entries(reward))if(Number.isFinite(value)&&value>0&&centralRoom(world,data,key)<value)return {ok:false,error:'Your stores are full — spend a little before answering the road.'};
 for(const [key,value] of Object.entries(cost))world.resources[key]-=value;
 for(const [key,value] of Object.entries(reward))world.resources[key]=(world.resources[key]||0)+value;
 world.lastFrontierEventId=event.id;
 world.frontierEventCount=(world.frontierEventCount||0)+1;
 if(!world.frontierEventSeen||typeof world.frontierEventSeen!=='object')world.frontierEventSeen={};
 world.frontierEventSeen[event.id]=world.elapsed||0;
 world.frontierEvent=null;
 schedule(world,data);
 return {ok:true,event,choice,message:choice.result||'The frontier settles again.',cost:{...cost},reward:{...reward},nextAt:world.nextFrontierEventAt};
}
