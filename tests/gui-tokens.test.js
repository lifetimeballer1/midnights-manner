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
  '--dock-bg': 'linear-gradient(#f2a94e,#cf7a28)',
  '--dock-edge': '#7a4416',
  '--dock-deep': '#5d3210',
  '--wood-bg': 'repeating-linear-gradient(90deg,#00000014 0 3px,transparent 3px 44px),linear-gradient(#cf9452,#9d6530)',
  '--wood-dark-bg': 'linear-gradient(#8a5a2e,#6b421f)',
  '--wood-edge': '#5a3a22',
  '--wood-deep': '#3a2413',
  '--wood-card-bg': 'linear-gradient(#e8b96e,#cf9450)',
  '--wood-ink': '#3a2c18',
  '--wood-faint': '#6b4e28',
  '--build-bg': 'linear-gradient(#ffd97a,#e8a83c)',
  '--build-edge': '#fff0b5',
  '--build-ink': '#443d24',
  '--battle-bg': 'linear-gradient(#c97a4a,#93402a)',
  '--battle-edge': '#e8a06a',
  '--res-bg': 'linear-gradient(#8a5a2e,#6b421f)',
  '--res-edge': '#5a3a22',
  '--modal-bg': 'linear-gradient(#35513f,#203a2d)',
  '--modal-edge': '#a4b390',
  '--modal-deep': '#15291b',
  '--drawer-bg': '#ebe5cf',
  '--drawer-head': 'linear-gradient(#375446,#243e33)',
  '--card-bg': 'linear-gradient(#fcfae9,#e1ddc3)',
  '--card-edge': '#c2c6a9',
  '--bar-track': '#112820',
  '--bar-xp': 'linear-gradient(90deg,#7ee787,#2ea043)',
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

test('rules reference tokens instead of repeating literals', async () => {
  const kingdom = await readFile(new URL('../src/kingdom.css', import.meta.url), 'utf8');
  const paint = css + kingdom;
  for (const token of Object.keys(TOKENS)) {
    assert.ok(paint.includes(`var(${token})`), `${token} is referenced`);
  }
  // Raw literals survive only inside the :root definitions themselves
  // (alpha-suffixed cousins like #a4b39088 are distinct values, not repeats).
  const body = css.slice(css.indexOf('}') + 1);
  for (const value of new Set(Object.values(TOKENS))) {
    const escaped = value.replace(/[()#,]/g, ch => '\\' + ch);
    assert.ok(!new RegExp(`${escaped}(?![0-9a-f])`, 'i').test(body), `literal ${value} no longer repeats outside :root`);
  }
});

test('the winning theme layer (kingdom.css) paints HUD surfaces from tokens', async () => {
  const kingdom = await readFile(new URL('../src/kingdom.css', import.meta.url), 'utf8');
  const rule = sel => {
    const i = kingdom.indexOf(sel);
    assert.ok(i >= 0, `${sel} styled in kingdom.css`);
    return kingdom.slice(i, kingdom.indexOf('}', i) + 1);
  };
  assert.ok(rule('.dock-button{').includes('var(--dock-bg)'), 'dock buttons candy-orange');
  assert.ok(rule('.resource{').includes('var(--res-bg)'), 'resources wood trays');
  assert.ok(rule('.crest{').includes('var(--wood-bg)'), 'crest wood badge');
  assert.ok(rule('.quest-chip{').includes('var(--wood-dark-bg)'), 'quest chip wood plaque');
  assert.ok(rule('.toast{').includes('var(--wood-dark-bg)'), 'toast wood plaque');
  assert.ok(rule('.build-button{').includes('var(--build-bg)'), 'build stays gold');
  assert.ok(rule('.battle-button{').includes('var(--battle-bg)'), 'defend stays red');
  assert.ok(kingdom.includes('.camera-tools button{border-radius:50%}'), 'camera tools round');
  const ruleIn = (sel, token) => {
    const i = kingdom.indexOf(sel);
    assert.ok(i >= 0, `${sel} styled in kingdom.css`);
    assert.ok(kingdom.slice(i, kingdom.indexOf('}', i) + 1).includes(token), `${sel} uses ${token}`);
  };
  ruleIn('.drawer{', 'var(--wood-bg)');
  ruleIn('.drawer-header{', 'var(--wood-dark-bg)');
  ruleIn('.menu-nav button.active{', 'var(--dock-bg)');
  ruleIn('.panel-filters button.active{', 'var(--dock-bg)');
  ruleIn('.build-card{', 'var(--wood-card-bg)');
  ruleIn('.village-strip{', 'var(--wood-dark-bg)');
  ruleIn('.levelbar>div,.progress>div{', 'var(--bar-xp)');
  ruleIn('.gear.selected{', '#e8a83c');
});

test('key surfaces still exist after the token pass', () => {
  for (const sel of ['.dock-button', '.build-button', '.battle-button', '.resource', '.modal-card', '.raid-card', '.drawer', '.drawer-header', '.build-card', '.chief-xp', '.cancel-button', '.gold-button']) {
    assert.ok(css.includes(sel), `${sel} survives`);
  }
});
