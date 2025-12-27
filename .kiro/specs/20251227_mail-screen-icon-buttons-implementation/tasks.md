# Implementation Plan

- [x] 1. ゴミ箱に移動機能の実装
- [x] 1.1 (P) moveToTrash()メソッドの実装
  - 認証チェックを実装する（`_auth.currentUser`がnullの場合は`Exception('User not authenticated')`を投げる）
  - メールメッセージドキュメントを取得して`threadId`を取得する
  - Firestoreのバッチ更新を作成する
  - メールメッセージドキュメントの`labels`フィールドに`trash`を追加する（`FieldValue.arrayUnion()`を使用、`inbox`ラベルは削除しない）
  - メールメッセージドキュメントの`deletedAt`フィールドに`FieldValue.serverTimestamp()`を設定する
  - メールメッセージドキュメントの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
  - メールスレッドドキュメントの`labels`フィールドに`trash`を追加する（`FieldValue.arrayUnion()`を使用、`inbox`ラベルは削除しない）
  - メールスレッドドキュメントの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
  - バッチ更新をコミットする
  - エラーハンドリングを実装する（`debugPrint`でログ出力、例外を再スロー）
  - 既存の`UnimplementedError()`を削除する
  - _Requirements: 1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8,1.9,1.10,5.1,5.2,5.4,5.5,6.1,6.2,6.3,6.4,6.5_

- [x] 2. アーカイブ機能の実装
- [x] 2.1 (P) archive()メソッドの実装
  - 認証チェックを実装する（`_auth.currentUser`がnullの場合は`Exception('User not authenticated')`を投げる）
  - メールメッセージドキュメントを取得して`threadId`を取得する
  - Firestoreのバッチ更新を作成する
  - メールメッセージドキュメントの`labels`フィールドから`inbox`を削除する（`FieldValue.arrayRemove()`を使用、`archive`ラベルは追加しない）
  - メールメッセージドキュメントの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
  - メールスレッドドキュメントの`labels`フィールドから`inbox`を削除する（`FieldValue.arrayRemove()`を使用、`archive`ラベルは追加しない）
  - メールスレッドドキュメントの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
  - バッチ更新をコミットする
  - エラーハンドリングを実装する（`debugPrint`でログ出力、例外を再スロー）
  - 既存の`UnimplementedError()`を削除する
  - _Requirements: 2.1,2.2,2.3,2.4,2.5,2.6,2.7,2.8,2.9,5.1,5.2,5.4,5.5,6.1,6.2,6.3,6.4,6.5_

- [x] 3. ゴミ箱から復元機能の実装
- [x] 3.1 (P) restoreFromTrash()メソッドの実装
  - 認証チェックを実装する（`_auth.currentUser`がnullの場合は`Exception('User not authenticated')`を投げる）
  - メールメッセージドキュメントを取得して`threadId`を取得する
  - Firestoreのバッチ更新を作成する
  - メールメッセージドキュメントの`labels`フィールドから`trash`を削除する（`FieldValue.arrayRemove()`を使用、`inbox`ラベルは追加・削除しない、元の状態を保持）
  - メールメッセージドキュメントの`deletedAt`フィールドを削除する（`FieldValue.delete()`を使用）
  - メールメッセージドキュメントの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
  - メールスレッドドキュメントの`labels`フィールドから`trash`を削除する（`FieldValue.arrayRemove()`を使用、`inbox`ラベルは追加・削除しない、元の状態を保持）
  - メールスレッドドキュメントの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
  - バッチ更新をコミットする
  - エラーハンドリングを実装する（`debugPrint`でログ出力、例外を再スロー）
  - 既存の`UnimplementedError()`を削除する
  - _Requirements: 3.1,3.2,3.3,3.4,3.5,3.6,3.7,3.8,3.9,3.10,5.1,5.2,5.4,5.5,6.1,6.2,6.3,6.4,6.5_

- [x] 4. アーカイブ解除機能の実装
- [x] 4.1 (P) unarchive()メソッドの実装
  - 認証チェックを実装する（`_auth.currentUser`がnullの場合は`Exception('User not authenticated')`を投げる）
  - メールメッセージドキュメントを取得して`threadId`を取得する
  - Firestoreのバッチ更新を作成する
  - メールメッセージドキュメントの`labels`フィールドに`inbox`を追加する（`FieldValue.arrayUnion()`を使用、重複を避ける）
  - メールメッセージドキュメントの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
  - メールスレッドドキュメントの`labels`フィールドに`inbox`を追加する（`FieldValue.arrayUnion()`を使用、重複を避ける）
  - メールスレッドドキュメントの`updatedAt`フィールドを更新する（`FieldValue.serverTimestamp()`）
  - バッチ更新をコミットする
  - エラーハンドリングを実装する（`debugPrint`でログ出力、例外を再スロー）
  - 既存の`UnimplementedError()`を削除する
  - _Requirements: 4.1,4.2,4.3,4.4,4.5,4.6,4.7,4.8,4.9,5.1,5.2,5.4,5.5,6.1,6.2,6.3,6.4,6.5_

- [x] 5. 既存テストコードの動作確認
- [x] 5.1 既存テストの実行と動作確認
  - `detail_screen_test.dart`の既存テストを実行する
  - すべてのテストが正常に動作することを確認する
  - 必要に応じてテストを更新する
  - _Requirements: 6.7_

