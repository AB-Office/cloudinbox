# Requirements Document

## Introduction

CloudInboxは、外部メールサーバ（POP3S）から受信したメールをクラウド上へ保存し、スマートフォンアプリ（Flutter）からどの端末でも同じ受信箱を閲覧できる「クラウド受信箱サービス」です。本要件書は、既存のPOP3メール受信機能に加えて、SMTP（SMTP over SSL/TLS必須）によるメール送信機能を追加する要件を定義します。

## Requirements

### Requirement 1: SMTPアカウント設定と管理

**Objective:** As a ユーザー, I want メールアカウント設定にSMTP（SMTP over SSL/TLS）設定を追加・設定・テストできること, so that 安全にメールを送信できる

#### Acceptance Criteria

1. When ユーザーがメールアカウント設定画面でSMTP設定を入力する, CloudInbox shall 既存のPOP3設定に加えてSMTP設定（ホスト、ポート、ユーザー名、パスワード）を入力可能にする
2. When ユーザーがメールアカウント情報を保存する, CloudInbox shall SMTP設定を`users/{uid}/mailAccounts/{accountId}`の`smtp`フィールドに保存する
3. When ユーザーがSMTP設定を入力する, CloudInbox shall `smtp.useSsl: true`を必須とする（非暗号化SMTP接続を拒否する）
4. When メールアカウントが作成・更新される, CloudInbox shall SMTPパスワードをPOP3パスワードと同様に、ユーザー専用のDEK（Data Encryption Key）を使用して暗号化し、`smtp.passwordEnc`に保存する
5. The CloudInbox shall 平文のSMTPパスワードをFirestoreに保存しない
6. When ユーザーがメールアカウント追加・編集画面で「SMTP接続テスト」または「確認」ボタンを押す, CloudInbox shall 入力されたSMTP設定で接続テストを実行する
7. When ユーザーがSMTP接続テストを実行する, CloudInbox shall 指定されたSMTPサーバにSSL/TLS接続し、認証情報を検証する
8. When SMTP接続テストが実行される, CloudInbox shall テスト結果（成功/失敗、エラーメッセージ）を画面に表示する
9. When SMTP接続テストが成功する, CloudInbox shall 成功メッセージを表示し、アカウント作成・更新ボタンを有効化する
10. If SMTP接続テストが失敗する, CloudInbox shall エラーメッセージを返し、アカウント状態を`status: "error"`に設定する
11. If 非暗号化SMTP接続が試行される, CloudInbox shall エラーメッセージを返し、接続を拒否する
12. When SMTP接続テストを実行する（アカウント作成前）, CloudInbox shall 入力された平文パスワード（HTTPSで保護）を受け取り、SMTPサーバへ接続テストを実行し、接続テスト後は即座に破棄する
13. When SMTP接続テストを実行する（既存アカウントの場合）, CloudInbox shall Secret ManagerからDEKを取得し、KMSでunwrapして、保存されている暗号化パスワード（`smtp.passwordEnc`）を復号化する
14. When メール送信時にSMTP認証を行う, CloudInbox shall Secret ManagerからDEKを取得し、KMSでunwrapして、保存されている暗号化パスワード（`smtp.passwordEnc`）を復号化する
15. The CloudInbox shall SMTP設定が必須であることを明示する（POP3設定のみのアカウントは送信不可）
16. When ユーザーがメールアカウント設定画面でPOP3設定を入力した後、SMTP設定が未入力の場合, CloudInbox shall 「POP3設定からコピー」ボタンを表示する
17. When ユーザーが「POP3設定からコピー」ボタンを押す, CloudInbox shall POP3設定のホスト名、ログインユーザー名、パスワードをSMTP設定の同名フィールドにコピーする
18. When ユーザーが「POP3設定からコピー」ボタンを押した後, CloudInbox shall SMTP設定のホスト名、ポート（通常は587または465）、ユーザー名、パスワードが自動入力された状態にする

### Requirement 2: メール送信機能

**Objective:** As a ユーザー, I want Flutterアプリからメールを送信できること, so that 受信したメールに返信したり、新しいメールを作成・送信できる

#### Acceptance Criteria

1. When ユーザーがメール送信画面を開く, CloudInbox shall メール作成フォーム（宛先、件名、本文、添付ファイル）を表示する
2. When ユーザーがメール送信画面で「返信」を選択する, CloudInbox shall 既存のメール情報（宛先、件名）を自動的に入力する
3. When ユーザーがメール送信画面で「転送」を選択する, CloudInbox shall 既存のメール情報（件名、本文）を自動的に入力する
4. When ユーザーがメール送信画面で送信アカウントを選択する, CloudInbox shall アクティブなメールアカウント一覧を表示する
5. When ユーザーがメール送信ボタンを押す, CloudInbox shall Cloud Functions経由でSMTPサーバに接続し、メールを送信する
6. When メール送信が実行される, CloudInbox shall 送信元アドレスを選択されたメールアカウントの`email`フィールドから取得する
7. When メール送信が実行される, CloudInbox shall SMTP設定（ホスト、ポート、ユーザー名、パスワード）をメールアカウントから取得する
8. When メール送信が実行される, CloudInbox shall SSL/TLS（SMTPS）接続を使用してSMTPサーバに接続する
9. When メール送信が実行される, CloudInbox shall 宛先（To、Cc、Bcc）を検証する
10. When メール送信が実行される, CloudInbox shall 件名と本文を検証する（空の件名や本文の許可は実装側で決定）
11. When メール送信が成功する, CloudInbox shall 成功メッセージを表示し、メール作成画面を閉じる
12. If メール送信が失敗する, CloudInbox shall エラーメッセージを表示し、メール作成画面を保持する
13. If SMTP接続エラーが発生する, CloudInbox shall 適切なエラーメッセージを表示する
14. If 認証エラーが発生する, CloudInbox shall 認証エラーメッセージを表示する
15. If メール送信がタイムアウトする, CloudInbox shall タイムアウトエラーメッセージを表示する
16. When メール送信中である, CloudInbox shall 送信中の状態を表示し、送信ボタンを無効化する
17. The CloudInbox shall メール送信処理をCloud Functions内で実行し、SMTPパスワードをクライアント側に送信しない

### Requirement 3: 送信済みメールの保存と管理

**Objective:** As a ユーザー, I want 送信したメールを保存・管理できること, so that 送信履歴を確認できる

#### Acceptance Criteria

1. When メール送信が成功する, CloudInbox shall 送信済みメールをFirestoreの`users/{uid}/mailMessages/{messageId}`に保存する
2. When 送信済みメールが保存される, CloudInbox shall メールヘッダ情報（件名、送信者、受信者、送信日時等）をFirestoreに保存する
3. When 送信済みメールが保存される, CloudInbox shall メール本文を既存の受信メールと同様に暗号化して保存する（Firestoreの`bodyTextEncrypted`またはStorageの`body.html.enc`）
4. When 送信済みメールが保存される, CloudInbox shall 送信済みメールに`sent`ラベルを付与する
5. When 送信済みメールが保存される, CloudInbox shall メールスレッド情報を`users/{uid}/mailThreads/{threadId}`に保存または更新する
6. When 送信済みメールが保存される, CloudInbox shall スレッドIDを生成する（既存の返信・転送の場合は既存のスレッドIDを使用）
7. When 送信済みメールが保存される, CloudInbox shall 送信日時（`sentAt`）を記録する
8. When 送信済みメールが保存される, CloudInbox shall 送信済みメールを「送信済み」フォルダに表示する
9. When ユーザーがナビゲーションメニュー（ハンバーガーメニュー）から「送信済み」を選択する, CloudInbox shall `labels`に`sent`を含むメールスレッド一覧を表示する
10. When ユーザーが「送信済み」フォルダを開く, CloudInbox shall ページネーション対応で、画面サイズに応じた件数で初期表示・追加読み込みを行う
11. When 送信済みメールが保存される, CloudInbox shall 既存の受信メールと同様に、使用量（`usage.storageBytes`）を更新する
12. When 送信済みメールが保存される, CloudInbox shall 添付ファイルがあれば、既存の受信メールと同様に暗号化してStorageに保存する
13. When 送信済みメールが保存される, CloudInbox shall MIME原本をStorageの`mail-data/{uid}/{messageId}/raw.eml.enc`に保存する
14. When 送信済みメールを表示する, CloudInbox shall 既存の受信メールと同様に、メール本文を復号化して表示する
15. The CloudInbox shall 送信済みメールの削除・ゴミ箱移動機能は既存の受信メールと同様に実装する

### Requirement 4: メール送信UI機能

**Objective:** As a ユーザー, I want 直感的なUIでメールを作成・送信できること, so that 効率的にメールを送信できる

#### Acceptance Criteria

1. When ユーザーがメール一覧画面で画面右下の「＋」（プラス）アイコンのオーバーレイボタン（FloatingActionButton）を押す, CloudInbox shall メール作成画面を表示する
2. When ユーザーがメール詳細画面で「返信」ボタンを押す, CloudInbox shall メール作成画面を表示し、返信先と件名を自動入力する（`Re: `プレフィックスを追加）
3. When ユーザーがメール詳細画面で「全員に返信」ボタンを押す, CloudInbox shall メール作成画面を表示し、返信先（送信者とCc受信者）と件名を自動入力する
4. When ユーザーがメール詳細画面で「転送」ボタンを押す, CloudInbox shall メール作成画面を表示し、件名（`Fw: `プレフィックスを追加）と本文（転送元メールの内容を含む）を自動入力する
5. When メール作成画面が表示される, CloudInbox shall 送信元アカウント選択ドロップダウンを表示する（複数アカウントがある場合）
6. When メール作成画面が表示される, CloudInbox shall 宛先（To）入力フィールドを表示する
7. When メール作成画面が表示される, CloudInbox shall Cc、Bcc入力フィールドを表示する（展開可能な形式）
8. When メール作成画面が表示される, CloudInbox shall 件名入力フィールドを表示する
9. When メール作成画面が表示される, CloudInbox shall 本文入力エリアを表示する
10. When メール作成画面が表示される, CloudInbox shall 添付ファイル追加ボタンを表示する
11. When ユーザーが添付ファイルを追加する, CloudInbox shall ファイル選択ダイアログを表示する
12. When ユーザーが添付ファイルを追加する, CloudInbox shall 選択されたファイル名を表示する
13. When ユーザーが添付ファイルを削除する, CloudInbox shall 添付ファイル一覧から該当ファイルを削除する
14. When メール作成画面で「送信」ボタンを押す, CloudInbox shall 入力検証を実行する（宛先、件名の必須チェック等）
15. If 入力検証が失敗する, CloudInbox shall エラーメッセージを表示する
16. When メール送信が成功する, CloudInbox shall メール作成画面を閉じ、メール一覧画面に戻る
17. When メール作成画面で「下書き保存」ボタンを押す（将来実装）, CloudInbox shall 下書きとして保存する（本要件では実装しない）
18. When メール作成画面で「キャンセル」ボタンを押す, CloudInbox shall 確認ダイアログを表示する
19. When ユーザーが確認ダイアログで「破棄」を選択する, CloudInbox shall メール作成画面を閉じ、入力内容を破棄する
20. The CloudInbox shall メール作成画面のUIはMaterial Designに準拠する
21. The CloudInbox shall メール作成画面の文字列を国際化対応する（日本語・英語）
22. When ユーザーがハンバーガーメニューを開く, CloudInbox shall 受信トレイ／すべてのメール／送信済み／ゴミ箱／設定へのメニュー項目をアイコン付きで一覧表示し、その一番下に現在のプラン情報（`plan.label`）と使用量および残り使用可能量を表示する
23. When ユーザーがハンバーガーメニューの「送信済み」をタップする, CloudInbox shall `labels`に`sent`を含むメールスレッド一覧を表示するメール一覧画面（MailListScreen）を表示する

### Requirement 5: メール送信バックエンド実装

**Objective:** As a システム, I want Cloud Functions経由で安全にメールを送信すること, so that ユーザーはメールを送信できる

#### Acceptance Criteria

1. When Cloud Functionsでメール送信が実行される, CloudInbox shall HTTPトリガー（Callable Function）として実装する
2. When メール送信関数が呼び出される, CloudInbox shall Firebase Authで認証されたユーザーのUIDを検証する
3. When メール送信関数が呼び出される, CloudInbox shall リクエストパラメータ（送信元アカウントID、宛先、件名、本文、添付ファイル）を検証する
4. When メール送信関数が実行される, CloudInbox shall メールアカウント情報（SMTP設定を含む）をFirestoreから取得する
5. When メール送信関数が実行される, CloudInbox shall SMTPパスワードを復号化する（Secret ManagerとKMSを使用）
6. When メール送信関数が実行される, CloudInbox shall SMTPクライアントライブラリ（例: nodemailer）を使用してSMTPサーバに接続する
7. When メール送信関数が実行される, CloudInbox shall SSL/TLS（SMTPS）接続を使用する
8. When メール送信関数が実行される, CloudInbox shall MIME形式のメールを作成する
9. When メール送信関数が実行される, CloudInbox shall 添付ファイルがあればMIMEに含める
10. When メール送信が成功する, CloudInbox shall 送信済みメールをFirestoreとStorageに保存する（Requirement 3の要件に従う）
11. When メール送信が成功する, CloudInbox shall 送信成功レスポンスを返す
12. If メール送信が失敗する, CloudInbox shall エラーレスポンスを返す
13. If SMTP接続エラーが発生する, CloudInbox shall 適切なエラーメッセージを返す
14. If 認証エラーが発生する, CloudInbox shall 認証エラーメッセージを返す
15. The CloudInbox shall メール送信関数のタイムアウトを適切に設定する（9分以内）
16. The CloudInbox shall メール送信関数のログを記録する（成功・失敗、エラー内容）
17. The CloudInbox shall SMTPクライアントライブラリはTypeScript型定義が利用可能なものを使用する
18. The CloudInbox shall メール送信関数は既存の`functions/src/mail/`ディレクトリに配置する
