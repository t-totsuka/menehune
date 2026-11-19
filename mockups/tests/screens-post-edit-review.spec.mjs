// Task 8.1 (post-edit only): the wireframe review notes recorded for `post-edit` in
// data/screens.js (Requirements 6.2, 6.3, 7.1, 12.1, 12.2, 13.5).
//   1. "位置の公開精度はアコーディオンで": the precision picker of the form is folded into a closed
//      <details> (mk-precision-picker `collapsed`, opt-in; settings and the component gallery
//      defaults keep the open radio group). The summary names the control and the current choice
//      ("位置の公開精度：市区町村"), and follows the choice. Inside, the fieldset keeps its legend
//      and the radios keep their labels and descriptions. The validation-error scenario has no
//      error inside the closed accordion (the date is the only invalid field).
//   2. "編集エリアは大きめに取りたい": the body textarea gets more rows (12) and a minimum height
//      (15rem, 24rem from 960px), and spans the full width of the form; no horizontal scroll at
//      375px.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, loadClassicScripts, watchConsole } from './helpers/e2e.mjs';

const w = loadClassicScripts('data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
const sample = /** @type {any} */ (w.MockSample);

const urlOf = (/** @type {string} */ id, query = '') =>
  pathToFileURL(join(MOCKUPS_ROOT, 'screens', `${id}.html`)).href + query;
const galleryUrl = pathToFileURL(join(MOCKUPS_ROOT, 'components.html')).href;

/** The summary text for a choice. @param {Record<string, string>} m @param {string} precisionText */
const summaryOf = (m, precisionText) =>
  (m['location.summary'] ?? '⟦location.summary⟧').replace('{label}', m['location.label'] ?? '').replace('{precision}', precisionText);

test.describe('post-edit: review note 1 (precision picker in an accordion)', () => {
  test('the picker starts closed; the summary names the control and the current choice', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('post-edit', '?lang=ja&auth=member'));
    const picker = page.locator('main mk-precision-picker');
    await expect(picker).toHaveAttribute('collapsed', '');
    const details = picker.locator('details.mk-precision-picker__toggle');
    await expect(details).toHaveCount(1);
    await expect(details).not.toHaveAttribute('open', '');
    const summary = details.locator('> summary');
    await expect(summary).toHaveText(summaryOf(ja, ja['location.precision.municipality']));
    await expect(picker.locator('input[type="radio"]').first()).toBeHidden();
    // the fieldset and its legend stay inside the accordion
    await expect(details.locator('> fieldset > legend')).toHaveText(ja['location.label']);
    expect(problems).toEqual([]);
  });

  test('opening by keyboard shows the radio group with its legend; the summary follows the choice', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('post-edit', '?lang=ja&auth=member'));
    const picker = page.locator('main mk-precision-picker');
    const details = picker.locator('details.mk-precision-picker__toggle');
    const summary = details.locator('> summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    const group = picker.getByRole('group', { name: ja['location.label'], exact: true });
    await expect(group).toBeVisible();
    await expect(group.getByRole('radio')).toHaveCount(5);
    const prefecture = group.getByRole('radio', { name: ja['location.precision.prefecture'], exact: true });
    await expect(prefecture).toHaveAccessibleDescription(ja['location.precision.prefecture.description']);
    await prefecture.check();
    await expect(summary).toHaveText(summaryOf(ja, ja['location.precision.prefecture']));

    // the open state and the choice survive a language switch (re-render)
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(picker.locator('details.mk-precision-picker__toggle')).toHaveAttribute('open', '');
    await expect(picker.locator('details > summary')).toHaveText(summaryOf(en, en['location.precision.prefecture']));
    await expect(picker.locator('input[value="prefecture"]')).toBeChecked();

    // closing again with the keyboard
    await picker.locator('details > summary').focus();
    await page.keyboard.press('Space');
    await expect(picker.locator('details.mk-precision-picker__toggle')).not.toHaveAttribute('open', '');
    expect(problems).toEqual([]);
  });

  test('?post= prefills the choice into the summary; turning location off hides the whole accordion', async ({ page }) => {
    const post = sample.posts.find((/** @type {any} */ p) => p.id === 'p-104');
    await page.goto(urlOf('post-edit', '?lang=ja&auth=member&post=p-104'));
    const picker = page.locator('main mk-precision-picker');
    await expect(picker.locator('details > summary')).toHaveText(summaryOf(ja, ja[`location.precision.${post.location.precision}`]));
    await page.locator('main #post-location-on').uncheck();
    await expect(picker.locator('details > summary')).toBeHidden();
  });

  test('validation-error: no invalid field or error message hides inside the closed accordion', async ({ page }) => {
    await page.goto(urlOf('post-edit', '?lang=ja&auth=member&scenario=validation-error'));
    await expect(page.locator('main #post-target-date')).toHaveAttribute('aria-invalid', 'true');
    const hiddenErrors = await page.evaluate(() =>
      [...document.querySelectorAll('main details:not([open])')]
        .flatMap((d) => [...d.querySelectorAll('[aria-invalid="true"], .field-error, [role="alert"]')])
        .length);
    expect(hiddenErrors).toBe(0);
    // every link of the error summary points at a field that is visible
    const targets = await page.locator('main [data-error-summary] a[href^="#"]').evaluateAll((els) =>
      els.map((a) => {
        const el = document.getElementById((a.getAttribute('href') ?? '').slice(1));
        return el !== null && el.getClientRects().length > 0;
      }));
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every(Boolean)).toBe(true);
  });

  test('opt-in: settings and the gallery default keep the open radio group; the gallery shows the collapsed one', async ({ page }) => {
    await page.goto(urlOf('settings', '?lang=ja&auth=member'));
    await expect(page.locator('main mk-precision-picker details')).toHaveCount(0);
    await expect(page.locator('main mk-precision-picker input[type="radio"]').first()).toBeVisible();

    await page.goto(galleryUrl);
    await expect(page.locator('#precision-default details')).toHaveCount(0);
    await expect(page.locator('#precision-municipality details')).toHaveCount(0);
    const collapsed = page.locator('#precision-collapsed');
    await expect(collapsed).toHaveAttribute('collapsed', '');
    await expect(collapsed.locator('details.mk-precision-picker__toggle')).not.toHaveAttribute('open', '');
    await expect(page.locator('tr[data-element="mk-precision-picker"]')).toContainText('collapsed');
  });
});

test.describe('post-edit: review note 2 (a larger editing area)', () => {
  for (const width of [375, 1440]) {
    test(`the body textarea is tall and spans the form @${width}`, async ({ page }) => {
      const problems = watchConsole(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(urlOf('post-edit', '?lang=ja&auth=member'));
      const body = page.locator('main #post-body');
      expect(Number(await body.getAttribute('rows'))).toBeGreaterThanOrEqual(12);
      const box = await body.boundingBox();
      const form = await page.locator('main form').boundingBox();
      expect(box && form).toBeTruthy();
      const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      // 15rem on narrow screens, 24rem from 960px
      expect(box?.height ?? 0).toBeGreaterThanOrEqual((width >= 960 ? 24 : 15) * rem - 1);
      // full width of the form
      expect(Math.abs((box?.width ?? 0) - (form?.width ?? 0))).toBeLessThanOrEqual(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(problems).toEqual([]);
    });
  }
});
