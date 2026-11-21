// Task 6.7: the accessibility page (a11y.html) shows the alt-text policy with examples for the star
// chart and the map, keyboard focus samples for both themes, and the places that do not rely on
// color alone (13.3, 13.4, 13.5).
// - the alt-text examples are read from the real components on the page (the role="img" svg's
//   aria-label of mk-star-chart and of mk-map-sample for every precision), so they stay in sync;
//   they follow the language of the page; the star chart lists the names that the drawing omits
//   but the alt text keeps (4.4)
// - the focus samples: one light and one dark panel whatever the page theme; each has an always
//   visible sample and real controls whose keyboard focus draws an outline in that theme's
//   --color-focus with --border-width-focus
// - the non-color list covers the required places, names components that exist, and shows the
//   real status badges with symbol and text
// - no console problems, no horizontal overflow at 375px
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pageUrl = pathToFileURL(join(root, 'a11y.html')).href;
const PRECISIONS = ['exact', 'fuzzed-1km', 'municipality', 'prefecture', 'country'];
const STATUSES = ['public', 'members-only', 'hidden', 'deleted'];

/** @param {import('@playwright/test').Page} page */
const collectProblems = (page) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
};

/** Alt text of the star chart and of every map, as rendered by the components and as shown in the examples. */
const readAlt = (/** @type {import('@playwright/test').Page} */ page) => page.evaluate((precisions) => {
  const text = (/** @type {Element | null} */ el) => (el?.textContent || '').trim();
  const chart = document.querySelector('main mk-star-chart svg[role="img"]');
  return {
    chart: { label: chart?.getAttribute('aria-label') || '', shown: text(document.querySelector('[data-alt-example="star-chart"]')) },
    maps: precisions.map((p) => ({
      precision: p,
      label: document.querySelector(`main mk-map-sample[precision="${p}"] svg[role="img"]`)?.getAttribute('aria-label') || '',
      shown: text(document.querySelector(`[data-alt-example="map-${p}"]`)),
    })),
  };
}, PRECISIONS);

test('the alt-text examples are the aria-labels of the real star chart and maps, in the page language', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto(pageUrl);
  await expect(page.locator('main [data-alt-policy] li').first()).toBeVisible();

  const ja = await readAlt(page);
  expect(ja.chart.label).toContain('星座：');
  expect(ja.chart.shown).toBe(ja.chart.label);
  for (const m of ja.maps) {
    expect(m.label, m.precision).not.toBe('');
    expect(m.shown, m.precision).toBe(m.label);
  }
  // Each precision gets the sentence of its dictionary template with the sample region.
  const expected = await page.evaluate((precisions) => precisions.map((p) => {
    const post = window.MockSample.posts.find((x) => x.location && x.location.precision === p);
    return window.MockI18n.t(/** @type {MessageKey} */ (`map.describe.${p}`), { region: post?.location?.regionLabel ?? '' });
  }), PRECISIONS);
  expect(ja.maps.map((m) => m.label)).toEqual(expected);

  // Names omitted from the drawing but kept in the alt text (4.4): Orion etc. in Japanese.
  const omitted = await page.locator('[data-alt-omitted] li').allTextContents();
  expect(omitted.length).toBeGreaterThan(0);
  expect(omitted).toContain('オリオン座');
  const drawn = await page.locator('main mk-star-chart svg text').allTextContents();
  for (const name of omitted) {
    expect(ja.chart.label, name).toContain(name);
    expect(drawn, name).not.toContain(name);
  }

  // Switching the language re-renders the components and the examples follow.
  await page.evaluate(() => window.MockState.update({ lang: 'en' }));
  const en = await readAlt(page);
  expect(en.chart.label).not.toBe(ja.chart.label);
  expect(en.chart.label).toMatch(/[A-Za-z]/);
  expect(en.chart.shown).toBe(en.chart.label);
  for (const m of en.maps) expect(m.shown, m.precision).toBe(m.label);
  expect(await page.locator('main h1').textContent()).toBe('アクセシビリティの方針');
  await page.evaluate(() => window.MockState.update({ lang: 'ja' }));
  expect(problems).toEqual([]);
});

for (const pageTheme of ['light', 'dark']) {
  test(`focus samples show the light and dark focus rings side by side (page theme ${pageTheme})`, async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(`${pageUrl}?theme=${pageTheme}&stage=hifi`);
    const tokens = await page.evaluate(() => {
      const html = document.documentElement;
      const saved = html.getAttribute('data-theme');
      /** @param {string} theme */
      const read = (theme) => {
        html.setAttribute('data-theme', theme);
        const cs = getComputedStyle(html);
        return { focus: cs.getPropertyValue('--color-focus').trim(), width: cs.getPropertyValue('--border-width-focus').trim(), bg: cs.getPropertyValue('--color-bg').trim() };
      };
      const values = { light: read('light'), dark: read('dark') };
      if (saved === null) html.removeAttribute('data-theme'); else html.setAttribute('data-theme', saved);
      return values;
    });
    expect(tokens.light.focus).not.toBe(tokens.dark.focus);
    await expect(page.locator('html')).toHaveAttribute('data-theme', pageTheme);

    for (const theme of ['light', 'dark']) {
      const panel = page.locator(`main [data-focus-panel="${theme}"]`);
      await expect(panel).toHaveCount(1);
      /** @param {import('@playwright/test').Locator} loc */
      const style = (loc) => loc.evaluate((el) => {
        const cs = getComputedStyle(el);
        const probe = document.createElement('span');
        probe.style.color = cs.getPropertyValue('--color-focus');
        el.append(probe);
        const focusColor = getComputedStyle(probe).color;
        probe.remove();
        return { outlineWidth: parseFloat(cs.outlineWidth), outlineStyle: cs.outlineStyle, outlineColor: cs.outlineColor, focusColor };
      });
      const bg = await panel.evaluate((el) => {
        const probe = document.createElement('span');
        probe.style.color = getComputedStyle(el).getPropertyValue('--color-bg');
        el.append(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return { panel: getComputedStyle(el).backgroundColor, token: c };
      });
      expect(bg.panel, `${theme} panel background`).toBe(bg.token);
      const themeFocus = await page.evaluate((v) => { const p = document.createElement('span'); p.style.color = v; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; }, tokens[theme].focus);

      // Always-visible sample (not focusable).
      const shown = panel.locator('[data-focus-shown]');
      expect(await shown.count()).toBeGreaterThan(0);
      for (const s of await shown.all()) {
        const st = await style(s);
        expect(st.outlineWidth).toBe(parseFloat(tokens[theme].width));
        expect(st.outlineColor).toBe(themeFocus);
        expect(await s.evaluate((el) => el.matches('a[href], button, input, select, textarea, [tabindex]'))).toBe(false);
      }

      // Real controls: keyboard focus draws the ring of this theme.
      const real = panel.locator('[data-focus-real]');
      expect(await real.count()).toBeGreaterThanOrEqual(3);
      await real.first().focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      for (const [i, r] of (await real.all()).entries()) {
        if (i > 0) await page.keyboard.press('Tab');
        await expect(r).toBeFocused();
        const st = await style(r);
        expect(st.outlineWidth, `${theme} control ${i}`).toBeGreaterThan(0);
        expect(st.outlineColor, `${theme} control ${i}`).toBe(themeFocus);
        expect(await r.evaluate((el) => el.closest('[data-figure]'))).toBeNull();
      }
    }
    expect(problems).toEqual([]);
  });
}

test('the non-color list covers the required places and shows the real status badges', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto(pageUrl);
  const rows = page.locator('main [data-distinction]');
  const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-distinction')));
  for (const id of ['post-status', 'holiday', 'provisional-holiday', 'weekday', 'rokuyo', 'marks', 'moon-phase', 'today', 'selected-day', 'star-chart-bodies', 'map-precision', 'like', 'form-error', 'contrast-result']) {
    expect(ids, id).toContain(id);
  }
  // Every component named in the list exists.
  const tags = await page.locator('main [data-distinction] [data-component]').evaluateAll((els) => els.map((e) => e.getAttribute('data-component')));
  expect(tags.length).toBeGreaterThan(5);
  for (const tag of tags) {
    expect(await page.evaluate((t) => customElements.get(t || '') !== undefined, tag), tag).toBe(true);
  }
  // The status row shows the four real badges, each with its symbol and its text.
  const badges = page.locator('main [data-distinction="post-status"] mk-status-badge');
  await expect(badges).toHaveCount(4);
  for (const [i, status] of STATUSES.entries()) {
    const badge = badges.nth(i);
    await expect(badge).toHaveAttribute('status', status);
    await expect(badge.locator('[data-status-symbol]')).not.toHaveText('');
    const label = await page.evaluate((s) => window.MockI18n.t(/** @type {MessageKey} */ (`post.status.${s}`)), status);
    await expect(badge).toContainText(label);
  }
  expect(problems).toEqual([]);
});

test('no horizontal overflow at 375px in both themes', async ({ page }) => {
  const problems = collectProblems(page);
  await page.setViewportSize({ width: 375, height: 812 });
  for (const theme of ['light', 'dark']) {
    await page.goto(`${pageUrl}?theme=${theme}`);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw, theme).toBeLessThanOrEqual(cw);
  }
  expect(problems).toEqual([]);
});
