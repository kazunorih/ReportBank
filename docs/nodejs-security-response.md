# Node.js脆弱性対応（2026年10月26日）

リポジトリの修正とローカル検証の記録です。本番への反映完了を示すものではありません。

## 対象と修正

Node.jsの[2026年10月21日公式告知](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)を確認しました。Brotli処理のリモートコード実行（CVE-2026-111497）、TLS検証などの修正が含まれます。24系の修正版は24.22.1、22系は22.23.4です。PCの標準Node.jsは調査時点で24.18.0でした。直接Brotliを呼ぶコードが見つからないことだけでは、依存ライブラリ経由の影響を除外できません。

[Next.jsの10月14日公式告知](https://nextjs.org/blog/nextjs-security-update-october-14-2026)にもリモートコード実行等の修正があります。Node.js本体の更新とは別に依存関係を更新しました。

| 対象 | 更新前 | 更新後 |
| --- | --- | --- |
| 推奨Node.js・検証環境 | 24.18.0 | 24.22.1 |
| Next.js・@next/third-parties・eslint-config-next | 16.2.12 | 16.4.3 |
| React・React DOM | 19.2.4 | 19.2.9 |
| sanitize-html | 2.17.6 | 2.18.1 |
| Zod | 4.4.3 | 4.6.7 |
| Vitest | 4.1.10 | 4.1.12 |

`npm audit`は更新前12パッケージ（critical 1、high 8、moderate 3）、更新後0件です。間接依存も互換範囲内で更新し、package-lock.jsonに固定しています。これはnpm監査に登録済みの依存脆弱性の結果であり、Node.js本体やAWS実環境の修正完了を意味しません。

`.nvmrc`・`.node-version`は24.22.1を指定。package.json・.npmrcと実行前チェックで、未修正のNode.jsによるインストール・開発サーバー・ビルド・起動・テスト・Workerバンドルを拒否します。サポートする系列は22.23.4以降の22系、24.22.1以降の24系です。26系やリリース候補版は今回の検証対象に含めていません。

検証用のWindows版24.22.1はNode.js公式配布元から作業用フォルダーへ取得し、同配布元のSHASUMS256.txtと照合しました。PCのProgram FilesにあるNode.jsを、この作業で自動的に置き換えてはいません。

## Amplifyへの反映

ユーザー提供の現在のビルド設定を基に、ルートにamplify.ymlを追加しました。既存の環境変数の抽出条件、.next出力、キャッシュを維持し、npm ciより前に次を追加しています。

```yaml
- nvm install "$(cat .nvmrc)"
- nvm use "$(cat .nvmrc)"
- node scripts/check-node-version.mjs
```

リポジトリのamplify.ymlがある場合は、コンソール保存の設定より優先されます。[AWS公式説明](https://docs.aws.amazon.com/amplify/latest/userguide/build-settings.html)

1. 通常のレビュー手順で、この変更一式（特にpackage.json・package-lock.json・amplify.yml・.nvmrc）を本番ブランチへ反映します。
2. AWSコンソール → Amplify → レポートバンクのアプリ → 本番ブランチで、新しいコミットのビルド・デプロイが成功したことを確認します。古いコミットを再デプロイするだけでは修正されません。
3. ビルドログでNode.js 24.22.1とランタイムチェック成功を確認します。AL2023など、Node.js 24を利用できるビルドイメージが必要です。
4. 公開サイトでホーム、ログイン、マクロ金融指標、貿易統計の表示を確認します。
5. AmplifyのSSRログで `ReportBank Node.js runtime` を検索し、`component: next-ssr` の実ランタイムが修正済みか確認します。instrumentation.tsでサーバー起動時に版だけを記録します。キーやユーザーデータは記録しません。

AmplifyのSSRはビルドと同じ**メジャー系列**のマネージドランタイムを使用します。ビルドで24.22.1を選んだことだけでSSRのパッチ番号まで同じとは断定せず、起動ログを確認します。[AWS公式説明](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-supported-features.html)

実ランタイムが24.22.1未満、または22系で22.23.4未満なら、本番の修正完了とは判定しません。新しいデプロイでも未修正の場合は、AWS側のロールアウト状況を確認し、AWSサポートへ問い合わせます。

## 広告Webhook Lambda

`infra/template.yaml`の広告Workerはnodejs24.xです。RuntimeManagementConfigをAutoと明示し、更新した依存関係でWorkerを再バンドルしました。Worker起動時にも `ReportBank Node.js runtime` とNode.jsの版を記録します。

AWSコンソール → Lambda → `reportbank-stripe-webhook-worker` → コード → ランタイム設定で、Node.js 24系、自動ランタイム更新がAutoであることを確認します。既存の広告Workerスタックに通常のSAMデプロイ手順で更新コードとテンプレートを反映し、CloudWatchログの `component: stripe-webhook` で実パッチを確認します。次のビルドはデプロイの準備だけで、本番は変更しません。

```powershell
npm run build:worker
sam build --template-file infra/template.yaml --build-dir .aws-sam/ads-security-build
```

既存のスタック名・既存の設定ファイル・シークレットの指定を維持してデプロイします。週次レポート用のweekly-samconfig.tomlは、広告Workerとは別スタック用なので流用しません。

Auto設定は、AWSが公開するランタイムパッチを適用する設定です。単にnodejs24.xと表示されていることだけでは、今回の修正が適用済みとは判定できません。AWSの段階的なパッチ配信と実パッチの確認が必要です。[AWSの自動更新仕様](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-update.html)

金曜のマクロ金融収集Workerはpython3.13であり、今回のNode.jsランタイム更新の直接対象ではありません。定期実行の有効／無効設定は変更していません。

## PCの標準Node.js更新

WindowsのNode.js公式[24.22.1 x64インストーラー](https://nodejs.org/dist/v24.22.1/node-v24.22.1-x64.msi)で更新し、PowerShellを開き直して次を確認します。インストール時のWindows管理者確認が必要になる場合があります。

```powershell
node --version
# v24.22.1、またはそれ以降の24系の修正版
Set-Location 'C:\Users\kazut\Documents\my-first-site'
npm run check:runtime
npm ci
```

今回の作業で検証用に使ったtmp以下のNode.jsは一時配置です。普段使うNode.jsの更新や、Amplify・Lambdaへの反映の代わりにはなりません。

## 検証と未確認事項

- npm監査：更新後0件。
- 全テスト：52件成功。旧図表順序・旧要約を前提とした既存テストは、現在の図表と意味を確認する形に修正しました。
- Lint：成功。生成物の.aws-samと一時作業用tmpは対象外にしました。
- Next.js本番用ビルド・広告Workerバンドル：成功。
- 未修正版Node.js 24.18.0をチェックで拒否することを確認。
- 主要ページの本番モード表示、4市場グラフ、スマートフォン表示を確認。
- 未署名Webhookが受理されないことを確認。ローカルの設定不足時は既存実装により500となるため、決済・SQS送信の本番疎通確認とは区別します。

AWSのreportbank SSO認証が期限切れのため、本番の現行ランタイム・実パッチ・デプロイ結果は今回の環境から未確認です。ユーザーから提供されたAmplifyビルド設定は修正に使用しましたが、AWS設定やGitHubへのpush・本番デプロイは実行していません。

今後はNode.js公式のセキュリティリリースとnpm監査を別々に確認し、新しい修正版が出たら.nvmrc・.node-version・engines・チェック条件を更新して再デプロイします。
