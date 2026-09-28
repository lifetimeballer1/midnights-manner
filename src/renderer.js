import {resourceInfo,resourceLabel,layoutCollectionBubbles,collectionBubbleScale,reserveReady} from './resources.js';
import {placementCells} from './systems/walls.js';
import {screenToWorld,panPixels,zoomAt,phaseSeed,zoomLimits,panLimits,project3D,cameraDepth,orbitCamera,DEFAULT_YAW,DEFAULT_PITCH} from './camera.js';
import {tileFor} from './systems/biomes.js';
import {center,canPlace,stats,housing,assignedWorkers} from './model.js';
import {sfx} from './systems/audio.js';
import {isWall} from './building-art.js';
import {drawVillage3D,pointInPolygon} from './scene3d.js';
import {weatherAt,skyLightAt} from './systems/daynight.js';
export class Renderer {
 constructor(canvas,data,images){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.data=data;this.images=images;this.grid=false;this.hover=null;this.selection=null;this.placing=null;this.moving=null;this.tw=43;this.th=22;this.ox=510;this.oy=97;this.shake=0;this.cam={x:10,y:8,zoom:1,yaw:DEFAULT_YAW,pitch:DEFAULT_PITCH};this.orbitMode=false;this.cx=550;this.cy=370;this.width=1100;this.height=740;this.dpr=1;this.hitAreas=[];this.staticLayer=null;this.staticKey='';this.frameTimes=[];this._pendingStaticKey=null;this._noCache=false;this._lastFrame=null;try{this.calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{this.calm=false;}this.seen=new Map();this.flash=new Map();this.deadAt=new Map();this.tints=new Map();}
 base(x,y){return {x:this.ox+(x-y)*this.tw/2,y:this.oy+(x+y)*this.th/2};}
 camBase(){return this.base(this.cam.x,this.cam.y);}
 project(x,y,height=0){return project3D(this,x,y,height);}
 depth(x,y,height=0){return cameraDepth(this,x,y,height);}
 orbit(yaw,pitch=0){orbitCamera(this,yaw,pitch);}
 resetView(){this.cam.yaw=DEFAULT_YAW;this.cam.pitch=DEFAULT_PITCH;}
 unproject(x,y){const p=screenToWorld(this,x,y);return {x:Math.floor(p.x),y:Math.floor(p.y)};}
 pan(dx,dy){const L=panLimits(this.data.world);this.cam.x=Math.max(L.minX,Math.min(L.maxX,this.cam.x+dx));this.cam.y=Math.max(L.minY,Math.min(L.maxY,this.cam.y+dy));}
 zoomBy(f){const L=zoomLimits(this.data.world);this.cam.zoom=Math.max(L.min,Math.min(L.max,this.cam.zoom*f));}
 panPixels(dx,dy){panPixels(this,dx,dy);}
 zoomAt(f,x,y){zoomAt(this,f,x,y);}
 worldPoint(x,y){return screenToWorld(this,x,y);}
 resize(width,height,dpr=1){this.width=width;this.height=height;this.dpr=Math.min(dpr,2);this.canvas.width=Math.round(width*this.dpr);this.canvas.height=Math.round(height*this.dpr);this.cx=width/2;this.cy=height*.51;}
 fitVillage(world){const hall=world.buildings.find(b=>b.type==='hall');this.cam.x=hall?hall.x+1:this.data.world.width/2;this.cam.y=hall?hall.y+1:this.data.world.height/2;this.cam.zoom=this.width<600?1.65:Math.min(2.5,Math.max(1.6,this.width/540));}
 pick(x,y){const bubble=[...this.hitAreas].reverse().find(h=>h.kind==='harvest'&&x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);if(bubble)return bubble;for(let i=(this.sceneFaces?.length||0)-1;i>=0;i--){const f=this.sceneFaces[i];if(pointInPolygon(x,y,f.points))return f.owner||{kind:'scenery'};}return null;}
 resetCam(){this.cam={x:this.data.world.width/2,y:this.data.world.height/2,zoom:1,yaw:DEFAULT_YAW,pitch:DEFAULT_PITCH};}
 cell(event){const r=this.canvas.getBoundingClientRect();return this.unproject((event.clientX-r.left)*this.width/r.width,(event.clientY-r.top)*this.height/r.height);}
 diamond(x,y,color,stroke){const c=this.ctx,points=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([a,b])=>this.project(a,b));c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.6;c.stroke();}}
 sprite(name,x,y,size=56,alpha=1,dy=0){const p=this.project(x,y),img=this.images[name];if(!img)return;const raw=size*this.cam.zoom,s=32*Math.max(1,Math.round(raw/32));this.ctx.globalAlpha=alpha;this.ctx.drawImage(img,Math.round(p.x-s/2),Math.round(p.y-s+12*this.cam.zoom+dy),s,s);this.ctx.globalAlpha=1;}
 tree(x,y,n){const c=this.ctx,p=this.project(x,y),z=this.cam.zoom,h=32+Math.abs(n)%3*9;c.save();c.translate(p.x,p.y);c.scale(z,z);c.fillStyle='#102e2155';c.beginPath();c.ellipse(8,7,18,7,0,0,Math.PI*2);c.fill();c.fillStyle='#60442b';c.fillRect(-3,-h/3,6,h/3+7);for(let l=0;l<3;l++){const top=-h+l*9;c.fillStyle=['#214b32','#2d6340','#407d48'][l];c.beginPath();c.moveTo(0,top);c.lineTo(17-l*2,top+23);c.lineTo(-17+l*2,top+23);c.closePath();c.fill();c.fillStyle=['#376b3c','#4a8547','#699b55'][l];c.beginPath();c.moveTo(0,top);c.lineTo(0,top+23);c.lineTo(-17+l*2,top+23);c.closePath();c.fill();}c.restore();}
 draw(world,time){
  const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);this.recordFrame(time);c.fillStyle='#29472f';c.fillRect(0,0,this.width,this.height);c.imageSmoothingEnabled=false;this.hitAreas=[];this.trackTransitions(world,time);const didShake=!this.calm&&this.shake>.2;
  if(didShake){c.save();c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);this.shake*=.88;}
  const W=this.data.world.width,H=this.data.world.height;
  // One resolved sky per frame feeds shadows, the vignette, the overlay,
  // the glows and the mesh shading — never the same clock read twice.
  const sky=skyLightAt(world.elapsed,this.data,{calm:this.calm}),weather=weatherAt(world.elapsed,this.data);
  if(!this.blitCachedStatic(world)){
  // Claimed lookup for wilderness fog (Phase 2): unclaimed tiles render dimmed.
  const claimedByKey=Array.isArray(world.tiles)?new Map(world.tiles.map(t=>[(t.x+','+t.y),t])):null;
  // Ambient moonlit clearing over deep night soil.
  c.fillStyle='#16281f45';c.beginPath();c.ellipse(this.width/2,this.height/2,Math.max(200,this.width*.45),Math.max(100,this.height*.4),0,0,Math.PI*2);c.fill();
  for(let y=-3;y<H+4;y++)for(let x=-3;x<W+4;x++){
   const n=((x*67+y*113+10000)*17)%101, checker=(x+y)%2===0;
   const edge=x<0||y<0||x>=W||y>=H;
   const bounds=world.bounds||{w:20,h:16};
   // Wild rows: inside the map but outside the settled bounds — darker, red grid.
   const usable=edge||(x>=1&&y>=1&&x<=bounds.w-2&&y<=bounds.h-2);
   // Moonlit-night checkerboard: deep pine vs moonlit moss; edges fall off darker.
   const inner=checker?['#668b46','#698e49','#6c924b','#648a43'][Math.abs(n)%4]:['#6b9148','#6e944b','#70964e','#6a8d46'][Math.abs(n)%4];
   const wild=checker?'#3e6037':'#43663b';
   this.diamond(x,y,edge?['#355931','#3a5f35','#32572e'][Math.abs(n)%3]:(usable?inner:wild),this.grid&&!edge?(usable?'#9db87a':'#c9766a'):null);
   // Biome tint overlay (Phase 1, visual only — no gameplay change).
   // Reads data/biomes.json tints via deterministic tileFor lookup.
   if(!edge){
    try{
     const tile=tileFor(this.data.world,x,y);
     const tint=this.data.biomes?.[tile.biome]?.tint;
     if(tint&&tile.biome!=='plains')this.diamond(x,y,tint+'55');
     if(tile.landmark){const lp=this.project(x+.5,y+.5);c.fillStyle='#f2e2a8';c.font='bold 10px system-ui';c.textAlign='center';c.fillText('✦ '+tile.landmark,lp.x,lp.y-8);c.textAlign='left';}
    }catch{}
    // Wilderness fog (Phase 2): unclaimed land renders dimmed/fogged, still visible.
    const rt=claimedByKey?.get(x+','+y);
    const isUnclaimed=rt?rt.claimed!==true:!(x>=1&&y>=1&&x<=(world.bounds?.w||20)-2&&y<=(world.bounds?.h||17)-2);
    if(isUnclaimed)this.diamond(x,y,'#0a100c8c');
   }
   if(usable&&!edge){const dx=x-10,dy=y-8;if(dx*dx+dy*dy<17)this.diamond(x,y,'#d6be7130');} // hearth warmth on the village clearing
   if(!edge&&n%5===0){const p=this.project(x+.5,y+.5);c.fillStyle=usable?'#24382c55':'#1a2a2055';c.fillRect(p.x-5,p.y-1,9,3);} // moss blotch
   if(!usable&&!edge&&n%3===0){const p=this.project(x+.5,y+.5);c.fillStyle='#1f4a34';c.beginPath();c.moveTo(p.x,p.y-9);c.lineTo(p.x+6,p.y+2);c.lineTo(p.x-6,p.y+2);c.closePath();c.fill();c.fillStyle='#2a5f42';c.beginPath();c.moveTo(p.x,p.y-5);c.lineTo(p.x+5,p.y+4);c.lineTo(p.x-5,p.y+4);c.closePath();c.fill();} // wild saplings on locked rows
   if(!usable&&!edge&&n%11===0){const p=this.project(x+.5,y+.5);c.fillStyle='#c9766a88';c.font='bold 9px system-ui';c.textAlign='center';c.fillText('✦',p.x,p.y+3);c.textAlign='left';}
   if(!edge&&n%9===0){const p=this.project(x+.5,y+.5);c.fillStyle='#6fae7a88';c.fillRect(p.x,p.y,2,3);c.fillRect(p.x+3,p.y-1,1,3);}
   if(!edge&&usable&&n%17===0){const p=this.project(x+.5,y+.5);c.fillStyle=n%34===0?'#c05a4e':'#f2c96e';c.fillRect(p.x-1,p.y-2,2,2);c.fillStyle='#7fbf7a';c.fillRect(p.x,p.y,1,2);} // moonblooms
   if(!edge&&n%7===0){const p=this.project(x+.5,y+.5);c.fillStyle='#7e93a855';c.fillRect(p.x-4,p.y+1,2,1);c.fillRect(p.x+3,p.y-2,1,1);}
   if(!edge&&n%13===0){const p=this.project(x+.5,y+.5);c.fillStyle='#0b122022';c.beginPath();c.ellipse(p.x,p.y+2,6,2.5,0,0,Math.PI*2);c.fill();}
  }
  // Moonlit stream outside the settlement; a readable cool border for the map.
  for(let i=-2;i<W+1;i++){this.diamond(i,H+1+(i%4===0?1:0),'#2e6b7a');}

  // Lantern-lit dirt paths join the manor clearing, with a spur to the east fields.
  for(let x=4;x<16;x++)this.diamond(x,11,'#a8895a');for(let y=4;y<11;y++)this.diamond(10,y,'#a8895a');for(let y=8;y<11;y++)this.diamond(13,y,'#a8895a');
  for(let x=4;x<16;x++){const p=this.project(x+.5,11.5);c.fillStyle='#8a6f4d';c.fillRect(p.x-3+((x*67)%5),p.y+((x*113)%3),2,2);}
  for(let y=4;y<11;y++){const p=this.project(10.5,y+.5);c.fillStyle='#8a6f4d';c.fillRect(p.x-3+((y*113)%5),p.y+((y*67)%3),2,2);}
  this.captureStatic(world);}
  // Stream shimmer stays dynamic: one short loop, never baked while animating.
  for(let i=-2;i<W+1;i++){const p=this.project(i+.5,H+1.5);const sx=this.calm?0:Math.sin(time/500+i)*3;c.fillStyle='#7fc4d4';c.fillRect(p.x-6+sx,p.y+2,8,1);}
  // Phase 4 — contact shadows: every footprint and body throws a short ink
  // smudge away from the key light. The offset swings with the sun/moon arc
  // and the alpha follows the key intensity: one polygon per body, no blur,
  // no texture — a live depth cue for free.
  {const lx=sky.keyDir[0],ly=sky.keyDir[1],ln=Math.hypot(lx,ly)||1,len=.42*Math.min(1,sky.keyI/.26),ox=-lx/ln*len,oy=-ly/ln*len,alpha=Math.max(.06,Math.min(.22,sky.keyI*.75));
   c.fillStyle=`rgba(18,24,16,${alpha})`;
   for(const b of world.buildings){const spec=this.data.buildings[b.type];if(!spec)continue;const n=spec.size;
    c.beginPath();[[b.x,b.y],[b.x+n,b.y],[b.x+n,b.y+n],[b.x,b.y+n]].forEach(([x,y],i)=>{const p=this.project(x+ox,y+oy,.01);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.closePath();c.fill();}
   for(const u of [...world.troops,...world.enemies]){if(u.hp<=0)continue;const p=this.project(u.x+ox,u.y+oy,.01),rz=13*this.cam.zoom;c.beginPath();c.ellipse(p.x,p.y,rz,rz*.42,0,0,Math.PI*2);c.fill();}}
  if(this.placing&&this.hover){const cells=placementCells(this),valid=cells.every(p=>canPlace(world,this.data,this.placing,p.x,p.y,this.moving));const size=this.data.buildings[this.placing].size;for(const p of cells)for(let y=0;y<size;y++)for(let x=0;x<size;x++)this.diamond(p.x+x,p.y+y,valid?'#69a06bcc':'#c05a4ecc',valid?'#fff6d8':'#ffe3dc');}
  else if(this.hover&&this.grid)this.diamond(this.hover.x,this.hover.y,'#f2ecb988','#fff3c0');
  const ring=(x,y,radius)=>{c.beginPath();for(let i=0;i<=64;i++){const a=i*Math.PI/32,p=this.project(x+Math.cos(a)*radius,y+Math.sin(a)*radius,.02);if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}c.stroke();};
  const selected=world.buildings.find(b=>b.id===this.selection);const defense=selected?this.data.buildings[selected.type]:this.placing?this.data.buildings[this.placing]:null;
  const tier=defense?.tiers[(selected?.level||1)-1];if(tier?.damage&&(selected||this.hover)){const pos=selected?center(selected,this.data):{x:this.hover.x+defense.size/2,y:this.hover.y+defense.size/2};c.save();c.strokeStyle='#f2e2a8';c.lineWidth=1.5;c.setLineDash([6,4]);ring(pos.x,pos.y,tier.range);c.restore();}
  drawVillage3D(this,world,time,sky);
  const drawables=[...world.buildings.map(b=>({kind:'building',value:b,depth:this.depth(b.x+this.data.buildings[b.type].size/2,b.y+this.data.buildings[b.type].size/2)})),...world.troops.map(t=>({kind:'unit',value:t,depth:this.depth(t.x,t.y)})),...world.enemies.map(e=>({kind:'enemy',value:e,depth:this.depth(e.x,e.y)}))].sort((a,b)=>a.depth-b.depth);
  for(const {kind,value:b} of drawables){
   if(kind==='building'){
    const spec=this.data.buildings[b.type],cp=center(b,this.data),baseSize=spec.size===2?79:51,size=baseSize*this.cam.zoom;
    const gp=this.project(cp.x,cp.y);
    this.hitAreas.push({kind:'building',id:b.id,x:gp.x-size*.4,y:gp.y-size*.84,w:size*.8,h:size*.87});
    if(this.selection===b.id){
     for(let y=0;y<spec.size;y++)for(let x=0;x<spec.size;x++)this.diamond(b.x+x,b.y+y,'#f0d47e66','#f2c96e');
     for(let y=0;y<spec.size;y++)for(let x=0;x<spec.size;x++)this.diamond(b.x+x,b.y+y,'#ffffff22','#fff3c0');
     // Pulsing selection marker — readable on phones in bright light.
     const bob=this.calm?0:Math.sin(time/300)*2;
     c.fillStyle='#fff3c0';c.beginPath();c.arc(gp.x,gp.y-size-6+bob,3.2,0,Math.PI*2);c.fill();
     c.fillStyle='#1c302c';c.beginPath();c.arc(gp.x,gp.y-size-6+bob,1.4,0,Math.PI*2);c.fill();
     // Name pill so taps answer back with what you picked.
     c.font='bold 11px system-ui';const label=spec.name+(b.remaining>0?' · building…':b.hp<=0?' · ruined':'');const wpx=c.measureText(label).width+14;
     c.fillStyle='#1c302cee';c.beginPath();if(c.roundRect)c.roundRect(gp.x-wpx/2,gp.y-size-34+bob,wpx,17,8);else c.rect(gp.x-wpx/2,gp.y-size-34+bob,wpx,17);c.fill();
     c.fillStyle='#f3eddc';c.textAlign='center';c.fillText(label,gp.x,gp.y-size-22+bob);c.textAlign='left';

    }
    // Living-village readouts: beds on cottages, gold crew pips on workplaces,
    // and a thin reserve bar on nodes draining below two-thirds.
    const p=this.project(cp.x,cp.y);const p2=p;
    if(spec.housing&&b.hp>0){const hh=housing(world,this.data);c.fillStyle='#1c302cee';c.font='bold 9px system-ui';c.textAlign='center';c.fillText(`🛏 ${hh.used}/${hh.beds}`,p2.x,p2.y-size-10);c.textAlign='left';}
    if(spec.workplace&&b.hp>0){const crew=assignedWorkers(world,b.id).length;
     for(let i=0;i<crew;i++){c.fillStyle='#f2c96e';c.beginPath();c.arc(p2.x-(crew*8)/2+i*8+4,p2.y-size-10,3,0,Math.PI*2);c.fill();c.strokeStyle='#1c302c';c.lineWidth=1;c.stroke();}}
    if(b.maxReserve&&b.hp>0){const frac=Math.max(0,Math.min(1,b.reserve/b.maxReserve));
     if(frac<0.66)this.bar(p2.x,p2.y+20,frac,36,frac>0.35?'#c9a44e':'#c9766a');}
    // Ready badge: a gold coin-dot on buildings holding a tap reserve.
    if(reserveReady(b,spec)){c.fillStyle='#f2c96e';c.beginPath();c.arc(p2.x+size*.34,p2.y-size-12,5,0,Math.PI*2);c.fill();c.strokeStyle='#1c302c';c.lineWidth=1.5;c.stroke();c.fillStyle='#1c302c';c.font='bold 8px system-ui';c.textAlign='center';c.fillText('!',p2.x+size*.34,p2.y-size-9);c.textAlign='left';}

    // Chimney smoke: houses breathe. Stateless phase per building, capped to homes.
    if(b.hp>0&&b.remaining<=0&&['hall','cottage','barracks','forge','chapel','farm'].includes(b.type)&&(Math.floor(time/1600)+phaseSeed(b.id))%3===0){
     const rise=this.calm?6:((time/45+phaseSeed(b.id)*37)%26);c.globalAlpha=this.calm?.1:.22*(1-rise/30);
     c.fillStyle='#cfd4d6';c.beginPath();c.arc(p.x+4,p.y-size-8-rise,2.5+rise*.08,0,Math.PI*2);c.fill();c.globalAlpha=1;}
    for(let i=0;i<spec.tiers.length;i++){c.fillStyle=i<b.level?'#e9c46a':'#5a6b5533';c.beginPath();c.arc(p.x-(spec.tiers.length*7)/2+i*7+3,p.y-size+4,2.6,0,Math.PI*2);c.fill();}
    if(b.hp<=0){c.fillStyle='#3d2c22ee';const w=52;c.fillRect(p.x-w/2,p.y+16,w,15);c.fillStyle='#ffd9a8';c.font='bold 10px system-ui';c.textAlign='center';c.fillText('REPAIR',p.x,p.y+27);c.textAlign='left';}
    if(b.remaining>0){const total=this.data.buildings[b.type].buildSeconds||8;this.bar(p.x,p.y-size+12,1-b.remaining/total,44,'#e9c46a');c.fillStyle='#2f4433';c.font='bold 10px system-ui';c.textAlign='center';c.fillText(`${Math.ceil(b.remaining)}s`,p.x,p.y-size+10);c.textAlign='left';}
    else if(b.hp>0&&b.hp<spec.tiers[b.level-1].hp)this.bar(p.x,p.y+14,b.hp/spec.tiers[b.level-1].hp,36,b.hp/spec.tiers[b.level-1].hp>.5?'#9caa66':'#c9766a');
   }else{
    const unit=kind==='unit';if(b.hp<=0){if(!this.calm){const age=time-(this.deadAt.get((unit?'u':'e')+b.id)??time);if(age<450)this.sprite(unit?this.data.troops[b.type].sprite:'raider.png',b.x,b.y,39,1-age/450);}continue;}
    const bob=unit?(this.calm?0:Math.sin(time/450+phaseSeed(b.id)*1.7)*2*this.cam.zoom):(this.calm?0:Math.abs(Math.sin(time/300+phaseSeed(b.id)))*2*this.cam.zoom);
    const up=this.project(b.x,b.y);const us=34*this.cam.zoom;this.hitAreas.push({kind:unit?'unit':'enemy',id:b.id,x:up.x-us*.35,y:up.y-us*.8,w:us*.7,h:us*.9});
    const p=this.project(b.x,b.y);
    // Hover attention: a soft ring under whoever your finger is over.
    if(this.hover&&!this.placing&&b.hp>0&&Math.hypot(b.x-(this.hover.x+.5),b.y-(this.hover.y+.5))<.8){c.strokeStyle='#fff3c088';c.lineWidth=1.5;c.beginPath();c.ellipse(up.x,up.y+7,unit?15:17,6,0,0,Math.PI*2);c.stroke();}
    if(unit){
     if(b.hp<stats(b,this.data).hp)this.bar(p.x,p.y+10,b.hp/stats(b,this.data).hp,20,'#80a56b');
     if(this.selection===b.id){c.strokeStyle='#fff3c0';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y+7,17,7,0,0,Math.PI*2);c.stroke();
      c.font='bold 11px system-ui';const nm=this.data.troops[b.type].name+(b.order?' · '+b.order.kind:'');const nw=c.measureText(nm).width+14;
      c.fillStyle='#1c302cee';c.beginPath();if(c.roundRect)c.roundRect(p.x-nw/2,p.y-44+bob,nw,17,8);else c.rect(p.x-nw/2,p.y-44+bob,nw,17,8);c.fill();
      c.fillStyle='#f3eddc';c.textAlign='center';c.fillText(nm,p.x,p.y-32+bob);c.textAlign='left';}
     if(b.order){const t=b.order.kind==='move'?`➤ ${Math.round(b.order.x)},${Math.round(b.order.y)}`:b.order.kind==='attack'?'⚔!':'✋';c.fillStyle='#1c302cee';c.font='bold 9px system-ui';c.textAlign='center';c.fillText(t,p.x,p.y-22+bob);c.textAlign='left';
      if(b.order.kind==='move'){const q=this.project(b.order.x,b.order.y);c.save();c.strokeStyle='#fff3c0';c.setLineDash([4,3]);c.beginPath();c.moveTo(p.x,p.y-8);c.lineTo(q.x,q.y-8);c.stroke();c.restore();}}
    }else this.bar(p.x,p.y+9,b.hp/b.maxHp,22,'#bd7770');
   }
  }
  for(const e of world.effects){const a=this.project(e.x,e.y),b=this.project(e.tx,e.ty);if(e.kind==='place'){const t=1-Math.max(0,e.life)/.6;c.globalAlpha=Math.max(0,e.life)/.6;c.strokeStyle='#ffe9a8';c.lineWidth=3;c.beginPath();c.ellipse(b.x,b.y-6,8+t*34,4+t*15,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;if(e.life>.5)this.shake=Math.max(this.shake,4);continue;}
   if(e.kind==='splash'){const t=1-Math.max(0,e.life)/.5;c.globalAlpha=Math.max(0,e.life)/.5;c.strokeStyle='#7fc4d4';c.lineWidth=2;for(let s=0;s<2;s++){c.beginPath();c.ellipse(b.x,b.y-8,6+t*(10+s*7),3+t*(4+s*3),0,Math.PI,Math.PI*2);c.stroke();}c.fillStyle='#dff3f8';c.fillRect(b.x-1,b.y-14-t*8,2,3);c.globalAlpha=1;continue;}
   if(e.kind==='float'||e.kind==='dmg'){const rise=1-Math.max(0,e.life)/(e.kind==='float'?.9:.7);c.globalAlpha=Math.min(1,e.life*2.2);c.font=`bold ${e.kind==='dmg'?13:14}px system-ui`;c.textAlign='center';c.fillStyle='#1c302c';c.fillText(e.text,b.x+1,b.y-30-rise*22+1);c.fillStyle=e.kind==='dmg'?'#ffd9a8':(e.color||'#ffe9a8');c.fillText(e.text,b.x,b.y-30-rise*22);c.textAlign='left';c.globalAlpha=1;continue;}
   if(e.kind==='sparkle'){c.globalAlpha=Math.max(0,e.life)/.4;c.strokeStyle='#fff3c0';c.lineWidth=2;for(let s=0;s<4;s++){const ang=s*Math.PI/2+time/300,l=4+(0.4-Math.max(0,e.life))*30;c.beginPath();c.moveTo(b.x+Math.cos(ang)*l,b.y-14+Math.sin(ang)*l*.6);c.lineTo(b.x+Math.cos(ang)*(l+5),b.y-14+Math.sin(ang)*(l+5)*.6);c.stroke();}c.globalAlpha=1;continue;}
   if(e.kind==='fanfare'){c.globalAlpha=Math.min(1,e.life*1.5);c.fillStyle='#f2c96e';for(let s=0;s<6;s++){const rise=(0.8-Math.max(0,e.life))*46;c.fillRect(b.x-14+s*6,b.y-44-rise-(s%3)*7,3,3);}c.globalAlpha=1;continue;}
   if(e.kind==='hit'){c.globalAlpha=Math.max(0,e.life)/.18;c.fillStyle='#fff';c.beginPath();c.arc(b.x,b.y-10,9,0,Math.PI*2);c.fill();c.globalAlpha=1;continue;}
   if(e.kind==='poof'){const t=1-Math.max(0,e.life)/.4;c.globalAlpha=Math.max(0,e.life)/.4;c.strokeStyle='#b8c4bb';c.lineWidth=2;c.beginPath();c.ellipse(b.x,b.y-8,6+t*12,4+t*6,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;continue;}
   if(e.kind==='slam')this.shake=Math.max(this.shake,3);c.globalAlpha=e.life/.3;c.strokeStyle=e.kind==='heal'?'#e4efb0':e.kind==='arrow'?'#f6ecbb':'#f5d78d';c.lineWidth=e.kind==='slam'?5:2;c.beginPath();if(e.kind==='heal'||e.kind==='slam'){c.ellipse(b.x,b.y-8,25,12,0,0,Math.PI*2);}else{c.moveTo(a.x,a.y-12);c.lineTo(b.x,b.y-12);}c.stroke();c.globalAlpha=1;}
  // Raiders can arrive from every side: a quiet border glow never points west by mistake.
  if(world.enemies.length){
   const radius=Math.max(this.width,this.height)*.7,g=c.createRadialGradient(this.width/2,this.height/2,Math.min(this.width,this.height)*.35,this.width/2,this.height/2,radius);
   g.addColorStop(0,'rgba(145,54,42,0)');g.addColorStop(1,`rgba(145,54,42,${this.calm?.2:.2+Math.sin(time/500)*.035})`);c.fillStyle=g;c.fillRect(0,0,this.width,this.height);
  }
 // Vignette + moon glow: depth and night air over the whole map (static,
 // motion-safe). Phase 4 — the vignette deepens with the dark (per-phase
 // `vignette`, data-tunable) and the moon glow follows the key arc's sweep.
  {const vg=c.createRadialGradient(this.width/2,this.height/2,Math.min(this.width,this.height)*.3,this.width/2,this.height/2,Math.max(this.width,this.height)*.75);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,`rgba(5,10,8,${sky.vignette})`);c.fillStyle=vg;c.fillRect(0,0,this.width,this.height);
   if(sky.overlay.glow>0){const mx=this.width*(.5+.42*Math.max(-1,Math.min(1,sky.keyDir[0]))),mg=c.createRadialGradient(mx,80,10,mx,80,320);mg.addColorStop(0,`rgba(242,201,110,${.10*sky.overlay.glow})`);mg.addColorStop(1,'rgba(242,201,110,0)');c.fillStyle=mg;c.fillRect(0,0,this.width,this.height);}}
 // Living sky (Phase 10): clock-driven lighting from world.elapsed — dawn
// daylight, dusk ember, deep night blue — plus the weather veil. All drawn
// every frame AFTER the static-layer blit, so the cached terrain stays valid
// and per-frame cost stays flat: two fullscreen fills, lamp glows, rain.
  {const lamp=sky.overlay;
   if(lamp.color&&lamp.alpha>0){c.globalAlpha=lamp.alpha;c.fillStyle=lamp.color;c.fillRect(0,0,this.width,this.height);c.globalAlpha=1;}
   if(weather.color&&weather.alpha>0){c.globalAlpha=weather.alpha;c.fillStyle=weather.color;c.fillRect(0,0,this.width,this.height);c.globalAlpha=1;}
   // Lamp glow: every finished standing building breathes warm light after
   // dark. One batched fillStyle, one ellipse per roof — flat O(buildings).
   // Fire sources burn larger and flicker (calm holds a steady glow); every
   // other finished building keeps the soft window-light halo.
   if(lamp.glow>0){const fires=['watchfire','forge','smeltery'];c.fillStyle='#f2c96e';
    for(const b of world.buildings){if(b.hp<=0||b.remaining>0)continue;
     const spec=this.data.buildings[b.type];if(!spec)continue;
     const fire=fires.includes(b.type),seed=phaseSeed(b.id);
     const flick=this.calm?1:.9+.1*Math.sin(time/170+seed*1.7)*Math.sin(time/91+seed);
     const base=(spec.size===2?46:30)*this.cam.zoom,r=(fire?base*1.7:base)*flick;
     const gp=this.project(b.x+spec.size/2,b.y+spec.size/2);
     c.globalAlpha=(fire?.2:.16)*lamp.glow*flick;
     c.beginPath();c.ellipse(gp.x,gp.y-10*this.cam.zoom,r,r*.42,0,0,Math.PI*2);c.fill();}
    c.globalAlpha=1;}
   // Rain streaks: 36 deterministic slashes, falling with the clock. Flat.
   if(weather.streaks){c.strokeStyle='#9fc4d4';c.globalAlpha=.32;c.lineWidth=1;c.beginPath();
    for(let i=0;i<36;i++){const rx=(i*97.31)%this.width,ry=((i*57.73)+time*.35)%(this.height+14)-7;
     c.moveTo(rx,ry);c.lineTo(rx-4,ry+9);}
    c.stroke();c.globalAlpha=1;}
   this._skyPhase=sky.phase.id;}
  if(didShake)c.restore();else this.shake=0;
  if(!this.calm)for(let i=0;i<8;i++){const p=this.project(4+i*1.8,4+(i*3)%9);c.globalAlpha=.25+Math.sin(time/1000+i)*.2;c.fillStyle='#fcf4c0';c.fillRect(p.x+Math.sin(time/1500+i)*8,p.y-25,2,2);}c.globalAlpha=1;
  // Critters keep the clock: gold butterflies by day, warm fireflies
  // after dark. Same loop count either way — per-frame cost never moves.
  if(!this.calm){const night=this._skyPhase==='night'||this._skyPhase==='dusk';
   for(let i=0;i<3;i++){const bp=this.project(5+4*Math.sin(time/(night?2300:3100)+i*2.1),6+3*Math.cos(time/(night?2900:2600)+i*1.7));
    if(night){c.globalAlpha=.5+Math.sin(time/400+i*2)*.4;c.fillStyle='#ffd97a';c.fillRect(bp.x,bp.y,2,2);c.globalAlpha=1;}
    else{const flap=Math.abs(Math.sin(time/180+i))*2;c.fillStyle='#f2c96ecc';c.fillRect(bp.x-2-flap,bp.y,2,2);c.fillRect(bp.x+flap,bp.y,2,2);}}}
  if(!this.placing)this.drawCollections(world);
 }
 drawCollections(world){
  const c=this.ctx;
  const items=world.buildings.filter(b=>reserveReady(b,this.data.buildings[b.type])).map(b=>{
   const spec=this.data.buildings[b.type],p=this.project(b.x+spec.size/2,b.y+spec.size/2),info=resourceInfo(spec.production),text=resourceLabel(spec.production,b.harvestBonus),scale=collectionBubbleScale(this.cam.zoom),fontSize=Math.max(9,12*scale),iconSize=28*scale;
   c.font=`bold ${fontSize}px system-ui`;
   return {id:b.id,x:p.x,y:p.y-(spec.size===2?79:51)*this.cam.zoom-18*scale,anchor:p,text,info,width:Math.max(104*scale,c.measureText(text).width+44*scale),height:40*scale,scale,fontSize,iconSize};
  });
  for(const pill of layoutCollectionBubbles(items,this.width,this.height,this.width<600?(this.collectionObstacles||[]):[])){
   const {x,y,w,h,info}=pill,scale=pill.scale||1,fontSize=pill.fontSize||12,iconSize=pill.iconSize||28;
   c.save();c.strokeStyle=info.color+'aa';c.lineWidth=Math.max(1,1.5*scale);c.beginPath();c.moveTo(x+w/2,y+h-4*scale);c.lineTo(pill.anchor.x,pill.anchor.y-28*this.cam.zoom);c.stroke();
   c.shadowColor='#0c22194d';c.shadowBlur=8*scale;c.shadowOffsetY=3*scale;c.fillStyle=info.paper;c.strokeStyle=info.color;c.lineWidth=Math.max(1,1.5*scale);c.beginPath();c.roundRect(x,y+3*scale,w,h-6*scale,12*scale);c.fill();c.stroke();c.shadowBlur=0;c.shadowOffsetY=0;
   const icon=this.images[info.sprite];if(icon)c.drawImage(icon,x+5*scale,y+6*scale,iconSize,iconSize);
   c.fillStyle='#293c30';c.font=`bold ${fontSize}px system-ui`;c.textAlign='left';c.fillText(pill.text,x+36*scale,y+25*scale);c.restore();
   const pad=Math.max(4,Math.round((44-h)/2));
   this.hitAreas.push({kind:'harvest',id:pill.id,x:x-pad,y:y-pad,w:w+pad*2,h:h+pad*2,resource:info.label,label:pill.text});
  }
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
 spriteFlash(name,x,y,size,key,time,dy=0){const until=this.flash.get(key);if(!until||time>until)return;const t=this.tint(name);if(!t)return;const p=this.project(x,y),raw=size*this.cam.zoom,s=32*Math.max(1,Math.round(raw/32)),c=this.ctx;c.globalAlpha=Math.min(1,(until-time)/150);c.drawImage(t,Math.round(p.x-s/2),Math.round(p.y-s+12*this.cam.zoom+dy),s,s);c.globalAlpha=1;}
 recordFrame(now){if(this._lastFrame==null){this._lastFrame=now;return;}const dt=now-this._lastFrame;this._lastFrame=now;if(dt>=0&&dt<1000){this.frameTimes.push(dt);if(this.frameTimes.length>240)this.frameTimes.shift();}}
 frameReport(){const a=[...this.frameTimes].sort((x,y)=>x-y);if(!a.length)return null;const avg=a.reduce((n,v)=>n+v,0)/a.length;const q=f=>a[Math.min(a.length-1,Math.floor(a.length*f))];return {n:a.length,avg:Math.round(avg*100)/100,p50:Math.round(q(.5)*100)/100,p95:Math.round(q(.95)*100)/100,faces:(this.sceneFaces||[]).length,staticFaces:(this._meshStatic?.faces||[]).length};}
 staticCacheKey(world){const b=world.bounds||{w:20,h:16};const seed=this.data.world?.seed??0;const lm=Array.isArray(this.data.world?.tiles)?this.data.world.tiles.length:0;let claimed=-1;try{if(Array.isArray(world.tiles)){claimed=0;for(const t of world.tiles)if(t.claimed)claimed++;}}catch{}return [this.cam.x.toFixed(2),this.cam.y.toFixed(2),this.cam.zoom,this.cam.yaw??DEFAULT_YAW,this.cam.pitch??DEFAULT_PITCH,this.width,this.height,this.dpr,this.grid?1:0,b.w,b.h,seed,lm,claimed].join('|');}
 blitCachedStatic(world){if(this._noCache)return false;const key=this.staticCacheKey(world);if(this.staticLayer&&key===this.staticKey){try{this.ctx.drawImage(this.staticLayer,0,0,this.width,this.height);}catch{this._noCache=true;return false;}return true;}this._pendingStaticKey=key;return false;}
 captureStatic(world){const key=this._pendingStaticKey;this._pendingStaticKey=null;if(!key||this._noCache||typeof document==='undefined')return;if(this.shake>0.2)return;try{const pw=Math.round(this.width*this.dpr),ph=Math.round(this.height*this.dpr);if(!this.staticLayer)this.staticLayer=document.createElement('canvas');if(this.staticLayer.width!==pw||this.staticLayer.height!==ph){this.staticLayer.width=pw;this.staticLayer.height=ph;}const g=this.staticLayer.getContext('2d');g.setTransform(1,0,0,1,0,0);g.drawImage(this.canvas,0,0);this.staticKey=key;}catch{this._noCache=true;this.staticLayer=null;this.staticKey='';}}
 bar(x,y,fraction,width,color){const c=this.ctx;c.fillStyle='#43573d66';c.fillRect(x-width/2,y,width,3);c.fillStyle=color;c.fillRect(x-width/2,y,width*Math.max(0,Math.min(1,fraction)),3);}
}
