import {hash2} from './biomes.js';
import {isRegionClaimed,regionById} from './expansion.js';

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
 const region=regionById(data?.expansion,event.region);
 return !!region&&isRegionClaimed(world,region);
}

export function eligibleFrontierEvents(state,data){
 return (data?.world?.frontierEvents||[]).filter(e=>frontierEventEligible(e,state,data));
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
 for(const [key,value] of Object.entries(cost))world.resources[key]-=value;
 for(const [key,value] of Object.entries(reward))world.resources[key]=(world.resources[key]||0)+value;
 world.lastFrontierEventId=event.id;
 world.frontierEventCount=(world.frontierEventCount||0)+1;
 world.frontierEvent=null;
 schedule(world,data);
 return {ok:true,event,choice,message:choice.result||'The frontier settles again.',cost:{...cost},reward:{...reward},nextAt:world.nextFrontierEventAt};
}
