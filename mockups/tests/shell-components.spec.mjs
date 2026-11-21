// Task 4.1: MockElement base (Light DOM render, re-render on mock:change, unsubscribe on
// disconnect, visible "missing sample" text) and the shell components mk-site-header,
// mk-site-footer, mk-guest-notice, mk-status-badge, mk-admin-band
// (2.4, 3.2, 3.6, 6.5, 6.8, 9.4, 11.2, 13.3).
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const catalogUrl = pathToFileURL(join(root, 'components.html')).href;
const topUrl = pathToFileURL(join(root, 'screens', 'top.html')).href;
const fixtureUrl = pathToFileURL(join(here, 'fixtures', 'mock-element-fixture.html')).href;
const screenHref = (/** @type {string} */ id) => pathToFileURL(join(root, 'screens', `${id}.html`)).href;

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

const NAV = ['calendar', 'astro-events', 'star-chart', 'my-posts'];
const NAV_TARGET = { calendar: 'calendar-month', 'astro-events': 'astro-events', 'star-chart': 'star-chart', 'my-posts': 'my-posts' };

/** @param {import('@playwright/test').Page} page */
const header = (page) => page.locator('mk-site-header').first();
/** @param {import('@playwright/test').Page} page */
const cssBg = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim());

/** @param {import('@playwright/test').Page} page */
const collectProblems = (page) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
};

test.describe('mk-site-header', () => {
  for (const [lang, dict] of /** @type {const} */ ([['ja', ja], ['en', en]])) {
    test(`renders logo, main nav and switches in ${lang}`, async ({ page }) => {
      const problems = collectProblems(page);
      await page.goto(`${topUrl}?lang=${lang}`);
      const h = header(page);
      const nav = h.getByRole('navigation', { name: dict['nav.main'] });
      await expect(nav).toBeVisible();
      for (const item of NAV) {
        const link = nav.getByRole('link', { name: dict[`nav.${item}`], exact: true });
        await expect(link).toBeVisible();
        expect(await link.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href))
          .toBe(screenHref(NAV_TARGET[/** @type {keyof typeof NAV_TARGET} */ (item)]));
      }
      const logo = h.getByRole('link', { name: dict['site.name'] });
      await expect(logo).toBeVisible();
      expect(await logo.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(screenHref('top'));
      await expect(h.getByRole('group', { name: dict['toggle.lang.label'] })).toBeVisible();
      await expect(h.getByRole('group', { name: dict['toggle.theme.label'] })).toBeVisible();
      expect(problems).toEqual([]);
    });
  }

  test('header links resolve to screens/ from the catalog page at the root too', async ({ page }) => {
    await page.goto(catalogUrl);
    const link = header(page).getByRole('link', { name: ja['nav.calendar'], exact: true });
    expect(await link.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(screenHref('calendar-month'));
  });

  test('the current page is marked with aria-current (attribute or inferred from the screen)', async ({ page }) => {
    await page.goto(pathToFileURL(join(root, 'screens', 'calendar-month.html')).href);
    await expect(header(page).getByRole('link', { name: ja['nav.calendar'], exact: true })).toHaveAttribute('aria-current', 'page');
    await page.goto(catalogUrl);
    const current = page.locator('#header-current');
    await expect(current.getByRole('link', { name: ja['nav.star-chart'], exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('language switch changes html[lang] and the nav copy without reloading', async ({ page }) => {
    await page.goto(`${topUrl}?lang=ja`);
    await page.evaluate(() => { /** @type {any} */ (window).__noReload = true; });
    const group = header(page).getByRole('group', { name: ja['toggle.lang.label'] });
    await expect(group.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false');
    await group.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(header(page).getByRole('link', { name: en['nav.calendar'], exact: true })).toBeVisible();
    await expect(page.locator('main h1')).toHaveText(en['screen.top.title']);
    expect(await page.evaluate(() => /** @type {any} */ (window).__noReload)).toBe(true);
    expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
    const enGroup = header(page).getByRole('group', { name: en['toggle.lang.label'] });
    await expect(enGroup.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    // Focus stays on the pressed switch after the re-render.
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('English');
    await enGroup.getByRole('button', { name: '日本語' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  });

  test('theme switch: light beats OS dark, is pressed, persists in the URL and after reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`${topUrl}?theme=light`);
    const light = await cssBg(page);
    await page.goto(`${topUrl}?theme=dark`);
    const dark = await cssBg(page);
    expect(light).not.toBe(dark);

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(topUrl);
    expect(await cssBg(page)).toBe(dark);
    const group = header(page).getByRole('group', { name: ja['toggle.theme.label'] });
    await expect(group.getByRole('button', { name: ja['toggle.theme.system'] })).toHaveAttribute('aria-pressed', 'true');
    await group.getByRole('button', { name: ja['toggle.theme.light'] }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await cssBg(page)).toBe(light);
    expect(new URL(page.url()).searchParams.get('theme')).toBe('light');
    await expect(header(page).getByRole('group', { name: ja['toggle.theme.label'] })
      .getByRole('button', { name: ja['toggle.theme.light'] })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    expect(await cssBg(page)).toBe(light);

    await header(page).getByRole('group', { name: ja['toggle.theme.label'] })
      .getByRole('button', { name: ja['toggle.theme.system'] }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    expect(await cssBg(page)).toBe(dark);

    await page.emulateMedia({ colorScheme: 'light' });
    await header(page).getByRole('group', { name: ja['toggle.theme.label'] })
      .getByRole('button', { name: ja['toggle.theme.dark'] }).click();
    expect(await cssBg(page)).toBe(dark);
  });

  test('login state: guest sees a login link, member sees the display name, admin also gets the admin link', async ({ page }) => {
    await page.goto(`${topUrl}?auth=guest`);
    const login = header(page).getByRole('link', { name: ja['nav.login'], exact: true });
    await expect(login).toBeVisible();
    expect(await login.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(screenHref('login'));
    await expect(header(page)).not.toContainText('ほしぞら散歩');
    await expect(header(page).getByRole('link', { name: ja['nav.admin'], exact: true })).toHaveCount(0);

    await page.goto(`${topUrl}?auth=member`);
    await expect(header(page)).toContainText('ほしぞら散歩');
    await expect(header(page).getByRole('link', { name: ja['nav.login'], exact: true })).toHaveCount(0);
    await expect(header(page).getByRole('link', { name: ja['nav.admin'], exact: true })).toHaveCount(0);

    await page.goto(`${catalogUrl}?auth=admin`);
    await expect(header(page)).toContainText('運営チーム');
    const admin = header(page).getByRole('link', { name: ja['nav.admin'], exact: true });
    await expect(admin).toBeVisible();
    // A logged-in auth state is carried over when the target screen allows it.
    expect(await admin.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(`${screenHref('admin')}?auth=admin`);
    const calendar = header(page).getByRole('link', { name: ja['nav.calendar'], exact: true });
    expect(await calendar.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(screenHref('calendar-month'));
  });

  test('switching auth with the review toolbar re-renders the header', async ({ page }) => {
    await page.goto(topUrl);
    await expect(header(page).getByRole('link', { name: ja['nav.login'], exact: true })).toBeVisible();
    await page.locator('[data-review-control="auth"]').selectOption('member');
    await expect(header(page)).toContainText('ほしぞら散歩');
  });

  test('phone width collapses the menu behind a toggle with aria-expanded', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(topUrl);
    const toggle = header(page).getByRole('button', { name: ja['header.menu'] });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const nav = header(page).getByRole('navigation', { name: ja['nav.main'] });
    await expect(nav).toBeHidden();
    await toggle.click();
    await expect(header(page).getByRole('button', { name: ja['header.menu'] })).toHaveAttribute('aria-expanded', 'true');
    await expect(nav).toBeVisible();
    const controls = await header(page).getByRole('button', { name: ja['header.menu'] }).getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(await page.locator(`[id="${controls}"]`).count()).toBe(1);
    // Switching language keeps the menu open.
    await header(page).getByRole('button', { name: 'English' }).click();
    await expect(header(page).getByRole('button', { name: en['header.menu'] })).toHaveAttribute('aria-expanded', 'true');
    // Escape closes it and returns focus to the toggle.
    await page.keyboard.press('Escape');
    await expect(header(page).getByRole('button', { name: en['header.menu'] })).toHaveAttribute('aria-expanded', 'false');
    await expect(header(page).getByRole('navigation', { name: en['nav.main'] })).toBeHidden();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-expanded'))).toBe('false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('desktop width shows the menu without the toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(topUrl);
    await expect(header(page).getByRole('button', { name: ja['header.menu'] })).toBeHidden();
    await expect(header(page).getByRole('navigation', { name: ja['nav.main'] })).toBeVisible();
  });
});

test('mk-site-footer links to the attribution and privacy pages', async ({ page }) => {
  for (const [url, lang, dict] of /** @type {const} */ ([[topUrl, 'ja', ja], [catalogUrl, 'en', en]])) {
    await page.goto(`${url}?lang=${lang}`);
    const footer = page.locator('mk-site-footer').first();
    const attribution = footer.getByRole('link', { name: dict['screen.attribution.title'] });
    const privacy = footer.getByRole('link', { name: dict['screen.privacy.title'] });
    expect(await attribution.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(screenHref('attribution'));
    expect(await privacy.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(screenHref('privacy'));
  }
});

test('mk-guest-notice: read-only and private-post variants, both with a login link', async ({ page }) => {
  await page.goto(catalogUrl);
  const readOnly = page.locator('#notice-read-only');
  await expect(readOnly).toContainText(ja['guest-notice.read-only']);
  const privatePost = page.locator('#notice-private-post');
  await expect(privatePost).toContainText(ja['guest-notice.private-post']);
  for (const n of [readOnly, privatePost]) {
    const link = n.getByRole('link', { name: ja['guest-notice.login'] });
    expect(await link.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)).toBe(screenHref('login'));
  }
  await page.goto(`${catalogUrl}?lang=en`);
  await expect(page.locator('#notice-read-only')).toContainText(en['guest-notice.read-only']);
});

test('mk-status-badge shows a distinct symbol and a text label for every status (not color only)', async ({ page }) => {
  await page.goto(catalogUrl);
  /** @type {string[]} */
  const symbols = [];
  for (const status of ['public', 'members-only', 'hidden', 'deleted']) {
    const badge = page.locator(`#badge-${status}`);
    await expect(badge).toContainText(ja[`post.status.${status}`]);
    const symbol = badge.locator('[data-status-symbol]');
    await expect(symbol).toHaveAttribute('aria-hidden', 'true');
    const text = (await symbol.textContent())?.trim() ?? '';
    expect(text).not.toBe('');
    symbols.push(text);
    const color = await badge.locator('.mk-status-badge').evaluate((el) => getComputedStyle(el).color);
    const token = await page.evaluate((s) => {
      const probe = document.createElement('span');
      probe.style.color = `var(--color-status-${s})`;
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    }, status);
    expect(color).toBe(token);
  }
  expect(new Set(symbols).size).toBe(4);
  await page.goto(`${catalogUrl}?lang=en`);
  await expect(page.locator('#badge-hidden')).toContainText(en['post.status.hidden']);
});

test('mk-status-badge wording follows 6.6 / the design table, and the long English badge wraps at 360px', async ({ page }) => {
  expect(['public', 'members-only', 'hidden', 'deleted'].map((s) => ja[`post.status.${s}`]))
    .toEqual(['公開中', 'ログインユーザのみ', '一時非表示', '削除済み']);
  expect(['public', 'members-only', 'hidden', 'deleted'].map((s) => en[`post.status.${s}`]))
    .toEqual(['Public', 'Logged-in users only', 'Temporarily hidden', 'Deleted']);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${catalogUrl}?lang=en`);
  await expect(page.locator('#badge-members-only .mk-status-badge__text')).toHaveText('Logged-in users only');
  const fits = await page.evaluate(() => {
    const badge = /** @type {HTMLElement} */ (document.querySelector('#badge-members-only .mk-status-badge'));
    const r = badge.getBoundingClientRect();
    return {
      page: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      badge: r.left >= 0 && r.right <= document.documentElement.clientWidth && badge.scrollWidth <= badge.clientWidth,
    };
  });
  expect(fits).toEqual({ page: true, badge: true });
});

test('pressed switch check mark is not part of the accessible name', async ({ page }) => {
  await page.goto(`${catalogUrl}?lang=en`);
  const content = await header(page).getByRole('button', { name: 'English', exact: true }).evaluate((el) => getComputedStyle(el, '::before').content);
  expect(content).toBe('"✓" / ""');
});

test('mk-admin-band marks the page as admin-only', async ({ page }) => {
  await page.goto(catalogUrl);
  const band = page.locator('#admin-band-sample');
  await expect(band).toContainText(ja['admin-band.label']);
  await expect(band).toContainText(ja['admin-band.description']);
  await page.goto(pathToFileURL(join(root, 'components.html')).href + '?lang=en');
  await expect(page.locator('#admin-band-sample')).toContainText(en['admin-band.label']);
});

test('component sample page shows every shell component without console problems', async ({ page }) => {
  const problems = collectProblems(page);
  for (const lang of ['ja', 'en']) {
    await page.goto(`${catalogUrl}?lang=${lang}`);
    for (const tag of ['mk-site-header', 'mk-site-footer', 'mk-guest-notice', 'mk-status-badge', 'mk-admin-band']) {
      const els = page.locator(tag);
      expect(await els.count()).toBeGreaterThan(0);
      for (const el of await els.all()) expect((await el.textContent())?.trim()).not.toBe('');
    }
    expect(await page.evaluate(() => document.body.innerText.includes('⟦'))).toBe(false);
  }
  expect(problems).toEqual([]);
});

test.describe('MockElement base', () => {
  test('renders into Light DOM, re-renders on mock:change and stops after disconnect', async ({ page }) => {
    await page.goto(fixtureUrl);
    const probe = page.locator('#probe-found');
    await expect(probe).toHaveText('p-101 ja');
    expect(await probe.evaluate((el) => el.shadowRoot)).toBeNull();
    const before = Number(await probe.getAttribute('data-renders'));
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(probe).toHaveText('p-101 en');
    expect(Number(await probe.getAttribute('data-renders'))).toBe(before + 1);

    const count = await page.evaluate(() => {
      const el = /** @type {HTMLElement} */ (document.getElementById('probe-found'));
      el.remove();
      window.MockState.update({ lang: 'ja' });
      return Number(el.getAttribute('data-renders'));
    });
    expect(count).toBe(before + 1);
  });

  test('a missing sample id renders the visible missing-sample text', async ({ page }) => {
    await page.goto(fixtureUrl);
    const missing = page.locator('#probe-missing');
    await expect(missing).toHaveText(ja['error.missing-sample'].replace('{id}', 'p-999'));
    await expect(missing.locator('[data-missing-sample]')).toHaveAttribute('data-missing-sample', 'p-999');
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(missing).toHaveText(en['error.missing-sample'].replace('{id}', 'p-999'));
  });

  test('window.MockElement is the base class of every shell component', async ({ page }) => {
    await page.goto(catalogUrl);
    const ok = await page.evaluate(() => ['mk-site-header', 'mk-site-footer', 'mk-guest-notice', 'mk-status-badge', 'mk-admin-band']
      .map((n) => {
        const ctor = customElements.get(n);
        return Boolean(ctor && ctor.prototype instanceof window.MockElement);
      }));
    expect(ok).toEqual([true, true, true, true, true]);
  });
});
