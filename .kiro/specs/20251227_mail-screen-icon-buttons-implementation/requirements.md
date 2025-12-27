# Requirements Document

## Introduction

CloudInboxサービスのメール詳細画面（`DetailScreen`）には、既に以下のアイコンボタンが配置されていますが、その機能が未実装の状態です：

- **ゴミ箱に移動** (`moveToTrash`): メールをゴミ箱に移動する
- **アーカイブ** (`archive`): メールをアーカイブする（受信トレイから除外）
- **ゴミ箱から復元** (`restoreFromTrash`): ゴミ箱からメールを復元する
- **アーカイブ解除** (`unarchive`): アーカイブからメールを復元する（受信トレイに戻す）

現在、`FirebaseDetailRepository`クラスのこれらのメソッドは`UnimplementedError()`を投げているため、実際の機能が動作していません。本機能により、これらのボタンを押した際に適切にFirestoreを更新し、メールの状態を変更できるようになります。

## Requirements

### Requirement 1: ゴミ箱に移動機能の実装

**Objective:** As a ユーザー, I want メールをゴミ箱に移動できること, so that 不要なメールを整理できる

#### Acceptance Criteria

1. When ユーザーがメール詳細画面で「ゴミ箱に移動」ボタンを押す, CloudInbox shall `FirebaseDetailRepository.moveToTrash()`メソッドを呼び出す
2. When `moveToTrash()`が実行される, CloudInbox shall メールメッセージドキュメント（`users/{uid}/mailMessages/{messageId}`）の`labels`フィールドに`trash`を追加する（`inbox`ラベルは削除しない）
3. When `moveToTrash()`が実行される, CloudInbox shall メールメッセージドキュメントの`deletedAt`フィールドに現在の日時（`FieldValue.serverTimestamp()`）を設定する
4. When `moveToTrash()`が実行される, CloudInbox shall メールスレッドドキュメント（`users/{uid}/mailThreads/{threadId}`）の`labels`フィールドに`trash`を追加する（`inbox`ラベルは削除しない）
5. When `moveToTrash()`が実行される, CloudInbox shall メールメッセージとメールスレッドの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
6. When `moveToTrash()`が実行される, CloudInbox shall Firestoreのトランザクションまたはバッチ更新を使用して、メールメッセージとメールスレッドの更新を一貫性保証する
7. If 認証されていないユーザーが操作を試みる場合, CloudInbox shall `Exception('User not authenticated')`を投げる
8. If メッセージIDが存在しない場合, CloudInbox shall 適切なエラーを投げる
9. When `moveToTrash()`が成功する, CloudInbox shall 使用量（`usage.storageBytes`）は変更しない（ゴミ箱内でも容量を使用）
10. The CloudInbox shall 既存の`FirebaseDetailRepository`クラス内に実装する

### Requirement 2: アーカイブ機能の実装

**Objective:** As a ユーザー, I want メールをアーカイブできること, so that 受信トレイを整理しつつ、メールを保持できる

#### Acceptance Criteria

1. When ユーザーがメール詳細画面で「アーカイブ」ボタンを押す, CloudInbox shall `FirebaseDetailRepository.archive()`メソッドを呼び出す
2. When `archive()`が実行される, CloudInbox shall メールメッセージドキュメント（`users/{uid}/mailMessages/{messageId}`）の`labels`フィールドから`inbox`を削除する（`archive`ラベルは追加しない）
3. When `archive()`が実行される, CloudInbox shall メールスレッドドキュメント（`users/{uid}/mailThreads/{threadId}`）の`labels`フィールドから`inbox`を削除する（`archive`ラベルは追加しない）
4. When `archive()`が実行される, CloudInbox shall メールメッセージとメールスレッドの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
5. When `archive()`が実行される, CloudInbox shall Firestoreのトランザクションまたはバッチ更新を使用して、メールメッセージとメールスレッドの更新を一貫性保証する
6. If 認証されていないユーザーが操作を試みる場合, CloudInbox shall `Exception('User not authenticated')`を投げる
7. If メッセージIDが存在しない場合, CloudInbox shall 適切なエラーを投げる
8. When `archive()`が成功する, CloudInbox shall 使用量（`usage.storageBytes`）は変更しない（すべてのメール一覧でも容量を使用）
9. The CloudInbox shall 既存の`FirebaseDetailRepository`クラス内に実装する

### Requirement 3: ゴミ箱から復元機能の実装

**Objective:** As a ユーザー, I want ゴミ箱からメールを復元できること, so that 誤って削除したメールを元に戻せる

#### Acceptance Criteria

1. When ユーザーがメール詳細画面で「ゴミ箱から復元」ボタンを押す, CloudInbox shall `FirebaseDetailRepository.restoreFromTrash()`メソッドを呼び出す
2. When `restoreFromTrash()`が実行される, CloudInbox shall メールメッセージドキュメント（`users/{uid}/mailMessages/{messageId}`）の`labels`フィールドから`trash`を削除する（`inbox`ラベルは追加・削除しない、元の状態を保持）
3. When `restoreFromTrash()`が実行される, CloudInbox shall メールメッセージドキュメントの`deletedAt`フィールドを削除する（`FieldValue.delete()`）
4. When `restoreFromTrash()`が実行される, CloudInbox shall メールスレッドドキュメント（`users/{uid}/mailThreads/{threadId}`）の`labels`フィールドから`trash`を削除する（`inbox`ラベルは追加・削除しない、元の状態を保持）
5. When `restoreFromTrash()`が実行される, CloudInbox shall メールメッセージとメールスレッドの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
6. When `restoreFromTrash()`が実行される, CloudInbox shall Firestoreのトランザクションまたはバッチ更新を使用して、メールメッセージとメールスレッドの更新を一貫性保証する
7. If 認証されていないユーザーが操作を試みる場合, CloudInbox shall `Exception('User not authenticated')`を投げる
8. If メッセージIDが存在しない場合, CloudInbox shall 適切なエラーを投げる
9. When `restoreFromTrash()`が成功する, CloudInbox shall 使用量（`usage.storageBytes`）は変更しない
10. The CloudInbox shall 既存の`FirebaseDetailRepository`クラス内に実装する

### Requirement 4: アーカイブ解除機能の実装

**Objective:** As a ユーザー, I want アーカイブからメールを復元できること, so that アーカイブしたメールを再び受信トレイに表示できる

#### Acceptance Criteria

1. When ユーザーがメール詳細画面で「アーカイブ解除」ボタンを押す, CloudInbox shall `FirebaseDetailRepository.unarchive()`メソッドを呼び出す
2. When `unarchive()`が実行される, CloudInbox shall メールメッセージドキュメント（`users/{uid}/mailMessages/{messageId}`）の`labels`フィールドに`inbox`を追加する（重複を避ける）
3. When `unarchive()`が実行される, CloudInbox shall メールスレッドドキュメント（`users/{uid}/mailThreads/{threadId}`）の`labels`フィールドに`inbox`を追加する（重複を避ける）
4. When `unarchive()`が実行される, CloudInbox shall メールメッセージとメールスレッドの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
5. When `unarchive()`が実行される, CloudInbox shall Firestoreのトランザクションまたはバッチ更新を使用して、メールメッセージとメールスレッドの更新を一貫性保証する
6. If 認証されていないユーザーが操作を試みる場合, CloudInbox shall `Exception('User not authenticated')`を投げる
7. If メッセージIDが存在しない場合, CloudInbox shall 適切なエラーを投げる
8. When `unarchive()`が成功する, CloudInbox shall 使用量（`usage.storageBytes`）は変更しない
9. The CloudInbox shall 既存の`FirebaseDetailRepository`クラス内に実装する

### Requirement 5: エラーハンドリングとユーザー体験

**Objective:** As a ユーザー, I want 操作時のエラーが適切に処理されること, so that 問題が発生した場合でも操作を継続できる

#### Acceptance Criteria

1. If メール操作中にエラーが発生する, CloudInbox shall エラーログを`debugPrint()`で出力する
2. If メール操作中にエラーが発生する, CloudInbox shall 例外を適切に再スローする（呼び出し元で処理できるように）
3. When メール操作が成功する, CloudInbox shall 画面の自動更新は行わない（既存の`_load()`メソッドによる再読み込みは実装しない、画面遷移や手動リロードで更新）
4. The CloudInbox shall 既存のエラーハンドリングパターン（`FirebaseDetailRepository`の他のメソッド）に従う
5. The CloudInbox shall トランザクションまたはバッチ更新の失敗時にも適切にエラーを処理する

### Requirement 6: 実装の一貫性とコード品質

**Objective:** As a 開発者, I want 実装が既存のコードベースと一貫性を保つこと, so that 保守性と可読性を確保できる

#### Acceptance Criteria

1. The CloudInbox shall 既存の`FirebaseDetailRepository`クラスの実装パターンに従う（`_auth.currentUser`チェック、`_firestore`の使用、エラーハンドリングなど）
2. The CloudInbox shall 既存のFirestoreスキーマ構造（`labels`フィールド、`deletedAt`フィールド、`threadId`フィールドなど）に従う
3. The CloudInbox shall 既存の要件仕様（`20251209_cloudinbox-mvp-pop3`）に記載されているラベル管理ロジックに従う
4. The CloudInbox shall トランザクションまたはバッチ更新を使用して、メールメッセージとメールスレッドの更新を一貫性保証する
5. The CloudInbox shall 既存の`UnimplementedError()`を削除し、実際の実装に置き換える
6. The CloudInbox shall コードコメントを適切に追加する（必要に応じて）
7. The CloudInbox shall 既存のテストコード（`detail_screen_test.dart`）が動作することを確認する

