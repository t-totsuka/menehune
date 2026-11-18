// Task 6.6: the glossary page (glossary.html) shows the Japanese / English glossary by category and
// the date / time / weekday formats of both languages (11.3, 11.4, 11.7).
// - every category of GlossaryCategory has a section with one table; every MockGlossary entry has
//   exactly one row, in the table of its category, with the key, the ja and en copy read from
//   window.MockMessages, the translation policy and the ja / en note
// - the format examples cover every DateStyle in ja and en; each value equals what the real
//   I18nRuntime (MockI18n.formatDate) returns when the page itself is shown in that language
// - building the examples leaves the page language as it was (html lang, MockI18n)
// - no console problems, no horizontal overflow at 375px
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pageUrl = pathToFileURL(join(root, 'glossary.html')).href;

/** GlossaryCategory (types.d.ts) in display order, with the fixed Japanese heading. */
const CATEGORIES = [
  ['ui', '画面の文言'],
  ['rokuyo', '六曜'],
  ['sekki', '二十四節気'],
  ['kou', '七十二候'],
  ['zassetsu', '雑節'],
  ['lunar-month', '旧暦の月名'],
  ['moon-phase', '月の満ち欠け'],
  ['astro-event', '天文現象・天体'],
  ['holiday', '祝日'],
  ['location', '位置情報'],
  ['weather', '天気'],
  ['moderation', '通報と非表示'],
];
const POLICY_LABELS = {
  translation: '意訳',
  transliteration: '音写',
  both: '音写と意訳の併記',
  standard: '標準の英語',
};
const STYLES = ['date-long', 'date-short', 'weekday', 'time', 'datetime', 'month-year'];

/** @param {import('@playwright/test').Page} page */
const collectProblems = (page) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
};

/** Rows of the format tables as rendered: style, input value, ja, en. */
const readFormatRows = (/** @type {import('@playwright/test').Page} */ page) =>
  page.locator('[data-format-row]').evaluateAll((rows) => rows.map((r) => ({
    style: r.getAttribute('data-style') || '',
    value: r.getAttribute('data-value') || '',
    ja: (r.querySelector('[data-lang-cell="ja"]')?.textContent || '').trim(),
    en: (r.querySelector('[data-lang-cell="en"]')?.textContent || '').trim(),
  })));

test('every glossary entry has one row in the table of its category, with ja / en from the dictionaries', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto(pageUrl);
  await expect(page.locator('h1')).toHaveText('日英用語集');

  const data = await page.evaluate(() => ({
    glossary: window.MockGlossary.map((g) => ({ key: g.key, category: g.category, policy: g.policy, note: g.note || null })),
    ja: window.MockMessages.ja,
    en: window.MockMessages.en,
  }));
  expect(data.glossary.length).toBeGreaterThan(0);
  // every entry's category is a known one (no entry can fall outside the page)
  const known = CATEGORIES.map(([c]) => c);
  for (const g of data.glossary) expect(known, g.key).toContain(g.category);

  for (const [category, label] of CATEGORIES) {
    const section = page.locator(`section[data-category="${category}"]`);
    await expect(section, category).toHaveCount(1);
    await expect(section.locator('h2')).toContainText(label);
    const table = section.locator('table');
    await expect(table).toHaveCount(1);
    await expect(table.locator('thead th')).toHaveText(['キー', '日本語', '英語', '英訳の方針', '注記']);
    const entries = data.glossary.filter((g) => g.category === category);
    expect(entries.length, category).toBeGreaterThan(0);
    const rows = await table.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => {
      const cells = Array.from(tr.children);
      const text = (/** @type {Element | undefined} */ el) => (el?.textContent || '').trim();
      return {
        key: tr.getAttribute('data-key'),
        keyText: text(cells[0]),
        ja: text(cells[1]), jaLang: cells[1]?.getAttribute('lang'),
        en: text(cells[2]), enLang: cells[2]?.getAttribute('lang'),
        policy: text(cells[3]), policyId: cells[3]?.getAttribute('data-policy'),
        noteJa: text(cells[4]?.querySelector('[lang="ja"]') || undefined),
        noteEn: text(cells[4]?.querySelector('[lang="en"]') || undefined),
      };
    }));
    expect(rows.map((r) => r.key), category).toEqual(entries.map((g) => g.key));
    for (const [i, g] of entries.entries()) {
      const r = rows[i];
      expect(r.keyText).toBe(g.key);
      expect(r.ja, g.key).toBe(data.ja[g.key]);
      expect(r.en, g.key).toBe(data.en[g.key]);
      expect(r.jaLang).toBe('ja');
      expect(r.enLang).toBe('en');
      expect(r.policyId).toBe(g.policy);
      expect(r.policy).toBe(POLICY_LABELS[/** @type {keyof typeof POLICY_LABELS} */ (g.policy)]);
      expect(r.noteJa, g.key).toBe(g.note ? g.note.ja : '');
      expect(r.noteEn, g.key).toBe(g.note ? g.note.en : '');
    }
  }
  // spot checks of the copy itself
  const row = (/** @type {string} */ key) => page.locator(`tr[data-key="${key}"]`);
  await expect(row('rokuyo.taian').locator('td').nth(0)).toHaveText('大安');
  await expect(row('rokuyo.taian').locator('td').nth(1)).toHaveText('Taian (Great Peace)');
  await expect(row('sekki.risshun').locator('td').nth(1)).toHaveText('Start of Spring (Risshun)');
  // the table of contents links to every category section and the format section
  const toc = page.getByRole('navigation', { name: 'このページの目次' });
  for (const [category] of CATEGORIES) {
    const id = await page.locator(`section[data-category="${category}"]`).getAttribute('id');
    await expect(toc.locator(`a[href="#${id}"]`)).toHaveCount(1);
  }
  await expect(toc.locator('a[href="#gl-dates"]')).toHaveCount(1);
  // the legend explains each translation policy
  for (const label of Object.values(POLICY_LABELS)) {
    await expect(page.locator('#gl-policies')).toContainText(label);
  }
  expect(problems).toEqual([]);
});

for (const lang of /** @type {const} */ (['ja', 'en'])) {
  test(`format examples match MockI18n.formatDate (page shown with lang=${lang})`, async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(`${pageUrl}?lang=${lang}`);
    const section = page.locator('section#gl-dates');
    await expect(section.locator('h2')).toHaveText('日付・時刻・曜日の書式');
    const rows = await readFormatRows(page);
    // every DateStyle appears, and the weekday table covers a full week
    for (const style of STYLES) expect(rows.some((r) => r.style === style), style).toBe(true);
    expect(rows.filter((r) => r.style === 'weekday').length).toBeGreaterThanOrEqual(7);
    expect(rows.some((r) => /T\d\d:\d\d(:\d\d)?$/.test(r.value)), 'a date-time without an offset').toBe(true);

    // the page language was left as it was
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const actual = await page.evaluate((list) => list.map((r) => window.MockI18n.formatDate(r.value, /** @type {DateStyle} */ (r.style))), rows);
    for (const [i, r] of rows.entries()) {
      expect(r[lang], `${r.style} ${r.value}`).toBe(actual[i]);
      expect(r.ja).not.toBe('');
      expect(r.en).not.toBe('');
    }
    expect(problems).toEqual([]);
  });
}

test('format examples show the documented ja / en forms', async ({ page }) => {
  await page.goto(pageUrl);
  const rows = await readFormatRows(page);
  const find = (/** @type {string} */ style, /** @type {string} */ value) => rows.find((r) => r.style === style && r.value === value);
  expect(find('date-long', '2026-11-16')).toMatchObject({ ja: '2026年11月16日(月)', en: 'Mon, Nov 16, 2026' });
  expect(find('date-short', '2026-11-16')).toMatchObject({ ja: '11月16日(月)', en: 'Mon, Nov 16' });
  expect(find('weekday', '2026-11-16')).toMatchObject({ ja: '月', en: 'Mon' });
  expect(find('time', '2026-11-16T18:42:00+09:00')).toMatchObject({ ja: '18:42', en: '18:42' });
  expect(find('datetime', '2026-11-16T18:42:00+09:00')).toMatchObject({ ja: '2026年11月16日(月) 18:42', en: 'Mon, Nov 16, 2026, 18:42' });
  expect(find('datetime', '2026-11-16T18:42')).toMatchObject({ ja: '2026年11月16日(月) 18:42', en: 'Mon, Nov 16, 2026, 18:42' });
  expect(find('month-year', '2026-11-16')).toMatchObject({ ja: '2026年11月', en: 'November 2026' });
  // ja / en cells are marked with their language
  await expect(page.locator('[data-format-row] [data-lang-cell="ja"]:not([lang="ja"])')).toHaveCount(0);
  await expect(page.locator('[data-format-row] [data-lang-cell="en"]:not([lang="en"])')).toHaveCount(0);
});

test('switching the page language keeps both languages in the examples', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto(pageUrl);
  const before = await readFormatRows(page);
  await page.evaluate(() => window.MockState.update({ lang: 'en' }));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.evaluate(() => window.MockI18n.formatDate('2026-11-16', 'weekday'))).toBe('Mon');
  // both languages stay side by side whatever the page language is
  expect(await readFormatRows(page)).toEqual(before);
  expect(problems).toEqual([]);
});

test.describe('at 375px', () => {
  test.use({ viewport: { width: 375, height: 800 } });
  test('no horizontal page scroll; wide tables scroll inside a focusable region', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(pageUrl);
    await expect(page.locator('section[data-category] table')).toHaveCount(CATEGORIES.length);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const regions = page.locator('main table').locator('xpath=..');
    const count = await regions.count();
    expect(count).toBeGreaterThan(CATEGORIES.length);
    for (let i = 0; i < count; i++) {
      await expect(regions.nth(i)).toHaveAttribute('role', 'region');
      await expect(regions.nth(i)).toHaveAttribute('tabindex', '0');
      await expect(regions.nth(i)).toHaveAttribute('aria-label', /.+/);
    }
    expect(problems).toEqual([]);
  });
});
