# Implementation Plan

- [ ] 1. 添付ファイルリスト取得機能の実装（バックエンド）(P)
- [ ] 1.1 添付ファイルリスト取得のコアロジック実装
  - executeGetAttachmentsList関数を実装する
  - Firestoreからメッセージを取得し、hasAttachmentsを確認する
  - hasAttachmentsがtrueの場合、Storageからファイルリストを取得する（getFiles with prefix）
  - ファイル名をStorageパスから抽出する（.enc拡張子を除去）
  - ファイルメタデータからサイズとcontentTypeを取得する
  - 認証・認可チェックを実装する（メッセージがユーザーに属していることを確認）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 1.2 getAttachmentsList Cloud Functionの実装
  - HTTP Callable Functionを実装する（functions.region('asia-northeast1').https.onCall）
  - 認証チェックを実装する
  - リクエストバリデーション（messageIdの存在確認）を実装する
  - executeGetAttachmentsListを呼び出す
  - エラーハンドリングを実装する（HttpsErrorを使用）
  - functions/src/index.tsにエクスポートを追加する
  - _Requirements: 1.1, 1.4, 4.1, 4.3, 4.6_

- [ ] 1.3 getAttachmentsListの単体テスト実装
  - executeGetAttachmentsListのテストを実装する
  - 正常系：添付ファイルがある場合のリスト取得
  - 正常系：添付ファイルがない場合の空リスト返却
  - 異常系：メッセージが存在しない場合のエラー
  - 異常系：認可エラー（ユーザーがメッセージを所有していない場合）
  - Storage API呼び出しのモック実装
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 1.4 getAttachmentsListの統合テスト実装
  - HTTP Callable Functionの統合テストを実装する
  - 認証されていない場合のエラー確認
  - 正常系のエンドツーエンドテスト
  - _Requirements: 1.1, 1.4, 4.1, 4.3_

- [ ] 2. 添付ファイルダウンロード・復号化機能の実装（バックエンド）(P)
- [ ] 2.1 添付ファイルダウンロード・復号化のコアロジック実装
  - executeDownloadAttachment関数を実装する
  - Firestoreからメッセージを取得し、認証・認可チェックを実行する
  - Storageから暗号化されたファイルをダウンロードする
  - 暗号化データをJSONとしてパースする
  - ユーザーのDEKを使用して復号化する（decryptForUserを使用）
  - 復号化されたデータをBase64エンコードする
  - ファイルメタデータ（filename、contentType、size）を取得する
  - _Requirements: 2.1, 2.2, 2.5, 4.1, 4.2_

- [ ] 2.2 downloadAttachment Cloud Functionの実装
  - HTTP Callable Functionを実装する（functions.region('asia-northeast1').https.onCall）
  - 認証チェックを実装する
  - リクエストバリデーション（messageId、filenameの存在確認）を実装する
  - executeDownloadAttachmentを呼び出す
  - エラーハンドリングを実装する（HttpsErrorを使用）
  - ファイルが存在しない場合のエラー処理
  - 復号化が失敗した場合のエラー処理
  - functions/src/index.tsにエクスポートを追加する
  - _Requirements: 2.3, 2.4, 2.6, 4.1, 4.3, 4.4, 4.5, 4.6_

- [ ] 2.3 downloadAttachmentの単体テスト実装
  - executeDownloadAttachmentのテストを実装する
  - 正常系：ファイルのダウンロード・復号化
  - 異常系：メッセージが存在しない場合のエラー
  - 異常系：認可エラー（ユーザーがメッセージを所有していない場合）
  - 異常系：ファイルが存在しない場合のエラー
  - 異常系：復号化が失敗した場合のエラー
  - Storage API呼び出しと復号化のモック実装
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 2.4 downloadAttachmentの統合テスト実装
  - HTTP Callable Functionの統合テストを実装する
  - 認証されていない場合のエラー確認
  - 正常系のエンドツーエンドテスト
  - _Requirements: 2.1, 2.2, 2.6, 4.1, 4.3_

- [ ] 3. メール詳細画面への添付ファイル表示機能の実装（フロントエンド）
- [ ] 3.1 添付ファイルリスト取得APIの統合
  - MailDetailRepositoryにgetAttachmentsListメソッドを追加する
  - getAttachmentsList Cloud Functionを呼び出す
  - レスポンスをパースしてAttachmentListItem型に変換する
  - エラーハンドリングを実装する
  - _Requirements: 1.1, 1.4, 3.1, 4.7_

- [ ] 3.2 添付ファイルダウンロードAPIの統合
  - MailDetailRepositoryにdownloadAttachmentメソッドを追加する
  - downloadAttachment Cloud Functionを呼び出す
  - Base64エンコードされたコンテンツをデコードする
  - エラーハンドリングを実装する
  - _Requirements: 2.1, 2.5, 3.2, 4.7_

- [ ] 3.3 添付ファイルリスト表示UIの実装
  - DetailScreenに添付ファイルリストセクションを追加する
  - ファイル名、ファイルサイズを表示する
  - ファイルタイプに応じたアイコンを表示する（contentTypeに基づく）
  - 添付ファイルがない場合はセクションを非表示にする
  - _Requirements: 3.1, 3.6_

- [ ] 3.4 添付ファイルダウンロード機能の実装
  - 添付ファイルをタップしたときのハンドラーを実装する
  - ダウンロード開始時に読み込みインジケーターを表示する
  - downloadAttachment APIを呼び出す
  - ファイルをデバイスのダウンロードディレクトリに保存する（path_provider、file_pickerなどのパッケージを使用）
  - またはファイルを開く/共有するオプションを提供する（share_plusなどのパッケージを使用）
  - ダウンロード完了後にインジケーターを非表示にする
  - エラー時はユーザーフレンドリーなメッセージを表示する
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [ ] 3.5 DetailScreenの状態管理拡張
  - 添付ファイルリストの状態を管理する
  - 各添付ファイルのダウンロード状態を管理する
  - エラーメッセージの状態を管理する
  - メッセージ読み込み時に添付ファイルリストを取得する
  - _Requirements: 3.1, 3.3, 3.5_

- [ ] 3.6 DetailScreenのテスト実装
  - 添付ファイルリスト表示のテスト
  - 添付ファイルダウンロードのテスト
  - エラー表示のテスト
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.7_

- [ ] 4. エンドツーエンド統合テスト
- [ ] 4.1 バックエンドとフロントエンドの統合テスト
  - メッセージ詳細画面で添付ファイルリストが表示されることを確認
  - 添付ファイルをダウンロードできることを確認
  - 複数添付ファイルがある場合の動作確認
  - 添付ファイルがない場合の動作確認
  - エラーケース（認証エラー、認可エラー、ファイル不存在エラー）の確認
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

- [ ] 4.2 パフォーマンステスト
  - 大きなファイル（10MB以上）のダウンロード性能確認
  - 複数添付ファイルがある場合のリスト取得性能確認
  - _Requirements: 2.1, 2.5_

