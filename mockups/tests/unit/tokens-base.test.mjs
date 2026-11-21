// Task 1.2: design tokens (tokens.css), base styles (base.css), sample page (components.html).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Return the body of the first `{...}` block that follows `selectorText` (balanced braces). */
function blockAfter(css, selectorText) {
  const at = css.indexOf(selectorText);
  if (at < 0) return null;
  const open = css.indexOf('{', at + selectorText.length);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return null;
}

/** Parse `--name: value;` declarations into an ordered Map. */
function decls(body) {
  const map = new Map();
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) map.set(m[1], m[2].trim());
  return map;
}

function themeBlocks() {
  const css = stripComments(read('assets/css/tokens.css'));
  const mediaBody = blockAfter(css, '@media (prefers-color-scheme: dark)');
  assert.ok(mediaBody, 'missing @media (prefers-color-scheme: dark) block');
  const mediaDark = blockAfter(mediaBody, ':root:not([data-theme="light"])');
  const manualDark = blockAfter(css, ':root[data-theme="dark"]');
  // Light block: first top-level `:root {`.
  const lightAt = css.search(/:root\s*\{/);
  const light = blockAfter(css, css.slice(lightAt, css.indexOf('{', lightAt)));
  return { css, light, mediaDark, manualDark };
}

test('tokens.css, base.css and components.html exist', () => {
  for (const p of ['assets/css/tokens.css', 'assets/css/base.css', 'components.html']) {
    assert.ok(existsSync(join(root, p)), `missing ${p}`);
  }
});

test('light :root defines tokens for every category (10.1)', () => {
  const { light } = themeBlocks();
  assert.ok(light, 'missing light :root block');
  const names = [...decls(light).keys()];
  for (const cat of ['color', 'font', 'font-size', 'font-weight', 'line-height', 'space', 'radius', 'shadow', 'border', 'bp']) {
    assert.ok(names.some((n) => n.startsWith(`--${cat}-`)), `no --${cat}-* token`);
  }
  assert.ok(names.some((n) => n.startsWith('--palette-')), 'no --palette-* raw colors');
  for (const n of names) {
    assert.match(n, /^--(palette|color|font|font-size|font-weight|line-height|space|radius|shadow|border|bp)-[a-z0-9]+(-[a-z0-9]+)*$/, `bad token name ${n}`);
  }
});

test('breakpoints are 600/960/1280px', () => {
  const t = decls(themeBlocks().light);
  assert.equal(t.get('--bp-sm'), '600px');
  assert.equal(t.get('--bp-md'), '960px');
  assert.equal(t.get('--bp-lg'), '1280px');
});

const ROLE_COLORS = ['bg', 'surface', 'text', 'text-muted', 'accent', 'link', 'border', 'focus'];
const SEMANTIC_COLORS = [
  'holiday', 'sunday', 'saturday',
  'rokuyo-taian', 'rokuyo-butsumetsu', 'rokuyo-sensho', 'rokuyo-tomobiki', 'rokuyo-senbu', 'rokuyo-shakku',
  'event-moon', 'event-planet', 'event-sun',
  'status-public', 'status-members-only', 'status-hidden', 'status-deleted',
  'admin-band', 'provisional',
];

test('role and semantic colors are defined in light and both dark blocks (10.2, 10.3)', () => {
  const { light, mediaDark, manualDark } = themeBlocks();
  assert.ok(mediaDark, 'missing :root:not([data-theme="light"]) inside the dark media query');
  assert.ok(manualDark, 'missing :root[data-theme="dark"] block');
  for (const [label, body] of [['light', light], ['media dark', mediaDark], ['manual dark', manualDark]]) {
    const t = decls(body);
    for (const r of [...ROLE_COLORS, ...SEMANTIC_COLORS]) {
      assert.ok(t.has(`--color-${r}`), `${label}: missing --color-${r}`);
    }
  }
});

test('the two dark blocks are identical (9.2, 9.3)', () => {
  const { mediaDark, manualDark } = themeBlocks();
  assert.deepEqual([...decls(mediaDark)], [...decls(manualDark)]);
  assert.ok(decls(mediaDark).size > 0);
});

test('role colors reference the palette layer only', () => {
  const { light, mediaDark } = themeBlocks();
  for (const body of [light, mediaDark]) {
    for (const [n, v] of decls(body)) {
      if (n.startsWith('--color-')) assert.match(v, /^var\(--palette-[a-z0-9-]+\)$/, `${n} must reference a palette token, got ${v}`);
    }
  }
});

test('headings use a Mincho stack and no web fonts are loaded', () => {
  const t = decls(themeBlocks().light);
  assert.match(t.get('--font-heading') ?? '', /Hiragino Mincho.*Yu Mincho.*Noto Serif JP/s);
  assert.match(t.get('--font-body') ?? '', /system-ui/);
  const all = read('assets/css/tokens.css') + read('assets/css/base.css');
  assert.doesNotMatch(all, /@font-face|@import|url\(/);
});

test('base.css uses tokens only: no color or length literals other than 0', () => {
  const css = stripComments(read('assets/css/base.css'));
  // Values only (strip selectors); media-query numbers are checked separately against --bp-*.
  const values = [...css.matchAll(/:\s*([^;{}]+);/g)].map((m) => m[1]);
  for (const v of values) {
    assert.doesNotMatch(v, /#[0-9a-f]{3,8}\b/i, `color literal in "${v}"`);
    assert.doesNotMatch(v, /\b(rgb|rgba|hsl|hsla|oklch|lab|lch)\(/i, `color function in "${v}"`);
    assert.doesNotMatch(v, /(^|[\s(,])-?\d*\.?\d+(px|rem|em|vh|vw|pt|ch)\b/, `length literal in "${v}"`);
    // Only the "fill the container" percentage (e.g. max-width: 100% on media) is allowed.
    assert.doesNotMatch(v.replace(/(^|\s)100%/g, ''), /\d%/, `percentage literal in "${v}"`);
  }
  for (const m of css.matchAll(/@media[^{]*\(\s*(?:min|max)-width\s*:\s*(\d+)px/g)) {
    assert.ok(['600', '960', '1280'].includes(m[1]), `media query ${m[1]}px is not a --bp-* value`);
  }
});

test('base.css has a :focus-visible outline using --color-focus and the wrapping rule (13.5, 11.6)', () => {
  const css = stripComments(read('assets/css/base.css'));
  const focus = blockAfter(css, ':focus-visible');
  assert.ok(focus, 'missing :focus-visible rule');
  assert.match(focus, /outline\s*:[^;]*var\(--color-focus\)/);
  assert.match(css, /overflow-wrap\s*:\s*anywhere/);
  assert.match(css, /min-width\s*:\s*0/);
});

test('components.html links tokens.css then base.css, no external resources or module scripts', () => {
  const html = read('components.html');
  const t = html.indexOf('assets/css/tokens.css');
  const b = html.indexOf('assets/css/base.css');
  assert.ok(t > 0 && b > t, 'tokens.css must be linked before base.css');
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /type="module"/);
  assert.match(html, /<html lang="ja"/);
});
