# UI モックアップ集

暦・天文と投稿の画面を、ワイヤーフレームとハイフィデリティの 2 段階でレビューするためのモックアップ集です。
モック本体は HTML・CSS・classic script だけでできており、サーバの起動やビルドは不要です。外部ネットワークにも接続しません。
表示しているサンプル値（暦・天文・天気・投稿など）はすべて架空で、正確さは検証していません。

## 開き方

1. エクスプローラーなどで `mockups/index.html` をブラウザ（Chrome、Edge、Firefox の最新版）で直接開きます（`file://` で開く）。
2. 一覧ページから、画面ごと・段階ごとのモックを開きます。各画面には一覧へ戻る導線があります。
3. 幅の比較は `viewer.html?screen={画面ID}` で、375px と 1440px を並べて確認できます。

その他のページ：

| ページ | 内容 |
|--------|------|
| `components.html` | 部品ギャラリー（mk-* 部品を状態ごとに一覧表示） |
| `tokens.html` | デザイントークンの見本 |
| `glossary.html` | 日英用語集と日付時刻の書式 |
| `a11y.html` | アクセシビリティの方針（代替テキスト、フォーカス、色以外の区別） |

## URL パラメータ

画面の表示状態は URL パラメータで切り替えます。画面下部のレビュー用ツールバーからも切り替えられます。

| パラメータ | 値 | 既定値 | 保存 |
|------------|----|--------|------|
| `stage` | `wireframe`、`hifi` | `hifi` | する |
| `lang` | `ja`、`en` | `ja` | する |
| `theme` | `system`、`light`、`dark` | `system` | する |
| `auth` | `guest`、`member`、`admin` | `guest` | しない |
| `scenario` | `default`、`empty`、`fetch-error`、`validation-error`、`private-blocked`、`hidden-own`、`hidden-other`、`deleted-comment`、`no-location`、`weather-failed`、`provisional-holiday` | `default` | しない |

- 優先順位は、URL パラメータ、保存値（`localStorage`。使えない環境では保存しません）、既定値の順です。
- `auth` と `scenario` は画面ごとに許可する値が決まっています（`data/screens.js`）。許可されていない値は既定値になり、ツールバーに警告が出ます。
- 例：`screens/post-detail.html?stage=wireframe&lang=en&theme=dark&auth=member&scenario=hidden-own`

## レビューの進め方

1. **ワイヤーフレーム**：`stage=wireframe` で、配置・情報の構成・画面遷移をレビューします。色はグレーのみで、装飾は表示しません。
2. 指摘を反映し、`data/screens.js` の各画面の `review.wireframe.status` を `draft` → `in-review` → `changes-requested` / `approved` と更新します。
3. **ハイフィデリティ**：全画面のワイヤーフレームが `approved` になってから着手します。ワイヤーフレームが未承認の画面をハイフィ段階で開くと、「未確定」のバナーが出ます。
4. ハイフィのレビューで配置の変更が必要になった場合は、ワイヤーフレームの状態を `in-review` に戻します。マークアップは 1 つなので、変更は両方の段階に反映されます。

## 検査の実行方法

検査には Node.js 22 以降が必要です（モック本体は Node.js に依存しません）。

```sh
cd mockups
npm install                  # 開発用の依存（TypeScript、Playwright）
npx playwright install chromium   # E2E を実行するときだけ
```

| コマンド | 内容 |
|----------|------|
| `npm run check` | 下の 4 つの静的検査をまとめて実行 |
| `npm run check:registry` | 画面レジストリ（15 画面、ファイルの存在、段階の承認順序） |
| `npm run check:tokens` | トークン以外の色・寸法の値の使用 |
| `npm run check:contrast` | トークンの組み合わせのコントラスト比、ダークテーマ定義の一致 |
| `npm run check:i18n` | 辞書のキー（使用キーの存在、日英のキー集合の一致、用語集のキー） |
| `npm run typecheck` | JS の型検査（`tsc --noEmit`、契約は `types.d.ts`） |
| `npm run test:unit` | 純粋なロジックの単体テスト（`node --test`） |
| `npm run test:e2e` | ブラウザでの検査（Playwright、Chromium、`file://`） |

検査は違反を「ファイル:行 内容」の形式で出力し、1 件でもあれば終了コード 1 で終わります。
E2E のスクリーンショットは `mockups/.review/` に保存されます（Git の管理外）。
