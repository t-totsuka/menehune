// Task 8.3: colors of the hi-fi decorations (13.2, 10.4). Every icon and decoration color is a
// token, and each is checked against the background it is painted on as a non-text element (3:1),
// in both themes: contrast-pairs.json holds the pair and the computed ratio passes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseColor, contrastRatio } from '../../tools/check-contrast.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (/** @type {string} */ p) => readFileSync(join(root, p), 'utf8');
const stripComments = (/** @type {string} */ css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Body of the first balanced `{...}` after `selector`. */
function blockAfter(/** @type {string} */ css, /** @type {string} */ selector) {
  const at = css.indexOf(selector);
  if (at < 0) return '';
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return '';
}
const decls = (/** @type {string} */ body) =>
  new Map([...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const tokensCss = stripComments(read('assets/css/tokens.css'));
const lightBlock = decls(blockAfter(tokensCss, ':root {'));
const darkBlock = decls(blockAfter(tokensCss, ':root[data-theme="dark"]'));
const mediaDark = decls(blockAfter(tokensCss, ':root:not([data-theme="light"])'));
const themes = { light: lightBlock, dark: new Map([...lightBlock, ...darkBlock]) };

/** @param {'light' | 'dark'} theme @param {string} name */
function color(theme, name) {
  let value = themes[theme].get(name);
  for (let i = 0; value && i < 5; i++) {
    const m = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (!m) break;
    value = themes[theme].get(m[1]);
  }
  const c = value ? parseColor(value) : null;
  assert.ok(c && c.a === 1, `${theme} ${name} is not an opaque color (${value})`);
  return c;
}

const pairs = /** @type {{ fg: string, bg: string, min: number, themes: string[] }[]} */ (
  JSON.parse(read('tools/contrast-pairs.json'))
);

// [foreground, background, where]. The pair in contrast-pairs.json may be stricter (4.5 for a
// color that is also used for text), never weaker than 3.
/** @type {[string, string, string][]} */
const DECOR_PAIRS = [
  ['--color-decor-star', '--color-surface', 'stars of the header starfield (header surface)'],
  ['--color-decor-star', '--color-bg', 'stars behind the top of the top page (page background)'],
  ['--color-event-moon', '--color-surface', 'moon event-kind icons on the event row'],
  ['--color-event-planet', '--color-surface', 'planet event-kind icons on the event row'],
  ['--color-moon-lit', '--color-moon-shadow', 'lit part of the phase / moon icons on the dark disc'],
  ['--color-border-strong', '--color-surface', 'outline of the phase / moon icons in cells and the almanac'],
  ['--color-border-strong', '--color-bg', 'outline of the phase icons in the legend'],
  ['--color-accent', '--color-bg', 'star glyph before the section headings'],
];

test('every decoration color pair of 8.3 is in contrast-pairs.json for both themes, at 3:1 or stricter', () => {
  const missing = DECOR_PAIRS.filter(([fg, bg]) => !pairs.some((p) => p.fg === fg && p.bg === bg && p.min >= 3
    && p.themes.includes('light') && p.themes.includes('dark'))).map(([fg, bg, where]) => `${fg} on ${bg} (${where})`);
  assert.deepEqual(missing, []);
});

test('every decoration color pair of 8.3 reaches 3:1 in both themes', () => {
  /** @type {string[]} */
  const failing = [];
  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    for (const [fg, bg] of DECOR_PAIRS) {
      const ratio = contrastRatio(color(theme, fg), color(theme, bg));
      if (ratio < 3) failing.push(`${theme} ${fg} on ${bg}: ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(failing, []);
});

test('--color-decor-star is a role token in both dark blocks and has a wireframe gray', () => {
  assert.ok(lightBlock.has('--color-decor-star'), 'light value');
  assert.ok(darkBlock.has('--color-decor-star'), ':root[data-theme="dark"] value');
  assert.equal(mediaDark.get('--color-decor-star'), darkBlock.get('--color-decor-star'), 'both dark blocks agree');
  const wf = stripComments(read('assets/css/wireframe.css'));
  assert.match(wf, /--color-decor-star\s*:\s*var\(--wf-gray-[a-z-]+\)/);
});

test('the decorations paint with token colors only (components.css)', () => {
  const css = stripComments(read('assets/css/components.css'));
  for (const selector of ['.mk-starfield {', '.mk-event__icon {', '.mk-phase-icon__disc', '.mk-phase-icon__lit']) {
    const body = blockAfter(css, selector);
    assert.notEqual(body, '', `${selector} is styled`);
    assert.match(body, /var\(--color-[a-z-]+\)|currentColor/, `${selector} uses a color token`);
  }
});
