# Research & Design Decisions Template

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

**Usage**:
- Log research activities and outcomes during the discovery phase.
- Document design decision trade-offs that are too detailed for `design.md`.
- Provide references and evidence for future audits or reuse.
---

## Summary
- **Feature**: `20251209_cloudinbox-mvp-pop3`
- **Discovery Scope**: New Feature
- **Key Findings**:
  - Firebase AuthはGoogle Sign-InとApple Sign-Inをサポートし、Flutter SDKで統合可能
  - Google Cloud Secret ManagerをFirebase Functionsからアクセス可能（Firebase Secret Managerという独立サービスは存在しない）
  - Node.js用POP3クライアントライブラリ（mailparser、node-imap等）が利用可能
  - Firebase Functions v2のonScheduleでCloud Schedulerと統合した定期実行が可能
  - FirestoreのcollectionGroupクエリでユーザー横断検索が実現可能

## Research Log

### Firebase Authentication (Google Sign-In & Apple Sign-In)
- **Context**: 要件1でGoogleアカウント認証と将来のApple Sign-In対応が必要
- **Sources Consulted**: 
  - Firebase Authentication公式ドキュメント
  - Flutter firebase_authパッケージ
- **Findings**: 
  - Firebase AuthはGoogle Sign-In、Apple Sign-Inを含む複数の認証プロバイダーをサポート
  - Flutterでは`firebase_auth`と`google_sign_in`パッケージで統合可能
  - 認証トークンは自動的に管理され、セッション状態を監視可能
  - Apple Sign-Inは将来の拡張として設計に含める必要がある
- **Implications**: 
  - FlutterアプリでFirebase Auth SDKを使用して認証フローを実装
  - 認証状態の監視とリダイレクトロジックが必要
  - Cloud FunctionsではFirebase Admin SDKで認証トークンを検証

### Google Cloud Secret Manager (パスワード暗号化)
- **Context**: 要件2でメールアカウントのパスワードを暗号化して保存する必要がある
- **Sources Consulted**: 
  - Google Cloud Secret Manager公式ドキュメント
  - Firebase Functions v2でのSecret Manager統合
- **Findings**: 
  - Firebase Secret Managerという独立サービスは存在せず、Google Cloud Secret Managerを使用
  - Firebase Functions v2では`runWith({ secrets: ['SECRET_NAME'] })`でシークレットにアクセス可能
  - マスター鍵をSecret Managerに保存し、パスワード暗号化・復号化に使用
  - IAMロール（Secret Manager Secret Accessor）が必要
- **Implications**: 
  - Cloud FunctionsでSecret Managerクライアントライブラリを使用
  - マスター鍵の取得とキャッシュ戦略を考慮
  - 暗号化アルゴリズム（AES-256-GCM等）の選択が必要

### POP3クライアントライブラリ
- **Context**: 要件3でPOP3サーバからメールを受信する必要がある
- **Sources Consulted**: 
  - npmレジストリ（mailparser、node-imap、pop3-client等）
- **Findings**: 
  - `mailparser`はメールパースに特化したライブラリ
  - `node-imap`はIMAP専用でPOP3非対応
  - `pop3-client`や`mailparser`と組み合わせたPOP3実装が一般的
  - TypeScript型定義が利用可能なライブラリを選択すべき
- **Implications**: 
  - POP3接続、認証、メール取得、削除の機能を実装
  - エラーハンドリングとリトライロジックが必要
  - SSL/TLS接続のサポートが必須

### Firebase Cloud Functions (スケジュール実行)
- **Context**: 要件3で15-30分間隔でメール受信を自動実行する必要がある
- **Sources Consulted**: 
  - Firebase Functions v2公式ドキュメント
  - Cloud Scheduler統合
- **Findings**: 
  - Firebase Functions v2の`onSchedule`で定期実行が可能
  - Cloud Schedulerと統合され、cron形式でスケジュール設定
  - タイムゾーン指定とリトライポリシーの設定が可能
- **Implications**: 
  - `functions/src/mail/fetchMails.ts`をonSchedule関数として実装
  - 15-30分間隔のランダム化または固定間隔の選択が必要
  - 実行時間制限（最大540秒）を考慮した設計

### Firestore (データモデルとセキュリティ)
- **Context**: 要件4、5でメールデータをFirestoreに保存し、collectionGroupクエリで取得する必要がある
- **Sources Consulted**: 
  - Firestore公式ドキュメント
  - collectionGroupクエリの制約
- **Findings**: 
  - collectionGroupクエリは複数のサブコレクションを横断検索可能
  - `messages`コレクションに`uid`フィールドが必要（インデックス要件）
  - セキュリティルールでユーザー単位のアクセス制御が可能
  - 階層構造（users/{uid}/mailAccounts/{accountId}/messages/{messageId}）が推奨
- **Implications**: 
  - messagesドキュメントに`uid`フィールドを必須で含める
  - collectionGroupクエリ用の複合インデックスを作成
  - セキュリティルールで`request.auth.uid == resource.data.uid`を検証

### Firebase Storage (ファイル保存)
- **Context**: 要件4でメール本文と添付ファイルをStorageに保存する必要がある
- **Sources Consulted**: 
  - Firebase Storage公式ドキュメント
  - セキュリティルール
- **Findings**: 
  - パス構造`mail/{uid}/{accountId}/{messageId}/`で階層管理
  - セキュリティルールでユーザー単位のアクセス制御が可能
  - ファイルサイズ制限（最大32MB）とメタデータ管理
- **Implications**: 
  - Storageパス構造を要件通りに実装
  - セキュリティルールで`request.auth.uid`を検証
  - ファイルサイズの追跡と使用量計算が必要

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Serverless Functions | Firebase Functionsによるイベント駆動アーキテクチャ | スケーラブル、運用コスト低、自動スケーリング | コールドスタート、実行時間制限 | 既存のsteeringと整合 |
| Domain-Driven Design | ドメイン別ディレクトリ（mail/, users/, shared/） | 責務分離、保守性向上 | 初期実装コスト | steeringのstructure.mdと整合 |

## Design Decisions

### Decision: Google Cloud Secret Managerの使用
- **Context**: メールアカウントのパスワードを安全に暗号化・復号化する必要がある
- **Alternatives Considered**:
  1. 環境変数にマスター鍵を保存 — セキュリティリスクが高い
  2. Firebase Functionsの環境変数 — v2では非推奨、Secret Manager推奨
  3. Google Cloud Secret Manager — 暗号化、バージョン管理、アクセス制御が可能
- **Selected Approach**: Google Cloud Secret Managerを使用し、マスター鍵を保存。Cloud Functionsから`@google-cloud/secret-manager`クライアントライブラリでアクセス
- **Rationale**: Firebase Functions v2の推奨方法であり、セキュリティベストプラクティスに準拠
- **Trade-offs**: 
  - メリット: セキュア、バージョン管理、監査ログ
  - デメリット: 追加のAPI呼び出し（キャッシュで軽減可能）
- **Follow-up**: マスター鍵のローテーション戦略とキャッシュ実装を検討

### Decision: POP3クライアントライブラリの選択
- **Context**: Node.js/TypeScript環境でPOP3プロトコルを実装する必要がある
- **Alternatives Considered**:
  1. 独自実装 — 開発コストが高い、メンテナンス負荷
  2. `node-imap` — IMAP専用でPOP3非対応
  3. `mailparser` + POP3接続ライブラリ — メールパースに特化、柔軟性
  4. `pop3-client` — POP3専用、シンプル
- **Selected Approach**: `mailparser`とPOP3接続ライブラリ（`pop3-client`または`node-pop3`）を組み合わせて使用
- **Rationale**: メールパース機能が充実しており、TypeScript型定義が利用可能
- **Trade-offs**: 
  - メリット: 実績のあるライブラリ、型安全性
  - デメリット: 複数ライブラリの依存関係管理
- **Follow-up**: 実際のライブラリ選定時にパフォーマンスとメンテナンス性を評価

### Decision: Firestore collectionGroupクエリの使用
- **Context**: 複数のメールアカウントのメールを単一の受信トレイで表示する必要がある
- **Alternatives Considered**:
  1. 各アカウントごとにクエリを実行してマージ — クエリ数が増加、パフォーマンス低下
  2. フラットなmessagesコレクション — 階層構造の利点を失う
  3. collectionGroupクエリ — 階層構造を保ちつつ横断検索が可能
- **Selected Approach**: collectionGroup('messages')クエリを使用し、`uid`フィールドでフィルタリング
- **Rationale**: steeringのtech.mdで推奨されているパターンであり、階層構造の利点を維持
- **Trade-offs**: 
  - メリット: 単一クエリ、階層構造の維持
  - デメリット: 複合インデックスの必要、`uid`フィールドの重複
- **Follow-up**: インデックス作成とパフォーマンステストを実施

## Risks & Mitigations
- **Secret Manager API呼び出しのレイテンシ** — マスター鍵をメモリキャッシュし、関数実行中は再利用
- **POP3接続のタイムアウト** — 適切なタイムアウト設定とリトライロジックを実装
- **Firestore collectionGroupクエリのパフォーマンス** — 複合インデックスを作成し、ページネーションを実装
- **Storage使用量の正確な追跡** — トランザクションまたはバッチ処理で使用量を更新
- **スケジュール実行の重複** — Cloud Schedulerの設定で重複実行を防止

## References
- [Firebase Authentication](https://firebase.google.com/docs/auth) — 認証実装の参考
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs) — シークレット管理
- [Firebase Functions v2](https://firebase.google.com/docs/functions) — スケジュール実行
- [Firestore collectionGroup](https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query) — 横断検索
- [Firebase Storage Security Rules](https://firebase.google.com/docs/storage/security) — アクセス制御

