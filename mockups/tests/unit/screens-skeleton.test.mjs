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
  // An inline page script (task 5.1: day-detail reads ?date=) may follow the designed external
  // scripts; it must not sit between them.
  const bodySrcs = scriptTags(body).map(src);
  const firstInline = bodySrcs.indexOf('');
  const lastExternal = bodySrcs.reduce((last, p, i) => (p === '' ? last : i), -1);
  return {
    headScripts: scriptTags(head).map(src).map(strip),
    bodyScripts: bodySrcs.filter((p) => p !== '').map(strip),
    inlineBeforeExternal: firstInline !== -1 && firstInline < lastExternal,
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
  assert.equal(a.inlineBeforeExternal, false, `${file}: an inline page script comes after the designed scripts`);
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

// Task 6.1: the catalog pages share the asset set (so the review shell, the theme and the read-only
// dictionaries work on every one), a static catalog nav and fixed Japanese copy.
const CATALOG_PAGES = ['index.html', 'viewer.html', 'components.html', 'tokens.html', 'glossary.html', 'a11y.html'];

test('review.css styles the catalog nav without product tokens', () => {
  const css = readFileSync(join(root, 'assets/css/review.css'), 'utf8');
  assert.match(css, /\.mk-catalog-nav\b/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /var\(--/, 'review.css must not reference product tokens');
});

for (const file of CATALOG_PAGES) {
  test(`${file}: catalog page skeleton, assets and catalog nav`, () => {
    assert.ok(existsSync(join(root, file)), `missing ${file}`);
    const html = readFileSync(join(root, file), 'utf8');
    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /<html lang="ja">/);
    assert.doesNotMatch(html, /<body[^>]*data-screen-id/, `${file}: a catalog page is not a screen`);
    assertOrderedAssets(file, '');
    const nav = /<nav class="mk-catalog-nav" aria-label="カタログ">([\s\S]*?)<\/nav>/.exec(html);
    assert.ok(nav, `${file}: has the catalog nav`);
    assert.ok(nav.index < html.indexOf('<main'), `${file}: catalog nav comes before <main>`);
    const hrefs = [...nav[1].matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, CATALOG_PAGES, `${file}: nav links in order`);
    const current = [...nav[1].matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]);
    assert.deepEqual(current, [file], `${file}: only the page itself is aria-current`);
    assert.doesNotMatch(nav[1], /data-i18n/, `${file}: catalog nav copy is fixed Japanese`);
    for (const m of html.matchAll(/\b(?:src|href)="([^"#?]+)"/g)) {
      assert.doesNotMatch(m[1], /^[a-z]+:/i, `${file}: no external reference ${m[1]}`);
      assert.ok(existsSync(resolve(root, m[1])), `${file} references missing ${m[1]}`);
    }
  });
}

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
