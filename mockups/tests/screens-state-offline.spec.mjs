// Task 7.3: theme, language, stage, focus, back-link and offline E2E over every screen
// (Requirements 1.2, 2.3, 2.6, 9.3, 9.4, 11.2, 13.5; design "Testing Strategy > E2E").
//
// For each of the 15 screens in the registry:
//   - theme    : OS appearance dark -> dark tokens and dark body background (ThemeBoot leaves
//                data-theme off for "system"); choosing light in the header wins over the OS
//                dark preference, and the choice persists (URL, reload, stored by MockState.update).
//   - language : the header language switch shows the same screen in English (html[lang], h1,
//                document title) without leaving the page.
//   - stage    : with stage=wireframe (light and dark), every rendered product element has
//                grayscale color / background-color / border colors (and SVG fill / stroke),
//                every [data-decor] is invisible and every [data-figure] is a placeholder.
//   - focus    : the first Tab stop is a product control (the review toolbar is appended at the
//                end of <body>, so it never comes first; it is the skip link of mk-site-header) and shows the focus ring of the theme
//                (outline solid, --border-width-focus wide, --color-focus) in light and dark.
//   - back link: the review toolbar links to mockups/index.html and following it opens the list.
//   - offline  : no request leaves file:// (context.route) and no WebSocket is opened, judged
//                after networkidle, for the default view and for wireframe/en/dark.
// Every test also fails on console errors and warnings (note 1.9).
//
// The detectors are proved first on a screen with deliberately injected violations, so a green
// run cannot come from a check that sees nothing.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import {
  MOCKUPS_ROOT, listScreens, screenPath, blockExternalRequests, recordWebSockets, watchConsole,
  loadClassicScripts,
} from './helpers/e2e.mjs';

const screens = listScreens();
const messages = /** @type {{ ja: Record<string, string>, en: Record<string, string> }} */ (
  loadClassicScripts('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js').MockMessages);
const { ja, en } = messages;
const INDEX_URL = pathToFileURL(join(MOCKUPS_ROOT, 'index.html')).href;
const SCHEMES = /** @type {const} */ (['light', 'dark']);
/** Screens whose default state draws a figure (star chart / map / top's moon and rise-set charts) marked with [data-figure]. */
const FIGURE_SCREENS = new Set(['top', 'star-chart', 'post-detail']);

/** @typedef {import('@playwright/test').Page} Page */

/** @param {Page} page */
const header = (page) => page.locator('mk-site-header').first();
/** @param {Page} page */
const tokenBg = (page) => page.evaluate(
  () => getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim());
/** @param {Page} page */
const bodyBg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/**
 * Opens a screen and waits until nothing is loading any more.
 * @param {Page} page @param {string} id @param {Record<string, string>} [params]
 */
async function open(page, id, params) {
  await page.goto(screenPath(id, params));
  await page.waitForLoadState('networkidle');
}

/**
 * In the page: every rendered element outside the review shell whose paint is not grayscale.
 * Checks color, background-color, the four border colors, SVG fill/stroke, and the same for
 * ::before / ::after when they have content. Returns "selector prop: value" strings.
 */
function collectNonGray() {
  /** @param {string} v */
  const isGray = (v) => {
    if (v === 'none' || v === 'transparent' || v.startsWith('url(')) return true;
    const m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (!m) return false; // unknown color format: report it rather than guess
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    return Math.abs(r - g) <= 1 && Math.abs(g - b) <= 1 && Math.abs(r - b) <= 1;
  };
  /** @param {Element} el */
  const name = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const PROPS = ['color', 'background-color', 'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color', 'outline-color'];
  /** @type {string[]} */
  const out = [];
  const els = [document.documentElement, ...document.body.querySelectorAll('*')];
  for (const el of els) {
    if (el.closest('[data-review-shell], script, style, template')) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility !== 'visible') continue;
    if (el !== document.documentElement && el.getClientRects().length === 0) continue;
    const props = el instanceof SVGElement ? [...PROPS, 'fill', 'stroke'] : PROPS;
    for (const p of props) {
      const v = s.getPropertyValue(p);
      if (!isGray(v)) out.push(`${name(el)} ${p}: ${v}`);
    }
    for (const pseudo of ['::before', '::after']) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content === 'none' || ps.content === 'normal') continue;
      for (const p of ['color', 'background-color']) {
        const v = ps.getPropertyValue(p);
        if (!isGray(v)) out.push(`${name(el)}${pseudo} ${p}: ${v}`);
      }
    }
  }
  return out;
}

/** In the page: [data-decor] that still paint, and [data-figure] that are not placeholders. */
function collectStageIssues() {
  /** @type {string[]} */
  const issues = [];
  const decor = [...document.querySelectorAll('[data-decor]')];
  for (const el of decor) {
    const painting = [el, ...el.querySelectorAll('*')]
      .some((n) => getComputedStyle(n).visibility !== 'hidden');
    if (painting) issues.push(`decor visible: ${el.outerHTML.slice(0, 80)}`);
  }
  const figures = [...document.querySelectorAll('[data-figure]')];
  let placeholders = 0;
  for (const el of figures) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || el.getClientRects().length === 0) continue;
    placeholders += 1;
    const visibleContent = [...el.querySelectorAll('*')]
      .filter((n) => getComputedStyle(n).visibility !== 'hidden').length;
    const diagonals = (s.backgroundImage.match(/linear-gradient/g) ?? []).length;
    if (visibleContent > 0) issues.push(`figure content visible (${visibleContent}): ${el.tagName}`);
    if (s.outlineStyle !== 'solid' || parseFloat(s.outlineWidth) <= 0) issues.push(`figure without frame: ${el.tagName}`);
    if (diagonals !== 2) issues.push(`figure without diagonals: ${el.tagName}`);
  }
  return { issues, decor: decor.length, figures: figures.length, placeholders };
}

/** In the page: the focused element and its outline next to the theme's focus tokens. */
function readFocus() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const s = getComputedStyle(el);
  const root = getComputedStyle(document.documentElement);
  const probe = document.createElement('span');
  probe.style.color = 'var(--color-focus)';
  document.body.append(probe);
  const focusColor = getComputedStyle(probe).color;
  probe.remove();
  return {
    tag: el.tagName.toLowerCase(),
    inHeader: !!el.closest('mk-site-header'),
    isSkipLink: el.matches('a.mk-skip-link'),
    inReviewShell: !!el.closest('[data-review-shell]'),
    focusVisible: el.matches(':focus-visible'),
    style: s.outlineStyle,
    width: parseFloat(s.outlineWidth),
    color: s.outlineColor,
    tokenWidth: parseFloat(root.getPropertyValue('--border-width-focus')),
    focusColor,
  };
}

test.describe('detectors (deliberate violations on a screen)', () => {
  test('gray / decor / figure checks flag injected color, visible decor and a non-placeholder figure', async ({ page }) => {
    await open(page, 'top', { stage: 'wireframe' });
    expect(await page.evaluate(collectNonGray)).toEqual([]);
    await page.evaluate(() => {
      const main = document.querySelector('main');
      const p = document.createElement('p');
      p.id = 'bad-color';
      p.textContent = 'x';
      p.style.color = 'rgb(200, 0, 0)';
      const d = document.createElement('span');
      d.id = 'bad-decor';
      d.setAttribute('data-decor', '');
      d.textContent = '✦';
      d.style.setProperty('visibility', 'visible', 'important');
      const f = document.createElement('div');
      f.setAttribute('data-figure', '');
      f.style.setProperty('outline', 'none', 'important');
      f.innerHTML = '<span style="visibility: visible !important">fig</span>';
      main?.append(p, d, f);
    });
    expect(await page.evaluate(collectNonGray)).toContain('p#bad-color color: rgb(200, 0, 0)');
    const { issues } = await page.evaluate(collectStageIssues);
    expect(issues.some((i) => i.startsWith('decor visible') && i.includes('bad-decor'))).toBe(true);
    expect(issues).toContain('figure content visible (1): DIV');
    expect(issues).toContain('figure without frame: DIV');
  });

  test('offline check records an external request and a WebSocket', async ({ page }) => {
    const external = await blockExternalRequests(page);
    const sockets = recordWebSockets(page);
    await open(page, 'top');
    expect(external).toEqual([]);
    expect(sockets).toEqual([]);
    // Loopback only: nothing leaves the machine, and the route aborts the request anyway.
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src = 'http://127.0.0.1:9/probe.png';
      document.body.append(img);
      try { new WebSocket('ws://127.0.0.1:9/probe'); } catch { /* recorded on creation */ }
    });
    await page.waitForLoadState('networkidle');
    await expect.poll(() => external.length).toBeGreaterThan(0);
    await expect.poll(() => sockets.length).toBeGreaterThan(0);
    expect(external[0]).toBe('http://127.0.0.1:9/probe.png');
    expect(sockets[0]).toBe('ws://127.0.0.1:9/probe');
  });
});

for (const screen of screens) {
  const { id } = screen;

  test.describe(`screen ${id}`, () => {
    test('theme: OS dark gives the dark palette; the header light choice wins and persists', async ({ page }) => {
      const problems = watchConsole(page);
      await page.emulateMedia({ colorScheme: 'light' });
      await open(page, id);
      const light = { token: await tokenBg(page), body: await bodyBg(page) };

      await page.emulateMedia({ colorScheme: 'dark' });
      await open(page, id);
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
      const dark = { token: await tokenBg(page), body: await bodyBg(page) };
      expect(dark.token).not.toBe(light.token);
      expect(dark.body).not.toBe(light.body);
      // The OS-driven dark equals the explicit dark theme (both dark token blocks agree).
      await open(page, id, { theme: 'dark' });
      expect(await tokenBg(page)).toBe(dark.token);
      await open(page, id);

      const group = header(page).getByRole('group', { name: ja['toggle.theme.label'] });
      await group.getByRole('button', { name: ja['toggle.theme.light'], exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      expect(await tokenBg(page)).toBe(light.token);
      expect(await bodyBg(page)).toBe(light.body);
      expect(new URL(page.url()).searchParams.get('theme')).toBe('light');
      // Persisted by MockState.update: survives a reload and a visit without the URL parameter.
      await page.reload();
      expect(await bodyBg(page)).toBe(light.body);
      await open(page, id);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      expect(await bodyBg(page)).toBe(light.body);
      expect(problems).toEqual([]);
    });

    // Task 8.1 (day-detail review): the day-detail h1 is the shown date (the sample today without
    // ?date=); the <title> keeps the screen title.
    const h1 = id === 'day-detail'
      ? { ja: '2026年11月16日(月)', en: 'Mon, Nov 16, 2026' }
      : { ja: ja[`screen.${id}.title`], en: en[`screen.${id}.title`] };
    test('language: the header switch shows the same screen in English', async ({ page }) => {
      const problems = watchConsole(page);
      await open(page, id);
      const path = new URL(page.url()).pathname;
      await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
      await expect(page.locator('main h1')).toHaveText(h1.ja);
      await page.evaluate(() => { /** @type {any} */ (window).__noReload = true; });

      const group = header(page).getByRole('group', { name: ja['toggle.lang.label'] });
      await group.getByRole('button', { name: en['toggle.lang.en'], exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('main h1')).toHaveText(h1.en);
      await expect(page).toHaveTitle(en[`screen.${id}.title`]);
      await expect(page.locator('body')).toHaveAttribute('data-screen-id', id);
      expect(new URL(page.url()).pathname).toBe(path);
      expect(await page.evaluate(() => /** @type {any} */ (window).__noReload)).toBe(true);
      expect(problems).toEqual([]);
    });

    for (const scheme of SCHEMES) {
      test(`wireframe (${scheme}): grayscale paint, hidden decoration, figure placeholders`, async ({ page }) => {
        const problems = watchConsole(page);
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, id, { stage: 'wireframe' });
        await expect(page.locator('html')).toHaveAttribute('data-stage', 'wireframe');
        expect(await page.evaluate(collectNonGray)).toEqual([]);
        const { issues, decor, figures, placeholders } = await page.evaluate(collectStageIssues);
        expect(issues).toEqual([]);
        // The header logo (shell.js) is decoration on every screen, so the decor check is never vacuous.
        expect(decor, 'screen has [data-decor]').toBeGreaterThan(0);
        if (FIGURE_SCREENS.has(id)) {
          expect(figures, 'screen draws [data-figure]').toBeGreaterThan(0);
          expect(placeholders, 'at least one visible figure was checked as a placeholder').toBeGreaterThan(0);
        } else {
          // Update FIGURE_SCREENS when a screen starts drawing figures.
          expect(figures, 'screen not in FIGURE_SCREENS draws no [data-figure]').toBe(0);
        }
        expect(problems).toEqual([]);
      });
    }

    test('focus: the first Tab stop is a product control with the theme focus ring (light and dark)', async ({ page }) => {
      const problems = watchConsole(page);
      /** @type {string[]} */
      const colors = [];
      for (const scheme of SCHEMES) {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, id);
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(readFocus);
        expect(focus, `${scheme}: something is focused`).not.toBeNull();
        if (!focus) continue;
        expect(focus.inReviewShell, `${scheme}: review toolbar is not first`).toBe(false);
        expect(focus.inHeader, `${scheme}: first stop is in the site header`).toBe(true);
        // Post-validation cleanup: the header's first control is the skip link to <main>
        // (tests/skip-link.spec.mjs covers its behaviour).
        expect(focus.isSkipLink, `${scheme}: first stop is the skip link`).toBe(true);
        expect(focus.focusVisible).toBe(true);
        expect(focus.style).toBe('solid');
        expect(focus.tokenWidth).toBeGreaterThan(0);
        expect(focus.width).toBeGreaterThanOrEqual(focus.tokenWidth);
        expect(focus.color).toBe(focus.focusColor);
        colors.push(focus.color);
      }
      // Each theme uses its own focus color (13.5: shown in both themes).
      expect(colors[0]).not.toBe(colors[1]);
      expect(problems).toEqual([]);
    });

    test('back link: the review toolbar links to the list and opens it', async ({ page }) => {
      const problems = watchConsole(page);
      await open(page, id);
      const back = page.getByRole('region', { name: 'レビュー用ツールバー' })
        .getByRole('link', { name: '一覧へ戻る' });
      await expect(back).toBeVisible();
      expect(await back.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(INDEX_URL);
      await back.click();
      await page.waitForURL(INDEX_URL);
      await expect(page.locator(`a[href*="screens/${id}.html"]`).first()).toBeAttached();
      expect(problems).toEqual([]);
    });

    test('offline: no external request and no WebSocket (default and wireframe/en/dark)', async ({ page }) => {
      const problems = watchConsole(page);
      const external = await blockExternalRequests(page);
      const sockets = recordWebSockets(page);
      await open(page, id);
      await open(page, id, { stage: 'wireframe', lang: 'en', theme: 'dark' });
      expect(external).toEqual([]);
      expect(sockets).toEqual([]);
      expect(problems).toEqual([]);
    });
  });
}
