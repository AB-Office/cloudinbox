# Requirements Document

## Introduction

CloudInbox MVPは、外部メールサーバ（POP3S、SSL/TLS必須）から受信したメールをクラウド上へ保存し、Flutterアプリからどの端末でも同じ受信箱を閲覧できる「クラウド受信箱サービス」です。本要件書は、Freeプラン（2GBストレージ、1アカウント）のMVP実装に関する要件を定義します。

## Requirements

### Requirement 1: ユーザー認証と初期化

**Objective:** As a ユーザー, I want Firebase AuthでGoogleアカウントによるログイン・ログアウトができ、新規ユーザーの場合は自動的にFreeプランが設定されること, so that 安全にサービスにアクセスし、すぐにメール受信サービスを利用開始できる

#### Acceptance Criteria

##### 認証機能
1. When ユーザーがGoogleアカウントでログインする, CloudInbox shall Firebase AuthのGoogle Sign-Inを使用して認証を実行する
2. When ユーザーがGoogleアカウントでログインに成功する, CloudInbox shall 認証トークンを取得し、セッションを確立する
3. When ユーザーがGoogleアカウントで初回ログインする, CloudInbox shall 新規ユーザーとしてアカウントを作成する
4. When ユーザーが既存のGoogleアカウントでログインする, CloudInbox shall 既存のセッションを復元する
5. If Googleアカウントでのログインがキャンセルされる, CloudInbox shall エラーメッセージを表示せず、ログイン画面に戻る
6. If Googleアカウントでのログインが失敗する, CloudInbox shall 適切なエラーメッセージを表示する
7. When ユーザーがログアウトする, CloudInbox shall Firebase Authを使用してセッションを終了し、認証トークンを無効化する
8. When アプリが起動される, CloudInbox shall Firebase Authで既存の認証セッションを確認する
9. When 認証セッションが有効である, CloudInbox shall ユーザーを自動的にログイン状態にする
10. When 認証セッションが無効または期限切れである, CloudInbox shall ユーザーをログイン画面にリダイレクトする
11. When ユーザーが認証されていない状態で保護されたリソースにアクセスしようとする, CloudInbox shall ログイン画面にリダイレクトする
12. The CloudInbox shall すべてのFirestore/StorageアクセスでFirebase Authにより認証されたユーザーのUIDを検証する
13. The CloudInbox shall 将来的にFirebase AuthのApple Sign-Inによる認証にも対応できる設計とする

##### アカウント作成と初期化
14. When ユーザーがFirebase Authでアカウントを作成する, CloudInbox shall ユーザードキュメントを`users/{uid}`に作成する
15. When ユーザードキュメントが作成される, CloudInbox shall Freeプラン設定（`plan.id: "free"`, `plan.maxStorageBytes: 2147483648`, `plan.maxAccounts: 1`）を自動的に注入する
16. When ユーザードキュメントが作成される, CloudInbox shall 使用量情報（`usage.storageBytes: 0`, `usage.updatedAt`）を初期化する
17. The CloudInbox shall ユーザー作成日時（`createdAt`）と更新日時（`updatedAt`）を記録する

### Requirement 2: メールアカウント設定と管理

**Objective:** As a ユーザー, I want POP3S（POP3 over SSL/TLS）メールアカウントを追加・設定・テストできること, so that 外部メールサーバから安全にメールを受信できる

#### Acceptance Criteria
1. When ユーザーがメールアカウント情報（ラベル、メールアドレス、POP3S設定、SMTP設定）を入力する, CloudInbox shall メールアカウントドキュメントを`users/{uid}/mailAccounts/{accountId}`に作成する
2. When メールアカウントが作成される, CloudInbox shall アカウント状態（`status: "active"`）を設定する
3. When ユーザーがFreeプランで既に1件のメールアカウントを持っている, CloudInbox shall 新しいアカウント追加を拒否する
4. The CloudInbox shall POP3接続はSSL/TLS（POP3S）のみを許可し、非暗号化POP3接続を拒否する
5. When ユーザーがPOP3設定を入力する, CloudInbox shall `pop3.useSsl: true`を必須とする
6. When ユーザーがメールアカウント追加画面で「接続テスト」または「確認」ボタンを押す, CloudInbox shall 入力されたPOP3S設定で接続テストを実行する
7. When ユーザーがPOP3S接続テストを実行する, CloudInbox shall 指定されたPOP3SサーバにSSL/TLS接続し、認証情報を検証する
8. When POP3S接続テストが実行される, CloudInbox shall テスト結果（成功/失敗、エラーメッセージ）を画面に表示する
9. When POP3S接続テストが成功する, CloudInbox shall 成功メッセージを表示し、アカウント作成ボタンを有効化する（または、接続テスト成功後にアカウント作成を実行可能にする）
10. If POP3S接続テストが失敗する, CloudInbox shall エラーメッセージを返し、アカウント状態を`status: "error"`に設定する
11. If 非暗号化POP3接続が試行される, CloudInbox shall エラーメッセージを返し、接続を拒否する
12. When メールアカウントが作成・更新される, CloudInbox shall 作成日時（`createdAt`）と更新日時（`updatedAt`）を記録する
13. When ユーザーがPOP3SパスワードまたはSMTPパスワードを入力する, CloudInbox shall ユーザー専用のDEK（Data Encryption Key）を使用してパスワードを暗号化する
14. When ユーザーが初回ログインする, CloudInbox shall Google Cloud KMSを使用してユーザー専用のDEKを生成し、KMSでwrapしてSecret Managerに保存する
15. When パスワードを暗号化する, CloudInbox shall AES-256-GCMアルゴリズムを使用し、暗号化されたパスワード（`passwordEnc`）をPOP3S設定とSMTP設定に保存する
16. The CloudInbox shall 平文のパスワードをFirestoreに保存しない
17. When POP3S接続テストを実行する（アカウント作成前）, CloudInbox shall 入力された平文パスワード（HTTPSで保護）を受け取り、POP3Sサーバへ接続テストを実行し、接続テスト後は即座に破棄する
18. When POP3S接続テストを実行する（既存アカウントの場合）, CloudInbox shall Secret ManagerからDEKを取得し、KMSでunwrapして、保存されている暗号化パスワード（`passwordEnc`）を復号化する
19. When メール受信時にPOP3S認証を行う, CloudInbox shall Secret ManagerからDEKを取得し、KMSでunwrapして、保存されている暗号化パスワード（`passwordEnc`）を復号化する
20. The CloudInbox shall DEKをSecret Managerに安全に保管し、KMSのKEK（Key Encryption Key）でwrapする
21. The CloudInbox shall 暗号鍵（KEK/DEK）をクライアント側に送信しない
22. The CloudInbox shall `deleteAfterFetch: true`をデフォルトで設定する

### Requirement 3: メール自動受信機能

**Objective:** As a システム, I want 定期的にPOP3Sサーバからメールを自動受信すること, so that ユーザーは最新のメールを常に受信トレイで確認できる

#### Acceptance Criteria
1. When スケジューラーが15〜30分間隔で実行される, CloudInbox shall すべてのアクティブなメールアカウント（`status: "active"`）を走査する
2. When メールアカウントが走査される, CloudInbox shall ユーザーのプラン情報（`plan.maxStorageBytes`）と使用量（`usage.storageBytes`）を読み込む
3. When POP3Sサーバからメールを取得する, CloudInbox shall 各メールのサイズを推定する
4. If 現在の使用量とメールサイズの合計がプランの上限（`usage.storageBytes + mailSize > plan.maxStorageBytes`）を超える, CloudInbox shall そのメールの受信を停止し、以降のメール受信をスキップする
5. When メールが正常に受信・保存される, CloudInbox shall アカウントの最終受信日時（`lastFetchedAt`）を更新する
6. If メール受信中にエラーが発生する, CloudInbox shall アカウント状態を`status: "error"`に設定し、エラーメッセージを`lastErrorMessage`に記録する
7. When メール受信が完了する, CloudInbox shall 使用量（`usage.storageBytes`）を更新し、更新日時（`usage.updatedAt`）を記録する
8. When メールが正常に保存される, CloudInbox shall POP3Sサーバからそのメールを削除する（`deleteAfterFetch: true`の場合）

### Requirement 4: メール保存機能

**Objective:** As a システム, I want 受信したメールをFirestoreとStorageに適切に保存すること, so that ユーザーはメールを閲覧・管理できる

#### Acceptance Criteria
1. When メールが受信される, CloudInbox shall メールヘッダ情報（件名、送信者、受信者、日時等）をFirestoreの`users/{uid}/mailMessages/{messageId}`に保存する
2. When メールが受信される, CloudInbox shall スレッド情報をFirestoreの`users/{uid}/mailThreads/{threadId}`に保存または更新する
3. When メールが受信される, CloudInbox shall 本文プレビュー（`bodyPreview`）を生成し、Firestoreの`mailMessages`に保存する
4. When メール本文のサイズが小さい場合（Firestoreの1MiB制限内）, CloudInbox shall ユーザー専用のDEKを使用してメール本文（テキスト形式）をAES-256-GCMで暗号化し、Firestoreの`bodyTextEncrypted`に保存する
5. When メール本文のサイズが大きい場合（Firestoreの1MiB制限を超える）, CloudInbox shall ユーザー専用のDEKを使用してメール本文をAES-256-GCMで暗号化し、Storageの`mail-data/{uid}/{messageId}/body.html.enc`に保存し、`hasLargeBody: true`を設定する
6. When メールが受信される, CloudInbox shall ユーザー専用のDEKを使用してMIME原本をAES-256-GCMで暗号化し、Storageの`mail-data/{uid}/{messageId}/raw.eml.enc`に保存する
7. When メールに添付ファイルがある, CloudInbox shall ユーザー専用のDEKを使用して各添付ファイルをAES-256-GCMで暗号化し、Storageの`mail-data/{uid}/{messageId}/attachments/{filename}.enc`に保存する
8. When メール本文を暗号化して保存する, CloudInbox shall Firestoreドキュメントに暗号化形式（`ciphertext`, `nonce`, `tag`）を記録する
9. When メールが保存される, CloudInbox shall Storageパス情報（`storage.rawMimePath`, `storage.largeBodyPath`, `storage.attachmentsBasePath`）をFirestoreの`mailMessages`に記録する
10. When メールが保存される, CloudInbox shall メールの基本状態（`isRead: false`, `labels: ["inbox"]`, `deletedAt: null`）を初期化する
11. When メールが保存される, CloudInbox shall メッセージID（`messageId`）とスレッドID（`threadId`）を記録する
12. When メールが保存される, CloudInbox shall 保存日時（`createdAt`）と更新日時（`updatedAt`）を記録する
13. When メールが保存される, CloudInbox shall 実際に保存されたファイルサイズの合計を計算し、ユーザーの使用量（`usage.storageBytes`）に加算する
14. The CloudInbox shall 暗号化前のメール本文をメモリに保持しない
15. The CloudInbox shall 暗号化処理をCloud Functions内で実行し、クライアント側には暗号鍵を送信しない

### Requirement 5: メール閲覧機能

**Objective:** As a ユーザー, I want Flutterアプリから受信トレイでメール一覧を閲覧し、個別メールの詳細を確認できること, so that 受信したメールを効率的に管理できる

**注**: メールのメタ情報（一覧表示、未既読管理、ラベル管理）はFlutterアプリ側でFirestoreを直接更新して実装する。メール本文のみCloud Functions（decryptMail）経由で復号化して取得する。

#### Acceptance Criteria
1. When ユーザーが受信トレイを開く, CloudInbox shall Firestoreの`users/{uid}/mailThreads`コレクションをクエリして、`labels`に`inbox`を含み、`trash`を含まないメールスレッド一覧を取得する
2. When メール一覧を表示する, CloudInbox shall メールスレッドを`lastMessageAt`の降順でソートする
3. When メール一覧を表示する, CloudInbox shall 件名（`subject`）、送信者（`from`）、プレビュー（`preview`）、日時（`lastMessageAt`）、未読状態（`hasUnread`）、ラベル（`labels`）を表示する
4. When メール一覧を表示する, CloudInbox shall Storageアクセスを発生させない（Firestoreのみで一覧表示）
5. When メール一覧を初期表示する, CloudInbox shall 画面サイズに応じて表示可能な件数を計算し、その件数分を取得して表示する（画面に収まる件数 + 若干の余裕分）
6. When ユーザーがメール一覧をスクロールして末尾に到達する, CloudInbox shall 次のN件（画面サイズに応じた件数）を取得して一覧に追加表示する（追加読み込み）
7. When 追加読み込みを実行する, CloudInbox shall 前回取得した最後のメールスレッドの`lastMessageAt`を基準に、次のN件を取得する
8. When すべてのメールスレッドを読み込み終えた場合, CloudInbox shall 追加読み込みを停止する
9. When ユーザーがゴミ箱を表示する, CloudInbox shall `labels`に`trash`を含むメールスレッド一覧を表示する（ページネーション対応、画面サイズに応じた件数で初期表示・追加読み込み）
10. When ユーザーが「すべてのメール」一覧を表示する, CloudInbox shall すべてのメールスレッド一覧を表示する（ラベルの条件によるフィルタリングは行わない、ページネーション対応、画面サイズに応じた件数で初期表示・追加読み込み）
11. When ユーザーがメールスレッドを選択する, CloudInbox shall メール詳細画面を表示する
12. When メール詳細を表示する, CloudInbox shall Firestoreの`users/{uid}/mailMessages/{messageId}`からメール情報を取得する
13. When メール本文が小さい場合（`hasLargeBody: false`）, CloudInbox shall Cloud Functions経由でFirestoreの`bodyTextEncrypted`を復号し、クライアントに送信する
14. When メール本文が大きい場合（`hasLargeBody: true`）, CloudInbox shall Cloud Functions経由でStorageの`body.html.enc`を取得・復号し、クライアントに送信する
15. When メール本文を復号する, CloudInbox shall ユーザー専用のDEKを使用してAES-256-GCMで復号を実行する
16. When メール詳細を表示する, CloudInbox shall Storageパス情報（`storage.attachmentsBasePath`）から添付ファイル一覧を取得・表示する
17. When ユーザーがメールを開く, CloudInbox shall Flutterアプリ側でFirestoreを直接更新して、メールの未読状態を`isRead: true`に更新し、スレッドの`hasUnread`を更新する
18. The CloudInbox shall 復号済みのメール本文をクライアント側でキャッシュしない（セキュリティ要件）
19. When ユーザーがハンバーガーメニューを開く, CloudInbox shall 受信トレイ／すべてのメール／ゴミ箱／設定へのメニュー項目をアイコン付きで一覧表示し、その一番下に現在のプラン情報（`plan.label`）と使用量および残り使用可能量を表示する
20. When ユーザーがハンバーガーメニューの「受信トレイ」をタップする, CloudInbox shall 受信トレイ用フィルタ（`labels`に`inbox`を含み、`trash`を含まない）を適用したメール一覧画面（MailListScreen）を表示する
21. When ユーザーがハンバーガーメニューの「すべてのメール」をタップする, CloudInbox shall ラベルによるフィルタリングを行わない「すべてのメール」用フィルタを適用したメール一覧画面（MailListScreen）を表示する
22. When ユーザーがハンバーガーメニューの「ゴミ箱」をタップする, CloudInbox shall `labels`に`trash`を含むスレッドのみを表示するメール一覧画面（MailListScreen）を表示する
23. When ユーザーがハンバーガーメニューの「設定」をタップする, CloudInbox shall 設定画面を表示し、その画面で「メールアカウント設定」と「ログアウト」の2つのメニュー項目を一覧表示する

### Requirement 6: メールゴミ箱機能

**Objective:** As a ユーザー, I want メールをゴミ箱に移動できること, so that 誤って削除したメールを復元できる

#### Acceptance Criteria
1. When ユーザーがメールを削除する, CloudInbox shall Flutterアプリ側でFirestoreを直接更新して、メールのラベルに`trash`を追加する（`inbox`ラベルは削除しない）
2. When メールがゴミ箱に移動される, CloudInbox shall Flutterアプリ側でFirestoreを直接更新して、ゴミ箱移動日時（`deletedAt`）を記録する
3. When メールがゴミ箱に移動される, CloudInbox shall Flutterアプリ側でFirestoreを直接更新して、メールスレッドのラベルにも`trash`を追加する（`inbox`ラベルは削除しない）
4. When メールがゴミ箱に移動される, CloudInbox shall 使用量（`usage.storageBytes`）は変更しない（ゴミ箱内でも容量を使用）
5. When ユーザーがゴミ箱からメールを復元する, CloudInbox shall Flutterアプリ側でFirestoreを直接更新して、メールのラベルから`trash`ラベルを削除する（`inbox`ラベルは追加・削除しない、元の状態を保持）
6. When メールがゴミ箱から復元される, CloudInbox shall Flutterアプリ側でFirestoreを直接更新して、`deletedAt`フィールドを削除する
7. When ゴミ箱に入ってから30日が経過する, CloudInbox shall メールを完全削除する（StorageファイルとFirestoreドキュメントを削除）
8. When メールが完全削除される, CloudInbox shall 削除されたファイルの合計サイズを計算する（Firestoreの暗号化データとStorageファイルの両方）
9. When メールが完全削除される, CloudInbox shall ユーザーの使用量（`usage.storageBytes`）から削除されたサイズを減算する
10. When メールが完全削除される, CloudInbox shall 使用量の更新日時（`usage.updatedAt`）を更新する
11. When スレッド内のすべてのメールが完全削除される, CloudInbox shall Firestoreからスレッドドキュメント（`users/{uid}/mailThreads/{threadId}`）を削除する

### Requirement 10: メールアーカイブ機能

**Objective:** As a ユーザー, I want メールをアーカイブできること, so that 受信トレイを整理しつつ、メールを保持できる

**注**: 「すべてのメール」一覧画面では、すべてのメールスレッドを表示する（ラベルの条件によるフィルタリングは行わない）。アーカイブ化の操作（inboxラベルを外す）は「アーカイブ」という表現を使用する。

#### Acceptance Criteria
1. When ユーザーがメールをアーカイブする, CloudInbox shall Flutterアプリ側でFirestoreを直接更新して、メールのラベルから`inbox`を削除する（`archive`ラベルは追加しない）
2. When メールがアーカイブされる, CloudInbox shall Flutterアプリ側でFirestoreを直接更新して、メールスレッドのラベルからも`inbox`を削除する（`archive`ラベルは追加しない）
3. When メールがアーカイブされる, CloudInbox shall 使用量（`usage.storageBytes`）は変更しない（すべてのメール一覧でも容量を使用）
4. When ユーザーがアーカイブからメールを復元する, CloudInbox shall Flutterアプリ側でFirestoreを直接更新して、メールのラベルに`inbox`を追加する
5. When アーカイブから復元される, CloudInbox shall Flutterアプリ側でFirestoreを直接更新して、メールスレッドのラベルにも`inbox`を追加する
6. When ユーザーが「すべてのメール」一覧を表示する, CloudInbox shall すべてのメールスレッドを表示する（ラベルの条件によるフィルタリングは行わない、ページネーション対応、画面サイズに応じた件数で初期表示・追加読み込み）
7. When ユーザーが受信トレイを表示する, CloudInbox shall `labels`に`inbox`を含み、`trash`を含まないメールスレッドのみを表示する

### Requirement 7: 容量管理とプラン制限

**Objective:** As a システム, I want プランベースのストレージ制限を適用し、使用量を正確に追跡すること, so that ユーザーはプラン内でサービスを利用できる

#### Acceptance Criteria
1. The CloudInbox shall Freeプランのストレージ上限（2GB = 2147483648バイト）を`plan.maxStorageBytes`に設定する
2. The CloudInbox shall Freeプランのアカウント数上限（1件）を`plan.maxAccounts`に設定する
3. When メール受信前に容量チェックを行う, CloudInbox shall 現在の使用量（`usage.storageBytes`）とメールサイズの合計が上限（`plan.maxStorageBytes`）を超えないことを確認する
4. If 使用量が上限に達する, CloudInbox shall 新しいメールの受信を停止する
5. When メールが保存される, CloudInbox shall 使用量（`usage.storageBytes`）を正確に増加させる
6. When メールが完全削除される（ゴミ箱から30日経過後）, CloudInbox shall 使用量（`usage.storageBytes`）を正確に減少させる
7. The CloudInbox shall 使用量の更新日時（`usage.updatedAt`）を常に最新の状態に保つ
8. When ユーザーが設定画面を開く, CloudInbox shall 現在のプラン情報（`plan.label`, `plan.maxStorageBytes`）と使用量（`usage.storageBytes`）を表示する

### Requirement 8: 国際化（i18n）

**Objective:** As a ユーザー, I want Flutterアプリの画面が複数言語に対応すること, so that 日本語と英語の両方でアプリを利用できる

#### Acceptance Criteria
1. The CloudInbox shall Flutterアプリのすべての画面文字列を国際化対応する
2. The CloudInbox shall 少なくとも日本語（ja）と英語（en）をサポートする
3. When アプリが起動される, CloudInbox shall デバイスの言語設定に基づいて適切な言語を選択する
4. When 画面に文字列を表示する, CloudInbox shall 国際化リソースから文字列を取得して表示する
5. The CloudInbox shall Flutterの`intl`パッケージまたは`flutter_localizations`を使用して国際化を実装する
6. The CloudInbox shall 文字列リソースを外部ファイル（.arbファイル等）に定義する
7. The CloudInbox shall バックエンド（Cloud Functions）のコメント、ログ、エラーメッセージは日本語のままとする
8. The CloudInbox shall 画面に表示されるエラーメッセージのみ国際化対応する
9. The CloudInbox shall 日付・時刻のフォーマットをロケールに応じて適切に表示する
10. The CloudInbox shall 数値（ファイルサイズ、使用量等）のフォーマットをロケールに応じて適切に表示する

### Requirement 9: データ暗号化基盤

**Objective:** As a システム, I want ユーザーデータ（パスワード、メール本文）を暗号化して保存すること, so that 第三者や運営側が内容を閲覧できないようにする

#### Acceptance Criteria
1. The CloudInbox shall Google Cloud KMSを使用してKEK（Key Encryption Key）を管理する
2. The CloudInbox shall ユーザーごとにDEK（Data Encryption Key）を生成し、KMSでwrapしてSecret Managerに保存する
3. When ユーザーが初回ログインする, CloudInbox shall ユーザー専用のDEKを自動生成する
4. The CloudInbox shall AES-256-GCMアルゴリズムを使用してデータを暗号化する
5. When データを暗号化する, CloudInbox shall ランダムなnonce（12バイト）を生成し、暗号化結果に含める
6. When データを暗号化する, CloudInbox shall 暗号化結果を`{ciphertext, nonce, tag}`形式で保存する
7. The CloudInbox shall 暗号化・復号処理をCloud Functions内で実行する
8. The CloudInbox shall 暗号鍵（KEK/DEK）をクライアント側に送信しない
9. The CloudInbox shall 平文データをログに出力しない
10. The CloudInbox shall 暗号化前のデータをメモリに保持しない（処理後は即座に破棄）
11. When メール本文を保存する, CloudInbox shall Firestoreに`{encrypted: true, ciphertext, nonce, tag}`形式で保存する
12. When メール本文を表示する, CloudInbox shall Cloud Functions経由で復号処理を実行し、復号済みデータのみクライアントに送信する
13. The CloudInbox shall 復号済みデータをクライアント側でキャッシュしない
14. The CloudInbox shall 添付ファイルの暗号化はMVPでは実装しない（後回し）

### Requirement 12: 広告表示機能（Freeプラン）

**Objective:** As a ビジネス, I want Freeプランユーザーの画面下に広告を表示すること, so that 収益化を実現し、無料プランを継続提供できる

#### Acceptance Criteria
1. When ユーザーがFreeプラン（`plan.id: "free"`）である, CloudInbox shall すべての主要画面の下部に広告を表示する
2. When ユーザーがProプラン（将来実装）である, CloudInbox shall 広告を表示しない
3. When 広告を表示する, CloudInbox shall 画面下部に固定表示する（バナー広告形式）
4. When 広告が表示される, CloudInbox shall 広告がコンテンツを隠さないようにレイアウトを調整する
5. When 広告が読み込まれる, CloudInbox shall 広告読み込み中の状態を表示する（オプション）
6. If 広告の読み込みに失敗する, CloudInbox shall 広告エリアを非表示にする（コンテンツは通常通り表示）
7. The CloudInbox shall 広告表示はGoogle AdMob（または同等の広告プラットフォーム）を使用する
8. The CloudInbox shall 広告は主要画面（認証画面を除く）に表示する
9. The CloudInbox shall 広告のクリックや表示に関するプライバシーポリシーに準拠する
