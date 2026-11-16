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
