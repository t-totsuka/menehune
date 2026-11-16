# Brief: ui-mockups

## Problem
暦・天文・星図・投稿コミュニティという多機能サービスであり、画面構成・情報密度・用語（日英）が未確定のまま実装に入ると、各 spec が個別に UI を作り一貫性が崩れ、手戻りが大きくなる。

## Current State
コードなし（greenfield）。要求仕様.md に機能列挙のみ存在。

## Desired Outcome
主要画面の静的モック（SVG / HTML / 画像）が揃い、レイアウト・ナビゲーション・デザイントークン（色・タイポ・余白、ライト/ダーク）・日英の主要用語がレビュー済みで、以降の spec が参照できる。

## Approach
実装フレームワークに依存しない静的 HTML/CSS + SVG でモックを作成し、レビューで確定させる。後続の Next.js コンポーネント化を見越して画面をコンポーネント単位で分割して描く。

## Scope
- **In**:
  - 画面モック: トップ（今日の暦＋天文＋投稿）、月/日カレンダー、日詳細（暦注・天文現象）、天文現象一覧、星図、投稿詳細（コメントツリー・地図・天気・出没・いいね・通報）、投稿作成/編集（公開範囲・位置精度）、自分の投稿一覧、ユーザ設定、ログイン、通報/異議申し立て、管理画面、出典表示ページ
  - PC / スマートフォン幅のレイアウト
  - デザイントークン定義、日英用語集（暦注・天文用語の英訳方針含む）
- **Out**: 実データ・動作するロジック、Next.js 実装

## Boundary Candidates
- 画面モック群
- デザイントークン
- 用語集（i18n キーの元）

## Out of Boundary
- i18n の技術基盤（platform-foundation）
- 各機能のビジネスロジック

## Upstream / Downstream
- **Upstream**: 要求仕様.md
- **Downstream**: 全 spec（特に platform-foundation の共通レイアウト・トークン）

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: platform-foundation

## Constraints
- 日英両方の表記を確認できること（英語で長くなる文言の崩れ確認）
- アクセシビリティ（コントラスト、星図/地図の代替テキスト方針）を考慮
