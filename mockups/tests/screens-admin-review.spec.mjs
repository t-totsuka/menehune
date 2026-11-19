// Task 8.1 (admin only): the wireframe review notes recorded for `admin` in data/screens.js
// (Requirements 3.6, 8.6, 13.3, 13.5).
//   1. "表示をKANBAN形式にしたい": the report queue is a board of four columns by status. The
//      columns come from the existing ReportQueueState values, nothing new is invented:
//        未対応 open | 一時非表示 auto-hidden + hidden-by-admin | 異議申し立ての審査 appealed |
//        対応済み restored + removed
//      Each column is a labelled region (h3 with the count, then a list of cards). The appeal
//      review (8.6) is the third column, so every report is shown once. Columns sit side by side
//      at 960px and wider (2 x 2 from 600px) and stack at narrow widths (no inner scroll, no
//      page-level horizontal scroll). The mock actions stay buttons and move the card to the
//      column of its new state (keyboard-operable, focus follows the card). Each column has its
//      own empty message (empty scenario, or a column emptied by the actions).
//   2. "通報件数・理由は見やすくしたい": the count is a large bold line at the top of the card
//      ("通報 5 件"), and the reasons are chips with per-reason counts ("スパム・宣伝 ×3"),
//      read as "3 件" by screen readers. Text, not colour.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, loadClassicScripts, watchConsole } from './helpers/e2e.mjs';

const w = loadClassicScripts('data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
const sample = /** @type {any} */ (w.MockSample);
/** @type {any[]} */
const reports = [...sample.reports];

const urlOf = (/** @type {string} */ query = '') =>
  pathToFileURL(join(MOCKUPS_ROOT, 'screens', 'admin.html')).href + query;

/** Columns in order and the ReportQueueState values each one holds (explicit expectation). */
const COLUMNS = /** @type {const} */ ([
  ['open', ['open']],
  ['hidden', ['auto-hidden', 'hidden-by-admin']],
  ['appealed', ['appealed']],
  ['done', ['restored', 'removed']],
]);
/** @param {string} state */
const columnOf = (state) => COLUMNS.find(([, states]) => /** @type {readonly string[]} */ (states).includes(state))?.[0];
/** @param {string} id */
const idsIn = (id) => reports.filter((r) => columnOf(r.state) === id).map((r) => r.targetId);
/** @param {Record<string, string>} m @param {number} count */
const columnCount = (m, count) => (m['screen.admin.column-count'] ?? '⟦screen.admin.column-count⟧').replace('{count}', String(count));
/** @param {Record<string, string>} m @param {number} count */
const reportCount = (m, count) => m[count === 1 ? 'moderation.report-count-one' : 'moderation.report-count'].replace('{count}', String(count));

/** @param {import('@playwright/test').Page} page @param {string} id */
const column = (page, id) => page.locator(`main [data-report-queue] section[data-column="${id}"]`);
/** @param {import('@playwright/test').Page} page @param {string} id */
const card = (page, id) => page.locator(`main [data-queue-item][data-target-id="${id}"]`);

test('the board: four labelled columns by status, each with its count and its cards', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto(urlOf('?lang=ja&auth=admin'));
  const board = page.locator('main [data-report-queue] [data-board]');
  await expect(board).toBeVisible();
  await expect(board.locator(':scope > section[data-column]')).toHaveCount(COLUMNS.length);
  expect(await board.locator(':scope > section[data-column]').evaluateAll((els) => els.map((e) => e.getAttribute('data-column'))))
    .toEqual(COLUMNS.map(([id]) => id));
  for (const [id] of COLUMNS) {
    const col = column(page, id);
    const ids = idsIn(id);
    const label = ja[`screen.admin.column.${id}`] ?? '';
    expect(label, `label of ${id}`).not.toBe('');
    // a labelled region: the h3 names it and carries the count as text
    const heading = col.getByRole('heading', { level: 3 });
    await expect(heading).toHaveText(`${label}${columnCount(ja, ids.length)}`);
    await expect(page.getByRole('region', { name: `${label}${columnCount(ja, ids.length)}`, exact: true })).toHaveCount(1);
    await expect(col.locator('[data-column-count]')).toHaveText(columnCount(ja, ids.length));
    await expect(col.locator('ul[data-column-list] > li[data-queue-item]')).toHaveCount(ids.length);
    expect(await col.locator('[data-queue-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-target-id')))).toEqual(ids);
    await expect(col.locator('[data-column-empty]')).toBeHidden();
  }
  // every report shows exactly once (the appeal review is a column, not a second list)
  await expect(page.locator('main [data-queue-item]')).toHaveCount(reports.length);
  // the appeal review (8.6) is the appealed column
  const appeals = column(page, 'appealed');
  await expect(appeals).toHaveAttribute('data-appeal-review', '');
  await expect(appeals.locator('[data-appeal-item] [data-appeal-text]')).not.toHaveCount(0);
  // the precise state stays on each card
  for (const r of reports) await expect(card(page, r.targetId).locator('[data-report-state]')).toHaveText(ja[`moderation.state.${r.state}`]);
  expect(problems).toEqual([]);
});

test('layout: side by side at 1440px, 2 x 2 at 600px, stacked at 375px; no page-level horizontal scroll', async ({ page }) => {
  await page.goto(urlOf('?stage=wireframe&lang=en&auth=admin'));
  const boxes = async () => Promise.all(COLUMNS.map(([id]) => column(page, id).boundingBox()));
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.setViewportSize({ width: 1440, height: 900 });
  let b = /** @type {{ x: number, y: number, width: number }[]} */ (await boxes());
  for (let i = 1; i < b.length; i += 1) {
    expect(Math.abs((b[i]?.y ?? 0) - (b[0]?.y ?? 0)), 'same row').toBeLessThanOrEqual(1);
    expect(b[i]?.x ?? 0, 'left to right').toBeGreaterThan((b[i - 1]?.x ?? 0) + (b[i - 1]?.width ?? 0) - 1);
  }
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 600, height: 900 });
  b = /** @type {{ x: number, y: number, width: number }[]} */ (await boxes());
  expect(Math.abs((b[1]?.y ?? 0) - (b[0]?.y ?? 0))).toBeLessThanOrEqual(1);
  expect(b[2]?.y ?? 0).toBeGreaterThan(b[0]?.y ?? 0);
  expect(Math.abs((b[2]?.x ?? 0) - (b[0]?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 375, height: 900 });
  b = /** @type {{ x: number, y: number, width: number }[]} */ (await boxes());
  for (let i = 1; i < b.length; i += 1) {
    expect(Math.abs((b[i]?.x ?? 0) - (b[0]?.x ?? 0)), 'same column').toBeLessThanOrEqual(1);
    expect(b[i]?.y ?? 0, 'top to bottom').toBeGreaterThan(b[i - 1]?.y ?? 0);
  }
  // stacked, so the board itself does not scroll sideways either
  const board = page.locator('main [data-board]');
  expect(await board.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test('count and reasons: a prominent count line and reason chips with per-reason counts', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto(urlOf('?stage=wireframe&lang=ja&auth=admin'));
  for (const r of reports) {
    const c = card(page, r.targetId);
    const count = c.locator('[data-report-count]');
    await expect(count).toHaveText(reportCount(ja, r.reportCount));
    // prominent by size and weight, not by colour: larger and bolder than the body text
    const [countStyle, bodyStyle] = await Promise.all([count, c.locator('[data-target-body]')].map((l) =>
      l.evaluate((el) => { const s = getComputedStyle(el); return { size: parseFloat(s.fontSize), weight: Number(s.fontWeight) }; })));
    expect(countStyle?.size ?? 0).toBeGreaterThan(bodyStyle?.size ?? 0);
    expect(countStyle?.weight ?? 0).toBeGreaterThanOrEqual(700);
    // the count comes before the body (read first)
    const order = await c.evaluate((el) => {
      const a = el.querySelector('[data-report-count]');
      const b = el.querySelector('[data-target-body]');
      return a && b ? a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
    });
    expect(order).toBeTruthy();
    // chips: one per reason, most frequent first, "理由 ×N" on screen and "N 件" for screen readers
    const reasons = c.getByRole('list', { name: ja['screen.admin.reasons'], exact: true });
    await expect(reasons).toHaveAttribute('data-reasons', '');
    const chips = reasons.locator(':scope > li[data-reason]');
    await expect(chips).toHaveCount(r.reasons.length);
    for (const [i, reason] of r.reasons.entries()) {
      const n = r.reasonCounts[reason];
      const chip = chips.nth(i);
      await expect(chip).toHaveAttribute('data-reason', reason);
      await expect(chip.locator('[data-reason-name]')).toHaveText(ja[`moderation.reason.${reason}`]);
      await expect(chip.locator('[data-reason-times]')).toHaveText(ja['screen.admin.reason-times'].replace('{count}', String(n)));
      await expect(chip.locator('[data-reason-times]')).toHaveAttribute('aria-hidden', 'true');
      await expect(chip.locator('[data-reason-times-label]')).toHaveText(reportCount(ja, n));
      await expect(chip.locator('[data-reason-times-label]')).toHaveClass(/visually-hidden/);
    }
  }
  // English copy
  await page.evaluate(() => window.MockState.update({ lang: 'en' }));
  const p109 = reports.find((r) => r.targetId === 'p-109');
  const c = card(page, 'p-109');
  await expect(c.locator('[data-report-count]')).toHaveText(reportCount(en, p109.reportCount));
  await expect(c.locator('li[data-reason="spam"] [data-reason-name]')).toHaveText(en['moderation.reason.spam']);
  await expect(c.locator('li[data-reason="spam"] [data-reason-times]')).toHaveText(en['screen.admin.reason-times'].replace('{count}', String(p109.reasonCounts.spam)));
  await expect(c.locator('li[data-reason="spam"] [data-reason-times-label]')).toHaveText(reportCount(en, p109.reasonCounts.spam));
  await expect(column(page, 'open').locator('[data-column-count]')).toHaveText(columnCount(en, idsIn('open').length));
  expect(problems).toEqual([]);
});

test('actions move the card to the column of its new state, with the keyboard, and update the counts', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto(urlOf('?lang=ja&auth=admin'));
  const open = idsIn('open');
  const first = /** @type {string} */ (open[0]);
  // keyboard: focus the button and press Enter
  await card(page, first).locator('button[data-hide-now]').focus();
  await page.keyboard.press('Enter');
  await expect(column(page, 'hidden').locator(`[data-queue-item][data-target-id="${first}"]`)).toHaveCount(1);
  await expect(column(page, 'open').locator(`[data-queue-item][data-target-id="${first}"]`)).toHaveCount(0);
  await expect(card(page, first).locator('[data-report-state]')).toHaveText(ja['moderation.state.hidden-by-admin']);
  await expect(card(page, first).locator('[data-report-state]')).toBeFocused();
  await expect(card(page, first).locator('button')).toHaveCount(0);
  await expect(column(page, 'open').locator('[data-column-count]')).toHaveText(columnCount(ja, open.length - 1));
  await expect(column(page, 'hidden').locator('[data-column-count]')).toHaveText(columnCount(ja, idsIn('hidden').length + 1));
  await expect(column(page, 'hidden').getByRole('heading', { level: 3 })).toHaveText(`${ja['screen.admin.column.hidden']}${columnCount(ja, idsIn('hidden').length + 1)}`);

  // emptying a column shows its empty message
  for (const id of open.slice(1)) await card(page, id).locator('button[data-hide-now]').click();
  await expect(column(page, 'open').locator('[data-queue-item]')).toHaveCount(0);
  await expect(column(page, 'open').locator('[data-column-empty]')).toBeVisible();
  await expect(column(page, 'open').locator('[data-column-empty]')).toHaveText(ja['screen.admin.column.open.empty']);
  await expect(column(page, 'open').locator('[data-column-count]')).toHaveText(columnCount(ja, 0));

  // the appeal decisions move the card to the done column
  const appealed = /** @type {string} */ (idsIn('appealed')[0]);
  await card(page, appealed).locator('button[data-decision="restore"]').click();
  await expect(column(page, 'done').locator(`[data-queue-item][data-target-id="${appealed}"]`)).toHaveCount(1);
  await expect(card(page, appealed).locator('[data-report-state]')).toHaveText(ja['moderation.state.restored']);
  await expect(card(page, appealed).locator('[data-report-state]')).toBeFocused();
  await expect(column(page, 'appealed').locator('[data-column-empty]')).toHaveText(ja['screen.admin.column.appealed.empty']);
  await expect(column(page, 'done').locator('[data-column-count]')).toHaveText(columnCount(ja, idsIn('done').length + 1));

  // the local state survives a language switch
  await page.evaluate(() => window.MockState.update({ lang: 'en' }));
  await expect(card(page, first).locator('[data-report-state]')).toHaveText(en['moderation.state.hidden-by-admin']);
  await expect(column(page, 'open').locator('[data-column-empty]')).toHaveText(en['screen.admin.column.open.empty']);
  await expect(column(page, 'done').locator('[data-column-count]')).toHaveText(columnCount(en, idsIn('done').length + 1));
  expect(problems).toEqual([]);
});

test('the remove decision moves the appealed card to the done column', async ({ page }) => {
  await page.goto(urlOf('?lang=en&auth=admin'));
  const appealed = /** @type {string} */ (idsIn('appealed')[0]);
  await card(page, appealed).locator('button[data-decision="remove"]').click();
  await expect(column(page, 'done').locator(`[data-target-id="${appealed}"]`)).toHaveCount(1);
  await expect(card(page, appealed).locator('[data-report-state]')).toHaveText(en['moderation.state.removed']);
});

test('empty scenario: every column stays, with a count of 0 and its own empty message', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto(urlOf('?lang=ja&auth=admin&scenario=empty'));
  await expect(page.locator('main [data-queue-item]:visible')).toHaveCount(0);
  for (const [id] of COLUMNS) {
    const col = column(page, id);
    await expect(col).toBeVisible();
    await expect(col.locator('[data-column-count]')).toHaveText(columnCount(ja, 0));
    await expect(col.locator('[data-column-empty]')).toBeVisible();
    await expect(col.locator('[data-column-empty]')).toHaveText(ja[`screen.admin.column.${id}.empty`] ?? '⟦missing⟧');
  }
  // back to default: the cards and the counts come back
  await page.evaluate(() => window.MockState.update({ scenario: 'default' }));
  await expect(page.locator('main [data-queue-item]:visible')).toHaveCount(reports.length);
  await expect(column(page, 'open').locator('[data-column-count]')).toHaveText(columnCount(ja, idsIn('open').length));
  await expect(column(page, 'open').locator('[data-column-empty]')).toBeHidden();
  expect(problems).toEqual([]);
});

for (const auth of ['guest', 'member']) {
  test(`${auth}: no board, only the no-permission notice`, async ({ page }) => {
    await page.goto(urlOf(`?lang=ja&auth=${auth}`));
    await expect(page.locator('main [data-board]')).toBeHidden();
    await expect(page.locator('main [data-no-permission]')).toBeVisible();
    await expect(page.locator('main [data-queue-item]:visible')).toHaveCount(0);
  });
}
