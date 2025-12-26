# Requirements Document

## Introduction

この仕様は、CloudInboxサービスにおいて、受信メールに含まれる添付ファイルをユーザーが閲覧・ダウンロードできる機能を実装するための要件を定義します。現在、バックエンド側では添付ファイルの保存機能（暗号化してFirebase Storageに保存）は実装済みですが、クライアントアプリ側での表示・ダウンロード機能が未実装です。本機能により、ユーザーはメール詳細画面で添付ファイルを確認し、必要に応じてダウンロードできるようになります。

## Requirements

### Requirement 1: 添付ファイルリスト取得機能

**Objective:** ユーザーとして、メールメッセージ内の添付ファイルリストを確認したい。これにより、ダウンロード前に利用可能な添付ファイルを識別できる。

#### Acceptance Criteria
1. When ユーザーがメール詳細画面を開いた時, the Mail Detail Service shall そのメッセージのすべての添付ファイルのリストを取得して表示する
2. If メッセージに添付ファイルがある場合, then the Mail Detail Service shall 各添付ファイルのファイル名、ファイルサイズ、およびコンテンツタイプを表示する
3. If メッセージに添付ファイルがない場合, then the Mail Detail Service shall 添付ファイルリストを表示しない
4. The Mail Detail Service shall 認証されたユーザーに属するメッセージの添付ファイルのみを取得する

### Requirement 2: 添付ファイルダウンロード・復号化機能（バックエンド）

**Objective:** ユーザーとして、メールから添付ファイルをダウンロードしたい。これにより、送信されたファイルにアクセスできる。

#### Acceptance Criteria
1. When ユーザーが添付ファイルのダウンロードを要求した時, the Attachment Download Service shall Firebase Storageから暗号化された添付ファイルを取得する
2. When the Attachment Download Serviceが暗号化された添付ファイルを取得した時, it shall ユーザーのデータ暗号化キー（DEK）を使用してファイルを復号化する
3. If Storageに添付ファイルが存在しない場合, then the Attachment Download Service shall 適切なエラーメッセージを返す
4. If 復号化が失敗した場合, then the Attachment Download Service shall 適切なエラーメッセージを返す
5. When 復号化が成功した時, the Attachment Download Service shall ファイル名、コンテンツタイプ、およびファイルサイズと共に復号化されたファイル内容を返す
6. The Attachment Download Service shall 認証されたユーザーに属するメッセージの添付ファイルのみのダウンロードを許可する

### Requirement 3: 添付ファイル表示機能（フロントエンド）

**Objective:** ユーザーとして、メール詳細画面で添付ファイルを表示・ダウンロードしたい。これにより、アプリを離れることなくファイルにアクセスできる。

#### Acceptance Criteria
1. When メッセージに添付ファイルがある時, the Mail Detail Screen shall 添付ファイル名とファイルサイズを表示する添付ファイルリストセクションを表示する
2. When ユーザーが添付ファイルをタップした時, the Mail Detail Screen shall その添付ファイルのダウンロードを開始する
3. While 添付ファイルがダウンロード中である間, the Mail Detail Screen shall 読み込みインジケーターを表示する
4. When 添付ファイルのダウンロードが完了した時, the Mail Detail Screen shall デバイスのダウンロードディレクトリにファイルを保存する、またはファイルを開く/共有するオプションを提供する
5. If 添付ファイルのダウンロードが失敗した場合, the Mail Detail Screen shall ユーザーにエラーメッセージを表示する
6. The Mail Detail Screen shall ファイルタイプを示す形式（例：コンテンツタイプに基づくアイコン）で添付ファイルを表示する

### Requirement 4: セキュリティとエラーハンドリング

**Objective:** システムとして、安全で信頼性の高い添付ファイル処理を確保したい。これにより、ユーザーデータが保護され、エラーが適切に処理される。

#### Acceptance Criteria
1. The Attachment Download Service shall 任意の添付ファイルダウンロードリクエストを処理する前にユーザー認証を検証する
2. The Attachment Download Service shall 要求された添付ファイルが認証されたユーザーが所有するメッセージに属していることを検証する
3. If 認証が失敗した場合, then the Attachment Download Service shall 認証エラーを返す
4. If 認可が失敗した場合（ユーザーがメッセージを所有していない）, then the Attachment Download Service shall 認可エラーを返す
5. The Attachment Download Service shall ストレージエラー（ファイルが見つからない、ネットワークエラー）を処理し、適切なエラーメッセージを返す
6. The Attachment Download Service shall デバッグおよびモニタリング目的でエラーを適切にログに記録する
7. The Mail Detail Screen shall ネットワークエラーを処理し、ユーザーフレンドリーなエラーメッセージを表示する

