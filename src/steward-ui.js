import {stewardSnapshot} from './systems/steward.js';
import {goalChoices} from './systems/steward-goals.js';
import {districtChoices} from './systems/steward-districts.js';
import {resourceInfo} from './resources.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const basket=c=>Object.entries(c||{}).filter(([,n])=>n>0).map(([k,n])=>`${Math.ceil(n)} ${resourceInfo(k).label}`).join(' · ');
const choiceCache=new WeakMap(),previewCache=new WeakMap();
function cachedChoices(g){
 const now=g.world.elapsed||0,cached=choiceCache.get(g.world);
 if(cached&&now>=cached.at&&now-cached.at<3)return cached.choices;
 const choices=goalChoices(g);choiceCache.set(g.world,{at:now,choices,districts:districtChoices(g)});return choices;
}
const same=(a,b)=>a?.id===b?.id&&a?.buildingId===b?.buildingId&&a?.targetTier===b?.targetTier&&a?.tribeId===b?.tribeId&&a?.action===b?.action;
function issuesHtml(issues,limit=12,empty='No problems found in the latest check.'){
 return issues.slice(0,limit).map(i=>`<div class="steward-issue"><strong>${esc(i.label)}</strong><p>${esc(i.detail)}</p>${Object.keys(i.cost||{}).length?`<small>Cost: ${esc(basket(i.cost))}</small>`:''}${Object.keys(i.missing||{}).length?`<small>Missing: ${esc(basket(i.missing))}</small>`:''}${i.buildingId?`<button data-steward-show="${esc(i.buildingId)}">Show problem</button>`:''}</div>`).join('')||`<p>${esc(empty)}</p>`;
}
export function stewardStores(g,anchor={x:0,y:0}){
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
 return `${head}<p>Goals protect their next unpaid cost. Upgrade, recruit and depart through the existing controls; goals do not launch expeditions or place buildings.</p><div class="steward-toggles">${[['protectMeals','Protect next town meal'],['protectRepairs','Protect repairs']].map(([key,label])=>`<button data-steward-toggle="${key}" data-setting-value="${s[key]===false}" aria-pressed="${s[key]!==false}">${label}: ${s[key]===false?'off':'on'}</button>`).join('')}</div>${slots}<details data-steward-details="budget"><summary>Shared resource budget</summary>${budgetHtml(snap.budget)}<p>Automatic work respects these budgets. Manual purchases remain your choice. Planned costs are reserved once in goal priority order.</p></details><details data-steward-details="issues"><summary>Village problems (${snap.issues?.length||0})</summary>${issuesHtml(snap.issues||[])}<small>Checks up to 24 buildings every 3 seconds; larger villages rotate through buildings.</small></details>${advancedHtml(g,snap,anchor)}</article>`;
}
function budgetHtml(budget){
 const resources=Object.entries(budget?.resources||{}).filter(([,r])=>r.planned>0||r.manual>0||r.missing>0);
 return resources.length?`<div class="steward-budget">${resources.map(([key,r])=>`<div><strong>${esc(resourceInfo(key).label)}</strong><span>${Math.floor(r.available||0)} available · ${Math.ceil(r.protected||0)} protected · ${Math.ceil(r.planned||0)} planned${r.missing>0?` · ${Math.ceil(r.missing)} short`:''}</span></div>`).join('')}</div>`:'<p>No protected or planned costs.</p>';
}
function advancedHtml(g,snap,anchor){
 const s=g.world.steward,p=snap.production||{},q=snap.queue||[],districts=snap.districts||[],choices=choiceCache.get(g.world)?.districts||[],coverage=snap.coverage||{},reports=snap.reports||{},blueprints=snap.blueprints||s.blueprints||[],preview=previewCache.get(g.world)||{};
 const queue=Array.isArray(q)?q:q.entries||[];
 const production=`<details data-steward-details="production"><summary>Production targets & equipment</summary><p>Keep a stock target for each good. Refiners coordinate required inputs; protected meals and goals also supply targets.</p><div class="reserve-grid">${Object.keys(g.world.resources).map(key=>`<label>${esc(resourceInfo(key).label)} stock<input type="number" min="0" max="100000" step="1" inputmode="numeric" data-steward-target="${esc(key)}" value="${s.productionTargets?.[key]||0}"></label>`).join('')}</div>${(p.rows||[]).slice(0,12).map(r=>`<div class="steward-issue"><strong>${esc(resourceInfo(r.resource).label)}: ${Math.ceil(r.stored)} stored / ${Math.ceil(r.target)} target</strong><small>${esc(r.status)}${r.held>0?` · ${Math.floor(r.held)} waiting on-site`:''}${r.upstream?.length?` · Inputs: ${esc(r.upstream.map(i=>`${Math.ceil(i.amount)} ${resourceInfo(i.resource).label}`).join(' · '))}`:''}</small></div>`).join('')}<button data-steward-toggle="autoEquip" data-setting-value="${!s.autoEquip}" aria-pressed="${!!s.autoEquip}">Fit better stocked equipment: ${s.autoEquip?'on':'off'}</button><p>Fits compatible equipment already in stock. Keep either gear slot fixed from People.</p><small>${snap.equipment?.fitted||0} automatic fittings this session.</small></details>`;
 const construction=`<details data-steward-details="queue"><summary>Construction queue (${queue.length} / 12)</summary><button data-steward-toggle="queueEnabled" data-setting-value="${!s.queueEnabled}" aria-pressed="${!!s.queueEnabled}">Run construction queue: ${s.queueEnabled?'on':'off'}</button><p>Add an upgrade from a building’s inspector or queue a saved layout below. Repairs come first; new work waits during raids.</p>${queue.map((e,i)=>`<div class="steward-issue"><strong>${i+1}. ${esc(e.label)}</strong><p>${esc(e.status)}${Object.keys(e.cost||{}).length?` · Next stage: ${esc(basket(e.cost))}`:''}</p><div class="steward-actions">${e.buildingId?`<button data-steward-show="${esc(e.buildingId)}">Show</button>`:''}<button data-steward-queue-move="${esc(e.id)}" data-direction="-1" ${i===0?'disabled':''} aria-label="Move ${esc(e.label)} earlier">↑ Earlier</button><button data-steward-queue-move="${esc(e.id)}" data-direction="1" ${i===queue.length-1?'disabled':''} aria-label="Move ${esc(e.label)} later">↓ Later</button><button data-steward-queue-remove="${esc(e.id)}">Remove</button></div></div>`).join('')||'<p>No construction plans queued.</p>'}</details>`;
 const districtHtml=`<details data-steward-details="districts"><summary>Districts (${districts.length} / 6)</summary><p>Group existing buildings to track staffing, damage, inputs and outputs. Add or remove a selected building in its inspector.</p><label>District name<input data-steward-district-name maxlength="32" placeholder="Village district"></label><label>Suggested buildings<select data-steward-district-kind>${choices.map(c=>`<option value="${esc(c.kind)}">${esc(c.label)} · ${c.buildingIds.length} buildings</option>`).join('')}</select></label><button data-steward-district-create ${choices.length&&districts.length<6?'':'disabled'}>Create suggested district</button>${districts.map(d=>`<div class="steward-issue"><strong>${esc(d.name)} · ${esc(d.kind)}</strong><p>${d.buildings} buildings · ${d.workers} workers · ${d.unstaffed} unstaffed · ${d.damaged} damaged</p><small>Inputs: ${esc(d.inputs?.map(k=>resourceInfo(k).label).join(', ')||'none')} · Outputs: ${esc(d.outputs?.map(k=>resourceInfo(k).label).join(', ')||'none')}</small><label>Priority<select data-steward-district-priority="${esc(d.id)}">${['balanced','supply','repair'].map(k=>`<option value="${k}" ${d.priority===k?'selected':''}>${k}</option>`).join('')}</select></label><div class="steward-actions">${d.buildingIds[0]?`<button data-steward-show="${esc(d.buildingIds[0])}">Show district</button>`:''}<button data-steward-district-remove="${esc(d.id)}">Remove district</button></div></div>`).join('')}</details>`;
 const defense=`<details data-steward-details="coverage"><summary>Defense coverage & recovery</summary><p>Geometric coverage estimate: ${coverage.protected||0} of ${coverage.examined||0} sampled sites covered. This measures nearby posts, rather than proving a safe route.</p>${issuesHtml(coverage.gaps||[],12)}${reports.recovery?.active?`<h4>Recovery plan</h4>${issuesHtml(reports.recovery.steps||[],8)}`:'<p>No recovery plan is active.</p>'}</details>`;
 const readiness=`<details data-steward-details="readiness"><summary>Expedition readiness</summary><p>Review requirements before departing manually from Adventure. Health and equipment advice describes the home roster; campaign rosters follow their own rules.</p>${(reports.readiness||[]).slice(0,12).map(r=>`<div class="steward-issue"><strong>${esc(r.label)} · ${r.ready?'ready':'preparation needed'}</strong><p>${esc(r.detail)}</p>${Object.keys(r.cost||{}).length?`<small>Departure supplies: ${esc(basket(r.cost))}</small>`:''}${r.requirements?.some(x=>!x.ok)?`<small>Needs: ${esc(r.requirements.filter(x=>!x.ok).map(x=>x.label).join(' · '))}</small>`:''}${Object.keys(r.missing||{}).length?`<small>Missing: ${esc(basket(r.missing))}</small>`:''}${r.kind==='woodland'&&r.unitId?`<button data-steward-expedition="${esc(r.unitId)}" ${r.ready?'':'disabled'}>Send explorer</button>`:''}</div>`).join('')||'<p>No expedition report is available yet.</p>'}</details>`;
 const history=`<details data-steward-details="reports"><summary>Village reports</summary>${issuesHtml(reports.history||[],12,'No new village reports.')}</details>`;
 const blueprint=`<details data-steward-details="blueprints"><summary>Saved layouts (${blueprints.length} / 4)</summary><p>Save up to 12 finished buildings nearest the camera, excluding the manor. Preview a layout at a tile anchor, then queue it with an explicit click.</p><label>Layout name<input data-steward-blueprint-name maxlength="32" placeholder="My village layout"></label><button data-steward-blueprint-capture ${blueprints.length<4?'':'disabled'}>Save nearby layout</button>${blueprints.length?`<label>Saved layout<select data-steward-blueprint-id>${blueprints.map(b=>`<option value="${esc(b.id)}" ${(preview.id||blueprints[0]?.id)===b.id?'selected':''}>${esc(b.name)} · ${(b.entries||b.buildings||[]).length} buildings</option>`).join('')}</select></label><div class="steward-anchor"><label>Anchor X<input type="number" step="1" inputmode="numeric" data-steward-blueprint-x value="${preview.x??Math.floor(anchor.x)}"></label><label>Anchor Y<input type="number" step="1" inputmode="numeric" data-steward-blueprint-y value="${preview.y??Math.floor(anchor.y)}"></label></div><div class="steward-actions"><button data-steward-blueprint-preview>Preview layout</button><button data-steward-blueprint-remove>Delete layout</button></div>${preview.quote?`<div class="steward-issue"><strong>${preview.quote.ok?'Placement valid':esc(preview.quote.error||'Placement unavailable')}</strong><p>${preview.quote.entries?.length||0} buildings · Full plan: ${esc(basket(preview.quote.cost)||'No cost quoted')}</p>${(preview.quote.entries||[]).slice(0,12).map(e=>`<small>${esc(g.data.buildings[e.type]?.name||e.type)} at (${e.x}, ${e.y}) → tier ${e.targetTier}</small>`).join('')}<small>Queueing reserves the plan; resources are spent only when construction starts.</small><button data-steward-blueprint-apply ${preview.quote.ok?'':'disabled'}>Queue blueprint</button></div>`:''}`:''}</details>`;
 return production+construction+districtHtml+defense+blueprint+readiness+history;
}
export function equipmentPins(g,u){
 if(g.state.mission||!g.world.steward?.enabled)return '';
 return `<div class="steward-actions">${[['main','manualGear','Tool / weapon'],['armor','manualArmor','Armor']].map(([slot,key,label])=>`<button data-steward-pin="${esc(u.id)}" data-slot="${slot}" data-setting-value="${!u[key]}" aria-pressed="${!!u[key]}">${label}: ${u[key]?'keep current':'automatic fitting'}</button>`).join('')}</div>`;
}
export function stewardBuilding(g,b){
 if(g.state.mission||!g.world.steward?.enabled)return '';
 const issues=(stewardSnapshot(g).issues||[]).filter(i=>i.buildingId===b.id),districts=(g.world.steward.districts||[]).slice(0,6),current=districts.find(d=>d.buildingIds.includes(b.id)),spec=g.data.buildings[b.type],queue=(g.world.steward.queue||[]).slice(0,12);
 return `<div class="steward-building"><strong>Steward check</strong>${issues.length?issuesHtml(issues,3).replace(/<button[^>]*>Show problem<\/button>/g,''):''}<div class="steward-actions">${b.hp>0&&b.remaining<=0&&b.type!=='hall'?`<button data-steward-blueprint-single="${esc(b.id)}">Save this building as layout</button>`:''}${b.level<spec.tiers.length?`<button data-steward-queue-upgrade="${esc(b.id)}" ${queue.some(e=>e.buildingId===b.id)?'disabled':''}>Queue upgrade to tier ${b.level+1}</button>`:''}</div><label>District<select data-steward-building-district="${esc(b.id)}"><option value="">No district</option>${districts.map(d=>`<option value="${esc(d.id)}" ${current?.id===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label></div>`;
}
const reportResult=(g,r)=>{if(r?.ok===false&&r.error)g.notify(r.error);};
export function stewardChange(g,e){
 const t=e.target;if(t.matches('[data-steward-target]')){g.setProductionTarget(t.dataset.stewardTarget,Number(t.value));return true;}
 if(t.matches('[data-steward-district-priority]')){reportResult(g,g.updateDistrict(t.dataset.stewardDistrictPriority,{priority:t.value}));return true;}
 if(t.matches('[data-steward-building-district]')){
  const list=(g.world.steward?.districts||[]).slice(0,6),id=t.dataset.stewardBuildingDistrict,prior=list.find(d=>d.buildingIds.includes(id)),next=list.find(d=>d.id===t.value);
  if(prior?.id===next?.id)return true;
  if(next&&next.buildingIds.length>=24){g.notify('That district already has 24 buildings.');return true;}
  if(prior)reportResult(g,g.updateDistrict(prior.id,{buildingIds:prior.buildingIds.filter(x=>x!==id)}));
  if(next)reportResult(g,g.updateDistrict(next.id,{buildingIds:[...next.buildingIds,id]}));
  choiceCache.delete(g.world);return true;
 }
 if(t.matches('[data-steward-blueprint-id],[data-steward-blueprint-x],[data-steward-blueprint-y]')){
  const box=t.closest('[data-steward-details]');previewCache.set(g.world,{id:box.querySelector('[data-steward-blueprint-id]').value,x:Number(box.querySelector('[data-steward-blueprint-x]').value),y:Number(box.querySelector('[data-steward-blueprint-y]').value)});return true;
 }
 if(!t.matches('[data-steward-goal]'))return false;
 choiceCache.delete(g.world);
 const slot=t.dataset.stewardGoal==='main'?'main':Number(t.dataset.stewardGoal);
 if(!t.value)g.clearStewardGoal(slot);
 else{try{g.setStewardGoal(slot,JSON.parse(t.value));}catch{g.notify('Choose a valid village goal.');}}
 return true;
}
export function stewardClick(g,b,anchor={x:0,y:0}){
 const d=b.dataset;
 if(d.stewardToggle){g.setSteward(d.stewardToggle,d.settingValue==='true');return true;}
 if(d.stewardExpedition){g.sendExpedition(d.stewardExpedition);return true;}
 if(d.stewardPin){g.setEquipmentPin(d.stewardPin,d.slot,d.settingValue==='true');return true;}
 if(d.stewardQueueUpgrade){const target=g.world.buildings.find(x=>x.id===d.stewardQueueUpgrade);if(target)reportResult(g,g.enqueueConstruction({kind:'upgrade',buildingId:target.id,targetTier:target.level+1}));return true;}
 if(d.stewardQueueRemove){reportResult(g,g.removeConstruction(d.stewardQueueRemove));return true;}
 if(d.stewardQueueMove){reportResult(g,g.moveConstruction(d.stewardQueueMove,Number(d.direction)));return true;}
 if(Object.hasOwn(d,'stewardDistrictCreate')){
  const box=b.closest('[data-steward-details]'),kind=box.querySelector('[data-steward-district-kind]').value,choice=(choiceCache.get(g.world)?.districts||districtChoices(g)).find(x=>x.kind===kind),name=box.querySelector('[data-steward-district-name]').value.trim()||`${kind[0]?.toUpperCase()}${kind.slice(1)} district`;
  if(choice)reportResult(g,g.createDistrict({name,kind,buildingIds:choice.buildingIds,priority:'balanced'}));choiceCache.delete(g.world);return true;
 }
 if(d.stewardDistrictRemove){reportResult(g,g.removeDistrict(d.stewardDistrictRemove));choiceCache.delete(g.world);return true;}
 if(d.stewardBlueprintSingle){const target=g.world.buildings.find(x=>x.id===d.stewardBlueprintSingle);if(target)reportResult(g,g.captureBlueprint(g.data.buildings[target.type].name,[target.id]));return true;}
 if(Object.hasOwn(d,'stewardBlueprintCapture')){
  const name=b.closest('[data-steward-details]').querySelector('[data-steward-blueprint-name]').value.trim()||'Village layout';
  const ids=g.world.buildings.filter(x=>x.type!=='hall'&&x.hp>0&&x.remaining<=0).sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y)).slice(0,12).map(x=>x.id);
  reportResult(g,g.captureBlueprint(name,ids));return true;
 }
 if(Object.hasOwn(d,'stewardBlueprintPreview')||Object.hasOwn(d,'stewardBlueprintRemove')){
  const box=b.closest('[data-steward-details]'),id=box.querySelector('[data-steward-blueprint-id]').value,x=Number(box.querySelector('[data-steward-blueprint-x]').value),y=Number(box.querySelector('[data-steward-blueprint-y]').value);
  if(Object.hasOwn(d,'stewardBlueprintRemove')){reportResult(g,g.removeBlueprint(id));previewCache.delete(g.world);}
  else previewCache.set(g.world,{id,x,y,quote:g.previewBlueprint(id,x,y)});
  return true;
 }
 if(Object.hasOwn(d,'stewardBlueprintApply')){const p=previewCache.get(g.world);if(p?.quote?.ok){reportResult(g,g.applyBlueprint(p.id,p.x,p.y));previewCache.delete(g.world);}return true;}
 return false;
}
