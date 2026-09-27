import {afford,pay} from '../model.js';
export const researchState=state=>state.research||{points:0,completed:[],active:null};
export function researchRate(state,data) {
 if(state.mission||state.world.raidPending||state.world.enemies.length)return 0;
 const w=state.world;if(!w.buildings.some(b=>b.type==='hall'&&b.hp>0&&b.remaining<=0))return 0;
 let rate=.1;
 for(const u of w.troops){if(u.hp<=0||u.expedition||u.emergency)continue;
  const b=w.buildings.find(b=>b.id===u.workplace&&b.hp>0&&b.remaining<=0);
  if(b&&data.buildings[b.type].researchRate&&data.troops[u.type].job?.workplace===b.type)rate+=data.buildings[b.type].researchRate*b.level;
 }
 return Math.min(1,rate);
}
export function researchReason(state,data,id) {
 const node=data.world.technologies?.find(n=>n.id===id),r=researchState(state);
 if(!node)return 'Unknown technology';
 if(state.mission)return 'Research waits at home';
 if(r.completed.includes(id))return 'Researched';
 if(r.active)return r.active.id===id?'Researching':'Finish current research';
 if(!(node.requires||[]).every(id=>r.completed.includes(id)))return 'Complete the connected technology first';
 if(r.points<node.points)return `Needs ${node.points} insight`;
 if(!afford(state.world.resources,node.cost))return 'Gather the required resources';
 return '';
}
export function startResearch(state,data,id) {
 if(researchReason(state,data,id))return false;
 const n=data.world.technologies.find(n=>n.id===id),r=state.research??={points:0,completed:[],active:null};
 if(!pay(state.world.resources,n.cost))return false;
 r.points-=n.points;r.active={id,remaining:n.seconds};return true;
}
export function tickResearch(state,data,dt,notify=()=>{}) {
 if(!data.world.technologies||!Number.isFinite(dt)||dt<=0||state.mission)return;
 const r=state.research??={points:0,completed:[],active:null};
 const rate=researchRate(state,data);r.points=Math.min(1000,r.points+rate*dt);
 if(!r.active||rate<=0)return;
 const n=data.world.technologies.find(n=>n.id===r.active.id);if(!n)return;
 r.active.remaining=Math.max(0,r.active.remaining-dt);
 if(r.active.remaining>0)return;
 if(!r.completed.includes(n.id)){r.completed.push(n.id);state.unlocks=[...new Set([...state.unlocks,...n.unlocks])];notify(`${n.name} researched — new settlement options unlocked.`);}
 r.active=null;
}
