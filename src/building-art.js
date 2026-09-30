// Original Canvas architecture: connected defenses follow the same isometric
// projection and tile footprint as collision/placement. No commercial art.
const PALETTES=[
 {top:'#d5ad70',left:'#976436',right:'#674323',trim:'#e6ca8b'},
 {top:'#d1d6d3',left:'#819298',right:'#52666c',trim:'#edf0d5'},
 {top:'#677d91',left:'#354757',right:'#23323e',trim:'#e4b957'}
];
function polygon(c,points,color){c.fillStyle=color;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();}
function box(r,x,y,w,d,h,palette){
 const c=r.ctx,z=r.cam.zoom,base=[r.project(x,y),r.project(x+w,y),r.project(x+w,y+d),r.project(x,y+d)],top=base.map(p=>({x:p.x,y:p.y-h*z}));
 polygon(c,[top[1],top[2],base[2],base[1]],palette.right);
 polygon(c,[top[2],top[3],base[3],base[2]],palette.left);
 polygon(c,top,palette.top);
 c.strokeStyle=palette.trim;c.lineWidth=Math.max(.6,z*.5);c.beginPath();c.moveTo(top[3].x,top[3].y);c.lineTo(top[2].x,top[2].y);c.lineTo(top[1].x,top[1].y);c.stroke();
}
import {isWall} from './systems/walls.js';
export {isWall};
export function wallNeighbors(b,world){return [[0,-1],[-1,0],[1,0],[0,1]].filter(([dx,dy])=>world.buildings.some(n=>isWall(n)&&n.hp>0&&n.x===b.x+dx&&n.y===b.y+dy));}
export function drawWall(r,b,world){
 const c=r.ctx,p=PALETTES[Math.min(2,b.level-1+(b.type==='stonewall'||b.type==='rampart'?1:0))],height=10+b.level*5+(b.type==='stonewall'?4:0)+(b.type==='rampart'?3:0);
 // Gatehouse: open middle, heavy posts — passage for friends, a wall for raiders.
 if(b.type==='gate'){c.save();c.globalAlpha=b.hp<=0?.3:b.remaining>0?.65:1;
  box(r,b.x+.12,b.y+.12,.76,.76,3,{top:'#8d8973',left:'#645e4c',right:'#494c40',trim:'#b6ae8c'});
  for(const [ox,oy,w,d]of[[.14,.14,.2,.2],[.66,.14,.2,.2],[.14,.66,.2,.2],[.66,.66,.2,.2]])box(r,b.x+ox,b.y+oy,w,d,height+2,p);
   box(r,b.x+.12,b.y+.12,.76,.76,height+6,{...p,top:p.trim});
   if(b.level>=3)box(r,b.x+.4,b.y+.4,.2,.2,height+10,{...p,top:p.trim,left:'#b88636',right:'#805b28'});
   if(b.level>=5)for(const f of [.3,.55])box(r,b.x+f,b.y+.14,.06,.72,4,{top:'#45525a',left:'#39434b',right:'#2c343b',trim:'#6a7a86'});
   if(b.level>=6)box(r,b.x+.3,b.y+.3,.4,.4,height+14,{...p,top:'#c86750',left:'#b88636',right:'#805b28'});
  c.restore();return;}
 c.save();c.globalAlpha=b.hp<=0?.3:b.remaining>0?.65:1;
 box(r,b.x+.12,b.y+.12,.76,.76,3,{top:'#8d8973',left:'#645e4c',right:'#494c40',trim:'#b6ae8c'});
 const neighbors=b.hp>0?wallNeighbors(b,world):[];
 const beam=([dx,dy])=>{
  const x=b.x+.5+Math.min(0,dx*.55)-.13,y=b.y+.5+Math.min(0,dy*.55)-.13;
  box(r,x,y,.26+Math.abs(dx)*.55,.26+Math.abs(dy)*.55,height-4,p);
  if(b.level>=2)box(r,x,y,.26+Math.abs(dx)*.55,.26+Math.abs(dy)*.55,height-7,{...p,top:p.trim});
  if(b.level>=5)box(r,x+.03,y+.03,.2+Math.abs(dx)*.55,.2+Math.abs(dy)*.55,height-10,{...p,top:'#b88636'});
 };
 neighbors.filter(([x,y])=>x+y<0).forEach(beam);
 box(r,b.x+.27,b.y+.27,.46,.46,height,p);
 if(b.level===1&&b.type!=='stonewall'){box(r,b.x+.34,b.y+.34,.32,.32,height+3,p);}
  else{
   for(const [dx,dy] of [[.24,.24],[.57,.24],[.24,.57],[.57,.57]])box(r,b.x+dx,b.y+dy,.19,.19,height+4,p);
   if(b.level>=3)box(r,b.x+.36,b.y+.36,.28,.28,height+6,{...p,top:p.trim,left:'#b88636',right:'#805b28'});
   if(b.level>=6)box(r,b.x+.44,b.y+.44,.12,.12,height+14,{...p,top:'#c86750',left:'#b88636',right:'#805b28'});
  }
 neighbors.filter(([x,y])=>x+y>0).forEach(beam);
 c.restore();
}
export function drawFoundation(r,b,spec){
 if(isWall(b)||b.type==='trap'||b.type==='pond')return;
 const stone=b.level>=2||['hall','tower','mine','forge','armory'].includes(b.type),p=stone?{top:'#a7aa91',left:'#697767',right:'#465d51',trim:'#d8d0a2'}:{top:'#b79963',left:'#826443',right:'#5e5238',trim:'#d6bd7a'};
 r.ctx.save();r.ctx.globalAlpha=b.hp<=0?.3:1;
 const pad=.13,size=spec.size-pad*2;
 box(r,b.x+pad,b.y+pad,size,size,2+b.level*1.5,p);
 if(b.level>=3){for(const [x,y] of [[pad,pad],[spec.size-.32,pad],[pad,spec.size-.32],[spec.size-.32,spec.size-.32]])box(r,b.x+x,b.y+y,.2,.2,9,{...p,top:'#ebcb76'});}
 r.ctx.restore();
}
function roof(r,x,y,w,d,h,rise,color){
 const at=(x,y,z)=>{const p=r.project(x,y);return {x:p.x,y:p.y-z*r.cam.zoom};};
 const a=at(x,y,h),b=at(x+w,y,h),c=at(x+w,y+d,h),e=at(x,y+d,h),u=at(x+w/2,y,h+rise),v=at(x+w/2,y+d,h+rise);
 polygon(r.ctx,[a,u,v,e],color.light);polygon(r.ctx,[u,b,c,v],color.dark);polygon(r.ctx,[e,v,c],color.face);
 r.ctx.strokeStyle=color.edge;r.ctx.lineWidth=r.cam.zoom;r.ctx.beginPath();r.ctx.moveTo(u.x,u.y);r.ctx.lineTo(v.x,v.y);r.ctx.lineTo(c.x,c.y);r.ctx.stroke();
 for(let f=.25;f<1;f+=.25){const left={x:u.x+(a.x-u.x)*f,y:u.y+(a.y-u.y)*f},right={x:v.x+(e.x-v.x)*f,y:v.y+(e.y-v.y)*f};r.ctx.strokeStyle=color.dark;r.ctx.lineWidth=.5*r.cam.zoom;r.ctx.beginPath();r.ctx.moveTo(left.x,left.y);r.ctx.lineTo(right.x,right.y);r.ctx.stroke();}
}
function frontPanel(r,x,y,w,bottom,height,color){
 const p=r.project(x,y),q=r.project(x+w,y),z=r.cam.zoom;
 polygon(r.ctx,[{x:p.x,y:p.y-bottom*z},{x:q.x,y:q.y-bottom*z},{x:q.x,y:q.y-(bottom+height)*z},{x:p.x,y:p.y-(bottom+height)*z}],color);
}
export function drawArchitecture(r,b,spec){
 if(!['hall','barracks','cottage','tower','farm'].includes(b.type))return false;
 const c=r.ctx,s=spec.size,l=b.level;c.save();c.globalAlpha=b.hp<=0?.3:b.remaining>0?.65:1;
 const stone={top:'#c3c9bd',left:'#9ba798',right:'#677d77',trim:'#e6d9b0'},wood={top:'#d2ae77',left:'#b98951',right:'#795633',trim:'#efcb89'};
 if(b.type==='farm'){
  box(r,b.x+.2,b.y+.2,s-.4,s-.4,5,{top:'#644c2f',left:'#887044',right:'#493e29',trim:'#d2b47d'});
  for(let x=.35;x<s-.2;x+=.26)for(let y=.35;y<s-.2;y+=.3){const p=r.project(b.x+x,b.y+y),h=(5+l*2)*r.cam.zoom;c.strokeStyle=l===1?'#b3c46c':'#e7c46d';c.lineWidth=2*r.cam.zoom;c.beginPath();c.moveTo(p.x,p.y-5*r.cam.zoom);c.lineTo(p.x,p.y-h);c.stroke();c.fillStyle='#ffe098';c.fillRect(p.x-r.cam.zoom,p.y-h,2*r.cam.zoom,3*r.cam.zoom);}
  if(l>=2){box(r,b.x+.08,b.y+.13,.13,s-.26,9,wood);box(r,b.x+s-.21,b.y+.13,.13,s-.26,9,wood);}
  if(l>=3){box(r,b.x+s-.4,b.y+.25,.18,.18,32,wood);const p=r.project(b.x+s-.31,b.y+.34);c.strokeStyle='#e5ddbd';c.lineWidth=3*r.cam.zoom;c.beginPath();c.moveTo(p.x-8*r.cam.zoom,p.y-25*r.cam.zoom);c.lineTo(p.x+8*r.cam.zoom,p.y-25*r.cam.zoom);c.stroke();}
 }else if(b.type==='tower'){
  const width=.46+l*.1,x=b.x+(1-width)/2,y=b.y+(1-width)/2,h=26+l*8;
  box(r,x,y,width,width,h,l===1?wood:stone);box(r,x-.1,y-.1,width+.2,width+.2,h+4,l===1?wood:stone);
  for(const [dx,dy] of [[-.1,-.1],[width-.08,-.1],[-.1,width-.08],[width-.08,width-.08]])box(r,x+dx,y+dy,.18,.18,h+11,l===1?wood:stone);
  frontPanel(r,x+width*.4,y+width+.01,.13,15,9,'#283a34');
  if(l===3){const p=r.project(b.x+.5,b.y+.5);c.strokeStyle='#e8c768';c.lineWidth=3*r.cam.zoom;c.beginPath();c.moveTo(p.x-9*r.cam.zoom,p.y-(h+9)*r.cam.zoom);c.lineTo(p.x+9*r.cam.zoom,p.y-(h+9)*r.cam.zoom);c.moveTo(p.x,p.y-(h+3)*r.cam.zoom);c.lineTo(p.x,p.y-(h+18)*r.cam.zoom);c.stroke();}
 }else{
  const pad=.25,w=s-.5,x=b.x+pad,y=b.y+pad,h=15+l*5,wall=l===1?wood:stone;
  box(r,x,y,w,w,h,wall);
  const color=b.type==='barracks'?{light:'#bd6860',dark:'#7b3d40',face:'#a65a4d',edge:'#e5a172'}:b.type==='cottage'?{light:'#a8aa63',dark:'#656d45',face:'#9b995f',edge:'#d5cf89'}:{light:'#729496',dark:'#3f626b',face:'#567d80',edge:'#b3c3ae'};
  roof(r,x-.1,y-.1,w+.2,w+.2,h,10+l*3,color);
  frontPanel(r,x+w*.38,y+w+.015,w*.24,3,14,'#493925');frontPanel(r,x+w*.45,y+w+.025,w*.1,4,12,'#6a5032');
  for(const f of [.12,.76]){frontPanel(r,x+w*f,y+w+.02,w*.13,12,6,'#344a42');frontPanel(r,x+w*f+.025,y+w+.025,w*.08,13,4,'#ffe2a0');}
  if(l>=2){box(r,x+w*.75,y+.15,.2,.2,h+15,stone);box(r,x+w*.71,y+.11,.28,.28,h+17,{...stone,top:'#414f4b'});}
  if(l>=3){const tx=x+w-.3,ty=y+w-.3;box(r,tx,ty,.42,.42,h+10,stone);roof(r,tx-.05,ty-.05,.52,.52,h+10,11,{light:'#b56c54',dark:'#764439',face:'#a35d47',edge:'#e4b276'});const p=r.project(tx+.21,ty+.21);c.strokeStyle='#f0d47b';c.lineWidth=1.5*r.cam.zoom;c.beginPath();c.moveTo(p.x,p.y-(h+20)*r.cam.zoom);c.lineTo(p.x,p.y-(h+34)*r.cam.zoom);c.stroke();polygon(c,[{x:p.x,y:p.y-(h+34)*r.cam.zoom},{x:p.x+10*r.cam.zoom,y:p.y-(h+31)*r.cam.zoom},{x:p.x,y:p.y-(h+27)*r.cam.zoom}],'#c86750');}
 }
 c.restore();return true;
}
