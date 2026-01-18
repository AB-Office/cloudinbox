# Implementation Plan

## Tasks

- [x] 1. Firestoreセキュリティルールの更新
  - `infra/firebase/firestore.rules`を更新し、認証済みユーザーが自分の`legalConsents`フィールドを読み書きできるようにする。
  - 既存のルール（`users/{uid}`の`plan`、`usage`など）は維持する。
  - _Requirements: 1_

- [x] 2. Webアプリ: 法的文書メタデータ取得機能の実装
  - `apps/web_app/src/services/legalDocument.ts`に`getDocumentMetadata`関数を追加する。
  - `getDocumentMetadata(documentType: 'terms' | 'privacy', locale: Locale): Promise<string>`関数を実装する。
  - Firebase Storage SDKの`getMetadata`関数を使用してメタデータを取得する。
  - `updated`フィールドが存在する場合はそれを使用、なければ`timeCreated`を使用する。
  - ISO 8601形式の文字列として返す。
  - エラーハンドリング（ファイル未存在、ネットワークエラー、認証エラー）を実装する。
  - 既存の`getDocument`関数は変更不要。
  - _Requirements: 2_

- [x] 3. Flutterアプリ: 法的文書メタデータ取得機能の実装
  - `apps/mobile_app/lib/services/legal_document_service.dart`の`LegalDocumentService`クラスに`getDocumentMetadata`メソッドを追加する。
  - `Future<String> getDocumentMetadata(String documentType, String locale)`メソッドを実装する。
  - Firebase Storage SDKの`getMetadata()`メソッドを使用してメタデータを取得する。
  - `updated`フィールドが存在する場合はそれを使用、なければ`timeCreated`を使用する。
  - ISO 8601形式の文字列として返す。
  - エラーハンドリング（ファイル未存在、ネットワークエラー、認証エラー）を実装する。
  - 既存の`getDocument`メソッドは変更不要。
  - _Requirements: 2_

- [x] 4. Webアプリ: ConsentStore（Piniaストア）の実装
  - `apps/web_app/src/stores/consent.ts`を作成し、同意状態を管理するPiniaストアを実装する。
  - `legalConsents`、`isLoading`、`needsReconsent`の状態を定義する。
  - `checkConsentStatus()`: ユーザードキュメントから`legalConsents`を取得し、Storageから法的文書のメタデータを取得して比較する。
  - `saveConsent(termsVersion: string, privacyVersion: string)`: Firestoreに同意情報を保存する。
  - `isConsentRequired()`: 同意が必要かどうかを判定する（`legalConsents`が`null`、または文書の更新日付がユーザーの同意日付より新しい場合に`true`を返す）。
  - バージョン比較はISO 8601形式の文字列で行う。
  - _Requirements: 3_

- [x] 5. Webアプリ: LegalConsentViewコンポーネントの実装
  - `apps/web_app/src/views/LegalConsentView.vue`を作成し、同意チェック画面を実装する。
  - Vuetifyの`v-checkbox`コンポーネントを使用して利用規約とプライバシーポリシーのチェックボックスを表示する。
  - 両方のチェックが入っていない場合、「同意する」ボタンを無効化する。
  - 同意時に`ConsentStore.saveConsent()`を呼び出してFirestoreに同意情報を保存する。
  - 再確認の場合（`isReconsent`が`true`）は、更新された文書へのリンクを表示する（`LegalDocumentViewer`コンポーネントを使用）。
  - ローディング状態とエラー状態を管理する。
  - 同意保存後、`/`ルート（メイン画面）にリダイレクトする。
  - _Requirements: 3_

- [x] 6. Webアプリ: ルーターにlegal-consentルートを追加
  - `apps/web_app/src/router/index.ts`に`legal-consent`ルートを追加する。
  - パス: `/legal-consent`、コンポーネント: `LegalConsentView`
  - `meta.requiresAuth: true`を設定する（認証が必要）。
  - 同意チェック画面自体は同意チェックをスキップする必要があるため、`meta.skipConsentCheck: true`を追加する（またはガード内で特別処理する）。
  - _Requirements: 3_

- [x] 7. Webアプリ: ルーターガードに同意チェックを追加
  - `apps/web_app/src/router/index.ts`の`beforeEach`ガードに同意チェックロジックを追加する。
  - 既存の認証チェックの後に同意チェックを実行する。
  - `ConsentStore.isConsentRequired()`を呼び出して同意が必要かどうかを判定する。
  - 同意が必要で、かつ`legal-consent`ルート以外の場合、`legal-consent`ルートにリダイレクトする。
  - `legal-consent`ルートの場合は同意チェックをスキップする（無限ループを防止）。
  - _Requirements: 3_

- [x] 8. Flutterアプリ: ConsentServiceの実装
  - `apps/mobile_app/lib/services/consent_service.dart`を作成し、同意状態を管理するサービスを実装する。
  - `Future<LegalConsents?> getConsents()`: Firestoreからユーザーの同意情報を取得する。
  - `Future<bool> isConsentRequired()`: 同意が必要かどうかを判定する（ユーザードキュメントから`legalConsents`を取得し、Storageから法的文書のメタデータを取得して比較する）。
  - `Future<void> saveConsent(String termsVersion, String privacyVersion)`: Firestoreに同意情報を保存する。
  - バージョン比較はISO 8601形式の文字列で行う。
  - エラーハンドリングを実装する（Firestore取得エラー、Storageメタデータ取得エラーなど）。
  - _Requirements: 4_

- [x] 9. Flutterアプリ: LegalConsentScreenの実装
  - `apps/mobile_app/lib/screens/legal_consent_screen.dart`を作成し、同意チェック画面を実装する。
  - Material Designの`Checkbox`ウィジェットを使用して利用規約とプライバシーポリシーのチェックボックスを表示する。
  - 両方のチェックが入っていない場合、「同意する」ボタンを無効化する。
  - 同意時に`ConsentService.saveConsent()`を呼び出してFirestoreに同意情報を保存する。
  - 再確認の場合（`isReconsent`が`true`）は、更新された文書へのリンクを表示する（`LegalDocumentScreen`を使用）。
  - ローディング状態とエラー状態を管理する。
  - 同意保存後、メイン画面（`/inbox`）に遷移する。
  - _Requirements: 4_

- [x] 10. Flutterアプリ: main.dartの認証フローに同意チェックを追加
  - `apps/mobile_app/lib/main.dart`の`_MyAppState`クラスの認証フローに同意チェックを追加する。
  - 認証済みユーザーの場合、`ConsentService.isConsentRequired()`を呼び出して同意が必要かどうかを判定する。
  - 同意が必要な場合、`LegalConsentScreen`を表示する。
  - 同意不要または同意済みの場合、通常のメイン画面を表示する。
  - 既存の認証フロー（`StreamBuilder<User?>`）は維持する。
  - _Requirements: 4_

- [x] 11. Webアプリ: 単体テストの追加
  - `apps/web_app/src/services/legalDocument.ts`の`getDocumentMetadata`関数の単体テストを実装する。
  - `apps/web_app/src/stores/consent.ts`の`ConsentStore`の単体テストを実装する（`isConsentRequired`、`saveConsent`、`checkConsentStatus`）。
  - バージョン比較ロジックの単体テストを実装する（ISO 8601文字列の比較）。
  - _Requirements: 2, 3_

- [x] 12. Flutterアプリ: 単体テストの追加
  - `apps/mobile_app/lib/services/legal_document_service.dart`の`getDocumentMetadata`メソッドの単体テストを実装する。
  - `apps/mobile_app/lib/services/consent_service.dart`の`ConsentService`の単体テストを実装する（`isConsentRequired`、`saveConsent`、`getConsents`）。
  - バージョン比較ロジックの単体テストを実装する（ISO 8601文字列の比較）。
  - _Requirements: 2, 4_

- [x] 13. 統合テスト: Webアプリでの同意フロー
  - 新規ユーザーの同意フローをテストする（認証後、同意チェック画面が表示され、同意後メイン画面に遷移することを確認）。
  - 既存ユーザーの再確認フローをテストする（文書が更新された場合、同意チェック画面が再表示されることを確認）。
  - 同意済みユーザーの通常フローをテストする（同意済みの場合、同意チェック画面をスキップしてメイン画面が表示されることを確認）。
  - ルーターガードが正しく動作することを確認する（未同意ユーザーはメイン画面にアクセスできない）。
  - _Requirements: 3_

- [x] 14. 統合テスト: Flutterアプリでの同意フロー
  - 新規ユーザーの同意フローをテストする（認証後、同意チェック画面が表示され、同意後メイン画面に遷移することを確認）。
  - 既存ユーザーの再確認フローをテストする（文書が更新された場合、同意チェック画面が再表示されることを確認）。
  - 同意済みユーザーの通常フローをテストする（同意済みの場合、同意チェック画面をスキップしてメイン画面が表示されることを確認）。
  - ナビゲーション制御が正しく動作することを確認する（未同意ユーザーはメイン画面にアクセスできない）。
  - _Requirements: 4_

- [x] 15. Firestoreルールの検証
  - 認証済みユーザーが自分の`legalConsents`フィールドを読み書きできることを確認する。
  - 認証済みユーザーが他のユーザーの`legalConsents`フィールドを読み書きできないことを確認する。
  - 未認証ユーザーが`legalConsents`フィールドにアクセスできないことを確認する。
  - _Requirements: 1_

