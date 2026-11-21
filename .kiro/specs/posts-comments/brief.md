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
  - 返信のお知らせ（自分のコメントへの返信をサイト内で知らせる。ui-mockups 要件 6.9〜6.11）：ヘッダーの未読件数、自分の投稿一覧のお知らせ一覧、受け取り設定（auth-users のユーザ設定）の参照
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
- **Adjacent**: moderation-reports（可視性の共有シーム、サイト内の通知）, auth-users（お知らせの受け取り設定）, platform-foundation（ヘッダーの未読件数の表示枠）

## Constraints
- 未ログイン非公開の投稿は SSR・API・OGP・サイトマップ全てで漏れないこと
- 編集可能期間・未来日の上限（任意）を design で決定

## 返信のお知らせ（ui-mockups から引き継ぎ）
- 画面（ui-mockups で承認済み）：ログイン時だけヘッダーに「お知らせ（未読 n 件）」（0 件は「お知らせ」）を出し `my-posts.html#notices` へ移る。自分の投稿一覧のお知らせ（未読・既読の文字、返信の日時、返信した人、抜粋、どの投稿か、「返信を見る」）と空状態・取得エラー。設定に受け取りのチェックボックス（初期値オン）。参照：`mockups/README.md` の「自分の投稿」「全画面：ヘッダーのお知らせ」「設定」
- 範囲外：サイトの外への通知（メール・プッシュなど）。ui-mockups でも範囲外
- 未決（requirements で決める）：
  - 対象：自分のコメントへの返信だけか、自分の投稿への（返信でない）コメントも含むか。削除済みの返信の扱い（モックでは出さない）
  - 既読になる時点：一覧を開いたとき／「返信を見る」を押したとき／まとめて既読にする操作
  - 保持期間
  - 受け取りをオフにしたときのヘッダー（導線ごと隠すか、件数だけ出さないか）
  - 「返信を見る」の移動先（モックはコメントの見出し `#post-comments` まで。コメントごとのアンカーで返信の位置まで移すか）
  - moderation-reports の「対象ユーザへの通知（サービス内）」と仕組みを共有するか

## ui-mockups で決めた暫定の値・前提（機能の仕様で確定する）
- 自分の投稿一覧のページング：投稿の一覧とお知らせの一覧の両方を 30 件ごと（暫定）。30 件以下ではページ送りを出さない。ページは URL に残さない（再読み込みで 1 ページ目）。参照：`mockups/README.md`「自分の投稿」、`mockups/assets/js/components/shell.js`（`mk-pager`）
- 自分の投稿一覧の並び：対象日の新しい順 → 投稿日時の新しい順 → id。要望の「新しい日付」を対象日と読んだ（投稿日時の意味なら並べ直す）。参照：`mockups/README.md`「自分の投稿」
- 自分の投稿のコメント件数：ツリー全体で返信を含む。削除済みのコメントは数えず、その下の返信は数える（0 件も出す、削除済みの投稿には出さない）。参照：`mockups/README.md`「自分の投稿」、`mockups/assets/js/components/posts.js`（`comment-count`）
