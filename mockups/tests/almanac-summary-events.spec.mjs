// Task 4.3: mk-almanac-summary, mk-rise-set and mk-event-list (3.4, 3.5, 4.3, 4.4, 4.5, 4.7, 7.3).
// - mk-almanac-summary: variant="full" (day detail) shows every item incl. the leap-month label
//   and the provisional holiday label; variant="brief" (top) shows fewer items.
// - mk-rise-set: sunrise / sunset / moonrise / moonset by date (sample point) or by post
//   (post location); a missing time is shown as text; a post without location renders nothing.
// - mk-event-list: events by datetime and kind, period and kind filters (no reload), empty state
//   (scenario empty or no match) and fetch error (scenario fetch-error).
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const catalogUrl = pathToFileURL(join(root, 'components.html')).href;

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
/** @param {Record<string, string>} dict @param {string} key @param {Record<string, string | number>} args */
const fill = (dict, key, args) => String(dict[key]).replace(/\{([^{}]+)\}/g, (all, name) => (name in args ? String(args[name]) : all));

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

/** @param {import('@playwright/test').Page} page @param {string} id @param {string} item */
const summaryItem = (page, id, item) => page.locator(`#${id} [data-item="${item}"]`);

const FULL_ITEMS = ['rokuyo', 'lunar', 'moon', 'sekki', 'kou', 'zassetsu', 'holiday', 'events'];

test.describe('mk-almanac-summary', () => {
  test('full: every item with its label; leap month on 2025-07-25', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440);
    const id = 'summary-full-leap';
    await expect(page.locator(`#${id} [data-item]`)).toHaveCount(FULL_ITEMS.length);
    const labels = ['rokuyo.label', 'lunar-month.label', 'almanac.moon', 'sekki.label', 'kou.label', 'zassetsu.label', 'almanac.holiday', 'almanac.events'];
    for (const [i, item] of FULL_ITEMS.entries()) {
      await expect(summaryItem(page, id, item).locator('dt')).toHaveText(ja[labels[i]]);
    }
    await expect(summaryItem(page, id, 'lunar').locator('dd')).toHaveText(fill(ja, 'lunar-month.date-leap', { month: 6, day: 1 }));
    await expect(summaryItem(page, id, 'lunar')).toHaveAttribute('data-leap', '');
    await expect(summaryItem(page, id, 'rokuyo').locator('dd')).toHaveText(ja['rokuyo.shakko']);
    await expect(summaryItem(page, id, 'moon').locator('dd')).toContainText(ja['moon-phase.new-moon']);
    await expect(summaryItem(page, id, 'moon').locator('dd')).toContainText(fill(ja, 'moon-phase.age', { age: '0.7' }));
    // Items without a value say so in text.
    await expect(summaryItem(page, id, 'sekki').locator('dd')).toHaveText(ja['almanac.none']);
    await expect(summaryItem(page, id, 'holiday').locator('dd')).toHaveText(ja['almanac.none']);
    await expect(page.locator(`#${id}`)).toContainText('2025年7月25日(金)');
    expect(problems).toEqual([]);
  });

  test('full: provisional holiday, sekki and kou on 2027-03-21', async ({ page }) => {
    await open(page, 1440);
    const id = 'summary-full-2027-03-21';
    const holiday = summaryItem(page, id, 'holiday').locator('dd');
    await expect(holiday).toContainText(ja['holiday.shunbun-no-hi']);
    await expect(holiday.locator('.mk-almanac-summary__provisional')).toHaveText(ja['holiday.provisional']);
    await expect(summaryItem(page, id, 'sekki').locator('dd')).toHaveText(ja['sekki.shunbun']);
    await expect(summaryItem(page, id, 'kou').locator('dd')).toHaveText(ja['kou.k10']);
    await expect(summaryItem(page, id, 'lunar')).not.toHaveAttribute('data-leap', '');
  });

  test('full: the day\'s astronomical events are listed', async ({ page }) => {
    await open(page, 1440);
    // 2026-11-07 has sekki and kou, no events.
    await expect(summaryItem(page, 'summary-full-2026-11-07', 'sekki').locator('dd')).toHaveText(ja['sekki.ritto']);
    await expect(summaryItem(page, 'summary-full-2026-11-07', 'kou').locator('dd')).toHaveText(ja['kou.k55']);
    await expect(summaryItem(page, 'summary-full-2026-11-07', 'events').locator('dd')).toHaveText(ja['almanac.none']);
  });

  test('brief: fewer items (date, rokuyo, lunar, moon and the sekki / holiday of the day)', async ({ page }) => {
    await open(page, 1440);
    const brief = page.locator('#summary-brief-2026-11-07 [data-item]');
    const full = page.locator('#summary-full-2026-11-07 [data-item]');
    const fullCount = await full.count();
    const briefCount = await brief.count();
    expect(briefCount).toBeGreaterThan(0);
    expect(briefCount).toBeLessThan(fullCount);
    await expect(summaryItem(page, 'summary-brief-2026-11-07', 'rokuyo').locator('dd')).toHaveText(ja['rokuyo.shakko']);
    await expect(summaryItem(page, 'summary-brief-2026-11-07', 'sekki').locator('dd')).toHaveText(ja['sekki.ritto']);
    await expect(summaryItem(page, 'summary-brief-2026-11-07', 'kou')).toHaveCount(0);
    await expect(summaryItem(page, 'summary-brief-2026-11-07', 'holiday')).toHaveCount(0);
    const briefHoliday = summaryItem(page, 'summary-brief-2027-03-21', 'holiday').locator('dd');
    await expect(briefHoliday).toContainText(ja['holiday.shunbun-no-hi']);
    await expect(briefHoliday).toContainText(ja['holiday.provisional']);
    await expect(page.locator('#summary-brief-2026-11-07 .mk-almanac-summary')).toHaveAttribute('data-variant', 'brief');
  });

  test('unknown date shows the missing-sample message', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator('#summary-missing [data-missing-sample="2026-12-31"]')).toBeVisible();
  });
});

test.describe('mk-rise-set', () => {
  const ITEMS = ['sunrise', 'sunset', 'moonrise', 'moonset'];

  test('by date: four labelled times', async ({ page }) => {
    await open(page, 1440);
    const times = { sunrise: '06:05', sunset: '16:42', moonrise: '04:07', moonset: '16:38' };
    for (const item of ITEMS) {
      const row = page.locator(`#riseset-2026-11-07 [data-item="${item}"]`);
      await expect(row.locator('dt')).toHaveText(ja[`astro.riseset.${item}`]);
      await expect(row.locator('dd time')).toHaveText(times[/** @type {keyof typeof times} */ (item)]);
    }
    await expect(page.locator('#riseset-2026-11-07 [data-item="sunrise"] time')).toHaveAttribute('datetime', '2026-11-07T06:05+09:00');
  });

  test('a missing moonset is shown as text', async ({ page }) => {
    await open(page, 1440);
    const row = page.locator('#riseset-2026-11-16 [data-item="moonset"]');
    await expect(row.locator('dd')).toHaveText(ja['almanac.riseset-none']);
    await expect(row.locator('time')).toHaveCount(0);
    await expect(page.locator('#riseset-2026-11-16 [data-item="moonrise"] time')).toHaveText('11:59');
  });

  test('by post: the post location times; a post without location renders nothing', async ({ page }) => {
    await open(page, 1440);
    const times = { sunrise: '06:16', sunset: '16:37', moonrise: '12:51', moonset: '00:20' };
    for (const item of ITEMS) {
      await expect(page.locator(`#riseset-post-p-101 [data-item="${item}"] time`)).toHaveText(times[/** @type {keyof typeof times} */ (item)]);
    }
    await expect(page.locator('#riseset-post-p-106')).toBeAttached();
    expect(await page.locator('#riseset-post-p-106').evaluate((el) => el.childElementCount)).toBe(0);
  });
});

test.describe('mk-event-list', () => {
  /** @param {import('@playwright/test').Page} page @param {string} id */
  const items = (page, id) => page.locator(`#${id} .mk-event-list__items > li`);

  test('2026-11: events in time order with datetime, kind and title', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440);
    const list = items(page, 'events-2026-11');
    await expect(list).toHaveCount(12);
    await expect(page.locator('#events-2026-11 ol.mk-event-list__items')).toBeVisible();
    const first = list.first();
    await expect(first.locator('time')).toHaveText('2026年11月1日(日) 05:28');
    await expect(first.locator('time')).toHaveAttribute('datetime', '2026-11-01T05:28+09:00');
    await expect(first.locator('.mk-event__kind')).toHaveText(ja['astro.kind.moon-phase']);
    await expect(first.locator('.mk-event__title')).toHaveText(ja['astro.event.last-quarter']);
    // Placeholders are filled with body names.
    await expect(list.nth(5).locator('.mk-event__title')).toHaveText(fill(ja, 'astro.event.close-approach', { body1: ja['astro.body.moon'], body2: ja['astro.body.saturn'] }));
    const stamps = await list.locator('time').evaluateAll((els) => els.map((el) => el.getAttribute('datetime') ?? ''));
    expect(stamps.every((s) => s.startsWith('2026-11-'))).toBe(true);
    expect([...stamps].sort()).toEqual(stamps);
    await expect(page.locator('#events-2026-11 [role="status"]')).toHaveText(fill(ja, 'event-list.result-count', { count: 12 }));
    expect(problems).toEqual([]);
  });

  test('filters are labelled: period inputs and a checkbox per kind, initial values from attributes', async ({ page }) => {
    await open(page, 1440);
    const root = page.locator('#events-kinds');
    await expect(root.getByRole('group', { name: ja['event-list.period'] })).toBeVisible();
    const kinds = root.getByRole('group', { name: ja['event-list.kinds'] });
    await expect(kinds.getByRole('checkbox')).toHaveCount(7);
    await expect(kinds.getByRole('checkbox', { name: ja['astro.kind.moon-phase'] })).toBeChecked();
    await expect(kinds.getByRole('checkbox', { name: ja['astro.kind.planet-opposition'] })).toBeChecked();
    await expect(kinds.getByRole('checkbox', { name: ja['astro.kind.moon-apsis'] })).not.toBeChecked();
    await expect(root.getByLabel(ja['event-list.from'])).toHaveValue('2026-11-01');
    await expect(root.getByLabel(ja['event-list.to'])).toHaveValue('2026-12-31');
    // 9 moon phases + 1 opposition over 2026-11 and 2026-12.
    await expect(items(page, 'events-kinds')).toHaveCount(10);
    const kindsShown = await items(page, 'events-kinds').evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-kind')))].sort());
    expect(kindsShown).toEqual(['moon-phase', 'planet-opposition']);
  });

  test('unchecking a kind removes those events without reload', async ({ page }) => {
    await open(page, 1440);
    await page.evaluate(() => { /** @type {any} */ (window).__noReload = true; });
    const root = page.locator('#events-2026-11');
    await root.getByRole('checkbox', { name: ja['astro.kind.moon-phase'] }).uncheck();
    await expect(items(page, 'events-2026-11')).toHaveCount(8);
    await expect(root.locator('.mk-event-list__items > li[data-kind="moon-phase"]')).toHaveCount(0);
    await expect(root.locator('[role="status"]')).toHaveText(fill(ja, 'event-list.result-count', { count: 8 }));
    await root.getByRole('checkbox', { name: ja['astro.kind.moon-phase'] }).check();
    await expect(items(page, 'events-2026-11')).toHaveCount(12);
    expect(await page.evaluate(() => /** @type {any} */ (window).__noReload)).toBe(true);
  });

  test('narrowing the period changes the list', async ({ page }) => {
    await open(page, 1440);
    const root = page.locator('#events-2026-11');
    await root.getByLabel(ja['event-list.to']).fill('2026-11-15');
    await expect(items(page, 'events-2026-11')).toHaveCount(4);
    await root.getByLabel(ja['event-list.from']).fill('2026-11-10');
    await expect(items(page, 'events-2026-11')).toHaveCount(2);
    await expect(root.locator('[role="status"]')).toHaveText(fill(ja, 'event-list.result-count', { count: 2 }));
  });

  test('a filter without matches shows the empty state', async ({ page }) => {
    await open(page, 1440);
    const root = page.locator('#events-2026-11');
    await root.getByLabel(ja['event-list.from']).fill('2026-11-30');
    await expect(items(page, 'events-2026-11')).toHaveCount(0);
    await expect(root.locator('.mk-event-list__empty')).toHaveText(ja['empty.events']);
    await expect(root.locator('[role="status"]')).toHaveText(fill(ja, 'event-list.result-count', { count: 0 }));
  });

  test('scenario=empty shows the empty state', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440, '?scenario=empty');
    for (const id of ['events-2026-11', 'events-kinds']) {
      await expect(items(page, id)).toHaveCount(0);
      await expect(page.locator(`#${id} .mk-event-list__empty`)).toHaveText(ja['empty.events']);
    }
    expect(problems).toEqual([]);
  });

  test('scenario=fetch-error shows the error message', async ({ page }) => {
    await open(page, 1440, '?scenario=fetch-error');
    for (const id of ['events-2026-11', 'events-kinds']) {
      await expect(items(page, id)).toHaveCount(0);
      await expect(page.locator(`#${id} [role="alert"]`)).toHaveText(ja['error.fetch']);
      await expect(page.locator(`#${id} .mk-event-list__empty`)).toHaveCount(0);
    }
  });

  test('switching the scenario at run time updates the list', async ({ page }) => {
    await open(page, 1440);
    await expect(items(page, 'events-2026-11')).toHaveCount(12);
    await page.evaluate(() => window.MockState.update({ scenario: 'fetch-error' }));
    await expect(page.locator('#events-2026-11 [role="alert"]')).toHaveText(ja['error.fetch']);
    await page.evaluate(() => window.MockState.update({ scenario: 'default' }));
    await expect(items(page, 'events-2026-11')).toHaveCount(12);
  });
});

test.describe('language switch', () => {
  test('?lang=en: summary, rise/set and event list in English', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440, '?lang=en');
    await expect(summaryItem(page, 'summary-full-leap', 'lunar').locator('dd')).toHaveText(fill(en, 'lunar-month.date-leap', { month: 6, day: 1 }));
    await expect(summaryItem(page, 'summary-full-leap', 'moon').locator('dt')).toHaveText(en['almanac.moon']);
    await expect(summaryItem(page, 'summary-full-2027-03-21', 'holiday').locator('.mk-almanac-summary__provisional')).toHaveText(en['holiday.provisional']);
    await expect(page.locator('#riseset-2026-11-16 [data-item="moonset"] dd')).toHaveText(en['almanac.riseset-none']);
    const first = page.locator('#events-2026-11 .mk-event-list__items > li').first();
    await expect(first.locator('time')).toHaveText('Sun, Nov 1, 2026, 05:28');
    await expect(first.locator('.mk-event__kind')).toHaveText(en['astro.kind.moon-phase']);
    await expect(page.locator('#events-2026-11').getByRole('group', { name: en['event-list.kinds'] })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('switching language at run time keeps the filter state', async ({ page }) => {
    await open(page, 1440);
    const root = page.locator('#events-2026-11');
    await root.getByRole('checkbox', { name: ja['astro.kind.moon-phase'] }).uncheck();
    await expect(root.locator('.mk-event-list__items > li')).toHaveCount(8);
    await page.locator('mk-site-header').first().getByRole('button', { name: 'English' }).click();
    await expect(root.getByRole('checkbox', { name: en['astro.kind.moon-phase'] })).not.toBeChecked();
    await expect(root.locator('.mk-event-list__items > li')).toHaveCount(8);
    await expect(root.locator('[role="status"]')).toHaveText(fill(en, 'event-list.result-count', { count: 8 }));
  });
});

test.describe('layout', () => {
  for (const width of [360, 375, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await open(page, width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const fits = await page.locator('mk-almanac-summary, mk-rise-set:not(mk-location-panel mk-rise-set), mk-event-list').evaluateAll((els) => els.map((el) => {
        const r = el.getBoundingClientRect();
        return r.right <= document.documentElement.clientWidth + 0.5;
      }));
      // Task 6.4 added the full summary of 2026-11-20 (a day with events).
      expect(fits.length).toBe(13);
      expect(fits.every(Boolean)).toBe(true);
    });
  }
});
