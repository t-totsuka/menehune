// Task 1.9: the 15 screens open directly via file://, share one skeleton, switch the title between
// ja and en, show the review toolbar (and the "未確定" banner on hifi), and load without console
// errors or failed requests.
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** Loads classic scripts into a fake window (same approach as the unit tests). */
const load = (/** @type {string[]} */ ...files) => {
  const window = /** @type {Record<string, unknown> & { MockScreens?: unknown, MockMessages?: unknown }} */ ({});
  const ctx = vm.createContext({ window });
  for (const f of files) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  return window;
};
const w = load('data/screens.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {{ id: string, titleKey: string, review: { wireframe: { status: string } } }[]} */
const screens = w.MockScreens;
const ja = w.MockMessages.ja;
const en = w.MockMessages.en;

// Task 8.1 (day-detail review): the day-detail heading is the shown date (date-long of the sample
// today, 2026-11-16, when there is no ?date=); its <title> keeps the registry title.
/** @type {Record<string, { ja: string, en: string }>} */
const H1_OVERRIDES = { 'day-detail': { ja: '2026年11月16日(月)', en: 'Mon, Nov 16, 2026' } };
/** @param {string} id @param {'ja' | 'en'} lang @param {string} titleKey @returns {string} */
const h1Of = (id, lang, titleKey) => H1_OVERRIDES[id]?.[lang] ?? (lang === 'ja' ? ja : en)[titleKey];

const urlOf = (/** @type {string} */ id, query = '') =>
  pathToFileURL(join(root, 'screens', `${id}.html`)).href + query;

const STYLESHEETS = ['tokens.css', 'base.css', 'components.css', 'wireframe.css', 'review.css'];
const BODY_SCRIPTS = [
  'screens.js', 'glossary.js', 'sample-data.js', 'messages.ja.js', 'messages.en.js',
  'mock-state.js', 'i18n.js', 'base.js', 'shell.js', 'almanac.js', 'sky.js', 'posts.js',
  'location.js', 'review-shell.js',
];

test('the registry lists 15 screens', () => {
  expect(screens).toHaveLength(15);
});

for (const { id, titleKey, review } of screens) {
  test.describe(`screens/${id}.html`, () => {
    test('opens via file:// without console errors or failed requests; skeleton and order', async ({ page }) => {
      /** @type {string[]} */
      const errors = [];
      /** @type {string[]} */
      const failed = [];
      page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') errors.push(msg.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('requestfailed', (r) => failed.push(r.url()));

      await page.goto(urlOf(id, '?lang=ja&stage=wireframe'));
      await expect(page.locator('body')).toHaveAttribute('data-screen-id', id);
      await expect(page.locator('main h1')).toHaveText(h1Of(id, 'ja', titleKey));
      await expect(page).toHaveTitle(ja[titleKey]);
      await expect(page.getByRole('region', { name: 'レビュー用ツールバー' })).toBeVisible();

      const order = await page.evaluate(() =>
        [...document.body.children].map((el) => el.localName)
          .filter((n) => ['mk-site-header', 'main', 'mk-site-footer'].includes(n)));
      expect(order).toEqual(['mk-site-header', 'main', 'mk-site-footer']);

      const assets = await page.evaluate(() => ({
        head: [...document.head.querySelectorAll('script')].map((s) => s.src.split('/').pop()),
        styles: [...document.querySelectorAll('link[rel="stylesheet"]')]
          .map((l) => /** @type {HTMLLinkElement} */ (l).href.split('/').pop()),
        // External scripts only: an inline page script (task 5.1, day-detail) may follow them.
        body: [...document.body.querySelectorAll('script[src]')].map((s) => s.src.split('/').pop()),
      }));
      expect(assets.head).toEqual(['theme-boot.js']);
      expect(assets.styles).toEqual(STYLESHEETS);
      expect(assets.body).toEqual(BODY_SCRIPTS);

      expect(errors).toEqual([]);
      expect(failed).toEqual([]);
    });

    test('title switches to English with ?lang=en', async ({ page }) => {
      await page.goto(urlOf(id, '?lang=en'));
      await expect(page.locator('main h1')).toHaveText(h1Of(id, 'en', titleKey));
      await expect(page).toHaveTitle(en[titleKey]);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });

    if (review.wireframe.status === 'approved') {
      test('no "未確定" banner on hifi (wireframe approved)', async ({ page }) => {
        await page.goto(urlOf(id, '?stage=hifi&lang=ja'));
        await expect(page.locator('[data-review-shell]')).toBeVisible();
        await expect(page.locator('[data-review-banner="provisional"]')).toBeHidden();
        await expect(page.locator('[data-review-status]')).toContainText('ワイヤーフレーム 承認済み');
      });
    } else {
      test('"未確定" banner on hifi', async ({ page }) => {
        await page.goto(urlOf(id, '?stage=hifi&lang=ja'));
        const banner = page.locator('[data-review-banner="provisional"]');
        await expect(banner).toBeVisible();
        await expect(banner).toContainText('未確定');
      });
    }
  });
}
