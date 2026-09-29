import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {characterModel,enemyGearFor} from '../src/character-art.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','buildings'].map(async n=>[
  n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))
 ])
));
const context={};
const r=new Renderer({getContext:()=>context},data,{});
r.resize(1000,760,1);r.cam.x=5;r.cam.y=5;r.cam.zoom=2;r.cam.yaw=Math.PI/4;
function faces(role,extra={}){
 const s=new MeshScene(r),u={id:`enemy-${role}`,x:5,y:5,hp:100,maxHp:100,damage:10,role,faction:'cinder-clan',animation:0,...extra};
 characterModel(s,u,data,500,true);
 return s.faces;
}
const colors=f=>new Set(f.map(x=>x.color));

test('enemy silhouettes: role gear mapping stops siege units from falling back to swords',()=>{
 assert.equal(enemyGearFor({role:'archer'}),'bow');
 assert.equal(enemyGearFor({role:'breaker'}),'warhammer');
 assert.equal(enemyGearFor({role:'scout'}),'blade');
 assert.equal(enemyGearFor({role:'raider'}),'sword');
 assert.equal(enemyGearFor({role:'ram'}),'');
 assert.equal(enemyGearFor({role:'bombard'}),'');
});

test('enemy silhouettes: ram carries a broad timber frame with an iron cap',()=>{
 const f=faces('ram'),c=colors(f);
 assert.ok(c.has('#987046'),'ram beam uses timber');
 assert.ok(c.has('#b7c8ca'),'ram has an iron cap');
 assert.ok(f.some(face=>face.center[0]<4.7||face.center[0]>5.3),'ram silhouette extends beyond ordinary torso width');
});

test('enemy silhouettes: bombard carries a metal field tube with brass hardware',()=>{
 const c=colors(faces('bombard'));
 assert.ok(c.has('#b7c8ca'),'bombard tube is visible');
 assert.ok(c.has('#dfba6a'),'bombard hardware reads in brass');
});

test('enemy silhouettes: elites gain recognition trim without changing faction coat',()=>{
 const normal=colors(faces('raider')),elite=colors(faces('raider',{elite:true}));
 assert.equal(normal.has('#f1d487'),false,'ordinary raider has no elite pale-gold trim');
 assert.equal(elite.has('#f1d487'),true,'elite gains pale-gold crest/shoulders');
 assert.ok(elite.has('#ad5948'),'elite keeps Cinder Clan faction color');
});

test('enemy silhouettes: bosses read as different characters at map scale',()=>{
 const cinder=colors(faces('boss',{bossId:'cinder-maul',faction:'boss'}));
 const queen=colors(faces('boss',{bossId:'pale-queen',faction:'boss'}));
 assert.ok(cinder.has('#8d4b38')&&cinder.has('#6b4637'),'Cinder-Maul gets heavy dark-red armor');
 assert.ok(queen.has('#b9c5d4')&&queen.has('#d8ddea'),'Pale Queen gets pale coat and cloak');
 assert.ok(queen.has('#dfba6a'),'Pale Queen crown reads in brass');
 assert.notDeepEqual([...cinder].sort(),[...queen].sort());
});
