# Stripe設定ガイド

このドキュメントでは、CloudInboxのプラン選択機能で使用するStripeの設定手順を説明します。

## 前提条件

- Stripeアカウント（開発環境と本番環境で異なるアカウントを使用することを推奨）
- Firebase CLIがインストールされていること
- Firebaseプロジェクトへのアクセス権限があること

## 1. Stripe Dashboardでの設定

### 1.1 ProductとPriceの作成

Standardプランには、円用とドル用の2つのPriceを作成する必要があります。

#### 円用Priceの作成

1. Stripe Dashboardにログインします
2. 「Products」→「Add product」をクリックします
3. 以下の情報を入力します：
   - **Name**: `Standard Plan (JPY)`（または任意の名前）
   - **Description**: `CloudInbox Standard Plan - 50GB storage, multiple accounts`
   - **Pricing model**: `Standard pricing`
   - **Price**: `¥500`（または適切な金額）
   - **Currency**: `JPY`（日本円）
   - **Billing period**: `Monthly`
   - **Recurring**: `Yes`（サブスクリプション型）
4. 「Save product」をクリックします
5. 作成されたPrice ID（`price_...`形式）を記録します
   - このPrice IDは後でFirebase Functionsの環境変数`STRIPE_STANDARD_PRICE_ID_JPY`に設定します

#### ドル用Priceの作成

1. 同じProductに追加のPriceを追加するか、別のProductとして作成します
2. 「Products」→既存のProductを選択、または「Add product」をクリックします
3. 以下の情報を入力します：
   - **Name**: `Standard Plan (USD)`（または任意の名前）
   - **Description**: `CloudInbox Standard Plan - 50GB storage, multiple accounts`
   - **Pricing model**: `Standard pricing`
   - **Price**: `$5.00`
   - **Currency**: `USD`（米ドル）
   - **Billing period**: `Monthly`
   - **Recurring**: `Yes`（サブスクリプション型）
4. 「Save product」をクリックします
5. 作成されたPrice ID（`price_...`形式）を記録します
   - このPrice IDは後でFirebase Functionsの環境変数`STRIPE_STANDARD_PRICE_ID_USD`に設定します

**注意**: 同じProductに複数のPriceを追加することも、別々のProductとして作成することもできます。どちらの方法でも動作します。

### 1.2 Webhookエンドポイントの設定

1. Stripe Dashboardの「Developers」→「Webhooks」を開きます
2. 「Add endpoint」をクリックします
3. エンドポイントURLを入力します：
   - **開発環境**: `https://asia-northeast1-cloudinbox-dev.cloudfunctions.net/stripeWebhook`
   - **本番環境**: `https://asia-northeast1-cloudinbox.cloudfunctions.net/stripeWebhook`
4. 監視するイベントを選択します：
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. 「Add endpoint」をクリックします
6. 作成されたWebhookシークレット（`whsec_...`形式）を記録します
   - 「Signing secret」セクションからコピーできます
   - このシークレットは後でFirebase Functionsの環境変数に設定します

### 1.3 APIキーの取得

1. Stripe Dashboardの「Developers」→「API keys」を開きます
2. 「Secret key」をコピーします（`sk_...`形式）
   - 開発環境と本番環境で異なるキーを使用する場合は、それぞれ取得します
   - このキーは後でFirebase Functionsの環境変数に設定します

## 2. Firebase Functionsの環境変数設定

### 2.1 環境変数の設定

Firebase Functions v2（Cloud Run）では、環境変数を`process.env`で直接アクセスします。各環境変数は以下のCloud Functionsで使用されます：

- **`STRIPE_SECRET_KEY`**: `createCheckoutSession`関数で使用（Stripe APIキー）
- **`STRIPE_WEBHOOK_SECRET`**: `stripeWebhook`関数で使用（Webhook署名検証用）
- **`STRIPE_STANDARD_PRICE_ID_JPY`**: `createCheckoutSession`関数で使用（円用Price ID）
- **`STRIPE_STANDARD_PRICE_ID_USD`**: `createCheckoutSession`関数で使用（ドル用Price ID）

環境変数は、Cloud Runの環境変数として設定します。以下の2つの方法があります：

#### 方法1: GCPコンソールで設定（推奨）

1. [Cloud Functions コンソール](https://console.cloud.google.com/functions)にアクセス
2. `createCheckoutSession`関数を選択
3. 「編集」をクリック
4. 「ランタイム、ビルド、接続」タブを開く
5. 「環境変数」セクションで以下を追加:
   - **名前**: `STRIPE_SECRET_KEY`、**値**: `sk_test_...`（開発環境）または`sk_live_...`（本番環境）
   - **名前**: `STRIPE_STANDARD_PRICE_ID_JPY`、**値**: `price_...`
   - **名前**: `STRIPE_STANDARD_PRICE_ID_USD`、**値**: `price_...`
6. 「デプロイ」をクリック

同様に`stripeWebhook`関数にも以下を設定:
   - **名前**: `STRIPE_WEBHOOK_SECRET`、**値**: `whsec_...`

#### 方法2: gcloud CLIで設定

```bash
# 開発環境の場合
firebase use cloudinbox-dev
gcloud run services update createCheckoutSession \
  --set-env-vars STRIPE_SECRET_KEY="sk_test_...",STRIPE_STANDARD_PRICE_ID_JPY="price_...",STRIPE_STANDARD_PRICE_ID_USD="price_..." \
  --region=asia-northeast1

gcloud run services update stripeWebhook \
  --set-env-vars STRIPE_WEBHOOK_SECRET="whsec_..." \
  --region=asia-northeast1

# 本番環境の場合
firebase use cloudinbox
gcloud run services update createCheckoutSession \
  --set-env-vars STRIPE_SECRET_KEY="sk_live_...",STRIPE_STANDARD_PRICE_ID_JPY="price_...",STRIPE_STANDARD_PRICE_ID_USD="price_..." \
  --region=asia-northeast1

gcloud run services update stripeWebhook \
  --set-env-vars STRIPE_WEBHOOK_SECRET="whsec_..." \
  --region=asia-northeast1
```

**注意**: 
- 開発環境ではStripeのテストモードキー（`sk_test_...`）を使用します
- 本番環境ではStripeの本番モードキー（`sk_live_...`）を使用します
- Webhookシークレットも環境ごとに異なります
- 各環境変数は対応するCloud Functionsをデプロイする前に設定する必要があります

### 2.2 環境変数の確認

設定した環境変数を確認するには：

```bash
gcloud run services describe createCheckoutSession --region=asia-northeast1 --format="value(spec.template.spec.containers[0].env)"
gcloud run services describe stripeWebhook --region=asia-northeast1 --format="value(spec.template.spec.containers[0].env)"
```

または、GCPコンソールで各関数の「環境変数」セクションを確認してください。

### 2.3 環境変数の削除

環境変数を削除するには、GCPコンソールまたは`gcloud run services update`コマンドを使用します：

#### 方法1: GCPコンソールで削除

1. [Cloud Functions コンソール](https://console.cloud.google.com/functions)にアクセス
2. 対象の関数を選択
3. 「編集」をクリック
4. 「ランタイム、ビルド、接続」タブを開く
5. 「環境変数」セクションで削除したい環境変数の「削除」ボタンをクリック
6. 「デプロイ」をクリック

#### 方法2: gcloud CLIで削除

```bash
# createCheckoutSession関数から環境変数を削除
gcloud run services update createCheckoutSession \
  --remove-env-vars STRIPE_SECRET_KEY,STRIPE_STANDARD_PRICE_ID_JPY,STRIPE_STANDARD_PRICE_ID_USD \
  --region=asia-northeast1

# stripeWebhook関数から環境変数を削除
gcloud run services update stripeWebhook \
  --remove-env-vars STRIPE_WEBHOOK_SECRET \
  --region=asia-northeast1
```

## 3. Firestoreセキュリティルールの確認

Cloud Functionsからの書き込みはAdmin SDKを使用するため、セキュリティルールをバイパスします。ただし、クライアント側からのアクセスを制御するために、既存のセキュリティルールを確認します。

現在のルール（`infra/firebase/firestore.rules`）では、`users/{uid}`ドキュメント全体に対して認証済みユーザーが自分のデータを読み書きできるようになっています：

```javascript
match /users/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
  // ...
}
```

このルールにより、`billing`フィールドも含めて、ユーザーは自分のデータを読み書きできます。Cloud Functionsからの書き込みはAdmin SDKを使用するため、セキュリティルールをバイパスします。

## 4. 設定の確認

### 4.1 Cloud Functionsのデプロイ

環境変数を設定した後、Cloud Functionsをデプロイします：

```bash
cd functions
npm install
npm run build

# 環境変数を使用する関数をデプロイ
# createCheckoutSession: stripe.secret_key, stripe.standard_price_id_jpy, stripe.standard_price_id_usd を使用
# stripeWebhook: stripe.webhook_secret を使用
firebase deploy --only functions:createCheckoutSession,functions:stripeWebhook
```

**重要**: 環境変数を設定してからCloud Functionsをデプロイしてください。環境変数が設定されていない場合、関数はエラーを返します。

### 4.2 Webhookエンドポイントのテスト

Stripe CLIを使用してWebhookイベントをテストできます。

```bash
# Stripe CLIをインストール（未インストールの場合）
# macOS: brew install stripe/stripe-cli/stripe
# Linux: 公式ドキュメントを参照

# Stripe CLIにログイン
stripe login

# Webhookイベントをテスト（デプロイ済みのエンドポイントに対して）
stripe trigger checkout.session.completed
```

**重要**: 環境変数が設定されていない場合、`stripeWebhook`関数は「Stripe webhook secret is not configured」エラーを返します。これは想定通りの動作です。

## 5. トラブルシューティング

### 5.1 Webhookが受信されない

- WebhookエンドポイントURLが正しいか確認します
- Cloud Functionsがデプロイされているか確認します
- Stripe Dashboardの「Webhooks」→「Events」でイベントの送信履歴を確認します

### 5.2 環境変数が読み込まれない

#### 本番環境（デプロイ済み）

- `firebase functions:config:get`で環境変数が設定されているか確認します
- Cloud Functionsを再デプロイします
- 環境変数の名前が正しいか確認します：
  - `createCheckoutSession`関数: `stripe.secret_key`, `stripe.standard_price_id_jpy`, `stripe.standard_price_id_usd`
  - `stripeWebhook`関数: `stripe.webhook_secret`
- 環境変数を設定した後にCloud Functionsを再デプロイしているか確認します

#### 環境変数が読み込まれない場合

- GCPコンソールまたは`gcloud run services describe`で環境変数が設定されているか確認します
- 環境変数を設定した後にCloud Functionsを再デプロイしているか確認します
- エラーメッセージ「Stripe webhook secret is not configured」が表示される場合、GCPコンソールまたは`gcloud run services update`で`STRIPE_WEBHOOK_SECRET`が設定されているか確認します

### 5.3 署名検証エラー

- Webhookシークレットが正しいか確認します
- 開発環境と本番環境で異なるシークレットを使用している場合、環境を確認します

## 6. セキュリティのベストプラクティス

1. **APIキーの管理**:
   - APIキーは環境変数として管理し、コードに直接記述しない
   - 開発環境と本番環境で異なるキーを使用する
   - 定期的にキーをローテーションする

2. **Webhookシークレット**:
   - Webhookシークレットは必ず署名検証に使用する
   - シークレットは環境変数として管理する

3. **環境変数の保護**:
   - `.env`ファイルは`.gitignore`に追加する
   - 環境変数はFirebase Functionsの設定として管理する

## 7. 参考リンク

- [Stripe Dashboard](https://dashboard.stripe.com/)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Firebase Functions Environment Variables](https://firebase.google.com/docs/functions/config-env)

