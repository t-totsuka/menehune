// Task 6.3: the width preview page (CatalogPages viewer) shows one screen at 375px and at 1440px
// (scaled down) side by side (12.1).
// - viewer.html?screen={ScreenId} has two iframes of screens/{id}.html: 375px wide and 1440px wide
//   (the 1440px one scaled down to fit); inside the frames the layout width is 375 / 1440
// - stage / lang / theme come from MockState (URL, saved value, default) and are passed to both
//   frames as URL parameters; changing them on the viewer reloads both frames with the new values
// - auth / scenario are passed only when the screen allows them
// - a screen chooser switches the screen; a missing ?screen shows the top screen, an unknown one
//   shows the top screen with a warning
// - no console problems or non-file requests, and no page-level horizontal scroll at 375px
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const urlOf = (/** @type {string} */ file) => pathToFileURL(join(root, file)).href;
const viewerUrl = urlOf('viewer.html');

const load = (/** @type {string[]} */ ...files) => {
  const window = /** @type {Record<string, any>} */ ({});
  const ctx = vm.createContext({ window });
  for (const f of files) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  return window;
};
const w = load('data/screens.js', 'assets/i18n/messages.ja.js');
/** @type {{ id: string, titleKey: string }[]} */
const screens = w.MockScreens;
const ja = w.MockMessages.ja;
const nameOf = (/** @type {string} */ id) => ja[/** @type {{ titleKey: string }} */ (screens.find((s) => s.id === id)).titleKey];

/** Records console warnings/errors, page errors and every non-file request (blocked). */
async function watch(/** @type {import('@playwright/test').Page} */ page) {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.route((u) => u.protocol !== 'file:', (route) => { problems.push(`external: ${route.request().url()}`); return route.abort(); });
  return problems;
}

/** @param {import('@playwright/test').Page} page @param {375 | 1440} width */
const frame = (page, width) => page.locator(`iframe[data-viewer-frame="${width}"]`);

/** @param {import('@playwright/test').Locator} f */
const srcOf = async (f) => new URL(/** @type {string} */ (await f.evaluate((el) => /** @type {HTMLIFrameElement} */ (el).src)));

/** @param {import('@playwright/test').Page} page @param {375 | 1440} width */
const frameDoc = async (page, width) => {
  const handle = await frame(page, width).elementHandle();
  const content = await handle?.contentFrame();
  if (!content) throw new Error(`no content frame for ${width}`);
  await content.waitForLoadState('load');
  return content;
};

test('shows the screen at 375px and at 1440px (scaled) side by side', async ({ page }) => {
  const problems = await watch(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${viewerUrl}?screen=post-detail`);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('iframe[data-viewer-frame]')).toHaveCount(2);
  const name = nameOf('post-detail');
  for (const width of /** @type {const} */ ([375, 1440])) {
    const f = frame(page, width);
    await expect(f).toBeVisible();
    await expect(f).toHaveAttribute('title', `${name}（${width}px）`);
    const src = await srcOf(f);
    expect(src.href.split('?')[0]).toBe(urlOf('screens/post-detail.html'));
    const doc = await frameDoc(page, width);
    // The layout inside the frame is computed at the nominal width.
    expect(await doc.evaluate(() => window.innerWidth)).toBe(width);
    expect(await doc.evaluate(() => document.body.dataset.screenId)).toBe('post-detail');
  }
  const sp = /** @type {{ x: number, y: number, width: number, height: number }} */ (await frame(page, 375).boundingBox());
  const pc = /** @type {{ x: number, y: number, width: number, height: number }} */ (await frame(page, 1440).boundingBox());
  // Side by side: the 1440px frame is to the right of the 375px one and starts on the same line.
  expect(pc.x).toBeGreaterThanOrEqual(sp.x + sp.width);
  expect(Math.abs(pc.y - sp.y)).toBeLessThan(2);
  expect(Math.round(sp.width)).toBe(375);
  // Scaled down so that it fits the page, with the 1440:900 proportions kept.
  expect(pc.width).toBeLessThan(1440);
  expect(pc.x + pc.width).toBeLessThanOrEqual(1440);
  expect(pc.height / pc.width).toBeCloseTo(900 / 1440, 1);
  // The scale is shown as text.
  await expect(page.locator('[data-viewer-scale="1440"]')).toContainText(/\d+%/);
  expect(problems).toEqual([]);
});

test('passes stage, lang and theme from the URL to both frames', async ({ page }) => {
  const problems = await watch(page);
  await page.goto(`${viewerUrl}?screen=top&stage=wireframe&lang=en&theme=dark`);
  for (const width of /** @type {const} */ ([375, 1440])) {
    const src = await srcOf(frame(page, width));
    expect(src.searchParams.get('stage')).toBe('wireframe');
    expect(src.searchParams.get('lang')).toBe('en');
    expect(src.searchParams.get('theme')).toBe('dark');
    const doc = await frameDoc(page, width);
    const attrs = await doc.evaluate(() => ({
      stage: document.documentElement.dataset.stage,
      lang: document.documentElement.lang,
      theme: document.documentElement.dataset.theme,
    }));
    expect(attrs).toEqual({ stage: 'wireframe', lang: 'en', theme: 'dark' });
  }
  expect(problems).toEqual([]);
});

test('uses the MockState defaults when nothing is given', async ({ page }) => {
  await page.goto(`${viewerUrl}?screen=top`);
  const src = await srcOf(frame(page, 375));
  expect(src.searchParams.get('stage')).toBe('hifi');
  expect(src.searchParams.get('lang')).toBe('ja');
  expect(src.searchParams.get('theme')).toBe('system');
  expect(src.searchParams.has('auth')).toBe(false);
  expect(src.searchParams.has('scenario')).toBe(false);
});

test('changing stage, lang or theme on the viewer reloads both frames with the new values', async ({ page }) => {
  await page.goto(`${viewerUrl}?screen=top`);
  // The stage switch of the review toolbar.
  await page.getByRole('region', { name: /レビュー/ }).getByRole('combobox', { name: /段階/ }).selectOption('wireframe');
  await page.getByRole('combobox', { name: '言語' }).selectOption('en');
  await page.getByRole('combobox', { name: 'テーマ' }).selectOption('dark');
  for (const width of /** @type {const} */ ([375, 1440])) {
    await expect.poll(async () => (await srcOf(frame(page, width))).search).toBe('?stage=wireframe&lang=en&theme=dark');
    const doc = await frameDoc(page, width);
    await expect.poll(() => doc.evaluate(() => document.documentElement.lang)).toBe('en');
  }
  // The viewer URL keeps the screen and the new state, so a reload shows the same thing.
  const here = new URL(page.url());
  expect(here.searchParams.get('screen')).toBe('top');
  expect(here.searchParams.get('lang')).toBe('en');
});

test('auth and scenario are passed only when the screen allows them', async ({ page }) => {
  await page.goto(`${viewerUrl}?screen=admin&auth=admin`);
  expect((await srcOf(frame(page, 1440))).searchParams.get('auth')).toBe('admin');
  await page.goto(`${viewerUrl}?screen=top&auth=admin&scenario=hidden-own`);
  const src = await srcOf(frame(page, 1440));
  expect(src.searchParams.has('auth')).toBe(false);
  expect(src.searchParams.has('scenario')).toBe(false);
  await page.goto(`${viewerUrl}?screen=post-detail&auth=member&scenario=hidden-own`);
  const pd = await srcOf(frame(page, 375));
  expect(pd.searchParams.get('auth')).toBe('member');
  expect(pd.searchParams.get('scenario')).toBe('hidden-own');
});

test('the screen chooser switches the previewed screen', async ({ page }) => {
  const problems = await watch(page);
  await page.goto(`${viewerUrl}?screen=top&lang=en`);
  const chooser = page.getByRole('combobox', { name: '画面' });
  await expect(chooser.locator('option')).toHaveCount(screens.length);
  await expect(chooser).toHaveValue('top');
  await chooser.selectOption('star-chart');
  await expect.poll(async () => (await srcOf(frame(page, 375))).pathname).toMatch(/\/screens\/star-chart\.html$/);
  expect((await srcOf(frame(page, 1440))).pathname).toMatch(/\/screens\/star-chart\.html$/);
  expect((await srcOf(frame(page, 1440))).searchParams.get('lang')).toBe('en');
  await expect(frame(page, 375)).toHaveAttribute('title', `${nameOf('star-chart')}（375px）`);
  expect(new URL(page.url()).searchParams.get('screen')).toBe('star-chart');
  await expect(page.locator('[data-viewer-warning]')).toBeHidden();
  expect(problems).toEqual([]);
});

test('without ?screen the top screen is shown; an unknown one also shows a warning', async ({ page }) => {
  const problems = await watch(page);
  await page.goto(viewerUrl);
  expect((await srcOf(frame(page, 375))).pathname).toMatch(/\/screens\/top\.html$/);
  await expect(page.locator('[data-viewer-warning]')).toBeHidden();
  await page.goto(`${viewerUrl}?screen=nope`);
  expect((await srcOf(frame(page, 375))).pathname).toMatch(/\/screens\/top\.html$/);
  const warning = page.locator('[data-viewer-warning]');
  await expect(warning).toBeVisible();
  await expect(warning).toHaveAttribute('role', 'alert');
  await expect(warning).toContainText('nope');
  await expect(page.getByRole('combobox', { name: '画面' })).toHaveValue('top');
  expect(problems).toEqual([]);
});

test('at 375px there is no page-level horizontal scroll and both frames fit', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${viewerUrl}?screen=calendar-month`);
  await expect(page.locator('iframe[data-viewer-frame]')).toHaveCount(2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const width of /** @type {const} */ ([375, 1440])) {
    const box = /** @type {{ x: number, width: number }} */ (await frame(page, width).boundingBox());
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    const doc = await frameDoc(page, width);
    expect(await doc.evaluate(() => window.innerWidth)).toBe(width);
  }
});
