# Requirements Document

## Project Description (Input)
WebアプリをVue+Vuetifyで構築したい。まずはメール受信環境を構築する

## Introduction

CloudInboxサービスは現在Flutterモバイルアプリとして実装されており、Firebase Functions、Firestore、Storageを活用したメール受信・管理機能を提供しています。本要件書は、既存のバックエンドインフラを活用し、Vue.jsとVuetifyを使用してWebアプリケーションを構築し、メール受信環境（メール一覧表示、メール詳細表示）を実現するための要件を定義します。

既存のモバイルアプリと同様に、Firebase認証、Firestoreからのメールデータ取得、Cloud Functions経由でのメール本文復号化を実装し、Webブラウザからメールを閲覧できるようにします。本フェーズではメール受信・閲覧機能に焦点を当て、メール送信機能は後続フェーズで実装します。

## Requirements

### Requirement 1: Vue+Vuetifyプロジェクトのセットアップ

**Objective:** As a 開発者, I want Vue.jsとVuetifyを使用したWebアプリケーションプロジェクトをセットアップできること, so that モダンなWebアプリケーションを構築できる

#### Acceptance Criteria

1. When プロジェクトを初期化する, CloudInbox shall `apps/web_app/`ディレクトリにVue.jsプロジェクトを作成する
2. When プロジェクトをセットアップする, CloudInbox shall Vue 3（Composition API）を使用する
3. When プロジェクトをセットアップする, CloudInbox shall Vuetify 3を使用する
4. When プロジェクトをセットアップする, CloudInbox shall TypeScriptを使用する（型安全性の確保）
5. When プロジェクトをセットアップする, CloudInbox shall Viteをビルドツールとして使用する
6. When プロジェクトをセットアップする, CloudInbox shall Firebase SDK（Firebase Auth、Firestore、Cloud Functions）を依存関係に追加する
7. When プロジェクトをセットアップする, CloudInbox shall vue-router、vue-i18n、Piniaを依存関係に追加する
8. When プロジェクトをセットアップする, CloudInbox shall 既存のmonorepo構造（`apps/`ディレクトリ）に従う
9. When プロジェクトをセットアップする, CloudInbox shall 開発環境で`npm run dev`コマンドでローカル開発サーバーを起動できるようにする
10. When プロジェクトをセットアップする, CloudInbox shall 本番環境で`npm run build`コマンドでビルドできるようにする
11. The CloudInbox shall プロジェクト構造を既存のモバイルアプリ（`apps/mobile_app/`）と一貫性のある構造とする

### Requirement 2: Firebase認証の実装

**Objective:** As a ユーザー, I want WebアプリでGoogleアカウントによるログイン・ログアウトができること, so that 安全にサービスにアクセスできる

#### Acceptance Criteria

1. When ユーザーがWebアプリにアクセスする, CloudInbox shall Firebase Authで既存の認証セッションを確認する
2. When 認証セッションが無効または存在しない場合, CloudInbox shall ログイン画面を表示する
3. When ユーザーがGoogleアカウントでログインする, CloudInbox shall Firebase AuthのGoogle Sign-Inを使用して認証を実行する
4. When ユーザーがGoogleアカウントでログインに成功する, CloudInbox shall 認証トークンを取得し、セッションを確立する
5. When ユーザーがGoogleアカウントで初回ログインする, CloudInbox shall 新規ユーザーとしてアカウントを作成する（既存のFirebase Functionsの`onUserCreate`トリガーが動作）
6. When ユーザーが既存のGoogleアカウントでログインする, CloudInbox shall 既存のセッションを復元する
7. If Googleアカウントでのログインがキャンセルされる, CloudInbox shall エラーメッセージを表示せず、ログイン画面に戻る
8. If Googleアカウントでのログインが失敗する, CloudInbox shall 適切なエラーメッセージを表示する
9. When ユーザーがログアウトする, CloudInbox shall Firebase Authを使用してセッションを終了し、認証トークンを無効化する
10. When ユーザーが認証されていない状態で保護されたリソースにアクセスしようとする, CloudInbox shall ログイン画面にリダイレクトする
11. The CloudInbox shall すべてのFirestore/StorageアクセスでFirebase Authにより認証されたユーザーのUIDを検証する
12. The CloudInbox shall 認証状態の変更をリアルタイムで監視し、UIを適切に更新する

### Requirement 3: メール一覧表示機能

**Objective:** As a ユーザー, I want Webアプリから受信トレイでメール一覧を閲覧できること, so that 受信したメールを効率的に確認できる

#### Acceptance Criteria

1. When ユーザーが認証され、メール一覧画面にアクセスする, CloudInbox shall Firestoreの`users/{uid}/mailThreads`コレクションをクエリして、`labels`に`inbox`を含み、`trash`を含まないメールスレッド一覧を取得する
2. When メール一覧を表示する, CloudInbox shall メールスレッドを`lastMessageAt`の降順でソートする
3. When メール一覧を表示する, CloudInbox shall 件名（`subject`）、送信者（`from`）、プレビュー（`preview`）、日時（`sentAt`：メールの送信日時）、未読状態（`hasUnread`）、ラベル（`labels`）を表示する
4. When メール一覧を表示する, CloudInbox shall 未読メール（`hasUnread: true`）の件名を太字で表示する
5. When メール一覧を表示する, CloudInbox shall Storageアクセスを発生させない（Firestoreのみで一覧表示）
6. When メール一覧を初期表示する, CloudInbox shall 画面サイズとメール一覧アイテムの高さを計算し、1画面で収まる件数分のみを取得して表示する（全件を一度に取得・表示しない）
7. When メール一覧を初期表示する, CloudInbox shall 画面に表示可能な件数を動的に計算し、その件数分を取得する（画面に収まる件数 + 若干の余裕分、通常は10-20件程度）
8. When ユーザーがメール一覧をスクロールして画面の末尾に近づく, CloudInbox shall 次のN件（画面サイズに応じた件数）を取得して一覧に追加表示する（無限スクロール方式のページネーション）
9. When 追加読み込みを実行する, CloudInbox shall 前回取得した最後のメールスレッドの`lastMessageAt`を基準に、次のN件を取得する
10. When 追加読み込みを実行する, CloudInbox shall ローディングインジケーターを表示する（追加読み込み中であることを示す）
11. When すべてのメールスレッドを読み込み終えた場合, CloudInbox shall 追加読み込みを停止し、「すべてのメールを読み込みました」などのメッセージを表示する
12. When ユーザーがゴミ箱を表示する, CloudInbox shall `labels`に`trash`を含むメールスレッド一覧を表示する（1画面で収まる分を初期表示し、スクロールで追加読み込み）
13. When ユーザーが「すべてのメール」一覧を表示する, CloudInbox shall すべてのメールスレッド一覧を表示する（ラベルの条件によるフィルタリングは行わない、1画面で収まる分を初期表示し、スクロールで追加読み込み）
14. When メール一覧を表示する, CloudInbox shall Firestoreのリアルタイム更新（`onSnapshot`）を監視し、新しいメールが受信された場合に自動的に一覧を更新する
15. When メール一覧を表示する, CloudInbox shall ローディング状態を表示する（初期データ取得中）
16. If メール一覧の取得に失敗する, CloudInbox shall エラーメッセージを表示する
17. The CloudInbox shall メール一覧のUIをVuetifyのコンポーネント（`v-list`、`v-list-item`等）を使用して実装する
18. The CloudInbox shall スクロール位置の検知にIntersection Observer APIまたはスクロールイベントを使用する

### Requirement 4: メール詳細表示機能

**Objective:** As a ユーザー, I want Webアプリから個別メールの詳細を確認できること, so that メールの内容を閲覧できる

#### Acceptance Criteria

1. When ユーザーがメールスレッドを選択する, CloudInbox shall メール詳細画面を表示する
2. When メール詳細を表示する, CloudInbox shall Firestoreの`users/{uid}/mailMessages/{messageId}`からメール情報を取得する
3. When メール詳細を表示する, CloudInbox shall 件名（`subject`）、送信者（`from`）、受信者（`to`、`cc`、`bcc`）、送信日時（`sentAt`）、添付ファイル情報を表示する
4. When メール本文が小さい場合（`hasLargeBody: false`）, CloudInbox shall Cloud Functions経由でFirestoreの`bodyTextEncrypted`を復号し、クライアントに送信する
5. When メール本文が大きい場合（`hasLargeBody: true`）, CloudInbox shall Cloud Functions経由でStorageの`body.html.enc`を取得・復号し、クライアントに送信する
6. When メール本文を復号する, CloudInbox shall 既存のCloud Functions（`decryptMail`）を呼び出す
7. When メール本文を表示する, CloudInbox shall HTML形式の本文（`bodyHtml`）を優先的に表示し、HTML形式がない場合はテキスト形式（`bodyText`）を表示する
8. When メール本文を表示する, CloudInbox shall HTMLコンテンツを安全にレンダリングする（XSS対策）
9. When メール詳細を表示する, CloudInbox shall Storageパス情報（`storage.attachmentsBasePath`）から添付ファイル一覧を取得・表示する
10. When 添付ファイル一覧を取得する, CloudInbox shall 既存のCloud Functions（`getAttachmentsList`）を呼び出す
11. When ユーザーがメールを開く, CloudInbox shall Firestoreを直接更新して、メールの未読状態を`isRead: true`に更新し、スレッド内のすべてのメッセージを確認して`hasUnread`を再計算する（スレッド内に未読メッセージが1つでもあれば`hasUnread: true`、すべて既読なら`hasUnread: false`）
12. The CloudInbox shall 復号済みのメール本文をクライアント側でキャッシュしない（セキュリティ要件）
13. When メール詳細を表示する, CloudInbox shall ローディング状態を表示する（データ取得中、復号処理中）
14. If メール詳細の取得に失敗する, CloudInbox shall エラーメッセージを表示する
15. If メール本文の復号に失敗する, CloudInbox shall エラーメッセージを表示する
16. The CloudInbox shall メール詳細のUIをVuetifyのコンポーネント（`v-card`、`v-container`等）を使用して実装する

### Requirement 5: ナビゲーションとルーティング

**Objective:** As a ユーザー, I want Webアプリで適切なナビゲーションとルーティングが機能すること, so that 画面間をスムーズに移動できる

#### Acceptance Criteria

1. When プロジェクトをセットアップする, CloudInbox shall vue-routerを使用してルーティングを実装する
2. When vue-routerを設定する, CloudInbox shall ベースパスを`/mail`に設定する（`createRouter`の`base`オプション）
3. When ユーザーが認証されていない場合, CloudInbox shall `/mail/login`ルートにリダイレクトする（実際のURLは`/mail/login`、ベースパス考慮後のルートは`/login`）
4. When ユーザーが認証されている場合, CloudInbox shall `/mail/`ルート（メール一覧）にリダイレクトする（実際のURLは`/mail/`、ベースパス考慮後のルートは`/`）
5. When ユーザーがメールスレッドを選択する（モバイル・タブレット: 1列レイアウト）, CloudInbox shall `/mail/:threadId`ルートに遷移する（実際のURLは`/mail/:threadId`、ベースパス考慮後のルートは`/:threadId`）
6. When ユーザーがメールスレッドを選択する（デスクトップ: 2列レイアウト）, CloudInbox shall 同一画面内で右側のメール詳細エリアを更新する（URLは変更せず、クエリパラメータまたは状態管理で選択中のスレッドを管理）
6. When ユーザーがログアウトする, CloudInbox shall `/mail/login`ルートにリダイレクトする（実際のURLは`/mail/login`、ベースパス考慮後のルートは`/login`）
7. When ユーザーが存在しないルートにアクセスする, CloudInbox shall 404エラーページを表示する
8. The CloudInbox shall ナビゲーションバーまたはサイドバーを実装し、主要な画面（受信トレイ、すべてのメール、ゴミ箱、設定）へのアクセスを提供する
9. The CloudInbox shall ナビゲーションUIをVuetifyのコンポーネント（`v-navigation-drawer`、`v-app-bar`等）を使用して実装する
10. When ユーザーが設定画面にアクセスする, CloudInbox shall `/mail/settings`ルートに遷移する（実際のURLは`/mail/settings`、ベースパス考慮後のルートは`/settings`）
11. When ユーザーがアカウント設定画面にアクセスする, CloudInbox shall `/mail/settings/accounts`ルートに遷移する（実際のURLは`/mail/settings/accounts`、ベースパス考慮後のルートは`/settings/accounts`）

### Requirement 6: レスポンシブデザイン

**Objective:** As a ユーザー, I want Webアプリが様々な画面サイズ（デスクトップ、タブレット、モバイル）で適切に表示されること, so that どのデバイスからでも快適に利用できる

#### Acceptance Criteria

1. When Webアプリを表示する, CloudInbox shall デスクトップ（1024px以上）、タブレット（768px-1023px）、モバイル（767px以下）の各画面サイズに対応する
2. When メール一覧画面を表示する（モバイル・タブレット: 1列レイアウト）, CloudInbox shall メール一覧のみを全画面で表示する
3. When メール一覧画面を表示する（デスクトップ: 2列レイアウト）, CloudInbox shall 左側にメール一覧、右側にメール詳細を同時に表示する
4. When ユーザーがメールスレッドをクリックする（モバイル・タブレット: 1列レイアウト）, CloudInbox shall メール詳細画面に遷移する（`/mail/:threadId`ルート）
5. When ユーザーがメールスレッドをクリックする（デスクトップ: 2列レイアウト）, CloudInbox shall 右側のメール詳細エリアに選択したメールを表示する（画面遷移せず、同一画面内で更新）
6. When メール詳細を表示する（デスクトップ: 2列レイアウト）, CloudInbox shall メール一覧とメール詳細を同時に表示し、メール一覧で選択中のスレッドをハイライト表示する
7. When メール詳細を表示する（モバイル・タブレット: 1列レイアウト）, CloudInbox shall メール詳細画面を全画面で表示する
8. When ナビゲーションバーを表示する, CloudInbox shall 画面サイズに応じて表示方法を調整する（デスクトップ：常時表示、モバイル：ハンバーガーメニュー）
9. The CloudInbox shall Vuetifyのレスポンシブグリッドシステム（`v-row`、`v-col`）を使用する
10. The CloudInbox shall Vuetifyのブレークポイント（`xs`、`sm`、`md`、`lg`、`xl`）を活用する
11. When 画面サイズが変更される（例: ブラウザウィンドウのリサイズ）, CloudInbox shall レイアウトを動的に切り替える（1列↔2列）
12. When デスクトップレイアウト（2列）でメール詳細が表示されていない場合, CloudInbox shall 右側に「メールを選択してください」などのプレースホルダーを表示する

### Requirement 7: 国際化（i18n）対応

**Objective:** As a ユーザー, I want Webアプリの画面が複数言語に対応すること, so that 日本語と英語の両方でアプリを利用できる

#### Acceptance Criteria

1. When プロジェクトをセットアップする, CloudInbox shall vue-i18nを使用して国際化を実装する
2. The CloudInbox shall 少なくとも日本語（ja）と英語（en）をサポートする
3. When アプリが起動される, CloudInbox shall ブラウザの言語設定に基づいて適切な言語を選択する
4. When 画面に文字列を表示する, CloudInbox shall 国際化リソースから文字列を取得して表示する
5. The CloudInbox shall 文字列リソースを外部ファイル（JSONファイル等）に定義する
6. The CloudInbox shall バックエンド（Cloud Functions）のコメント、ログ、エラーメッセージは日本語のままとする
7. The CloudInbox shall 画面に表示されるエラーメッセージのみ国際化対応する
8. The CloudInbox shall 日付・時刻のフォーマットをロケールに応じて適切に表示する
9. The CloudInbox shall 数値（ファイルサイズ、使用量等）のフォーマットをロケールに応じて適切に表示する
10. When ユーザーが言語を切り替える, CloudInbox shall アプリ全体の言語を即座に切り替える

### Requirement 8: エラーハンドリングと状態管理

**Objective:** As a ユーザー, I want Webアプリでエラーが適切に処理され、状態が適切に管理されること, so that 問題が発生した場合でも操作を継続できる

#### Acceptance Criteria

1. When プロジェクトをセットアップする, CloudInbox shall Piniaを使用して状態管理を実装する
2. When 認証状態が変更される, CloudInbox shall 状態管理ストアを更新する
3. When メール一覧データが取得される, CloudInbox shall 状態管理ストアに保存する
4. When メール詳細データが取得される, CloudInbox shall 状態管理ストアに保存する
5. If Firebase認証でエラーが発生する, CloudInbox shall 適切なエラーメッセージを表示する
6. If Firestoreクエリでエラーが発生する, CloudInbox shall 適切なエラーメッセージを表示する
7. If Cloud Functions呼び出しでエラーが発生する, CloudInbox shall 適切なエラーメッセージを表示する
8. When エラーが発生する, CloudInbox shall ユーザーに分かりやすいエラーメッセージを表示する（技術的なエラー詳細は表示しない）
9. The CloudInbox shall エラーメッセージをVuetifyのコンポーネント（`v-alert`、`v-snackbar`等）を使用して表示する
10. The CloudInbox shall ローディング状態を適切に管理し、UIに反映する

### Requirement 9: 既存バックエンドAPIの統合

**Objective:** As a 開発者, I want 既存のFirebase Functions APIを活用できること, so that バックエンドロジックを再利用できる

#### Acceptance Criteria

1. When メール本文を復号する, CloudInbox shall 既存のCloud Functions（`decryptMail`）を呼び出す
2. When 添付ファイル一覧を取得する, CloudInbox shall 既存のCloud Functions（`getAttachmentsList`）を呼び出す
3. When POP3S/SMTP接続テストを実行する, CloudInbox shall 既存のCloud Functions（`accountTest`）を呼び出す
3. When Cloud Functionsを呼び出す, CloudInbox shall Firebase Cloud Functions SDKを使用する
4. When Cloud Functionsを呼び出す, CloudInbox shall 認証トークンを自動的に付与する
5. When Cloud Functionsを呼び出す, CloudInbox shall リージョン（`asia-northeast1`）を指定する
6. If Cloud Functions呼び出しでエラーが発生する, CloudInbox shall エラーレスポンスを適切に処理する
7. The CloudInbox shall 既存のFirestoreスキーマ（`users/{uid}/mailThreads`、`users/{uid}/mailMessages`）を使用する
8. The CloudInbox shall 既存のStorageパス構造（`mail-data/{uid}/{messageId}/...`）を使用する

### Requirement 10: 開発環境とビルド設定

**Objective:** As a 開発者, I want 適切な開発環境とビルド設定が整備されること, so that 効率的に開発・デプロイできる

#### Acceptance Criteria

1. When プロジェクトをセットアップする, CloudInbox shall 開発環境用のFirebase設定ファイル（`firebase-config-dev.json`等）を用意する
2. When プロジェクトをセットアップする, CloudInbox shall 本番環境用のFirebase設定ファイル（`firebase-config-prod.json`等）を用意する
3. When プロジェクトをビルドする, CloudInbox shall 環境変数に基づいて適切なFirebase設定を読み込む
4. When プロジェクトをセットアップする, CloudInbox shall ESLintとPrettierを設定する（コード品質の確保）
5. When プロジェクトをセットアップする, CloudInbox shall TypeScriptの型チェックを有効にする
6. When プロジェクトをセットアップする, CloudInbox shall ソースマップを生成する（デバッグのため）
7. The CloudInbox shall 既存のmonorepo構造に従い、`apps/web_app/`ディレクトリに配置する
8. The CloudInbox shall 既存のCI/CDパイプライン（存在する場合）に統合できる構造とする

### Requirement 11: Firebase Hostingデプロイとルーティング設定

**Objective:** As a 開発者, I want Firebase Hostingを使用してWebアプリをデプロイし、適切なルーティングを設定できること, so that 本番環境でWebアプリを公開できる

#### Acceptance Criteria

1. When プロジェクトをデプロイする, CloudInbox shall Firebase Hostingを使用してデプロイする
2. When プロジェクトをデプロイする, CloudInbox shall Webアプリを`/mail`ディレクトリにデプロイする
3. When プロジェクトをセットアップする, CloudInbox shall `firebase.json`にFirebase Hostingの設定を追加する
4. When Firebase Hostingを設定する, CloudInbox shall `public`ディレクトリ（またはビルド出力ディレクトリ）を`/mail`にマッピングする
5. When プロジェクトをビルドする, CloudInbox shall Viteのビルド出力を`/mail`ディレクトリに配置するように設定する
6. When プロジェクトをデプロイする, CloudInbox shall `firebase deploy --only hosting`コマンドでデプロイできるようにする
7. When ルーティングを設定する, CloudInbox shall `firebase.json`に`rewrites`設定を追加し、`/mail/*`へのアクセスを適切に処理する
8. When ルーティングを設定する, CloudInbox shall Vue RouterのHistoryモードに対応するため、`/mail/*`へのすべてのリクエストを`index.html`にリライトする
9. When ルートパス（`/`）にアクセスする, CloudInbox shall `index.html`を表示する（ランディングページ用）
10. When `index.html`が表示される, CloudInbox shall 当面は`/mail`にリダイレクトするページを配置する
11. When ユーザーが`index.html`にアクセスする, CloudInbox shall 自動的に`/mail`にリダイレクトする（JavaScriptまたはHTMLメタタグを使用）
12. When ランディングページを実装する場合（将来）, CloudInbox shall `index.html`をランディングページとして使用できる構造とする
13. The CloudInbox shall 静的アセット（CSS、JavaScript、画像等）が正しく配信されるように設定する
14. The CloudInbox shall キャッシュヘッダーを適切に設定する（静的アセットは長期キャッシュ、HTMLは短期キャッシュ）

### Requirement 12: メールアカウント設定機能

**Objective:** As a ユーザー, I want Webアプリからメールアカウントを追加・編集・削除できること, so that メールアカウントを管理できる

#### Acceptance Criteria

1. When ユーザーがアカウント設定画面にアクセスする, CloudInbox shall Firestoreの`users/{uid}/mailAccounts`コレクションからアカウント一覧を取得する
2. When アカウント一覧を表示する, CloudInbox shall アクティブなアカウント（`status: "active"`）と削除済みアカウント（`status: "inactive"`）の両方を表示する
3. When ユーザーが新しいアカウントを追加する, CloudInbox shall アカウント追加フォームを表示する
4. When アカウント追加フォームを表示する, CloudInbox shall ラベル、メールアドレス、POP3設定（ホスト、ポート、ユーザー名、パスワード）、SMTP設定（ホスト、ポート、ユーザー名、パスワード）の入力フィールドを表示する
5. When ユーザーがPOP3設定を入力する, CloudInbox shall POP3接続はSSL/TLS（POP3S）のみを許可し、非暗号化POP3接続を拒否する（`useSsl: true`を必須とする）
6. When ユーザーがSMTP設定を入力する, CloudInbox shall SMTP接続はSSL/TLS必須とする（`useSsl: true`を必須とする）
7. When ユーザーが「接続テスト」ボタンをクリックする, CloudInbox shall 既存のCloud Functions（`accountTest`）を呼び出してPOP3S/SMTP接続テストを実行する
8. When POP3S接続テストが実行される, CloudInbox shall テスト結果（成功/失敗、エラーメッセージ）を画面に表示する
9. When SMTP接続テストが実行される, CloudInbox shall テスト結果（成功/失敗、エラーメッセージ）を画面に表示する
10. When POP3S/SMTP接続テストが成功する, CloudInbox shall 成功メッセージを表示し、アカウント作成ボタンを有効化する
11. If POP3S/SMTP接続テストが失敗する, CloudInbox shall エラーメッセージを表示する
12. If 非暗号化POP3/SMTP接続が試行される, CloudInbox shall エラーメッセージを返し、接続を拒否する
13. When ユーザーがアカウントを作成する, CloudInbox shall Firestoreの`users/{uid}/mailAccounts/{accountId}`にアカウントドキュメントを作成する
14. When アカウントが作成される, CloudInbox shall ユーザーのプラン情報（`plan.maxAccounts`）を確認し、アカウント数が上限に達している場合は作成を拒否する
15. When アカウントが作成される, CloudInbox shall アカウント状態（`status: "active"`）を設定する
16. When ユーザーがPOP3SパスワードまたはSMTPパスワードを入力する, CloudInbox shall ユーザー専用のDEK（Data Encryption Key）を使用してパスワードを暗号化する（既存のFirebase Functionsの暗号化ロジックを使用）
17. When アカウントが作成・更新される, CloudInbox shall 作成日時（`createdAt`）と更新日時（`updatedAt`）を記録する
18. When ユーザーが既存のアカウントを編集する, CloudInbox shall アカウント編集フォームを表示し、既存の設定値を入力フィールドに設定する
19. When アカウント編集フォームを表示する, CloudInbox shall パスワードフィールドは空のまま表示する（既存のパスワードは取得できないため）
20. When ユーザーがアカウントを更新する, CloudInbox shall Firestoreの`users/{uid}/mailAccounts/{accountId}`を更新する
21. When ユーザーがアカウントを更新する, CloudInbox shall パスワードが入力されている場合のみ暗号化して更新し、入力されていない場合は既存のパスワードを保持する
22. When ユーザーがアカウントを削除する, CloudInbox shall 論理削除を実行し、アカウント状態を`status: "inactive"`に設定し、`deletedAt`に削除日時を記録する
23. When ユーザーが削除済みアカウントを復元する, CloudInbox shall アカウント状態を`status: "active"`に設定し、`deletedAt`を削除する
24. When ユーザーがアカウントを完全削除する, CloudInbox shall Firestoreからアカウントドキュメントを物理削除する
25. When アカウント設定画面を表示する, CloudInbox shall ローディング状態を表示する（データ取得中）
26. If アカウント一覧の取得に失敗する, CloudInbox shall エラーメッセージを表示する
27. If アカウント作成・更新・削除に失敗する, CloudInbox shall エラーメッセージを表示する
28. The CloudInbox shall アカウント設定のUIをVuetifyのコンポーネント（`v-form`、`v-text-field`、`v-btn`等）を使用して実装する
29. The CloudInbox shall アカウント設定画面へのナビゲーションを実装する（設定メニューまたはナビゲーションバーからアクセス可能）
