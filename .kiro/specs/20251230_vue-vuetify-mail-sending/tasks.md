# Implementation Plan

- [x] 1. 型定義の追加
- [x] 1.1 (P) メール送信関連の型定義を追加する
  - `apps/web_app/src/types/mail.ts`に`SendMailRequest`インターフェースを追加する
  - `apps/web_app/src/types/mail.ts`に`SendMailResponse`インターフェースを追加する
  - `apps/web_app/src/types/mail.ts`に`ComposeAttachment`インターフェースを追加する
  - 既存のバックエンドAPI（`sendMail`関数）のインターフェースと整合性を保つ
  - TypeScriptのstrict modeでコンパイルエラーが発生しないことを確認する
  - _Requirements: 6.1,6.2,6.3,6.4,6.5,6.6_

- [x] 2. サービス層の実装
- [x] 2.1 (P) mailServiceにsendMail関数を追加する
  - `apps/web_app/src/services/mail.ts`に`sendMail`関数を実装する
  - Firebase Cloud Functions SDK（`httpsCallable`）を使用して`sendMail` Cloud Functionを呼び出す
  - リージョン（`asia-northeast1`）を指定する
  - 認証トークンは自動的に付与される
  - リクエストパラメータ（`accountId`、`to`、`cc`、`bcc`、`subject`、`body`、`attachments`、`threadId`、`inReplyToMessageId`）を送信する
  - 添付ファイルをBase64エンコードして送信する
  - エラーハンドリングを実装し、適切なエラーメッセージを返す
  - _Requirements: 2.1,2.2,2.3,2.4,2.5,2.6,2.7,2.8,2.9,2.10,2.11,2.12,2.13,2.14,2.15,2.16_

- [x] 3. ストアの拡張
- [x] 3.1 (P) mailStoreにメール送信関連の状態とメソッドを追加する
  - `apps/web_app/src/stores/mail.ts`に`isSending` refを追加する
  - `apps/web_app/src/stores/mail.ts`に`sendError` refを追加する
  - `sendMail`関数を実装する（mailService.sendMailを呼び出す）
  - `clearSendError`関数を実装する
  - エラーハンドリングを実装する
  - _Requirements: 5.1,5.2,5.3,5.4,5.5,5.6,5.7,5.8,5.9,5.10_

- [x] 4. ルーティングの追加
- [x] 4.1 (P) メール作成画面のルートを追加する
  - `apps/web_app/src/router/index.ts`に`/compose`ルートを追加する
  - ルート名は`compose`とする
  - `meta: { requiresAuth: true }`を設定する
  - クエリパラメータ（`reply`、`replyAll`、`forward`）をサポートする
  - _Requirements: 4.1,4.2,4.10_

- [x] 5. 国際化リソースの追加
- [x] 5.1 (P) メール送信関連の翻訳キーを追加する
  - `apps/web_app/src/locales/ja.json`にメール作成画面の日本語翻訳を追加する
  - `apps/web_app/src/locales/en.json`にメール作成画面の英語翻訳を追加する
  - `mail.compose.*`キーを使用する（既存の命名規則に従う）
  - `mail.sent`キーを追加する（送信済みフォルダ用）
  - _Requirements: 7.1,7.2,7.3,7.4,7.5,7.6_

- [x] 6. ComposeViewコンポーネントの実装
- [x] 6.1 (P) ComposeViewコンポーネントを作成する
  - `apps/web_app/src/views/ComposeView.vue`を作成する
  - Vue 3 Composition APIを使用する
  - Vuetifyのコンポーネント（`v-card`、`v-text-field`、`v-textarea`、`v-btn`等）を使用する
  - レスポンシブ対応（デスクトップ・モバイル）
  - _Requirements: 1.24,4.7,4.8_

- [x] 6.2 (P) ComposeViewにフォーム入力フィールドを実装する
  - 送信元アカウント選択ドロップダウンを実装する（SMTP設定があるアクティブなアカウントのみ表示）
  - 宛先（To）入力フィールドを実装する
  - Cc入力フィールドを実装する（展開可能な形式、デフォルトは非表示）
  - Bcc入力フィールドを実装する（展開可能な形式、デフォルトは非表示）
  - 件名入力フィールドを実装する
  - 本文入力エリアを実装する（プレーンテキスト）
  - 国際化リソースを使用する
  - _Requirements: 1.6,1.7,1.8,1.9,1.10,1.11,1.25_

- [x] 6.3 (P) ComposeViewに添付ファイル機能を実装する
  - 添付ファイル追加ボタンを実装する
  - ファイル選択ダイアログを実装する（`<input type="file">`を使用）
  - 選択されたファイル名とファイルサイズを表示する
  - 添付ファイル削除機能を実装する
  - 添付ファイル一覧を表示する
  - _Requirements: 1.12,1.13,1.14,1.15,1.16_

- [x] 6.4 (P) ComposeViewにフォームバリデーションを実装する
  - 宛先（To）の必須チェックを実装する
  - メールアドレス形式の検証を実装する
  - 件名の必須チェックを実装する
  - 本文の必須チェックを実装する
  - エラーメッセージをフィールド直下に表示する（`v-alert`または`v-text-field`の`error-messages`を使用）
  - _Requirements: 1.17,1.18_

- [x] 6.5 (P) ComposeViewにメール送信機能を実装する
  - 送信ボタンを実装する
  - 送信処理を実装する（mailStore.sendMailを呼び出す）
  - ローディングインジケーターを表示する（送信ボタンの`loading` propを使用）
  - 送信ボタンを無効化する（`disabled` propを使用）
  - 送信成功時に成功メッセージを表示する（`v-snackbar`を使用）
  - 送信成功時にメール作成画面を閉じてメール一覧画面に戻る
  - エラーメッセージを表示する（`v-snackbar`を使用）
  - _Requirements: 1.17,1.18,1.19,2.9,2.10,2.11,2.12,5.6,5.7_

- [x] 6.6 (P) ComposeViewにキャンセル機能を実装する
  - キャンセルボタンを実装する
  - 入力内容がある場合、確認ダイアログを表示する（`v-dialog`を使用）
  - 確認ダイアログで「破棄」を選択した場合、メール作成画面を閉じ、入力内容を破棄する
  - 確認ダイアログで「キャンセル」を選択した場合、確認ダイアログを閉じ、メール作成画面を保持する
  - _Requirements: 1.20,1.21,1.22,1.23_

- [x] 6.7 (P) ComposeViewに返信・転送機能を実装する
  - ルートクエリパラメータから作成モード（`reply`、`replyAll`、`forward`）を判定する
  - 返信モード：元のメールを取得し、送信者を宛先に、件名に`Re: `プレフィックスを追加する
  - 全員に返信モード：元のメールを取得し、送信者とCc受信者を宛先に、件名に`Re: `プレフィックスを追加する
  - 転送モード：元のメールを取得し、件名に`Fw: `プレフィックスを追加し、本文に元のメール内容を含める
  - 転送モード：元のメールの添付ファイルを`downloadAttachment` Cloud Functionを使用して取得し、添付ファイル一覧に追加する
  - 元のメール情報を適切にフォーマットして表示する
  - `threadId`と`inReplyToMessageId`を設定する
  - _Requirements: 1.2,1.3,1.4,1.5,1.26,1.27,2.8,2.9,4.2,4.3,4.4,4.5,4.6_

- [x] 6.8 (P) ComposeViewに送信元アカウント取得機能を実装する
  - accountServiceを使用してアカウント一覧を取得する
  - SMTP設定があるアクティブなアカウントのみをフィルタリングする
  - 複数のアカウントがある場合、デフォルトで最初のアカウントを選択する
  - _Requirements: 1.6,1.7_

- [x] 7. 既存コンポーネントの拡張
- [x] 7.1 (P) MailListPanelにFABを追加する
  - `apps/web_app/src/components/MailListPanel.vue`にFAB（Floating Action Button）を追加する
  - 画面右下に配置する（`v-fab`コンポーネントまたは`v-btn` with `fixed` propを使用）
  - FABクリック時に`/compose`ルートに遷移する
  - _Requirements: 1.1_

- [x] 7.2 (P) MailDetailPanelに返信・転送ハンドラを実装する
  - `apps/web_app/src/components/MailDetailPanel.vue`の`handleReply`関数を実装する
  - `/compose?reply=${messageId}`ルートに遷移する
  - `apps/web_app/src/components/MailDetailPanel.vue`の`handleReplyAll`関数を実装する
  - `/compose?replyAll=${messageId}`ルートに遷移する
  - `apps/web_app/src/components/MailDetailPanel.vue`の`handleForward`関数を実装する
  - `/compose?forward=${messageId}`ルートに遷移する
  - _Requirements: 1.2,1.3,1.4,4.3,4.4,4.5,4.6_

- [x] 7.3 (P) App.vueに「送信済み」メニュー項目を追加する
  - `apps/web_app/src/App.vue`の`navItems`配列に「送信済み」メニュー項目を追加する
  - 受信トレイ、すべてのメール、送信済み、ゴミ箱、設定の順序とする
  - `route: { name: 'mail-list', query: { label: 'sent' } }`を設定する
  - アイコンは`mdi-send`を使用する
  - 国際化リソース（`mail.sent`）を使用する
  - _Requirements: 3.1,3.2,7.2_

- [x] 8. 送信済みフォルダのサポート（既存機能の活用）
- [x] 8.1 (I) 送信済みフォルダの表示を確認する
  - 既存の`mailService.fetchThreads`関数が`label='sent'`をサポートしていることを確認する
  - 既存の`MailListView`コンポーネントが`label=sent`クエリパラメータをサポートしていることを確認する
  - 必要に応じて修正する
  - _Requirements: 3.3,3.4,3.5,3.6,3.7,3.8,3.9,3.10,3.11_

- [ ] 9. テストの実装
- [x] 9.1 (P) mailService.sendMail()のユニットテストを実装する
  - `apps/web_app/src/services/__tests__/mail.test.ts`に`sendMail`関数のテストを追加する
  - Firebase Cloud Functions SDK（`httpsCallable`）をモックする
  - 正常系：メール送信が成功する場合のテスト
  - 異常系：エラーが発生する場合のテスト（認証エラー、パラメータエラー、SMTP接続エラー等）
  - 添付ファイルを含むメール送信のテスト
  - 返信・転送時の`threadId`と`inReplyToMessageId`の設定をテストする
  - Vitestとモックを使用する
  - _Requirements: 2.9,2.10,2.11,2.12,2.13,2.14,2.15,2.16_

- [x] 9.2 (P) useMailStore.sendMail()のユニットテストを実装する
  - `apps/web_app/src/stores/__tests__/mail.test.ts`に`sendMail`関数のテストを追加する
  - `mailService.sendMail`をモックする
  - 正常系：メール送信が成功する場合のテスト（`isSending`、`sendError`の状態変化を確認）
  - 異常系：エラーが発生する場合のテスト（`sendError`の状態を確認）
  - `clearSendError`関数のテスト
  - Piniaストアの状態管理をテストする
  - Vitestとモックを使用する
  - _Requirements: 5.1,5.2,5.3,5.4,5.5,5.6,5.7,5.8,5.9,5.10_

- [x] 9.3 (P) ComposeViewコンポーネントのユニットテストを実装する
  - `apps/web_app/src/views/__tests__/ComposeView.test.ts`を作成する
  - `@vue/test-utils`を使用してコンポーネントをマウントする
  - フォームバリデーションのテスト（宛先の必須チェック、メールアドレス形式の検証、件名の必須チェック、本文の必須チェック）
  - 添付ファイル追加・削除機能のテスト
  - 送信ボタンのクリック時の動作をテストする
  - キャンセルボタンのクリック時の動作をテストする（確認ダイアログの表示）
  - 返信モードのテスト（クエリパラメータ`reply`から元のメールを取得し、適切にフォームを初期化）
  - 全員に返信モードのテスト（クエリパラメータ`replyAll`から元のメールを取得し、適切にフォームを初期化）
  - 転送モードのテスト（クエリパラメータ`forward`から元のメールを取得し、適切にフォームを初期化、添付ファイルも含める）
  - 送信元アカウント選択のテスト（SMTP設定があるアカウントのみ表示）
  - Vitestと`@vue/test-utils`を使用する
  - _Requirements: 1.17,1.18,1.20,1.21,1.22,1.23,1.2,1.3,1.4,1.5,1.6,1.7,6.4,6.5,6.6,6.7,6.8_

- [x] 9.4 (I) メール送信フローの統合テストを実装する
  - `apps/web_app/src/__tests__/integration/sendMail.test.ts`を作成する
  - エンドツーエンドのメール送信フローをテストする（モックCloud Functions使用）
  - ComposeViewからmailStore、mailServiceを経由してCloud Functionsを呼び出すまでのフローをテストする
  - 送信成功時の画面遷移をテストする
  - 送信失敗時のエラーメッセージ表示をテストする
  - Vitestとモックを使用する
  - _Requirements: 1.19,2.9,2.10,2.11,2.12,4.9_

- [x] 9.5 (I) 返信・転送フローの統合テストを実装する
  - `apps/web_app/src/__tests__/integration/replyForward.test.ts`を作成する
  - 返信フロー：元のメール取得からメール送信までをテストする
  - 全員に返信フロー：元のメール取得からメール送信までをテストする
  - 転送フロー：元のメール取得、添付ファイル取得、メール送信までをテストする
  - `downloadAttachment` Cloud Functionの呼び出しをモックする
  - Vitestとモックを使用する
  - _Requirements: 1.2,1.3,1.4,1.5,1.27,2.8,2.9,6.7_

- [x] 9.6 (I) 型定義のテストを実装する
  - TypeScriptの型チェックを実行する（`npm run build`で確認）
  - `SendMailRequest`、`SendMailResponse`、`ComposeAttachment`の型定義が正しいことを確認する
  - 既存のバックエンドAPI（`sendMail`関数）のインターフェースと整合性を保つことを確認する
  - TypeScriptのstrict modeでコンパイルエラーが発生しないことを確認する
  - _Requirements: 6.4,6.5,6.6_

