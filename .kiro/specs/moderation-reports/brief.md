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

## ui-mockups で決めた暫定の値・前提（機能の仕様で確定する）
- `ReportQueueItem.reasonCounts`（理由ごとの件数）をモックの型に足した。1 件の通報で理由を 1 つ選ぶ前提（合計が通報件数になる）。本 spec で確かめる。参照：`mockups/types.d.ts`、`mockups/README.md`「管理」
- 管理画面の通報キューは状態ごとの 4 列のかんばん：未対応＝open、一時非表示＝auto-hidden・hidden-by-admin、異議申し立ての審査＝appealed、対応済み＝restored・removed。新しい状態は足しておらず、異議の審査は 3 列目に統合した。参照：`mockups/README.md`「管理」、`mockups/screens/admin.html`
