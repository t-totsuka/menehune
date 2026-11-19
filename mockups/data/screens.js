// Screen registry: the single source of truth for the 15 screens, their allowed login states
// and scenarios, access level and per-stage review status. Classic script that registers into
// window.MockScreens. The file of each screen is always screens/{id}.html.
//
// Invariants (checked by tools/check-registry.mjs):
// - scenarios[0] === 'default'
// - review.hifi.status !== 'draft' implies review.wireframe.status === 'approved'
//
// authStates: 'guest' is the MockState default, so every screen lists it first.
// Member-only screens keep 'guest' so the not-logged-in view can be reviewed.
// Only the admin screen offers 'admin' (admin UI vs. the no-permission view for guest/member).
//
// To record a review, change the status (and optionally reviewedAt / notes) of a stage, e.g.
//   review: review({ status: 'approved', reviewedAt: '2026-11-20', notes: ['...'] }, DRAFT)
(function () {
  /** @type {StageReview} */
  const DRAFT = Object.freeze({ status: 'draft' });

  /**
   * @param {StageReview} wireframe
   * @param {StageReview} hifi
   * @returns {Readonly<Record<StageId, StageReview>>}
   */
  const review = (wireframe, hifi) => Object.freeze({ wireframe, hifi });

  // 2026-11-19 の全画面共通の指摘（ワイヤーフレーム）。タスク 8.1 で反映し、画面ごとの結果を後ろに記録する
  const GUEST_BAND_NOTE = '「ログインしていないため、閲覧のみ・・・」は全画面通して一番上にエリアを作って表示に統一';
  const BAND_ADDED = '反映（8.1）：未ログインのとき、ヘッダーの直下の全幅の帯（mk-guest-notice band）に閲覧のみの案内とログインの導線を出すようにした（これまでこの画面には案内がなかった）';
  const PROMPT_KEPT = '反映（8.1）：ヘッダーの直下の全幅の帯に案内を出し、本文の囲みの案内とログインの導線を外した。会員向けの内容を出さない理由は、本文に 1 行の文として残した（README の論点）';

  /**
   * Wireframe review of a screen that only got the cross-screen note of 2026-11-19: applied in
   * task 8.1 and back to in-review (only a person approves).
   * @param {string} outcome "反映（8.1）：..." or "見送り（8.1）：..."
   * @returns {Readonly<Record<StageId, StageReview>>}
   */
  const guestBandReview = (outcome) => review(
    Object.freeze({ status: 'in-review', reviewedAt: '2026-11-19', notes: Object.freeze([GUEST_BAND_NOTE, outcome]) }),
    DRAFT,
  );

  /** @type {readonly AuthState[]} */
  const GUEST_MEMBER = Object.freeze(['guest', 'member']);
  /** @type {readonly AuthState[]} */
  const ALL_AUTH = Object.freeze(['guest', 'member', 'admin']);

  /**
   * @param {ScreenId} id
   * @param {ScreenAccess} access
   * @param {readonly AuthState[]} authStates
   * @param {readonly ScenarioId[]} extraScenarios scenarios after 'default'
   * @param {Readonly<Record<StageId, StageReview>>} [reviewState]
   * @returns {ScreenEntry}
   */
  const screen = (id, access, authStates, extraScenarios = [], reviewState = review(DRAFT, DRAFT)) =>
    Object.freeze({
      id,
      titleKey: `screen.${id}.title`,
      access,
      authStates,
      scenarios: Object.freeze(/** @type {ScenarioId[]} */ (['default', ...extraScenarios])),
      review: reviewState,
    });

  /** @type {ScreenRegistry} */
  const screens = Object.freeze([
    screen('top', 'public', GUEST_MEMBER, [], review(
      Object.freeze({
        // 2026-11-19 の指摘（changes-requested）をタスク 8.1 で反映し、再レビュー待ちに戻した
        status: 'in-review',
        reviewedAt: '2026-11-19',
        notes: Object.freeze([
          '題名の「トップ」の見出しは不要',
          '投稿を主な内容とする。PC 幅では左右を 1:3 に分け、3 の側に投稿を並べる',
          '1 の側には「ログインしていない…」の案内、今日の暦、直近の天文現象を並べる',
          '天文現象の期間と種類を選ぶチェックボックスは、目立たないようにアコーディオンにする',
          '今日の暦があっさりしているので、月齢を模した月の満ち欠けの絵と、今日の日の出・日の入り・月の出・月の入り（未ログインでは東京を基準）の情報を、図で見せる',
          '反映（8.1）：見出し「トップ」は画面に出さず、読み上げ用に残した（h1 は visually-hidden）',
          '反映（8.1）：960px 以上で 1:3 の 2 列にし、3 の側に投稿を並べた。狭い幅では 1 列で、案内・今日の暦・投稿・天文現象の順にした（README の論点）',
          '反映（8.1）：1 の側に、未ログインの案内、今日の暦、直近の天文現象を並べた',
          '反映（8.1）：天文現象の期間と種類の絞り込みを、閉じたアコーディオン（mk-event-list filters="collapsed"）にした。天文現象一覧の画面は従来どおり開いたまま',
          '反映（8.1）：月齢から描いた月の満ち欠けの図と、0〜24 時の帯で日月が地平線の上にある時間を示す図を加え、東京を基準とした時刻であることを添えた（ワイヤーフレームでは図は占位表示）',
          '見送り（8.1）：ログイン時の基準地点。サンプルデータと設定画面に利用者の地点がないため、ログイン時も東京を基準として表示している。利用者の地点の扱いは auth-users などの spec で決める（README の論点）',
          GUEST_BAND_NOTE,
          '反映（8.1）：未ログインの案内を、左の列からヘッダーの直下の全幅の帯（mk-guest-notice band）に移した（全画面で同じ）。左の列は今日の暦と直近の天文現象になり、狭い幅では今日の暦・投稿・天文現象の順になった',
        ]),
      }),
      DRAFT,
    )),
    screen('calendar-month', 'public', GUEST_MEMBER, ['provisional-holiday'], review(
      Object.freeze({
        // 2026-11-19 の画面ごとの指摘をタスク 8.1 で反映し、再レビュー待ちのままにした
        status: 'in-review',
        reviewedAt: '2026-11-19',
        notes: Object.freeze([
          GUEST_BAND_NOTE,
          BAND_ADDED,
          '月曜始まりが望ましい',
          '反映（8.1）：週を月曜始まり（月〜日）にした（mk-month-calendar week-start="mon"。部品の既定は日曜始まりのままで、月のカレンダーを出す製品の画面はこの画面だけ）。土日・祝日の印は列ではなく実際の曜日で付け、小さな格子の Home・End も月曜・日曜に移る',
          '月の移動ができない',
          '反映（8.1）：カレンダーの上に「前の月」「今月」「次の月」のボタンを置いた（mk-month-calendar nav。読み上げ名は移動先の月を含む）。見出しと ?month=YYYY-MM が追従し、ほかの URL パラメータは残る。サンプルデータは 2026年11月と 2027年3月だけなので、ほかの月は日付と曜日だけを出し、その旨を注記した（祝日・六曜・月齢などは計算しない。README の論点）',
        ]),
      }),
      DRAFT,
    )),
    screen('day-detail', 'public', GUEST_MEMBER, [], review(
      Object.freeze({
        // 2026-11-19 の画面ごとの指摘をタスク 8.1 で反映し、再レビュー待ちのままにした
        status: 'in-review',
        reviewedAt: '2026-11-19',
        notes: Object.freeze([
          GUEST_BAND_NOTE,
          '反映（8.1）：「この日の投稿」の中にあった案内を、ヘッダーの直下の全幅の帯に移した',
          'Topに同じく、投稿がメインなので左右１：２で表示',
          '反映（8.1）：960px 以上で、見出しと「月のカレンダーに戻る」の下を 1:2 の 2 列にし、2 の側（右）に「この日の投稿」、1 の側（左）に「この日の暦」と日の出・日の入り、月の出・月の入りを並べた（トップと同じ幅から）。狭い幅では 1 列で、暦、出没、投稿の順のまま（README の論点）',
        ]),
      }),
      DRAFT,
    )),
    screen('astro-events', 'public', GUEST_MEMBER, ['empty', 'fetch-error'], review(
      Object.freeze({
        // 2026-11-19 の画面ごとの指摘をタスク 8.1 で反映し、再レビュー待ちのままにした
        status: 'in-review',
        reviewedAt: '2026-11-19',
        notes: Object.freeze([
          GUEST_BAND_NOTE,
          BAND_ADDED,
          '過去の日付のものはわかるようにしたい',
          '反映（8.1）：サンプルの今日（2026-11-16）より前の日付の現象に、日時の前に「過去」（英語は Past）の文字の印を付け、日時と現象名を淡い文字にした（色だけに頼らず、読み上げでも項目と一緒に読まれる）。mk-event-list の opt-in の属性 mark-past で、この画面だけに付けた。トップの「今日と直近の天文現象」は今日からの期間なので付けていない（README の論点）',
        ]),
      }),
      DRAFT,
    )),
    screen('star-chart', 'public', GUEST_MEMBER, [], guestBandReview(BAND_ADDED)),
    screen('post-detail', 'public', GUEST_MEMBER, [
      'private-blocked', 'hidden-own', 'hidden-other',
      'deleted-comment', 'no-location', 'weather-failed',
    ], review(
      Object.freeze({
        // 2026-11-19 の画面ごとの指摘をタスク 8.1 で反映し、再レビュー待ちのままにした
        status: 'in-review',
        reviewedAt: '2026-11-19',
        notes: Object.freeze([
          GUEST_BAND_NOTE,
          '反映（8.1）：投稿の操作の代わりに出していた案内を、ヘッダーの直下の全幅の帯に移した。ログインしたユーザだけが見られる投稿の案内（private-blocked）は、投稿の代わりに出す状態の説明なので本文に残した（README の論点）',
          '左右１：１で「投稿」と「コメント」は近くに寄せたい',
          '反映（8.1）：960px 以上（トップ、日詳細と同じ幅）で、見出しの下を 1:1 の 2 列にし、左に「投稿の内容」、右に「コメント」（会員の入力欄を含む）を上端をそろえて並べた。「場所と空のようす」（地図、日月の出没、天気）は 2 列の下に全幅で置いた（地図と出没・天気を横に並べる部品の配置を保ち、読む順と見た目の順をそろえるため）。狭い幅では 1 列で、投稿、コメント、場所の順にした（コメントを場所より前に移した）。投稿の代わりに案内を出す表示（private-blocked、非表示）は列に分けず全幅のまま（README の論点）',
        ]),
      }),
      DRAFT,
    )),
    screen('post-edit', 'member', GUEST_MEMBER, ['validation-error'], review(
      Object.freeze({
        // 2026-11-19 の画面ごとの指摘をタスク 8.1 で反映し、再レビュー待ちのままにした
        status: 'in-review',
        reviewedAt: '2026-11-19',
        notes: Object.freeze([
          GUEST_BAND_NOTE,
          '反映（8.1）：フォームの代わりに出していた案内を、ヘッダーの直下の全幅の帯に移した。フォームを出さない理由は、本文に 1 行の文として残した（ログインの導線は帯だけ。README の論点）',
          '位置の公開精度はアコーディオンで',
          '反映（8.1）：位置の公開精度の選択を、閉じたアコーディオン（details と summary）にした（mk-precision-picker collapsed。opt-in で、設定画面と部品ギャラリーの既定は開いたラジオグループのまま）。見出しに今の選択を「位置の公開精度：市区町村」のように出し、選び直すと追従する。中のラジオグループは凡例（legend）、ラベル、見え方の説明を保つ。入力エラーの例（validation-error）の誤りは対象日だけで、閉じたアコーディオンの中に誤りは隠れない。位置情報を付けないときは、アコーディオンごと隠す（README の論点）',
          '編集エリアは大きめに取りたい',
          '反映（8.1）：本文の入力欄を 12 行にし、最小の高さを 15rem（960px 以上は 24rem）にした。幅はフォームの全幅（最大 1280px のページ幅）で、375px でも横にスクロールしない（README の論点）',
        ]),
      }),
      DRAFT,
    )),
    screen('my-posts', 'member', GUEST_MEMBER, ['empty', 'fetch-error'], guestBandReview(PROMPT_KEPT)),
    screen('settings', 'member', GUEST_MEMBER, [], guestBandReview(PROMPT_KEPT)),
    screen('login', 'public', GUEST_MEMBER, [], guestBandReview(
      '見送り（8.1）：ログイン画面には帯を出さない。この画面自体がログインの入口で、「ログインしてください」の案内と導線が本文と重なるため（README の論点）',
    )),
    screen('report', 'member', GUEST_MEMBER, [], guestBandReview(PROMPT_KEPT)),
    screen('appeal', 'member', GUEST_MEMBER, [], guestBandReview(PROMPT_KEPT)),
    screen('admin', 'admin', ALL_AUTH, ['empty'], guestBandReview(
      '反映（8.1）：未ログインのとき、ヘッダーの直下の全幅の帯に案内を出す。権限がない旨の案内は本文に残した（ログイン中の会員には帯を出さず、権限の案内だけ）',
    )),
    screen('attribution', 'public', GUEST_MEMBER, [], guestBandReview(BAND_ADDED)),
    screen('privacy', 'public', GUEST_MEMBER, [], guestBandReview(BAND_ADDED)),
  ]);

  window.MockScreens = screens;
})();
