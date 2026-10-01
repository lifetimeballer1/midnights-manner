// Supplemental function-specific props live in the existing static mesh cache.
const wood='#987046',pale='#d7c59b',steel='#aebbbb';
const groups={military:['barracks','shieldwall-yard','armory','bastion','tower','archer_tower','ballista','grand-watchtower','city-wall','manner-citadel'],food:['farm','pasture','mill','bakery','grand-granary'],books:['schoolroom','scriptorium','scout_post'],stone:['mason_yard','monument','cairnfield','oathstone','moon-dial'],worship:['chapel','sunken-chapel','bellcote','bell-tower','dawn-gate'],cargo:['storehouse','market','market-square','hall','cottage','longhouse'],wood:['lumber','timber_yard','sawmill','whisper-grove'],water:['pond','deephole','blackwater-weir'],orchard:['grove','frostgrove','manor-gardens'],industry:['forge','smeltery','workshop','forge-quarter','tannery','butchery','fletcher','mine','emberglass'],road:['stone-road','lantern-rows'],defense:['wall','stonewall','rampart','gate','trap','fire-trap','watchfire']};
export function propFamily(type){return Object.entries(groups).find(([,types])=>types.includes(type))?.[0]||null;}
export function addLivingProps(s,b,spec){
 if(b.id==null||b.hp<=0||b.remaining>0||s.r.cam.zoom<1.35)return;
 const {x,y,type,level}=b,n=spec.size,family=propFamily(type),px=x+.14,py=y+n-.24;
 if(family==='defense')return; // existing braces, portcullis, spikes and fuel
 if(family==='books'){
  s.box(px,py,.14,.4,.2,.28,wood);for(let i=0;i<3;i++)s.box(px+.04+i*.11,py+.01,.42,.09,.15,.025,['#6c7c97','#a67958',pale][i]);
  if(level>=3){s.box(x+n-.27,y+.16,.14,.025,.025,.6,wood);s.box(x+n-.25,y+.16,.58,.14,.025,.1,pale);}
 }else if(family==='military'){
  s.box(px,py,.14,.35,.14,.18,wood);for(let i=0;i<3;i++)s.box(px+.07+i*.075,py+.04,.32,.016,.016,.35,pale);if(level>=3){s.box(px+.04,py+.04,.57,.035,.025,.08,steel);s.box(px+.19,py+.04,.57,.035,.025,.08,steel);}
 }else if(family==='food'||family==='cargo'){
  s.box(px,py,.13,.24,.2,.13,wood);s.box(px-.01,py-.01,.25,.26,.22,.025,'#68513b');for(const dx of [.06,.16])s.pyramid(px+dx,py+.1,.26,.045,.07,family==='food'?'#d2b571':pale,5);if(level>=3){s.box(px+.28,py,.13,.09,.19,.15,wood);s.box(px+.28,py,.29,.12,.19,.02,pale);}
 }else if(family==='stone'||family==='worship'){
  s.box(px,py,.13,.24,.18,.12,'#a8afa9');s.box(px+.03,py+.02,.25,.19,.14,.055,'#c0c6ba');if(level>=3)s.box(px+.26,py+.03,.13,.035,.035,.34,steel);
 }else if(family==='water'){
  s.box(px,py,.13,.16,.16,.16,wood);s.box(px+.02,py+.02,.29,.12,.12,.02,'#6a979d');for(let i=0;i<3;i++)s.box(px+.2+i*.035,py,.13,.016,.23,.14,pale);
 }else if(family==='wood'){
  for(let i=0;i<2;i++){s.box(px,py+i*.08,.13,.35,.06,.08,wood);s.box(px+.33,py+i*.08,.13,.025,.06,.08,'#c49c67');}
 }else if(family==='orchard'){
  s.box(px,py,.13,.28,.2,.12,wood);for(const dx of [.06,.16,.23])s.pyramid(px+dx,py+.1,.25,.035,.045,type==='frostgrove'?'#aad6d4':'#ba7a59',5);
 }else if(family==='industry'){
  if(type==='tannery'){for(const dx of [0,.35])s.box(px+dx,py,.13,.035,.035,.5,wood);s.box(px+.04,py,.36,.3,.025,.24,'#b99770');}
  else if(type==='fletcher'){s.box(px,py,.13,.28,.13,.1,wood);for(let i=0;i<4;i++){s.box(px+.025+i*.06,py+.03,.23,.012,.012,.3,pale);s.box(px+.02+i*.06,py+.02,.47,.025,.025,.055,'#dfe1d1');}}
  else {s.box(px,py,.13,.24,.18,.1,wood);s.box(px+.04,py+.02,.23,.16,.12,.045,type==='mine'||type==='emberglass'?'#a29074':steel);}
 }else if(family==='road'){s.box(px,py,.13,.22,.18,.1,'#a8afa9');s.box(px+.03,py+.02,.23,.16,.12,.07,'#c0c6ba');}
 if(level>=4&&['food','cargo','books','industry'].includes(family)){for(const dx of [0,.2])s.box(px+dx,py,.08,.035,.035,.18,level>=6?steel:wood);if(level>=5)s.box(px,py+.16,.16,.24,.025,.025,wood);}
}
