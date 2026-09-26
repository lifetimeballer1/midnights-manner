import {center,canPlace,stats,housing,assignedWorkers} from './model.js';
import {sfx} from './systems/audio.js';
export class Renderer {
 constructor(canvas,data,images){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.data=data;this.images=images;this.grid=false;this.hover=null;this.selection=null;this.placing=null;this.moving=null;this.tw=43;this.th=22;this.ox=510;this.oy=97;this.shake=0;this.cam={x:10,y:8,zoom:1};this.cx=550;this.cy=320;try{this.calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{this.calm=false;}this.seen=new Map();this.flash=new Map();this.deadAt=new Map();this.tints=new Map();}
 base(x,y){return {x:this.ox+(x-y)*this.tw/2,y:this.oy+(x+y)*this.th/2};}
 camBase(){return this.base(this.cam.x,this.cam.y);}
 project(x,y){const b=this.base(x,y),c=this.camBase(),z=this.cam.zoom;return {x:this.cx+(b.x-c.x)*z,y:this.cy+(b.y-c.y)*z};}
 unproject(x,y){const c=this.camBase(),z=this.cam.zoom,bx=c.x+(x-this.cx)/z,by=c.y+(y-this.cy)/z;return {x:Math.floor((bx-this.ox)/this.tw+(by-this.oy)/this.th),y:Math.floor((by-this.oy)/this.th-(bx-this.ox)/this.tw)};}
 pan(dx,dy){const W=this.data.world.width,H=this.data.world.height;this.cam.x=Math.max(0,Math.min(W,this.cam.x+dx));this.cam.y=Math.max(0,Math.min(H,this.cam.y+dy));}
 zoomBy(f){this.cam.zoom=Math.max(.5,Math.min(2,this.cam.zoom*f));}
 resetCam(){this.cam={x:this.data.world.width/2,y:this.data.world.height/2,zoom:1};}
 cell(event){const r=this.canvas.getBoundingClientRect();return this.unproject((event.clientX-r.left)*this.canvas.width/r.width,(event.clientY-r.top)*this.canvas.height/r.height);}
 diamond(x,y,color,stroke){const c=this.ctx,p=this.project(x,y),z=this.cam.zoom,hw=this.tw/2*z,hh=this.th/2*z;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+hw,p.y+hh);c.lineTo(p.x,p.y+hh*2);c.lineTo(p.x-hw,p.y+hh);c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.6;c.stroke();}}
 sprite(name,x,y,size=56,alpha=1,dy=0){const p=this.project(x,y),img=this.images[name];if(!img)return;const s=size*this.cam.zoom;this.ctx.globalAlpha=alpha;this.ctx.drawImage(img,Math.round(p.x-s/2),Math.round(p.y-s+12*this.cam.zoom+dy),s,s);this.ctx.globalAlpha=1;}
 tree(x,y,n){const c=this.ctx,p=this.project(x,y),h=26+n%3*8;c.fillStyle='#0e1f1833';c.beginPath();c.ellipse(p.x+8,p.y+7,14,5,0,0,Math.PI*2);c.fill();c.fillStyle='#4a3826';c.fillRect(p.x-2,p.y-h/3,4,h/3+6);for(let l=0;l<3;l++){c.fillStyle=['#1f4a34','#2a5f42','#3a7a52'][l];const top=p.y-h+l*8;c.beginPath();c.moveTo(p.x,top);c.lineTo(p.x+14-l*2,top+20);c.lineTo(p.x-14+l*2,top+20);c.closePath();c.fill();}}
 draw(world,time){
  const c=this.ctx;c.clearRect(0,0,1100,740);c.imageSmoothingEnabled=false;this.trackTransitions(world,time);
  if(!this.calm&&this.shake>0.2){c.save();c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);this.shake*=.88;}
  // Ambient moonlit clearing over deep night soil.
  c.fillStyle='#16281f45';c.beginPath();c.ellipse(543,385,410,190,0,0,Math.PI*2);c.fill();
  const W=this.data.world.width,H=this.data.world.height;
  for(let y=-3;y<H+4;y++)for(let x=-3;x<W+4;x++){
   const n=((x*67+y*113+10000)*17)%101, checker=(x+y)%2===0;
   const edge=x<0||y<0||x>=W||y>=H;
   const bounds=world.bounds||{w:20,h:16};
   // Wild rows: inside the map but outside the settled bounds — darker, red grid.
   const usable=edge||(x>=1&&y>=1&&x<=bounds.w-2&&y<=bounds.h-2);
   // Moonlit-night checkerboard: deep pine vs moonlit moss; edges fall off darker.
   const inner=checker?['#2f5240','#335844','#38604a','#2c4e3d'][Math.abs(n)%4]:['#3f6b4e','#45755a','#4c805f','#3a6547'][Math.abs(n)%4];
   const wild=checker?'#24382c':'#2c4433';
   this.diamond(x,y,edge?['#22392e','#1f342a','#263e33'][Math.abs(n)%3]:(usable?inner:wild),this.grid&&!edge?(usable?'#9db87a':'#c9766a'):null);
   if(usable&&!edge){const dx=x-10,dy=y-8;if(dx*dx+dy*dy<17)this.diamond(x,y,'#8a6f4d2e');} // hearth warmth on the village clearing
   if(!edge&&n%5===0){const p=this.project(x+.5,y+.5);c.fillStyle=usable?'#24382c55':'#1a2a2055';c.fillRect(p.x-5,p.y-1,9,3);} // moss blotch
   if(!usable&&!edge&&n%3===0){const p=this.project(x+.5,y+.5);c.fillStyle='#1f4a34';c.beginPath();c.moveTo(p.x,p.y-9);c.lineTo(p.x+6,p.y+2);c.lineTo(p.x-6,p.y+2);c.closePath();c.fill();c.fillStyle='#2a5f42';c.beginPath();c.moveTo(p.x,p.y-5);c.lineTo(p.x+5,p.y+4);c.lineTo(p.x-5,p.y+4);c.closePath();c.fill();} // wild saplings on locked rows
   if(!usable&&!edge&&n%11===0){const p=this.project(x+.5,y+.5);c.fillStyle='#c9766a88';c.font='bold 9px Arial';c.textAlign='center';c.fillText('✦',p.x,p.y+3);c.textAlign='left';}
   if(!edge&&n%9===0){const p=this.project(x+.5,y+.5);c.fillStyle='#6fae7a88';c.fillRect(p.x,p.y,2,3);c.fillRect(p.x+3,p.y-1,1,3);}
   if(!edge&&usable&&n%17===0){const p=this.project(x+.5,y+.5);c.fillStyle=n%34===0?'#c05a4e':'#f2c96e';c.fillRect(p.x-1,p.y-2,2,2);c.fillStyle='#7fbf7a';c.fillRect(p.x,p.y,1,2);} // moonblooms
   if(!edge&&n%7===0){const p=this.project(x+.5,y+.5);c.fillStyle='#7e93a855';c.fillRect(p.x-4,p.y+1,2,1);c.fillRect(p.x+3,p.y-2,1,1);}
   if(!edge&&n%13===0){const p=this.project(x+.5,y+.5);c.fillStyle='#0b122022';c.beginPath();c.ellipse(p.x,p.y+2,6,2.5,0,0,Math.PI*2);c.fill();}
  }
  // Moonlit stream outside the settlement; a readable cool border for the map.
  for(let i=-2;i<W+1;i++){this.diamond(i,H+1+(i%4===0?1:0),'#2e6b7a');const p=this.project(i+.5,H+1.5);const sx=this.calm?0:Math.sin(time/500+i)*3;c.fillStyle='#7fc4d4';c.fillRect(p.x-6+sx,p.y+2,8,1);}
  for(let i=-1;i<W+2;i++){if(i%2!==0)this.tree(i,-1.5,i);if(i%2===0)this.tree(i,-2.5,i+3);if(i%2===0)this.tree(-1.5,i%H,i+2);if(i%3===0)this.tree(-2.5,(i+2)%H,i);if(i%2!==0)this.tree(W+1,i%H,i);if(i%4===0)this.tree(i,H+3,i+1);}
  // Lantern-lit dirt paths join the manor clearing, with a spur to the east fields.
  for(let x=4;x<16;x++)this.diamond(x,11,'#a8895a');for(let y=4;y<11;y++)this.diamond(10,y,'#a8895a');for(let y=8;y<11;y++)this.diamond(13,y,'#a8895a');
  for(let x=4;x<16;x++){const p=this.project(x+.5,11.5);c.fillStyle='#8a6f4d';c.fillRect(p.x-3+((x*67)%5),p.y+((x*113)%3),2,2);}
  for(let y=4;y<11;y++){const p=this.project(10.5,y+.5);c.fillStyle='#8a6f4d';c.fillRect(p.x-3+((y*113)%5),p.y+((y*67)%3),2,2);}
  if(this.placing&&this.hover){const valid=canPlace(world,this.data,this.placing,this.hover.x,this.hover.y,this.moving);const size=this.data.buildings[this.placing].size;for(let y=0;y<size;y++)for(let x=0;x<size;x++)this.diamond(this.hover.x+x,this.hover.y+y,valid?'#69a06bcc':'#c05a4ecc',valid?'#fff6d8':'#ffe3dc');}
  else if(this.hover&&this.grid)this.diamond(this.hover.x,this.hover.y,'#f2ecb988','#fff3c0');
  const drawables=[...world.buildings.map(b=>({kind:'building',value:b,depth:b.x+b.y+this.data.buildings[b.type].size})),...world.troops.map(t=>({kind:'unit',value:t,depth:t.x+t.y+.2})),...world.enemies.map(e=>({kind:'enemy',value:e,depth:e.x+e.y+.2}))].sort((a,b)=>a.depth-b.depth);
  for(const {kind,value:b} of drawables){
   if(kind==='building'){
    const spec=this.data.buildings[b.type],cp=center(b,this.data),size=spec.size===2?93:66;
    const gp=this.project(cp.x,cp.y);
    // Ground shadow anchors every building to the map.
    c.fillStyle='#0b122022';c.beginPath();c.ellipse(gp.x,gp.y+9,size*.5,12,0,0,Math.PI*2);c.fill();
    c.fillStyle='#0b122030';c.beginPath();c.ellipse(gp.x,gp.y+9,size*.36,8,0,0,Math.PI*2);c.fill();
    // Pond shimmer: the water breathes so fishing spots read at a glance.
    if(b.type==='pond'&&b.hp>0){c.save();c.globalAlpha=this.calm?.45:.45+Math.sin(time/600)*.2;c.strokeStyle='#7fc4d4';c.lineWidth=1.5;c.beginPath();c.ellipse(gp.x,gp.y+4,20+(this.calm?0:Math.sin(time/600)*3),7,0,0,Math.PI*2);c.stroke();c.restore();}
    if(this.selection===b.id){
     for(let y=0;y<spec.size;y++)for(let x=0;x<spec.size;x++)this.diamond(b.x+x,b.y+y,'#f0d47e66','#f2c96e');
     for(let y=0;y<spec.size;y++)for(let x=0;x<spec.size;x++)this.diamond(b.x+x,b.y+y,'#ffffff22','#fff3c0');
     // Pulsing selection marker — readable on phones in bright light.
     const bob=this.calm?0:Math.sin(time/300)*2;
     c.fillStyle='#fff3c0';c.beginPath();c.arc(gp.x,gp.y-size-6+bob,3.2,0,Math.PI*2);c.fill();
     c.fillStyle='#1c302c';c.beginPath();c.arc(gp.x,gp.y-size-6+bob,1.4,0,Math.PI*2);c.fill();
     // Name pill so taps answer back with what you picked.
     c.font='bold 11px Arial';const label=spec.name+(b.remaining>0?' · building…':b.hp<=0?' · ruined':'');const wpx=c.measureText(label).width+14;
     c.fillStyle='#1c302cee';c.beginPath();if(c.roundRect)c.roundRect(gp.x-wpx/2,gp.y-size-34+bob,wpx,17,8);else c.rect(gp.x-wpx/2,gp.y-size-34+bob,wpx,17);c.fill();
     c.fillStyle='#f3eddc';c.textAlign='center';c.fillText(label,gp.x,gp.y-size-22+bob);c.textAlign='left';
     // Range preview for defenses so layout choices read at a glance.
     const range=spec.tiers[b.level-1].range;
     if(spec.tiers[b.level-1].damage){c.save();c.globalAlpha=.9;c.strokeStyle='#f2e2a8';c.lineWidth=1.5;c.setLineDash([6,4]);c.beginPath();c.ellipse(gp.x,gp.y,range*this.tw*.72,range*this.th*.72,0,0,Math.PI*2);c.stroke();c.restore();}
    }
    this.sprite(spec.tiers[b.level-1].sprite,cp.x,cp.y,size,b.hp<=0?.3:b.remaining>0?.65:1);
    // Living-village readouts: beds on cottages, gold crew pips on workplaces,
    // and a thin reserve bar on nodes draining below two-thirds.
    const p=this.project(cp.x,cp.y);const p2=p;
    if(spec.housing&&b.hp>0){const hh=housing(world,this.data);c.fillStyle='#1c302cee';c.font='bold 9px Arial';c.textAlign='center';c.fillText(`🛏 ${hh.used}/${hh.beds}`,p2.x,p2.y-size-10);c.textAlign='left';}
    if(spec.workplace&&b.hp>0){const crew=assignedWorkers(world,b.id).length;
     for(let i=0;i<crew;i++){c.fillStyle='#f2c96e';c.beginPath();c.arc(p2.x-(crew*8)/2+i*8+4,p2.y-size-10,3,0,Math.PI*2);c.fill();c.strokeStyle='#1c302c';c.lineWidth=1;c.stroke();}}
    if(b.maxReserve&&b.hp>0){const frac=Math.max(0,Math.min(1,b.reserve/b.maxReserve));
     if(frac<0.66)this.bar(p2.x,p2.y+20,frac,36,frac>0.35?'#c9a44e':'#c9766a');}
    // Chimney smoke: houses breathe. Stateless phase per building, capped to homes.
    if(b.hp>0&&b.remaining<=0&&['hall','cottage','barracks','forge','chapel','farm'].includes(b.type)&&((time/1600)|0+b.id)%3===0){
     const rise=this.calm?6:((time/45+b.id*37)%26);c.globalAlpha=this.calm?.1:.22*(1-rise/30);
     c.fillStyle='#cfd4d6';c.beginPath();c.arc(p.x+4,p.y-size-8-rise,2.5+rise*.08,0,Math.PI*2);c.fill();c.globalAlpha=1;}
    for(let i=0;i<spec.tiers.length;i++){c.fillStyle=i<b.level?'#e9c46a':'#5a6b5533';c.beginPath();c.arc(p.x-(spec.tiers.length*7)/2+i*7+3,p.y-size+4,2.6,0,Math.PI*2);c.fill();}
    if(b.hp<=0){c.fillStyle='#3d2c22ee';const w=52;c.fillRect(p.x-w/2,p.y+16,w,15);c.fillStyle='#ffd9a8';c.font='bold 10px Arial';c.textAlign='center';c.fillText('REPAIR',p.x,p.y+27);c.textAlign='left';}
    if(b.remaining>0){const total=this.data.buildings[b.type].buildSeconds||8;this.bar(p.x,p.y-size+12,1-b.remaining/total,44,'#e9c46a');c.fillStyle='#2f4433';c.font='bold 10px Arial';c.textAlign='center';c.fillText(`${Math.ceil(b.remaining)}s`,p.x,p.y-size+10);c.textAlign='left';}
    else if(b.hp>0&&b.hp<spec.tiers[b.level-1].hp)this.bar(p.x,p.y+14,b.hp/spec.tiers[b.level-1].hp,36,b.hp/spec.tiers[b.level-1].hp>.5?'#9caa66':'#c9766a');
   }else{
    const unit=kind==='unit';if(b.hp<=0){if(!this.calm){const age=time-(this.deadAt.get((unit?'u':'e')+b.id)??time);if(age<450)this.sprite(unit?this.data.troops[b.type].sprite:'raider.png',b.x,b.y,39,1-age/450);}continue;}
    const bob=unit?(this.calm?0:Math.sin(time/450+b.id*1.7)*2*this.cam.zoom):(this.calm?0:Math.abs(Math.sin(time/300+b.id))*2*this.cam.zoom);
    const up=this.project(b.x,b.y);
    c.fillStyle='#0b122018';c.beginPath();c.ellipse(up.x,up.y+7,unit?18:20,7,0,0,Math.PI*2);c.fill();
    c.fillStyle=unit?'#2c3a2c2e':'#5a232633';c.beginPath();c.ellipse(up.x,up.y+7,unit?13:15,5,0,0,Math.PI*2);c.fill();
    if(!unit){c.strokeStyle='#d96a5e';c.lineWidth=1.5;c.beginPath();c.ellipse(up.x,up.y+7,16,6,0,0,Math.PI*2);c.stroke();}
    this.sprite(unit?this.data.troops[b.type].sprite:'raider.png',b.x,b.y,39,1,bob);
    this.spriteFlash(unit?this.data.troops[b.type].sprite:'raider.png',b.x,b.y,39,(unit?'u':'e')+b.id,time,bob);
    const p=this.project(b.x,b.y);
    // Hover attention: a soft ring under whoever your finger is over.
    if(this.hover&&!this.placing&&b.hp>0&&Math.hypot(b.x-(this.hover.x+.5),b.y-(this.hover.y+.5))<.8){c.strokeStyle='#fff3c088';c.lineWidth=1.5;c.beginPath();c.ellipse(up.x,up.y+7,unit?15:17,6,0,0,Math.PI*2);c.stroke();}
    if(unit){
     const item=this.data.items[b.gear];c.save();c.translate(p.x+12,p.y-8+bob);if(b.animation>0)c.rotate(item.animation==='slam'?-1.2:item.animation==='sweep'?(b.animation/.4)*Math.PI-Math.PI/2:Math.sin(b.animation*14)*.7);c.drawImage(this.images[item.sprite],-8,-24,29,29);c.restore();
     if(b.carry>0){c.fillStyle='#d3ae61';c.fillRect(p.x-14,p.y-10+bob,4,5);}
     if(b.hp<stats(b,this.data).hp)this.bar(p.x,p.y+10,b.hp/stats(b,this.data).hp,20,'#80a56b');
     if(this.selection===b.id){c.strokeStyle='#fff3c0';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y+7,17,7,0,0,Math.PI*2);c.stroke();
      c.font='bold 11px Arial';const nm=this.data.troops[b.type].name+(b.order?' · '+b.order.kind:'');const nw=c.measureText(nm).width+14;
      c.fillStyle='#1c302cee';c.beginPath();if(c.roundRect)c.roundRect(p.x-nw/2,p.y-44+bob,nw,17,8);else c.rect(p.x-nw/2,p.y-44+bob,nw,17,8);c.fill();
      c.fillStyle='#f3eddc';c.textAlign='center';c.fillText(nm,p.x,p.y-32+bob);c.textAlign='left';}
     if(b.order){const t=b.order.kind==='move'?`➤ ${Math.round(b.order.x)},${Math.round(b.order.y)}`:b.order.kind==='attack'?'⚔!':'✋';c.fillStyle='#1c302cee';c.font='bold 9px Arial';c.textAlign='center';c.fillText(t,p.x,p.y-22+bob);c.textAlign='left';
      if(b.order.kind==='move'){const q=this.project(b.order.x,b.order.y);c.save();c.strokeStyle='#fff3c0';c.setLineDash([4,3]);c.beginPath();c.moveTo(p.x,p.y-8);c.lineTo(q.x,q.y-8);c.stroke();c.restore();}}
    }else this.bar(p.x,p.y+9,b.hp/b.maxHp,22,'#bd7770');
   }
  }
  if(this.placing&&this.hover){const size=this.data.buildings[this.placing].size,tier=this.data.buildings[this.placing].tiers[0];this.sprite(tier.sprite,this.hover.x+size/2,this.hover.y+size/2,size===2?93:66,this.calm?.5:.5+Math.sin(time/200)*.08);if(tier.damage){const gp=this.project(this.hover.x+size/2,this.hover.y+size/2);c.save();c.globalAlpha=.85;c.strokeStyle='#f2e2a8';c.lineWidth=1.5;c.setLineDash([6,4]);c.beginPath();c.ellipse(gp.x,gp.y,tier.range*this.tw*.72,tier.range*this.th*.72,0,0,Math.PI*2);c.stroke();c.restore();}}
  for(const e of world.effects){const a=this.project(e.x,e.y),b=this.project(e.tx,e.ty);if(e.kind==='place'){const t=1-Math.max(0,e.life)/.6;c.globalAlpha=Math.max(0,e.life)/.6;c.strokeStyle='#ffe9a8';c.lineWidth=3;c.beginPath();c.ellipse(b.x,b.y-6,8+t*34,4+t*15,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;if(e.life>.5)this.shake=Math.max(this.shake,4);continue;}
   if(e.kind==='splash'){const t=1-Math.max(0,e.life)/.5;c.globalAlpha=Math.max(0,e.life)/.5;c.strokeStyle='#7fc4d4';c.lineWidth=2;for(let s=0;s<2;s++){c.beginPath();c.ellipse(b.x,b.y-8,6+t*(10+s*7),3+t*(4+s*3),0,Math.PI,Math.PI*2);c.stroke();}c.fillStyle='#dff3f8';c.fillRect(b.x-1,b.y-14-t*8,2,3);c.globalAlpha=1;continue;}
   if(e.kind==='float'||e.kind==='dmg'){const rise=1-Math.max(0,e.life)/(e.kind==='float'?.9:.7);c.globalAlpha=Math.min(1,e.life*2.2);c.font=`bold ${e.kind==='dmg'?13:14}px Arial`;c.textAlign='center';c.fillStyle='#1c302c';c.fillText(e.text,b.x+1,b.y-30-rise*22+1);c.fillStyle=e.kind==='dmg'?'#ffd9a8':(e.color||'#ffe9a8');c.fillText(e.text,b.x,b.y-30-rise*22);c.textAlign='left';c.globalAlpha=1;continue;}
   if(e.kind==='sparkle'){c.globalAlpha=Math.max(0,e.life)/.4;c.strokeStyle='#fff3c0';c.lineWidth=2;for(let s=0;s<4;s++){const ang=s*Math.PI/2+time/300,l=4+(0.4-Math.max(0,e.life))*30;c.beginPath();c.moveTo(b.x+Math.cos(ang)*l,b.y-14+Math.sin(ang)*l*.6);c.lineTo(b.x+Math.cos(ang)*(l+5),b.y-14+Math.sin(ang)*(l+5)*.6);c.stroke();}c.globalAlpha=1;continue;}
   if(e.kind==='fanfare'){c.globalAlpha=Math.min(1,e.life*1.5);c.fillStyle='#f2c96e';for(let s=0;s<6;s++){const rise=(0.8-Math.max(0,e.life))*46;c.fillRect(b.x-14+s*6,b.y-44-rise-(s%3)*7,3,3);}c.globalAlpha=1;continue;}
   if(e.kind==='hit'){c.globalAlpha=Math.max(0,e.life)/.18;c.fillStyle='#fff';c.beginPath();c.arc(b.x,b.y-10,9,0,Math.PI*2);c.fill();c.globalAlpha=1;continue;}
   if(e.kind==='poof'){const t=1-Math.max(0,e.life)/.4;c.globalAlpha=Math.max(0,e.life)/.4;c.strokeStyle='#b8c4bb';c.lineWidth=2;c.beginPath();c.ellipse(b.x,b.y-8,6+t*12,4+t*6,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;continue;}
   if(e.kind==='slam')this.shake=Math.max(this.shake,3);c.globalAlpha=e.life/.3;c.strokeStyle=e.kind==='heal'?'#e4efb0':e.kind==='arrow'?'#f6ecbb':'#f5d78d';c.lineWidth=e.kind==='slam'?5:2;c.beginPath();if(e.kind==='heal'||e.kind==='slam'){c.ellipse(b.x,b.y-8,25,12,0,0,Math.PI*2);}else{c.moveTo(a.x,a.y-12);c.lineTo(b.x,b.y-12);}c.stroke();c.globalAlpha=1;}
  // Raid readability: red western edge + marching chevrons while raiders live.
  if(world.enemies.length){
   const pulse=this.calm?.14:.14+Math.sin(time/300)*.05;
   const g=c.createLinearGradient(0,0,150,0);g.addColorStop(0,`rgba(178,60,50,${pulse+.18})`);g.addColorStop(1,'rgba(178,60,50,0)');
   c.fillStyle=g;c.fillRect(0,0,150,740);
   c.fillStyle='#b23c32';c.font='bold 14px Arial';c.textAlign='center';
   for(let y=2;y<16;y+=2){const p=this.project(.6,y+.5);c.fillText('▶',p.x-30+(this.calm?0:Math.sin(time/250+y)*5),p.y);}
   c.textAlign='left';
  }
 // Vignette + moon glow: depth and night air over the whole map (static, motion-safe).
  {const vg=c.createRadialGradient(550,370,260,550,370,640);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(5,10,8,0.42)');c.fillStyle=vg;c.fillRect(0,0,1100,740);
   const mg=c.createRadialGradient(180,80,10,180,80,320);mg.addColorStop(0,'rgba(242,201,110,0.10)');mg.addColorStop(1,'rgba(242,201,110,0)');c.fillStyle=mg;c.fillRect(0,0,1100,740);}
 // Cheap day/night grade: slow 3-minute cycle, static per frame (motion-safe).
  {const dayT=((world.elapsed||0)%180)/180;let tc=null,ta=0;
   if(dayT<.15){tc='#f2c96e';ta=.07;}else if(dayT>=.55&&dayT<.7){tc='#c05a4e';ta=.08;}else if(dayT>=.7){tc='#1a2c4e';ta=.12;}
   if(tc){c.globalAlpha=ta;c.fillStyle=tc;c.fillRect(0,0,1100,740);c.globalAlpha=1;}}
  // Raid event banners: incoming warning, then wave + live kill counter.
  const banner=(line,sub,color)=>{c.fillStyle=color;c.fillRect(280,52,540,66);c.strokeStyle='#f2c96e';c.lineWidth=3;c.strokeRect(280,52,540,66);c.lineWidth=1;c.strokeStyle='#f2c96e88';c.strokeRect(286,58,528,54);c.fillStyle='#f6ecbb';c.font='bold 20px Arial';c.textAlign='center';c.fillText(line,550,80);c.font='bold 13px Arial';c.fillStyle='#e8dcc0';c.fillText(sub,550,103);c.textAlign='left';};
  if(world.raidPending)banner('⚠ RAIDERS INCOMING ⚠',`${world.raidPending.count} raiders from the west — ${Math.ceil(world.raidPending.timer)}…`,'#7a2e26ee');
  else if(world.enemies.length&&(world.raidAge??99)<5)banner(`WAVE ${world.wave} — FIGHT!`,`${world.enemies.length} raiders remain · ${world.raidKills??0} slain`,'#3d3220ee');
  if(!this.calm&&this.shake>0.2)c.restore();else this.shake=0;
  if(!this.calm)for(let i=0;i<8;i++){const p=this.project(4+i*1.8,4+(i*3)%9);c.globalAlpha=.25+Math.sin(time/1000+i)*.2;c.fillStyle='#fcf4c0';c.fillRect(p.x+Math.sin(time/1500+i)*8,p.y-25,2,2);}c.globalAlpha=1;
  // Butterflies by day: three gold wanderers over the fields.
  if(!this.calm)for(let i=0;i<3;i++){const bp=this.project(5+4*Math.sin(time/3100+i*2.1),6+3*Math.cos(time/2600+i*1.7));const flap=Math.abs(Math.sin(time/180+i))*2;c.fillStyle='#f2c96ecc';c.fillRect(bp.x-2-flap,bp.y,2,2);c.fillRect(bp.x+flap,bp.y,2,2);}
 }
 // Juice: renderer-local transition detection. Simulation untouched — the
 // renderer watches hp/remaining edges and spawns its own capped effects.
 trackTransitions(world,time){
  const alive=new Set();
  for(const b of world.buildings){
   const key='b'+b.id;alive.add(key);
   const prev=this.seen.get(key),cp=center(b,this.data);
   if(prev){
    if(prev.hp>0&&b.hp<=0){this.burst(world,cp.x,cp.y,cp.x,cp.y,'poof',.4);this.burst(world,cp.x,cp.y,cp.x,cp.y,'hit',.18);if(!this.calm)this.shake=Math.max(this.shake,6);sfx.destroy();}
    else if(b.hp<prev.hp&&time>(this.flash.get(key)||0)){this.burst(world,cp.x,cp.y,cp.x,cp.y,'hit',.18);if(!this.calm)this.shake=Math.max(this.shake,2.5);this.flash.set(key,time+200);sfx.hit();}
    if(prev.remaining>0&&!(b.remaining>0)){this.burst(world,cp.x,cp.y,cp.x,cp.y,'sparkle',.4);sfx.buildDone();}
   }
   this.seen.set(key,{hp:b.hp,remaining:b.remaining});
  }
  for(const u of world.troops){
   const key='u'+u.id;alive.add(key);
   const prev=this.seen.get(key);
   if(prev){
    if(prev.hp>0&&u.hp<=0){this.deadAt.set(key,time);this.burst(world,u.x,u.y,u.x,u.y,'poof',.4);}
    else if(u.hp<prev.hp)this.flash.set(key,time+150);
   }
   this.seen.set(key,{hp:u.hp});
  }
  for(const e of world.enemies){
   const key='e'+e.id;alive.add(key);
   const prev=this.seen.get(key);
   if(prev&&e.hp<prev.hp)this.flash.set(key,time+150);
   this.seen.set(key,{hp:e.hp});
  }
  for(const key of [...this.seen.keys()])if(!alive.has(key)){this.seen.delete(key);this.flash.delete(key);}
  for(const [key,until] of [...this.flash.entries()])if(time>until+4000)this.flash.delete(key);
  for(const [key,t0] of [...this.deadAt.entries()])if(time-t0>4000)this.deadAt.delete(key);
 }
 burst(world,x,y,tx,ty,kind,life){if(world.effects.length>=48)return;world.effects.push({x,y,tx,ty,kind,life});}
 tint(name){let t=this.tints.get(name);if(t!==undefined)return t;const img=this.images[name];t=null;try{if(img){t=document.createElement('canvas');t.width=img.naturalWidth||32;t.height=img.naturalHeight||32;const g=t.getContext('2d');g.drawImage(img,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#fff';g.fillRect(0,0,t.width,t.height);}}catch{t=null;}this.tints.set(name,t);return t;}
 spriteFlash(name,x,y,size,key,time,dy=0){const until=this.flash.get(key);if(!until||time>until)return;const t=this.tint(name);if(!t)return;const p=this.project(x,y),s=size*this.cam.zoom,c=this.ctx;c.globalAlpha=Math.min(1,(until-time)/150);c.drawImage(t,Math.round(p.x-s/2),Math.round(p.y-s+12*this.cam.zoom+dy),s,s);c.globalAlpha=1;}
 bar(x,y,fraction,width,color){const c=this.ctx;c.fillStyle='#43573d66';c.fillRect(x-width/2,y,width,3);c.fillStyle=color;c.fillRect(x-width/2,y,width*Math.max(0,Math.min(1,fraction)),3);}
}
