// Task 5.2: the astronomical events list and star chart screens (3.4, 3.5, 4.4, 4.5, 5.1, 5.3, 5.5).
// - astro-events: h1, a lead sentence and mk-event-list (period / kind filters and the list of
//   every sample event); scenario empty shows the empty state, fetch-error the fetch error
//   (role="alert"), also when the scenario is switched at run time.
// - star-chart: mk-star-chart plus labelled date-time and place inputs filled with the fixed
//   sample (2026-11-16 20:00 JST, the sample place); a visible note says that changing them does
//   not redraw this mock chart.
// - both: decoration marked with data-decor, a valid heading hierarchy, no horizontal overflow
//   at 375 / 1440 px, and no console errors or warnings in wireframe / hifi x ja / en x guest / member.
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const load = (/** @type {string[]} */ ...files) => {
  const window = /** @type {Record<string, any>} */ ({});
  const ctx = vm.createContext({ window });
  for (const f of files) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  return window;
};
const w = load('data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
const sample = w.MockSample;

const urlOf = (/** @type {string} */ id, query = '') =>
  pathToFileURL(join(root, 'screens', `${id}.html`)).href + query;

/** @param {import('@playwright/test').Page} page */
const collectProblems = (page) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
};

/** Visible headings of <main> as [level, text]. @param {import('@playwright/test').Page} page */
const headingsOf = (page) => page.evaluate(() =>
  [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')]
    .filter((h) => /** @type {HTMLElement} */ (h).offsetParent !== null || h.getClientRects().length > 0)
    .map((h) => [Number(h.localName.slice(1)), (h.textContent ?? '').trim()]));

/** One h1 first, and no level is skipped going down. @param {[number, string][]} headings */
const expectValidHierarchy = (headings) => {
  expect(headings.length).toBeGreaterThan(1);
  expect(headings[0]?.[0]).toBe(1);
  expect(headings.filter(([level]) => level === 1)).toHaveLength(1);
  for (let i = 1; i < headings.length; i += 1) {
    const prev = /** @type {[number, string]} */ (headings[i - 1])[0];
    const level = /** @type {[number, string]} */ (headings[i])[0];
    expect(level, `heading ${headings[i]?.[1]} after h${prev}`).toBeLessThanOrEqual(prev + 1);
  }
};

const SCREENS = ['astro-events', 'star-chart'];

test.describe('task 5.2 screens: switching without console problems', () => {
  for (const id of SCREENS) {
    for (const stage of ['wireframe', 'hifi']) {
      for (const lang of ['ja', 'en']) {
        for (const auth of ['guest', 'member']) {
          test(`${id} ${stage} ${lang} ${auth}`, async ({ page }) => {
            const problems = collectProblems(page);
            await page.goto(urlOf(id, `?stage=${stage}&lang=${lang}&auth=${auth}`));
            await expect(page.locator('html')).toHaveAttribute('data-auth', auth);
            await expect(page.locator('main h2').first()).toBeVisible();
            await expect(page.locator('main')).not.toContainText('⟦');
            await expect(page.locator('main [data-missing-sample]')).toHaveCount(0);
            // no posting / commenting on these screens: no guest notice, no create-post entry point
            await expect(page.locator('main mk-guest-notice')).toHaveCount(0);
            await expect(page.locator('main a[href*="post-edit.html"]')).toHaveCount(0);
            // decoration is marked and hidden on the wireframe stage
            const decor = page.locator('main [data-decor]');
            expect(await decor.count()).toBeGreaterThan(0);
            const visibility = await decor.first().evaluate((el) => getComputedStyle(el).visibility);
            expect(visibility).toBe(stage === 'wireframe' ? 'hidden' : 'visible');
            for (const width of [375, 1440]) {
              await page.setViewportSize({ width, height: 900 });
              expectValidHierarchy(await headingsOf(page));
              const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
              expect(overflow).toBeLessThanOrEqual(0);
            }
            expect(problems).toEqual([]);
          });
        }
      }
    }
  }
});

test.describe('astro-events', () => {
  test('lead, period and kind filters, and every sample event by date and kind', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('astro-events', '?lang=ja'));
    await expect(page.locator('main h2 > [data-i18n]')).toHaveText([ja['screen.astro-events.list']]);
    await expect(page.locator('main [data-i18n="screen.astro-events.lead"]')).toHaveText(ja['screen.astro-events.lead']);

    const list = page.locator('main mk-event-list');
    await expect(list).toHaveCount(1);
    await expect(list.locator('fieldset legend')).toHaveText([ja['event-list.period'], ja['event-list.kinds']]);
    await expect(list.getByLabel(ja['event-list.from'])).toHaveValue('2026-11-01');
    await expect(list.getByLabel(ja['event-list.to'])).toHaveValue('2026-12-31');
    await expect(list.locator('input[type="checkbox"]:checked')).toHaveCount(await list.locator('input[type="checkbox"]').count());

    const events = list.locator('.mk-event');
    await expect(events).toHaveCount(sample.events.length);
    // planetary phenomena and the moon's phases, declination extremes and apsides (4.4)
    const kinds = new Set(await events.evaluateAll((els) => els.map((el) => el.getAttribute('data-kind'))));
    for (const kind of ['moon-phase', 'moon-declination', 'moon-apsis', 'planet-conjunction', 'planet-opposition', 'planet-elongation']) {
      expect(kinds.has(kind), kind).toBe(true);
    }
    await expect(events.first().locator('.mk-event__at')).toHaveText('2026年11月1日(日) 05:28');
    await expect(events.first().locator('.mk-event__kind')).toHaveText(ja['astro.kind.moon-phase']);
    await expect(list.locator('.mk-event-list__count')).toHaveText(ja['event-list.result-count'].replace('{count}', String(sample.events.length)));

    // the kind filter narrows the list (4.5)
    await list.getByLabel(ja['astro.kind.moon-phase']).uncheck();
    const phases = sample.events.filter((/** @type {any} */ e) => e.kind === 'moon-phase').length;
    await expect(events).toHaveCount(sample.events.length - phases);
    expect(problems).toEqual([]);
  });

  test('English copy', async ({ page }) => {
    await page.goto(urlOf('astro-events', '?lang=en'));
    await expect(page.locator('main h1')).toHaveText(en['screen.astro-events.title']);
    await expect(page.locator('main h2 > [data-i18n]')).toHaveText([en['screen.astro-events.list']]);
    await expect(page.locator('main [data-i18n="screen.astro-events.lead"]')).toHaveText(en['screen.astro-events.lead']);
    const list = page.locator('main mk-event-list');
    await expect(list.locator('fieldset legend')).toHaveText([en['event-list.period'], en['event-list.kinds']]);
    await expect(list.locator('.mk-event').first().locator('.mk-event__at')).toHaveText('Sun, Nov 1, 2026, 05:28');
    await expect(list.locator('.mk-event').first().locator('.mk-event__kind')).toHaveText(en['astro.kind.moon-phase']);
  });

  test('scenario=empty shows the empty state with the filters kept', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('astro-events', '?lang=ja&scenario=empty'));
    await expect(page.locator('html')).toHaveAttribute('data-scenario', 'empty');
    const list = page.locator('main mk-event-list');
    await expect(list.locator('.mk-event')).toHaveCount(0);
    await expect(list.locator('.mk-event-list__empty')).toHaveText(ja['empty.events']);
    await expect(list.locator('fieldset')).toHaveCount(2);
    expect(problems).toEqual([]);
  });

  test('scenario=fetch-error shows the fetch error as an alert', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('astro-events', '?lang=en&scenario=fetch-error'));
    await expect(page.locator('html')).toHaveAttribute('data-scenario', 'fetch-error');
    const list = page.locator('main mk-event-list');
    await expect(list.locator('.mk-event')).toHaveCount(0);
    await expect(list.getByRole('alert')).toHaveText(en['error.fetch']);
    expect(problems).toEqual([]);
  });

  test('switching the scenario and the language at run time updates the screen', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('astro-events', '?lang=ja'));
    const list = page.locator('main mk-event-list');
    await expect(list.locator('.mk-event')).toHaveCount(sample.events.length);
    await page.evaluate(() => window.MockState.update({ scenario: 'empty' }));
    await expect(list.locator('.mk-event-list__empty')).toHaveText(ja['empty.events']);
    await page.evaluate(() => window.MockState.update({ scenario: 'fetch-error', lang: 'en' }));
    await expect(list.getByRole('alert')).toHaveText(en['error.fetch']);
    await expect(page.locator('main h2 > [data-i18n]')).toHaveText([en['screen.astro-events.list']]);
    await page.evaluate(() => window.MockState.update({ scenario: 'default' }));
    await expect(list.locator('.mk-event')).toHaveCount(sample.events.length);
    expect(problems).toEqual([]);
  });
});

test.describe('star-chart', () => {
  const sampleDateTime = sample.starChart.observedAt.slice(0, 16); // 2026-11-16T20:00 (JST)

  test('date-time and place inputs with labels, the fixed-sample note and the chart', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('star-chart', '?lang=ja'));
    await expect(page.locator('main h2 > [data-i18n]')).toHaveText([ja['screen.star-chart.conditions'], ja['screen.star-chart.sky']]);

    const datetime = page.getByLabel(ja['screen.star-chart.datetime'], { exact: true });
    await expect(datetime).toHaveAttribute('type', 'datetime-local');
    await expect(datetime).toHaveValue(sampleDateTime);
    await expect(datetime).toHaveAccessibleDescription(ja['screen.star-chart.datetime-hint']);
    const place = page.getByLabel(ja['screen.star-chart.place'], { exact: true });
    await expect(place).toHaveValue(sample.starChart.placeLabel);
    await expect(place).toHaveAccessibleDescription(ja['screen.star-chart.place-hint']);

    const note = page.locator('main [data-i18n="screen.star-chart.fixed-sample"]');
    await expect(note).toBeVisible();
    await expect(note).toHaveText(ja['screen.star-chart.fixed-sample']);

    const chart = page.locator('main mk-star-chart');
    await expect(chart.locator('svg[role="img"]')).toHaveCount(1);
    await expect(chart.locator('.mk-star-chart__caption')).toContainText('2026年11月16日(月) 20:00');
    await expect(chart.locator('.mk-star-chart__caption')).toContainText(sample.starChart.placeLabel);

    // the inputs can be changed; this mock keeps showing the fixed sample (as the note says)
    await datetime.fill('2026-12-24T21:30');
    await place.fill('北海道 札幌市');
    await expect(datetime).toHaveValue('2026-12-24T21:30');
    await expect(place).toHaveValue('北海道 札幌市');
    await expect(chart.locator('.mk-star-chart__caption')).toContainText('2026年11月16日(月) 20:00');
    expect(problems).toEqual([]);
  });

  test('English labels, note and chart names', async ({ page }) => {
    await page.goto(urlOf('star-chart', '?lang=en'));
    await expect(page.locator('main h1')).toHaveText(en['screen.star-chart.title']);
    await expect(page.locator('main h2 > [data-i18n]')).toHaveText([en['screen.star-chart.conditions'], en['screen.star-chart.sky']]);
    await expect(page.getByLabel(en['screen.star-chart.datetime'], { exact: true })).toHaveValue(sampleDateTime);
    await expect(page.getByLabel(en['screen.star-chart.place'], { exact: true })).toHaveValue(sample.starChart.placeLabel);
    await expect(page.locator('main [data-i18n="screen.star-chart.fixed-sample"]')).toHaveText(en['screen.star-chart.fixed-sample']);
    const chart = page.locator('main mk-star-chart');
    await expect(chart.locator('.mk-star-chart__caption')).toContainText('Mon, Nov 16, 2026, 20:00');
    // body names follow the language (5.4)
    const bodyNames = await chart.locator('.mk-star-chart__body-label').allTextContents();
    expect(bodyNames.length).toBeGreaterThan(0);
    const enBodies = Object.entries(en).filter(([k]) => k.startsWith('astro.body.')).map(([, v]) => v);
    for (const name of bodyNames) expect(enBodies).toContain(name);
  });

  test('switching the language at run time keeps the edited input values', async ({ page }) => {
    await page.goto(urlOf('star-chart', '?lang=ja'));
    const datetime = page.locator('main input[type="datetime-local"]');
    await datetime.fill('2026-12-24T21:30');
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(page.getByLabel(en['screen.star-chart.datetime'], { exact: true })).toHaveValue('2026-12-24T21:30');
    await expect(page.locator('main mk-star-chart .mk-star-chart__caption')).toContainText('Mon, Nov 16, 2026, 20:00');
  });

  test('phone width: the chart and the inputs fit inside the screen (5.5)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(urlOf('star-chart', '?lang=en'));
    const box = await page.locator('main mk-star-chart svg').boundingBox();
    expect(box).not.toBeNull();
    expect(/** @type {{ x: number, width: number }} */ (box).x).toBeGreaterThanOrEqual(0);
    expect(/** @type {{ x: number, width: number }} */ (box).x + /** @type {{ width: number }} */ (box).width).toBeLessThanOrEqual(375);
    for (const input of await page.locator('main input').all()) {
      const b = await input.boundingBox();
      expect(b).not.toBeNull();
      expect(/** @type {{ x: number, width: number }} */ (b).x + /** @type {{ width: number }} */ (b).width).toBeLessThanOrEqual(375);
    }
  });
});
