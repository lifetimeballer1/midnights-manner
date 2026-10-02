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
const CASES = [
  ["hall-1","hall",1,207,"fbeff627beb772a4","06d7d28a22b0aaaf","9cb46ec8433be3bb","e955f4f6ab94a7f6"],
  ["hall-2","hall",2,267,"4aba687d05ec28f0","961d54243adfcccb","1adb9a33c51f4c74","1b67c461502c5766"],
  ["hall-3","hall",3,281,"0d2e205bfc3c4e6d","2f19b263851004da","96180e0397dd6806","96b9d51eac1e998f"],
  ["cottage-3","cottage",3,267,"e6854c4deb6351bd","4e8f8be04c8c61e4","e1dc1076aef07e74","4b03904fa6ca6a02"],
  ["wall-3","wall",3,50,"66f49e5bb1ec257b","0febfbad242f8c3c","cb5be678bcbe22ce","e4e6c0073c7d5d85"],
  ["gate-1","gate",1,84,"96e261af4c6c169a","ace76688e6458a7f","1b749b208cadd235","7fabae7d7075bfbe"],
  ["trap-1","trap",1,51,"bdd62e2597b787f6","c520a25808aa9642","353c6f1ac46c7783","2fb02fbd069f95aa"],
  ["fire-trap-1","fire-trap",1,54,"bbe0759e8d33440e","f3051ca98323b89c","66484937567b945d","39ba568ae48fbe5c"],
  ["tower-3","tower",3,72,"ebc9c087acf5f1e3","b10ea680d2afed94","c01b2692645a3315","7f68f3801e65e545"],
  ["sawmill-2","sawmill",2,151,"be4fd15e9d212d69","7cdf7b6e6718abb3","444862e660ad422e","b2a1b4609cd127db"],
  ["mill-2","mill",2,229,"86664e9121675515","cc6c6242ca4af88b","a7d93443ff0faf79","84db1b53162d41d2"],
  ["citadel-4","manner-citadel",4,418,"1047474d6e566a85","7e2d07fc14915b82","c18f1bf044480e49","98d09698fe88e9a1"],
  ["grand-watch-4","grand-watchtower",4,229,"12be0cec770346bb","d516eeebf2f879a4","bb5bb0cb31e71c25","4b2cf703e9575b93"],
  ["stone-road-6","stone-road",6,406,"101ec1c683599c15","7260147591595cb4","4e3262c00bdbc287","53a9065ac746bbc8"],
  ["city-wall-6","city-wall",6,419,"2f6de9c549d34dc9","16981a1f255c1ae9","b67403196b0f365b","d801ecbfb384d17e"],
  ["forge-quarter-6","forge-quarter",6,421,"84ddb4409f271f76","b19f92a7043f0378","eeac67b85ef7da3a","efe022345e67ec90"],
  ["lantern-rows-6","lantern-rows",6,398,"9a4b5d6adab2855c","bb95e11a6cc87f81","7c6c6a3a8fff6e4b","0d4a4ed367306e82"],
];
const ORBIT = {"faces":770,"day":"42c57ac0a58b0b8b","night":"0a922c280a83f28f","dawn":"33de588b650fcfbe"};
// Canonical tool and outfit lineups at the mobile/gameplay zoom.
// P3 deliberately adds quiver/belt/satchel/hem faces (villager readability);
// shading formula verified drift-free at update time.
const EQUIPMENT_BASELINE={"faces":2341,"raw":"e6cd55c6c3d6f72a","frozen":"1dbbb4708d698fc7","day":"a869672666d550a6","night":"5685c36eb6d438e5","dawn":"a6a9e2554ac4bc25"};

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
