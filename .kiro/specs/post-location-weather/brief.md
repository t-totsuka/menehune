# Brief: post-location-weather

## Problem
投稿にその場所の文脈（地域・地図・日月の出没・当時の天気）を付けたいが、ユーザのプライバシーのため位置の公開精度はユーザが選べる必要がある。

## Current State
なし。posts-comments が投稿、astro-core が出没計算を提供予定。

## Desired Outcome
投稿時に位置を付与でき、公開精度（厳密 / ランダム 1km 誤差 / 市区町村 / 都道府県 / 国）に応じて丸めた位置だけが他者に公開される。投稿には市区町村名・地図・その地点の日の出/日の入り/月の出/月の入り、投稿時点の天気概況（天候・気温・湿度・風速 等）が表示される。

## Approach
位置は PostGIS に保存。市区町村判定は国土数値情報 N03 行政区域を PostGIS に取り込みオフラインで point-in-polygon（外部逆ジオコーディング API に依存しない）。国外は国レベル（Natural Earth 等）。公開用座標は保存時に精度に応じてサーバ側で生成・保存（1km 誤差は投稿ごとに固定の乱数で生成し再計算で揺れないようにする）。地図は Leaflet 1.9.x + 地理院タイル。天気は Open-Meteo を投稿時にサーバから取得し保存（グリッド単位キャッシュ）。

## Scope
- **In**:
  - 位置入力（ブラウザ Geolocation / 地図クリック）、精度選択（ユーザ既定値あり）、後から精度変更
  - 公開座標の生成・保存、厳密座標は本人のみ参照可
  - N03 / 国境データの取り込みスクリプトと更新手順
  - 地図表示（公開精度に応じたズーム/範囲表示）
  - 地点の日月出没（astro-core 利用、地点タイムゾーン）
  - 投稿時の天気取得・保存・表示（失敗時のリトライ/欠損表示）
  - 出典表示（地理院タイル、国土数値情報、Open-Meteo CC BY 4.0）
- **Out**: 投稿本体、星図

## Boundary Candidates
- 位置精度・匿名化
- 行政区域判定
- 天気取得・保存
- 地図/出没表示

## Out of Boundary
- 投稿の CRUD と可視性（posts-comments）
- 天文計算本体（astronomy-events）

## Upstream / Downstream
- **Upstream**: posts-comments, astronomy-events, auth-users（既定精度）
- **Downstream**: star-chart への連携リンク（任意）

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: posts-comments, star-chart

## Constraints
- Open-Meteo 無料枠は非商用・呼出上限あり → 商用化時は有料プラン/セルフホストに切替できる抽象化
- 低精度設定の投稿で、天気や出没時刻から厳密位置が逆算されない粒度で保存・表示する
- 地図タイル提供元は差し替え可能にする

## ui-mockups で決めた暫定の値・前提（機能の仕様で確定する）
- 投稿作成・編集の位置の公開精度は閉じたアコーディオン（見出しに「位置の公開精度：{段階}」を出す）。設定画面の既定値の選択は開いたまま。公開精度に誤りを出すときはアコーディオンを開いて見せる必要がある（モックでは未実装）。参照：`mockups/README.md`「投稿作成・編集」、`mockups/screens/post-edit.html`
