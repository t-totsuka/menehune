// Japanese message dictionary (key -> copy). Classic script: registers into
// window.MockMessages so that assets/js/i18n.js can read it later.
// Keys are language independent (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/) and must match messages.en.js exactly.
// Placeholders use the `{name}` form.
(function () {
  /** @type {MessageDictionary} */
  const ja = Object.freeze({
    // Common navigation
    'nav.top': 'トップ',
    'nav.calendar': 'カレンダー',
    'nav.astro-events': '天文現象',
    'nav.star-chart': '星図',
    'nav.my-posts': '自分の投稿',
    'nav.settings': '設定',
    'nav.admin': '管理',
    'nav.login': 'ログイン',
    'nav.logout': 'ログアウト',
    'nav.main': 'メインメニュー',
    'nav.skip-to-content': '本文へ移動',

    // Language and theme toggles
    'toggle.lang.label': '言語',
    'toggle.lang.ja': '日本語',
    'toggle.lang.en': 'English',
    'toggle.theme.label': 'テーマ',
    'toggle.theme.system': 'システム設定に合わせる',
    'toggle.theme.light': 'ライト',
    'toggle.theme.dark': 'ダーク',

    // Common buttons
    'button.save': '保存',
    'button.cancel': 'キャンセル',
    'button.submit': '送信',
    'button.back': '戻る',
    'button.delete': '削除',
    'button.edit': '編集',
    'button.post': '投稿する',
    'button.reply': '返信',
    'button.report': '通報',
    'button.like': 'いいね',
    'button.unlike': 'いいねを取り消す',
    'button.close': '閉じる',
    'button.retry': '再試行',
    'button.more': 'もっと見る',
    'button.prev': '前へ',
    'button.next': '次へ',
    'button.today': '今日',

    // Screen titles (one per ScreenId)
    'screen.top.title': 'トップ',
    'screen.calendar-month.title': '月のカレンダー',
    'screen.day-detail.title': '日の詳細',
    'screen.astro-events.title': '天文現象',
    'screen.star-chart.title': '星図',
    'screen.post-detail.title': '投稿の詳細',
    'screen.post-edit.title': '投稿の作成・編集',
    'screen.my-posts.title': '自分の投稿',
    'screen.settings.title': '設定',
    'screen.login.title': 'ログイン',
    'screen.report.title': '通報',
    'screen.appeal.title': '異議申し立て',
    'screen.admin.title': '管理',
    'screen.attribution.title': '出典・クレジット',
    'screen.privacy.title': 'プライバシーポリシー',

    // Common errors
    'error.fetch': 'データを取得できませんでした。時間をおいてもう一度お試しください。',
    'error.validation': '入力内容に誤りがあります。各項目を確認してください。',
    'error.required': '{field}を入力してください。',
    'error.no-permission': 'このページを表示する権限がありません。',
    'error.login-required': 'この操作にはログインが必要です。',
    'error.not-found': 'お探しのページは見つかりませんでした。',
    'error.missing-sample': 'サンプルデータ「{id}」が見つかりません。',

    // Common empty states
    'empty.list': '表示する項目はまだありません。',
    'empty.posts': 'まだ投稿はありません。',
    'empty.comments': 'まだコメントはありません。',
    'empty.events': 'この期間の天文現象はありません。',

    // Common status
    'status.loading': '読み込み中…',
    'status.saved': '保存しました。',
    'common.count': '{count}件',
  });

  window.MockMessages = window.MockMessages || {};
  window.MockMessages.ja = ja;
})();
