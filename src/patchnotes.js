// In-game notice board: version-stamped patch notes players read inside the
// game. Data-driven (data/updates.json), dismissible, and never blocking —
// the modal never pauses the simulation and one tap returns to the village.
// Save-compat is additive only: game.state.seenUpdatesVersion rides along in
// the save blob when present; old saves without the flag fall back to showing
// the board once, fresh villages stay quiet and mark the latest entry seen.
import {peekVersion} from './storage.js';
export const NEWS_TABS=['build','troops','workplace','story','resources'];
export function versionParts(value){
 if(typeof value!=='string')return [];
 const parts=value.trim().split('.');
 if(!parts.length||parts.some(p=>!/^\d+$/.test(p)))return [];
 return parts.map(Number);
}
export function compareVersions(a,b){
 const pa=versionParts(a),pb=versionParts(b);
 for(let i=0;i<Math.max(pa.length,pb.length);i++){
  const d=(pa[i]??0)-(pb[i]??0);
  if(d!==0)return d<0?-1:1;
 }
 return 0;
}
export function normalizeFeed(raw){
 const list=Array.isArray(raw)?raw:raw?.entries;
 if(!Array.isArray(list))return [];
 const out=[];
 for(const e of list){
  if(!e||typeof e!=='object')continue;
  if(typeof e.id!=='string'||!e.id||typeof e.title!=='string'||!e.title)continue;
  const version=versionParts(e.version).length?e.version:'0.0.0';
  const links=[];
  for(const l of Array.isArray(e.links)?e.links:[]){
   if(l&&typeof l.label==='string'&&NEWS_TABS.includes(l.tab))links.push({label:l.label,tab:l.tab});
  }
  out.push({id:e.id,version,title:String(e.title),body:typeof e.body==='string'?e.body:'',links});
 }
 return out.sort((x,y)=>compareVersions(y.version,x.version));
}
export function latestVersion(feed){
 let best=null;
 for(const e of feed||[])if(best==null||compareVersions(e.version,best)>0)best=e.version;
 return best;
}
// seen==null means "never marked": every entry is new to this village.
export function unseenEntries(feed,seen){
 if(!Array.isArray(feed)||!feed.length)return [];
 if(seen==null||!versionParts(seen).length)return [...feed];
 return feed.filter(e=>compareVersions(e.version,seen)>0);
}
 export class PatchNotes{
  constructor(game,ui,{doc=document,peekSave=null,onFresh=null}={}){
   this.game=game;this.ui=ui;this.doc=doc;
   this.onFresh=typeof onFresh==='function'?onFresh:null;
  this.peekSave=peekSave||(()=>{try{return peekVersion();}catch{return null;}});
  this.feed=normalizeFeed(game?.data?.updates);
  this.overlay=doc.querySelector('#news-overlay');
  this.list=doc.querySelector('#news-list');
  this.closeButton=doc.querySelector('#news-close');
  this.newsButton=doc.querySelector('#opt-news');
  if(this.newsButton)this.newsButton.onclick=()=>this.open(this.feed);
  if(this.closeButton)this.closeButton.onclick=()=>this.close();
  if(this.list)this.list.addEventListener('click',e=>this.follow(e));
  // Capture-phase Escape closes the board first; the drawer/pause handler
  // in ui.js never sees it, so the game state behind stays as it was.
  doc.addEventListener?.('keydown',e=>{
   if(e.key==='Escape'&&this.isOpen()){e.preventDefault?.();e.stopPropagation?.();this.close();}
  },true);
  // Auto-show only after the player enters the village — never over the
  // title screen, never mid-tutorial, never while paused behind menus.
  const begin=doc.querySelector?.('#begin');
  if(begin)begin.addEventListener('click',()=>this.maybeAutoShow(),{once:true});
  this.updateBadge();
 }
 seen(){return this.game?.state?.seenUpdatesVersion??null;}
 unseen(){
  if(this.seen()==null){try{if(this.peekSave()==null)return [];}catch{return [];}}
  return unseenEntries(this.feed,this.seen());
 }
 isOpen(){return !!this.overlay&&!this.overlay.hidden;}
 open(entries){
  if(!this.overlay||!this.list)return;
  const shown=Array.isArray(entries)&&entries.length?entries:this.feed;
  this.list.innerHTML='';
  for(const e of shown){
   const card=this.doc.createElement('article');
   card.className='news-entry';
   const tag=this.doc.createElement('span');
   tag.className='news-version';tag.textContent='v'+e.version;
   const title=this.doc.createElement('h3');title.textContent=e.title;
   const body=this.doc.createElement('p');body.textContent=e.body;
   card.appendChild(tag);card.appendChild(title);
   if(e.body)card.appendChild(body);
   if(e.links.length){
    const row=this.doc.createElement('div');
    row.className='news-links';
    for(const l of e.links){
     const b=this.doc.createElement('button');
     b.type='button';b.textContent=l.label;b.dataset.newsTab=l.tab;
     row.appendChild(b);
    }
    card.appendChild(row);
   }
   this.list.appendChild(card);
  }
  this.overlay.hidden=false;
  try{this.closeButton?.focus?.({preventScroll:true});}catch{}
  this.updateBadge();
 }
 follow(event){
  const tab=event?.target?.dataset?.newsTab;
  if(!tab||!NEWS_TABS.includes(tab))return;
  this.close();
  // Entry links lead into live panels: leave pause first, since panels only
  // open while the simulation runs.
  try{if(this.ui&&!this.doc.querySelector('#pause-overlay')?.hidden)this.ui.closePause?.();}catch{}
  try{this.ui?.openPanel?.(tab);}catch{}
 }
 close(){
  if(this.overlay)this.overlay.hidden=true;
  const latest=latestVersion(this.feed);
  if(latest&&this.game?.state&&this.seen()!==latest){
   this.game.state.seenUpdatesVersion=latest;
   try{this.game.persist?.();}catch{}
  }
  this.updateBadge();
 }
 maybeAutoShow(){
  if(!this.feed.length||this.isOpen())return;
  if(this.seen()==null){
   let hadSave=false;
   try{hadSave=this.peekSave()!=null;}catch{hadSave=true;}
   // Fresh villages never saw an old version: mark quietly, no modal.
   if(!hadSave){this.close();return;}
  }
   const unseen=unseenEntries(this.feed,this.seen());
   if(unseen.length){this.open(unseen);try{this.onFresh?.(unseen);}catch{}}
 }
 updateBadge(){
  if(!this.newsButton)return;
  const n=this.unseen().length;
  this.newsButton.textContent=n>0?`What's new · ${n}`:"What's new";
 }
}
