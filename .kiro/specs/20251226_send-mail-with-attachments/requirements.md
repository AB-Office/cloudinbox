# Requirements Document

## Introduction

CloudInboxサービスにおいて、メール送信時に添付ファイルを付与できる機能を実装します。現在、バックエンド側（Cloud Functions）では添付ファイル付きメール送信の処理は既に実装済みですが、フロントエンド側（Flutterアプリ）のメール作成画面でファイル選択機能が未実装です。本機能により、ユーザーはメール作成画面からファイルを選択し、添付ファイル付きのメールを送信できるようになります。

## Requirements

### Requirement 1: ファイル選択機能の実装

**Objective:** As a ユーザー, I want メール作成画面からファイルを選択して添付できること, so that 添付ファイル付きのメールを送信できる

#### Acceptance Criteria

1. When ユーザーがメール作成画面で「添付ファイルを追加」ボタンを押す, CloudInbox shall ファイル選択ダイアログを表示する
2. When ファイル選択ダイアログが表示される, CloudInbox shall デバイスのファイルシステムからファイルを選択できるようにする
3. When ユーザーがファイルを選択する, CloudInbox shall 選択されたファイルの情報（ファイル名、ファイルサイズ、コンテンツタイプ）を取得する
4. When ユーザーがファイルを選択する, CloudInbox shall 選択されたファイルの内容をメモリに読み込む
5. When ファイルが選択される, CloudInbox shall 選択されたファイルを添付ファイルリストに追加する
6. When ファイルが選択される, CloudInbox shall メール作成画面に選択されたファイル名とファイルサイズを表示する
7. When ユーザーが複数のファイルを選択する, CloudInbox shall すべてのファイルを添付ファイルリストに追加する
8. If ファイル選択がキャンセルされる, CloudInbox shall ファイル選択ダイアログを閉じ、何も追加しない
9. If ファイル読み込みエラーが発生する, CloudInbox shall エラーメッセージを表示する
10. The CloudInbox shall ファイル選択機能に`file_picker`パッケージを使用する
11. The CloudInbox shall 選択されたファイルのコンテンツタイプを自動検出する（可能な場合）
12. When ファイルが選択される, CloudInbox shall ファイルサイズの制限をチェックする（実装側で適切な制限値を決定）

### Requirement 2: 添付ファイルの管理と表示

**Objective:** As a ユーザー, I want 選択した添付ファイルを確認・削除できること, so that 送信前に添付ファイルを管理できる

#### Acceptance Criteria

1. When 添付ファイルが追加される, CloudInbox shall メール作成画面に添付ファイルリストを表示する
2. When 添付ファイルリストが表示される, CloudInbox shall 各添付ファイルのファイル名を表示する
3. When 添付ファイルリストが表示される, CloudInbox shall 各添付ファイルのファイルサイズを表示する（人間が読みやすい形式、例: "1.5 MB"）
4. When 添付ファイルリストが表示される, CloudInbox shall 各添付ファイルに削除ボタンを表示する
5. When ユーザーが添付ファイルの削除ボタンを押す, CloudInbox shall 該当ファイルを添付ファイルリストから削除する
6. When ユーザーが添付ファイルの削除ボタンを押す, CloudInbox shall メモリからファイルデータを解放する
7. When すべての添付ファイルが削除される, CloudInbox shall 添付ファイルリストセクションを非表示にする
8. The CloudInbox shall 既存の添付ファイル表示UI（`ListTile`）を活用する
9. The CloudInbox shall 添付ファイルの表示順序を追加順とする

### Requirement 3: 添付ファイルの送信処理

**Objective:** As a システム, I want 選択された添付ファイルをメール送信リクエストに含めること, so that バックエンドで添付ファイル付きメールを送信できる

#### Acceptance Criteria

1. When ユーザーがメール送信ボタンを押す, CloudInbox shall 添付ファイルリストをメール送信リクエストに含める
2. When メール送信リクエストが作成される, CloudInbox shall 添付ファイルを`AttachmentData`形式に変換する
3. When 添付ファイルがメール送信リクエストに含まれる, CloudInbox shall ファイル名、ファイル内容（`Uint8List`）、コンテンツタイプを含める
4. When メール送信リクエストがバックエンドに送信される, CloudInbox shall 添付ファイルデータをBase64エンコードして送信する（バックエンド側で処理）
5. When メール送信が成功する, CloudInbox shall 添付ファイルデータをメモリから解放する
6. If メール送信が失敗する, CloudInbox shall 添付ファイルデータを保持し、再送信を可能にする
7. The CloudInbox shall 既存の`SendMailRequest`クラスの`attachments`フィールドを使用する
8. The CloudInbox shall 既存の`AttachmentData`クラスを使用する
9. The CloudInbox shall バックエンド側の既存実装（`sendMail.ts`）を活用する

### Requirement 4: プラットフォーム対応と権限管理

**Objective:** As a システム, I want Android/iOSの両プラットフォームでファイル選択機能が動作すること, so that すべてのユーザーが添付ファイル機能を利用できる

#### Acceptance Criteria

1. The CloudInbox shall Androidプラットフォームでファイル選択機能をサポートする
2. The CloudInbox shall iOSプラットフォームでファイル選択機能をサポートする
3. When Androidでファイル選択が実行される, CloudInbox shall スコープドストレージ制約に準拠する
4. When iOSでファイル選択が実行される, CloudInbox shall iOSのファイルアクセス権限に準拠する
5. If ファイルアクセス権限が不足している場合, CloudInbox shall 適切なエラーメッセージを表示する
6. The CloudInbox shall `file_picker`パッケージのAndroid/iOS設定を適切に構成する
7. The CloudInbox shall 必要に応じてAndroidの`AndroidManifest.xml`に権限設定を追加する
8. The CloudInbox shall 必要に応じてiOSの`Info.plist`に用途説明を追加する

### Requirement 5: エラーハンドリングとユーザー体験

**Objective:** As a ユーザー, I want ファイル選択時のエラーが適切に処理されること, so that 問題が発生した場合でも操作を継続できる

#### Acceptance Criteria

1. If ファイル選択中にエラーが発生する, CloudInbox shall ユーザーフレンドリーなエラーメッセージを表示する
2. If ファイルサイズが制限を超える場合, CloudInbox shall ファイルサイズ制限を超えていることを示すエラーメッセージを表示する
3. If ファイル読み込みに失敗する場合, CloudInbox shall ファイル読み込みエラーメッセージを表示する
4. If サポートされていないファイルタイプが選択される場合, CloudInbox shall 警告メッセージを表示する（または選択を許可するかは実装側で決定）
5. When エラーメッセージが表示される, CloudInbox shall 国際化対応されたメッセージを表示する（日本語・英語）
6. The CloudInbox shall エラーログを適切に記録する（デバッグ用）
7. When ファイル選択処理が実行中である, CloudInbox shall 読み込みインジケーターを表示する（必要に応じて）

### Requirement 6: 依存関係とパッケージ管理

**Objective:** As a 開発者, I want 必要なパッケージが適切に追加・設定されること, so that ファイル選択機能が正常に動作する

#### Acceptance Criteria

1. The CloudInbox shall `file_picker`パッケージを`pubspec.yaml`の`dependencies`に追加する
2. The CloudInbox shall `file_picker`パッケージの適切なバージョンを指定する（最新の安定版を推奨）
3. When パッケージが追加される, CloudInbox shall `flutter pub get`を実行して依存関係を解決する
4. The CloudInbox shall `file_picker`パッケージの使用方法に従って実装する
5. The CloudInbox shall 既存のパッケージ（`share_plus`等）との互換性を確保する
