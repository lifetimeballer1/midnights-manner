import {researchPanel} from './research-ui.js';
import {factionFor} from './systems/tactics.js';
import {resourceInfo,collectionTotals,reserveCollectible} from './resources.js';
import {wallRowQuote,isWall,placementCells} from './systems/walls.js';
import {raidSides} from './systems/combat.js';
import {stats,unlockedAbilities,buildingCost,housing,XP_LEVELS,center,assignedWorkers,workplaceCapacity,canPlace,afford,promotionOptions} from './model.js';
import {currentQuest,questProgress,growthStatus} from './systems/village.js';
import {exportSave,importSaveBlob} from './storage.js';
import {pickRumor,pickLegend,daySeed} from './systems/story.js';
import {dayKey,seasonFor,modifierFor,dealsFor,marketOpen,tradeCap,describeDeal} from './systems/calendar.js';
import {describeClock} from './systems/daynight.js';
import {expeditionStatus} from './systems/expeditions.js';
import {renownCost,renownAvailable,paragonEligible,paragonCost,buildingMaxHp} from './systems/endgame.js';
import {TRAITS, isIdle, idleWorkers, scorePost} from './systems/villagers.js';
import {itemRarity, RARITY_INFO, stockCount} from './systems/crafting.js';
import {ADVENTURE_LABELS, campaignCards, expeditionRoster, homeSummary, questCards, taskHint} from './adventure.js';
import {missionObjectiveProgress} from './systems/campaign.js';
import {sfx,isMuted,toggleMute} from './systems/audio.js';
const icons={wood:'▰',food:'♧',gold:'◆',frostwood:'❄',plate:'▣',lumber:'▤',flour:'❀',bread:'◉'};
const cost=c=>Object.entries(c).map(([k,v])=>`${icons[k]} ${Math.ceil(v)} ${k}`).join(' · ')||'Included';
const img=name=>`<img src="./assets/sprites/${name}" alt="">`;
const rarTag=item=>{const r=itemRarity(item);return r==='common'?'':` <em class="rarity" style="color:${RARITY_INFO[r].color}">· ${RARITY_INFO[r].name}</em>`;};
const $=s=>document.querySelector(s);
export class UI {
 constructor(game,renderer,music){this.game=game;this.renderer=renderer;this.music=music;this.tab='build';this.category='all';this.expandMode=false;this.selected=null;this.selectedTroop=null;this.clock=0;this.panel=$('#panel');this.lastMessage='';this.toastTime=0;this.lastPanel='';this.lastRail='';this.lastResult='';this.lastOverview='';this.started=false;this.game.paused=true;this.bind();this.refresh();}
 blocked(){return !this.started||this.game.paused||!$('#drawer').hidden||!$('#raid-overlay').hidden||!$('#map-overview').hidden;}
 bind(){
  // Keep controls mounted between press and click, including slow touch taps.
  this.controlPressed=false;
  document.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,select'))this.controlPressed=true;},true);
  const release=()=>setTimeout(()=>{this.controlPressed=false;},0);
  document.addEventListener('pointerup',release,true);
  document.addEventListener('pointercancel',release,true);
  window.addEventListener('blur',()=>{this.controlPressed=false;});
  $('#begin').onclick=()=>{this.started=true;this.music.start({calm:this.renderer.calm});$('#title').hidden=true;this.game.paused=false;this.renderer.fitVillage(this.game.world);$('#world').focus({preventScroll:true});this.game.notify('Your village awaits. Drag to explore; pinch to zoom.');this.refresh();};
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>this.openPanel(b.dataset.tab));
  $('#close-panel').onclick=()=>this.closePanel();$('#drawer-backdrop').onclick=()=>this.closePanel();
  $('#quest-chip').onclick=()=>{this.openPanel('story');this.category='quests';this.lastPanel='';this.renderFilters();this.refresh();};
  $('#resources').onclick=e=>{if(e.target.closest('[data-resource]'))this.openPanel('resources');};
  $('#panel-search').oninput=e=>{this.search=e.target.value.trim().toLowerCase();this.lastPanel='';this.refresh();};
  $('#panel-filters').onclick=e=>{const button=e.target.closest('[data-category]');if(!button)return;this.category=button.dataset.category;this.lastPanel='';this.renderFilters();this.refresh();};
  $('#pause').onclick=()=>this.openPause();$('#resume').onclick=()=>this.closePause();
  try{if(localStorage.getItem('midnights-manner-calm')==='on')this.renderer.calm=true;}catch{}
  $('#pause-overlay').onclick=e=>{const b=e.target.closest('button');if(!b)return;
   if(b.id==='opt-sound'){toggleMute();this.music.setEnabled(!isMuted());this.syncPause();}
   if(b.id==='opt-motion'){this.renderer.calm=!this.renderer.calm;this.music.setCalm(this.renderer.calm);try{localStorage.setItem('midnights-manner-calm',this.renderer.calm?'on':'off');}catch{}this.syncPause();}
   if(b.id==='opt-grid'){this.renderer.grid=!this.renderer.grid;this.syncPause();}
   if(b.id==='opt-save'){if(this.game.persist())this.game.notify('Saved on this browser.');}
   if(b.id==='opt-export'){const blob=exportSave(this.game.state);if(!blob){this.game.notify('Export failed in this browser.');}else{const label='village save v'+(this.game.state.version||2);try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(blob).then(()=>{this.game.notify('Village copied ('+label+'). Paste it into Import on your other device.');this.refresh();},()=>{window.prompt('Copy your '+label+' (Ctrl+C, Enter):',blob);});}else{window.prompt('Copy your '+label+' (Ctrl+C, Enter):',blob);}}catch{window.prompt('Copy your '+label+' (Ctrl+C, Enter):',blob);}}this.refresh();}
   if(b.id==='opt-import'){const text=window.prompt('Paste a village save (Export on your other device):','');if(text==null)return;const result=importSaveBlob(text,this.game.data);if(!result.ok){this.game.notify('Import failed: '+result.error);this.refresh();return;}this.game.importState(result.state);this.cancel();this.closePause();this.refresh();}
   if(b.id==='fullscreen'){if(document.fullscreenElement)document.exitFullscreen?.();else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>this.game.notify('Use Add to Home Screen for full-screen play.'));else this.game.notify('On iPhone: Safari → Share → Add to Home Screen.');}
   if(b.id==='help')$('#controls-recap').classList.toggle('help-highlight');this.refresh();
  };
  $('#camera-menu').onclick=()=>{const p=$('#camera-panel');p.hidden=!p.hidden;$('#camera-menu').setAttribute('aria-expanded',String(!p.hidden));};
  $('#camera-close').onclick=()=>{$('#camera-panel').hidden=true;$('#camera-menu').setAttribute('aria-expanded','false');};
  $('#map-overview-button').onclick=()=>this.openOverview();
  $('#map-overview-close').onclick=()=>this.closeOverview();$('#map-overview-backdrop').onclick=()=>this.closeOverview();
  $('#map-overview-grid').onclick=e=>{const b=e.target.closest('[data-map-region]');if(!b)return;const region=this.game.data.expansion?.regions?.find(r=>r.id===b.dataset.mapRegion),q=region?.rect;if(!q)return;this.renderer.cam.x=q.x+q.w/2;this.renderer.cam.y=q.y+q.h/2;const target=Math.max(.9,Math.min(1.5,9/Math.max(q.w,q.h)));this.renderer.zoomBy(target/this.renderer.cam.zoom);this.closeOverview();this.game.notify(`${region.name} centered on the map.`);};
  $('#orbit-mode').onclick=()=>{this.renderer.orbitMode=!this.renderer.orbitMode;this.syncCamera();};
  $('#turn-left').onclick=()=>{this.renderer.orbit(-Math.PI/8);this.syncCamera();};
  $('#turn-right').onclick=()=>{this.renderer.orbit(Math.PI/8);this.syncCamera();};
  $('#camera-tilt').oninput=e=>{this.renderer.cam.pitch=Number(e.target.value)*Math.PI/180;};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{this.renderer.cam.pitch=({low:22,classic:31,top:78}[b.dataset.view])*Math.PI/180;this.syncCamera();});
  $('#camera-reset').onclick=()=>{this.renderer.resetView();this.renderer.fitVillage(this.game.world);this.renderer.orbitMode=false;this.syncCamera();};
  $('#grid').onclick=()=>{this.renderer.grid=!this.renderer.grid;$('#grid').setAttribute('aria-pressed',String(this.renderer.grid));};
  $('#zoom-in').onclick=()=>this.renderer.zoomBy(1.18);$('#zoom-out').onclick=()=>this.renderer.zoomBy(1/1.18);$('#recenter').onclick=()=>this.renderer.fitVillage(this.game.world);
  $('#cancel').onclick=()=>this.cancel();$('#confirm-place').onclick=()=>this.confirmPlacement();
  $('#raid').onclick=()=>{this.closePanel();this.cancel();if(this.game.state.mission){this.openPanel('story');return;}this.game.raid();this.refresh();};
  $('#army-rail').onclick=e=>{const b=e.target.closest('[data-select-unit]');if(b)this.selectTroop(b.dataset.selectUnit);};
  $('#inspector').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const action=b.dataset.action;
   if(action==='close'){this.clearSelection();return;}
   if(action==='upgrade-row')this.game.upgradeWallRow(this.selected,b.dataset.axis);
   if(action==='upgrade')this.game.upgrade(this.selected);
   if(action==='reinforce')this.game.reinforce(this.selected);
   if(action==='renown')this.game.raiseRenown();
   if(action==='repair')this.game.repair(this.selected);
   if(action==='hold'&&this.selectedTroop)this.game.commandHold(this.selectedTroop);
   if(action==='resume'&&this.selectedTroop)this.game.clearOrder(this.selectedTroop);
   if(action==='expedition'&&this.selectedTroop)this.game.sendExpedition(this.selectedTroop);
   if(action==='gear'){this.openPanel('troops');return;}
   if(action==='harvest')this.game.harvest(this.selected);
   if(action==='service')this.game.serviceArmor();
   if(action==='craft'){this.game.startCraft(this.selected,b.dataset.item);}
   if(action==='move'){const selected=this.game.world.buildings.find(b=>b.id===this.selected);if(selected){this.startPlacement(selected.type,selected.id);return;}}
   if(action==='assign'){const id=this.selected;this.workplaceId=id;this.openPanel('workplace');return;}
   this.refresh();
  };
  this.panel.onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
   if(b.dataset.frontierChoice){this.game.frontierChoice(b.dataset.frontierChoice);this.lastPanel='';this.refresh();return;}
   if(b.dataset.collect){this.game.harvest(b.dataset.collect);this.refresh();return;}
   if(b.dataset.collectAll){this.game.collectAll();this.refresh();return;}
   if(b.dataset.expandToggle||b.dataset.expandRegion){const target=b.dataset.expandRegion||null,on=target?true:!this.expandMode;this.cancel();this.expandMode=on;if(on){if(target){const region=this.game.data.expansion?.regions?.find(r=>r.id===target),p=region?.landmark||region?.rect&&{x:region.rect.x+region.rect.w/2,y:region.rect.y+region.rect.h/2};if(p){this.renderer.cam.x=p.x;this.renderer.cam.y=p.y;this.renderer.grid=true;}this.game.notify(`Expand mode — ${region?.landmark?.name||region?.name||'the destination'} is centered. Claim a bordering wild region to reach it.`);}else this.game.notify('Expand mode — tap a wild tile beside your land to claim it. Tap Expand again to stop.');this.closePanel();this.closeSelectionOnly();}this.lastPanel='';this.refresh();return;}
   if(b.dataset.build){this.startPlacement(b.dataset.build);return;}
   if(b.dataset.recruit)this.game.recruit(b.dataset.recruit,b.dataset.workplace||null);
   if(b.dataset.staff)this.game.assign(b.dataset.staff,this.workplaceId);
   if(b.dataset.release)this.game.assign(b.dataset.release,null);
   if(b.dataset.autoassign){const placed=this.game.autoAssignIdle();if(placed)this.lastPanel='';this.refresh();return;}
   if(b.dataset.level)this.game.level(b.dataset.level);
   if(b.dataset.gear)this.game.equip(b.dataset.unit,b.dataset.gear);
   if(b.dataset.promoteUnit)this.game.promote(b.dataset.promoteUnit,b.dataset.promoteTo);
   if(b.dataset.prestige)this.game.prestige(b.dataset.prestige);
   if(b.dataset.oath)this.game.takeOath(b.dataset.oath);
   if(b.dataset.reforge)this.game.reforge(b.dataset.reforge);
   if(b.dataset.ability)this.game.ability(b.dataset.unit,b.dataset.ability);
   if(b.dataset.goto){this.category=b.dataset.goto;this.lastPanel='';this.renderFilters();this.refresh();return;}
   if(b.dataset.expedition){this.game.sendExpedition(b.dataset.expedition);this.lastPanel='';this.refresh();return;}
   if(b.dataset.mission){this.cancel();this.clearSelection();this.game.mission(b.dataset.mission);if(this.game.state.mission){this.closePanel();this.renderer.fitVillage(this.game.world);}}
   if(b.dataset.research)this.game.research(b.dataset.research);
   if(b.dataset.trade){this.game.trade(b.dataset.trade);}
   if(b.dataset.friendName){const inp=$('#friend-username');const name=(inp?.value||'').trim();if(name){this.game.setUsername(name);}this.lastPanel='';this.refresh();return;}
   if(b.dataset.friendAdd){const u=$('#friend-add-name')?.value||'',c=$('#friend-add-code')?.value||'';this.game.addFriend(u,c);this.lastPanel='';this.refresh();return;}
   if(b.dataset.friendDrop){this.game.dropFriend(b.dataset.friendDrop);this.lastPanel='';this.refresh();return;}
   if(b.dataset.giftTo){const card=b.closest('[data-friend-card]');const res=card?.querySelector('select[data-gift-res]')?.value||'wood';const amt=card?.querySelector('input[data-gift-amt]')?.value||10;this.game.sendGift(b.dataset.giftTo,res,amt);this.lastPanel='';this.refresh();return;}
   if(b.dataset.helpTo){const rising=this.game.world.buildings.find(x=>x.remaining>0);if(!rising){this.game.notify('No scaffold rises right now — your echo waits for the next build.');this.refresh();return;}this.game.sendHelp(b.dataset.helpTo,rising.id);this.lastPanel='';this.refresh();return;}
   if(b.dataset.cloudSync){b.disabled=true;b.textContent='Sending…';this.game.syncCloud().then(r=>{this.lastPanel='';if(r.ok)this.game.notify('Village rests on the cloud shelf.');else if(r.offline)this.game.notify('Cloud is not set up — the village stays safe on this browser. See docs/MULTIPLAYER_SETUP.md.');else this.game.notify('Cloud hiccup: '+(r.error||'unknown')+'. Local save is safe.');this.refresh();});return;}
   if(b.dataset.cloudVisit){const code=$('#friend-visit-code')?.value||'';b.disabled=true;b.textContent='Traveling…';import('./cloud.js').then(async cloud=>{this.lastPanel='';if(!cloud.configured()){this.game.notify('Cloud is not set up — visits light up after setup (docs/MULTIPLAYER_SETUP.md).');this.refresh();return;}const r=await cloud.visitVillage(code);if(!r.ok){this.game.notify(r.offline?'No road right now — the village stays local.':r.error);this.refresh();return;}const p=r.data?.public||r.data;this.visitSnapshot=p;this.refresh();});return;}
   if(b.dataset.home){this.game.returnHome();this.cancel();this.clearSelection();this.closePanel();this.renderer.fitVillage(this.game.world);}
   this.lastPanel='';this.refresh();
  };
  this.panel.onchange=e=>{const select=e.target.closest('select[data-assign]');if(select){this.game.assign(select.dataset.assign,select.value||null);this.refresh();}};
  $('#raid-overlay').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.repairAll)this.game.repairAll();if(b.dataset.home){this.game.returnHome();this.renderer.fitVillage(this.game.world);}if(b.dataset.dismiss||b.dataset.repairAll)this.game.world.raidResult=null;this.refresh();};
 $('#battle-hud').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.home){this.game.returnHome();this.cancel();this.clearSelection();this.closePanel();this.renderer.fitVillage(this.game.world);}this.lastPanel='';this.refresh();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#pause-overlay').hidden)this.closePause();else if(!$('#map-overview').hidden)this.closeOverview();else if(!$('#drawer').hidden)this.closePanel();else this.cancel();}if(e.key==='Tab')this.trapFocus(e);});
 }
 trapFocus(e){const container=!$('#title').hidden?$('#title'):!$('#pause-overlay').hidden?$('#pause-overlay'):!$('#raid-overlay').hidden?$('#raid-overlay'):!$('#map-overview').hidden?$('#map-overview'):!$('#drawer').hidden?$('#drawer'):null;if(!container)return;const items=[...container.querySelectorAll('button:not(:disabled),select,input')].filter(el=>el.getClientRects().length);if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||!container.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!container.contains(document.activeElement))){e.preventDefault();first.focus();}}
 openPanel(tab){if(!this.started||this.game.paused)return;this.cancel();this.tab=tab;this.category=tab==='story'?'home':'all';this.search='';$('#panel-search').value='';$('#panel-search-wrap').hidden=!['build','troops'].includes(tab);$('#panel-search').placeholder=tab==='build'?'Find a building…':'Find a person or profession…';this.panel.scrollTop=0;this.lastPanel='';this.closeSelectionOnly();$('#drawer').hidden=false;$('#drawer-backdrop').hidden=false;document.body.classList.add('drawer-open');const titles={build:['VILLAGE WORKSHOP','Build your village'],troops:['YOUR PEOPLE','Army & people'],workplace:['WORKPLACE','Manage this job'],story:['BEYOND THE TREELINE','Adventure'],resources:['THE VILLAGE STORES','Resources'],friends:['THE OPEN ROADS','Friends & visits']};$('#panel-kicker').textContent=titles[tab][0];$('#panel-title').textContent=titles[tab][1];document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-expanded',String(b.dataset.tab===tab));});this.renderFilters();this.refresh();$('#close-panel').focus({preventScroll:true});sfx.click();}
 closePanel(){const wasOpen=!$('#drawer').hidden;$('#drawer').hidden=true;$('#drawer-backdrop').hidden=true;document.body.classList.remove('drawer-open');document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-expanded','false');});if(wasOpen)$('#world').focus({preventScroll:true});}
 renderFilters(){const filters=this.tab==='build'?[['all','All'],['economy','Resources'],['defense','Defenses'],['village','Village & jobs']]:this.tab==='troops'?[['all','Everyone'],['combat','Fighters'],['workers','Workers'],['recruit','Recruit']]:this.tab==='story'?[['home',ADVENTURE_LABELS.home],['quests',ADVENTURE_LABELS.quests],['expeditions',ADVENTURE_LABELS.expeditions],['chapters',ADVENTURE_LABELS.chapters],['lore',ADVENTURE_LABELS.lore]]:[];$('#panel-filters').hidden=!filters.length;$('#panel-filters').innerHTML=filters.map(([id,label])=>`<button data-category="${id}" class="${id===this.category?'active':''}" aria-pressed="${id===this.category}">${label}</button>`).join('');}
 openPause(){if(!this.started)return;this.closePanel();this.cancel();this.game.paused=true;$('#pause-overlay').hidden=false;this.syncPause();$('#resume').focus();}
 closePause(){this.game.paused=false;$('#pause-overlay').hidden=true;$('#world').focus({preventScroll:true});this.refresh();}
 syncCamera(){const r=this.renderer;$('#orbit-mode').textContent=`Orbit: ${r.orbitMode?'on':'off'}`;$('#orbit-mode').setAttribute('aria-pressed',String(r.orbitMode));$('#camera-heading').textContent=`${Math.round((r.cam.yaw||0)*180/Math.PI)}°`;if(document.activeElement!==$('#camera-tilt'))$('#camera-tilt').value=Math.round((r.cam.pitch||.536)*180/Math.PI);document.body.classList.toggle('orbit-mode',r.orbitMode);}
 openOverview(){if(!this.started||this.game.paused)return;this.closePanel();this.cancel();$('#camera-panel').hidden=true;$('#camera-menu').setAttribute('aria-expanded','false');$('#map-overview-backdrop').hidden=false;$('#map-overview').hidden=false;this.lastOverview='';this.renderOverview();$('#map-overview-close').focus({preventScroll:true});sfx.click();}
 closeOverview(){const open=!$('#map-overview').hidden;$('#map-overview').hidden=true;$('#map-overview-backdrop').hidden=true;this.lastOverview='';if(open)$('#world').focus({preventScroll:true});}
 renderOverview(){const root=$('#map-overview');if(!root||root.hidden)return;const w=this.game.world,d=this.game.data,W=d.world.width,H=d.world.height,regions=d.expansion?.regions||[],claimed=new Set((w.tiles||[]).filter(t=>t.claimed===true).map(t=>t.x+','+t.y));let full=0;const cards=regions.map(region=>{const q=region.rect;if(!q)return '';let owned=0;for(let y=q.y;y<q.y+q.h;y++)for(let x=q.x;x<q.x+q.w;x++)if(claimed.has(x+','+y))owned++;const total=q.w*q.h,state=owned===total?'claimed':owned?'partial':'wild';if(state==='claimed')full++;let buildings=0;for(const b of w.buildings){const spec=d.buildings[b.type],cx=b.x+(spec?.size||1)/2,cy=b.y+(spec?.size||1)/2;if(cx>=q.x&&cy>=q.y&&cx<q.x+q.w&&cy<q.y+q.h)buildings++;}const active=this.renderer.cam.x>=q.x&&this.renderer.cam.y>=q.y&&this.renderer.cam.x<q.x+q.w&&this.renderer.cam.y<q.y+q.h,label=q.w>=10&&q.h>=8?region.name:q.w>=10?region.name.split(' ')[0]:'';return `<button class="frontier-region ${state} ${active?'active':''}" data-map-region="${region.id}" style="left:${q.x/W*100}%;top:${q.y/H*100}%;width:${q.w/W*100}%;height:${q.h/H*100}%" aria-label="${region.name}: ${state}, ${owned} of ${total} tiles owned, ${buildings} buildings" title="${region.name} · ${state} · ${buildings} buildings">${label?`<b>${label}</b>`:''}</button>`;}).join('');const focus=`<i class="frontier-focus" style="left:${Math.max(0,Math.min(100,this.renderer.cam.x/W*100))}%;top:${Math.max(0,Math.min(100,this.renderer.cam.y/H*100))}%" aria-hidden="true"></i>`,html=cards+focus,key=html+'|'+full;if(key!==this.lastOverview){$('#map-overview-grid').innerHTML=html;$('#map-overview-summary').textContent=`${full} / ${regions.length} regions fully claimed · ${W}×${H} world`;this.lastOverview=key;}}

 syncPause(){$('#opt-sound').setAttribute('aria-pressed',String(!isMuted()));$('#opt-motion').setAttribute('aria-pressed',String(!this.renderer.calm));$('#opt-grid').setAttribute('aria-pressed',String(this.renderer.grid));$('#opt-sound').textContent=`Sound: ${isMuted()?'off':'on'}`;$('#opt-motion').textContent=`Motion: ${this.renderer.calm?'calm':'full'}`;$('#opt-grid').textContent=`Grid: ${this.renderer.grid?'on':'off'}`;}
 closeSelectionOnly(){this.selected=null;this.selectedTroop=null;this.renderer.selection=null;$('#inspector').hidden=true;}
 clearSelection(){this.closeSelectionOnly();this.refresh();}
 cancel(){this.expandMode=false;this.renderer.wallStart=null;this.renderer.placing=null;this.renderer.moving=null;this.closeSelectionOnly();this.placementHint();this.refresh();}
 startPlacement(type,id=null){this.renderer.orbitMode=false;this.syncCamera();this.closePanel();this.closeSelectionOnly();this.expandMode=false;this.renderer.placing=type;this.renderer.moving=id;this.renderer.grid=true;this.renderer.hover=null;this.renderer.wallStart=null;this.placementHint();this.game.notify('Tap or slide to position. Two fingers pan/zoom. Confirm when ready.');this.refresh();}
 placementHint(){const r=this.renderer,type=r.placing;$('#placement').hidden=!type;document.body.classList.toggle('placing',!!type);if(!type)return;const b=this.game.data.buildings[type],cells=placementCells(r),unitCost=r.moving?{}:buildingCost(type,1,this.game.world,this.game.data),costs=Object.fromEntries(Object.entries(unitCost).map(([k,v])=>[k,v*Math.max(1,cells.length)]));const valid=cells.length&&cells.every(p=>canPlace(this.game.world,this.game.data,type,p.x,p.y,r.moving));const affordable=afford(this.game.world.resources,costs);$('#placement-hint').textContent=b.name+(cells.length>1?` · ${cells.length} segments`:'');$('#placement-cost').textContent=r.moving?'Move for free':cost(costs);$('#placement-state').textContent=!r.hover?'TAP OR SLIDE TO POSITION':!valid?'BLOCKED · CHOOSE ANOTHER TILE':!affordable?'NOT ENOUGH RESOURCES':'READY TO PLACE';$('#confirm-place').disabled=!valid||!affordable;$('#confirm-place').textContent=r.moving?'Move ✓':'Build ✓';}
 confirmPlacement(){const r=this.renderer;if(!r.placing||!r.hover)return;const {x,y}=r.hover;const type=r.placing;if(r.moving){if(this.game.relocate(r.moving,x,y))this.cancel();}else if(isWall({type})&&r.wallStart){if(this.game.buildWallRow(type,r.wallStart,r.hover)){r.wallStart=null;r.hover=null;}}else{const b=this.game.build(type,x,y);if(b){if(this.game.data.buildings[type].repeatPlace){r.hover=null;this.placementHint();}else{this.cancel();this.selected=b.id;r.selection=b.id;}}}this.refresh();}
 selectTroop(id){this.cancel();const unit=this.game.world.troops.find(t=>t.id===id&&t.hp>0);if(!unit)return;this.selectedTroop=id;this.renderer.selection=id;this.renderer.cam.x=unit.x;this.renderer.cam.y=unit.y;this.refresh();sfx.click();}
 selectCell(cell,hit=null){if(this.blocked())return;const r=this.renderer,g=this.game;if(r.placing){r.hover=cell;this.placementHint();return;}
  if(this.expandMode){g.expandClaim(cell.x,cell.y);this.refresh();return;}
  if(hit?.kind==='harvest'){g.harvest(hit.id);this.refresh();return;}
  const unit=hit?.kind==='unit'?g.world.troops.find(t=>t.id===hit.id):null;
  if(unit){this.selected=null;this.selectedTroop=unit.id;r.selection=unit.id;this.refresh();sfx.click();return;}
  if(this.selectedTroop){if(hit?.kind==='enemy')g.commandAttack(this.selectedTroop,hit.id);else g.commandMove(this.selectedTroop,cell.x,cell.y);this.refresh();return;}
  if(hit?.kind==='site'){const site=(g.data.world.hotspots||[]).find(s=>s.id===hit.id);this.clearSelection();if(site){g.notify(`${site.name} — ${site.text}`);r.cam.x=site.x+.5;r.cam.y=site.y+.5;}this.refresh();sfx.click();return;}
  if(hit?.kind==='faction-camp'){const camp=(g.data.world.frontierCamps||[]).find(c=>c.id===hit.id),faction=(g.data.world.enemyFactions||[]).find(f=>f.id===camp?.faction);this.clearSelection();if(camp){g.notify(`${camp.name} — ${camp.text}${faction?.lore?` ${faction.lore}`:''}`);r.cam.x=camp.x+.5;r.cam.y=camp.y+.5;}this.refresh();sfx.click();return;}
  if(hit?.kind==='scenery'){this.clearSelection();return;}
  const building=hit?.kind==='building'?g.world.buildings.find(b=>b.id===hit.id):g.world.buildings.find(b=>cell.x>=b.x&&cell.x<b.x+g.data.buildings[b.type].size&&cell.y>=b.y&&cell.y<b.y+g.data.buildings[b.type].size);
  // Clash-style tap: picking a building sweeps whatever its reserve holds (badges
  // and bubbles wait for the notifyAt threshold, but taps never strand drips).
  const took=building&&reserveCollectible(building,g.data.buildings[building.type])?g.harvest(building.id):false;
  this.selected=building?.id||null;r.selection=this.selected;if(building&&!took)sfx.click();this.refresh();
 }
 setPanelHTML(html){
  if(this.lastPanel===html||this.panel.contains(document.activeElement)&&document.activeElement.tagName==='SELECT')return;
  const scroll=this.panel.scrollTop;
  const railKey=el=>`${el.querySelector('[data-unit]')?.dataset.unit}:${el.classList.contains('armor-list')?'armor':'tools'}`;
  const rails=new Map([...this.panel.querySelectorAll('.gear-list')].map(el=>[railKey(el),el.scrollLeft]));
  this.panel.innerHTML=html;
  if(this.tab==='troops'&&this.search&&!this.panel.querySelector('.person-card,[data-recruit]')){const empty=document.createElement('div');empty.className='menu-empty';empty.setAttribute('role','status');empty.innerHTML='<span aria-hidden="true">⌕</span><h3>No villagers found</h3><p>Try another name or profession, or switch the filter above.</p>';this.panel.append(empty);}
  for(const el of this.panel.querySelectorAll('.gear-list'))el.scrollLeft=rails.get(railKey(el))||0;
  this.panel.scrollTop=scroll;this.lastPanel=html;
 }
 refresh(){this.syncCamera();if(!$('#map-overview').hidden)this.renderOverview();const g=this.game,w=g.world,d=g.data;
  const visibleResources=Object.entries(w.resources).filter(([key,value])=>['wood','food','gold'].includes(key)||value>0||w.buildings.some(b=>d.buildings[b.type].production===key));
  document.body.classList.toggle('many-resources',visibleResources.length>3);
  const resourceHTML=visibleResources.map(([key,value])=>`<button class="resource ${value<30?'low':''}" data-resource="${key}" aria-label="${Math.floor(value)} ${resourceInfo(key).label}. Open resource stores" style="--resource-color:${resourceInfo(key).color}">${img(resourceInfo(key).sprite)}<span><b>${Math.floor(value).toLocaleString()}</b><small>${resourceInfo(key).label}</small></span></button>`).join('');if($('#resources').innerHTML!==resourceHTML)$('#resources').innerHTML=resourceHTML;
  document.body.classList.toggle('raid-active',w.enemies.length>0||!!w.raidPending);
  const seasonName=seasonFor(d.calendar,new Date())?.season?.name;
  $('#day').textContent=`Day ${Math.floor(w.elapsed/180)+1} · ${g.state.mission?'Expedition':(seasonName||'Homestead')}`;
  $('#village-level').textContent=g.state.vlevel||1;const lv=g.state.vlevel||1,lo=XP_LEVELS[lv-1]||0,hi=XP_LEVELS[lv]||lo+1;$('#xp-fill').style.width=`${Math.max(0,Math.min(100,((g.state.xp||0)-lo)/(hi-lo)*100))}%`;
  $('#chapter-count').textContent=`${g.state.completed.length} / ${d.missions.length}`;$('#population-count').textContent=`${w.troops.length} villagers`;$('#wave-count').textContent=g.state.mission?'Expedition':`Wave ${w.wave+1}`;
  if(this.lastMessage!==g.message){this.lastMessage=g.message;$('#status').textContent=g.message;this.toastTime=4.5;$('#status').classList.add('show');const log=$('#event-log');if(log)log.textContent=g.message;}
  const q=currentQuest(g.state,d);$('#quest-name').textContent=q?.name||'Your village is thriving';
  const legendEl=$('#title-legend');if(legendEl&&!$('#title').hidden){const legend=pickLegend(d.legends,daySeed());if(legend)legendEl.textContent=`${legend.title} — ${legend.text}`;}if(q){const p=questProgress(q.task,g.state);$('#quest-progress').textContent=`${Math.min(p.have,p.need)} / ${p.need} · +${q.xp} XP`;}else $('#quest-progress').textContent='Explore the campaign';
  const mission=d.missions.find(m=>m.id===g.state.mission?.id),battle=$('#battle-hud');battle.hidden=!w.enemies.length&&!w.raidPending&&!mission;
  if(w.raidPending)battle.innerHTML=`<b>RAIDERS INCOMING · ${Math.ceil(w.raidPending.timer)}</b><small>${factionFor(d,w.wave+1)?.name||"Raiders"} · ${w.raidPending.count} approaching: ${raidSides(w.wave+1,w.raidPending.count).join(' · ')}</small>`;
  else if(w.enemies.length)battle.innerHTML=`<b>DEFEND THE MANOR</b><small>${w.enemies.length} raiders left · ${w.raidKills||0} defeated</small>`;
  else if(mission){const all=mission.objectives.map(o=>missionObjectiveProgress(o,w,d)),o=all.find(x=>!x.complete)||all[0],fraction=Math.min(1,(o?.have||0)/Math.max(1,o?.need||1)),done=all.filter(x=>x.complete).length;battle.innerHTML=`<b>${Math.max(0,Math.ceil(mission.timeLimit-w.elapsed))}s · ${mission.name}</b><small>${o?.progressText||'Hold the line'} · ${done}/${all.length} objectives</small><div class="battle-progress"><i style="width:${fraction*100}%"></i></div><button data-home="true" class="hud-home">Return home</button>`;}
  const units=w.troops.filter(t=>d.troops[t.type].role==='combat'),rail=units.map(u=>`<button class="army-card ${this.selectedTroop===u.id?'selected':''}" data-select-unit="${u.id}" aria-label="Select ${d.troops[u.type].name}, level ${u.level}" ${u.hp<=0?'disabled':''}><span class="unit-level">${u.level}</span>${img(d.troops[u.type].sprite)}<small>${d.troops[u.type].name}</small><span class="unit-health"><i style="width:${Math.ceil(u.hp/stats(u,d).hp*100)}%"></i></span></button>`).join('');if(rail!==this.lastRail){const scroll=$('#army-rail').scrollLeft;$('#army-rail').innerHTML=rail;$('#army-rail').scrollLeft=scroll;this.lastRail=rail;}
  if(!$('#drawer').hidden){if(this.tab==='build')this.renderBuild();else if(this.tab==='troops')this.renderTroops();else if(this.tab==='workplace')this.renderWorkplace();else if(this.tab==='resources')this.renderResources();else if(this.tab==='friends')this.renderFriends();else this.renderStory();}
  this.renderInspector();this.placementHint();this.renderRaidOverlay();
  this.renderer.collectionObstacles=[...document.querySelectorAll('.chief,#resources,#quest-chip,.camera-tools,.bottom-hud,#inspector,#battle-hud,#camera-panel')].filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
  g.dirty=false;
 }
 renderRaidOverlay(){const g=this.game,w=g.world,el=$('#raid-overlay'),mission=g.state.mission;
  if(mission&&mission.status!=='active'){const won=mission.status==='won',m=g.data.missions.find(m=>m.id===mission.id);const line=won?(m.ceremony?.victory||'The frontier is yours. Mission complete.'):(m.ceremony?.defeat||'Your home is safe.');const html=`<section class="raid-card ${won?'won':'lost'}" role="dialog" aria-modal="true" aria-label="Expedition result"><div class="eyebrow">${won?'EXPEDITION COMPLETE':'EXPEDITION LOST'}</div><h2>${won?'A new chapter begins.':'Your home is safe.'}</h2><p>${m.name}</p><p class="ceremony">${line}</p><div class="raid-stats"><div><span>${won?'First-clear rewards':'Regroup and try again'}</span><b>${won?cost(m.rewards):''}</b></div></div><button class="gold-button" data-home="true">${won?'Claim & return home':'Return home'}</button></section>`;if(this.lastResult!==html){el.innerHTML=html;this.lastResult=html;el.querySelector('button').focus({preventScroll:true});}el.hidden=false;return;}
  const r=w.raidResult;if(!r||w.enemies.length||w.raidPending||mission){el.hidden=true;this.lastResult='';return;}const repairWood=w.buildings.reduce((n,b)=>n+Math.ceil((g.data.buildings[b.type].tiers[b.level-1].hp-b.hp)/15),0);
  const html=`<section class="raid-card ${r.won?'won':'lost'}" role="dialog" aria-modal="true" aria-label="Raid result"><div class="eyebrow">${r.won?'VICTORY':'DEFEAT'} · WAVE ${w.wave}</div><h2>${r.won?'The village stands!':'Rebuild. Rise again.'}</h2><div class="raid-stats"><div><span>Raiders defeated</span><b>${r.kills}</b></div><div><span>Gold recovered</span><b>+${r.loot}</b></div><div><span>Repair cost</span><b>${repairWood} wood</b></div></div><p class="ceremony">Recovery: ${Math.max(0,Math.ceil((w.director?.recoveryUntil||0)-w.elapsed))}s protected from scheduled raids. Repair your defenses and regroup.</p><div class="actions"><button class="gold-button" data-repair-all="true" ${repairWood>0&&w.resources.wood>=repairWood?'':'disabled'}>Repair all</button><button data-dismiss="true">Continue</button></div></section>`;
  if(this.lastResult!==html){el.innerHTML=html;this.lastResult=html;}el.hidden=false;
 }
 renderResources(){
  const g=this.game,w=g.world,d=g.data,bonuses=collectionTotals(w,d);
  const ready=w.buildings.filter(b=>{const s=d.buildings[b.type];return s?.production&&b.hp>0&&b.remaining<=0&&Math.floor(b.harvestBonus||0)>0;});
  this.setPanelHTML(`<div class="panel-intro"><span class="eyebrow">GATHER • BUILD • GROW</span><h3>Your village, at a glance.</h3><p>Production buildings store their output on-site. Tap a glowing building, its bubble, Collect below, or take everything at once.</p><button class="gold-button" data-collect-all="1" ${ready.length?'':'disabled'}>🧺 Collect all${ready.length?` (${ready.length} ready)`:''}</button></div>${Object.entries(w.resources).filter(([key,n])=>n>0||['wood','food','gold'].includes(key)||w.buildings.some(b=>d.buildings[b.type].production===key)).map(([key,n])=>{const r=resourceInfo(key),sources=w.buildings.filter(b=>d.buildings[b.type].production===key);return `<article class="resource-detail" style="--resource-color:${r.color}"><div class="resource-detail-head">${img(r.sprite)}<div><small>IN STORAGE</small><h3>${r.label}</h3></div><strong>${Math.floor(n).toLocaleString()}</strong></div><p>${r.description}</p><div class="resource-bonus">${bonuses[key]||0} ${r.label.toLowerCase()} stored on buildings · tap to collect</div>${sources.map(b=>`<div class="source-row"><span>${d.buildings[b.type].name}<small>Tier ${b.level} · ${b.hp<=0?'Needs repair':b.remaining>0?'Under construction':'Filling reserve'}</small></span><button data-collect="${b.id}" ${b.hp<=0||b.remaining>0||Math.floor(b.harvestBonus||0)<1?'disabled':''}>Collect +${Math.floor(b.harvestBonus||0)} ${r.label}</button></div>`).join('')||'<p class="empty-state">Build a source to start gathering this resource.</p>'}</article>`;}).join('')}`);
 }
 renderBuild(){const g=this.game,w=g.world,d=g.data;
  const lvl=g.state.vlevel||1,xp=g.state.xp||0,lo=XP_LEVELS[lvl-1]??0,hi=XP_LEVELS[lvl]??(lo+1);
  const hh=housing(w,d),bal=(w.foodIncome??0)-(w.foodUpkeep??0);
  const growth=growthStatus(g.state,d);
  const next=(d.levels||[]).find(l=>l.level===lvl+1);
  const nextCache=next&&Object.keys(next.rewards||{}).length?` · 🎁 ${Object.entries(next.rewards).map(([k,v])=>`+${v} ${k}`).join(' ')}`:'';
  const strip=`<div class="village-strip"><div class="vlevel">☾ LVL ${lvl} · ${Math.floor(xp)} XP${nextCache}</div><div class="levelbar village-xp"><div style="width:${Math.max(0,Math.min(100,(xp-lo)/Math.max(1,hi-lo)*100))}%"></div></div><div class="vstats"><span title="Beds used / beds built">🛏 ${hh.used}/${hh.beds}</span><span title="Settled map size">🗺 ${w.bounds?.w||d.world.width}×${w.bounds?.h||d.world.height}</span><span title="Food income minus mouths to feed">${bal>=0?'+':''}${bal.toFixed(1)} ♧/s</span><span title="Wayfinder survey progress">✦ ${Math.floor(w.survey||0)}/50</span><span title="Next villager: ${growth.note}">🌱 ${growth.pct}%${growth.note==='growing'?'':` · ${growth.note}`}</span></div></div>`;
  const host=id=>{const w=d.buildings[id].workplace;return w?` · ${d.troops[w]?.name||'Worker'} workplace`:''};
  // Chain-gate read-through (mirrors Game.build): a shop card for gated
  // work stays dim until the required building stands at tier.
  const needReq=id=>{const r=d.buildings[id].requiresBuilding;if(r&&r.type){const ok=w.buildings.some(b=>b.type===r.type&&b.hp>0&&(b.level||1)>=(r.level||1));if(!ok)return `Needs ${d.buildings[r.type]?.name||r.type} tier ${r.level||1} first`;}const rs=d.buildings[id].requiresBuildings;if(Array.isArray(rs)&&rs.length){const missing=rs.filter(q=>!w.buildings.some(b=>b.type===q.type&&b.hp>0&&(b.level||1)>=(q.level||1)));if(missing.length)return `Needs ${missing.map(q=>`tier-${q.level||1} ${d.buildings[q.type]?.name||q.type}`).join(' and ')} first`;}if(d.buildings[id].maxPerVillage&&w.buildings.some(b=>b.type===id&&b.hp>0))return 'Only one may stand';return null;};
  const blurb=(id,b)=>g.locked(id)?'Unlock through the campaign':(b.minLevel||1)>(g.state.vlevel||1)?`Needs village level ${b.minLevel} — quests, scholars, surveys`:(needReq(id)||(b.production?`+${b.rate*b.tiers[0].rateMultiplier} ${b.production} / second${host(id)}`:b.tiers[0].damage?`${b.tiers[0].damage} damage · ${b.tiers[0].range.toFixed(1)} tiles`:id==='barracks'?'Recruit and train people':id==='wall'?'Blocks raider paths':b.housing?`Houses ${b.housing[0]} villagers`:b.workplace?`${d.troops[b.workplace]?.name||'Worker'} workplace · assign villagers`:'Upgrade at the hall'));
  this.setPanelHTML(`<button class="expand-action" data-expand-toggle="toggle" style="margin-bottom:10px">${this.expandMode?'✓ Expand mode ON — tap wild border tiles':'Expand territory ↗'}</button><div class="panel-heading"><span>MAKE ROOM TO GROW</span><span>Select, then place</span></div><div class="build-list">${Object.entries(g.data.buildings).filter(([id,b])=>id!=='hall'&&(!this.search||b.name.toLowerCase().includes(this.search)||(b.production||'').includes(this.search))&&(this.category==='all'||this.category==='economy'&&b.production||this.category==='defense'&&(isWall({type:id})||b.tiers[0].damage)||this.category==='village'&&!b.production&&!isWall({type:id})&&!b.tiers[0].damage)).sort(([a],[b])=>Number(g.locked(a))-Number(g.locked(b))).map(([id,b])=>{const needLvl=(b.minLevel||1)>(g.state.vlevel||1);const needChain=needReq(id);return `<button class="build-card ${this.renderer.placing===id?'selected':''}" data-build="${id}" ${g.locked(id)||needLvl||needChain?'disabled':''}><span class="tag">${g.locked(id)?'LOCKED':needChain?'CHAIN':needLvl?`LVL ${b.minLevel}`:b.size+' × '+b.size}</span><span class="build-art">${img(b.tiers[0].sprite)}</span><strong>${b.name}</strong><span class="blurb">${blurb(id,b)}</span><span class="tiers">${w.buildings.filter(x=>x.type===id).length} built · ${b.tiers.length} tiers</span><span class="cost ${afford(w.resources,buildingCost(id,1,w,d))?'':'short'}">${cost(buildingCost(id,1,w,d))}</span></button>`;}).join('')}</div>${strip}<p class="cost" style="margin-top:14px">Collectors add deliveries to building production.<br>Walls block movement. Towers cover nearby tiles.<br>Campaign chapters unlock spike traps, the Moon axe, warhammers and more.</p>`);
 }
 renderTroops(){const g=this.game,d=g.data;
  const unlockChapter=id=>{const m=d.missions.find(m=>(m.unlocks||[]).includes(id));return m?`Ch ${m.chapter}`:'Campaign';};
  const traitChips=u=>(u.traits||[]).map(t=>TRAITS[t]?`<span class="trait" title="${TRAITS[t].desc}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`:'').join('');
  const jobLine=u=>{const spec=d.troops[u.type];if(!spec.job)return '';const pct=u.jobLevel>=5?'MAX':`+${Math.round(((u.jobLevel||1)-1)*8)}% output`;return `<div class="joblvl">⚒ Job level ${u.jobLevel||1} · ${pct}${u.manualPost&&u.workplace?' · 🔒 placed by you':''}${isIdle(u)?' · Jobless — looking for an open job':''}</div>`;};
  const idle=idleWorkers(g.world,d);
  const idleBar=this.category!=='recruit'?`<div class="idle-bar" role="status">🧑‍🌾 ${idle.length} jobless worker${idle.length===1?'':'s'}${idle.length?` · ${idle.slice(0,3).map(u=>u.name||d.troops[u.type].name).join(', ')}${idle.length>3?'…':''}`:''}<button data-autoassign ${!idle.length?'disabled':''}>Find open jobs</button></div>`:'';
  this.setPanelHTML(`<div class="panel-heading"><span>YOUR PEOPLE · ${g.world.troops.length}</span><span>Train. Equip. Defend.</span></div>${idleBar}${this.category==='recruit'?`<div class="recruit">${Object.entries(d.troops).filter(([,t])=>!this.search||t.name.toLowerCase().includes(this.search)).map(([id,t])=>`<button data-recruit="${id}" title="${cost(t.recruitCost)}" ${g.locked(id)?'disabled':''}>${img(t.sprite)}+ ${t.name}<small>${g.locked(id)?'Locked — quests/campaign':cost(t.recruitCost)}</small></button>`).join('')}</div><p class="cost">Recruitment requires a finished barracks.</p>`:''}${g.world.troops.filter(u=>(!this.search||`${u.name||''} ${d.troops[u.type].name}`.toLowerCase().includes(this.search))&&this.category!=='recruit'&&(this.category==='all'||this.category==='combat'&&d.troops[u.type].role==='combat'||this.category==='workers'&&d.troops[u.type].role!=='combat')).map(u=>{const s=stats(u,d),spec=d.troops[u.type],abilities=unlockedAbilities(u,d),next=Object.keys(spec.abilities).map(Number).find(n=>n>u.level);return `<article class="person-card"><div class="person-head">${img(spec.sprite)}<div><h3>${'★'.repeat(u.prestigeStars||0)}${u.oath?'⚔ ':''}${u.name||spec.name} <em class="role role-${spec.role}">${spec.role}</em></h3><small>${u.name?spec.name+' · ':''}LEVEL ${u.level} / ${spec.maxLevel}</small><div class="levelbar"><div style="width:${u.level/spec.maxLevel*100}%"></div></div></div><button data-level="${u.id}" ${u.level>=spec.maxLevel?'disabled':''}>Train ↑</button></div><div class="statline">♥ ${Math.ceil(u.hp)}/${Math.round(s.hp)} · ⚔ ${Math.round(s.damage)} · Speed ${s.speed.toFixed(2)}<br>Next level: ${cost(Object.fromEntries(Object.entries(spec.levelCost).map(([k,v])=>[k,Math.ceil(v*u.level*(u.level>=5?1.5:1))])))}</div><div class="traits">${traitChips(u)}</div>${jobLine(u)}<div class="section-label">TOOLS & WEAPONS</div><div class="gear-list">${Object.entries(d.items).filter(([,item])=>!item.slot&&item.roles.includes(u.type)).map(([id,item])=>`<button data-unit="${u.id}" data-gear="${id}" class="gear ${u.gear===id?'selected':''}" title="${item.name}: ${item.craftOnly?'forged':cost(item.cost)}" ${g.locked(id)?'disabled':''}>${img(item.sprite)}${item.name}${rarTag(item)}<small>${g.locked(id)?unlockChapter(id):u.owned.includes(id)?u.gear===id?'Equipped':'Owned':item.craftOnly?((g.world.stock?.[id]||0)>0?`In stock — tap to fit`:`Forge at ${d.buildings[item.craft.building]?.name||'forge'}`):cost(item.cost)}</small></button>`).join('')}</div>${Object.entries(d.items).some(([,item])=>item.slot==='armor'&&item.roles.includes(u.type))?`<div class="section-label">ARMOR</div><div class="gear-list armor-list">${Object.entries(d.items).filter(([,item])=>item.slot==='armor'&&item.roles.includes(u.type)).map(([id,item])=>`<button data-unit="${u.id}" data-gear="${id}" class="gear ${u.armor===id?'selected':''}" title="${item.name} (armor): ${item.craftOnly?'forged':cost(item.cost)}" ${g.locked(id)?'disabled':''}>${img(item.sprite)}${item.name}${rarTag(item)}<small>${g.locked(id)?unlockChapter(id):(u.armorOwned||[]).includes(id)?u.armor===id?'Fitted':'Owned':item.craftOnly?((g.world.stock?.[id]||0)>0?`In stock — tap to fit`:`Forge at ${d.buildings[item.craft.building]?.name||'armory'}`):cost(item.cost)}</small></button>`).join('')}</div>`:''}${spec.job?(()=>{const sites=g.world.buildings.filter(b=>(b.type===spec.job.workplace||(d.buildings[b.type]?.hosts||[]).includes(u.type))&&b.hp>0&&b.remaining<=0);return `<div class="job">⚒ Work: <select data-assign="${u.id}"><option value="">Jobless</option>${sites.map(b=>{const n=assignedWorkers(g.world,b.id).length,cap=workplaceCapacity(b,d);return `<option value="${b.id}" ${u.workplace===b.id?'selected':''} ${(n>=cap&&u.workplace!==b.id)?'disabled':''}>${d.buildings[b.type].name} ${n}/${cap}</option>`;}).join('')}</select><small>${isIdle(u)?'Looking for an open job matching this profession. Checks automatically every 5 seconds. ':''}${spec.job.text}</small></div>`;})():''}<div class="section-label">ABILITIES & PROGRESSION</div><div class="ability">${abilities.map(a=>`<div title="${a.description}">✦ ${a.name}${a.active?` <button data-unit="${u.id}" data-ability="${a.id}" ${u.abilityTimer>0?'disabled':''}>${u.abilityTimer>0?Math.ceil(u.abilityTimer)+'s':'Cast'}</button>`:''}</div>`).join('')||'No abilities unlocked yet.'}${next?`<div>Level ${next} → ${d.abilities[spec.abilities[next]].name}</div>`:''}${(()=>{const opts=promotionOptions(g.world,d,u);return opts.length?`<div class="promote">🎓 Ready to graduate: ${opts.map(o=>`<button data-promote-unit="${u.id}" data-promote-to="${o.type}" title="${o.text}">Graduate → ${d.troops[o.type].name}</button>`).join('')}</div>`:'';})()}${u.level>=spec.maxLevel&&(u.prestigeStars||0)<3?`<div class="promote">★ The Bell Tower remembers: <button data-prestige="${u.id}" title="Reset to level 1, keep gear and kit, +5% all stats per star (max 3)">Ring back${(u.prestigeStars||0)>0?` (★${u.prestigeStars}→★${u.prestigeStars+1})`:''}</button></div>`:''}${d.troops[u.type]?.oathbound&&u.level>=20&&!u.oath?`<div class="promote">⚔ Swear the Last Watch: <button data-oath="${u.id}" title="+50% damage and armor — but if they fall, they fall forever">Take the oath</button></div>`:''}${(()=>{const nid='starforged-'+u.gear;const nx=d.items[nid];return nx&&!g.locked(nid)&&!(u.owned||[]).includes(nid)?`<div class="promote">✦ Starforge line: <button data-reforge="${u.id}" title="${nx.name}: +15% main stat for plate 5 + gold 500">Reforge → ${nx.name}</button></div>`:'';})()}</div></article>`;}).join('')}`);
 }
 // Adventure drawer (Phase 1): five sections — Home, Quests, Expeditions
 // (woodland ranging), Campaign (mission chapters), Chronicle — plus the
 // Grey Market kept as a deep-link category from Home. Gameplay calls
 // (mission/home/trade/sendExpedition) are unchanged; this is presentation.
 renderFriends(){const g=this.game,mp=g.mp();
  if(!this.cloudInfo){this.cloudInfo='local';import('./cloud.js').then(c=>{this.cloudInfo=c.configured()?'ready':'local';this.lastPanel='';this.refresh();}).catch(()=>{this.cloudInfo='local';});}
  const today=new Date().toISOString().slice(0,10);
  const giftsLeft=3-(mp.giftsSentDay===today?mp.giftsSent:0),helpsLeft=3-(mp.helpsSentDay===today?mp.helpsSent:0);
  const ident=mp.username
   ?`<article class="adv-card"><div class="adv-eyebrow">YOUR BANNER</div><h3>${mp.username}</h3><p>Friend code: <b>${mp.friendCode||'—'}</b> · share the code, never your email. Villages know names, not inboxes.</p></article>`
   :`<article class="adv-card"><div class="adv-eyebrow">RAISE YOUR BANNER</div><h3>Who travels these roads?</h3><p>3–16 letters or numbers. Usernames only — no emails, ever.</p><div class="adv-row"><input id="friend-username" maxlength="16" autocomplete="off" placeholder="village name" aria-label="Choose your village name"><button class="gold-button" data-friend-name="1">Raise banner</button></div></article>`;
  const add=`<article class="adv-card"><div class="adv-eyebrow">ADD BY USERNAME + CODE</div><p>Ask your friend for their name and code — nothing else. No searching people up.</p><div class="adv-row"><input id="friend-add-name" maxlength="16" autocomplete="off" placeholder="friend's name" aria-label="Friend's username"><input id="friend-add-code" maxlength="9" autocomplete="off" placeholder="XXXX-XXXX" aria-label="Friend's code"><button class="gold-button" data-friend-add="1">Befriend</button></div></article>`;
  const giftOpts=['wood','food','gold','lumber','flour','bread'].map(r=>`<option value="${r}">${r}</option>`).join('');
  const friends=mp.friends.length?mp.friends.map(f=>`<article class="adv-card" data-friend-card="${f.username}"><div class="adv-row"><span>${f.username}<small>code ${f.code}</small></span><b>FRIEND</b></div><div class="adv-row"><select data-gift-res aria-label="Gift resource">${giftOpts}</select><input data-gift-amt type="number" min="1" max="100" value="10" aria-label="Gift amount"><button data-gift-to="${f.username}">Send gift</button></div><div class="adv-row"><span>Lend hands<small>−60s on their rising build</small></span><button data-help-to="${f.username}">Help build</button></div><div class="adv-row"><span>Part ways</span><button data-friend-drop="${f.username}">Remove</button></div></article>`).join(''):'<p class="adv-empty">No friends yet. Trade codes with someone you trust — the roads are quiet till then.</p>';
  const visit=this.visitSnapshot?(()=>{const p=this.visitSnapshot;const blist=Object.entries(p.buildings||{}).map(([k,v])=>`${v}× ${k}`).join(', ')||'a fresh clearing';return `<article class="adv-card"><div class="adv-eyebrow">VISITING · READ-ONLY</div><h3>${p.username} <small>lvl ${p.vlevel} · ${p.xp} XP · ${p.population} villagers</small></h3><p>${blist}</p><p class="adv-note">You walk their lanes, admire the work, change nothing. That is the rule of guests.</p></article>`;})():'';
  const feed=mp.activity.length?mp.activity.slice(0,10).map(e=>`<div class="adv-row"><span>${e.text}</span><b>${new Date(e.at).toLocaleDateString()}</b></div>`).join(''):'<p class="adv-empty">Nothing yet. Befriend, gift, help — the chronicle writes itself.</p>';
  this.setPanelHTML(`<div class="panel-heading"><span>THE OPEN ROADS</span><span>${this.cloudInfo==='ready'?'cloud lit':'local-only'}</span></div>${ident}${add}<div class="panel-heading"><span>FRIENDS · ${mp.friends.length}</span><span>${giftsLeft} gifts · ${helpsLeft} helps left today</span></div>${friends}<div class="panel-heading"><span>VISIT A VILLAGE</span><span>read-only</span></div><article class="adv-card"><div class="adv-row"><input id="friend-visit-code" maxlength="9" autocomplete="off" placeholder="XXXX-XXXX" aria-label="Village code to visit"><button data-cloud-visit="1">Visit</button></div><p class="adv-note">Needs the cloud (below). Without it, visits wait — everything else works.</p></article>${visit}<div class="panel-heading"><span>CLOUD SHELF</span></div><article class="adv-card"><p class="adv-note">${this.cloudInfo==='ready'?'The shelf is lit — your village can travel.':'Local-only mode: friendships live on this browser. To light up the cloud, follow docs/MULTIPLAYER_SETUP.md.'}</p><button class="gold-button" data-cloud-sync="1">Save to cloud</button></article><div class="panel-heading"><span>CHRONICLE</span></div><article class="adv-card">${feed}</article>`);
 }
 renderStory(){const g=this.game;
  if(this.category==='research')return this.setPanelHTML(researchPanel(g));
  if(this.category==='home')return this.setPanelHTML(this.homeBlock(g));
  if(this.category==='quests')return this.setPanelHTML(this.questBlock(g));
  if(this.category==='expeditions')return this.setPanelHTML(this.expeditionBlock(g));
  if(this.category==='lore')return this.setPanelHTML(this.chronicleBlock(g));
  if(this.category==='market')return this.setPanelHTML(`<button class="adv-back" data-goto="home">‹ Home</button><div class="panel-heading"><span>GREY MARKET</span><span>Trading</span></div>${this.marketBlock(g)}`);
  return this.setPanelHTML(this.campaignBlock(g));
 }
 homeBlock(g){
  const s=homeSummary(g.state,g.data);
  const n=s.next;
  const nextBtn=n.kind==='chapter'
   ?`<button class="gold-button adv-next-btn" data-mission="${n.missionId}">${n.label} →</button>`
   :n.kind==='frontier'
   ?`<button class="gold-button adv-next-btn" data-expand-region="${n.destination?.id||''}">${n.label} →</button>`
   :n.kind==='expedition'
   ?`<button class="gold-button adv-next-btn" data-expedition="${n.unitId}">${n.label} →</button>`
   :`<button class="gold-button adv-next-btn" data-goto="${n.goto}">${n.label} →</button>`;
  const q=s.quest;
  const activeFrontier=g.world.frontierEvent&&(g.data.world.frontierEvents||[]).find(e=>e.id===g.world.frontierEvent.id);
  const frontierEvent=activeFrontier?`<article class="adv-card adv-trade"><div class="adv-eyebrow">FRONTIER EVENT · ${activeFrontier.region.replaceAll('-',' ').toUpperCase()}</div><h3>${activeFrontier.title}</h3><p>${activeFrontier.text}</p><div class="actions">${(activeFrontier.choices||[]).map(ch=>{const price=ch.cost||{},short=!afford(g.world.resources,price),suffix=Object.keys(price).length?` · ${cost(price)}`:'';return `<button data-frontier-choice="${ch.id}" ${short?'disabled':''}>${ch.label}${suffix}</button>`;}).join('')}</div></article>`:'';
  const objective=q
   ?`<article class="adv-card"><div class="adv-eyebrow">CURRENT OBJECTIVE · VILLAGE PATH</div><h3>${q.name}</h3><p>${q.text}</p><div class="progress" role="progressbar" aria-valuenow="${Math.min(s.progress.have,s.progress.need)}" aria-valuemax="${s.progress.need}" aria-label="${q.name} progress"><div style="width:${Math.min(100,s.progress.have/Math.max(1,s.progress.need)*100)}%"></div></div><div class="adv-meta">${taskHint(q.task,g.data)} · ${Math.min(s.progress.have,s.progress.need)} / ${s.progress.need} · +${q.xp} XP</div></article>`
   :`<article class="adv-card adv-done"><div class="adv-eyebrow">CURRENT OBJECTIVE</div><h3>The path is walked.</h3><p>All ${s.questsTotal} village-path quests complete. The frontier is yours to hold.</p></article>`;
  const survival=s.away
   ?`<div class="adv-row"><span>Away on expedition — home waits safe.</span><b>AWAY</b></div>`
   :s.raidIncoming
   ?`<div class="adv-row adv-danger"><span>Raiders incoming — ${s.raidCount} approaching.</span><b>BRACE</b></div>`
   :s.raidActive
   ?`<div class="adv-row adv-danger"><span>Defend the manor — ${s.raidCount} raiders.</span><b>FIGHT</b></div>`
   :s.survival.recovery
   ?`<div class="adv-row"><span>Recovery · at least ${s.survival.recovery}s to repair and regroup.</span><b>REST</b></div>`
   :`<div class="adv-row"><span>Wave ${s.wave} — the treeline is quiet.</span><b>CALM</b></div>`;
  const food=s.foodBalance==null?'—':`${s.foodBalance>=0?'+':''}${s.foodBalance.toFixed(1)} ♧/s`;
  const beds=s.beds?`${s.beds.used}/${s.beds.beds}`:'—';
  const xpPct=Math.max(0,Math.min(100,(s.xp-s.xpLo)/Math.max(1,s.xpHi-s.xpLo)*100));
  const nextCache=s.nextLevel&&Object.keys(s.nextLevel.rewards||{}).length?Object.entries(s.nextLevel.rewards).map(([k,v])=>`+${v} ${k}`).join(' · '):'new rows open';
  const trade=!g.state.mission&&marketOpen(g.state)
   ?`<article class="adv-card adv-trade"><div class="adv-eyebrow">TRADE WINDS · GREY MARKET</div><h3>The wagons are in.</h3><p>Three deals today, same faces till dawn.</p><button class="adv-next-btn" data-goto="market">Open the Grey Market →</button></article>`
   :g.state.mission
   ?`<article class="adv-card adv-trade"><div class="adv-eyebrow">TRADE WINDS</div><p>The wagons wait at home — finish the expedition first.</p></article>`
   :`<article class="adv-card adv-trade"><div class="adv-eyebrow">TRADE WINDS</div><p>Dust on the Grey Road — grow the village to level 2 and the traders will find you.</p></article>`;
  return `<div class="panel-heading"><span>ADVENTURE · HOME</span><span>${s.chaptersDone}/${s.chaptersTotal} chapters</span></div>
  <article class="adv-hero"><div class="adv-eyebrow">NEXT ACTION</div><h3>${n.label}</h3><p>${n.detail}</p>${nextBtn}</article>
  ${objective}
  ${frontierEvent}
  <div class="panel-heading"><span>SURVIVAL STATUS</span><span>Wave ${s.wave}</span></div>
  <button class="gold-button adv-next-btn" data-goto="research">Technology tree →</button><article class="adv-card">${survival}${!s.away?`<div class="adv-row"><span>Settlement threat · size, stores & victories</span><b>${s.survival.label} · ${s.survival.score}/100</b></div><p class="adv-note">${factionFor(g.data,s.wave)?.name||"Raiders"}: ${factionFor(g.data,s.wave)?.lore||"Watch the treeline."}</p><p class="adv-note">Quiet time varies. Scouts warn before an attack. Ruined buildings stop producing until repaired. Civilians shelter during alarms; builders repair safe defenses and healers aid allies behind the fighting.</p>`:""}<div class="adv-row"><span>Food balance</span><b>${food}</b></div><div class="adv-row"><span>Cottage beds spoken for</span><b>${beds}</b></div><div class="adv-row"><span>Growth · ${s.growth.note}</span><b>${s.growth.pct}%</b></div><div class="adv-row"><span>Rangers out · idle hands</span><b>${s.ranging} · ${s.idleRangers}</b></div></article>
  <div class="panel-heading"><span>SETTLEMENT GOALS</span><span>Lvl ${s.lvl}</span></div>
  <article class="adv-card"><div class="adv-row"><span>Village level ${s.lvl} · ${s.xp} XP</span><b>${s.questsDone}/${s.questsTotal} quests</b></div><div class="progress" role="progressbar" aria-valuenow="${Math.round(xpPct)}" aria-valuemax="100" aria-label="Village level progress"><div style="width:${xpPct}%"></div></div><div class="adv-meta">Next: level ${s.lvl+1} — ${nextCache}${s.nextLevel?.text?` · ${s.nextLevel.text}`:''}</div><button class="adv-next-btn" data-goto="quests">Walk the village path →</button></article>
  ${trade}`;
 }
 expeditionBlock(g){
  const w=g.world,d=g.data;
  if(g.state.mission)return `<div class="panel-heading"><span>EXPEDITIONS · WOODLAND RANGING</span><span>paused away</span></div><div class="notice-board" aria-live="polite"><span>RANGING</span><p>Ranging waits at home — finish the expedition first. Campaign chapters march under their own banner, below the Campaign tab.</p></div><button class="adv-next-btn" data-home="true">Abandon expedition & return home</button><button class="adv-next-btn" data-goto="chapters">Return to the campaign →</button>`;
  const {out,idle}=expeditionRoster(w,d);
  const outHtml=out.length?out.map(o=>{const spec=d.troops[o.type];return `<div class="adv-row"><span>${o.name}<small>${spec?.name||o.type} · ${o.status||'ranging'}</small></span><b>OUT</b></div>`;}).join(''):'<p class="adv-empty">No hands in the treeline. The woods keep their counsel.</p>';
  const idleHtml=idle.length?idle.map(o=>{const spec=d.troops[o.type];const haul=Object.entries(o.yields).map(([k,v])=>`+${v} ${k}`).join(' · ');const riskPct=Math.round((o.risk||0)*100);return `<article class="adv-ranger"><div><b>${o.name}</b><small>${spec?.name||o.type} · hauls ${haul} · ~${o.durationSec}s · ${riskPct}% mishap</small></div><button data-expedition="${o.id}">Send →</button></article>`;}).join(''):'<p class="adv-empty">No idle rangers. Foragers, woodcutters and wayfinders range — fighters hold the walls.</p>';
  return `<div class="panel-heading"><span>EXPEDITIONS · WOODLAND RANGING</span><span>${out.length} out · ${idle.length} ready</span></div>
  <p class="adv-note">Rangers slip into the treeline and haul back wild goods. This is ranging — campaign chapters march under the Campaign tab.</p>${this.shelfLine(g)}
  <div class="panel-heading"><span>OUT NOW</span></div><article class="adv-card">${outHtml}</article>${this.lastReturnCard(g)}
  <div class="panel-heading"><span>READY TO SEND</span></div>${idleHtml}`;
 }
 // Phase 11 — the shelf: recovered artifacts and what they bless.
 shelfLine(g){
  const shelf=g.world?.artifacts||[];
  if(!shelf.length)return '';
  const known=new Map((g.data.artifacts?.artifacts||[]).map(a=>[a.id,a]));
  const names=shelf.map(id=>known.get(id)?.name||id).join(' · ');
  return `<p class="adv-note">◈ Relics on the shelf (${shelf.length}): ${names}.</p>`;
 }
 // Phase 11 — the last homecoming, kept on the world for the panel.
 lastReturnCard(g){
  const r=g.world?.lastReturn;
  if(!r||!r.lines?.length)return '';
  return `<div class="panel-heading"><span>LAST RETURN · DAY ${r.day}</span><span>home</span></div><article class="adv-card"><div class="adv-row"><span>${r.ranger}</span><b>HOME</b></div><p class="adv-note">${r.lines.join('; ')}.</p></article>`;
 }
 campaignBlock(g){const w=g.world;
  const cards=campaignCards(g.data,g.state);
  const names=id=>g.data.missions.find(m=>m.id===id)?.name||id;
  const reqLine=c=>{
   const bits=[];
   if(c.requires.length)bits.push(`Needs ${c.requires.map(names).join(' + ')}`);
   if(c.requiresAny.length)bits.push(`Needs ${c.requiresAny.map(names).join(' or ')}`);
   if(c.destination&&!c.destination.claimed)bits.push(`Claim ${c.destination.name}`);
   return bits.join(' · ');
  };
  const objectiveLine=(o,current)=>{const p=missionObjectiveProgress(o,w,g.data);return current?`${p.progressText}<div class="progress"><div style="width:${Math.min(100,p.have/Math.max(1,p.need)*100)}%"></div></div>`:`${p.label}<br>`;};
  const firstOpen=cards.find(c=>c.state==='available');
  return `<div class="panel-heading"><span>CAMPAIGN · ${g.data.missions.length} CHAPTERS</span><span>${cards.filter(c=>c.state==='completed').length} complete</span></div>
  <p class="adv-note">Expedition chapters under their own banner — timed marches with scheduled raids, far from the woodland ranging above.</p>
  ${g.data.missions.map(m=>{const c=cards.find(c=>c.id===m.id);const current=c.state==='current',completed=c.state==='completed',locked=c.state==='locked',claimGate=locked&&c.prerequisitesMet&&c.destination&&!c.destination.claimed;return `<article class="mission-card ${current?'current':completed?'completed':locked?'locked':'available'}"><div class="chapter">CHAPTER ${m.chapter}${m.act?` · ACT ${m.act}`:''} ${completed?'· COMPLETE':locked?'· LOCKED':current?'· UNDERWAY':''}${m.id===firstOpen?.id?' · NEXT':''}</div><h3>${m.name}</h3>${m.giver?`<p class="mission-beat">— ${m.giver}</p>`: ''}<p>${m.description}</p>${m.beat?`<p class="mission-beat">${m.beat}</p>`:''}${current&&m.ceremony?`<p class="ceremony">${m.ceremony.warning}</p>`:''}<div class="details">${m.objectives.map(o=>objectiveLine(o,current)).join('')}${current?Math.max(0,Math.ceil(m.timeLimit-w.elapsed)):m.timeLimit}s ${current?'remaining':'limit'} · ${m.troopLimit} people maximum<br>${m.raids.length} scheduled raids ${m.raids.length?'· defeat every wave':''}${c.destination?`<br>Destination: ${c.destination.name} · ${c.destination.claimed?'CLAIMED':'WILD'}`:''}<br>First-clear reward: ${cost(m.rewards)}<br>Unlock: ${m.unlocks.map(id=>g.data.buildings[id]?.name||g.data.items[id]?.name||g.data.troops[id]?.name||id).join(', ')}${(c.requires.length||c.requiresAny.length)?`<br>${reqLine(c)}`:''}</div>${current?`<p class="result">${g.state.mission.status==='won'?'The frontier is yours. Mission complete.':g.state.mission.status==='lost'?'The expedition was lost. Your home is safe.':'Your home village is paused during this expedition.'}</p><button class="primary" data-home="true">${g.state.mission.status==='won'?'Claim rewards & return':g.state.mission.status==='lost'?'Return home':'Abandon & return home'}</button>`:claimGate?`<button class="primary" data-expand-region="${c.destination.id}">Claim ${c.destination.name} →</button>`:`<button class="primary" data-mission="${m.id}" ${locked||g.state.mission?'disabled':''}>${locked?(reqLine(c)||'Complete the previous chapter'):completed?'Replay chapter (no repeat rewards)':'Begin expedition →'}</button>`}</article>`;}).join('')}`;
 }
 marketBlock(g){
  const d=g.data;
  if(g.state.mission)return `<div class="notice-board" aria-live="polite"><span>GREY MARKET</span><p>The wagons wait at home — finish the expedition first.</p></div>`;
  if(!marketOpen(g.state))return `<div class="notice-board" aria-live="polite"><span>GREY MARKET</span><p>Dust on the Grey Road — no wagons yet. Grow the village to level 2 and the traders will find you.</p></div>`;
  const now=new Date(),key=dayKey(now);
  const s=seasonFor(d.calendar,now),m=modifierFor(d.calendar,now);
  const clock=describeClock(g.world,d);
  const sky=`<div class="notice-board" aria-live="polite"><span>TONIGHT'S SKY</span><p>${s?`${s.season.name}, day ${s.dayOfCycle} of 28. ${s.season.text} `:''}${m?`${m.name} — ${m.text}`:''}<br>${clock.line}${clock.hint?` — ${clock.hint}.`:'.'}</p></div>`;
  const used=g.state.tradeDay===key&&(g.state.tradesUsed||{});
  const deals=dealsFor(d.traders,d.calendar,now,g.state.vlevel||1);
  if(!deals.length)return `${sky}<div class="notice-board" aria-live="polite"><span>GREY MARKET</span><p>No wagons on the road today. The bell will bring new faces tomorrow.</p></div>`;
  const cards=deals.map(deal=>{const cap=tradeCap(deal),n=used?used[deal.id]||0:0,left=cap-n;
   const short=!afford(g.world.resources,deal.give||{});
   const done=left<=0;
   return `<article class="mission-card"><div class="chapter">GREY MARKET · ${done?'DEAL DONE':`${left} OF ${cap} LEFT TODAY`}${deal.season?' · THIS SEASON ONLY':''}</div><h3>${describeDeal(deal)}</h3><p>${deal.flavor||''}</p><p class="mission-beat">${deal.trader?`— ${deal.trader}`:''}</p><button class="primary" data-trade="${deal.id}" ${done||short?'disabled':''}>${done?'Come back tomorrow':short?'Gather a little more':'Strike the deal →'}</button></article>`;}).join('');
  return `${sky}<div class="panel-heading"><span>GREY MARKET · 3 WAGONS TODAY</span><span>Same faces all day</span></div>${cards}`;
 }
 questBlock(g){
  const d=g.data,done=g.state.questsCompleted||[];
  const states=new Map(questCards(d,g.state).map(s=>[s.id,s]));
  const rows=(d.quests||[]).map(q=>{const st=states.get(q.id)||{status:'upcoming',progress:questProgress(q.task,g.state)};
   const p=st.progress,pill=st.status==='done'?'✓ DONE':st.status==='active'?'▶ ACTIVE':'· UPCOMING';
   const pct=Math.min(100,Math.floor(p.have/Math.max(1,p.need)*100));
   const giver=q.giver?`<span class="qgiver">— ${q.giver}${q.act?` · Act ${q.act}`:''}</span>`:'';
   const flavor=q.flavor?`<span class="qflavor">${q.flavor}</span>`:'';
   const rewards=Object.entries(q.rewards||{}).map(([k,v])=>`+${v} ${k}`).join(' · ');
   const unlocks=q.unlocks?`<span class="qflavor">Unlocks: ${q.unlocks.map(id=>d.buildings[id]?.name||d.items[id]?.name||d.troops[id]?.name||id).join(', ')}</span>`:'';
   return `<article class="quest ${st.status==='done'?'qdone':st.status==='active'?'qactive':'qnext'}"><span class="qpill qpill-${st.status}">${pill}</span><b>${q.name}</b><span>${q.text}</span>${flavor}${unlocks}${giver}<div class="progress" role="progressbar" aria-valuenow="${Math.min(p.have,p.need)}" aria-valuemax="${p.need}" aria-label="${q.name} progress"><div style="width:${st.status==='done'?100:pct}%"></div></div><span class="qprog">${Math.min(p.have,p.need)}/${p.need} · +${q.xp} XP${rewards?` · ${rewards}`:''}</span></article>`;}).join('');
  return `<div class="panel-heading"><span>VILLAGE PATH · LVL ${g.state.vlevel||1} · ${Math.floor(g.state.xp||0)} XP</span><span>${done.length}/${(d.quests||[]).length}</span></div><p class="adv-note">The village road, step by step — finish the active quest to walk the path.</p><div class="quests">${rows}</div>`;
 }
 // Chronicle: notice board + Issa's chart log + the manner's legends.
 chronicleBlock(g){
  const rumor=pickRumor(g.data.rumors,daySeed());
  const board=rumor?`<div class="notice-board" aria-live="polite"><span>NOTICE BOARD</span><p>${rumor.text}</p></div>`:'';
  // Phase 11 — the latest homecoming is pinned above the rumors: rangers
  // bring the news home, and the manner remembers it here.
  const pages=g.world?.expeditionLog||[];
  const latest=pages.length?pages[pages.length-1]:null;
  const home=latest?`<div class="notice-board" aria-live="polite"><span>HOMECOMING · DAY ${latest.day}</span><p>${latest.ranger} — ${latest.text}</p></div>`:'';
  // Phase 12 — the latest crown is pinned above the rumors: boss waves
  // are telegraphed here as well as on the notice line, fair and remembered.
  const crown=g.world?.lastBoss;
  const crownPin=crown?`<div class="notice-board" aria-live="polite"><span>${crown.won===true?'CROWN FELLED':crown.won===false?'CROWN ENDURES':'CROWN MARCHES'} · WAVE ${crown.wave}</span><p>${crown.name}, ${crown.title||'terror of the frontier'} — ${crown.won===true?'broken before the gates.':crown.won===false?'still out there. Bar the gates.':'marching. To arms!'}</p></div>`:'';
  const legends=(g.data.legends||[]).map(l=>`<div class="quest qdone"><b>☾ ${l.title}</b><span>${l.text}</span></div>`).join('');
  return `<div class="panel-heading"><span>CHRONICLE</span><span>memory</span></div><p class="adv-note">What the manner remembers — rumors on the board, Issa's chart pages, old legends.</p>${home}${crownPin}${board}${this.chartLog(g)}${legends?`<div class="panel-heading"><span>LEGENDS OF THE MANNER</span><span>${(g.data.legends||[]).length} tales</span></div><div class="quests">${legends}</div>`:''}`;
 }
 // Chart Log: Issa's persistent record. Quests with a `log` line leave a
 // page here once completed — panel history, never toast-only.
 chartLog(g){
  const done=g.state.questsCompleted||[];
  const rows=(g.data.quests||[]).filter(q=>q.log&&done.includes(q.id));
  if(!rows.length)return '';
  return `<div class="panel-heading"><span>CHART LOG · ISSA'S RECORD</span><span>${rows.length} pages</span></div><div class="quests">${rows.map(q=>`<div class="quest qdone"><b>☾ ${q.name}</b><span>${q.log}</span><span class="qgiver">— ${q.giver||'Issa the chart-keeper'}</span></div>`).join('')}</div>`;
 }
 workLine(g,b,spec){
  const d=g.data,bits=[];
  if(spec.housing){const hh=housing(g.world,d);bits.push(`🛏 ${hh.used}/${hh.beds} beds spoken for`);}
  if(spec.workplace){const crew=g.world.troops.filter(t=>t.workplace===b.id);
   bits.push(`⚒ ${crew.map(t=>d.troops[t.type].name).join(', ')||'No hands yet — assign from the People panel'}`);}
  if(b.maxReserve){const frac=Math.round(100*Math.max(0,Math.min(1,b.reserve/b.maxReserve)));bits.push(`◈ Node ${frac}% full`);}
  return bits.length?`<br><small>${bits.join(' · ')}</small>`:'';
 }
 renderWorkplace(){
  const g=this.game,d=g.data,w=g.world,b=w.buildings.find(b=>b.id===this.workplaceId);
  if(!b){this.setPanelHTML('<p>This workplace is no longer available.</p>');return;}
  const spec=d.buildings[b.type],type=spec.workplace,job=d.troops[type],crew=assignedWorkers(w,b.id),cap=workplaceCapacity(b,d),ready=b.hp>0&&b.remaining<=0,room=crew.length<cap;
  $('#panel-title').textContent=spec.name;
  const candidates=w.troops.filter(u=>u.hp>0&&(d.troops[u.type].job?.workplace===b.type||(d.buildings[b.type]?.hosts||[]).includes(u.type))&&u.workplace!==b.id);
  // Perf: crew counts once per render instead of a troops filter per
  // scorePost comparison — identical scores, no per-frame churn.
  const crewCounts=new Map();
  for(const t of w.troops)if(t.workplace&&t.hp>0)crewCounts.set(t.workplace,(crewCounts.get(t.workplace)||0)+1);
  const bestId=candidates.length?candidates.slice().sort((x,y)=>scorePost(y,b,d,w,crewCounts)-scorePost(x,b,d,w,crewCounts))[0].id:null;
  const row=(u,posted)=>{const old=w.buildings.find(site=>site.id===u.workplace);const star=!posted&&u.id===bestId?' <span class="best-match" title="Best trait match for this post">★ best match</span>':'';return `<article class="worker-row">${img(d.troops[u.type].sprite)}<div><b>${u.name||d.troops[u.type].name}</b>${star}<small>Level ${u.level} · Job ${u.jobLevel||1}${(u.traits||[]).map(t=>TRAITS[t]?TRAITS[t].icon:'').join(' ')} · ${posted?'Assigned here':old?'At '+d.buildings[old.type].name:'Available'}</small></div><button ${posted?`data-release="${u.id}"`:`data-staff="${u.id}"`} ${!posted&&(!ready||!room)?'disabled':''}>${posted?'Release':old?'Transfer':'Assign'}</button></article>`;};
  this.setPanelHTML(`<div class="workplace-summary">${img(spec.tiers[b.level-1].sprite)}<div><h3>${crew.length} / ${cap} jobs filled</h3><p>${job?.job?.text||'Assign matching workers here.'}</p><small>${!ready?'Repair or finish construction to open jobs.':room?`${cap-crew.length} open positions`:'Fully staffed'}</small></div></div><div class="panel-heading">CURRENT CREW</div>${crew.map(u=>row(u,true)).join('')||'<p class="empty-crew">No workers assigned yet.</p>'}<div class="panel-heading">AVAILABLE WORKERS & TRANSFERS</div>${candidates.map(u=>row(u,false)).join('')||'<p class="empty-crew">Hire a matching worker to fill an open job.</p>'}${job?`<button class="hire-worker gold-button" data-recruit="${type}" data-workplace="${b.id}" ${!ready||!room||g.locked(type)||!afford(w.resources,job.recruitCost)?'disabled':''}>${img(job.sprite)}<span>Hire ${job.name}<small>${cost(job.recruitCost)} · Automatically assigned here</small></span></button><p class="cost">Requires a finished barracks and room in your troop limit. Hiring from People also fills an open matching job automatically.</p>`:''}`);
 }
 renderInspector(){const g=this.game,d=g.data,w=g.world,el=$('#inspector');const u=w.troops.find(t=>t.id===this.selectedTroop),b=w.buildings.find(b=>b.id===this.selected);if((!u&&!b)||this.renderer.placing||!$('#drawer').hidden){el.hidden=true;return;}el.hidden=false;
 const close='<button class="close-selection" data-action="close" aria-label="Clear selection">✕</button>';
 if(u){const spec=d.troops[u.type];const exp=expeditionStatus(u,d);const tline=(u.traits||[]).map(t=>TRAITS[t]?`${TRAITS[t].icon} ${TRAITS[t].name}`:'').filter(Boolean).join(' · ');el.innerHTML=`${close}<div class="inspector-head">${img(spec.sprite)}<div><span class="eyebrow">LEVEL ${u.level} · JOB ${u.jobLevel||1} · ${u.order?.kind?.toUpperCase()||'AUTO'}</span><h2>${u.name||spec.name}</h2><p>${spec.name}${tline?` · ${tline}`:''}</p><p>Tap ground to move · Tap an enemy to attack${exp?` · ${exp}`:''}</p></div></div><div class="actions"><button data-action="hold">Hold position</button><button data-action="resume">Auto duties</button>${spec.expedition?`<button data-action="expedition" ${u.expedition?'disabled':''}>${u.expedition?exp:'Send expedition'}</button>`:''}<button class="gold-button" data-action="gear">Equipment</button></div>`;return;}
 const spec=d.buildings[b.type],tier=spec.tiers[b.level-1],max=b.level>=spec.tiers.length,upgradeCost=b.type==='hall'?{wood:200*b.level,gold:150*b.level}:buildingCost(b.type,b.level+1,w,d),maxHp=buildingMaxHp(b,d),repairCost=Math.ceil((maxHp-b.hp)/15);const hp=Math.max(0,b.hp/maxHp);
 // Phase 12 endless work: paragon reinforcement on max-tier fortifications,
 // renown bought at a standing hall. Both repeat forever.
 const canPara=max&&paragonEligible(b.type,d)&&b.hp>0&&b.remaining<=0;
 const paraCost=canPara?paragonCost(b.type,Math.max(0,b.paragon||0),w,d):null;
 const renownOpen=b.type==='hall'&&renownAvailable(g.state,d);
 const renownPrice=renownOpen?renownCost(d,Math.max(0,w.renown||0)):null;
 const tierGate=spec.tierGates?.[b.level+1],tierGated=tierGate&&(g.state.vlevel||1)<tierGate;
 const rowActions=isWall(b)?['x','y'].map(axis=>{
  const q=wallRowQuote(w,d,b.id,axis,g.state.vlevel||1);
  if(q.row.length<2)return '';
  return `<button data-action="upgrade-row" data-axis="${axis}" ${!q.eligible.length||!afford(w.resources,q.cost)?'disabled':''}>Upgrade row ${axis==='x'?'↘':'↙'} · ${q.eligible.length}/${q.row.length}<br><small>${q.eligible.length?cost(q.cost):'No ready segments'}</small></button>`;
 }).join(''):'';
 el.innerHTML=`${close}<div class="inspector-head">${img(tier.sprite)}<div><span class="eyebrow">TIER ${b.level} · ${b.hp<=0?'RUINED':b.remaining>0?'BUILDING':'READY'}</span><h2>${spec.name}</h2><p>♥ ${Math.ceil(b.hp)} / ${maxHp}${b.paragon?` · paragon ${b.paragon}`:''}${b.remaining>0?` · ${Math.ceil(b.remaining)}s remaining`:spec.production?` · ${spec.rate*tier.rateMultiplier} ${spec.production}/s into reserve`:tier.damage?` · ${tier.damage} damage`:''}</p></div></div><div class="hpbar"><div style="width:${hp*100}%"></div></div>${spec.refine?`<p class="refine-line">⚙ Refinery: ${spec.refine.map(r=>`${Object.entries(r.in||{}).map(([k,v])=>`${v} ${resourceInfo(k).label}`).join(' + ')} → ${Object.entries(r.out||{}).map(([k,v])=>`${v} ${resourceInfo(k).label}`).join(' + ')}`).join(' · ')} — post ${d.troops[spec.workplace]?.name||'workers'} to run it</p>`:''}<div class="actions"><button class="gold-button" data-action="upgrade" ${max||tierGated||b.remaining>0||b.hp<=0||!afford(w.resources,upgradeCost)?'disabled':''}>${max?'Max tier':tierGated?`Tier ${b.level+1} needs LVL ${tierGate}`:`Upgrade<br><small>${cost(upgradeCost)}</small>`}</button>${canPara?`<button data-action="reinforce" ${!afford(w.resources,paraCost)?'disabled':''}>Reinforce ${b.paragon?`· ${b.paragon} → ${b.paragon+1}`:''}<br><small>${cost(paraCost)}</small></button>`:''}${renownOpen?`<button class="gold-button" data-action="renown" ${!afford(w.resources,renownPrice)?'disabled':''}>📜 Renown ${Math.max(0,w.renown||0)+1}<br><small>${cost(renownPrice)}</small></button>`:''}<button data-action="move" ${w.enemies.length||w.raidPending?'disabled':''}>Move</button>${b.hp<tier.hp?`<button data-action="repair" ${w.resources.wood<repairCost?'disabled':''}>Repair<br><small>${repairCost} wood</small></button>`:''}${spec.workplace?`<button data-action="assign">Workers ${assignedWorkers(w,b.id).length}/${workplaceCapacity(b,d)}</button>`:''}${spec.production&&b.harvestBonus>=1?`<button data-action="harvest">Collect +${Math.floor(b.harvestBonus)} ${resourceInfo(spec.production).label}</button>`:''}${spec.serviceArmor?'<button data-action="service">Service armor<br><small>20 wood</small></button>':''}</div>${(()=>{const recipes=Object.entries(d.items).filter(([,it])=>it.craft?.building===b.type);if(!recipes.length)return '';const busy=b.craft;const thrift=assignedWorkers(w,b.id).some(t=>(t.traits||[]).includes('craftsman'));return `<div class="craft-block"><div class="section-label">FORGE ORDERS${busy?` · AT WORK: ${d.items[busy.item]?.name||'—'} (${Math.max(0,Math.ceil(busy.remaining))}s)`:''}${!busy&&thrift?' · ⚙ craftsman thrift −25% stores':''}</div>${recipes.map(([id,it])=>{const st=stockCount(w,id);return `<button data-action="craft" data-item="${id}" ${busy||b.hp<=0||b.remaining>0||!afford(w.resources,it.cost)?'disabled':''}>${img(it.sprite)}${it.name}${rarTag(it)}<small>${st>0?`${st} in stock · `:''}${cost(it.cost)} · ${it.craft.seconds}s</small></button>`;}).join('')}</div>`;})()}${rowActions?`<div class="actions wall-row-actions">${rowActions}</div><p>Each ready segment gains one tier. Busy, ruined, gated and max-tier walls stay unchanged.</p>`:''}${spec.cairn?`<div class="cairn-roll"><h4>THE FALLEN — THE LAST WATCH</h4><p>${(w.fallen||[]).length? w.fallen.map(f=>`🕯 ${f.name} (${d.troops[f.type]?.name||f.type})`).join('<br>'):'No oathbound have fallen. The cairns stand ready, and pray they stand empty.'}</p></div>`:''}`;
}
 tick(dt){this.clock+=dt;this.toastTime=Math.max(0,this.toastTime-dt);if(this.toastTime===0)$('#status').classList.remove('show');if(!this.controlPressed&&(this.game.dirty||this.clock>.5)){this.clock=0;this.refresh();}}
}
