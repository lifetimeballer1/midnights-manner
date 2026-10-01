import {defensePostCapacity,defenseOccupants,defenseStatus} from './systems/defense-posts.js';
import {automationSettings,automationStatus} from './systems/automation.js';
import {shelterOccupants} from './systems/shelter.js';
import {resourceInfo} from './resources.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function defenseChoice(g,u){
 if(g.state.mission)return '';
 if(g.data.troops[u.type]?.role!=='combat')return '';
 const sites=g.world.buildings.filter(b=>defensePostCapacity(b,g.data));
 return `<div class="job automation-controls"><label>Defense job <select data-defense-assign="${u.id}"><option value="auto" ${!u.manualDefensePost?'selected':''}>Automatic assignment</option><option value="reserve" ${u.manualDefensePost&&!u.defensePost?'selected':''}>Unstationed reserve</option>${sites.map(b=>{const n=defenseOccupants(g.world,b.id).length,cap=defensePostCapacity(b,g.data);return `<option value="${b.id}" ${u.manualDefensePost&&u.defensePost===b.id?'selected':''} ${n>=cap&&u.defensePost!==b.id?'disabled':''}>${escape(g.data.buildings[b.type].name)} ${n}/${cap}</option>`;}).join('')}</select></label><small>${escape(defenseStatus(g.world,g.data,u))}${u.manualDefensePost?' · Assigned by you':''}</small></div>`;
}
export function defenseWorkplace(g,b){
 if(g.state.mission)return '';
 const cap=defensePostCapacity(b,g.data);if(!cap)return '';
 const crew=defenseOccupants(g.world,b.id),candidates=g.world.troops.filter(u=>u.hp>0&&!u.expedition&&g.data.troops[u.type]?.role==='combat'&&u.defensePost!==b.id);
 const row=(u,posted)=>`<article class="worker-row"><img src="./assets/sprites/${g.data.troops[u.type].sprite}" alt=""><div><b>${escape(u.name||g.data.troops[u.type].name)}</b><small>${escape(defenseStatus(g.world,g.data,u))}${u.manualDefensePost?' · Manual post':''}</small></div><button data-defense-unit="${u.id}" data-defense-post="${posted?'reserve':b.id}" ${!posted&&crew.length>=cap?'disabled':''}>${posted?'Release':'Station'}</button></article>`;
 return `<div class="workplace-summary"><div><h3>${crew.length} / ${cap} defense jobs filled</h3><p>Available fighters fill posts automatically. Stationing a fighter here keeps your choice; releasing keeps them in reserve. Choose Automatic assignment in People to resume filling.</p></div></div><div class="panel-heading">STATIONED FIGHTERS</div>${crew.map(u=>row(u,true)).join('')||'<p class="empty-crew">Waiting for available fighters.</p>'}<div class="panel-heading">AVAILABLE FIGHTERS & TRANSFERS</div>${candidates.map(u=>row(u,false)).join('')||'<p class="empty-crew">No available fighters.</p>'}`;
}
export function buildingAutomation(g,b){
 if(g.state.mission)return '';
 const spec=g.data.buildings[b.type],craft=Object.values(g.data.items).some(i=>i.craft?.building===b.type),occupants=shelterOccupants(g.world,b.id),config=automationSettings(g.world);
 return `${occupants?`<p class="refine-line">Sheltered inside: ${occupants} villagers</p>`:''}<div class="automation-controls"><button data-building-setting="autoUpgrade" data-building-id="${b.id}" data-setting-value="${!b.autoUpgrade}" aria-pressed="${!!b.autoUpgrade}">Auto-upgrade: ${b.autoUpgrade?'on':'off'}</button><label>Stop at tier <select data-building-tier="${b.id}">${spec.tiers.map((_,i)=>`<option value="${i+1}" ${(b.autoUpgradeMaxTier||spec.tiers.length)===i+1?'selected':''}>${i+1}</option>`).join('')}</select></label>${craft?`<button data-building-setting="autoCraft" data-building-id="${b.id}" data-setting-value="${b.autoCraft===false}" aria-pressed="${b.autoCraft!==false}">Auto-craft: ${b.autoCraft===false?'off':'on'}</button>`:''}<small>${escape(automationStatus(g,b))}${b.autoUpgrade&&!config.autoUpgrade?' · Enable automatic upgrades in Stores.':''}</small></div>`;
}
export function automationStores(g){
 if(g.state.mission)return '';
 const s=automationSettings(g.world),keys=Object.keys(g.world.resources);
 return `<article class="resource-detail automation-controls"><small>VILLAGE AUTOMATION</small><h3>Builders & workshops</h3><button data-automation-toggle="autoUpgrade" data-setting-value="${!s.autoUpgrade}" aria-pressed="${s.autoUpgrade}">Automatic upgrades: ${s.autoUpgrade?'on':'off'}</button><p>Enable individual buildings in their inspector. Builders repair first, then finish construction. One automatic upgrade runs at a time; new upgrades wait during raids.</p><label>Spare equipment stock <input type="number" min="0" max="5" step="1" inputmode="numeric" data-automation-stock value="${s.stockTarget}"></label><p>Staffed workshops forge the highest unlocked equipment needed by your people, then keep this many spares. They wait for its materials. Equipment remains in stock until fitted.</p><details data-automation-reserves><summary>Protected resource reserves</summary><p>Automatic crafting, repairs and upgrades leave these amounts in storage.</p><div class="reserve-grid">${keys.map(k=>`<label>${escape(resourceInfo(k).label)}<input type="number" min="0" max="1000000000" step="1" inputmode="numeric" data-automation-reserve="${k}" value="${s.reserves[k]||0}"></label>`).join('')}</div></details></article>`;
}
export function automationChange(g,e){
 const t=e.target;
 if(t.matches('[data-defense-assign]')){g.assignDefense(t.dataset.defenseAssign,t.value==='reserve'?null:t.value);return true;}
 if(t.matches('[data-building-tier]')){g.configureBuilding(t.dataset.buildingTier,'autoUpgradeMaxTier',Number(t.value));return true;}
 if(t.matches('[data-automation-reserve]')){g.setAutomationReserve(t.dataset.automationReserve,Number(t.value));return true;}
 if(t.matches('[data-automation-stock]')){g.setAutomation('stockTarget',Number(t.value));return true;}
 return false;
}
export function automationClick(g,b){
 if(b.dataset.defenseUnit){g.assignDefense(b.dataset.defenseUnit,b.dataset.defensePost==='reserve'?null:b.dataset.defensePost);return true;}
 if(b.dataset.buildingSetting){g.configureBuilding(b.dataset.buildingId,b.dataset.buildingSetting,b.dataset.settingValue==='true');return true;}
 if(b.dataset.automationToggle){g.setAutomation(b.dataset.automationToggle,b.dataset.settingValue==='true');return true;}
 return false;
}
