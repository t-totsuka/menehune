// Shared E2E helpers (task 7.1), reused by the screen suites of tasks 7.2 and 7.3.
//
// - listScreens(): enumerates the screen registry in Node. data/screens.js is a classic script,
//   so it is evaluated with node:vm against a fake `window` (same approach as tests/unit). This
//   runs synchronously at collection time, which lets a spec declare one test per screen; reading
//   the registry inside a browser page would only be possible after the tests are declared.
// - screenPath(): a path relative to the file:// baseURL set in playwright.config.mjs.
// - blockExternalRequests(): aborts and records every request that is not file:// (or an inline
//   data:/blob: URL), so a passing suite proves the mockups open without any network access (2.6).
// - watchConsole(): collects console errors and warnings and uncaught page errors (note 1.9:
//   screen E2E treats warnings as failures).
// - recordWebSockets(): records WebSockets, which context.route() cannot see (task 7.3).
// - saveScreenshot(): writes a full-page PNG to mockups/.review/screenshots/ (git-ignored, per
//   design "E2ESuite") and attaches it to the test report.
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {import('@playwright/test').TestInfo} TestInfo */
/**
 * @typedef {object} ScreenInfo
 * @property {string} id
 * @property {string} titleKey
 * @property {string} access
 * @property {readonly string[]} authStates
 * @property {readonly string[]} scenarios
 */

/** Absolute path of the mockups directory. */
export const MOCKUPS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Where saveScreenshot() writes its files (git-ignored via mockups/.review/). */
export const SCREENSHOT_DIR = join(MOCKUPS_ROOT, '.review', 'screenshots');

/** URL schemes that never leave the machine. */
const LOCAL_PROTOCOLS = new Set(['file:', 'data:', 'blob:', 'about:']);

/**
 * Loads classic scripts (paths relative to mockups/) into one fake browser global.
 * @param {...string} files
 * @returns {Record<string, unknown>}
 */
export function loadClassicScripts(...files) {
  /** @type {Record<string, unknown>} */
  const window = {};
  const ctx = vm.createContext({ window });
  for (const f of files) {
    vm.runInContext(readFileSync(join(MOCKUPS_ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return window;
}

/**
 * Enumerates every screen in the registry (window.MockScreens of data/screens.js), in order.
 * @returns {ScreenInfo[]}
 */
export function listScreens() {
  const screens = loadClassicScripts('data/screens.js').MockScreens;
  if (!Array.isArray(screens) || screens.length === 0) {
    throw new Error('data/screens.js did not register window.MockScreens');
  }
  return /** @type {ScreenInfo[]} */ (screens);
}

/**
 * Path of a screen relative to the file:// baseURL, with optional URL parameters.
 * @param {string} id ScreenId
 * @param {Record<string, string>} [params] e.g. { lang: 'en', theme: 'dark' }
 */
export function screenPath(id, params = {}) {
  const query = new URLSearchParams(params).toString();
  return `screens/${id}.html${query ? `?${query}` : ''}`;
}

/**
 * Aborts every request that is not local and records its URL. Call before page.goto().
 * The returned array fills as requests happen; assert it is empty for the offline check.
 * @param {Page} page
 * @returns {Promise<string[]>}
 */
export async function blockExternalRequests(page) {
  /** @type {string[]} */
  const external = [];
  await page.context().route(
    (url) => !LOCAL_PROTOCOLS.has(url.protocol),
    async (route) => {
      external.push(route.request().url());
      await route.abort('internetdisconnected');
    },
  );
  return external;
}

/**
 * Collects console errors/warnings and uncaught page errors as "type: text" strings.
 * @param {Page} page
 * @returns {string[]}
 */
export function watchConsole(page) {
  /** @type {string[]} */
  const issues = [];
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') issues.push(`${type}: ${msg.text()}`);
  });
  page.on('pageerror', (e) => issues.push(`pageerror: ${String(e)}`));
  return issues;
}

/**
 * Saves a full-page screenshot to .review/screenshots/{name}.png and attaches it to the report.
 * @param {Page} page
 * @param {TestInfo} testInfo
 * @param {string} name file name without extension (use [a-z0-9-] only)
 * @returns {Promise<string>} absolute path of the saved file
 */
export async function saveScreenshot(page, testInfo, name) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  return path;
}

/**
 * Records the URL of every WebSocket the page opens (task 7.3). context.route() does not see
 * WebSockets (note 7.1), so the offline check combines this with blockExternalRequests().
 * Call before page.goto(); wait for networkidle before asserting the array is empty.
 * @param {Page} page
 * @returns {string[]}
 */
export function recordWebSockets(page) {
  /** @type {string[]} */
  const sockets = [];
  page.on('websocket', (ws) => sockets.push(ws.url()));
  return sockets;
}
