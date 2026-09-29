import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,makeUnit,auras,reviveFraction} from '../src/model.js';
import {tickVillage} from '../src/systems/village.js';
import {tickVillagerJobs} from '../src/systems/villagers.js';
import {performTrade,dealsFor} from '../src/systems/calendar.js';
import {
 warChestList,warChestLevel,warChestMax,warChestTotal,warChestArmed,warChestBonus,
 warChestRecovery,warChestOpenable,warChestMinLevel,
} from '../src/systems/warchest.js';
import {festivalList,festivalActive,festivalCooldownLeft,festivalReason,beginFestival,festivalBonus,festivalAuraEffects} from '../src/systems/festivals.js';
const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals']
  .map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const quiet=()=>{};
const rich=g=>{g.world.resources={wood:99999,food:99999,gold:99999,lumber:9999,plate:9999,frostwood:9999,flour:9999,bread:9999};return g;};
// Commands persist; the save fallback is shared across tests in one process,
// so every test starts from an explicit fresh world (the phase12 pattern).
const fresh=()=>{const g=new Game(data);g.state={...g.state,world:createWorld(data),home:null,mission:null};return g;};
const home=(vlevel=9)=>{const g=rich(fresh());g.state.vlevel=vlevel;return g;};

// ---- War Chest: stock, open, burn ----

test('phase6: war-chest data is combat-only and fully costed',()=>{
 assert.equal(warChestMinLevel(data),5);
 const list=warChestList(data);
 assert.equal(list.length,5,'five investments');
 const allowed=new Set(['heal','revive','damage','armor','wallGuard','slow','repairBuildings']);
 for(const inv of list){
  assert.ok(inv.name&&inv.text&&inv.cost&&Object.keys(inv.cost).length,`${inv.id} carries name, text and a cost`);
  assert.ok(inv.max>=1,`${inv.id} has a cap`);
  for(const k of Object.keys(inv.perLevel||{}))assert.ok(allowed.has(k),`${inv.id} effect ${k} is a combat key`);
 }
});

test('phase6: preparing the chest pays exactly, gates by level and caps out',()=>{
 const g=home(4);
 g.prepareWarChest('arrows');
 assert.equal(warChestLevel(g.world,'arrows'),0,'below the gate nothing stocks');
 assert.match(g.message,/village level 5/);
 g.state.vlevel=5;
 const before=structuredClone(g.world.resources),cost=data.world.warChest.investments.find(i=>i.id==='arrows').cost;
 assert.equal(g.prepareWarChest('arrows'),true);
 for(const [k,v] of Object.entries(cost))assert.equal(g.world.resources[k],before[k]-v,`${k} paid exactly`);
 assert.equal(warChestLevel(g.world,'arrows'),1);
 g.prepareWarChest('arrows');g.prepareWarChest('arrows');
 assert.equal(warChestLevel(g.world,'arrows'),3,'stocks to the cap');
 assert.equal(g.prepareWarChest('arrows'),undefined,'the cap holds');
 assert.match(g.message,/fully stocked/);
});

test('phase6: the chest only opens for a raid on the road',()=>{
 const g=home();
 assert.equal(g.openWarChest(),undefined,'empty chest refuses');
 assert.match(g.message,/empty/);
 g.prepareWarChest('armor');
 assert.equal(g.openWarChest(),undefined,'no raid, no opening');
 assert.match(g.message,/on the road/);
 g.world.raidPending={timer:5,count:1};
 assert.equal(warChestOpenable(g.world,data),true);
 assert.equal(g.openWarChest(),true);
 assert.equal(warChestArmed(g.world),true);
 assert.equal(g.openWarChest(),undefined,'already open');
});

test('phase6: an open chest bends combat numbers only while it is open',()=>{
 const w=createWorld(data);
 w.warChest={arrows:2,armor:1,rations:1};
 const closed=auras(w,data);
 assert.equal(warChestBonus(w,data,'damage'),0,'closed chest bends nothing');
 w.warChestArmed=true;
 assert.ok(Math.abs(warChestBonus(w,data,'damage')-0.06)<1e-9,'two arrow stocks');
 const open=auras(w,data);
 assert.ok(Math.abs(open.damage-closed.damage-0.06)<1e-9,'aura damage rises');
 assert.ok(Math.abs(open.armor-closed.armor-0.03)<1e-9,'aura armor rises');
 assert.ok(Math.abs(open.heal-closed.heal-0.25)<1e-9,'rations mend');
 assert.equal(open.gather,closed.gather,'production never moves');
});

test('phase6: rations raise the fallen, stakes blunt walls, wagons repair',()=>{
 const w=createWorld(data);
 assert.ok(Math.abs(reviveFraction(w,data)-0.3)<1e-9,'cold ground holds the baseline');
 w.warChest={rations:2,stakes:2,wagons:1};w.warChestArmed=true;
 assert.ok(Math.abs(reviveFraction(w,data)-0.5)<1e-9,'rations lift two tenths');
 assert.ok(Math.abs(warChestBonus(w,data,'wallGuard')-0.24)<1e-9);
 assert.ok(Math.abs(warChestBonus(w,data,'slow')-0.1)<1e-9);
 const farm=w.buildings.find(b=>b.type==='farm');
 const tower=w.buildings.find(b=>b.type==='tower');
 farm.hp=1;tower.hp=0;
 const repaired=warChestRecovery(w,data);
 assert.equal(repaired,2,'one wagon stock mends two buildings');
 assert.equal(tower.hp,data.buildings.tower.tiers[tower.level-1].hp,'the ruin rises whole');
 assert.equal(farm.hp,data.buildings.farm.tiers[farm.level-1].hp,'the worst wound first');
});

test('phase6: the chest burns at raid end and the wagons count the wreckage',()=>{
 const g=home();
 g.prepareWarChest('arrows');g.prepareWarChest('wagons');
 g.world.raidPending={timer:0.001,count:1};
 assert.equal(g.openWarChest(),true);
 g.tick(0.1);
 assert.ok(g.world.enemies.length>0,'the horn brought raiders');
 const farm=g.world.buildings.find(b=>b.type==='farm'&&b.hp>0);
 farm.hp=0;
 for(const e of g.world.enemies)e.hp=0;
 g.tick(0.1);
 assert.equal(warChestArmed(g.world),false,'the chest is spent with the raid');
 assert.equal(warChestTotal(g.world,data),0,'every stock returned to zero');
 assert.ok(farm.hp>0,'the repair wagons restored the ruin');
 assert.match(g.message,/repair wagons/,'the victory notice counts the wagon work');
});

// ---- Festivals: pay once, the town glows ----

test('phase6: festivals gate by level, cost and cooldown, then pay exactly',()=>{
 const g=home(3);
 assert.match(String(festivalReason(g.state,g.data,'harvest-feast')),/village level 4/);
 assert.equal(beginFestival(g.state,g.data,'harvest-feast').ok,false);
 g.state.vlevel=4;
 const before=structuredClone(g.world.resources),f=data.festivals.find(x=>x.id==='harvest-feast');
 const r=beginFestival(g.state,g.data,'harvest-feast');
 assert.equal(r.ok,true);
 for(const [k,v] of Object.entries(f.cost))assert.equal(g.world.resources[k],before[k]-v,`${k} paid exactly`);
 assert.ok(festivalActive(g.world,g.data),'the feast is live');
 assert.ok(festivalCooldownLeft(g.world,g.data)>f.seconds-1,'the town rests while the feast runs');
 assert.match(String(festivalReason(g.state,g.data,'harvest-feast')),/catching its breath/);
});

test('phase6: a live festival warms the aura table, growth and training, then fades',()=>{
 const w=createWorld(data);
 const plain=auras(w,data);
 w.festival={id:'harvest-feast',until:(w.elapsed||0)+300};
 const warm=auras(w,data);
 assert.ok(Math.abs(warm.gather-plain.gather-0.1)<1e-9,'gather warms');
 assert.ok(Math.abs(warm.xp-plain.xp-0.08)<1e-9,'village XP warms');
 assert.ok(Math.abs(festivalBonus(w,data,'growth')-0.25)<1e-9);
 assert.ok(Math.abs(festivalBonus(w,data,'jobXp')-0.25)<1e-9);
 w.elapsed=301;
 assert.equal(festivalActive(w,data),null,'the warmth fades on its own clock');
 assert.equal(festivalBonus(w,data,'growth'),0);
 assert.deepEqual(festivalAuraEffects(w,data),{});
});

test('phase6: festival growth and training bonuses reach the sim',()=>{
 const run=fest=>{
  const g=fresh();g.world.resources.food=500;
  const cottage=makeBuilding('cottage',2,5,data);g.world.buildings.push(cottage);
  const cottage2=makeBuilding('cottage',2,8,data);g.world.buildings.push(cottage2);
  const shop=makeBuilding('sawmill',5,8,data);g.world.buildings.push(shop);
  const hand=makeUnit('sawyer',data);hand.workplace=shop.id;g.world.troops.push(hand);
  if(fest)g.world.festival={id:'harvest-feast',until:9999};
  for(let i=0;i<10;i++)tickVillage(g.state,data,1,quiet);
  tickVillagerJobs(g.world,data,10);
  return {timer:g.world.childTimer,jobXp:hand.jobXp};
 };
 const plain=run(false),fest=run(true);
 assert.ok(plain.timer>9.9&&plain.timer<10.1,`plain cradle holds its rate (${plain.timer})`);
 assert.ok(fest.timer>12.4&&fest.timer<12.6,`the feast quickens the cradle (${fest.timer})`);
 assert.equal(plain.jobXp,10,'plain crews train at the base rate');
 assert.ok(Math.abs(fest.jobXp-12.5)<1e-9,'festival crews train a quarter faster');
});

test('phase6: Founder\'s glory pays village XP through the Game command',()=>{
 const g=home(8);
 const before=g.state.xp||0;
 assert.equal(g.holdFestival('founders-festival'),true);
 assert.equal(g.state.xp,before+400,'the glory lands');
 assert.match(g.message,/Founder's Festival/);
 assert.equal(festivalList(data).length>=3,true,'three festivals in data');
});

// ---- Market: the lossy bulk valves ----

// The board rotates three deals a day — walk days until this one shows.
function dayWith(dealId,vlevel){
 for(let i=0;i<60;i++){
  const d=new Date(Date.UTC(2026,8,1+i));
  if(dealsFor(data.traders,data.calendar,d,vlevel).some(t=>t.id===dealId))return d;
 }
 return null;
}
const tradeState=w=>({world:w,home:null,mission:null,completed:[],unlocks:[],xp:0,vlevel:8,questsCompleted:[],tradeDay:null,tradesUsed:{}});

test('phase6: bulk market deals carry daily caps and real baskets',()=>{
 const ids=['provender-run','northern-caravan'];
 for(const id of ids){
  const deal=data.traders.find(t=>t.id===id);
  assert.ok(deal,`${id} exists`);
  assert.equal(deal.cap,1,'one run a day');
  assert.ok(deal.minLevel>=7,'late-game valves open late');
  for(const basket of [deal.give,deal.take]){
   for(const [k,v] of Object.entries(basket))assert.ok(['wood','food','gold','lumber','plate','frostwood','flour','bread'].includes(k)&&v>0,`${id} trades real goods (${k})`);
  }
 }
});

test('phase6: a bulk conversion moves every good exactly once a day',()=>{
 const day=dayWith('provender-run',8);
 assert.ok(day,'the provisioners roll at some point in the cycle');
 const w=createWorld(data);
 w.resources={wood:0,food:50000,gold:0,lumber:0,plate:0,frostwood:0,flour:0,bread:20000};
 const state=tradeState(w);
 const res=performTrade(state,data,'provender-run',day);
 assert.equal(res.ok,true,'the deal strikes');
 assert.equal(w.resources.gold,1400,'gold lands');
 assert.equal(w.resources.food,38000,'the food column loads');
 assert.equal(w.resources.bread,17000,'and the loaves');
 const again=performTrade(state,data,'provender-run',day);
 assert.equal(again.ok,false,'one run a day');
 assert.match(again.error,/done until tomorrow/);
});

test('phase6: the northern caravan pays in frostwood now that all goods trade',()=>{
 const day=dayWith('northern-caravan',8);
 assert.ok(day,'the caravan rolls at some point in the cycle');
 const w=createWorld(data);
 w.resources={wood:0,food:0,gold:0,lumber:9000,plate:3000,frostwood:0,flour:0,bread:0};
 const state=tradeState(w);
 const res=performTrade(state,data,'northern-caravan',day);
 assert.equal(res.ok,true);
 assert.equal(w.resources.frostwood,650,'cold coin lands');
 assert.equal(w.resources.lumber,1500);
 assert.equal(w.resources.plate,1000);
});
