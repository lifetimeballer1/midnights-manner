import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {makeBuilding,makeUnit,workplaceCapacity} from '../src/model.js';
import {tickEconomy} from '../src/systems/economy.js';
import {wallNeighbors} from '../src/building-art.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function setup(){const g=new Game(data);g.world.resources={wood:10000,food:10000,gold:10000};g.world.troops=[];g.world.buildings.push(makeBuilding('barracks',3,3,data));return g;}
test('hiring fills a matching vacancy and never overfills it',()=>{const g=setup(),farm=g.world.buildings.find(b=>b.type==='farm');for(let i=0;i<workplaceCapacity(farm,data);i++)assert.equal(g.recruit('farmer').workplace,farm.id);assert.equal(g.recruit('farmer').workplace,null);});
test('hire at workplace honors target; full target spends nothing',()=>{const g=setup(),farm=makeBuilding('farm',2,6,data);g.world.buildings.push(farm);for(let i=0;i<workplaceCapacity(farm,data);i++)assert.equal(g.recruit('farmer',farm.id).workplace,farm.id);const before={...g.world.resources},count=g.world.troops.length;g.recruit('farmer',farm.id);assert.deepEqual(g.world.resources,before);assert.equal(g.world.troops.length,count);});
test('unfinished or ruined workplaces cannot hire or auto assign',()=>{const g=setup();for(const b of g.world.buildings.filter(b=>b.type==='farm'))b.remaining=10;assert.equal(g.recruit('farmer').workplace,null);const farm=g.world.buildings.find(b=>b.type==='farm');farm.remaining=0;farm.hp=0;assert.equal(g.recruit('farmer').workplace,null);});
test('workplace assignment releases hold and specialists walk to work',()=>{const g=setup(),site=makeBuilding('scriptorium',3,6,data),u=makeUnit('scholar',data,0);g.world.buildings.push(site);g.world.troops.push(u);u.order={kind:'hold'};assert.equal(g.assign(u.id,site.id),true);assert.equal(u.order,null);const before={x:u.x,y:u.y};tickEconomy(g.world,data,.25);assert.ok(u.x!==before.x||u.y!==before.y);g.assign(u.id,null);assert.equal(u.workplace,null);});
test('walls join cardinal living neighbors, never diagonal or ruined walls',()=>{const b={type:'wall',x:4,y:4,hp:10};const world={buildings:[b,{type:'wall',x:5,y:4,hp:10},{type:'wall',x:3,y:4,hp:0},{type:'wall',x:5,y:5,hp:10}]};assert.deepEqual(wallNeighbors(b,world),[[1,0]]);});
