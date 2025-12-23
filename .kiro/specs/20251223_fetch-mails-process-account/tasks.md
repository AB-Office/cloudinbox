# Implementation Plan

## Tasks

- [x] 1. `processAccount`モジュールの新規作成 (P)
  - `functions/src/mail`配下に`processAccount.ts`（仮）を追加し、`ProcessAccountParams`インターフェースと`processAccount`関数シグネチャを定義する。
  - 既存のPOP3/POP3Sクライアント、メール保存ロジックを呼び出す形で、単一アカウントのメール取得〜保存フローを移植する。
  - 既存`fetchMails`内のアカウント単位処理ロジックを参照しつつ、責務を`processAccount`側に集約する。
  - _Requirements: 1_

- [x] 2. `fetchMails`のオーケストレータ化とCloud Tasksタスク投入 (P)
  - 既存`fetchMails`実装をリファクタし、アカウント一覧取得とCloud Tasksタスク投入に責務を限定する。
  - 各アカウントごとに`accountId`等を含むペイロードでCloud Tasksキューにタスクを投入する処理を実装する。
  - 処理開始時刻を記録し、開始から10分を超過したら新規タスク投入を停止する制御を追加する（タイムアウト15分前提）。
  - _Requirements: 1, 2, 6_

- [x] 3. `onTaskDispatched`ハンドラの実装と`processAccount`呼び出し (P)
  - Cloud Functions側に`onTaskDispatched`ハンドラ（例: `processAccountTaskHandler`）を追加し、Cloud Tasks用エンドポイントとして公開する。
  - 受信ペイロードから`accountId`等を検証し、問題がなければ`processAccount`を呼び出す。
  - 成功時・失敗時のHTTPステータスとレスポンスボディをCloud Tasks仕様に沿って返す。
  - _Requirements: 2_

- [x] 4. Cloud Tasksキュー設定と再試行ポリシーの定義
  - インフラ側（`firebase.json`やGCPコンソール／Terraform等）で、`processAccount`用Cloud Tasksキューを定義する。
  - 再試行ポリシー（最大試行回数、バックオフ等）を、設計ドキュメントの方針に沿って設定する。
  - 設計上のHTTPエラーコード（4xx/5xx）と再試行挙動が期待通りになるように確認する。
  - _Requirements: 2_

- [x] 5. タイムアウト／実行時間監視の実装
  - `processAccountTaskHandler`関数のタイムアウトを15分に設定し、デプロイ設定や環境変数を更新する。
  - 単一アカウント向け`processAccount`処理が開始から10分を超過した場合に処理を中断するための制御（ループ中断や経過時間チェックなど）を実装し、残りのメールは後続タスクで処理されることを保証する。
  - `processAccountTaskHandler`および`processAccount`の実行時間をメトリクスまたはログとして記録し、10分／15分の閾値に対する動作が期待どおりであることを確認できるようにする。
  - _Requirements: 2, 6_

- [x] 6. 単体テストの追加・更新
  - `processAccount`モジュールに対する単体テスト（正常系・認証エラー・接続エラー・容量超過・10分超過による処理中断など）を`fetchMailsPop3.test.ts`でカバーする。
  - `onTaskDispatched`ハンドラ（`processAccountTaskHandler`）の入力バリデーションと`processAccount`呼び出しをモックした単体テストを`processAccountTaskHandler.test.ts`で追加済みとし、今後の変更にも追従できるようにする。
  - 必要に応じて既存テストを更新し、新しいモジュール構成に追従させる。
  - _Requirements: 1, 2_

- [x] 7. 統合テスト・E2Eテストの更新
  - `fetchMails`実行時に、対象アカウント分のCloud Tasksタスクが正しく生成されることを`fetchMails.test.ts`のテストで確認する。
  - Cloud Tasks→`onTaskDispatched`→`processAccount`のフローについては、`fetchMails.test.ts`でのタスクエンキュー検証、`processAccountTaskHandler.test.ts`でのペイロード検証と`processAccount`呼び出し、`fetchMailsPop3.test.ts`での実際のメール取得〜保存フロー検証を組み合わせて一連の動作を担保する。
  - `processAccount`分離後も従来どおりメールが取得・保存されることは、`fetchMailsPop3.test.ts`の統合テスト群で確認済みとする。
  - _Requirements: 1, 2_


