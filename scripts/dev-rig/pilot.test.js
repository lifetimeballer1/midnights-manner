// Pilot verification for the rigged-to-posed-mesh toolchain.
// Run directly: node scripts/dev-rig/pilot.test.js
//
// Proves the three baked Warrior poses are real game-format meshes:
//   * JSON parses, faces are bounded, colors are hex, vertices are finite
//   * provenance shows a real rig/animation clip was sampled (not hand-built)
//   * the three poses differ structurally
//   * the walk pose strides (feet spread/centroid shift vs stand)
//   * every pose is grounded at z=0 and tile-scaled
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const POSES = ['stand', 'walk', 'swing'];
const EXPECTED_CLIP = {stand: 'Idle', walk: 'Walk', swing: 'Sword_Attack'};
const TARGET_HEIGHT = 1.1;

function loadPose(name) {
  const path = join(here, `warrior-${name}.json`);
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(doc && Array.isArray(doc.faces), `${name}: missing faces array`);
  assert.ok(doc.faces.length > 0, `${name}: no faces`);
  assert.ok(doc.faces.length < 800, `${name}: ${doc.faces.length} faces exceeds the 800-face pilot budget`);
  assert.ok(doc.meta && doc.meta.rig, `${name}: missing rig provenance`);
  assert.equal(doc.meta.rig.joints, 32, `${name}: expected the 32-joint Quaternius armature`);
  assert.ok(doc.meta.rig.animation_channels > 0, `${name}: no animation channels recorded`);
  assert.equal(doc.meta.clip, EXPECTED_CLIP[name], `${name}: sampled clip should be ${EXPECTED_CLIP[name]}`);
  assert.ok(Number.isFinite(doc.meta.clip_time_seconds), `${name}: missing sampled clip time`);

  const colors = new Set();
  for (const face of doc.faces) {
    assert.equal(face.v.length, 3, `${name}: face is not a triangle`);
    for (const point of face.v) {
      assert.equal(point.length, 3, `${name}: vertex is not [x,y,z]`);
      for (const value of point) {
        assert.ok(Number.isFinite(value), `${name}: non-finite vertex coordinate`);
      }
    }
    assert.match(face.c, /^#[0-9a-f]{6}$/i, `${name}: invalid hex color ${face.c}`);
    colors.add(face.c.toLowerCase());
  }
  assert.ok(colors.size >= 4, `${name}: only ${colors.size} flat colors baked`);
  return doc;
}

function bounds(doc) {
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (const face of doc.faces) {
    for (const point of face.v) {
      for (let axis = 0; axis < 3; axis += 1) {
        low[axis] = Math.min(low[axis], point[axis]);
        high[axis] = Math.max(high[axis], point[axis]);
      }
    }
  }
  return {low, high};
}

function vertices(doc) {
  return doc.faces.flatMap((face) => face.v);
}

function centroid(doc) {
  const points = vertices(doc);
  const sum = points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]], [0, 0, 0]);
  return sum.map((value) => value / points.length);
}

function signature(doc) {
  const rounded = doc.faces.map((face) => face.v.map((point) => point.map((value) => Math.round(value * 1000) / 1000)));
  return createHash('sha1').update(JSON.stringify(rounded)).digest('hex');
}

// Feet/lower legs: the sword and arms stay above z=0.3 in all three sampled
// clips, so this isolates the legs for the stride comparison.
function feetMetrics(doc, cut = 0.3) {
  const low = vertices(doc).filter((point) => point[2] < cut);
  assert.ok(low.length > 0, 'no vertices below the feet cut');
  const left = low.filter((point) => point[0] < 0);
  const right = low.filter((point) => point[0] >= 0);
  assert.ok(left.length > 0 && right.length > 0, 'feet split into left/right');
  const meanY = (points) => points.reduce((sum, point) => sum + point[1], 0) / points.length;
  const ys = low.map((point) => point[1]);
  return {
    spanY: Math.max(...ys) - Math.min(...ys),
    gap: Math.abs(meanY(left) - meanY(right)),
  };
}

const meshes = Object.fromEntries(POSES.map((name) => [name, loadPose(name)]));

// Grounded and tile-scaled.
for (const name of POSES) {
  const {low, high} = bounds(meshes[name]);
  assert.ok(Math.abs(low[2]) <= 0.01, `${name}: not grounded (min z ${low[2].toFixed(4)})`);
  const height = high[2] - low[2];
  assert.ok(height >= 0.95 && height <= 1.3, `${name}: height ${height.toFixed(3)} tiles is off target ${TARGET_HEIGHT}`);
  const footprintX = high[0] - low[0];
  const footprintY = high[1] - low[1];
  assert.ok(footprintX <= 1.6 && footprintY <= 1.6, `${name}: footprint ${footprintX.toFixed(2)}x${footprintY.toFixed(2)} is not tile-scaled`);
}

// Structurally distinct poses.
const signatures = POSES.map((name) => signature(meshes[name]));
assert.equal(new Set(signatures).size, POSES.length, 'poses share identical geometry');
for (let i = 0; i < POSES.length; i += 1) {
  for (let j = i + 1; j < POSES.length; j += 1) {
    const a = new Set(vertices(meshes[POSES[i]]).map((point) => point.map((v) => Math.round(v * 1000)).join(',')));
    const b = new Set(vertices(meshes[POSES[j]]).map((point) => point.map((v) => Math.round(v * 1000)).join(',')));
    const shared = [...a].filter((key) => b.has(key)).length;
    const overlap = shared / Math.max(a.size, b.size);
    assert.ok(overlap < 0.8, `${POSES[i]}/${POSES[j]} share ${(overlap * 100).toFixed(0)}% of vertices`);
  }
}

// Walk strides: wider foot spread and a shifted lower-body centroid than stand.
const standFeet = feetMetrics(meshes.stand);
const walkFeet = feetMetrics(meshes.walk);
assert.ok(walkFeet.spanY > standFeet.spanY * 1.3,
  `walk foot span ${walkFeet.spanY.toFixed(3)} is not striding vs stand ${standFeet.spanY.toFixed(3)}`);
assert.ok(walkFeet.gap > 0.1, `walk left/right foot gap ${walkFeet.gap.toFixed(3)} is not a stride`);
assert.ok(walkFeet.gap > standFeet.gap + 0.05,
  `walk foot gap ${walkFeet.gap.toFixed(3)} does not separate vs stand ${standFeet.gap.toFixed(3)}`);
const standCentroid = centroid(meshes.stand);
const walkCentroid = centroid(meshes.walk);
const centroidShift = Math.hypot(walkCentroid[0] - standCentroid[0], walkCentroid[1] - standCentroid[1]);
assert.ok(centroidShift > 0.005, `walk centroid shift ${centroidShift.toFixed(4)} is negligible`);

console.log('pilot ok: 3 rigged Warrior poses parse, stay under the face budget, differ, stride, and are grounded/tile-scaled');
for (const name of POSES) {
  const {low, high} = bounds(meshes[name]);
  const feet = feetMetrics(meshes[name]);
  console.log(`  ${name.padEnd(5)} clip=${meshes[name].meta.clip.padEnd(12)} faces=${String(meshes[name].faces.length).padStart(3)} height=${(high[2] - low[2]).toFixed(3)} feet-span=${feet.spanY.toFixed(3)} feet-gap=${feet.gap.toFixed(3)}`);
}
