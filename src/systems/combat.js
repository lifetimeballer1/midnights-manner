import {distance,center,stats,unlockedAbilities,auras} from '../model.js';
import {move} from './pathfinding.js';
import {sfx} from './audio.js';
export function spawnRaid(world,count=4) {
 world.wave++;world.raidTimer=0;world.raidAge=0;world.raidKills=world.raidKills??0;world.raidLoot=world.raidLoot??0;
 for(let i=0;i<count;i++) world.enemies.push({id:crypto.randomUUID(),x:.5,y:3.5+i%10,hp:65+world.wave*12,maxHp:65+world.wave*12,damage:9+world.wave*2,attackTimer:i*.2,animation:0});
}
function push(world,effect){if(world.effects.length<140)world.effects.push(effect);}
function dmgNum(world,to,amount){push(world,{x:to.x,y:to.y,tx:to.x,ty:to.y-.9,kind:'dmg',text:String(Math.max(1,Math.round(amount))),life:.7});}
function effect(world,from,to,kind){world.effects.push({x:from.x,y:from.y,tx:to.x,ty:to.y,kind,life:.3});}
export function activateAbility(world,data,unit,id) {
 const a=unlockedAbilities(unit,data).find(a=>a.id===id&&a.active);
 if(!a||unit.hp<=0||unit.abilityTimer>0)return false;
 if(a.effect==='heal')for(const ally of world.troops)if(ally.hp>0&&distance(unit,ally)<=a.radius)ally.hp=Math.min(stats(ally,data).hp,ally.hp+a.value);
 unit.abilityTimer=a.cooldown;effect(world,unit,unit,'heal');return true;
}
export function tickCombat(world,data,dt) {
 const aura=auras(world,data);
 for(const e of world.effects)e.life-=dt;
 world.effects=world.effects.filter(e=>e.life>0);
 for(const unit of world.troops) {
  unit.attackTimer=Math.max(0,unit.attackTimer-dt);unit.abilityTimer=Math.max(0,unit.abilityTimer-dt);unit.animation=Math.max(0,unit.animation-dt);
  if(unit.hp<=0)continue;
  if(!world.enemies.length){unit.hp=Math.min(stats(unit,data).hp,unit.hp+dt*2);continue;}
  if(data.troops[unit.type].role!=='combat')continue;
  const enemy=world.enemies.filter(e=>e.hp>0).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];if(!enemy)continue;
  const s=stats(unit,data);
  if(move(world,data,unit,enemy,s.speed,dt,s.range)&&unit.attackTimer<=0){
   const dealt=s.damage*(1+aura.damage);
   enemy.hp-=dealt;unit.attackTimer=1;unit.animation=.4;effect(world,unit,enemy,data.items[unit.gear].animation);dmgNum(world,enemy,dealt);
   for(const a of unlockedAbilities(unit,data)) if(a.effect==='splash')for(const other of world.enemies)if(other!==enemy&&distance(other,enemy)<a.radius)other.hp-=s.damage*a.factor;
  }
 }
 for(const b of world.buildings) {
  if(b.hp<=0||b.remaining>0)continue;
  b.cooldown=Math.max(0,b.cooldown-dt);const tier=data.buildings[b.type].tiers[b.level-1];if(!tier.damage)continue;
  const c=center(b,data),enemy=world.enemies.find(e=>e.hp>0&&distance(c,e)<tier.range);
  if(enemy&&b.cooldown===0){enemy.hp-=tier.damage;b.cooldown=b.type==='trap'?8:1.2;effect(world,c,enemy,b.type==='trap'?'slam':'arrow');dmgNum(world,enemy,tier.damage);}
 }
 for(const enemy of world.enemies) {
  if(enemy.hp<=0)continue;enemy.attackTimer-=dt;
  const targetUnit=world.troops.filter(t=>t.hp>0&&distance(enemy,t)<1.4).sort((a,b)=>distance(enemy,a)-distance(enemy,b))[0];
  const buildings=world.buildings.filter(b=>b.hp>0&&b.type!=='trap').sort((a,b)=>distance(enemy,center(a,data))-distance(enemy,center(b,data)));
  const target=targetUnit||buildings[0];if(!target)continue;
  const targetPoint=targetUnit?target:center(target,data),range=targetUnit?1.1:data.buildings[target.type].size/2+.7;
  if(move(world,data,enemy,targetPoint,.95,dt,range)&&enemy.attackTimer<=0){
   let reduction=aura.armor;if(targetUnit) reduction+=unlockedAbilities(target,data).filter(a=>a.effect==='armor').reduce((n,a)=>n+a.value,0);
   target.hp=Math.max(0,target.hp-enemy.damage*(1-Math.min(.8,reduction)));enemy.attackTimer=1.3;effect(world,enemy,targetPoint,'slash');push(world,{x:targetPoint.x,y:targetPoint.y,tx:targetPoint.x,ty:targetPoint.y,kind:'hit',life:.18});sfx.hit();
  }
 }
 const dead=world.enemies.filter(e=>e.hp<=0).length;world.raidKills=(world.raidKills??0)+dead;const loot=dead*5;world.raidLoot=(world.raidLoot??0)+loot;world.resources.gold+=loot;
 world.enemies=world.enemies.filter(e=>e.hp>0);world.raidAge=(world.raidAge??0)+dt;
 if(!world.enemies.length)for(const u of world.troops)if(u.hp<=0){u.hp=stats(u,data).hp*.3;u.x=10.5;u.y=10.5;}
}
