// Task 1.6: I18nRuntime (assets/js/i18n.js -> window.MockI18n): t() with argument substitution,
// missing-key marker + warning, and formatDate for every DateStyle in ja/en (Asia/Tokyo, 24-hour)
// (11.1, 11.2, 11.7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Loads the dictionaries and i18n.js into one fake browser global. A minimal `document`
 * records event listeners so that tests can send 'mock:change' the way MockState does.
 */
function setup({ withDictionaries = true, htmlLang = 'ja' } = {}) {
  const warnings = [];
  const listeners = {};
  const document = {
    readyState: 'complete',
    documentElement: { getAttribute: (name) => (name === 'lang' ? htmlLang : null) },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    querySelectorAll: () => [],
  };
  const window = {};
  const ctx = vm.createContext({
    window,
    document,
    console: { warn: (...a) => warnings.push(a.join(' ')), log() {}, error() {} },
  });
  const files = [
    ...(withDictionaries ? ['assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js'] : []),
    'assets/js/i18n.js',
  ];
  for (const f of files) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  const setLang = (lang) => {
    for (const fn of listeners['mock:change'] || []) fn({ type: 'mock:change', detail: { lang } });
  };
  return { i18n: window.MockI18n, warnings, setLang };
}

test('exposes window.MockI18n with register / t / formatDate / apply', () => {
  const { i18n } = setup();
  assert.equal(typeof i18n, 'object');
  for (const fn of ['register', 't', 'formatDate', 'apply']) assert.equal(typeof i18n[fn], 'function', fn);
});

test('t() reads dictionaries from window.MockMessages in the current language (default ja)', () => {
  const { i18n, setLang } = setup();
  assert.equal(i18n.t('button.close'), '閉じる');
  setLang('en');
  assert.equal(i18n.t('button.close'), 'Close');
  setLang('ja');
  assert.equal(i18n.t('button.close'), '閉じる');
});

test('initial language follows <html lang> before any mock:change', () => {
  const { i18n } = setup({ htmlLang: 'en' });
  assert.equal(i18n.t('button.close'), 'Close');
});

test('t() substitutes {name} placeholders with string and number args', () => {
  const { i18n, setLang } = setup();
  assert.equal(i18n.t('common.count', { count: 3 }), '3件');
  setLang('en');
  assert.equal(i18n.t('common.count', { count: 12 }), '12 items');
  assert.equal(i18n.t('error.required', { field: 'Title' }), 'Title is required.');
});

test('t() leaves placeholders without a matching arg untouched', () => {
  const { i18n, setLang } = setup();
  setLang('en');
  assert.equal(i18n.t('error.required'), '{field} is required.');
});

test('missing key renders ⟦key⟧ and warns on the console', () => {
  const { i18n, warnings } = setup();
  assert.equal(i18n.t('missing.key'), '⟦missing.key⟧');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /missing\.key/);
});

test('register() adds or overrides entries for a locale', () => {
  const { i18n, setLang } = setup({ withDictionaries: false });
  assert.equal(i18n.t('demo.hello'), '⟦demo.hello⟧');
  i18n.register('ja', { 'demo.hello': 'こんにちは、{name}' });
  i18n.register('en', { 'demo.hello': 'Hello, {name}' });
  assert.equal(i18n.t('demo.hello', { name: 'Hoshi' }), 'こんにちは、Hoshi');
  setLang('en');
  assert.equal(i18n.t('demo.hello', { name: 'Hoshi' }), 'Hello, Hoshi');
});

test('unknown language in mock:change is ignored (keeps the previous language)', () => {
  const { i18n, setLang } = setup();
  setLang('fr');
  assert.equal(i18n.t('button.close'), '閉じる');
});

const DATE = '2026-11-16';
const DATETIME = '2026-11-16T18:42:00+09:00';

const EXPECTED = {
  ja: {
    'date-long': [DATE, '2026年11月16日(月)'],
    'date-short': [DATE, '11月16日(月)'],
    weekday: [DATE, '月'],
    time: [DATETIME, '18:42'],
    datetime: [DATETIME, '2026年11月16日(月) 18:42'],
    'month-year': [DATE, '2026年11月'],
  },
  en: {
    'date-long': [DATE, 'Mon, Nov 16, 2026'],
    'date-short': [DATE, 'Mon, Nov 16'],
    weekday: [DATE, 'Mon'],
    time: [DATETIME, '18:42'],
    datetime: [DATETIME, 'Mon, Nov 16, 2026, 18:42'],
    'month-year': [DATE, 'November 2026'],
  },
};

for (const lang of ['ja', 'en']) {
  for (const [style, [input, expected]] of Object.entries(EXPECTED[lang])) {
    test(`formatDate ${lang} ${style}: ${input} -> ${expected}`, () => {
      const { i18n, setLang } = setup();
      setLang(lang);
      assert.equal(i18n.formatDate(input, style), expected);
    });
  }
}

// Post-validation cleanup: an explicit language formats in that language without changing the
// current one (glossary.html shows ja and en side by side without dispatching mock:change).
for (const pageLang of ['ja', 'en']) {
  test(`formatDate with an explicit lang ignores the current language (${pageLang})`, () => {
    const { i18n, setLang, warnings } = setup();
    setLang(pageLang);
    for (const lang of ['ja', 'en']) {
      for (const [style, [input, expected]] of Object.entries(EXPECTED[lang])) {
        assert.equal(i18n.formatDate(input, style, lang), expected, `${lang} ${style}`);
      }
    }
    // The current language is unchanged.
    assert.equal(i18n.formatDate(DATE, 'date-long'), EXPECTED[pageLang]['date-long'][1]);
    assert.deepEqual(warnings, []);
  });
}

test('formatDate with an unknown lang warns and uses the current language', () => {
  const { i18n, warnings } = setup();
  assert.equal(i18n.formatDate(DATE, 'date-long', 'fr'), '2026年11月16日(月)');
  assert.ok(warnings.some((w) => /unknown lang "fr"/.test(w)), warnings.join(' | '));
});

test('formatDate is fixed to Asia/Tokyo and 24-hour regardless of the input offset', () => {
  const { i18n, setLang } = setup();
  // 09:42 UTC == 18:42 JST; 15:05 UTC == 00:05 JST on the next day
  assert.equal(i18n.formatDate('2026-11-16T09:42:00Z', 'time'), '18:42');
  assert.equal(i18n.formatDate('2026-11-16T15:05:00Z', 'datetime'), '2026年11月17日(火) 00:05');
  setLang('en');
  assert.equal(i18n.formatDate('2026-11-16T15:05:00Z', 'datetime'), 'Tue, Nov 17, 2026, 00:05');
  assert.equal(i18n.formatDate('2026-11-16T04:07:00+09:00', 'time'), '04:07');
});

test('formatDate treats a date-only value as that calendar day in Tokyo', () => {
  const { i18n } = setup();
  assert.equal(i18n.formatDate('2026-01-01', 'date-long'), '2026年1月1日(木)');
  assert.equal(i18n.formatDate('2026-12-31', 'weekday'), '木');
});

test('formatDate on an invalid value returns the raw value and warns', () => {
  const { i18n, warnings } = setup();
  assert.equal(i18n.formatDate('not-a-date', 'date-long'), 'not-a-date');
  assert.equal(warnings.length, 1);
});
