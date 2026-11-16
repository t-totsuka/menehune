// Task 1.5: ThemeBoot (initial theme without flicker) and MockState (resolution, attributes,
// warnings, update + mock:change, stored prefs) (3.3, 9.3, 9.4, 11.2).
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalogUrl = pathToFileURL(join(here, '..', 'components.html')).href;
const screenUrl = pathToFileURL(join(here, 'fixtures', 'screen-fixture.html')).href;
const bootOnlyUrl = pathToFileURL(join(here, 'fixtures', 'theme-boot-only.html')).href;
const STORAGE_KEY = 'mk.prefs';

/** @param {import('@playwright/test').Page} page */
const rootAttrs = (page) => page.evaluate(() => {
  const h = document.documentElement;
  return {
    lang: h.getAttribute('lang'),
    theme: h.getAttribute('data-theme'),
    stage: h.getAttribute('data-stage'),
    auth: h.getAttribute('data-auth'),
    scenario: h.getAttribute('data-scenario'),
  };
});

/** @param {import('@playwright/test').Page} page */
const stored = (page) => page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);

test('catalog page: URL params resolve; unknown stage falls back to hifi with one warning', async ({ page }) => {
  await page.goto(`${catalogUrl}?lang=en&theme=dark&stage=foo&scenario=weather-failed`);
  expect(await rootAttrs(page)).toEqual({
    lang: 'en', theme: 'dark', stage: 'hifi', auth: 'guest', scenario: 'weather-failed',
  });
  const snap = await page.evaluate(() => window.MockState.get());
  expect(snap).toEqual({ stage: 'hifi', lang: 'en', theme: 'dark', auth: 'guest', scenario: 'weather-failed' });
  const warnings = await page.evaluate(() => window.MockState.warnings());
  expect(warnings).toEqual([{ kind: 'unknown-param', param: 'stage', value: 'foo' }]);
});

test('defaults: hifi / ja / system (no data-theme) / guest / default, no warnings', async ({ page }) => {
  await page.goto(catalogUrl);
  expect(await rootAttrs(page)).toEqual({
    lang: 'ja', theme: null, stage: 'hifi', auth: 'guest', scenario: 'default',
  });
  expect(await page.evaluate(() => window.MockState.warnings().length)).toBe(0);
});

test('theme=system leaves data-theme absent; catalog page accepts every auth state', async ({ page }) => {
  await page.goto(`${catalogUrl}?theme=system&auth=admin&scenario=hidden-own`);
  const attrs = await rootAttrs(page);
  expect(attrs.theme).toBeNull();
  expect(attrs.auth).toBe('admin');
  expect(attrs.scenario).toBe('hidden-own');
  expect(await page.evaluate(() => window.MockState.get().theme)).toBe('system');
});

test('initial mock:change is dispatched on document with the snapshot', async ({ page }) => {
  await page.addInitScript(() => {
    /** @type {unknown[]} */
    const seen = [];
    Object.defineProperty(window, '__mockChanges', { value: seen });
    document.addEventListener('mock:change', (e) => seen.push(e.detail));
  });
  await page.goto(`${catalogUrl}?lang=en`);
  const seen = await page.evaluate(() => window.__mockChanges);
  expect(seen.length).toBe(1);
  expect(seen[0].lang).toBe('en');
});

test('update() rewrites the URL without reload, updates attributes and re-dispatches mock:change', async ({ page }) => {
  await page.goto(`${catalogUrl}?lang=en`);
  const result = await page.evaluate(() => {
    /** @type {unknown[]} */
    const seen = [];
    document.addEventListener('mock:change', (e) => seen.push(e.detail));
    window.__marker = 'same-document';
    const snap = window.MockState.update({ theme: 'light', scenario: 'empty' });
    return { snap, seen, href: location.href };
  });
  expect(result.snap).toMatchObject({ theme: 'light', lang: 'en', scenario: 'empty' });
  expect(result.seen).toEqual([result.snap]);
  const url = new URL(result.href);
  expect(url.searchParams.get('theme')).toBe('light');
  expect(url.searchParams.get('lang')).toBe('en');
  expect(url.searchParams.get('scenario')).toBe('empty');
  expect(await page.evaluate(() => window.__marker)).toBe('same-document');
  const attrs = await rootAttrs(page);
  expect(attrs.theme).toBe('light');
  expect(attrs.scenario).toBe('empty');

  await page.evaluate(() => window.MockState.update({ theme: 'system' }));
  expect((await rootAttrs(page)).theme).toBeNull();
});

test('stage/lang/theme are stored and reused when the URL lacks them; auth/scenario are not stored', async ({ page }) => {
  await page.goto(catalogUrl);
  await page.evaluate(() => window.MockState.update({
    stage: 'wireframe', lang: 'en', theme: 'dark', auth: 'member', scenario: 'empty',
  }));
  const saved = JSON.parse(String(await stored(page)));
  expect(saved).toEqual({ stage: 'wireframe', lang: 'en', theme: 'dark' });

  await page.goto(catalogUrl);
  expect(await rootAttrs(page)).toEqual({
    lang: 'en', theme: 'dark', stage: 'wireframe', auth: 'guest', scenario: 'default',
  });

  // URL wins over stored values.
  await page.goto(`${catalogUrl}?lang=ja&theme=light`);
  const attrs = await rootAttrs(page);
  expect(attrs.lang).toBe('ja');
  expect(attrs.theme).toBe('light');
  expect(attrs.stage).toBe('wireframe');
});

test('broken stored value and failing storage are ignored (URL-only operation)', async ({ page }) => {
  await page.goto(catalogUrl);
  await page.evaluate((k) => localStorage.setItem(k, '{not json'), STORAGE_KEY);
  await page.goto(`${catalogUrl}?lang=en`);
  expect((await rootAttrs(page)).lang).toBe('en');
  expect((await rootAttrs(page)).stage).toBe('hifi');

  await page.addInitScript(() => {
    const fail = () => { throw new Error('storage disabled'); };
    Storage.prototype.getItem = fail;
    Storage.prototype.setItem = fail;
  });
  await page.goto(`${catalogUrl}?theme=dark`);
  expect((await rootAttrs(page)).theme).toBe('dark');
  const snap = await page.evaluate(() => window.MockState.update({ lang: 'en' }));
  expect(snap.lang).toBe('en');
  expect((await rootAttrs(page)).lang).toBe('en');
});

test('screen page: a scenario/auth not allowed by the screen falls back to default with a warning', async ({ page }) => {
  await page.goto(`${screenUrl}?scenario=weather-failed&auth=admin`);
  const snap = await page.evaluate(() => window.MockState.get());
  expect(snap).toMatchObject({ screenId: 'calendar-month', scenario: 'default', auth: 'guest' });
  expect(await page.evaluate(() => window.MockState.warnings())).toEqual([
    { kind: 'unknown-param', param: 'auth', value: 'admin' },
    { kind: 'unknown-param', param: 'scenario', value: 'weather-failed' },
  ]);
  expect((await rootAttrs(page)).scenario).toBe('default');

  await page.goto(`${screenUrl}?scenario=provisional-holiday&auth=member`);
  expect(await page.evaluate(() => window.MockState.get())).toMatchObject({
    scenario: 'provisional-holiday', auth: 'member',
  });
  expect(await page.evaluate(() => window.MockState.warnings().length)).toBe(0);
});

test('ThemeBoot sets data-theme from the URL or stored value before CSS; system sets none', async ({ page }) => {
  await page.goto(`${bootOnlyUrl}?theme=dark`);
  expect(await page.evaluate(() => window.__themeAtBoot)).toBe('dark');

  await page.goto(`${bootOnlyUrl}?theme=system`);
  expect(await page.evaluate(() => window.__themeAtBoot)).toBeNull();

  await page.goto(`${bootOnlyUrl}?theme=bogus`);
  expect(await page.evaluate(() => window.__themeAtBoot)).toBeNull();

  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ theme: 'light' })), STORAGE_KEY);
  await page.goto(bootOnlyUrl);
  expect(await page.evaluate(() => window.__themeAtBoot)).toBe('light');
});

test('components.html loads theme-boot before the stylesheets', async ({ page }) => {
  await page.goto(catalogUrl);
  const order = await page.evaluate(() => [...document.head.querySelectorAll('script[src], link[rel="stylesheet"]')]
    .map((el) => el.getAttribute('src') || el.getAttribute('href')));
  expect(order[0]).toBe('assets/js/theme-boot.js');
});
