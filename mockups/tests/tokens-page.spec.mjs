// Task 6.5: the token page (tokens.html) shows every design token with a sample and usage
// examples (10.5). Colors show the light and dark values side by side, and the main foreground /
// background pairs show their contrast ratio in both themes (13.1, 13.2 for context).
// - every custom property defined in the :root block of tokens.css has exactly one row, in the
//   section of its category, and every category section has a usage example
// - color rows hold the light and dark values that the browser computes for each theme, whatever
//   theme or stage the page itself is shown in (the page attributes are left as they were)
// - the contrast table lists exactly the pairs of tools/contrast-pairs.json, with the ratio that
//   check-contrast's formula gives for the values of each theme, and a pass / fail mark
// - no console problems, no horizontal overflow at 375px
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parseColor, contrastRatio } from '../tools/check-contrast.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const pageUrl = pathToFileURL(join(root, 'tokens.html')).href;

const tokensCss = readFileSync(join(root, 'assets/css/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** Custom property names declared in the first `:root {` block, in source order. */
const TOKENS = (() => {
  const start = tokensCss.indexOf(':root {');
  const body = tokensCss.slice(start, tokensCss.indexOf('}', start));
  return [...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
})();
/** Names redefined by the dark theme. */
const DARK_TOKENS = (() => {
  const start = tokensCss.indexOf(':root[data-theme="dark"] {');
  const body = tokensCss.slice(start, tokensCss.indexOf('}', start));
  return [...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
})();

/** @type {{ fg: string, bg: string, min: number, themes: string[] }[]} */
const PAIRS = JSON.parse(readFileSync(join(root, 'tools/contrast-pairs.json'), 'utf8'));

// Longest prefix first, so --font-size-* is not filed under --font-*.
const CATEGORIES = ['font-size', 'font-weight', 'line-height', 'palette', 'color', 'font', 'space', 'radius', 'border', 'shadow', 'bp'];
/** @param {string} name */
const categoryOf = (name) => CATEGORIES.find((c) => name.startsWith(`--${c}-`));

/** @param {import('@playwright/test').Page} page */
const collectProblems = (page) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
};

/**
 * Values the browser computes for every token under a forced theme, read on a plain page load.
 * @param {import('@playwright/test').Page} page @param {'light' | 'dark'} theme
 */
const computedValues = async (page, theme) => {
  await page.goto(`${pageUrl}?theme=${theme}&stage=hifi`);
  return page.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim()]));
  }, TOKENS);
};

test('the source scan finds the token set and the pairs', () => {
  expect(TOKENS.length).toBeGreaterThanOrEqual(100);
  expect(DARK_TOKENS.length).toBeGreaterThan(20);
  expect(PAIRS.length).toBeGreaterThan(20);
  expect(TOKENS.filter((n) => categoryOf(n) === undefined)).toEqual([]);
});

test('every token has exactly one row in its category section, and every section has a usage example', async ({ page }) => {
  const problems = collectProblems(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(pageUrl);
  for (const name of TOKENS) {
    const rows = page.locator(`main [data-token="${name}"]`);
    await expect(rows, name).toHaveCount(1);
    const section = await rows.evaluate((el) => el.closest('section[data-category]')?.getAttribute('data-category'));
    expect(section, name).toBe(categoryOf(name));
  }
  // No row for something that is not a token (e.g. the wireframe grays).
  const shown = await page.locator('main [data-token]').evaluateAll((els) => els.map((e) => e.getAttribute('data-token')));
  expect([...shown].sort()).toEqual([...TOKENS].sort());

  for (const category of new Set(TOKENS.map(categoryOf))) {
    const section = page.locator(`main section[data-category="${category}"]`);
    await expect(section, category).toHaveCount(1);
    await expect(section.locator('h2'), category).toHaveCount(1);
    const usage = section.locator('[data-usage]');
    expect(await usage.count(), `${category} usage`).toBeGreaterThan(0);
    await expect(usage.first(), `${category} usage`).toBeVisible();
  }
  // A table of contents links to every category section.
  for (const category of new Set(TOKENS.map(categoryOf))) {
    const id = await page.locator(`main section[data-category="${category}"]`).getAttribute('id');
    expect(id, category).toBeTruthy();
    await expect(page.locator(`main nav a[href="#${id}"]`), category).toHaveCount(1);
  }
  expect(problems).toEqual([]);
});

test('color rows show the light and dark values side by side, whatever the page theme and stage', async ({ page }) => {
  const light = await computedValues(page, 'light');
  const dark = await computedValues(page, 'dark');
  const colorTokens = TOKENS.filter((n) => n.startsWith('--color-') || n.startsWith('--palette-'));
  expect(DARK_TOKENS.every((n) => colorTokens.includes(n))).toBe(true);

  for (const query of ['', '?theme=dark', '?theme=light&stage=wireframe', '?theme=dark&stage=wireframe']) {
    const problems = collectProblems(page);
    await page.goto(`${pageUrl}${query}`);
    const shown = await page.locator('main [data-token]').evaluateAll((els) => Object.fromEntries(els.map((e) => [
      e.getAttribute('data-token'),
      {
        light: e.querySelector('[data-theme-value="light"]')?.getAttribute('data-value') ?? null,
        dark: e.querySelector('[data-theme-value="dark"]')?.getAttribute('data-value') ?? null,
        swatches: e.querySelectorAll('[data-swatch]').length,
      },
    ])));
    for (const name of colorTokens) {
      expect(shown[name]?.light, `${name} light ${query}`).toBe(light[name]);
      expect(shown[name]?.dark, `${name} dark ${query}`).toBe(dark[name]);
      expect(shown[name]?.swatches, `${name} swatches ${query}`).toBeGreaterThanOrEqual(2);
    }
    // Non-color tokens whose value follows the theme (borders, shadows) show both values too.
    for (const name of TOKENS.filter((n) => !colorTokens.includes(n) && light[n] !== dark[n])) {
      expect(shown[name]?.light, `${name} light ${query}`).toBe(light[name]);
      expect(shown[name]?.dark, `${name} dark ${query}`).toBe(dark[name]);
    }
    // The page leaves its own theme and stage as they were.
    const attrs = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      stage: document.documentElement.getAttribute('data-stage'),
    }));
    const params = new URLSearchParams(query);
    if (params.has('theme')) expect(attrs.theme, query).toBe(params.get('theme'));
    expect(attrs.stage, query).toBe(params.get('stage') ?? 'hifi');
    expect(problems, query).toEqual([]);
  }
});

test('the contrast table lists the contrast-pairs.json pairs with the ratio of each theme', async ({ page }) => {
  const values = { light: await computedValues(page, 'light'), dark: await computedValues(page, 'dark') };
  const problems = collectProblems(page);
  await page.goto(pageUrl);
  const rows = page.locator('main #tk-contrast tbody > tr');
  await expect(rows).toHaveCount(PAIRS.length);
  const shown = await rows.evaluateAll((trs) => trs.map((tr) => ({
    fg: tr.getAttribute('data-fg'),
    bg: tr.getAttribute('data-bg'),
    min: Number(tr.getAttribute('data-min')),
    cells: [...tr.querySelectorAll('[data-theme-ratio]')].map((c) => ({
      theme: c.getAttribute('data-theme-ratio'),
      ratio: c.getAttribute('data-ratio'),
      text: c.textContent ?? '',
    })),
  })));
  expect(shown.map((r) => `${r.fg} ${r.bg} ${r.min}`)).toEqual(PAIRS.map((p) => `${p.fg} ${p.bg} ${p.min}`));
  for (const [i, pair] of PAIRS.entries()) {
    const row = shown[i];
    expect(row.cells.map((c) => c.theme), pair.fg).toEqual(pair.themes);
    for (const cell of row.cells) {
      const theme = /** @type {'light' | 'dark'} */ (cell.theme);
      const fg = parseColor(values[theme][pair.fg]);
      const bg = parseColor(values[theme][pair.bg]);
      if (!fg || !bg) throw new Error(`unparsable ${pair.fg} / ${pair.bg} in ${theme}`);
      const ratio = contrastRatio(fg, bg);
      expect(cell.ratio, `${pair.fg} on ${pair.bg} ${theme}`).toBe(ratio.toFixed(2));
      expect(cell.text).toContain(`${ratio.toFixed(2)}:1`);
      expect(cell.text).toContain(ratio >= pair.min ? '合格' : '不合格');
    }
  }
  expect(problems).toEqual([]);
});

test('the page fits a 375px viewport without horizontal overflow', async ({ page }) => {
  const problems = collectProblems(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(pageUrl);
  await expect(page.locator('main [data-token]').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(problems).toEqual([]);
});

// Post-validation cleanup: tokens that nothing references yet stay (removing a token name is a
// revalidation trigger for the later specs) and are marked as reserved on this page. A token is
// referenced when its name appears in the product CSS, the scripts, the screens or the catalog
// pages outside its own definition (var(--x) in tokens.css counts: role colors reference the
// palette). The --bp-* values are referenced by the @media rules (check-tokens keeps them equal).
const REFERENCE_SOURCES = [
  ...['tokens.css', 'base.css', 'components.css', 'wireframe.css'].map((f) => `assets/css/${f}`),
  ...['almanac.js', 'base.js', 'location.js', 'posts.js', 'shell.js', 'sky.js'].map((f) => `assets/js/components/${f}`),
  'assets/js/i18n.js', 'assets/js/mock-state.js', 'assets/js/theme-boot.js', 'assets/js/paging.js',
  ...['top', 'calendar-month', 'day-detail', 'astro-events', 'star-chart', 'post-detail', 'post-edit', 'my-posts',
    'settings', 'login', 'report', 'appeal', 'admin', 'attribution', 'privacy'].map((id) => `screens/${id}.html`),
  'index.html', 'viewer.html', 'components.html', 'tokens.html', 'glossary.html', 'a11y.html',
];
const UNREFERENCED = (() => {
  // Inline scripts of the pages are left out: tokens.html names the reserved tokens in its script.
  const text = REFERENCE_SOURCES.map((f) => {
    const src = readFileSync(join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    return f.endsWith('.html') ? src.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '') : src;
  }).join('\n');
  return TOKENS.filter((name) => !name.startsWith('--bp-')).filter((name) => {
    const esc = name.replace(/[-]/g, '\-');
    const uses = text.match(new RegExp(`${esc}(?![\w-])(?!\s*:)`, 'g')) ?? [];
    return uses.length === 0;
  });
})();

test('tokens no product file references are marked as reserved, and only those', async ({ page }) => {
  expect(UNREFERENCED.length, 'there are reserved tokens to mark').toBeGreaterThan(0);
  await page.goto(pageUrl);
  const reserved = await page.locator('main [data-token]:has([data-reserved])').evaluateAll((els) => els.map((e) => e.getAttribute('data-token')));
  expect([...reserved].sort()).toEqual([...UNREFERENCED].sort());
  for (const name of UNREFERENCED) {
    await expect(page.locator(`main [data-token="${name}"] [data-reserved]`), name).toHaveText(/予約/);
  }
});
