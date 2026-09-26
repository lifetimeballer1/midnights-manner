const KEY='midnights-manner-v1';
export function save(game) {try{localStorage.setItem(KEY,JSON.stringify({...game,version:1}));return true;}catch{return false;}}
export function load(data) {
 try {
  const value=JSON.parse(localStorage.getItem(KEY));if(!value||value.version!==1)return null;
  function valid(w){return w&&['wood','food','gold'].every(k=>Number.isFinite(w.resources?.[k])&&w.resources[k]>=0)&&Array.isArray(w.buildings)&&w.buildings.every(b=>data.buildings[b.type]&&Number.isInteger(b.level)&&b.level>=1&&b.level<=data.buildings[b.type].tiers.length&&Number.isFinite(b.hp)&&Number.isFinite(b.x)&&Number.isFinite(b.y))&&Array.isArray(w.troops)&&w.troops.every(t=>data.troops[t.type]&&data.items[t.gear]&&Number.isInteger(t.level)&&t.level>=1&&t.level<=data.troops[t.type].maxLevel&&Array.isArray(t.owned))&&Array.isArray(w.enemies)&&Array.isArray(w.effects);}
  if(!valid(value.world)||!Array.isArray(value.completed)||!Array.isArray(value.unlocks))return null;
  if(value.mission&&(!valid(value.home)||!data.missions.some(m=>m.id===value.mission.id)))return null;
  return value;
 }catch{return null;}
}
