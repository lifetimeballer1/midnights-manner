import {stewardSnapshot} from './systems/steward.js';
import {goalChoices} from './systems/steward-goals.js';
import {resourceInfo} from './resources.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const basket=c=>Object.entries(c||{}).filter(([,n])=>n>0).map(([k,n])=>`${Math.ceil(n)} ${resourceInfo(k).label}`).join(' · ');
const choiceCache=new WeakMap();
function cachedChoices(g){
 const now=g.world.elapsed||0,cached=choiceCache.get(g.world);
 if(cached&&now>=cached.at&&now-cached.at<3)return cached.choices;
 const choices=goalChoices(g);choiceCache.set(g.world,{at:now,choices});return choices;
}
const same=(a,b)=>a?.id===b?.id&&a?.buildingId===b?.buildingId&&a?.targetTier===b?.targetTier&&a?.tribeId===b?.tribeId&&a?.action===b?.action;
function issuesHtml(issues,limit=12){
 return issues.slice(0,limit).map(i=>`<div class="steward-issue"><strong>${esc(i.label)}</strong><p>${esc(i.detail)}</p>${i.buildingId?`<button data-steward-show="${esc(i.buildingId)}">Show problem</button>`:''}</div>`).join('')||'<p>No problems found in the latest check.</p>';
}
export function stewardStores(g){
 if(g.state.mission)return '';
 const s=g.world.steward||{},enabled=!!s.enabled;
 const head=`<article class="resource-detail steward-controls"><small>VILLAGE STEWARD</small><h3>Plan the village’s next step</h3><button data-steward-toggle="enabled" data-setting-value="${!enabled}" aria-pressed="${enabled}">Steward: ${enabled?'on':'off'}</button>`;
 if(!enabled)return head+'<p>Turn on village diagnostics, protected meal and repair budgets, and one main goal with two supporting goals.</p></article>';
 const snap=stewardSnapshot(g),choices=snap.choices||cachedChoices(g),goals=snap.goals||[];
 const slots=[['main','Main goal'],[0,'Supporting goal 1'],[1,'Supporting goal 2']].map(([slot,label])=>{
  const selected=slot==='main'?s.main:s.secondary?.[slot],goal=goals.find(x=>x.slot===slot);
  const available=selected&&!choices.some(c=>same(c,selected))?[{...selected,label:goal?.label||'Current goal'},...choices]:choices;
  return `<div class="steward-goal"><label>${label}<select data-steward-goal="${slot}"><option value="" ${selected?'':'selected'}>No goal</option>${available.map(c=>`<option value="${esc(JSON.stringify(c))}" ${same(c,selected)?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label>${goal?`<progress max="1" value="${Math.max(0,Math.min(1,goal.progress||0))}" aria-label="${esc(goal.label)} progress"></progress><p><strong>${Math.round((goal.progress||0)*100)}%</strong> · ${esc(goal.status)}</p>${goal.requirements?.some(r=>!r.ok)?`<small>Needs: ${esc(goal.requirements.filter(r=>!r.ok).map(r=>r.label).join(' · '))}</small>`:''}${Object.keys(goal.missing||{}).length?`<small>Missing from stores: ${esc(basket(goal.missing))}</small>`:''}${goal.buildingId?`<button data-steward-show="${esc(goal.buildingId)}">Show goal</button>`:''}`:''}</div>`;
 }).join('');
 return `${head}<p>Goals protect their next unpaid cost. Upgrade, recruit and depart through the existing controls; goals do not launch expeditions or place buildings.</p><div class="steward-toggles">${[['protectMeals','Protect next town meal'],['protectRepairs','Protect repairs']].map(([key,label])=>`<button data-steward-toggle="${key}" data-setting-value="${s[key]===false}" aria-pressed="${s[key]!==false}">${label}: ${s[key]===false?'off':'on'}</button>`).join('')}</div>${slots}<details data-steward-details="budget"><summary>Shared resource budget</summary>${budgetHtml(snap.budget)}<p>Automatic work respects these budgets. Manual purchases remain your choice. Planned costs are reserved once in goal priority order.</p></details><details data-steward-details="issues"><summary>Village problems (${snap.issues?.length||0})</summary>${issuesHtml(snap.issues||[])}<small>Checks up to 24 buildings every 3 seconds; larger villages rotate through buildings.</small></details></article>`;
}
function budgetHtml(budget){
 const resources=Object.entries(budget?.resources||{}).filter(([,r])=>r.planned>0||r.manual>0||r.missing>0);
 return resources.length?`<div class="steward-budget">${resources.map(([key,r])=>`<div><strong>${esc(resourceInfo(key).label)}</strong><span>${Math.floor(r.available||0)} available · ${Math.ceil(r.protected||0)} protected · ${Math.ceil(r.planned||0)} planned${r.missing>0?` · ${Math.ceil(r.missing)} short`:''}</span></div>`).join('')}</div>`:'<p>No protected or planned costs.</p>';
}
export function stewardBuilding(g,b){
 if(g.state.mission||!g.world.steward?.enabled)return '';
 const issues=(stewardSnapshot(g).issues||[]).filter(i=>i.buildingId===b.id);
 return issues.length?`<div class="steward-building"><strong>Steward check</strong>${issuesHtml(issues,3).replace(/<button[^>]*>Show problem<\/button>/g,'')}</div>`:'';
}
export function stewardChange(g,e){
 const t=e.target;if(!t.matches('[data-steward-goal]'))return false;
 choiceCache.delete(g.world);
 const slot=t.dataset.stewardGoal==='main'?'main':Number(t.dataset.stewardGoal);
 if(!t.value)g.clearStewardGoal(slot);
 else{try{g.setStewardGoal(slot,JSON.parse(t.value));}catch{g.notify('Choose a valid village goal.');}}
 return true;
}
export function stewardClick(g,b){
 if(!b.dataset.stewardToggle)return false;
 g.setSteward(b.dataset.stewardToggle,b.dataset.settingValue==='true');return true;
}
