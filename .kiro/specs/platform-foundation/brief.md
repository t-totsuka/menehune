# Brief: platform-foundation

## Problem
複数 spec が並行して実装されるため、リポジトリ構成・実行環境・DB 接続・i18n・共通レイアウトの土台が無いと、各 spec が独自に基盤を作り衝突する。

## Current State
コードなし。WSL2 Ubuntu + Docker が利用可能。

## Desired Outcome
`docker compose up` で Next.js（Web）・API サーバ・PostgreSQL(PostGIS) が起動し、日英切替可能な共通レイアウトが表示される。各 spec はパッケージ/モジュールを追加するだけで機能を載せられる。

## Approach
pnpm モノレポ（apps/web: Next.js App Router、apps/api: Hono または Fastify、packages/*: 共有）。Drizzle ORM とマイグレーション基盤、next-intl による i18n（ロケールを設定で追加できる構造）。ui-mockups のデザイントークンを取り込む。

## Scope
- **In**:
  - モノレポ構成、TypeScript/ESLint/テスト基盤（ユニット・E2E の枠）
  - Docker Compose（web / api / postgres+postgis、named volume）
  - Drizzle 設定・マイグレーション運用
  - i18n 基盤（ja / en、ロケール拡張可能、キー命名規約）、ロケール別ルーティング
  - 共通レイアウト・ナビゲーション・デザイントークン
  - API ↔ Web の型共有方式、エラー形式、レート制限の共通ミドルウェア
  - 出典表示ページ・プライバシーポリシーページの枠
  - タイムゾーン方針（既定 Asia/Tokyo、地点のタイムゾーン対応の枠組み）
- **Out**: 認証、各機能のドメインロジック、クラウドデプロイ

## Boundary Candidates
- リポジトリ/ビルド/実行環境
- i18n 基盤
- 共通 UI シェル

## Out of Boundary
- 認証・セッション（auth-users）
- 天文計算パッケージの中身（astronomy-events）

## Upstream / Downstream
- **Upstream**: ui-mockups
- **Downstream**: 全機能 spec

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: ui-mockups, auth-users

## Constraints
- リポジトリと PGDATA は WSL の Linux ファイルシステム側に置く
- 将来のクラウド移行を妨げない構成（環境変数による設定、12-factor）

## ui-mockups で決めた暫定の値・前提（機能の仕様で確定する）
- 配色（ハイフィは未承認の draft）：ライトは薄藍の明け方の背景 `--color-bg` #e2e6f6（dawn-100）、文字は濃紺 #0b1026（navy-900）、アクセントは藍 #2d3a8c（indigo-700）。ダークは濃紺の背景 #0b1026、アクセントは金 #f4d58a（gold-300）。参照：`mockups/README.md`「ハイフィの配色（タスク 8.2）」、`mockups/assets/css/tokens.css`
- 8.2・8.3 で足した役割トークン：`--color-moon-lit`・`--color-moon-shadow`（月の図の光る側・暗い側。両テーマとも暗い側は濃紺）、`--color-decor-star`（背景の星。ライトは藍、ダークは金）。参照：`mockups/README.md`「ハイフィの装飾（タスク 8.3）」
- 段階の規約（モック）：装飾は `data-decor`・`aria-hidden` のインライン SVG で、ワイヤーフレームでは `visibility: hidden`（場所は残す）。ハイフィだけの規則は `html:not([data-stage="wireframe"])` に書き、書体など配置に関わる値は段階で変えない。役割トークンを足したら `wireframe.css` にグレーの値も足す。製品に段階はないので、装飾の扱いだけを取り込むかを決める。参照：`.kiro/specs/ui-mockups/tasks.md` の Implementation Notes（1.7、8.3）
- 未ログインの案内：ログイン画面以外の全画面で、ヘッダーと `<main>` の間に全幅の帯（`mk-guest-notice band`、領域名「ログインの案内」）を共通レイアウトとして置く。参照：`mockups/README.md`「全画面：未ログインの案内」
