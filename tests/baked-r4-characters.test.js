import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene, shade} from '../src/scene3d.js';
import {characterModel} from '../src/character-art.js';
import {DAY_LENGTH, skyLightAt} from '../src/systems/daynight.js';

const root = new URL('../', import.meta.url);
const files = (await readdir(new URL('assets/meshes/baked/', root))).filter(f => f.endsWith('.json'));
const meshes = Object.fromEntries(await Promise.all(files.map(async f => [f.slice(0, -5), JSON.parse(await readFile(new URL('assets/meshes/baked/' + f, root)))])));
const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'buildings', 'art-manifest'].map(async n => [n, JSON.parse(await readFile(new URL(`data/${n}.json`, root)))])));

test('r4 flat colors meet the cloth floor without arbitrary dark-face exemptions', () => {
  for (const [id, mesh] of Object.entries(meshes)) for (const face of mesh.faces) {
    const rgb = [1, 3, 5].map(i => parseInt(face.c.slice(i, i + 2), 16));
    assert.ok(rgb.every((v, i) => v >= [58, 63, 69][i]) || face.eyePit === true, `${id} ${face.c} below floor`);
  }
});

test('r4 preserves ten sets, four distinct grounded poses, and bounded LODs and weight', async () => {
  assert.ok(files.length >= 80);
  let total = 0;
  for (const [id, entry] of Object.entries(data['art-manifest'].baked)) {
    assert.equal(entry.phase, 'R4');
    const signatures = new Set();
    for (const pose of ['stand', 'walk-a', 'walk-b', 'attack']) for (const lod of ['hi', 'lo']) {
      const mesh = meshes[`${id}-${pose}-${lod}`];
      assert.ok(mesh.faces.length > (lod === 'hi' ? 350 : 130));
      assert.ok(mesh.faces.length <= (lod === 'hi' ? 450 : 180));
      assert.ok(mesh.faces.flatMap(f => f.v).every(v => v.length === 3 && v.every(Number.isFinite)));
      assert.ok(Math.abs(Math.min(...mesh.faces.flatMap(f => f.v.map(v => v[2])))) < .001);
      if (lod === 'hi') signatures.add(JSON.stringify(mesh.faces));
    }
    assert.ok(signatures.size >= 4, id + ' distinct poses');
    // Expanded 8-pose library (work-a/b, attack-2, special hi-only) is
    // optional until the baker runs: validate only when committed.
    for (const key of [`${id}-work-a-hi`, `${id}-work-b-hi`, `${id}-attack-2-hi`, `${id}-special-hi`]) {
      if (!meshes[key]) continue;
      assert.ok(meshes[key].faces.length > 0 && meshes[key].faces.length <= 450, key);
    }
  }
  for (const f of files) total += (await stat(new URL('assets/meshes/baked/' + f, root))).size;
  assert.ok(total < 4 * 1024 * 1024, `${total} bytes`);
});

test('r4 hand and head anchors sit inside baked anatomy and faces stay welded', () => {
  for (const [id, mesh] of Object.entries(meshes)) {
    const points = mesh.faces.flatMap(f => f.v);
    for (const name of ['hand', 'head']) {
      const anchor = mesh.meta.anchors?.[name];
      assert.ok(Array.isArray(anchor) && anchor.length === 3, `${id} ${name} anchor`);
      assert.ok(Math.min(...points.map(p => Math.hypot(...p.map((v, i) => v - anchor[i])))) < .12, `${id} ${name} attached`);
    }
    // Attached gear anchors (back/chest/hip) validated when the baker emits them.
    for (const name of ['back', 'chest', 'hip']) {
      const anchor = mesh.meta.anchors?.[name];
      if (!anchor) continue;
      assert.ok(Math.min(...points.map(p => Math.hypot(...p.map((v, i) => v - anchor[i])))) < .3, `${id} ${name} attached`);
    }
    const unique = new Set(points.map(p => p.join(',')));
    assert.ok(unique.size < points.length * .65, id + ' shared welded vertices');
    for (const face of mesh.faces) {
      assert.equal(new Set(face.v.map(p => p.join(','))).size, 3, id + ' no collapsed triangles');
    }
  }
});

test('r4 retains verified staged-source hashes and CC0 provenance', async () => {
  // The staged GLBs are git-ignored review inputs; the committed manifest is
  // the provenance record. Verify the record, and that every recorded pose
  // resolves to a committed baked file (checked against files[] above).
  for (const [id, entry] of Object.entries(data['art-manifest'].baked)) {
    assert.equal(entry.creator, 'Kay Lousberg', id);
    assert.match(entry.license, /CC0/, id);
    assert.match(entry.source, /^https:\/\/kaylousberg\.itch\.io\//, id);
    assert.ok(entry.pack, id + ' pack named');
    assert.match(entry.sourceSHA256, /^[a-f0-9]{64}$/, id + ' source hash recorded');
    assert.match(entry.textureSHA256, /^[a-f0-9]{64}$/, id + ' texture hash recorded');
    assert.ok(entry.licenseFile, id + ' license pointer recorded');
    assert.deepEqual(entry.poseBudget, {hi: 450, lo: 180}, id + ' budgets');
    for (const pose of Object.values(entry.poses)) {
      assert.ok(files.includes(pose.split('/').pop()), `${id} ${pose} committed`);
    }
  }
});

function render(type, gear, time = 0, options = {}) {
  const r = new Renderer({getContext: () => ({})}, options.data || data, {});
  r.cam.x = 0; r.cam.y = 0; r.cam.zoom = options.zoom ?? 1.65; r.cam.yaw = options.yaw ?? Math.PI / 4;
  r.calm = true; r.meshes = options.meshes || meshes;
  const s = new MeshScene(r), raw = [], face = s.face;
  s.face = (v, c, split) => {raw.push({v, c, emissive: s.emissive}); return face.call(s, v, c, split);};
  characterModel(s, {id: 'r4', type, gear, hp: 100, x: 0, y: 0, attackTimer: .1, ...options.unit}, options.data || data, time, options.enemy === true);
  return {raw, faces: s.faces};
}

test('r4 held shaft reaches the baked hand, miner lamp emits, and Calm freezes', () => {
  const anchor = meshes['warrior-attack-lo'].meta.anchors?.hand;
  assert.ok(anchor, 'baked hand available');
  const armed = render('warrior', 'sword'), bare = render('warrior', '');
  const equipment = armed.raw.slice(bare.raw.length).filter(f => f.c === '#987046');
  assert.ok(equipment.flatMap(f => f.v).some(p => Math.hypot(...p.map((v, i) => v - anchor[i])) < .06), 'sword grip is in the baked palm');
  assert.ok(render('miner', 'pickaxe').raw.some(f => f.c === '#f6df9a' && f.emissive >= .7), 'baked miner lamp');
  assert.deepEqual(render('miner', 'pickaxe', 100).faces, render('miner', 'pickaxe', 3000).faces);
});

test('r4 baked professions retain data-colored accents and distinct work headwear', () => {
  for (const type of Object.keys(data.troops)) {
    assert.ok(render(type, '').raw.some(f => f.c === data.troops[type].color), type + ' profession color');
  }
  const shape = type => JSON.stringify(render(type, '').raw.map(f => f.v));
  assert.notEqual(shape('farmer'), shape('builder'), 'straw brim versus work cap');
  assert.notEqual(shape('builder'), shape('haggler'), 'builder apron versus merchant cap');
  for (const zoom of [1,1.65]) for (const yaw of [Math.PI/4,5*Math.PI/4]) {
    const shown = render('farmer','',0,{zoom,yaw}).faces;
    assert.ok(shown.some(f => f.color === data.troops.farmer.color && f.vertices.length === 4), 'outward cloth panel survives view culling');
  }
});

test('r4 baked KayKit hand-gear attaches at the palm with fallback', async () => {
  const gearFiles = (await readdir(new URL('assets/meshes/gear/', root))).filter(f => f.endsWith('.json'));
  assert.ok(gearFiles.length >= 14, 'Sol gear library committed');
  const gearMeshes = Object.fromEntries(await Promise.all(gearFiles.map(async f => [`gear-${f.slice(0, -5)}`, JSON.parse(await readFile(new URL('assets/meshes/gear/' + f, root)))])));
  for (const [id, mesh] of Object.entries(gearMeshes)) {
    assert.ok(mesh.faces.length > 0 && mesh.faces.length <= 60, `${id} tool budget`);
    assert.ok(data['art-manifest'].gear?.[id.slice(5)]?.enabled, `${id} manifest enabled`);
  }
  const withGear = render('miner', 'pickaxe', 0, {meshes: {...meshes, ...gearMeshes}});
  assert.ok(withGear.raw.some(f => ['#5e5e5e', '#868686', '#a39281'].includes(f.c)), 'baked pickaxe steel in palm');
  const withoutGear = render('miner', 'pickaxe', 0, {meshes});
  assert.ok(!withoutGear.raw.some(f => ['#5e5e5e', '#a39281'].includes(f.c)), 'procedural fallback without gear mesh');
});

test('r4 disabled, missing and empty pose meshes silently use procedural fallback', () => {
  const disabled = structuredClone(data);
  disabled['art-manifest'].baked.warrior.enabled = false;
  const missing = render('warrior', 'sword', 0, {meshes: {}}).faces;
  assert.deepEqual(render('warrior', 'sword', 0, {data: disabled}).faces, missing);
  assert.deepEqual(render('warrior', 'sword', 0, {meshes: {'warrior-attack-lo': {faces: []}}}).faces, missing);
  assert.ok(missing.length > 0 && missing.length < 160);
});

test('r4 night villager lineup separates face, profession cloth and palm-held tools', () => {
  const nightLight = skyLightAt(DAY_LENGTH * .8, data, {calm:true});
  const lum = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)).reduce((n,v,i) => n+v*[.2126,.7152,.0722][i],0);
  for (const type of ['warrior','archer','farmer','builder','haggler','miner']) for (const zoom of [1,1.65]) for (const yaw of [Math.PI/4,5*Math.PI/4]) {
    const options = {zoom,yaw}, gear = data.troops[type].defaultGear;
    const shown = render(type,gear,100,options).faces;
    const painted = f => shade(f.color,f.normal,nightLight,f.emissive,0,f.ao);
    const cloth = shown.filter(f => f.color === data.troops[type].color && f.vertices.length === 4);
    const face = shown.filter(f => ['#dbb38c','#b98c64','#936a50'].includes(f.color));
    const tool = shown.filter(f => f.color === '#987046');
    assert.ok(cloth.some(f => lum(painted(f)) >= 45), `${type} ${yaw} night cloth`);
    assert.ok(face.some(f => lum(painted(f)) >= 65), `${type} ${yaw} night face/neck`);
    assert.ok(tool.some(f => lum(painted(f)) >= 45), `${type} ${yaw} night tool edge`);
    assert.ok(Math.max(...face.map(f => lum(painted(f)))) > Math.max(...cloth.map(f => lum(painted(f)))) + 8, `${type} face separates from cloth`);
    assert.deepEqual(shown,render(type,gear,3000,options).faces,`${type} night Calm freeze`);
  }
});

test('r4 composed enemy factions and roles attach to baked anatomy at gameplay zoom and freeze', () => {
  const factions = {'thornband':'human-thornband','cinder-clan':'human-cinder','ember-legion':'human-ember','pale-host':'skeleton','pale-court':'skeleton'};
  for (const [faction, set] of Object.entries(factions)) for (const zoom of [1, 1.65]) {
    const shapes = new Set();
    for (const role of ['raider','scout','archer','breaker','ram','bombard','boss']) {
      const unit = {faction, role, elite: role === 'raider', bossId: faction === 'cinder-clan' ? 'cinder-maul' : 'pale-queen'};
      const options = {enemy:true, zoom, unit};
      const rendered = render('enemy', '', 100, options);
      assert.ok(rendered.faces.length > 0, `${faction} ${role}`);
      assert.deepEqual(rendered.faces, render('enemy', '', 3000, options).faces, `${faction} ${role} Calm`);
      shapes.add(JSON.stringify(rendered.raw.map(f => f.v)));
      if (['raider','scout','archer','breaker'].includes(role)) {
        const hand = meshes[`${set}-attack-lo`].meta.anchors.hand;
        const tool = rendered.raw.slice(meshes[`${set}-attack-lo`].faces.length).filter(f => f.c === '#987046');
        assert.ok(tool.flatMap(f => f.v).some(p => Math.hypot(...p.map((v,i) => v-hand[i])) < .08), `${faction} ${role} palm attachment`);
      }
    }
    assert.equal(shapes.size, 7, `${faction} role profiles below detail cutoff`);
  }
});

test('r4 siege roles keep faction armor on anatomy rather than the carried frame', () => {
  for (const [faction,color] of [['cinder-clan','#c76b43'],['ember-legion','#c2502f']]) {
    const cue = role => render('enemy','',0,{enemy:true,unit:{faction,role}}).raw.filter(f => f.c === color);
    assert.ok(cue('raider').length > 0);
    for(const role of ['ram','bombard'])assert.deepEqual(cue(role),cue('raider'),`${faction} ${role} anatomy attachment`);
  }
});

test('r4 fitted Thornband cowl follows head anchors and selected pose bounds', () => {
  const key = 'human-thornband-attack-lo', mesh = structuredClone(meshes[key]);
  const original = render('enemy','',0,{enemy:true,unit:{faction:'thornband',role:'scout'}});
  const delta = [.04,.06,.03];
  mesh.meta.anchors.head = mesh.meta.anchors.head.map((v,i) => v+delta[i]);
  mesh.faces.forEach(f => f.v.forEach(p => {p[2] += delta[2];}));
  const moved = render('enemy','',0,{enemy:true,unit:{faction:'thornband',role:'scout'},meshes:{...meshes,[key]:mesh}});
  const cowl = raw => raw.filter(f => f.c === '#5d7348').flatMap(f => f.v);
  assert.ok(cowl(original.raw).length > 0);
  cowl(original.raw).forEach((p,j) => p.forEach((v,i) => assert.ok(Math.abs(cowl(moved.raw)[j][i]-v-delta[i]) < 1e-8)));
});

test('b4 named leaders scale baked body offsets around the unit origin', () => {
  const leaders = [
    ['ironshield-warden','thornband',1.15],['thornband-vex','thornband',1.15],
    ['cinder-sorr','cinder-clan',1.12],['palehost-herald','pale-host',1.2],
    ['ember-cindral','ember-legion',1.15],['grey-sovereign','pale-court',1.18],
    ['ashen-warlord','ember-legion',1.25],['cinder-maul','cinder-clan',1.12],
    ['pale-queen','pale-court',1.22],['unknown','thornband',1],
  ];
  const sets = {thornband:'human-thornband','cinder-clan':'human-cinder','ember-legion':'human-ember','pale-host':'skeleton','pale-court':'skeleton'};
  for (const [bossId,faction,scale] of leaders) for (const zoom of [1,4]) {
    const mesh = meshes[`${sets[faction]}-stand-${zoom === 4 ? 'hi' : 'lo'}`];
    const shown = render('enemy','',0,{enemy:true,zoom,unit:{bossId,faction,role:'boss',attackTimer:0,x:1,y:2}});
    assert.deepEqual(shown.raw.slice(0,mesh.faces.length).map(f => f.v),
      mesh.faces.map(f => f.v.map(([x,y,z]) => [1+x*scale,2+y*scale,z*scale])),bossId);
  }
});

test('b4 head, palm, chest and back attachments follow scaled baked anchors', () => {
  const mesh = meshes['human-ember-stand-hi'], scale = 1.25;
  const anchors = Object.fromEntries(Object.entries(mesh.meta.anchors).map(([key,p]) => [key,p.map(v => v*scale)]));
  const unit = {bossId:'ashen-warlord',faction:'ember-legion',role:'boss',attackTimer:0,x:1,y:2};
  const shown = armor => render('enemy','',0,{enemy:true,zoom:4,unit:{...unit,armor}}).raw.slice(mesh.faces.length);
  const near = (raw,color,p) => raw.filter(f => f.c === color).flatMap(f => f.v).some(v => Math.hypot(...v.map((n,i) => n-p[i])) < 1e-8);
  const plate = shown('iron-plate');
  assert.ok(['#dbb38c','#b98c64','#936a50'].some(color => near(plate,color,[1+anchors.head[0]-.055,2+anchors.head[1]+.15,anchors.head[2]-.035])),'head face');
  assert.ok(plate.filter(f => f.c === '#987046').flatMap(f => f.v).some(p => Math.hypot(p[0]-1-anchors.hand[0],p[1]-2-anchors.hand[1],p[2]-anchors.hand[2]) < .08),'palm grip');
  assert.ok(plate.flatMap(f => f.v).some(p => Math.hypot(p[0]-1-anchors.chest[0],p[1]-2-anchors.chest[1],p[2]-anchors.chest[2]) < 1e-8),'chest plate');
  assert.ok(shown('kite-shield').flatMap(f => f.v).some(p => Math.hypot(p[0]-1-anchors.back[0]+.09,p[1]-2-anchors.back[1]+.02,p[2]-anchors.back[2]) < 1e-8),'back shield');
  const ordinary = render('enemy','',0,{enemy:true,zoom:4,unit:{...unit,role:'raider'}});
  assert.deepEqual(ordinary.raw.slice(0,mesh.faces.length).map(f => f.v),mesh.faces.map(f => f.v.map(([x,y,z]) => [1+x,2+y,z])),'non-boss stays unscaled');
  const disabled = structuredClone(data);
  disabled['art-manifest'].baked['human-ember'].enabled = false;
  assert.deepEqual(render('enemy','',0,{enemy:true,unit,meshes:{}}).raw,render('enemy','',0,{enemy:true,unit,data:disabled}).raw,'procedural fallback');
});
