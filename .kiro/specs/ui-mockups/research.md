# Research & Design Decisions

## Summary
- **Feature**: `ui-mockups`
- **Discovery Scope**: New Feature（greenfield。外部連携なしの静的成果物のため、軽量な調査）
- **Key Findings**:
  - `file://` で直接開くページでは、Chromium 系で ES モジュール（`type="module"`）・`fetch()`・外部 SVG の `<use href>` が CORS により使えない。共通部品と辞書は classic script（グローバル登録）で読み込む必要がある
  - ワイヤーフレームとハイフィデリティを別々のマークアップで作ると、要件 1.4（ワイヤーの変更をハイフィ前に反映）の同期が人手頼みになる。マークアップを 1 つにし、段階は「見た目の上書き（スキン）」で切り替えるほうが確実
  - 要件 10.4（トークン以外の値を使わない）、13.1/13.2（コントラスト）、12.2/11.6（はみ出し）、2.6（オフライン）は目視レビューだけでは保証できない。機械的なチェック（静的検査スクリプトとヘッドレスブラウザによる検査）で検証する

## Research Log

### `file://` で開く静的ページの制約
- **Context**: 要件 2.1（サーバなし・ビルドなしでブラウザから直接開く）
- **Sources Consulted**: ブラウザの同一オリジンポリシーの既知の挙動（Chromium は `file://` を不透明オリジン `null` として扱う。Firefox も v68 以降は `file://` のオリジンを厳格化）
- **Findings**:
  - `<script type="module">` は CORS エラーになり、読み込めない
  - `fetch()` と `XMLHttpRequest` による JSON の読み込みはできない
  - `<svg><use href="other.svg#id">` で外部ファイルを参照すると表示されない
  - `<script src>`（classic）、`<link rel="stylesheet">`、`<img src="x.svg">`、`<iframe src>` は使える
  - `localStorage` は使えるが、ブラウザやプライベートモードによって例外を出すことがある
- **Implications**: 辞書・サンプルデータ・画面の一覧（レジストリ）は `window.Mock*` に登録する classic script とする。SVG で色をテーマに追従させたい図（星図・地図）は、JS で生成してインライン SVG として描く。保存処理は try/catch で囲み、URL パラメータを正とする

### カスタム要素（Web Components）による部品化
- **Context**: 要件 2.4（部品単位の一覧）。brief の「後で Next.js のコンポーネントに移しやすい分け方」
- **Findings**: Custom Elements v1 は classic script から `customElements.define` で登録でき、`file://` でも動く。Shadow DOM を使うとグローバルな CSS（トークン）が届かない。Light DOM に描画すれば、共通のスタイルシートをそのまま使える
- **Implications**: 部品は Light DOM に描画するカスタム要素とする。`mk-` 接頭辞の 1 要素が、将来の 1 React コンポーネントに対応する

### 書体とオフライン表示
- **Context**: 要件 2.6（外部ネットワークなしでも主要な見た目が崩れない）、9.1（夜空・天文のトーン）
- **Findings**: Google Fonts などの Web フォントは、オフラインでは代替フォントになる。日本語フォントを同梱すると数 MB 単位になる
- **Implications**: OS のシステムフォント（ヒラギノ、游、Noto の各ゴシック・明朝）を並べた指定とし、見出しは明朝系で暦らしさを出す。Web フォントの採用判断は platform-foundation に委ねる

### コントラストの基準
- **Context**: 要件 13.1、13.2
- **Sources Consulted**: WCAG 2.1 の達成基準 1.4.3（文字のコントラスト 4.5:1）、1.4.11（文字以外のコントラスト 3:1）、相対輝度の計算式
- **Implications**: トークンの「前景と背景の組み合わせ」を宣言的に列挙し、両テーマについて相対輝度からコントラスト比を計算するスクリプトで検証する

### 検査用ツール
- **Context**: 要件 12.2、11.6、2.6、9.3、13.5 は、実際のブラウザで描画しないと検証できない
- **Findings**: Playwright は `file://` の URL を開け、`emulateMedia({ colorScheme })`、ビューポート幅の指定、ネットワーク要求の遮断（`route`）ができる
- **Implications**: 検査は開発者用ツール（`mockups/tools`、`mockups/tests`）に限定する。モック本体は依存なしで開ける状態を保つ（要件 2.1）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 素の HTML を画面ごとにコピーする | 部品のマークアップを各画面に複製 | 仕組みが不要 | 部品の修正が全画面に伝わらない。ワイヤーとハイフィの同期も困難 | 不採用 |
| 静的サイトジェネレータ（ビルドあり） | テンプレートから HTML を生成 | 共通化が容易 | 要件 2.1（ビルドなし）に反する | 不採用 |
| **classic script のカスタム要素と単一マークアップ、段階はスキン** | 部品は `mk-*` 要素、画面は 1 つのマークアップで段階を CSS で切替 | ビルド不要。部品の修正が全体に伝わる。ワイヤーの変更がハイフィに自動で反映される | JS が無効だと部品が出ない（レビュー用途なので許容） | 採用 |

## Design Decisions

### Decision: 段階は「単一マークアップとスキン」で表現する
- **Context**: 要件 1.1（2 種類のモック）、1.2（ワイヤーは配色・装飾なし）、1.4（ワイヤーの変更をハイフィ前に反映）
- **Alternatives Considered**:
  1. 段階ごとに別ファイル — 自由度は高いが、二重管理になる
  2. 単一マークアップで `html[data-stage]` によってスキンを切り替える
- **Selected Approach**: 2。ワイヤーフレームのスキンは、色のトークンをグレースケールに再定義し、`[data-decor]` を付けた装飾要素を非表示にする
- **Rationale**: 配置の合意内容が、そのままハイフィの土台になる
- **Trade-offs**: ハイフィだけに必要な配置変更は、ワイヤー段階でも見える形で入れることになる（配置の変更はワイヤーで合意する、という運用と一致する）
- **Follow-up**: ワイヤー段階で色が残っていないことを、E2E で計算後の色を見て検査する

### Decision: 状態は「ログイン状態」と「シナリオ」の 2 軸にする
- **Context**: 要件 3.3〜3.5、6.4、6.5、7.5、7.6、8.4
- **Selected Approach**: `auth`（guest / member / admin）は全画面に共通する軸とする。`scenario`（default / empty / error / private-blocked など）は画面ごとに許可する値をレジストリで宣言する。要素には `data-when-auth`、`data-when-scenario` を付け、条件に合わないものを非表示にする
- **Rationale**: ログイン状態と、空・エラーなどの状態を組み合わせた表示を、1 つのマークアップで確認できる

### Decision: 用語集とメッセージ辞書の識別名を共有する
- **Context**: 要件 11.3〜11.5
- **Selected Approach**: 文言の本体は、言語ごとの辞書（`messages.ja.js`、`messages.en.js`）に置く。用語集（`glossary.js`）は同じキーに、分類・英訳の方針・注記を付けるだけにする
- **Rationale**: 訳語の二重管理を避ける。キーは言語に依存しないので、言語の追加は辞書ファイルを 1 つ足すだけで済む

### Decision: 製品 UI の切替と、レビュー用の切替を分ける
- **Context**: 要件 3.2（ヘッダーに言語・テーマの切替）、1.5、2.3
- **Selected Approach**: 言語とテーマの切替は、製品ヘッダー（`mk-site-header`）に置いて実際に動かす。段階・ログイン状態・シナリオ・一覧への戻りは、画面下部に固定したレビュー用ツールバーに置き、製品の見た目とは別の `review.css` で描く
- **Rationale**: 製品 UI のモックに、レビューの道具が混ざらない

### Decision: 機械的な検査を開発者用ツールとして用意する
- **Context**: 要件 10.4、11.1、11.5、11.6、12.2、13.1、13.2、13.5、2.6、1.3
- **Selected Approach**: 依存なしの Node スクリプト（トークン・コントラスト・辞書・レジストリ）と、Playwright の E2E（はみ出し・オフライン・テーマ・フォーカス・ワイヤーの色）
- **Trade-offs**: 開発者には Node と Playwright のブラウザが必要。モック本体を見るだけなら不要

## Synthesis Outcomes
- **Generalization**: 画面ごとの状態表示を「auth と scenario の 2 軸による条件表示」という 1 つの仕組みにまとめた。地図の 5 段階の精度表示は、1 つの部品（`mk-map-sample`）の属性で表現する
- **Build vs Adopt**: 部品の仕組みは、ブラウザ標準の Custom Elements を採用し、フレームワークは入れない。日付の書式は標準の `Intl.DateTimeFormat` を使う。検査は Playwright を採用する。トークン検査とコントラスト計算は小さいので自作する
- **Simplification**: 段階ごとの別マークアップ、テンプレートエンジン、Shadow DOM、状態管理ライブラリは入れない。部品のファイルは、ドメインごとに 5 つにまとめる

## Risks & Mitigations
- サンプルの暦の値（六曜・旧暦・月齢など）が不正確で、レビューで混乱する — 一覧ページに「サンプル値は未検証」と明記する。正確さは almanac-calendar が保証する
- 英語の長い訳語（七十二候など）で表示が崩れる — 11.6 の E2E で、全画面を英語・両テーマ・複数の幅で検査する
- `localStorage` が使えない環境 — URL パラメータを正とし、保存の失敗は無視する
- ダークテーマの定義の重複（メディアクエリ用と `data-theme` 用）で値がずれる — コントラスト検査スクリプトで、2 つのブロックの値が一致することも検査する

## References
- [WCAG 2.1 1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG21/#contrast-minimum) — 文字のコントラスト 4.5:1
- [WCAG 2.1 1.4.11 Non-text Contrast](https://www.w3.org/TR/WCAG21/#non-text-contrast) — 文字以外のコントラスト 3:1
- [HTML Standard: Custom elements](https://html.spec.whatwg.org/multipage/custom-elements.html) — Light DOM で描画するカスタム要素
- [Playwright: Emulation / Network](https://playwright.dev/docs/emulation) — カラースキーム、ビューポート、ネットワーク遮断
