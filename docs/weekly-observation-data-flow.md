# 週次定点観測のデータフロー

対象は `reportbank-weekly` の `ReportScope=markets`。リポジトリの実装を基に作成。AWS上の接続・初回生成・スケジュール有効化の完了を示す図ではありません。自動起動はScheduleStateをENABLEDにした後です。

```mermaid
flowchart TD
  Sources["公表資料<br/>財務省・日銀・JPX・住宅金融支援機構<br/>厚生労働省・e-Stat"]
  Seed["同梱の履歴データ<br/>貸出CSV・保存済み統計"]
  subgraph AWS["AWS：実行・保存・サイト配信"]
    Timer["EventBridge Scheduler<br/>毎週金曜23時・日本時間"]
    Flow["Step Functions<br/>実行管理・最大2回の再試行"]
    subgraph Worker["Lambda Worker：1つの関数内の処理"]
      Collect["資料取得・単位と期間の整合・検証<br/>FIGURE01～05のデータを作成"]
      Compare{"統計・期間・注記・出典<br/>プロンプト・モデルに変更？"}
      Request["5図の数値・出典・プロンプトを送信"]
      Check["返答を検証<br/>完了状態・400字以内・出典ID"]
      Reuse["API呼び出しを省略<br/>前回の本文・生成日時を維持"]
      Save["成功した図表・本文を保存"]
    end
    Secret["Secrets Manager<br/>Gemini APIキー"]
    S3["S3：非公開<br/>取得原本・正規化データ・実行記録"]
    DB["DynamoDB<br/>最新版 CHART / MARKETS"]
    Site["Amplify / Next.js<br/>サーバーで最新版を読み取る"]
    SNS["SNS<br/>購読確認済みメールへ失敗通知"]
    CW["CloudWatch<br/>ログ・失敗／タイムアウト監視"]
    DLQ["SQS<br/>スケジュール配信失敗を保管"]
    Timer --> Flow
    Timer -. "起動の配信失敗" .-> DLQ
    Flow --> Collect
    Collect --> Compare
    Compare -- "初回または変更あり" --> Request
    Compare -- "変更なし" --> Reuse
    Secret -- "APIキー：Lambdaだけが取得" --> Request
    Check --> Save
    Reuse --> Save
    Collect -- "取得原本" --> S3
    S3 -- "保存済み履歴" --> Collect
    DB -- "前回データ・本文・比較ハッシュ" --> Collect
    Save -- "図表・本文・監査記録" --> S3
    Save -- "最新版を更新" --> DB
    DB -- "図表・本文" --> Site
    Flow -. "再試行後も失敗" .-> SNS
    Flow -. "実行メトリクス" .-> CW
    Worker -. "処理ログ" .-> CW
    DLQ -. "滞留を監視" .-> CW
    CW -. "アラーム" .-> SNS
  end
  Gemini["Google Gemini API<br/>gemini-3.8-flash<br/>400字以内の考察を生成"]
  Reader["閲覧者<br/>週次定点観測ページ"]
  Sources --> Collect
  Seed --> Collect
  Request -- "HTTPS：数値・資料情報・指示" --> Gemini
  Gemini -- "本文・参照した出典ID" --> Check
  Site --> Reader
```

- 毎週確認するのは統計です。取得日時だけが変わっても本文は再生成しません。初回、モデルやプロンプトを変更した場合は再生成します。
- `markets` はStep FunctionsのCollect内で収集から生成・保存まで行い、`AlreadyPublished → Done` で終了します。図のLambda内の箱は別々の関数ではありません。
- 収集・生成・検証で失敗すると最新版を書き換えず、前回の掲載を維持します。失敗した回でも、途中まで取得した原本がS3に残る場合があります。
- Geminiキー未設定の場合は図表のみ更新します。図のAI生成を動かすには `GeminiSecretArn` の設定が必要です。
- FIGURE02の貸出は同梱データを使い、新しい貸出統計の自動取得は未実装です。他の系列も公表頻度・履歴取得の制約があり、週ごとに数値が変わるとは限りません。
- S3には実行ごとの記録を保存しますが、`markets` の本文をサイトの「過去の400字整理」一覧へ追加する処理は未実装です。
- Amplifyには対象テーブル名・リージョン・読み取り用Compute roleを設定します。未接続時にも同梱の図表が表示されるため、掲載本文とDynamoDBを照合して接続を確認します。Geminiキーはブラウザには渡しません。
- Googleの無料枠はGoogle側で確認します。AWS料金は別です。Bedrockは使用しません。

参照：[構築手順書](weekly-reports-aws-setup.md)、[AWSテンプレート](../infra/weekly-reports.yaml)、[Lambda処理](../workers/weekly-report/index.py)、[更新判定](../workers/weekly-report/insight_config.py)、[生成プロンプト](../workers/weekly-report/weekly-insight-prompt.txt)。
