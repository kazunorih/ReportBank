# 週次レポートの実装・運用

`/weekly-reports` に「日本のマクロ金融環境」を表示します。ホーム・週次レポート・サイト情報のナビゲーション、5図表、出典、AIの推論であることを明記した400字以内の本文、作成日時付きの過去本文を実装しています。

## AWS構成

既存の広告・決済スタックから独立した `infra/weekly-reports.yaml` を使用します。

```mermaid
flowchart LR
  E[EventBridge Scheduler\n金曜23時 Asia/Tokyo] --> S[Step Functions Standard]
  S --> C[Lambda: 公表資料収集]
  C --> B[S3: 原本・正規化データ]
  B --> G[Lambda: 検証・400字生成]
  K[Secrets Manager] --> G
  G --> O[OpenAI Responses API\ngpt-5.6-luna]
  G --> P[Lambda: 公開]
  P --> D[DynamoDB: 最新版・履歴]
  D --> A[Amplify / Next.js]
  S --> N[SNS / CloudWatch: 失敗通知]
```

AWS側はすべてフルマネージドです。モデルはOpenAI APIの `gpt-5.6-luna` を直接呼び出します。Amazon Bedrockのモデルとしては扱いません。別モデルへの自動切替はありません。金曜23時は**生成開始時刻**であり、収集・検証・生成が終わった時点で公開します。

## データ定義と取得状況

数値は決定的なパーサーで取得し、AIに数値の生成・欠測補完をさせません。対象期間は直近の終了済み60半期（6月末・12月末）。日次データは該当月の最終観測値、月次・四半期残高は半期末、建設受注は6か月の合計です。6か月が揃わなければ合計を掲載しません。年度末の値を暦年末として表示することもありません。

| 項目 | 使用する公表系列・取得方法 | 留意点 |
| --- | --- | --- |
| 国債3・10・30年 | 財務省 `data/jgbcm_all.csv` と当月 `jgbcm.csv` | 30年金利は1999年9月以降。負の金利を保持 |
| フラット35（中間値） | 住宅金融支援機構の金利推移PDFと当月金利表 | （最高金利＋最低金利）÷2。2003年12月～2026年6月の46半期。実際の借入金利の平均ではない。2007年10月以降は21～35年、2010年4月以降は融資率9割以下、2017年10月以降は新機構団信付き |
| TOPIX | JPX「指数値の推移」の年間四本値Excel | `topixyear_j.xls` の「年（月）末」列。年末終値、ポイント。6月・未収録年は補間しない |
| 時価総額 | JPXの長期Excelを毎回リンク探索 | 東証内国株式の全市場合計。全国取引所合計ではない。2022年市場再編以前のシートも取得 |
| 建設受注 | e-Statの受注高時系列Excelをリンク探索 | 全国・全業者、元請と下請を含む総受注高。大手50社や前年比表とは区別。古い月は初期CSVで補う |
| 企業向け貸出 | 日銀 FF `FOF_FFALA00A411` | 預金取扱機関 → 民間非金融法人 |
| 個人向け貸出 | 日銀 FF `FOF_FFALA00A430` | 預金取扱機関 → 家計（個人事業主を含む） |
| 公共団体向け貸出 | 日銀 FF `FOF_FFALA00A422` | 預金取扱機関 → 地方公共団体。中央政府や公的企業の合計ではない |
| 国債保有 | 日銀 FF `FOF_FFAS120A311` | 預金取扱機関の国債・財投債。ユーザー確認に基づき貸出とは区別 |
| 日銀総資産・国債 | 日銀 BS01 `MABJMTA`・`MABJMA5` | 現行系列は1998年4月以降。国債は総資産の内数・短期国債を含む |

日銀の金額は億円から兆円へ、JPX・建設受注は百万円から兆円へ変換します。資金循環の上記四半期系列は1997年末以降です。これらの公表系列だけで30年すべてが埋まるとは限りません。異なる制度・対象範囲の旧系列を自動で接続しません。

経産省、全銀協、日本証券業協会、日本プライベート・エクイティ協会、住宅金融支援機構、日本経済研究センターの公表ページと取得可能な関連資料を文章生成の補助資料として収集します。索引タイトルから資料本文を推測しないよう指示しています。対象機関・財団を追加する場合は `sources.py` の `CONTEXT_SOURCES` と `ALLOWED_HOSTS` に明示的に登録します。取得できなかった参考資料は警告に表示し、出典を創作しません。

## 初期データを準備する

先行図表のフラット35・TOPIXには確認済みの履歴を同梱しており、初回用CSVの追加は不要です。以下は他系列を含む履歴補充の仕様です。建設受注はe-Statから取得・検証した2005年4月～2026年7月の256か月分を `workers/weekly-report/data/construction.csv` に同梱しています。1996年～2005年前半は未収録です。ダミーの数値は同梱していません。

UTF-8 CSVの必須列は次のとおりです。

```csv
date,value,unit,source_name,source_url
```

- `date`: `YYYY-MM-DD`。株価は月末最終営業日、金利は観測日または適用日、建設受注は月末。未公表・将来の日付は使用しない。
- `value`: 実測数値。欠測をゼロにしない。
- `unit`: フラット35は `%`、TOPIXは `ポイント`、建設受注は `兆円`。
- `source_name`, `source_url`: 各行の資料名と公式HTTPS URL。出典はホスト許可リストで検証する。
- フラット35の開始前の値や異なる返済期間・融資率の金利を混ぜない。CSVの数値・定義・利用条件は投入前に確認する。
- 認可済みの別のデータ提供会社を使用する場合は、そのURL・形式・認証方法に合わせたアダプターを追加する。任意URLの無制限取得はしない。

建設受注の公表ファイルを遡って出典付きCSVを作成するコマンドも用意しています。

```sh
python -m pip install -r workers/weekly-report/requirements.txt
python scripts/backfill-construction.py --as-of 2026-10-11 --output construction.csv
```

その時点のe-Stat分類に存在する公表値のみを収録し、取得できない年・半期をログに表示します。出力と欠測一覧を確認してから、必要に応じて `imports/construction.csv` に置いて同梱履歴を更新できます。初期の統計は分類・対象範囲が変わっているため、このコマンドだけで1996年までの同一定義の系列が得られる保証はありません。

S3配置先は `imports/<seriesId>.csv` です。既存の全13系列に対応しているので、確認済みの旧公表値も同じ方式で追加できます。毎週、前回までの観測履歴→CSV→最新公表値の順で統合します。最新公表値が重なる月は最新公表値を優先します。原本と実行時の入力CSVもS3に保存します。

現在の先行図表ではTOPIXはJPXの年間四本値Excel、フラット35は住宅金融支援機構の最高・最低金利の中間値を使用します。フラット35の履歴は公式PDFに印字された数値を確認して `data/flat35-range.csv` に収録（最低・最高・出典URL・確認日時を保存）。当月の公式HTMLを毎週読み取り、同じ式で計算します。以前の銀行別・最低金利の履歴は統合しません。

### アップロード前のCSV検証

次のコマンドで、ネットワーク接続やAWSへの書き込みを行わずに、列・単位・出典URL・重複日・未来日・鮮度を検証できます。半期データが一つもない場合もエラーになります。

```sh
python scripts/check-report-import.py topix topix.csv
python scripts/check-report-import.py flat35 flat35.csv
```

成功時には観測数・最新日・利用可能な半期数・欠測半期を表示します。欠測は補完しません。終了コード0は入力形式と基本条件の合格を意味し、30年分の完全性や資料の利用許諾を保証するものではありません。

## 最初の図表の先行実装

表示対象は国債10年・30年・フラット35（中間値）の折れ線と、TOPIXの棒グラフです。国債3年は表示・この図表の要約入力から除外しています。この4系列のみを使った400字以内のまとめを同梱し、「初回掲載文（AI作成）」と明示しています。これはこの実装作業で図表の数値から作成した文章で、GPT-5.6-luna APIの実行結果ではありません。観測値は半年ごと、横軸ラベルは各年12月のみ。単位はグラフ上部に独立して表示し、狭い画面では横スクロールできます。

`markets` モードでも `OpenAISecretArn` を設定すると、表示対象の4系列・半期・出典・欠測情報だけをGPT-5.6-lunaに渡して400字以内のまとめを生成し、図表と一緒に保存します。他の図表・参考記事・国債3年・図表にない直近値は渡しません。生成に失敗した場合は公開せず、前回の図表と本文を保持します。キー未設定の場合は図表のみ更新し、古い本文を新しい図表に流用しません。ローカル更新コマンドも本文を生成しないため、再取得後は本文の再作成が必要です。

現在は「金利とTOPIX」を先行表示します。TOPIXはユーザー提供の `topixyear_j.xls`（1949～2025年、77年分）を読み取り、1996～2025年の30年末を表示します。参照情報は[JPX「TOPIX」ページの「指数値の推移」](https://www.jpx.co.jp/markets/indices/topix/)と、その年間四本値Excelです。「年（月）末」列だけを使い、年初・高値・安値を混同しません。6月や2026年の値はこの資料にないため欠測です。元ファイルは `workers/weekly-report/data/topixyear_j.xls`、抽出結果・SHA-256は `data/topix.json` に保存しています。再取り込みは `python scripts/import-topix-annual.py <Excelのパス>`。値を変更すると旧まとめは削除されるため、図表に合わせて再作成します。

フラット35は機構公表の2003年12月～2026年6月の46半期を収録し、最新の観測月は2026年10月です。PDFの数値は文字抽出では拾えないアウトライン文字だったため、画像として確認して転記しました。線の座標からの推計はしていません。中間値はDecimalで計算し、小数第4位まで保持します。制度変更による条件の違いを注記し、公表開始前は補間しません。銀行別金利の保存済み図表は定義識別子 `range-midpoint-v1` がないため表示せず、新定義の同梱図表を表示します。

```sh
python scripts/refresh-market-chart.py
```

このコマンドはJPXの年間四本値Excelを読み、財務省の国債金利、機構のフラット35履歴CSVと当月金利を合わせて図表JSONを更新します。Python依存ライブラリのインストールが必要です。AWSや生成AIは呼び出しません。

SAMの `ReportScope` は既定で `markets` です。このモードでは毎週の収集後に `CHART / MARKETS` をDynamoDBへ保存して処理を終了し、他の統計・400字本文・OpenAIキーを必要としません。公開済みの全体レポートがない場合、Web側はこの図表を表示します。テーブル未設定または図表未登録の場合は同梱の実測値を、収集基準日付きで表示します。AWS通信障害時は静的データへ黙って切り替えません。

TOPIXは毎週、同じ公式Excelを取得し、年末終値を置き換えます。以前の月報・CSVの値とは統合しません。年次資料なので鮮度判定は400日（年次更新と公表猶予）です。保存済み図表も `annual-close-v1` の定義識別子を確認し、旧月次データは表示しません。取得・検証に失敗した場合は直前の図表を保持します。フラット35は当月金利を毎週取得し、同じ定義の保存済み観測値を引き継ぎます。履歴PDFの改定はCSVの再確認が必要です。

最初の図表だけを導入する際は、下記のOpenAIキー準備と必須CSV配置を省略できます。全体レポートを有効にする場合のみ `ReportScope=full` とし、残りのデータ・キーを準備してください。AWSへのデプロイと定期実行の有効化は未実施です。

## AWSへの導入

1. 東京リージョンのSecrets Managerで、JSON `{"apiKey":"実際のAPIキー"}` を格納したシークレットを準備します。キーをNext.jsやクライアント環境変数に設定しないでください。独自KMSキーで暗号化する場合はWorkerロールに該当キーの `kms:Decrypt` 権限も必要です。
2. Python 3.13、AWS SAM CLI、AWS認証情報を用意し、独立スタックとしてビルド・デプロイします。

```sh
sam build --template-file infra/weekly-reports.yaml --build-dir .aws-sam/weekly-build
sam deploy --guided --template-file .aws-sam/weekly-build/template.yaml
```

`OpenAISecretArn` を指定します。`ScheduleState` の初期値は `DISABLED`。`AlertEmail` を指定した場合はSNS購読確認メールで購読を有効にします。

3. 出力された `DataBucket` にCSVを配置します。

```sh
aws s3 cp flat35.csv s3://BUCKET/imports/flat35.csv
aws s3 cp topix.csv s3://BUCKET/imports/topix.csv
```

同梱分より長い・新しい建設受注履歴を用意した場合は、同様に `imports/construction.csv` へ配置してください。

4. Amplifyの環境変数 `WEEKLY_REPORTS_TABLE_NAME` に `ReportsTableName`、`APP_AWS_REGION` に `ap-northeast-1` を設定します。既存のビルド手順で `npm run build` の前に `npm run configure:reports` を実行してください。このコマンドはSSR用 `.env.production` にこの2変数のみを追記し、既存の他変数は保持します。ローカル開発では `.env.local` に設定します。
5. Amplify **SSR Compute Role** に以下を追加します。ビルド用ロールとは別です。秘密鍵、S3、生成処理の書き込み権限をWeb側に与える必要はありません。

```json
{
  "Effect": "Allow",
  "Action": ["dynamodb:GetItem", "dynamodb:Query"],
  "Resource": "ReportsTableArnの出力値"
}
```

6. Step Functionsを手動実行します。Input例の時刻は**実際の開始時刻**に置き換えます。過去の日付を指定して現在の資料から過去レポートを装う運用はしないでください。

```json
{"scheduledTime":"2026-10-16T14:00:00Z"}
```

7. 収集・生成・公開が成功し、`/weekly-reports` の図表・本文・出典を確認したら、同じスタックを `ScheduleState=ENABLED` で更新します。設定は `cron(0 23 ? * FRI *)`、`Asia/Tokyo`、柔軟な実行時間枠OFFです。初回デプロイ・Secrets Managerへのキー設定・スケジュール有効化はこの実装作業では行っていません。

## 公開時の検証・障害対応

- 必須13系列の欠落、全半期が欠測、異常単位、未来日付、古すぎる最新観測、本文401文字以上、不明な出典ID、APIエラーは公開を停止する。
- 鮮度上限は四半期資金循環220日、それ以外120日。必ず最新観測日も画面に表示する。原資料の公表ラグと観測日を区別する。
- 一部参考文章の取得失敗は警告として残す。公開統計の欠落をAIの推測で埋めない。
- DynamoDBトランザクションで最新本文と履歴を同時に確定。日付キーで重複公開を防ぎ、遅れて終了した古い実行は最新を上書きしない。
- S3は公開禁止・暗号化・バージョニング。DynamoDBはオンデマンド・PITR。両方ともスタック削除時に保持する。
- Step Functions再試行、SNS失敗通知、CloudWatch失敗・タイムアウト通知、Scheduler配信失敗のSQS DLQを用意。前回公開分は失敗時にも残り、8日以上更新されなければ画面に遅延表示。
- `runs/<予定日>/<実行ID>/` の `collected.json`、原本、`generation-audit.json`、`report.json` で追跡可能。ログにAPIキーやAPI応答全文を出さない。
- 400字と出典IDの機械検証は、文章の経済解釈の正しさを保証するものではない。初回は出典・統計の定義・推論を確認する。

## 検証コマンド

```sh
npm test
npx tsc --noEmit
npm run build
python -m unittest discover -s workers/weekly-report -p "test_*.py"
sam validate --lint --template-file infra/weekly-reports.yaml
python scripts/check-report-sources.py
```

PythonのローカルテストではAWS SDK `boto3` も必要です（Lambdaランタイムには同梱）。ライブ統計検証はAWSへの書き込み・OpenAI呼び出しを行いません。モデルAPIとAWS上の実行の疎通確認は、秘密情報とデプロイ先が設定されてから行います。

## 公式仕様

- [OpenAI GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [EventBridge Schedulerのスケジュールとタイムゾーン](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html)
- [日銀・統計APIマニュアル](https://www.stat-search.boj.or.jp/info/api_manual.pdf)
- [財務省・国債金利](https://www.mof.go.jp/jgbs/reference/interest_rate/index.htm)
- [JPX・市場別時価総額](https://www.jpx.co.jp/markets/statistics-equities/misc/02.html)
- [住宅金融支援機構・フラット35の金利推移](https://www.flat35.com/kinri/kinri_suii.html)
