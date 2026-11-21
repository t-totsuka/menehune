// I18nRuntime: message lookup with {name} substitution, DOM application of the markup
// conventions, and date/time formatting fixed to Asia/Tokyo (24-hour in both languages).
//
// Markup conventions (processed by apply(root)):
//   data-i18n="key"                         -> textContent = t(key, args)
//   data-i18n-args='{"count":3}'            -> JSON object of args for data-i18n
//   data-i18n-attr="aria-label:k1;title:k2" -> each attribute = t(key)
//   data-i18n-date="2026-11-16" data-date-style="date-long" -> textContent = formatDate(...)
// A key missing from the current language renders as ⟦key⟧ and warns on the console
// (no fallback to the other language, so gaps stay visible).
//
// DateStyle outputs (input 2026-11-16 / 2026-11-16T18:42:00+09:00):
//   style        ja                          en
//   date-long    2026年11月16日(月)           Mon, Nov 16, 2026
//   date-short   11月16日(月)                 Mon, Nov 16
//   weekday      月                          Mon
//   time         18:42                       18:42
//   datetime     2026年11月16日(月) 18:42     Mon, Nov 16, 2026, 18:42
//   month-year   2026年11月                   November 2026
// Strings are assembled from Intl.DateTimeFormat#formatToParts so the punctuation does not
// depend on the ICU version. A date-only value (YYYY-MM-DD) means that calendar day in Tokyo;
// a date-time without an offset is read as Tokyo time. formatDate(value, style, lang) formats in
// `lang` instead of the current language (glossary.html shows ja and en side by side); an
// unknown `lang` warns and uses the current language.
//
// Language: starts from MockState.get().lang (or <html lang>), then follows every
// CustomEvent<MockStateSnapshot>('mock:change') and re-applies the whole document.
// Dictionaries are read from window.MockMessages at lookup time (load order does not matter);
// register() adds entries on top of them.
(function () {
  /** @type {readonly LocaleId[]} */
  const LANGS = ['ja', 'en'];
  /** @type {readonly DateStyle[]} */
  const STYLES = ['date-long', 'date-short', 'weekday', 'time', 'datetime', 'month-year'];
  const TIME_ZONE = 'Asia/Tokyo';
  const TOKYO_OFFSET = '+09:00';

  /**
   * @template {string} T
   * @param {readonly T[]} list
   * @param {unknown} value
   * @returns {value is T}
   */
  const isOneOf = (list, value) => typeof value === 'string' && list.some((v) => v === value);

  const hasDocument = typeof document !== 'undefined';

  /** @returns {LocaleId} */
  const initialLang = () => {
    const state = window.MockState;
    if (state && typeof state.get === 'function') {
      const lang = state.get().lang;
      if (isOneOf(LANGS, lang)) return lang;
    }
    const htmlLang = hasDocument ? document.documentElement.getAttribute('lang') : null;
    return isOneOf(LANGS, htmlLang) ? htmlLang : 'ja';
  };

  /** @type {LocaleId} */
  let currentLang = initialLang();

  /** @type {Record<LocaleId, Record<MessageKey, string>>} */
  const registered = { ja: {}, en: {} };

  // ---- messages --------------------------------------------------------
  /** @param {MessageKey} key @returns {string | undefined} */
  const lookup = (key) => {
    const own = registered[currentLang];
    if (Object.prototype.hasOwnProperty.call(own, key)) return own[key];
    const dicts = window.MockMessages;
    const dict = dicts ? dicts[currentLang] : undefined;
    if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    return undefined;
  };

  /** @param {MessageKey} key @param {MessageArgs} [args] @returns {string} */
  const t = (key, args) => {
    const template = lookup(key);
    if (template === undefined) {
      console.warn(`[MockI18n] missing message key "${key}" for "${currentLang}"`);
      return `⟦${key}⟧`;
    }
    if (!args) return template;
    return template.replace(/\{([^{}]+)\}/g, (whole, name) =>
      Object.prototype.hasOwnProperty.call(args, name) ? String(args[name]) : whole);
  };

  // ---- dates -----------------------------------------------------------
  /** @param {string} value @returns {Date | null} */
  const parseDate = (value) => {
    let iso = value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      iso = `${value}T00:00:00${TOKYO_OFFSET}`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) {
      iso = `${value}${TOKYO_OFFSET}`;
    } else if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return null;
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  /** @type {Record<LocaleId, string>} */
  const LOCALE_TAGS = { ja: 'ja-JP', en: 'en-US' };

  /**
   * @param {LocaleId} lang
   * @param {Date} date
   * @returns {{ year: string, monthNum: string, monthShort: string, monthLong: string, day: string, weekday: string, hour: string, minute: string }}
   */
  const partsOf = (lang, date) => {
    /** @param {Intl.DateTimeFormatOptions} opts @returns {Record<string, string>} */
    const parts = (opts) => {
      /** @type {Record<string, string>} */
      const out = {};
      const fmt = new Intl.DateTimeFormat(LOCALE_TAGS[lang], { timeZone: TIME_ZONE, calendar: 'gregory', ...opts });
      for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
      return out;
    };
    const numeric = parts({ year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });
    const hm = parts({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return {
      year: numeric['year'] || '',
      monthNum: numeric['month'] || '',
      monthShort: parts({ month: 'short' })['month'] || '',
      monthLong: parts({ month: 'long' })['month'] || '',
      day: numeric['day'] || '',
      weekday: numeric['weekday'] || '',
      hour: hm['hour'] || '',
      minute: hm['minute'] || '',
    };
  };

  /**
   * @param {IsoDate | IsoDateTime} value
   * @param {DateStyle} style
   * @param {LocaleId} [lang] defaults to the current language
   * @returns {string}
   */
  const formatDate = (value, style, lang) => {
    /** @type {LocaleId} */
    let locale = currentLang;
    if (lang !== undefined) {
      if (isOneOf(LANGS, lang)) locale = lang;
      else console.warn(`[MockI18n] unknown lang "${String(lang)}"; using "${currentLang}"`);
    }
    const date = parseDate(value);
    if (date === null) {
      console.warn(`[MockI18n] invalid date "${value}"`);
      return value;
    }
    /** @type {DateStyle} */
    let s = style;
    if (!isOneOf(STYLES, s)) {
      console.warn(`[MockI18n] unknown date style "${String(style)}"; using date-long`);
      s = 'date-long';
    }
    const p = partsOf(locale, date);
    const time = `${p.hour}:${p.minute}`;
    if (locale === 'ja') {
      const dateLong = `${p.year}年${p.monthNum}月${p.day}日(${p.weekday})`;
      switch (s) {
        case 'date-long': return dateLong;
        case 'date-short': return `${p.monthNum}月${p.day}日(${p.weekday})`;
        case 'weekday': return p.weekday;
        case 'time': return time;
        case 'datetime': return `${dateLong} ${time}`;
        case 'month-year': return `${p.year}年${p.monthNum}月`;
      }
    }
    const dateLong = `${p.weekday}, ${p.monthShort} ${p.day}, ${p.year}`;
    switch (s) {
      case 'date-long': return dateLong;
      case 'date-short': return `${p.weekday}, ${p.monthShort} ${p.day}`;
      case 'weekday': return p.weekday;
      case 'time': return time;
      case 'datetime': return `${dateLong}, ${time}`;
      case 'month-year': return `${p.monthLong} ${p.year}`;
    }
    return dateLong;
  };

  // ---- DOM -------------------------------------------------------------
  /** @param {Element} el @returns {MessageArgs | undefined} */
  const readArgs = (el) => {
    const raw = el.getAttribute('data-i18n-args');
    if (raw === null || raw.trim() === '') return undefined;
    try {
      /** @type {unknown} */
      const parsed = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        /** @type {Record<string, string | number>} */
        const args = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' || typeof v === 'number') args[k] = v;
        }
        return args;
      }
    } catch {
      // fall through to the warning below
    }
    console.warn(`[MockI18n] invalid data-i18n-args ${raw}`);
    return undefined;
  };

  /**
   * @param {ParentNode} root
   * @param {string} selector
   * @returns {Element[]}
   */
  const select = (root, selector) => {
    const found = Array.from(root.querySelectorAll(selector));
    if (typeof Element !== 'undefined' && root instanceof Element && root.matches(selector)) found.unshift(root);
    return found;
  };

  /** @param {ParentNode} root */
  const apply = (root) => {
    for (const el of select(root, '[data-i18n]')) {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key, readArgs(el));
    }
    for (const el of select(root, '[data-i18n-attr]')) {
      const spec = el.getAttribute('data-i18n-attr') || '';
      for (const pair of spec.split(';')) {
        const at = pair.indexOf(':');
        if (at <= 0) continue;
        const attr = pair.slice(0, at).trim();
        const key = pair.slice(at + 1).trim();
        if (attr && key) el.setAttribute(attr, t(key));
      }
    }
    for (const el of select(root, '[data-i18n-date]')) {
      const value = el.getAttribute('data-i18n-date');
      if (!value) continue;
      const style = el.getAttribute('data-date-style');
      el.textContent = formatDate(value, isOneOf(STYLES, style) ? style : 'date-long');
    }
  };

  /** @param {LocaleId} locale @param {MessageDictionary} dict */
  const register = (locale, dict) => {
    if (!isOneOf(LANGS, locale)) {
      console.warn(`[MockI18n] unknown locale "${String(locale)}"`);
      return;
    }
    Object.assign(registered[locale], dict);
  };

  /** @type {I18nRuntime} */
  const runtime = Object.freeze({ register, t, formatDate, apply });
  window.MockI18n = runtime;

  if (hasDocument) {
    document.addEventListener('mock:change', (event) => {
      /** @type {unknown} */
      const detail = /** @type {CustomEvent<unknown>} */ (event).detail;
      const lang = detail !== null && typeof detail === 'object'
        ? /** @type {{ lang?: unknown }} */ (detail).lang
        : undefined;
      if (isOneOf(LANGS, lang)) currentLang = lang;
      else console.warn(`[MockI18n] mock:change without a known lang; keeping "${currentLang}"`);
      apply(document);
    });
    // Pages without MockState still get their copy; with MockState the initial
    // 'mock:change' (dispatched on DOMContentLoaded) re-applies idempotently.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => apply(document), { once: true });
    } else {
      apply(document);
    }
  }
})();
