// Async multiplayer unit tests: sync/merge logic, gift/help rules,
// friend-code handling. Pure `src/multiplayer.js` — no DOM, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUsername, randomCode, validateFriendCode, sameCode,
  blankMultiplayer, ensureMultiplayer, addFriend, removeFriend,
  giftReason, makeGift, speedupReason, makeSpeedup, applyInbox,
  publicSnapshot, rankVillages, pushActivity, mergeCloudSave, stampCloud,
  GIFT_MAX, GIFTS_PER_DAY, HELPS_PER_DAY, FEED_CAP,
} from '../src/multiplayer.js';

function mpWithFriend(name = 'Ash') {
  const mp = blankMultiplayer();
  mp.username = 'Bram';
  mp.friendCode = 'AAAA-1111';
  const r = addFriend(mp, name, 'BBBB-2222');
  assert.equal(r.ok, true);
  return mp;
}

function worldWith(res = { wood: 50, food: 50, gold: 50 }, buildings = []) {
  return { resources: { ...res }, buildings };
}

// --- usernames: usernames only, never emails ---

test('usernames accept 3-16 letters/digits/_/-', () => {
  assert.equal(validateUsername('Ash_99').ok, true);
  assert.equal(validateUsername('ab').ok, false);
  assert.equal(validateUsername('a'.repeat(17)).ok, false);
  assert.equal(validateUsername('Ash Ketchum').ok, false);
});

test('usernames reject emails and blanks', () => {
  const email = validateUsername('ash@example.com');
  assert.equal(email.ok, false);
  assert.match(email.error, /never an email/i);
  assert.equal(validateUsername('   ').ok, false);
  assert.equal(validateUsername('has@sign').ok, false);
});

// --- friend codes ---

test('friend codes generate as XXXX-XXXX and validate', () => {
  const code = randomCode();
  assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(validateFriendCode(code).ok, true);
  assert.equal(validateFriendCode('abcd-1234').ok, true); // case-insensitive
  assert.equal(validateFriendCode('abcd1234').ok, true);  // dash optional
  assert.equal(validateFriendCode('short').ok, false);
  assert.equal(validateFriendCode('').ok, false);
});

test('sameCode ignores case and dash', () => {
  assert.equal(sameCode('abcd-1234', 'ABCD1234'), true);
  assert.equal(sameCode('ABCD-1234', 'WXYZ-9999'), false);
});

// --- friend list ---

test('addFriend needs valid name + code, blocks self and dupes', () => {
  const mp = blankMultiplayer();
  mp.username = 'Bram';
  mp.friendCode = 'AAAA-1111';
  assert.equal(addFriend(mp, 'Bram', 'AAAA-1111').ok, false); // self
  assert.equal(addFriend(mp, 'ash@example.com', 'BBBB-2222').ok, false); // email
  assert.equal(addFriend(mp, 'Ash', 'nope').ok, false); // bad code
  assert.equal(addFriend(mp, 'Ash', 'BBBB-2222').ok, true);
  assert.equal(addFriend(mp, 'ash', 'CCCC-3333').ok, false); // dupe name
  assert.equal(addFriend(mp, 'Cinder', 'BBBB-2222').ok, false); // dupe code
});

test('removeFriend drops case-insensitively', () => {
  const mp = mpWithFriend();
  assert.equal(removeFriend(mp, 'aSH').removed, 1);
  assert.deepEqual(mp.friends, []);
  assert.equal(removeFriend(mp, 'Nobody').ok, false);
});

// --- gifts ---

test('giftReason enforces resource, amount, friendship, funds', () => {
  const mp = mpWithFriend();
  const w = worldWith();
  assert.equal(giftReason(mp, w, 'Ash', 'wood', 10), null);
  assert.ok(giftReason(mp, w, 'Ash', 'diamond', 10)); // not giftable
  assert.ok(giftReason(mp, w, 'Ash', 'wood', 0)); // too small
  assert.ok(giftReason(mp, w, 'Ash', 'wood', GIFT_MAX + 1)); // too big
  assert.ok(giftReason(mp, w, 'Stranger', 'wood', 10)); // not a friend
  assert.ok(giftReason(mp, worldWith({ wood: 5 }), 'Ash', 'wood', 10)); // broke
});

test('gifts cap at 3 per day, reset next day', () => {
  const mp = mpWithFriend();
  const w = worldWith({ wood: 1000 });
  for (let i = 0; i < GIFTS_PER_DAY; i++) {
    assert.equal(giftReason(mp, w, 'Ash', 'wood', 10), null);
    w.resources.wood -= 10;
    mp.outbox.push(makeGift(mp, 'Bram', 'Ash', 'wood', 10));
  }
  assert.match(giftReason(mp, w, 'Ash', 'wood', 10), /Three gifts a day/);
  // tomorrow: fresh hands
  const t = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  assert.equal(giftReason(mp, w, 'Ash', 'wood', 10, t), null);
});

test('applyInbox pours gifts into storage and clears the inbox', () => {
  const state = { world: worldWith({ wood: 5 }), multiplayer: blankMultiplayer() };
  state.multiplayer.inbox.push(
    { id: 'g1', kind: 'gift', from: 'Ash', resource: 'wood', amount: 25 },
    { id: 'g2', kind: 'gift', from: 'Ash', resource: 'gold', amount: 7 },
  );
  const report = applyInbox(state);
  assert.equal(report.length, 2);
  assert.equal(state.world.resources.wood, 30);
  assert.equal(state.world.resources.gold, 7);
  assert.deepEqual(state.multiplayer.inbox, []);
  assert.ok(state.multiplayer.activity.length >= 2);
});

// --- speed-ups ---

test('speedupReason needs a rising scaffold + daily budget', () => {
  const mp = mpWithFriend();
  assert.ok(speedupReason(mp, worldWith({}, []), 'Ash', 'b1')); // no buildings
  const done = worldWith({}, [{ id: 'b1', remaining: 0 }]);
  assert.match(speedupReason(mp, done, 'Ash', 'b1'), /already stands/);
  const rising = worldWith({}, [{ id: 'b1', remaining: 120 }]);
  assert.equal(speedupReason(mp, rising, 'Ash', 'b1'), null);
  assert.ok(speedupReason(mp, rising, 'Stranger', 'b1'));
});

test('helps cap at 3 per day; applyInbox shortens scaffolds, never below 0', () => {
  const mp = mpWithFriend();
  for (let i = 0; i < HELPS_PER_DAY; i++) mp.outbox.push(makeSpeedup(mp, 'Bram', 'Ash', 'b1'));
  const w = worldWith({}, [{ id: 'b1', remaining: 120 }]);
  const t = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  assert.match(speedupReason(mp, w, 'Ash', 'b1'), /Three helping hands/);
  assert.equal(speedupReason(mp, w, 'Ash', 'b1', t), null);

  const state = { world: worldWith({}, [{ id: 'b1', remaining: 30 }]), multiplayer: blankMultiplayer() };
  state.multiplayer.inbox.push({ id: 'h1', kind: 'speedup', from: 'Ash', buildingId: 'b1', seconds: 60 });
  const report = applyInbox(state);
  assert.equal(report.length, 1);
  assert.equal(state.world.buildings[0].remaining, 0); // floored, never negative
});

test('speedup with no rising build reports gracefully', () => {
  const state = { world: worldWith({}, []), multiplayer: blankMultiplayer() };
  state.multiplayer.inbox.push({ id: 'h9', kind: 'speedup', from: 'Ash', buildingId: 'gone', seconds: 60 });
  const report = applyInbox(state);
  assert.equal(report.length, 1);
  assert.match(report[0].text, /already stands/);
});

// --- visits + leaderboard ---

test('publicSnapshot exposes username + village only', () => {
  const snap = publicSnapshot({
    vlevel: 4, xp: 321, cloudUpdatedAt: 123,
    multiplayer: { username: 'Bram' },
    world: { troops: [{}, {}], buildings: [{ type: 'farm' }, { type: 'farm' }, { type: 'tower' }] },
  });
  assert.deepEqual(snap, {
    username: 'Bram', vlevel: 4, xp: 321, population: 2,
    buildings: { farm: 2, tower: 1 }, updatedAt: 123,
  });
  assert.ok(!('save' in snap) && !('inbox' in snap) && !('friendCode' in snap));
});

test('rankVillages sorts XP desc, level breaks ties, caps 20', () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ username: `v${i}`, xp: i, vlevel: 1 }));
  const ranked = rankVillages([...rows, { username: 'champ', xp: 100, vlevel: 2 }]);
  assert.equal(ranked.length, 20);
  assert.equal(ranked[0].username, 'champ');
  assert.equal(ranked[1].xp, 24);
});

// --- merge ---

test('mergeCloudSave: newer world wins, friends/activity/inbox union', () => {
  const lmp = blankMultiplayer();
  lmp.friends.push({ username: 'Ash', code: 'BBBB-2222' });
  const rmp = blankMultiplayer();
  rmp.friends.push({ username: 'ash', code: 'BBBB-2222' }); // same friend, other device
  rmp.friends.push({ username: 'Cinder', code: 'CCCC-3333' });
  const local = { cloudUpdatedAt: 100, xp: 10, multiplayer: lmp };
  const remote = { cloudUpdatedAt: 200, xp: 99, multiplayer: rmp };
  const { state, winner } = mergeCloudSave(local, remote);
  assert.equal(winner, 'remote');
  assert.equal(state.xp, 99); // newer world wins whole
  assert.equal(state.multiplayer.friends.length, 2); // union, deduped
  assert.equal(state.cloudUpdatedAt, 200);
});

test('mergeCloudSave: older cloud never clobbers newer local', () => {
  const { state, winner } = mergeCloudSave(
    { cloudUpdatedAt: 300, xp: 50, multiplayer: blankMultiplayer() },
    { cloudUpdatedAt: 100, xp: 999, multiplayer: blankMultiplayer() },
  );
  assert.equal(winner, 'local');
  assert.equal(state.xp, 50);
});

test('mergeCloudSave tolerates nulls; stampCloud stamps', () => {
  assert.equal(mergeCloudSave({ a: 1 }, null).winner, 'local');
  assert.equal(mergeCloudSave(null, { b: 2 }).winner, 'remote');
  const s = {};
  assert.ok(stampCloud(s) > 0);
});

// --- backfill + feed ---

test('ensureMultiplayer backfills without touching the world', () => {
  const state = { world: { resources: { wood: 1 } }, xp: 5 };
  const mp = ensureMultiplayer(state);
  assert.equal(mp.username, null);
  assert.deepEqual(mp.friends, []);
  assert.equal(state.world.resources.wood, 1);
  assert.equal(state.xp, 5);
  const again = ensureMultiplayer(state);
  assert.equal(again, mp); // idempotent, same object kept
});

test('activity feed caps at 30, newest first', () => {
  const mp = blankMultiplayer();
  for (let i = 0; i < FEED_CAP + 5; i++) pushActivity(mp, `event ${i}`);
  assert.equal(mp.activity.length, FEED_CAP);
  assert.equal(mp.activity[0].text, `event ${FEED_CAP + 4}`);
});
