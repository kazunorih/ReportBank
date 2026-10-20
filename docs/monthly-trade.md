# 月次貿易観測

「定点観測」の既定ページ `/weekly-reports` は週次マクロ金融観測です。
上部のリンクボタンから `/weekly-reports/trade` の月次貿易観測に切り替えます。
既存の週次レポート、400字要約、AWS生成処理は継続して使用します。

## データと定義

- 出典：財務省・税関 [最新発表](https://www.customs.go.jp/toukei/latest/index.htm)／[報道発表資料](https://www.customs.go.jp/toukei/shinbun/happyou.htm) の月次XML・PDF。
- `lib/reports/data/trade.json` に2000年1月から最新月までの金額、月別の資料URL、公表区分、公表日、取得日時を保存。
- 国別は国・地域。地域合計を除外して最新月の上位5を選び、過去にも同じ5区分を使用。
- XML掲載対象外の国が5位を超えないことを地域別の未掲載金額から検証。証明できない場合は取り込みを停止する。
- 品別は主要商品の大分類。公表分類「その他」を除いた8分類から上位5を選択し、残る分類と公表分類「その他」を一つの「その他」に集約。
- 内訳の小分類を混ぜず、金額の二重計上を防止。最新月以外の順位は選定に使わない。
- 金額は原資料の百万円を整数で保存、図表のみ兆円へ換算。残余＝総額－上位5合計。
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
最新月に合わせて上位5も自動的に再選定されます。

## 主なファイル

- ページ：`app/weekly-reports/trade/page.tsx`
- 図表：`app/weekly-reports/trade/trade-charts.tsx`
- 切り替え：`app/weekly-reports/observation-tabs.tsx`
- 取り込み：`scripts/import-trade-history.py`
- データ：`lib/reports/data/trade.json`
