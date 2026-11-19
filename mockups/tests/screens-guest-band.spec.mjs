// Task 8.1 (cross-screen review note of 2026-11-19): the read-only notice for guests
// (「ログインしていないため、閲覧のみ…」 with the login link) is shown in one place on every
// screen: a full-width band directly below the site header, above <main>
// (Requirements 6.5, 6.8, 12.1, 12.2, 13.3, 13.4).
// - every screen except login: exactly one notice, in the band (a named region), same text
// - the band sits between the header and <main> in the DOM and on screen, at 375 and 1440 px
// - no other read-only notice or login link is left inside <main> (the band replaces them)
// - members do not see it, and it follows a login state change (mock:change)
// - login: no band (the screen is the login itself; decision recorded as 見送り in the registry)
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, listScreens, loadClassicScripts } from './helpers/e2e.mjs';

const w = loadClassicScripts('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;

const urlOf = (/** @type {string} */ id, query = '') =>
  pathToFileURL(join(MOCKUPS_ROOT, 'screens', `${id}.html`)).href + query;

const BAND = 'body > mk-guest-notice[band]';
const NO_BAND = new Set(['login']);

for (const { id } of listScreens()) {
  test.describe(`guest band: ${id}`, () => {
    if (NO_BAND.has(id)) {
      test('guest: no band and no read-only notice on the login screen', async ({ page }) => {
        await page.goto(urlOf(id, '?lang=ja&auth=guest'));
        await expect(page.locator(BAND)).toHaveCount(0);
        await expect(page.getByText(ja['guest-notice.read-only'])).toHaveCount(0);
      });
      return;
    }

    for (const width of [375, 1440]) {
      test(`guest at ${width}px: exactly one notice, in the band below the header and above main`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(urlOf(id, '?lang=ja&auth=guest'));
        const band = page.locator(BAND);
        await expect(band).toHaveCount(1);
        await expect(band).toBeVisible();
        // one read-only notice on the whole page, and it is the band
        await expect(page.getByText(ja['guest-notice.read-only'], { exact: true })).toHaveCount(1);
        await expect(band).toContainText(ja['guest-notice.read-only']);
        await expect(page.locator('mk-guest-notice:not([variant="private-post"]):visible')).toHaveCount(1);
        // a named region with the login link
        const region = page.getByRole('region', { name: ja['guest-notice.band-label'] });
        await expect(region).toHaveCount(1);
        await expect(band.getByRole('region', { name: ja['guest-notice.band-label'] })).toHaveCount(1);
        await expect(band.getByRole('link', { name: ja['guest-notice.login'] })).toHaveAttribute('href', /screens\/login\.html$/);
        // nothing in <main> repeats the notice or the login link
        await expect(page.locator('main a[href*="login.html"]:visible')).toHaveCount(0);
        // DOM: directly after the header, before main
        const dom = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return {
            prev: el?.previousElementSibling?.localName ?? null,
            next: el?.nextElementSibling?.localName ?? null,
          };
        }, BAND);
        expect(dom).toEqual({ prev: 'mk-site-header', next: 'main' });
        // on screen: full width, below the header, above the main content
        const box = await page.evaluate((sel) => {
          const r = (/** @type {Element | null} */ el) => (el ? el.getBoundingClientRect().toJSON() : null);
          return {
            header: r(document.querySelector('mk-site-header')),
            band: r(document.querySelector(sel)),
            main: r(document.querySelector('main')),
            viewport: document.documentElement.clientWidth,
          };
        }, BAND);
        const { header, band: b, main } = /** @type {Record<string, DOMRect>} */ (/** @type {unknown} */ (box));
        expect(b.top).toBeGreaterThanOrEqual(header.bottom - 1);
        expect(b.bottom).toBeLessThanOrEqual(main.top + 1);
        expect(b.left).toBeLessThanOrEqual(0.5);
        expect(Math.abs(b.width - box.viewport)).toBeLessThanOrEqual(1);
      });
    }

    test('member: no band; switching the login state shows and hides it', async ({ page }) => {
      await page.goto(urlOf(id, '?lang=ja&auth=member'));
      await expect(page.locator(BAND)).toHaveCount(1);
      await expect(page.locator(BAND)).toBeHidden();
      await expect(page.getByText(ja['guest-notice.read-only']).filter({ visible: true })).toHaveCount(0);
      await page.evaluate(() => window.MockState.update({ auth: 'guest' }));
      await expect(page.locator(BAND)).toBeVisible();
      await page.evaluate(() => window.MockState.update({ auth: 'member' }));
      await expect(page.locator(BAND)).toBeHidden();
    });
  });
}

test('the band follows the language', async ({ page }) => {
  await page.goto(urlOf('settings', '?lang=en&auth=guest'));
  const band = page.locator(BAND);
  await expect(band).toContainText(en['guest-notice.read-only']);
  await expect(band.getByRole('region', { name: en['guest-notice.band-label'] })).toHaveCount(1);
  await expect(band.getByRole('link', { name: en['guest-notice.login'] })).toBeVisible();
});

test('admin as guest: the band and the no-permission notice', async ({ page }) => {
  await page.goto(urlOf('admin', '?lang=ja&auth=guest'));
  await expect(page.locator(BAND)).toBeVisible();
  await expect(page.locator('main [data-no-permission]')).toContainText(ja['error.no-permission']);
  await page.evaluate(() => window.MockState.update({ auth: 'admin' }));
  await expect(page.locator(BAND)).toBeHidden();
});
