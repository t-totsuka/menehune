# Brief: reactions-likes

## Problem
ユーザが投稿への共感・評価を手軽に示す手段が欲しい。

## Current State
なし。posts-comments が投稿・コメントを提供予定。

## Desired Outcome
ログインユーザは投稿（必要に応じコメント）に「いいね」を 1 人 1 回付与・取消でき、件数が表示される。未ログインユーザは件数閲覧のみ。

## Approach
likes テーブル（user_id, target_type, target_id の一意制約）と集計カウンタ（非正規化カウント or 集計クエリを design で決定）。楽観的 UI 更新。

## Scope
- **In**: いいね付与/取消、件数表示、自分がいいね済みかの表示、レート制限、非表示・削除対象の扱い
- **Out**: いいね順ランキング・推薦（将来拡張）、通報

## Boundary Candidates
- いいねの記録と集計
- UI コンポーネント

## Out of Boundary
- 投稿の可視性・モデレーション

## Upstream / Downstream
- **Upstream**: posts-comments, auth-users
- **Downstream**: 将来のランキング機能

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: posts-comments, moderation-reports

## Constraints
- コメントへのいいね対象可否を requirements で確定
