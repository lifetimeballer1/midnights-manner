import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeUnit} from '../src/model.js';
import {Renderer} from '../src/renderer.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function fixture(){
 const w=createWorld(data),hall=w.buildings.find(b=>b.type==='hall');hall.remaining=0;
 const u=makeUnit('farmer',data);u.id='sheltered-farmer';u.x=hall.x+1;u.y=hall.y+data.buildings.hall.size+.5;u.shelteredIn=hall.id;u.emergency={kind:'shelter',target:hall.id};w.troops=[u];w.enemies=[];
 const ctx=new Proxy({measureText:()=>({width:60})},{get:(t,k)=>k in t?t[k]:(...args)=>k.includes('Gradient')?{addColorStop(){}}:undefined,set:(t,k,v)=>(t[k]=v,true)});
 const r=new Renderer({getContext:()=>ctx},data,{});r.resize(390,844,2);r.fitVillage(w);r.calm=true;
 return {w,hall,u,r};
}
test('sheltered civilians have no exterior meshes, touch areas, shadows or footsteps',()=>{
 const {w,u,r}=fixture();
 for(const zoom of [.7,1.65])for(const yaw of [Math.PI/4,Math.PI*1.25]){
  r.cam.zoom=zoom;r.cam.yaw=yaw;r.selection=u.id;r.draw(w,1000);
  assert.equal(r.sceneFaces.some(f=>f.owner?.id===u.id),false);
  assert.equal(r.hitAreas.some(h=>h.id===u.id),false);
  assert.equal(r.lightingStats.unitShadows,0);
  assert.equal(r._strideActors?.has('u'+u.id)||false,false);
 }
});
test('shelter exit and building destruction immediately restore exterior rendering',()=>{
 const {w,u,r,hall}=fixture();r.draw(w,1000);
 hall.hp=0;r.draw(w,1100);
 assert.ok(r.sceneFaces.some(f=>f.owner?.id===u.id),'invalid shelter is never cached as indoor');
 hall.hp=1000;delete u.shelteredIn;delete u.emergency;r.draw(w,1200);
 assert.ok(r.hitAreas.some(h=>h.id===u.id));
 assert.ok(r.lightingStats.unitShadows>0);
});
