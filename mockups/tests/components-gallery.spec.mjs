// Task 6.4: the component gallery (components.html) shows every mk-* part with its main
// attribute variants and states on one page (2.4).
// - every element defined with customElements.define in assets/js/components appears in <main>,
//   is upgraded, and has a row in the overview table that links to its section
// - key variants: mk-almanac-summary full / brief, mk-precision-picker for each precision,
//   mk-map-sample for each precision, mk-status-badge for each status, mk-guest-notice variants,
//   compact mk-day-cell / mk-post-card, mk-rise-set by date / post, mk-event-list by period / kinds
// - the phone-width samples (header, month calendar, comment tree) show their < 600px layout
//   even on a PC-width page
// - the scenario-following location example covers every ScenarioId exactly once
// - no console problems, no horizontal overflow at 375px
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const catalogUrl = pathToFileURL(join(root, 'components.html')).href;

/** Element names defined by the component scripts (static source scan). */
const componentDir = join(root, 'assets/js/components');
const DEFINED = readdirSync(componentDir)
  .filter((f) => f.endsWith('.js'))
  .flatMap((f) => [...readFileSync(join(componentDir, f), 'utf8').matchAll(/customElements\.define\('(mk-[a-z-]+)'/g)].map((m) => m[1]))
  .sort();

/** ScenarioIds as listed in mock-state.js. */
const SCENARIOS = (() => {
  const src = readFileSync(join(root, 'assets/js/mock-state.js'), 'utf8');
  const block = /const SCENARIOS = \[([\s\S]*?)\];/.exec(src);
  return block ? [...block[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]) : [];
})();

const PRECISIONS = ['exact', 'fuzzed-1km', 'municipality', 'prefecture', 'country'];

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

test('the source scan finds the component set', () => {
  expect(DEFINED.length).toBeGreaterThanOrEqual(19);
  expect(SCENARIOS.length).toBe(13);
});

test('every defined mk-* element appears in <main>, upgraded, with an overview row linking to its section', async ({ page }) => {
  const problems = collectProblems(page);
  await open(page, 1440);
  const defined = await page.evaluate((names) => names.filter((n) => customElements.get(n) !== undefined), DEFINED);
  expect(defined).toEqual(DEFINED);
  for (const name of DEFINED) {
    expect(await page.locator(`main ${name}`).count(), name).toBeGreaterThan(0);
  }
  // No mk-* tag in the page is left undefined (typo or missing script).
  expect(await page.evaluate(() => [...document.querySelectorAll('main *')]
    .filter((el) => el.localName.startsWith('mk-') && !customElements.get(el.localName)).map((el) => el.localName))).toEqual([]);

  const table = page.locator('#gallery-overview table');
  await expect(table).toHaveCount(1);
  await expect(table.locator('tbody > tr')).toHaveCount(DEFINED.length);
  for (const name of DEFINED) {
    const row = table.locator(`tbody > tr[data-element="${name}"]`);
    await expect(row, name).toHaveCount(1);
    const link = row.locator('a[href^="#"]').first();
    const target = String(await link.getAttribute('href')).slice(1);
    const section = page.locator(`[id="${target}"]`);
    await expect(section, `${name} -> #${target}`).toHaveCount(1);
    // The linked heading's section (the heading itself or its enclosing section) holds the element.
    const holds = await section.evaluate((el, n) => {
      const scope = el.closest('section') ?? el;
      return scope.querySelector(n) !== null;
    }, name);
    expect(holds, `${name} section holds the element`).toBe(true);
  }
  expect(problems).toEqual([]);
});

test('the table of contents links to every top-level section', async ({ page }) => {
  await open(page, 1440);
  const toc = page.getByRole('navigation', { name: '目次' });
  await expect(toc).toHaveCount(1);
  const ids = await page.locator('main > section[aria-labelledby]').evaluateAll((els) => els.map((s) => s.getAttribute('aria-labelledby')));
  const hrefs = await toc.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual(ids.map((id) => `#${id}`));
});

test('the page no longer says it is waiting for later tasks', async ({ page }) => {
  await open(page, 1440);
  await expect(page.locator('main > header')).not.toContainText('後続のタスク');
});

test.describe('main variants', () => {
  test('mk-almanac-summary: full (with events) and brief', async ({ page }) => {
    await open(page, 1440);
    expect(await page.locator('main mk-almanac-summary[variant="full"]').count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator('main mk-almanac-summary[variant="brief"]').count()).toBeGreaterThanOrEqual(2);
    // The full summary of a day with astronomical events lists them.
    await expect(page.locator('#summary-full-2026-11-20 [data-item="events"] li').first()).toBeVisible();
  });

  test('mk-precision-picker: none selected and each precision selected', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator('#precision-default input[type="radio"]:checked')).toHaveCount(0);
    // The collapsed sample (task 8.1, `collapsed`) is checked in screens-post-edit-review.spec.
    for (const p of PRECISIONS) {
      const picker = page.locator(`main mk-precision-picker[value="${p}"]:not([collapsed])`);
      await expect(picker, p).toHaveCount(1);
      await expect(picker.locator('input[type="radio"]:checked')).toHaveValue(p);
    }
  });

  test('attribute values: map precisions, badge statuses, notice variants, compact forms, rise / set and event list', async ({ page }) => {
    await open(page, 1440);
    for (const p of PRECISIONS) await expect(page.locator(`main mk-map-sample[precision="${p}"]`).first(), p).toBeVisible();
    for (const s of ['public', 'members-only', 'hidden', 'deleted']) await expect(page.locator(`main mk-status-badge[status="${s}"]`).first(), s).toBeVisible();
    await expect(page.locator('main mk-guest-notice:not([variant]):not([band])')).toHaveCount(1);
    await expect(page.locator('main mk-guest-notice[band]')).toHaveCount(1);
    await expect(page.locator('main mk-guest-notice[band]').getByRole('region', { name: 'ログインの案内' })).toHaveCount(1);
    await expect(page.locator('main mk-guest-notice[variant="private-post"]')).toHaveCount(1);
    await expect(page.locator('main mk-day-cell[compact]')).not.toHaveCount(0);
    await expect(page.locator('main mk-month-calendar[week-start="mon"][nav]')).toHaveCount(1);
    await expect(page.locator('main mk-post-card[variant="compact"]')).not.toHaveCount(0);
    await expect(page.locator('main mk-rise-set[date]')).not.toHaveCount(0);
    await expect(page.locator('main mk-rise-set[post-id]')).not.toHaveCount(0);
    await expect(page.locator('main mk-event-list[from][to]')).not.toHaveCount(0);
    await expect(page.locator('main mk-event-list[kinds]')).not.toHaveCount(0);
    await expect(page.locator('main mk-event-list[mark-past]')).toHaveCount(1);
    await expect(page.locator('main mk-event-list[relative-days]')).toHaveCount(1);
    await expect(page.locator('main mk-site-header[current]')).not.toHaveCount(0);
    await expect(page.locator('main mk-star-chart[sample]')).not.toHaveCount(0);
  });

  test('scenario and auth states are reachable from the page', async ({ page }) => {
    await open(page, 1440);
    for (const q of ['?scenario=empty', '?scenario=fetch-error', '?scenario=weather-failed', '?scenario=no-location', '?auth=guest', '?auth=member', '?auth=admin']) {
      await expect(page.locator(`section[aria-labelledby="sec-gallery-states"] a[href="${q}"]`), q).toHaveCount(1);
    }
  });

  test('fetch-error scenario: the event lists show the error, the location example follows', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440, '?scenario=fetch-error');
    await expect(page.locator('#events-2026-11 [role="alert"]')).toBeVisible();
    await expect(page.locator('#scenario-location-default')).toBeVisible();
    expect(problems).toEqual([]);
  });
});

test.describe('phone-width samples on a PC-width page', () => {
  test('month calendar: compact grid and summary, no full grid', async ({ page }) => {
    await open(page, 1440);
    const narrow = page.locator('[data-gallery-width="narrow"]');
    const cal = narrow.locator('mk-month-calendar');
    await expect(cal).toHaveCount(1);
    await expect(cal.locator('[data-layout="full"]')).toBeHidden();
    await expect(cal.locator('[data-layout="compact"]')).toBeVisible();
    await expect(cal.locator('.mk-calendar__summary')).toBeVisible();
    // The PC samples keep the full grid.
    await expect(page.locator('#cal-2026-11 [data-layout="full"]')).toBeVisible();
  });

  test('site header: the menu collapses behind the toggle', async ({ page }) => {
    await open(page, 1440);
    const header = page.locator('[data-gallery-width="narrow"] mk-site-header');
    await expect(header).toHaveCount(1);
    const toggle = header.locator('.mk-header__toggle');
    await expect(toggle).toBeVisible();
    await expect(header.locator('.mk-header__menu')).toBeHidden();
    await toggle.click();
    await expect(header.locator('.mk-header__menu')).toBeVisible();
    // The PC samples keep the open menu without the toggle.
    await expect(page.locator('#header-default .mk-header__toggle')).toBeHidden();
  });

  test('comment tree: levels beyond 3 are flat and show the reply-to label', async ({ page }) => {
    await open(page, 1440);
    const tree = page.locator('[data-gallery-width="narrow"] mk-comment-tree');
    await expect(tree).toHaveCount(1);
    await expect(tree.locator('.mk-comment__reply-to[data-scope="phone"]').first()).toBeVisible();
    await expect(page.locator('#comments-p-120 .mk-comment__reply-to[data-scope="phone"]').first()).toBeHidden();
  });
});

test('the scenario-following example lists every ScenarioId exactly once', async ({ page }) => {
  await open(page, 1440);
  const lists = await page.locator('#sec-location-scenario ~ [data-when-scenario]').evaluateAll((els) => els.flatMap((el) => String(el.getAttribute('data-when-scenario')).split(/\s+/)));
  expect([...lists].sort()).toEqual([...SCENARIOS].sort());
});

test('no horizontal overflow at 375px and no console problems', async ({ page }) => {
  const problems = collectProblems(page);
  await open(page, 375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(problems).toEqual([]);
});
