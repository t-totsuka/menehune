// Task 1.1: project scaffold (package scripts, tsconfig, type contracts, ignore rules).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('package.json defines every developer script entry point', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const name of [
    'check:registry', 'check:tokens', 'check:contrast', 'check:i18n', 'check',
    'typecheck', 'test:unit', 'test:e2e',
  ]) {
    assert.equal(typeof pkg.scripts?.[name], 'string', `missing script ${name}`);
  }
  for (const sub of ['check:registry', 'check:tokens', 'check:contrast', 'check:i18n']) {
    assert.match(pkg.scripts.check, new RegExp(sub), `check must run ${sub}`);
  }
  assert.match(pkg.scripts.typecheck, /tsc\b.*--noEmit/);
});

test('package.json pins typescript 5.x and @playwright/test 1.x exactly, with no runtime deps', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.devDependencies?.typescript ?? '', /^5\.\d+\.\d+$/);
  assert.match(pkg.devDependencies?.['@playwright/test'] ?? '', /^1\.\d+\.\d+$/);
  assert.equal(pkg.dependencies, undefined);
});

test('tsconfig.json enables checkJs, strict and noEmit', () => {
  const ts = JSON.parse(read('tsconfig.json'));
  assert.equal(ts.compilerOptions?.checkJs, true);
  assert.equal(ts.compilerOptions?.strict, true);
  assert.equal(ts.compilerOptions?.noEmit, true);
});

test('types.d.ts declares the design contracts without any', () => {
  const src = read('types.d.ts');
  for (const name of [
    'ScreenRegistry', 'ScreenEntry', 'MessageDictionary', 'GlossaryEntry', 'SampleDataSet',
    'MockStateSnapshot', 'MockStateService', 'I18nRuntime', 'ReviewShellService', 'MockElementContract', 'MockElementConstructor',
    'SiteHeaderAttrs', 'MonthCalendarAttrs', 'CommentTreeAttrs', 'ContrastPair', 'TokenCheckRule',
  ]) {
    assert.match(src, new RegExp(String.raw`\b(type|interface|class)\s+${name}\b`), `missing ${name}`);
  }
  assert.doesNotMatch(src, /:\s*any\b|<any>|\bany\[\]/);
});

test('.gitignore excludes dependencies and review screenshots', () => {
  const gi = readFileSync(join(root, '..', '.gitignore'), 'utf8');
  assert.match(gi, /^mockups\/node_modules\/$/m);
  assert.match(gi, /^mockups\/\.review\/$/m);
});

test('README.md exists', () => {
  assert.ok(existsSync(join(root, 'README.md')));
});
