# microCMS + Next.js + AWS Amplify

このプロジェクトは、microCMS の記事を取得して表示する Next.js アプリです。

## セットアップ

1. `my-first-site` ディレクトリに移動します。
2. `.env.example` をコピーして `.env.local` を作成します。
3. `MICROCMS_SERVICE_ID` と `MICROCMS_API_KEY` を設定します。

```bash
cp .env.example .env.local
```

4. 依存関係をインストールします。

```bash
npm install
```

5. 開発サーバーを起動します。

```bash
npm run dev
```

6. ブラウザで `http://localhost:3000` を開きます。

## microCMS 設定

- サービス ID: `MICROCMS_SERVICE_ID`
- API キー: `MICROCMS_API_KEY`
- API エンドポイント: `https://<serviceId>.microcms.io/api/v1/articles`

`articles` は microCMS 管理画面で作成したコンテンツ API のエンドポイント名です。

## GitHub + AWS Amplify デプロイ

このリポジトリには AWS Amplify 用の GitHub Actions ワークフローと `amplify.yml` を追加しています。

1. GitHub リポジトリを作成し、`main` ブランチをプッシュします。
2. GitHub Secrets に以下を追加します。
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `AMPLIFY_APP_ID`
   - `AMPLIFY_BRANCH_NAME`
3. GitHub の `main` ブランチにプッシュすると、`Deploy to AWS Amplify` ワークフローが起動します。

## 主要ファイル

- `app/page.tsx` - microCMS から記事を読み込んで表示するページ
- `lib/microcms.ts` - microCMS API 呼び出しロジック
- `.env.example` - 必要な環境変数の例
- `.github/workflows/amplify-deploy.yml` - GitHub Actions デプロイ設定
- `amplify.yml` - Amplify ビルド設定

## 広告主機能

- Amazon Cognito: 広告主の登録・メール確認・ログイン
- DynamoDB: 原稿、契約、支払い状態、Webhook処理履歴
- Stripe Checkout: 月額継続課金（カード番号はReportBankで保持しません）
- Stripe Customer Portal: 広告記事ごとの契約を期間終了時に解約
- SQS FIFO + Lambda: Stripe Webhookの非同期・重複排除処理
- Amazon SNS: 支払い完了後、審査待ちになった広告記事を管理者へメール通知
- microCMS `articles`: 初回決済成功後に下書きを作成し、広告主の修正版は公開内容を維持したまま下書きとして保存

`MICROCMS_ADS_WRITE_API_KEY` には、初回原稿作成用のPUT権限と修正版更新用のPATCH権限が必要です。

料金は月額50,000円（税込）です。Stripeに月額Priceを作成し、`.env.example` のPrice IDへ設定してください。

Stripe Webhook用のAWSリソースは `infra/template.yaml` にあります。既存のCognito、DynamoDB、SNSトピックは作成せず、`AdsTableName` で指定した既存テーブルと `AdminNotificationTopicArn` で指定した既存SNSトピックを参照しながら、SQSとLambda Workerを作成します。東京リージョンは `ap-northeast-1` を使用します。Workerは次のコマンドでバンドルします。

```bash
npm run build:worker
```

Stripe Webhook URLは `https://<本番ドメイン>/api/stripe/webhook` です。最低限、次のイベントを送信してください。

- `checkout.session.completed`
- `checkout.session.expired`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Stripe Customer Portalでは、サブスクリプションのキャンセルを有効にし、キャンセル時期を「請求期間の終了時」に設定してください。ReportBankは広告記事ごとに1つのStripe Subscriptionを作成し、DynamoDBに広告IDとSubscription IDの対応を保存します。

Amplify SSR Compute Roleには、広告DynamoDBテーブルへのアクセスとStripeイベントSQSへの `sqs:SendMessage` のみを付与してください。秘密鍵とAPIキーはリポジトリへコミットしないでください。

SAMデプロイ時は `AdminNotificationTopicArn` に購読確認済みの既存SNSトピックARN、`AppUrl` に本番サイトのオリジン（例: `https://reportbankwebsite.com`）を指定してください。SAMはSNSトピックや購読を新規作成せず、Lambda Workerに既存トピックへの通知権限を付与します。
