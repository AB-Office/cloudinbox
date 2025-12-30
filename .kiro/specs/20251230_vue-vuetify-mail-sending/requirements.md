# Requirements Document

## Project Description (Input)
Vue+Vuetifyのアプリにメール送信機能を追加してください

## Introduction

CloudInboxサービスは現在Vue.jsとVuetifyを使用したWebアプリケーションとしてメール受信・閲覧機能を提供しています。また、バックエンド（Cloud Functions）には既にメール送信機能（`sendMail`関数）が実装されています。本要件書は、既存のバックエンドインフラを活用し、Vue.jsとVuetifyを使用してWebアプリケーションにメール送信機能を追加するための要件を定義します。

既存のメール受信機能と同様に、Firebase認証、Firestore、Cloud Functions経由でのメール送信を実装し、Webブラウザからメールを作成・送信できるようにします。また、送信済みメールの表示機能も実装します。

## Requirements

### Requirement 1: メール作成・送信UIの実装

**Objective:** As a ユーザー, I want 直感的なUIでメールを作成・送信できること, so that 効率的にメールを送信できる

#### Acceptance Criteria

1. When ユーザーがメール一覧画面で画面右下の「＋」（プラス）アイコンのFloating Action Button（FAB）をクリックする, CloudInbox shall メール作成画面を表示する
2. When ユーザーがメール詳細画面のケバブメニューから「返信」を選択する, CloudInbox shall メール作成画面を表示し、返信先（送信者）と件名（`Re: `プレフィックスを追加）を自動入力する
3. When ユーザーがメール詳細画面のケバブメニューから「全員に返信」を選択する, CloudInbox shall メール作成画面を表示し、返信先（送信者とCc受信者）と件名（`Re: `プレフィックスを追加）を自動入力する
4. When ユーザーがメール詳細画面のケバブメニューから「転送」を選択する, CloudInbox shall メール作成画面を表示し、件名（`Fw: `プレフィックスを追加）と本文（転送元メールの内容を含む）を自動入力する
5. When ユーザーがメール詳細画面のケバブメニューから「転送」を選択する, CloudInbox shall 転送元メールの添付ファイルを自動的に添付ファイル一覧に追加する
6. When メール作成画面が表示される, CloudInbox shall 送信元アカウント選択ドロップダウンを表示する（SMTP設定があるアクティブなアカウントのみ表示）
7. When メール作成画面が表示される, CloudInbox shall 複数のアカウントがある場合、デフォルトで最初のアカウントを選択する
8. When メール作成画面が表示される, CloudInbox shall 宛先（To）入力フィールドを表示する
9. When メール作成画面が表示される, CloudInbox shall Cc入力フィールドを表示する（展開可能な形式、デフォルトは非表示）
10. When メール作成画面が表示される, CloudInbox shall Bcc入力フィールドを表示する（展開可能な形式、デフォルトは非表示）
11. When メール作成画面が表示される, CloudInbox shall 件名入力フィールドを表示する
12. When メール作成画面が表示される, CloudInbox shall 本文入力エリアを表示する（リッチテキストエディタまたはプレーンテキストエリア）
13. When メール作成画面が表示される, CloudInbox shall 添付ファイル追加ボタンを表示する
14. When ユーザーが添付ファイルを追加する, CloudInbox shall ファイル選択ダイアログを表示する
15. When ユーザーが添付ファイルを追加する, CloudInbox shall 選択されたファイル名とファイルサイズを表示する
16. When ユーザーが添付ファイルを削除する, CloudInbox shall 添付ファイル一覧から該当ファイルを削除する
17. When メール作成画面で「送信」ボタンをクリックする, CloudInbox shall 入力検証を実行する（宛先の必須チェック、メールアドレス形式の検証、件名の必須チェック等）
18. If 入力検証が失敗する, CloudInbox shall エラーメッセージを表示する（Vuetifyの`v-alert`または`v-snackbar`を使用）
19. When メール送信が成功する, CloudInbox shall 成功メッセージを表示し、メール作成画面を閉じてメール一覧画面に戻る
20. When メール送信中である, CloudInbox shall ローディングインジケーターを表示し、送信ボタンを無効化する
21. When メール作成画面で「キャンセル」ボタンをクリックする, CloudInbox shall 入力内容がある場合、確認ダイアログを表示する
22. When ユーザーが確認ダイアログで「破棄」を選択する, CloudInbox shall メール作成画面を閉じ、入力内容を破棄する
23. When ユーザーが確認ダイアログで「キャンセル」を選択する, CloudInbox shall 確認ダイアログを閉じ、メール作成画面を保持する
24. The CloudInbox shall メール作成画面のUIはVuetifyのコンポーネント（`v-card`、`v-text-field`、`v-textarea`、`v-btn`等）を使用して実装する
25. The CloudInbox shall メール作成画面の文字列を国際化対応する（日本語・英語）
26. When メール作成画面が表示される（返信・転送の場合）, CloudInbox shall 元のメール情報（件名、本文等）を適切にフォーマットして表示する
27. When 転送時に添付ファイルを追加する, CloudInbox shall 既存のCloud Functions（`downloadAttachment`）を使用して添付ファイルを取得し、Base64エンコードしてメール送信に含める

### Requirement 2: メール送信バックエンドAPIとの統合

**Objective:** As a 開発者, I want 既存のCloud Functions APIを活用できること, so that バックエンドロジックを再利用できる

#### Acceptance Criteria

1. When メール送信が実行される, CloudInbox shall 既存のCloud Functions（`sendMail`）を呼び出す
2. When Cloud Functionsを呼び出す, CloudInbox shall Firebase Cloud Functions SDK（`httpsCallable`）を使用する
3. When Cloud Functionsを呼び出す, CloudInbox shall 認証トークンを自動的に付与する
4. When Cloud Functionsを呼び出す, CloudInbox shall リージョン（`asia-northeast1`）を指定する
5. When メール送信関数を呼び出す, CloudInbox shall リクエストパラメータ（`accountId`、`to`、`cc`、`bcc`、`subject`、`body`、`attachments`、`threadId`、`inReplyToMessageId`）を送信する
6. When 添付ファイルを送信する, CloudInbox shall ファイルをBase64エンコードして送信する
7. When 添付ファイルを送信する, CloudInbox shall ファイル名とContent-Typeを含める
8. When 返信・転送の場合, CloudInbox shall 元のメールの`threadId`と`messageId`を適切に設定する
9. When 転送の場合, CloudInbox shall 転送元メールの添付ファイルを既存のCloud Functions（`downloadAttachment`）を使用して取得し、Base64エンコードしてメール送信リクエストに含める
10. If Cloud Functions呼び出しでエラーが発生する, CloudInbox shall エラーレスポンスを適切に処理し、ユーザーに分かりやすいエラーメッセージを表示する
11. If SMTP接続エラーが発生する, CloudInbox shall 適切なエラーメッセージを表示する
12. If 認証エラーが発生する, CloudInbox shall 認証エラーメッセージを表示する
13. If メール送信がタイムアウトする, CloudInbox shall タイムアウトエラーメッセージを表示する
14. The CloudInbox shall メール送信サービスを`apps/web_app/src/services/mail.ts`に追加する
15. The CloudInbox shall メール送信サービスの関数名を`sendMail`とする
16. The CloudInbox shall メール送信サービスの関数は型安全に実装する（TypeScriptの型定義を使用）

### Requirement 3: 送信済みフォルダの表示機能

**Objective:** As a ユーザー, I want 送信したメールを確認できること, so that 送信履歴を閲覧できる

#### Acceptance Criteria

1. When ユーザーがナビゲーションドロワー（ハンバーガーメニュー）を開く, CloudInbox shall 「送信済み」メニュー項目を追加する（受信トレイ、すべてのメール、送信済み、ゴミ箱、設定の順序）
2. When ユーザーがナビゲーションドロワーの「送信済み」をクリックする, CloudInbox shall `labels`に`sent`を含むメールスレッド一覧を表示するメール一覧画面を表示する
3. When 送信済みフォルダを表示する, CloudInbox shall 既存のメール一覧画面（`MailListView.vue`）を使用し、クエリパラメータ`label=sent`でフィルタリングする
4. When 送信済みフォルダを表示する, CloudInbox shall 既存のメールサービス（`mailService.getThreads`）を使用して、`labels`に`sent`を含むメールスレッド一覧を取得する
5. When 送信済みフォルダを表示する, CloudInbox shall メールスレッドを`lastMessageAt`の降順でソートする
6. When 送信済みフォルダを表示する, CloudInbox shall ページネーション対応で、画面サイズに応じた件数で初期表示・追加読み込みを行う
7. When 送信済みメールの詳細を表示する, CloudInbox shall 既存のメール詳細表示機能を使用して、メール内容を表示する
8. When 送信済みメールを表示する, CloudInbox shall 送信元アカウント情報、受信者情報、送信日時を表示する
9. The CloudInbox shall 送信済みフォルダのUIは既存のメール一覧・詳細表示機能を再利用する
10. The CloudInbox shall 送信済みフォルダの文字列を国際化対応する（日本語・英語）
11. When 送信済みフォルダを表示する, CloudInbox shall ルートのクエリパラメータ`label=sent`を使用する（既存の`label=inbox`、`label=trash`、`label=all`と同様）

### Requirement 4: ルーティングとナビゲーションの拡張

**Objective:** As a ユーザー, I want メール作成画面への適切なナビゲーションが機能すること, so that スムーズにメールを作成・送信できる

#### Acceptance Criteria

1. When ルーティングを設定する, CloudInbox shall vue-routerにメール作成画面のルート（`/compose`）を追加する
2. When メール作成画面のルートを設定する, CloudInbox shall クエリパラメータで返信・転送の情報を渡す（`?reply=messageId`、`?replyAll=messageId`、`?forward=messageId`）
3. When ユーザーがメール一覧画面でFABをクリックする, CloudInbox shall `/compose`ルートに遷移する
4. When ユーザーがメール詳細画面で「返信」を選択する, CloudInbox shall `/compose?reply=messageId`ルートに遷移する
5. When ユーザーがメール詳細画面で「全員に返信」を選択する, CloudInbox shall `/compose?replyAll=messageId`ルートに遷移する
6. When ユーザーがメール詳細画面で「転送」を選択する, CloudInbox shall `/compose?forward=messageId`ルートに遷移する
7. When メール作成画面が表示される（デスクトップ: 2列レイアウト）, CloudInbox shall メール一覧とメール作成画面を同時に表示する（または、メール作成画面を全画面で表示する）
8. When メール作成画面が表示される（モバイル・タブレット: 1列レイアウト）, CloudInbox shall メール作成画面を全画面で表示する
9. When メール送信が成功し、メール作成画面を閉じる, CloudInbox shall 前の画面（メール一覧またはメール詳細）に戻る
10. The CloudInbox shall メール作成画面のルートは認証が必要とする（`meta: { requiresAuth: true }`）

### Requirement 5: 状態管理とエラーハンドリング

**Objective:** As a ユーザー, I want メール送信処理が適切に状態管理され、エラーが適切に処理されること, so that 問題が発生した場合でも操作を継続できる

#### Acceptance Criteria

1. When メール送信処理を実装する, CloudInbox shall Piniaストア（`useMailStore`）にメール送信の状態を管理する
2. When メール送信中である, CloudInbox shall ローディング状態をストアで管理する
3. When メール送信が成功する, CloudInbox shall 成功状態をストアで管理する
4. If メール送信が失敗する, CloudInbox shall エラー状態をストアで管理する
5. When エラーが発生する, CloudInbox shall ユーザーに分かりやすいエラーメッセージを表示する（技術的なエラー詳細は表示しない）
6. The CloudInbox shall エラーメッセージをVuetifyのコンポーネント（`v-alert`、`v-snackbar`等）を使用して表示する
7. The CloudInbox shall ローディング状態を適切に管理し、UIに反映する（送信ボタンの無効化、ローディングインジケーターの表示等）
8. When メール送信が成功する, CloudInbox shall エラー状態をクリアする
9. When メール送信画面を開く, CloudInbox shall 前回のエラー状態をクリアする
10. The CloudInbox shall メール送信サービスのエラーハンドリングを適切に実装する（try-catch文、エラーメッセージの変換等）

### Requirement 6: 型定義とインターフェース

**Objective:** As a 開発者, I want メール送信機能の型定義が適切に定義されること, so that 型安全性を確保できる

#### Acceptance Criteria

1. When メール送信機能を実装する, CloudInbox shall メール送信リクエストの型定義を`apps/web_app/src/types/mail.ts`に追加する
2. When メール送信機能を実装する, CloudInbox shall メール送信レスポンスの型定義を`apps/web_app/src/types/mail.ts`に追加する
3. When メール送信機能を実装する, CloudInbox shall 添付ファイルの型定義を`apps/web_app/src/types/mail.ts`に追加する
4. The CloudInbox shall 既存のメール型定義（`MailMessage`、`MailThread`等）を活用する
5. The CloudInbox shall 型定義は既存のバックエンドAPI（`sendMail`関数）のインターフェースと整合性を保つ
6. The CloudInbox shall TypeScriptのstrict modeでコンパイルエラーが発生しないことを確認する

### Requirement 7: 国際化（i18n）対応

**Objective:** As a ユーザー, I want メール送信機能の画面が複数言語に対応すること, so that 日本語と英語の両方でアプリを利用できる

#### Acceptance Criteria

1. When メール送信機能を実装する, CloudInbox shall メール作成画面の文字列を国際化リソースに追加する
2. When メール送信機能を実装する, CloudInbox shall エラーメッセージの文字列を国際化リソースに追加する
3. When メール送信機能を実装する, CloudInbox shall 送信済みフォルダの文字列を国際化リソースに追加する
4. The CloudInbox shall 既存の国際化リソース（`apps/web_app/src/locales/ja.json`、`apps/web_app/src/locales/en.json`）に文字列を追加する
5. The CloudInbox shall 国際化リソースのキーは既存の命名規則に従う（例: `mail.compose.subject`、`mail.compose.send`等）
6. When アプリの言語が切り替わる, CloudInbox shall メール作成画面の文字列も即座に切り替わる

### Requirement 8: アクセシビリティとUX

**Objective:** As a ユーザー, I want メール送信機能が使いやすく、アクセシビリティに配慮されていること, so that 快適にメールを送信できる

#### Acceptance Criteria

1. When メール作成画面を実装する, CloudInbox shall Vuetifyのアクセシビリティ機能を活用する（適切なARIAラベル、キーボード操作のサポート等）
2. When メール作成画面を実装する, CloudInbox shall フォーカス管理を適切に行う（最初の入力フィールドにフォーカスを設定する等）
3. When メール送信が成功する, CloudInbox shall 成功メッセージを表示し、適切な時間後に自動的に閉じる（または手動で閉じる）
4. When エラーが発生する, CloudInbox shall エラーメッセージを適切な時間表示し、ユーザーが確認できるようにする
5. The CloudInbox shall メール作成画面のレイアウトは既存のメール詳細画面と一貫性を保つ
6. The CloudInbox shall メール作成画面のボタン配置は既存の画面と一貫性を保つ（送信ボタンは右上、キャンセルボタンは左上等）
7. When メール作成画面でキーボードショートカット（Ctrl+EnterまたはCmd+Enter）を押す, CloudInbox shall メールを送信する（オプション、将来の拡張機能）
