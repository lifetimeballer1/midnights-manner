import {seedOf} from './procedural-seed.js';
import {hash2} from './systems/biomes.js';
import {beam} from './mechanical-art.js';
export const LIVING_LIMITS=Object.freeze({vegetation:18,banners:12,flames:16});
export function addWindLife(s,world,time){
 const r=s.r;if(r.calm||r.cam.zoom<1.2)return;const old=s.owner,wind=world.weather==='rain'?1.35:1;let leaves=0,banners=0;
 // Quality-aware caps: Low trims ambient life first, High keeps full detail.
 const ambientCap=r.qualityCfg?.ambientCap??20, lightCap=r.qualityCfg?.lightCap??40;
 const leafCap=Math.min(18,ambientCap), bannerCap=Math.min(12,Math.max(4,Math.round(ambientCap*.6))), flameCap=Math.min(16,Math.max(6,Math.round(lightCap*.4)));
 for(const prop of r._livingScenery||[]){
  if(leaves>=leafCap)break;if(!['grass','reeds','pine','shrub','flowers','lilies'].includes(prop.kind))continue;
  const x=prop.x+.5,y=prop.y+.5,p=r.project(x,y);if(p.x<-25||p.y<-60||p.x>r.width+25||p.y>r.height+30)continue;
  // Sway anchors follow the rebuilt silhouettes: broadleaf crowns sit lower
  // than conifer tips, scrub below shrubs, pads at the waterline. Variant
  // choice matches environment-art's tile hash so beams never float.
  const broad=prop.kind==='pine'&&hash2(prop.x,prop.y,991)%100<42,fringe=prop.biome==='unclaimed-fringe';
  const z=prop.kind==='pine'?(broad?.62:.88):prop.kind==='shrub'?.24:prop.kind==='reeds'?.36:prop.kind==='lilies'?.06:prop.kind==='flowers'?.34:.2;
  const color=prop.kind==='reeds'||prop.kind==='lilies'?'#b69a55':prop.kind==='flowers'?'#c98a9a':fringe?'#3f5a34':'#78965b';
  const phase=seedOf(`${prop.x},${prop.y}`)*6.28,sway=Math.sin(time*.0015+phase)*.035*wind;s.owner=null;beam(s,[x,y,z],[x+.025+sway,y+sway*.3,z+.12],.024,color);leaves++;
 }
 for(const b of world.buildings){
  if(banners>=bannerCap)break;if(b.hp<=0||b.remaining>0||!['barracks','scout_post','market','market-square','longhouse','shieldwall-yard'].includes(b.type))continue;
  const n=r.data.buildings[b.type].size,x=b.x+.17,y=b.y+n-.14,z=.76,p=r.project(x,y,z);if(p.x<0||p.y<0||p.x>r.width||p.y>r.height)continue;
  const sway=Math.sin(time*.0017+seedOf(b.id)*6.28)*.045*wind;s.owner={kind:'building',id:b.id};s.box(x-.02,y-.02,.13,.04,.04,.81,'#987046');const cloth=[[x,y,z],[x+.24,y+sway,z-.035],[x+.23,y+sway*.7,z-.16],[x,y,z-.15]];s.face(cloth,'#a06c59',false);s.face([...cloth].reverse(),'#a06c59',false);banners++;
 }
 let flames=0;for(const source of s.sources){
  if(flames>=flameCap)break;if(!['torch','fire','trap'].includes(source.profile))continue;const [x,y,z]=source.position,p=r.project(x,y,z);if(p.x<0||p.y<0||p.x>r.width||p.y>r.height)continue;
  const height=.06+.035*(1+Math.sin(time*.008+seedOf(source.owner?.id)*6.28));s.owner=source.owner;s.emissive=.8;s.pyramid(x,y,z,.035,height,'#ffcf84',5);s.emissive=0;flames++;
 }s.owner=old;
}
