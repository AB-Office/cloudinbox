# Technology Stack

## Architecture

サーバーレスアーキテクチャを採用。Firebase Functionsによるバックエンド処理と、Firestore/Storageによるデータ永続化、Flutterによるクロスプラットフォームクライアントで構成される。

```
外部メール(POP3) → Cloud Functions → Firestore/Storage → Flutterアプリ
```

## Core Technologies

- **Backend Language**: TypeScript
- **Backend Runtime**: Node.js (Firebase Functions)
- **Frontend Framework**: Flutter (Dart)
- **Database**: Firestore (NoSQL)
- **Storage**: Firebase Storage
- **Authentication**: Firebase Auth
- **Infrastructure**: Firebase (Functions, Firestore, Storage, Auth, Scheduler)

## Key Libraries

### Backend (Functions)
- POP3クライアント（メール受信）
- Firebase Admin SDK（Firestore/Storage操作）
- Secret Manager（認証情報管理）

### Frontend (Flutter)
- Firebase SDK（認証、Firestore、Storage）
- Flutter Material Design（UI）

## Development Standards

### Type Safety
- TypeScript strict mode推奨
- Dartの型安全性を活用

### Code Quality
- 関数は単一責任原則に従う
- エラーハンドリングを明示的に実装

### Testing
- Cloud Functions: 単体テストと統合テスト
- Flutter: Widgetテストと統合テスト

## Development Environment

### Required Tools
- Node.js (Firebase Functions用)
- Flutter SDK
- Firebase CLI
- Google Cloud SDK（Secret Manager用）

### Common Commands
```bash
# Functions開発
cd functions && npm run dev

# Flutter開発
cd apps/mobile_app && flutter run

# Firebaseデプロイ
firebase deploy --only functions
```

## Key Technical Decisions

1. **Monorepo構成**: 複数アプリとパッケージを一元管理
   - `apps/`: クライアントアプリ（mobile_app, web_app）
   - `functions/`: Cloud Functions（TypeScript）
   - `packages/`: 共有パッケージ（dart_models等）
   - `infra/`: インフラ設定とスクリプト

2. **Firestoreスキーマ設計**: ユーザー中心の階層構造
   - `users/{uid}`: ユーザープランと使用量
   - `users/{uid}/mailAccounts/{accountId}`: メールアカウント設定
   - `users/{uid}/mailAccounts/{accountId}/messages/{messageId}`: メールデータ
   - `collectionGroup`クエリで全メールを横断検索

3. **Storageパス構造**: ユーザー・アカウント・メッセージ階層
   - `mail/{uid}/{accountId}/{messageId}/body.txt`
   - `mail/{uid}/{accountId}/{messageId}/attachments/{filename}`

4. **容量管理**: プランベースの制限と使用量追跡
   - 受信前に容量チェック
   - 削除時に使用量を減算

---
_Document standards and patterns, not every dependency_

