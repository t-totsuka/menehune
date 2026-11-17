// Task 5.7: the admin screen, the attribution (credits) screen and the privacy policy (3.4, 3.6, 8.6).
// - admin: for the admin viewer, mk-admin-band, the report queue (target, report count, state) with
//   an immediate-hide mock action for open items, and the appeal review with restore / remove mock
//   decisions. Guests and members get a no-permission notice instead (no band, no admin UI).
//   The `empty` scenario shows empty states for the queue and the appeals.
//   The admin UI is set apart from the general screens by the band and the admin role color.
// - attribution / privacy: public pages built from h2 chapters and example copy (marked as such);
//   the privacy policy lists example collected items.
// - No console problems, valid heading hierarchy and no horizontal overflow at 360 / 375 / 1440 px
//   in wireframe / hifi x ja / en x every auth state (and the admin scenarios).
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
const w = load('data/sample-data.js', 'data/screens.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
const sample = w.MockSample;
/** @param {string} id */
const entryOf = (id) => w.MockScreens.find((/** @type {any} */ s) => s.id === id);
/** @param {string} id @returns {string[]} */
const authStatesOf = (id) => [...entryOf(id).authStates];
/** @param {string} id @returns {string[]} */
const scenariosOf = (id) => [...entryOf(id).scenarios];
/** @type {any[]} */
const reports = [...sample.reports];
const appealed = reports.filter((r) => r.state === 'appealed');

const urlOf = (/** @type {string} */ id, query = '') => pathToFileURL(join(root, 'screens', `${id}.html`)).href + query;

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
    .filter((h) => h.getClientRects().length > 0)
    .map((h) => [Number(h.localName.slice(1)), (h.textContent ?? '').trim()]));

/** One h1 first, and no level is skipped going down. @param {[number, string][]} headings */
const expectValidHierarchy = (headings) => {
  expect(headings[0]?.[0]).toBe(1);
  expect(headings.filter(([level]) => level === 1)).toHaveLength(1);
  for (let i = 1; i < headings.length; i += 1) {
    const prev = /** @type {[number, string]} */ (headings[i - 1])[0];
    const level = /** @type {[number, string]} */ (headings[i])[0];
    expect(level, `heading ${headings[i]?.[1]} after h${prev}`).toBeLessThanOrEqual(prev + 1);
  }
};

/** Elements in <main> whose content is wider than their box (text that does not wrap). */
const clippedIn = (/** @type {import('@playwright/test').Page} */ page) => page.evaluate(() =>
  [...document.querySelectorAll('main p, main li, main a, main button, main h1, main h2, main h3, main dt, main dd')]
    .filter((el) => el.getClientRects().length > 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline')
    .map((el) => `${el.localName}: ${(el.textContent ?? '').trim().slice(0, 40)}`));

/** @param {Record<string, string>} dict @param {number} count */
const countText = (dict, count) => dict[count === 1 ? 'moderation.report-count-one' : 'moderation.report-count'].replace('{count}', String(count));

test('registry: admin offers every auth state and the empty scenario; attribution and privacy are public', () => {
  expect(authStatesOf('admin')).toEqual(['guest', 'member', 'admin']);
  expect(scenariosOf('admin')).toEqual(['default', 'empty']);
  expect(entryOf('admin').access).toBe('admin');
  for (const id of ['attribution', 'privacy']) {
    expect(authStatesOf(id)).toEqual(['guest', 'member']);
    expect(entryOf(id).access).toBe('public');
  }
  expect(appealed.length).toBeGreaterThan(0);
  expect(reports.some((r) => r.reportCount === 1)).toBe(true);
});

for (const id of ['admin', 'attribution', 'privacy']) {
  test.describe(`${id}: renders in every stage, language and auth state`, () => {
    for (const stage of ['wireframe', 'hifi']) {
      for (const lang of ['ja', 'en']) {
        for (const auth of authStatesOf(id)) {
          for (const scenario of id === 'admin' ? scenariosOf(id) : ['default']) {
            test(`${stage} ${lang} ${auth} ${scenario}`, async ({ page }) => {
              const problems = collectProblems(page);
              const dict = lang === 'ja' ? ja : en;
              await page.goto(urlOf(id, `?stage=${stage}&lang=${lang}&auth=${auth}&scenario=${scenario}`));
              await expect(page.locator('html')).toHaveAttribute('data-auth', auth);
              await expect(page.locator('html')).toHaveAttribute('lang', lang);
              await expect(page.locator('main h1')).toHaveText(dict[`screen.${id}.title`]);
              if (id === 'admin') {
                await expect(page.locator('main [data-admin-content]:visible')).toHaveCount(auth === 'admin' ? 1 : 0);
                await expect(page.locator('main [data-no-permission]:visible')).toHaveCount(auth === 'admin' ? 0 : 1);
              } else {
                await expect(page.locator('main h2').first()).toBeVisible();
              }
              await expect(page.locator('main')).not.toContainText('⟦');
              await expect(page.locator('main [data-missing-sample]')).toHaveCount(0);
              for (const width of [360, 375, 1440]) {
                await page.setViewportSize({ width, height: 900 });
                expectValidHierarchy(await headingsOf(page));
                const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
                expect(overflow, `@${width}`).toBeLessThanOrEqual(0);
                expect(await clippedIn(page), `@${width}`).toEqual([]);
              }
              expect(problems).toEqual([]);
            });
          }
        }
      }
    }
  });
}

test.describe('admin (3.4, 3.6, 8.6)', () => {
  test('admin: the band, the report queue with target, count and state', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('admin', '?lang=ja&auth=admin'));
    const content = page.locator('main [data-admin-content]');
    await expect(content.locator('mk-admin-band')).toBeVisible();
    await expect(content.locator('mk-admin-band')).toContainText(ja['admin-band.label']);

    const queue = page.locator('main [data-report-queue]');
    await expect(queue.getByRole('heading', { level: 2, name: ja['screen.admin.queue'], exact: true })).toBeVisible();
    const items = queue.locator('[data-queue-item]');
    await expect(items).toHaveCount(reports.length);
    for (const [i, report] of reports.entries()) {
      const item = items.nth(i);
      await expect(item).toHaveAttribute('data-target-id', report.targetId);
      await expect(item.locator('[data-target-kind]')).toHaveText(ja[`screen.report.kind.${report.targetType}`]);
      await expect(item.locator('[data-report-count]')).toHaveText(countText(ja, report.reportCount));
      await expect(item.locator('[data-report-state]')).toHaveText(ja[`moderation.state.${report.state}`]);
      for (const reason of report.reasons) await expect(item.locator('[data-reasons]')).toContainText(ja[`moderation.reason.${reason}`]);
      // the immediate-hide action is offered for open items only
      await expect(item.locator('button[data-hide-now]')).toHaveCount(report.state === 'open' ? 1 : 0);
    }
    await expect(page.locator('main [data-queue-empty]')).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('admin: hiding an open item immediately changes its state (mock)', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('admin', '?lang=ja&auth=admin'));
    const open = reports.find((r) => r.state === 'open');
    const item = page.locator(`main [data-queue-item][data-target-id="${open.targetId}"]`);
    const button = item.locator('button[data-hide-now]');
    await expect(button).toHaveText(ja['screen.admin.hide-now']);
    await button.click();
    await expect(item.locator('[data-report-state]')).toHaveText(ja['moderation.state.hidden-by-admin']);
    await expect(item.locator('button[data-hide-now]')).toHaveCount(0);
    await expect(item.locator('[data-report-state]')).toBeFocused();
    // the local state survives a language switch
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(item.locator('[data-report-state]')).toHaveText(en['moderation.state.hidden-by-admin']);
    expect(problems).toEqual([]);
  });

  test('admin: the appeal review with restore and remove decisions (mock)', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('admin', '?lang=ja&auth=admin'));
    const review = page.locator('main [data-appeal-review]');
    await expect(review.getByRole('heading', { level: 2, name: ja['screen.admin.appeals'], exact: true })).toBeVisible();
    const items = review.locator('[data-appeal-item]');
    await expect(items).toHaveCount(appealed.length);
    const first = items.first();
    const post = sample.posts.find((/** @type {any} */ p) => p.id === appealed[0].targetId);
    await expect(first.locator('[data-target-body]')).toHaveText(post.body);
    await expect(first.locator('[data-appeal-text]')).not.toBeEmpty();
    await expect(first.locator('button[data-decision="restore"]')).toHaveText(ja['screen.admin.restore']);
    await expect(first.locator('button[data-decision="remove"]')).toHaveText(ja['screen.admin.remove']);
    await first.locator('button[data-decision="restore"]').click();
    await expect(first.locator('[data-report-state]')).toHaveText(ja['moderation.state.restored']);
    await expect(first.locator('button[data-decision]')).toHaveCount(0);
    await expect(page.locator('main [data-admin-content]')).toContainText(ja['screen.admin.mock-note']);
    await expect(page.locator('main [data-appeals-empty]')).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('admin: the remove decision', async ({ page }) => {
    await page.goto(urlOf('admin', '?lang=en&auth=admin'));
    const first = page.locator('main [data-appeal-item]').first();
    await first.locator('button[data-decision="remove"]').click();
    await expect(first.locator('[data-report-state]')).toHaveText(en['moderation.state.removed']);
  });

  test('empty scenario: empty states for the queue and the appeals', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('admin', '?lang=ja&auth=admin&scenario=empty'));
    await expect(page.locator('main [data-queue-item]:visible')).toHaveCount(0);
    await expect(page.locator('main [data-appeal-item]:visible')).toHaveCount(0);
    await expect(page.locator('main [data-queue-empty]')).toHaveText(ja['screen.admin.queue-empty']);
    await expect(page.locator('main [data-appeals-empty]')).toHaveText(ja['screen.admin.appeals-empty']);
    expect(problems).toEqual([]);
  });

  for (const auth of ['guest', 'member']) {
    test(`${auth}: a no-permission notice instead of the admin UI`, async ({ page }) => {
      const problems = collectProblems(page);
      await page.goto(urlOf('admin', `?lang=ja&auth=${auth}`));
      const notice = page.locator('main [data-no-permission]');
      await expect(notice).toBeVisible();
      await expect(notice).toContainText(ja['error.no-permission']);
      await expect(page.locator('main mk-admin-band:visible')).toHaveCount(0);
      await expect(page.locator('main [data-report-queue]')).toBeHidden();
      await expect(page.locator('main button:visible')).toHaveCount(0);
      expect(problems).toEqual([]);
    });
  }

  test('switching the login state flips between the admin UI and the no-permission notice', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('admin', '?lang=ja&auth=member'));
    await expect(page.locator('main [data-no-permission]')).toBeVisible();
    await page.evaluate(() => window.MockState.update({ auth: 'admin' }));
    await expect(page.locator('main [data-admin-content]')).toBeVisible();
    await expect(page.locator('main [data-no-permission]')).toBeHidden();
    await page.evaluate(() => window.MockState.update({ auth: 'guest' }));
    await expect(page.locator('main [data-admin-content]')).toBeHidden();
    await expect(page.locator('main [data-no-permission]')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('the admin UI is visibly distinct from the general screens (admin role color)', async ({ page }) => {
    await page.goto(urlOf('admin', '?stage=hifi&lang=ja&auth=admin'));
    const adminColor = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--color-admin-band)';
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    const content = page.locator('main [data-admin-content]');
    expect(await content.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(adminColor);
    expect(await content.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('solid');
    // general screens carry neither the band nor the admin frame
    await page.goto(urlOf('top', '?stage=hifi&lang=ja&auth=admin'));
    await expect(page.locator('mk-admin-band')).toHaveCount(0);
    await expect(page.locator('[data-admin-content]')).toHaveCount(0);
  });
});

test.describe('attribution and privacy (3.4 page set)', () => {
  test('the footer links open both pages', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('top', '?lang=ja'));
    await page.locator('mk-site-footer').getByRole('link', { name: ja['screen.attribution.title'] }).click();
    await expect(page).toHaveURL(/screens\/attribution\.html/);
    await expect(page.locator('main h1')).toHaveText(ja['screen.attribution.title']);
    await page.locator('mk-site-footer').getByRole('link', { name: ja['screen.privacy.title'] }).click();
    await expect(page).toHaveURL(/screens\/privacy\.html/);
    await expect(page.locator('main h1')).toHaveText(ja['screen.privacy.title']);
    expect(problems).toEqual([]);
  });

  test('attribution: chapters for the data sources, marked as example copy', async ({ page }) => {
    await page.goto(urlOf('attribution', '?lang=ja'));
    await expect(page.locator('main [data-example-note]')).toHaveText(ja['screen.legal.example-note']);
    expect(await page.locator('main h2').count()).toBeGreaterThanOrEqual(4);
    const main = page.locator('main');
    for (const text of ['国立天文台', '暦要項', 'astronomy-engine', 'Yale Bright Star Catalogue', '地理院タイル', 'Open-Meteo', 'CC BY 4.0']) {
      await expect(main).toContainText(text);
    }
  });

  test('privacy: chapters and an example list of collected items', async ({ page }) => {
    await page.goto(urlOf('privacy', '?lang=ja'));
    await expect(page.locator('main [data-example-note]')).toHaveText(ja['screen.legal.example-note']);
    expect(await page.locator('main h2').count()).toBeGreaterThanOrEqual(5);
    const items = page.locator('main [data-collected-items] li');
    expect(await items.count()).toBeGreaterThanOrEqual(5);
    const list = page.locator('main [data-collected-items]');
    for (const key of ['screen.privacy.item.google-id', 'screen.privacy.item.display-name', 'screen.privacy.item.location',
      'screen.privacy.item.posts', 'screen.privacy.item.access-log']) {
      await expect(list).toContainText(ja[key]);
    }
    // consistent with the login screen: what is received from Google
    await expect(list).toContainText('Google アカウントの識別子');
    await expect(list).toContainText('表示名');
  });

  test('English copy', async ({ page }) => {
    await page.goto(urlOf('privacy', '?lang=en'));
    await expect(page.locator('main [data-example-note]')).toHaveText(en['screen.legal.example-note']);
    await expect(page.locator('main [data-collected-items]')).toContainText(en['screen.privacy.item.google-id']);
    await page.goto(urlOf('attribution', '?lang=en'));
    await expect(page.locator('main')).toContainText('Open-Meteo');
    await expect(page.locator('main')).not.toContainText('⟦');
  });
});
