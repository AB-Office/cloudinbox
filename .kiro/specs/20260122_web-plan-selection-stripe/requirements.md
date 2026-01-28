# Requirements Document

## Introduction
Web版でプラン選択機能を実装し、Stripeとの連携によりプラン変更を処理する。ユーザーがWebアプリからプランを選択・変更できるようにし、Stripeでの決済完了後にFirestoreのプラン情報を自動更新する。これにより、Stripeの決済結果に基づいて確実にプラン変更が反映されるようになる。

## Requirements

### Requirement 1: Webアプリでプラン選択画面を実装
**Objective:** Webアプリユーザーとして、現在のプラン情報を確認し、プラン変更を開始できる画面が欲しい。そうすることで、ユーザーが自分のプランを理解し、必要に応じてアップグレードやダウングレードを行えるようになる。

#### Acceptance Criteria
1. 設定画面（`SettingsView.vue`）にプラン情報カードを追加すること。
2. プラン情報カードには、現在のプラン名（Free/Standard）、ストレージ容量、アカウント数上限を表示すること。
3. プラン情報カードに「プランを変更」ボタンを追加し、クリックでプラン選択画面（`PlanSelectionView.vue`）に遷移すること。
4. プラン選択画面では、利用可能なプラン（Free、Standard）を一覧表示すること。
5. 各プランには、価格、ストレージ容量、アカウント数上限、機能一覧を表示すること。価格はロケールに応じて表示すること（日本語: 円、英語: ドル）。
6. 現在のプランには「現在のプラン」バッジを表示すること。
7. プラン選択画面で「このプランに変更」ボタンをクリックした際に、Stripe Checkoutセッション作成処理を呼び出すこと。
8. プラン選択画面のUIは、既存のデザインシステム（Vuetify）と一貫性があること。
9. ルーターに`/settings/plan`ルートを追加し、認証必須とすること。

### Requirement 2: Stripe Checkoutセッション作成のCloud Functionを実装
**Objective:** バックエンドエンジニアとして、ユーザーが選択したプランに基づいてStripe Checkoutセッションを作成できるようにしたい。そうすることで、ユーザーをStripeの決済画面に安全にリダイレクトできるようになる。

#### Acceptance Criteria
1. Cloud Functionsに`createCheckoutSession`関数を追加すること（`functions/src/subscription/createCheckoutSession.ts`）。
2. `createCheckoutSession`関数は、認証済みユーザーのUIDを取得し、リクエストボディから`planId`（'free'または'standard'）と`locale`（'ja'または'en'）を受け取ること。
3. **プラン変更の種類に応じた処理**:
   - **アップグレード（Free → Standard）**: Stripe SDKを使用してCheckout Sessionを作成すること。
   - **ダウングレード（Standard → Free）**: 既存のサブスクリプションを`cancel_at_period_end: true`で更新し、Checkout Sessionは作成しないこと。請求期間終了時に自動的にFreeプランにダウングレードされる。
4. Checkout Sessionには、選択されたプランの価格ID（ロケールに応じて円用またはドル用のPrice IDを選択）、成功時のリダイレクトURL、キャンセル時のリダイレクトURLを設定すること。
5. Checkout Sessionのメタデータに、ユーザーUIDとプランIDを保存すること。
6. 作成されたCheckout SessionのURLをクライアントに返すこと（ダウングレードの場合は、更新完了のメッセージを返すこと）。
7. エラーハンドリングを実装し、Stripe APIエラーや無効なプランIDの場合に適切なエラーメッセージを返すこと。
8. Stripe APIキーは環境変数（`STRIPE_SECRET_KEY`）から取得すること。
9. 関数は`asia-northeast1`リージョンでデプロイすること。

### Requirement 3: WebアプリからStripe Checkoutへのリダイレクト処理を実装
**Objective:** フロントエンドエンジニアとして、プラン選択画面からStripe Checkoutセッションを作成し、ユーザーをStripeの決済画面にリダイレクトできるようにしたい。そうすることで、ユーザーが安全に決済を行えるようになる。

#### Acceptance Criteria
1. Webアプリに`subscription.ts`サービスを追加し、`createCheckoutSession(planId: string, locale: 'ja' | 'en')`関数を実装すること。
2. `createCheckoutSession`関数は、Firebase Functionsの`createCheckoutSession`を呼び出し、返されたURLにリダイレクトすること。
3. プラン選択画面（`PlanSelectionView.vue`）で「このプランに変更」ボタンをクリックした際に、`subscription.ts`の`createCheckoutSession`を呼び出すこと。
4. Checkout Session作成中はローディング状態を表示すること。
5. Checkout Session作成に失敗した場合は、エラーメッセージを表示すること。
6. リダイレクトは`window.location.href`を使用して実装すること。

### Requirement 4: Stripe Webhookエンドポイントを実装してプラン変更を処理
**Objective:** バックエンドエンジニアとして、Stripeでの決済完了やサブスクリプション変更を検知し、Firestoreのユーザープラン情報を自動更新できるようにしたい。そうすることで、Stripeの決済結果に基づいて確実にプラン変更が反映されるようになる。

#### Acceptance Criteria
1. Cloud Functionsに`stripeWebhook`関数を追加すること（`functions/src/subscription/stripeWebhook.ts`）。
2. `stripeWebhook`関数は、Stripe Webhookの署名検証を実装すること。
3. 以下のStripeイベントを処理すること：
   - `checkout.session.completed`: チェックアウト完了時にプランを更新（アップグレード時は即座に反映）
   - `customer.subscription.updated`: サブスクリプション更新時にプランを更新（請求期間終了時のダウングレード処理を含む）
   - `customer.subscription.deleted`: サブスクリプション削除時にFreeプランにダウングレード
4. **プラン変更の動作**:
   - **アップグレード（Free → Standard）**: `checkout.session.completed`イベントで即座にFirestoreのプランをStandardに更新すること。
   - **ダウングレード（Standard → Free）**: 請求期間終了時にプランをFreeに更新すること。`customer.subscription.updated`イベントで`cancel_at_period_end: true`が設定されている場合は、請求期間終了時（`current_period_end`）までStandardプランを維持し、期間終了時にFreeプランに更新すること。
5. WebhookイベントからユーザーUIDとプランIDを取得し、Firestoreの`users/{uid}/plan`フィールドを更新すること。
6. プラン更新時は、以下の情報を設定すること：
   - `plan.id`: 'free'または'standard'
   - `plan.label`: 'Free'または'Standard'
   - `plan.maxStorageBytes`: プランに応じた値（Free: 2GB、Standard: 50GB）
   - `plan.maxAccounts`: プランに応じた値（Free: 1、Standard: 複数）
7. プラン更新時は`updatedAt`フィールドも更新すること。
8. Webhook処理中にエラーが発生した場合は、ログに記録し、Stripeに適切なステータスコードを返すこと。
9. Stripe Webhookシークレットは環境変数（`STRIPE_WEBHOOK_SECRET`）から取得すること。
10. 関数は`asia-northeast1`リージョンでデプロイすること。

### Requirement 5: プラン変更後のUI更新とエラーハンドリング
**Objective:** Webアプリユーザーとして、プラン変更後に設定画面のプラン情報が自動的に更新され、変更が反映されたことを確認できるようにしたい。また、エラーが発生した場合も適切に通知を受けたい。そうすることで、プラン変更の状態を常に把握できるようになる。

#### Acceptance Criteria
1. Stripe Checkoutから成功時のリダイレクトURL（`/settings/plan?success=true`）に戻った際に、成功メッセージを表示すること。
2. Stripe Checkoutからキャンセル時のリダイレクトURL（`/settings/plan?canceled=true`）に戻った際に、キャンセルメッセージを表示すること。
3. 設定画面のプラン情報は、Firestoreのリアルタイムリスナー（既存の`settingsStore`）により自動更新されること。
4. プラン変更処理中にエラーが発生した場合は、エラーメッセージをスナックバーで表示すること。
5. プラン選択画面から設定画面に戻るボタンを追加すること。
6. プラン変更が完了するまで数秒かかる可能性があるため、リダイレクト後は「プラン変更を処理中です...」などのメッセージを表示すること（オプション）。

### Requirement 7: アップグレードが必要な操作時の通知とプラン選択画面への遷移
**Objective:** Webアプリユーザーとして、プラン上限に達した操作（アカウント追加、ストレージ容量超過など）を行った際に、アップグレードが必要であることを通知され、プラン選択画面に遷移できるようにしたい。そうすることで、必要な時に適切なプランにアップグレードできるようになる。

#### Acceptance Criteria
1. アカウント追加時にプラン上限に達した場合（`Account limit reached`エラー）:
   - エラーメッセージを表示し、アップグレードが必要であることを通知すること。
   - ダイアログまたはスナックバーに「プランをアップグレード」ボタンを表示すること。
   - 「プランをアップグレード」ボタンをクリックすると、プラン選択画面（`/settings/plan?upgrade=true`）に遷移すること。
   - プラン選択画面では、Standardプランを強調表示し、アップグレードを促すメッセージを表示すること。
2. ストレージ容量上限に達した場合（メール受信時のエラーなど）:
   - エラーメッセージを表示し、ストレージ容量が上限に達していることを通知すること。
   - 可能な場合は、プラン選択画面への遷移を促すメッセージを表示すること。
3. エラーハンドリング:
   - 既存のエラーハンドラー（`errorHandler.ts`）で`Account limit reached`エラーを検出し、アップグレードが必要であることを示すカスタムエラーに変換すること。
   - エラーメッセージには、現在のプランと上限値、アップグレード後の上限値を表示すること。
4. プラン選択画面でのアップグレード促進:
   - URLクエリパラメータ`?upgrade=true`が設定されている場合、アップグレードが必要であることを示すバナーを表示すること。
   - Standardプランを強調表示し、「今すぐアップグレード」などのメッセージを表示すること。

### Requirement 6: Stripe環境変数と設定の管理
**Objective:** 開発者として、StripeのAPIキーとWebhookシークレットを安全に管理し、開発環境と本番環境で適切に設定できるようにしたい。そうすることで、セキュリティを保ちながら開発とデプロイを行えるようになる。

#### Acceptance Criteria
1. Cloud Functionsの環境変数に以下を追加すること：
   - `STRIPE_SECRET_KEY`: Stripe APIシークレットキー
   - `STRIPE_WEBHOOK_SECRET`: Stripe Webhookシークレット
   - `STRIPE_STANDARD_PRICE_ID_JPY`: Standardプランの円用Price ID（`price_...`形式）
   - `STRIPE_STANDARD_PRICE_ID_USD`: Standardプランのドル用Price ID（`price_...`形式）
2. 環境変数は`.env.example`に記載し、実際の値は`.env`（gitignore）に保存すること。
3. Firebase Functionsのデプロイ時に環境変数が正しく設定されることを確認すること。
4. Stripe SDK（`stripe`パッケージ）を`functions/package.json`に追加すること。
5. 開発環境と本番環境で異なるStripeキーを使用できるようにすること。

