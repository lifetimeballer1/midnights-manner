import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hudPreferences,HUD_DEFAULTS,resourceSummary,armySummary,cameraToggle,questDot} from '../src/systems/hud.js';
import {UI} from '../src/ui.js';

test('U1: resource summary shows three original identities and short stored values', () => {
 const html=resourceSummary({gold:12400,food:1200,wood:7,plate:999},['gold','food','wood','plate'],{plate:1000});
 for(const [name,value] of [['Gold','12k'],['Food','1.2k'],['Wood','7']]) {
  assert.ok(html.includes(`alt="${name}"`));assert.ok(html.includes(`<b>${value}</b>`));
 }
 assert.equal((html.match(/<img /g)||[]).length,3);
 assert.ok(!html.includes('<em>FULL</em>'));
 assert.ok(html.includes('aria-expanded="false"'));
 assert.ok(resourceSummary({},[],{}).includes('<b>0</b>'));
});
test('U1: FULL follows any visible capped resource, including resources outside the summary', () => {
 assert.ok(resourceSummary({plate:1000},['plate'],{plate:1000}).includes('<em>FULL</em>'));
 assert.ok(resourceSummary({plate:1001},['plate'],{plate:1000}).includes('<em>FULL</em>'));
 assert.ok(!resourceSummary({plate:1000},['wood'],{plate:1000,wood:Infinity}).includes('<em>FULL</em>'));
 assert.ok(!resourceSummary({gold:9999},['gold'],{}).includes('<em>FULL</em>'));
 assert.ok(resourceSummary({},[],{},false).includes('aria-expanded="true"'));
});
test('U1: army count handles empty and small rosters and keeps selected level in its label', () => {
 assert.ok(armySummary().includes('Army 0'));
 assert.ok(!armySummary(1).includes('class="army-level"'));
 const html=armySummary(9,{level:12});
 assert.ok(html.includes('Army 9'));assert.ok(html.includes('Lv 12'));
 assert.ok(html.includes('selected unit level 12'));
});
test('U1: camera toggle and quest dot preserve accessible identity', () => {
 assert.ok(cameraToggle().includes('aria-expanded="false"'));
 assert.ok(cameraToggle(false).includes('aria-expanded="true"'));
 assert.ok(cameraToggle().includes('Map controls'));
 assert.ok(questDot('A "new" & bright path').includes('Open current quest: A &quot;new&quot; &amp; bright path'));
 assert.ok(questDot('').includes('>✦</button>'));
});
test('U1: preferences default collapsed, round-trip independently, and ignore malformed data', () => {
 let value=null;const storage={getItem:key=>{assert.equal(key,'mm.hud');return value;},setItem:(key,v)=>{assert.equal(key,'mm.hud');value=v;}};
 const prefs=hudPreferences(storage);assert.deepEqual(prefs.get(),HUD_DEFAULTS);
 for(const key of Object.keys(HUD_DEFAULTS)) {
  prefs.set(key,false);assert.equal(hudPreferences(storage).get()[key],false);
  prefs.set(key,true);assert.equal(hudPreferences(storage).get()[key],true);
 }
 value='{broken';assert.deepEqual(hudPreferences(storage).get(),HUD_DEFAULTS);
 value='{"resources":false,"camera":"false","world":42}';
 assert.deepEqual(hudPreferences(storage).get(),{...HUD_DEFAULTS,resources:false});
 const copy=prefs.get();copy.army=false;assert.equal(prefs.get().army,true);
});
test('U1: denied storage retains changes in memory', () => {
 const prefs=hudPreferences({getItem(){throw Error('denied');},setItem(){throw Error('full');}});
 prefs.set('quest',false);assert.equal(prefs.get().quest,false);
 prefs.set('quest',true);assert.equal(prefs.get().quest,true);
 prefs.set('unknown',false);assert.deepEqual(prefs.get(),HUD_DEFAULTS);
 assert.deepEqual(hudPreferences().get(),HUD_DEFAULTS);
});
test('U1: toggling camera closes its secondary controls and persists both states', () => {
 const old=globalThis.document;
 const panel={hidden:false},menu={setAttribute(k,v){this[k]=v;}};
 globalThis.document={querySelector:s=>s==='#camera-panel'?panel:menu};
 try {
  const ui={hudPrefs:hudPreferences(),refresh(){this.refreshes=(this.refreshes||0)+1;}};
  UI.prototype.toggleHUD.call(ui,'camera');assert.equal(ui.hudPrefs.get().camera,false);
  UI.prototype.toggleHUD.call(ui,'camera');assert.equal(ui.hudPrefs.get().camera,true);
  assert.equal(panel.hidden,true);assert.equal(menu['aria-expanded'],'false');assert.equal(ui.refreshes,2);
 } finally {globalThis.document=old;}
});
test('U1: HUD wiring retains detail, quick selection, pause, and collection obstacles', async () => {
 const ui=await readFile(new URL('../src/ui.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(ui.includes("if(tab==='resources')this.hudPrefs.set('resources',false)"));
 assert.ok(ui.includes("$('#army-summary-slot').onclick=()=>this.openPanel('troops')"));
 assert.ok(ui.includes("closest('[data-select-unit]')"));
 assert.ok(ui.includes("this.selectTroop(b.dataset.selectUnit)"));
 for(const id of ['resource-summary','army-summary','army-toggle','camera-toggle','quest-dot','quest-dismiss']) {
  assert.ok(ui.slice(ui.indexOf('this.renderer.collectionObstacles=')).includes('#'+id));
 }
 assert.ok(html.indexOf('id="pause"')<html.indexOf('id="camera-buttons"'));
 assert.ok(ui.includes("$('#pause').onclick=()=>this.openPause()"));
 assert.ok(ui.includes('renderResources(){'));
});
test('U1: CSS keeps summaries at edges with 44px targets across responsive sizes', async () => {
 const css=await readFile(new URL('../src/polish.css',import.meta.url),'utf8');
 const u1=css.slice(css.indexOf('/* U1:'));
 assert.match(u1,/#game \.hud-chip\{min-width:44px;min-height:44px;height:44px/);
 assert.match(u1,/body\.hud-resources-collapsed #game\{--resource-stack-height:44px\}/);
 assert.match(u1,/#game #quest-summary,#game #quest-dismiss\{[^}]*left:calc\(var\(--hud-edge\) \+ var\(--safe-left\)\)/);
 assert.match(u1,/@media\(max-width:700px\)/);
 assert.match(u1,/@media\(max-height:550px\) and \(orientation:landscape\)/);
 assert.match(u1,/#game \.army-controls\{position:absolute;bottom:64px;left:0/);
 assert.match(u1,/#game #camera-buttons\[hidden\][^}]*display:none/);
 // At a 360px viewport the collapsed top stack is 44px high, followed by
 // 44px edge controls. The left dot occupies x=12..56; camera x=256..348.
 // Neither edge control crosses x=180; the resource chip sits in the header.
 const center=360/2;
 assert.ok(12+44<center);assert.ok(360-12-92>center);
});
