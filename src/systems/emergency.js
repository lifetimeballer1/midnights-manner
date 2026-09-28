import {center,distance,stats} from '../model.js';
import {move} from './pathfinding.js';
import {retreat} from './tactics.js';
import {isWall} from './walls.js';
import {hasTrait, fleeRadius, fleeSpeedMult} from './villagers.js';
const danger=(foes,p,r=3)=>foes.some(e=>distance(e,p)<r);
// Orders, workplaces and carried goods are never overwritten. Emergency is a
// temporary overlay; normal duties resume as soon as the last threat passes.
export function tickEmergency(world,data,dt) {
 // Perf: living foes + shelter shortlist (with centers) hoisted once —
 // enemies never move or die inside this loop, so all danger() answers
 // below are identical to the live scans. Building centers and troop max-
 // HP memoize per tick (positions/levels/gear are static here; hp stays
 // a live read). Sorts become linear min-scans with the same first-min
 // tie-break the stable sorts returned.
 const foes=world.enemies.filter(e=>e.hp>0);
 const active=!!world.raidPending||foes.length>0;
 const shelters=world.buildings.filter(b=>b.hp>0&&b.remaining<=0&&(b.type==='hall'||data.buildings[b.type].housing)).map(b=>({b,c:center(b,data)}));
 const safeShelters=shelters.filter(s=>!danger(foes,s.c,4));
 const bCenters=new Map();
 const bCenter=b=>{let c=bCenters.get(b);if(!c){c=center(b,data);bCenters.set(b,c);}return c;};
 const maxHp=new Map();
 const maxOf=t=>{let m=maxHp.get(t);if(m===undefined){m=stats(t,data).hp;maxHp.set(t,m);}return m;};
 for(const u of world.troops){
  if(!active||u.hp<=0||u.expedition||data.troops[u.type].role==='combat'){delete u.emergency;continue;}
  u.emergency={kind:'shelter'};
  const s=stats(u,data),spec=data.troops[u.type];
  // Phase 7 temperament: Cowardly flees early (4 tiles) and fast (+30%),
  // Brave holds until raiders close (1.2 tiles). Night Owls run 15% faster.
  const fleeAt=fleeRadius(u),fleeSpeed=s.speed*fleeSpeedMult(u);
  let nearest=null,nearestD=Infinity;
  for(const e of foes){const d=distance(u,e);if(d<nearestD){nearestD=d;nearest=e;}}
  if(nearest&&distance(u,nearest)<fleeAt){retreat(world,data,u,nearest,fleeSpeed,dt);continue;}
  // Cowardly healers run for shelter instead of tending the field.
  const job=(spec.emergency==='heal'&&hasTrait(u,'cowardly'))?null:spec.emergency;
  if(job==='repair'&&world.resources.wood>0){
   // Every wall line counts: palisades, stone, ramparts and gatehouses
   // all read as walls, so builders mend the whole perimeter. Brave
   // builders mend closer to the fighting (2.5 tiles); the timid keep 3.5.
   const safeDist=hasTrait(u,'brave')?2.5:3.5;
   let b=null,bestD=Infinity;
   for(const cand of world.buildings){
    if(cand.hp<=0||cand.remaining>0||!(isWall(cand)||cand.type==='hall'||data.buildings[cand.type].tiers[cand.level-1].damage))continue;
    if(cand.hp>=data.buildings[cand.type].tiers[cand.level-1].hp)continue;
    const cc=bCenter(cand);
    if(danger(foes,cc,safeDist))continue;
    const d=distance(u,cc);
    if(d<bestD){bestD=d;b=cand;}
   }
   if(b){u.emergency={kind:'repair',target:b.id};if(move(world,data,u,center(b,data),fleeSpeed,dt,data.buildings[b.type].size/2+.7,true,true)){
    const hp=Math.min(6*dt,data.buildings[b.type].tiers[b.level-1].hp-b.hp,world.resources.wood*15);b.hp+=hp;world.resources.wood=Math.max(0,world.resources.wood-hp/15);
   }continue;}
  }
  if(job==='heal'){
   let ally=null,bestF=Infinity;
   for(const t of world.troops){
    if(t===u||t.hp<=0||t.expedition)continue;
    const m=maxOf(t);
    if(t.hp>=m)continue;
    if(danger(foes,t,3.5))continue;
    const f=t.hp/m;
    if(f<bestF){bestF=f;ally=t;}
   }
   if(ally){u.emergency={kind:'heal',target:ally.id};if(move(world,data,u,ally,fleeSpeed,dt,1.8,true,true))ally.hp=Math.min(maxOf(ally),ally.hp+3*dt);continue;}
  }
  // Prefer the nearest safe living home; route around enemy positions.
  let shelter=null,shelterD=Infinity;
  for(const cand of safeShelters){const d=distance(u,cand.c);if(d<shelterD){shelterD=d;shelter=cand.b;}}
  if(shelter){u.emergency.target=shelter.id;move(world,data,u,center(shelter,data),fleeSpeed,dt,data.buildings[shelter.type].size/2+.7,true,true);}
 }
}
