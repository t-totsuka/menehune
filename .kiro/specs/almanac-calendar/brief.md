# Brief: almanac-calendar

## Problem
日本の暦情報（六曜・旧暦・月齢・二十四節気・七十二候・雑節・祝日）を、正確かつ一覧性高く日英で確認できるサービスが欲しい。暦注は天文計算に依存し、境界日の扱いを誤りやすい。

## Current State
なし。astronomy-events が太陽黄経・朔の計算 API を提供する予定。

## Desired Outcome
月表示・日詳細カレンダーで、各日の六曜・旧暦日付（閏月含む）・月齢・二十四節気・七十二候・雑節・祝日が日英で表示され、国立天文台データと一致することがテストで保証される。

## Approach
astro-core の太陽黄経探索・朔探索を使い、JST 基準で暦注を算出する純粋関数群（packages 内）を実装。祝日は @holiday-jp/holiday_jp（バージョン固定）を使い、春分・秋分は自前計算で検算、翌年以降は「予定」表示。年単位で計算結果をキャッシュ。

## Scope
- **In**:
  - 旧暦（天保暦方式: 中気を含まない月を閏月）、旧暦2033年問題の扱い方針の明示
  - 六曜（旧暦月日から算出）
  - 月齢（正午月齢など定義を明示）
  - 二十四節気・七十二候（太陽黄経 15°/5° 刻み）
  - 雑節（節分・彼岸・社日・八十八夜・入梅・半夏生・土用・二百十日・二百二十日 等）
  - 日本の祝日（振替休日・国民の休日含む）
  - 月カレンダー・日詳細画面（天文現象表示枠と統合）、日英表記
  - 暦要項との回帰テスト
- **Out**: 天文現象そのものの計算（astronomy-events）、投稿の表示（posts-comments が日詳細に載せる）

## Boundary Candidates
- 暦注算出ライブラリ（純粋関数）
- 祝日データ連携
- カレンダー UI

## Out of Boundary
- 天文イベント探索アルゴリズム
- 投稿・コメント

## Upstream / Downstream
- **Upstream**: platform-foundation, astronomy-events（astro-core）
- **Downstream**: posts-comments（日付ページに投稿を表示）、トップページ

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: astronomy-events

## Constraints
- 暦の基準タイムゾーンは JST（日本の暦）。海外地点でも暦注は JST 基準と明記
- 境界（節入り・朔が JST 0 時近傍）のテストケースを重点的に用意

## ui-mockups で決めた暫定の値・前提（機能の仕様で確定する）
- 月のカレンダーは月曜始まり（土日・祝日の印は実際の曜日で付ける）で、「前の月」「今月」「次の月」で移動し、表示中の月を `?month=YYYY-MM` に残す。移動できる範囲と、週の始まりを設定で選べるようにするかは未定。参照：`mockups/README.md`「月のカレンダー」、`mockups/screens/calendar-month.html`
- 日の詳細：七十二候は毎日「名前（n日目）」（始まりの日が 1 日目）で出す。二十四節気は節気の日に名前だけ。値のない項目（二十四節気、雑節、祝日、その日の天文現象）は出さない。日月の出没の 4 行は「なし（この日は起こりません）」も含めていつも出す。参照：`mockups/README.md`「日詳細」、`mockups/screens/day-detail.html`
