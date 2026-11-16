#!/usr/bin/env node
// check-i18n: static check of the message dictionaries (assets/i18n/messages.{locale}.js)
// against the keys used by the product pages, scripts and sample data.
// Requirements 11.1, 11.5 / design: Tools > CheckScripts (check-i18n), Data > MessageDictionaries,
// Core > I18nRuntime (markup conventions).
//
// Checks:
// - every used key exists in every locale dictionary (reported at the usage, with the locale)
// - all locales have the same key set (reported at the dictionary line that has the extra key)
// - every key (dictionary or used) matches /^[a-z0-9-]+(\.[a-z0-9-]+)+$/ (language independent)
// - every glossary key (data/glossary.js -> window.MockGlossary[].key) exists in the dictionaries
//
// Locales are discovered from assets/i18n/messages.*.js; each file is evaluated with node:vm
// against a fake `window` and must register window.MockMessages.{locale}.
//
// Where used keys come from:
// - HTML: every *.html under the root except tests/, node_modules/, test-results/ (test fixtures
//   intentionally hold missing keys). data-i18n="key", data-i18n-attr="attr:key;attr2:key2".
//   data-i18n-date holds a date, not a key. Inline <script> bodies are scanned like JS.
// - JS: assets/js/**/*.js and data/*.js (comments are ignored):
//   * the first argument of t(...) / X.t(...) when it is a string literal
//   * string values (or string arrays) of properties named key/keys or ending in Key/Keys
//   * data-i18n / data-i18n-attr attributes inside string and template literals
// - data/*.js is also evaluated with node:vm and every string under a key/keys/*Key/*Keys
//   property of the registered window.Mock* objects is collected, so keys built at load time
//   (e.g. titleKey: `screen.${id}.title` in data/screens.js) are checked with their real value.
// Keys computed at run time in assets/js (template literals with ${...}, variables) cannot be
// known statically and are skipped; such keys must also be reachable from data (above) or HTML.
//
// Output: one "file:line message" line per violation on stdout (file is relative to the root);
// exit code 1 if there is at least one violation, otherwise 0. Read-only.
// Usage: node tools/check-i18n.mjs [rootDir]   (or CHECK_I18N_ROOT=rootDir)
// Self-contained on purpose: no helper module shared with the other check scripts.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve, sep } from 'node:path';
import vm from 'node:vm';

const KEY_FORMAT = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const I18N_DIR = 'assets/i18n';
const GLOSSARY_FILE = 'data/glossary.js';
const SKIP_DIRS = new Set(['node_modules', 'tests', 'test-results', '.git', 'tools']);

const root = resolve(
  process.argv[2] ?? process.env.CHECK_I18N_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..'),
);

/** @type {string[]} */
const violations = [];
/** @param {string} file @param {number} line @param {string} message */
const report = (file, line, message) => violations.push(`${file}:${Math.max(1, line)} ${message}`);

/** 1-based line number of a character offset in src. */
const lineAt = (src, offset) => src.slice(0, offset).split('\n').length;

/** @param {string} abs */
const rel = (abs) => relative(root, abs).split(sep).join('/');

// ---- files -----------------------------------------------------------------

/** @param {string} dir @param {(name: string) => boolean} accept @returns {string[]} absolute paths, sorted */
function walk(dir, accept) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      if (!SKIP_DIRS.has(name)) out.push(...walk(abs, accept));
    } else if (accept(name)) {
      out.push(abs);
    }
  }
  return out;
}

/** Evaluates a classic script against a fresh fake `window`; returns the window or an error. */
function evaluate(file, src) {
  /** @type {Record<string, unknown>} */
  const window = {};
  try {
    vm.runInContext(src, vm.createContext({ window }), { filename: file, timeout: 5000 });
    return { window };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    const name = file.split('/').pop() ?? file;
    const at = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+)`).exec(String(e.stack ?? ''))?.[1];
    return { error: `failed to evaluate: ${e.message}`, line: at ? Number(at) : 1 };
  }
}

// ---- source scanning -------------------------------------------------------

/**
 * Replaces JS comments with spaces (newlines kept, so offsets and lines stay valid).
 * Understands string, template (with nested ${...}) and regex literals well enough for the
 * classic scripts of this mock.
 * @param {string} src
 */
function stripJsComments(src) {
  const out = src.split('');
  /** @type {number[]} brace depth of each open ${ ... } */
  const tplStack = [];
  let depth = 0;
  let i = 0;
  let prevSignificant = '';
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
  };
  /** Scans a template literal body from i (just after ` or }) to its end or the next ${. */
  const scanTemplate = () => {
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; return; }
      if (c === '$' && src[i + 1] === '{') { i += 2; tplStack.push(depth); depth++; return; }
      i++;
    }
  };
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? src.length : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === '\'' || c === '"') {
      i++;
      while (i < src.length && src[i] !== c && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
      i++;
      prevSignificant = c;
      continue;
    }
    if (c === '`') {
      i++;
      scanTemplate();
      prevSignificant = '`';
      continue;
    }
    if (c === '/' && (prevSignificant === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prevSignificant))) {
      // regex literal
      i++;
      let inClass = false;
      while (i < src.length && src[i] !== '\n') {
        const r = src[i];
        if (r === '\\') { i += 2; continue; }
        if (r === '[') inClass = true;
        else if (r === ']') inClass = false;
        else if (r === '/' && !inClass) break;
        i++;
      }
      i++;
      prevSignificant = 'a';
      continue;
    }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (tplStack.length && tplStack[tplStack.length - 1] === depth) {
        tplStack.pop();
        i++;
        scanTemplate();
        prevSignificant = '`';
        continue;
      }
    }
    if (!/\s/.test(c)) prevSignificant = /[\w$)\].]/.test(c) ? 'a' : c;
    i++;
  }
  return out.join('');
}

/** Replaces HTML comments with spaces (newlines kept). @param {string} src */
const stripHtmlComments = (src) => src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\r\n]/g, ' '));

/**
 * @typedef {{ file: string, line: number, key: string }} Usage
 */

/** A key literal is checkable only when it has no interpolation. @param {string} v */
const isStatic = (v) => !v.includes('${');

/**
 * data-i18n="key" and data-i18n-attr="attr:key;..." attributes in markup (also inside JS strings).
 * Both quote styles; escaped quotes (\") as they appear inside JS string literals are accepted.
 * @param {string} file @param {string} src @param {Usage[]} out
 */
function scanAttributes(file, src, out) {
  const attr = /(?<![\w-])data-i18n(-attr)?\s*=\s*\\?(["'])([^"'\\<>]*)\\?\2/g;
  for (const m of src.matchAll(attr)) {
    const value = m[3];
    const base = (m.index ?? 0);
    if (!isStatic(value) || value.includes('{')) continue;
    if (m[1]) {
      for (const pair of value.split(';')) {
        const at = pair.indexOf(':');
        if (at <= 0) continue;
        const key = pair.slice(at + 1).trim();
        if (key) out.push({ file, line: lineAt(src, base), key });
      }
    } else if (value.trim()) {
      out.push({ file, line: lineAt(src, base), key: value.trim() });
    }
  }
}

const STRING_LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/y;

/**
 * Reads the string literal at `pos` (after optional whitespace). Returns its value and offset,
 * or null. Template literals with ${...} return null (dynamic).
 * @param {string} src @param {number} pos
 */
function literalAt(src, pos) {
  let p = pos;
  while (p < src.length && /\s/.test(src[p])) p++;
  STRING_LITERAL.lastIndex = p;
  const m = STRING_LITERAL.exec(src);
  if (!m) return null;
  const value = m[1] ?? m[2] ?? m[3] ?? '';
  if (m[3] !== undefined && !isStatic(value)) return null;
  return { value, offset: p, end: STRING_LITERAL.lastIndex };
}

/** Property names whose values are message keys: key, keys, *Key, *Keys. */
const KEY_PROP = /^(?:keys?|[A-Za-z0-9_$]*[a-z0-9](?:Key|Keys))$/;

/**
 * t('key') calls, key/*Key properties and markup attributes in JS source.
 * @param {string} file @param {string} rawSrc @param {Usage[]} out
 */
function scanJs(file, rawSrc, out) {
  const src = stripJsComments(rawSrc);
  // t('key', ...) / MockI18n.t('key') / this.t('key')
  for (const m of src.matchAll(/(?<![\w$])t\s*\(/g)) {
    const lit = literalAt(src, (m.index ?? 0) + m[0].length);
    if (lit) out.push({ file, line: lineAt(src, lit.offset), key: lit.value });
  }
  // titleKey: 'k', key: "k", zassetsuKeys: ['a', 'b'] (optionally Object.freeze([...]))
  for (const m of src.matchAll(/(?<![\w$.'"`])([A-Za-z_$][\w$]*)\s*:(?!:)/g)) {
    if (!KEY_PROP.test(m[1])) continue;
    let p = (m.index ?? 0) + m[0].length;
    const lit = literalAt(src, p);
    if (lit) {
      out.push({ file, line: lineAt(src, lit.offset), key: lit.value });
      continue;
    }
    const arr = /\s*(?:Object\.freeze\(\s*)?\[/y;
    arr.lastIndex = p;
    if (!arr.exec(src)) continue;
    p = arr.lastIndex;
    for (;;) {
      const item = literalAt(src, p);
      if (!item) break;
      out.push({ file, line: lineAt(src, item.offset), key: item.value });
      const sepRe = /\s*,/y;
      sepRe.lastIndex = item.end;
      if (!sepRe.exec(src)) break;
      p = sepRe.lastIndex;
    }
  }
  scanAttributes(file, src, out);
}

/**
 * Markup attributes plus inline <script> bodies of an HTML page.
 * @param {string} file @param {string} rawSrc @param {Usage[]} out
 */
function scanHtml(file, rawSrc, out) {
  const src = stripHtmlComments(rawSrc);
  scanAttributes(file, src, out);
  // Inline scripts: scan with everything else masked so offsets map to the page's lines.
  const masked = src.replace(/[^\r\n]/g, ' ').split('');
  let hasInline = false;
  for (const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(m[1]) || m[2].trim() === '') continue;
    hasInline = true;
    const start = (m.index ?? 0) + m[0].indexOf('>') + 1;
    for (let k = 0; k < m[2].length; k++) masked[start + k] = m[2][k];
  }
  if (hasInline) scanJs(file, masked.join(''), out);
}

// ---- runtime data ----------------------------------------------------------

/**
 * Collects every string under a key/*Key property in a registered data object.
 * @param {unknown} value @param {(prop: string, key: string) => void} found
 */
function collectDataKeys(value, found, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const [prop, v] of Object.entries(value)) {
    if (KEY_PROP.test(prop)) {
      if (typeof v === 'string') found(prop, v);
      else if (Array.isArray(v)) for (const s of v) if (typeof s === 'string') found(prop, s);
    }
    collectDataKeys(v, found, seen);
  }
}

/** Best line for a runtime key in a data file: its literal, else its property, else 1. */
function dataLine(src, prop, key) {
  for (const q of ['\'', '"', '`']) {
    const at = src.indexOf(`${q}${key}${q}`);
    if (at !== -1) return lineAt(src, at);
  }
  const p = new RegExp(`(?<![\\w$])${prop.replace(/\$/g, '\\$')}\\s*:`).exec(src);
  return p ? lineAt(src, p.index) : 1;
}

// ---- dictionaries ----------------------------------------------------------

/** @typedef {{ locale: string, file: string, src: string, keys: Set<string> }} Dictionary */

/** @returns {Dictionary[]} */
function loadDictionaries() {
  /** @type {Dictionary[]} */
  const dicts = [];
  const dir = join(root, I18N_DIR);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^messages\.[^.]+\.js$/.test(f)).sort() : [];
  if (files.length === 0) report(`${I18N_DIR}/messages.ja.js`, 1, 'no dictionary files (assets/i18n/messages.{locale}.js) found');
  for (const name of files) {
    const locale = name.slice('messages.'.length, -'.js'.length);
    const file = `${I18N_DIR}/${name}`;
    const src = readFileSync(join(dir, name), 'utf8');
    const r = evaluate(file, src);
    if (!r.window) {
      report(file, r.line, r.error);
      continue;
    }
    /** @type {unknown} */
    const all = r.window.MockMessages;
    const dict = all !== null && typeof all === 'object' ? Object.getOwnPropertyDescriptor(all, locale)?.value : undefined;
    if (!dict || typeof dict !== 'object') {
      report(file, 1, `does not register window.MockMessages.${locale}`);
      continue;
    }
    /** @type {Set<string>} */
    const keys = new Set();
    for (const [k, v] of Object.entries(dict)) {
      keys.add(k);
      if (typeof v !== 'string') report(file, keyLine(src, k), `key "${k}" has a non-string message`);
    }
    dicts.push({ locale, file, src, keys });
  }
  return dicts;
}

/** Line of a dictionary entry `'key':`. */
function keyLine(src, key) {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(['"\`])${esc}\\1\\s*:`).exec(src) ?? new RegExp(`(?<![\\w$])${esc}\\s*:`).exec(src);
  return m ? lineAt(src, m.index) : 1;
}

// ---- checks ----------------------------------------------------------------

function main() {
  const dicts = loadDictionaries();

  // Dictionary key format and key set equality across locales.
  for (const d of dicts) {
    for (const k of d.keys) {
      if (!KEY_FORMAT.test(k)) {
        report(d.file, keyLine(d.src, k), `key "${k}" does not match the key format ${KEY_FORMAT}`);
      }
      for (const other of dicts) {
        if (other !== d && !other.keys.has(k)) {
          report(d.file, keyLine(d.src, k), `key "${k}" is not in ${other.locale} (${other.file}); key sets must match`);
        }
      }
    }
  }

  /** @type {Usage[]} */
  const usages = [];
  for (const abs of walk(root, (n) => n.endsWith('.html'))) {
    scanHtml(rel(abs), readFileSync(abs, 'utf8'), usages);
  }
  const jsFiles = [
    ...walk(join(root, 'assets', 'js'), (n) => n.endsWith('.js')),
    ...walk(join(root, 'data'), (n) => n.endsWith('.js')),
  ].filter((abs) => rel(abs) !== GLOSSARY_FILE);
  for (const abs of jsFiles) {
    const file = rel(abs);
    const src = readFileSync(abs, 'utf8');
    scanJs(file, src, usages);
    if (!file.startsWith('data/')) continue;
    // Values built at load time (e.g. titleKey: `screen.${id}.title`).
    const r = evaluate(file, src);
    if (!r.window) {
      report(file, r.line, r.error);
      continue;
    }
    for (const [name, value] of Object.entries(r.window)) {
      if (name === 'MockMessages' || name === 'MockGlossary') continue;
      collectDataKeys(value, (prop, key) => {
        if (!usages.some((u) => u.file === file && u.key === key)) {
          usages.push({ file, line: dataLine(src, prop, key), key });
        }
      });
    }
  }

  // Used keys: format, then presence in every locale (one line per usage location).
  const seen = new Set();
  for (const u of usages) {
    const id = `${u.file}:${u.line}:${u.key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!KEY_FORMAT.test(u.key)) {
      report(u.file, u.line, `used key "${u.key}" does not match the key format ${KEY_FORMAT}`);
      continue;
    }
    const missing = dicts.filter((d) => !d.keys.has(u.key));
    if (missing.length) {
      report(u.file, u.line, `key "${u.key}" is missing from ${missing.map((d) => `${d.locale} (${d.file})`).join(', ')}`);
    }
  }

  // Glossary keys.
  const glossaryAbs = join(root, GLOSSARY_FILE);
  if (existsSync(glossaryAbs)) {
    const src = readFileSync(glossaryAbs, 'utf8');
    const r = evaluate(GLOSSARY_FILE, src);
    if (!r.window) {
      report(GLOSSARY_FILE, r.line, r.error);
    } else {
      /** @type {unknown} */
      const glossary = r.window.MockGlossary;
      if (!Array.isArray(glossary)) {
        report(GLOSSARY_FILE, 1, 'does not register window.MockGlossary as an array');
      } else {
        for (const entry of glossary) {
          const key = entry !== null && typeof entry === 'object' ? Object.getOwnPropertyDescriptor(entry, 'key')?.value : undefined;
          if (typeof key !== 'string') {
            report(GLOSSARY_FILE, 1, 'glossary entry without a string key');
            continue;
          }
          const line = dataLine(src, 'key', key);
          if (!KEY_FORMAT.test(key)) {
            report(GLOSSARY_FILE, line, `glossary key "${key}" does not match the key format ${KEY_FORMAT}`);
            continue;
          }
          const missing = dicts.filter((d) => !d.keys.has(key));
          if (missing.length) {
            report(GLOSSARY_FILE, line, `glossary key "${key}" is missing from ${missing.map((d) => `${d.locale} (${d.file})`).join(', ')}`);
          }
        }
      }
    }
  }
}

main();
for (const v of violations) console.log(v);
process.exit(violations.length ? 1 : 0);
