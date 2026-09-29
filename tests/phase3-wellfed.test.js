import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,makeUnit,auras} from '../src/model.js';
import {tickVillage} from '../src/systems/village.js';
import {tickVillagerJobs} from '../src/systems/villagers.js';
import {mealConfig,mealCost,mealDay,mealStatus,tickTownMeal,wellFedBonus} from '../src/systems/food.js';
const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders']
  .map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const quiet=()=>{};
const stocked=w=>{w.resources.food=1000;w.resources.bread=100;return w;};

// ---- The daily meal, the basket and the day ----

test('phase3: the meal costs food and bread by mouth, once per game-day',()=>{
 const w=createWorld(data);
 assert.equal(w.lastMealDay,0,'fresh worlds start on day zero');
 assert.deepEqual(mealCost(w,data),{food:25,bread:5},'five mouths, five food and one loaf each');
 assert.equal(mealDay(w,data),0);
 assert.equal(tickTownMeal(w,data,quiet),null,'day zero is already eaten');
 stocked(w);w.elapsed=180;
 const first=tickTownMeal(w,data,quiet);
 assert.equal(first.served,true);
 assert.equal(w.resources.food,975,'the basket is drawn exactly');
 assert.equal(w.resources.bread,95);
 assert.equal(w.wellFed,true);
 assert.equal(tickTownMeal(w,data,quiet),null,'one meal per day, never two');
 w.elapsed=360;
 const second=tickTownMeal(w,data,quiet);
 assert.equal(second.served,true,'the next day asks again');
 assert.equal(w.resources.food,950);
});

test('phase3: a short table is never punished — no partial draw, no debt',()=>{
 const w=createWorld(data);
 w.resources.food=1000;w.resources.bread=0;w.elapsed=180;
 const short=tickTownMeal(w,data,quiet);
 assert.equal(short.served,false);
 assert.equal(short.reason,'short');
 assert.equal(w.resources.food,1000,'food is not drawn without the bread');
 assert.equal(w.resources.bread,0);
 assert.equal(w.wellFed,false);
 const w2=createWorld(data);
 w2.resources.food=0;w2.resources.bread=100;w2.elapsed=180;
 tickTownMeal(w2,data,quiet);
 assert.equal(w2.resources.bread,100,'bread is not drawn without the food');
 assert.equal(w2.wellFed,false);
});

test('phase3: Well Fed speaks when it arrives and when it fades, never nags',()=>{
 const w=createWorld(data);
 stocked(w);w.elapsed=180;
 let said='';
 tickTownMeal(w,data,m=>{said=m;});
 assert.equal(w.wellFed,true);
 assert.match(said,/Well Fed/,'the village hears about the good table');
 w.resources.bread=0;w.elapsed=360;
 said='';
 tickTownMeal(w,data,m=>{said=m;});
 assert.equal(w.wellFed,false);
 assert.match(said,/fades/,'losing the bonus is spoken once');
 said='';
 w.elapsed=540;
 tickTownMeal(w,data,m=>{said=m;});
 assert.equal(said,'','a bare table that stays bare is not nagged');
});

test('phase3: old saves without meal fields eat on their first new day',()=>{
 const w=createWorld(data);stocked(w);
 delete w.wellFed;delete w.lastMealDay;
 w.elapsed=200;
 const out=tickTownMeal(w,data,quiet);
 assert.equal(out.served,true,'a veteran save still gets supper');
 assert.equal(w.lastMealDay,mealDay(w,data));
 assert.equal(tickTownMeal(w,data,quiet),null,'and never twice');
});

// ---- The bonus, not the punishment ----

test('phase3: Well Fed lifts the aura table — data effects, known keys only',()=>{
 const base=createWorld(data);
 const fed=createWorld(data);fed.wellFed=true;
 const a=auras(base,data),b=auras(fed,data);
 assert.ok(Math.abs(b.gather-a.gather-0.08)<1e-9,'quicker hands');
 assert.ok(Math.abs(b.xp-a.xp-0.05)<1e-9,'warmer study');
 assert.ok(Math.abs(b.heal-a.heal-0.2)<1e-9,'softer recovery');
 assert.equal(b.carry,a.carry,'nothing else moves');
});

test('phase3: a covered table quickens the cradle a quarter',()=>{
 const run=fed=>{
  const g=new Game(data);const c=makeBuilding('cottage',2,5,data);g.world.buildings.push(c);
  g.world.resources.food=500;
  if(fed)g.world.wellFed=true;
  for(let i=0;i<10;i++)tickVillage(g.state,data,1,quiet);
  return g.world.childTimer;
 };
 const plain=run(false),fed=run(true);
 assert.ok(plain>9.9&&plain<10.1,`plain growth holds its rate (${plain})`);
 assert.ok(fed>12.4&&fed<12.6,`well fed growth runs a quarter hotter (${fed})`);
});

test('phase3: a covered table trains posted crews faster',()=>{
 const run=fed=>{
  const w=createWorld(data);w.troops=[];
  const shop=makeBuilding('sawmill',5,5,data);w.buildings.push(shop);
  const hand=makeUnit('sawyer',data);hand.workplace=shop.id;w.troops.push(hand);
  if(fed)w.wellFed=true;
  tickVillagerJobs(w,data,10);
  return hand.jobXp;
 };
 const plain=run(false),fed=run(true);
 assert.equal(plain,10,'a plain day trains at the base rate');
 assert.ok(Math.abs(fed-12.5)<1e-9,'a fed day trains a quarter faster');
});

test('phase3: an empty table threatens nobody — lives and work go on',()=>{
 const w=createWorld(data);
 const hp=w.troops.map(t=>t.hp);
 w.elapsed=180;
 tickTownMeal(w,data,quiet);
 assert.equal(w.wellFed,false);
 assert.deepEqual(w.troops.map(t=>t.hp),hp,'no one starves');
 assert.ok((w.resources.food||0)>=0&&(w.resources.bread||0)>=0,'no debt');
 assert.equal(wellFedBonus(w,data,'growth'),0);
 assert.equal(wellFedBonus(w,data,'jobXp'),0);
});

// ---- Data hygiene ----

test('phase3: meal tuning lives in data with safe fallbacks',()=>{
 const cfg=mealConfig(data);
 assert.equal(cfg.secondsPerDay,180);
 assert.equal(cfg.foodPerVillager,5);
 assert.equal(cfg.breadPerVillager,1);
 const fallback=mealConfig({});
 assert.equal(fallback.secondsPerDay,180,'missing data still feeds the town');
 assert.equal(fallback.wellFed.growth,0.25);
 const status=mealStatus(createWorld(data),data);
 assert.equal(status.wellFed,false);
 assert.equal(status.mouths,5);
 assert.ok(status.cost.food>0&&status.cost.bread>0);
});
