import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createWorld,makeUnit,makeBuilding,stats,unlockedAbilities,canPlace,builderBonuses} from '../src/model.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickCombat,spawnRaid,activateAbility} from '../src/systems/combat.js';
import {startMission,tickMission,finishMission} from '../src/systems/campaign.js';
import {nextStep,blocked} from '../src/systems/pathfinding.js';
import {Game} from '../src/game.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('all data references and unique sprite assets resolve',async()=>{
 const sprites=[];
 for(const b of Object.values(data.buildings))for(const tier of b.tiers)sprites.push(tier.sprite);
 for(const t of Object.values(data.troops)){sprites.push(t.sprite);assert.ok(data.items[t.defaultGear]);for(let level=5;level<=t.maxLevel;level+=5)assert.ok(data.abilities[t.abilities[level]]);}
 for(const item of Object.values(data.items)){sprites.push(item.sprite);for(const role of item.roles)assert.ok(data.troops[role]);}
 assert.equal(new Set(sprites).size,sprites.length);
 for(const name of sprites)await access(new URL(`../assets/sprites/${name}`,import.meta.url));
 for(const m of data.missions){for(const b of m.map.buildings)assert.ok(data.buildings[b.type]);for(const t of m.map.troops)assert.ok(data.troops[t]);for(const id of m.requires)assert.ok(data.missions.some(m=>m.id===id));}
});
test('level curves increase HP damage speed and unlock exact thresholds',()=>{const u=makeUnit('warrior',data);const initial=stats(u,data);u.level=4;assert.equal(unlockedAbilities(u,data).length,0);u.level=5;assert.equal(unlockedAbilities(u,data)[0].id,'cleave');u.level=25;assert.equal(unlockedAbilities(u,data).length,5);for(const key of ['hp','damage','speed'])assert.ok(stats(u,data)[key]>initial[key]);});
test('equipment changes reach and builder economy',()=>{const w=createWorld(data),u=w.troops[0];const reach=stats(u,data).range;u.gear='warhammer';assert.ok(stats(u,data).range>reach);const before=builderBonuses(w,data);w.troops.find(t=>t.type==='builder').gear='toolkit';const after=builderBonuses(w,data);assert.ok(after.speed>before.speed);assert.ok(after.discount>before.discount);});
test('placement rejects overlap and boundaries',()=>{const w=createWorld(data);assert.equal(canPlace(w,data,'farm',9,7),false);assert.equal(canPlace(w,data,'farm',19,15),false);assert.equal(canPlace(w,data,'farm',2,2),true);assert.equal(canPlace(w,data,'wall',-1,1),false);});
test('production pauses during construction and ignores destroyed buildings',()=>{const w=createWorld(data);w.troops=[];const farm=w.buildings.find(b=>b.type==='farm');farm.remaining=2;const food=w.resources.food;tickEconomy(w,data,1);assert.equal(w.resources.food,food);tickEconomy(w,data,1);tickEconomy(w,data,1);assert.equal(w.resources.food,food+2);farm.hp=0;tickEconomy(w,data,2);assert.equal(w.resources.food,food+2);});
test('collectors route and deliver a carried load',()=>{const w=createWorld(data);const expected=w.resources.food;for(let i=0;i<1200;i++)tickEconomy(w,data,.05);assert.ok(w.resources.food>expected+120,'collector should add food above passive production');});
test('walls block routes and routing finds a gap',()=>{const w=createWorld(data);w.buildings=[];for(let y=0;y<16;y++)w.buildings.push(makeBuilding('wall',5,y,data));assert.equal(blocked(w,data,5,7),true);assert.equal(nextStep(w,data,{x:2.5,y:7.5},{x:9.5,y:7.5},1),null);w.buildings.splice(7,1);assert.ok(nextStep(w,data,{x:2.5,y:7.5},{x:9.5,y:7.5},1));});
test('tower damages enemies and active healing observes cooldown',()=>{const w=createWorld(data);w.troops=[];w.buildings=[makeBuilding('tower',2,3,data)];spawnRaid(w,1);const hp=w.enemies[0].hp;tickCombat(w,data,.1);assert.ok(w.enemies[0].hp<hp);const u=makeUnit('warrior',data);u.level=15;u.hp=10;w.troops=[u];assert.equal(activateAbility(w,data,u,'heal'),true);assert.equal(u.hp,30);assert.equal(activateAbility(w,data,u,'heal'),false);});
test('mission isolation, constraints, unlocks and one-time rewards',()=>{const game={world:createWorld(data),completed:[],unlocks:[]};const home=game.world,food=home.resources.food;assert.equal(startMission(game,data,'timber-line'),false);assert.ok(startMission(game,data,'first-harvest'));assert.notEqual(game.world,home);game.world.gathered.food=100;tickMission(game,data);assert.equal(game.mission.status,'won');finishMission(game,data);assert.equal(game.world,home);assert.equal(home.resources.food,food);assert.ok(game.unlocks.includes('tower'));const gold=home.resources.gold;startMission(game,data,'first-harvest');game.world.gathered.food=100;tickMission(game,data);finishMission(game,data);assert.equal(home.resources.gold,gold);});
test('mission cannot win until all raids are cleared; timeout loses',()=>{const game={world:createWorld(data),completed:['first-harvest'],unlocks:[]};startMission(game,data,'timber-line');game.world.gathered.wood=999;tickMission(game,data);assert.equal(game.mission.status,'active');game.world.elapsed=220;tickMission(game,data);assert.equal(game.mission.status,'lost');});
test('recruiting requires barracks, honors limit, and charging is atomic',()=>{const g=new Game(data);g.world.resources={food:10000,wood:10000,gold:10000};for(let i=0;i<20;i++)g.recruit('warrior');assert.equal(g.world.troops.length,16);const stock=g.world.resources.food;g.recruit('archer');assert.equal(g.world.resources.food,stock);g.world.resources.gold=0;const level=g.world.troops[0].level;g.level(g.world.troops[0].id);assert.equal(g.world.troops[0].level,level);});
