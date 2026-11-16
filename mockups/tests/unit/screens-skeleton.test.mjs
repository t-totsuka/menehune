// Task 1.9: every screen page and the component sample page load the same assets in the
// designed order (design.md Pages > Screens), and every referenced file exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const SCREEN_IDS = [
  'top', 'calendar-month', 'day-detail', 'astro-events', 'star-chart',
  'post-detail', 'post-edit', 'my-posts', 'settings', 'login',
  'report', 'appeal', 'admin', 'attribution', 'privacy',
];

/** Paths relative to mockups/, in the designed order. */
const HEAD_SCRIPTS = ['assets/js/theme-boot.js'];
const STYLESHEETS = [
  'assets/css/tokens.css',
  'assets/css/base.css',
  'assets/css/components.css',
  'assets/css/wireframe.css',
  'assets/css/review.css',
];
const BODY_SCRIPTS = [
  'data/screens.js',
  'data/glossary.js',
  'data/sample-data.js',
  'assets/i18n/messages.ja.js',
  'assets/i18n/messages.en.js',
  'assets/js/mock-state.js',
  'assets/js/i18n.js',
  'assets/js/components/base.js',
  'assets/js/components/shell.js',
  'assets/js/components/almanac.js',
  'assets/js/components/sky.js',
  'assets/js/components/posts.js',
  'assets/js/components/location.js',
  'assets/js/review-shell.js',
];

/** @param {string} html @param {string} prefix */
function assetsOf(html, prefix) {
  const headEnd = html.indexOf('</head>');
  assert.ok(headEnd > 0, 'page must have a </head>');
  const head = html.slice(0, headEnd);
  const body = html.slice(headEnd);
  const strip = (/** @type {string} */ p) => {
    assert.ok(p.startsWith(prefix), `${p} must start with ${prefix || '(no prefix)'}`);
    return p.slice(prefix.length);
  };
  const scriptTags = (/** @type {string} */ s) => [...s.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
  for (const attrs of scriptTags(html)) {
    assert.doesNotMatch(attrs, /\b(defer|async|type\s*=)/, `classic script without defer/async/type: ${attrs}`);
  }
  const src = (/** @type {string} */ a) => (a.match(/\bsrc="([^"]+)"/) ?? [])[1] ?? '';
  return {
    headScripts: scriptTags(head).map(src).map(strip),
    bodyScripts: scriptTags(body).map(src).map(strip),
    styles: [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => strip(m[1])),
    stylesInBody: /<link\b[^>]*rel="stylesheet"/.test(body),
  };
}

/** @param {string} file @param {string} prefix */
function assertOrderedAssets(file, prefix) {
  const html = readFileSync(join(root, file), 'utf8');
  const a = assetsOf(html, prefix);
  assert.deepEqual(a.headScripts, HEAD_SCRIPTS, `${file}: only theme-boot in <head>`);
  assert.deepEqual(a.styles, STYLESHEETS, `${file}: stylesheet order`);
  assert.equal(a.stylesInBody, false, `${file}: stylesheets belong in <head>`);
  assert.deepEqual(a.bodyScripts, BODY_SCRIPTS, `${file}: body script order`);
  assert.match(html, /<\/script>\s*<\/body>/, `${file}: scripts sit at the end of <body>`);
}

test('every referenced asset file exists', () => {
  for (const p of [...HEAD_SCRIPTS, ...STYLESHEETS, ...BODY_SCRIPTS]) {
    assert.ok(existsSync(join(root, p)), `missing ${p}`);
  }
});

for (const id of SCREEN_IDS) {
  test(`screens/${id}.html: skeleton and designed asset order`, () => {
    const file = `screens/${id}.html`;
    assert.ok(existsSync(join(root, file)), `missing ${file}`);
    const html = readFileSync(join(root, file), 'utf8');
    assert.match(html, /^<!doctype html>/i);
    assert.match(html, new RegExp(`<body data-screen-id="${id}">`));
    assert.match(html, new RegExp(`<title data-i18n="screen\\.${id}\\.title">`));
    assert.match(html, new RegExp(`<h1[^>]*data-i18n="screen\\.${id}\\.title"`));
    const h = html.indexOf('<mk-site-header');
    const m = html.indexOf('<main');
    const f = html.indexOf('<mk-site-footer');
    assert.ok(h > 0 && m > h && f > m, 'mk-site-header, main, mk-site-footer in order');
    assertOrderedAssets(file, '../');
  });
}

test('components.html loads the same assets in the same order', () => {
  assertOrderedAssets('components.html', '');
});

test('no screen file references a missing local file', () => {
  for (const id of SCREEN_IDS) {
    const file = join(root, 'screens', `${id}.html`);
    assert.ok(existsSync(file), `missing screens/${id}.html`);
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/\b(?:src|href)="([^"#?]+)"/g)) {
      if (/^[a-z]+:/i.test(m[1])) continue;
      assert.ok(existsSync(resolve(root, 'screens', m[1])), `${id}.html references missing ${m[1]}`);
    }
  }
});
