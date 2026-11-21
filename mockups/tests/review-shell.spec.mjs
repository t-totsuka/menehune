// Task 1.8: ReviewShell — fixed review toolbar (back link, stage/auth/scenario switches, review
// status), banners ("未確定" on hifi when the wireframe is not approved; unknown-param warnings)
// and conditional display via [data-when-auth] / [data-when-scenario] (1.3, 2.3, 3.3, 3.4, 3.5).
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalogUrl = pathToFileURL(join(here, '..', 'components.html')).href;
const screenUrl = pathToFileURL(join(here, 'fixtures', 'screen-fixture.html')).href;
const indexUrl = pathToFileURL(join(here, '..', 'index.html')).href;

const ALL_SCENARIOS = [
  'default', 'empty', 'fetch-error', 'validation-error',
  'private-blocked', 'hidden-own', 'hidden-other',
  'deleted-comment', 'no-location', 'weather-failed', 'provisional-holiday', 'many-items', 'daytime',
];

/** @param {import('@playwright/test').Page} page */
const toolbar = (page) => page.getByRole('region', { name: 'レビュー用ツールバー' });

/** @param {import('@playwright/test').Page} page @param {'stage' | 'auth' | 'scenario'} field */
const control = (page, field) => page.locator(`[data-review-control="${field}"]`);

/** @param {import('@playwright/test').Page} page @param {'stage' | 'auth' | 'scenario'} field */
const optionValues = (page, field) => control(page, field).evaluate(
  (el) => [...(/** @type {HTMLSelectElement} */ (el)).options].map((o) => o.value));

test('toolbar is a labelled region with a back link to index.html and the three switches', async ({ page }) => {
  await page.goto(catalogUrl);
  const bar = toolbar(page);
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('role', 'region');
  const back = bar.getByRole('link', { name: '一覧へ戻る' });
  await expect(back).toBeVisible();
  expect(await back.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(indexUrl);
  for (const field of /** @type {const} */ (['stage', 'auth', 'scenario'])) {
    await expect(control(page, field)).toBeVisible();
  }
  await expect(page.locator('[data-review-status]')).toBeVisible();
});

test('back link from a page in a subdirectory still points at mockups/index.html', async ({ page }) => {
  await page.goto(screenUrl);
  const back = toolbar(page).getByRole('link', { name: '一覧へ戻る' });
  expect(await back.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(indexUrl);
});

test('catalog page: switchers list every scenario and every auth state', async ({ page }) => {
  await page.goto(catalogUrl);
  expect(await optionValues(page, 'scenario')).toEqual(ALL_SCENARIOS);
  expect(await optionValues(page, 'auth')).toEqual(['guest', 'member', 'admin']);
  expect(await optionValues(page, 'stage')).toEqual(['wireframe', 'hifi']);
});

test('screen page: switchers list only the screen\'s auth states and scenarios', async ({ page }) => {
  await page.goto(screenUrl);
  const entry = await page.evaluate(() => window.MockScreens.find((s) => s.id === 'calendar-month'));
  expect(await optionValues(page, 'scenario')).toEqual(entry?.scenarios);
  expect(await optionValues(page, 'auth')).toEqual(entry?.authStates);
});

test('scenario switch updates html[data-scenario] and the data-when-scenario elements', async ({ page }) => {
  await page.goto(catalogUrl);
  await expect(page.locator('#cond-default')).toBeVisible();
  await expect(page.locator('#cond-empty')).toBeHidden();

  await control(page, 'scenario').selectOption('empty');
  await expect(page.locator('html')).toHaveAttribute('data-scenario', 'empty');
  await expect(page).toHaveURL(/[?&]scenario=empty/);
  await expect(page.locator('#cond-default')).toBeHidden();
  await expect(page.locator('#cond-empty')).toBeVisible();

  // Space-separated lists: "empty fetch-error" also matches fetch-error.
  await control(page, 'scenario').selectOption('fetch-error');
  await expect(page.locator('#cond-empty')).toBeVisible();
  await expect(page.locator('#cond-default')).toBeHidden();
});

test('auth switch updates html[data-auth] and the data-when-auth elements (both conditions combine)', async ({ page }) => {
  await page.goto(catalogUrl);
  await expect(page.locator('#cond-guest')).toBeVisible();
  await expect(page.locator('#cond-member')).toBeHidden();
  await expect(page.locator('#cond-both')).toBeHidden();

  await control(page, 'auth').selectOption('member');
  await expect(page.locator('html')).toHaveAttribute('data-auth', 'member');
  await expect(page.locator('#cond-guest')).toBeHidden();
  await expect(page.locator('#cond-member')).toBeVisible();
  await expect(page.locator('#cond-both')).toBeHidden(); // needs scenario=empty too

  await control(page, 'scenario').selectOption('empty');
  await expect(page.locator('#cond-both')).toBeVisible();

  await control(page, 'auth').selectOption('admin');
  await expect(page.locator('#cond-member')).toBeVisible();
  await expect(page.locator('#cond-both')).toBeHidden();
});

test('conditions are applied on load from the URL', async ({ page }) => {
  await page.goto(`${catalogUrl}?auth=member&scenario=empty`);
  await expect(control(page, 'auth')).toHaveValue('member');
  await expect(control(page, 'scenario')).toHaveValue('empty');
  await expect(page.locator('#cond-both')).toBeVisible();
  await expect(page.locator('#cond-guest')).toBeHidden();
});

test('stage switch updates html[data-stage]', async ({ page }) => {
  await page.goto(catalogUrl);
  await expect(control(page, 'stage')).toHaveValue('hifi');
  await control(page, 'stage').selectOption('wireframe');
  await expect(page.locator('html')).toHaveAttribute('data-stage', 'wireframe');
  await expect(page).toHaveURL(/[?&]stage=wireframe/);
  await expect(toolbar(page)).toBeVisible();
});

/**
 * Every real wireframe is approved (task 8.1, 2026-11-21), so to cover the "未確定" logic the
 * registry is replaced, before any page script reads it, by a copy whose calendar-month (the
 * fixture's screen id) has the given wireframe status.
 * @param {import('@playwright/test').Page} page
 * @param {string} status
 */
const overrideFixtureWireframe = (page, status) => page.addInitScript((wfStatus) => {
  /** @type {unknown} */
  let value;
  Object.defineProperty(window, 'MockScreens', {
    configurable: true,
    get: () => value,
    set: (/** @type {any[]} */ list) => {
      value = list.map((e) => (e.id === 'calendar-month'
        ? { ...e, review: { wireframe: { status: wfStatus, reviewedAt: '2026-11-22' }, hifi: { status: 'draft' } } }
        : e));
    },
  });
}, status);

test('no "未確定" banner on hifi for the registry as is: the wireframe is approved (task 8.1)', async ({ page }) => {
  await page.goto(`${screenUrl}?stage=hifi`);
  await expect(toolbar(page)).toBeVisible();
  await expect(page.locator('[data-review-status]')).toContainText('ワイヤーフレーム 承認済み');
  await expect(page.locator('[data-review-status]')).toContainText('ハイフィ 下書き');
  await expect(page.locator('[data-review-banner="provisional"]')).toBeHidden();
});

for (const status of ['in-review', 'changes-requested', 'draft']) {
  test(`"未確定" banner on hifi when the wireframe is ${status} (overridden registry)`, async ({ page }) => {
    await overrideFixtureWireframe(page, status);
    await page.goto(`${screenUrl}?stage=hifi`);
    const banner = page.locator('[data-review-banner="provisional"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('未確定');
  });
}

test('"未確定" banner on hifi when the wireframe is not approved; not on wireframe', async ({ page }) => {
  await overrideFixtureWireframe(page, 'in-review');
  await page.goto(`${screenUrl}?stage=hifi`);
  const banner = page.locator('[data-review-banner="provisional"]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('未確定');
  // The current review status of the screen is shown.
  await expect(page.locator('[data-review-status]')).toContainText('レビュー中');
  await expect(page.locator('[data-review-status]')).toContainText('下書き');

  await control(page, 'stage').selectOption('wireframe');
  await expect(banner).toBeHidden();

  await page.goto(`${screenUrl}?stage=wireframe`);
  await expect(page.locator('[data-review-banner="provisional"]')).toBeHidden();
});

test('"未確定" banner is never shown on a catalog page (no screen id)', async ({ page }) => {
  await page.goto(`${catalogUrl}?stage=hifi`);
  await expect(toolbar(page)).toBeVisible();
  await expect(page.locator('[data-review-banner="provisional"]')).toBeHidden();
});

test('unknown-param warning banner for ?stage=foo; none without warnings', async ({ page }) => {
  await page.goto(catalogUrl);
  await expect(toolbar(page)).toBeVisible();
  await expect(page.locator('[data-review-banner="warnings"]')).toBeHidden();

  await page.goto(`${catalogUrl}?stage=foo`);
  const banner = page.locator('[data-review-banner="warnings"]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('stage=foo');
});

test('screen page: a scenario not allowed by the screen shows the warning banner', async ({ page }) => {
  await page.goto(`${screenUrl}?scenario=hidden-own`);
  const banner = page.locator('[data-review-banner="warnings"]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('scenario=hidden-own');
  await expect(control(page, 'scenario')).toHaveValue('default');
});

test('mount() is idempotent: calling it again does not add a second toolbar', async ({ page }) => {
  await page.goto(catalogUrl);
  await expect(toolbar(page)).toBeVisible();
  await page.evaluate(() => window.MockReviewShell.mount());
  await expect(page.getByRole('region', { name: 'レビュー用ツールバー' })).toHaveCount(1);
});

for (const width of [360, 1440]) {
  test(`no horizontal overflow and the toolbar does not cover the end of the content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.goto(`${catalogUrl}?stage=foo`);
    await expect(toolbar(page)).toBeVisible();
    const m = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(m.scroll).toBeLessThanOrEqual(m.client);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = page.locator('main > :last-child');
    const lastBox = await last.boundingBox();
    const shellBox = await page.locator('[data-review-shell]').boundingBox();
    expect(lastBox).not.toBeNull();
    expect(shellBox).not.toBeNull();
    // The spacer takes the toolbar's height rounded up (Math.ceil of getBoundingClientRect), but the
    // scroll range is rounded, so allow up to 1px of sub-pixel overlap.
    if (lastBox && shellBox) expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(shellBox.y + 1);
    // Fixed to the bottom of the viewport.
    if (shellBox) expect(Math.round(shellBox.y + shellBox.height)).toBe(640);
  });
}
