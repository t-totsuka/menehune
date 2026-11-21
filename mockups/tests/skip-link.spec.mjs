// Post-validation cleanup (13.5, nav.skip-to-content): mk-site-header starts with a skip link to
// the page's <main>. It is the first Tab stop, hidden until focused (so no screen changes its
// look), named by nav.skip-to-content in the current language, and moves the focus to <main>
// without changing the URL.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { MOCKUPS_ROOT, listScreens } from './helpers/e2e.mjs';

const load = (/** @type {string[]} */ ...files) => {
  const window = /** @type {Record<string, any>} */ ({});
  const ctx = vm.createContext({ window });
  for (const f of files) vm.runInContext(readFileSync(join(MOCKUPS_ROOT, f), 'utf8'), ctx, { filename: f });
  return window;
};
const w = load('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, Record<string, string>>} */
const dict = { ja: w.MockMessages.ja, en: w.MockMessages.en };

/** @param {import('@playwright/test').Page} page */
const collectProblems = (page) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
};

/** @param {import('@playwright/test').Page} page */
const skipLink = (page) => page.locator('mk-site-header').first().locator('a.mk-skip-link');

/** Size of the link's box (a visually hidden link is at most 1px). @param {import('@playwright/test').Page} page */
const box = async (page) => {
  const b = await skipLink(page).boundingBox();
  return { width: b?.width ?? 0, height: b?.height ?? 0, x: b?.x ?? -1, y: b?.y ?? -1 };
};

for (const lang of /** @type {const} */ (['ja', 'en'])) {
  for (const stage of /** @type {const} */ (['hifi', 'wireframe'])) {
    test(`top (${lang}, ${stage}): the first Tab stop is the skip link; hidden until focused; moves focus to <main>`, async ({ page }) => {
      const problems = collectProblems(page);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`screens/top.html?lang=${lang}&stage=${stage}`);
      const link = skipLink(page);
      await expect(link).toHaveCount(1);
      await expect(link).toHaveText(dict[lang]['nav.skip-to-content']);

      // Hidden until focused: no box of its own, so the screen looks the same.
      const hidden = await box(page);
      expect(hidden.width).toBeLessThanOrEqual(1);
      expect(hidden.height).toBeLessThanOrEqual(1);

      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      const shown = await box(page);
      expect(shown.width).toBeGreaterThan(1);
      expect(shown.height).toBeGreaterThan(1);
      expect(shown.x).toBeGreaterThanOrEqual(0);
      expect(shown.y).toBeGreaterThanOrEqual(0);
      expect(shown.x + shown.width).toBeLessThanOrEqual(375);
      const outline = await link.evaluate((el) => ({ visible: el.matches(':focus-visible'), width: parseFloat(getComputedStyle(el).outlineWidth) }));
      expect(outline.visible).toBe(true);
      expect(outline.width).toBeGreaterThan(0);

      const before = page.url();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
      expect(page.url(), 'the URL does not change (no hash)').toBe(before);
      // The next Tab continues inside <main> (or after it), not back in the header.
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('mk-site-header'))).toBe(false);
      expect(problems).toEqual([]);
    });
  }
}

test('the skip link follows the language switch', async ({ page }) => {
  await page.goto('screens/top.html?lang=ja');
  await expect(skipLink(page)).toHaveText(dict.ja['nav.skip-to-content']);
  await page.locator('mk-site-header').first().getByRole('button', { name: 'English' }).click();
  await expect(skipLink(page)).toHaveText(dict.en['nav.skip-to-content']);
});

for (const { id } of listScreens()) {
  test(`screens/${id}.html: the skip link points at the page's <main>`, async ({ page }) => {
    await page.goto(`screens/${id}.html`);
    const link = skipLink(page);
    await expect(link).toHaveCount(1);
    const target = await link.evaluate((a) => {
      const href = a.getAttribute('href') ?? '';
      const el = href.startsWith('#') ? document.getElementById(href.slice(1)) : null;
      return { href, isMain: el !== null && el === document.querySelector('main') };
    });
    expect(target.isMain, `${target.href} names <main>`).toBe(true);
  });
}
