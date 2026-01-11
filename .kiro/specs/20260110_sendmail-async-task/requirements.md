# Requirements Document

## Introduction

メール送信処理を非同期化するため、`sendMail`関数でメール送信リクエストを受け付け、実際の送信処理を`sendMailTaskHandler`と`onTaskDispatched`として独立させます。また、`sendMailTaskHandler`の結果をFirestoreに保存し、Web/Flutterアプリでスナックバーで確認できるようにします。

既存の`processAccountTaskHandler`パターンを踏襲し、メール送信処理のスケーラビリティと責務分離を実現します。

## Requirements

### Requirement 1: sendMail関数のリファクタリング（タスク投入のみ）

**Objective:** メール送信処理の開発者として、`sendMail`関数をタスク投入のみを行うようにリファクタしたい。そうすることで、メール送信リクエストの受け付けと実際の送信処理を分離し、レスポンス時間を短縮できる。

#### Acceptance Criteria

1. When ユーザーがメール送信リクエストを送信する, the `sendMail` Function shall リクエストパラメータを検証し、Cloud Tasksにメール送信タスクを投入する。
2. When メール送信タスクを投入する, the `sendMail` Function shall タスクIDを生成し、レスポンスに含めて返却する。
3. When メール送信タスクを投入する, the `sendMail` Function shall タスク投入の成功/失敗のみを返却し、実際のメール送信結果は返却しない。
4. When メール送信リクエストのパラメータ検証が失敗する, the `sendMail` Function shall エラーレスポンスを返却し、タスクを投入しない。
5. When メール送信タスクの投入に失敗する, the `sendMail` Function shall エラーレスポンスを返却する。
6. The `sendMail` Function shall タイムアウトを60秒以内に設定する（タスク投入のみのため）。

### Requirement 2: handleSendMailTask関数の作成

**Objective:** メール送信処理の開発者として、実際のメール送信処理を独立した関数として管理したい。そうすることで、`sendMail`関数と疎結合に保ちつつ、テスト容易性と再利用性を高められる。

#### Acceptance Criteria

1. When `handleSendMailTask`関数が呼び出される, the `handleSendMailTask` Function shall タスクペイロードからメール送信情報を取得し、SMTP経由でメールを送信する。
2. When メール送信が成功する, the `handleSendMailTask` Function shall 送信済みメールをFirestoreとStorageに保存する。
3. When メール送信が成功する, the `handleSendMailTask` Function shall タスク結果（成功、messageId）をFirestoreの`users/{uid}/mailTaskResults/{taskId}`に保存する。
4. When メール送信が失敗する, the `handleSendMailTask` Function shall タスク結果（失敗、errorMessage）をFirestoreの`users/{uid}/mailTaskResults/{taskId}`に保存する。
5. When メール送信処理中にエラーが発生する, the `handleSendMailTask` Function shall エラーをスローし、Cloud Tasksの再試行ポリシーに委ねる。
6. The `handleSendMailTask` Function shall 既存の`sendMail.ts`内のメール送信ロジックを移植し、`processAccount`関数パターンを踏襲する。

### Requirement 3: sendMailTaskHandler（onTaskDispatched）の作成

**Objective:** バックエンドエンジニアとして、メール送信処理をCloud Tasks＋`onTaskDispatched`で非同期実行できるようにしたい。そうすることで、メール送信処理のスケーラビリティと安定性を向上できる。

#### Acceptance Criteria

1. When Cloud Tasksからメール送信タスクが投入される, the `sendMailTaskHandler` shall `onTaskDispatched`トリガーでタスクを受け取り、`handleSendMailTask`を呼び出す。
2. When タスクペイロードを受信する, the `sendMailTaskHandler` shall ペイロードを検証し、問題がなければ`handleSendMailTask`に渡す。
3. When タスク実行時にエラーが発生する, the `sendMailTaskHandler` shall エラーをスローし、Cloud Tasksの再試行ポリシーに委ねる。
4. The `sendMailTaskHandler` shall タイムアウトを540秒（9分）に設定する（メール送信処理のタイムアウトと同じ）。
5. The `sendMailTaskHandler` shall 再試行ポリシー（maxAttempts: 3, maxRetrySeconds: 3600, maxBackoffSeconds: 300）を設定する。
6. The `sendMailTaskHandler` shall 既存の`processAccountTaskHandler`パターンを踏襲する。

### Requirement 4: CloudTasksClientWrapperの拡張（メール送信タスク投入）

**Objective:** バックエンドエンジニアとして、メール送信タスクをCloud Tasksに投入できるようにしたい。そうすることで、既存の`CloudTasksClientWrapper`を再利用し、一貫性のあるタスク管理を実現できる。

#### Acceptance Criteria

1. When メール送信タスクを投入する, the `CloudTasksClientWrapper` shall `enqueueSendMailTask`メソッドを提供し、メール送信タスクをCloud Tasksに投入する。
2. When メール送信タスクを投入する, the `CloudTasksClientWrapper` shall タスクIDを生成し、レスポンスに含めて返却する。
3. When メール送信タスクを投入する, the `CloudTasksClientWrapper` shall タスクペイロード（uid, accountId, to, cc, bcc, subject, body, attachments, threadId, inReplyToMessageId, taskId）を含める。
4. When メール送信タスクを投入する, the `CloudTasksClientWrapper` shall `sendMailTaskHandler`をターゲットとするHTTPリクエストを作成する。
5. When メール送信タスクを投入する, the `CloudTasksClientWrapper` shall OIDCトークンを使用して認証する。
6. The `CloudTasksClientWrapper` shall 既存の`enqueueTask`メソッドと同様のパターンで実装する。

### Requirement 5: タスク結果のFirestore保存

**Objective:** バックエンドエンジニアとして、メール送信タスクの結果をFirestoreに保存したい。そうすることで、Web/Flutterアプリでタスク結果を確認できるようにできる。

#### Acceptance Criteria

1. When メール送信タスクが成功する, the `handleSendMailTask` Function shall タスク結果を`users/{uid}/mailTaskResults/{taskId}`に保存する。
2. When メール送信タスクが失敗する, the `handleSendMailTask` Function shall タスク結果を`users/{uid}/mailTaskResults/{taskId}`に保存する。
3. When タスク結果を保存する, the `handleSendMailTask` Function shall 以下の情報を含める：`success`, `messageId`（成功時）, `errorMessage`（失敗時）, `taskId`, `accountId`, `subject`, `createdAt`, `completedAt`。
4. When タスク結果を保存する, the `handleSendMailTask` Function shall `createdAt`と`completedAt`にサーバータイムスタンプを使用する。
5. If タスク結果の保存に失敗する, the `handleSendMailTask` Function shall エラーログを出力するが、メール送信処理のエラーとしては扱わない（タスク結果保存の失敗はメール送信の成功/失敗に影響しない）。

### Requirement 6: Web/Flutterアプリでのタスク結果確認（スナックバー表示）

**Objective:** ユーザーとして、メール送信タスクの結果をスナックバーで確認したい。そうすることで、メール送信が成功したか失敗したかを即座に確認できる。

#### Acceptance Criteria

1. When メール送信タスクが投入される, the Web/Flutter App shall タスクIDを受け取る。
2. When メール送信タスクが投入される, the Web/Flutter App shall Firestoreの`users/{uid}/mailTaskResults/{taskId}`を監視し、タスク結果が保存されるまで待機する。
3. When タスク結果が保存される, the Web/Flutter App shall タスク結果を取得し、スナックバーで表示する。
4. When タスク結果が成功の場合, the Web/Flutter App shall 成功メッセージ（例：「メールを送信しました」）をスナックバーで表示する。
5. When タスク結果が失敗の場合, the Web/Flutter App shall エラーメッセージ（`errorMessage`）をスナックバーで表示する。
6. When タスク結果の監視がタイムアウトする（例：30秒）, the Web/Flutter App shall タイムアウトメッセージをスナックバーで表示する。
7. The Web/Flutter App shall タスク結果の監視を最大30秒間行い、それ以降はタイムアウトとして扱う。
8. The Web/Flutter App shall 既存のスナックバー仕組み（Web: `useSnackbar` composable, Flutter: `ScaffoldMessenger`）を使用する。
