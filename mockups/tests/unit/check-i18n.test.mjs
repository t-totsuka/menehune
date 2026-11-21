// Task 2.4: tools/check-i18n.mjs (message dictionary static check).
// Runs the script as a child process against the real tree and against temp copies
// (HTML pages, assets/js, assets/i18n, data) that each break one rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(root, 'tools', 'check-i18n.mjs');

/** @param {string[]} args @param {Record<string,string>} [env] */
function run(args, env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  const lines = r.stdout.split(/\r?\n/).filter((l) => l.trim() !== '');
  return { status: r.status, lines, stdout: r.stdout, stderr: r.stderr };
}

/** Copies the product pages, scripts, dictionaries and data to a temp root, applies `mutate`. */
function fixture(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'check-i18n-'));
  for (const d of ['screens', 'data', join('assets', 'js'), join('assets', 'i18n')]) {
    cpSync(join(root, d), join(dir, d), { recursive: true });
  }
  for (const f of readdirSync(root)) {
    if (f.endsWith('.html')) cpSync(join(root, f), join(dir, f));
  }
  mutate({
    dir,
    read: (p) => readFileSync(join(dir, p), 'utf8'),
    write: (p, s) => {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      writeFileSync(join(dir, p), s);
    },
  });
  return dir;
}

/** @param {(f: any) => void} mutate @param {(r: ReturnType<typeof run>, dir: string) => void} check */
function withFixture(mutate, check) {
  const dir = fixture(mutate);
  try {
    check(run([dir]), dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Each violation line must be "file:line message". */
const LINE_FORMAT = /^([\w./-]+):(\d+) \S.*$/;

function assertViolation(result, file, messagePattern) {
  assert.equal(result.status, 1, `expected exit 1, got ${result.status}\n${result.stdout}${result.stderr}`);
  assert.ok(result.lines.length > 0, 'expected violation lines');
  for (const l of result.lines) assert.match(l, LINE_FORMAT, `bad line format: ${l}`);
  const hit = result.lines.find((l) => l.startsWith(`${file}:`) && messagePattern.test(l));
  assert.ok(hit, `no violation for ${file} matching ${messagePattern}:\n${result.stdout}`);
  return { hit, line: Number(LINE_FORMAT.exec(hit)?.[2]) };
}

const lineOf = (src, needle) => src.split(/\r?\n/).findIndex((l) => l.includes(needle)) + 1;

/** Removes the dictionary line that defines `key`. */
const dropKey = (src, key) => {
  const next = src.split('\n').filter((l) => !l.includes(`'${key}':`)).join('\n');
  assert.notEqual(next, src, `key ${key} not found`);
  return next;
};

/** Adds an entry right after the opening of the frozen dictionary object. */
const addKey = (src, key, value) => {
  const next = src.replace('Object.freeze({', `Object.freeze({\n    '${key}': '${value}',`);
  assert.notEqual(next, src);
  return next;
};

/** Appends a classic script with `body` under assets/js (a new product script). */
const extraScript = (body) => `(function () {\n${body}\n})();\n`;

test('current tree: exits 0 with no violation lines', () => {
  const r = run([]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.lines.filter((l) => LINE_FORMAT.test(l)).length, 0, r.stdout);
});

test('accepts the root as an argument and via CHECK_I18N_ROOT', () => {
  const dir = fixture(() => {});
  try {
    const a = run([dir]);
    assert.equal(a.status, 0, a.stdout + a.stderr);
    const b = run([], { CHECK_I18N_ROOT: dir });
    assert.equal(b.status, 0, b.stdout + b.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a key removed from en is reported with the key and its usage location', () => {
  withFixture(
    ({ read, write }) => write('assets/i18n/messages.en.js', dropKey(read('assets/i18n/messages.en.js'), 'screen.top.title')),
    (r, dir) => {
      const html = readFileSync(join(dir, 'screens', 'top.html'), 'utf8');
      const { hit, line } = assertViolation(r, 'screens/top.html', /screen\.top\.title/);
      assert.match(hit, /\ben\b/);
      assert.equal(line, lineOf(html, 'data-i18n="screen.top.title"'));
      // The h1 usage is reported too, not only the first one.
      assert.ok(r.lines.some((l) => l.startsWith(`screens/top.html:${lineOf(html, '<h1')} `)), r.stdout);
      // The key set mismatch is reported on the ja dictionary.
      assertViolation(r, 'assets/i18n/messages.ja.js', /screen\.top\.title.*\ben\b/);
    },
  );
});

test('a registry titleKey built from the screen id is checked (data/screens.js)', () => {
  withFixture(
    ({ read, write, dir }) => {
      for (const l of ['ja', 'en']) {
        const p = `assets/i18n/messages.${l}.js`;
        write(p, dropKey(read(p), 'screen.privacy.title'));
      }
      // Keep the page itself from also using the key, so only the registry reports it.
      const page = read('screens/privacy.html').replaceAll('data-i18n="screen.privacy.title"', 'data-i18n="screen.top.title"');
      write('screens/privacy.html', page);
      void dir;
    },
    (r) => {
      assertViolation(r, 'data/screens.js', /screen\.privacy\.title/);
    },
  );
});

test('a key only in en is a key set mismatch reported at its en line', () => {
  withFixture(
    ({ read, write }) => write('assets/i18n/messages.en.js', addKey(read('assets/i18n/messages.en.js'), 'extra.only-en', 'Extra')),
    (r, dir) => {
      const src = readFileSync(join(dir, 'assets/i18n/messages.en.js'), 'utf8');
      const { line } = assertViolation(r, 'assets/i18n/messages.en.js', /extra\.only-en.*\bja\b/);
      assert.equal(line, lineOf(src, "'extra.only-en'"));
    },
  );
});

test('a dictionary key that is not language independent is a format violation', () => {
  withFixture(
    ({ read, write }) => {
      for (const l of ['ja', 'en']) {
        const p = `assets/i18n/messages.${l}.js`;
        write(p, addKey(read(p), 'Button.Close_Now', 'x'));
      }
    },
    (r) => {
      assertViolation(r, 'assets/i18n/messages.en.js', /Button\.Close_Now.*format/);
      assertViolation(r, 'assets/i18n/messages.ja.js', /Button\.Close_Now.*format/);
    },
  );
});

test('a used key with a bad format is a format violation at the usage', () => {
  withFixture(
    ({ read, write }) => write('screens/top.html', read('screens/top.html').replace(/<h1([^>]*) data-i18n="screen.top.title">/, '<h1$1 data-i18n="TopTitle">')),
    (r, dir) => {
      const html = readFileSync(join(dir, 'screens/top.html'), 'utf8');
      const { line } = assertViolation(r, 'screens/top.html', /TopTitle.*format/);
      assert.equal(line, lineOf(html, 'TopTitle'));
    },
  );
});

test('a glossary key missing from the dictionaries is reported in data/glossary.js', () => {
  withFixture(
    ({ read, write }) => {
      const src = read('data/glossary.js');
      // Prepend an entry to the registered (non-empty since task 3.1) glossary array.
      const next = src.replace(
        'const glossary = Object.freeze([\n',
        "const glossary = Object.freeze([\n    Object.freeze({ key: 'rokuyo.nothing', category: 'rokuyo', policy: 'both' }),\n",
      );
      assert.notEqual(next, src);
      write('data/glossary.js', next);
    },
    (r, dir) => {
      const src = readFileSync(join(dir, 'data/glossary.js'), 'utf8');
      const { hit, line } = assertViolation(r, 'data/glossary.js', /rokuyo\.nothing/);
      assert.match(hit, /glossary/);
      assert.equal(line, lineOf(src, 'rokuyo.nothing'));
    },
  );
});

test('a data-i18n-attr key missing from the dictionaries is reported', () => {
  withFixture(
    ({ read, write }) => write(
      'components.html',
      read('components.html').replace('title:button.close"', 'title:button.nope"'),
    ),
    (r, dir) => {
      const html = readFileSync(join(dir, 'components.html'), 'utf8');
      const { line } = assertViolation(r, 'components.html', /button\.nope/);
      assert.equal(line, lineOf(html, 'button.nope'));
    },
  );
});

test("a JS t('x.y') call and *Key properties with missing keys are reported", () => {
  withFixture(
    ({ write }) => write(
      'assets/js/components/extra.js',
      extraScript([
        "  const a = window.MockI18n.t('x.missing-call');",
        "  const b = t(\"y.missing-dq\", { n: 1 });",
        "  const c = { titleKey: 'z.missing-prop', zassetsuKeys: ['w.missing-arr'] };",
        "  const d = `<p data-i18n=\"v.missing-tpl\"></p>`;",
        '  const e = t(`dyn.${a}`); // dynamic: skipped',
        "  // t('comment.ignored') in a comment is ignored",
        '  void [a, b, c, d, e];',
      ].join('\n')),
    ),
    (r) => {
      assertViolation(r, 'assets/js/components/extra.js', /x\.missing-call/);
      assertViolation(r, 'assets/js/components/extra.js', /y\.missing-dq/);
      assertViolation(r, 'assets/js/components/extra.js', /z\.missing-prop/);
      assertViolation(r, 'assets/js/components/extra.js', /w\.missing-arr/);
      assertViolation(r, 'assets/js/components/extra.js', /v\.missing-tpl/);
      assert.ok(!r.lines.some((l) => /comment\.ignored|dyn\./.test(l)), r.stdout);
    },
  );
});

test('sample data keys (nameKey etc.) missing from the dictionaries are reported', () => {
  withFixture(
    ({ read, write }) => {
      const src = read('data/sample-data.js');
      const next = src.replace(
        /    bodies: \[\r?\n/,
        "    bodies: [\n      { kind: 'moon', nameKey: 'body.no-such-moon', az: 1, alt: 2 },\n",
      );
      assert.notEqual(next, src);
      write('data/sample-data.js', next);
    },
    (r, dir) => {
      const src = readFileSync(join(dir, 'data/sample-data.js'), 'utf8');
      const { line } = assertViolation(r, 'data/sample-data.js', /body\.no-such-moon/);
      assert.equal(line, lineOf(src, 'body.no-such-moon'));
    },
  );
});

test('test fixtures and dictionaries themselves are not scanned for usages', () => {
  withFixture(
    ({ write }) => write('tests/fixtures/x.html', '<p data-i18n="missing.key">x</p>'),
    (r) => assert.equal(r.status, 0, r.stdout + r.stderr),
  );
});
