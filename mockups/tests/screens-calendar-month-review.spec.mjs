// Task 8.1 (calendar-month only): the wireframe review notes recorded for `calendar-month` in
// data/screens.js (Requirements 1.3, 1.4, 4.1, 4.2, 12.3, 13.3, 13.4).
//   1. 月曜始まりが望ましい: the screen's calendar starts the week on Monday
//      (mk-month-calendar week-start="mon"; the component default stays Sunday first)
//   2. 月の移動ができない: previous / this / next month buttons (mk-month-calendar nav). The
//      page keeps the shown month in ?month=YYYY-MM (replaceState; the other parameters stay),
//      and updates the h2. Months without sample rows show the dates and weekdays only, with
//      a note saying so (no holidays / rokuyo / lunar date / moon / marks are computed).
//   3. カレンダーで2026年11月が2回出てくるので要修正: the month shows once, in the h2. The full
//      grid keeps its <caption> (the table's accessible name) but visually hidden
//      (mk-month-calendar caption="hidden"; the gallery samples keep a visible caption). The
//      visible order is h2, month buttons, grid.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, loadClassicScripts, watchConsole } from './helpers/e2e.mjs';
import { pageHorizontalOverflow } from './helpers/layout-checks.mjs';

const w = loadClassicScripts('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;

const urlOf = (query = '') =>
  pathToFileURL(join(MOCKUPS_ROOT, 'screens', 'calendar-month.html')).href + query;

/** @param {import('@playwright/test').Page} page */
const calendar = (page) => page.locator('main mk-month-calendar');
/** @param {import('@playwright/test').Page} page */
const fullGrid = (page) => calendar(page).locator('[data-layout="full"]');
/** @param {import('@playwright/test').Page} page */
const monthNav = (page) => calendar(page).getByRole('navigation', { name: ja['calendar.nav.label'] });
/** @param {import('@playwright/test').Page} page */
const searchOf = (page) => new URL(page.url()).searchParams;

test.describe('calendar-month: review note 1 (Monday first)', () => {
  test('PC: headers run Monday to Sunday and 2026-11-01 (Sunday) sits in the last column', async ({ page }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('?lang=ja'));
    await expect(calendar(page)).toHaveAttribute('week-start', 'mon');
    const headers = fullGrid(page).locator('thead th');
    await expect(headers).toHaveText(['月', '火', '水', '木', '金', '土', '日']);
    expect(await headers.evaluateAll((ths) => ths.map((th) => th.getAttribute('data-weekday'))))
      .toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    expect(await headers.evaluateAll((ths) => ths.map((th) => th.getAttribute('scope')))).toEqual(Array(7).fill('col'));
    const rows = fullGrid(page).locator('tbody tr');
    const first = rows.first().locator('td');
    await expect(first).toHaveCount(7);
    for (let i = 0; i < 6; i += 1) await expect(first.nth(i)).toHaveClass(/mk-calendar__blank/);
    await expect(first.nth(6).locator('mk-day-cell')).toHaveAttribute('date', '2026-11-01');
    // 2026-11-30 is a Monday: first column of the last row.
    await expect(rows.last().locator('td').first().locator('mk-day-cell')).toHaveAttribute('date', '2026-11-30');
    await expect(fullGrid(page).locator('mk-day-cell')).toHaveCount(30);
    // Weekend / holiday marking follows the real weekday, not the column.
    await expect(first.nth(6).locator('.mk-day-cell')).toHaveAttribute('data-weekday', 'sun');
    await expect(fullGrid(page).locator('mk-day-cell[date="2026-11-03"] .mk-day-cell')).toHaveAttribute('data-holiday', '');
    await expect(fullGrid(page).locator('mk-day-cell[date="2026-11-07"] .mk-day-cell')).toHaveAttribute('data-weekday', 'sat');
    expect(await rows.evaluateAll((trs) => trs.map((tr) => tr.children.length)).then((n) => n.every((c) => c === 7))).toBe(true);
    expect(problems).toEqual([]);
  });

  test('English headers run Mon to Sun', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('?lang=en'));
    await expect(fullGrid(page).locator('thead th')).toHaveText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  test('2027-03 (provisional-holiday): 2027-03-01 is a Monday, so it starts the first row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('?lang=ja&scenario=provisional-holiday'));
    await expect(fullGrid(page).locator('tbody tr').first().locator('td').first().locator('mk-day-cell'))
      .toHaveAttribute('date', '2027-03-01');
  });

  test('phone: the compact grid starts on Monday and Home / End go to Monday / Sunday', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(urlOf('?lang=ja'));
    const grid = calendar(page).locator('[data-layout="compact"] [role="grid"]');
    await expect(grid.locator('thead th')).toHaveText(['月', '火', '水', '木', '金', '土', '日']);
    const day = (/** @type {string} */ date) => grid.locator(`button[data-date="${date}"]`);
    await day('2026-11-18').click();
    await expect(day('2026-11-18')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(day('2026-11-16')).toBeFocused();
    await page.keyboard.press('End');
    await expect(day('2026-11-22')).toBeFocused();
    expect(await page.evaluate(pageHorizontalOverflow)).toBeLessThanOrEqual(0);
  });
});

test.describe('calendar-month: review note 2 (moving between months)', () => {
  test('previous / this / next month buttons are named with their target month', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('?lang=ja'));
    const nav = monthNav(page);
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole('button')).toHaveCount(3);
    await expect(nav.getByRole('button', { name: '前の月（2026年10月）' })).toBeVisible();
    await expect(nav.getByRole('button', { name: '今月（2026年11月）' })).toBeVisible();
    await expect(nav.getByRole('button', { name: '次の月（2026年12月）' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('next month: heading, caption, ?month and the button names move; other params stay', async ({ page }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('?lang=ja&stage=wireframe&auth=member&theme=dark'));
    const next = monthNav(page).getByRole('button', { name: '次の月（2026年12月）' });
    await next.click();
    await expect(calendar(page)).toHaveAttribute('month', '2026-12');
    await expect(page.locator('main h2 [data-i18n-date]')).toHaveText('2026年12月');
    await expect(page.getByRole('heading', { level: 2, name: /2026年12月/ })).toHaveCount(1);
    await expect(fullGrid(page).locator('caption')).toHaveText('2026年12月');
    const params = searchOf(page);
    expect(params.get('month')).toBe('2026-12');
    expect(params.get('lang')).toBe('ja');
    expect(params.get('stage')).toBe('wireframe');
    expect(params.get('auth')).toBe('member');
    expect(params.get('theme')).toBe('dark');
    // Focus stays on the button, which now names the month after.
    const moved = monthNav(page).getByRole('button', { name: '次の月（2027年1月）' });
    await expect(moved).toBeFocused();
    await expect(monthNav(page).getByRole('button', { name: '前の月（2026年11月）' })).toBeVisible();
    await expect(calendar(page).locator('[data-calendar-status]')).toHaveText('2026年12月を表示しています');
    expect(problems).toEqual([]);
  });

  test('previous month and "this month" go back; the keyboard works too', async ({ page }) => {
    await page.goto(urlOf('?lang=ja'));
    const prev = monthNav(page).getByRole('button', { name: '前の月（2026年10月）' });
    await prev.focus();
    await page.keyboard.press('Enter');
    await expect(calendar(page)).toHaveAttribute('month', '2026-10');
    await page.keyboard.press('Space');
    await expect(calendar(page)).toHaveAttribute('month', '2026-09');
    await monthNav(page).getByRole('button', { name: '今月（2026年11月）' }).click();
    await expect(calendar(page)).toHaveAttribute('month', '2026-11');
    await expect(page.locator('main h2 [data-i18n-date]')).toHaveText('2026年11月');
    expect(searchOf(page).get('month')).toBe('2026-11');
  });

  test('moves across the year boundary', async ({ page }) => {
    await page.goto(urlOf('?lang=ja&month=2026-01'));
    await monthNav(page).getByRole('button', { name: '前の月（2025年12月）' }).click();
    await expect(calendar(page)).toHaveAttribute('month', '2025-12');
    await page.goto(urlOf('?lang=ja&month=2026-12'));
    await monthNav(page).getByRole('button', { name: '次の月（2027年1月）' }).click();
    await expect(calendar(page)).toHaveAttribute('month', '2027-01');
  });

  test('?month=YYYY-MM opens that month (reload keeps it); 2027-03 shows its sample rows', async ({ page }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('?lang=ja&month=2027-03'));
    await expect(calendar(page)).toHaveAttribute('month', '2027-03');
    await expect(page.locator('main h2 [data-i18n-date]')).toHaveText('2027年3月');
    await expect(fullGrid(page).locator('mk-day-cell')).toHaveCount(31);
    await expect(calendar(page).locator('[data-calendar-no-sample]')).toHaveCount(0);
    await page.reload();
    await expect(calendar(page)).toHaveAttribute('month', '2027-03');
    expect(problems).toEqual([]);
  });

  test('a month without sample rows: dates and weekdays only, with a note; no missing-sample errors', async ({ page }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('?lang=ja&month=2026-12'));
    await expect(page.locator('[data-missing-sample]')).toHaveCount(0);
    await expect(fullGrid(page).locator('mk-day-cell')).toHaveCount(0);
    const plain = fullGrid(page).locator('[data-no-sample-day]');
    await expect(plain).toHaveCount(31);
    // 2026-12-01 is a Tuesday: second column (Monday first).
    const first = fullGrid(page).locator('tbody tr').first().locator('td');
    await expect(first.nth(0)).toHaveClass(/mk-calendar__blank/);
    await expect(first.nth(1).locator('[data-no-sample-day]')).toHaveAttribute('data-weekday', 'tue');
    await expect(first.nth(1)).toContainText('1');
    await expect(first.nth(1).locator('a')).toHaveCount(0);
    await expect(calendar(page).locator('[data-calendar-no-sample]')).toHaveText(ja['calendar.no-sample-days']);
    await expect(fullGrid(page).locator('.mk-day-cell__holiday, .mk-day-cell__rokuyo')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('a month with only some sample rows (2025-07) shows those days in full', async ({ page }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('?lang=ja&month=2025-07'));
    await expect(fullGrid(page).locator('mk-day-cell')).toHaveCount(1);
    await expect(fullGrid(page).locator('mk-day-cell')).toHaveAttribute('date', '2025-07-25');
    await expect(fullGrid(page).locator('[data-no-sample-day]')).toHaveCount(30);
    await expect(calendar(page).locator('[data-calendar-no-sample]')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('phone: a day without sample rows can be selected; the summary says so without a detail link', async ({ page }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(urlOf('?lang=ja&month=2026-12'));
    const compact = calendar(page).locator('[data-layout="compact"]');
    const day = compact.getByRole('button', { name: /2026年12月5日\(土\)/ });
    await day.click();
    const summary = compact.locator('.mk-calendar__summary');
    await expect(summary.locator('h3')).toHaveText('2026年12月5日(土)');
    await expect(summary).toContainText(ja['calendar.no-sample-day']);
    await expect(summary.locator('a')).toHaveCount(0);
    await expect(monthNav(page)).toBeVisible();
    expect(await page.evaluate(pageHorizontalOverflow)).toBeLessThanOrEqual(0);
    expect(problems).toEqual([]);
  });

  test('an invalid ?month falls back to the default month with a warning', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('?lang=ja&month=2026-13'));
    await expect(calendar(page)).toHaveAttribute('month', '2026-11');
    await expect(page.locator('main h2 [data-i18n-date]')).toHaveText('2026年11月');
    expect(problems.some((p) => p.includes('month=2026-13'))).toBe(true);
  });

  test('switching the scenario resets the month to its initial value and drops ?month', async ({ page }) => {
    await page.goto(urlOf('?lang=ja&month=2026-12'));
    await page.evaluate(() => window.MockState.update({ scenario: 'provisional-holiday' }));
    await expect(calendar(page)).toHaveAttribute('month', '2027-03');
    await expect(page.locator('main h2 [data-i18n-date]')).toHaveText('2027年3月');
    expect(searchOf(page).get('month')).toBeNull();
    expect(searchOf(page).get('scenario')).toBe('provisional-holiday');
    // A language switch keeps the month.
    await monthNav(page).getByRole('button', { name: '次の月（2027年4月）' }).click();
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(calendar(page)).toHaveAttribute('month', '2027-04');
    await expect(page.locator('main h2 [data-i18n-date]')).toHaveText('April 2027');
  });

  test('English: names and status', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('?lang=en'));
    const nav = calendar(page).getByRole('navigation', { name: en['calendar.nav.label'] });
    await expect(nav.getByRole('button', { name: 'Previous month (October 2026)' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'This month (November 2026)' })).toBeVisible();
    await nav.getByRole('button', { name: 'Next month (December 2026)' }).click();
    await expect(calendar(page).locator('[data-calendar-status]')).toHaveText('Showing December 2026');
    await expect(calendar(page).locator('[data-calendar-no-sample]')).toHaveText(en['calendar.no-sample-days']);
    expect(problems).toEqual([]);
  });
});

/**
 * Visible text nodes in <main> whose trimmed text is exactly `text`. A node counts when it has a
 * box larger than 1px and no ancestor is hidden (checkVisibility) or clipped (clip-path, as
 * .visually-hidden does).
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 */
const visibleExactCount = (page, text) => page.evaluate((want) => {
  const main = document.querySelector('main');
  if (main === null) return -1;
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  let count = 0;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if ((node.textContent ?? '').trim() !== want) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) continue;
    let hidden = false;
    for (let el = node.parentElement; el !== null; el = el.parentElement) {
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) { hidden = true; break; }
      if (getComputedStyle(el).clipPath !== 'none') { hidden = true; break; }
    }
    if (!hidden) count += 1;
  }
  return count;
}, text);

test.describe('calendar-month: review note 3 (the month shows once)', () => {
  for (const width of [1440, 375]) {
    test(`${width}px ja: 2026年11月 is visible once, also after moving to December`, async ({ page }) => {
      const problems = watchConsole(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(urlOf('?lang=ja'));
      await expect(page.locator('main h2 [data-i18n-date]')).toHaveText('2026年11月');
      expect(await visibleExactCount(page, '2026年11月')).toBe(1);
      await monthNav(page).getByRole('button', { name: '次の月（2026年12月）' }).click();
      await expect(page.locator('main h2 [data-i18n-date]')).toHaveText('2026年12月');
      expect(await visibleExactCount(page, '2026年12月')).toBe(1);
      expect(await visibleExactCount(page, '2026年11月')).toBe(0);
      expect(problems).toEqual([]);
    });

    test(`${width}px en: November 2026 is visible once, also after moving to December`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(urlOf('?lang=en'));
      await expect(page.locator('main h2 [data-i18n-date]')).toHaveText('November 2026');
      expect(await visibleExactCount(page, 'November 2026')).toBe(1);
      await calendar(page).getByRole('navigation', { name: en['calendar.nav.label'] })
        .getByRole('button', { name: 'Next month (December 2026)' }).click();
      await expect(page.locator('main h2 [data-i18n-date]')).toHaveText('December 2026');
      expect(await visibleExactCount(page, 'December 2026')).toBe(1);
    });
  }

  test('the full grid keeps its caption as the accessible name, visually hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('?lang=ja'));
    await expect(calendar(page)).toHaveAttribute('caption', 'hidden');
    const caption = fullGrid(page).locator('caption');
    await expect(caption).toHaveText('2026年11月');
    await expect(caption).toHaveClass(/visually-hidden/);
    await expect(page.getByRole('table', { name: '2026年11月', exact: true })).toHaveCount(1);
    await monthNav(page).getByRole('button', { name: '次の月（2026年12月）' }).click();
    await expect(page.getByRole('table', { name: '2026年12月', exact: true })).toHaveCount(1);
    await expect(fullGrid(page).locator('caption')).toHaveClass(/visually-hidden/);
  });

  for (const width of [1440, 375]) {
    test(`${width}px: the visible order is h2, month buttons, grid`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(urlOf('?lang=ja'));
      const grid = width >= 600 ? fullGrid(page) : calendar(page).locator('[data-layout="compact"] [role="grid"]');
      await expect(grid).toBeVisible();
      const top = async (/** @type {import('@playwright/test').Locator} */ l) => (await l.boundingBox())?.y ?? NaN;
      const h2 = await top(page.locator('#calendar-month-heading'));
      const nav = await top(monthNav(page));
      const g = await top(grid);
      expect(h2).toBeLessThan(nav);
      expect(nav).toBeLessThan(g);
      expect(await page.evaluate(pageHorizontalOverflow)).toBeLessThanOrEqual(0);
    });
  }

  test('the component gallery keeps a visible caption (caption="hidden" is opt-in)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(join(MOCKUPS_ROOT, 'components.html')).href + '?lang=ja');
    for (const id of ['cal-2026-11', 'cal-week-nav']) {
      const caption = page.locator(`#${id} [data-layout="full"] caption`);
      await expect(caption, id).toBeVisible();
      await expect(caption, id).not.toHaveClass(/visually-hidden/);
      await expect(caption, id).toHaveText('2026年11月');
    }
  });
});
