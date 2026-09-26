import {stats,unlockedAbilities,buildingCost,housing,XP_LEVELS,center,assignedWorkers,workplaceCapacity,canPlace,afford} from './model.js';
import {currentQuest,questProgress} from './systems/village.js';
import {sfx,isMuted,toggleMute} from './systems/audio.js';
const icons={wood:'▰',food:'♧',gold:'◆'};
const resourceSprites={wood:'item-hammer.png',food:'item-sickle.png',gold:'item-pickaxe.png'};
const cost=c=>Object.entries(c).map(([k,v])=>`${icons[k]} ${Math.ceil(v)} ${k}`).join(' · ')||'Included';
const img=name=>`<img src="./assets/sprites/${name}" alt="">`;
const $=s=>document.querySelector(s);
export class UI {
 constructor(game,renderer){this.game=game;this.renderer=renderer;this.tab='build';this.category='all';this.selected=null;this.selectedTroop=null;this.clock=0;this.panel=$('#panel');this.lastMessage='';this.toastTime=0;this.lastPanel='';this.lastRail='';this.lastResult='';this.started=false;this.game.paused=true;this.bind();this.refresh();}
 blocked(){return !this.started||this.game.paused||!$('#drawer').hidden||!$('#raid-overlay').hidden;}
 bind(){
  $('#begin').onclick=()=>{this.started=true;$('#title').hidden=true;this.game.paused=false;this.renderer.fitVillage(this.game.world);$('#world').focus({preventScroll:true});this.game.notify('Your village awaits. Drag to explore; pinch to zoom.');this.refresh();};
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>this.openPanel(b.dataset.tab));
  $('#close-panel').onclick=()=>this.closePanel();$('#drawer-backdrop').onclick=()=>this.closePanel();
  $('#quest-chip').onclick=()=>this.openPanel('story');
  $('#panel-filters').onclick=e=>{const button=e.target.closest('[data-category]');if(!button)return;this.category=button.dataset.category;this.lastPanel='';this.renderFilters();this.refresh();};
  $('#pause').onclick=()=>this.openPause();$('#resume').onclick=()=>this.closePause();
  try{if(localStorage.getItem('midnights-manner-calm')==='on')this.renderer.calm=true;}catch{}
  $('#pause-overlay').onclick=e=>{const b=e.target.closest('button');if(!b)return;
   if(b.id==='opt-sound'){toggleMute();this.syncPause();}
   if(b.id==='opt-motion'){this.renderer.calm=!this.renderer.calm;try{localStorage.setItem('midnights-manner-calm',this.renderer.calm?'on':'off');}catch{}this.syncPause();}
   if(b.id==='opt-grid'){this.renderer.grid=!this.renderer.grid;this.syncPause();}
   if(b.id==='opt-save'){if(this.game.persist())this.game.notify('Saved on this browser.');}
   if(b.id==='fullscreen'){if(document.fullscreenElement)document.exitFullscreen?.();else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>this.game.notify('Use Add to Home Screen for full-screen play.'));else this.game.notify('On iPhone: Safari → Share → Add to Home Screen.');}
   if(b.id==='help')$('#controls-recap').classList.toggle('help-highlight');this.refresh();
  };
  $('#grid').onclick=()=>{this.renderer.grid=!this.renderer.grid;$('#grid').setAttribute('aria-pressed',String(this.renderer.grid));};
  $('#zoom-in').onclick=()=>this.renderer.zoomBy(1.18);$('#zoom-out').onclick=()=>this.renderer.zoomBy(1/1.18);$('#recenter').onclick=()=>this.renderer.fitVillage(this.game.world);
  $('#cancel').onclick=()=>this.cancel();$('#confirm-place').onclick=()=>this.confirmPlacement();
  $('#raid').onclick=()=>{this.closePanel();this.cancel();if(this.game.state.mission){this.openPanel('story');return;}this.game.raid();this.refresh();};
  $('#army-rail').onclick=e=>{const b=e.target.closest('[data-select-unit]');if(b)this.selectTroop(b.dataset.selectUnit);};
  $('#inspector').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const action=b.dataset.action;
   if(action==='close'){this.clearSelection();return;}
   if(action==='upgrade')this.game.upgrade(this.selected);
   if(action==='repair')this.game.repair(this.selected);
   if(action==='hold'&&this.selectedTroop)this.game.commandHold(this.selectedTroop);
   if(action==='resume'&&this.selectedTroop)this.game.clearOrder(this.selectedTroop);
   if(action==='gear'){this.openPanel('troops');return;}
   if(action==='harvest')this.game.harvest(this.selected);
   if(action==='move'){const selected=this.game.world.buildings.find(b=>b.id===this.selected);if(selected){this.startPlacement(selected.type,selected.id);return;}}
   if(action==='assign'){this.openPanel('troops');return;}
   this.refresh();
  };
  this.panel.onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
   if(b.dataset.build){this.startPlacement(b.dataset.build);return;}
   if(b.dataset.recruit)this.game.recruit(b.dataset.recruit);
   if(b.dataset.level)this.game.level(b.dataset.level);
   if(b.dataset.gear)this.game.equip(b.dataset.unit,b.dataset.gear);
   if(b.dataset.ability)this.game.ability(b.dataset.unit,b.dataset.ability);
   if(b.dataset.mission){this.cancel();this.clearSelection();this.game.mission(b.dataset.mission);if(this.game.state.mission){this.closePanel();this.renderer.fitVillage(this.game.world);}}
   if(b.dataset.home){this.game.returnHome();this.cancel();this.clearSelection();this.closePanel();this.renderer.fitVillage(this.game.world);}
   this.lastPanel='';this.refresh();
  };
  this.panel.onchange=e=>{const select=e.target.closest('select[data-assign]');if(select){this.game.assign(select.dataset.assign,select.value||null);this.refresh();}};
  $('#raid-overlay').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.repairAll)this.game.repairAll();if(b.dataset.home){this.game.returnHome();this.renderer.fitVillage(this.game.world);}if(b.dataset.dismiss||b.dataset.repairAll)this.game.world.raidResult=null;this.refresh();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#pause-overlay').hidden)this.closePause();else if(!$('#drawer').hidden)this.closePanel();else this.cancel();}if(e.key==='Tab')this.trapFocus(e);});
 }
 trapFocus(e){const container=!$('#title').hidden?$('#title'):!$('#pause-overlay').hidden?$('#pause-overlay'):!$('#raid-overlay').hidden?$('#raid-overlay'):!$('#drawer').hidden?$('#drawer'):null;if(!container)return;const items=[...container.querySelectorAll('button:not(:disabled),select')].filter(el=>el.getClientRects().length);if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||!container.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!container.contains(document.activeElement))){e.preventDefault();first.focus();}}
 openPanel(tab){if(!this.started||this.game.paused)return;this.cancel();this.tab=tab;this.category='all';this.lastPanel='';this.closeSelectionOnly();$('#drawer').hidden=false;$('#drawer-backdrop').hidden=false;document.body.classList.add('drawer-open');const titles={build:['VILLAGE WORKSHOP','Build your village'],troops:['YOUR PEOPLE','Train. Equip. Defend.'],story:['BEYOND THE TREELINE','The frontier awaits']};$('#panel-kicker').textContent=titles[tab][0];$('#panel-title').textContent=titles[tab][1];document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));this.renderFilters();this.refresh();$('#close-panel').focus({preventScroll:true});sfx.click();}
 closePanel(){const wasOpen=!$('#drawer').hidden;$('#drawer').hidden=true;$('#drawer-backdrop').hidden=true;document.body.classList.remove('drawer-open');document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));if(wasOpen)$('#world').focus({preventScroll:true});}
 renderFilters(){const filters=this.tab==='build'?[['all','All'],['economy','Resources'],['defense','Defenses'],['village','Village & jobs']]:this.tab==='troops'?[['all','Everyone'],['combat','Fighters'],['workers','Workers'],['recruit','Recruit']]:[];$('#panel-filters').hidden=!filters.length;$('#panel-filters').innerHTML=filters.map(([id,label])=>`<button data-category="${id}" class="${id===this.category?'active':''}">${label}</button>`).join('');}
 openPause(){if(!this.started)return;this.closePanel();this.cancel();this.game.paused=true;$('#pause-overlay').hidden=false;this.syncPause();$('#resume').focus();}
 closePause(){this.game.paused=false;$('#pause-overlay').hidden=true;$('#world').focus({preventScroll:true});this.refresh();}
 syncPause(){$('#opt-sound').textContent=`Sound: ${isMuted()?'off':'on'}`;$('#opt-motion').textContent=`Motion: ${this.renderer.calm?'calm':'full'}`;$('#opt-grid').textContent=`Grid: ${this.renderer.grid?'on':'off'}`;}
 closeSelectionOnly(){this.selected=null;this.selectedTroop=null;this.renderer.selection=null;$('#inspector').hidden=true;}
 clearSelection(){this.closeSelectionOnly();this.refresh();}
 cancel(){this.renderer.placing=null;this.renderer.moving=null;this.closeSelectionOnly();this.placementHint();this.refresh();}
 startPlacement(type,id=null){this.closePanel();this.closeSelectionOnly();this.renderer.placing=type;this.renderer.moving=id;this.renderer.grid=true;this.renderer.hover=null;this.placementHint();this.game.notify('Tap a tile to preview. Press Build to confirm.');this.refresh();}
 placementHint(){const r=this.renderer,type=r.placing;$('#placement').hidden=!type;document.body.classList.toggle('placing',!!type);if(!type)return;const b=this.game.data.buildings[type],costs=r.moving?{}:buildingCost(type,1,this.game.world,this.game.data);const valid=r.hover&&canPlace(this.game.world,this.game.data,type,r.hover.x,r.hover.y,r.moving);const affordable=afford(this.game.world.resources,costs);$('#placement-hint').textContent=b.name;$('#placement-cost').textContent=r.moving?'Move for free':cost(costs);$('#placement-state').textContent=!r.hover?'TAP A TILE TO PREVIEW':!valid?'BLOCKED · CHOOSE ANOTHER TILE':!affordable?'NOT ENOUGH RESOURCES':'READY TO PLACE';$('#confirm-place').disabled=!valid||!affordable;$('#confirm-place').textContent=r.moving?'Move ✓':'Build ✓';}
 confirmPlacement(){const r=this.renderer;if(!r.placing||!r.hover)return;const {x,y}=r.hover;const type=r.placing;if(r.moving){if(this.game.relocate(r.moving,x,y))this.cancel();}else{const b=this.game.build(type,x,y);if(b){if(type==='wall'){r.hover=null;this.placementHint();}else{this.cancel();this.selected=b.id;r.selection=b.id;}}}this.refresh();}
 selectTroop(id){this.cancel();const unit=this.game.world.troops.find(t=>t.id===id&&t.hp>0);if(!unit)return;this.selectedTroop=id;this.renderer.selection=id;this.renderer.cam.x=unit.x;this.renderer.cam.y=unit.y;this.refresh();sfx.click();}
 selectCell(cell,hit=null){if(this.blocked())return;const r=this.renderer,g=this.game;if(r.placing){r.hover=cell;this.placementHint();return;}
  if(hit?.kind==='harvest'){g.harvest(hit.id);this.refresh();return;}
  const unit=hit?.kind==='unit'?g.world.troops.find(t=>t.id===hit.id):null;
  if(unit){this.selected=null;this.selectedTroop=unit.id;r.selection=unit.id;this.refresh();sfx.click();return;}
  if(this.selectedTroop){if(hit?.kind==='enemy')g.commandAttack(this.selectedTroop,hit.id);else g.commandMove(this.selectedTroop,cell.x,cell.y);this.refresh();return;}
  const building=hit?.kind==='building'?g.world.buildings.find(b=>b.id===hit.id):g.world.buildings.find(b=>cell.x>=b.x&&cell.x<b.x+g.data.buildings[b.type].size&&cell.y>=b.y&&cell.y<b.y+g.data.buildings[b.type].size);
  this.selected=building?.id||null;r.selection=this.selected;if(building)sfx.click();this.refresh();
 }
 setPanelHTML(html){if(this.lastPanel===html||this.panel.contains(document.activeElement)&&document.activeElement.tagName==='SELECT')return;const scroll=this.panel.scrollTop;this.panel.innerHTML=html;this.panel.scrollTop=scroll;this.lastPanel=html;}
 refresh(){const g=this.game,w=g.world,d=g.data;
  const resourceHTML=Object.entries(w.resources).map(([key,value])=>`<div class="resource ${value<30?'low':''}" data-resource="${key}" title="${key}">${img(resourceSprites[key])}<div><b>${Math.floor(value).toLocaleString()}</b><small>${key}</small></div></div>`).join('');if($('#resources').innerHTML!==resourceHTML)$('#resources').innerHTML=resourceHTML;
  document.body.classList.toggle('raid-active',w.enemies.length>0||!!w.raidPending);
  $('#day').textContent=`Day ${Math.floor(w.elapsed/180)+1} · ${g.state.mission?'Expedition':'Homestead'}`;
  $('#village-level').textContent=g.state.vlevel||1;const lv=g.state.vlevel||1,lo=XP_LEVELS[lv-1]||0,hi=XP_LEVELS[lv]||lo+1;$('#xp-fill').style.width=`${Math.max(0,Math.min(100,((g.state.xp||0)-lo)/(hi-lo)*100))}%`;
  $('#chapter-count').textContent=`${g.state.completed.length} / ${d.missions.length}`;$('#population-count').textContent=`${w.troops.length} villagers`;$('#wave-count').textContent=g.state.mission?'Expedition':`Wave ${w.wave+1}`;
  if(this.lastMessage!==g.message){this.lastMessage=g.message;$('#status').textContent=g.message;this.toastTime=4.5;$('#status').classList.add('show');}
  const q=currentQuest(g.state,d);$('#quest-name').textContent=q?.name||'Your village is thriving';if(q){const p=questProgress(q.task,g.state);$('#quest-progress').textContent=`${Math.min(p.have,p.need)} / ${p.need} · +${q.xp} XP`;}else $('#quest-progress').textContent='Explore the campaign';
  const mission=d.missions.find(m=>m.id===g.state.mission?.id),battle=$('#battle-hud');battle.hidden=!w.enemies.length&&!w.raidPending&&!mission;
  if(w.raidPending)battle.innerHTML=`<b>RAIDERS INCOMING · ${Math.ceil(w.raidPending.timer)}</b><small>${w.raidPending.count} approaching from the west</small>`;
  else if(w.enemies.length)battle.innerHTML=`<b>DEFEND THE MANOR</b><small>${w.enemies.length} raiders left · ${w.raidKills||0} defeated</small>`;
  else if(mission){const o=mission.objectives[0],fraction=Math.min(1,w.gathered[o.resource]/o.amount);battle.innerHTML=`<b>${Math.max(0,Math.ceil(mission.timeLimit-w.elapsed))}s · ${mission.name}</b><small>${Math.floor(w.gathered[o.resource])} / ${o.amount} ${o.resource}</small><div class="battle-progress"><i style="width:${fraction*100}%"></i></div>`;}
  const units=w.troops.filter(t=>d.troops[t.type].role==='combat'),rail=units.map(u=>`<button class="army-card ${this.selectedTroop===u.id?'selected':''}" data-select-unit="${u.id}" aria-label="Select ${d.troops[u.type].name}, level ${u.level}" ${u.hp<=0?'disabled':''}><span class="unit-level">${u.level}</span>${img(d.troops[u.type].sprite)}<small>${d.troops[u.type].name}</small><span class="unit-health"><i style="width:${Math.ceil(u.hp/stats(u,d).hp*100)}%"></i></span></button>`).join('');if(rail!==this.lastRail){const scroll=$('#army-rail').scrollLeft;$('#army-rail').innerHTML=rail;$('#army-rail').scrollLeft=scroll;this.lastRail=rail;}
  if(!$('#drawer').hidden){if(this.tab==='build')this.renderBuild();else if(this.tab==='troops')this.renderTroops();else this.renderStory();}
  this.renderInspector();this.placementHint();this.renderRaidOverlay();g.dirty=false;
 }
 renderRaidOverlay(){const g=this.game,w=g.world,el=$('#raid-overlay'),mission=g.state.mission;
  if(mission&&mission.status!=='active'){const won=mission.status==='won',m=g.data.missions.find(m=>m.id===mission.id);const html=`<section class="raid-card ${won?'won':'lost'}" role="dialog" aria-modal="true" aria-label="Expedition result"><div class="eyebrow">${won?'EXPEDITION COMPLETE':'EXPEDITION LOST'}</div><h2>${won?'A new chapter begins.':'Your home is safe.'}</h2><p>${m.name}</p><div class="raid-stats"><div><span>${won?'First-clear rewards':'Regroup and try again'}</span><b>${won?cost(m.rewards):''}</b></div></div><button class="gold-button" data-home="true">${won?'Claim & return home':'Return home'}</button></section>`;if(this.lastResult!==html){el.innerHTML=html;this.lastResult=html;el.querySelector('button').focus({preventScroll:true});}el.hidden=false;return;}
  const r=w.raidResult;if(!r||w.enemies.length||w.raidPending||mission){el.hidden=true;this.lastResult='';return;}const repairWood=w.buildings.reduce((n,b)=>n+Math.ceil((g.data.buildings[b.type].tiers[b.level-1].hp-b.hp)/15),0);
  const html=`<section class="raid-card ${r.won?'won':'lost'}" role="dialog" aria-modal="true" aria-label="Raid result"><div class="eyebrow">${r.won?'VICTORY':'DEFEAT'} · WAVE ${w.wave}</div><h2>${r.won?'The village stands!':'Rebuild. Rise again.'}</h2><div class="raid-stats"><div><span>Raiders defeated</span><b>${r.kills}</b></div><div><span>Gold recovered</span><b>+${r.loot}</b></div><div><span>Repair cost</span><b>${repairWood} wood</b></div></div><div class="actions"><button class="gold-button" data-repair-all="true" ${repairWood>0&&w.resources.wood>=repairWood?'':'disabled'}>Repair all</button><button data-dismiss="true">Continue</button></div></section>`;
  if(this.lastResult!==html){el.innerHTML=html;this.lastResult=html;}el.hidden=false;
 }
 renderBuild(){const g=this.game,w=g.world,d=g.data;
  const lvl=g.state.vlevel||1,xp=g.state.xp||0,lo=XP_LEVELS[lvl-1]??0,hi=XP_LEVELS[lvl]??(lo+1);
  const hh=housing(w,d),bal=(w.foodIncome??0)-(w.foodUpkeep??0);
  const strip=`<div class="village-strip"><div class="vlevel">☾ LVL ${lvl} · ${Math.floor(xp)} XP</div><div class="levelbar village-xp"><div style="width:${Math.max(0,Math.min(100,(xp-lo)/Math.max(1,hi-lo)*100))}%"></div></div><div class="vstats"><span title="Beds used / beds built">🛏 ${hh.used}/${hh.beds}</span><span title="Settled map size">🗺 ${w.bounds?.w||d.world.width}×${w.bounds?.h||d.world.height}</span><span title="Food income minus mouths to feed">${bal>=0?'+':''}${bal.toFixed(1)} ♧/s</span><span title="Wayfinder survey progress">✦ ${Math.floor(w.survey||0)}/50</span></div></div>`;
  const host=id=>{const w=d.buildings[id].workplace;return w?` · ${d.troops[w]?.name||'Worker'} workplace`:''};
  const blurb=(id,b)=>g.locked(id)?'Unlock through the campaign':b.production?`+${b.rate*b.tiers[0].rateMultiplier} ${b.production} / second${host(id)}`:b.tiers[0].damage?`${b.tiers[0].damage} damage · ${b.tiers[0].range.toFixed(1)} tiles`:id==='barracks'?'Recruit and train people':id==='wall'?'Blocks raider paths':b.housing?`Houses ${b.housing[0]} villagers`:b.workplace?`${d.troops[b.workplace]?.name||'Worker'} workplace · assign villagers`:'Upgrade at the hall';
  this.setPanelHTML(`<div class="panel-heading"><span>MAKE ROOM TO GROW</span><span>Select, then place</span></div><div class="build-list">${Object.entries(g.data.buildings).filter(([id,b])=>id!=='hall'&&(this.category==='all'||this.category==='economy'&&b.production||this.category==='defense'&&(id==='wall'||b.tiers[0].damage)||this.category==='village'&&!b.production&&id!=='wall'&&!b.tiers[0].damage)).map(([id,b])=>`<button class="build-card ${this.renderer.placing===id?'selected':''}" data-build="${id}" ${g.locked(id)?'disabled':''}><span class="tag">${g.locked(id)?'LOCKED':b.size+' × '+b.size}</span>${img(b.tiers[0].sprite)}<strong>${b.name}</strong><span class="blurb">${blurb(id,b)}</span><span class="tiers" title="${b.tiers.length} tiers">${'●'.repeat(b.tiers.length)}</span><span class="cost ${afford(w.resources,buildingCost(id,1,w,d))?'':'short'}">${cost(buildingCost(id,1,w,d))}</span></button>`).join('')}</div><p class="cost" style="margin-top:14px">Collectors add deliveries to building production.<br>Walls block movement. Towers cover nearby tiles.<br>Complete chapter 2 to unlock spike traps.</p>`);
 }
 renderTroops(){const g=this.game,d=g.data;
  this.setPanelHTML(`<div class="panel-heading"><span>YOUR PEOPLE · ${g.world.troops.length}</span><span>Train. Equip. Defend.</span></div>${this.category==='recruit'?`<div class="recruit">${Object.entries(d.troops).map(([id,t])=>`<button data-recruit="${id}" title="${cost(t.recruitCost)}">${img(t.sprite)}+ ${t.name}<small>${cost(t.recruitCost)}</small></button>`).join('')}</div><p class="cost">Recruitment requires a finished barracks.</p>`:''}${g.world.troops.filter(u=>this.category!=='recruit'&&(this.category==='all'||this.category==='combat'&&d.troops[u.type].role==='combat'||this.category==='workers'&&d.troops[u.type].role!=='combat')).map(u=>{const s=stats(u,d),spec=d.troops[u.type],abilities=unlockedAbilities(u,d),next=Object.keys(spec.abilities).map(Number).find(n=>n>u.level);return `<article class="person-card"><div class="person-head">${img(spec.sprite)}<div><h3>${spec.name} <em class="role role-${spec.role}">${spec.role}</em></h3><small>LEVEL ${u.level} / ${spec.maxLevel}</small><div class="levelbar"><div style="width:${u.level/spec.maxLevel*100}%"></div></div></div><button data-level="${u.id}" ${u.level>=spec.maxLevel?'disabled':''}>Train ↑</button></div><div class="statline">♥ ${Math.ceil(u.hp)}/${Math.round(s.hp)} · ⚔ ${Math.round(s.damage)} · Speed ${s.speed.toFixed(2)}<br>Next level: ${cost(Object.fromEntries(Object.entries(spec.levelCost).map(([k,v])=>[k,Math.ceil(v*u.level*(u.level>=5?1.5:1))])))}</div><div class="gear-list">${Object.entries(d.items).filter(([,item])=>item.roles.includes(u.type)).map(([id,item])=>`<button data-unit="${u.id}" data-gear="${id}" class="gear ${u.gear===id?'selected':''}" title="${item.name}: ${cost(item.cost)}" ${g.locked(id)?'disabled':''}>${img(item.sprite)}${item.name}<small>${g.locked(id)?'Chapter 3':u.owned.includes(id)?u.gear===id?'Equipped':'Owned':cost(item.cost)}</small></button>`).join('')}</div>${spec.job?(()=>{const sites=g.world.buildings.filter(b=>b.type===spec.job.workplace&&b.hp>0&&b.remaining<=0);return `<div class="job">⚒ Work: <select data-assign="${u.id}"><option value="">Resting</option>${sites.map(b=>{const n=assignedWorkers(g.world,b.id).length,cap=workplaceCapacity(b,d);return `<option value="${b.id}" ${u.workplace===b.id?'selected':''} ${(n>=cap&&u.workplace!==b.id)?'disabled':''}>${d.buildings[b.type].name} ${n}/${cap}</option>`;}).join('')}</select><small>${spec.job.text}</small></div>`;})():''}<div class="ability">${abilities.map(a=>`<div title="${a.description}">✦ ${a.name}${a.active?` <button data-unit="${u.id}" data-ability="${a.id}" ${u.abilityTimer>0?'disabled':''}>${u.abilityTimer>0?Math.ceil(u.abilityTimer)+'s':'Cast'}</button>`:''}</div>`).join('')||'No abilities unlocked yet.'}${next?`<div>Level ${next} → ${d.abilities[spec.abilities[next]].name}</div>`:''}</div></article>`;}).join('')}`);
 }
 renderStory(){const g=this.game,w=g.world;
  this.setPanelHTML(`<div class="panel-heading"><span>TALES OF THE FRONTIER</span><span>${g.data.missions.length} chapters</span></div>${this.questBlock(g)}${g.data.missions.map(m=>{const current=g.state.mission?.id===m.id,completed=g.state.completed.includes(m.id),locked=!m.requires.every(id=>g.state.completed.includes(id));return `<article class="mission-card"><div class="chapter">CHAPTER ${m.chapter} ${completed?'· COMPLETE':locked?'· LOCKED':''}</div><h3>${m.name}</h3><p>${m.description}</p><div class="details">${m.objectives.map(o=>`${current?Math.floor(w.gathered[o.resource])+' / ':''}${o.amount} ${o.resource} collected${current?`<div class="progress"><div style="width:${Math.min(100,w.gathered[o.resource]/o.amount*100)}%"></div></div>`:'<br>'}`).join('')}${current?Math.max(0,Math.ceil(m.timeLimit-w.elapsed)):m.timeLimit}s ${current?'remaining':'limit'} · ${m.troopLimit} people maximum<br>${m.raids.length} scheduled raids ${m.raids.length?'· defeat every wave':''}<br>First-clear reward: ${cost(m.rewards)}<br>Unlock: ${m.unlocks.map(id=>g.data.buildings[id]?.name||g.data.items[id]?.name).join(', ')}</div>${current?`<p class="result">${g.state.mission.status==='won'?'The frontier is yours. Mission complete.':g.state.mission.status==='lost'?'The expedition was lost. Your home is safe.':'Your home village is paused during this expedition.'}</p><button class="primary" data-home="true">${g.state.mission.status==='won'?'Claim rewards & return':g.state.mission.status==='lost'?'Return home':'Abandon & return home'}</button>`:`<button class="primary" data-mission="${m.id}" ${locked||g.state.mission?'disabled':''}>${locked?'Complete the previous chapter':completed?'Replay chapter (no repeat rewards)':'Begin expedition →'}</button>`}</article>`;}).join('')}`);
 }
 questBlock(g){
  const d=g.data,done=g.state.questsCompleted||[];
  const rows=(d.quests||[]).map(q=>{const isDone=done.includes(q.id),p=questProgress(q.task,g.state),active=!isDone&&currentQuest(g.state,d)?.id===q.id;
   return `<div class="quest ${isDone?'qdone':active?'qactive':''}"><b>${isDone?'✓':active?'▶':'·'} ${q.name}</b><span>${q.text}</span><span class="qprog">${Math.min(p.have,p.need)}/${p.need} · +${q.xp} XP</span></div>`;}).join('');
  return `<div class="panel-heading"><span>VILLAGE PATH · LVL ${g.state.vlevel||1} · ${Math.floor(g.state.xp||0)} XP</span><span>${done.length}/${(d.quests||[]).length}</span></div><div class="quests">${rows}</div>`;
 }
 workLine(g,b,spec){
  const d=g.data,bits=[];
  if(spec.housing){const hh=housing(g.world,d);bits.push(`🛏 ${hh.used}/${hh.beds} beds spoken for`);}
  if(spec.workplace){const crew=g.world.troops.filter(t=>t.workplace===b.id);
   bits.push(`⚒ ${crew.map(t=>d.troops[t.type].name).join(', ')||'No hands yet — assign from the People panel'}`);}
  if(b.maxReserve){const frac=Math.round(100*Math.max(0,Math.min(1,b.reserve/b.maxReserve)));bits.push(`◈ Node ${frac}% full`);}
  return bits.length?`<br><small>${bits.join(' · ')}</small>`:'';
 }
 renderInspector(){const g=this.game,d=g.data,w=g.world,el=$('#inspector');const u=w.troops.find(t=>t.id===this.selectedTroop),b=w.buildings.find(b=>b.id===this.selected);if((!u&&!b)||this.renderer.placing||!$('#drawer').hidden){el.hidden=true;return;}el.hidden=false;
 const close='<button class="close-selection" data-action="close" aria-label="Clear selection">✕</button>';
 if(u){const spec=d.troops[u.type];el.innerHTML=`${close}<div class="inspector-head">${img(spec.sprite)}<div><span class="eyebrow">LEVEL ${u.level} · ${u.order?.kind?.toUpperCase()||'AUTO'}</span><h2>${spec.name}</h2><p>Tap ground to move · Tap an enemy to attack</p></div></div><div class="actions"><button data-action="hold">Hold position</button><button data-action="resume">Auto duties</button><button class="gold-button" data-action="gear">Equipment</button></div>`;return;}
 const spec=d.buildings[b.type],tier=spec.tiers[b.level-1],max=b.level>=spec.tiers.length,upgradeCost=b.type==='hall'?{wood:200*b.level,gold:150*b.level}:buildingCost(b.type,b.level+1,w,d),repairCost=Math.ceil((tier.hp-b.hp)/15);const hp=Math.max(0,b.hp/tier.hp);
 el.innerHTML=`${close}<div class="inspector-head">${img(tier.sprite)}<div><span class="eyebrow">TIER ${b.level} · ${b.hp<=0?'RUINED':b.remaining>0?'BUILDING':'READY'}</span><h2>${spec.name}</h2><p>♥ ${Math.ceil(b.hp)} / ${tier.hp}${b.remaining>0?` · ${Math.ceil(b.remaining)}s remaining`:spec.production?` · ${spec.rate*tier.rateMultiplier} ${spec.production}/s`:tier.damage?` · ${tier.damage} damage`:''}</p></div></div><div class="hpbar"><div style="width:${hp*100}%"></div></div><div class="actions"><button class="gold-button" data-action="upgrade" ${max||b.remaining>0||b.hp<=0||!afford(w.resources,upgradeCost)?'disabled':''}>${max?'Max tier':`Upgrade<br><small>${cost(upgradeCost)}</small>`}</button><button data-action="move" ${w.enemies.length||w.raidPending?'disabled':''}>Move</button>${b.hp<tier.hp?`<button data-action="repair" ${w.resources.wood<repairCost?'disabled':''}>Repair<br><small>${repairCost} wood</small></button>`:spec.workplace?'<button data-action="assign">Assign workers</button>':''}${spec.production&&b.harvestBonus>=1?`<button data-action="harvest">Collect +${Math.floor(b.harvestBonus)}</button>`:''}</div>`;
 }
 tick(dt){this.clock+=dt;this.toastTime=Math.max(0,this.toastTime-dt);if(this.toastTime===0)$('#status').classList.remove('show');if(this.game.dirty||this.clock>.5){this.clock=0;this.refresh();}}
}
