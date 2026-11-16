// Task 1.3: base message dictionaries (ja/en) and the empty glossary registry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Loads classic scripts in order into one fake browser global and returns its `window`. */
function load(...files) {
  const window = {};
  const ctx = vm.createContext({ window });
  for (const f of files) {
    vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  }
  return window;
}

const KEY_FORMAT = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const SCREEN_IDS = [
  'top', 'calendar-month', 'day-detail', 'astro-events', 'star-chart',
  'post-detail', 'post-edit', 'my-posts', 'settings', 'login',
  'report', 'appeal', 'admin', 'attribution', 'privacy',
];
const placeholders = (s) => [...s.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]).sort();

const dicts = () => {
  const w = load('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
  return { ja: w.MockMessages?.ja, en: w.MockMessages?.en };
};

test('ja and en register into window.MockMessages in any order', () => {
  const a = load('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
  const b = load('assets/i18n/messages.en.js', 'assets/i18n/messages.ja.js');
  for (const w of [a, b]) {
    assert.equal(typeof w.MockMessages?.ja, 'object');
    assert.equal(typeof w.MockMessages?.en, 'object');
  }
});

test('ja and en have identical key sets', () => {
  const { ja, en } = dicts();
  assert.deepEqual(Object.keys(ja).sort(), Object.keys(en).sort());
});

test('every key matches the language-independent key format and every value is a non-empty string', () => {
  const { ja, en } = dicts();
  for (const d of [ja, en]) {
    for (const [k, v] of Object.entries(d)) {
      assert.match(k, KEY_FORMAT, `bad key ${k}`);
      assert.equal(typeof v, 'string', `value of ${k}`);
      assert.ok(v.trim().length > 0, `empty value for ${k}`);
    }
  }
});

test('all 15 screen title keys exist in both languages', () => {
  const { ja, en } = dicts();
  for (const id of SCREEN_IDS) {
    const key = `screen.${id}.title`;
    assert.ok(key in ja, `ja missing ${key}`);
    assert.ok(key in en, `en missing ${key}`);
  }
});

test('common navigation, buttons, theme/lang toggles and error/empty states are present', () => {
  const { ja } = dicts();
  for (const key of [
    'nav.calendar', 'nav.astro-events', 'nav.star-chart', 'nav.my-posts', 'nav.settings', 'nav.admin',
    'nav.login', 'nav.logout',
    'toggle.lang.label', 'toggle.lang.ja', 'toggle.lang.en',
    'toggle.theme.label', 'toggle.theme.system', 'toggle.theme.light', 'toggle.theme.dark',
    'button.save', 'button.cancel', 'button.submit', 'button.back', 'button.delete', 'button.edit',
    'button.post', 'button.reply', 'button.report', 'button.like',
    'error.fetch', 'error.validation', 'error.no-permission', 'error.missing-sample',
    'empty.list',
  ]) {
    assert.ok(key in ja, `missing ${key}`);
  }
});

test('placeholders match between ja and en for every key', () => {
  const { ja, en } = dicts();
  for (const k of Object.keys(ja)) {
    assert.deepEqual(placeholders(ja[k]), placeholders(en[k]), `placeholder mismatch in ${k}`);
  }
});

test('dictionaries are frozen', () => {
  const { ja, en } = dicts();
  assert.ok(Object.isFrozen(ja));
  assert.ok(Object.isFrozen(en));
});

test('glossary registers an array on window.MockGlossary (entries are added in task 3.1, see glossary.test.mjs)', () => {
  const w = load('data/glossary.js');
  assert.ok(Array.isArray(w.MockGlossary));
});
