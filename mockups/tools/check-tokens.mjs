#!/usr/bin/env node
// check-tokens: product CSS must use design tokens only (no color or non-zero length literals).
// Requirement 10.4 / design: Tools > CheckScripts (check-tokens), DesignTokens (breakpoints).
//
// Scope: assets/css/base.css and assets/css/components.css. Token definitions live in tokens.css
// (and the grey overrides in wireframe.css); those files are not scanned. review.css is not product CSS.
//
// Rules (TokenCheckRule in types.d.ts):
// - color-literal:    #hex, rgb()/rgba(), hsl()/hsla() (and the other CSS color functions),
//                     named colors (red, white, ...). Keywords such as transparent, currentColor,
//                     inherit are allowed.
// - length-literal:   non-zero px / rem / em values, including inside calc(). Zero with a unit (0px)
//                     is still zero and allowed. % and unitless numbers are not lengths here.
// - media-breakpoint: lengths in an @media prelude must be px values equal to a --bp-* token in
//                     tokens.css (CSS variables cannot be used in @media).
//
// Only declaration values and @media preludes are inspected: comments, strings, url() contents,
// selectors and property names are ignored. Custom property definitions (--x: 12px) inside
// base/components.css are checked like any other declaration, because a literal there is an
// undeclared token that bypasses tokens.css.
//
// Output: one "file:line message" line per violation on stdout (file is relative to the root);
// exit code 1 if there is at least one violation, otherwise 0. Read-only.
// Usage: node tools/check-tokens.mjs [rootDir]   (or CHECK_TOKENS_ROOT=rootDir)
// Self-contained on purpose: no helper module shared with the other check scripts.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const TOKENS_FILE = 'assets/css/tokens.css';
const TARGET_FILES = ['assets/css/base.css', 'assets/css/components.css'];

// CSS named colors (CSS Color 4), lower case. Not included: transparent, currentcolor, system colors.
const NAMED_COLORS = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown ' +
  'burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan ' +
  'darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid ' +
  'darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet ' +
  'deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ' +
  'ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
  'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow ' +
  'lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
  'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine ' +
  'mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise ' +
  'mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab ' +
  'orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru ' +
  'pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
  'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan ' +
  'teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
).split(' ');

// An identifier boundary: not part of a longer ident (so --color-red or red-500 do not match).
const IDENT_START = '(?<![\\w-])';
const IDENT_END = '(?![\\w-])';
const LENGTH = `${IDENT_START}(-?(?:\\d+\\.?\\d*|\\.\\d+))(px|rem|em)${IDENT_END}`;

/** @type {readonly TokenCheckRule[]} */
const RULES = [
  {
    id: 'color-literal',
    pattern: new RegExp(
      `#[0-9a-fA-F]{3,8}${IDENT_END}` +
        `|${IDENT_START}(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(` +
        `|${IDENT_START}(?:${NAMED_COLORS.join('|')})${IDENT_END}`,
      'gi',
    ),
    appliesTo: TARGET_FILES,
  },
  { id: 'length-literal', pattern: new RegExp(LENGTH, 'gi'), appliesTo: TARGET_FILES },
  { id: 'media-breakpoint', pattern: new RegExp(LENGTH, 'gi'), appliesTo: TARGET_FILES },
];

const rule = (/** @type {TokenCheckRule['id']} */ id) => /** @type {TokenCheckRule} */ (RULES.find((r) => r.id === id));

const root = resolve(
  process.argv[2] ?? process.env.CHECK_TOKENS_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..'),
);

/** @type {string[]} */
const violations = [];
/** @param {string} file @param {number} line @param {string} message */
const report = (file, line, message) => violations.push(`${file}:${Math.max(1, line)} ${message}`);

/** 1-based line number of a character offset in src. */
const lineAt = (/** @type {string} */ src, /** @type {number} */ offset) => src.slice(0, offset).split('\n').length;

/** Replaces every non-newline character of a match with a space, so offsets and lines are kept. */
const blank = (/** @type {string} */ s) => s.replace(/[^\n]/g, ' ');

/**
 * Blanks out comments, string contents and url(...) contents, keeping offsets.
 * @param {string} src
 */
function mask(src) {
  return src
    .replace(/\/\*[\s\S]*?(?:\*\/|$)/g, blank)
    .replace(/"(?:[^"\\\n]|\\[\s\S])*"|'(?:[^'\\\n]|\\[\s\S])*'/g, (s) => s[0] + blank(s.slice(1, -1)) + s.at(-1))
    .replace(/\burl\(([^)]*)\)/gi, (s, inner) => `url(${blank(inner)})`);
}

/**
 * Splits masked CSS into preludes (text before `{`) and declarations (text before `;` or `}`).
 * @param {string} css
 * @returns {{ kind: 'prelude' | 'declaration', text: string, start: number }[]}
 */
function segments(css) {
  const out = [];
  let start = 0;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch !== '{' && ch !== '}' && ch !== ';') continue;
    const text = css.slice(start, i);
    if (text.trim() !== '') out.push({ kind: ch === '{' ? 'prelude' : 'declaration', text, start });
    start = i + 1;
  }
  return /** @type {{ kind: 'prelude' | 'declaration', text: string, start: number }[]} */ (out);
}

/** Breakpoint values (px numbers) from the --bp-* tokens in tokens.css. */
function readBreakpoints() {
  const path = join(root, TOKENS_FILE);
  if (!existsSync(path)) {
    report(TOKENS_FILE, 1, 'media-breakpoint: tokens.css not found (breakpoint tokens are read from it)');
    return new Set();
  }
  const css = mask(readFileSync(path, 'utf8'));
  const values = new Set([...css.matchAll(/--bp-[\w-]+\s*:\s*(\d+(?:\.\d+)?)px\s*[;}]/g)].map((m) => Number(m[1])));
  if (values.size === 0) report(TOKENS_FILE, 1, 'media-breakpoint: no --bp-* breakpoint tokens found');
  return values;
}

/**
 * @param {string} file relative path
 * @param {Set<number>} breakpoints
 */
function checkFile(file, breakpoints) {
  const path = join(root, file);
  if (!existsSync(path)) {
    report(file, 1, 'file not found');
    return;
  }
  const src = readFileSync(path, 'utf8');
  const css = mask(src);
  const color = rule('color-literal');
  const length = rule('length-literal');
  const media = rule('media-breakpoint');

  for (const seg of segments(css)) {
    if (seg.kind === 'prelude') {
      // Selectors are not values; only @media preludes carry lengths that need checking.
      const at = /^\s*@media\b/i.exec(seg.text);
      if (!at || !media.appliesTo.includes(file)) continue;
      for (const m of seg.text.matchAll(media.pattern)) {
        const value = Number(m[1]);
        if (m[2].toLowerCase() === 'px' && breakpoints.has(value)) continue;
        report(
          file,
          lineAt(src, seg.start + (m.index ?? 0)),
          `media-breakpoint: ${m[0]} is not a breakpoint token value (${[...breakpoints].map((b) => `${b}px`).join(', ')})`,
        );
      }
      continue;
    }
    const colon = seg.text.indexOf(':');
    if (colon < 0) continue;
    const valueStart = seg.start + colon + 1;
    const value = seg.text.slice(colon + 1);
    const prop = seg.text.slice(0, colon).trim();
    if (color.appliesTo.includes(file)) {
      for (const m of value.matchAll(color.pattern)) {
        const literal = m[0].endsWith('(') ? `${m[0]})` : m[0];
        report(file, lineAt(src, valueStart + (m.index ?? 0)), `color-literal: ${literal} in "${prop}" (use a color token)`);
      }
    }
    if (length.appliesTo.includes(file)) {
      for (const m of value.matchAll(length.pattern)) {
        if (Number(m[1]) === 0) continue;
        report(file, lineAt(src, valueStart + (m.index ?? 0)), `length-literal: ${m[0]} in "${prop}" (use a size token)`);
      }
    }
  }
}

const breakpoints = readBreakpoints();
for (const file of TARGET_FILES) checkFile(file, breakpoints);

for (const v of violations) console.log(v);
process.exitCode = violations.length > 0 ? 1 : 0;
