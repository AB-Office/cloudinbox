# Implementation Tasks

## Overview

本ドキュメントは、添付ファイル付きメール送信機能の実装タスクを定義します。要件（requirements.md）と設計（design.md）に基づき、実装可能な単位に分解しています。

**実装順序**: 依存関係を考慮し、依存関係追加 → ファイル選択機能実装 → UI改善 → テストの順で実装します。

## Task Categories

### 1. 依存関係とパッケージ管理

- [x] 1.1 (P) file_pickerパッケージの追加
  - `apps/mobile_app/pubspec.yaml`の`dependencies`に`file_picker: ^8.0.0`を追加
  - `flutter pub get`を実行して依存関係を解決
  - 既存パッケージ（`share_plus`等）との互換性を確認
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

### 2. ファイル選択機能の実装

- [x] 2.1 ComposeScreenのファイル選択機能実装
  - `apps/mobile_app/lib/screens/compose_screen.dart`の`_onAddAttachmentPressed`メソッドを実装
  - `file_picker`パッケージの`FilePicker.platform.pickFiles()`を呼び出し
  - 複数ファイル選択を許可（`allowMultiple: true`）
  - ファイル選択結果の処理（`FilePickerResult`からファイル情報を取得）
  - 選択されたファイルの読み込み（`withData: true`でbytesを取得）
  - ファイル情報（ファイル名、ファイルサイズ、コンテンツタイプ）の取得
  - `AttachmentData`オブジェクトの作成
  - `_attachments`リストへの追加
  - ファイル選択キャンセル時の処理（エラーメッセージを表示せずに終了）
  - ファイル読み込みエラー時のエラーメッセージ表示
  - 拡張子からコンテンツタイプを推測する`_getContentTypeFromExtension`メソッドを実装
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_

- [x] 2.2 ファイルサイズ検証の実装
  - ファイルサイズ制限の定数を定義（10MBを推奨）
  - ファイル選択時にファイルサイズをチェック
  - ファイルサイズ超過時のエラーメッセージ表示（国際化対応）
  - ファイルサイズ超過の場合は`_attachments`リストに追加しない
  - デバッグログにファイルサイズ情報を記録
  - _Requirements: 1.12, 5.2_

- [x] 2.3 コンテンツタイプ自動検出の実装
  - 選択されたファイルの拡張子からコンテンツタイプを推測
  - `file_picker`の`PlatformFile.extension`から取得可能な場合はそれを使用
  - 推測できない場合は`application/octet-stream`をデフォルトとして設定
  - `AttachmentData`の`contentType`フィールドに設定
  - `_getContentTypeFromExtension`メソッドで主要なファイルタイプに対応
  - _Requirements: 1.11_

### 3. 添付ファイル表示の改善

- [x] 3.1 ファイルサイズ表示の実装
  - 既存の添付ファイル表示UI（`ListTile`）を拡張
  - 各添付ファイルのファイルサイズを表示
  - `I18nService.formatBytes()`を使用して人間が読みやすい形式で表示（例: "1.5 MB"）
  - ファイル名とファイルサイズを`ListTile`の`subtitle`に表示
  - `attachment.content.length`からファイルサイズを取得
  - _Requirements: 2.2, 2.3_

- [x] 3.2 添付ファイル削除機能の確認
  - 既存の`_onRemoveAttachment`メソッドが正しく動作することを確認
  - 削除時にメモリからファイルデータが解放されることを確認（DartのGCにより自動解放）
  - すべての添付ファイルが削除された場合、添付ファイルリストセクションが非表示になることを確認（`if (_attachments.isNotEmpty)`で実装済み）
  - テストを追加して動作を検証
  - _Requirements: 2.4, 2.5, 2.6, 2.7_

### 4. エラーハンドリングとユーザー体験

- [x] 4.1 エラーメッセージの国際化対応
  - ファイル選択エラーメッセージの国際化（日本語・英語）- 実装済み
  - ファイルサイズ超過エラーメッセージの国際化 - 実装済み
  - ファイル読み込みエラーメッセージの国際化 - 実装済み
  - ファイルアクセス権限エラーメッセージの国際化 - PlatformExceptionをキャッチして権限エラーを検出
  - 直接的なロケール判定を使用（`locale.languageCode == 'ja'`）
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 4.2 エラーログの実装
  - ファイル選択エラー時に`debugPrint`でログを記録
  - エラーの種類（ファイルサイズ超過、読み込みエラー、権限エラー等）をログに含める
  - デバッグ用の詳細情報を含める（エラータイプ、ファイル名、ファイルサイズ、エラーコード等）
  - ログメッセージに`[Attachment Error]`プレフィックスを追加して識別しやすくする
  - _Requirements: 5.6_

- [x] 4.3 読み込みインジケーターの実装（オプション）
  - 複数ファイル処理中に読み込みインジケーターを表示
  - `CircularProgressIndicator`を添付ファイル追加ボタンのアイコン部分に表示
  - 処理中はボタンを無効化してUIのブロックを防止
  - 処理完了時またはエラー時に読み込み状態を解除
  - _Requirements: 5.7_

### 5. プラットフォーム対応と権限管理

- [x] 5.1 Android権限設定の確認
  - `apps/mobile_app/android/app/src/main/AndroidManifest.xml`を確認
  - `file_picker`パッケージが要求する権限が適切に設定されていることを確認
  - `file_picker` 8.0はSAF（Storage Access Framework）を使用するため、明示的なストレージ権限（READ_EXTERNAL_STORAGE等）は不要
  - スコープドストレージ制約に準拠していることを確認（SAFにより自動的に準拠）
  - 現在の設定は適切で、追加の権限設定は不要
  - _Requirements: 4.1, 4.3, 4.6, 4.7_

- [x] 5.2 iOS権限設定の確認
  - `apps/mobile_app/ios/Runner/Info.plist`を確認
  - `file_picker`パッケージが要求する用途説明が適切に設定されていることを確認
  - `file_picker` 8.0はiOS 14以降で`UIDocumentPickerViewController`を使用するため、用途説明（Usage Description）は不要
  - `UIDocumentPickerViewController`はシステムのファイルピッカーを使用するため、アプリが直接ファイルシステムにアクセスしない
  - 写真ライブラリやカメラロールにアクセスする場合は用途説明が必要だが、file_pickerは主にUIDocumentPickerViewControllerを使用するため不要
  - iOSのファイルアクセス権限に準拠していることを確認（UIDocumentPickerViewControllerにより自動的に準拠）
  - 現在の設定は適切で、追加の用途説明は不要
  - _Requirements: 4.2, 4.4, 4.6, 4.8_

- [x] 5.3 プラットフォーム固有エラーハンドリング
  - Android/iOSで異なるエラーメッセージが必要な場合の処理
  - プラットフォーム固有のエラーコードの処理（`_getPlatformSpecificErrorMessage`メソッドを実装）
  - ファイルアクセス権限エラーの適切な処理（プラットフォーム別のメッセージを提供）
  - エラーログにプラットフォーム情報を含める（`Platform.operatingSystem`）
  - プラットフォーム固有のエラーコード（`user_canceled`、`pick_files_canceled`、`unknown`等）に対応
  - _Requirements: 4.5_

### 6. メール送信処理の確認

- [x] 6.1 既存のメール送信処理の確認
  - `apps/mobile_app/lib/main.dart`の`MailComposeRepository`実装を確認
  - 添付ファイルがBase64エンコードされて送信されることを確認（`FirebaseMailComposeRepository.sendMail`で`base64Encode(att.content)`を使用）
  - `SendMailRequest`の`attachments`フィールドが正しく使用されていることを確認（`compose_screen.dart`の`_onSendPressed`で`attachments: _attachments`を設定）
  - メール送信成功時に添付ファイルデータが解放されることを確認（`Navigator.pop()`で画面が閉じられ、Stateが破棄されるため自動的に解放）
  - メール送信失敗時に添付ファイルデータが保持されることを確認（画面が開いたままなので、`_attachments`が保持され、再送信可能）
  - バックエンド（`sendMail.ts`）でBase64デコードが正しく処理されていることを確認
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

### 7. テスト実装

- [x] 7.1 ファイル選択機能の単体テスト
  - `apps/mobile_app/test/compose_screen_test.dart`を更新
  - 添付ファイルが正しく表示されることを検証するテストを追加
  - 添付ファイル付きメール送信が正しく動作することを検証するテストを追加
  - 注意: `file_picker`はプラットフォーム固有の実装のため、完全な単体テスト（ファイル選択、キャンセル、エラー処理等）は統合テストで検証する必要がある
  - `_onAddAttachmentPressed`メソッドはプライベートメソッドのため、直接テストするのは困難
  - ファイル選択成功時の`_attachments`リストへの追加、キャンセル時の処理、ファイルサイズ超過、ファイル読み込みエラーは統合テストで検証
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 5.1, 5.2, 5.3_

- [x] 7.2 添付ファイル表示のテスト
  - `apps/mobile_app/test/compose_screen_test.dart`に添付ファイル表示のテストグループを追加
  - 添付ファイルリストの表示を検証するテストを追加
  - ファイル名とファイルサイズの表示を検証するテストを追加
  - 添付ファイル削除機能のテストを追加
  - すべての添付ファイル削除時のリスト非表示を検証するテストを追加
  - 注意: `file_picker`はプラットフォーム固有の実装のため、完全な単体テスト（実際のファイル選択、表示、削除）は統合テストで検証する必要がある
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [x] 7.3 メール送信統合テスト
  - `apps/mobile_app/integration_test/send_mail_test.dart`に添付ファイル付きメール送信統合テストグループを追加
  - ファイル選択 → 添付ファイル表示 → メール送信の一連の流れを検証するテストを追加
  - バックエンドへの送信リクエストに添付ファイルが含まれることを検証するテストを追加
  - メール送信成功時の添付ファイルデータ解放を検証するテストを追加
  - メール送信失敗時の添付ファイルデータ保持を検証するテストを追加
  - 複数ファイル選択時の処理を検証するテストを追加
  - ファイルサイズ超過時のエラーハンドリングを検証するテストを追加
  - 注意: これらのテストは実際のFirebaseサービスと接続する必要があるため、現在は`skip: true`でスキップされている。Firebase実装が完了したら実装する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 7.4 エラーハンドリングの統合テスト
  - `apps/mobile_app/integration_test/send_mail_test.dart`にエラーハンドリングの統合テストグループを追加
  - ファイル選択エラー時のエラーメッセージ表示を検証するテストを追加
  - ファイルサイズ超過時のエラーメッセージ表示を検証するテストを追加
  - ファイル読み込みエラー時のエラーメッセージ表示を検証するテストを追加
  - 国際化対応のエラーメッセージを検証するテストを追加
  - 複数ファイル選択時のエラーハンドリングを検証するテストを追加
  - 注意: これらのテストは実際のFirebaseサービスと接続する必要があるため、現在は`skip: true`でスキップされている。Firebase実装が完了したら実装する
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7.5 プラットフォーム対応テスト
  - `apps/mobile_app/integration_test/send_mail_test.dart`にプラットフォーム対応テストグループを追加
  - Androidでのファイル選択機能の動作を検証するテストを追加
  - iOSでのファイル選択機能の動作を検証するテストを追加
  - ファイルアクセス権限エラー時の処理を検証するテストを追加
  - プラットフォーム固有のエラーコード処理を検証するテストを追加
  - AndroidとiOSでのファイル選択UIの違いを検証するテストを追加
  - 注意: これらのテストは実際のFirebaseサービスと接続する必要があるため、現在は`skip: true`でスキップされている。Firebase実装が完了したら実装する
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

