// Task 6.1: shared catalog navigation (review.css) on the component gallery and the five catalog
// pages (index, viewer, tokens, glossary, a11y) (2.2).
// - every catalog page has <nav aria-label="カタログ"> with a list of links to all six pages
// - the link to the page itself carries aria-current="page" (and only that one)
// - each link moves to its page over file://, without console problems or non-file requests
// - the nav wraps at 375px without a horizontal page scroll, and keyboard focus on it is visible
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const urlOf = (/** @type {string} */ file) => pathToFileURL(join(root, file)).href;

/** In nav order: file and fixed Japanese label. */
const PAGES = [
  { file: 'index.html', label: '一覧' },
  { file: 'viewer.html', label: '幅プレビュー' },
  { file: 'components.html', label: '部品ギャラリー' },
  { file: 'tokens.html', label: 'トークン' },
  { file: 'glossary.html', label: '用語集' },
  { file: 'a11y.html', label: 'アクセシビリティ' },
];

/** @param {import('@playwright/test').Page} page */
const catalogNav = (page) => page.getByRole('navigation', { name: 'カタログ' });

/** Records console warnings/errors, page errors and every non-file request (blocked). */
async function watch(/** @type {import('@playwright/test').Page} */ page) {
  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const external = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.route((u) => u.protocol !== 'file:', (route) => {
    external.push(route.request().url());
    return route.abort();
  });
  return { problems, external };
}

for (const current of PAGES) {
  test(`${current.file}: catalog nav lists every catalog page and marks the current one`, async ({ page }) => {
    const seen = await watch(page);
    await page.goto(urlOf(current.file));
    const nav = catalogNav(page);
    await expect(nav).toHaveCount(1);
    await expect(nav).toBeVisible();
    const links = nav.locator('ul > li > a');
    await expect(links).toHaveCount(PAGES.length);
    for (const [i, p] of PAGES.entries()) {
      const link = links.nth(i);
      await expect(link).toHaveText(p.label);
      expect(await link.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(urlOf(p.file));
      if (p.file === current.file) await expect(link).toHaveAttribute('aria-current', 'page');
      else await expect(link).not.toHaveAttribute('aria-current', /.*/);
    }
    await expect(page.locator('h1')).toHaveCount(1);
    expect(seen.problems).toEqual([]);
    expect(seen.external).toEqual([]);
  });
}

test('moving through the catalog nav reaches each page over file://', async ({ page }) => {
  const seen = await watch(page);
  await page.goto(urlOf('components.html'));
  for (const target of [...PAGES.filter((p) => p.file !== 'components.html'), PAGES[2]]) {
    await catalogNav(page).getByRole('link', { name: target.label, exact: true }).click();
    await expect(page).toHaveURL(urlOf(target.file));
    await expect(catalogNav(page).locator('[aria-current="page"]')).toHaveText(target.label);
  }
  expect(seen.problems).toEqual([]);
  expect(seen.external).toEqual([]);
});

test.describe('at 375px', () => {
  test.use({ viewport: { width: 375, height: 800 } });
  for (const p of PAGES) {
    test(`${p.file}: the nav wraps without a horizontal page scroll`, async ({ page }) => {
      await page.goto(urlOf(p.file));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const boxes = await catalogNav(page).locator('a').evaluateAll((as) => as.map((a) => {
        const r = a.getBoundingClientRect();
        return { left: r.left, right: r.right };
      }));
      for (const b of boxes) {
        expect(b.left).toBeGreaterThanOrEqual(0);
        expect(b.right).toBeLessThanOrEqual(375);
      }
    });
  }
});

for (const scheme of /** @type {const} */ (['light', 'dark'])) {
  test(`keyboard focus on the catalog nav is visible (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(urlOf('index.html'));
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || !el.closest('nav[aria-label="カタログ"]')) return null;
      const s = getComputedStyle(el);
      return { width: parseFloat(s.outlineWidth), style: s.outlineStyle };
    });
    expect(focus).not.toBeNull();
    expect(focus?.width ?? 0).toBeGreaterThan(0);
    expect(focus?.style).not.toBe('none');
  });
}
