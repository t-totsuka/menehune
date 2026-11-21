// Task 2.3: tools/check-contrast.mjs (WCAG 2.1 contrast of declared token pairs, both themes,
// and identical values in the two dark blocks of tokens.css). Requirements 13.1, 13.2.
// Pure math is imported; the CLI is run as a child process against the real tree and against
// temp roots holding a modified tokens.css and/or tools/contrast-pairs.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(root, 'tools', 'check-contrast.mjs');
const TOKENS = 'assets/css/tokens.css';
const PAIRS = 'tools/contrast-pairs.json';
const realTokens = () => readFileSync(join(root, TOKENS), 'utf8');

/** @param {string[]} args @param {Record<string,string>} [env] */
function run(args, env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  const lines = r.stdout.split(/\r?\n/).filter((l) => l.trim() !== '');
  return { status: r.status, lines, stdout: r.stdout, stderr: r.stderr };
}

/** Writes a temp root with tokens.css and contrast-pairs.json (defaults: the real files). */
function fixture({ tokens = realTokens(), pairs } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'check-contrast-'));
  mkdirSync(join(dir, 'assets', 'css'), { recursive: true });
  mkdirSync(join(dir, 'tools'), { recursive: true });
  writeFileSync(join(dir, TOKENS), tokens);
  writeFileSync(
    join(dir, PAIRS),
    pairs === undefined ? readFileSync(join(root, PAIRS), 'utf8') : JSON.stringify(pairs, null, 2) + '\n',
  );
  return dir;
}

function check(opts) {
  const dir = fixture(opts);
  try {
    return run([dir]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const LINE_FORMAT = /^([\w./-]+):(\d+) \S.*$/;
function assertFormat(result) {
  for (const l of result.lines) assert.match(l, LINE_FORMAT, `bad line format: ${l}`);
}

/** Minimal tokens.css with the three theme blocks. */
function miniTokens({ lightText = '#000000', darkText = '#ffffff', attrText = darkText, extra = '' } = {}) {
  return [
    ':root {', //                                              1
    '  --palette-black: #000;', //                             2
    '  --palette-white: #ffffff;', //                          3
    '  --palette-grey: #777777;', //                           4
    '  --color-bg: var(--palette-white);', //                  5
    `  --color-text: ${lightText};`, //                        6
    extra, //                                                   7
    '}', //                                                     8
    '@media (prefers-color-scheme: dark) {', //                9
    '  :root:not([data-theme="light"]) {', //                  10
    '    --color-bg: var(--palette-black);', //                11
    `    --color-text: ${darkText};`, //                       12
    '  }', //                                                   13
    '}', //                                                     14
    ':root[data-theme="dark"] {', //                           15
    '  --color-bg: var(--palette-black);', //                  16
    `  --color-text: ${attrText};`, //                         17
    '}', //                                                     18
    '',
  ].join('\n');
}

test('contrast math matches known WCAG values', async () => {
  const { contrastRatio, parseColor, relativeLuminance } = await import('../../tools/check-contrast.mjs');
  const black = parseColor('#000');
  const white = parseColor('#ffffff');
  assert.ok(black && white);
  assert.equal(relativeLuminance(black), 0);
  assert.equal(relativeLuminance(white), 1);
  assert.equal(contrastRatio(black, white), 21);
  assert.equal(contrastRatio(white, black), 21);
  const grey = parseColor('#777777');
  assert.ok(grey);
  assert.ok(Math.abs(contrastRatio(grey, white) - 4.48) < 0.005, String(contrastRatio(grey, white)));
  assert.ok(Math.abs(contrastRatio(parseColor('#767676'), white) - 4.54) < 0.005);
  assert.deepEqual(parseColor('rgb(255 0 0)'), { r: 255, g: 0, b: 0, a: 1 });
  assert.deepEqual(parseColor('rgba(0, 128, 255, 0.5)'), { r: 0, g: 128, b: 255, a: 0.5 });
  assert.deepEqual(parseColor('#0f08'), { r: 0, g: 255, b: 0, a: 0x88 / 255 });
  assert.equal(parseColor('not-a-color'), null);
});

test('real tree: prints results for every pair and theme; exit code matches the violations', () => {
  const r = run([]);
  assertFormat(r);
  const pairs = JSON.parse(readFileSync(join(root, PAIRS), 'utf8'));
  assert.ok(Array.isArray(pairs) && pairs.length > 0);
  const expectedResults = pairs.reduce((n, p) => n + p.themes.length, 0);
  const resultLines = r.stderr.split(/\r?\n/).filter((l) => /^(OK|NG) /.test(l));
  assert.equal(resultLines.length, expectedResults, r.stderr);
  assert.equal(r.status, r.lines.length > 0 ? 1 : 0, r.stdout + r.stderr);
  assert.equal(r.lines.length, resultLines.filter((l) => l.startsWith('NG ')).length, r.stdout + r.stderr);
});

test('contrast-pairs.json covers the main role and semantic colors in both themes', () => {
  const pairs = JSON.parse(readFileSync(join(root, PAIRS), 'utf8'));
  const has = (fg, bg, min) =>
    pairs.some((p) => p.fg === fg && p.bg === bg && p.min === min && p.themes.includes('light') && p.themes.includes('dark'));
  for (const [fg, bg, min] of [
    ['--color-text', '--color-bg', 4.5],
    ['--color-text', '--color-surface', 4.5],
    ['--color-text-muted', '--color-bg', 4.5],
    ['--color-link', '--color-bg', 4.5],
    ['--color-on-accent', '--color-accent', 4.5],
    ['--color-error', '--color-surface', 4.5],
    ['--color-holiday', '--color-surface', 4.5],
    ['--color-status-hidden', '--color-surface', 4.5],
    ['--color-border', '--color-bg', 3],
    ['--color-focus', '--color-surface', 3],
  ]) {
    assert.ok(has(fg, bg, min), `missing pair ${fg} on ${bg} (${min})`);
  }
  for (const p of pairs) {
    assert.deepEqual(Object.keys(p).sort(), ['bg', 'fg', 'min', 'themes']);
    assert.ok(p.min === 4.5 || p.min === 3);
  }
});

test('passing fixture: exit 0, root via argument and CHECK_CONTRAST_ROOT', () => {
  const pairs = [{ fg: '--color-text', bg: '--color-bg', min: 4.5, themes: ['light', 'dark'] }];
  const dir = fixture({ tokens: miniTokens(), pairs });
  try {
    const a = run([dir]);
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.equal(a.lines.length, 0);
    assert.match(a.stderr, /^OK light --color-text on --color-bg 21\.00/m);
    assert.match(a.stderr, /^OK dark --color-text on --color-bg 21\.00/m);
    const b = run([], { CHECK_CONTRAST_ROOT: dir });
    assert.equal(b.status, 0, b.stdout + b.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('failing pair: reports pair, theme and actual ratio at the pair line; exit 1', () => {
  const pairs = [
    { fg: '--color-text', bg: '--color-bg', min: 4.5, themes: ['light', 'dark'] },
  ];
  // light text #777777 on white = 4.48 (< 4.5); dark stays 21.
  const r = check({ tokens: miniTokens({ lightText: 'var(--palette-grey)' }), pairs });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assertFormat(r);
  assert.equal(r.lines.length, 1, r.stdout);
  assert.match(r.lines[0], /^tools\/contrast-pairs\.json:2 .*--color-text.*--color-bg.*light.*4\.48.*4\.5/);
});

test('min 3 pair passes at 4.48 and fails below 3', () => {
  const pairs = [
    { fg: '--color-text', bg: '--color-bg', min: 3, themes: ['light'] },
    { fg: '--color-border', bg: '--color-bg', min: 3, themes: ['light'] },
  ];
  const r = check({
    tokens: miniTokens({ lightText: 'var(--palette-grey)', extra: '  --color-border: #aaaaaa;' }),
    pairs,
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.lines.length, 1, r.stdout);
  assert.match(r.lines[0], /--color-border.*--color-bg.*light.*2\.32/);
});

test('dark blocks that differ are reported at the attribute block line; exit 1', () => {
  const pairs = [{ fg: '--color-text', bg: '--color-bg', min: 4.5, themes: ['dark'] }];
  const r = check({ tokens: miniTokens({ darkText: '#ffffff', attrText: '#eeeeee' }), pairs });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assertFormat(r);
  assert.ok(
    r.lines.some((l) => /^assets\/css\/tokens\.css:17 .*--color-text/.test(l)),
    r.stdout,
  );
});

test('a token present in only one dark block is reported', () => {
  const tokens = miniTokens().replace('    --color-text: #ffffff;\n  }', '    --color-text: #ffffff;\n    --color-extra: #000;\n  }');
  const pairs = [{ fg: '--color-text', bg: '--color-bg', min: 4.5, themes: ['dark'] }];
  const r = check({ tokens, pairs });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(r.lines.some((l) => /tokens\.css:\d+ .*--color-extra/.test(l)), r.stdout);
});

test('a missing dark block is reported', () => {
  const tokens = miniTokens().split('\n').slice(0, 14).join('\n') + '\n';
  const pairs = [{ fg: '--color-text', bg: '--color-bg', min: 4.5, themes: ['light'] }];
  const r = check({ tokens, pairs });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(r.lines.some((l) => /tokens\.css:\d+ .*data-theme="dark"/.test(l)), r.stdout);
});

test('unknown token, unparsable value and translucent color are violations', () => {
  const pairs = [
    { fg: '--color-nope', bg: '--color-bg', min: 4.5, themes: ['light'] }, // line 2
    { fg: '--color-text', bg: '--color-weird', min: 4.5, themes: ['light'] }, // line 10
    { fg: '--color-glass', bg: '--color-bg', min: 3, themes: ['light'] }, // line 18
  ];
  const r = check({
    tokens: miniTokens({ extra: '  --color-weird: linear-gradient(red, blue); --color-glass: rgb(0 0 0 / 0.5);' }),
    pairs,
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assertFormat(r);
  assert.ok(r.lines.some((l) => /^tools\/contrast-pairs\.json:2 .*--color-nope/.test(l)), r.stdout);
  assert.ok(r.lines.some((l) => /^tools\/contrast-pairs\.json:10 .*--color-weird/.test(l)), r.stdout);
  assert.ok(r.lines.some((l) => /^tools\/contrast-pairs\.json:18 .*--color-glass.*(alpha|translucent)/.test(l)), r.stdout);
});

test('invalid pair entries (min, themes) are violations', () => {
  const pairs = [{ fg: '--color-text', bg: '--color-bg', min: 4, themes: ['sepia'] }];
  const r = check({ tokens: miniTokens(), pairs });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(r.lines.some((l) => /contrast-pairs\.json:2 .*min/.test(l)), r.stdout);
  assert.ok(r.lines.some((l) => /contrast-pairs\.json:2 .*sepia/.test(l)), r.stdout);
});
