// Task 2.1: tools/check-registry.mjs (screen registry static check).
// Runs the script as a child process against the real tree and against temp copies
// (data/screens.js + screens/*.html) that each break one rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(root, 'tools', 'check-registry.mjs');

/** @param {string[]} args @param {Record<string,string>} [env] */
function run(args, env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  const lines = r.stdout.split(/\r?\n/).filter((l) => l.trim() !== '');
  return { status: r.status, lines, stdout: r.stdout, stderr: r.stderr };
}

/** Copies the registry and screen pages to a temp root, applies `mutate`, returns the root. */
function fixture(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'check-registry-'));
  mkdirSync(join(dir, 'data'));
  cpSync(join(root, 'data', 'screens.js'), join(dir, 'data', 'screens.js'));
  cpSync(join(root, 'screens'), join(dir, 'screens'), { recursive: true });
  mutate({
    dir,
    read: (p) => readFileSync(join(dir, p), 'utf8'),
    write: (p, s) => writeFileSync(join(dir, p), s),
    remove: (p) => rmSync(join(dir, p)),
  });
  return dir;
}

/** Each violation line must be "file:line message". */
const LINE_FORMAT = /^([\w./-]+):(\d+) \S.*$/;

function assertViolation(result, file, messagePattern) {
  assert.equal(result.status, 1, `expected exit 1, got ${result.status}\n${result.stdout}${result.stderr}`);
  assert.ok(result.lines.length > 0, 'expected violation lines');
  for (const l of result.lines) assert.match(l, LINE_FORMAT, `bad line format: ${l}`);
  const hit = result.lines.find((l) => l.startsWith(`${file}:`) && messagePattern.test(l));
  assert.ok(hit, `no violation for ${file} matching ${messagePattern}:\n${result.stdout}`);
  const line = Number(LINE_FORMAT.exec(hit)?.[2]);
  assert.ok(line >= 1, 'line number must be >= 1');
  return { hit, line };
}

const lineOf = (src, needle) => src.split(/\r?\n/).findIndex((l) => l.includes(needle)) + 1;

test('current tree: exits 0 with no violation lines', () => {
  const r = run([]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.lines.filter((l) => LINE_FORMAT.test(l)).length, 0, r.stdout);
});

test('accepts the root as an argument and via CHECK_REGISTRY_ROOT', () => {
  const dir = fixture(() => {});
  try {
    assert.equal(run([dir]).status, 0, run([dir]).stdout);
    assert.equal(run([], { CHECK_REGISTRY_ROOT: dir }).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hifi not draft while wireframe not approved is a violation at the entry line', () => {
  const dir = fixture(({ read, write }) => {
    const src = read('data/screens.js');
    const next = src.replace(
      "screen('settings', 'member', GUEST_MEMBER),",
      "{ ...screen('settings', 'member', GUEST_MEMBER), review: review({ status: 'in-review' }, { status: 'approved' }) },",
    );
    assert.notEqual(next, src);
    write('data/screens.js', next);
  });
  try {
    const src = readFileSync(join(dir, 'data', 'screens.js'), 'utf8');
    const { line } = assertViolation(run([dir]), 'data/screens.js', /settings.*hifi|hifi.*settings/);
    assert.equal(line, lineOf(src, "screen('settings'"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hifi not draft with wireframe approved is allowed', () => {
  const dir = fixture(({ read, write }) => {
    write('data/screens.js', read('data/screens.js').replace(
      "screen('settings', 'member', GUEST_MEMBER),",
      "{ ...screen('settings', 'member', GUEST_MEMBER), review: review({ status: 'approved' }, { status: 'in-review' }) },",
    ));
  });
  try {
    const r = run([dir]);
    assert.equal(r.status, 0, r.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing screen file is a violation', () => {
  const dir = fixture(({ remove }) => remove('screens/report.html'));
  try {
    const src = readFileSync(join(dir, 'data', 'screens.js'), 'utf8');
    const { line } = assertViolation(run([dir]), 'data/screens.js', /screens\/report\.html/);
    assert.equal(line, lineOf(src, "screen('report'"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mismatched data-screen-id is a violation at the body line of the page', () => {
  const dir = fixture(({ read, write }) => {
    write('screens/login.html', read('screens/login.html').replace('data-screen-id="login"', 'data-screen-id="top"'));
  });
  try {
    const page = readFileSync(join(dir, 'screens', 'login.html'), 'utf8');
    const { line } = assertViolation(run([dir]), 'screens/login.html', /data-screen-id/);
    assert.equal(line, lineOf(page, 'data-screen-id'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing data-screen-id is a violation', () => {
  const dir = fixture(({ read, write }) => {
    write('screens/privacy.html', read('screens/privacy.html').replace(' data-screen-id="privacy"', ''));
  });
  try {
    assertViolation(run([dir]), 'screens/privacy.html', /data-screen-id/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing screen id is a violation', () => {
  const dir = fixture(({ read, write }) => {
    const src = read('data/screens.js');
    const next = src.replace(/^\s*screen\('attribution'[^\n]*\n/m, '');
    assert.notEqual(next, src);
    write('data/screens.js', next);
  });
  try {
    assertViolation(run([dir]), 'data/screens.js', /attribution/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scenarios not starting with default is a violation', () => {
  const dir = fixture(({ read, write }) => {
    const src = read('data/screens.js');
    const next = src.replace(
      "screen('admin', 'admin', ALL_AUTH, ['empty']),",
      "{ ...screen('admin', 'admin', ALL_AUTH), scenarios: ['empty', 'default'] },",
    );
    assert.notEqual(next, src);
    write('data/screens.js', next);
  });
  try {
    const src = readFileSync(join(dir, 'data', 'screens.js'), 'utf8');
    const { line } = assertViolation(run([dir]), 'data/screens.js', /admin.*default|default.*admin/);
    assert.equal(line, lineOf(src, "screen('admin'"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('duplicate and unknown ids are violations', () => {
  const dir = fixture(({ read, write }) => {
    write('data/screens.js', read('data/screens.js').replace(
      "screen('privacy', 'public', GUEST_MEMBER),",
      "screen('privacy', 'public', GUEST_MEMBER),\n    screen('privacy', 'public', GUEST_MEMBER),\n    screen('extra', 'public', GUEST_MEMBER),",
    ));
  });
  try {
    const r = run([dir]);
    assertViolation(r, 'data/screens.js', /duplicate.*privacy|privacy.*duplicate/i);
    assertViolation(r, 'data/screens.js', /extra/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the check is read-only (fixture files unchanged after a run)', () => {
  const dir = fixture(({ remove }) => remove('screens/top.html'));
  try {
    const before = readdirSync(join(dir, 'screens')).sort().join(',');
    const src = readFileSync(join(dir, 'data', 'screens.js'), 'utf8');
    run([dir]);
    assert.equal(readdirSync(join(dir, 'screens')).sort().join(','), before);
    assert.equal(readFileSync(join(dir, 'data', 'screens.js'), 'utf8'), src);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
