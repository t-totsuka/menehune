# Brief: posts-comments

## Problem
ユーザは特定の日（当日〜未来日）に紐づく記事を公開し、他者や自分の投稿・コメントに対してツリー状に議論したい。一方で投稿ごとに未ログインユーザへの公開可否を制御したい。

## Current State
なし。auth-users がユーザ・セッション・既定公開設定を提供予定。

## Desired Outcome
ログインユーザは当日以降の日付に記事を投稿・編集・削除（論理削除）でき、投稿とコメントにツリー状のコメントを付けられる。未ログインユーザは閲覧のみで、非公開設定の投稿は見えない。自分の過去投稿一覧を表示できる。

## Approach
posts / comments（parent_id による隣接リスト、取得は再帰 CTE または materialized path）を PostgreSQL で管理。論理削除（deleted_at）を基本とし、削除済みコメントはツリー構造維持のためプレースホルダ表示。可視性判定（公開設定・論理削除・モデレーション非表示フラグ）を単一のクエリ層/関数に集約する。

## Scope
- **In**:
  - 投稿 CRUD（対象日 = 投稿日以降の制約、JST 基準）
  - 投稿単位の「未ログイン閲覧可否」、ユーザ既定値の適用
  - コメント（投稿へ・コメントへ、自分の投稿にも可）、ツリー表示、深さ/ページングの方針
  - 自分の投稿一覧（削除済み含むかの方針）
  - 論理削除（または削除済みテーブル移行の比較を design で決定）
  - 日付ページ・トップへの投稿表示
  - 可視性判定層（moderation-reports が非表示フラグを供給）
  - 入力サニタイズ（Markdown 等の採否）、投稿レート制限
- **Out**: 位置・天気（post-location-weather）、通報（moderation-reports）、いいね（reactions-likes）

## Boundary Candidates
- 投稿ドメイン
- コメントツリー
- 可視性判定

## Out of Boundary
- 位置情報・天気・地図
- 通報・異議申し立て・いいね

## Upstream / Downstream
- **Upstream**: auth-users, platform-foundation, almanac-calendar（日付ページ）
- **Downstream**: post-location-weather, moderation-reports, reactions-likes

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: moderation-reports（可視性の共有シーム）

## Constraints
- 未ログイン非公開の投稿は SSR・API・OGP・サイトマップ全てで漏れないこと
- 編集可能期間・未来日の上限（任意）を design で決定
