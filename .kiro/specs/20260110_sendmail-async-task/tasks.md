# Implementation Plan

## Overview

本ドキュメントは、メール送信処理の非同期化機能の実装タスクを定義します。要件（requirements.md）と設計（design.md）に基づき、実装可能な単位に分解しています。

**実装順序**: 依存関係を考慮し、バックエンド基盤（handleSendMailTask、sendMailTaskHandler） → タスク投入機能（CloudTasksClientWrapper拡張、sendMailリファクタ） → タスク結果保存 → フロントエンド（タスク結果監視）の順で実装します。

## Task Categories

### 1. バックエンド実装（メール送信処理の独立化）

#### - [x] 1.1 (P) handleSendMailTask関数の作成
- **目的**: 実際のメール送信処理を独立した関数として実装
- **作業内容**:
  - `functions/src/mail/handleSendMailTask.ts`の作成
  - 既存の`sendMail.ts`内のメール送信ロジックを移植
  - タスクペイロード（`SendMailTaskPayload`）からメール送信情報を取得
  - メールアカウント情報取得（SMTP設定含む）
  - SMTPパスワード復号化（既存の`decryptPassword`関数を使用）
  - SMTP経由でメール送信（既存の`smtpClient.sendSmtpMail`を使用）
  - 送信済みメールの保存（既存の`saveMail`関数を使用）
  - MIMEメールの作成と解析（既存ロジックを移植）
  - スレッドIDの処理（返信・転送の場合は既存のthreadIdを使用）
  - エラーハンドリング（送信失敗、保存失敗）
  - `processAccount`関数パターンを踏襲
- **成果物**: functions/src/mail/handleSendMailTask.ts
- **依存関係**: なし
- **要件カバー**: 2.1, 2.2, 2.5, 2.6

#### - [x] 1.2 (P) sendMailTaskHandler（onTaskDispatched）の作成
- **目的**: Cloud Tasksからのタスクを受け取り、handleSendMailTaskを実行するハンドラを実装
- **作業内容**:
  - `functions/src/mail/sendMailTaskHandler.ts`の作成
  - `onTaskDispatched`トリガーを使用してタスクを受け取る
  - タスクペイロードの検証（`uid`, `accountId`, `to`, `subject`, `body`必須、型チェック）
  - `handleSendMailTask`を呼び出す
  - 成功・失敗をHTTPステータスとしてCloud Tasksへ返す
  - タイムアウト設定（540秒、9分）
  - 再試行ポリシー設定（maxAttempts: 3, maxRetrySeconds: 3600, maxBackoffSeconds: 300）
  - 既存の`processAccountTaskHandler`パターンを踏襲
  - エラーハンドリング（Cloud Tasksの再試行ポリシーに委ねる）
- **成果物**: functions/src/mail/sendMailTaskHandler.ts
- **依存関係**: 1.1
- **要件カバー**: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

#### - [x] 1.3 タスク結果のFirestore保存機能の実装
- **目的**: メール送信タスクの結果をFirestoreに保存する機能を実装
- **作業内容**:
  - `handleSendMailTask.ts`内でタスク結果の保存処理を追加
  - 成功時: `users/{uid}/mailTaskResults/{taskId}`に`success: true`, `messageId`を保存
  - 失敗時: `users/{uid}/mailTaskResults/{taskId}`に`success: false`, `errorMessage`を保存
  - タスク結果に含める情報: `success`, `messageId?`, `errorMessage?`, `taskId`, `accountId`, `subject`, `createdAt`, `completedAt`
  - `createdAt`と`completedAt`にサーバータイムスタンプ（`admin.firestore.FieldValue.serverTimestamp()`）を使用
  - タスク結果保存の失敗時はエラーログを出力するが、メール送信処理のエラーとしては扱わない
- **成果物**: functions/src/mail/handleSendMailTask.ts（更新）
- **依存関係**: 1.1
- **要件カバー**: 5.1, 5.2, 5.3, 5.4, 5.5

### 2. バックエンド実装（タスク投入機能）

#### - [x] 2.1 (P) CloudTasksClientWrapperの拡張（メール送信タスク投入）
- **目的**: メール送信タスクをCloud Tasksに投入するためのメソッドを追加
- **作業内容**:
  - `functions/src/mail/cloudTasksClient.ts`に`enqueueSendMailTask`メソッドを追加
  - タスクIDを生成（`sendmail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`形式）
  - タスクペイロードを構築（`{ data: { uid, accountId, to, cc, bcc, subject, body, attachments, threadId, inReplyToMessageId, taskId } }`形式）
  - `sendMailTaskHandler`をターゲットとするHTTPリクエストを作成
  - OIDCトークンを使用して認証（既存の`enqueueTask`メソッドと同様）
  - 再試行ポリシー設定（maxAttempts: 3, maxRetrySeconds: 3600, maxBackoffSeconds: 300）
  - タスクIDとタスク名を返却（`{ taskName: string, taskId: string }`）
  - 既存の`enqueueTask`メソッドと同様のパターンで実装
  - 入力検証（uid, accountId, to, subject, body必須）
- **成果物**: functions/src/mail/cloudTasksClient.ts（更新）
- **依存関係**: なし
- **要件カバー**: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6

#### - [x] 2.2 sendMail関数のリファクタリング（タスク投入のみ）
- **目的**: sendMail関数をタスク投入のみを行うようにリファクタリング
- **作業内容**:
  - `functions/src/mail/sendMail.ts`をリファクタリング
  - 実際のメール送信処理を削除（`handleSendMailTask`に移動済み）
  - リクエストパラメータ検証を維持（accountId、to、subject、body、メールアドレス形式）
  - メールアカウント設定の存在確認（SMTP設定必須チェック）
  - `CloudTasksClientWrapper.enqueueSendMailTask`を呼び出してタスクを投入
  - タスクIDをレスポンスに含めて返却（`SendMailResponse`に`taskId`フィールドを追加）
  - タイムアウトを540秒から60秒に短縮（タスク投入のみのため）
  - メモリを512MBから256MBに削減（タスク投入のみのため）
  - エラーハンドリング（タスク投入失敗時のエラーレスポンス）
- **成果物**: functions/src/mail/sendMail.ts（更新）
- **依存関係**: 2.1
- **要件カバー**: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6

#### - [x] 2.3 sendMailTaskHandlerのエクスポート追加
- **目的**: sendMailTaskHandlerをindex.tsにエクスポートしてデプロイ可能にする
- **作業内容**:
  - `functions/src/index.ts`に`sendMailTaskHandler`のエクスポートを追加
  - 既存の`processAccountTaskHandler`のエクスポートパターンを踏襲
- **成果物**: functions/src/index.ts（更新）
- **依存関係**: 1.2
- **要件カバー**: 3.1

### 3. フロントエンド実装（タスク結果監視）

#### - [x] 3.1 Webアプリでのタスク結果監視機能の実装
- **目的**: Webアプリでメール送信タスクの結果をFirestoreで監視し、スナックバーで表示
- **作業内容**:
  - `apps/web_app/src/services/mail.ts`に`watchTaskResult`関数を追加
  - Firestoreの`users/{uid}/mailTaskResults/{taskId}`を監視（`onSnapshot`を使用）
  - タスク結果が保存されたら、コールバック関数を呼び出す
  - タイムアウト処理（30秒以内に結果が保存されない場合、タイムアウトコールバックを呼び出す）
  - 監視停止関数を返却
  - `apps/web_app/src/views/ComposeView.vue`を更新
  - `sendMail`関数呼び出し後、タスクIDを受け取る
  - `watchTaskResult`を呼び出してタスク結果を監視
  - 成功時: 既存の`useSnackbar` composableの`showSuccess`を使用して成功メッセージを表示
  - 失敗時: 既存の`useSnackbar` composableの`showError`を使用してエラーメッセージを表示
  - タイムアウト時: タイムアウトメッセージをスナックバーで表示
  - 監視のクリーンアップ（コンポーネントのアンマウント時またはタイムアウト時）
- **成果物**: apps/web_app/src/services/mail.ts（更新）、apps/web_app/src/views/ComposeView.vue（更新）
- **依存関係**: 1.3
- **要件カバー**: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8

#### - [x] 3.2 Flutterアプリでのタスク結果監視機能の実装
- **目的**: Flutterアプリでメール送信タスクの結果をFirestoreで監視し、スナックバーで表示
- **作業内容**:
  - `apps/mobile_app/lib/repositories/mail_repository.dart`に`watchTaskResult`メソッドを追加
  - Firestoreの`users/{uid}/mailTaskResults/{taskId}`を監視（`snapshots()`を使用）
  - `Stream<SendMailTaskResult?>`を返却
  - タイムアウト処理（30秒以内に結果が保存されない場合、ストリームを完了）
  - メール送信画面（ComposeScreen等）を更新
  - `sendMail`関数呼び出し後、タスクIDを受け取る
  - `watchTaskResult`を呼び出してタスク結果を監視（`StreamBuilder`を使用）
  - 成功時: `ScaffoldMessenger.showSnackBar`を使用して成功メッセージを表示
  - 失敗時: `ScaffoldMessenger.showSnackBar`を使用してエラーメッセージを表示
  - タイムアウト時: タイムアウトメッセージをスナックバーで表示
  - ストリームのクリーンアップ（ウィジェットの破棄時またはタイムアウト時）
- **成果物**: apps/mobile_app/lib/repositories/mail_repository.dart（更新）、メール送信画面（更新）
- **依存関係**: 1.3
- **要件カバー**: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8

### 4. Firestoreセキュリティルールの更新

#### - [x] 4.1 mailTaskResultsコレクションのセキュリティルール追加
- **目的**: mailTaskResultsコレクションへのアクセスを認証ユーザーのみに制限
- **作業内容**:
  - `infra/firebase/firestore.rules`を更新
  - `users/{uid}/mailTaskResults/{taskId}`のセキュリティルールを追加
  - 認証ユーザーのみ読み取り可能（`request.auth != null && request.auth.uid == uid`）
  - 書き込みはCloud Functionsからのみ（クライアント側からの書き込みは不可）
- **成果物**: infra/firebase/firestore.rules（更新）
- **依存関係**: 1.3
- **要件カバー**: 5.1, 5.2

### 5. テスト実装

#### - [x] 5.1 handleSendMailTask関数の単体テスト
- **目的**: handleSendMailTask関数の単体テストを実装
- **作業内容**:
  - `functions/src/mail/__tests__/handleSendMailTask.test.ts`の作成
  - 正常系: メール送信成功、送信済みメール保存、タスク結果保存
  - 異常系: SMTP接続エラー、認証エラー、タイムアウト、タスク結果保存失敗
  - パラメータ検証のテスト
  - エラーハンドリングのテスト
- **成果物**: functions/src/mail/__tests__/handleSendMailTask.test.ts
- **依存関係**: 1.1, 1.3
- **要件カバー**: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4, 5.5

#### - [x] 5.2 sendMailTaskHandlerの単体テスト
- **目的**: sendMailTaskHandlerの単体テストを実装
- **作業内容**:
  - `functions/src/mail/__tests__/sendMailTaskHandler.test.ts`の作成
  - 正常系: タスクペイロード検証、handleSendMailTask呼び出し
  - 異常系: ペイロード検証エラー、handleSendMailTaskエラー
  - エラーハンドリングのテスト（Cloud Tasksの再試行ポリシーに委ねる）
- **成果物**: functions/src/mail/__tests__/sendMailTaskHandler.test.ts
- **依存関係**: 1.2
- **要件カバー**: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

#### - [x] 5.3 CloudTasksClientWrapperの拡張テスト
- **目的**: enqueueSendMailTaskメソッドの単体テストを実装
- **作業内容**:
  - `functions/src/mail/__tests__/cloudTasksClient.test.ts`を更新
  - `enqueueSendMailTask`メソッドのテストを追加
  - タスクID生成のテスト
  - タスクペイロード構築のテスト
  - OIDCトークン設定のテスト
  - エラーハンドリングのテスト
- **成果物**: functions/src/mail/__tests__/cloudTasksClient.test.ts（更新）
- **依存関係**: 2.1
- **要件カバー**: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6

#### - [x] 5.4 sendMail関数のリファクタリングテスト
- **目的**: sendMail関数のリファクタリング後の単体テストを実装
- **作業内容**:
  - `functions/src/mail/__tests__/sendMail.test.ts`を更新
  - タスク投入の成功/失敗ケース
  - パラメータ検証のテスト
  - タスクID返却のテスト
  - エラーハンドリングのテスト
- **成果物**: functions/src/mail/__tests__/sendMail.test.ts（更新）
- **依存関係**: 2.2
- **要件カバー**: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6

#### - [x] 5.5 統合テスト（メール送信フロー）
- **目的**: メール送信の非同期フローの統合テストを実装
- **作業内容**:
  - `functions/src/mail/__tests__/sendMail.integration.test.ts`の作成
  - sendMail → Cloud Tasks → sendMailTaskHandler → handleSendMailTask → SMTP送信 → 保存 → タスク結果保存のフローをテスト
  - タスク結果のFirestore保存を確認
  - エラーケースの統合テスト
- **成果物**: functions/src/mail/__tests__/sendMail.integration.test.ts
- **依存関係**: 2.2, 1.2, 1.3
- **要件カバー**: 1.1, 2.1, 3.1, 4.1, 5.1

#### - [x] 5.6 Webアプリのタスク結果監視テスト
- **目的**: Webアプリのタスク結果監視機能のテストを実装
- **作業内容**:
  - `apps/web_app/src/services/__tests__/mail.test.ts`を更新
  - `watchTaskResult`関数のテストを追加
  - タスク結果の監視、タイムアウト処理のテスト
  - `apps/web_app/src/views/__tests__/ComposeView.test.ts`を更新
  - タスク結果のスナックバー表示のテスト
- **成果物**: apps/web_app/src/services/__tests__/mail.test.ts（更新）、apps/web_app/src/views/__tests__/ComposeView.test.ts（更新）
- **依存関係**: 3.1
- **要件カバー**: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8

#### - [x] 5.7 Flutterアプリのタスク結果監視テスト
- **目的**: Flutterアプリのタスク結果監視機能のテストを実装
- **作業内容**:
  - `apps/mobile_app/test/repositories/mail_repository_test.dart`を更新
  - `watchTaskResult`メソッドのテストを追加
  - タスク結果の監視、タイムアウト処理のテスト
  - メール送信画面のWidgetテストを更新
  - タスク結果のスナックバー表示のテスト
- **成果物**: apps/mobile_app/test/repositories/mail_repository_test.dart（更新）、メール送信画面のテスト（更新）
- **依存関係**: 3.2
- **要件カバー**: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8

