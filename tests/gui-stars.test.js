import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {raidStars} from '../src/systems/combat.js';

test('wave stars read the raid ledger', () => {
  assert.equal(raidStars({won: true, kills: 5, loot: 20, damaged: 0}), 3, 'flawless holds earn three');
  assert.equal(raidStars({won: true, kills: 5, loot: 20, damaged: 1}), 2, 'one scar costs a star');
  assert.equal(raidStars({won: true, kills: 5, loot: 20, damaged: 2}), 2, 'two scars hold two');
  assert.equal(raidStars({won: true, kills: 5, loot: 20, damaged: 3}), 1, 'heavy damage leaves one');
  assert.equal(raidStars({won: false, kills: 5, loot: 0, damaged: 4}), 0, 'defeats earn none');
  assert.equal(raidStars(null), 0, 'missing ledger is safe');
  assert.equal(raidStars({}), 0, 'empty ledger is safe');
  assert.equal(raidStars({won: true}), 3, 'unscarred shorthand is flawless');
});

test('dialog surfaces and stars are painted from tokens', async () => {
  const kingdom = await readFile(new URL('../src/kingdom.css', import.meta.url), 'utf8');
  const ruleIn = (sel, token) => {
    const i = kingdom.indexOf(sel);
    assert.ok(i >= 0, `${sel} styled in kingdom.css`);
    assert.ok(kingdom.slice(i, kingdom.indexOf('}', i) + 1).includes(token), `${sel} uses ${token}`);
  };
  ruleIn('.inspector,.placement,.modal-card,.raid-card{', 'var(--wood-bg)');
  assert.ok(kingdom.includes('.wave-stars{'), 'star row styled');
  assert.ok(kingdom.includes('.wave-stars .off'), 'empty stars styled');
  ruleIn('.setting-rows button{', 'var(--dock-bg)');
  ruleIn('.title-card{', 'var(--wood-bg)');
  assert.ok(kingdom.includes('.close-button{background:linear-gradient(#c95a5a,#93363b)'), 'close is ref red');
});
