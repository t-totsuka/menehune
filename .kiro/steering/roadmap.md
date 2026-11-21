# Roadmap

## Overview
日本の暦（六曜・旧暦・月齢・二十四節気・七十二候・雑節・祝日）と天文現象（惑星現象・月の朔望/上下弦/最北最南/近地点遠地点・出没）、指定日時・地点の全天星図を提供し、Google OAuth2 でログインしたユーザが「当日〜未来日」に紐づく記事をオープンに投稿・ツリー状にコメントできる、日英対応の本格的な公開 Web サービスを構築する。

開発はまず静的モック（SVG / HTML / 画像）で UI を確定させ、その後 TypeScript 統一のモノレポ上で、暦・天文計算を共有パッケージ化してサーバとブラウザ双方で再利用する。当面の実行環境は WSL2 (Ubuntu) 上の Docker Compose。

## Approach Decision
- **Chosen**: 案A — TypeScript 統一モノレポ（pnpm）。Next.js (App Router, SSR, next-intl) + API サーバ (Hono または Fastify) + PostgreSQL/PostGIS (Drizzle ORM) + astronomy-engine（共有パッケージでサーバ/ブラウザ両用）
- **Why**: 天文計算ライブラリ astronomy-engine (MIT) がサーバとブラウザ双方で動作し、暦計算と星図描画で同一コードを共有できる。単一言語で開発・保守コストが低く、Next.js は多言語化・公開投稿の SEO（SSR）に有利。UI モック先行の進め方とも相性が良い。
- **Rejected alternatives**:
  - 案B Python (FastAPI + Skyfield) + TS SPA — 精度は最高だが2言語構成になり、星図のためにブラウザ側にも天文計算が必要で計算ロジックが分散する
  - 案C Kotlin (Ktor) + TS — 構成が重く Web エコシステムが案A に劣る
- **Viability check で確定した技術選定の補正**:
  - 認証: Lucia（非推奨化）・Auth.js（保守モード）は採用しない → **Better Auth**（Drizzle アダプタ、Google 対応）または arctic + 自前セッション
  - 星図: d3-celestial（d3 v3 依存・SSR 非対応）は採用しない → **d3-geo / d3-geo-projection または Canvas による自作**。恒星は Yale Bright Star Catalogue（PD）、星座線は BSD の GeoJSON、惑星位置は astronomy-engine
  - 地図タイル: tile.openstreetmap.org は公開サービスで不適 → **地理院タイル**（出典表示）を既定、将来は商用タイル / Protomaps も可
  - 逆ジオコーディング: Nominatim / GSI 非公式 API に依存しない → **国土数値情報 N03 行政区域を PostGIS に取り込みオフライン判定**
  - 天気: Open-Meteo（無料枠は非商用・CC BY 4.0）→ サーバ側キャッシュ必須。商用化時は有料プランまたはセルフホストに切替
  - 地図描画は Leaflet 1.9.x 安定版（クライアント側のみ）

## Scope
- **In**:
  - UI 静的モック（主要画面、日英）
  - 暦計算とカレンダー表示（六曜・旧暦・月齢・二十四節気・七十二候・雑節・日本の祝日）
  - 天文現象計算（惑星現象、月の朔・望・上弦・下弦・最北・最南・最近・最遠、日月の出没）
  - 指定日時・地点の全天星図
  - Google OAuth2 ログイン（最小スコープ）、ユーザ設定、管理者ロール
  - 当日〜未来日への記事投稿、ツリー状コメント、未ログイン閲覧可否（投稿単位・既定値）、自分の投稿一覧、論理削除
  - 投稿の位置情報（5 段階の公開精度）、地図、地点の日月出没、投稿時天気の保存・表示
  - 通報（n 件で一時非表示、管理者即時非表示）、異議申し立て
  - いいね投票
  - 日英ローカライズ（他言語へ拡張可能な構造）
- **Out**:
  - クラウド本番デプロイ・CDN・監視基盤（当面ローカル Docker のみ。構成は将来移行可能に保つ）
  - インタラクティブなプラネタリウム（視点ドラッグ・時間送りアニメーション等）
  - 画像/動画アップロード（要求に無いため。導入時は EXIF GPS 除去を必須とする）
  - 日英以外の言語リソースの実装
  - Google 以外の認証プロバイダ

## Constraints
- 実行環境: WSL2 Ubuntu + Docker Compose。リポジトリと PGDATA は Linux ファイルシステム側（/mnt/c 配下を避ける）、PGDATA は named volume
- 言語: TypeScript（Node.js）。DB は PostgreSQL（+ PostGIS）
- 天文計算はライブラリ（astronomy-engine）を利用し、バージョン固定。旧暦は国立天文台「暦要項」と回帰テストで照合、旧暦2033年問題を明示的に扱う
- 祝日: 翌年以降は予測値（春分・秋分は astronomy-engine で検算し「予定」表示）
- Google OAuth2 スコープは `openid email profile` 以内の最小限、保存項目も最小限
- 公開サービスとして: 外部データ/タイルの出典表示ページ、プライバシーポリシー（個人情報保護法）、情報流通プラットフォーム対処法を踏まえた通報・削除フロー、レート制限
- 位置情報はユーザ指定の精度でサーバ側で丸めてから公開（厳密値はユーザ本人以外に返さない）

## Boundary Strategy
- **Why this split**:
  - UI モックを最初に独立させ、以降の全 spec が画面・用語・デザイントークンの合意済み成果物を参照できるようにする
  - 暦（almanac）と天文現象（astronomy）は同じライブラリを使うが、利用者・出力形態（日単位の暦注 vs 時刻付きイベント）が異なるため分離。星図は描画責務として独立
  - 認証・投稿・位置天気・通報・いいねは、データ所有境界（users / posts+comments / post_locations+weather / reports+appeals / likes）で分け、並行実装できるようにする
- **Shared seams to watch**:
  - `packages/astro-core`（仮）: almanac-calendar / astronomy-events / star-chart / post-location-weather が共有する計算 API の契約（入力: 日時・タイムゾーン・緯度経度、出力型）
  - 投稿の「可視性判定」: posts-comments（公開設定・論理削除）、moderation-reports（一時非表示）の両方が関与 → 可視性判定を単一の関数/クエリ層に集約し、moderation はフラグを提供する側に限定
  - i18n リソースのキー命名規約（platform-foundation が定義、各 spec が追加）
  - 管理者ロールの定義は auth-users が所有し、moderation-reports は参照のみ
  - サイト内のお知らせ: 返信のお知らせ（posts-comments）、通報の対象ユーザへの通知（moderation-reports）、受け取り設定（auth-users）、ヘッダーの未読件数（platform-foundation の共通レイアウト）が関与 → お知らせの仕組みを共有するかを posts-comments の design で決める

## Specs (dependency order)
- [x] ui-mockups -- 主要画面の静的モック（SVG/HTML）・デザイントークン・日英表記の確定。Dependencies: none
- [ ] platform-foundation -- pnpm モノレポ、Docker Compose（Next.js / API / PostgreSQL+PostGIS）、i18n 基盤、共通レイアウト、出典表示ページ。Dependencies: ui-mockups
- [ ] astronomy-events -- astro-core 共有パッケージと、惑星現象・月の朔望/上下弦/最北最南/近地点遠地点・日月出没の計算 API と表示。Dependencies: platform-foundation
- [ ] almanac-calendar -- 六曜・旧暦・月齢・二十四節気・七十二候・雑節・祝日の計算とカレンダー画面。Dependencies: platform-foundation, astronomy-events
- [ ] star-chart -- 指定日時・地点の全天星図（自作 d3-geo/Canvas、BSC 恒星、星座線、惑星・月）。Dependencies: astronomy-events
- [ ] auth-users -- Google OAuth2（Better Auth、最小スコープ）、セッション、ユーザ設定（既定の公開範囲、返信のお知らせの受け取り）、管理者ロール。Dependencies: platform-foundation
- [ ] posts-comments -- 当日〜未来日への投稿、ツリー状コメント、未ログイン閲覧可否、自分の投稿一覧、返信のお知らせ（サイト内）、論理削除、可視性判定層。Dependencies: auth-users
- [ ] post-location-weather -- 位置 5 段階精度・N03 による市区町村判定・地理院タイル地図・地点の日月出没・投稿時天気保存。Dependencies: posts-comments, astronomy-events
- [ ] moderation-reports -- 通報（n 件で一時非表示、管理者即時非表示）、異議申し立て、管理画面。Dependencies: posts-comments, auth-users
- [ ] reactions-likes -- 投稿（必要ならコメント）へのいいね投票と集計表示。Dependencies: posts-comments
