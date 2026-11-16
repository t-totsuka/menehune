# Brief: star-chart

## Problem
ユーザは特定の日時・地点（例: 投稿地点や自宅）で見える星空を確認したい。

## Current State
なし。astronomy-events が惑星・月の位置計算を提供予定。

## Desired Outcome
指定日時・地点の全天星図（地平座標）がブラウザで表示され、恒星・星座線・星座名（日英）・惑星・月・太陽が正しい位置に描かれる。日時と地点を変更できる。

## Approach
d3-celestial は採用せず（d3 v3 依存・SSR 非対応・保守停滞）、d3-geo + d3-geo-projection（立体射影など）または Canvas で自作する。恒星は Yale Bright Star Catalogue（パブリックドメイン）、星座線は BSD ライセンスの GeoJSON、惑星・月は astro-core で計算。クライアントサイド描画（Next.js では SSR 無効の動的読込）。

## Scope
- **In**:
  - 全天図（天頂中心、方位表示）、恒星（等級で大きさ）、星座線・星座名、惑星・月（位相表示は任意）・太陽
  - 日時・地点（緯度経度、プリセット/現在地）入力
  - 日英ラベル、星表データの前処理スクリプト
  - 出典表示への登録
- **Out**: ドラッグ視点移動・ズーム・時間送りアニメーション等のプラネタリウム機能、深宇宙天体カタログ

## Boundary Candidates
- 星表データ前処理・配信
- 座標変換と描画コンポーネント

## Out of Boundary
- 天体位置計算の本体（astro-core）
- 地図表示（post-location-weather）

## Upstream / Downstream
- **Upstream**: astronomy-events, platform-foundation
- **Downstream**: post-location-weather（投稿地点の星図リンク）

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: astronomy-events

## Constraints
- データライセンス: CC BY-SA の星表（HYG 等）や Stellarium skyculture を使う場合は継承義務を確認・表示
- モバイルでも描画性能が十分であること
