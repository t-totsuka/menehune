# Brief: auth-users

## Problem
投稿・コメント・通報・いいねには本人識別が必要だが、個人情報の取得・保持は最小限にしたい。

## Current State
なし。

## Desired Outcome
Google OAuth2 でログイン/ログアウトでき、最小限のユーザ情報とセッションが管理される。ユーザは表示名・言語・「自分の投稿の未ログイン閲覧可否」既定値・位置精度既定値を設定できる。管理者ロールが存在する。

## Approach
Better Auth（Drizzle アダプタ、Google プロバイダ）を採用。Lucia（非推奨）・Auth.js（保守モード）は採用しない。代替案は arctic + 自前セッションテーブル。スコープは `openid email profile` 以内で、保存は Google の sub・表示名（ユーザ編集可）・必要ならメールのみ。

## Scope
- **In**:
  - Google OAuth2 ログイン/ログアウト、セッション（HttpOnly Cookie、CSRF 対策）
  - users テーブル（最小項目）、ユーザ設定（表示名、UI 言語、既定の公開範囲、既定の位置精度）
  - 返信のお知らせの受け取り設定（初期値オン。お知らせ本体は posts-comments が参照して使う）
  - ロール（一般 / 管理者）と認可ヘルパ（API ミドルウェア・Web ガード）
  - 退会（アカウント削除時の投稿の扱い方針）
- **Out**: 投稿の公開設定の適用ロジック（posts-comments）、Google 以外のプロバイダ

## Boundary Candidates
- 認証・セッション
- ユーザプロファイルと設定
- ロール/認可

## Out of Boundary
- 投稿・コメントのデータ
- 通報・非表示処理

## Upstream / Downstream
- **Upstream**: platform-foundation
- **Downstream**: posts-comments, moderation-reports, reactions-likes, post-location-weather

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: platform-foundation

## Constraints
- 取得データは最低限（要求仕様）。プライバシーポリシーに取得項目を明記
- 管理者の付与方法（初期管理者の設定手段）を定義

## ui-mockups で決めた暫定の値・前提（機能の仕様で確定する）
- 設定画面の「コメントへの返信をお知らせで受け取る」：チェックボックス、初期値オン、ほかの既定値と同じく保存ボタンで反映。オフのときのヘッダーの扱いは posts-comments と決める。参照：`mockups/README.md`「設定」、`mockups/screens/settings.html`
- 未ログインの案内：ログイン画面以外の全画面で、ヘッダーと `<main>` の間の全幅の帯（閲覧のみの案内とログインの導線）。ログイン画面には出さない。会員向けの画面（投稿作成・編集、自分の投稿、設定、通報、異議申し立て）は本文に理由の 1 行だけを出し、フォームは出さない。帯の部品は platform-foundation の共通レイアウト。参照：`mockups/README.md`「全画面：未ログインの案内」
