import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compareVersions,latestVersion,normalizeFeed,unseenEntries,NEWS_TABS,PatchNotes} from '../src/patchnotes.js';

const FEED=[
 {id:'b',version:'0.3.0',title:'B',body:'second',links:[{label:'Go',tab:'build'}]},
 {id:'a',version:'0.2.0',title:'A',body:'first',links:[]},
];
function fakeEl(){
 const el={hidden:true,disabled:false,textContent:'',innerHTML:'',className:'',type:'',children:[],dataset:{},handlers:{},
  addEventListener(n,fn){(this.handlers[n]??=[]).push(fn);},
  appendChild(c){this.children.push(c);return c;},
  querySelector(){return null;},querySelectorAll(){return [];},
  focus(){this.focused=true;},scrollIntoView(){},getClientRects(){return [1];},
  click(){if(typeof this.onclick==='function')this.onclick();for(const fn of this.handlers.click||[])fn();},
  key(handlers){this.handlers=handlers;}};
 return el;
}
function fakeDoc(){
 const els={'#news-overlay':fakeEl(),'#news-list':fakeEl(),'#news-close':fakeEl(),'#opt-news':fakeEl(),'#begin':fakeEl(),'#pause-overlay':fakeEl()};
 els['#pause-overlay'].hidden=true;
 const doc={created:[],
  querySelector:s=>els[s]||null,
  createElement:()=>{const e=fakeEl();doc.created.push(e);return e;},
  addEventListener(n,fn){(doc.handlers??={})[n]=fn;}};
 return {doc,els};
}
function setup({feed=FEED,state={},peekSave=null,ui=null}={}){
 const {doc,els}=fakeDoc();
 let persisted=0;
 const game={data:{updates:{entries:feed}},state:{...state},persist(){persisted++;return true;}};
 const notes=new PatchNotes(game,ui||{opened:[],openPanel(t){this.opened.push(t);}}, {doc,peekSave:peekSave||(()=>null)});
 return {notes,game,doc,els,get persisted(){return persisted;}};
}

test('versions compare numerically, not lexicographically',()=>{
 assert.equal(compareVersions('0.3.0','0.2.9'),1);
 assert.equal(compareVersions('0.2.9','0.3.0'),-1);
 assert.equal(compareVersions('0.10.0','0.9.0'),1);
 assert.equal(compareVersions('0.3.0','0.3.0'),0);
 assert.equal(compareVersions('1.0','1.0.0'),0);
 assert.equal(compareVersions('bogus','0.0.1'),-1);
});
test('feed normalizes newest-first and drops bad rows and bad tabs',()=>{
 const feed=normalizeFeed({entries:[
  {id:'old',version:'0.1.0',title:'Old',links:[{label:'X',tab:'nope'}]},
  {id:'',title:'No id'},
  {title:'No id at all'},
  {id:'new',version:'0.3.0',title:'New',links:[{label:'Ok',tab:'troops'}]},
  {id:'noversion',title:'No version'},
 ]});
 assert.deepEqual(feed.map(e=>e.id),['new','old','noversion']);
 assert.deepEqual(feed[0].links,[{label:'Ok',tab:'troops'}]);
 assert.deepEqual(feed[1].links,[]);
 assert.equal(feed[2].version,'0.0.0');
 assert.equal(latestVersion(feed),'0.3.0');
 assert.equal(latestVersion([]),null);
});
test('null seen-version means everything is unseen; filters cut by version',()=>{
 assert.equal(unseenEntries(FEED,null).length,2);
 assert.equal(unseenEntries(FEED,undefined).length,2);
 assert.deepEqual(unseenEntries(FEED,'0.2.0').map(e=>e.id),['b']);
 assert.deepEqual(unseenEntries(FEED,'0.3.0'),[]);
 assert.deepEqual(unseenEntries(FEED,'bogus').map(e=>e.id),['b','a']);
 assert.deepEqual(unseenEntries([],'bogus'),[]);
});
test('fresh villages stay quiet and mark the latest entry seen',()=>{
 const t=setup({peekSave:()=>null});
 t.notes.maybeAutoShow();
 assert.equal(t.els['#news-overlay'].hidden,true);
 assert.equal(t.game.state.seenUpdatesVersion,'0.3.0');
 assert.equal(t.persisted,1);
 assert.equal(t.els['#opt-news'].textContent,"What's new");
});
test('veteran saves without the flag get the full board once',()=>{
 const t=setup({peekSave:()=>11});
 t.notes.maybeAutoShow();
 assert.equal(t.els['#news-overlay'].hidden,false);
 assert.equal(t.els['#news-list'].children.length,2);
 assert.equal(t.els['#opt-news'].textContent,"What's new · 2");
 t.els['#news-close'].click();
 assert.equal(t.els['#news-overlay'].hidden,true);
 assert.equal(t.game.state.seenUpdatesVersion,'0.3.0');
 assert.equal(t.els['#opt-news'].textContent,"What's new");
});
test('up-to-date villages see no auto modal; the button still opens the board',()=>{
 const t=setup({state:{seenUpdatesVersion:'0.3.0'},peekSave:()=>11});
 t.notes.maybeAutoShow();
 assert.equal(t.els['#news-overlay'].hidden,true);
 t.els['#opt-news'].click();
 assert.equal(t.els['#news-overlay'].hidden,false);
 assert.equal(t.els['#news-list'].children.length,2);
});
test('only newer entries auto-show after an update lands',()=>{
 const t=setup({state:{seenUpdatesVersion:'0.2.0'},peekSave:()=>11});
 t.notes.maybeAutoShow();
 assert.equal(t.els['#news-list'].children.length,1);
 assert.equal(t.els['#news-list'].children[0].children[1].textContent,'B');
});
test('entry links close the board and open the matching panel',()=>{
 const ui={opened:[],closedPause:0,openPanel(t){this.opened.push(t);},closePause(){this.closedPause++;}};
 const t=setup({state:{seenUpdatesVersion:'0.2.0'},peekSave:()=>11,ui});
 t.els['#pause-overlay'].hidden=false;
 t.notes.maybeAutoShow();
 const link=t.doc.created.find(e=>e.dataset.newsTab==='build');
 assert.ok(link,'entry renders its panel link');
 t.notes.follow({target:link});
 assert.equal(t.els['#news-overlay'].hidden,true);
 assert.equal(ui.closedPause,1);
 assert.deepEqual(ui.opened,['build']);
 assert.equal(t.game.state.seenUpdatesVersion,'0.3.0');
});
test('Escape closes the board and marks it seen without touching pause',()=>{
 const t=setup({state:{seenUpdatesVersion:'0.2.0'},peekSave:()=>11});
 t.notes.maybeAutoShow();
 assert.equal(t.els['#news-overlay'].hidden,false);
 let stopped=false;
 t.doc.handlers.keydown({key:'Escape',preventDefault(){},stopPropagation(){stopped=true;}});
 assert.equal(stopped,true);
 assert.equal(t.els['#news-overlay'].hidden,true);
 assert.equal(t.game.state.seenUpdatesVersion,'0.3.0');
});
test('missing overlay elements never throw; broken storage never blocks',()=>{
 const game={data:{updates:{entries:FEED}},state:{},persist(){throw Error('no storage');}};
 const notes=new PatchNotes(game,{},{doc:{querySelector:()=>null,addEventListener(){}},peekSave:()=>{throw Error('denied');}});
 assert.doesNotThrow(()=>{notes.maybeAutoShow();notes.open(FEED);notes.close();notes.updateBadge();});
});
test('shipped data/updates.json is valid: unique ids, real versions, known tabs',async()=>{
 const raw=JSON.parse(await readFile(new URL('../data/updates.json',import.meta.url),'utf8'));
 const feed=normalizeFeed(raw);
 assert.ok(feed.length>=3,'board ships with real entries');
 assert.equal(new Set(feed.map(e=>e.id)).size,feed.length,'entry ids unique');
 for(const e of feed){
  assert.ok(e.title&&e.body,`${e.id} has copy`);
  assert.match(e.version,/^\d+\.\d+\.\d+$/,e.id);
  for(const l of e.links)assert.ok(NEWS_TABS.includes(l.tab),`${e.id} link tab`);
 }
});
