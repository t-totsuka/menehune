// ThemeBoot: runs synchronously in <head> before any stylesheet so the first paint already uses
// the chosen theme (no flicker). Reads `theme` from the URL, then the stored preference
// (localStorage 'mk.prefs', shared with mock-state.js). 'system' (or anything unknown) leaves
// data-theme absent so the CSS prefers-color-scheme media query decides (9.3, 9.4).
(function () {
  /** @param {unknown} v @returns {v is 'light' | 'dark'} */
  const isManual = (v) => v === 'light' || v === 'dark';

  /** @type {unknown} */
  let theme = null;
  try {
    theme = new URLSearchParams(window.location.search).get('theme');
  } catch {
    theme = null;
  }
  if (theme === null) {
    try {
      const raw = window.localStorage.getItem('mk.prefs');
      /** @type {unknown} */
      const parsed = raw === null ? null : JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object' && 'theme' in parsed) theme = parsed.theme;
    } catch {
      // Storage unavailable or broken: fall back to the OS appearance.
    }
  }
  if (isManual(theme)) document.documentElement.setAttribute('data-theme', theme);
})();
