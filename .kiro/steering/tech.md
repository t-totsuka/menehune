# Technology Stack

## Architecture

TypeScript だけで書くモノレポ（pnpm）にする。Web は Next.js（App Router、SSR）、API は別のサーバ（Hono か Fastify）、DB は PostgreSQL と PostGIS。暦と天文の計算は共有パッケージにまとめ、サーバとブラウザの両方で同じコードを使う（星図はブラウザで描くため）。

現時点で存在するのは、確定済みの UI モック集（`mockups/`。ビルドなしの静的なファイル）だけである。モノレポは platform-foundation で作る。

## Core Technologies

- **言語**: TypeScript（Node.js）
- **Web**: Next.js（App Router、SSR）、next-intl
- **API**: Hono または Fastify（platform-foundation で決める）
- **DB**: PostgreSQL + PostGIS、Drizzle ORM
- **実行環境**: WSL2（Ubuntu）上の Docker Compose（Next.js、API、PostgreSQL+PostGIS）

## Key Libraries

- **astronomy-engine**（MIT）: 暦と天文の計算の基盤。バージョンを固定する
- **Better Auth**: Google OAuth2（スコープは `openid email profile` 以内）とセッション
- **d3-geo / d3-geo-projection または Canvas**: 星図を自作する。恒星は Yale Bright Star Catalogue、星座線は BSD の GeoJSON
- **Leaflet 1.9.x**: 地図（クライアントだけ）。タイルは地理院タイル（出典を表示する）

## Key Technical Decisions

- **TypeScript で統一する**: astronomy-engine がサーバとブラウザの両方で動き、暦・天文・星図で計算を共有できる。Python と TS の 2 言語構成は、計算ロジックが分散するので採らなかった
- **採らなかったもの**: Lucia（非推奨）、Auth.js（保守モード）、d3-celestial（d3 v3 依存で SSR に非対応）、tile.openstreetmap.org（公開サービスに不向き）、Nominatim などの外部の逆ジオコーディング
- **逆ジオコーディングはオフラインで行う**: 国土数値情報 N03（行政区域）を PostGIS に取り込んで判定する
- **天気は Open-Meteo**: 無料枠は非商用で CC BY 4.0 なので、サーバ側でキャッシュする。商用化するときは有料プランかセルフホストに切り替える
- **旧暦の 2033 年問題**: 明示的に扱い、回帰テストで確かめる

## Development Standards

### Type Safety
- strict にする。モック集は JS だが、`checkJs` と `strict` で型を検査する（契約は `mockups/types.d.ts`）
- 型の契約は 1 か所に置き、データ、部品、画面が同じ型を参照する

### i18n
- 文言のキーは、ドット区切りの英小文字・数字・ハイフンで、言語に依存しない（例：`nav.calendar`、`rokuyo.taian`、`sekki.risshun`）
- `ja` と `en` のキー集合は完全に一致させ、機械で検査する。言語は、辞書を 1 つ足せば増やせる構造にする
- 投稿の本文や表示名など、ユーザが書いた文は訳さない
- 日付と時刻は日本時間（Asia/Tokyo）に固定して表示し、どちらの言語でも 24 時間表記にする

### Design Tokens
- 色、余白、文字の大きさなどは、トークン（CSS カスタムプロパティ）だけを使い、リテラルの値を書かない。ライトとダークの両方を定義する
- コントラスト（文字 4.5:1、UI 3:1）は、トークンの組ごとに機械で検査する

### Testing
- 純粋なロジックは単体テスト（モック集では `node --test`）、ブラウザでの振る舞いは Playwright で確かめる
- 画面の E2E では、コンソールの警告もテストの失敗として扱う。外部へのリクエストは遮断する
- はみ出しは、360〜1920px の幅、日英、ライトとダークの組み合わせで検査する

## Development Environment

### Required Tools
- Node.js（モック集は Windows の Node v26、npm 12 で検証した）、Docker Compose（WSL2）
- リポジトリと PGDATA は Linux のファイルシステム側に置く（`/mnt/c` の下は避ける）。PGDATA は named volume にする

### Common Commands（モック集 `mockups/`）
```bash
npm run check       # 画面の登録・トークン・コントラスト・辞書の静的検査
npm run typecheck   # tsc --noEmit
npm run test:unit   # node --test tests/unit
npm run test:e2e    # Playwright（C:\ のパスから実行する）
```
Playwright は、Git Bash の `/c/...` や小文字の `c:\` から実行すると、`file://` の URL のドライブ名の大小が合わず、一部のテストが落ちる。PowerShell で `C:\` から実行する。

## Git Workflow

- 仕様ごとにブランチを作る（ブランチ名は仕様の名前。例：`ui-mockups`）。main に直接コミットしない
- コミットのメッセージは `type(spec): 日本語の要約 (タスク番号)` の形にする（例：`feat(ui-mockups): 一覧ページを作る (6.2)`）。仕様をまたぐ文書の変更は `docs: ...`
- main へは GitHub の PR で Squash and merge する。main には仕様ごとにまとまったコミットが並ぶ

---
_updated_at: 2026-11-21（初版。roadmap.md の技術選定と、ui-mockups で使った取り決めから作成）_
