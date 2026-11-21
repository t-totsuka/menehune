# Project Structure

## Organization Philosophy

仕様（spec）ごとに作り、仕様はデータの持ち主の境界で分ける（users、posts と comments、post_locations と weather、reports と appeals、likes）。暦（日単位の暦注）と天文（時刻付きの現象）は、同じ計算ライブラリを使うが、使う人と出力の形が違うので別の仕様にする。星図は描画の責務として独立させる。

複数の仕様が関わる継ぎ目は、1 か所に集める。
- **暦と天文の計算**: 共有パッケージ（`packages/astro-core`、仮）の API の契約（入力は日時・タイムゾーン・緯度経度）
- **投稿の可視性**: 判定を 1 つの関数かクエリの層に集める。moderation-reports はフラグを提供するだけにする
- **管理者ロール**: auth-users が定義し、ほかの仕様は参照するだけにする
- **i18n のキー**: platform-foundation が規約を決め、各仕様がキーを足す
- **サイト内のお知らせ**: 仕組みを共有するかは、posts-comments の design で決める

## Directory Patterns

### 仕様と steering
**Location**: `.kiro/specs/{spec}/`、`.kiro/steering/`
**Purpose**: 仕様ごとの brief、requirements、design、tasks。steering はプロジェクト全体の取り決め。仕様の一覧と依存の順番は `roadmap.md` にある
**Example**: `.kiro/specs/posts-comments/brief.md`

### UI モック集（確定版）
**Location**: `mockups/`
**Purpose**: 全画面の基準となる静的なモック。ビルドもサーバも不要で、`file://` で開く。後続の仕様は参照するだけで、作り直さない
**Example**: 画面は `mockups/screens/{画面ID}.html`、決めたことと論点は `mockups/README.md`

### アプリ本体（platform-foundation で作る）
**Location**: `apps/`、`packages/`（予定）
**Purpose**: Next.js の Web と API サーバを `apps/` に、暦と天文の計算などの共有コードを `packages/` に置く
**Example**: `packages/astro-core`（仮）

## Naming Conventions

- **ファイル**: kebab-case（例：`mock-state.js`、`calendar-month.html`）
- **画面の ID**: kebab-case で、ファイル名と一致させる（例：`day-detail` → `screens/day-detail.html`）
- **UI の部品**（モック集）: カスタム要素で `mk-` を付ける（例：`mk-month-calendar`、`mk-post-card`）
- **文言のキー**: ドット区切りで、分類から始める（例：`screen.top.title`、`astro.event.new-moon`）
- **テスト**: ブラウザのテストは `*.spec.mjs`、単体テストは `tests/unit/*.test.mjs`

## Code Organization Principles

### 依存の向き（モック集で確かめた形。アプリでも同じ向きを保つ）
型定義 → データ（画面の登録、辞書、用語集、サンプル） → 基盤（状態、ページング、i18n、テーマ） → 部品 → 画面

逆向きの参照はしない。部品どうしは、子として置く場合だけ参照してよい。DOM を持たない純粋な計算（例：ページの範囲）は、部品ではなく基盤に置き、部品と画面の両方から使う。

### 正本を 1 つにする
- 画面の一覧と各画面のレビュー状態は、画面の登録（モック集では `data/screens.js`）が正本
- 文言は言語ごとの辞書が正本。用語集は文言を持たず、キーに分類と英訳の方針を付けるだけ
- 見た目の値はトークン（`tokens.css`）が正本

### 検査で守る
取り決めは文章だけにせず、検査のスクリプトやテストで守る（キー集合の一致、トークン以外の値の禁止、コントラスト、画面の登録の不変条件など）。

---
_updated_at: 2026-11-21（初版。roadmap.md の境界の方針と、ui-mockups の構成から作成）_
