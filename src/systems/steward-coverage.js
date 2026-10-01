import {center} from '../model.js';
import {defensePostCapacity} from './defense-posts.js';

export const COVERAGE_LIMITS=Object.freeze({sites:24,posts:24,gaps:8});
const caches=new WeakMap();
const cursors=new WeakMap();
const empty=()=>({examined:0,totalSites:0,nextCursor:0,posts:0,protected:0,unguarded:0,gaps:[],geometric:true});
const copy=s=>({...s,gaps:s.gaps.map(g=>({...g}))});
const critical=(b,d)=>b&&b.hp>0&&!(b.remaining>0)&&d.buildings[b.type]&&(b.type==='hall'||b.type==='gate'||d.buildings[b.type].housing||d.buildings[b.type].storage);
export function refreshCoverage(game){
 if(game.state.mission)return empty();
 const {world:w,data:d}=game,posts=[],sites=[],crewed=new Set();
 // Rotate only sites. Keeping the sampled ready post set stable avoids
 // changing apparent gaps simply because a covering post rotated away.
 let totalSites=0;for(const b of w.buildings)if(critical(b,d))totalSites++;
 const start=totalSites?(cursors.get(w)||0)%totalSites:0,sampleSize=Math.min(24,totalSites);
 let siteIndex=0;
 for(const u of w.troops)if(u.hp>0&&!u.order&&!u.expedition&&!u.emergency&&u.defensePost&&d.troops[u.type]?.role==='combat')crewed.add(u.defensePost);
 for(const b of w.buildings){
  if(!b||b.hp<=0||b.remaining>0||!d.buildings[b.type])continue;
  const spec=d.buildings[b.type];
  if(critical(b,d)){const offset=(siteIndex-start+totalSites)%totalSites;if(offset<sampleSize)sites[offset]=b;siteIndex++;}
  if(posts.length>=24||!defensePostCapacity(b,d))continue;
  const tier=spec.tiers[b.level-1],tower=tier?.damage>0?Number(tier.range)||0:0;
  // These match the local posted response radii, not traversable routes.
  const response=crewed.has(b.id)?(b.type==='hall'?7:6):0;
  const radius=Math.max(tower,response);if(radius>0)posts.push({point:center(b,d),radius});
 }
 const nextCursor=totalSites?(start+sampleSize)%totalSites:0;cursors.set(w,nextCursor);
 const report={...empty(),examined:sites.length,totalSites,nextCursor,posts:posts.length};
 for(const b of sites){const point=center(b,d),covered=posts.some(p=>Math.hypot(p.point.x-point.x,p.point.y-point.y)<=p.radius);
  if(covered)report.protected++;else{report.unguarded++;if(report.gaps.length<8)report.gaps.push({buildingId:b.id,label:`${d.buildings[b.type].name} outside coverage`,detail:'No sampled ready tower range or available posted fighter response radius reaches this site. Geometric estimate; walls and routes are not checked.'});}
 }
 caches.set(w,report);return copy(report);
}
// UI reads never run scans, reassign a fighter or build a route.
export function coverageSnapshot(game){return copy(game.state.mission?empty():caches.get(game.world)||empty());}
