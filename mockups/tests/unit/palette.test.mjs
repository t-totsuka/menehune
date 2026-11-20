// Task 8.2: the night-sky / astronomy palette (9.1, 9.2, 9.5) and the contrast pairs widened to
// every foreground / background combination the hi-fi screens paint (13.1, 13.2).
// tokens.css is parsed here on purpose (self-contained, like the check scripts): every role color
// is var(--palette-*) and every palette value is a #rrggbb literal in the light :root block.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseColor, relativeLuminance, contrastRatio } from '../../tools/check-contrast.mjs';

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
const themes = { light: lightBlock, dark: new Map([...lightBlock, ...darkBlock]) };

/** Resolves a token to an opaque color in a theme. @param {'light' | 'dark'} theme @param {string} name */
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

/** HSL of a color: hue in degrees, saturation and lightness 0..1, chroma 0..1. */
function hsl(/** @type {{ r: number, g: number, b: number }} */ c) {
  const [r, g, b] = [c.r / 255, c.g / 255, c.b / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (chroma > 0) {
    if (max === r) h = ((g - b) / chroma) % 6;
    else if (max === g) h = (b - r) / chroma + 2;
    else h = (r - g) / chroma + 4;
    h = (h * 60 + 360) % 360;
  }
  const s = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * l - 1));
  return { h, s, l, chroma };
}

const pairs = /** @type {{ fg: string, bg: string, min: number, themes: string[] }[]} */ (
  JSON.parse(read('tools/contrast-pairs.json'))
);

// Every combination the hi-fi DOM paints (surveyed over all 15 screens x auth x scenario at 375
// and 1280px, plus the component gallery, and the CSS rules of base.css / components.css).
// 4.5: text. 3: borders, outlines, focus, icons and figure marks.
const SURFACES = ['--color-bg', '--color-surface', '--color-surface-muted'];
const SEMANTIC_TEXT = [
  'holiday', 'sunday', 'saturday',
  'rokuyo-taian', 'rokuyo-butsumetsu', 'rokuyo-sensho', 'rokuyo-tomobiki', 'rokuyo-senbu', 'rokuyo-shakku',
  'event-moon', 'event-planet', 'event-sun',
  'status-public', 'status-members-only', 'status-hidden', 'status-deleted',
  'admin-band', 'provisional', 'error',
].map((n) => `--color-${n}`);
/** @type {[string, string, number][]} */
const REQUIRED = [
  ...['--color-text', '--color-text-muted', '--color-link'].flatMap((fg) => SURFACES.map((bg) => /** @type {[string, string, number]} */ ([fg, bg, 4.5]))),
  ['--color-on-accent', '--color-accent', 4.5],
  ...SEMANTIC_TEXT.flatMap((fg) => ['--color-bg', '--color-surface'].map((bg) => /** @type {[string, string, number]} */ ([fg, bg, 4.5]))),
  // The admin item's left rule on the surface-muted board column.
  ['--color-admin-band', '--color-surface-muted', 3],
  // The moon figure: the lit part against the dark part of the disc.
  ['--color-moon-lit', '--color-moon-shadow', 3],
  // Buttons, the selected day, calendar summary rule, precision picker: accent against the page.
  ['--color-accent', '--color-bg', 3],
  ['--color-accent', '--color-surface', 3],
  // The map pin's dot on the accent pin body.
  ['--color-surface', '--color-accent', 3],
  // Card, guest band and admin item edges, chart ticks, star-chart lines, map roads.
  ...SURFACES.map((bg) => /** @type {[string, string, number]} */ (['--color-border', bg, 3])),
  // Controls, pager, unread notice rule, guest notice rule, moon disc and horizon outlines.
  ...SURFACES.map((bg) => /** @type {[string, string, number]} */ (['--color-border-strong', bg, 3])),
  // The focus ring sits on the background around the element (outline-offset): bg, surface, the guest band.
  ...SURFACES.map((bg) => /** @type {[string, string, number]} */ (['--color-focus', bg, 3])),
];

test('contrast-pairs.json holds every surveyed hi-fi combination, in both themes (13.1, 13.2)', () => {
  const missing = REQUIRED.filter(([fg, bg, min]) =>
    !pairs.some((p) => p.fg === fg && p.bg === bg && p.min === min && p.themes.includes('light') && p.themes.includes('dark')));
  assert.deepEqual(missing, []);
  const keys = pairs.map((p) => `${p.fg} ${p.bg} ${p.min}`);
  assert.equal(new Set(keys).size, keys.length, 'no duplicate pairs');
});

test('every foreground color token is checked against at least one background', () => {
  // Backgrounds only: the page surfaces, the shadow, and the moon disc (the lit part's background).
  const backgroundsOnly = new Set([...SURFACES, '--color-shadow', '--color-moon-shadow']);
  const fgs = new Set(pairs.map((p) => p.fg));
  const unchecked = [...lightBlock.keys()].filter((n) => n.startsWith('--color-') && !backgroundsOnly.has(n) && !fgs.has(n));
  assert.deepEqual(unchecked, []);
});

test('light: a pale indigo dawn background, deep navy text and an indigo accent (9.5)', () => {
  const bg = hsl(color('light', '--color-bg'));
  assert.ok(bg.h >= 215 && bg.h <= 255, `bg hue ${bg.h.toFixed(0)} is blue-violet`);
  assert.ok(bg.l >= 0.85 && bg.l <= 0.96, `bg lightness ${bg.l.toFixed(3)} is pale, not white`);
  assert.ok(bg.chroma >= 0.06, `bg chroma ${bg.chroma.toFixed(3)} shows a visible indigo tint`);
  for (const name of ['--color-surface', '--color-surface-muted']) {
    const s = hsl(color('light', name));
    assert.ok(s.chroma === 0 || (s.h >= 215 && s.h <= 255), `${name} hue ${s.h.toFixed(0)} stays in the indigo family`);
  }
  const text = hsl(color('light', '--color-text'));
  assert.ok(text.h >= 215 && text.h <= 250, `text hue ${text.h.toFixed(0)} is navy`);
  assert.ok(text.l <= 0.2 && text.chroma >= 0.1, `text is a deep navy, not black (l ${text.l.toFixed(3)}, chroma ${text.chroma.toFixed(3)})`);
  const accent = hsl(color('light', '--color-accent'));
  assert.ok(accent.h >= 220 && accent.h <= 250, `accent hue ${accent.h.toFixed(0)} is indigo`);
  assert.ok(accent.l >= 0.2 && accent.l <= 0.45 && accent.s >= 0.35, `accent is a saturated indigo (l ${accent.l.toFixed(3)}, s ${accent.s.toFixed(3)})`);
});

test('dark: a deep navy background with a gold accent (9.1)', () => {
  const bg = hsl(color('dark', '--color-bg'));
  assert.ok(bg.h >= 215 && bg.h <= 250, `bg hue ${bg.h.toFixed(0)} is navy`);
  assert.ok(bg.l <= 0.12 && bg.chroma >= 0.05, `bg is a deep navy (l ${bg.l.toFixed(3)}, chroma ${bg.chroma.toFixed(3)})`);
  for (const name of ['--color-surface', '--color-surface-muted']) {
    const s = hsl(color('dark', name));
    assert.ok(s.h >= 215 && s.h <= 250 && s.l <= 0.2, `${name} stays a dark navy`);
  }
  for (const name of ['--color-accent', '--color-focus']) {
    const a = hsl(color('dark', name));
    assert.ok(a.h >= 35 && a.h <= 55, `${name} hue ${a.h.toFixed(0)} is gold`);
    assert.ok(a.l >= 0.6 && a.s >= 0.5, `${name} is a bright gold (l ${a.l.toFixed(3)}, s ${a.s.toFixed(3)})`);
  }
});

test('moon figure: the lit part is the bright gold side in both themes (hi-fi point from 8.1)', () => {
  const components = stripComments(read('assets/css/components.css'));
  assert.match(blockAfter(components, '.mk-moon__disc {'), /fill:\s*var\(--color-moon-shadow\)/);
  assert.match(blockAfter(components, '.mk-moon__lit {'), /fill:\s*var\(--color-moon-lit\)/);
  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    const lit = color(theme, '--color-moon-lit');
    const shadow = color(theme, '--color-moon-shadow');
    assert.ok(relativeLuminance(lit) > relativeLuminance(shadow), `${theme}: the lit side is brighter than the dark side`);
    assert.ok(contrastRatio(lit, shadow) >= 3, `${theme}: lit vs dark side 3:1`);
    const h = hsl(lit);
    assert.ok(h.h >= 35 && h.h <= 55, `${theme}: the lit side is gold (hue ${h.h.toFixed(0)})`);
    assert.ok(hsl(shadow).l <= 0.3, `${theme}: the dark side is a night navy`);
  }
});

test('wireframe.css turns every color token into a gray (no hi-fi color leaks into the wireframe stage)', () => {
  const wf = stripComments(read('assets/css/wireframe.css'));
  const all = new Set([...wf.matchAll(/(--color-[a-z0-9-]+)\s*:\s*var\(--wf-gray-[a-z-]+\)/g)].map((m) => m[1]));
  const missing = [...lightBlock.keys()].filter((n) => n.startsWith('--color-') && !all.has(n));
  assert.deepEqual(missing, []);
});
