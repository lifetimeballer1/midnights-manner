// Original low-poly outfits and equipment. All choices are renderer-only;
// no generated appearance is written into a villager or player save.
import {phaseSeed} from './camera.js';

const wood='#987046',metal='#b7c8ca',leather='#624b37';
const uniforms={
 farmer:['#829453','straw'],shepherd:['#a08f69','straw'],miller:['#c3b391','straw'],
 miner:['#747f88','lamp'],sapper:['#749d9a','lamp'],diver:['#597e86','lamp'],
 builder:['#a4875d','cap'],mason:['#9d9b88','cap'],
 lumberjack:['#927052','cap'],sawyer:['#8b684c','cap'],woodward:['#648d87','hood'],
 fisherman:['#628c98','cap'],butcher:['#aa7966','apron'],
 weaponsmith:['#95664c','apron'],armorer:['#657b8f','apron'],
 toolsmith:['#79917a','apron'],leatherworker:['#b29260','apron'],smelter:['#9b6e55','apron'],
 scholar:['#7588b0','robe'],chorister:['#9882aa','robe'],
 healer:['#b5c8a9','robe'],tidecaller:['#74a5b7','robe'],
 apprentice:['#b99970','apron'],haggler:['#a38458','cap'],
 scout:['#759578','hood'],forager:['#738a5c','hood'],
 archer:['#6d8a60','hood'],ranger:['#4f8070','hood'],longbowman:['#6b8860','hood'],
 warrior:['#5d8093','helmet'],warden:['#667d97','helmet'],
 pikewoman:['#8b727f','helmet'],halberdier:['#947454','helmet'],
 oathsworn:['#738697','helmet'],squire:['#9b8160','helmet'],
};
const rarityMetal={uncommon:'#c1d0c9',rare:'#87c6d3',epic:'#b5a2d5',legendary:'#efd389'};

function equipment(s,gear,item,x,y,lift,detail){
 const steel=rarityMetal[item?.rarity]||metal,z=.3+lift;
 const shaft=(height=.55)=>s.box(x+.22,y-.025,z,.045,.045,height,wood);
 if(/tome|hymnal|primer/.test(gear)){
  s.box(x+.2,y-.06,z+.07,.12,.25,.2,'#64587b');
  if(detail)s.box(x+.325,y-.03,z+.1,.016,.19,.14,'#e1d7b4');
 }else if(/chalice|bell|scales|compass|orrery/.test(gear)){
  shaft(.24);s.box(x+.16,y-.07,z+.24,.17,.14,.14,'#dfba6a');
 }else if(/bow/.test(gear)||item?.animation==='arrow'){
  s.box(x+.26,y-.025,z,.045,.05,.48,wood);
  for(const h of [0,.44])s.box(x+.2,y-.08,z+h,.05,.12,.05,wood);
  if(detail)s.box(x+.2,y-.08,z,.018,.018,.49,'#ddcfac');
 }else if(/pike|halberd/.test(gear)){
  shaft(.92);s.pyramid(x+.243,y,1.22+lift,.065,.2,steel);
  if(/halberd/.test(gear))s.box(x+.25,y-.025,1.02+lift,.16,.06,.18,steel);
 }else if(/pick/.test(gear)){
  shaft();s.box(x+.08,y-.04,z+.48,.34,.075,.07,steel);
  s.box(x+.08,y-.04,z+.39,.055,.075,.12,steel);
 }else if(/axe|cleaver|sickle|scythe/.test(gear)){
  shaft(/scythe/.test(gear)?.8:.56);
  s.box(x+.255,y-.04,z+(/scythe/.test(gear)?.66:.4),.19,.07,/sickle|scythe/.test(gear)?.07:.2,steel);
 }else if(/rod|crook|net/.test(gear)){
  shaft(.87);s.box(x+.24,y-.02,z+.82,.15,.04,.045,wood);
  if(detail)s.box(x+.36,y-.02,z+.55,.02,.02,.31,/rod/.test(gear)?'#d5d2b4':wood);
 }else if(/blade|sword/.test(gear)||['slash','oath'].includes(item?.animation)){
  shaft(.17);s.box(x+.14,y-.045,z+.17,.2,.085,.055,'#d4b06b');
  s.box(x+.205,y-.025,z+.22,.075,.045,.43,steel);
  s.pyramid(x+.242,y,z+.65,.053,.12,steel);
 }else if(/cart|basket/.test(gear)){
  s.box(x+.19,y-.1,z,.27,.25,.24,wood);
 }else if(/hammer|kit|trowel|tongs|awl/.test(gear)){
  shaft(.48);s.box(x+.13,y-.065,z+.43,.26,.12,/hammer/.test(gear)?.17:.09,steel);
 }else if(gear&&gear!=='apron'){
  shaft(.48);
 }
}

export function characterModel(s,u,data,time,enemy=false){
 if(u.hp<=0)return;
 // Include the longest pike and all gear in this conservative screen margin.
 // Offscreen citizens should not pay for detailed meshes on a large map.
 const p=s.r.project(u.x,u.y),pad=50*s.r.cam.zoom;
 if(p.x<-pad||p.x>s.r.width+pad||p.y<-pad||p.y>s.r.height+pad)return;
 s.owner={kind:enemy?'enemy':'unit',id:u.id};s.alpha=1;
 const role=data.troops[u.type]?.role;
 const faction=data.world.enemyFactions?.find(f=>f.id===u.faction);
 const [coat,hat]=enemy?[faction?.color||'#a65c54',u.role==='archer'?'hood':u.role==='scout'?'hood':'helmet']
  :uniforms[u.type]||[role==='combat'?'#5d8093':'#8c946c',role==='combat'?'helmet':'cap'];
 const detail=s.characterDetail!==false&&s.r.cam.zoom>=1.8,seed=phaseSeed(u.id);
 const skin=['#dbb38c','#b98c64','#936a50'][Math.floor(seed*100)%3];
 const hair=['#594532','#a47d4b','#6e6353'][Math.floor(seed*71)%3];
 const bob=s.r.calm?0:Math.sin(time/350+seed)*.012,x=u.x,y=u.y;
 const lift=s.r.calm?0:u.animation>0?Math.sin(u.animation*14)*.12:0;
 for(const dx of [-.115,.04]){
  s.box(x+dx,y-.075,.055,.085,.15,.2,leather);
  if(detail)s.box(x+dx-.01,y-.06,.02,.105,.2,.08,'#41453d');
 }
 s.box(x-.15,y-.11,.25,.3,.22,.31,coat);
 if(hat==='robe')s.box(x-.17,y-.13,.13,.34,.26,.2,coat);
 if(hat==='apron')s.box(x-.1,y+.115,.24,.2,.02,.3,'#d3b58b');
 if(detail){s.box(x-.154,y-.114,.29,.308,.228,.045,leather);s.box(x-.035,y+.117,.29,.07,.018,.046,'#d8bd79');}
 for(const dx of [-.22,.15])s.box(x+dx,y-.075,.29,.07,.13,.23,coat);
 if(detail){s.box(x-.22,y-.076,.27,.075,.14,.075,skin);s.box(x+.15,y-.076,.27+lift,.075,.14,.075,skin);}
 s.box(x-.1,y-.09,.57+bob,.2,.18,.19,skin);
 if(detail)s.box(x-.105,y-.105,.66+bob,.21,.04,.13,hair);
 if(hat==='helmet'||hat==='lamp'){
  s.box(x-.12,y-.11,.74+bob,.24,.22,.1,hat==='lamp'?'#86754f':metal);
  if(detail&&hat==='helmet')for(const dx of [-.12,.085])s.box(x+dx,y-.1,.61+bob,.035,.18,.14,metal);
  if(hat==='lamp')s.box(x-.035,y+.115,.75+bob,.07,.035,.055,'#f6df9a');
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
 const gear=enemy?(u.role==='archer'?'bow':u.role==='breaker'?'warhammer':'sword'):(u.gear||'');
 equipment(s,gear,data.items[gear],x,y,lift,detail);
 if(/bow/.test(gear)){
  s.box(x-.12,y-.2,.32,.13,.09,.32,leather);
  if(detail)for(const dx of [-.1,-.04])s.box(x+dx,y-.18,.61,.02,.02,.17,'#d9cda5');
 }
 if(enemy&&u.role==='breaker')s.box(x-.27,y-.13,.28,.09,.32,.37,'#687777');
 if(u.armor){
  const armorColor=rarityMetal[data.items[u.armor]?.rarity]||metal;
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
 if(u.carry>0){s.box(x-.14,y-.27,.32,.28,.14,.26,'#b69260');if(detail)s.box(x-.14,y-.275,.41,.28,.15,.035,leather);}
 if(u.emergency)s.box(x-.07,y-.06,1.14,.14,.12,.08,u.emergency.kind==='heal'?'#8ad2ad':u.emergency.kind==='repair'?'#bcd4e8':'#e2c578');
}
