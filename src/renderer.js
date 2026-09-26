import {center,canPlace,stats} from './model.js';
export class Renderer {
 constructor(canvas,data,images){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.data=data;this.images=images;this.grid=false;this.hover=null;this.selection=null;this.placing=null;this.moving=null;this.tw=43;this.th=22;this.ox=510;this.oy=97;}
 project(x,y){return {x:this.ox+(x-y)*this.tw/2,y:this.oy+(x+y)*this.th/2};}
 unproject(x,y){return {x:Math.floor((x-this.ox)/this.tw+(y-this.oy)/this.th),y:Math.floor((y-this.oy)/this.th-(x-this.ox)/this.tw)};}
 cell(event){const r=this.canvas.getBoundingClientRect();return this.unproject((event.clientX-r.left)*this.canvas.width/r.width,(event.clientY-r.top)*this.canvas.height/r.height);}
 diamond(x,y,color,stroke){const c=this.ctx,p=this.project(x,y);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+this.tw/2,p.y+this.th/2);c.lineTo(p.x,p.y+this.th);c.lineTo(p.x-this.tw/2,p.y+this.th/2);c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.6;c.stroke();}}
 sprite(name,x,y,size=56,alpha=1){const p=this.project(x,y),img=this.images[name];if(!img)return;this.ctx.globalAlpha=alpha;this.ctx.drawImage(img,Math.round(p.x-size/2),Math.round(p.y-size+12),size,size);this.ctx.globalAlpha=1;}
 tree(x,y,n){const c=this.ctx,p=this.project(x,y),h=26+n%3*8;c.fillStyle='#7d826553';c.beginPath();c.ellipse(p.x+8,p.y+7,14,5,0,0,Math.PI*2);c.fill();c.fillStyle='#766a4b';c.fillRect(p.x-2,p.y-h/3,4,h/3+6);for(let l=0;l<3;l++){c.fillStyle=['#5f7856','#6e875e','#80966a'][l];const top=p.y-h+l*8;c.beginPath();c.moveTo(p.x,top);c.lineTo(p.x+14-l*2,top+20);c.lineTo(p.x-14+l*2,top+20);c.closePath();c.fill();}}
 draw(world,time){
  const c=this.ctx;c.clearRect(0,0,1100,740);c.imageSmoothingEnabled=false;
  // Ambient paper and a raised, diamond-shaped clearing.
  c.fillStyle='#a3ac7c25';c.beginPath();c.ellipse(543,385,410,190,0,0,Math.PI*2);c.fill();
  for(let y=-3;y<20;y++)for(let x=-3;x<24;x++){
   const n=((x*67+y*113+10000)*17)%101;
   const edge=x<0||y<0||x>=20||y>=16;
   this.diamond(x,y,edge?['#d7ddbf','#d3dbb7','#dbe0c7'][Math.abs(n)%3]:['#c1cf9d','#c4d29f','#c7d4a3','#bfd09d'][Math.abs(n)%4],this.grid&&!edge?'#a3b88b88':null);
   if(!edge&&n%9===0){const p=this.project(x+.5,y+.5);c.fillStyle='#91a77688';c.fillRect(p.x,p.y,2,3);c.fillRect(p.x+3,p.y-1,1,3);}
  }
  // Winding stream outside the settlement; a readable soft border for the map.
  for(let i=-2;i<21;i++){this.diamond(i,17+(i%4===0?1:0),'#9dbab3');const p=this.project(i+.5,17.5);c.fillStyle='#c7d8cd';c.fillRect(p.x-6,p.y+2,8,1);}
  for(let i=0;i<20;i++){if(i%3!==0)this.tree(i,-1.5,i);if(i%2===0)this.tree(-1.5,i%16,i+2);if(i%3===0)this.tree(21,i%16,i);}
  // Small paths join the manor clearing.
  for(let x=5;x<15;x++)this.diamond(x,11,'#c7bc96');for(let y=4;y<11;y++)this.diamond(10,y,'#c7bc96');
  if(this.placing&&this.hover){const valid=canPlace(world,this.data,this.placing,this.hover.x,this.hover.y,this.moving);const size=this.data.buildings[this.placing].size;for(let y=0;y<size;y++)for(let x=0;x<size;x++)this.diamond(this.hover.x+x,this.hover.y+y,valid?'#7ca476aa':'#c67e7299','#faf5d3');}
  else if(this.hover&&this.grid)this.diamond(this.hover.x,this.hover.y,'#e8e6b266','#f5edc9');
  const drawables=[...world.buildings.map(b=>({kind:'building',value:b,depth:b.x+b.y+this.data.buildings[b.type].size})),...world.troops.map(t=>({kind:'unit',value:t,depth:t.x+t.y+.2})),...world.enemies.map(e=>({kind:'enemy',value:e,depth:e.x+e.y+.2}))].sort((a,b)=>a.depth-b.depth);
  for(const {kind,value:b} of drawables){
   if(kind==='building'){
    const spec=this.data.buildings[b.type],cp=center(b,this.data),size=spec.size===2?93:66;
    if(this.selection===b.id)for(let y=0;y<spec.size;y++)for(let x=0;x<spec.size;x++)this.diamond(b.x+x,b.y+y,'#e4d59766','#fbf5cf');
    this.sprite(spec.tiers[b.level-1].sprite,cp.x,cp.y,size,b.hp<=0?.25:b.remaining>0?.6:1);
    const p=this.project(cp.x,cp.y);if(b.hp<=0){c.fillStyle='#685b4c';c.font='11px Arial';c.fillText('Repair',p.x-15,p.y+22);}
    if(b.remaining>0){c.fillStyle='#304534';c.font='10px Arial';c.textAlign='center';c.fillText(`${Math.ceil(b.remaining)}s`,p.x,p.y-size+11);c.textAlign='left';}
    if(b.hp>0&&b.hp<spec.tiers[b.level-1].hp)this.bar(p.x,p.y+14,b.hp/spec.tiers[b.level-1].hp,32,'#9caa66');
   }else{
    const unit=kind==='unit';if(b.hp<=0)continue;
    this.sprite(unit?this.data.troops[b.type].sprite:'raider.png',b.x,b.y,39);
    const p=this.project(b.x,b.y);
    if(unit){
     const item=this.data.items[b.gear];c.save();c.translate(p.x+12,p.y-8);if(b.animation>0)c.rotate(item.animation==='slam'?-1.2:Math.sin(b.animation*14)*1.1);c.drawImage(this.images[item.sprite],-8,-24,29,29);c.restore();
     if(b.carry>0){c.fillStyle='#d3ae61';c.fillRect(p.x-14,p.y-10,4,5);}
     if(b.hp<stats(b,this.data).hp)this.bar(p.x,p.y+10,b.hp/stats(b,this.data).hp,20,'#80a56b');
    }else this.bar(p.x,p.y+9,b.hp/b.maxHp,22,'#bd7770');
   }
  }
  if(this.placing&&this.hover){const size=this.data.buildings[this.placing].size;this.sprite(this.data.buildings[this.placing].tiers[0].sprite,this.hover.x+size/2,this.hover.y+size/2,size===2?93:66,.5);}
  for(const e of world.effects){const a=this.project(e.x,e.y),b=this.project(e.tx,e.ty);c.globalAlpha=e.life/.3;c.strokeStyle=e.kind==='heal'?'#e4efb0':e.kind==='arrow'?'#f6ecbb':'#f5d78d';c.lineWidth=e.kind==='slam'?5:2;c.beginPath();if(e.kind==='heal'||e.kind==='slam'){c.ellipse(b.x,b.y-8,25,12,0,0,Math.PI*2);}else{c.moveTo(a.x,a.y-12);c.lineTo(b.x,b.y-12);}c.stroke();c.globalAlpha=1;}
  // Fireflies and chimney smoke are decorative only.
  for(let i=0;i<8;i++){const p=this.project(4+i*1.8,4+(i*3)%9);c.globalAlpha=.25+Math.sin(time/1000+i)*.2;c.fillStyle='#fcf4c0';c.fillRect(p.x+Math.sin(time/1500+i)*8,p.y-25,2,2);}c.globalAlpha=1;
 }
 bar(x,y,fraction,width,color){const c=this.ctx;c.fillStyle='#43573d66';c.fillRect(x-width/2,y,width,3);c.fillStyle=color;c.fillRect(x-width/2,y,width*Math.max(0,Math.min(1,fraction)),3);}
}
