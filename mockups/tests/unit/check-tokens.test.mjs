// Task 2.2: tools/check-tokens.mjs (no color / non-zero length literals outside the token definitions).
// Runs the script as a child process against the real tree and against temp copies of assets/css
// where base.css / components.css are modified.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(root, 'tools', 'check-tokens.mjs');
const COMPONENTS = 'assets/css/components.css';
const BASE = 'assets/css/base.css';

/** @param {string[]} args @param {Record<string,string>} [env] */
function run(args, env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  const lines = r.stdout.split(/\r?\n/).filter((l) => l.trim() !== '');
  return { status: r.status, lines, stdout: r.stdout, stderr: r.stderr };
}

/** Copies assets/css to a temp root; `css` maps a relative path to text appended to (or replacing) it. */
function fixture({ append = {}, replace = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'check-tokens-'));
  mkdirSync(join(dir, 'assets'), { recursive: true });
  cpSync(join(root, 'assets', 'css'), join(dir, 'assets', 'css'), { recursive: true });
  for (const [p, s] of Object.entries(append)) {
    writeFileSync(join(dir, p), readFileSync(join(dir, p), 'utf8') + s);
  }
  for (const [p, s] of Object.entries(replace)) writeFileSync(join(dir, p), s);
  return dir;
}

/** Runs the check on a fixture and removes it. */
function check(opts) {
  const dir = fixture(opts);
  try {
    return run([dir]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const LINE_FORMAT = /^([\w./-]+):(\d+) \S.*$/;

function assertViolation(result, file, line, messagePattern) {
  assert.equal(result.status, 1, `expected exit 1, got ${result.status}\n${result.stdout}${result.stderr}`);
  for (const l of result.lines) assert.match(l, LINE_FORMAT, `bad line format: ${l}`);
  const hit = result.lines.find((l) => l.startsWith(`${file}:${line} `) && messagePattern.test(l));
  assert.ok(hit, `no violation ${file}:${line} matching ${messagePattern}:\n${result.stdout}`);
}

function assertClean(result) {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.lines.length, 0, result.stdout);
}

test('current tree: exits 0 with no violation lines', () => {
  assertClean(run([]));
});

test('accepts the root as an argument and via CHECK_TOKENS_ROOT', () => {
  const dir = fixture({ append: { [COMPONENTS]: '\n.x {\n  color: #ff0000;\n}\n' } });
  try {
    assert.equal(run([dir]).status, 1);
    assert.equal(run([], { CHECK_TOKENS_ROOT: dir }).status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hex color in components.css is reported at its line', () => {
  const css = '.a {\n  display: block;\n  color: #1a2B3c;\n}\n';
  assertViolation(check({ replace: { [COMPONENTS]: css } }), COMPONENTS, 3, /color-literal.*#1a2B3c/);
});

test('rgb()/rgba()/hsl()/hsla() and named colors are reported', () => {
  const css = [
    '.a {', //                                   1
    '  color: rgb(0 0 0);', //                   2
    '  background: rgba(0, 0, 0, 0.5);', //      3
    '  border-color: hsl(200 50% 50%);', //      4
    '  outline-color: hsla(200, 50%, 50%, 1);', // 5
    '  fill: White;', //                         6
    '  box-shadow: 0 0 0 var(--x) red;', //     7
    '}',
  ].join('\n');
  const r = check({ replace: { [COMPONENTS]: css } });
  for (const [line, pat] of [[2, /rgb\(/], [3, /rgba\(/], [4, /hsl\(/], [5, /hsla\(/], [6, /White/], [7, /red/]]) {
    assertViolation(r, COMPONENTS, line, new RegExp(`color-literal.*${pat.source}`));
  }
});

test('color keywords, var() names, selectors and url() contents are not color literals', () => {
  const css = [
    '.text-red,',
    '.bg-white:hover {',
    '  color: currentColor;',
    '  background-color: transparent;',
    '  border-color: inherit;',
    '  fill: var(--color-red);',
    '  background-image: url("img/red-8px.svg#black");',
    '  content: "#fff 8px white";',
    '  font-family: var(--font-body);',
    '}',
  ].join('\n');
  assertClean(check({ replace: { [COMPONENTS]: css } }));
});

test('non-zero px / rem / em lengths are reported (also inside calc() and negatives)', () => {
  const css = [
    '.a {', //                                         1
    '  padding: 8px;', //                              2
    '  margin: 0 1.5rem;', //                          3
    '  gap: .5em;', //                                 4
    '  width: calc(100% - 2px);', //                   5
    '  margin-block-start: -4px;', //                  6
    '}',
  ].join('\n');
  const r = check({ replace: { [COMPONENTS]: css } });
  for (const [line, v] of [[2, '8px'], [3, '1.5rem'], [4, '.5em'], [5, '2px'], [6, '-4px']]) {
    assertViolation(r, COMPONENTS, line, new RegExp(`length-literal.*${v.replace('.', '\\.')}`));
  }
  assert.equal(r.lines.length, 5, r.stdout);
});

test('zero lengths, percentages and unitless numbers are allowed', () => {
  const css = '.a {\n  margin: 0;\n  padding: 0px 0rem 0.0em;\n  max-width: 100%;\n  line-height: 1.5;\n  flex: 1 1 0;\n}\n';
  assertClean(check({ replace: { [COMPONENTS]: css } }));
});

test('literals inside comments are ignored (single and multi-line)', () => {
  const css = '/* color: #fff; padding: 8px */\n.a {\n  /*\n   red 4px\n  */\n  color: var(--color-text); /* white */\n}\n';
  assertClean(check({ replace: { [COMPONENTS]: css } }));
});

test('@media with a breakpoint value from tokens.css is allowed; other values are reported', () => {
  const css = [
    '@media (min-width: 600px) {', //                1
    '  .a { color: var(--color-text); }',
    '}',
    '@media (min-width: 960px) and (max-width: 1280px) {', // 4
    '  .a { color: var(--color-text); }',
    '}',
    '@media (min-width: 700px) {', //                7
    '  .a { color: var(--color-text); }',
    '}',
    '@media (width >= 40em) {', //                   10
    '  .a { color: var(--color-text); }',
    '}',
  ].join('\n');
  const r = check({ replace: { [COMPONENTS]: css } });
  assertViolation(r, COMPONENTS, 7, /media-breakpoint.*700px/);
  assertViolation(r, COMPONENTS, 10, /media-breakpoint.*40em/);
  assert.equal(r.lines.length, 2, r.stdout);
});

test('breakpoints are read from tokens.css, not hard-coded', () => {
  const tokens = readFileSync(join(root, 'assets', 'css', 'tokens.css'), 'utf8').replace('--bp-sm: 600px;', '--bp-sm: 700px;');
  const css = '@media (min-width: 700px) {\n  .a { color: var(--color-text); }\n}\n@media (min-width: 600px) {\n  .a { color: var(--color-text); }\n}\n';
  const r = check({ replace: { 'assets/css/tokens.css': tokens, [COMPONENTS]: css } });
  assertViolation(r, COMPONENTS, 4, /media-breakpoint.*600px/);
  // base.css's own `@media (min-width: 600px)` is now off-token as well.
  assert.ok(r.lines.some((l) => l.startsWith(`${BASE}:`) && /600px/.test(l)), r.stdout);
  assert.equal(r.lines.filter((l) => l.startsWith(`${COMPONENTS}:`)).length, 1, r.stdout);
});

test('custom property definitions with literals in base/components are reported', () => {
  const r = check({ append: { [BASE]: '\n.a {\n  --local-gap: 12px;\n}\n' } });
  const baseLines = readFileSync(join(root, BASE), 'utf8').split('\n').length;
  assertViolation(r, BASE, baseLines + 2, /length-literal.*12px/);
});

test('tokens.css and wireframe.css are out of scope', () => {
  const r = check({
    append: {
      'assets/css/tokens.css': '\n.x { padding: 8px; color: red; }\n',
      'assets/css/wireframe.css': '\n.x { padding: 8px; color: #000; }\n',
    },
  });
  assertClean(r);
});

test('injecting a color into the real components.css is reported', () => {
  const src = readFileSync(join(root, COMPONENTS), 'utf8');
  const line = src.split('\n').length + 2;
  const r = check({ append: { [COMPONENTS]: '\n.mk-x {\n  color: #ff0000;\n}\n' } });
  assertViolation(r, COMPONENTS, line, /color-literal/);
});
