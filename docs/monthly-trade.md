# 月次貿易観測

「定点観測」の既定ページ `/weekly-reports` は週次マクロ金融観測です。
上部のリンクボタンから `/weekly-reports/trade` の月次貿易観測に切り替えます。
既存の週次レポート、400字要約、AWS生成処理は継続して使用します。

## データと定義

- 出典：財務省・税関 [最新発表](https://www.customs.go.jp/toukei/latest/index.htm)／[報道発表資料](https://www.customs.go.jp/toukei/shinbun/happyou.htm) の月次XML・PDF。
- `lib/reports/data/trade.json` に2000年1月から最新月までの金額、月別の資料URL、公表区分、公表日、取得日時を保存。
- 国別は国・地域。地域合計を除外して最新月の上位8を選び、過去にも同じ8か国・地域を使用。
- XML掲載対象外の国が8位を超えないことを地域別の未掲載金額から検証。証明できない場合は取り込みを停止する。
- 品別は主要商品の大分類。公表分類「その他」を除いた8分類から上位5を選択し、残る分類と公表分類「その他」を一つの「その他」に集約。
- 内訳の小分類を混ぜず、金額の二重計上を防止。最新月以外の順位は選定に使わない。
- 金額は原資料の百万円を整数で保存、図表のみ兆円へ換算。残余＝総額－選定区分合計（国別8、品目別5）。
- 2000年1月からの連続性、金額、分類の数、合計、ランキングを検証してからファイルを置換する。2000～2008年はPDFを解析するため `pdfplumber` が必要。分類変更前で現在の上位5区分を取り出せない月は品目別の内訳を `null` とし、総額は保持する。旧表記の「アメリカ」「ヴィエトナム」は現在の国名へ統一する。
- 月次速報・確報・確定値を使用。年計、半期計、上旬・上中旬の値は対象外。

## 更新操作

このページは保存済みデータを表示します。月次のAWS自動実行は今回の変更には含めていません。
新しい月の追加や過去値の改訂を反映するには、ローカルPowerShellでプロジェクトのフォルダーから実行します。
AWS権限やAPIキーは不要です。Python 3.13以降とインターネット接続を使用します。

```powershell
python -m pip install pdfplumber
python scripts/import-trade-history.py
python scripts/test_trade_history.py
npm.cmd test -- lib/reports/trade.test.ts
```

取得に失敗した場合は、前回のJSONを保持します。成功後、JSONの差分を確認し、通常のサイト公開手順で反映します。
最新月に合わせて国別上位8・品目別上位5も自動的に再選定されます。

## 主なファイル

- ページ：`app/weekly-reports/trade/page.tsx`
- 図表：`app/weekly-reports/trade/trade-charts.tsx`
- 切り替え：`app/weekly-reports/observation-tabs.tsx`
- 取り込み：`scripts/import-trade-history.py`
- データ：`lib/reports/data/trade.json`

## 品目例とFIGURE05：対外直接投資残高

FIGURE03・04の凡例の下に、税関の主要商品別輸出入表に沿った商品例を各分類2～3個表示します。定義は `lib/reports/trade-examples.ts`。「その他」は選定外の大分類から商品例を選ぶため、輸出入で内容が異なります。

FIGURE05は[JETRO直接投資統計](https://www.jetro.go.jp/world/japan/stats/fdi.html)の「日本の直接投資（残高）」の対外Excelを使用。`python scripts/import-fdi-stock.py` で一覧から最新Excelのリンクを取得し、検証後に `lib/reports/data/fdi-stock.json` を置換します。初回収録は1996～2025年末の30年分。図表は `app/weekly-reports/trade/fdi-chart.tsx`。AWSの定期更新には追加していません。

地域集計とベルギー・ルクセンブルクの旧合算行を除き、JETRO掲載国・地域の最新年末上位8を選び、全期間で固定します。初回の順序は米国、オランダ、英国、シンガポール、中国、オーストラリア、タイ、スイス。「その他」＝世界合計−上位8の合計。年末残高（資産）であり、フローではありません。原資料の100万米ドルを小数6桁で保持し、図表のみ兆米ドルへ換算します。円換算は追加しません。2013年以前と2014年以降は国際収支統計の基準変更により非連続で、図中・本文に注記します。

検証：`npm.cmd test -- lib/reports/fdi-stock.test.ts`。連続年、最新順位、合計と残余、商品例を確認します。

## 貿易観測の400字要約

図表の上部にTRADE INSIGHTを表示します。2026年10月20日に掲載データからAIが作成した初回文（356字）を `lib/reports/data/trade-insight.json` に保存。Gemini APIの定期生成結果ではありません。月次輸出入は2026年8月、対外直接投資残高は2025年末で、観測期間・通貨・フローと残高を区別します。

`lib/reports/trade-insight.ts` がFIGURE01～05の数値・分類・期間のハッシュを検証します。図表が改訂された場合は古い本文を表示せず、再作成待ちを表示します。取得日時だけの変更では無効にしません。検証：`npm.cmd test -- lib/reports/observation-insights.test.ts`。
