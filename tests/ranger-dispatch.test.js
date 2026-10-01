import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {makeUnit} from '../src/model.js';
import {rangingPlans, expeditionQuote, expeditionReason, startExpedition, recallExpedition, tickExpeditions, rollReturn, skyRisk} from '../src/systems/expeditions.js';
import {expeditionRoster, computeNextAction} from '../src/adventure.js';
import {rangingCards, rangingClick} from '../src/ranging-ui.js';
import {exportSave, importSaveBlob} from '../src/storage.js';

const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','expansion','biomes','artifacts'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const lucky = () => 0.999;
function fixture(type = 'forager') {
  const g = new Game(structuredClone(data));
  const u = makeUnit(type, g.data);
  g.world.troops = [u]; g.world.enemies = []; g.world.raidPending = null;
  g.world.night = false; g.world.weather = 'clear';
  g.world.resources = {...g.world.resources, wood: 0, food: 0};
  return {g, w: g.world, u, d: g.data};
}
function gather(f, plan = 'standard') {
  assert.equal(startExpedition(f.w, f.d, f.u, lucky, plan), true);
  f.u.x = f.u.expedition.entryX; f.u.y = f.u.expedition.entryY;
  tickExpeditions(f.w, f.d, 0.1, lucky);
  assert.equal(f.u.expedition.phase, 'gather');
}
function home(f, rng = lucky) {
  f.u.x = f.u.expedition.homeX; f.u.y = f.u.expedition.homeY;
  tickExpeditions(f.w, f.d, 0.1, rng, {state:f.g.state});
}

test('standard quotes preserve legacy rewards while plans trade time, yields and intel', () => {
  const {w,d,u} = fixture();
  const standard = expeditionQuote(w,d,u);
  assert.deepEqual(standard.yields, d.troops.forager.expedition.yields);
  assert.equal(standard.durationSec, 60); assert.equal(standard.risk, 0.1);
  const supply = expeditionQuote(w,d,u,'provisions');
  assert.deepEqual(supply.yields, {food:37,wood:22});
  assert.equal(supply.durationSec, 90); assert.equal(supply.risk, 0.13);
  const survey = expeditionQuote(w,d,u,'survey');
  assert.deepEqual(survey.yields, {food:18,wood:11});
  assert.equal(survey.durationSec, 90); assert.equal(survey.intelChance, 0.75);
  assert.equal(expeditionQuote(w,d,u,'bogus'), null);
  const before = structuredClone(u);
  assert.equal(startExpedition(w,d,u,lucky,'bogus'), false);
  assert.deepEqual(u,before);
});

test('plans are generic, validated and optional for thin/older data', () => {
  const {w,d,u} = fixture('scout');
  delete d.artifacts;
  assert.deepEqual(rangingPlans(d).map(p => p.id), ['standard']);
  assert.equal(startExpedition(w,d,u,lucky), true);
  d.artifacts = {rangingPlans:{free:{name:'Free',durationMult:0,yieldMult:100,riskAdd:0,intelMult:100}}};
  assert.deepEqual(rangingPlans(d).map(p => p.id), ['standard']);
});

test('preview sky risk matches return roll and survey changes only intel probability', () => {
  const f = fixture(); f.w.night = true; f.w.weather = 'fog';
  const quote = expeditionQuote(f.w,f.d,f.u,'survey');
  gather(f,'survey');
  assert.equal(quote.risk, f.u.expedition.risk + skyRisk(f.w,f.d));
  assert.equal(rollReturn(f.w,f.d,f.u,() => quote.risk - 0.001).mishap,true);
  f.w.night = false; f.w.weather = 'clear';
  const rng = () => 0.6;
  const survey = rollReturn(f.w,f.d,f.u,rng);
  assert.ok(survey.intel); assert.equal(survey.artifactId,null); assert.equal(survey.rescueType,null);
  f.u.expedition.intelMult = 1;
  assert.equal(rollReturn(f.w,f.d,f.u,rng).intel,null);
});

test('busy dispatches spend nothing and preserve cargo, orders and workplace', () => {
  const f = fixture(); f.u.workplace = f.w.buildings[0].id;
  for (const [key,value] of [['carry',12],['order',{kind:'hold'}],['builderTask',{kind:'repair'}],['emergency',{kind:'shelter'}],['shelteredIn','hall']]) {
    f.u[key] = value;
    const before = structuredClone(f.u), resources = {...f.w.resources};
    assert.ok(expeditionReason(f.w,f.d,f.u));
    assert.equal(f.g.sendExpedition(f.u.id),false);
    assert.deepEqual(f.u,before); assert.deepEqual(f.w.resources,resources);
    delete f.u[key];
  }
  assert.equal(f.g.sendExpedition(f.u.id),true);
  assert.equal(f.u.workplace,f.w.buildings[0].id);
});

test('alarm and campaign block new dispatch; recall still works during a home raid', () => {
  const f = fixture();
  f.w.raidPending = {timer:10}; assert.equal(f.g.sendExpedition(f.u.id),false);
  f.w.raidPending = null; f.w.enemies = [{hp:10}]; assert.equal(f.g.sendExpedition(f.u.id),false);
  f.w.enemies = []; f.g.state.mission = {id:'first-harvest'};
  assert.equal(f.g.sendExpedition(f.u.id),false);
  f.g.state.mission = null; gather(f);
  f.w.raidPending = {timer:10}; assert.equal(f.g.recallRanger(f.u.id),true);
  assert.equal(f.u.expedition.phase,'back');
});

test('recall halfway returns earned materials once, restores the post and rolls no finds', () => {
  const f = fixture(); f.u.workplace = f.w.buildings[0].id;
  gather(f,'provisions'); tickExpeditions(f.w,f.d,45,lucky);
  assert.equal(recallExpedition(f.w,f.d,f.u),true);
  assert.deepEqual(f.u.expedition.yields,{food:18,wood:11});
  assert.equal(f.u.expedition.offgrid,false);
  assert.equal(recallExpedition(f.w,f.d,f.u),false);
  let calls = 0;
  const manifest = rollReturn(f.w,f.d,f.u,() => { calls++; return 0.999; });
  assert.equal(calls,1,'only the earned-material mishap roll remains');
  assert.equal(manifest.salvage,0); assert.equal(manifest.intel,null);
  assert.equal(manifest.artifactId,null); assert.equal(manifest.rescueType,null);
  home(f);
  assert.equal(f.w.resources.food,18); assert.equal(f.w.resources.wood,11);
  assert.equal(f.u.expedition,null); assert.equal(f.u.workplace,f.w.buildings[0].id);
  assert.match(f.w.lastReturn.lines.join(' '), /\+18 food.*recalled/);
  assert.equal(f.w.artifacts,undefined); assert.equal(f.w.scoutBonus,undefined);
  tickExpeditions(f.w,f.d,20,lucky);
  assert.equal(f.w.resources.food,18); assert.equal(f.w.expeditionLog.length,1);
});

test('outbound recall keeps position and pays nothing, even with the luckiest RNG', () => {
  const f = fixture(); startExpedition(f.w,f.d,f.u);
  const x = f.u.x, y = f.u.y;
  assert.equal(recallExpedition(f.w,f.d,f.u),true);
  assert.equal(f.u.x,x); assert.equal(f.u.y,y);
  home(f,() => {throw Error('An empty recalled trip must not roll rewards.');});
  assert.equal(f.w.resources.food,0); assert.equal(f.w.resources.wood,0);
  assert.equal(f.g.state.research?.points || 0,0);
});

test('recalled haul still risks mishaps and storage overflow stays on the ledger', () => {
  const f = fixture(); gather(f); tickExpeditions(f.w,f.d,30,lucky);
  recallExpedition(f.w,f.d,f.u); home(f,() => 0);
  assert.equal(f.w.resources.food,6); assert.equal(f.w.resources.wood,3);
  const capped = fixture(); capped.w.resources.food = 1e6;
  gather(capped); tickExpeditions(capped.w,capped.d,30,lucky);
  recallExpedition(capped.w,capped.d,capped.u); home(capped);
  assert.equal(capped.w.resources.food,1e6);
  assert.equal(capped.w.pendingRewards.food,12);
});

test('active planned and recalled trips survive portable save round trips; old trips still finish', () => {
  const f = fixture(); gather(f,'survey'); tickExpeditions(f.w,f.d,30,lucky);
  let loaded = importSaveBlob(exportSave(f.g.state), f.d);
  assert.equal(loaded.ok,true);
  const u = loaded.state.world.troops[0];
  assert.equal(u.expedition.planId,'survey'); assert.equal(u.expedition.timer,60);
  assert.equal(recallExpedition(loaded.state.world,f.d,u),true);
  loaded = importSaveBlob(exportSave(loaded.state), f.d);
  assert.equal(loaded.ok,true); assert.equal(loaded.state.world.troops[0].expedition.recalled,true);
  const old = fixture(); gather(old);
  delete old.u.expedition.planId; delete old.u.expedition.intelMult;
  tickExpeditions(old.w,old.d,60,lucky); home(old);
  assert.equal(old.w.resources.food,25); assert.equal(old.w.resources.wood,15);
});

test('roster/home suggestions show true readiness and cards escape names with current weather odds', () => {
  const f = fixture(); f.u.name = '<img onerror="bad">'; f.u.carry = 10;
  f.g.state.questsCompleted = f.d.quests.map(q => q.id);
  f.g.state.completed = f.d.missions.map(m => m.id);
  const roster = expeditionRoster(f.w,f.d);
  assert.match(roster.idle[0].reason,/delivery/);
  assert.notEqual(computeNextAction(f.g.state,f.d).kind,'expedition');
  let cards = rangingCards(f.g,roster);
  assert.equal(cards.ready,0); assert.ok(cards.idleHtml.includes('&lt;img'));
  assert.ok(!cards.idleHtml.includes('<img onerror'));
  assert.match(cards.idleHtml,/Send ranger →<\/button>/);
  assert.match(cards.idleHtml,/disabled/);
  f.u.carry = 0; f.w.night = true;
  cards = rangingCards(f.g,expeditionRoster(f.w,f.d));
  assert.equal(cards.ready,1);
  assert.ok(cards.idleHtml.includes(`${Math.round(expeditionQuote(f.w,f.d,f.u).risk * 100)}% mishap now`));
});

test('delegated ranging controls reject stale commands and preserve standard Home dispatch', () => {
  const f = fixture();
  assert.equal(rangingClick(f.g,{dataset:{expedition:f.u.id}}),true);
  assert.equal(f.u.expedition.planId,'standard');
  assert.equal(rangingClick(f.g,{dataset:{recallRanger:f.u.id}}),true);
  assert.equal(f.u.expedition.recalled,true);
  const haul = {...f.u.expedition.yields};
  rangingClick(f.g,{dataset:{recallRanger:f.u.id}});
  assert.deepEqual(f.u.expedition.yields,haul);
  assert.equal(rangingClick(f.g,{dataset:{other:'x'}}),false);
});
