import {gaitFor} from './character-motion.js';
import {pivotMesh,wheelMesh,beam} from './mechanical-art.js';
import {workPhase,strikeLift} from './work-motion.js';
// Original low-poly outfits and equipment. All choices are renderer-only;
// no generated appearance is written into a villager or player save.
import {phaseSeed} from './camera.js';
import {RARITY_COLORS} from './rarity.js';

const wood='#987046',metal='#b7c8ca',leather='#624b37',brass='#dfba6a';
const uniforms={
 farmer:['#6b853b','straw'],shepherd:['#a08f69','straw'],miller:['#c3b391','straw'],
 miner:['#747f88','lamp'],sapper:['#4f9e9c','lamp'],diver:['#5f87bd','lamp'],
 builder:['#a4875d','cap'],mason:['#9d9b88','cap'],
 lumberjack:['#725235','cap'],sawyer:['#8b684c','goggles'],woodward:['#648d87','hood'],
 heartwarden:['#a2683e','hood'],
 mudlark:['#385f68','straw'],
 fisherman:['#628c98','cap'],butcher:['#aa7966','apron'],
 weaponsmith:['#7f4939','apron'],armorer:['#657b8f','apron'],
 toolsmith:['#67a34d','apron'],leatherworker:['#d8b244','apron'],smelter:['#4f5962','apron'],
 scholar:['#7588b0','robe'],chorister:['#b96fae','robe'],
 healer:['#b5c8a9','robe'],tidecaller:['#5aa7a1','robe'],
 apprentice:['#c6bb8b','apron'],haggler:['#4d9f9a','apron'],
 scout:['#b78d55','hood'],forager:['#738a5c','cap'],
 archer:['#7f9d4e','hood'],ranger:['#3e704d','hood'],longbowman:['#8b695f','hood'],
 warrior:['#5d8093','helmet'],warden:['#667d97','crest'],
 pikewoman:['#8b727f','helmet'],halberdier:['#947454','helmet'],
 oathsworn:['#c17d39','helmet'],squire:['#c8a95f','cap'],
};
function rarityColor(rarity){return Object.hasOwn(RARITY_COLORS,rarity)?RARITY_COLORS[rarity]:metal;}
function shaft(s,x,y,z,height=.55){s.box(x+.22,y-.025,z,.045,.045,height,wood);}
function bookEquipment(s,gear,x,y,z,detail){
 if(!gear.includes('tome')&&!gear.includes('hymnal')&&!gear.includes('primer'))return false;
 s.box(x+.2,y-.06,z+.07,.12,.25,.2,'#64587b');
 if(detail)s.box(x+.325,y-.03,z+.1,.016,.19,.14,'#e1d7b4');
 return true;
}
function relicEquipment(s,gear,x,y,z,steel){
 if(gear.includes('compass')){
  s.box(x+.18,y-.07,z+.16,.27,.08,.2,'#8b6d42');s.box(x+.29,y-.085,z+.18,.05,.11,.17,'#dfba6a');
  s.box(x+.306,y-.015,z+.24,.018,.035,.13,steel);return true;
 }
 if(gear.includes('orrery')){
  s.box(x+.19,y-.08,z+.12,.29,.2,.07,wood);s.box(x+.31,y-.035,z+.18,.04,.04,.34,steel);
  s.box(x+.2,y-.04,z+.32,.26,.04,.04,brass);s.box(x+.2,y-.04,z+.44,.26,.04,.04,brass);
  s.box(x+.2,y-.04,z+.32,.04,.04,.16,brass);s.box(x+.42,y-.04,z+.32,.04,.04,.16,brass);
  s.box(x+.275,y-.015,z+.35,.08,.08,.08,brass);return true;
 }
 if(gear.includes('scales')){
  shaft(s,x,y,z,.46);s.box(x+.08,y-.045,z+.41,.39,.04,.04,brass);
  s.box(x+.12,y-.045,z+.25,.025,.025,.18,steel);s.box(x+.4,y-.045,z+.25,.025,.025,.18,steel);
  s.box(x+.055,y-.1,z+.2,.15,.12,.035,metal);s.box(x+.34,y-.1,z+.2,.15,.12,.035,metal);return true;
 }
 if(gear.includes('tidebell')){
  shaft(s,x,y,z,.27);s.box(x+.2,y-.085,z+.22,.22,.16,.17,'#dfba6a');
  s.box(x+.23,y-.095,z+.37,.16,.18,.055,brass);s.box(x+.295,y-.035,z+.17,.03,.06,.1,steel);return true;
 }
 if(gear.includes('chalice')){
  shaft(s,x,y,z,.3);s.box(x+.2,y-.075,z+.29,.18,.15,.07,'#dfba6a');
  s.box(x+.23,y-.06,z+.34,.12,.12,.13,'#dfba6a');s.box(x+.21,y-.075,z+.47,.16,.15,.04,brass);return true;
 }
 return false;
}
function weaponEquipment(s,gear,item,x,y,z,lift,steel,detail){
 if(gear.includes('bow')||item?.animation==='arrow'){
  // The recurved limbs and string stay visible below the detail-trim threshold.
  const long=gear.includes('longbow'),height=long?.72:.49,outer=long?.37:.3,inner=long?.12:.19;
  s.box(x+outer,y-.025,z,.05,.05,height*.22,wood);
  s.box(x+inner,y-.025,z+height*.18,.05,.05,height*.34,wood);
  s.box(x+inner,y-.025,z+height*.48,.05,.05,height*.34,wood);
  s.box(x+outer,y-.025,z+height*.78,.05,.05,height*.22,wood);
  const draw=item?.draw||0;
  if(draw){const grip=[x+outer+.03+draw*.11,y-.08,z+height*.5];beam(s,[x+outer+.03,y-.08,z+.02],grip,.014,'#ddcfac');beam(s,grip,[x+outer+.03,y-.08,z+height-.02],.014,'#ddcfac');}
  else s.box(x+outer+.03,y-.08,z+.02,.018,.018,height-.04,'#ddcfac');
  s.box(x+inner-.02,y-.055,z+height*.45,.13,.1,.05,leather);
  if(detail)s.box(x+inner-.015,y-.06,z+height*.42,.04,.11,.07,brass);return true;
 }
 if(gear.includes('pike')||gear.includes('halberd')){
  shaft(s,x,y,z,.92);s.pyramid(x+.243,y,1.22+lift,.065,.2,steel);
  if(gear.includes('halberd'))s.box(x+.25,y-.025,1.02+lift,.16,.06,.18,steel);return true;
 }
 if(gear.includes('pick')){
  shaft(s,x,y,z);s.box(x+.08,y-.04,z+.48,.34,.075,.07,steel);s.box(x+.08,y-.04,z+.39,.055,.075,.12,steel);return true;
 }
 if(gear.includes('blade')||gear.includes('sword')||item?.animation==='slash'||item?.animation==='oath'){
  shaft(s,x,y,z,.17);s.box(x+.14,y-.045,z+.17,.2,.085,.055,brass);
  s.box(x+.205,y-.025,z+.22,.075,.045,.43,steel);s.pyramid(x+.242,y,z+.65,.053,.12,steel);return true;
 }
 return false;
}
function fieldEquipment(s,gear,x,y,z,steel,detail,wheelAngle=0){
 if(gear.includes('fellingaxe')){
  shaft(s,x,y,z,.78);s.box(x+.19,y-.07,z+.67,.26,.12,.13,steel);s.box(x+.13,y-.075,z+.63,.08,.13,.2,steel);return true;
 }
 if(gear.includes('cleaver')){
  shaft(s,x,y,z,.32);s.box(x+.16,y-.07,z+.27,.25,.12,.18,steel);s.box(x+.16,y-.075,z+.42,.23,.13,.035,steel);return true;
 }
 if((gear.includes('axe')&&!gear.includes('pick'))||gear.includes('sickle')||gear.includes('scythe')){
  const scythe=gear.includes('scythe'),sickle=gear.includes('sickle');shaft(s,x,y,z,scythe?.8:.56);
  s.box(x+.255,y-.04,z+(scythe?.66:.4),.19,.07,sickle||scythe?.07:.2,steel);return true;
 }
 if(gear.includes('net')){
  shaft(s,x,y,z,.58);s.box(x+.16,y-.04,z+.34,.04,.04,.32,wood);
  s.box(x+.42,y-.04,z+.34,.04,.04,.32,wood);s.box(x+.16,y-.04,z+.64,.3,.04,.04,wood);
  if(detail){for(let i=0;i<3;i++){const px=x+.21+i*.08;s.box(px,y-.04,z+.37,.02,.02,.23,leather);}s.box(x+.2,y-.04,z+.48,.22,.02,.02,leather);}
  return true;
 }
 if(gear.includes('crook')){
  shaft(s,x,y,z,.86);s.box(x+.22,y-.025,z+.78,.16,.045,.045,wood);s.box(x+.335,y-.025,z+.66,.045,.045,.16,wood);return true;
 }
 if(gear.includes('rod')){
  shaft(s,x,y,z,.87);s.box(x+.24,y-.02,z+.82,.15,.04,.045,wood);
  if(detail)s.box(x+.36,y-.02,z+.55,.02,.02,.31,'#d5d2b4');return true;
 }
 if(gear.includes('cart')){
  s.box(x+.17,y-.1,z+.12,.34,.21,.18,wood);s.box(x+.14,y-.13,z+.08,.39,.04,.04,leather);
  for(const px of [x+.19,x+.44])wheelMesh(s,px,y-.13,z+.08,.065,wheelAngle);beam(s,[x+.16,y-.13,z+.08],[x+.47,y-.13,z+.08],.022,metal);return true;
 }
 if(gear.includes('basket')){
  s.box(x+.2,y-.1,z+.14,.27,.23,.18,wood);s.box(x+.18,y-.11,z+.31,.31,.25,.04,leather);
  s.box(x+.23,y-.1,z+.34,.035,.04,.12,wood);s.box(x+.4,y-.1,z+.34,.035,.04,.12,wood);return true;
 }
 return false;
}
function workshopEquipment(s,gear,x,y,z,steel){
 if(gear.includes('warhammer')){
  shaft(s,x,y,z,.62);s.box(x+.1,y-.09,z+.5,.35,.18,.19,steel);
  s.box(x+.1,y-.095,z+.53,.06,.19,.13,brass);s.box(x+.37,y-.06,z+.54,.11,.12,.14,steel);return true;
 }
 if(gear.includes('forgehammer')){
  shaft(s,x,y,z,.56);s.box(x+.12,y-.085,z+.46,.31,.17,.14,steel);
  s.box(x+.19,y-.09,z+.49,.14,.18,.09,brass);return true;
 }
 if(gear.includes('toolkit')){
  s.box(x+.17,y-.1,z+.12,.32,.22,.23,wood);s.box(x+.17,y-.12,z+.33,.32,.04,.05,leather);
  s.box(x+.29,y-.14,z+.34,.09,.06,.08,brass);return true;
 }
 if(gear.includes('armorkit')){
  s.box(x+.17,y-.1,z+.13,.29,.2,.24,metal);s.box(x+.14,y-.11,z+.15,.05,.22,.25,leather);
  s.box(x+.23,y-.12,z+.22,.17,.05,.09,brass);return true;
 }
 if(gear.includes('tinkerkit')){
  s.box(x+.18,y-.1,z+.12,.28,.2,.22,leather);s.box(x+.2,y-.13,z+.29,.24,.06,.06,steel);
  s.box(x+.38,y-.12,z+.32,.05,.05,.17,steel);return true;
 }
 if(gear.includes('awl')){shaft(s,x,y,z,.34);s.box(x+.233,y-.02,z+.35,.02,.03,.3,steel);return true;}
 if(gear.includes('trowel')){
  shaft(s,x,y,z,.32);s.box(x+.18,y-.055,z+.29,.2,.1,.05,steel);return true;
 }
 if(gear.includes('tongs')){
  shaft(s,x,y,z,.52);s.box(x+.15,y-.025,z+.41,.035,.04,.28,steel);
  s.box(x+.25,y-.025,z+.41,.035,.04,.28,steel);s.box(x+.15,y-.03,z+.65,.14,.045,.05,steel);return true;
 }
 if(gear.includes('hammer')||gear.includes('kit')){
  shaft(s,x,y,z,.46);s.box(x+.17,y-.06,z+.4,.22,.1,.08,steel);s.box(x+.35,y-.06,z+.39,.06,.1,.11,steel);return true;
 }
 return false;
}
function equipment(s,gear,item,x,y,lift,detail){
 const steel=rarityColor(item?.rarity),z=.3+lift;
 if(bookEquipment(s,gear,x,y,z,detail)||fieldEquipment(s,gear,x,y,z,steel,detail,item?.wheelAngle||0)
  ||weaponEquipment(s,gear,item,x,y,z,lift,steel,detail)||workshopEquipment(s,gear,x,y,z,steel)||relicEquipment(s,gear,x,y,z,steel))return;
 if(gear&&gear!=='apron')shaft(s,x,y,z,.48);
}

export function enemyGearFor(unit){
 if(!unit)return '';
 if(unit.role==='archer')return 'bow';
 if(unit.role==='breaker')return 'warhammer';
 if(unit.role==='scout')return 'blade';
 if(unit.role==='raider')return 'sword';
 if(unit.role==='boss'&&unit.bossId==='cinder-maul')return 'warhammer';
 if(unit.role==='boss'&&unit.bossId==='pale-queen')return 'longbow';
 return '';
}
function enemyRoleSilhouette(s,u,x,y,bob,detail,coat){
 if(!u)return;
 if(u.role==='ram'){
  // Carried beam + iron cap: a siege profile broader than an ordinary raider.
  s.box(x-.42,y-.19,.28,.84,.16,.17,wood);
  s.box(x+.36,y-.2,.27,.13,.18,.19,metal);
  s.box(x-.27,y-.12,.36,.06,.24,.34,leather);
  s.box(x+.18,y-.12,.36,.06,.24,.34,leather);
 }
 if(u.role==='bombard'){
  // Short field tube on a shoulder frame; intentionally compact at map scale.
  s.box(x-.18,y-.2,.34,.36,.18,.28,wood);
  s.box(x-.04,y-.27,.5,.15,.45,.14,metal);
  s.box(x-.055,y+.14,.49,.18,.08,.16,brass);
  if(detail)s.box(x-.22,y-.18,.29,.07,.15,.33,leather);
 }
 if(u.role==='scout'&&detail){
  s.box(x-.24,y-.15,.31,.08,.27,.18,leather);
  s.box(x-.26,y+.06,.38,.11,.04,.09,coat);
 }
 if(u.elite){const eliteGold='#f1d487';
  s.box(x-.24,y-.13,.5,.09,.18,.13,eliteGold);
  s.box(x+.15,y-.13,.5,.09,.18,.13,eliteGold);
  s.box(x-.025,y-.02,.82+bob,.05,.06,.18,eliteGold);
 }
 if(u.role==='boss'){
  if(u.bossId==='cinder-maul'){
   s.box(x-.26,y-.15,.43,.52,.3,.18,'#6b4637');
   s.box(x-.31,y-.16,.5,.12,.24,.17,metal);s.box(x+.19,y-.16,.5,.12,.24,.17,metal);
   s.box(x-.03,y-.02,.84+bob,.06,.07,.25,'#b55a3d');
  }else if(u.bossId==='pale-queen'){
   s.box(x-.2,y-.18,.2,.4,.05,.46,'#d8ddea');
   s.box(x-.14,y-.13,.77+bob,.28,.25,.08,'#d8ddea');
   for(const dx of [-.1,0,.1])s.pyramid(x+dx,y-.01,.84+bob,.045,.14,brass,4);
  }
 }
}

export function workMotionFor(u,troop,time,calm=false){
 if(calm||!u||u.hp<=0||u.expedition||u.order)return 0;
 if((u.animation||0)>0)return Math.sin(u.animation*14)*.12;
 const repair=u.emergency?.kind==='repair';
 const posted=!!u.workplace&&troop?.role!=='combat'&&!u.emergency;
 const collecting=posted&&troop?.role==='collector'&&u.phase==='gather'&&(u.carry||0)>0;
 const stationed=posted&&troop?.role!=='collector';
  if(!repair&&!collecting&&!stationed){
   // Idle ambient life: villagers breathe and shift their weight while they
   // wait, gather or talk. Zero at time 0 so frozen digest pins never move,
   // desynced per unit so the town never sways in formation. Calm still
   // freezes everything via the early return above. Combat roles, enemies
   // (no troop record) and posted workers hold still — only townspeople
   // between jobs breathe, so waiting collectors keep their pinned stillness.
   if(!troop||troop.role==='combat'||u.workplace)return 0;
   const s2=phaseSeed(u.id);
   return (Math.sin(time*.0021+s2)-Math.sin(s2))*.035;
  }
  const gear=u.gear||troop?.defaultGear||'';
  let amp=.08,speed=.007;
  if(/pick|axe|hammer|cleaver|sickle|scythe|trowel|tongs/.test(gear)){amp=.18;speed=.011;}
  else if(/rod|crook|net|bow/.test(gear)){amp=.1;speed=.006;}
  else if(/tome|hymnal|primer|orrery|scales|chalice|compass/.test(gear)){amp=.055;speed=.0045;}
  const seed=phaseSeed(u.id)*.013;
  return Math.max(0,Math.sin(time*speed+seed))*amp;
}
function carriedLoad(s,u,troop,x,y,detail){
 if(!(u.carry>0))return;
 const res=troop?.gatherResource;
 if(res==='wood'||res==='frostwood'){
  const a=res==='frostwood'?'#91b5bd':'#9d744a',b=res==='frostwood'?'#c5e0e4':'#c79a62';
  for(const dz of [0,.11,.22])s.box(x-.19,y-.29,.28+dz,.38,.1,.085,dz===.11?b:a);
  s.box(x-.205,y-.305,.27,.035,.13,.36,leather);
  s.box(x+.17,y-.305,.27,.035,.13,.36,leather);
  return;
 }
 if(res==='gold'){
  s.box(x-.16,y-.29,.29,.32,.18,.22,'#7d6547');
  s.box(x-.14,y-.275,.48,.28,.15,.04,'#ad8a57');
  for(const [dx,dz,color]of[[-.09,.5,'#d2bb73'],[.01,.53,'#958b7d'],[.09,.49,'#e2c878']])s.box(x+dx,y-.27,dz,.07,.09,.07,color);
  return;
 }
 if(res==='food'){
   if(['fisherman','diver','mudlark'].includes(u.type)){
   s.box(x-.16,y-.29,.29,.32,.18,.2,'#8c704e');
   s.box(x-.14,y-.31,.47,.28,.03,.035,leather);
   if(detail){s.box(x-.08,y-.315,.44,.12,.02,.035,'#8bc7d0');s.box(x+.04,y-.315,.39,.13,.02,.035,'#6fa7b4');}
  }else{
   s.box(x-.15,y-.28,.3,.3,.16,.25,'#c9b37d');
   s.box(x-.06,y-.29,.53,.12,.18,.045,'#8d7654');
   if(detail)s.box(x-.1,y-.292,.47,.2,.02,.035,'#e0cb8a');
  }
  return;
 }
 s.box(x-.14,y-.27,.32,.28,.14,.26,'#b69260');
 if(detail)s.box(x-.14,y-.275,.41,.28,.15,.035,leather);
}
export function characterModel(s,u,data,time,enemy=false){
 if(u.hp<=0)return;
 // Include the longest pike and all gear in this conservative screen margin.
 // Offscreen citizens should not pay for detailed meshes on a large map.
 const p=s.r.project(u.x,u.y),pad=50*s.r.cam.zoom;
 if(p.x<-pad||p.x>s.r.width+pad||p.y<-pad||p.y>s.r.height+pad)return;
 s.owner={kind:enemy?'enemy':'unit',id:u.id};s.alpha=1;
 const troop=data.troops[u.type],role=troop?.role,professionColor=enemy?null:troop?.color;
 const faction=data.world.enemyFactions?.find(f=>f.id===u.faction);
 const bossCoat=u.bossId==='pale-queen'?'#b9c5d4':u.bossId==='cinder-maul'?'#8d4b38':null;
 const [coat,hat]=enemy?[bossCoat||faction?.color||'#a65c54',u.role==='archer'||u.role==='scout'||u.bossId==='pale-queen'?'hood':'helmet']
  :uniforms[u.type]||[role==='combat'?'#5d8093':'#8c946c',role==='combat'?'helmet':'cap'];
 const detail=s.characterDetail!==false&&s.r.cam.zoom>=1.8,seed=phaseSeed(u.id);
 const skin=['#dbb38c','#b98c64','#936a50'][Math.floor(seed*100)%3];
 const hair=['#594532','#a47d4b','#6e6353'][Math.floor(seed*71)%3];
 const gait=gaitFor(s.r,u,time),bob=s.r.calm?0:gait.bob+Math.sin(time/350+seed)*.012,x=u.x,y=u.y;
 let lift=gait.moving?0:workMotionFor(u,troop,time,s.r.calm);
 const post=s.r._motionWorld?.buildings?.find(b=>b.id===u.workplace);
 if(post&&lift&&Math.hypot(u.x-post.x-data.buildings[post.type].size/2,u.y-post.y-data.buildings[post.type].size/2)<data.buildings[post.type].size/2+.7){
  const channel=/pick/.test(u.gear)?'pick':/axe/.test(u.gear)?'chop':/hammer|tongs/.test(u.gear)?'hammer':/sickle|scythe/.test(u.gear)?'rustle':null;
  if(channel)lift=strikeLift(workPhase(post,channel,time))*.18;
 }
 for(const dx of [-.115,.04]){
  const stride=gait.swing*(dx<0?1:-1),px=x+dx+gait.dx*stride,py=y+gait.dy*stride;
  if(gait.moving)beam(s,[x+dx+.043,y,.26],[px+.043,py,.07],.085,leather);else s.box(x+dx,y-.075,.055,.085,.15,.2,leather);
  if(detail||gait.moving)s.box(px-.01,py-.06,.02,.105,.2,.08,'#41453d');
 }
 s.box(x-.15,y-.11,.25,.3,.22,.31,coat);
 if(hat==='robe')s.box(x-.17,y-.13,.13,.34,.26,.2,coat);
 if(hat==='apron')s.box(x-.1,y+.115,.24,.2,.02,.3,'#d3b58b');
 if(detail){s.box(x-.154,y-.114,.29,.308,.228,.045,leather);s.box(x-.035,y+.117,.29,.07,.018,.046,'#d8bd79');}
 for(const dx of [-.22,.15]){const swing=-gait.swing*(dx<0?1:-1);if(gait.moving||lift)beam(s,[x+dx+.035,y,.52],[x+dx+.035+gait.dx*swing,y+gait.dy*swing,.29+(dx>0?lift:0)],.07,dx===.15&&professionColor?professionColor:coat);else s.box(x+dx,y-.075,.29,.07,.13,.23,dx===.15&&professionColor?professionColor:coat);}
 if(detail){s.box(x-.22,y-.076,.27,.075,.14,.075,skin);s.box(x+.15,y-.076,.27+lift,.075,.14,.075,skin);}
 s.box(x-.1,y-.09,.57+bob,.2,.18,.19,skin);
 if(detail)s.box(x-.105,y-.105,.66+bob,.21,.04,.13,hair);
  if(hat==='helmet'||hat==='lamp'||hat==='crest'){
   s.box(x-.12,y-.11,.74+bob,.24,.22,.1,hat==='lamp'?'#86754f':metal);
   if(hat==='crest'){s.box(x-.025,y-.02,.82+bob,.05,.06,.22,brass);s.box(x-.075,y-.02,1.0+bob,.15,.06,.045,'#b76053');}
   if(detail&&hat==='helmet')for(const dx of [-.12,.085])s.box(x+dx,y-.1,.61+bob,.035,.18,.14,metal);
  if(hat==='lamp')s.box(x-.035,y+.115,.75+bob,.07,.035,.055,'#f6df9a');
  }else if(hat==='goggles'){
   s.box(x-.12,y-.11,.74+bob,.24,.22,.085,coat);
   s.box(x-.095,y+.075,.62+bob,.075,.035,.065,'#c7d6d6');s.box(x+.025,y+.075,.62+bob,.075,.035,.065,'#c7d6d6');
   s.box(x-.025,y+.08,.645+bob,.05,.02,.025,leather);
  }else if(hat==='hood'||hat==='robe'){
  s.box(x-.13,y-.13,.74+bob,.26,.25,.12,coat);
  s.box(x-.13,y-.13,.56+bob,.26,.05,.18,coat);
  s.pyramid(x,y-.015,.86+bob,.14,.14,coat);
 }else{
  s.box(x-.12,y-.11,.75+bob,.24,.22,.085,hat==='straw'?'#d6bb78':coat);
  if(hat==='straw')s.box(x-.19,y-.17,.735+bob,.38,.34,.045,'#cbb176');
 }
  if(detail){
   for(const dx of [-.066,.038])s.box(x+dx,y+.092,.65+bob,.028,.016,.025,'#33443a');
   s.box(x-.02,y+.097,.613+bob,.045,.025,.035,skin);
  }
 const gear=enemy?enemyGearFor(u):(u.gear||'');
 const attack=(u.animation||0)>0,bow=/bow/.test(gear);
 const toolAngle=s.r.calm||bow?0:attack?-1.1*Math.min(1,u.animation/.4):lift*4.2;
 const item=/cart/.test(gear)&&!s.r.calm?{...data.items[gear],wheelAngle:-gait.distance/.065}:bow&&!s.r.calm&&u.attackTimer>0&&u.attackTimer<.18?{...data.items[gear],draw:1-u.attackTimer/.18}:data.items[gear];
 equipment(pivotMesh(s,[x+.24,y,.34],toolAngle),gear,item,x,y,0,detail);
 if(enemy)enemyRoleSilhouette(s,u,x,y,bob,detail,coat);
 if(/bow/.test(gear)){
  s.box(x-.12,y-.2,.32,.13,.09,.32,leather);
  if(detail)for(const dx of [-.1,-.04])s.box(x+dx,y-.18,.61,.02,.02,.17,'#d9cda5');
 }
 if(enemy&&u.role==='breaker')s.box(x-.27,y-.13,.28,.09,.32,.37,'#687777');
  if(u.armor){
   const armorColor=rarityColor(data.items[u.armor]?.rarity);
  if(/shield/.test(u.armor)){
   s.box(x-.31,y-.12,.22,.075,.3,.38,armorColor);
   if(detail)s.box(x-.33,y-.015,.35,.03,.09,.1,'#ddbb75');
  }else if(/cap/.test(u.armor))s.box(x-.13,y-.12,.74+bob,.26,.24,.11,armorColor);
  else if(/coat|cloak|robe/.test(u.armor)){
   const cloth=/winter/.test(u.armor)?'#c7cebb':/oilskin/.test(u.armor)?'#5b8088':/robe/.test(u.armor)?'#9f8aaf':'#9b856c';
   s.box(x-.17,y-.16,.21,.34,.04,.34,cloth);
   if(detail)s.box(x-.18,y-.15,.5,.36,.28,.055,cloth);
  }
  else{
   s.box(x-.16,y+.112,.34,.32,.03,.19,armorColor);
   if(detail)for(const dx of [-.23,.15])s.box(x+dx,y-.085,.49,.085,.18,.08,armorColor);
  }
  if(u.armor==='regalia')for(const dx of [-.1,0,.1])s.box(x+dx-.025,y+.05,.82+bob,.05,.05,.13,'#e8c673');
 }
 carriedLoad(s,u,troop,x,y+gait.swing*.12,detail);
 if(u.emergency)s.box(x-.07,y-.06,1.14,.14,.12,.08,u.emergency.kind==='heal'?'#8ad2ad':u.emergency.kind==='repair'?'#bcd4e8':'#e2c578');
}
