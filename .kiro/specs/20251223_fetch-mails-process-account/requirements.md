# Requirements Document

## Introduction
fetchMailsの`processAccount`処理を独立したソースとして切り出し、Cloud Functionsの`onTaskDispatched`トリガで非同期実行できるようにすることで、メール取得処理のスケーラビリティと責務分離を実現する。

## Requirements

### Requirement 1: fetchMailsのprocessAccount処理の独立化
**Objective:** メール取得処理の開発者として、`processAccount`ロジックを独立したモジュールとして管理できるようにしたい。そうすることで、fetchMails本体と疎結合に保ちつつ、テスト容易性と再利用性を高められる。

#### Acceptance Criteria
1. fetchMails本体から`processAccount`ロジックが分離され、専用のソースファイル（モジュール）として定義されていること。
2. 既存のfetchMailsフローからは、新しい`processAccount`モジュールを経由してアカウント単位の処理が呼び出されること。
3. `processAccount`モジュールに対する単体テストが作成され、正常系・代表的な異常系（認証エラー、接続エラーなど）をカバーしていること。
4. 既存のメール取得フローに対する統合テストが更新され、`processAccount`分離後も従来どおりメールが取得・保存されることが確認できること。
5. `processAccount`モジュールのインターフェース（入力・出力・例外）がドキュメント化されていること。

### Requirement 2: Cloud Tasks / onTaskDispatchedによる非同期実行
**Objective:** バックエンドエンジニアとして、`processAccount`処理をCloud Tasks＋`onTaskDispatched`で非同期実行できるようにしたい。そうすることで、アカウント数の増加に対してもスケーラブルかつ安定したメール取得処理を提供できる。

#### Acceptance Criteria
1. Cloud Tasksキューに`processAccount`実行用のタスクを投入でき、そのタスクをCloud Functionsの`onTaskDispatched`ハンドラが受け取り、対象アカウントのメール取得処理を実行すること。
2. タスクペイロードに含めるアカウントIDや必要なメタデータの形式・バリデーションルールが定義されていること。
3. タスク実行時の失敗（ネットワークエラー、認証エラー、外部APIエラーなど）に対して、再試行ポリシー（リトライ回数、間隔など）がCloud Tasks設定として定義されていること。
4. タスク実行結果（成功／失敗、主要なエラー理由）が、ログまたは監視基盤から確認できるようになっていること。
5. fetchMails全体の処理時間が、アカウント数に比例して線形に増大しないこと（アカウントごとの処理がタスクとして並列・非同期に実行されるアーキテクチャになっていること）。
6. Cloud Tasksから呼び出される`processAccountTaskHandler`関数のタイムアウトを15分とし、その内部で実行される単一アカウント向け`processAccount`処理は開始から10分を超過した場合に残処理を中断し、未処理分は以降のスケジュール実行または再キューイングされたタスクによって継続処理できる設計になっていること。


