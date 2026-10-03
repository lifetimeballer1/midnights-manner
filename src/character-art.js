import {gaitFor} from './character-motion.js';
import {artEnabled,meshBounds} from './asset-art.js';
import {pivotMesh,wheelMesh,beam} from './mechanical-art.js';
import {workPhase,strikeLift} from './work-motion.js';
// Original low-poly outfits and equipment. All choices are renderer-only;
// no generated appearance is written into a villager or player save.
import {phaseSeed} from './camera.js';
import {RARITY_COLORS} from './rarity.js';
import {drawLevelFlair, drawHitFlash} from './fx/level-flair.js';

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
const smithTypes=new Set(['weaponsmith','armorer','toolsmith','smelter','leatherworker']);
function roundedHead(s,x,y,z,h,rx,ry,color){
 const sides=8,lo=[],hi=[];
 for(let i=0;i<sides;i++){const a=(i+.5)*Math.PI*2/sides,cx=x+Math.cos(a)*rx,cy=y+Math.sin(a)*ry;lo.push([cx,cy,z]);hi.push([cx,cy,z+h]);}
 for(let i=0;i<sides;i++){const j=(i+1)%sides;s.face([lo[i],lo[j],hi[j],hi[i]],color,false);}
 s.face(hi,color,false);
}
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
   shaft(s,x,y,z,1.08);s.pyramid(x+.243,y,1.38+lift,.07,.22,steel);
   if(gear.includes('halberd')){s.box(x+.25,y-.03,1.14+lift,.2,.07,.24,steel);s.box(x+.25,y-.03,1.3+lift,.1,.07,.12,steel);}return true;
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
function workshopEquipment(s,gear,x,y,z,steel,detail){
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
 if(gear.includes('apron')){ // Apprentice kit: hip satchel + primer tome.
  s.box(x-.24,y-.1,z+.12,.2,.13,.26,leather);s.box(x-.24,y-.12,z+.3,.2,.05,.05,leather);
  s.box(x+.2,y-.06,z+.07,.1,.2,.15,'#7b6a8f');
  if(detail)s.box(x+.29,y-.035,z+.09,.015,.15,.11,'#e1d7b4');return true;
 }
 if(gear.includes('hammer')||gear.includes('kit')){
  shaft(s,x,y,z,.46);s.box(x+.17,y-.06,z+.4,.22,.1,.08,steel);s.box(x+.35,y-.06,z+.39,.06,.1,.11,steel);return true;
 }
 return false;
}
const BAKED_GEAR={pickaxe:['pickaxe',.85],hammer:['hammer',.8],forgehammer:['mallet',.8],warhammer:['mallet',.8],fellingaxe:['axe',.8],'heartwood-axe':['axe',.8],frostaxe:['axe',.8],trowel:['trowel',.8],tongs:['tongs',.8],awl:['chisel',.8],cleaver:['knife',.8],saw:['saw',.8],shovel:['shovel',.9],torch:['torch',.9],lantern:['lantern',.7]};
function bakedGearMesh(s,gear){const entry=BAKED_GEAR[gear];if(!entry)return null;const mesh=s.r?.meshes?.[`gear-${entry[0]}`];return mesh?.faces?.length?{mesh,scale:entry[1]}:null;}
function equipment(s,gear,item,x,y,lift,detail){
 const steel=rarityColor(item?.rarity),z=.3+lift;
 if(bookEquipment(s,gear,x,y,z,detail)||fieldEquipment(s,gear,x,y,z,steel,detail,item?.wheelAngle||0)
  ||weaponEquipment(s,gear,item,x,y,z,lift,steel,detail)||workshopEquipment(s,gear,x,y,z,steel,detail)||relicEquipment(s,gear,x,y,z,steel))return;
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
  if(unit.role==='boss'&&/vex|sorr|brannoc|warden|ashen/i.test(unit.bossId||''))return 'warhammer';
  if(unit.role==='boss'&&/herald|sovereign/i.test(unit.bossId||''))return 'bow';
  if(unit.role==='boss')return 'sword';
 return '';
}

// Baked CC0 rig mapping (renderer-only, no save fields). Offline-baked pose
// sets replace the procedural body when the manifest entry is enabled and the
// pose/LOD mesh is preloaded; otherwise the original procedural body draws.
// Role groups: fighters -> warrior, archers/rangers -> ranger, scouts/light ->
// rogue, scholars/robes -> wizard, healers -> cleric, builders/labor -> monk.
// Enemies: pale-host/pale-court -> skeleton, thornband -> human-thornband,
// cinder-clan -> human-cinder, ember-legion -> human-ember. Unknown troops,
// unknown factions, missing/disabled meshes and far zoom beyond the lo LOD all
// fall back to the procedural body. Crowded scenes (characterDetail off) hold
// the lo LOD so a full village never pays near-zoom body cost.
const BAKED_TROOPS={
 warrior:'warrior',warden:'warrior',pikewoman:'warrior',halberdier:'warrior',oathsworn:'warrior',squire:'warrior',
 archer:'ranger',ranger:'ranger',longbowman:'ranger',
 scout:'rogue',
 scholar:'wizard',chorister:'wizard',tidecaller:'wizard',
 healer:'cleric',
 builder:'monk',mason:'monk',smelter:'monk',apprentice:'monk',miller:'monk',sawyer:'monk',
 weaponsmith:'monk',armorer:'monk',toolsmith:'monk',leatherworker:'monk',haggler:'monk',
 miner:'monk',farmer:'monk',fisherman:'monk',shepherd:'monk',lumberjack:'monk',butcher:'monk',
 forager:'monk',woodward:'monk',heartwarden:'monk',diver:'monk',mudlark:'monk',sapper:'monk',
};
const BAKED_FACTIONS={'pale-host':'skeleton','pale-court':'skeleton',thornband:'human-thornband','cinder-clan':'human-cinder','ember-legion':'human-ember'};
const BOSS_SCALE={'ashen-warlord':1.25,'grey-sovereign':1.18,'ember-cindral':1.15,'ironshield-warden':1.15,'cinder-sorr':1.12,'cinder-maul':1.12,'thornband-vex':1.15,'palehost-herald':1.2,'pale-queen':1.22};
export const BAKED_HI_ZOOM=2,BAKED_MIN_ZOOM=.75;
const BOSS_BODIES={'ironshield-warden':'warrior','thornband-vex':'human-thornband','cinder-sorr':'human-cinder','palehost-herald':'skeleton','ember-cindral':'human-ember','grey-sovereign':'skeleton','ashen-warlord':'warrior','cinder-maul':'human-cinder','pale-queen':'skeleton'};
export function bakedSetId(u,troop,enemy){
 if(!u)return null;
 if(enemy&&u.faction==='boss')return BOSS_BODIES[u.bossId]||'warrior';
 return enemy?(BAKED_FACTIONS[u.faction]||null):(BAKED_TROOPS[u.type]||null);
}
export function bakedPoseFor(u,gait,zoom,detail=true,time=0,lift=0){
 if(!(zoom>=BAKED_MIN_ZOOM))return null;
 const lod=zoom>=BAKED_HI_ZOOM&&detail!==false?'hi':'lo';
 if((u?.attackTimer||0)>0||(u?.animation||0)>0)return {pose:(u?.animation||0)>.2?'attack-2':'attack',lod};
 if(gait?.moving)return {pose:gait.swing>=0?'walk-a':'walk-b',lod};
 // Work poses carry the body lean; tool pivot carries the strike.
 if(lift>.075&&lod==='hi')return {pose:lift>.12?'work-a':'work-b',lod};
 return {pose:'stand',lod};
}
function bakedBodyFor(s,u,data,enemy,gait,time=0,lift=0){
 const setId=bakedSetId(u,data.troops[u.type],enemy);
 if(!setId||!artEnabled(data,setId))return null;
 const pick=bakedPoseFor(u,gait,s.r?.cam?.zoom??1.65,s.characterDetail,time,lift);
 if(!pick)return null;
 const meshes=s.r?.meshes||{};
 const order=[`${setId}-${pick.pose}-${pick.lod}`,`${setId}-${pick.pose.startsWith('attack')?'attack':'stand'}-${pick.lod}`,`${setId}-stand-${pick.lod}`,`${setId}-stand-lo`];
 for(const key of order){const mesh=meshes[key];if(mesh?.faces?.length)return {setId,pose:pick.pose,lod:pick.lod,mesh};}
 return null;
}
function factionSilhouette(s,u,x,y,bob,detail){
 // Faction read at gameplay zoom: pale bone, thornband moss hood,
 // cinder soot guards, ember red crest. Renderer-only; stats untouched.
 const f=u.faction||'';
  if(f==='pale-host'||f==='pale-court'){
   const bone=f==='pale-court'?'#e8e2d2':'#d6cfb8',pit='#14181c';
   // Host: hollow-eyed ivory skull mass. Court: gilded crown + mantle.
   s.box(x-.135,y+.105,.59+bob,.27,.05,.24,bone);
   for(const dx of [-.085,.04])s.box(x+dx,y+.14,.7+bob,.07,.035,.07,pit);
   s.box(x-.16,y+.1,.62+bob,.36,.04,.05,pit);
   for(let i=0;i<3;i++)s.box(x-.15,y+.11,.33+i*.07,.3,.035,.035,bone);
   for(const dx of [-.27,.16])s.box(x+dx,y-.08,.5,.1,.16,.07,bone);
   if(f==='pale-court'){
    for(const dx of [-.1,0,.1])s.pyramid(x+dx,y-.01,.98+bob,.075,.2,brass,4);
    s.box(x-.2,y-.16,.5,.42,.1,.3,'#e8c673');
    for(const dx of [-.27,.16])s.box(x+dx,y-.13,.52,.13,.2,.07,'#e8c673');
   }
   }else if(f==='thornband'){
   const moss='#5d7348';
   if(s.bakedHead){
    const [hx,hy,hz,top]=s.bakedHead;
    // Broad moss cowl: wide shoulders + open rim leave the face exposed.
    for(const side of [-1,1])beam(s,[hx+side*.2,hy+.08,hz+.02],[hx+side*.13,hy,top-.04],.07,moss);
    beam(s,[hx-.14,hy,top-.04],[hx+.14,hy,top-.04],.06,moss);
    s.box(hx-.2,hy-.06,hz-.32,.16,.2,.14,moss);
    s.box(hx+.06,hy-.06,hz-.32,.16,.2,.14,moss);
   }else{
    s.box(x-.19,y-.18,.72+bob,.38,.36,.2,moss);
    s.box(x-.19,y-.18,.55+bob,.38,.05,.24,moss);
   }
  }else if(f==='cinder-clan'){
   // Rust-orange furnace guards in tribe color; dark reads grey at distance.
   for(const dx of [-.28,.16])s.box(x+dx,y-.09,.4,.13,.22,.12,'#c76b43');
   s.box(x-.06,y-.02,.82+bob,.12,.06,.08,'#e0783c');
  }else if(f==='ember-legion'){
   // Crest draws in direct space (see enemy block): the head-envelope
   // remap floats it on high-headed rogue hoods.
   if(!s.bakedHead){s.box(x-.03,y-.025,.88+bob,.08,.09,.26,'#c2502f');s.box(x-.03,y-.025,.84+bob,.05,.06,.1,'#e0783c');}
  }
}

function enemyRoleSilhouette(s,u,x,y,bob,detail,coat){
 if(!u)return;
  if(u.role==='ram'){
   // Carried beam + iron cap: a siege profile broader than an ordinary raider.
   s.box(x-.42,y-.19,.3,.84,.16,.17,wood);
   s.box(x+.36,y-.2,.29,.13,.18,.19,metal);
   s.box(x-.27,y-.12,.38,.06,.24,.34,leather);
   s.box(x+.18,y-.12,.38,.06,.24,.34,leather);
   // Patched hide cover draped over the frame + iron-shod beam end.
   s.box(x-.3,y-.14,.42,.5,.04,.2,'#6b5138');
   s.box(x+.05,y-.14,.42,.34,.04,.2,'#7d5f3f');
   if(detail)for(const dz of [.46,.52,.58])s.box(x+.39,y-.2,dz,.03,.19,.03,'#3f3a33');
  }
  if(u.role==='bombard'){
   // Short field tube on a shoulder frame; intentionally compact at map scale.
   s.box(x-.18,y-.2,.38,.36,.18,.28,wood);
   s.box(x-.04,y-.27,.54,.15,.45,.14,metal);
   s.box(x-.055,y+.14,.53,.18,.08,.16,brass);
   // Reinforced carriage + barrel bands + aim wedge.
   s.box(x-.2,y-.22,.3,.4,.22,.1,'#5e4630');
   for(const dx of [-.12,.02,.16])s.box(x+dx,y-.28,.52,.03,.47,.17,'#3f3a33');
   s.box(x-.12,y+.02,.4,.12,.1,.1,wood);
  }
  if(u.role==='scout'){
  s.box(x-.28,y-.16,.36,.09,.28,.2,leather);
  s.box(x-.3,y+.06,.43,.12,.04,.09,coat);
 }
 if(u.elite){const eliteGold='#f1d487';
  s.box(x-.27,y-.14,.5,.1,.18,.13,eliteGold);
  s.box(x+.17,y-.14,.5,.1,.18,.13,eliteGold);
  s.box(x-.03,y-.025,.88+bob,.06,.07,.18,eliteGold);
 }
  if(u.role==='boss'){
   // All nine named leaders/bosses get one distinct silhouette read.
   const bid=u.bossId||'';
    if(bid==='cinder-maul'){
     // Gorm: tall black war-helm + short bone horns split the twins at map scale.
     const ghx=s.bakedHead?s.bakedHead[0]:x,ghy=s.bakedHead?s.bakedHead[1]:y,ghz=s.bakedHead?s.bakedHead[2]:.8;
     s.box(ghx-.09,ghy+.13,ghz-.02,.18,.04,.05,'#1c2226');
     s.box(x-.13,y-.12,.84+bob,.26,.27,.3,'#23262b');
     for(const dx of [-.1,.1])s.pyramid(x+dx,y+.015,1.14+bob,.055,.14,'#d8d3c2',4);
    s.box(x-.28,y-.16,.32,.56,.32,.22,'#6b4637');
    s.box(x-.33,y-.17,.5,.13,.25,.17,metal);s.box(x+.2,y-.17,.5,.13,.25,.17,metal);
    s.box(x-.035,y-.025,.78+bob,.07,.08,.16,'#b55a3d');
   }else if(bid==='grey-sovereign'){
    // Broad crown + dark cape: the sovereign reads massive next to the herald.
    for(const dx of [-.16,-.08,0,.08,.16])s.pyramid(x+dx,y-.01,.95+bob,.06,.17,brass,4);
    s.box(x-.24,y-.2,.3,.5,.1,.5,'#3a3f4a');
    for(const dx of [-.27,.16])s.box(x+dx,y-.13,.52,.13,.2,.09,'#e8c673');
    s.box(x-.035,y-.025,.9+bob,.07,.08,.25,'#e8c673');
   }else if(bid==='palehost-herald'){
    // Veiled bow-herald: no crown, pale veil panels + bow stave silhouette.
    s.box(x-.14,y-.18,.6,.32,.06,.3,'#a9bccb');
    s.box(x+.1,y-.18,.6,.32,.06,.3,'#a9bccb');
    s.box(x+.24,y-.05,.5,.04,.04,.5,wood);
   }else if(bid==='ashen-warlord'){
    // Bulk in width, not just height: furnace-plate mass + ember seams.
    s.box(x-.4,y-.2,.3,.5,.2,.3,'#5a3228');
    s.box(x+.22,y-.2,.3,.5,.2,.3,'#5a3228');
    s.box(x-.035,y-.025,.9+bob,.09,.1,.3,'#8a4a3a');
    s.box(x-.06,y-.02,.5,.05,.05,.3,'#e0783c');
    s.box(x-.33,y-.17,.5,.13,.25,.17,metal);
   }else if(bid==='ironshield-warden'){
    // Brannoc: open-face captain — skin face, blue nasal helm, tower shield.
    const bhx=s.bakedHead?s.bakedHead[0]:x,bhy=s.bakedHead?s.bakedHead[1]:y,bhz=s.bakedHead?s.bakedHead[2]:.8;
    s.box(bhx-.07,bhy+.14,bhz-.05,.14,.03,.12,'#dbb38c');
    s.box(bhx-.09,bhy+.1,bhz+.09,.18,.05,.06,'#7b96b8');
    s.box(bhx-.38,y-.14,.24,.1,.36,.44,'#7b96b8');
    s.box(x-.4,y-.12,.4,.03,.1,.12,'#ddbb75');
    s.box(x+.16,y-.16,.42,.12,.3,.14,'#7b96b8');
    s.box(x-.035,y-.025,.9+bob,.07,.08,.25,'#7b96b8');
   }else if(bid==='thornband-vex'){
    // Vex: twin briar blades + green shoulder spikes, no shield.
    s.box(x-.38,y+.02,.55,.3,.05,.07,'#6a8a5a');
    s.box(x+.08,y+.02,.55,.3,.05,.07,'#6a8a5a');
    for(const dx of [-.28,.16])s.pyramid(x+dx,y-.08,.55,.06,.1,'#4a5a3f',4);
    s.box(x-.035,y-.025,.78+bob,.07,.08,.16,'#6a8a5a');
   }else if(bid==='cinder-sorr'){
    // Sorr: closed furnace mask — rust plate, ember eye slits, no skin.
    const shx=s.bakedHead?s.bakedHead[0]:x,shy=s.bakedHead?s.bakedHead[1]:y,shz=s.bakedHead?s.bakedHead[2]:.8;
    s.box(shx-.1,shy+.14,shz-.07,.2,.035,.17,'#7a3f2a');
    const se=s.emissive;s.emissive=1;
    for(const dx of [-.05,.05])s.box(shx+dx-.018,shy+.158,shz+.02,.036,.015,.03,'#ff9a4d');
    s.emissive=se;
    s.box(x+.2,y-.05,.62,.2,.2,.06,'#e0783c');
    for(const dx of [-.28,.16])s.box(x+dx,y-.16,.42,.14,.3,.16,'#a55536');
    s.box(x-.035,y-.025,.78+bob,.07,.08,.16,'#c76b43');
   }else if(bid==='pale-queen'){
    s.box(x-.22,y-.2,.1,.44,.06,.52,'#d8ddea');
    s.box(x-.19,y-.17,.72+bob,.38,.34,.12,'#d8ddea');
    for(const dx of [-.1,0,.1])s.pyramid(x+dx,y-.01,.9+bob,.045,.14,brass,4);
   }else if(bid==='ember-cindral'){
    // Cindral: heavy ember pauldrons + tall war-crest, officer of the legion.
    s.box(x-.3,y-.16,.42,.2,.32,.18,'#b85a30');
    s.box(x+.18,y-.16,.42,.2,.32,.18,'#b85a30');
    s.box(x-.035,y-.025,.78+bob,.09,.09,.18,'#d8793c');
    s.box(x-.03,y-.03,.8+bob,.05,.06,.1,'#e0783c');
    s.box(x+.2,y-.17,.5,.13,.25,.17,metal);
   }else{
    const trim={'ironshield-warden':'#7b96b8','thornband-vex':'#6a8a5a','cinder-sorr':'#c76b43','palehost-herald':'#b8c8d8','ember-cindral':'#d8793c','grey-sovereign':'#e8c673','ashen-warlord':'#8a4a3a'}[bid]||'#f1d487';
    const bulk=/ashen|sovereign|cindral/.test(bid)?.14:.08;
    s.box(x-.28,y-.16,.42,.12+bulk,.3,.14,trim);
    s.box(x+.16,y-.16,.42,.12+bulk,.3,.14,trim);
    s.box(x-.035,y-.025,.78+bob,.07,.08,.16,trim);
    if(/herald|queen|sovereign/.test(bid))for(const dx of [-.1,0,.1])s.pyramid(x+dx,y-.01,.9+bob,.045,.14,brass,4);
    if(/ashen|sorr|cindral|maul|warden/.test(bid))s.box(x-.33,y-.17,.5,.13,.25,.17,metal);
   }
  }
}

export function workMotionFor(u,troop,time,calm=false,post=null){
 if(calm||!u||u.hp<=0||u.expedition||u.order)return 0;
 if((u.animation||0)>0)return Math.sin(u.animation*14)*.12;
 const repair=u.emergency?.kind==='repair'||!!u.builderTask?.working;
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
  if(post){
   // Workplace clocks override carried defaults (mill sickle, sawmill axe).
   const channel={mine:'pick',emberglass:'pick',lumber:'chop',timber_yard:'chop','whisper-grove':'chop',forge:'hammer',smeltery:'hammer',workshop:'hammer',armory:'hammer',sawmill:'saw',mill:'creak',farm:'rustle',pasture:'rustle',grove:'rustle',frostgrove:'rustle',pond:'lap',deephole:'lap','blackwater-weir':'lap',mason_yard:'chisel',butchery:'board',fletcher:'shave',tannery:'scrape',bakery:'oven',barracks:'drill'}[post.type]
    ||(/pick|shovel/.test(gear)?'pick':/axe|heartwood/.test(gear)?'chop':/hammer|tongs|mallet|tinkerkit|armorkit/.test(gear)?'hammer':/saw/.test(gear)?'saw':/sickle|scythe|crook|apron/.test(gear)?'rustle':/chisel|trowel/.test(gear)?'chisel':/awl/.test(gear)?'scrape':/cleaver/.test(gear)?'board':/rod|net/.test(gear)?'lap':'drill');
   return strikeLift(workPhase(post,channel,time))*.18;
  }
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
  const bossCoat={'pale-queen':'#b9c5d4','cinder-maul':'#8d4b38','ironshield-warden':'#7b96b8','thornband-vex':'#5a7048','cinder-sorr':'#a55536','palehost-herald':'#a9bccb','ember-cindral':'#b85a30','grey-sovereign':'#c9b98a','ashen-warlord':'#7a3f30'}[u.bossId]||null;
 const [coat,hat]=enemy?[bossCoat||faction?.color||'#a65c54',u.role==='archer'||u.role==='scout'||u.bossId==='pale-queen'?'hood':'helmet']
  :uniforms[u.type]||[role==='combat'?'#5d8093':'#8c946c',role==='combat'?'helmet':'cap'];
 const detail=s.characterDetail!==false&&s.r.cam.zoom>=1.8,seed=phaseSeed(u.id);
 const skin=['#dbb38c','#b98c64','#936a50'][Math.floor(seed*100)%3];
 const hair=['#594532','#a47d4b','#6e6353'][Math.floor(seed*71)%3];
 const gait=gaitFor(s.r,u,time),bob=s.r.calm?0:gait.bob+Math.sin(time/350+seed)*.012,x=u.x,y=u.y;
  const post=s.r._motionWorld?.buildings?.find(b=>b.id===u.workplace);
  const size=data.buildings[post?.type]?.size;
  const nearby=post&&Math.hypot(u.x-post.x-size/2,u.y-post.y-size/2)<size/2+.7?post:null;
  const lift=gait.moving?0:workMotionFor(u,troop,time,s.r.calm,nearby);
  const baked=bakedBodyFor(s,u,data,enemy,gait,time,lift);
  const bodyScale=baked&&enemy&&u.role==='boss'?(BOSS_SCALE[u.bossId]??1):1;
  const anchors=baked?.mesh.meta?.anchors;
  const bakedAnchors=bodyScale===1?anchors:Object.fromEntries(Object.entries(anchors||{}).map(([key,p])=>[key,p.map(v=>v*bodyScale)]));
  if(baked){
    // The selected low LOD is already budgeted: area cropping loses face/limbs at 1x.
    for(const f of baked.mesh.faces)s.face(f.v.map(([vx,vy,vz])=>[x+vx*bodyScale,y+vy*bodyScale,vz*bodyScale]),f.c);
   if(!enemy){
     // Local albedo wash preserves midnight cues without changing scene lighting.
     const wash=s.emissive;s.emissive=Math.max(wash,.35);
     const {head,hand}=bakedAnchors||{};
     const top=meshBounds(baked.mesh).z1;
     // Broad front/back cloth panels carry the data color even at far gameplay zoom.
     if(head){
      s.emissive=Math.max(wash,.95);
      roundedHead(s,x+head[0],y+head[1]+.12,head[2]+.04,.18,.1,.12,skin);
      s.emissive=Math.max(wash,.35);
      const color=professionColor||coat,hz=head[2],bottom=hat==='robe'?.15:.29;
      for(const side of [-1,1]){
       const panel=[[x-.14,y+head[1]+side*.23,bottom],[x+.14,y+head[1]+side*.23,bottom],[x+.17,y+head[1]+side*.16,hz-.08],[x-.17,y+head[1]+side*.16,hz-.08]];
       s.face(side>0?panel.reverse():panel,color,false);
      }
      if(hat==='apron')s.face([[x-.08,y+head[1]+.18,hz-.12],[x+.08,y+head[1]+.18,hz-.12],[x+.1,y+head[1]+.245,.24],[x-.1,y+head[1]+.245,.24]],'#d3b58b',false);
      else if(role==='builder')s.box(x-.18,y+head[1]+.23,.3,.36,.035,.08,leather);
     }
     // Sleeves and cuffs follow the moving palm.
     if(professionColor&&hand&&head)beam(s,
      [x+hand[0],y+hand[1],hand[2]+.06],
      [x+hand[0]*.65+head[0]*.35,y+hand[1]*.65+head[1]*.35,hand[2]*.65+head[2]*.35+.06],.11,professionColor);
     // Shared-Barbarian differentiation: trade silhouette per monk profession.
     if(head&&hand&&baked?.setId==='monk'){
      const hx=x+head[0],hy=y+head[1];
      if(u.type==='mason')s.box(hx-.09,hy+.16,head[2]-.3,.18,.03,.1,'#cfc9b8');
      else if(u.type==='smelter'){const e=s.emissive;s.emissive=.55;s.box(hx-.07,hy+.17,head[2]-.32,.14,.03,.12,'#e0783c');s.emissive=e;}
      else if(u.type==='diver')s.box(hx-.12,hy-.05,.42,.26,.04,.3,'#3d5a74');
      else if(u.type==='mudlark')s.box(hx-.14,hy-.02,.4,.1,.1,.12,'#4a3f2c');
      else if(u.type==='sapper'){const e=s.emissive;s.emissive=.6;s.box(hx+.05,hy+.1,head[2]-.28,.05,.05,.1,'#9fe8d8');s.emissive=e;}
      else if(u.type==='woodward')s.box(hx-.1,hy-.02,head[2]-.15,.2,.04,.06,'#dfe9ef');
       else if(u.type==='heartwarden')s.box(hx-.06,hy+.12,head[2]-.2,.12,.03,.12,'#7c4a2d');
       else if(u.type==='lumberjack'||u.type==='sawyer')s.box(hx-.16,hy-.08,.3,.34,.03,.12,'#5e4630');
       else if(u.type==='miller')s.box(hx-.12,hy-.08,.37,.24,.04,.2,'#d8c99f');
       else if(u.type==='forager')s.box(hx-.16,hy-.06,.32,.32,.045,.18,'#6e5032');
       else if(u.type==='haggler')s.box(hx-.13,hy+.12,head[2]-.34,.26,.045,.16,'#b89443');
       else if(u.type==='apprentice')s.box(hx-.16,hy-.07,.3,.18,.08,.22,'#725039');
       else if(u.type==='fisherman')s.box(hx-.13,hy-.04,.36,.24,.03,.2,'#47626b');
      else if(u.type==='shepherd')s.box(hx-.15,hy-.06,.5,.32,.03,.1,'#c9bd9a');
      else if(u.type==='butcher'){s.box(hx-.08,hy+.16,head[2]-.3,.16,.03,.2,'#b08383');}
      else if(smithTypes.has(u.type))s.box(hx-.1,hy+.14,head[2]-.34,.2,.03,.24,'#4c423a');
     }
     // B1b Barbarian read: broad beard mass + stocky shoulders on shared bodies.
     if(head&&hand&&baked?.setId==='monk'){
      const hx=x+head[0],hy=y+head[1],hz=head[2];
      // Wide warm face plate over the grey bake, jaw beard below it.
      s.box(hx-.1,hy+.17,hz-.06,.2,.035,.16,skin);
      s.box(hx-.025,hy+.19,hz-.04,.05,.02,.05,skin);
      if(detail)for(const dx of [-.05,.05])s.box(hx+dx-.016,hy+.19,hz+.02,.032,.015,.035,'#33443a');
      s.box(hx-.09,hy+.165,hz-.17,.18,.035,.1,hair);
      s.box(hx-.06,hy+.16,hz-.25,.12,.03,.07,hair);
      for(const side of [-1,1])s.box(hx+side*.17-.04,hy-.04,hz-.27,.08,.1,.1,coat);
      // Chunky boots cap the baked legs at the ground line.
      for(const dx of [-.1,.03])s.box(x+dx,y-.03,.015,.1,.12,.09,'#41453d');
     }
    if(hat==='lamp'&&head){
      roundedHead(s,x+head[0],y+head[1],top+.015,.055,.16,.14,'#86754f');
     const emissive=s.emissive;s.emissive=.7;
      s.box(x+head[0]-.045,y+head[1]+.14,top+.015,.09,.04,.06,'#f6df9a');s.emissive=emissive;
    }
    if(head&&hat!=='lamp'){
      const hx=x+head[0],hy=y+head[1],hz=top-.23;
     if(hat==='crest'){
       s.box(hx-.025,hy-.045,top+.02,.05,.09,.16,brass);
       s.box(hx-.08,hy-.045,top+.15,.16,.09,.045,'#b76053');
      }else if(hat==='helmet')roundedHead(s,hx,hy,top+.015,.055,.17,.15,metal);
      else if(hat==='hood'||hat==='robe'){
        for(const side of [-1,1])beam(s,[hx+side*.15,hy+.1,head[2]+.04],[hx+side*.12,hy,top+.025],.045,coat);
        beam(s,[hx-.12,hy,top+.025],[hx+.12,hy,top+.025],.045,coat);
        // Unarmored bow users show skin faces and hair under the hood.
        if(!enemy&&baked?.setId==='ranger'){
         const rew=s.emissive;s.emissive=Math.max(rew,.55);
         s.box(hx-.085,hy+.13,head[2]-.06,.17,.03,.13,skin);
         if(detail)for(const dx of [-.048,.048])s.box(hx+dx-.016,hy+.145,head[2]-.015,.032,.015,.035,'#33443a');
         s.emissive=rew;
         for(const side of [-1,1])s.box(hx+side*.11-.02,hy+.1,head[2]-.12,.045,.03,.15,hair);
        }
      }else{
       roundedHead(s,hx,hy,top+.025,.07,.14,.13,hat==='straw'?'#d6bb78':coat);
       if(hat==='straw')roundedHead(s,hx,hy,top+.01,.025,.25,.22,'#cbb176');
      if(hat==='goggles'){
       for(const dx of [-.1,.025])s.box(hx+dx,hy+.13,hz+.16,.075,.035,.055,'#c7d6d6');
       s.box(hx-.025,hy+.135,hz+.18,.05,.025,.025,leather);
      }
     }
     }
      s.emissive=wash;
    }
    // Human-faction enemies get KayKit-style skin faces like villagers;
    // Pale Host/Court keep their baked skulls.
    if(enemy&&(u.faction==='thornband'||u.faction==='cinder-clan'||u.faction==='ember-legion'||['human-thornband','human-cinder','human-ember'].includes(baked?.setId))){
     const ea=bakedAnchors||{};
     if(ea.head&&ea.hand){
      const hx=x+ea.head[0],hy=y+ea.head[1],hz=ea.head[2],ew=s.emissive;
      s.emissive=Math.max(ew,.5);
      s.box(hx-.055,hy+.15,hz-.035,.11,.03,.08,skin);
      if(detail)for(const dx of [-.026,.026])s.box(hx+dx-.01,hy+.165,hz+.01,.02,.015,.025,'#33443a');
      s.emissive=ew;
     }
    }
   }
 else{
 const smith=!enemy&&smithTypes.has(u.type);
 const boot=!enemy&&u.type==='miner'?'#4a5560':'#41453d';
 for(const dx of [-.13,.05]){
  const stride=gait.swing*(dx<0?1:-1),px=x+dx+gait.dx*stride,py=y+gait.dy*stride;
  if(gait.moving)beam(s,[x+dx+.05,y,.3],[px+.05,py,.08],.1,leather);else s.box(x+dx-.005,y-.07,.08,.11,.14,.23,leather);
  s.box(px-.005,py-.12,.005,.12,.22,.085,boot);
  if(detail&&!enemy&&u.type==='miner')s.box(px-.005,py+.045,.005,.12,.055,.045,brass);
 }
  s.box(x-.17,y-.115,.29,.34,.23,.26,coat);
  if(hat==='robe'){s.box(x-.19,y-.15,.1,.38,.3,.17,coat);s.box(x-.205,y-.165,.06,.41,.33,.06,coat);}
  if(hat==='apron')s.box(x-.11,y+.125,.16,.22,.03,.34,'#d3b58b');
  if(!enemy&&troop?.role==='builder'){s.box(x-.18,y-.125,.31,.36,.25,.19,'#8a6f4a');s.box(x-.18,y+.115,.29,.36,.03,.07,leather);if(detail)s.box(x-.03,y+.15,.3,.06,.03,.05,brass);}
  if(!enemy&&troop?.role==='collector'&&u.type!=='farmer'){s.box(x-.3,y-.09,.3,.1,.16,.15,leather);if(detail)s.box(x-.305,y-.095,.39,.11,.03,.05,brass);}
  if(!enemy&&u.type==='farmer'){s.box(x-.31,y-.06,.28,.14,.15,.16,wood);s.box(x-.325,y-.075,.425,.16,.17,.035,leather);}
 for(const dx of [-.25,.15]){const swing=-gait.swing*(dx<0?1:-1);if(gait.moving||lift)beam(s,[x+dx+.05,y,.55],[x+dx+.05+gait.dx*swing,y+gait.dy*swing,.31+(dx>0?lift:0)],smith?.12:.1,dx===.15&&professionColor?professionColor:coat);else s.box(x+dx,y-.065,.29,smith?.12:.1,smith?.15:.13,.26,dx===.15&&professionColor?professionColor:coat);}
 if(detail){s.box(x-.25,y-.066,.275,.1,.15,.075,skin);s.box(x+.15,y-.066,.275+lift,.1,.15,.075,skin);if(smith){s.box(x-.25,y-.07,.33,.125,.155,.07,'#8a6f4a');s.box(x+.15,y-.07,.33,.125,.155,.07,'#8a6f4a');}}
 roundedHead(s,x,y,.56+bob,.32,.16,.145,skin);
 if(detail)s.box(x-.15,y-.14,.84+bob,.3,.15,.05,hair);
  if(hat==='helmet'||hat==='lamp'||hat==='crest'){
   s.box(x-.17,y-.16,.82+bob,.34,.32,.11,hat==='lamp'?'#86754f':metal);
   if(hat==='crest'){s.box(x-.03,y-.03,.88+bob,.06,.07,.2,brass);s.box(x-.085,y-.03,1.04+bob,.17,.07,.05,'#b76053');}
   if(detail&&hat==='helmet')for(const dx of [-.17,.135])s.box(x+dx,y-.15,.62+bob,.04,.2,.2,metal);
   if(hat==='lamp'){s.emissive=.7;s.box(x-.045,y+.135,.8+bob,.09,.04,.06,'#f6df9a');s.emissive=0;}
  }else if(hat==='goggles'){
   s.box(x-.17,y-.16,.82+bob,.34,.32,.09,coat);
   s.box(x-.13,y+.13,.68+bob,.09,.04,.075,'#c7d6d6');s.box(x+.02,y+.13,.68+bob,.09,.04,.075,'#c7d6d6');
   s.box(x-.025,y+.135,.71+bob,.06,.025,.03,leather);
  }else if(hat==='hood'||hat==='robe'){
  s.box(x-.19,y-.18,.72+bob,.38,.36,.2,coat);
  s.box(x-.19,y-.18,.55+bob,.38,.05,.24,coat);
  s.pyramid(x,y-.015,.88+bob,.16,.16,coat);
 }else{
  s.box(x-.16,y-.15,.84+bob,.32,.3,.1,hat==='straw'?'#d6bb78':coat);
  if(hat==='straw')s.box(x-.25,y-.23,.81+bob,.5,.46,.05,'#cbb176');
 }
  if(detail){
   for(const dx of [-.075,.045])s.box(x+dx,y+.14,.71+bob,.035,.02,.03,'#33443a');
   s.box(x-.02,y+.145,.665+bob,.05,.025,.035,skin);
  }
 }
  const gear=enemy?enemyGearFor(u):(u.gear||'');
  const attack=(u.animation||0)>0,bow=/bow/.test(gear);
    const twoHand=/pick|axe|hammer|saw|halberd|pike|bow|scythe|shovel|rod|net|crook/.test(gear);
  // Work arc synced to the strike clock: tool drives DOWN at contact (lift 0)
  // and recovers overhead (lift max), instead of resting up at impact.
  const stroke=Math.max(0,Math.min(1,lift/.18));
  const toolAngle=s.r.calm||bow?0:attack?-1.1*Math.min(1,u.animation/.4):twoHand?-0.9+stroke*1.9:-0.7+stroke*1.5;
 const item=/cart/.test(gear)&&!s.r.calm?{...data.items[gear],wheelAngle:-gait.distance/.065}:bow&&!s.r.calm&&u.attackTimer>0&&u.attackTimer<.18?{...data.items[gear],draw:1-u.attackTimer/.18}:data.items[gear];
   const hand=bakedAnchors?.hand,grip=hand||[.24,0,.34],facing=Object.create(s);
   // Turn the tool about its palm so its outward cant leads the walking direction.
   if(gait.moving)facing.face=(vertices,color,split=true)=>s.face(vertices.map(([vx,vy,vz])=>{const dx=vx-x-grip[0],dy=vy-y-grip[1];return [x+grip[0]+dx*gait.dx-dy*gait.dy,y+grip[1]+dx*gait.dy+dy*gait.dx,vz];}),color,split);
   const toolScene=pivotMesh(facing,[x+.24,y,.34],toolAngle);
   if(hand){
    // Rotate around the baked palm, not the old procedural grip.
     const anchored=Object.create(facing);
     anchored.face=(vertices,color,split=true)=>facing.face(vertices.map(([vx,vy,vz])=>[vx+hand[0]-.24,vy+hand[1],vz+hand[2]-.34]),color,split);
    // A fixed outward cant separates the tool without moving its grip off the palm.
    const wash=s.emissive;
    if(!enemy)s.emissive=Math.max(wash,.4);
    const gearScene=pivotMesh(anchored,[x+.24,y,.34],toolAngle-.25),gearMesh=bakedGearMesh(s,gear);
     if(gearMesh)for(const f of gearMesh.mesh.faces)gearScene.face(f.v.map(([vx,vy,vz])=>[x+.24+vx*gearMesh.scale,y+vy*gearMesh.scale,.34+vz*gearMesh.scale]),f.c);
    else equipment(gearScene,gear,item,x,y,0,detail);
     s.emissive=wash;
   }else equipment(toolScene,gear,item,x,y,0,detail);
   // Brace both baked and procedural two-hand tools from the chest to the shaft.
   if(twoHand){
    const c=bakedAnchors?.chest||[0,0,.55],angle=toolAngle-(hand?.25:0),reach=Math.sin(angle)*.1;
    beam(s,[x+c[0],y+c[1],c[2]],[x+grip[0]+reach*(gait.moving?gait.dx:1),y+grip[1]+reach*(gait.moving?gait.dy:0),grip[2]-Math.cos(angle)*.1],.07,skin);
   }
   if(enemy){
    let overlay=s,roleOverlay=s;
    if(baked){
     const {head,hand}=bakedAnchors,bounds=meshBounds(baked.mesh);
     // Head-zone top derives from the head anchor, NOT mesh bounds: raised
     // arms/weapons in attack poses would otherwise stretch head trim skyward.
     // Clamp the headroom so high-headed sets (rogue hoods) don't float trim.
     const top=head[2]+Math.max(.3,Math.min(.55,bounds.z1-head[2]))*bodyScale,width=(bounds.x1-bounds.x0)*bodyScale;
     overlay=Object.create(s);
     overlay.bakedHead=[x+head[0],y+head[1],head[2],top];
      // Preserve role profiles, fitted to this pose's palm, neck and head envelope.
      // Design constants scale with the body so oversized leaders keep trim on anatomy.
      overlay.face=(v,c,split=true)=>s.face(v.map(([vx,vy,vz])=>{
       const t=.56*bodyScale,d=.32*bodyScale;
       return [x+(vx-x)*width/.56+head[0],y+(vy-y)*bodyScale+head[1],vz<=t?vz*head[2]/t:head[2]+(vz-t)*(top-head[2])/d];
      }),c,split);
     roleOverlay=overlay;
     if(u.role==='ram'||u.role==='bombard'){
      roleOverlay=Object.create(s);
      roleOverlay.face=(v,c,split=true)=>s.face(v.map(([vx,vy,vz])=>[vx+hand[0],vy+hand[1],vz+hand[2]-.34]),c,split);
     }
    }
    enemyRoleSilhouette(roleOverlay,u,x,y,bob,detail,coat);
   // Baked skeletons skip the bone-face/rib overlay: it is authored for the
   // procedural skull and cannot sit on the baked anatomy. The pale bone bake
   // and role gear carry the read; baked human factions keep their overlay.
    if(!baked||baked.setId!=='skeleton')factionSilhouette(baked&&u.faction==='thornband'?Object.assign(Object.create(s),{bakedHead:overlay.bakedHead}):overlay,u,x,y,bob,detail);
    // Ember crest in direct space: the head-envelope remap can't place head
    // trim on high-headed rogue hoods. Ember is always rogue-based, so the
    // crest seats a fixed height above its head joint, clear of the hood.
    if(baked&&u.faction==='ember-legion'&&bakedAnchors?.head){
     const eh=bakedAnchors.head;
     s.box(x+eh[0]-.04,y+eh[1]-.02,eh[2]+.36,.08,.07,.15,'#c2502f');
     s.box(x+eh[0]-.025,y+eh[1]-.02,eh[2]+.45,.05,.06,.1,'#e0783c');
    }
   }
  if(/bow/.test(gear)){
   // Attached back-quiver sub-mesh: baked KayKit quiver at the back anchor.
   const back=bakedAnchors?.back;
   const qx=back?x+back[0]-.07:x-.13,qy=back?y+back[1]:y-.21,qz=back?back[2]:.3;
   const quiver=s.r?.meshes?.['gear-quiver'];
   if(quiver?.faces?.length&&back){for(const f of quiver.faces)s.face(f.v.map(([vx,vy,vz])=>[qx+vx*.5,qy+vy*.5,qz+vz*.5]),f.c);}
   else{
    s.box(qx,qy,qz,.14,.09,.34,leather);
    if(detail)for(const dx of [-.1,-.04])s.box(qx+dx+.03,qy+.02,qz+.32,.02,.02,.17,'#d9cda5');
    s.box(qx-.18,qy+.08,qz+.12,.1,.15,.32,leather);
    for(const dz of [.64,.7,.76])s.box(qx-.16,qy+.1,qz+dz-.3,.045,.05,.1,'#d9cda5');
   }
  }
 if(!baked&&enemy&&u.role==='breaker')s.box(x-.28,y-.135,.34,.1,.34,.39,'#687777');
  // Attached armor sub-mesh: simplified plate/shield at chest/back anchors
  // so baked bodies keep their read. Procedural torso path untouched.
  if(u.armor){
   const chest=bakedAnchors?.chest,back=bakedAnchors?.back;
   const armorColor=rarityColor(data.items[u.armor]?.rarity);
   if(/shield/.test(u.armor)){
   const buckler=s.r?.meshes?.['gear-shield'];
   if(baked&&back&&buckler?.faces?.length){for(const f of buckler.faces)s.face(f.v.map(([vx,vy,vz])=>[x+back[0]-.07+vx*.5,y+back[1]+vy*.5,back[2]+vz*.5]),f.c);}
   else if(baked&&back){s.box(x+back[0]-.09,y+back[1]-.02,back[2],.1,.38,.46,armorColor);if(detail){s.box(x+back[0]-.11,y+back[1]+.1,back[2]+.1,.035,.1,.12,'#ddbb75');s.box(x+back[0]-.055,y+back[1]+.12,back[2]+.14,.03,.06,.06,'#b76053');}}
   else{s.box(x-.31,y-.12,.24,.08,.32,.4,armorColor);if(detail)s.box(x-.33,y-.015,.37,.03,.09,.1,'#ddbb75');}
   }else if(/cap/.test(u.armor))s.box(x-.16,y-.15,.83+bob,.32,.3,.12,armorColor);
  else if(/coat|cloak|robe/.test(u.armor)){
   const cloth=/winter/.test(u.armor)?'#c7cebb':/oilskin/.test(u.armor)?'#5b8088':/robe/.test(u.armor)?'#9f8aaf':'#9b856c';
   s.box(x-.19,y-.17,.12,.38,.05,.44,cloth);
   if(detail)s.box(x-.2,y-.17,.48,.4,.3,.07,cloth);
  }
   else{
   if(baked&&chest){s.box(x+chest[0],y+chest[1],chest[2],.34,.03,.21,armorColor);if(detail)for(const dx of [-.27,.16])s.box(x+chest[0]+dx*.4,y+chest[1],chest[2]-.3,.1,.2,.08,armorColor);}
   else{s.box(x-.17,y+.115,.32,.34,.03,.21,armorColor);if(detail)for(const dx of [-.27,.16])s.box(x+dx,y-.1,.49,.1,.2,.08,armorColor);}
   }
  if(u.armor==='regalia')for(const dx of [-.1,0,.1])s.box(x+dx-.025,y+.05,.88+bob,.05,.05,.13,'#e8c673');
 }
  carriedLoad(s,u,troop,x,y+gait.swing*.12,detail);
  drawLevelFlair(s,u,x,y,bob,detail);
  drawHitFlash(s,u,x,y,enemy,time);
 if(u.emergency)s.box(x-.07,y-.06,1.14,.14,.12,.08,u.emergency.kind==='heal'?'#8ad2ad':u.emergency.kind==='repair'?'#bcd4e8':'#e2c578');
}
