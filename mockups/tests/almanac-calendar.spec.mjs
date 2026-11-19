// Task 4.2: mk-month-calendar and mk-day-cell (4.1, 4.2, 4.6, 12.3, 13.3).
// - PC width: 7-column grid (Sunday first) with date, weekday, holiday (+ provisional label),
//   rokuyo, lunar date, moon age and marks (symbol + text) for sekki / kou / zassetsu / events.
// - Phone width: compact grid (date, holiday, moon phase, marks) + summary panel of the
//   selected day; selection by click and keyboard.
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const catalogUrl = pathToFileURL(join(root, 'components.html')).href;
const dayDetailHref = (/** @type {string} */ date) =>
  `${pathToFileURL(join(root, 'screens', 'day-detail.html')).href}?date=${date}`;

const load = (/** @type {string[]} */ ...files) => {
  const window = /** @type {Record<string, any>} */ ({});
  const ctx = vm.createContext({ window });
  for (const f of files) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  return window;
};
const w = load('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;

/** @param {import('@playwright/test').Page} page */
const collectProblems = (page) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
};

/** @param {import('@playwright/test').Page} page @param {number} width @param {string} [query] */
const open = async (page, width, query = '') => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${catalogUrl}${query}`);
};

/** Full (PC) grid of a calendar. @param {import('@playwright/test').Page} page @param {string} id */
const fullGrid = (page, id) => page.locator(`#${id} [data-layout="full"]`);
/** Compact (phone) part of a calendar. @param {import('@playwright/test').Page} page @param {string} id */
const compact = (page, id) => page.locator(`#${id} [data-layout="compact"]`);
/** @param {import('@playwright/test').Page} page @param {string} id @param {string} date */
const fullCell = (page, id, date) => fullGrid(page, id).locator(`mk-day-cell[date="${date}"]`);

test.describe('mk-month-calendar at PC width', () => {
  test('2026-11: 30 days in a 7-column grid starting on the Sunday column', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440);
    const grid = fullGrid(page, 'cal-2026-11');
    await expect(grid).toBeVisible();
    await expect(compact(page, 'cal-2026-11')).toBeHidden();
    const headers = grid.locator('thead th');
    await expect(headers).toHaveCount(7);
    await expect(headers.first()).toHaveText('日');
    await expect(headers.last()).toHaveText('土');
    await expect(grid.locator('caption')).toContainText('2026年11月');
    await expect(grid.locator('mk-day-cell')).toHaveCount(30);
    const firstRow = grid.locator('tbody tr').first();
    await expect(firstRow.locator('td').first().locator('mk-day-cell')).toHaveAttribute('date', '2026-11-01');
    // Every row has 7 columns.
    const widths = await grid.locator('tbody tr').evaluateAll((rows) => rows.map((r) => r.children.length));
    expect(widths.every((n) => n === 7)).toBe(true);
    // 7 columns side by side.
    const boxes = await firstRow.locator('td').evaluateAll((tds) => tds.map((td) => td.getBoundingClientRect().left));
    expect(boxes.length).toBe(7);
    for (let i = 1; i < boxes.length; i += 1) expect(boxes[i]).toBeGreaterThan(boxes[i - 1]);
    expect(problems).toEqual([]);
  });

  test('2026-11 holidays show their name as text, without the provisional label', async ({ page }) => {
    await open(page, 1440);
    for (const [date, key] of [['2026-11-03', 'holiday.bunka-no-hi'], ['2026-11-23', 'holiday.kinro-kansha-no-hi']]) {
      const holiday = fullCell(page, 'cal-2026-11', date).locator('.mk-day-cell__holiday');
      await expect(holiday).toContainText(ja[key]);
      await expect(holiday.locator('.mk-day-cell__provisional')).toHaveCount(0);
    }
  });

  test('2027-03: starts on Monday; 春分の日 and 振替休日 carry the provisional label text', async ({ page }) => {
    await open(page, 1440);
    const grid = fullGrid(page, 'cal-2027-03');
    await expect(grid).toBeVisible();
    await expect(grid.locator('mk-day-cell')).toHaveCount(31);
    const firstRow = grid.locator('tbody tr').first();
    await expect(firstRow.locator('td').first().locator('mk-day-cell')).toHaveCount(0);
    await expect(firstRow.locator('td').nth(1).locator('mk-day-cell')).toHaveAttribute('date', '2027-03-01');
    const equinox = fullCell(page, 'cal-2027-03', '2027-03-21').locator('.mk-day-cell__holiday');
    await expect(equinox).toContainText(ja['holiday.shunbun-no-hi']);
    await expect(equinox.locator('.mk-day-cell__provisional')).toHaveText(ja['holiday.provisional']);
    const substitute = fullCell(page, 'cal-2027-03', '2027-03-22').locator('.mk-day-cell__holiday');
    await expect(substitute).toContainText(ja['holiday.furikae-kyujitsu']);
    await expect(substitute.locator('.mk-day-cell__provisional')).toHaveText(ja['holiday.provisional']);
  });

  test('a cell shows weekday, rokuyo, lunar date and moon age as text', async ({ page }) => {
    await open(page, 1440);
    const cell = fullCell(page, 'cal-2026-11', '2026-11-07');
    await expect(cell.locator('.mk-day-cell__weekday')).toContainText('土');
    await expect(cell.locator('.mk-day-cell__rokuyo')).toHaveText(ja['rokuyo.shakko']);
    await expect(cell.locator('.mk-day-cell__lunar')).toHaveText('旧暦9月28日');
    await expect(cell.locator('.mk-day-cell__moon')).toContainText('月齢 27.8');
  });

  test('marks use a symbol and text: sekki, kou, zassetsu and astronomical events', async ({ page }) => {
    await open(page, 1440);
    const ritto = fullCell(page, 'cal-2026-11', '2026-11-07');
    const sekki = ritto.locator('[data-mark="sekki"]');
    await expect(sekki).toContainText(ja['sekki.ritto']);
    await expect(sekki.locator('.mk-mark__symbol')).not.toHaveText('');
    await expect(ritto.locator('[data-mark="kou"]')).toContainText(ja['kou.k55']);
    const zassetsu = fullCell(page, 'cal-2027-03', '2027-03-20').locator('[data-mark="zassetsu"]');
    await expect(zassetsu).toContainText(ja['zassetsu.shanichi-spring']);
    const events = fullCell(page, 'cal-2026-11', '2026-11-20').locator('[data-mark="event"]');
    await expect(events).toHaveCount(2);
    await expect(events.first()).toContainText('月と土星が接近');
    await expect(events.first().locator('.mk-mark__symbol')).not.toHaveText('');
  });

  test('the date links to day-detail with the full date as its accessible name', async ({ page }) => {
    await open(page, 1440);
    const link = fullCell(page, 'cal-2026-11', '2026-11-07').getByRole('link', { name: '2026年11月7日(土)' });
    await expect(link).toBeVisible();
    expect(await link.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(dayDetailHref('2026-11-07'));
    await link.focus();
    await expect(link).toBeFocused();
  });

  test('today (2026-11-16) is marked with aria-current="date" and a text label', async ({ page }) => {
    await open(page, 1440);
    const td = fullGrid(page, 'cal-2026-11').locator('td[aria-current="date"]');
    await expect(td).toHaveCount(1);
    await expect(td.locator('mk-day-cell')).toHaveAttribute('date', '2026-11-16');
    await expect(td).toContainText(ja['calendar.today']);
  });

  test('Sunday and Saturday differ in the weekday text, not only color', async ({ page }) => {
    await open(page, 1440);
    const sunday = fullCell(page, 'cal-2026-11', '2026-11-01');
    const saturday = fullCell(page, 'cal-2026-11', '2026-11-07');
    await expect(sunday.locator('.mk-day-cell')).toHaveAttribute('data-weekday', 'sun');
    await expect(saturday.locator('.mk-day-cell')).toHaveAttribute('data-weekday', 'sat');
    await expect(sunday.locator('.mk-day-cell__weekday')).toContainText('日');
  });
});

test.describe('mk-day-cell variants', () => {
  test('leap-month example shows the leap label in the lunar date', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator('#cell-leap .mk-day-cell__lunar')).toHaveText('旧暦閏6月1日');
  });

  test('compact cell shows date, holiday mark, moon phase and mark symbols with a full label', async ({ page }) => {
    await open(page, 1440);
    const cell = page.locator('#cell-compact-2027-03-22 .mk-day-cell');
    await expect(cell).toHaveAttribute('data-compact', '');
    await expect(cell.locator('.mk-day-cell__num')).toHaveText('22');
    await expect(cell.locator('.mk-day-cell__holiday-mark')).toContainText(ja['calendar.holiday-short']);
    await expect(cell.locator('.mk-day-cell__phase')).not.toHaveText('');
    const label = await cell.getAttribute('aria-label');
    expect(label).toContain('2027年3月22日(月)');
    expect(label).toContain(ja['holiday.furikae-kyujitsu']);
    expect(label).toContain(ja['holiday.provisional']);
    expect(label).toContain(ja['moon-phase.full-moon']);
  });

  test('unknown date shows the missing-sample text', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator('#cell-missing [data-missing-sample]')).toBeVisible();
  });
});

test.describe('language switch', () => {
  test('en: weekday headers, holiday names, provisional label, lunar date and marks', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440, '?lang=en');
    const grid = fullGrid(page, 'cal-2027-03');
    await expect(grid.locator('thead th').first()).toHaveText('Sun');
    await expect(grid.locator('caption')).toContainText('March 2027');
    const equinox = fullCell(page, 'cal-2027-03', '2027-03-21');
    await expect(equinox.locator('.mk-day-cell__holiday')).toContainText(en['holiday.shunbun-no-hi']);
    await expect(equinox.locator('.mk-day-cell__provisional')).toHaveText(en['holiday.provisional']);
    await expect(equinox.locator('[data-mark="sekki"]')).toContainText(en['sekki.shunbun']);
    await expect(equinox.locator('.mk-day-cell__lunar')).toHaveText('Lunar 2/14');
    await expect(fullCell(page, 'cal-2026-11', '2026-11-03').locator('.mk-day-cell__holiday')).toContainText(en['holiday.bunka-no-hi']);
    expect(problems).toEqual([]);
  });

  test('switching language at run time re-renders the calendar', async ({ page }) => {
    await open(page, 1440);
    const holiday = fullCell(page, 'cal-2026-11', '2026-11-03').locator('.mk-day-cell__holiday');
    await expect(holiday).toContainText(ja['holiday.bunka-no-hi']);
    await page.locator('mk-site-header').first().getByRole('button', { name: 'English' }).click();
    await expect(holiday).toContainText(en['holiday.bunka-no-hi']);
  });
});

test.describe('mk-month-calendar at phone width', () => {
  test('375px: compact grid and summary panel instead of the full grid', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 375);
    await expect(fullGrid(page, 'cal-2027-03')).toBeHidden();
    const part = compact(page, 'cal-2027-03');
    await expect(part).toBeVisible();
    const grid = part.getByRole('grid');
    await expect(grid).toBeVisible();
    await expect(grid.getByRole('gridcell').filter({ has: page.locator('button') })).toHaveCount(31);
    await expect(grid.getByRole('columnheader')).toHaveCount(7);
    const summary = part.locator('.mk-calendar__summary');
    await expect(summary).toBeVisible();
    // Initial selection: the first day of a month that does not hold "today".
    await expect(grid.locator('[aria-selected="true"]')).toHaveCount(1);
    await expect(summary.locator('mk-day-cell')).toHaveAttribute('date', '2027-03-01');
    expect(problems).toEqual([]);
  });

  test('375px: the summary panel shows the full date of the selected day as a heading', async ({ page }) => {
    await open(page, 375);
    const part = compact(page, 'cal-2027-03');
    const summary = part.locator('.mk-calendar__summary');
    await expect(summary.getByRole('heading', { name: '2027年3月1日(月)' })).toBeVisible();
    await part.getByRole('button', { name: /2027年3月21日\(日\)/ }).click();
    await expect(summary.getByRole('heading', { name: '2027年3月21日(日)' })).toBeVisible();
    await open(page, 375, '?lang=en');
    await expect(compact(page, 'cal-2027-03').locator('.mk-calendar__summary').getByRole('heading', { name: 'Mon, Mar 1, 2027' })).toBeVisible();
  });

  test('375px: before any selection, a legend explains the holiday marks (incl. provisional) and the symbols as text', async ({ page }) => {
    await open(page, 375);
    const legend = compact(page, 'cal-2027-03').locator('.mk-calendar__legend');
    await expect(legend).toBeVisible();
    await expect(legend.getByText(ja['calendar.legend.provisional'])).toBeVisible();
    for (const key of ['calendar.legend.holiday', 'sekki.label', 'kou.label', 'zassetsu.label', 'calendar.legend.event',
      'moon-phase.new-moon', 'moon-phase.first-quarter', 'moon-phase.full-moon', 'moon-phase.last-quarter']) {
      await expect(legend).toContainText(ja[key]);
    }
    await expect(legend.locator('.mk-day-cell__holiday-mark[data-provisional]')).toBeVisible();
    for (const symbol of ['◆', '◇', '■', '★', '●', '◐', '○', '◑']) await expect(legend).toContainText(symbol);
    await open(page, 375, '?lang=en');
    await expect(compact(page, 'cal-2027-03').locator('.mk-calendar__legend').getByText(en['calendar.legend.provisional'])).toBeVisible();
  });

  test('375px: the summary live region persists across selections; compact cell wrapper is phrasing content', async ({ page }) => {
    await open(page, 375);
    const part = compact(page, 'cal-2027-03');
    await part.locator('.mk-calendar__summary').evaluate((el) => { el.setAttribute('data-probe', '1'); });
    await part.getByRole('button', { name: /2027年3月21日/ }).click();
    await expect(part.locator('.mk-calendar__summary')).toHaveAttribute('data-probe', '1');
    await expect(part.locator('.mk-calendar__summary')).toHaveAttribute('aria-live', 'polite');
    await expect(part.locator('.mk-calendar__summary mk-day-cell')).toHaveAttribute('date', '2027-03-21');
    const tags = await part.locator('button mk-day-cell > *').evaluateAll((els) => [...new Set(els.map((e) => e.tagName))]);
    expect(tags).toEqual(['SPAN']);
  });

  test('375px: today is selected first in the month that holds it', async ({ page }) => {
    await open(page, 375);
    const part = compact(page, 'cal-2026-11');
    await expect(part.locator('.mk-calendar__summary mk-day-cell')).toHaveAttribute('date', '2026-11-16');
    await expect(part.locator('[aria-current="date"]')).toHaveCount(1);
  });

  test('375px: tapping a day selects it and updates the summary panel', async ({ page }) => {
    await open(page, 375);
    const part = compact(page, 'cal-2027-03');
    const button = part.getByRole('button', { name: /2027年3月21日\(日\)/ });
    await button.click();
    await expect(part.locator('td[aria-selected="true"] button')).toHaveAccessibleName(/2027年3月21日/);
    const summary = part.locator('.mk-calendar__summary');
    await expect(summary.locator('mk-day-cell')).toHaveAttribute('date', '2027-03-21');
    await expect(summary.locator('.mk-day-cell__holiday')).toContainText(ja['holiday.shunbun-no-hi']);
    await expect(summary.locator('.mk-day-cell__provisional')).toHaveText(ja['holiday.provisional']);
    await expect(summary.locator('.mk-day-cell__rokuyo')).toHaveText(ja['rokuyo.sakimake']);
    await expect(summary.locator('[data-mark="sekki"]')).toContainText(ja['sekki.shunbun']);
    const detail = summary.getByRole('link', { name: ja['calendar.open-day-detail'] });
    expect(await detail.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(dayDetailHref('2027-03-21'));
  });

  test('375px: arrow keys move the selection and the focus (roving tabindex)', async ({ page }) => {
    await open(page, 375);
    const part = compact(page, 'cal-2027-03');
    const selected = part.locator('td[aria-selected="true"] button');
    await selected.focus();
    await expect(selected).toHaveAttribute('tabindex', '0');
    const summaryDate = part.locator('.mk-calendar__summary mk-day-cell');
    // Before the 1st: stays on the 1st (no days outside the month).
    await page.keyboard.press('ArrowLeft');
    await expect(summaryDate).toHaveAttribute('date', '2027-03-01');
    await page.keyboard.press('ArrowRight');
    await expect(summaryDate).toHaveAttribute('date', '2027-03-02');
    await expect(part.locator('td[aria-selected="true"] button')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(summaryDate).toHaveAttribute('date', '2027-03-09');
    await expect(part.locator('td[aria-selected="true"] button')).toBeFocused();
    // Home / End: start (Sunday) and end (Saturday) of the week.
    await page.keyboard.press('End');
    await expect(summaryDate).toHaveAttribute('date', '2027-03-13');
    await page.keyboard.press('Home');
    await expect(summaryDate).toHaveAttribute('date', '2027-03-07');
    await page.keyboard.press('ArrowUp');
    await expect(summaryDate).toHaveAttribute('date', '2027-03-01');
    await expect(part.locator('td[aria-selected="true"] button')).toBeFocused();
    expect(await part.locator('button[tabindex="0"]').count()).toBe(1);
  });

  test('375px: compact cells show the holiday mark and the moon phase', async ({ page }) => {
    await open(page, 375);
    const part = compact(page, 'cal-2027-03');
    const cell = part.locator('mk-day-cell[date="2027-03-22"] .mk-day-cell');
    await expect(cell.locator('.mk-day-cell__holiday-mark')).toBeVisible();
    await expect(cell.locator('.mk-day-cell__phase')).toBeVisible();
  });
});

test.describe('layout and stage', () => {
  for (const width of [360, 375, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await open(page, width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const overflow = await page.locator('mk-month-calendar').evaluateAll((els) => els.map((el) => {
        const r = el.getBoundingClientRect();
        return r.right <= document.documentElement.clientWidth + 0.5;
      }));
      // Task 6.4: the PC samples (2026-11, 2027-03) and the phone-width sample of the gallery;
      // task 8.1 added the Monday-first sample with month navigation.
      expect(overflow.length).toBe(4);
      expect(overflow.every(Boolean)).toBe(true);
    });
  }

  test('wireframe: holiday, weekday and provisional colors are grayscale; texts stay', async ({ page }) => {
    await open(page, 1440, '?stage=wireframe');
    const cell = fullCell(page, 'cal-2027-03', '2027-03-21');
    await expect(cell.locator('.mk-day-cell__provisional')).toHaveText(ja['holiday.provisional']);
    const colors = await cell.evaluate((el) => [
      '.mk-day-cell__holiday', '.mk-day-cell__provisional', '.mk-day-cell__num', '.mk-day-cell__rokuyo', '.mk-mark__symbol',
    ].map((sel) => {
      const node = el.querySelector(sel);
      if (!node) return `${sel}: missing`;
      const s = getComputedStyle(node);
      return [s.color, s.borderTopColor, s.backgroundColor];
    }));
    for (const entry of colors) {
      expect(Array.isArray(entry)).toBe(true);
      for (const value of /** @type {string[]} */ (entry)) {
        const m = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?/);
        expect(m, value).not.toBeNull();
        if (m && m[4] !== '0') expect(m[1] === m[2] && m[2] === m[3], value).toBe(true);
      }
    }
  });
});
