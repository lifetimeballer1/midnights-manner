import {center,canPlace,stats} from './model.js';
export class Renderer {
 constructor(canvas,data,images){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.data=data;this.images=images;this.grid=false;this.hover=null;this.selection=null;this.placing=null;this.moving=null;this.tw=43;this.th=22;this.ox=510;this.oy=97;this.shake=0;try{this.calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{this.calm=false;}}
 project(x,y){return {x:this.ox+(x-y)*this.tw/2,y:this.oy+(x+y)*this.th/2};}
 unproject(x,y){return {x:Math.floor((x-this.ox)/this.tw+(y-this.oy)/this.th),y:Math.floor((y-this.oy)/this.th-(x-this.ox)/this.tw)};}
 cell(event){const r=this.canvas.getBoundingClientRect();return this.unproject((event.clientX-r.left)*this.canvas.width/r.width,(event.clientY-r.top)*this.canvas.height/r.height);}
 diamond(x,y,color,stroke){const c=this.ctx,p=this.project(x,y);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+this.tw/2,p.y+this.th/2);c.lineTo(p.x,p.y+this.th);c.lineTo(p.x-this.tw/2,p.y+this.th/2);c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.6;c.stroke();}}
 sprite(name,x,y,size=56,alpha=1){const p=this.project(x,y),img=this.images[name];if(!img)return;this.ctx.globalAlpha=alpha;this.ctx.drawImage(img,Math.round(p.x-size/2),Math.round(p.y-size+12),size,size);this.ctx.globalAlpha=1;}
 tree(x,y,n){const c=this.ctx,p=this.project(x,y),h=26+n%3*8;c.fillStyle='#0e1f1833';c.beginPath();c.ellipse(p.x+8,p.y+7,14,5,0,0,Math.PI*2);c.fill();c.fillStyle='#4a3826';c.fillRect(p.x-2,p.y-h/3,4,h/3+6);for(let l=0;l<3;l++){c.fillStyle=['#1f4a34','#2a5f42','#3a7a52'][l];const top=p.y-h+l*8;c.beginPath();c.moveTo(p.x,top);c.lineTo(p.x+14-l*2,top+20);c.lineTo(p.x-14+l*2,top+20);c.closePath();c.fill();}}
 draw(world,time){
  const c=this.ctx;c.clearRect(0,0,1100,740);c.imageSmoothingEnabled=false;
  if(!this.calm&&this.shake>0.2){c.save();c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);this.shake*=.88;}
  // Ambient moonlit clearing over deep night soil.
  c.fillStyle='#16281f45';c.beginPath();c.ellipse(543,385,410,190,0,0,Math.PI*2);c.fill();
  for(let y=-3;y<20;y++)for(let x=-3;x<24;x++){
   const n=((x*67+y*113+10000)*17)%101, checker=(x+y)%2===0;
   const edge=x<0||y<0||x>=20||y>=16;
   // Moonlit-night checkerboard: deep pine vs moonlit moss; edges fall off darker.
   const inner=checker?['#2f5240','#335844','#38604a','#2c4e3d'][Math.abs(n)%4]:['#3f6b4e','#45755a','#4c805f','#3a6547'][Math.abs(n)%4];
   this.diamond(x,y,edge?['#22392e','#1f342a','#263e33'][Math.abs(n)%3]:inner,this.grid&&!edge?'#9db87a':null);
   if(!edge&&n%9===0){const p=this.project(x+.5,y+.5);c.fillStyle='#6fae7a88';c.fillRect(p.x,p.y,2,3);c.fillRect(p.x+3,p.y-1,1,3);}
  }
  // Moonlit stream outside the settlement; a readable cool border for the map.
  for(let i=-2;i<21;i++){this.diamond(i,17+(i%4===0?1:0),'#2e6b7a');const p=this.project(i+.5,17.5);c.fillStyle='#7fc4d4';c.fillRect(p.x-6,p.y+2,8,1);}
  for(let i=0;i<20;i++){if(i%3!==0)this.tree(i,-1.5,i);if(i%2===0)this.tree(-1.5,i%16,i+2);if(i%3===0)this.tree(21,i%16,i);}
  // Lantern-lit dirt paths join the manor clearing, with a spur to the east fields.
  for(let x=4;x<16;x++)this.diamond(x,11,'#a8895a');for(let y=4;y<11;y++)this.diamond(10,y,'#a8895a');for(let y=8;y<11;y++)this.diamond(13,y,'#a8895a');
  if(this.placing&&this.hover){const valid=canPlace(world,this.data,this.placing,this.hover.x,this.hover.y,this.moving);const size=this.data.buildings[this.placing].size;for(let y=0;y<size;y++)for(let x=0;x<size;x++)this.diamond(this.hover.x+x,this.hover.y+y,valid?'#69a06bcc':'#c05a4ecc',valid?'#fff6d8':'#ffe3dc');}
  else if(this.hover&&this.grid)this.diamond(this.hover.x,this.hover.y,'#f2ecb988','#fff3c0');
  const drawables=[...world.buildings.map(b=>({kind:'building',value:b,depth:b.x+b.y+this.data.buildings[b.type].size})),...world.troops.map(t=>({kind:'unit',value:t,depth:t.x+t.y+.2})),...world.enemies.map(e=>({kind:'enemy',value:e,depth:e.x+e.y+.2}))].sort((a,b)=>a.depth-b.depth);
  for(const {kind,value:b} of drawables){
   if(kind==='building'){
    const spec=this.data.buildings[b.type],cp=center(b,this.data),size=spec.size===2?93:66;
    const gp=this.project(cp.x,cp.y);
    // Ground shadow anchors every building to the map.
    c.fillStyle='#2c3a2c33';c.beginPath();c.ellipse(gp.x,gp.y+9,size*.42,10,0,0,Math.PI*2);c.fill();
    if(this.selection===b.id){
     for(let y=0;y<spec.size;y++)for(let x=0;x<spec.size;x++)this.diamond(b.x+x,b.y+y,'#f0d47e99','#fff3c0');
     // Range preview for defenses so layout choices read at a glance.
     const range=spec.tiers[b.level-1].range;
     if(spec.tiers[b.level-1].damage){c.save();c.globalAlpha=.9;c.strokeStyle='#f2e2a8';c.lineWidth=1.5;c.setLineDash([6,4]);c.beginPath();c.ellipse(gp.x,gp.y,range*this.tw*.72,range*this.th*.72,0,0,Math.PI*2);c.stroke();c.restore();}
    }
    this.sprite(spec.tiers[b.level-1].sprite,cp.x,cp.y,size,b.hp<=0?.3:b.remaining>0?.65:1);
    const p=this.project(cp.x,cp.y);
    // Tier pips: filled gold per tier so upgrades read instantly.
    for(let i=0;i<spec.tiers.length;i++){c.fillStyle=i<b.level?'#e9c46a':'#5a6b5533';c.beginPath();c.arc(p.x-(spec.tiers.length*7)/2+i*7+3,p.y-size+4,2.6,0,Math.PI*2);c.fill();}
    if(b.hp<=0){c.fillStyle='#3d2c22ee';const w=52;c.fillRect(p.x-w/2,p.y+16,w,15);c.fillStyle='#ffd9a8';c.font='bold 10px Arial';c.textAlign='center';c.fillText('REPAIR',p.x,p.y+27);c.textAlign='left';}
    if(b.remaining>0){const total=this.data.buildings[b.type].buildSeconds||8;this.bar(p.x,p.y-size+12,1-b.remaining/total,44,'#e9c46a');c.fillStyle='#2f4433';c.font='bold 10px Arial';c.textAlign='center';c.fillText(`${Math.ceil(b.remaining)}s`,p.x,p.y-size+10);c.textAlign='left';}
    else if(b.hp>0&&b.hp<spec.tiers[b.level-1].hp)this.bar(p.x,p.y+14,b.hp/spec.tiers[b.level-1].hp,36,b.hp/spec.tiers[b.level-1].hp>.5?'#9caa66':'#c9766a');
   }else{
    const unit=kind==='unit';if(b.hp<=0)continue;
    const up=this.project(b.x,b.y);
    c.fillStyle=unit?'#2c3a2c2e':'#5a232633';c.beginPath();c.ellipse(up.x,up.y+7,unit?13:15,5,0,0,Math.PI*2);c.fill();
    if(!unit){c.strokeStyle='#d96a5e';c.lineWidth=1.5;c.beginPath();c.ellipse(up.x,up.y+7,16,6,0,0,Math.PI*2);c.stroke();}
    this.sprite(unit?this.data.troops[b.type].sprite:'raider.png',b.x,b.y,39);
    const p=this.project(b.x,b.y);
    if(unit){
     const item=this.data.items[b.gear];c.save();c.translate(p.x+12,p.y-8);if(b.animation>0)c.rotate(item.animation==='slam'?-1.2:item.animation==='sweep'?(b.animation/.4)*Math.PI-Math.PI/2:Math.sin(b.animation*14)*.7);c.drawImage(this.images[item.sprite],-8,-24,29,29);c.restore();
     if(b.carry>0){c.fillStyle='#d3ae61';c.fillRect(p.x-14,p.y-10,4,5);}
     if(b.hp<stats(b,this.data).hp)this.bar(p.x,p.y+10,b.hp/stats(b,this.data).hp,20,'#80a56b');
    }else this.bar(p.x,p.y+9,b.hp/b.maxHp,22,'#bd7770');
   }
  }
  if(this.placing&&this.hover){const size=this.data.buildings[this.placing].size,tier=this.data.buildings[this.placing].tiers[0];this.sprite(tier.sprite,this.hover.x+size/2,this.hover.y+size/2,size===2?93:66,.55);if(tier.damage){const gp=this.project(this.hover.x+size/2,this.hover.y+size/2);c.save();c.globalAlpha=.85;c.strokeStyle='#f2e2a8';c.lineWidth=1.5;c.setLineDash([6,4]);c.beginPath();c.ellipse(gp.x,gp.y,tier.range*this.tw*.72,tier.range*this.th*.72,0,0,Math.PI*2);c.stroke();c.restore();}}
  for(const e of world.effects){const a=this.project(e.x,e.y),b=this.project(e.tx,e.ty);if(e.kind==='place'){const t=1-Math.max(0,e.life)/.6;c.globalAlpha=Math.max(0,e.life)/.6;c.strokeStyle='#ffe9a8';c.lineWidth=3;c.beginPath();c.ellipse(b.x,b.y-6,8+t*34,4+t*15,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;if(e.life>.5)this.shake=Math.max(this.shake,4);continue;}
   if(e.kind==='float'||e.kind==='dmg'){const rise=1-Math.max(0,e.life)/(e.kind==='float'?.9:.7);c.globalAlpha=Math.min(1,e.life*2.2);c.font=`bold ${e.kind==='dmg'?13:14}px Arial`;c.textAlign='center';c.fillStyle='#1c302c';c.fillText(e.text,b.x+1,b.y-30-rise*22+1);c.fillStyle=e.kind==='dmg'?'#ffd9a8':(e.color||'#ffe9a8');c.fillText(e.text,b.x,b.y-30-rise*22);c.textAlign='left';c.globalAlpha=1;continue;}
   if(e.kind==='sparkle'){c.globalAlpha=Math.max(0,e.life)/.4;c.strokeStyle='#fff3c0';c.lineWidth=2;for(let s=0;s<4;s++){const ang=s*Math.PI/2+time/300,l=4+(0.4-Math.max(0,e.life))*30;c.beginPath();c.moveTo(b.x+Math.cos(ang)*l,b.y-14+Math.sin(ang)*l*.6);c.lineTo(b.x+Math.cos(ang)*(l+5),b.y-14+Math.sin(ang)*(l+5)*.6);c.stroke();}c.globalAlpha=1;continue;}
   if(e.kind==='fanfare'){c.globalAlpha=Math.min(1,e.life*1.5);c.fillStyle='#f2c96e';for(let s=0;s<6;s++){const rise=(0.8-Math.max(0,e.life))*46;c.fillRect(b.x-14+s*6,b.y-44-rise-(s%3)*7,3,3);}c.globalAlpha=1;continue;}
   if(e.kind==='hit'){c.globalAlpha=Math.max(0,e.life)/.18;c.fillStyle='#fff';c.beginPath();c.arc(b.x,b.y-10,9,0,Math.PI*2);c.fill();c.globalAlpha=1;continue;}
   if(e.kind==='slam')this.shake=Math.max(this.shake,3);c.globalAlpha=e.life/.3;c.strokeStyle=e.kind==='heal'?'#e4efb0':e.kind==='arrow'?'#f6ecbb':'#f5d78d';c.lineWidth=e.kind==='slam'?5:2;c.beginPath();if(e.kind==='heal'||e.kind==='slam'){c.ellipse(b.x,b.y-8,25,12,0,0,Math.PI*2);}else{c.moveTo(a.x,a.y-12);c.lineTo(b.x,b.y-12);}c.stroke();c.globalAlpha=1;}
  // Raid readability: red western edge + marching chevrons while raiders live.
  if(world.enemies.length){
   const pulse=.14+Math.sin(time/300)*.05;
   const g=c.createLinearGradient(0,0,150,0);g.addColorStop(0,`rgba(178,60,50,${pulse+.18})`);g.addColorStop(1,'rgba(178,60,50,0)');
   c.fillStyle=g;c.fillRect(0,0,150,740);
   c.fillStyle='#b23c32';c.font='bold 14px Arial';c.textAlign='center';
   for(let y=2;y<16;y+=2){const p=this.project(.6,y+.5);c.fillText('▶',p.x-30+Math.sin(time/250+y)*5,p.y);}
   c.textAlign='left';
  }
  // Raid event banners: incoming warning, then wave + live kill counter.
  const banner=(line,sub,color)=>{c.fillStyle=color;c.fillRect(280,52,540,66);c.strokeStyle='#f2c96e';c.lineWidth=3;c.strokeRect(280,52,540,66);c.lineWidth=1;c.strokeStyle='#f2c96e88';c.strokeRect(286,58,528,54);c.fillStyle='#f6ecbb';c.font='bold 20px Arial';c.textAlign='center';c.fillText(line,550,80);c.font='bold 13px Arial';c.fillStyle='#e8dcc0';c.fillText(sub,550,103);c.textAlign='left';};
  if(world.raidPending)banner('⚠ RAIDERS INCOMING ⚠',`${world.raidPending.count} raiders from the west — ${Math.ceil(world.raidPending.timer)}…`,'#7a2e26ee');
  else if(world.enemies.length&&(world.raidAge??99)<5)banner(`WAVE ${world.wave} — FIGHT!`,`${world.enemies.length} raiders remain · ${world.raidKills??0} slain`,'#3d3220ee');
  if(!this.calm&&this.shake>0.2)c.restore();else this.shake=0;
  for(let i=0;i<8;i++){const p=this.project(4+i*1.8,4+(i*3)%9);c.globalAlpha=.25+Math.sin(time/1000+i)*.2;c.fillStyle='#fcf4c0';c.fillRect(p.x+Math.sin(time/1500+i)*8,p.y-25,2,2);}c.globalAlpha=1;
 }
 bar(x,y,fraction,width,color){const c=this.ctx;c.fillStyle='#43573d66';c.fillRect(x-width/2,y,width,3);c.fillStyle=color;c.fillRect(x-width/2,y,width*Math.max(0,Math.min(1,fraction)),3);}
}
