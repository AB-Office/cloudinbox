# Implementation Plan

## Tasks

- [x] 0. Firebase設定のドキュメント化
  - 実装前に必要なFirebase側の設定をドキュメント化する。
  - **Stripe Dashboardでの設定**:
    - Stripe ProductとPriceの作成:
      - StandardプランのProductを作成する（名前: "Standard Plan"など）。
      - StandardプランのPriceを作成する（$5/月、サブスクリプション型）。
      - Price IDを記録する（`price_...`形式、後で環境変数に設定）。
    - Stripe Webhookエンドポイントの設定:
      - Stripe Dashboardの「Developers」→「Webhooks」でエンドポイントを追加する。
      - エンドポイントURL: `https://asia-northeast1-{project-id}.cloudfunctions.net/stripeWebhook`
      - 監視するイベントを選択:
        - `checkout.session.completed`
        - `customer.subscription.updated`
        - `customer.subscription.deleted`
      - Webhookシークレット（`whsec_...`形式）を記録する（後で環境変数に設定）。
    - Stripe APIキーの取得:
      - Stripe Dashboardの「Developers」→「API keys」からシークレットキー（`sk_...`形式）を取得する。
      - 開発環境と本番環境で異なるキーを使用する場合は、それぞれ取得する。
  - **Firebase Functionsの環境変数設定**:
    - Firebase CLIを使用して環境変数を設定する方法をドキュメント化する：
      ```bash
      firebase functions:config:set stripe.secret_key="sk_..."
      firebase functions:config:set stripe.webhook_secret="whsec_..."
      firebase functions:config:set stripe.standard_price_id="price_..."
      ```
    - 環境変数の確認方法をドキュメント化する：
      ```bash
      firebase functions:config:get
      ```
    - 開発環境と本番環境で異なる値を設定する方法を説明する。
  - **Firestoreセキュリティルールの確認**:
    - `users/{uid}/billing`フィールドへの書き込み権限が適切に設定されているか確認する。
    - Cloud Functionsからの書き込みはAdmin SDKを使用するため、通常は問題ないが、必要に応じてルールを更新する。
  - **ドキュメントの保存場所**:
    - `docs/STRIPE_SETUP.md`または`docs/FIREBASE_STRIPE_SETUP.md`に設定手順を保存する。
    - または、プロジェクトのREADMEにセクションを追加する。
  - _Requirements: 2, 4, 6_

- [x] 1. Stripe SDKの追加と環境変数設定
  - `functions/package.json`に`stripe`パッケージ（`^14.0.0`）を追加する。
  - `npm install`を実行して依存関係をインストールする。
  - Firebase Functionsの環境変数に以下を設定する方法をドキュメント化する：
    - `STRIPE_SECRET_KEY`: Stripe APIシークレットキー
    - `STRIPE_WEBHOOK_SECRET`: Stripe Webhookシークレット
    - `STRIPE_STANDARD_PRICE_ID_JPY`: Standardプランの円用Price ID
    - `STRIPE_STANDARD_PRICE_ID_USD`: Standardプランのドル用Price ID
  - `functions/README.md`に環境変数の説明を追加する（実際の値は`.env`に保存、gitignore）。
  - _Requirements: 6_

- [x] 2. プラン設定ファイルの作成
  - `functions/src/subscription/planConfig.ts`を作成し、プラン設定を定義する。
  - `PlanConfig`インターフェースを定義する（`id`, `label`, `priceIdJpy`, `priceIdUsd`, `maxStorageBytes`, `maxAccounts`）。
  - `PLAN_CONFIGS`定数を作成し、FreeプランとStandardプランの設定を定義する。
  - Freeプラン: `id: 'free'`, `label: 'Free'`, `maxStorageBytes: 2147483648` (2GB), `maxAccounts: 1`
  - Standardプラン: `id: 'standard'`, `label: 'Standard'`, `maxStorageBytes: 53687091200` (50GB), `maxAccounts: 10`
  - `getPlanConfig(planId: 'free' | 'standard'): PlanConfig`関数を実装する。
  - `getPriceId(planId: 'free' | 'standard', locale: 'ja' | 'en'): string`関数を実装する（環境変数から動的にPrice IDを取得）。
  - 単体テスト（`planConfig.test.ts`）を作成し、すべてのテストがパスすることを確認する。
  - _Requirements: 2, 4_

- [x] 3. Cloud Functions: createCheckoutSession関数の実装
  - `functions/src/subscription/createCheckoutSession.ts`を作成する。
  - `functions.region('asia-northeast1').https.onCall`を使用してCloud Functionを実装する。
  - 認証チェック: `context.auth`を確認し、UIDを取得する。
  - リクエストボディから`planId`（'free'または'standard'）を受け取る。
  - Firestoreからユーザーの現在のプラン情報を取得する。
  - **プラン変更の種類に応じた処理**:
    - **アップグレード（Free → Standard）**:
      - Stripe SDKを使用してCheckout Sessionを作成する。
      - `mode: 'subscription'`を設定する。
      - `success_url`: `/settings/plan?success=true`（ベースURLを含む完全なURL）
      - `cancel_url`: `/settings/plan?canceled=true`（ベースURLを含む完全なURL）
      - `metadata`: `{ userId: uid, planId: planId }`を設定する。
      - `line_items`: StandardプランのPrice IDを含める。
      - 作成されたCheckout SessionのURLを返す。
    - **ダウングレード（Standard → Free）**:
      - Firestoreから`billing.stripeCustomerId`と`billing.stripeSubscriptionId`を取得する。
      - Stripe APIを使用して既存のサブスクリプションを取得する。
      - サブスクリプションを`cancel_at_period_end: true`で更新する。
      - Checkout Sessionは作成せず、更新完了のメッセージを返す。
  - エラーハンドリング: Stripe APIエラーや無効なプランIDの場合に`functions.https.HttpsError`をスローする。
  - Stripe APIキーは環境変数（`STRIPE_SECRET_KEY`）から取得する。
  - `functions/src/index.ts`に`createCheckoutSession`をエクスポートする。
  - _Requirements: 2_

- [x] 4. Cloud Functions: stripeWebhook関数の実装
  - `functions/src/subscription/stripeWebhook.ts`を作成する。
  - `functions.region('asia-northeast1').https.onRequest`を使用してCloud Functionを実装する。
  - Stripe Webhookの署名検証を実装する（`stripe.webhooks.constructEvent`を使用）。
  - Stripe Webhookシークレットは環境変数（`STRIPE_WEBHOOK_SECRET`）から取得する。
  - 以下のStripeイベントを処理する：
    - `checkout.session.completed`:
      - `session.metadata.userId`からUIDを取得する。
      - `session.metadata.planId`からプランIDを取得する。
      - **アップグレード（Free → Standard）の場合**: 即座にFirestoreの`users/{uid}/plan`をStandardプランに更新する。
      - `billing.stripeCustomerId`と`billing.stripeSubscriptionId`を保存する（`session.customer`と`session.subscription`から取得）。
    - `customer.subscription.updated`:
      - `subscription.customer`からCustomer IDを取得する。
      - Firestoreで`billing.stripeCustomerId`が一致するユーザーを検索してUIDを取得する。
      - `subscription.cancel_at_period_end`と`subscription.status`を確認する：
        - `cancel_at_period_end: true`かつ`status: 'active'`の場合: 請求期間終了時までStandardプランを維持（プラン更新は行わない）。
        - `cancel_at_period_end: true`かつ`status: 'canceled'`の場合: 請求期間終了時にFreeプランに更新（`current_period_end`が現在時刻を過ぎている場合）。
        - その他の場合: `subscription.items.data[0].price.id`からPrice IDを取得し、プランIDに変換してFirestoreの`users/{uid}/plan`を更新する。
    - `customer.subscription.deleted`:
      - `subscription.customer`からCustomer IDを取得する。
      - Firestoreで`billing.stripeCustomerId`が一致するユーザーを検索してUIDを取得する。
      - Firestoreの`users/{uid}/plan`をFreeプランに更新する。
  - プラン更新時は、以下の情報を設定する：
    - `plan.id`: 'free'または'standard'
    - `plan.label`: 'Free'または'Standard'
    - `plan.maxStorageBytes`: プランに応じた値（Free: 2GB、Standard: 50GB）
    - `plan.maxAccounts`: プランに応じた値（Free: 1、Standard: 10）
  - プラン更新時は`updatedAt`フィールドも更新する。
  - エラーハンドリング: エラー発生時はログに記録し、Stripeに適切なステータスコード（200または500）を返す。
  - `functions/src/index.ts`に`stripeWebhook`をエクスポートする。
  - _Requirements: 4_

- [x] 5. Webアプリ: 型定義の追加
  - `apps/web_app/src/types/subscription.ts`を作成する。
  - `Plan`インターフェースを定義する（`id`, `label`, `price`, `priceLabel`, `maxStorageBytes`, `maxAccounts`, `features`）。
  - `CreateCheckoutSessionRequest`インターフェースを定義する（`planId`）。
  - `CreateCheckoutSessionResponse`インターフェースを定義する（`url`）。
  - _Requirements: 1, 3_

- [x] 6. Webアプリ: subscription.tsサービスの実装
  - `apps/web_app/src/services/subscription.ts`を作成する。
  - `createCheckoutSession(planId: 'free' | 'standard'): Promise<void>`関数を実装する。
  - Firebase Functionsの`createCheckoutSession`を呼び出す（`getFunctions`と`httpsCallable`を使用）。
  - 返されたURLに`window.location.href`でリダイレクトする。
  - ダウングレードの場合は、URLではなく成功メッセージが返されるため、リダイレクトは行わずに成功メッセージを表示する。
  - エラーハンドリングを実装し、エラー発生時は例外をスローする。
  - _Requirements: 3_

- [x] 7. Webアプリ: PlanSelectionView.vueの実装
  - `apps/web_app/src/views/PlanSelectionView.vue`を作成する。
  - Vuetifyのコンポーネントを使用してプラン選択画面を実装する。
  - `useSettingsStore`を使用して現在のプラン情報を取得する。
  - `plans: Plan[]`状態を定義し、利用可能なプラン（Free、Standard）を一覧表示する。
  - URLクエリパラメータ`?upgrade=true`を確認し、アップグレード促進バナーを表示する。
  - アップグレード促進バナーには以下を表示する：
    - アップグレードが必要であることを示すメッセージ
    - 現在のプランと上限値（アカウント数、ストレージ容量）
    - アップグレード後の上限値（Standardプランの場合）
  - 各プランカードには以下を表示する：
    - プラン名
    - 価格（Free: "無料", Standard: "$5/month"または"¥500/月"、ロケールに応じて）
    - ストレージ容量（Free: "2GB", Standard: "50GB"）
    - アカウント数上限（Free: "1アカウント", Standard: "複数アカウント"）
    - 機能一覧
    - 「現在のプラン」バッジ（現在のプランのみ表示）
    - 「このプランに変更」ボタン（Standardプランでアップグレード促進時は「今すぐアップグレード」など強調表示）
  - `handlePlanChange(planId: string)`メソッドを実装し、`subscription.ts`の`createCheckoutSession`を呼び出す（現在のロケールを渡す）。
  - Checkout Session作成中はローディング状態を表示する。
  - Checkout Session作成に失敗した場合は、エラーメッセージをスナックバーで表示する。
  - `handleBack()`メソッドを実装し、設定画面に戻る。
  - URLクエリパラメータ（`?success=true`または`?canceled=true`）を確認し、成功/キャンセルメッセージを表示する。
  - 既存のデザインシステム（Vuetify）と一貫性があるUIを実装する。
  - _Requirements: 1, 3, 5, 7_

- [x] 8. Webアプリ: SettingsView.vueの更新
  - `apps/web_app/src/views/SettingsView.vue`を更新する。
  - プラン情報カードを追加する（容量情報表示の下に配置）。
  - プラン情報カードには以下を表示する：
    - 現在のプラン名（`settingsStore.settings?.planLabel`）
    - ストレージ容量（既存の表示を利用）
    - アカウント数上限（`planMaxAccounts`を計算して表示）
  - 「プランを変更」ボタンを追加し、クリックでプラン選択画面（`PlanSelectionView.vue`）に遷移する。
  - `navigateToPlanSelection()`メソッドを実装する。
  - `planMaxAccounts`を計算するcomputedプロパティを追加する（`settingsStore.settings`から取得、またはFirestoreから直接取得）。
  - _Requirements: 1_

- [x] 9. Webアプリ: ルーター設定の更新
  - `apps/web_app/src/router/index.ts`を更新する。
  - `/settings/plan`ルートを追加する。
  - `name: 'plan-selection'`を設定する。
  - `component: () => import('@/views/PlanSelectionView.vue')`を設定する。
  - `meta: { requiresAuth: true }`を設定して認証必須とする。
  - _Requirements: 1_

- [x] 10. Firestoreセキュリティルールの確認（必要に応じて更新）
  - `infra/firebase/firestore.rules`を確認する。
  - `users/{uid}/billing`フィールドへの書き込み権限が適切に設定されているか確認する。
  - 必要に応じて、認証済みユーザーが自分の`billing`フィールドを読み書きできるようにルールを追加する。
  - _Requirements: 2, 4_

- [x] 11. i18n翻訳キーの追加
  - `apps/web_app/src/plugins/i18n/locales/ja.json`と`en.json`に以下の翻訳キーを追加する：
    - `settings.plan`: "プラン" / "Plan"
    - `settings.currentPlan`: "現在のプラン" / "Current Plan"
    - `settings.maxAccounts`: "アカウント数上限" / "Max Accounts"
    - `settings.changePlan`: "プランを変更" / "Change Plan"
    - `planSelection.title`: "プラン選択" / "Plan Selection"
    - `planSelection.currentPlan`: "現在のプラン" / "Current Plan"
    - `planSelection.changePlan`: "このプランに変更" / "Change to this plan"
    - `planSelection.upgradeNow`: "今すぐアップグレード" / "Upgrade Now"
    - `planSelection.back`: "戻る" / "Back"
    - `planSelection.success`: "プラン変更が完了しました" / "Plan change completed"
    - `planSelection.canceled`: "プラン変更がキャンセルされました" / "Plan change canceled"
    - `planSelection.processing`: "プラン変更を処理中です..." / "Processing plan change..."
    - `planSelection.upgradeRequired`: "プランのアップグレードが必要です" / "Plan upgrade required"
    - `planSelection.upgradeBanner`: "現在のプランでは上限に達しています。Standardプランにアップグレードすると、より多くのアカウントとストレージ容量を利用できます。" / "You have reached the limit of your current plan. Upgrade to Standard plan to use more accounts and storage capacity."
    - `planSelection.currentLimit`: "現在の上限: {accounts}アカウント、{storage}" / "Current limit: {accounts} accounts, {storage}"
    - `planSelection.upgradeLimit`: "アップグレード後: {accounts}アカウント、{storage}" / "After upgrade: {accounts} accounts, {storage}"
    - `errors.account.upgradeRequired`: "アカウント数の上限に達しています。プランをアップグレードしてください。" / "You have reached the account limit. Please upgrade your plan."
    - `errors.account.upgradeButton`: "プランをアップグレード" / "Upgrade Plan"
    - `plan.free`: "Free"
    - `plan.standard`: "Standard"
    - `plan.price.free`: "無料" / "Free"
    - `plan.price.standard`: "$5/月" / "$5/month"
    - `plan.storage.free`: "2GB"
    - `plan.storage.standard`: "50GB"
    - `plan.accounts.free`: "1アカウント" / "1 account"
    - `plan.accounts.standard`: "複数アカウント" / "Multiple accounts"
  - _Requirements: 1, 5, 7_

- [x] 13. エラーハンドラーの更新（アップグレード促進対応）
  - `apps/web_app/src/utils/errorHandler.ts`を更新する。
  - `Account limit reached`エラーを検出し、アップグレードが必要であることを示すカスタムエラーに変換する。
  - エラーメッセージに現在のプランと上限値、アップグレード後の上限値を含める。
  - エラーメッセージに「プランをアップグレード」ボタンのアクションを含める。
  - _Requirements: 7_

- [x] 14. アカウント追加時のエラーハンドリング更新
  - `apps/web_app/src/views/AccountFormView.vue`（またはアカウント追加画面）を更新する。
  - `accountService.createAccount()`のエラー処理を更新する。
  - `Account limit reached`エラーが発生した場合、エラーダイアログまたはスナックバーを表示する。
  - エラーダイアログに「プランをアップグレード」ボタンを追加する。
  - 「プランをアップグレード」ボタンをクリックすると、`/settings/plan?upgrade=true`に遷移する。
  - _Requirements: 7_

- [ ] 12. 統合テストと動作確認
  - Cloud Functionsのデプロイと動作確認を行う。
  - Stripe DashboardでWebhookエンドポイントを設定する。
  - Stripe CLIを使用してWebhookイベントをテストする。
  - Webアプリのプラン選択フローをテストする：
    - 設定画面からプラン選択画面への遷移
    - プラン選択とStripe Checkoutへのリダイレクト
    - 決済完了後のリダイレクトと成功メッセージ表示
    - プラン変更後の設定画面の自動更新
  - ダウングレード処理のテスト：
    - StandardプランからFreeプランへの変更
    - 請求期間終了時の自動ダウングレード
  - エラーハンドリングのテスト：
    - Checkout Session作成失敗時のエラー表示
    - Webhook処理失敗時のログ確認
  - _Requirements: 1, 2, 3, 4, 5_

