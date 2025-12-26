# CloudInbox

CloudInboxは、外部メールサーバ（POP3S）から受信したメールをクラウド上へ保存し、スマートフォンアプリ（Flutter）からどの端末でも同じ受信箱を閲覧できる「クラウド受信箱サービス」です。

Googleの外部メール受信終了後、複数メールアカウントを一元管理できる代替サービスとして設計されています。

## 主要機能

- **外部メール受信**: POP3S（SSL/TLS必須）による自動メール受信とクラウド保存
- **統一受信箱**: 複数アカウントのメールを単一の受信トレイで閲覧
- **メール送信**: SMTP（SSL/TLS必須）によるメール送信機能
- **添付ファイル管理**: メール添付ファイルの表示・ダウンロード機能
- **容量管理**: プランベースのストレージ制限と使用量追跡
- **暗号化**: アプリケーションレベル暗号化（AES-256-GCM、KMS + Secret Managerによる鍵管理）
- **クロスプラットフォーム**: Flutterアプリによるモバイル対応
- **認証**: Firebase Auth（Google Sign-In）

## アーキテクチャ概要

```
外部メール(POP3S/SMTP)
   ↓
Cloud Functions
   ├ EncryptionService (KMS + Secret Manager)
   ├ Firestore (メタデータ)
   └ Storage (本文・添付ファイル)
   ↓
Flutterアプリ (モバイル)
```

サーバーレスアーキテクチャを採用。Firebase Functionsによるバックエンド処理と、Firestore/Storageによるデータ永続化、Flutterによるクロスプラットフォームクライアントで構成されます。

## 技術スタック

### バックエンド
- **言語**: TypeScript
- **ランタイム**: Node.js 20 (Firebase Functions)
- **データベース**: Firestore (NoSQL)
- **ストレージ**: Firebase Storage
- **認証**: Firebase Auth
- **暗号化**: Google Cloud KMS（KEK管理） + Secret Manager（wrapされたDEKの保存）

### フロントエンド
- **フレームワーク**: Flutter (Dart)
- **UI**: Material Design
- **国際化**: 日本語・英語（デバイス言語設定に基づく自動選択）

### インフラ
- Firebase Functions（Cloud Functions）
- Firestore
- Firebase Storage
- Firebase Auth
- Cloud Scheduler（定期メール受信）
- Cloud Tasks（非同期処理）

## ディレクトリ構成

```
cloudinbox/
├── apps/
│   └── mobile_app/          # Flutterモバイルアプリ
├── functions/
│   ├── src/
│   │   ├── mail/            # メール関連機能（受信、送信、添付ファイル）
│   │   ├── users/           # ユーザー管理機能
│   │   ├── encryption/      # 暗号化機能
│   │   └── shared/          # 共通ユーティリティ
│   └── package.json
├── packages/
│   └── dart_models/         # Flutter共有モデル定義
├── infra/
│   └── firebase/            # Firestore/Security Rules等の設定
├── docs/                    # プロジェクト仕様書
└── .kiro/                   # 仕様駆動開発（Spec-Driven Development）管理
    ├── steering/            # プロジェクト全体のガイドライン
    └── specs/               # 機能別仕様書
```

## セットアップ

### 必要なツール

- Node.js 20+
- Flutter SDK (最新の安定版)
- Firebase CLI
- Google Cloud SDK（Secret Manager用）

### 環境設定

1. **Firebase プロジェクトの初期化**
   ```bash
   firebase login
   firebase use <project-id>
   ```

2. **Functions の依存関係インストール**
   ```bash
   cd functions
   npm install
   ```

3. **Flutter アプリの依存関係インストール**
   ```bash
   cd apps/mobile_app
   flutter pub get
   ```

4. **KMS と Secret Manager のセットアップ**
   
   KMS と Secret Manager の設定は以下のドキュメントを参照してください：
   - `docs/SETUP_SECRET_MANAGER_KMS.md`
   - `infra/kms-setup.md`
   - `infra/secret-manager-setup.md`

## 開発

### Functions の開発

```bash
# TypeScript のビルド
cd functions
npm run build

# エミュレータで実行
npm run serve

# テスト実行
npm test

# ウォッチモードでテスト実行
npm run test:watch
```

### Flutter アプリの開発

```bash
# アプリの実行
cd apps/mobile_app
flutter run

# テスト実行
flutter test

# 統合テスト実行
flutter test integration_test/
```

### デプロイ

```bash
# Functions のみデプロイ
firebase deploy --only functions

# Firestore Rules のみデプロイ
firebase deploy --only firestore:rules

# Storage Rules のみデプロイ
firebase deploy --only storage

# すべてデプロイ
firebase deploy
```

## テスト

### Functions のテスト

- **単体テスト**: Jest を使用した各関数の単体テスト
- **統合テスト**: HTTP Callable Function のエンドツーエンドテスト

### Flutter アプリのテスト

- **Widget テスト**: 各ウィジェットの動作確認
- **統合テスト**: アプリ全体のエンドツーエンドテスト

## プロジェクト管理

本プロジェクトは Spec-Driven Development（仕様駆動開発）を採用しています。

- 仕様書は `.kiro/specs/` に配置されています
- プロジェクト全体のガイドラインは `.kiro/steering/` に配置されています
- 各機能は Requirements → Design → Tasks → Implementation のフェーズで管理されます

詳細は `.kiro/` ディレクトリ内のドキュメントを参照してください。

## セキュリティ

- **認証**: Firebase Auth による Google アカウント認証
- **認可**: Firestore Security Rules によるデータアクセス制御
- **暗号化**: 
  - アルゴリズム: AES-256-GCM
  - 鍵管理アーキテクチャ: KMS（KEK） + Secret Manager（wrapされたDEK）
    - **KEK (Key Encryption Key)**: Google Cloud KMSで管理されるマスター鍵（プロジェクト全体で1つ）
    - **DEK (Data Encryption Key)**: ユーザーごとに生成される32バイトのデータ暗号化鍵
    - **鍵のライフサイクル**:
      1. ユーザー作成時: DEKを生成 → KMSのKEKでwrap（暗号化） → wrapされたDEKをSecret Managerに保存
      2. データ暗号化時: Secret ManagerからwrapされたDEKを取得 → KMSでunwrap（復号） → DEKでデータを暗号化
      3. データ復号時: Secret ManagerからwrapされたDEKを取得 → KMSでunwrap（復号） → DEKでデータを復号
    - **役割分担**:
      - **KMS**: KEKの管理とDEKのwrap/unwrap処理を実行
      - **Secret Manager**: KMSでwrapされたDEK（暗号化されたDEK）を保存（平文のDEKは保存しない）
- **通信**: SSL/TLS 必須（POP3S、SMTP）

## ライセンス

**Private project - All rights reserved**

本プロジェクトはプライベートプロジェクトであり、オープンソースではありません。

⚠️ **重要**: 本リポジトリはGitHub ActionsおよびCI/CDワークフローを有効化するためにのみ公開されています。**ライセンスは一切付与されておらず、このソフトウェアの使用、コピー、修正、配布、販売、その他の利用は一切禁止されています。**

詳細なライセンス条項については [LICENSE.txt](./LICENSE.txt) を必ず確認してください。このリポジトリにアクセスする、閲覧する、またはその他の方法で利用することにより、あなたはライセンス条項に同意したものとみなされます。ライセンス条項に同意できない場合は、直ちにこのソフトウェアへのアクセスを停止してください。

使用許可を希望される場合は、AB-Office に書面でお問い合わせください。

## ドキュメント

- [MVP 仕様書](./docs/SPEC_MVP_FREE.md)
- [Cloud Tasks OIDC セットアップ](./docs/SETUP_CLOUD_TASKS_OIDC.md)
- [Secret Manager KMS セットアップ](./docs/SETUP_SECRET_MANAGER_KMS.md)
