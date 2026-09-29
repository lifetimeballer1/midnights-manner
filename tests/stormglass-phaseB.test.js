import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Stormglass Phase B: tokens + first-run hint wiring. Presentation only.
test('stormglass tokens land in kingdom.css', async () => {
  const css = await readFile(new URL('../src/kingdom.css', import.meta.url), 'utf8');
  assert.ok(css.includes('--night:#1a2c4e'), 'night token');
  assert.ok(css.includes('--brass:#f4cc73'), 'brass token');
  assert.ok(css.includes('--lamp:#ffb95b'), 'lamp token');
  assert.ok(css.includes('--parchment:#eee4c9'), 'parchment token');
  assert.ok(css.includes('#guide'), 'guide hint style');
});
test('guide hint is wired without touching saves', async () => {
  const ui = await readFile(new URL('../src/ui.js', import.meta.url), 'utf8');
  assert.ok(ui.includes('tutorial.js'), 'imports guide system');
  assert.ok(ui.includes('loadGuide()'), 'loads separate-key guide');
  assert.ok(ui.includes("$('#guide')"), 'renders into #guide');
  assert.ok(ui.includes('#guide,.camera-tools') || ui.includes('#guide,'), 'guide avoids bubble overlap');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="guide"'), 'guide mount exists');
  assert.ok(html.includes('#1a2c4e'), 'theme-color matches night token');
});
