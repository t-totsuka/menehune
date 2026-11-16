# Brief: moderation-reports

## Problem
公開サービスとして不適切な投稿・コメントへの対処が必要。一方で誤通報・悪意ある通報から投稿者を守る仕組みも必要。

## Current State
なし。posts-comments が可視性判定層、auth-users が管理者ロールを提供予定。

## Desired Outcome
一般ユーザの通報が n 件（設定可能）に達すると対象は一時非表示になり、管理者の申し立ては即非表示になる。対象ユーザは異議申し立てができ、管理者が審査して復帰/削除を決定できる。

## Approach
reports / moderation_actions / appeals テーブルで状態遷移（表示 → 一時非表示 → 審査 → 復帰 or 削除）を管理し、非表示フラグを posts-comments の可視性判定層に供給する。同一ユーザの重複通報は 1 件として数える。

## Scope
- **In**:
  - 投稿・コメントへの通報（理由カテゴリ）
  - 閾値 n による自動一時非表示、管理者による即時非表示
  - 対象ユーザへの通知（サービス内）と異議申し立て
  - 管理画面（通報キュー、審査、操作履歴）
  - 通報のレート制限・濫用対策
  - 情報流通プラットフォーム対処法を踏まえた対応記録
- **Out**: 投稿の可視性判定そのもの（posts-comments）、ロール管理（auth-users）

## Boundary Candidates
- 通報受付と集計
- モデレーション状態遷移
- 異議申し立てと審査

## Out of Boundary
- 投稿・コメントの CRUD
- ユーザロールの付与

## Upstream / Downstream
- **Upstream**: posts-comments, auth-users
- **Downstream**: なし

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: posts-comments（可視性シーム）, reactions-likes

## Constraints
- 一時非表示中も投稿者本人には見え、状態が分かること
- 閾値 n は設定値として変更可能
