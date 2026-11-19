// Task 5.5: the settings screen and the login screen (8.1, 8.2).
// - settings (members): display name (text input), UI language and theme (radio groups in
//   fieldsets, wired to MockState like the header switches), the default visibility of own posts
//   to guests (radio group) and the default location precision (mk-precision-picker with a value).
//   Guests get a login prompt instead of the form.
// - login: a "sign in with Google" entry (text and a neutral decorative mark, no logo image) and
//   the explanation that only minimal information is received (what is and what is not). Members
//   (already logged in) see that state instead of the entry.
// - No console problems, valid heading hierarchy and no horizontal overflow at 360 / 375 / 1440 px
//   in wireframe / hifi x ja / en x guest / member.
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
const me = sample.users.find((/** @type {any} */ u) => u.id === sample.viewerIds.member);
/** @param {string} id @returns {string[]} */
const authStatesOf = (id) => [...w.MockScreens.find((/** @type {any} */ s) => s.id === id).authStates];

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
  [...document.querySelectorAll('main label, main legend, main p, main li, main a, main button, main h1, main h2')]
    .filter((el) => el.getClientRects().length > 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline')
    .map((el) => `${el.localName}: ${(el.textContent ?? '').trim().slice(0, 40)}`));

test('registry: settings and login can be viewed as guest and member', () => {
  expect(authStatesOf('settings')).toEqual(['guest', 'member']);
  expect(authStatesOf('login')).toEqual(['guest', 'member']);
});

for (const id of ['settings', 'login']) {
  test.describe(`${id}: renders in every stage, language and auth state`, () => {
    for (const stage of ['wireframe', 'hifi']) {
      for (const lang of ['ja', 'en']) {
        for (const auth of authStatesOf(id)) {
          test(`${stage} ${lang} ${auth}`, async ({ page }) => {
            const problems = collectProblems(page);
            await page.goto(urlOf(id, `?stage=${stage}&lang=${lang}&auth=${auth}`));
            await expect(page.locator('html')).toHaveAttribute('data-auth', auth);
            await expect(page.locator('html')).toHaveAttribute('lang', lang);
            if (id === 'settings') {
              await expect(page.locator('main [data-guest-prompt]:visible')).toHaveCount(auth === 'guest' ? 1 : 0);
              await expect(page.locator('main [data-member-content]:visible')).toHaveCount(auth === 'guest' ? 0 : 1);
            } else {
              await expect(page.locator('main [data-login-entry]:visible')).toHaveCount(auth === 'guest' ? 1 : 0);
              await expect(page.locator('main [data-logged-in]:visible')).toHaveCount(auth === 'guest' ? 0 : 1);
              await expect(page.locator('main [data-login-info]')).toBeVisible();
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
  });
}

test.describe('settings (8.2)', () => {
  test('guest: a login prompt instead of the settings', async ({ page }) => {
    await page.goto(urlOf('settings', '?lang=en'));
    const prompt = page.locator('main [data-guest-prompt]');
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveText(en['screen.settings.login-required']);
    // task 8.1: the login link is in the band above <main>, not in the prompt
    await expect(prompt.locator('a')).toHaveCount(0);
    await expect(page.locator('body > mk-guest-notice[band]').locator('a[href*="login.html"]')).toHaveText(en['guest-notice.login']);
    await expect(page.locator('main #settings-display-name')).toBeHidden();
  });

  test('member: the five settings with labels and grouped radios', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('settings', '?lang=ja&auth=member'));
    const name = page.getByLabel(ja['screen.settings.display-name'], { exact: true });
    await expect(name).toBeVisible();
    await expect(name).toHaveAttribute('type', 'text');
    await expect(name).toHaveValue(me.displayName);

    const langGroup = page.locator('main').getByRole('group', { name: ja['screen.settings.lang'], exact: true });
    await expect(langGroup).toHaveJSProperty('localName', 'fieldset');
    await expect(langGroup.getByRole('radio')).toHaveCount(2);
    await expect(langGroup.getByRole('radio', { name: ja['toggle.lang.ja'] })).toBeChecked();
    await expect(langGroup.getByRole('radio', { name: ja['toggle.lang.en'] })).not.toBeChecked();

    const themeGroup = page.locator('main').getByRole('group', { name: ja['screen.settings.theme'], exact: true });
    await expect(themeGroup).toHaveJSProperty('localName', 'fieldset');
    await expect(themeGroup.getByRole('radio')).toHaveCount(3);
    await expect(themeGroup.getByRole('radio', { name: ja['toggle.theme.system'] })).toBeChecked();

    const visibility = page.locator('main').getByRole('group', { name: ja['screen.settings.guest-visible'], exact: true });
    await expect(visibility).toHaveJSProperty('localName', 'fieldset');
    await expect(visibility.getByRole('radio')).toHaveCount(2);
    await expect(visibility.getByRole('radio', { name: ja['screen.settings.guest-visible-yes'] })).toBeChecked();
    await expect(visibility.getByRole('radio', { name: ja['screen.settings.guest-visible-no'] })).not.toBeChecked();

    const picker = page.locator('main mk-precision-picker');
    await expect(picker).toBeVisible();
    await expect(picker).toHaveAttribute('value', 'municipality');
    await expect(picker.locator('input[type="radio"]')).toHaveCount(5);
    await expect(picker.locator('input[value="municipality"]')).toBeChecked();

    // every control in the form has an accessible label
    const unlabelled = await page.locator('main form input, main form select, main form textarea').evaluateAll((els) =>
      els.filter((el) => !(/** @type {HTMLInputElement} */ (el).labels?.length)).map((el) => el.id || el.outerHTML));
    expect(unlabelled).toEqual([]);
    await expect(page.locator('main form button', { hasText: ja['button.save'] })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('the language radios switch the UI language, like the header switch', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('settings', '?lang=ja&auth=member'));
    await page.getByRole('radio', { name: ja['toggle.lang.en'] }).check();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('main h1')).toHaveText(en['screen.settings.title']);
    await expect(page.locator('mk-site-header button[lang="en"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('radio', { name: en['toggle.lang.en'] })).toBeChecked();
    // and the header switch updates the radios
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('mk-site-header button[lang="ja"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByRole('radio', { name: ja['toggle.lang.ja'] })).toBeChecked();
    expect(problems).toEqual([]);
  });

  test('the theme radios switch the theme, and follow MockState', async ({ page }) => {
    await page.goto(urlOf('settings', '?lang=en&auth=member'));
    await page.getByRole('radio', { name: en['toggle.theme.dark'] }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.evaluate(() => window.MockState.update({ theme: 'light' }));
    await expect(page.getByRole('radio', { name: en['toggle.theme.light'] })).toBeChecked();
    await page.getByRole('radio', { name: en['toggle.theme.system'] }).check();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  });

  test('English: long labels wrap inside the 360px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(urlOf('settings', '?lang=en&auth=member'));
    await expect(page.locator('main')).toContainText(en['screen.settings.guest-visible-no']);
    const widths = await page.locator('main form fieldset').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    for (const right of widths) expect(right).toBeLessThanOrEqual(360);
  });
});

test.describe('login (8.1)', () => {
  test('guest: the Google sign-in entry and the minimal-information explanation', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('login', '?lang=ja'));
    const entry = page.locator('main [data-login-entry]');
    const signIn = entry.getByRole('link', { name: ja['screen.login.google'], exact: true });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveClass(/\bbutton\b/);
    await expect(signIn).toHaveAttribute('href', /auth=member/);
    // no logo image: text, with only a decorative mark
    await expect(page.locator('main img, main svg')).toHaveCount(0);
    await expect(signIn.locator('[data-decor]')).toHaveAttribute('aria-hidden', 'true');

    const info = page.locator('main [data-login-info]');
    await expect(info).toContainText(ja['screen.login.minimal']);
    const received = info.locator('[data-received] li');
    expect(await received.allTextContents()).toEqual([ja['screen.login.received.id'], ja['screen.login.received.name']]);
    const notReceived = info.locator('[data-not-received] li');
    expect(await notReceived.count()).toBeGreaterThanOrEqual(2);
    await expect(info.locator('a[href*="privacy.html"]')).toBeVisible();
    await expect(page.locator('main [data-logged-in]')).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('member: the already-logged-in state instead of the entry', async ({ page }) => {
    await page.goto(urlOf('login', '?lang=en&auth=member'));
    const done = page.locator('main [data-logged-in]');
    await expect(done).toBeVisible();
    await expect(done).toContainText(en['screen.login.already'].replace('{name}', me.displayName));
    await expect(done.locator('a[href*="settings.html"]')).toBeVisible();
    await expect(page.locator('main [data-login-entry]')).toBeHidden();
  });

  test('English copy of the explanation', async ({ page }) => {
    await page.goto(urlOf('login', '?lang=en'));
    await expect(page.locator('main [data-login-entry] a.button')).toHaveText(en['screen.login.google']);
    expect(await page.locator('main [data-received] li').allTextContents()).toEqual([en['screen.login.received.id'], en['screen.login.received.name']]);
  });
});
