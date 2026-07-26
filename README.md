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
