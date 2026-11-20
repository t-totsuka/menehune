// Task 8.3: hi-fi decorations across the screens (Requirements 9.1, 9.2, 10.4, 13.2; design
// "StageStyles" and the [data-decor] convention, note 1.7).
//
// The decorations of the hi-fi stage:
//   - background stars: an absolutely positioned starfield (.mk-starfield, inline SVG) behind the
//     header (every screen, mk-site-header) and behind the top of the top page;
//   - moon-phase icons: inline SVG drawn from the moon age, over the phase symbol of the calendar
//     cells and the legend (the symbol stays for the wireframe), and next to the moon age of the
//     day detail's almanac;
//   - event-kind icons: one inline SVG per AstroEventKind before the kind's name in mk-event-list;
//   - headings in the Mincho (serif) stack.
// Every decoration is [data-decor] and aria-hidden, uses token colors only, and disappears in the
// wireframe stage without moving any element (the wireframe stage must not change). The heading
// typeface is the same in both stages: the font is a layout property, and the stages must lay out
// identically (wireframe.css rules, design StageStyles), so it is not hidden in the wireframe.
import { test, expect } from '@playwright/test';
import { screenPath, watchConsole, blockExternalRequests } from './helpers/e2e.mjs';
import { pageHorizontalOverflow } from './helpers/layout-checks.mjs';

const TARGETS = ['top', 'calendar-month', 'day-detail', 'astro-events', 'star-chart', 'post-detail'];
const SCHEMES = /** @type {const} */ (['light', 'dark']);
const EVENT_KINDS = ['moon-phase', 'moon-apsis', 'moon-declination', 'planet-conjunction',
  'planet-opposition', 'planet-elongation', 'close-approach'];

/** @typedef {import('@playwright/test').Page} Page */

/** @param {Page} page @param {string} id @param {Record<string, string>} [params] */
async function open(page, id, params = {}) {
  await page.goto(screenPath(id, params));
  await page.waitForLoadState('networkidle');
}

/** In the page: [data-decor] decorations of task 8.3 that break the decoration contract. */
function decorContractIssues() {
  /** @type {string[]} */
  const out = [];
  const nodes = document.querySelectorAll('.mk-starfield, .mk-phase-icon, .mk-event__icon, .mk-moon-icon');
  for (const el of nodes) {
    const name = `${el.tagName.toLowerCase()}.${String(el.getAttribute('class')).split(' ')[0]}`;
    if (!el.hasAttribute('data-decor')) out.push(`${name} without data-decor`);
    if (el.getAttribute('aria-hidden') !== 'true') out.push(`${name} not aria-hidden`);
    if (el.querySelector('a, button, input, [tabindex]')) out.push(`${name} holds a focusable element`);
  }
  return out;
}

/** @param {Page} page @param {string} selector */
const visibleCount = (page, selector) => page.evaluate((sel) => [...document.querySelectorAll(sel)]
  .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible').length, selector);

for (const scheme of SCHEMES) {
  test.describe(`hifi decorations (${scheme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
    });

    for (const id of TARGETS) {
      test(`${id}: header stars and serif headings in hifi, nothing painted in wireframe`, async ({ page }) => {
        const issues = watchConsole(page);
        const external = await blockExternalRequests(page);
        await open(page, id);
        const stars = page.locator('.mk-header .mk-starfield');
        await expect(stars).toHaveCount(1);
        await expect(stars).toBeVisible();
        expect(await stars.locator('circle, path').count()).toBeGreaterThanOrEqual(8);
        expect(await page.evaluate(decorContractIssues)).toEqual([]);

        // Star color is the decoration token of the theme.
        const starPaint = await page.evaluate(() => {
          const star = document.querySelector('.mk-header .mk-starfield circle');
          const probe = document.createElement('span');
          probe.style.color = 'var(--color-decor-star)';
          document.body.append(probe);
          const token = getComputedStyle(probe).color;
          probe.remove();
          return { fill: star ? getComputedStyle(star).fill : 'none', token };
        });
        expect(starPaint.token).not.toBe('');
        expect(starPaint.fill).toBe(starPaint.token);

        // Headings: the Mincho stack in hifi.
        const fonts = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2')]
          .map((h) => getComputedStyle(h).fontFamily));
        expect(fonts.length).toBeGreaterThan(0);
        for (const f of fonts) expect(f).toMatch(/^"Hiragino Mincho ProN".*serif$/);

        // Wireframe: the decorations keep their box but paint nothing; headings keep the same font
        // (same layout); every element sits where it was in hifi.
        const boxes = () => page.evaluate(() => [...document.querySelectorAll('body *')]
          .filter((el) => !el.closest('[data-review-shell], script'))
          .map((el) => { const r = el.getBoundingClientRect(); return `${el.tagName} ${r.x} ${r.y} ${r.width} ${r.height}`; }));
        const hifiBoxes = await boxes();
        await page.evaluate(() => window.MockState.update({ stage: 'wireframe' }));
        await expect(page.locator('html')).toHaveAttribute('data-stage', 'wireframe');
        expect(await visibleCount(page, '.mk-starfield, .mk-starfield *, .mk-phase-icon, .mk-phase-icon *, .mk-event__icon, .mk-event__icon *, .mk-moon-icon, .mk-moon-icon *')).toBe(0);
        const wireFonts = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2')]
          .map((h) => getComputedStyle(h).fontFamily));
        expect(wireFonts).toEqual(fonts);
        expect(await boxes()).toEqual(hifiBoxes);

        expect(external).toEqual([]);
        expect(issues).toEqual([]);
      });
    }

    test('top: a starfield behind the top of the page', async ({ page }) => {
      await open(page, 'top');
      const field = page.locator('main .mk-starfield');
      await expect(field).toHaveCount(1);
      await expect(field).toBeVisible();
      expect(await field.locator('circle, path').count()).toBeGreaterThanOrEqual(8);
      // Behind the content: it never takes pointer events and never widens the page.
      expect(await field.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    });

    for (const id of ['top', 'astro-events']) {
      test(`${id}: every event row has the icon of its kind, in the tone color`, async ({ page }) => {
        await open(page, id);
        const rows = await page.evaluate(() => [...document.querySelectorAll('mk-event-list .mk-event')].map((li) => {
          const icon = li.querySelector('.mk-event__kind .mk-event__icon');
          const shape = icon ? getComputedStyle(icon.querySelector('circle, path, ellipse, line') ?? icon) : null;
          const probe = document.createElement('span');
          probe.style.color = li.getAttribute('data-tone') === 'moon' ? 'var(--color-event-moon)' : 'var(--color-event-planet)';
          document.body.append(probe);
          const tone = getComputedStyle(probe).color;
          probe.remove();
          return {
            kind: li.getAttribute('data-kind'),
            icon: icon?.getAttribute('data-icon') ?? null,
            text: li.querySelector('.mk-event__kind')?.textContent?.trim() ?? '',
            color: icon ? getComputedStyle(icon).color : '',
            tone,
            painted: shape ? (shape.stroke !== 'none' || shape.fill !== 'none') : false,
          };
        }));
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
          expect(r.icon, `icon of ${r.kind}`).toBe(r.kind);
          expect(r.text, 'the kind is still written out (13.3)').not.toBe('');
          expect(r.color).toBe(r.tone);
          expect(r.painted).toBe(true);
        }
        expect(await page.evaluate(decorContractIssues)).toEqual([]);
      });
    }

    test('event-kind icons: one distinct drawing per kind (component gallery)', async ({ page }) => {
      await page.goto('components.html');
      const drawings = await page.evaluate((kinds) => {
        /** @type {Record<string, string>} */
        const out = {};
        for (const kind of kinds) {
          const icon = document.querySelector(`.mk-event__icon[data-icon="${kind}"]`);
          out[kind] = icon ? icon.innerHTML : '';
        }
        return out;
      }, EVENT_KINDS);
      for (const kind of EVENT_KINDS) expect(drawings[kind], kind).not.toBe('');
      expect(new Set(Object.values(drawings)).size).toBe(EVENT_KINDS.length);
    });

    test('calendar-month (375px): phase icons over the symbols of the cells and the legend', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 900 });
      await open(page, 'calendar-month');
      const phases = await page.evaluate(() => [...document.querySelectorAll('.mk-calendar__compact .mk-day-cell__phase')]
        .map((p) => {
          const glyph = p.querySelector('.mk-day-cell__phase-glyph');
          const icon = p.querySelector('.mk-phase-icon');
          return {
            text: p.textContent?.trim() ?? '',
            glyphColor: glyph ? getComputedStyle(glyph).color : 'missing',
            icon: icon !== null && icon.getClientRects().length > 0,
            phase: icon?.getAttribute('data-phase') ?? '',
            lit: icon ? getComputedStyle(icon.querySelector('.mk-phase-icon__disc') ?? icon).fill : '',
          };
        }));
      expect(phases.length).toBeGreaterThanOrEqual(8); // 4 cells + 4 legend items
      for (const p of phases) {
        expect(['●', '◐', '○', '◑']).toContain(p.text); // the symbol stays in the DOM
        expect(p.glyphColor).toBe('rgba(0, 0, 0, 0)'); // hifi: the icon replaces it visually
        expect(p.icon).toBe(true);
      }
      // Legend: new moon is a dark disc, full moon a lit one (the 8.2 moon figure colors).
      const legend = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.mk-calendar__legend .mk-phase-icon')]
        .map((svg) => [svg.getAttribute('data-phase'), svg.querySelector('.mk-phase-icon__lit') !== null])));
      expect(legend).toEqual({ 'new-moon': false, 'first-quarter': true, 'full-moon': true, 'last-quarter': true });
      expect(await page.evaluate(decorContractIssues)).toEqual([]);

      // Compact cells: the cell around the date button is painted like the button in hifi.
      const tones = await page.evaluate(() => {
        const td = document.querySelector('.mk-calendar__grid--compact td:not(.mk-calendar__blank)');
        const btn = td?.querySelector('.mk-calendar__day');
        return td && btn ? [getComputedStyle(td).backgroundColor, getComputedStyle(btn).backgroundColor] : [];
      });
      expect(tones.length).toBe(2);
      expect(tones[0]).toBe(tones[1]);

      // Wireframe: the symbols are visible again (gray), the icons are hidden.
      await page.evaluate(() => window.MockState.update({ stage: 'wireframe' }));
      const wire = await page.evaluate(() => [...document.querySelectorAll('.mk-calendar__compact .mk-day-cell__phase-glyph')]
        .map((g) => getComputedStyle(g).color));
      for (const c of wire) expect(c).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('day-detail: a moon icon from the moon age next to the age (no named phase that day)', async ({ page }) => {
      await open(page, 'day-detail');
      const icon = page.locator('mk-almanac-summary [data-item="moon"] .mk-moon-icon');
      await expect(icon).toHaveCount(1);
      await expect(icon).toBeVisible();
      expect(await page.evaluate(decorContractIssues)).toEqual([]);
      // A named phase day uses the phase icon over its symbol instead.
      await open(page, 'day-detail', { date: '2026-11-17' });
      await expect(page.locator('mk-almanac-summary [data-item="moon"] .mk-moon-icon')).toHaveCount(0);
      await expect(page.locator('mk-almanac-summary [data-item="moon"] .mk-phase-icon')).toHaveCount(1);
    });
  });
}

for (const lang of ['ja', 'en']) {
  test(`375px (${lang}): no horizontal scroll on the decorated screens`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    for (const id of TARGETS) {
      await open(page, id, { lang });
      expect(await page.evaluate(pageHorizontalOverflow), id).toBe(0);
    }
  });
}
