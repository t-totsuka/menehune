# Brief: astronomy-events

## Problem
ユーザは惑星現象や月の位相・軌道上のイベント、日月の出没時刻を一か所で確認したい。また暦・星図・投稿地点情報がいずれも天文計算を必要とし、共通の計算基盤が無いと重複・不整合が生じる。

## Current State
なし。

## Desired Outcome
共有パッケージ（仮 `packages/astro-core`）が天文計算 API を提供し、サーバ/ブラウザ双方から利用できる。Web では期間内の天文現象一覧と、日ごと・地点ごとの日月出没が表示される。

## Approach
astronomy-engine (MIT, バージョン固定) をラップした astro-core を作成。標準関数（SearchMoonPhase, SearchLunarApsis, SearchSunLongitude, SearchRiseSet, SearchRelativeLongitude, SearchMaxElongation, Seasons）に加え、未提供のイベントは自前探索で実装する。年単位の結果はキャッシュ（DB または事前計算）する。

## Scope
- **In**:
  - 月: 朔・上弦・望・下弦、近地点・遠地点、最北・最南（赤緯極値: GeoMoon → 視赤道座標の赤緯の極値を Search で探索）
  - 惑星現象: 合・衝・外合/内合、東方/西方最大離角（水星・金星）、留（必要に応じ）、惑星同士・月と惑星の接近（自前探索）
  - 日の出・日の入り・月の出・月の入り（任意地点・タイムゾーン）
  - 太陽黄経探索 API（almanac-calendar が二十四節気・七十二候・雑節に利用）
  - 天文現象一覧 API・画面、日付詳細への組込み
  - 精度検証用テスト（国立天文台 暦要項 / 暦計算室データとの照合）
- **Out**: 暦注の算出ロジック（almanac-calendar）、星図描画（star-chart）

## Boundary Candidates
- astro-core 計算ライブラリ（純粋関数・UI 非依存）
- 天文現象 API とキャッシュ
- 天文現象表示 UI

## Out of Boundary
- 旧暦・六曜・祝日などの暦ルール
- 星表データの管理と描画

## Upstream / Downstream
- **Upstream**: platform-foundation
- **Downstream**: almanac-calendar, star-chart, post-location-weather

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: almanac-calendar（太陽黄経・朔の API 契約を共有）, star-chart

## Constraints
- astronomy-engine の精度は約 ±1 分角（月イベント時刻は数分の誤差あり得る）。表示は分単位とし、精度の注記を出典ページに記載
- すべての時刻は UTC で計算し、表示時に地点/ユーザのタイムゾーンへ変換

## ui-mockups で決めた暫定の値・前提（機能の仕様で確定する）
- 天文現象一覧：今日より前の現象に「過去」（Past）の印を付け、日数は出さない。今日以降は日時の後ろに「n日後」「今日」（in n days / today）を出す。判定は日付単位で、時刻は見ない。トップの「今日と直近の天文現象」も同じ。参照：`mockups/README.md`「天文現象一覧」、`mockups/screens/astro-events.html`
