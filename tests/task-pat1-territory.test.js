import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Game} from '../src/game.js';
import {createWorld, makeUnit, inBounds, canPlace} from '../src/model.js';
import {claimCheck, claimRegion, regionById, isRegionClaimed} from '../src/systems/expansion.js';
import {directorPatrol, territoryPatrol, ensureDirector, scheduleRecovery} from '../src/systems/raid-director.js';
import {spawnRaid, spawnExclusion} from '../src/systems/combat.js';
import {bossFor} from '../src/systems/endgame.js';
import {conquestState, tribeOf, readinessReason, assaultReason, recordAssault,
  applyAnnex, conquestAuraEffects, conquestLimitBonus} from '../src/systems/conquest.js';
import {finishMission} from '../src/systems/campaign.js';
import {tickTownSupply} from '../src/systems/food.js';
import {exportSave, importSaveBlob, VERSION} from '../src/storage.js';

const data = Object.fromEntries(await Promise.all(
  ['world','troops','items','abilities','buildings','missions','quests','levels','calendar',
    'traders','endgame','festivals','conquest','expansion','biomes']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const cores = [['whisperwood','thornband','raider','thornband'],
  ['ashfall-march','cinder','breaker','cinder-clan'],
  ['pale-coast','palehost','bowman','pale-host'],
  ['starwatch-ridge','ember','breaker','ember-legion']];
const legacy = structuredClone(data);
for (const region of legacy.expansion.regions) delete region.tribe;
function game(definition = data) {
  const g = new Game(definition);
  g.state = {...g.state, world:createWorld(definition), home:null, mission:null,
    completed:[], vlevel:11, xp:0};
  g.world.renown = 6;
  g.world.autoTrain = false;
  const b = g.world.buildings.find(b => b.type === 'barracks');
  b.level = 3; b.hp = definition.buildings.barracks.tiers[2].hp; b.remaining = 0;
  g.world.troops = Array.from({length:14}, () => makeUnit('warrior', definition));
  for (const key of Object.keys(g.world.resources)) g.world.resources[key] = 99999;
  return g;
}
function border(g, region) {
  // Reach the core without testing the unrelated prerequisite claim chain.
  const x = region.rect.x > 0 ? region.rect.x-1 : region.rect.x+region.rect.w;
  g.world.tiles.find(t => t.x === x && t.y === region.rect.y).claimed = true;
}
function due(g, wave) {
  ensureDirector(g.world,g.data);
  g.world.wave = wave; g.world.elapsed = 1000; g.world.nextRaidAt = 1000;
  g.tick(.05);
}

test('PAT1: four core regions refuse without spending, name their tribe, and open after assault', () => {
  assert.deepEqual(data.expansion.regions.filter(r => r.tribe).map(r => [r.id,r.tribe]).sort(),
    cores.map(([id,tribe]) => [id,tribe]).sort());
  assert.ok(!data.expansion.regions.some(r => r.tribe === 'ironshield'), 'no Ironshield valley region');
  for (const [id,tribe] of cores) {
    const g = game(), region = regionById(data.expansion,id); border(g,region);
    const before = JSON.stringify(g.world);
    assert.equal(g.expandClaim(region.rect.x,region.rect.y), false);
    assert.ok(g.message.includes(tribeOf(data,tribe).name));
    assert.equal(JSON.stringify(g.world), before, 'refusal writes nothing');
    recordAssault(g.world,tribe);
    const resources = {...g.world.resources};
    assert.equal(g.expandClaim(region.rect.x,region.rect.y), true);
    assert.equal(isRegionClaimed(g.world,region), true);
    for (const [key,cost] of Object.entries(region.cost)) assert.equal(g.world.resources[key],resources[key]-cost);
  }
});

test('PAT1: grandfathered regions stay claimed and buildable with undefeated tribes', () => {
  for (const [id,tribe] of cores) {
    const g = game(), region = regionById(data.expansion,id);
    claimRegion(g.world,region);
    assert.equal(conquestState(g.world,tribe).assaultWon,false);
    assert.equal(isRegionClaimed(g.world,region),true);
    assert.equal(claimCheck(g.world,data.expansion,data.world,region.rect.x,region.rect.y).reason,'claimed');
    const x = region.rect.x+1, y = region.rect.y+1;
    assert.equal(inBounds(g.world,data,'wall',x,y),true);
    assert.equal(canPlace(g.world,data,'wall',x,y),true);
    const imported = importSaveBlob(exportSave(g.state),data);
    assert.equal(imported.ok,true);
    assert.equal(isRegionClaimed(imported.state.world,region),true);
    assert.equal(conquestState(imported.state.world,tribe).assaultWon,false);
  }
});

test('PAT1: unrelated region claims retain legacy checks, cost and tile outcomes', () => {
  for (const region of data.expansion.regions.filter(r => !r.tribe)) {
    const modern = game(), old = game(legacy); old.state = structuredClone(modern.state);
    if (!region.preclaimed) border(modern,region), border(old,region);
    const {x,y} = region.rect;
    assert.deepEqual(claimCheck(modern.world,data.expansion,data.world,x,y),claimCheck(old.world,legacy.expansion,legacy.world,x,y));
    assert.equal(modern.expandClaim(x,y),old.expandClaim(x,y));
    assert.equal(modern.message,old.message);
    assert.equal(JSON.stringify(modern.world),JSON.stringify(old.world));
  }
});

test('PAT1: director patrols use each existing pressure role and strict spawn exclusion', () => {
  for (const [id,tribe,role,faction] of cores) {
    const g = game();
    for (const [,other] of cores) if (other !== tribe) recordAssault(g.world,other);
    const notices = [];
    const notify = g.notify.bind(g);
    g.notify = message => {notices.push(message); notify(message);};
    // Wave twelve is a normal, non-crown horn at this village level.
    assert.equal(bossFor(data,11,12),null);
    due(g,11);
    const pending = g.world.raidPending;
    assert.equal(pending.patrol,tribe); assert.ok(pending.count >= 2 && pending.count <= 4);
    assert.ok(notices.some(message => message.includes(tribeOf(data,tribe).name) && message.includes('seconds to positions')));
    const exclusion = spawnExclusion(g.world,data);
    g.tick(.05); assert.equal(g.world.raidPending,pending,'one warning slot');
    pending.timer = 0; g.tick(.05);
    assert.equal(g.world.raidPending,null);
    assert.equal(g.world.enemies.length,pending.count);
    for (const e of g.world.enemies) {
      assert.equal(e.role,role); assert.equal(e.faction,faction);
      assert.equal(exclusion.has(`${Math.floor(e.x)},${Math.floor(e.y)}`),false);
    }
    // Saturate the full navigation grid: the unsafe legacy fallback must not run.
    const w = createWorld(data); w.bounds = {w:data.world.width,h:data.world.height};
    w.buildings = w.tiles.map(t => ({type:'wall',x:t.x,y:t.y,hp:1,remaining:0,level:1}));
    const patrol = territoryPatrol({...w,wave:9},data,tribe,11);
    spawnRaid(w,4,null,data,patrol.faction,{strictExclusion:true});
    assert.equal(w.enemies.length,0,'no safe footprint means no materialized enemies');
    assert.equal(regionById(data.expansion,id).tribe,tribe);
  }
});

test('PAT1: victory permanently stops territory patrols, including a saved pending warning', () => {
  for (const [,tribe] of cores) {
    const g = game();
    for (const [,other] of cores) if (other !== tribe) recordAssault(g.world,other);
    due(g,11); assert.equal(g.world.raidPending.patrol,tribe);
    recordAssault(g.world,tribe);
    const imported = importSaveBlob(exportSave(g.state),data); assert.equal(imported.ok,true);
    g.state = imported.state;
    g.world.raidPending.timer = 0; g.tick(.05);
    assert.equal(g.world.enemies.length,0); assert.equal(g.world.wave,11);
    assert.equal(g.world.raidPending,null); assert.ok(g.world.nextRaidAt > g.world.elapsed);
    for (let wave = 1; wave <= 200; wave++) {
      g.world.wave = wave;
      assert.equal(territoryPatrol(g.world,data,tribe,11),null);
      assert.equal(directorPatrol(g.state,data),null);
    }
  }
  const first = game(); due(first,0); assert.equal(first.world.raidPending.count,2);
  assert.equal(first.world.raidPending.patrol,undefined);
  const crown = game(); due(crown,9);
  assert.ok(crown.world.raidPending.boss); assert.equal(crown.world.raidPending.patrol,undefined);
  const recovery = game(); recovery.world.wave = 9; recovery.world.elapsed = 1000;
  scheduleRecovery(recovery.state,data,true,()=>0); recovery.tick(.05);
  assert.equal(recovery.world.raidPending ?? null,null);
  recovery.state.mission = {status:'active'}; assert.equal(directorPatrol(recovery.state,data),null);
});

 test('PAT1: pinned campaign/conquest data and Ironshield end-to-end laws and ledgers stay unchanged', () => {
  // SHA-256 of parsed pre-PAT1 HEAD data; runnable without Git history in CI.
  // J1 appends ix-ashen-crown + the Ashen Warlord additively; J2 orders the arc 34-36 with the crown at 39; J3 branches at shared chapter 37; J4 reconverges at 38 — deliberate pin update.
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  assert.equal(hash(data.missions),'1ac25f579f6cdfa72c33f3f854474694db00b34b1fdb3989d62ed01bec56f96f');
  assert.equal(hash(data.conquest),'2f61ee3b3a3977aaa59896de45879f448bc1f59d1172eaaec67091f741942cae');
  for (const choice of ['outpost','settlement','dismantle']) {
    const modern = game(), old = game(legacy); old.state = structuredClone(modern.state);
    for (const level of [1,11]) {
      modern.state.vlevel = old.state.vlevel = level;
      assert.equal(readinessReason(modern.state,data),readinessReason(old.state,legacy));
      assert.equal(assaultReason(modern.state,data),assaultReason(old.state,legacy));
    }
    assert.deepEqual(modern.scoutTribe(),old.scoutTribe());
    for (const mid of [...data.conquest.tribe.preliminaries.map(p => p.id),data.conquest.tribe.assault]) {
      const requires = data.missions.find(m => m.id === mid).requires;
      modern.state.completed.push(...requires); old.state.completed.push(...requires);
      modern.mission(mid); old.mission(mid);
      assert.equal(modern.state.mission?.id,mid); assert.equal(old.state.mission?.id,mid);
      modern.state.mission.status = old.state.mission.status = 'won';
      assert.deepEqual(finishMission(modern.state,data),finishMission(old.state,legacy));
      assert.equal(JSON.stringify(modern.state),JSON.stringify(old.state));
    }
    assert.deepEqual(applyAnnex(modern.state,data,choice),applyAnnex(old.state,legacy,choice));
    for (const elapsed of [180,180,360,1800]) {
      modern.world.elapsed = old.world.elapsed = elapsed;
      if (elapsed === 360) modern.world.resources.food = old.world.resources.food = 0;
      const a = [], b = [];
      assert.deepEqual(tickTownSupply(modern.world,data,n => a.push(n)),tickTownSupply(old.world,legacy,n => b.push(n)));
      assert.equal(JSON.stringify(modern.world),JSON.stringify(old.world)); assert.deepEqual(a,b);
      assert.deepEqual(conquestAuraEffects(modern.world,data),conquestAuraEffects(old.world,legacy));
      assert.equal(conquestLimitBonus(modern.world,data),conquestLimitBonus(old.world,legacy));
    }
  }
});

test('PAT1: refused claims and old-save imports add no world fields or save version', () => {
  assert.equal(VERSION,15);
  const g = game(), region = regionById(data.expansion,'whisperwood'); border(g,region);
  const before = exportSave(g.state), keys = Object.keys(g.world);
  assert.equal(g.expandClaim(region.rect.x,region.rect.y),false);
  assert.equal(exportSave(g.state),before);
  const out = importSaveBlob(before,data); assert.equal(out.ok,true);
  assert.deepEqual(Object.keys(out.state.world),keys);
  assert.equal(out.state.world.conquest,undefined);
  assert.equal(isRegionClaimed(out.state.world,region),false);
  assert.equal(claimCheck(out.state.world,data.expansion,data.world,region.rect.x,region.rect.y).reason,'tribe');
  const prior = JSON.parse(before); prior.version = 13;
  const modern = importSaveBlob(JSON.stringify(prior),data), old = importSaveBlob(JSON.stringify(prior),legacy);
  assert.equal(modern.ok,true); assert.equal(old.ok,true);
  assert.equal(JSON.stringify(modern.state),JSON.stringify(old.state));
});
