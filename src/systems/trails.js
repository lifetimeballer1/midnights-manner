// Sparse half-tile desire paths. Only movement in the simulation deposits wear.
export const TRAIL_THRESHOLDS=Object.freeze([3,15,45]);
export const TRAIL_BONUSES=Object.freeze([1,1.025,1.07,1.11]);
export const TRAIL_MAX=100;
const SCALE=2,GAIN=.4,RECOVERY=.00008,revisions=new WeakMap(),sweeps=new WeakMap();
export function trailStage(wear){return wear>=45?3:wear>=15?2:wear>=3?1:0;}
function strength(e,now){return e?e[0]>=15?e[0]:Math.max(0,e[0]-Math.max(0,now-e[1])*RECOVERY):0;}
export function trailRevision(world){return revisions.get(world)||0;}
function changed(world){revisions.set(world,trailRevision(world)+1);}
export function normalizeTrails(world,data){
 const out={},src=world.trails,now=Math.max(0,world.elapsed||0),W=data.world.width*SCALE,H=data.world.height*SCALE;
 if(src&&typeof src==='object'&&!Array.isArray(src))for(const [key,e] of Object.entries(src)){
  if(!/^\d+,\d+$/.test(key)||!Array.isArray(e)||!Number.isFinite(e[0])||e[0]<=0)continue;
  const [x,y]=key.split(',').map(Number);if(x>=W||y>=H||key!==`${x},${y}`)continue;
  out[key]=[Math.min(TRAIL_MAX,e[0]),Number.isFinite(e[1])?Math.max(0,Math.min(now,e[1])):now];
 }
 world.trails=out;changed(world);return out;
}
export function trailWearAt(world,x,y){return strength(world.trails?.[`${Math.floor(x*SCALE)},${Math.floor(y*SCALE)}`],world.elapsed||0);}
export function trailMultiplier(world,x,y,friendly=true){return friendly?TRAIL_BONUSES[trailStage(trailWearAt(world,x,y))]:1;}
export function recordTravel(world,data,x0,y0,x1,y1){
 if(![x0,y0,x1,y1].every(Number.isFinite))return 0;
 const dx=x1-x0,dy=y1-y0,d=Math.hypot(dx,dy);if(d<1e-8)return 0;
 // Exact boundary intersections make distance accumulation independent of
 // simulation subdivision. Never sample once per rendered frame.
 const cuts=[0,1];
 for(const [a,b,delta,limit] of [[x0,x1,dx,data.world.width],[y0,y1,dy,data.world.height]])if(delta)for(let k=Math.max(0,Math.floor(Math.min(a,b)*SCALE)+1);k<Math.min(limit*SCALE,Math.max(a,b)*SCALE);k++){
  const t=(k/SCALE-a)/delta;if(t>0&&t<1)cuts.push(t);
 }
 cuts.sort((a,b)=>a-b);world.trails??={};const now=world.elapsed||0;
 for(let i=1;i<cuts.length;i++){
  const a=cuts[i-1],b=cuts[i];if(b-a<1e-10)continue;
  const x=Math.floor((x0+dx*(a+b)/2)*SCALE),y=Math.floor((y0+dy*(a+b)/2)*SCALE);
  if(x<0||y<0||x>=data.world.width*SCALE||y>=data.world.height*SCALE)continue;
  const key=`${x},${y}`,old=strength(world.trails[key],now),wear=Math.min(TRAIL_MAX,old+d*(b-a)*GAIN);
  world.trails[key]=[wear,now];if(trailStage(old)!==trailStage(wear))changed(world);
 }
 return d;
}
export function tickTrails(world){
 const now=world.elapsed||0;if(now-(sweeps.get(world)||0)<60)return;sweeps.set(world,now);
 for(const [key,e] of Object.entries(world.trails||{})){
  const wear=strength(e,now);if(trailStage(e[0])!==trailStage(wear))changed(world);
  if(wear<=0)delete world.trails[key];else world.trails[key]=[wear,now];
 }
}
// Ground polygons join neighboring cells without square tile borders. They
// share the static mesh cache: only tier crossings trigger new geometry.
export function addTrailGeometry(s,world){
 const old=s.owner;s.owner=null;
 for(const [key,e] of Object.entries(world.trails||{})){
  const stage=trailStage(strength(e,world.elapsed||0));if(!stage)continue;
  const [ix,iy]=key.split(',').map(Number),x=(ix+.5)/SCALE,y=(iy+.5)/SCALE,p=s.r.project(x,y);
  if(p.x<-40||p.y<-40||p.x>s.r.width+40||p.y>s.r.height+40)continue;
  const seed=((ix*31+iy*17)%13)/13,r=.16+stage*.033,color=['','#7f8159','#8c7654','#a08c68'][stage];
  s.face(Array.from({length:8},(_,i)=>{const a=i*Math.PI/4,rad=r*(.91+((i*7+seed*13)%5)*.035);return [x+Math.cos(a)*rad,y+Math.sin(a)*rad,.013];}),color,false);
  for(const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]){
   if(trailStage(strength(world.trails[`${ix+dx},${iy+dy}`],world.elapsed||0))<1)continue;
   const nx=x+dx/SCALE,ny=y+dy/SCALE,len=Math.hypot(dx,dy),sx=-dy/len*r*.7,sy=dx/len*r*.7;
   s.face([[x+sx,y+sy,.013],[x-sx,y-sy,.013],[nx-sx,ny-sy,.013],[nx+sx,ny+sy,.013]],color,false);
  }
  if(stage===3&&s.r.cam.zoom>=1.2){
   const vertical=world.trails[`${ix},${iy+1}`]&&!world.trails[`${ix+1},${iy}`];
   for(const off of [-.075,.075]){const points=[[-.14,off],[.14,off],[.14,off+.018],[-.14,off+.018]];s.face(points.map(([a,b])=>[x+(vertical?-b:a),y+(vertical?a:b),.015]),'#88795e',false);}
   if((ix+iy)%5===0)s.box(x+.12,y+.09,.014,.035,.025,.012,'#b4afa0');
  }
 }
 s.owner=old;
}
