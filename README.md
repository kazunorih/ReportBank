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
- SQS FIFO + Lambda: Stripe Webhookの非同期・重複排除処理
- microCMS `articles`: 初回決済成功後に下書きを作成

料金は先着5契約が月額5,000円（税込）、以降は月額50,000円（税込）です。Stripeには同一商品の月額Priceを2つ作成し、`.env.example` のPrice IDへ設定してください。

AWSリソースの雛形は `infra/template.yaml` にあります。東京リージョンは `ap-northeast-1` を使用します。Workerは次のコマンドでバンドルします。

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

Amplify SSR Compute Roleには、広告DynamoDBテーブルへのアクセスとStripeイベントSQSへの `sqs:SendMessage` のみを付与してください。秘密鍵とAPIキーはリポジトリへコミットしないでください。
