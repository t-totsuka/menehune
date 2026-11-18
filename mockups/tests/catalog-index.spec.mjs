// Task 6.2: the index page (CatalogPages index) builds one table row per registry screen (1.5, 2.2).
// - a <table> with a caption and column / row headers; 15 rows in registry order
// - each row: screen name (ja dictionary), access in Japanese, wireframe link + status,
//   hifi link + status (with the "未確定" mark when the wireframe is not approved), width preview link
// - every wireframe / hifi link opens its screen in that stage over file://
// - changing a registry review status changes the table (registry replaced before the page script)
// - links to the guide pages and the "サンプル値は未検証" note
// - at 375px there is no page-level horizontal scroll; the table scrolls inside a focusable region
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const urlOf = (/** @type {string} */ file) => pathToFileURL(join(root, file)).href;
const indexUrl = urlOf('index.html');

const load = (/** @type {string[]} */ ...files) => {
  const window = /** @type {Record<string, any>} */ ({});
  const ctx = vm.createContext({ window });
  for (const f of files) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  return window;
};
const w = load('data/screens.js', 'assets/i18n/messages.ja.js');
/** @type {{ id: string, titleKey: string, access: 'public' | 'member' | 'admin', review: Record<'wireframe' | 'hifi', { status: string }> }[]} */
const screens = w.MockScreens;
const ja = w.MockMessages.ja;
/** Labels shown by index.html for each review status. */
/** @type {Record<string, string>} */
const STATUS_LABELS = { 'draft': '下書き', 'in-review': 'レビュー中', 'changes-requested': '修正依頼', 'approved': '承認済み' };

const ACCESS = { public: '公開', member: 'ログインユーザ', admin: '管理者' };
const COLUMNS = ['画面', '閲覧権限', 'ワイヤーフレーム', 'ハイフィ', '幅プレビュー'];

/** @param {import('@playwright/test').Page} page */
const table = (page) => page.getByRole('table', { name: /画面の一覧/ });
/** @param {import('@playwright/test').Page} page @param {string} id */
const row = (page, id) => table(page).locator(`tbody tr[data-screen="${id}"]`);

/** Records console warnings/errors, page errors and every non-file request (blocked). */
async function watch(/** @type {import('@playwright/test').Page} */ page) {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.route((u) => u.protocol !== 'file:', (route) => { problems.push(`external: ${route.request().url()}`); return route.abort(); });
  return problems;
}

test('the table has a caption, column headers and one row per registry screen', async ({ page }) => {
  const problems = await watch(page);
  await page.goto(indexUrl);
  const t = table(page);
  await expect(t).toHaveCount(1);
  await expect(t.locator('caption')).toContainText('画面の一覧');
  const heads = t.locator('thead th');
  await expect(heads).toHaveText(COLUMNS);
  for (const h of await heads.all()) await expect(h).toHaveAttribute('scope', 'col');
  const rows = t.locator('tbody tr');
  await expect(rows).toHaveCount(15);
  expect(await rows.evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-screen')))).toEqual(screens.map((s) => s.id));
  for (const s of screens) {
    const r = row(page, s.id);
    const name = r.locator('th');
    await expect(name).toHaveAttribute('scope', 'row');
    await expect(name).toHaveText(ja[s.titleKey]);
    await expect(r.locator('td').nth(0)).toHaveText(ACCESS[s.access]);
  }
  expect(problems).toEqual([]);
});

test('each row links to both stages and to the width preview, with the review status as text', async ({ page }) => {
  await page.goto(indexUrl);
  for (const s of screens) {
    const r = row(page, s.id);
    const wf = r.locator('td').nth(1);
    const hf = r.locator('td').nth(2);
    const href = (/** @type {import('@playwright/test').Locator} */ l) => l.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href);
    expect(await href(wf.getByRole('link'))).toBe(`${urlOf(`screens/${s.id}.html`)}?stage=wireframe`);
    expect(await href(hf.getByRole('link'))).toBe(`${urlOf(`screens/${s.id}.html`)}?stage=hifi`);
    expect(await href(r.locator('td').nth(3).getByRole('link'))).toBe(`${urlOf('viewer.html')}?screen=${s.id}`);
    // The links are distinguishable out of context (screen name + stage).
    await expect(wf.getByRole('link')).toHaveAccessibleName(new RegExp(`${ja[s.titleKey]}.*ワイヤーフレーム`));
    await expect(hf.getByRole('link')).toHaveAccessibleName(new RegExp(`${ja[s.titleKey]}.*ハイフィ`));
    const wfStatus = s.review.wireframe.status;
    await expect(wf.locator('[data-review-state]')).toHaveText(new RegExp(STATUS_LABELS[wfStatus]));
    await expect(wf.locator('[data-review-state]')).toHaveAttribute('data-review-state', wfStatus);
    await expect(hf.locator('[data-review-state]')).toHaveText(new RegExp(STATUS_LABELS[s.review.hifi.status]));
    // Wireframe not approved -> the hifi cell carries the textual "未確定" mark.
    await expect(hf.locator('[data-provisional]')).toHaveText(/未確定/);
  }
});

test('every screen opens in both stages from the index links', async ({ page }) => {
  const problems = await watch(page);
  await page.goto(indexUrl);
  const links = await table(page).locator('tbody td a[href*="screens/"]').evaluateAll(
    (as) => as.map((a) => /** @type {HTMLAnchorElement} */ (a).href));
  expect(links).toHaveLength(30);
  for (const href of links) {
    const u = new URL(href);
    const id = u.pathname.split('/').pop()?.replace(/\.html$/, '');
    await page.goto(href);
    await expect(page.locator('body')).toHaveAttribute('data-screen-id', String(id));
    await expect(page.locator('html')).toHaveAttribute('data-stage', String(u.searchParams.get('stage')));
  }
  expect(problems).toEqual([]);
});

test('clicking a stage link opens that screen', async ({ page }) => {
  await page.goto(indexUrl);
  await row(page, 'post-detail').locator('td').nth(1).getByRole('link').click();
  await expect(page).toHaveURL(`${urlOf('screens/post-detail.html')}?stage=wireframe`);
  await expect(page.locator('html')).toHaveAttribute('data-stage', 'wireframe');
});

test('changing a registry review status changes the index display', async ({ page }) => {
  const problems = await watch(page);
  // Replace the frozen registry with a copy whose review statuses differ, before any page script reads it.
  await page.addInitScript(() => {
    /** @type {unknown} */
    let value;
    Object.defineProperty(window, 'MockScreens', {
      configurable: true,
      get: () => value,
      set: (/** @type {any[]} */ list) => {
        value = list.map((e) => {
          if (e.id === 'top') {
            return { ...e, review: {
              wireframe: { status: 'approved', reviewedAt: '2026-11-20', notes: ['見出しの階層を確認した'] },
              hifi: { status: 'in-review' },
            } };
          }
          if (e.id === 'login') return { ...e, review: { wireframe: { status: 'changes-requested' }, hifi: { status: 'draft' } } };
          return e;
        });
      },
    });
  });
  await page.goto(indexUrl);
  const top = row(page, 'top');
  const wf = top.locator('td').nth(1);
  const hf = top.locator('td').nth(2);
  await expect(wf.locator('[data-review-state]')).toHaveAttribute('data-review-state', 'approved');
  await expect(wf.locator('[data-review-state]')).toHaveText(/承認済み/);
  await expect(wf).toContainText('2026-11-20');
  await expect(wf).toContainText('見出しの階層を確認した');
  await expect(hf.locator('[data-review-state]')).toHaveText(/レビュー中/);
  await expect(hf.locator('[data-provisional]')).toHaveCount(0);
  const login = row(page, 'login');
  await expect(login.locator('td').nth(1).locator('[data-review-state]')).toHaveText(/修正依頼/);
  await expect(login.locator('td').nth(2).locator('[data-provisional]')).toHaveText(/未確定/);
  // Other rows keep the registry values.
  await expect(row(page, 'admin').locator('td').nth(1).locator('[data-review-state]')).toHaveText(/下書き/);
  expect(problems).toEqual([]);
});

test('the review status does not rely on color alone (each status has its own symbol and text)', async ({ page }) => {
  await page.goto(indexUrl);
  for (const s of screens) {
    const cell = row(page, s.id).locator('td').nth(1).locator('[data-review-state]');
    const text = await cell.textContent();
    // A symbol precedes the label, so the state is readable without color.
    expect(text?.trim()).toMatch(new RegExp(`^\\S+\\s*${STATUS_LABELS[s.review.wireframe.status]}$`));
  }
});

test('links to the guide pages, the review points and the unverified-sample note', async ({ page }) => {
  await page.goto(indexUrl);
  const main = page.locator('main');
  for (const [name, file] of [
    ['部品ギャラリー', 'components.html'], ['トークン', 'tokens.html'], ['用語集', 'glossary.html'],
    ['アクセシビリティ', 'a11y.html'], ['幅プレビュー', 'viewer.html'], ['README', 'README.md'],
  ]) {
    const link = main.getByRole('link', { name: new RegExp(name) }).first();
    expect(await link.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(urlOf(file));
  }
  await expect(main).toContainText('サンプル値は未検証');
  await expect(main).toContainText('ワイヤーフレームのレビューで確認してほしい論点');
});

test.describe('at 375px', () => {
  test.use({ viewport: { width: 375, height: 800 } });
  test('no page-level horizontal scroll; the table scrolls inside a labelled focusable region', async ({ page }) => {
    await page.goto(indexUrl);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const region = page.getByRole('region', { name: /画面の一覧/ });
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(region.getByRole('table')).toHaveCount(1);
    const box = await region.boundingBox();
    expect((box?.x ?? -1)).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(375);
    await region.focus();
    const outline = await region.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });
});
