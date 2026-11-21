#!/usr/bin/env node
// check-contrast: WCAG 2.1 contrast ratios of the token pairs in tools/contrast-pairs.json, in both
// themes, and identical values in the two dark blocks of tokens.css.
// Requirements 13.1, 13.2 / design: Tools > CheckScripts (check-contrast), DesignTokens.
//
// tokens.css has three theme blocks:
//   light      :root { ... }
//   dark       @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }
//   dark-attr  :root[data-theme="dark"] { ... }
// The two dark blocks must declare exactly the same properties with the same values.
// A theme's values are the light block overlaid with its dark block (palette values live in :root
// only). var(--x[, fallback]) is resolved recursively within that theme; cycles are violations.
//
// Colors: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() (comma or space syntax, % allowed).
// A translucent color (alpha < 1) is a violation: its contrast depends on what lies beneath, so a
// pair must use opaque tokens. Anything else (gradients, named colors, hsl()) is reported as
// unparsable rather than guessed.
//
// contrast-pairs.json: an array of ContrastPair { fg, bg, min: 4.5 | 3, themes: ('light'|'dark')[] }
// (types.d.ts). 4.5 for body text, 3 for large text, icons, borders and focus indicators.
//
// Output: one "file:line message" line per violation on stdout (file relative to the root; pair
// violations point at the pair's line in contrast-pairs.json, dark-block mismatches at tokens.css).
// The result of every pair and theme ("OK|NG theme fg on bg ratio (min N)") goes to stderr.
// Exit code 1 if there is at least one violation, otherwise 0. Read-only.
// Usage: node tools/check-contrast.mjs [rootDir]   (or CHECK_CONTRAST_ROOT=rootDir)
// Self-contained on purpose: no helper module shared with the other check scripts.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const TOKENS_FILE = 'assets/css/tokens.css';
const PAIRS_FILE = 'tools/contrast-pairs.json';
/** @type {readonly ThemeBlock[]} */
const THEMES = ['light', 'dark'];
const MINS = [4.5, 3];

/** @typedef {{ r: number, g: number, b: number, a: number }} Rgba */

// ---------------------------------------------------------------- color math (exported for tests)

/** @param {string} raw @returns {Rgba | null} */
export function parseColor(raw) {
  const s = String(raw).trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (/** @type {number} */ i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = /^rgba?\(\s*([^)]*)\)$/.exec(s);
  if (fn) {
    const body = fn[1].trim();
    let parts;
    let alpha;
    if (body.includes(',')) {
      parts = body.split(',').map((p) => p.trim());
      if (parts.length === 4) alpha = parts.pop();
    } else {
      const [main, a, ...rest] = body.split('/');
      if (rest.length > 0) return null;
      parts = main.trim().split(/\s+/);
      alpha = a?.trim();
    }
    if (parts.length !== 3) return null;
    const channel = (/** @type {string} */ p) => {
      const m = /^(-?\d*\.?\d+)(%?)$/.exec(p);
      if (!m) return NaN;
      const v = m[2] ? (parseFloat(m[1]) * 255) / 100 : parseFloat(m[1]);
      return Math.min(255, Math.max(0, v));
    };
    const [r, g, b] = parts.map(channel);
    let a = 1;
    if (alpha !== undefined) {
      const m = /^(-?\d*\.?\d+)(%?)$/.exec(alpha);
      if (!m) return null;
      a = Math.min(1, Math.max(0, m[2] ? parseFloat(m[1]) / 100 : parseFloat(m[1])));
    }
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b, a };
  }
  return null;
}

/** WCAG 2.1 relative luminance. @param {Rgba} c */
export function relativeLuminance(c) {
  const lin = (/** @type {number} */ v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG 2.1 contrast ratio (1..21), order independent. @param {Rgba} a @param {Rgba} b */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---------------------------------------------------------------- tokens.css parsing

/**
 * @typedef {{ value: string, line: number }} Decl
 * @typedef {{ line: number, decls: Map<string, Decl> }} Block
 */

/** Replaces comments with spaces, keeping newlines (so offsets and line numbers stay valid). */
function stripComments(/** @type {string} */ css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

const norm = (/** @type {string} */ s) => s.replace(/\s+/g, ' ').replace(/'/g, '"').trim();

/**
 * Finds the light, dark (media) and dark (attribute) blocks.
 * @param {string} css
 * @returns {{ light?: Block, darkMedia?: Block, darkAttr?: Block }}
 */
function parseThemeBlocks(css) {
  const src = stripComments(css);
  const lineAt = (/** @type {number} */ i) => src.slice(0, i).split('\n').length;
  /** @type {{ light?: Block, darkMedia?: Block, darkAttr?: Block }} */
  const out = {};
  /** @type {string[]} preludes of the enclosing blocks */
  const stack = [];
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      const prelude = norm(src.slice(start, i).split(/[;}]/).pop() ?? '');
      stack.push(prelude);
      const bodyStart = i + 1;
      const parent = stack.length >= 2 ? stack[stack.length - 2] : '';
      /** @type {'light' | 'darkMedia' | 'darkAttr' | null} */
      let kind = null;
      if (stack.length === 1 && prelude === ':root') kind = 'light';
      else if (stack.length === 1 && prelude === ':root[data-theme="dark"]') kind = 'darkAttr';
      else if (
        stack.length === 2 &&
        prelude === ':root:not([data-theme="light"])' &&
        /^@media\b.*prefers-color-scheme\s*:\s*dark/.test(parent)
      )
        kind = 'darkMedia';
      if (kind) {
        const end = src.indexOf('}', bodyStart);
        const body = src.slice(bodyStart, end < 0 ? src.length : end);
        const block = out[kind] ?? { line: lineAt(i), decls: new Map() };
        let offset = bodyStart;
        for (const piece of body.split(';')) {
          const m = /^(\s*)([-\w]+)\s*:([\s\S]*)$/.exec(piece);
          if (m) block.decls.set(m[2], { value: norm(m[3]), line: lineAt(offset + m[1].length) });
          offset += piece.length + 1;
        }
        out[kind] = block;
      }
      start = i + 1;
    } else if (ch === '}') {
      stack.pop();
      start = i + 1;
    } else if (ch === ';' && stack.length === 0) {
      start = i + 1;
    }
  }
  return out;
}

/**
 * Resolves a token to a color within one theme.
 * @param {string} name
 * @param {Map<string, Decl>} theme
 * @returns {{ color: Rgba, value: string } | { error: string }}
 */
function resolveToken(name, theme) {
  /** @type {string[]} */
  const seen = [];
  /** @param {string} value @returns {{ value: string } | { error: string }} */
  const expand = (value) => {
    let out = '';
    let rest = value;
    for (;;) {
      const i = rest.indexOf('var(');
      if (i < 0) return { value: out + rest };
      out += rest.slice(0, i);
      let depth = 0;
      let j = i + 3;
      for (; j < rest.length; j++) {
        if (rest[j] === '(') depth++;
        else if (rest[j] === ')' && --depth === 0) break;
      }
      const inner = rest.slice(i + 4, j);
      const comma = inner.indexOf(',');
      const ref = (comma < 0 ? inner : inner.slice(0, comma)).trim();
      const fallback = comma < 0 ? undefined : inner.slice(comma + 1).trim();
      const r = lookup(ref, fallback);
      if ('error' in r) return r;
      out += r.value;
      rest = rest.slice(j + 1);
    }
  };
  /** @param {string} ref @param {string | undefined} fallback @returns {{ value: string } | { error: string }} */
  const lookup = (ref, fallback) => {
    if (seen.includes(ref)) return { error: `circular var() reference ${[...seen, ref].join(' -> ')}` };
    const d = theme.get(ref);
    if (!d) {
      if (fallback !== undefined) return expand(fallback);
      return { error: ref === name ? `unknown token ${ref}` : `unknown token ${ref} (referenced from ${name})` };
    }
    seen.push(ref);
    const r = expand(d.value);
    seen.pop();
    return r;
  };
  const r = lookup(name, undefined);
  if ('error' in r) return r;
  const color = parseColor(r.value);
  if (!color) return { error: `${name} is not a parsable color: ${r.value}` };
  if (color.a < 1) return { error: `${name} is translucent (alpha ${+color.a.toFixed(3)}); contrast needs an opaque color: ${r.value}` };
  return { color, value: r.value };
}

// ---------------------------------------------------------------- contrast-pairs.json

/** Line number of the start of each top-level array element. @param {string} text */
function elementLines(text) {
  /** @type {number[]} */
  const lines = [];
  let depth = 0;
  let line = 1;
  let inString = false;
  let expectElement = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') line++;
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (depth === 1 && expectElement && !/\s/.test(ch)) {
      lines.push(line);
      expectElement = false;
    }
    if (ch === '"') inString = true;
    else if (ch === '[' || ch === '{') {
      depth++;
      if (depth === 1) expectElement = true;
    } else if (ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 1) expectElement = true;
  }
  return lines;
}

// ---------------------------------------------------------------- main

function main() {
  const root = resolve(
    process.argv[2] ?? process.env.CHECK_CONTRAST_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..'),
  );
  /** @type {string[]} */
  const violations = [];
  /** @type {string[]} */
  const results = [];
  const report = (/** @type {string} */ file, /** @type {number} */ line, /** @type {string} */ message) =>
    violations.push(`${file}:${Math.max(1, line)} ${message}`);

  const tokensPath = join(root, TOKENS_FILE);
  const pairsPath = join(root, PAIRS_FILE);
  if (!existsSync(tokensPath)) report(TOKENS_FILE, 1, 'file not found');
  if (!existsSync(pairsPath)) report(PAIRS_FILE, 1, 'file not found');

  if (violations.length === 0) {
    const css = readFileSync(tokensPath, 'utf8');
    const blocks = parseThemeBlocks(css);
    if (!blocks.light) report(TOKENS_FILE, 1, 'light block ":root { ... }" not found');
    if (!blocks.darkMedia)
      report(TOKENS_FILE, 1, 'dark block "@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }" not found');
    if (!blocks.darkAttr) report(TOKENS_FILE, 1, 'dark block \':root[data-theme="dark"] { ... }\' not found');

    // The two dark blocks must be identical.
    if (blocks.darkMedia && blocks.darkAttr) {
      const media = blocks.darkMedia;
      const attr = blocks.darkAttr;
      for (const [prop, d] of attr.decls) {
        const m = media.decls.get(prop);
        if (!m) report(TOKENS_FILE, d.line, `dark-mismatch ${prop} is in :root[data-theme="dark"] but not in the prefers-color-scheme: dark block`);
        else if (m.value !== d.value)
          report(TOKENS_FILE, d.line, `dark-mismatch ${prop}: "${d.value}" here, "${m.value}" in the prefers-color-scheme: dark block (line ${m.line})`);
      }
      for (const [prop, m] of media.decls) {
        if (!attr.decls.has(prop))
          report(TOKENS_FILE, m.line, `dark-mismatch ${prop} is in the prefers-color-scheme: dark block but not in :root[data-theme="dark"]`);
      }
    }

    const light = new Map(blocks.light?.decls ?? []);
    const dark = new Map([...light, ...(blocks.darkMedia ?? blocks.darkAttr)?.decls ?? []]);
    /** @type {Record<ThemeBlock, Map<string, Decl>>} */
    const themes = { light, dark };

    const text = readFileSync(pairsPath, 'utf8');
    /** @type {unknown} */
    let pairs;
    try {
      pairs = JSON.parse(text);
    } catch (e) {
      report(PAIRS_FILE, 1, `invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (pairs !== undefined && !Array.isArray(pairs)) report(PAIRS_FILE, 1, 'must be an array of { fg, bg, min, themes }');
    if (Array.isArray(pairs)) {
      const lines = elementLines(text);
      pairs.forEach((/** @type {unknown} */ raw, /** @type {number} */ i) => {
        const line = lines[i] ?? 1;
        const p = /** @type {Partial<Record<keyof ContrastPair, unknown>>} */ (raw ?? {});
        let ok = true;
        const bad = (/** @type {string} */ msg) => {
          report(PAIRS_FILE, line, `invalid-pair #${i + 1}: ${msg}`);
          ok = false;
        };
        if (typeof p.fg !== 'string' || !p.fg.startsWith('--')) bad(`fg must be a custom property name, got ${JSON.stringify(p.fg)}`);
        if (typeof p.bg !== 'string' || !p.bg.startsWith('--')) bad(`bg must be a custom property name, got ${JSON.stringify(p.bg)}`);
        if (typeof p.min !== 'number' || !MINS.includes(p.min)) bad(`min must be 4.5 or 3, got ${JSON.stringify(p.min)}`);
        if (!Array.isArray(p.themes) || p.themes.length === 0) bad('themes must be a non-empty array of "light" | "dark"');
        else
          for (const t of p.themes)
            if (!THEMES.includes(/** @type {ThemeBlock} */ (t))) bad(`unknown theme ${JSON.stringify(t)} (use "light" or "dark")`);
        if (!ok) return;
        const pair = /** @type {ContrastPair} */ (p);
        for (const theme of pair.themes) {
          const fg = resolveToken(pair.fg, themes[theme]);
          const bg = resolveToken(pair.bg, themes[theme]);
          const label = `${theme} ${pair.fg} on ${pair.bg}`;
          if ('error' in fg || 'error' in bg) {
            for (const r of [fg, bg]) if ('error' in r) report(PAIRS_FILE, line, `contrast ${label}: ${r.error}`);
            results.push(`NG ${label} unresolved (min ${pair.min})`);
            continue;
          }
          const ratio = contrastRatio(fg.color, bg.color);
          const shown = ratio.toFixed(2);
          if (ratio >= pair.min) {
            results.push(`OK ${label} ${shown} (min ${pair.min}) ${fg.value} / ${bg.value}`);
          } else {
            results.push(`NG ${label} ${shown} (min ${pair.min}) ${fg.value} / ${bg.value}`);
            report(PAIRS_FILE, line, `contrast ${pair.fg} on ${pair.bg} (theme ${theme}): ${shown}:1 is below ${pair.min}:1 (${fg.value} on ${bg.value})`);
          }
        }
      });
    }
  }

  for (const r of results) console.error(r);
  for (const v of violations) console.log(v);
  console.error(`check-contrast: ${results.length} pair/theme results, ${violations.length} violation(s)`);
  process.exitCode = violations.length > 0 ? 1 : 0;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invokedPath === fileURLToPath(import.meta.url).toLowerCase()) main();
