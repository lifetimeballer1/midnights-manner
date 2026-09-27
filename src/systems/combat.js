import {enemyRole,defenseTarget,retreat,enemyBuildingTarget} from './tactics.js';
import {distance,center,stats,unlockedAbilities,auras,gearArmor,proximityArmor,reviveFraction,siegeBonus} from '../model.js';
import {move,blocked} from './pathfinding.js';
import {isWall} from './walls.js';
import {sfx} from './audio.js';
export function raidSides(wave,count) {
 const sides=['west','north','east','south'];
 return Array.from({length:Math.min(4,count)},(_,i)=>sides[(Math.max(0,wave-1)+i)%4]);
}
export function spawnRaid(world,count=4,scaling=null,data=null,faction=null) {
 world.wave++;world.raidTimer=0;world.raidAge=0;world.raidKills=world.raidKills??0;world.raidLoot=world.raidLoot??0;
 // Wave-scaled missions (the Pale Host onward): a mission may steepen the
 // climb through data `scaling: {hp, damage}` per wave. Home raids omit
 // it and ride the classic 65+12N curve untouched.
 const hpPer=scaling&&Number.isFinite(scaling.hp)?scaling.hp:12;
 const dmgPer=scaling&&Number.isFinite(scaling.damage)?scaling.damage:2;
 const hp=65+world.wave*hpPer,dmg=9+world.wave*dmgPer;
 // Use the settled perimeter, clamped to the configured navigation grid.
 const width=Math.min(world.bounds?.w||data?.world.width||20,data?.world.width||Infinity);
 const height=Math.min(world.bounds?.h||data?.world.height||17,data?.world.height||Infinity);
 const sides=raidSides(world.wave,count);
 for(let i=0;i<count;i++) {
  const side=sides[i%sides.length],vertical=side==='west'||side==='east',length=vertical?height:width;
  const entries=Array.from({length:Math.max(1,length-2)},(_,n)=>{
   const along=1.5+(n+2+Math.floor(i/4)*3)%(length-2);
   return vertical?{x:side==='west'?.5:width-.5,y:along}:{x:along,y:side==='north'?.5:height-.5};
  });
  const entry=entries.find(p=>!data||!blocked(world,data,Math.floor(p.x),Math.floor(p.y)));
  if(entry){const role=faction?.roles[i%faction.roles.length],spec=data?.world.enemyRoles?.[role]||{};
   world.enemies.push({id:crypto.randomUUID(),...entry,hp:hp*(spec.hp||1),maxHp:hp*(spec.hp||1),damage:dmg*(spec.damage||1),role,faction:faction?.id,attackTimer:i*.2,animation:0});}
 }
 // Flawless tracking (Rue's terms): a fresh raid opens the ledger with
 // zero building losses; multi-wave assaults keep one ledger per raid.
 if(!world.inRaid){world.inRaid=true;world.raidLosses=0;}
}
function push(world,effect){if(world.effects.length<140)world.effects.push(effect);}
function dmgNum(world,to,amount){push(world,{x:to.x,y:to.y,tx:to.x,ty:to.y-.9,kind:'dmg',text:String(Math.max(1,Math.round(amount))),life:.7});}
function effect(world,from,to,kind){world.effects.push({x:from.x,y:from.y,tx:to.x,ty:to.y,kind,life:.3});}
export function activateAbility(world,data,unit,id) {
 if(!unit||unit.hp<=0)return false;
 unit.attackTimer??=0;unit.abilityTimer??=0;
 let list=[];try{list=unlockedAbilities(unit,data);}catch{return false;}
 const a=list.find(a=>a.id===id&&a.active);
 if(!a||unit.abilityTimer>0)return false;
 if(a.effect==='heal')for(const ally of world.troops)if(ally.hp>0&&distance(unit,ally)<=a.radius)ally.hp=Math.min(stats(ally,data).hp,ally.hp+a.value);
 // Oathcall (Act VII): plant a sworn challenge — nearby raiders turn on
 // the oathbound while the taunt timer burns. Data radius/duration.
 if(a.effect==='taunt'){unit.taunt={radius:a.radius||2.5,timer:a.duration||8};effect(world,unit,unit,'sparkle');unit.abilityTimer=a.cooldown;return true;}
 // Arrowstorm (Act VII): an active splash — the sky darkens over the
 // nearest raider and every enemy in the arc takes the storm. Generic:
 // any future active splash rides this same branch.
 if(a.effect==='splash'&&a.active){
  const aura=auras(world,data),s2=stats(unit,data);
  const foe=world.enemies.filter(e=>e.hp>0).sort((x,y)=>distance(unit,x)-distance(unit,y))[0];
  if(!foe)return false;
  for(const e of world.enemies)if(e.hp>0&&distance(e,foe)<=(a.radius||1.5)){const dealt=s2.damage*(1+aura.damage)*(a.factor||0.5);e.hp-=dealt;effect(world,unit,e,data.items[unit.gear].animation);dmgNum(world,e,dealt);}
  unit.abilityTimer=a.cooldown;return true;
 }
 // Drills ('buff'-effect actives: Brace, Rally): plant a transient buff on
 // the bearer, or on every living ally in radius when one is given.
 if(a.effect==='buff'&&a.stat){
  const targets=a.radius?world.troops.filter(t=>t.hp>0&&distance(unit,t)<=a.radius):[unit];
  for(const t of targets){t.buffs=t.buffs||{};t.buffs[a.stat]={value:a.value,timer:a.duration||6};}
  effect(world,unit,unit,'sparkle');
 }
 else effect(world,unit,unit,'heal');
 unit.abilityTimer=a.cooldown;return true;
}
export function tickCombat(world,data,dt) {
 if(!Number.isFinite(dt)||dt<=0)return;
 const aura=auras(world,data);
 for(const e of world.effects)e.life-=dt;
 world.effects=world.effects.filter(e=>e.life>0);
 for(const unit of world.troops) {
  unit.attackTimer=Math.max(0,(unit.attackTimer??0)-dt);unit.abilityTimer=Math.max(0,(unit.abilityTimer??0)-dt);unit.animation=Math.max(0,(unit.animation??0)-dt);
  // Drills fade: transient buff timers tick down even off-raid. Sworn
  // challenges (taunt) burn down beside them.
  if(unit.buffs)for(const k of Object.keys(unit.buffs)){unit.buffs[k].timer-=dt;if(unit.buffs[k].timer<=0)delete unit.buffs[k];}
  if(unit.taunt){unit.taunt.timer-=dt;if(unit.taunt.timer<=0)delete unit.taunt;}
  if(unit.hp<=0||unit.expedition)continue;
  // Quiet hands: passive 'heal'-effect abilities without `active` mend
  // their bearer each second (the K1 track's Mend). Castable heals still
  // go through activateAbility; this never spends a cooldown.
  for(const a of unlockedAbilities(unit,data)) if(a.effect==='heal'&&!a.active&&a.value>0)unit.hp=Math.min(stats(unit,data).hp,unit.hp+a.value*dt);
  // Burn wards (Ashen Cloak onward): a burning villager's wardrobe resists
  // up to immunity. No live source sets troops alight yet — the math is
  // pinned in-test and waits on the enemy-burn doctrine, like trade auras
  // before the market. Never NaNs: missing burn reads zero.
  if(unit.burn&&unit.burn.timer>0){
   let resist=0;
   for(const gid of [unit.gear,unit.armor]){const gs=(gid&&data.items[gid]&&data.items[gid].stats)||{};if(Number.isFinite(gs.burnResist))resist=Math.max(resist,gs.burnResist);}
   unit.hp-=unit.burn.dps*(1-Math.min(1,resist))*dt;unit.burn.timer-=dt;
  }
  const s=stats(unit,data);
  const order=unit.order;
  if(order&&order.kind==='move'&&Number.isFinite(order.x)&&Number.isFinite(order.y)){
   if(move(world,data,unit,order,s.speed,dt,.4))unit.order=null;
   continue;
  }
  if(order&&order.kind==='hold'){const e2=world.enemies.filter(e=>e.hp>0).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];if(e2&&distance(unit,e2)<=s.range&&unit.attackTimer<=0){const dealt=s.damage*(1+aura.damage);e2.hp-=dealt;unit.attackTimer=1;unit.animation=.4;effect(world,unit,e2,data.items[unit.gear].animation);dmgNum(world,e2,dealt);}continue;}
  if(order&&order.kind==='attack'){const tgt=world.enemies.find(e=>e.id===order.targetId&&e.hp>0);if(!tgt){unit.order=null;continue;}
   if(move(world,data,unit,tgt,s.speed,dt,s.range)&&unit.attackTimer<=0){const dealt=s.damage*(1+aura.damage);tgt.hp-=dealt;unit.attackTimer=1;unit.animation=.4;effect(world,unit,tgt,data.items[unit.gear].animation);dmgNum(world,tgt,dealt);}continue;}
  if(!world.enemies.length){unit.hp=Math.min(stats(unit,data).hp,unit.hp+dt*2);continue;}
  if(data.troops[unit.type].role!=='combat')continue;
  const enemy=defenseTarget(world,data,unit);if(!enemy)continue;
  if(s.range>2&&distance(unit,enemy)<1.7)retreat(world,data,unit,enemy,s.speed,dt);
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
  if(enemy&&b.cooldown===0){
   // Siege-craft: tongs-sharpened crews teach every defense — trap, tower
   // and watchfire all ride the same bonus. Fire traps add a burn stack:
   // damage-over-time from data `burn`/`burnDuration`, first of its kind.
   const mult=1+siegeBonus(world,data),dealt=(tier.damage||0)*mult;
   enemy.hp-=dealt;
   if(tier.burn)enemy.burn={dps:tier.burn*mult,timer:tier.burnDuration||3};
   b.cooldown=b.type==='trap'?8:1.2;effect(world,c,enemy,b.type==='trap'?'slam':'arrow');dmgNum(world,enemy,dealt);
  }
 }
 for(const enemy of world.enemies) {
  if(enemy.hp<=0)continue;enemy.attackTimer=(enemy.attackTimer??0)-dt;
  // Burn ticks before blades: lit raiders smolder each second.
  if(enemy.burn&&enemy.burn.timer>0){enemy.hp-=enemy.burn.dps*dt;enemy.burn.timer-=dt;}
  if(enemy.hp<=0)continue;
  // Sworn challenges first: a living oathbound whose taunt covers this
  // ground pulls the raider off its path. Otherwise the nearest hand.
  const sworn=world.troops.filter(t=>t.hp>0&&t.taunt&&t.taunt.timer>0&&distance(enemy,t)<=t.taunt.radius).sort((a,b)=>distance(enemy,a)-distance(enemy,b))[0];
  const targetUnit=sworn||world.troops.filter(t=>t.hp>0&&!t.expedition&&distance(enemy,t)<Math.max(1.4,enemyRole(data,enemy).range||0)).sort((a,b)=>distance(enemy,a)-distance(enemy,b))[0];
  const role=enemyRole(data,enemy);
  const target=targetUnit||enemyBuildingTarget(world,data,enemy);if(!target)continue;
  enemy.targetId=target.id;
  const targetPoint=targetUnit?target:center(target,data),range=targetUnit?(role.range||1.1):data.buildings[target.type].size/2+Math.max(.7,(role.range||1.1)-.4);
  const arrived=move(world,data,enemy,targetPoint,role.speed||.95,dt,range);
  if(!arrived){
   const barrier=world.buildings.filter(b=>isWall(b)&&b.hp>0&&distance(enemy,center(b,data))<=1.2).sort((a,b)=>distance(enemy,center(a,data))-distance(enemy,center(b,data)))[0];
   if(barrier&&enemy.attackTimer<=0){
    barrier.hp=Math.max(0,barrier.hp-enemy.damage*(role.wallDamage||1));enemy.attackTimer=1.3;
    effect(world,enemy,center(barrier,data),'slash');
    if(barrier.hp<=0)world.raidLosses=(world.raidLosses||0)+1;
    continue;
   }
  }
  if(!arrived&&!targetUnit&&target){
   // Walled in? Chew the adjacent barrier so raids never soft-lock.
   const bb=target;let adjacent=false;
   const bx0=Math.floor(enemy.x),by0=Math.floor(enemy.y);
   for(let yy=bb.y-1;yy<bb.y+data.buildings[bb.type].size+1&&!adjacent;yy++)for(let xx=bb.x-1;xx<bb.x+data.buildings[bb.type].size+1&&!adjacent;xx++)if(xx===bx0&&yy===by0)adjacent=true;
   if(adjacent&&enemy.attackTimer<=0){bb.hp=Math.max(0,bb.hp-enemy.damage*(isWall(bb)?role.wallDamage||1:1));if(bb.hp<=0)world.raidLosses=(world.raidLosses||0)+1;enemy.attackTimer=1.3;effect(world,enemy,center(bb,data),'slash');push(world,{x:targetPoint.x,y:targetPoint.y,tx:targetPoint.x,ty:targetPoint.y,kind:'hit',life:.18});continue;}
  }
  if(arrived&&enemy.attackTimer<=0){
   // Armor stacks: sky aura + ability resolve + worn gear (Padded Coat
   // onward, read through gearArmor) + the phalanx shield-line ('guard'-
   // effect allies in radius lend their value) + Oathstone ground (Act VII
   // proximity armor). The 0.8 ceiling still holds.
   let reduction=aura.armor;if(targetUnit){const tAbilities=unlockedAbilities(target,data);reduction+=tAbilities.filter(a=>a.effect==='armor').reduce((n,a)=>n+a.value,0);
    // The Last Watch holds harder: oathbound wardens read +0.25 armor
    // under the same 0.8 ceiling — the oath guards, it does not break.
    if(targetUnit.oath)reduction+=0.25;try{reduction+=gearArmor(target,data);}catch{}
    try{reduction+=proximityArmor(target,world,data);}catch{}
    if(targetUnit.hp>0)for(const ally of world.troops){if(ally.id===target.id||ally.hp<=0)continue;try{for(const a of unlockedAbilities(ally,data))if(a.effect==='guard'&&distance(ally,target)<=a.radius)reduction+=a.value;}catch{}}}
   const raw=enemy.damage*(1-Math.min(.8,reduction))*(!targetUnit&&isWall(target)?role.wallDamage||1:1);
   if(targetUnit&&raw>=target.hp&&!target.unbrokenUsed){try{if(unlockedAbilities(target,data).some(a=>a.effect==='unbroken')){target.hp=1;target.unbrokenUsed=true;enemy.attackTimer=1.3;push(world,{x:targetPoint.x,y:targetPoint.y,tx:targetPoint.x,ty:targetPoint.y-1,kind:'float',text:'UNBROKEN!',color:'#ffe9a8',life:.9});effect(world,enemy,targetPoint,'slash');sfx.hit();continue;}}catch{}}
   target.hp=Math.max(0,target.hp-raw);enemy.attackTimer=1.3;effect(world,enemy,targetPoint,role.range>2?'arrow':'slash');push(world,{x:targetPoint.x,y:targetPoint.y,tx:targetPoint.x,ty:targetPoint.y,kind:'hit',life:.18});sfx.hit();
   // Rue's ledger: a building that falls while raiders walk counts against
   // the flawless defense. Troops falling never do — only walls and roofs.
   if(!targetUnit&&target.hp<=0)world.raidLosses=(world.raidLosses||0)+1;
  }
 }
 for(const e of world.enemies)if(e.hp<=0)push(world,{x:e.x,y:e.y,tx:e.x,ty:e.y,kind:'poof',life:.4});
 const dead=world.enemies.filter(e=>e.hp<=0).length;world.raidKills=(world.raidKills??0)+dead;const loot=dead*5;world.raidLoot=(world.raidLoot??0)+loot;world.resources.gold+=loot;
 world.enemies=world.enemies.filter(e=>e.hp>0);world.raidAge=(world.raidAge??0)+dt;
 if(world.enemies.length&&world.raidAge>240){
  // Failsafe: a raid dragging past 4 minutes is soft-locked — raiders flee.
  world.enemies=[];world.raidFled=true;
 }
 // The raid just ended (one ledger per raid, multi-wave or single): a
 // defense with zero building losses and real kills is flawless — Rue's
 // terms. Worn plate dulls a notch on every armored survivor, and spent
 // oaths (unbroken) are ready to be sworn again next raid.
 const raidJustEnded=world.inRaid&&world.enemies.length===0;
 if(raidJustEnded){
  world.inRaid=false;
  if((world.raidLosses||0)===0&&(world.raidKills||0)>0)world.flawlessRaids=(world.flawlessRaids||0)+1;
  world.raidLosses=0;
  for(const u of world.troops){u.unbrokenUsed=false;if(u.armor)u.armorWear=(u.armorWear||0)+1;}
 }
 // The fallen rise at the best finished revive rate in the village — cold
 // ground 30%, Bellcote mercy 50%. Data, never a hardcoded second rule.
 // The oath carves the one exception: oathbound who fall stay fallen, and
 // their names go on the cairn list — the stakes, by player consent.
 if(!world.enemies.length)for(const u of world.troops)if(u.hp<=0){
  if(u.oath){world.fallen=world.fallen||[];if(!world.fallen.some(f=>f.id===u.id))world.fallen.push({id:u.id,name:u.name||data.troops[u.type].name,type:u.type});continue;}
  u.hp=stats(u,data).hp*reviveFraction(world,data);u.x=10.5;u.y=10.5;
 }
}
