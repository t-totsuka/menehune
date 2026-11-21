// ReviewShell: review-only UI kept apart from the product UI (styled only by review.css).
//
// - A toolbar fixed to the bottom of the viewport (role="region" + aria-label) with a link back
//   to index.html (2.3), the stage / auth / scenario switches and the current review status.
// - Banners: "未確定" on the hifi stage when the screen's wireframe is not approved (1.3), and a
//   warning for URL parameters that are not allowed (MockState warnings).
// - Conditional display (3.3, 3.4, 3.5): elements with [data-when-auth] / [data-when-scenario]
//   (space-separated lists) get `hidden` unless the current auth / scenario is in the list.
//
// Every switch goes through MockState.update(). On a catalog page (no data-screen-id) the
// switches list every AuthState and ScenarioId, matching what MockState accepts there.
// Review chrome is not product UI, so its copy is fixed Japanese (no dictionary keys).
//
// Preconditions: data/screens.js and assets/js/mock-state.js are loaded first; this script is
// the last one in <body>. mount() runs once on DOMContentLoaded.
(function () {
  // The back link is resolved against this script's URL (assets/js/ -> mockups/index.html), so
  // it works from screens/, the catalog pages at the root and test fixtures alike.
  const scriptEl = document.currentScript;
  const scriptSrc = scriptEl instanceof HTMLScriptElement ? scriptEl.src : '';

  /** @returns {string} */
  const indexHref = () => {
    try {
      return new URL('../../index.html', scriptSrc || window.location.href).href;
    } catch {
      return 'index.html';
    }
  };

  /** @type {readonly StageId[]} */
  const STAGES = ['wireframe', 'hifi'];
  /** @type {readonly AuthState[]} */
  const AUTH_STATES = ['guest', 'member', 'admin'];
  /** @type {readonly ScenarioId[]} */
  const SCENARIOS = [
    'default', 'empty', 'fetch-error', 'validation-error',
    'private-blocked', 'hidden-own', 'hidden-other',
    'deleted-comment', 'no-location', 'weather-failed', 'provisional-holiday', 'many-items', 'daytime',
  ];

  /** @type {Readonly<Record<StageId, string>>} */
  const STAGE_LABELS = { wireframe: 'ワイヤーフレーム', hifi: 'ハイフィ' };
  /** @type {Readonly<Record<AuthState, string>>} */
  const AUTH_LABELS = { guest: '未ログイン', member: '会員', admin: '管理者' };
  /** @type {Readonly<Record<ScenarioId, string>>} */
  const SCENARIO_LABELS = {
    'default': '既定',
    'empty': '空状態',
    'fetch-error': '取得失敗',
    'validation-error': '入力エラー',
    'private-blocked': '非公開で閲覧不可',
    'hidden-own': '非表示（本人）',
    'hidden-other': '非表示（他人）',
    'deleted-comment': '削除されたコメント',
    'no-location': '位置情報なし',
    'weather-failed': '天気の取得失敗',
    'provisional-holiday': '暫定の祝日',
    'many-items': '件数が多い（ページング）',
    'daytime': '昼間（星図の太陽）',
  };
  /** @type {Readonly<Record<ReviewStatus, string>>} */
  const STATUS_LABELS = {
    'draft': '下書き',
    'in-review': 'レビュー中',
    'changes-requested': '修正依頼',
    'approved': '承認済み',
  };

  /** @param {MockStateSnapshot} s @returns {ScreenEntry | undefined} */
  const entryOf = (s) => {
    const registry = Array.isArray(window.MockScreens) ? window.MockScreens : [];
    return s.screenId === undefined ? undefined : registry.find((e) => e.id === s.screenId);
  };

  /**
   * @template {keyof HTMLElementTagNameMap} K
   * @param {K} tag
   * @param {Record<string, string>} [attrs]
   * @param {string} [text]
   * @returns {HTMLElementTagNameMap[K]}
   */
  const el = (tag, attrs, text) => {
    const node = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /**
   * @param {HTMLSelectElement} select
   * @param {readonly string[]} values
   * @param {Readonly<Record<string, string>>} labels
   * @param {string} current
   */
  const fillOptions = (select, values, labels, current) => {
    const same = select.options.length === values.length
      && values.every((v, i) => select.options[i]?.value === v);
    if (!same) {
      select.replaceChildren(...values.map((v) => el('option', { value: v }, `${labels[v] ?? v}（${v}）`)));
    }
    select.value = current;
  };

  /** @param {Element} node @param {string} attr @param {string} value */
  const matches = (node, attr, value) => {
    const raw = node.getAttribute(attr);
    if (raw === null) return true;
    return raw.split(/\s+/).filter((t) => t !== '').includes(value);
  };

  /**
   * @typedef {object} ShellParts
   * @property {HTMLElement} root
   * @property {HTMLElement} provisional
   * @property {HTMLElement} warnings
   * @property {HTMLSelectElement} stage
   * @property {HTMLSelectElement} auth
   * @property {HTMLSelectElement} scenario
   * @property {HTMLElement} status
   */
  /** @type {ShellParts | null} */
  let parts = null;

  /** @param {string} labelText @param {'stage' | 'auth' | 'scenario'} field */
  const switcher = (labelText, field) => {
    const id = `mk-review-${field}`;
    const wrap = el('div', { class: 'mk-review__field' });
    const label = el('label', { for: id }, labelText);
    const select = el('select', { id, 'data-review-control': field });
    select.addEventListener('change', () => {
      window.MockState.update({ [field]: select.value });
    });
    wrap.append(label, select);
    return { wrap, select };
  };

  /** @returns {ShellParts} */
  const build = () => {
    const root = el('div', { class: 'mk-review', 'data-review-shell': '', role: 'region', 'aria-label': 'レビュー用ツールバー', lang: 'ja' });

    const provisional = el('div', { class: 'mk-review__banner mk-review__banner--provisional', 'data-review-banner': 'provisional', role: 'status' });
    provisional.hidden = true;
    const warnings = el('div', { class: 'mk-review__banner mk-review__banner--warning', 'data-review-banner': 'warnings', role: 'alert' });
    warnings.hidden = true;

    const bar = el('div', { class: 'mk-review__bar' });
    const back = el('a', { class: 'mk-review__back', href: indexHref() }, '一覧へ戻る');
    const stage = switcher('段階', 'stage');
    const auth = switcher('ログイン状態', 'auth');
    const scenario = switcher('シナリオ', 'scenario');
    const status = el('p', { class: 'mk-review__status', 'data-review-status': '' });
    bar.append(back, stage.wrap, auth.wrap, scenario.wrap, status);
    root.append(provisional, warnings, bar);

    // In-flow spacer as tall as the fixed shell, so the shell never covers the end of the page.
    const spacer = el('div', { class: 'mk-review-spacer', 'aria-hidden': 'true' });
    document.body.append(spacer, root);
    const syncSpacer = () => { spacer.style.height = `${root.offsetHeight}px`; };
    if (typeof ResizeObserver === 'function') new ResizeObserver(syncSpacer).observe(root);
    syncSpacer();

    return { root, provisional, warnings, stage: stage.select, auth: auth.select, scenario: scenario.select, status };
  };

  /** @param {MockStateSnapshot} s */
  const render = (s) => {
    if (!parts) return;
    const entry = entryOf(s);
    fillOptions(parts.stage, STAGES, STAGE_LABELS, s.stage);
    fillOptions(parts.auth, entry ? entry.authStates : AUTH_STATES, AUTH_LABELS, s.auth);
    fillOptions(parts.scenario, entry ? entry.scenarios : SCENARIOS, SCENARIO_LABELS, s.scenario);

    parts.status.textContent = entry
      ? `レビュー状態：ワイヤーフレーム ${STATUS_LABELS[entry.review.wireframe.status]} ／ ハイフィ ${STATUS_LABELS[entry.review.hifi.status]}`
      : 'レビュー状態：画面ではないページ（一覧・見本）';

    const provisional = s.stage === 'hifi' && entry !== undefined && entry.review.wireframe.status !== 'approved';
    parts.provisional.hidden = !provisional;
    parts.provisional.textContent = provisional
      ? '未確定：ワイヤーフレームが未承認のため、このハイフィは確定版ではありません。'
      : '';

    const list = window.MockState.warnings();
    parts.warnings.hidden = list.length === 0;
    parts.warnings.textContent = list.length === 0
      ? ''
      : `許可されていないパラメータを既定値に置き換えました：${list.map((w) => `${w.param}=${w.value}`).join('、')}`;
  };

  /** @type {ReviewShellService} */
  const service = {
    mount() {
      if (parts || !document.body) return;
      parts = build();
      document.addEventListener('mock:change', (e) => {
        render(e.detail);
        service.applyConditions(e.detail);
      });
      const s = window.MockState.get();
      render(s);
      service.applyConditions(s);
    },
    applyConditions(snapshot) {
      for (const node of document.querySelectorAll('[data-when-auth], [data-when-scenario]')) {
        if (!(node instanceof HTMLElement)) continue;
        node.hidden = !(matches(node, 'data-when-auth', snapshot.auth)
          && matches(node, 'data-when-scenario', snapshot.scenario));
      }
    },
  };
  window.MockReviewShell = service;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => service.mount(), { once: true });
  } else {
    service.mount();
  }
})();
