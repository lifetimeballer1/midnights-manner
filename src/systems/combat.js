import {towerCrewBonus, raidDamageMult} from './villagers.js';
import {enemyRole,defenseTarget,retreat,enemyBuildingTarget} from './tactics.js';
import {distance,center,stats,unlockedAbilities,auras,gearArmor,proximityArmor,reviveFraction,siegeBonus} from '../model.js';
import {move,blocked} from './pathfinding.js';
import {enemyDamageMult,enemySpeedMult} from './daynight.js';
import {isWall} from './walls.js';
import {bossTick,bossAuraMult,isSiegeRole,eliteLootMult,renownDamageMult,renownLootMult,paragonDamageMult,markElites} from './endgame.js';
import {sfx, scheduleSound} from './audio.js';
import {listenerGain} from './soundstage.js';
// Release/impact split: the swing (or bow release) sounds now; the impact
// thud lands after arrow-flight time (distance-scaled) or a melee beat.
// Damage itself is untouched — this only separates what the ear hears.
function flightTime(from, to) {
  try {
    const d = Math.hypot(from.x - to.x, from.y - to.y);
    return Math.max(0.05, Math.min(0.5, d * 0.09));
  } catch { return 0.12; }
}
export function strikeSound(from, to, ranged) {
  const g = listenerGain('combat');
  if (!(g > 0)) return;
  if (ranged) {
    sfx.arrow({vol: g});
    const f = flightTime(from, to);
    scheduleSound(f, () => { const g2 = listenerGain('combat'); if (g2 > 0) sfx.hit({vol: g2}); });
  } else {
    sfx.blade({vol: g});
    scheduleSound(0.07, () => { const g2 = listenerGain('combat'); if (g2 > 0) sfx.hit({vol: g2}); });
  }
}
const STONE_WALLS = new Set(['stonewall', 'rampart']);
export function wallSound(b) {
  const g = listenerGain('combat');
  if (!(g > 0)) return;
  if (b && STONE_WALLS.has(b.type)) sfx.wallStone({vol: g});
  else sfx.wallWood({vol: g});
}
import {grantCentral} from './storage.js';
import {warChestBonus} from './warchest.js';
export function raidSides(wave,count) {
 const sides=['west','north','east','south'];
 return Array.from({length:Math.min(4,count)},(_,i)=>sides[(Math.max(0,wave-1)+i)%4]);
}
// Wave stars for the raid result card: flawless holds earn three, costly
// victories fewer, defeats none. Pure read of the raid ledger — no sim.
export function raidStars(r) {
 if (!r || !r.won) return 0;
 const damaged = Math.max(0, Number(r.damaged) || 0);
 if (damaged <= 0) return 3;
 if (damaged <= 2) return 2;
 return 1;
}
// Spawn protection (Phase 8): the settlement's exclusion footprint — every
// structure's tile span grown by a buffer (`world.spawnBuffer`, default 2).
// Enemies never materialize on or beside the built-up town; one Set per
// raid keeps the check O(1) per candidate.
export function spawnExclusion(world, data, buffer) {
 const pad=Number.isFinite(+buffer)?Math.max(0,Math.floor(+buffer)):(Number.isFinite(+data?.world?.spawnBuffer)?Math.max(0,Math.floor(+data.world.spawnBuffer)):2);
 const out=new Set();
 for(const b of world?.buildings||[]){
  if(!b||!Number.isFinite(b.x)||!Number.isFinite(b.y))continue;
  const size=Number.isFinite(+data?.buildings?.[b.type]?.size)?+data.buildings[b.type].size:1;
  for(let y=b.y-pad;y<b.y+size+pad;y++)for(let x=b.x-pad;x<b.x+size+pad;x++)out.add(x+','+y);
 }
 return out;
}
export function spawnRaid(world,count=4,scaling=null,data=null,faction=null,opts=null) {
 world.wave++;world.raidTimer=0;world.raidAge=0;world.raidKills=world.raidKills??0;world.raidLoot=world.raidLoot??0;
 // Wave-scaled missions (the Pale Host onward): a mission may steepen the
 // climb through data `scaling: {hp, damage}` per wave. Home raids omit
 // it and ride the classic 65+12N curve untouched.
 const hpPer=scaling&&Number.isFinite(scaling.hp)?scaling.hp:12;
 const dmgPer=scaling&&Number.isFinite(scaling.damage)?scaling.damage:2;
 // Endgame ladder (Phase 12): multiplicative threat over the classic
 // curve, passed as opts.scaling. No opts, no change — mid-game untouched.
 const eg=opts?.scaling||null;
 const hp=(65+world.wave*hpPer)*(eg?.hp||1),dmg=(9+world.wave*dmgPer)*(eg?.damage||1);
 // Use the settled perimeter, clamped to the configured navigation grid.
 const width=Math.min(world.bounds?.w||data?.world.width||20,data?.world.width||Infinity);
 const height=Math.min(world.bounds?.h||data?.world.height||17,data?.world.height||Infinity);
 const worldW=Number.isFinite(+data?.world?.width)?+data.world.width:width;
 const worldH=Number.isFinite(+data?.world?.height)?+data.world.height:height;
 const exclusion=spawnExclusion(world,data);
 const taken=new Set();
 const clear=p=>{const key=Math.floor(p.x)+','+Math.floor(p.y);return !taken.has(key)&&(!data||(!exclusion.has(key)&&!blocked(world,data,Math.floor(p.x),Math.floor(p.y))));};
 const sides=raidSides(world.wave,count);
 for(let i=0;i<count;i++) {
  const side=sides[i%sides.length],vertical=side==='west'||side==='east',length=vertical?height:width;
  const entries=Array.from({length:Math.max(1,length-2)},(_,n)=>{
   const along=1.5+(n+2+Math.floor(i/4)*3)%(length-2);
   return vertical?{x:side==='west'?.5:width-.5,y:along}:{x:along,y:side==='north'?.5:height-.5};
  });
  let entry=entries.find(clear);
  if(!entry){
   // The ring moves outward: when the near edge is wall-to-wall with the
   // settlement, raiders muster in the wild beyond it instead.
   for(let step=1;step<=6&&!entry;step++){
    const out=entries.map(p=>vertical?{x:side==='west'?p.x-step:p.x+step,y:p.y}:{x:p.x,y:side==='north'?p.y-step:p.y+step})
     .filter(p=>p.x>=.5&&p.y>=.5&&p.x<=worldW-.5&&p.y<=worldH-.5);
    entry=out.find(clear);
   }
  }
  if(!entry&&!opts?.strictExclusion)entry=entries.find(p=>!data||!blocked(world,data,Math.floor(p.x),Math.floor(p.y)));
  if(entry){const role=faction?.roles[i%faction.roles.length],spec=data?.world.enemyRoles?.[role]||{};
   taken.add(Math.floor(entry.x)+','+Math.floor(entry.y));
   world.enemies.push({id:crypto.randomUUID(),...entry,hp:hp*(spec.hp||1),maxHp:hp*(spec.hp||1),damage:dmg*(spec.damage||1),role,faction:faction?.id,attackTimer:i*.2,animation:0});}
 }
 // Flawless tracking (Rue's terms): a fresh raid opens the ledger with
 // zero building losses; multi-wave assaults keep one ledger per raid.
 if(!world.inRaid){world.inRaid=true;world.raidLosses=0;}
 // Late-war veterans walk among the raiders — data chance, never bosses.
 if(opts?.eliteChance>0&&data){try{markElites(world,data,opts.eliteChance,opts.random);}catch{}}
}
function push(world,effect){if(world.effects.length<140)world.effects.push(effect);}
// Perf: linear nearest scan — replaces filter+sort+[0]. Strict < keeps the
// first minimal, exactly what the stable sort's [0] returned.
function nearestFoe(enemies,unit) {
 let best=null,bestD=Infinity;
 for(const e of enemies){if(e.hp<=0)continue;const d=distance(unit,e);if(d<bestD){bestD=d;best=e;}}
 return best;
}
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
  const foe=nearestFoe(world.enemies,unit);
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
 // Perf: raid presence scanned once (was once per troop). Building index
 // + urgency memo for defenseTarget (targetIds only change in the enemy
 // loop below, after the troops loop — same values, no re-scans).
 const raidActive=world.enemies.some(e=>e.hp>0);
 // Living sky (Phase 10): raiders hit harder after dark and trudge in
 // fog. Worlds without flags (old saves, direct ticks) read exactly 1.
  const skyDmg=enemyDamageMult(world,data),skySlow=enemySpeedMult(world,data);
  // War Chest (Phase 6): frostwood stakes slow the charge and blunt siege
  // blows against walls; arrows sharpen every tower. Data, armed-only.
  const chestSlow=1-Math.min(0.4,Math.max(0,warChestBonus(world,data,'slow')));
  const chestGuard=1-Math.min(0.5,Math.max(0,warChestBonus(world,data,'wallGuard')));
  const chestArrows=1+Math.max(0,warChestBonus(world,data,'damage'));
 const postOf=new Map();
 for(const b of world.buildings)postOf.set(b.id,b);
 const tgtCtx={postOf,urgCache:new Map()};
 for(const e of world.effects)e.life-=dt;
 world.effects=world.effects.filter(e=>e.life>0);
 for(const unit of world.troops) {
  unit.attackTimer=Math.max(0,(unit.attackTimer??0)-dt);unit.abilityTimer=Math.max(0,(unit.abilityTimer??0)-dt);unit.animation=Math.max(0,(unit.animation??0)-dt);
  // Drills fade: transient buff timers tick down even off-raid. Sworn
  // challenges (taunt) burn down beside them.
  if(unit.buffs)for(const k of Object.keys(unit.buffs)){unit.buffs[k].timer-=dt;if(unit.buffs[k].timer<=0)delete unit.buffs[k];}
  if(unit.taunt){unit.taunt.timer-=dt;if(unit.taunt.timer<=0)delete unit.taunt;}
  if(unit.hp<=0||unit.expedition)continue;
  // Perf: one stats + one abilities read per troop per tick (were up to
  // 3 stats + 2 abilities). Inputs (level/gear/buffs) are untouched until
  // the enemy loop, so every later use below reads identical values.
  const s=stats(unit,data);
  const abs=unlockedAbilities(unit,data);
  // Quiet hands: passive 'heal'-effect abilities without `active` mend
  // their bearer each second (the K1 track's Mend). Castable heals still
  // go through activateAbility; this never spends a cooldown.
  for(const a of abs) if(a.effect==='heal'&&!a.active&&a.value>0)unit.hp=Math.min(s.hp,unit.hp+a.value*dt);
  // Burn wards (Ashen Cloak onward): a burning villager's wardrobe resists
  // up to immunity. No live source sets troops alight yet — the math is
  // pinned in-test and waits on the enemy-burn doctrine, like trade auras
  // before the market. Never NaNs: missing burn reads zero.
  if(unit.burn&&unit.burn.timer>0){
   let resist=0;
   for(const gid of [unit.gear,unit.armor]){const gs=(gid&&data.items[gid]&&data.items[gid].stats)||{};if(Number.isFinite(gs.burnResist))resist=Math.max(resist,gs.burnResist);}
   unit.hp-=unit.burn.dps*(1-Math.min(1,resist))*dt;unit.burn.timer-=dt;
  }
  if(unit.emergency)continue;
  const order=unit.order;
  if(order&&order.kind==='move'&&Number.isFinite(order.x)&&Number.isFinite(order.y)){
   if(move(world,data,unit,order,s.speed,dt,.4,false,true))unit.order=null;
   continue;
  }
  // Phase 7 temperament: Brave holds (+10%) and Cowardly falters (−10%) while raiders walk. No raid, no modifier.
  const grit=raidDamageMult(unit,raidActive);
   if(order&&order.kind==='hold'){const e2=nearestFoe(world.enemies,unit);if(e2&&distance(unit,e2)<=s.range&&unit.attackTimer<=0){const dealt=s.damage*(1+aura.damage)*grit;e2.hp-=dealt;unit.attackTimer=1;unit.animation=.4;effect(world,unit,e2,data.items[unit.gear].animation);strikeSound(unit,e2,s.range>2);dmgNum(world,e2,dealt);}continue;}
   if(order&&order.kind==='attack'){const tgt=world.enemies.find(e=>e.id===order.targetId&&e.hp>0);if(!tgt){unit.order=null;continue;}
    if(move(world,data,unit,tgt,s.speed,dt,s.range,false,true)&&unit.attackTimer<=0){const dealt=s.damage*(1+aura.damage)*grit;tgt.hp-=dealt;unit.attackTimer=1;unit.animation=.4;effect(world,unit,tgt,data.items[unit.gear].animation);strikeSound(unit,tgt,s.range>2);dmgNum(world,tgt,dealt);}continue;}
  if(!world.enemies.length){unit.hp=Math.min(s.hp,unit.hp+dt*2);continue;}
  if(data.troops[unit.type].role!=='combat')continue;
  const enemy=defenseTarget(world,data,unit,tgtCtx);if(!enemy)continue;
  if(s.range>2&&distance(unit,enemy)<1.7)retreat(world,data,unit,enemy,s.speed,dt);
   if(move(world,data,unit,enemy,s.speed,dt,s.range,false,true)&&unit.attackTimer<=0){
    const dealt=s.damage*(1+aura.damage)*grit;
    enemy.hp-=dealt;unit.attackTimer=1;unit.animation=.4;effect(world,unit,enemy,data.items[unit.gear].animation);strikeSound(unit,enemy,s.range>2);dmgNum(world,enemy,dealt);
   for(const a of abs) if(a.effect==='splash')for(const other of world.enemies)if(other!==enemy&&distance(other,enemy)<a.radius)other.hp-=s.damage*a.factor;
  }
 }
 // Perf: tower + siege bonuses are troop-derived and no troop changes in
 // the buildings loop — compute once (were once per tower).
 const towerBonus=towerCrewBonus(world),siege=siegeBonus(world,data);
 for(const b of world.buildings) {
  if(b.hp<=0||b.remaining>0)continue;
  b.cooldown=Math.max(0,b.cooldown-dt);const tier=data.buildings[b.type].tiers[b.level-1];if(!tier.damage)continue;
  const c=center(b,data);
  // Late-war doctrine (Phase 12): bastions and siegebane tiers answer
   // engines first — data `prefer: ["boss", "siege"]` aims them,
   // data `siegebane` sharpens them. Everything else holds the classic
   // nearest-raider discipline.
   const prefer=tier.prefer||[];
   const inRange=e=>e.hp>0&&distance(c,e)<tier.range;
   let enemy=null;
   if(prefer.length)enemy=world.enemies.find(e=>inRange(e)&&((prefer.includes('boss')&&e.role==='boss')||(prefer.includes('siege')&&isSiegeRole(data,e.role))));
   if(!enemy)enemy=world.enemies.find(inRange);
  if(enemy&&b.cooldown===0){
   // Siege-craft: tongs-sharpened crews teach every defense — trap, tower
   // and watchfire all ride the same bonus. Phase 7: living Marksmen spot
   // for the towers (+2% each, max +20%). Fire traps add a burn stack:
   // damage-over-time from data `burn`/`burnDuration`, first of its kind.
   // Phase 12: renown sharpens every defense, paragon hones the engine,
   // siegebane bites engines and crowns.
    const mult=(1+siege+towerBonus)*renownDamageMult(world,data)*paragonDamageMult(b,data)*chestArrows;
   let dealt=(tier.damage||0)*mult;
   if(tier.siegebane&&(enemy.role==='boss'||isSiegeRole(data,enemy.role)))dealt*=(1+tier.siegebane);
   enemy.hp-=dealt;
   if(tier.burn)enemy.burn={dps:tier.burn*mult,timer:tier.burnDuration||3};
   // Slow heavy engines (the ballista's data `cooldown`) reload on
   // their own rhythm; everything else keeps the classic cadence.
    b.cooldown=tier.cooldown??(b.type==='trap'?8:1.2);
    if(b.type==='trap'){
     const g=listenerGain('combat');
     effect(world,c,enemy,'slam');
     if(g>0){sfx.hit({vol:g});if(tier.burn)sfx.ignite({vol:g});}
     dmgNum(world,enemy,dealt);
    }else if(b.type==='ballista'){
     const g=listenerGain('combat');
     effect(world,c,enemy,'bolt');
     if(g>0){sfx.siege({vol:g});scheduleSound(flightTime(c,enemy)+0.1,()=>{const g2=listenerGain('combat');if(g2>0)sfx.hit({vol:g2,pitch:0.7});});}
     dmgNum(world,enemy,dealt);
    }else{
     effect(world,c,enemy,'arrow');strikeSound(c,enemy,true);dmgNum(world,enemy,dealt);
    }
  }
 }
 // Perf: wall membership never changes mid-tick (only hp does) — hoist the
 // list + centers once; hp stays a live check in the scan below.
 const walls=world.buildings.filter(isWall);
 const wallCenters=new Map();
 const wallCenter=b=>{let c=wallCenters.get(b);if(!c){c=center(b,data);wallCenters.set(b,c);}return c;};
 for(const enemy of world.enemies) {
  if(enemy.hp<=0)continue;enemy.attackTimer=(enemy.attackTimer??0)-dt;
  // Crowns of the late war (Phase 12): slam, muster, enrage and dread
   // all tick here. Heralds ride float-text so the field reads the moment.
   if(enemy.role==='boss'&&data){
    try{
     for(const ev of bossTick(world,data,enemy,dt)){
      if(ev.kind==='enrage')push(world,{x:enemy.x,y:enemy.y,tx:enemy.x,ty:enemy.y-1.2,kind:'float',text:`${enemy.bossName||'The boss'} ENRAGED!`,color:'#ff6b5e',life:1.2});
      else if(ev.kind==='summon')push(world,{x:enemy.x,y:enemy.y,tx:enemy.x,ty:enemy.y-1.2,kind:'float',text:`${enemy.bossName||'The boss'} musters ${ev.count}!`,color:'#ffb35e',life:1});
     }
    }catch{}
   }
  // Burn ticks before blades: lit raiders smolder each second.
  if(enemy.burn&&enemy.burn.timer>0){enemy.hp-=enemy.burn.dps*dt;enemy.burn.timer-=dt;}
  if(enemy.hp<=0)continue;
  const role=enemyRole(data,enemy);
  const reach=Math.max(1.4,role.range||0);
  // Perf: linear scans replace three filter+sort+[0] passes (sworn,
  // target, barrier). Strict < keeps the first minimal — exactly what
  // the stable sorts returned. hp stays live; the sworn short-circuit
  // (skip the target scan when sworn) is preserved.
  let sworn=null,swornD=Infinity;
  for(const t of world.troops){
   if(t.hp<=0||t.expedition)continue;
   if(!(t.taunt&&t.taunt.timer>0))continue;
   const d=distance(enemy,t);
   if(d<=t.taunt.radius&&d<swornD){swornD=d;sworn=t;}
  }
  let targetUnit=sworn;
  if(!targetUnit){
   let bestD=Infinity;
   for(const t of world.troops){
    if(t.hp<=0||t.expedition)continue;
    const d=distance(enemy,t);
    if(d<reach&&d<bestD){bestD=d;targetUnit=t;}
   }
  }
  const target=targetUnit||enemyBuildingTarget(world,data,enemy);if(!target)continue;
  enemy.targetId=target.id;
  const targetPoint=targetUnit?target:center(target,data),range=targetUnit?(role.range||1.1):data.buildings[target.type].size/2+Math.max(.7,(role.range||1.1)-.4);
  const arrived=move(world,data,enemy,targetPoint,(role.speed||.95)*skySlow*chestSlow,dt,range);
  if(!arrived){
   let barrier=null,barrierD=Infinity;
   for(const b of walls){
    if(b.hp<=0)continue;
    const d=distance(enemy,wallCenter(b));
    if(d<=1.2&&d<barrierD){barrierD=d;barrier=b;}
   }
   if(barrier&&enemy.attackTimer<=0){
     barrier.hp=Math.max(0,barrier.hp-enemy.damage*skyDmg*(role.wallDamage||1)*chestGuard);enemy.attackTimer=1.3;
     effect(world,enemy,center(barrier,data),'slash');wallSound(barrier);
    if(barrier.hp<=0)world.raidLosses=(world.raidLosses||0)+1;
    continue;
   }
  }
  if(!arrived&&!targetUnit&&target){
   // Walled in? Chew the adjacent barrier so raids never soft-lock.
   const bb=target;let adjacent=false;
   const bx0=Math.floor(enemy.x),by0=Math.floor(enemy.y);
   for(let yy=bb.y-1;yy<bb.y+data.buildings[bb.type].size+1&&!adjacent;yy++)for(let xx=bb.x-1;xx<bb.x+data.buildings[bb.type].size+1&&!adjacent;xx++)if(xx===bx0&&yy===by0)adjacent=true;
     if(adjacent&&enemy.attackTimer<=0){bb.hp=Math.max(0,bb.hp-enemy.damage*skyDmg*(isWall(bb)?(role.wallDamage||1)*chestGuard:1));if(bb.hp<=0)world.raidLosses=(world.raidLosses||0)+1;enemy.attackTimer=1.3;effect(world,enemy,center(bb,data),'slash');if(isWall(bb))wallSound(bb);else{const g=listenerGain('combat');if(g>0)sfx.hit({vol:g});}push(world,{x:targetPoint.x,y:targetPoint.y,tx:targetPoint.x,ty:targetPoint.y,kind:'hit',life:.18});continue;}
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
   // Dread courts (Phase 12): raiders fighting beside their living crown
   // hit harder — the aura reads off every boss still standing.
   let dread=1;
   try{if(enemy.role!=='boss')dread=bossAuraMult(world,data,enemy);}catch{}
   const raw=enemy.damage*dread*skyDmg*(1-Math.min(.8,reduction))*(!targetUnit&&isWall(target)?(role.wallDamage||1)*chestGuard:1);
    if(targetUnit&&raw>=target.hp&&!target.unbrokenUsed){try{if(unlockedAbilities(target,data).some(a=>a.effect==='unbroken')){target.hp=1;target.unbrokenUsed=true;enemy.attackTimer=1.3;push(world,{x:targetPoint.x,y:targetPoint.y,tx:targetPoint.x,ty:targetPoint.y-1,kind:'float',text:'UNBROKEN!',color:'#ffe9a8',life:.9});effect(world,enemy,targetPoint,'slash');strikeSound(enemy,targetPoint,false);continue;}}catch{}}
    target.hp=Math.max(0,target.hp-raw);enemy.attackTimer=1.3;effect(world,enemy,targetPoint,role.range>2?'arrow':'slash');push(world,{x:targetPoint.x,y:targetPoint.y,tx:targetPoint.x,ty:targetPoint.y,kind:'hit',life:.18});strikeSound(enemy,targetPoint,role.range>2);
   // Rue's ledger: a building that falls while raiders walk counts against
   // the flawless defense. Troops falling never do — only walls and roofs.
   if(!targetUnit&&target.hp<=0)world.raidLosses=(world.raidLosses||0)+1;
  }
 }
 for(const e of world.enemies)if(e.hp<=0)push(world,{x:e.x,y:e.y,tx:e.x,ty:e.y,kind:'poof',life:.4});
 // Salvage (Phase 12): elites pay elite bounty, renown sweetens every
 // purse. Boss crowns pay through the same ledger, tenfold.
 const fallen=world.enemies.filter(e=>e.hp<=0);
 const dead=fallen.length;world.raidKills=(world.raidKills??0)+dead;
 let loot=0;
 try{
  const rMult=renownLootMult(world,data),eMult=eliteLootMult(data);
  for(const f of fallen){loot+=Math.round(5*(f.role==='boss'?10:f.elite?eMult:1)*rMult);if(f.role==='boss')world.bossSlain=f.bossId;}
 }catch{loot=dead*5;}
 world.raidLoot=(world.raidLoot??0)+loot;if(loot>0)grantCentral(world,data,'gold',loot);
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
