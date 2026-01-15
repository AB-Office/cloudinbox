# Implementation Plan

## Tasks

- [x] 1. Firebase Storageルールの更新 (P)
  - `infra/firebase/storage.rules`を更新し、`legal-docs/`パス配下のファイルに対する読み取り権限を認証ユーザーに付与する。
  - 書き込み権限は管理者のみ（Firebase Admin SDK経由）とする。
  - 既存の`mail-data/{uid}/...`ルールは維持する。
  - _Requirements: 1_

- [x] 2. 法的文書アップロードスクリプトの作成 (P)
  - `scripts/upload-legal-docs.ts`を作成し、既存の`apps/web_app/public/`内のMarkdownファイルをFirebase Storageにアップロードする機能を実装する。
  - ファイルマッピング: `terms.md` → `legal-docs/terms_ja.md`, `terms_en.md` → `legal-docs/terms_en.md`, `privacy.md` → `legal-docs/privacy_ja.md`, `privacy_en.md` → `legal-docs/privacy_en.md`, `commercial.md` → `legal-docs/commercial_ja.md`, `pricing_en.md` → `legal-docs/pricing_en.md`
  - Firebase Admin SDKを使用してStorageにアップロードし、メタデータ（contentType: `text/markdown`）を設定する。
  - アップロード前にファイルの存在確認とバリデーションを実施する。
  - _Requirements: 1_

- [x] 3. Webアプリ: LegalDocumentServiceの実装 (P)
  - `apps/web_app/src/services/legalDocument.ts`を作成し、Firebase Storageから法的文書のMarkdownを取得するサービスを実装する。
  - `getDocument(documentType: string, locale: string): Promise<string>`メソッドを実装する。
  - Firebase Storage SDK（`getStorage`, `ref`, `getDownloadURL`）を使用してファイルを取得する。
  - エラーハンドリング（ファイル未存在、ネットワークエラー、認証エラー）を実装する。
  - _Requirements: 2_

- [x] 4. Webアプリ: LegalDocumentViewerコンポーネントの実装 (P)
  - `apps/web_app/src/components/LegalDocumentViewer.vue`を作成し、Storageから取得したMarkdownをHTMLに変換して表示するコンポーネントを実装する。
  - `marked`ライブラリを使用してMarkdownをHTMLに変換する（既存の`package.json`に含まれている）。
  - ローディング状態、エラー状態、コンテンツ表示状態を管理する。
  - Vuetifyのダイアログまたは専用ページでMarkdownコンテンツを表示する。
  - 既存のスタイル（`/css/style.css`）を適用して一貫性を保つ。
  - _Requirements: 2_

- [x] 5. Webアプリ: SettingsViewの更新
  - `apps/web_app/src/views/SettingsView.vue`の`openLink`関数を置き換え、外部URLへの直接リンクではなく`LegalDocumentViewer`コンポーネントを表示するように変更する。
  - `getPrivacyPolicyUrl`, `getTermsOfServiceUrl`, `getCommercialTransactionUrl`関数を削除または非推奨化する。
  - 法的文書リンクのクリック時に、適切な`documentType`と`locale`を渡して`LegalDocumentViewer`を表示する。
  - 特定商取引法に基づく表記は日本語環境でのみ表示し、Pricing/Billingは英語環境でのみ表示するロジックを維持する。
  - _Requirements: 2_

- [x] 6. Flutterアプリ: flutter_markdownパッケージの追加 (P)
  - `apps/mobile_app/pubspec.yaml`に`flutter_markdown`パッケージを追加する。
  - `flutter pub get`を実行して依存関係を更新する。
  - _Requirements: 3_

- [x] 7. Flutterアプリ: LegalDocumentServiceの実装 (P)
  - `apps/mobile_app/lib/services/legal_document_service.dart`を作成し、Firebase Storageから法的文書のMarkdownを取得するサービスを実装する。
  - `Future<String> getDocument(String documentType, String locale)`メソッドを実装する。
  - Firebase Storage SDK（`FirebaseStorage.instance.ref()`）を使用してファイルを取得する。
  - UTF-8エンコーディングでMarkdownコンテンツをデコードする。
  - エラーハンドリング（ファイル未存在、ネットワークエラー、認証エラー）を実装する。
  - _Requirements: 3_

- [x] 8. Flutterアプリ: LegalDocumentScreenの実装 (P)
  - `apps/mobile_app/lib/screens/legal_document_screen.dart`を作成し、Storageから取得したMarkdownを表示する画面を実装する。
  - `flutter_markdown`パッケージを使用してMarkdownを表示する。
  - ローディング状態、エラー状態、コンテンツ表示状態を管理する。
  - AppBarに戻るボタンとタイトルを表示する。
  - エラー時はSnackBarでエラーメッセージを表示する。
  - _Requirements: 3_

- [x] 9. Flutterアプリ: settings_screenの更新
  - `apps/mobile_app/lib/screens/settings_screen.dart`の`_openLink`関数を置き換え、外部URLへの直接リンクではなく`LegalDocumentScreen`に遷移するように変更する。
  - `_getPrivacyPolicyUrl`, `_getTermsOfServiceUrl`, `_getCommercialTransactionUrl`関数を削除または非推奨化する。
  - 法的文書リンクのタップ時に、適切な`documentType`と`locale`を渡して`LegalDocumentScreen`に遷移する。
  - 特定商取引法に基づく表記は日本語環境でのみ表示し、Pricing/Billingは英語環境でのみ表示するロジックを維持する。
  - _Requirements: 3_

- [x] 10. 法的文書のStorageへのアップロード（初回セットアップ）
  - アップロードスクリプト（Task 2）を実行し、既存のMarkdownファイルをStorageにアップロードする。
  - アップロードされたファイルが正しく格納されていることを確認する。
  - 各ファイルのメタデータ（contentType、ファイルサイズなど）が適切に設定されていることを確認する。
  - 検証スクリプト（`scripts/verify-legal-docs.ts`）を作成し、アップロード後の検証を自動化。
  - **注意**: 実行にはFirebase Admin SDKの認証情報（サービスアカウントキーまたはgcloud認証）が必要。
  - _Requirements: 1_

- [x]* 11. Webアプリ: 単体テストの追加
  - `LegalDocumentService`の単体テストを実装する（Storageからの取得ロジック、エラーハンドリング）。
  - `LegalDocumentViewer`コンポーネントの単体テストを実装する（Markdown変換、ローディング/エラー状態の表示）。
  - _Requirements: 2_

- [x]* 12. Flutterアプリ: 単体テストの追加
  - `LegalDocumentService`の単体テストを実装する（Storageからの取得ロジック、エラーハンドリング）。
  - `LegalDocumentScreen`の単体テストを実装する（Markdown表示、ローディング/エラー状態の表示）。
  - _Requirements: 3_

- [x]* 13. 統合テスト: Webアプリでの法的文書表示
  - 設定画面から各法的文書タイプ（利用規約、プライバシーポリシー、特定商取引法/Pricing）が正しく表示されることを確認する。
  - 言語切り替え時に適切な文書が表示されることを確認する。
  - エラーケース（ファイル未存在、ネットワークエラー）の動作を確認する。
  - _Requirements: 2_

- [x]* 14. 統合テスト: Flutterアプリでの法的文書表示
  - 設定画面から各法的文書タイプ（利用規約、プライバシーポリシー、特定商取引法/Pricing）が正しく表示されることを確認する。
  - 言語切り替え時に適切な文書が表示されることを確認する。
  - エラーケース（ファイル未存在、ネットワークエラー）の動作を確認する。
  - _Requirements: 3_

- [x]* 15. Storageルールの検証
  - 認証ユーザーが法的文書を読み取れることを確認する。
  - 未認証ユーザーが法的文書を読み取れないことを確認する。
  - 管理者以外が法的文書を書き込めないことを確認する。
  - _Requirements: 1_

