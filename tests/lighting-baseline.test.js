// Presentation pass — deliberate baseline updates per phase.
// Phase 1 froze construction-time baked colors. Phase 2 moved shading into
// paint() and drove it from the sky clock. Phase 3 swept the key light
// (sun/moon arcs) and let weather touch the meshes. Phase 4 adds per-face
// ground-contact occlusion and the phase vignette; Phase 7 deliberately
// reshapes defenses and Phase 8 held equipment at gameplay scale. The guarantees now are:
//  - raw digests pin geometry and albedo, independent of light,
//  - the frozen-light test proves the shading formula still reproduces the
//    legacy formula byte-for-byte at flat AO (the Phase 1 digests' exact
//    guarantee, now a pure-function contract),
//  - day/night/dawn digests pin the current look so later phases diff it
//    deliberately, in one reviewed commit.
// Face digests are canonical (per-face entries sorted) on purpose: paint()
// reorders faces by depth, so hashing construction order would flake.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {Game} from '../src/game.js';
import {MeshScene,buildingModel,shade} from '../src/scene3d.js';
import {characterModel} from '../src/character-art.js';
import {DAY_LENGTH,skyLightAt} from '../src/systems/daynight.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const context = new Proxy({}, {get: (t, k) => t[k] || (() => k === 'measureText' ? {width: 40} : k.includes('Gradient') ? {addColorStop() {}} : undefined), set: (t, k, v) => (t[k] = v, true)});
function renderer() {
  const r = new Renderer({getContext: () => context}, data, {});
  r.resize(1280, 900, 1);
  r.cam.x = 9; r.cam.y = 9; r.cam.zoom = 1.8;
  return r;
}
function mesh(r, type, level, yaw) {
  r.cam.yaw = yaw;
  const s = new MeshScene(r);
  const b = {id: type, type, x: 5, y: 5, level, hp: 100, remaining: 0};
  buildingModel(s, b, data.buildings[type], {buildings: [b]});
  return s;
}
function equipmentLineup(){
  // Freeze the shipped lineup; new outfits/tools have full-orbit coverage in character-art.test.js.
  const troops=Object.entries(data.troops).filter(([id])=>!['heartwarden','mudlark'].includes(id));
  const r=renderer(),gear=[...new Set([...troops.map(([,t])=>t.defaultGear),'axe','warhammer','scythe','cart','berry-basket','orrery','toolkit'])].filter(id=>id&&id!=='apron');
  r.calm=true;r.cam.x=2+(gear.length-1)*.8/2;r.cam.y=8;r.cam.zoom=1.65;r.cam.yaw=PI/4;
  const s=new MeshScene(r);
  gear.forEach((id,i)=>characterModel(s,{id:`equipment-${i}-${id}`,type:data.items[id]?.roles?.[0]||'warrior',x:2+i*.8,y:8,hp:100,gear:id},data,0));
  r.cam.y=16;
  troops.forEach(([type],i)=>characterModel(s,{id:`outfit-${i}-${type}`,type,x:2+i*.8,y:16,hp:100,gear:''},data,0));
  return s;
}
// The frozen Phase 1 formula — any drift here fails the test by construction.
const legacyShade = (hex, n) => {
  const value = parseInt(hex.slice(1), 16), light = .72 + .26 * Math.max(0, (-n[0] * .4 - n[1] * .5 + n[2]) / 1.187) + .12 * Math.max(0, n[2]);
  return '#' + [value >> 16, (value >> 8) & 255, value & 255].map(v => Math.min(255, Math.round(v * light)).toString(16).padStart(2, '0')).join('');
};
// The Phase 2 day light, frozen as a synthetic descriptor (Phase 3's arcs
// move the real sun, so the formula contract gets its own constant light).
const LEGACY_LIGHT = {keyDir: [-0.4, -0.5, 1], keyNorm: 1.187, keyRGB: [1, 1, 1], keyI: 0.26, ambRGB: [1, 1, 1], ambI: 0.72, sky: 0.12, emissive: 0, dim: 1, fog: 0, key: 'legacy'};
const entry = (hex, f) => JSON.stringify([hex, ...f.points.flatMap(p => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100])]);
const digest = (faces, field) => createHash('sha256').update(faces.map(f => entry(f[field], f)).sort().join('|')).digest('hex').slice(0, 16);
const PI = Math.PI;
// Day 1 (seed 7) is a clear sky; these times are whole phase points of it.
const canon = fraction => skyLightAt(DAY_LENGTH * (1 + fraction), null);
const dayLight = canon(0.3), nightLight = canon(0.8), dawnLight = canon(0.01);
// Frozen from main after the Phase 4 implementation (Windows V8; coordinates
// rounded to 2dp so cross-platform float noise can never flake the pins).
// Living detail pass: functional props, circular cart wheels and gate guides.
// V1 deliberately pins the new masterwork branches (citadel, grand
// watchtower, great-work tier 6) so later phases diff them in review.
// CC0 prop pass deliberately repins five masterwork cargo geometries; all
// other structure, defense, equipment and lighting formula pins stay intact.
// R3/B modular architecture pass deliberately repins hall-1/2/3 + cottage-3
// (8-family tier rebuild) and the equipment lineup (rig-baked bodies).
// R5 civic identity pass deliberately repins citadel-4 +
// stone-road/city-wall/lantern-rows-6 (own massing, no hut fallback).
const CASES = [
  ["hall-1","hall",1,144,"4a01c5cb33f45e90","af1dacefc6436bce","6752c79f6bc06596","bac14ebef4feeb7f"],
  ["hall-2","hall",2,198,"cef43961a8d931d9","6eab374b4226b902","bd862814f17cf94d","36a1744411f782a2"],
  ["hall-3","hall",3,279,"2a1b8f305a828ff2","a75386a25afcbedf","7c5e6583ca5aec68","472aa67bc2adcdc5"],
  ["cottage-3","cottage",3,285,"d7c39e81a607b885","372db19a960b1bc8","02892edd8a317779","659550bc37f76664"],
  ["wall-3","wall",3,50,"d5944b2a353ffc0a","b7f1ca5631ec8717","74257c5dfe2fb3ad","4feec123ed73ec80"],
  ["gate-1","gate",1,84,"96e261af4c6c169a","ace76688e6458a7f","1b749b208cadd235","7fabae7d7075bfbe"],
  ["trap-1","trap",1,108,"f641279d753011c6","90821dcc50bf866d","82b637353d4abf39","b372f8059d239fd6"],
  ["fire-trap-1","fire-trap",1,105,"ed5ad989924463ab","59925cf86827aacb","ab344a73a2154660","c2070027782b6ea1"],
  ["tower-3","tower",3,120,"19491a4138f208d5","dbe9492d7aab2582","9cc32f00ad2b41a2","0601c1e981cb53ce"],
  ["sawmill-2","sawmill",2,196,"917c15c36a251eff","c7c776db313aaac6","18dc92a0f6aa5081","805f241cd5bba972"],
  ["mill-2","mill",2,263,"15ebfa44adb29af6","0360e170e2a2dcc6","297135221a0a9573","75840c3ab0c5da88"],
  ["citadel-4","manner-citadel",4,414,"b43d51e064ffbf34","45805b62b32b3867","0164c3fceab35f49","60fdf3408f26e038"],
  ["grand-watch-4","grand-watchtower",4,245,"06bc41f3ddc801b4","84a4e7ec461c777f","72f185ad1c1c06d8","3e72306ef484ef69"],
  ["stone-road-6","stone-road",6,314,"4531e4853534c2a2","933c015668f79a6d","aa31e2ce16d33880","b520695bbbfe107f"],
  ["city-wall-6","city-wall",6,365,"18bce402babf7e2a","aef0cf1087ddfbf6","c0cfb8df7236ecc3","1cde1056bb7e2c21"],
  ["forge-quarter-6","forge-quarter",6,437,"98be0e7ee3c0401b","77d53b20e29a6c46","7ef45857f09a909d","79a1c3c27fd45c78"],
  ["lantern-rows-6","lantern-rows",6,287,"e0ac02ee38b40238","bdef05f98cb7d514","3744530a0a08a306","cc1bc6cb8517e957"],
];
const ORBIT = {"faces":816,"day":"390bf1a9a8be7a48","night":"4bc094c97d1b5428","dawn":"f11f9da413b7c3ee"};
// Canonical tool and outfit lineups at the mobile/gameplay zoom.
// P3 deliberately adds quiver/belt/satchel/hem faces (villager readability);
// R3/A deliberately replaces procedural bodies with rig-baked CC0 geometry.
// Shading formula verified drift-free at each update.
const EQUIPMENT_BASELINE={"faces":3038,"raw":"94457a62042c64bb","frozen":"02136e9580ba522c","day":"79aca5fe17913126","night":"2956374739593eda","dawn":"0c43a545a390e3f1"};

test('baseline: canonical meshes keep their raw geometry and albedo', () => {
  const r = renderer();
  for (const [name, type, level, faces, raw] of CASES) {
    const s = mesh(r, type, level, PI / 4), core = s.faces.filter(f => !f.fixture);
    assert.equal(core.length, faces, `${name} face count moved`);
    assert.equal(digest(core, 'color'), raw, `${name} geometry or albedo moved`);
  }
});

test('baseline: gameplay-scale equipment keeps its geometry and lit look deliberate',()=>{
  const s=equipmentLineup();
  assert.equal(s.faces.length,EQUIPMENT_BASELINE.faces,'equipment lineup face count moved');
  assert.equal(digest(s.faces,'color'),EQUIPMENT_BASELINE.raw,'equipment geometry or albedo moved');
  const expected=s.faces.map(f=>entry(legacyShade(f.color,f.normal),f)).sort().join('|');
  const painted=s.faces.map(f=>entry(shade(f.color,f.normal,LEGACY_LIGHT,0,0,1),f)).sort().join('|');
  assert.equal(painted,expected,'equipment shade formula drifted');
  assert.equal(createHash('sha256').update(painted).digest('hex').slice(0,16),EQUIPMENT_BASELINE.frozen,'equipment frozen digest moved');
  s.light=dayLight;s.paint();assert.equal(digest(s.faces,'painted'),EQUIPMENT_BASELINE.day,'equipment day look moved');
  s.light=nightLight;s.paint();assert.equal(digest(s.faces,'painted'),EQUIPMENT_BASELINE.night,'equipment night look moved');
  s.light=dawnLight;s.paint();assert.equal(digest(s.faces,'painted'),EQUIPMENT_BASELINE.dawn,'equipment dawn look moved');
});

test('baseline: the shading formula stays legacy-exact (frozen light, flat AO)', () => {
  const r = renderer();
  for (const [name, type, level, , , frozen] of CASES) {
    const s = mesh(r, type, level, PI / 4), core = s.faces.filter(f => !f.fixture);
    const expected = core.map(f => entry(legacyShade(f.color, f.normal), f)).sort().join('|');
    const painted = core.map(f => entry(shade(f.color, f.normal, LEGACY_LIGHT, 0, 0, 1), f)).sort().join('|');
    assert.equal(painted, expected, `${name} shading formula drifted`);
    assert.equal(createHash('sha256').update(painted).digest('hex').slice(0, 16), frozen, `${name} frozen digest moved`);
  }
});

test('baseline: the sky keeps its exact painted look at day and midnight', () => {
  const r = renderer();
  for (const [name, type, level, , , , day, night] of CASES) {
    const s = mesh(r, type, level, PI / 4);
    s.light = dayLight; s.paint();
    assert.equal(digest(s.faces.filter(f => !f.fixture), 'painted'), day, `${name} day look moved`);
    s.light = nightLight; s.paint();
    assert.equal(digest(s.faces.filter(f => !f.fixture), 'painted'), night, `${name} night look moved`);
  }
  const orbit = t => {
    const faces = [];
    for (const yaw of [0, PI / 2, PI, 3 * PI / 2]) { const s = mesh(r, 'hall', 3, yaw); s.light = skyLightAt(t, null); s.paint(); faces.push(...s.faces.filter(f => !f.fixture)); }
    return faces;
  };
  assert.equal(orbit(DAY_LENGTH * 1.8).length, ORBIT.faces, 'orbited hall face count moved');
  assert.equal(digest(orbit(DAY_LENGTH * 1.3), 'painted'), ORBIT.day, 'orbited hall day look moved');
  assert.equal(digest(orbit(DAY_LENGTH * 1.8), 'painted'), ORBIT.night, 'orbited hall night look moved');
  assert.equal(digest(orbit(DAY_LENGTH * 1.01), 'painted'), ORBIT.dawn, 'orbited hall dawn look moved');
});

test('baseline: shading stays directional, dims at night, keeps lit windows', () => {
  const r = renderer();
  const lum = hex => parseInt(hex.slice(1), 16) >> 16;
  const box = light => { const s = new MeshScene(r); s.box(0, 0, 0, 1, 1, 1, '#808080'); s.light = light; s.paint(); return s.faces.map(f => f.painted); };
  const day = box(dayLight), night = box(nightLight);
  assert.ok(Math.max(...day.map(lum)) > Math.min(...day.map(lum)), 'the sun still lights one side brighter');
  assert.ok(Math.min(...day.map(lum)) >= 72 && Math.max(...day.map(lum)) <= 136, 'day ambient floor and key ceiling hold (AO shades the foot)');
  assert.ok(Math.max(...night.map(lum)) < Math.min(...day.map(lum)), 'midnight is darker than any daylight face');
  // Windows are emissive: at midnight they keep more of their albedo than the
  // same geometry without the flag, and the boost vanishes at noon.
  const windowFace = light => { const s = new MeshScene(r); s.emissive = 1; s.box(0, 0, 0, 1, 1, 1, '#ffe6ab'); s.light = light; s.paint(); return s.faces[0].painted; };
  const plainFace = light => { const s = new MeshScene(r); s.box(0, 0, 0, 1, 1, 1, '#ffe6ab'); s.light = light; s.paint(); return s.faces[0].painted; };
  assert.ok(lum(windowFace(nightLight)) > lum(plainFace(nightLight)), 'lit windows outshine walls at midnight');
  assert.equal(windowFace(dayLight), plainFace(dayLight), 'no noon glow above the daylight shading');
});

test('baseline: ground-hugging faces carry a soft occlusion, roofs do not', () => {
  const r = renderer();
  const lum = hex => parseInt(hex.slice(1), 16) >> 16;
  const paint = z => { const s = new MeshScene(r); s.box(0, 0, z, 1, 1, 1, '#808080'); s.light = dayLight; s.paint(); return s.faces.map(f => lum(f.painted)); };
  const low = paint(0), high = paint(1.5);
  assert.equal(Math.max(...low), Math.max(...high), 'roofs stay at full light');
  assert.ok(Math.min(...low) < Math.min(...high), `wall feet darken against the dirt (${Math.min(...low)} vs ${Math.min(...high)})`);
});

test('baseline: the sky clock never rebuilds the static mesh cache', () => {
  const r = renderer(), g = new Game(data);
  r.calm = true;
  r.draw(g.world, 1000);
  const cached = r._meshStatic, key = r.staticCacheKey(g.world);
  g.world.elapsed = 390; r.draw(g.world, 1016);
  assert.equal(r._meshStatic, cached, 'noon keeps the cached geometry');
  assert.equal(r.staticCacheKey(g.world), key, 'clock time is not a cache key');
  g.world.elapsed = 540; r.draw(g.world, 1032);
  assert.equal(r._meshStatic, cached, 'midnight keeps the cached geometry');
});
