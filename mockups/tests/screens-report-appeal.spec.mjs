// Task 5.6: the report screen and the appeal screen (8.3, 8.5).
// - report (members): reads ?target=ID (a post or a comment; mk-report-link links here with
//   ?auth=member). Shows the target (kind, author, content), the reason as a fieldset radio group
//   (moderation.reason.*), an optional details field and a mock submit. Without ?target it shows
//   the default sample post; an unknown target falls back to it with a console warning. One's own
//   post or comment cannot be reported; a hidden post's content is not shown.
// - appeal (members): reads ?target=ID (post-detail links here for the viewer's hidden post).
//   Shows the target post, why it was hidden (the reasons of its report) and the appeal field with
//   a label and a mock submit. Without ?target it shows the hidden-own sample post; an unknown
//   target falls back to it with a warning. Someone else's post, or an own post that is not
//   hidden, gets a notice instead of the form.
// - Guests get a login prompt instead of the forms.
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
/** @param {string} id */
const postOf = (id) => sample.posts.find((/** @type {any} */ p) => p.id === id);
/** @param {string} id */
const nameOf = (id) => sample.users.find((/** @type {any} */ u) => u.id === id).displayName;
/** @param {string} id @returns {string[]} */
const authStatesOf = (id) => [...w.MockScreens.find((/** @type {any} */ s) => s.id === id).authStates];
const REASONS = ['spam', 'harassment', 'inappropriate', 'personal-info', 'other'];

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
  [...document.querySelectorAll('main label, main legend, main p, main li, main a, main button, main h1, main h2, main dd')]
    .filter((el) => el.getClientRects().length > 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline')
    .map((el) => `${el.localName}: ${(el.textContent ?? '').trim().slice(0, 40)}`));

/** Every visible form control in <main> has a label. @param {import('@playwright/test').Page} page */
const unlabelledIn = (page) => page.locator('main form input, main form select, main form textarea').evaluateAll((els) =>
  els.filter((el) => el.getClientRects().length > 0 && !(/** @type {HTMLInputElement} */ (el).labels?.length))
    .map((el) => el.id || el.outerHTML));

test('registry: report and appeal can be viewed as guest and member', () => {
  expect(authStatesOf('report')).toEqual(['guest', 'member']);
  expect(authStatesOf('appeal')).toEqual(['guest', 'member']);
});

for (const id of ['report', 'appeal']) {
  test.describe(`${id}: renders in every stage, language and auth state`, () => {
    for (const stage of ['wireframe', 'hifi']) {
      for (const lang of ['ja', 'en']) {
        for (const auth of authStatesOf(id)) {
          test(`${stage} ${lang} ${auth}`, async ({ page }) => {
            const problems = collectProblems(page);
            const dict = lang === 'ja' ? ja : en;
            await page.goto(urlOf(id, `?stage=${stage}&lang=${lang}&auth=${auth}`));
            await expect(page.locator('html')).toHaveAttribute('data-auth', auth);
            await expect(page.locator('html')).toHaveAttribute('lang', lang);
            await expect(page.locator('main h1')).toHaveText(dict[`screen.${id}.title`]);
            await expect(page.locator('main [data-guest-prompt]:visible')).toHaveCount(auth === 'guest' ? 1 : 0);
            await expect(page.locator('main [data-member-content]:visible')).toHaveCount(auth === 'guest' ? 0 : 1);
            if (auth === 'guest') {
              const prompt = page.locator('main [data-guest-prompt]');
              await expect(prompt).toContainText(dict[`screen.${id}.login-required`]);
              await expect(prompt.locator('a[href*="login.html"]')).toHaveText(dict['guest-notice.login']);
            } else {
              await expect(page.locator('main form textarea:visible')).toHaveCount(1);
              expect(await unlabelledIn(page)).toEqual([]);
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

test.describe('report (8.3)', () => {
  test('the report link on post-detail opens the report screen with the target', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('post-detail', '?lang=ja&auth=member'));
    const postId = sample.postDetailScenarios.default;
    await page.locator('main [data-post-report] mk-report-link a').click();
    await expect(page).toHaveURL(/screens\/report\.html\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get('target')).toBe(postId);
    expect(url.searchParams.get('auth')).toBe('member');
    await expect(page.locator('html')).toHaveAttribute('data-auth', 'member');

    const target = page.locator('main [data-report-target]');
    await expect(target).toBeVisible();
    await expect(target.locator('[data-target-kind]')).toHaveText(ja['screen.report.kind.post']);
    await expect(target.locator('[data-target-author]')).toHaveText(nameOf(postOf(postId).authorId));
    await expect(target.locator('[data-target-body]')).toHaveText(postOf(postId).body);
    await expect(target.locator('a[data-target-back]')).toHaveAttribute('href', /post-detail\.html\?.*auth=member/);

    const reasons = page.locator('main').getByRole('group', { name: ja['moderation.reason.label'], exact: true });
    await expect(reasons).toHaveJSProperty('localName', 'fieldset');
    await expect(reasons.getByRole('radio')).toHaveCount(REASONS.length);
    for (const reason of REASONS) await expect(reasons.getByRole('radio', { name: ja[`moderation.reason.${reason}`], exact: true })).toBeVisible();
    await reasons.getByRole('radio', { name: ja['moderation.reason.spam'], exact: true }).check();
    await expect(reasons.getByRole('radio', { name: ja['moderation.reason.spam'], exact: true })).toBeChecked();

    const details = page.getByLabel(ja['screen.report.details'], { exact: true });
    await expect(details).toBeVisible();
    await expect(details).toHaveJSProperty('localName', 'textarea');
    await expect(page.locator('main form button', { hasText: ja['button.report'] })).toBeVisible();
    await expect(page.locator('main form')).toContainText(ja['screen.report.mock-note']);
    expect(await unlabelledIn(page)).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('a comment report link opens the report screen with the comment', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('post-detail', '?lang=ja&auth=member&scenario=deleted-comment'));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('main mk-comment-tree mk-report-link[target-id="c-120-04"] a').click();
    await expect(page).toHaveURL(/screens\/report\.html\?.*target=c-120-04/);
    const target = page.locator('main [data-report-target]');
    await expect(target.locator('[data-target-kind]')).toHaveText(ja['screen.report.kind.comment']);
    await expect(target.locator('[data-target-author]')).toHaveText(nameOf('u-kumo'));
    await expect(target.locator('[data-target-body]')).toHaveText('話がそれてきたので、満月の話に戻しましょう。');
    // back to the post that holds the comment
    await expect(target.locator('a[data-target-back]')).toHaveAttribute('href', /scenario=deleted-comment/);
    await expect(page.locator('main').getByRole('group', { name: ja['moderation.reason.label'], exact: true }).getByRole('radio'))
      .toHaveCount(REASONS.length);
    expect(problems).toEqual([]);
  });

  test('an unknown target falls back to the default post with a warning', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('report', '?lang=ja&auth=member&target=p-999'));
    await expect(page.locator('main [data-target-body]')).toHaveText(postOf(sample.postDetailScenarios.default).body);
    expect(problems.some((p) => p.includes('[report]') && p.includes('p-999'))).toBe(true);
  });

  test('one\'s own post or comment cannot be reported', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('report', '?lang=ja&auth=member&target=c-120-02'));
    await expect(page.locator('main [data-target-author]')).toHaveText(nameOf(sample.viewerIds.member));
    const own = page.locator('main [data-own-target]');
    await expect(own).toBeVisible();
    await expect(own).toContainText(ja['screen.report.own']);
    await expect(page.locator('main fieldset')).toBeHidden();
    await expect(page.locator('main textarea')).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('a hidden post is reported without showing its content', async ({ page }) => {
    await page.goto(urlOf('report', '?lang=en&auth=member&target=p-109'));
    const body = page.locator('main [data-target-body]');
    await expect(body).toHaveText(en['moderation.hidden-notice']);
    await expect(page.locator('main')).not.toContainText(postOf('p-109').body);
    await expect(page.locator('main fieldset')).toBeVisible();
  });

  test('English copy', async ({ page }) => {
    await page.goto(urlOf('report', '?lang=en&auth=member&target=p-101'));
    await expect(page.locator('main [data-target-kind]')).toHaveText(en['screen.report.kind.post']);
    await expect(page.getByLabel(en['screen.report.details'], { exact: true })).toBeVisible();
    for (const reason of REASONS) await expect(page.getByRole('radio', { name: en[`moderation.reason.${reason}`], exact: true })).toBeVisible();
  });
});

test.describe('appeal (8.5)', () => {
  test('the appeal link on post-detail opens the appeal screen with the post and its reasons', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('post-detail', '?lang=ja&auth=member&scenario=hidden-own'));
    await page.locator('main a[data-appeal-link]').click();
    await expect(page).toHaveURL(/screens\/appeal\.html\?.*target=p-108/);
    const post = postOf('p-108');
    const report = sample.reports.find((/** @type {any} */ r) => r.targetId === 'p-108');

    const target = page.locator('main [data-appeal-target]');
    await expect(target).toBeVisible();
    await expect(target.locator('[data-target-author]')).toHaveText(nameOf(post.authorId));
    await expect(target.locator('[data-target-body]')).toHaveText(post.body);
    await expect(target.locator('mk-status-badge')).toHaveAttribute('status', 'hidden');

    const reason = page.locator('main [data-hidden-reason]');
    await expect(reason).toBeVisible();
    expect(await reason.locator('li').allTextContents())
      .toEqual(report.reasons.map((/** @type {string} */ r) => ja[`moderation.reason.${r}`]));
    await expect(reason).toContainText(ja['moderation.report-count'].replace('{count}', String(report.reportCount)));

    const content = page.getByLabel(ja['screen.appeal.content'], { exact: true });
    await expect(content).toBeVisible();
    await expect(content).toHaveJSProperty('localName', 'textarea');
    await expect(page.locator('main form button', { hasText: ja['button.submit'] })).toBeVisible();
    await expect(page.locator('main form')).toContainText(ja['screen.appeal.mock-note']);
    expect(await unlabelledIn(page)).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('someone else\'s post gets a notice instead of the form', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('appeal', '?lang=ja&auth=member&target=p-109'));
    const notice = page.locator('main [data-appeal-unavailable]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(ja['screen.appeal.not-own']);
    await expect(page.locator('main textarea')).toBeHidden();
    await expect(page.locator('main')).not.toContainText(postOf('p-109').body);
    expect(problems).toEqual([]);
  });

  test('an own post that is not hidden gets a notice instead of the form', async ({ page }) => {
    await page.goto(urlOf('appeal', '?lang=en&auth=member&target=p-102'));
    await expect(page.locator('main [data-appeal-unavailable]')).toContainText(en['screen.appeal.not-hidden']);
    await expect(page.locator('main textarea')).toBeHidden();
  });

  test('an unknown target falls back to the hidden-own post with a warning', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('appeal', '?lang=ja&auth=member&target=zzz'));
    await expect(page.locator('main [data-target-body]')).toHaveText(postOf(sample.postDetailScenarios['hidden-own']).body);
    expect(problems.some((p) => p.includes('[appeal]') && p.includes('zzz'))).toBe(true);
  });

  test('English copy', async ({ page }) => {
    await page.goto(urlOf('appeal', '?lang=en&auth=member&target=p-108'));
    await expect(page.locator('main [data-hidden-reason] li').first()).toHaveText(en['moderation.reason.spam']);
    await expect(page.getByLabel(en['screen.appeal.content'], { exact: true })).toBeVisible();
    await expect(page.locator('main [data-hidden-reason]')).toContainText(en['screen.appeal.reason-intro']);
  });
});
