import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// P0 token foundation: every surface color lives in :root exactly once and
// rules reference tokens. Neutral refactor — values must equal the shipped
// palette so captures stay pixel-identical.
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

const TOKENS = {
  '--btn-bg': 'linear-gradient(#375047,#263d35)',
  '--btn-edge': '#82978570',
  '--btn-deep': '#12271d',
  '--goldbtn-bg': 'linear-gradient(#f7df95,#d0a24d)',
  '--goldbtn-edge': '#ffebb0',
  '--goldbtn-ink': '#493c23',
  '--goldbtn-deep': '#8a612d',
  '--dock-bg': 'linear-gradient(#3d5648f5,#263d32f5)',
  '--dock-edge': '#8a9a7b',
  '--dock-deep': '#172d21',
  '--build-bg': 'linear-gradient(#efd689,#cea354)',
  '--build-edge': '#fff0b5',
  '--build-ink': '#443d24',
  '--battle-bg': 'linear-gradient(#b36e46,#85432d)',
  '--battle-edge': '#dca775',
  '--res-bg': 'linear-gradient(90deg,#22352bed,#33493adf)',
  '--res-edge': '#829a79',
  '--modal-bg': 'linear-gradient(#35513f,#203a2d)',
  '--modal-edge': '#a4b390',
  '--modal-deep': '#15291b',
  '--drawer-bg': '#ebe5cf',
  '--drawer-head': 'linear-gradient(#375446,#243e33)',
  '--card-bg': 'linear-gradient(#fcfae9,#e1ddc3)',
  '--card-edge': '#c2c6a9',
  '--bar-track': '#112820',
  '--bar-xp': 'linear-gradient(90deg,#65bec7,#c0f8d5)',
  '--danger-bg': 'linear-gradient(#8b5545,#69382e)',
  '--danger-edge': '#ca9380',
};

test('every GUI token is defined once with its shipped value', () => {
  const root = css.slice(0, css.indexOf('}') + 1);
  for (const [token, value] of Object.entries(TOKENS)) {
    const defs = root.split(`${token}:`).length - 1;
    assert.equal(defs, 1, `${token} defined exactly once`);
    assert.ok(root.includes(`${token}:${value}`), `${token} keeps shipped value ${value}`);
  }
});

test('rules reference tokens instead of repeating literals', () => {
  for (const token of Object.keys(TOKENS)) {
    assert.ok(css.includes(`var(${token})`), `${token} is referenced`);
  }
  // Raw literals survive only inside the :root definitions themselves
  // (alpha-suffixed cousins like #a4b39088 are distinct values, not repeats).
  const body = css.slice(css.indexOf('}') + 1);
  for (const value of new Set(Object.values(TOKENS))) {
    const escaped = value.replace(/[()#,]/g, ch => '\\' + ch);
    assert.ok(!new RegExp(`${escaped}(?![0-9a-f])`, 'i').test(body), `literal ${value} no longer repeats outside :root`);
  }
});

test('key surfaces still exist after the token pass', () => {
  for (const sel of ['.dock-button', '.build-button', '.battle-button', '.resource', '.modal-card', '.raid-card', '.drawer', '.drawer-header', '.build-card', '.chief-xp', '.cancel-button', '.gold-button']) {
    assert.ok(css.includes(sel), `${sel} survives`);
  }
});
