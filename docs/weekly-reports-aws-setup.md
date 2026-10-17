# ReportBank 週次定点観測：AWS構築手順書

対象：WindowsのPCから、現在のFIGURE01～04とWeekly Insightを毎週更新する方。確認日：2026年10月17日。

**この手順書は構築の説明書です。AWSへの作成・公開・課金を伴う操作は、まだ実行していません。**

## 最初に：何をすれば完成するか

AWSの各サービスを一つずつ手作業で作る必要はありません。リポジトリにある `infra/weekly-reports.yaml` が設計図です。PCでAWS SAMというツールを実行すると、CloudFormationが必要なサービスと接続権限をまとめて作ります。コンソールではAPIキーの保存、Webサイトとの接続、動作確認を行います。

既にReportBankがAmplifyで公開されている前提です。新しいAmplifyアプリ、ドメイン、広告・決済用スタックを作り直す手順ではありません。

| 順番 | 作業 | 操作する場所 | 完了の目印 |
| --- | --- | --- | --- |
| 1 | 使用アカウントとPCの準備 | AWSコンソール・PowerShell | AWSアカウント番号を確認できる |
| 2 | OpenAI APIキーを保存 | OpenAI・Secrets Manager | シークレットARNを控えた |
| 3 | AWS一式を作成 | PowerShell・CloudFormation | スタックがCREATE_COMPLETE |
| 4 | 通知を有効化 | メール・SNS | 購読が確認済み |
| 5 | 初回レポートを生成 | Step Functions | markets-publishedと本文を確認 |
| 6 | サイトから読めるよう設定 | IAM・Amplify | 本文作成日時が初回実行の日時になる |
| 7 | 毎週の実行を有効化 | PowerShell・Scheduler | 東京時間の金曜23時、ENABLED |

### 今回の設定は `markets`

`ReportScope=markets` を選びます。名前は古いですが、**現在はFIGURE01～04の4図表に対応**しています。テンプレートの説明にある「First chart only」は以前の説明であり、現在の処理内容とは異なります。`full` は別の13系列を扱うモードなので選びません。

現行コードで動く流れは次のとおりです。

```mermaid
flowchart TD
  E[Scheduler：金曜23時・日本時間] --> S[Step Functions：実行管理]
  S --> L[Lambda Worker：収集・検証・AI生成・保存]
  K[Secrets Manager：APIキー] --> L
  L --> O[OpenAI Responses API：gpt-5.6-luna]
  L --> B[S3：原本と実行記録]
  L --> D[DynamoDB：CHART / MARKETS]
  D --> A[既存Amplify：週次定点観測ページ]
  S --> N[SNS・CloudWatch：失敗通知]
```

Lambdaは1つです。`markets` ではStep Functionsの **Collect内で生成・保存まで完了**します。画面上のGenerate・Publishを通過しなくても正常です。

### 構築しても変わらない、現在の制約

| 項目 | 週次実行の動作 |
| --- | --- |
| 国債金利・フラット35 | 公表資料を再取得。半期末グラフなので毎週棒・線が増えるわけではない |
| TOPIX | JPXの年間四本値Excelを再取得。年末値の資料なので、毎週の株価を表示するものではない |
| FIGURE02の貸出 | 同梱CSV・法人向けAPI応答の保存データを使用。新しい貸出データへの自動更新は未実装 |
| 日銀資産 | 指定の財務諸表を再取得。古い期間を他統計で埋めない |
| 政府債務・利払費 | 最新残高・予算総額を再取得。新年度の利払費を追加。保存済み年度の利払費は維持 |
| Weekly Insight | キー設定時に4図のデータから400字以内で生成。モデルの自動切替なし |
| 「過去の400字整理」欄 | `markets` の本文をこの一覧へ追加する処理は未実装。実行ごとの本文はS3に保存される |

**AWSを構築するだけで、貸出の自動取得や過去本文の一覧保存が追加されるわけではありません。** この手順の完成条件は「4図と最新本文の週次更新」です。

## 1. アカウント・PCを準備する

### 1-1. 作業メモを用意する

次の表を自分用メモにコピーしてください。APIキーそのものはこのメモに書きません。

| 項目 | 記入する値 |
| --- | --- |
| AWSアカウントID | 12桁の番号 |
| AWSリージョン | `ap-northeast-1`（東京） |
| AWS CLIプロファイル | この手順では `reportbank` |
| スタック名 | この手順では `reportbank-weekly` |
| 通知メールアドレス | 自分が受信・確認できるアドレス |
| OpenAISecretArn | 手順2で記入 |
| ReportsTableName / ReportsTableArn | 手順3で記入 |
| DataBucket / WorkflowArn / ScheduleName | 手順3で記入 |
| Amplifyアプリ名・本番ブランチ名 | 現在公開中のもの |

ARNはAWSリソースの住所のような識別子です。APIキーとは別の値です。

### 1-2. AWSにログインする

1. AWSコンソールへ、普段ReportBankを管理しているアカウントでログインします。
2. 右上のアカウント情報で12桁のアカウントIDを控えます。
3. リージョンを「アジアパシフィック（東京）」にします。IAMはリージョン選択がない画面です。
4. 構築を担当するユーザー／ロールに、CloudFormationと本書のサービスを作成できる権限があることを確認します。IAMロールの作成と `iam:PassRole` も必要です。組織のアカウントでは、このテンプレートを管理者に渡して権限を用意してもらいます。

閲覧だけの権限では構築できません。ルートユーザーのアクセスキーを作る必要はありません。

### 1-3. PCにツールを用意する

Windowsのスタートメニューから「PowerShell」を開きます。以下のリンクから未導入のツールをインストールしてください。

| ツール | 用途・導入先 |
| --- | --- |
| AWS CLI v2 | AWSへのログイン・接続確認。[公式インストール手順](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)のWindows版 |
| AWS SAM CLI | 設計図からAWSを構築。[公式インストール手順](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)のWindows MSI |
| Python 3.13（64bit） | Lambdaコードのビルド。[Python公式配布](https://www.python.org/downloads/windows/)から3.13系を選ぶ。PATH追加を有効にする |

インストール後はPowerShellを一度閉じ、開き直します。

```powershell
aws --version
sam --version
py -3.13 --version
python --version
```

**確認：** AWS CLIは2系、SAMのバージョン、Python 3.13が表示されること。`python` が別バージョンの場合は、3.13のインストール先をPATHに追加してから開き直します。SAMが同梱する内部Pythonだけではビルド用Pythonが見つからない場合があります。

この手順はローカルPythonでビルドするためDockerは使いません。会社のPCなどでPythonを導入できない場合は、ここで管理者に導入を依頼してください。

### 1-4. PowerShellからAWSへログインする

既に動作するCLIプロファイルがある場合は、それを使えます。その場合は以後の `--profile reportbank` を自分のプロファイル名に読み替えてください。

未設定の場合はIAM Identity Centerのログインを使います。管理者から「AWSアクセスポータルURL」「SSOリージョン」「利用アカウント」「許可セット（ロール）」を受け取ってください。**SSOリージョンは東京とは限りません。** 個人アカウントで未設定なら、先に[Identity Centerの開始手順](https://docs.aws.amazon.com/singlesignon/latest/userguide/getting-started.html)でAWSアカウントにアクセスできるユーザーと許可セットを準備します。

```powershell
aws configure sso --profile reportbank
```

| 質問 | 入力 |
| --- | --- |
| SSO session name | `reportbank-session` |
| SSO start URL | 受け取ったアクセスポータルURL |
| SSO region | Identity Centerを設定したリージョン |
| SSO registration scopes | 通常は表示された既定値をEnter |
| ブラウザでの確認 | 自分のAWSアカウントでログインして許可 |
| Account / Role | ReportBankのアカウントと構築用ロール |
| Default client Region | `ap-northeast-1` |
| Default output format | `json` |

続けて実行します。

```powershell
aws sso login --profile reportbank
aws sts get-caller-identity --profile reportbank
```

**確認：** `Account` が手順1-2の12桁の番号と同じであること。違う場合はデプロイしません。SSOログインは期限が切れるので、その場合は `aws sso login` を再実行します。[公式CLIのSSO手順](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)

### 1-5. プロジェクトを開く

```powershell
Set-Location -LiteralPath 'C:\Users\kazut\Documents\my-first-site'
Test-Path -LiteralPath '.\infra\weekly-reports.yaml'
Test-Path -LiteralPath '.\workers\weekly-report\data\corporate-la01.json'
$weeklyConfig = Join-Path (Get-Location) 'weekly-samconfig.toml'
```

**確認：** 2つとも `True`。最新の作業内容と `workers/weekly-report/data/` の同梱資料が必要です。コマンドは以後、このフォルダーで実行します。PowerShellを開き直した場合はこの手順を再実行してください。

## 2. OpenAI APIキーをSecrets Managerへ保存する

### 2-1. OpenAI側の用意

OpenAIのAPIプロジェクトでAPIキーを作成し、APIの課金設定・利用上限・モデル利用権限を確認します。指定モデルは **`gpt-5.6-luna`** です。[公式モデル仕様](https://developers.openai.com/api/docs/models/gpt-5.6-luna)を確認し、このプロジェクトでの実際の呼び出し可否は手順5で確認します。別モデルには自動切替しません。

APIキーを使うのはLambdaだけです。ブラウザ向けの `NEXT_PUBLIC_...`、Amplifyの環境変数、Gitのファイルには保存しません。

### 2-2. AWSコンソールで保存する

1. 東京リージョンの「Secrets Manager」を検索して開きます。
2. 「新しいシークレットを保存する」を選びます。
3. 種類は「その他のシークレットのタイプ」。
4. キー／値の欄で、キーを **`apiKey`**、値をOpenAIの実際のAPIキーにします。大文字小文字をそのまま合わせます。
5. 暗号化キーはこの手順では既定の **`aws/secretsmanager`** を使います。
6. 名前を `reportbank/weekly/openai` にします。
7. 自動ローテーションは今回は設定せず、内容を確認して保存します。
8. 作成したシークレットを開き、「シークレットARN」を作業メモへコピーします。

保存される内容の形は次のJSONです。例の文字列をそのままAPIキーとして登録しないでください。

```json
{"apiKey":"ここに実際のOpenAI APIキー"}
```

**確認：** ARNは `arn:aws:secretsmanager:ap-northeast-1:...:secret:...` で始まります。後ろのランダム文字まで全部コピーします。独自KMSキーを使う場合は追加の復号権限が必要になるため、この標準手順の範囲外です。[Secrets Managerの公式手順](https://docs.aws.amazon.com/secretsmanager/latest/userguide/create_secret.html)

## 3. 設計図を使ってAWS一式を作成する

### 3-1. ビルドする【PC】

```powershell
sam validate --template-file infra/weekly-reports.yaml --region ap-northeast-1 --profile reportbank
sam build --template-file infra/weekly-reports.yaml --build-dir .aws-sam/weekly-build
```

**確認：** エラーがなく `Build Succeeded` と表示され、`.aws-sam/weekly-build/template.yaml` が生成されること。ここまでは週次レポートのAWSリソースを作成しません。

### 3-2. デプロイする【PC】

ここからAWSリソースが作られ、利用料が発生します。SAMはLambdaのコードと依存ライブラリも梱包してアップロードします。元のYAMLだけをCloudFormation画面へ直接アップロードする方法は、このコードの配置には使いません。

```powershell
sam deploy --guided --template-file .aws-sam/weekly-build/template.yaml --config-file "$weeklyConfig" --config-env weekly --region ap-northeast-1 --profile reportbank
```

質問の順番はSAMのバージョンで変わることがあります。表示された項目に次の値を入力します。

| 質問・パラメータ | 入力値 |
| --- | --- |
| Stack Name | `reportbank-weekly` |
| AWS Region | `ap-northeast-1` |
| Parameter AppName | `reportbank` |
| Parameter OpenAISecretArn | 手順2で控えたARN。APIキー本体ではない |
| Parameter ReportScope | **`markets`** |
| Parameter AlertEmail | 自分の通知用メールアドレス |
| Parameter ScheduleState | **`DISABLED`** |
| Confirm changes before deploy | `Y` |
| Allow SAM CLI IAM role creation | `Y`（実行に必要なロールを作る） |
| Disable rollback | `N`（失敗時の自動ロールバックを有効にする） |
| Save arguments to configuration file | `Y` |
| SAM configuration file | 指定した `weekly-samconfig.toml` のパスを維持 |
| SAM configuration environment | `weekly` |

最後に変更一覧が出ます。初回は新規追加が中心です。アカウント・リージョン・スタック名を再確認して、`Deploy this changeset?` に `Y` と答えます。以前作った同名スタックがある場合は新規作成ではなく更新になります。削除や置換が表示された場合は内容を確認してから進めてください。

**確認：** 東京のCloudFormation →「スタック」→ `reportbank-weekly` が `CREATE_COMPLETE`（更新なら `UPDATE_COMPLETE`）になること。[SAM deployの公式仕様](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-deploy.html)

### 3-3. 出力値を控える【コンソール】

CloudFormationの対象スタック →「出力」を開きます。

| 出力名 | 後で使う場所 |
| --- | --- |
| `ReportsTableName` | Amplify環境変数・DynamoDBの確認 |
| `ReportsTableArn` | Amplifyに付ける読み取り権限 |
| `DataBucket` | S3の実行記録確認 |
| `WorkflowArn` | Step Functionsで初回実行 |
| `ScheduleName` | Schedulerの設定確認・停止 |
| `AlertsTopicArn` | SNS通知の確認 |

名前の末尾はAWSが自動で付けます。推測して入力せず「出力」の実際の値を使用します。

「リソース」タブにはLambdaの `Worker`、S3の `ReportBucket`、DynamoDBの `ReportsTable` などが表示されます。物理IDのリンクから各サービスへ移動できます。IAMロール、ログ、通知、スケジュールはテンプレートが作るため、別途重複作成しません。

## 4. 失敗通知のメールを確認する

1. 手順3で入力したメールの受信箱を開きます。
2. AWS Notificationsから届いた購読確認メールを開きます。
3. 内容が今回のSNSトピックであることを確認し、`Confirm subscription` を押します。
4. SNSコンソール →「サブスクリプション」で、該当メールが確認待ちではなくなっていることを確認します。

メールが来ない場合は迷惑メールと `AlertEmail` の綴りを確認します。SNSの対象トピックから「メッセージの発行」で自分宛てにテスト通知を送り、受信できるか確認できます。未確認のままだと実行失敗に気づけません。

## 5. 自動実行の前に、1回だけ手動実行する

### 5-1. 入力を用意する【PC】

PowerShellで次を実行します。これは現在のUTC時刻入りJSONを表示するだけで、AWSを実行しません。

```powershell
@{ scheduledTime = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ') } | ConvertTo-Json -Compress
```

表示された `{...}` をコピーします。例の古い日時を使い回さず、実行直前に作成してください。

### 5-2. 開始する【コンソール】

1. CloudFormationの「リソース」→ `Workflow` のリンクからStep Functionsを開きます。
2. 「実行を開始」を押します。
3. 名前は自動生成のまま、または `first-check-日時` のような重複しない名前にします。
4. 入力欄を手順5-1のJSONに置き換えます。`action` や `run` は入力不要です。
5. 「実行を開始」を押し、完了まで待ちます。公表資料の取得・AI呼び出し・再試行で数分以上かかる場合があります。

この操作は実際にデータを収集し、OpenAI APIを呼び出し、DynamoDBの最新版を保存します。何度も連打すると再度API料金がかかり得ます。

### 5-3. 成功を確認する

**Step Functions：** 全体が `Succeeded`。通常は `Collect → AlreadyPublished → Done` の経路です。`Collect` の出力、または最終出力の `run` を開き、次を確認します。

```json
{
  "skipped": true,
  "asOf": "実行日の日本時間の日付",
  "prefix": "runs/日付/実行ごとのID",
  "status": "markets-published"
}
```

`skipped: true` は、このモードでは後続Generate・Publishを省略したという意味です。生成が失敗したという意味ではありません。

**DynamoDB：** `ReportsTableName` のテーブル →「テーブル項目の探索」で、`pk = CHART`、`sk = MARKETS` の項目を開きます。

| 確認箇所 | 正常な状態 |
| --- | --- |
| `chart.summaryScope` | 現時点のコードでは `four-figures-v5` |
| `chart.insight.summary` | 400字以内の日本語。50年の観測窓を踏まえた3点の考察 |
| `chart.insight.model` | `gpt-5.6-luna` |
| `chart.insight.generatedAt` | 今回の実行時刻に近い日時 |
| `chart.fiscal` / `chart.lending` / `chart.bojFinancials` | 各図のデータが入っている |

`insight` がなければ、キー未設定の図表のみ更新で成功している可能性があります。これでは今回のAI週次生成の完成条件を満たしません。`OpenAISecretArn` を確認します。

**S3：** `DataBucket` → `runs/` →今回の日付→実行IDを開きます。`markets.json`、`markets-collected.json`、キー設定時の `generation-audit.json`、`raw/` を確認します。`markets.json` が今回保存された図表・本文です。バケットを公開する必要はありません。

**確認：** 上記3か所を確認できたら次へ。失敗時は手順9の対処表を使い、スケジュールは無効のままにします。

## 6. 既存のAmplifyサイトと接続する

### 6-1. DynamoDBを読むIAMポリシーを作る

1. IAM →「ポリシー」→「ポリシーの作成」→ JSON編集を選びます。
2. 次のJSONを貼り付け、`ここをReportsTableArnに置換` を手順3の実際のARNに置き換えます。
3. 名前を `ReportBankWeeklyRead` として保存します。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:Query"],
      "Resource": "ここをReportsTableArnに置換"
    }
  ]
}
```

### 6-2. SSR Compute Roleへ追加する

Amplifyの対象アプリ →「アプリの設定」→「IAMロール」で **Compute role** を確認します。ビルド用のService roleとは別です。

既にCompute roleが設定されていれば、IAMでそのロールを開き、手順6-1のポリシーを追加します。広告・決済などで使っている既存権限は削除しません。

Compute roleが未設定なら、IAM →「ロール」→「ロールを作成」→「カスタム信頼ポリシー」で以下を指定します。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "amplify.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}
```

次へ進み `ReportBankWeeklyRead` を選択、ロール名を `ReportBankWeeklySsrRole` として作成します。AmplifyのCompute role編集で作成したロールを選んで保存します。本番ブランチに別のロールが指定されている場合は、そのブランチに実際に適用されるロールへ権限を追加してください。

**確認：** Amplifyの実行ロールが対象テーブルの `GetItem` と `Query` を許可していること。WebサイトにOpenAIキーやAWSアクセスキーを渡す必要はありません。[Amplifyの公式SSRロール手順](https://docs.aws.amazon.com/amplify/latest/userguide/amplify-SSR-compute-role.html)

### 6-3. 環境変数を設定する

Amplifyの対象アプリ →「ホスティング」→「環境変数」（画面構成によっては「環境変数」を直接選択）→編集で追加します。

| 名前 | 値 |
| --- | --- |
| `WEEKLY_REPORTS_TABLE_NAME` | 手順3の **ReportsTableName**。ARNではない |
| `APP_AWS_REGION` | `ap-northeast-1` |

本番ブランチの上書き設定がある場合は、そちらにも正しい値が設定されていることを確認します。既存の他の環境変数は維持します。

### 6-4. ビルド設定に1行追加して再デプロイする

Amplifyの「ビルドの設定」を開き、既存の `npm run build` の直前に **`npm run configure:reports`** を追加します。リポジトリの `amplify.yml` を使っている場合は、そちらの設定を変更して反映します。

これは挿入位置の例です。既存のYAML全体をこの断片で置き換えないでください。

```yaml
frontend:
  phases:
    build:
      commands:
        # 既存の必要なコマンドを維持する
        - npm run configure:reports
        - npm run build
```

このコマンドは2つの設定値を `.env.production` に書き、Next.jsのサーバー処理から参照できるようにします。Amplifyの変数設定だけでは足りません。[SSR環境変数の公式説明](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html)

最新のアプリコードを本番ブランチへ反映し、Amplifyで再デプロイします。既に最新コードが反映済みなら、そのコミットを再デプロイします。

### 6-5. サイトを確認する

`https://reportbankwebsite.com/weekly-reports` を開きます。

- FIGURE01～04が表示される。
- Weekly Insightの「本文作成」が手順5の実行時刻に対応する。
- 表示本文がDynamoDBの `chart.insight.summary` と一致する。
- データ取得エラーが表示されていない。

**グラフが表示されるだけでは接続成功とは判定しません。** 未設定時も同梱データが表示されるため、日時と本文を照合します。`markets` では「過去の400字整理」が空でも、最新本文の接続失敗とは限りません。

## 7. 毎週金曜23時の自動実行を有効にする

手順5と6が成功してから実施します。

1. PowerShellで手順1-5のフォルダー・`$weeklyConfig` を準備します。
2. 手順3-2と同じ `sam deploy --guided ...` を再実行します。
3. スタック名は **同じ `reportbank-weekly`**、`ReportScope=markets` を維持します。
4. ARN・メールなど保存済みの値を確認し、**`ScheduleState` だけを `ENABLED`** にします。
5. 設定保存と変更適用を行い、CloudFormationが `UPDATE_COMPLETE` になるまで待ちます。

続いてEventBridge Scheduler →「スケジュール」で、出力の `ScheduleName` を開いて確認します。

| 項目 | 正しい設定 |
| --- | --- |
| 状態 | Enabled／有効 |
| スケジュール式 | `cron(0 23 ? * FRI *)` |
| タイムゾーン | `Asia/Tokyo` |
| Flexible time window | OFF／無効 |
| ターゲット | 手順3のWorkflowArn |
| 入力 | `{"scheduledTime":"<aws.scheduler.scheduled-time>"}` |

23時は生成を開始する時刻です。収集・検証・AI生成の終了後に公開されます。PCを閉じてもAWSで動きます。金曜23時を過ぎてから有効にした場合、その回を遡って自動実行するものではありません。手順5で手動実行し、次の金曜から自動更新を確認します。

## 8. 運用・更新・停止

### 毎週の確認

金曜の実行後、Step Functionsが成功し、DynamoDBとページの本文作成日時が更新されたか確認します。株価や残高の公表頻度が低い場合、グラフの数値が前週と同じでも正常です。

AWSとOpenAIの利用料は別々です。正確な金額は実行後にAWSの請求画面とOpenAIプロジェクトの利用状況で確認します。S3、DynamoDB、Secrets Managerなどはスケジュール停止中にも保管料金が発生し得ます。

### コード・同梱データを変更したとき

Lambda側の変更はPCで `sam build` →同じ設定ファイル・スタックへ `sam deploy --guided`。画面側の変更は既存Amplifyの本番ブランチを再デプロイします。両方を変更した場合は両方に反映します。設定変更時は `ScheduleState` が意図せず戻っていないか確認してください。

貸出CSVを差し替えるだけでなく、法人向け原本も対象期間がそろっているか確認します。現在の貸出取得は保存データ方式なので、AWSの再デプロイだけで新しい日銀統計を自動取得することはありません。

### 一時停止

通常は同じスタックを `ScheduleState=DISABLED` で更新します。急いで止める場合はSchedulerコンソールで対象スケジュールを無効化し、その後SAMの保存設定・スタック側もDISABLEDへそろえます。コンソールだけで変更すると、次回デプロイで元に戻ることがあります。[Schedulerの状態変更](https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-schedule-state.html)

スケジュール停止は、既に開始したStep Functions実行を止めません。進行中の実行を止めたい場合はStep Functionsでその実行を停止します。既に起動したLambda処理は続く場合があるため、保存結果も確認してください。

### 廃止するとき

まずスケジュールを停止します。テンプレートではS3・DynamoDBを保持する設定なので、スタックを削除してもこの2つは残ります。Secrets Managerのキー、Amplifyの環境変数・権限、残したデータも別管理です。保管データを削除する前に必要な記録を保存してください。

## 9. 困ったときの確認表

| 症状 | 最初に確認する場所・対処 |
| --- | --- |
| `aws` / `sam` が見つからない | インストール完了後にPowerShellを開き直す。PATHを確認 |
| `PythonPipBuilder:Validation` / python3.13がない | `python --version` とPython 3.13のPATH。SAM内部Pythonだけで済ませない |
| SSOトークン期限切れ | `aws sso login --profile reportbank` を再実行 |
| デプロイでAccessDenied | `get-caller-identity` のアカウントとロールを確認。拒否されたActionを管理者へ伝える |
| `ROLLBACK_COMPLETE` | CloudFormationの「イベント」で最初のCREATE_FAILEDを確認。原因解消後、初回失敗スタックの扱いを確認して再作成。既存稼働スタックを削除しない |
| Lambdaの予約同時実行数を設定できない | テンプレートは2を予約する。アカウントのリージョン別同時実行枠をService Quotasで確認・増枠する |
| `No changes to deploy` | 設定が既に同じなら正常。コード変更時は先に再ビルドしたか確認 |
| `ResourceNotFoundException`（シークレット） | ARN全体、東京リージョン、削除予定でないことを確認 |
| `apiKey`のKeyError | Secrets Managerのキー名が正確に `apiKey` か確認 |
| OpenAI 401 / 403 | APIキーの有効性、プロジェクト・モデルの権限を確認 |
| OpenAI 404 / model not found | `gpt-5.6-luna` の利用可否を確認。代替モデルへ変更せず、自動実行は無効のままにする |
| OpenAI 429 | 利用上限・残高・レート制限を確認。連続再実行しない |
| `Summary must contain 1–400...` | 生成本文が文字数などの検証に不合格。前回掲載を維持。実行記録から原因を確認して再実行 |
| 公表資料の取得・解析で失敗 | Step FunctionsのCollectのエラー、CloudWatchログを確認。URL・単位・資料形式の変更はコード側の対応が必要 |
| Step Functionsは成功、本文がない | OpenAISecretArnとDynamoDBのinsightを確認。キーなしでも図表更新は成功する |
| ページでAccessDenied | Amplifyの**Compute role**に対象テーブルのGetItem・Queryがあるか確認。ビルド用ロールだけに付けていないか確認 |
| ページが古いまま | Amplify環境変数、configure:reports、再デプロイ、本文日時を確認。アプリとWorkerのsummaryScopeの版をそろえる |
| 「過去の400字整理」が空 | marketsからHISTORYへの保存は未実装。今回の本文はS3のmarkets.jsonで確認 |
| 毎週の実行が始まらない | Schedulerの状態・東京のタイムゾーン・対象Workflowを確認。配信失敗はSQSのScheduleDeadLetterQueueとCloudWatchのアラームを確認 |
| 通知メールが来ない | SNS購読の承認、メールアドレス、迷惑メールを確認 |

CloudWatchログへは、CloudFormation →リソース→ `Worker` →Lambdaの「モニタリング」→「CloudWatchログを表示」から進めます。ロググループは `/aws/lambda/実際のWorker名` です。

問い合わせ時は「失敗した手順番号」「AWSリージョン」「スタック名」「実行ARN」「エラー名」を伝えると調査できます。APIキーやシークレットの値を含める必要はありません。

## 10. 完成チェックリスト

- [ ] CloudFormationがCREATE_COMPLETEまたはUPDATE_COMPLETE
- [ ] ReportScopeはmarkets、OpenAISecretArnは正しい
- [ ] SNS通知の購読確認が完了
- [ ] 手動実行がSucceeded、出力はmarkets-published
- [ ] DynamoDBにgpt-5.6-lunaで生成した本文がある
- [ ] S3にmarkets.jsonとgeneration-audit.jsonがある
- [ ] AmplifyのCompute role・環境変数・ビルド設定を反映した
- [ ] ページの本文・作成日時がDynamoDBと一致した
- [ ] SchedulerがENABLED、金曜23時、Asia/Tokyo
- [ ] 次の金曜日に実行が始まり、本文日時が更新された

## 参照した実装

本書は次のファイルに照らして作成しています。AWS画面の表記は変更される場合があります。

- [構築テンプレート](../infra/weekly-reports.yaml)
- [収集・生成・保存処理](../workers/weekly-report/index.py)
- [4図表の統合](../workers/weekly-report/integrated.py)
- [Amplifyの実行時設定](../scripts/configure-report-env.mjs)
- [最新図表の読み取り](../lib/reports/markets.ts)
- [履歴の読み取り](../lib/reports/store.ts)
- [統計定義と実装の詳細](weekly-reports.md)

検証範囲はソースコードと公式資料の照合です。実アカウントへのデプロイ、APIキー登録、初回実行、通知送信は本書作成時には行っていません。
