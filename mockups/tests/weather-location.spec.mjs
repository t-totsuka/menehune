// Task 4.7: mk-weather and mk-location-panel (7.2, 7.3, 7.4, 7.5, 7.6).
// - mk-weather (`post-id`): condition, temperature (°C), humidity (%), wind speed (m/s) and the
//   observation time (datetime format, <time datetime>). A post with location but no weather shows
//   weather.unavailable as role="alert" (same as mk-event-list's fetch error). A post without
//   location renders nothing. Units are the same symbols in both languages.
// - mk-location-panel (`post-id`): a section with a heading that groups the region name and map
//   (mk-map-sample with the post's precision and regionLabel), the rise / set times (mk-rise-set
//   post-id) and the weather (mk-weather post-id). A post without location renders nothing.
// - Catalog: the scenario examples follow postDetailScenarios (default p-101, no-location p-106,
//   weather-failed p-107) through data-when-scenario.
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
const w = load('data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
/** @type {SamplePost[]} */
const posts = w.MockSample.posts;
/** @type {Record<string, string>} */
const scenarios = w.MockSample.postDetailScenarios;

/** @param {string} id */
const post = (id) => /** @type {SamplePost} */ (posts.find((p) => p.id === id));
/** @param {string} template @param {Record<string, string>} args */
const fill = (template, args) => template.replace(/\{(\w+)\}/g, (_, name) => args[name]);

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

test.describe('mk-weather', () => {
  test('condition, temperature, humidity, wind and observation time (ja)', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440);
    const weather = /** @type {WeatherSnapshot} */ (post('p-101').weather);
    const el = page.locator('#weather-p-101');
    await expect(el.locator('.mk-weather__condition')).toHaveText(ja[weather.conditionKey]);
    await expect(el.locator('[data-item="temperature"]')).toHaveText(fill(ja['weather.temperature'], { value: '11.8' }));
    await expect(el.locator('[data-item="humidity"]')).toHaveText(fill(ja['weather.humidity'], { value: '58' }));
    await expect(el.locator('[data-item="wind"]')).toHaveText(fill(ja['weather.wind'], { value: '2.1' }));
    const time = el.locator('time');
    await expect(time).toHaveAttribute('datetime', weather.observedAt);
    await expect(time).toHaveText(fill(ja['weather.observed-at'], { time: '2026年11月16日(月) 18:30' }));
    await expect(el.locator('[role="alert"]')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('follows the language; units stay the same symbols', async ({ page }) => {
    await open(page, 1440, '?lang=en');
    const el = page.locator('#weather-p-101');
    await expect(el.locator('.mk-weather__condition')).toHaveText(en['weather.condition.clear']);
    await expect(el.locator('[data-item="temperature"]')).toHaveText(fill(en['weather.temperature'], { value: '11.8' }));
    await expect(el.locator('time')).toHaveText(fill(en['weather.observed-at'], { time: 'Mon, Nov 16, 2026, 18:30' }));
    for (const [key, unit] of [['weather.temperature', '{value}°C'], ['weather.humidity', '{value}%'], ['weather.wind', '{value} m/s']]) {
      expect(ja[key].endsWith(unit)).toBe(true);
      expect(en[key].endsWith(unit)).toBe(true);
    }
  });

  test('wind with a whole number keeps one decimal place', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator('#weather-p-105 [data-item="wind"]')).toHaveText(fill(ja['weather.wind'], { value: '4.0' }));
  });

  test('a post with location but no weather shows the failure message as an alert', async ({ page }) => {
    await open(page, 1440);
    const el = page.locator('#weather-p-107');
    const alert = el.getByRole('alert');
    await expect(alert).toHaveText(ja['weather.unavailable']);
    await expect(el.locator('[data-item]')).toHaveCount(0);
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(alert).toHaveText(en['weather.unavailable']);
  });

  test('a post without location renders nothing; an unknown post shows missing-sample', async ({ page }) => {
    await open(page, 1440);
    expect(await page.locator('#weather-p-106').evaluate((el) => el.childElementCount)).toBe(0);
    await expect(page.locator('#weather-missing [data-missing-sample="p-999"]')).toHaveCount(1);
  });
});

test.describe('mk-location-panel', () => {
  test('groups the region and map, rise / set and weather under a heading', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440);
    const location = /** @type {PostLocation} */ (post('p-101').location);
    const panel = page.locator('#location-panel-p-101');
    const section = panel.getByRole('region', { name: ja['location.panel.title'] });
    await expect(section).toHaveCount(1);
    await expect(section.getByRole('heading', { name: ja['location.panel.title'], exact: true })).toHaveCount(1);
    const map = panel.locator('mk-map-sample');
    await expect(map).toHaveAttribute('precision', location.precision);
    await expect(map).toHaveAttribute('region', location.regionLabel);
    await expect(map.locator('.mk-map__caption')).toHaveText(fill(ja['map.caption'], {
      region: location.regionLabel, precision: ja[`location.precision.${location.precision}`],
    }));
    await expect(panel.getByRole('heading', { name: ja['location.panel.rise-set'] })).toHaveCount(1);
    await expect(panel.locator('mk-rise-set')).toHaveAttribute('post-id', 'p-101');
    await expect(panel.locator('mk-rise-set time').first()).toHaveAttribute('datetime', /** @type {string} */ (location.riseSet.sunrise));
    await expect(panel.getByRole('heading', { name: ja['weather.label'] })).toHaveCount(1);
    await expect(panel.locator('mk-weather')).toHaveAttribute('post-id', 'p-101');
    await expect(panel.locator('mk-weather .mk-weather__condition')).toHaveText(ja['weather.condition.clear']);
    expect(problems).toEqual([]);
  });

  test('region and headings follow the language; the region name stays Japanese', async ({ page }) => {
    await open(page, 1440, '?lang=en');
    const panel = page.locator('#location-panel-p-101');
    await expect(panel.getByRole('heading', { name: en['location.panel.title'], exact: true })).toHaveCount(1);
    await expect(panel.locator('.mk-map__caption')).toHaveText(fill(en['map.caption'], {
      region: '東京都 武蔵野市', precision: en['location.precision.municipality'],
    }));
  });

  test('weather failure: map and rise / set stay, the weather shows the failure message', async ({ page }) => {
    await open(page, 1440);
    const panel = page.locator('#location-panel-p-107');
    await expect(panel.locator('mk-map-sample svg')).toHaveCount(1);
    await expect(panel.locator('mk-rise-set dl')).toHaveCount(1);
    await expect(panel.locator('mk-weather').getByRole('alert')).toHaveText(ja['weather.unavailable']);
  });

  test('a post without location shows no panel; an unknown post shows missing-sample', async ({ page }) => {
    await open(page, 1440);
    const panel = page.locator('#location-panel-p-106');
    expect(await panel.evaluate((el) => el.childElementCount)).toBe(0);
    await expect(panel.locator('mk-map-sample, mk-rise-set, mk-weather')).toHaveCount(0);
    await expect(page.locator('#location-panel-missing [data-missing-sample="p-999"]')).toHaveCount(1);
  });

  test('catalog scenario examples follow postDetailScenarios', async ({ page }) => {
    expect(scenarios['default']).toBe('p-101');
    expect(post(scenarios['no-location']).location).toBeUndefined();
    expect(post(scenarios['weather-failed']).location).toBeDefined();
    expect(post(scenarios['weather-failed']).weather).toBeUndefined();
    await open(page, 1440);
    for (const id of ['default', 'no-location', 'weather-failed']) {
      await expect(page.locator(`#scenario-location-${id} mk-location-panel`)).toHaveAttribute('post-id', scenarios[id]);
    }
  });

  test('switching the scenario to weather-failed and no-location changes the display', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440);
    const visiblePanels = page.locator('[id^="scenario-location-"]:visible');
    await expect(visiblePanels).toHaveCount(1);
    await expect(page.locator('#scenario-location-default')).toBeVisible();
    await expect(page.locator('#scenario-location-default .mk-weather__condition')).toBeVisible();

    await page.evaluate(() => window.MockState.update({ scenario: 'weather-failed' }));
    await expect(page.locator('#scenario-location-default')).toBeHidden();
    await expect(page.locator('#scenario-location-weather-failed')).toBeVisible();
    await expect(page.locator('#scenario-location-weather-failed').getByRole('alert')).toHaveText(ja['weather.unavailable']);
    await expect(page.locator('#scenario-location-weather-failed mk-map-sample svg')).toBeVisible();

    await page.evaluate(() => window.MockState.update({ scenario: 'no-location' }));
    await expect(page.locator('#scenario-location-weather-failed')).toBeHidden();
    await expect(page.locator('#scenario-location-no-location')).toBeVisible();
    await expect(page.locator('#scenario-location-no-location mk-location-panel section')).toHaveCount(0);
    await expect(page.locator('#scenario-location-no-location mk-map-sample, #scenario-location-no-location mk-weather')).toHaveCount(0);

    await page.evaluate(() => window.MockState.update({ scenario: 'default' }));
    await expect(page.locator('#scenario-location-default')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('?scenario=weather-failed opens with the failure example', async ({ page }) => {
    await open(page, 1440, '?scenario=weather-failed');
    await expect(page.locator('#scenario-location-weather-failed').getByRole('alert')).toBeVisible();
    await expect(page.locator('#scenario-location-default')).toBeHidden();
  });

  for (const width of [375, 1440]) {
    test(`${width}px: the panel fits and the page does not scroll sideways`, async ({ page }) => {
      await open(page, width);
      const box = await page.locator('#location-panel-p-101 .mk-location-panel').boundingBox();
      expect(box).not.toBeNull();
      const b = /** @type {{ x: number, width: number }} */ (box);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(width);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('wireframe: the map placeholder keeps the same box', async ({ page }) => {
    await open(page, 1440, '?stage=hifi');
    const figure = page.locator('#location-panel-p-101 [data-figure]');
    await expect(figure).toHaveCount(1);
    const hifiBox = await figure.boundingBox();
    await open(page, 1440, '?stage=wireframe');
    expect(await figure.boundingBox()).toEqual(hifiBox);
  });
});
