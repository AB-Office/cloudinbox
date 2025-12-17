# Implementation Tasks

## Overview

本ドキュメントは、CloudInbox MVP - POP3メール受信とクラウド保存機能の実装タスクを定義します。要件（requirements.md）と設計（design.md）に基づき、実装可能な単位に分解しています。

**実装順序**: 依存関係を考慮し、バックエンド基盤 → 認証 → メール受信 → フロントエンドの順で実装します。

## Task Categories

### 1. プロジェクトセットアップと基盤構築

#### - [x] 1.1: プロジェクト構造の初期化
- **目的**: Monorepo構成とディレクトリ構造を確立
- **作業内容**:
  - `functions/`ディレクトリの作成とTypeScript設定
  - `apps/mobile_app/`ディレクトリの作成とFlutter設定
  - `packages/dart_models/`ディレクトリの作成
  - `infra/`ディレクトリの作成（Firebase設定、セキュリティルール）
- **成果物**: プロジェクト構造、package.json、pubspec.yaml
- **依存関係**: なし
- **見積もり**: 2時間

#### - [x] 1.2: Firebase プロジェクトの初期化
- **目的**: Firebase CLIとプロジェクト設定を準備
- **作業内容**:
  - Firebase CLIのインストール確認
  - `firebase.json`の作成
  - `.firebaserc`の設定
  - Firebase Functions v2の設定
- **成果物**: firebase.json、.firebaserc
- **依存関係**: T1.1
- **見積もり**: 1時間

#### - [x] 1.3: 依存パッケージのインストール（Backend）
- **目的**: Cloud Functionsに必要なパッケージをインストール
- **作業内容**:
  - Firebase Admin SDK
  - @google-cloud/secret-manager
  - @google-cloud/kms
  - POP3Sクライアントライブラリ（mailparser、pop3-client等、SSL/TLS必須）
  - Google AdMob SDK（`google_mobile_ads`パッケージ）
  - 暗号化ライブラリ（crypto、@noble/ciphers等）
  - TypeScript型定義
- **成果物**: functions/package.json
- **依存関係**: T1.1, T1.2
- **見積もり**: 1時間

#### - [x] 1.4: 依存パッケージのインストール（Frontend）
- **目的**: Flutterアプリに必要なパッケージをインストール
- **作業内容**:
  - firebase_auth
  - google_sign_in
  - cloud_firestore
  - firebase_storage
  - cloud_functions
  - intl
  - flutter_localizations
- **成果物**: apps/mobile_app/pubspec.yaml
- **依存関係**: T1.1
- **見積もり**: 1時間

#### - [x] 1.5: 国際化（i18n）基盤構築
- **目的**: Flutterアプリの国際化リソース管理機能を実装
- **作業内容**:
  - `apps/mobile_app/lib/l10n/`ディレクトリの作成
  - `app_ja.arb`（日本語リソース）の作成
  - `app_en.arb`（英語リソース）の作成
  - `l10n.yaml`の設定
  - `pubspec.yaml`に`flutter_localizations`の設定追加
  - `main.dart`で`MaterialApp`に`localizationsDelegates`と`supportedLocales`を設定
  - I18nServiceクラスの作成（`lib/services/i18n_service.dart`）
  - 日付・時刻・数値フォーマット用のユーティリティ関数
- **成果物**: 
  - apps/mobile_app/lib/l10n/app_ja.arb
  - apps/mobile_app/lib/l10n/app_en.arb
  - apps/mobile_app/lib/l10n/l10n.yaml
  - apps/mobile_app/lib/services/i18n_service.dart
- **依存関係**: T1.4
- **要件カバー**: 8.1-8.10
- **見積もり**: 3時間

### 2. バックエンド実装（Cloud Functions）

#### - [x] 2.1: 暗号化基盤 - EncryptionService
- **目的**: Google Cloud KMSとDEKを使用したデータ暗号化・復号化機能を実装
- **作業内容**:
  - `functions/src/encryption/`ディレクトリの作成
  - `functions/src/encryption/kms.ts`: KMS操作（wrap/unwrap）
  - `functions/src/encryption/keys.ts`: DEK生成・管理
  - `functions/src/encryption/encrypt.ts`: 暗号化処理（AES-256-GCM）
  - `functions/src/encryption/decrypt.ts`: 復号処理
  - `functions/src/encryption/index.ts`: EncryptionServiceのエクスポート
  - ユーザーごとのDEK生成機能（`createDataKeyForUser()`）
  - DEKのKMS wrap/unwrap機能
  - Secret ManagerへのDEK保存・取得機能
  - AES-256-GCMによる暗号化・復号化（nonce 12bytes、tag含む）
  - 暗号化結果の形式化（`{ciphertext, nonce, tag}`）
  - DEKのメモリキャッシュ実装
- **成果物**: 
  - functions/src/encryption/kms.ts
  - functions/src/encryption/keys.ts
  - functions/src/encryption/encrypt.ts
  - functions/src/encryption/decrypt.ts
  - functions/src/encryption/index.ts
- **依存関係**: T1.3, T4.6
- **要件カバー**: 2.7-2.9, 2.11-2.12, 9.1-9.14
- **見積もり**: 8時間

#### - [x] 2.2: 共有サービス - PlanValidator
- **目的**: プラン制限チェック機能を実装
- **作業内容**:
  - `functions/src/shared/planValidator.ts`の作成
  - `canAddAccount()`: アカウント数上限チェック
  - `canStoreMail()`: ストレージ容量上限チェック
  - Firestoreからプラン情報と使用量を取得
- **成果物**: functions/src/shared/planValidator.ts
- **依存関係**: T1.3
- **要件カバー**: 2.3, 3.4, 7.3-7.4
- **見積もり**: 3時間

#### - [x] 2.3: ユーザー初期化 - onUserCreate
- **目的**: Firebase Authでユーザー作成時にFreeプラン設定とDEKを自動生成
- **作業内容**:
  - `functions/src/users/onUserCreate.ts`の作成
  - Firebase Authトリガー（`auth.user().onCreate()`）の実装
  - `users/{uid}`ドキュメントの作成
  - Freeプラン設定（`plan.id: "free"`, `plan.maxStorageBytes: 2147483648`, `plan.maxAccounts: 1`）の注入
  - 使用量初期化（`usage.storageBytes: 0`, `usage.updatedAt`）
  - EncryptionServiceを使用してユーザー専用DEKを生成・保存
  - トランザクションで一貫性保証
- **成果物**: functions/src/users/onUserCreate.ts
- **依存関係**: T2.1
- **要件カバー**: 1.14-1.17, 9.3
- **見積もり**: 4時間

#### - [x] 2.4: POP3S接続テスト - accountTest
- **目的**: メールアカウント設定時のPOP3S接続テスト機能（SSL/TLS必須）
- **作業内容**:
  - `functions/src/mail/accountTest.ts`の作成
  - HTTP Callable Functionとして実装
  - アカウント作成前の接続テスト: 平文パスワードを受け取り、POP3Sサーバへ接続テストを実行（接続テスト後は即座に破棄）
  - 既存アカウントの接続テスト: EncryptionServiceを使用してパスワード復号化
  - `useSsl: true`の必須チェック（非暗号化接続を拒否）
  - POP3SサーバへのSSL/TLS接続・認証テスト
  - エラーハンドリングとタイムアウト設定
  - SSL/TLS証明書エラーの適切な処理
  - 結果を返却（成功/失敗、エラーメッセージ）
  - セキュリティ: 平文パスワードは接続テスト後すぐに破棄し、永続化しない
- **成果物**: functions/src/mail/accountTest.ts
- **依存関係**: T2.1, T1.3
- **要件カバー**: 2.6-2.11, 2.14-2.15
- **見積もり**: 5時間

#### - [x] 2.5: メール自動受信 - fetchMails（基本構造）
- **目的**: 定期実行によるメール受信機能の基本構造
- **作業内容**:
  - `functions/src/mail/fetchMails.ts`の作成
  - `onSchedule`関数として実装（Cloud Scheduler統合）
  - アクティブなメールアカウントの取得ロジック
  - 各アカウントの走査ループ
- **成果物**: functions/src/mail/fetchMails.ts（基本構造）
- **依存関係**: T1.3
- **要件カバー**: 3.1
- **見積もり**: 2時間

#### - [x] 2.6: メール自動受信 - fetchMails（POP3S接続とメール取得）
- **目的**: POP3Sサーバからのメール取得機能（SSL/TLS必須）
- **作業内容**:
  - `useSsl: true`の必須チェック（非暗号化接続を拒否）
  - POP3S接続・認証の実装（SSL/TLS）
  - EncryptionServiceを使用してパスワード復号化
  - メール一覧取得とメール本文取得
  - メールパース（mailparser使用）
  - SSL/TLS証明書エラーの適切な処理
  - エラーハンドリングとアカウント状態更新（`status: "error"`）
- **成果物**: functions/src/mail/fetchMails.ts（POP3S接続部分）
- **依存関係**: T2.1, T2.5
- **要件カバー**: 3.2, 3.6
- **見積もり**: 5時間

#### - [x] 2.7: メール自動受信 - fetchMails（MIMEパースと保存ロジック）
- **目的**: MIMEパース、bodyPreview生成、サイズ判定、保存先分岐
- **作業内容**:
  - mailparserを使用したMIMEパース
  - bodyPreview生成（本文の冒頭テキスト）
  - スレッドID生成ロジック
  - 本文サイズ判定（Firestoreの1MiB制限を考慮）
  - 小さい本文はFirestore、大きい本文はStorageに保存する分岐処理
  - Storageパスユーティリティの実装（`getRawMimePath`, `getBodyHtmlPath`, `getAttachmentsBasePath`）
  - Firestore型定義の作成（`MailThreadDoc`, `MailMessageDoc`）
- **成果物**: 
  - functions/src/mail/fetchMails.ts（MIMEパース部分）
  - functions/src/mail/storagePaths.ts
  - functions/src/mail/types.ts
- **依存関係**: T2.6
- **要件カバー**: 4.1-4.3
- **見積もり**: 4時間

#### - [x] 2.8: メール自動受信 - fetchMails（暗号化保存）
- **目的**: メールの暗号化保存とmailThreads/mailMessages更新
- **作業内容**:
  - PlanValidatorを使用した容量チェック
  - メールサイズの推定（暗号化後のサイズを考慮）
  - 容量超過時の受信停止ロジック
  - EncryptionServiceを使用してMIME原本を暗号化し、Storageに保存（`raw.eml.enc`）
  - 小さい本文をEncryptionServiceで暗号化し、Firestoreの`bodyTextEncrypted`に保存
  - 大きい本文をEncryptionServiceで暗号化し、Storageに保存（`body.html.enc`）
  - 添付ファイルをEncryptionServiceで暗号化し、Storageに保存（`attachments/{filename}.enc`）
  - mailThreadsの作成・更新（`latestMessageId`, `preview`, `hasUnread`等）
  - mailMessagesの作成（メタデータ、bodyPreview、storageパス情報）
  - 使用量更新（`usage.storageBytes`、暗号化後のサイズを計算）
  - POP3Sサーバからのメール削除（`deleteAfterFetch: true`の場合）
  - 暗号化前データの即座な破棄（メモリから削除）
- **成果物**: functions/src/mail/fetchMails.ts（保存部分）
- **依存関係**: T2.1, T2.2, T2.7
- **要件カバー**: 3.3-3.5, 3.7-3.8, 4.4-4.15, 7.1-7.2, 7.4-7.5, 9.11-9.13, 12.1-12.9
- **見積もり**: 10時間

#### - [x] 2.9: メールゴミ箱移動 - moveToTrash（Flutter側で実装）
- **目的**: メールをゴミ箱に移動する機能（仕様によりFlutter側で実装）
- **作業内容**:
  - Flutter側でFirestoreを直接更新するように実装（T3.5で実装）
  - Flutter側でメールのラベルに`trash`を追加する（`inbox`ラベルは削除しない）
  - Flutter側でメールスレッドのラベルにも`trash`を追加する（`inbox`ラベルは削除しない）
  - Flutter側でゴミ箱移動日時（`deletedAt`）を記録
  - 使用量は変更しない（ゴミ箱内でも容量を使用）
  - Flutter側でトランザクションまたはバッチ更新で一貫性保証
- **成果物**: Flutter側で実装（T3.5参照）
- **依存関係**: T3.5（Flutter側で実装）
- **要件カバー**: 6.1-6.4
- **見積もり**: Flutter側タスクに統合

#### - [x] 2.10: ゴミ箱から復元 - restoreFromTrash（Flutter側で実装）
- **目的**: ゴミ箱からメールを復元する機能（仕様によりFlutter側で実装）
- **作業内容**:
  - Flutter側でFirestoreを直接更新するように実装（T3.5で実装）
  - Flutter側でメールのラベルから`trash`ラベルを削除する（`inbox`ラベルは追加・削除しない、元の状態を保持）
  - Flutter側でメールスレッドのラベルからも`trash`ラベルを削除する（`inbox`ラベルは追加・削除しない、元の状態を保持）
  - Flutter側で`deletedAt`フィールドを削除
  - Flutter側でトランザクションまたはバッチ更新で一貫性保証
- **成果物**: Flutter側で実装（T3.5参照）
- **依存関係**: T3.5（Flutter側で実装）
- **要件カバー**: 6.5-6.6
- **見積もり**: Flutter側タスクに統合

#### - [x] 2.11: ゴミ箱完全削除 - purgeTrash
- **目的**: ゴミ箱に入ってから30日が経過したメールを完全削除する機能
- **作業内容**:
  - `functions/src/mail/purgeTrash.ts`の作成
  - `onSchedule`関数として実装（Cloud Scheduler統合、1日1回推奨）
  - `deletedAt`が30日以上前のメールを検索（`labels`に`trash`を含む）
  - FirestoreからmailMessageドキュメントを削除
  - StorageからMIME原本（`raw.eml.enc`）、大きい本文（`body.html.enc`）、添付ファイル（`attachments/*.enc`）を削除
  - スレッド内のすべてのメールが削除された場合、mailThreadも削除
  - 削除されたファイルサイズの計算（Firestoreの暗号化データとStorageファイルの両方）
  - 使用量から削除サイズを減算（`usage.storageBytes`）
  - 使用量更新日時の更新（`usage.updatedAt`）
  - バッチ処理で一貫性保証
- **成果物**: functions/src/mail/purgeTrash.ts
- **依存関係**: T1.3
- **要件カバー**: 6.7-6.11, 7.7
- **見積もり**: 4時間

#### - [x] 2.12: メールアーカイブ - archiveMail（Flutter側で実装）
- **目的**: メールをアーカイブする機能（仕様によりFlutter側で実装）
- **作業内容**:
  - Flutter側でFirestoreを直接更新するように実装（T3.5で実装）
  - Flutter側でメールのラベルから`inbox`を削除する（`archive`ラベルは追加しない）
  - Flutter側でメールスレッドのラベルからも`inbox`を削除する（`archive`ラベルは追加しない）
  - 使用量は変更しない
  - Flutter側でトランザクションまたはバッチ更新で一貫性保証
- **成果物**: Flutter側で実装（T3.5参照）
- **依存関係**: T3.5（Flutter側で実装）
- **要件カバー**: 10.1-10.3
- **見積もり**: Flutter側タスクに統合

#### - [x] 2.13: アーカイブから復元 - unarchiveMail（Flutter側で実装）
- **目的**: アーカイブからメールを復元する機能（仕様によりFlutter側で実装）
- **作業内容**:
  - Flutter側でFirestoreを直接更新するように実装（T3.5で実装）
  - Flutter側でメールのラベルに`inbox`を追加する（`archive`ラベルは存在しないため削除不要）
  - Flutter側でメールスレッドのラベルにも`inbox`を追加する
  - Flutter側でトランザクションまたはバッチ更新で一貫性保証
- **成果物**: Flutter側で実装（T3.5参照）
- **依存関係**: T3.5（Flutter側で実装）
- **要件カバー**: 10.4-10.5
- **見積もり**: Flutter側タスクに統合

#### - [x] 2.14: メール本文復号 - decryptMail
- **目的**: 暗号化されたメール本文を復号してクライアントに返す
- **作業内容**:
  - `functions/src/mail/decryptMail.ts`の作成
  - HTTP Callable Functionとして実装
  - FirestoreからmailMessageを取得
  - `hasLargeBody`に応じてFirestoreまたはStorageから暗号化データを取得
  - EncryptionServiceを使用して復号処理
  - 復号済みデータのみクライアントに返却
  - 認証済みユーザーのみアクセス可能
  - エラーハンドリング（復号失敗時の処理）
- **成果物**: functions/src/mail/decryptMail.ts
- **依存関係**: T2.1, T2.7
- **要件カバー**: 5.7-5.9, 9.12-9.13
- **見積もり**: 4時間

#### - [x] 2.15: メールスレッド一覧取得 - getMailThreads（Flutter側でFirestoreを直接クエリして実装：T3.3, T3.9, T3.10）
- **目的**: メールスレッド一覧を取得するAPI（仕様によりFlutter側で実装）
- **作業内容**:
  - `functions/src/mail/getMailThreads.ts`の作成（オプション）
  - HTTP Callable Functionとして実装
  - Firestoreの`users/{uid}/mailThreads`をクエリ
  - ページング、ラベルフィルタ、未読フィルタをサポート
  - 認証済みユーザーのみアクセス可能
- **成果物**: functions/src/mail/getMailThreads.ts（オプション）
- **依存関係**: T1.3
- **要件カバー**: 5.1-5.4
- **見積もり**: 2時間（オプション）

#### - [x] 2.16: メール詳細取得 - getMailMessage（Flutter側でFirestoreを直接クエリして実装：T3.4）
- **目的**: メールメッセージの詳細情報を取得するAPI（仕様によりFlutter側で実装）
- **作業内容**:
  - `functions/src/mail/getMailMessage.ts`の作成（オプション）
  - HTTP Callable Functionとして実装
  - Firestoreの`users/{uid}/mailMessages/{messageId}`から取得
  - メタデータ、bodyPreview、storageパス情報を返却
  - 認証済みユーザーのみアクセス可能
- **成果物**: functions/src/mail/getMailMessage.ts（オプション）
- **依存関係**: T1.3
- **要件カバー**: 5.6, 5.10
- **見積もり**: 1時間（オプション）

### 3. フロントエンド実装（Flutter）

#### - [x] 3.1: 認証画面 - AuthScreen
- **目的**: Firebase AuthによるGoogleアカウント認証画面
- **作業内容**:
  - `apps/mobile_app/lib/screens/auth_screen.dart`の作成
  - Google Sign-Inボタンの実装
  - Firebase Auth SDKの統合
  - 認証状態の監視（StreamBuilder）
  - 認証成功時のホーム画面遷移
  - エラーハンドリングとユーザーフィードバック
  - 認証セッションの自動復元
  - 国際化対応（I18nServiceを使用した文字列取得）
- **成果物**: apps/mobile_app/lib/screens/auth_screen.dart
- **依存関係**: T1.5
- **要件カバー**: 1.1-1.13, 8.1-8.10
- **見積もり**: 5時間

#### - [x] 3.2: メールアカウント設定画面 - AccountScreen
- **目的**: メールアカウント情報の入力、接続テストによる確認、アカウント作成
- **作業内容**:
  - `apps/mobile_app/lib/screens/account_screen.dart`の作成
  - メールアカウント情報入力フォーム（ラベル、メールアドレス、POP3S/SMTP設定、SSL/TLS必須）
  - パスワード入力フィールド（暗号化はバックエンドで実行）
  - 「接続テスト」または「確認」ボタンの実装
  - 接続テスト実行中のローディング表示
  - 接続テスト結果の表示（成功/失敗、エラーメッセージ）
  - 接続テスト成功時にアカウント作成ボタンを有効化（または、接続テスト成功後にアカウント作成を実行可能にする）
  - PlanValidatorを使用したアカウント数上限チェック（UI側）
  - accountTest Function呼び出し（POP3S接続テスト、SSL/TLS必須、アカウント作成前の平文パスワード対応）
  - Firestoreへのアカウント保存（接続テスト成功後）
  - エラーハンドリングと成功メッセージ
  - 国際化対応（フォームラベル、バリデーションメッセージ、成功/エラーメッセージ、ボタンラベル）
- **成果物**: apps/mobile_app/lib/screens/account_screen.dart
- **依存関係**: T1.5, T2.4
- **要件カバー**: 2.1-2.3, 2.6-2.11, 8.1-8.10
- **見積もり**: 8時間

#### - [x] 3.3: メール一覧共通画面 - MailListScreen
- **目的**: 受信トレイ／ゴミ箱／すべてのメールで共通利用できるメールスレッド一覧表示（ページネーション対応）の実装
- **作業内容**:
  - `apps/mobile_app/lib/screens/mail_list_screen.dart`を「メール一覧共通画面（MailListScreen）」として実装
  - Firestoreの`users/{uid}/mailThreads`コレクションをクエリし、ラベル条件や並び順をパラメータで切り替え可能な抽象リポジトリを利用
  - `lastMessageAt`降順ソート、件名／送信者／プレビュー／日時／未読状態／ラベルの表示
  - ページネーション実装（受信トレイ・ゴミ箱・すべてのメールで共通利用）:
    - 画面サイズ（MediaQuery）と1アイテムの高さから表示可能件数を計算（画面高さ ÷ アイテム高さ + 余裕分3-5件）
    - 最小値・最大値の制約を適用（最小10件、最大50件程度）
    - 初期表示で計算された件数を取得（`limit(calculatedLimit)`）
    - ScrollController等を用いて末尾付近で追加読み込みをトリガー
    - `startAfter()`相当の情報を用いて次ページを取得し、取得件数が`limit`未満の場合は`hasMore: false`とする
  - リアルタイム更新（既存アイテムの更新のみ監視）とローディング／エラー表示
  - 国際化対応（画面タイトル、空状態メッセージ、ローディングメッセージ、日時フォーマット）
  - Storageアクセスは発生させない（Firestoreのみで一覧表示）
- **成果物**: apps/mobile_app/lib/screens/mail_list_screen.dart（共通メール一覧画面として）
- **依存関係**: T1.5
- **要件カバー**: 5.1-5.8, 8.1-8.10
- **見積もり**: 7時間（ページネーション実装により2時間増加）

#### - [x] 3.8: 受信トレイ画面 - Inbox（MailListScreen フィルタ設定）
- **目的**: MailListScreen を用いて、受信トレイ（`labels` に `inbox` を含み、`trash` を含まないスレッド）を表示するためのフィルタ定義とルーティング設定を実装
- **作業内容**:
  - 受信トレイ用フィルタ条件（`labels` に `inbox` を含み、`trash` を含まない）で `MailListScreen` を呼び出す設定を実装
  - `MailListScreen` に受信トレイ用タイトル（例: 'Inbox' または I18n の「受信トレイ」）を指定して表示できることを確認
  - メールスレッド一覧表示とページネーションは MailListScreen のロジックをそのまま利用
  - 国際化対応（画面タイトル、メッセージ文言）
  - テストで受信トレイ用フィルタで `MailListScreen` を呼び出せることを検証
- **成果物**:
  - 受信トレイ用フィルタ条件の定義とルーティング設定
  - テストコード（`test/inbox_screen_test.dart` に受信トレイ用フィルタのテスト追加）
- **依存関係**: T1.5, T3.3
- **要件カバー**: 5.1-5.8, 8.1-8.10, 12.1-12.9
- **見積もり**: 2時間

#### - [x] 3.4: メール詳細画面 - DetailScreen
- **目的**: 個別メールの詳細表示
- **作業内容**:
  - `apps/mobile_app/lib/screens/detail_screen.dart`の作成
  - FirestoreからmailMessageを直接取得（getMailMessage Functionは使用しない）
  - メールメタデータの表示（件名、送信者、受信者、日時、プレビュー）
  - decryptMail Function呼び出しで暗号化されたメール本文を復号して表示（hasLargeBodyに応じてFirestoreまたはStorageから取得）
  - HTML本文のレンダリング（flutter_html等のパッケージ検討）
  - Storageパス情報から添付ファイル一覧を取得・表示
  - メールを開いた際の未読状態更新をFlutter側でFirestoreを直接更新（mailMessageの`isRead: true`、mailThreadの`hasUnread`を計算して更新）
  - ローディング状態とエラーハンドリング
  - 国際化対応（添付ファイルラベル、日時フォーマット、エラーメッセージ）
  - 復号済みデータのキャッシュなし（セキュリティ要件）
- **成果物**: apps/mobile_app/lib/screens/detail_screen.dart
- **依存関係**: T1.5, T2.14, T3.3
- **要件カバー**: 5.5-5.12, 8.1-8.10
- **見積もり**: 6時間

#### - [x] 3.5: メールゴミ箱・アーカイブ機能（Flutter側でFirestore直接更新）
- **目的**: DetailScreenまたはInboxScreenからメールをゴミ箱に移動、アーカイブ、復元（仕様変更によりFlutter側で実装）
- **作業内容**:
  - メール削除ボタンの実装（Flutter側でFirestoreを直接更新：mailMessageとmailThreadの`labels`に`trash`を追加（`inbox`ラベルは削除しない）、`deletedAt`を設定）
  - メールアーカイブボタンの実装（Flutter側でFirestoreを直接更新：mailMessageとmailThreadの`labels`から`inbox`を削除）
  - ゴミ箱から復元ボタンの実装（Flutter側でFirestoreを直接更新：mailMessageとmailThreadの`labels`から`trash`を削除する（`inbox`ラベルは追加・削除しない、元の状態を保持）、`deletedAt`を削除）
  - アーカイブから復元ボタンの実装（Flutter側でFirestoreを直接更新：mailMessageとmailThreadの`labels`に`inbox`を追加）
  - Firestoreバッチ更新またはトランザクションでmailMessageとmailThreadの一貫性を保証
  - 削除確認ダイアログ
  - 操作成功後のUI更新（リアルタイム更新により自動反映）
  - エラーハンドリング
  - 国際化対応（削除ボタン、アーカイブボタン、確認ダイアログ、成功/エラーメッセージ）
- **成果物**: 
  - apps/mobile_app/lib/screens/detail_screen.dart（ゴミ箱・アーカイブ機能追加）
  - apps/mobile_app/lib/screens/inbox_screen.dart（必要に応じて機能追加）
- **依存関係**: T1.5, T3.4
- **要件カバー**: 6.1-6.6, 10.1-10.5, 8.1-8.10
- **見積もり**: 6時間（Functions実装からFlutter側実装に変更により増加）

#### - [x] 3.6: 広告表示機能 - AdService
- **目的**: Freeプランユーザーの画面下部に広告を表示
- **作業内容**:
  - `apps/mobile_app/lib/services/ad_service.dart`の作成
  - Google AdMob SDKの統合（`google_mobile_ads`パッケージ）
  - プラン情報（`plan.id`）を確認し、Freeプランの場合のみ広告を表示
  - バナー広告ウィジェットの実装
  - 広告読み込み失敗時の処理（広告エリアを非表示）
  - 広告の初期化と破棄処理
  - 認証画面には広告を表示しない
- **成果物**: apps/mobile_app/lib/services/ad_service.dart
- **依存関係**: T1.4
- **要件カバー**: 12.1-12.9
- **見積もり**: 4時間

#### - [x] 3.7: 広告表示のUI統合
- **目的**: 各主要画面に広告を統合
- **作業内容**:
  - InboxScreenに広告表示を追加（画面下部）
  - DetailScreenに広告表示を追加（画面下部）
  - AccountScreenに広告表示を追加（画面下部）
  - SettingsScreenに広告表示を追加（画面下部）
  - 広告がコンテンツを隠さないようにレイアウト調整
  - 広告読み込み中の状態表示（オプション）
  - 国際化対応（必要に応じて）
- **成果物**: 
  - apps/mobile_app/lib/screens/inbox_screen.dart（広告追加）
  - apps/mobile_app/lib/screens/detail_screen.dart（広告追加）
  - apps/mobile_app/lib/screens/account_screen.dart（広告追加）
  - apps/mobile_app/lib/screens/settings_screen.dart（広告追加）
- **依存関係**: T3.6
- **要件カバー**: 12.1-12.9
- **見積もり**: 3時間

#### - [x] 3.9: ゴミ箱画面 - ゴミ箱用フィルタとルーティング設定
- **目的**: MailListScreen を用いて、ゴミ箱内のメール一覧（`labels` に `trash` を含むスレッド）を表示するためのフィルタ条件とルーティング設定を実装
- **作業内容**:
  - ゴミ箱用フィルタ条件（`labels` に `trash` を含む）で `MailListScreen` を呼び出す設定を実装
  - `MailListScreen` に `title: 'Trash'` を指定してゴミ箱画面として表示できることを確認
  - メールスレッド一覧表示とページネーションは MailListScreen のロジックをそのまま利用
  - 国際化対応（画面タイトル、メッセージ文言）
  - テストでゴミ箱用フィルタで `MailListScreen` を呼び出せることを検証
- **成果物**: 
  - ゴミ箱用フィルタ条件の定義とルーティング設定
  - テストコード（`test/inbox_screen_test.dart` にゴミ箱用フィルタのテスト追加）
- **依存関係**: T1.5, T3.3
- **要件カバー**: 5.5, 6.5-6.6（UI部分）, 8.1-8.10
- **見積もり**: 2時間（ラッパー画面不要により削減）

#### - [x] 3.10: すべてのメール一覧画面 - All mail（MailListScreen フィルタ設定）
- **目的**: 共通メール一覧画面（MailListScreen）を用いて、すべてのメールスレッド一覧を表示するためのフィルタ定義とルーティング設定を実装
- **作業内容**:
  - 「すべてのメール」用フィルタ条件（ラベルによるフィルタリングなし）で `MailListScreen` を呼び出す設定を実装
  - `MailListScreen` に「すべてのメール」用タイトル（例: 'All mail' または I18n の「すべてのメール」）を指定して表示できることを確認
  - メールスレッド一覧表示とページネーションは MailListScreen のロジックをそのまま利用
  - 必要に応じて操作UIを追加
  - 国際化対応（画面タイトル、ボタンラベル等）
  - テストで「すべてのメール」用フィルタで `MailListScreen` を呼び出せることを検証
- **成果物**:
  - 「すべてのメール」用フィルタ条件の定義とルーティング設定
  - テストコード（`test/inbox_screen_test.dart` に「すべてのメール」用フィルタのテスト追加）
- **依存関係**: T1.5, T3.3
- **要件カバー**: 10.6-10.7（UI部分）, 8.1-8.10
- **見積もり**: 2時間（ラッパー画面不要により削減）

#### - [x] 3.12: 設定画面 - SettingsScreen（メニュー）
- **目的**: メールアカウント設定・ログアウト操作の入口を提供
- **作業内容**:
  - `apps/mobile_app/lib/screens/settings_screen.dart`の作成
  - 画面本体に「メールアカウント設定」「ログアウト」の2つのメニュー項目を一覧表示
  - 「メールアカウント設定」タップ時に AccountScreen へ遷移する処理を実装
  - 「ログアウト」タップ時に Firebase Auth のサインアウトを実行し、AuthScreen へ遷移する処理を実装
  - エラーハンドリング
  - 国際化対応（メニューラベル等）
- **成果物**: apps/mobile_app/lib/screens/settings_screen.dart
- **依存関係**: T1.5, T3.1, T3.2
- **要件カバー**: 5.1-5.12, 8.1-8.10, 12.1-12.9
- **見積もり**: 3時間

#### - [x] 3.13: ナビゲーションドロワー実装 - NavigationDrawer
- **目的**: ハンバーガーメニューから受信トレイ／すべてのメール／ゴミ箱／設定へ遷移し、ドロワー下部にプラン情報と使用量を表示できるようにする
- **作業内容**:
  - メインの`Scaffold`に`Drawer`（または`NavigationDrawer`）を追加し、以下のメニュー項目をアイコン付きで実装
    - 受信トレイ
    - すべてのメール
    - ゴミ箱
    - 設定
  - 各メニュー項目タップ時に対応する画面へ遷移するロジックを実装
    - 受信トレイ: MailListScreen に受信トレイ用フィルタ（`labels`に`inbox`を含み、`trash`を含まない）を渡して表示
    - すべてのメール: MailListScreen にフィルタなしで表示
    - ゴミ箱: MailListScreen に`labels`に`trash`を含むフィルタを渡して表示
    - 設定: SettingsScreen へ遷移
  - ドロワーの一番下に現在のプラン情報（`plan.label`）と使用量（`usage.storageBytes`）および残り使用可能量を表示
  - 国際化対応（メニューラベル、プラン情報・容量表示、数値フォーマット）
  - Widgetテストでドロワーに各メニューが表示され、タップ時に対応する画面へ遷移することを検証
- **成果物**:
  - ナビゲーションドロワー実装（メイン画面の`Scaffold`周り）
  - テストコード（ナビゲーションおよび表示内容のWidgetテスト）
- **依存関係**: T1.5, T3.1, T3.3, T3.8, T3.9, T3.10, T3.12
- **要件カバー**: 5.1-5.12, 7.8, 8.1-8.10, 12.1-12.9
- **見積もり**: 5時間

### 4. インフラ・設定

#### - [x] 4.1: Firestore セキュリティルール
- **目的**: ユーザー単位のアクセス制御
- **作業内容**:
  - `infra/firebase/firestore.rules`の作成
  - `users/{uid}`: 認証ユーザーのみ読み書き可能
  - `mailAccounts/{accountId}`: 認証ユーザーのみ読み書き可能
  - `messages/{messageId}`: collectionGroupクエリ用に`uid`フィールドで検証
  - `request.auth.uid == resource.data.uid`の検証
- **成果物**: infra/firebase/firestore.rules
- **依存関係**: T1.2
- **要件カバー**: 1.12, 5.1
- **見積もり**: 2時間

#### - [x] 4.2: Storage セキュリティルール
- **目的**: ユーザー単位のファイルアクセス制御
- **作業内容**:
  - `infra/firebase/storage.rules`の作成
  - `mail/{uid}/{accountId}/{messageId}/**`パスのアクセス制御
  - `request.auth.uid == request.resource.name.split('/')[1]`の検証
  - 読み取り・書き込み・削除権限の設定
- **成果物**: infra/firebase/storage.rules
- **依存関係**: T1.2
- **要件カバー**: 1.12
- **見積もり**: 2時間

#### - [x] 4.3: Firestore インデックス定義
- **目的**: メールスレッド・メッセージクエリのパフォーマンス最適化
- **作業内容**:
  - `infra/firebase/firestore.indexes.json`の作成
  - `mailThreads`: `uid` (ascending), `lastMessageAt` (descending) の複合インデックス
  - `mailThreads`: `uid` (ascending), `labels` (array-contains), `lastMessageAt` (descending) の複合インデックス（ラベルフィルタ用）
  - `mailMessages`: `uid` (ascending), `threadId` (ascending), `receivedAt` (descending) の複合インデックス
  - `mailMessages`: `uid` (ascending), `labels` (array-contains), `deletedAt` (ascending) の複合インデックス（ゴミ箱完全削除用）
  - Firebase Consoleでインデックス作成確認
- **成果物**: infra/firebase/firestore.indexes.json
- **依存関係**: T1.2
- **要件カバー**: 5.1-5.2, 6.7
- **見積もり**: 2時間

#### - [x] 4.4: Cloud Scheduler 設定
- **目的**: 定期メール受信とゴミ箱完全削除のスケジュール設定
- **作業内容**:
  - Cloud Schedulerジョブの作成（cron形式、15-30分間隔）
  - fetchMails Functionへのトリガー設定
  - purgeTrash Functionへのトリガー設定（1日1回推奨）
  - タイムゾーン設定
  - リトライポリシーの設定
- **成果物**: Cloud Schedulerジョブ設定（firebase.jsonまたは手動設定）
- **依存関係**: T2.5, T2.11
- **要件カバー**: 3.1, 6.7
- **見積もり**: 2時間

#### - [x] 4.5: Google Cloud KMS 設定
- **目的**: 暗号化基盤のKMS鍵リングと鍵の作成
- **作業内容**:
  - Google Cloud ConsoleでKMS鍵リング（Key Ring）を作成
  - KEK（Key Encryption Key）の作成（AES-256）
  - Cloud FunctionsのIAMロール設定（Cloud KMS CryptoKey Encrypter/Decrypter）
  - KMS APIの有効化確認
  - 鍵の場所と名前の設定（環境変数または設定ファイル）
- **成果物**: KMS鍵リング、KEK、IAMロール設定
- **依存関係**: T1.2
- **要件カバー**: 9.1-9.2
- **見積もり**: 2時間

#### - [x] 4.6: Secret Manager 設定（DEK保存用）
- **目的**: DEK（Data Encryption Key）の保存先としてSecret Managerを設定
- **作業内容**:
  - Cloud FunctionsのIAMロール設定（Secret Manager Secret Accessor）
  - Secret Managerのシークレット命名規則の定義（`dek-{uid}`等）
  - Firebase Functions v2の`runWith({ secrets: [] })`設定（必要に応じて）
- **成果物**: IAMロール設定、命名規則ドキュメント
- **依存関係**: T1.2, T4.5
- **要件カバー**: 9.2, 9.13
- **見積もり**: 1時間

### 5. テスト

#### - [ ] 5.1: EncryptionService 単体テスト
- **目的**: 暗号化・復号化の正確性とKMS/DEK管理を検証
- **作業内容**:
  - `functions/src/encryption/__tests__/encrypt.test.ts`の作成
  - `functions/src/encryption/__tests__/decrypt.test.ts`の作成
  - `functions/src/encryption/__tests__/keys.test.ts`の作成
  - `functions/src/encryption/__tests__/kms.test.ts`の作成
  - AES-256-GCM暗号化・復号化のラウンドトリップテスト
  - DEK生成・保存・取得のテスト
  - KMS wrap/unwrapのテスト（モックまたは実際のKMS）
  - Secret Manager統合テスト（モックまたは実際のSecret Manager）
  - nonce/tagの検証テスト
  - エラーハンドリングテスト（復号失敗等）
- **成果物**: テストファイル、テスト結果
- **依存関係**: T2.1, T4.5, T4.6
- **見積もり**: 4時間

#### - [ ] 5.2: PlanValidator 単体テスト
- **目的**: プラン制限チェックロジックを検証
- **作業内容**:
  - `functions/src/shared/__tests__/planValidator.test.ts`の作成
  - アカウント数上限チェックのテスト
  - ストレージ容量上限チェックのテスト
  - Firestoreモックを使用したテスト
- **成果物**: テストファイル、テスト結果
- **依存関係**: T2.2
- **見積もり**: 2時間

#### - [ ] 5.3: onUserCreate 統合テスト
- **目的**: ユーザー初期化フローとDEK生成の検証
- **作業内容**:
  - `functions/src/users/__tests__/onUserCreate.test.ts`の作成
  - Firebase Authトリガーのモック
  - Firestoreへのユーザードキュメント作成確認
  - Freeプラン設定の注入確認
  - 使用量初期化の確認
  - DEK生成・保存の確認
  - Secret ManagerへのDEK保存確認
- **成果物**: テストファイル、テスト結果
- **依存関係**: T2.3
- **見積もり**: 3時間

#### - [ ] 5.4: fetchMails 統合テスト
- **目的**: メール受信・MIMEパース・暗号化保存フローの検証
- **作業内容**:
  - `functions/src/mail/__tests__/fetchMails.test.ts`の作成
  - POP3Sサーバのモックまたはテストサーバ（SSL/TLS必須）
  - MIMEパースのテスト
  - bodyPreview生成のテスト
  - スレッドID生成のテスト
  - 本文サイズ判定と保存先分岐のテスト
  - 容量チェックロジックのテスト
  - メール本文の暗号化処理の確認
  - FirestoreへのmailThreads/mailMessages保存確認
  - 小さい本文のFirestore保存確認（`{ciphertext, nonce, tag}`形式）
  - 大きい本文のStorage保存確認
  - MIME原本のStorage保存確認
  - 添付ファイルのStorage保存確認
  - 使用量更新の確認（暗号化後のサイズを考慮）
  - 暗号化前データの破棄確認
- **成果物**: テストファイル、テスト結果
- **依存関係**: T2.8
- **見積もり**: 6時間

#### - [ ] 5.5: decryptMail 統合テスト
- **目的**: メール本文復号フローの検証
- **作業内容**:
  - `functions/src/mail/__tests__/decryptMail.test.ts`の作成
  - FirestoreからmailMessage取得の確認
  - hasLargeBodyがfalseの場合のFirestoreからの復号テスト
  - hasLargeBodyがtrueの場合のStorageからの復号テスト
  - 復号処理の確認
  - 復号済みデータの返却確認
  - 認証検証のテスト
  - エラーハンドリングテスト（復号失敗等）
- **成果物**: テストファイル、テスト結果
- **依存関係**: T2.14
- **見積もり**: 3時間

#### - [ ] 5.6: ゴミ箱・アーカイブ機能 統合テスト
- **目的**: ゴミ箱移動、復元、完全削除、アーカイブ機能の検証
- **作業内容**:
  - `functions/src/mail/__tests__/purgeTrash.test.ts`の作成（完全削除のみFunctions側で実装）
  - 30日経過メールの完全削除確認（Functions側：purgeTrash）
  - 使用量減算の確認（完全削除時のみ）
  - Flutter側でのゴミ箱移動・復元・アーカイブ・復元のWidgetテストまたは統合テスト
  - ラベル更新の一貫性確認（mailMessageとmailThreadの同期）
- **成果物**: 
  - functions/src/mail/__tests__/purgeTrash.test.ts
  - Flutter側テストファイル（Widgetテストまたは統合テスト）
- **依存関係**: T2.11（purgeTrashのみ）、T3.5（Flutter側実装）
- **見積もり**: 4時間

#### - [ ] 5.7: Flutter Widget テスト
- **目的**: UIコンポーネントの動作検証
- **作業内容**:
  - AuthScreenのWidgetテスト
  - InboxScreenのWidgetテスト
  - DetailScreenのWidgetテスト
  - AccountScreenのWidgetテスト
  - Firebase SDKのモック
- **成果物**: テストファイル、テスト結果
- **依存関係**: T3.1-T3.6
- **見積もり**: 6時間

#### - [ ] 5.8: E2E テスト（オプション）
- **目的**: エンドツーエンドのフロー検証
- **作業内容**:
  - Google Sign-In → ユーザー初期化 → ホーム画面遷移
  - メールアカウント追加 → POP3S接続テスト（SSL/TLS必須） → アカウント作成
  - 受信トレイ表示 → メール詳細表示 → 未読状態更新
  - メール削除 → 使用量更新確認
- **成果物**: E2Eテストスクリプト、テスト結果
- **依存関係**: T3.1-T3.6
- **見積もり**: 4時間（オプション）

## Implementation Order

### Phase 1: 基盤構築（Week 1）
1. T1.1-T1.5: プロジェクトセットアップ（国際化基盤含む）
2. T4.5-T4.6: KMS・Secret Manager設定
3. T2.1: 暗号化基盤（EncryptionService）
4. T2.2: 共有サービス（PlanValidator）

### Phase 2: バックエンド実装（Week 2-3）
5. T2.3: ユーザー初期化（DEK生成含む）
6. T2.4: POP3S接続テスト（SSL/TLS必須）
7. T2.5-T2.8: メール自動受信（MIMEパース、暗号化保存含む）
8. T2.11: ゴミ箱完全削除（purgeTrashのみ、移動・復元はFlutter側で実装）
9. T2.14: メール本文復号（decryptMail）
10. T2.15-T2.16: メール取得API（オプション）

### Phase 3: インフラ設定（Week 3）
10. T4.1-T4.4: セキュリティルール、インデックス、スケジューラー

### Phase 4: フロントエンド実装（Week 4-5）
11. T3.1: 認証画面
12. T3.2: メールアカウント設定画面
13. T3.3: メール一覧共通画面（MailListScreen）
14. T3.4: メール詳細画面（復号処理含む、未読状態更新はFlutter側でFirestore直接更新）
15. T3.5: メールゴミ箱・アーカイブ機能（Flutter側でFirestore直接更新、移動・復元・アーカイブ・復元を実装）
16. T3.6: 設定画面
17. T3.6: 広告表示機能 - AdService
18. T3.7: 広告表示のUI統合
19. T3.9: ゴミ箱画面（MailListScreen ラッパー）
20. T3.10: すべてのメール一覧画面（MailListScreen ラッパー）

### Phase 5: テスト（Week 6）
17. T5.1-T5.7: 単体テスト・統合テスト
18. T5.8: E2Eテスト（オプション）

## Dependencies Graph

```
T1.1 → T1.2 → T1.3 → T2.1, T2.2, T2.3, T2.4, T2.5, T2.11, T2.14, T2.15, T2.16
T1.1 → T1.4 → T1.5 → T3.1, T3.2, T3.3, T3.4, T3.5, T3.6, T3.7, T3.8, T3.9, T3.10
T4.5 → T4.6 → T2.1
T2.1 → T2.3, T2.4, T2.6, T2.8, T2.14
T2.2 → T2.8
T2.5 → T2.6 → T2.7 → T2.8
T2.7 → T2.14
T2.8 → T4.4
T2.11 → T4.4
T2.14 → T3.4
T3.6 → T3.7
T3.3 → T3.4 → T3.5
T1.2 → T4.1, T4.2, T4.3, T4.5
```

## Risk Mitigation

- **POP3ライブラリの選定**: 実装前に複数のライブラリを評価し、TypeScript型定義とメンテナンス性を確認
- **Secret Manager APIレイテンシ**: マスター鍵のメモリキャッシュを実装し、関数実行中は再利用
- **Firestore collectionGroupクエリのパフォーマンス**: インデックス作成を早期に実施し、必要に応じてページネーションを実装
- **容量管理の正確性**: トランザクションまたはバッチ処理で使用量更新の一貫性を保証

## Notes

- 各タスクは独立して実装可能な単位に分解
- テストは実装と並行して進めることを推奨
- E2EテストはMVP完了後のオプションタスク
- 実装中に発見された課題は適宜タスクを追加・修正

