# CloudInbox Functions

CloudInboxのFirebase Cloud Functions実装です。

## セットアップ

### 依存関係のインストール

```bash
npm install
```

### 環境変数

Stripe連携機能を使用する場合は、Cloud Runの環境変数として設定します。以下の環境変数が必要です：

- **`STRIPE_SECRET_KEY`**: `createCheckoutSession`関数で使用（Stripe APIキー）
- **`STRIPE_WEBHOOK_SECRET`**: `stripeWebhook`関数で使用（Webhook署名検証用）
- **`STRIPE_STANDARD_PRICE_ID_JPY`**: `createCheckoutSession`関数で使用（円用Price ID）
- **`STRIPE_STANDARD_PRICE_ID_USD`**: `createCheckoutSession`関数で使用（ドル用Price ID）

環境変数の設定方法は `docs/STRIPE_SETUP.md` を参照してください。

## ビルド

```bash
npm run build
```

## テスト

```bash
npm test
```

## デプロイ

```bash
npm run deploy
```

特定の関数のみをデプロイする場合：

```bash
firebase deploy --only functions:createCheckoutSession,functions:stripeWebhook
```

