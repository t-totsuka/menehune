#!/usr/bin/env node
// check-registry: static check of the screen registry (data/screens.js) against screens/*.html.
// Requirements 1.1, 1.3, 3.1 / design: Tools > CheckScripts (check-registry), Data > ScreenRegistry.
//
// Checks:
// - all 15 ScreenIds are registered, each once, and no unknown id is registered
// - screens/{id}.html exists and its <body data-screen-id> equals the id
// - review.hifi.status !== 'draft'  =>  review.wireframe.status === 'approved'
// - scenarios[0] === 'default'
//
// Output: one "file:line message" line per violation on stdout (file is relative to the root);
// exit code 1 if there is at least one violation, otherwise 0. Read-only.
// Usage: node tools/check-registry.mjs [rootDir]   (or CHECK_REGISTRY_ROOT=rootDir)
// Self-contained on purpose: no helper module shared with the other check scripts.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const SCREEN_IDS = [
  'top', 'calendar-month', 'day-detail', 'astro-events', 'star-chart',
  'post-detail', 'post-edit', 'my-posts', 'settings', 'login',
  'report', 'appeal', 'admin', 'attribution', 'privacy',
];
const REGISTRY_FILE = 'data/screens.js';

const root = resolve(
  process.argv[2] ?? process.env.CHECK_REGISTRY_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..'),
);

/** @type {string[]} */
const violations = [];
/** @param {string} file @param {number} line @param {string} message */
const report = (file, line, message) => violations.push(`${file}:${Math.max(1, line)} ${message}`);

/** @param {string} s */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 1-based line number of a character offset in src. */
const lineAt = (src, offset) => src.slice(0, offset).split('\n').length;

/** Line numbers (in source order) where `re` matches. */
function matchLines(src, re) {
  const out = [];
  for (const m of src.matchAll(re)) out.push(lineAt(src, m.index ?? 0));
  return out;
}

/**
 * Best line in screens.js for the n-th (0-based) registry entry with this id:
 * a `screen('id'` call or an `id: 'id'` property, else any quoted occurrence of the id,
 * else the registration line.
 */
function entryLine(src, id, nth, fallback) {
  const q = `['"\`]${escapeRe(String(id))}['"\`]`;
  const precise = matchLines(src, new RegExp(`screen\\s*\\(\\s*${q}|\\bid\\s*:\\s*${q}`, 'g'));
  if (precise.length) return precise[Math.min(nth, precise.length - 1)];
  const loose = matchLines(src, new RegExp(q, 'g'));
  if (loose.length) return loose[Math.min(nth, loose.length - 1)];
  return fallback;
}

function checkRegistry() {
  const registryPath = join(root, REGISTRY_FILE);
  if (!existsSync(registryPath)) {
    report(REGISTRY_FILE, 1, 'registry file not found');
    return;
  }
  const src = readFileSync(registryPath, 'utf8');
  const registrationLine = matchLines(src, /window\.MockScreens\s*=/g)[0] ?? 1;

  /** @type {Record<string, unknown>} */
  const window = {};
  try {
    vm.runInContext(src, vm.createContext({ window }), { filename: REGISTRY_FILE, timeout: 5000 });
  } catch (err) {
    const stackLine = /screens\.js:(\d+)/.exec(String(err?.stack ?? ''))?.[1];
    report(REGISTRY_FILE, stackLine ? Number(stackLine) : 1, `failed to evaluate registry: ${err?.message ?? err}`);
    return;
  }
  const screens = window.MockScreens;
  if (!Array.isArray(screens)) {
    report(REGISTRY_FILE, registrationLine, 'window.MockScreens is not an array');
    return;
  }

  /** @type {Map<string, number>} */
  const seen = new Map();
  for (const entry of screens) {
    const id = entry?.id;
    const nth = seen.get(id) ?? 0;
    seen.set(id, nth + 1);
    const line = entryLine(src, id, nth, registrationLine);

    if (typeof id !== 'string' || !SCREEN_IDS.includes(id)) {
      report(REGISTRY_FILE, line, `unknown screen id ${JSON.stringify(id)}`);
      continue;
    }
    if (nth > 0) {
      report(REGISTRY_FILE, line, `duplicate screen id "${id}"`);
      continue;
    }

    const scenarios = entry.scenarios;
    if (!Array.isArray(scenarios) || scenarios[0] !== 'default') {
      report(REGISTRY_FILE, line,
        `screen "${id}": scenarios[0] must be "default" (got ${JSON.stringify(Array.isArray(scenarios) ? scenarios[0] : scenarios)})`);
    }

    const wireframe = entry.review?.wireframe?.status;
    const hifi = entry.review?.hifi?.status;
    if (typeof wireframe !== 'string' || typeof hifi !== 'string') {
      report(REGISTRY_FILE, line, `screen "${id}": review.wireframe.status and review.hifi.status are required`);
    } else if (hifi !== 'draft' && wireframe !== 'approved') {
      report(REGISTRY_FILE, line,
        `screen "${id}": hifi is "${hifi}" but wireframe is "${wireframe}" (hifi may leave draft only after wireframe is approved)`);
    }

    checkScreenFile(id, line);
  }

  for (const id of SCREEN_IDS) {
    if (!seen.has(id)) report(REGISTRY_FILE, registrationLine, `missing screen id "${id}"`);
  }
}

/** @param {string} id @param {number} registryLine */
function checkScreenFile(id, registryLine) {
  const file = `screens/${id}.html`;
  const path = join(root, file);
  if (!existsSync(path)) {
    report(REGISTRY_FILE, registryLine, `screen "${id}": ${file} not found`);
    return;
  }
  const html = readFileSync(path, 'utf8');
  const body = /<body\b[^>]*>/i.exec(html);
  if (!body) {
    report(file, 1, `no <body> element (expected data-screen-id="${id}")`);
    return;
  }
  const attr = /\bdata-screen-id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(body[0]);
  if (!attr) {
    report(file, lineAt(html, body.index), `<body> has no data-screen-id (expected "${id}")`);
    return;
  }
  const value = attr[1] ?? attr[2] ?? attr[3];
  if (value !== id) {
    report(file, lineAt(html, body.index + attr.index), `data-screen-id is "${value}" but expected "${id}"`);
  }
}

checkRegistry();
if (violations.length) {
  process.stdout.write(`${violations.join('\n')}\n`);
  process.exitCode = 1;
}
