// MockState: resolves the display state (stage, lang, theme, auth, scenario), reflects it on
// <html>, and notifies changes with CustomEvent<MockStateSnapshot>('mock:change') on document.
//
// Resolution order: URL params -> stored values (stage, lang, theme only; localStorage 'mk.prefs')
// -> defaults (hifi, ja, system, guest, default). auth and scenario are never stored because
// their meaning differs per screen. A URL value that is not allowed falls back to the default
// and is recorded as an 'unknown-param' warning. On a screen (<body data-screen-id>), auth and
// scenario must be in that screen's authStates / scenarios; catalog pages (no screen id) accept
// every AuthState and ScenarioId. Storage failures are ignored (URL-only operation).
//
// Preconditions: data/screens.js is loaded first; this script sits at the end of <body>.
(function () {
  const STORAGE_KEY = 'mk.prefs';

  /** @type {readonly StageId[]} */
  const STAGES = ['wireframe', 'hifi'];
  /** @type {readonly LocaleId[]} */
  const LANGS = ['ja', 'en'];
  /** @type {readonly ThemePreference[]} */
  const THEMES = ['system', 'light', 'dark'];
  /** @type {readonly AuthState[]} */
  const AUTH_STATES = ['guest', 'member', 'admin'];
  /** @type {readonly ScenarioId[]} */
  const SCENARIOS = [
    'default', 'empty', 'fetch-error', 'validation-error',
    'private-blocked', 'hidden-own', 'hidden-other',
    'deleted-comment', 'no-location', 'weather-failed', 'provisional-holiday',
  ];

  /** @typedef {'stage' | 'lang' | 'theme' | 'auth' | 'scenario'} StateField */
  /** @type {readonly StateField[]} */
  const FIELDS = ['stage', 'lang', 'theme', 'auth', 'scenario'];

  /**
   * @template {string} T
   * @param {readonly T[]} list
   * @param {unknown} value
   * @returns {value is T}
   */
  const isOneOf = (list, value) => typeof value === 'string' && list.some((v) => v === value);

  // ---- screen context ------------------------------------------------
  const rawScreenId = document.body ? document.body.getAttribute('data-screen-id') : null;
  const registry = Array.isArray(window.MockScreens) ? window.MockScreens : [];
  const entry = rawScreenId === null ? undefined : registry.find((s) => s.id === rawScreenId);
  if (rawScreenId !== null && entry === undefined) {
    console.warn(`[MockState] unknown data-screen-id "${rawScreenId}"; treating the page as a catalog page`);
  }

  /** @type {{ readonly [K in StateField]: readonly MockStateSnapshot[K][] }} */
  const allowed = {
    stage: STAGES,
    lang: LANGS,
    theme: THEMES,
    auth: entry ? entry.authStates : AUTH_STATES,
    scenario: entry ? entry.scenarios : SCENARIOS,
  };
  /** @type {Omit<MockStateSnapshot, 'screenId'>} */
  const DEFAULTS = { stage: 'hifi', lang: 'ja', theme: 'system', auth: 'guest', scenario: 'default' };

  /** @type {MockStateWarning[]} */
  const warningList = [];
  /** @param {string} param @param {string} value */
  const warn = (param, value) => {
    warningList.push(Object.freeze({ kind: 'unknown-param', param, value }));
    console.warn(`[MockState] "${param}=${value}" is not allowed here; using the default`);
  };

  // ---- storage (failures ignored) ------------------------------------
  /** @returns {Partial<Pick<MockStateSnapshot, 'stage' | 'lang' | 'theme'>>} */
  const readStored = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      /** @type {unknown} */
      const parsed = raw === null ? null : JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object') return {};
      /** @type {Record<string, unknown>} */
      const obj = /** @type {Record<string, unknown>} */ (parsed);
      const stage = obj['stage'];
      const lang = obj['lang'];
      const theme = obj['theme'];
      return {
        ...(isOneOf(STAGES, stage) ? { stage } : {}),
        ...(isOneOf(LANGS, lang) ? { lang } : {}),
        ...(isOneOf(THEMES, theme) ? { theme } : {}),
      };
    } catch {
      return {};
    }
  };
  /** @param {MockStateSnapshot} s */
  const writeStored = (s) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ stage: s.stage, lang: s.lang, theme: s.theme }));
    } catch {
      // Ignored: the URL alone still carries the state.
    }
  };

  // ---- snapshot helpers ----------------------------------------------
  /** @param {Omit<MockStateSnapshot, 'screenId'>} v @returns {MockStateSnapshot} */
  const snapshot = (v) => Object.freeze(entry
    ? { stage: v.stage, lang: v.lang, theme: v.theme, auth: v.auth, scenario: v.scenario, screenId: entry.id }
    : { stage: v.stage, lang: v.lang, theme: v.theme, auth: v.auth, scenario: v.scenario });

  /** @param {MockStateSnapshot} s */
  const applyAttributes = (s) => {
    const html = document.documentElement;
    html.setAttribute('data-stage', s.stage);
    html.setAttribute('lang', s.lang);
    if (s.theme === 'system') html.removeAttribute('data-theme');
    else html.setAttribute('data-theme', s.theme);
    html.setAttribute('data-auth', s.auth);
    html.setAttribute('data-scenario', s.scenario);
  };

  /** @param {MockStateSnapshot} s */
  const dispatch = (s) => {
    document.dispatchEvent(new CustomEvent('mock:change', { detail: s }));
  };

  // ---- initial resolution --------------------------------------------
  const resolveInitial = () => {
    /** @type {URLSearchParams} */
    let params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      params = new URLSearchParams();
    }
    const saved = readStored();
    /**
     * @template {StateField} K
     * @param {K} field
     * @returns {MockStateSnapshot[K]}
     */
    const resolveField = (field) => {
      /** @type {readonly MockStateSnapshot[K][]} */
      const list = allowed[field];
      const fromUrl = params.get(field);
      if (fromUrl !== null) {
        if (isOneOf(list, fromUrl)) return fromUrl;
        warn(field, fromUrl);
        return DEFAULTS[field];
      }
      if (field === 'stage' || field === 'lang' || field === 'theme') {
        const fromStore = saved[/** @type {'stage' | 'lang' | 'theme'} */ (field)];
        if (isOneOf(list, fromStore)) return fromStore;
      }
      return DEFAULTS[field];
    };
    return snapshot({
      stage: resolveField('stage'),
      lang: resolveField('lang'),
      theme: resolveField('theme'),
      auth: resolveField('auth'),
      scenario: resolveField('scenario'),
    });
  };

  let current = resolveInitial();
  applyAttributes(current);

  /** @type {MockStateService} */
  const service = {
    get() {
      return current;
    },
    update(patch) {
      /** @type {Omit<MockStateSnapshot, 'screenId'>} */
      const next = { stage: current.stage, lang: current.lang, theme: current.theme, auth: current.auth, scenario: current.scenario };
      /** @type {StateField[]} */
      const changed = [];
      /** @type {Record<string, unknown>} */
      const input = patch;
      for (const field of FIELDS) {
        if (!(field in input) || input[field] === undefined) continue;
        const value = input[field];
        /** @type {readonly string[]} */
        const list = allowed[field];
        if (!isOneOf(list, value)) {
          warn(field, String(value));
          continue;
        }
        /** @type {Record<StateField, string>} */ (next)[field] = value;
        changed.push(field);
      }
      current = snapshot(next);

      try {
        const url = new URL(window.location.href);
        for (const field of changed) url.searchParams.set(field, current[field]);
        window.history.replaceState(window.history.state, '', url.href);
      } catch {
        // replaceState can be refused in unusual embeddings; the attributes still update.
      }
      // Always persist so the stored stage/lang/theme match the current state (design postcondition).
      writeStored(current);
      applyAttributes(current);
      dispatch(current);
      return current;
    },
    warnings() {
      return Object.freeze(warningList.slice());
    },
  };
  window.MockState = service;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => dispatch(current), { once: true });
  } else {
    dispatch(current);
  }
})();
