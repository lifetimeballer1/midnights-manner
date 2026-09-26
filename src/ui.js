import {stats,unlockedAbilities,buildingCost} from './model.js';
import {loadGuide,updateGuide,skipGuide} from './systems/tutorial.js';
import {sfx,isMuted,toggleMute} from './systems/audio.js';
const icons={wood:'▰',food:'♧',gold:'◆'};
const cost=c=>Object.entries(c).map(([k,v])=>`${icons[k]} ${Math.ceil(v)} ${k}`).join(' · ')||'Included';
const img=name=>`<img src="./assets/sprites/${name}" alt="">`;
export class UI {
 constructor(game,renderer){this.game=game;this.renderer=renderer;this.tab='build';this.selected=null;this.clock=0;this.panel=document.querySelector('#panel');this.guide=loadGuide();this.prevRes={...game.world.resources};this.bind();this.refresh();}
 bind(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{this.tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(t=>t.classList.toggle('active',t===b));this.refresh();});
  document.querySelector('#pause').onclick=()=>{this.game.paused=!this.game.paused;document.querySelector('#pause').textContent=this.game.paused?'▶ Resume':'Ⅱ Pause';};
  document.querySelector('#save').onclick=()=>{if(this.game.persist())this.game.notify('Village saved on this browser.');this.refresh();};
  document.querySelector('#grid').onclick=()=>{this.renderer.grid=!this.renderer.grid;};
  document.querySelector('#cancel').onclick=()=>this.cancel();
  const sound=document.querySelector('#sound');if(sound){sound.textContent=isMuted()?'🔇 Sound':'🔊 Sound';sound.onclick=()=>{sound.textContent=toggleMute()?'🔇 Sound':'🔊 Sound';};}
  const guideEl=document.querySelector('#guide');if(guideEl)guideEl.onclick=e=>{if(e.target.closest('[data-skip]')){skipGuide(this.guide);this.refresh();}};
  const overlay=document.querySelector('#raid-overlay');if(overlay)overlay.onclick=e=>{const b=e.target.closest('button');if(!b)return;
   if(b.dataset.repairAll)this.game.repairAll();
   if(b.dataset.repairAll||b.dataset.dismiss){this.game.world.raidResult=null;}
   this.refresh();};
  document.querySelector('#inspector').onclick=e=>{const b=e.target.closest('button');if(!b)return;const action=b.dataset.action;if(b.id==='raid')this.game.raid();else if(action==='upgrade')this.game.upgrade(this.selected);else if(action==='repair')this.game.repair(this.selected);else if(action==='move'){const selected=this.game.world.buildings.find(b=>b.id===this.selected);if(selected){this.renderer.moving=selected.id;this.renderer.placing=selected.type;this.placementHint();}}this.refresh();};
  this.panel.onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
   if(b.dataset.build){this.renderer.placing=b.dataset.build;this.renderer.moving=null;this.renderer.grid=true;this.placementHint();}
   if(b.dataset.recruit)this.game.recruit(b.dataset.recruit);
   if(b.dataset.level)this.game.level(b.dataset.level);
   if(b.dataset.gear)this.game.equip(b.dataset.unit,b.dataset.gear);
   if(b.dataset.ability)this.game.ability(b.dataset.unit,b.dataset.ability);
   if(b.dataset.mission){this.cancel();this.selected=null;this.renderer.selection=null;this.game.mission(b.dataset.mission);}
   if(b.dataset.home){this.cancel();this.selected=null;this.renderer.selection=null;this.game.returnHome();}
   this.refresh();
  };
 }
 cancel(){this.renderer.placing=null;this.renderer.moving=null;this.placementHint();this.refresh();}
 placementHint(){const type=this.renderer.placing;document.querySelector('#cancel').hidden=!type;document.querySelector('#placement-hint').textContent=type?`${this.renderer.moving?'Move':'Place'} ${this.game.data.buildings[type].name} · choose a tile · Esc cancels`:'Tap a building to inspect it';}
 selectCell(cell){
  const r=this.renderer,g=this.game;
  if(r.placing){if(r.moving){if(g.relocate(r.moving,cell.x,cell.y))this.cancel();}else{const b=g.build(r.placing,cell.x,cell.y);if(b){this.selected=b.id;r.selection=b.id;}}}
  else{const b=g.world.buildings.find(b=>cell.x>=b.x&&cell.x<b.x+g.data.buildings[b.type].size&&cell.y>=b.y&&cell.y<b.y+g.data.buildings[b.type].size);this.selected=b?.id;r.selection=b?.id;}
  sfx.click();
  this.refresh();
 }
 refresh(){
  const g=this.game,w=g.world,d=g.data;
  const gained={};for(const k of ['wood','food','gold']){gained[k]=Math.floor(w.resources[k])>Math.floor(this.prevRes[k]??0);}
  this.prevRes={...w.resources};
  document.querySelector('#resources').innerHTML=Object.entries(w.resources).map(([key,value])=>`<div class="resource${value<30?' low':''}${gained[key]?' gain':''}" title="${value<30?'Running low — gather more':key}"><span class="symbol">${icons[key]}</span><div><b>${Math.floor(value).toLocaleString()}</b><small>${key.toUpperCase()}</small></div></div>`).join('');
  document.body.classList.toggle('raid-active',w.enemies.length>0||!!w.raidPending);
  document.querySelector('#status').textContent=g.message;
  document.querySelector('#day').textContent=w.raidPending?`⚠ ${w.raidPending.count} raiders incoming…`:`Day ${Math.floor(w.elapsed/180)+1} · ${w.enemies.length?`⚔ ${w.enemies.length} left · ${w.raidKills??0} slain`:g.state.mission?'Expedition':'Homestead'}`;
  const hint=g.state.mission?null:updateGuide(this.guide,g);
  const guideEl=document.querySelector('#guide');
  if(guideEl){if(hint){guideEl.hidden=false;guideEl.innerHTML=`<span class="guide-step">${hint.index+1}/${hint.total}</span><span>${hint.text}</span><button data-skip="true" title="Hide this guide">Skip ×</button>`;}else guideEl.hidden=true;}
  document.querySelector('#world-title').innerHTML=g.state.mission?d.missions.find(m=>m.id===g.state.mission.id).name:'A small beginning.<br>A world of your own.';
  document.querySelector('#chapter-count').textContent=`${g.state.completed.length}/${d.missions.length}`;
  const scroll=this.panel.scrollTop;
  if(this.tab==='build')this.renderBuild();else if(this.tab==='troops')this.renderTroops();else this.renderStory();
  this.panel.scrollTop=scroll;this.renderInspector();this.renderRaidOverlay();g.dirty=false;
 }
 renderRaidOverlay(){const g=this.game,w=g.world,el=document.querySelector('#raid-overlay');if(!el)return;
  const r=w.raidResult;
  if(!r||w.enemies.length||w.raidPending||g.state.mission){el.hidden=true;el.innerHTML='';return;}
  el.hidden=false;
  el.innerHTML=`<div class="raid-card ${r.won?'won':'lost'}" role="dialog" aria-label="Raid result"><div class="eyebrow">${r.won?'VICTORY':'DEFEAT'} · WAVE ${w.wave}</div><h2>${r.won?'The village stands!':'The manor has fallen.'}</h2><div class="raid-stats"><div><span>⚔ Raiders slain</span><b>${r.kills}</b></div><div><span>◆ Gold loot</span><b>+${r.loot}</b></div><div><span>🔨 Buildings damaged</span><b>${r.damaged?`${r.damaged} · ${r.repairWood} wood to fix`:'None'}</b></div></div><div class="actions"><button class="primary" data-repair-all="true" ${r.damaged&&w.resources.wood>=r.repairWood?'':'disabled'}>Repair all · ${r.repairWood} wood</button><button data-dismiss="true">Back to the village</button></div></div>`;
 renderBuild(){const g=this.game;
  const blurb=(id,b)=>g.locked(id)?'Finish the story to unlock':b.production?`+${b.rate*b.tiers[0].rateMultiplier} ${b.production} / second`:b.tiers[0].damage?`${b.tiers[0].damage} damage · ${b.tiers[0].range.toFixed(1)} tiles`:id==='barracks'?'Recruit and train people':id==='wall'?'Blocks raider paths':'Upgrade at the hall';
  this.panel.innerHTML=`<div class="panel-heading"><span>MAKE ROOM TO GROW</span><span>Select, then place</span></div><div class="build-list">${Object.entries(g.data.buildings).filter(([id])=>id!=='hall').map(([id,b])=>`<button class="build-card ${this.renderer.placing===id?'selected':''}" data-build="${id}" ${g.locked(id)?'disabled':''}><span class="tag">${g.locked(id)?'LOCKED':b.size+' × '+b.size}</span>${img(b.tiers[0].sprite)}<strong>${b.name}</strong><span class="blurb">${blurb(id,b)}</span><span class="tiers" title="${b.tiers.length} tiers">${'●'.repeat(b.tiers.length)}</span><span class="cost">${cost(buildingCost(id,1,g.world,g.data))}</span></button>`).join('')}</div><p class="cost" style="margin-top:14px">Collectors add deliveries to building production.<br>Walls block movement. Towers cover nearby tiles.<br>Complete chapter 2 to unlock spike traps.</p>`;
 }
 renderTroops(){const g=this.game,d=g.data;
  this.panel.innerHTML=`<div class="panel-heading"><span>YOUR PEOPLE · ${g.world.troops.length}</span><span>Train. Equip. Defend.</span></div><div class="recruit">${Object.entries(d.troops).map(([id,t])=>`<button data-recruit="${id}" title="${cost(t.recruitCost)}">+ ${t.name}</button>`).join('')}</div><p class="cost">Recruit: 35 food + 20 gold · Requires barracks</p>${g.world.troops.map(u=>{const s=stats(u,d),spec=d.troops[u.type],abilities=unlockedAbilities(u,d),next=Object.keys(spec.abilities).map(Number).find(n=>n>u.level);return `<article class="person-card"><div class="person-head">${img(spec.sprite)}<div><h3>${spec.name} <em class="role role-${spec.role}">${spec.role}</em></h3><small>LEVEL ${u.level} / ${spec.maxLevel}</small><div class="levelbar"><div style="width:${u.level/spec.maxLevel*100}%"></div></div></div><button data-level="${u.id}" ${u.level>=spec.maxLevel?'disabled':''}>Train ↑</button></div><div class="statline">♥ ${Math.ceil(u.hp)}/${Math.round(s.hp)} · ⚔ ${Math.round(s.damage)} · Speed ${s.speed.toFixed(2)}<br>Next level: ${cost(Object.fromEntries(Object.entries(spec.levelCost).map(([k,v])=>[k,v*u.level])))}</div><div class="gear-list">${Object.entries(d.items).filter(([,item])=>item.roles.includes(u.type)).map(([id,item])=>`<button data-unit="${u.id}" data-gear="${id}" class="gear ${u.gear===id?'selected':''}" title="${item.name}: ${cost(item.cost)}" ${g.locked(id)?'disabled':''}>${img(item.sprite)}${item.name}<small>${g.locked(id)?'Chapter 3':u.owned.includes(id)?u.gear===id?'Equipped':'Owned':cost(item.cost)}</small></button>`).join('')}</div><div class="ability">${abilities.map(a=>`<div title="${a.description}">✦ ${a.name}${a.active?` <button data-unit="${u.id}" data-ability="${a.id}" ${u.abilityTimer>0?'disabled':''}>${u.abilityTimer>0?Math.ceil(u.abilityTimer)+'s':'Cast'}</button>`:''}</div>`).join('')||'No abilities unlocked yet.'}${next?`<div>Level ${next} → ${d.abilities[spec.abilities[next]].name}</div>`:''}</div></article>`;}).join('')}`;
 }
 renderStory(){const g=this.game,w=g.world;
  this.panel.innerHTML=`<div class="panel-heading"><span>TALES OF THE FRONTIER</span><span>${g.data.missions.length} chapters</span></div>${g.data.missions.map(m=>{const current=g.state.mission?.id===m.id,completed=g.state.completed.includes(m.id),locked=!m.requires.every(id=>g.state.completed.includes(id));return `<article class="mission-card"><div class="chapter">CHAPTER ${m.chapter} ${completed?'· COMPLETE':locked?'· LOCKED':''}</div><h3>${m.name}</h3><p>${m.description}</p><div class="details">${m.objectives.map(o=>`${current?Math.floor(w.gathered[o.resource])+' / ':''}${o.amount} ${o.resource} collected${current?`<div class="progress"><div style="width:${Math.min(100,w.gathered[o.resource]/o.amount*100)}%"></div></div>`:'<br>'}`).join('')}${current?Math.max(0,Math.ceil(m.timeLimit-w.elapsed)):m.timeLimit}s ${current?'remaining':'limit'} · ${m.troopLimit} people maximum<br>${m.raids.length} scheduled raids ${m.raids.length?'· defeat every wave':''}<br>First-clear reward: ${cost(m.rewards)}<br>Unlock: ${m.unlocks.map(id=>g.data.buildings[id]?.name||g.data.items[id]?.name).join(', ')}</div>${current?`<p class="result">${g.state.mission.status==='won'?'The frontier is yours. Mission complete.':g.state.mission.status==='lost'?'The expedition was lost. Your home is safe.':'Your home village is paused during this expedition.'}</p><button class="primary" data-home="true">${g.state.mission.status==='won'?'Claim rewards & return':g.state.mission.status==='lost'?'Return home':'Abandon & return home'}</button>`:`<button class="primary" data-mission="${m.id}" ${locked||g.state.mission?'disabled':''}>${locked?'Complete the previous chapter':completed?'Replay chapter (no repeat rewards)':'Begin expedition →'}</button>`}</article>`;}).join('')}`;
 }
 renderInspector(){const g=this.game,b=g.world.buildings.find(b=>b.id===this.selected),el=document.querySelector('#inspector');
  if(!b){el.innerHTML='<div><span class="eyebrow">YOUR HOMESTEAD</span><h2>Make yourself at home.</h2><p>Farms feed your people. Timber builds your future. Keep the manor standing.</p></div><button id="raid" class="primary">Test your defenses ⚔</button>';return;}
  const spec=g.data.buildings[b.type],tier=spec.tiers[b.level-1],max=b.level===spec.tiers.length;
  const upgradeCost=b.type==='hall'?{wood:200*b.level,gold:150*b.level}:buildingCost(b.type,b.level+1,g.world,g.data);
  const hpFrac=Math.max(0,Math.min(1,b.hp/tier.hp));
  const why=max?'Highest tier reached.':b.remaining>0?'Builders are on it — wait for construction.':b.hp<=0?'Repair the ruins before upgrading.':`Tier ${b.level} of ${spec.tiers.length} · ${'●'.repeat(b.level)}${'○'.repeat(spec.tiers.length-b.level)}`;
  el.innerHTML=`<div><span class="eyebrow">TIER ${b.level} OF ${spec.tiers.length} · ${b.remaining>0?'UNDER CONSTRUCTION':b.hp<=0?'DESTROYED':'VILLAGE BUILDING'}</span><h2>${spec.name}</h2><div class="hpbar hpbar-inspector"><div style="width:${hpFrac*100}%"></div></div><p>♥ ${Math.ceil(b.hp)} / ${tier.hp}${spec.production?` · +${spec.rate*tier.rateMultiplier} ${spec.production} / second`:tier.damage?` · ${tier.damage} damage · ${tier.range.toFixed(1)} range`:''}<br>${max?'Highest tier reached.':`Upgrade: ${cost(upgradeCost)}`}${b.hp<=0?'<br>Destroyed buildings produce nothing until repaired.':''}<br><small>${why}</small></p></div><div class="actions"><button class="primary" data-action="upgrade" ${max||b.remaining>0||b.hp<=0?'disabled':''}>Upgrade ↑</button><button data-action="move" ${g.world.enemies.length?'disabled':''}>Move</button><button data-action="repair" ${b.hp>=tier.hp?'disabled':''}>Repair · ${Math.ceil((tier.hp-b.hp)/15)} wood</button></div>`;
 }
 tick(dt){this.clock+=dt;if(this.game.dirty||this.clock>.65){this.clock=0;this.refresh();}}
}
