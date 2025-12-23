# Implementation Plan

## Tasks

- [ ] 1. `processAccount`モジュールの新規作成 (P)
  - `functions/src/mail`配下に`processAccount.ts`（仮）を追加し、`ProcessAccountParams`インターフェースと`processAccount`関数シグネチャを定義する。
  - 既存のPOP3/POP3Sクライアント、メール保存ロジックを呼び出す形で、単一アカウントのメール取得〜保存フローを移植する。
  - 既存`fetchMails`内のアカウント単位処理ロジックを参照しつつ、責務を`processAccount`側に集約する。
  - _Requirements: 1_

- [ ] 2. `fetchMails`のオーケストレータ化とCloud Tasksタスク投入 (P)
  - 既存`fetchMails`実装をリファクタし、アカウント一覧取得とCloud Tasksタスク投入に責務を限定する。
  - 各アカウントごとに`accountId`等を含むペイロードでCloud Tasksキューにタスクを投入する処理を実装する。
  - 処理開始時刻を記録し、開始から10分を超過したら新規タスク投入を停止する制御を追加する（タイムアウト15分前提）。
  - _Requirements: 1, 2, 6_

- [ ] 3. `onTaskDispatched`ハンドラの実装と`processAccount`呼び出し (P)
  - Cloud Functions側に`onTaskDispatched`ハンドラ（例: `processAccountTaskHandler`）を追加し、Cloud Tasks用エンドポイントとして公開する。
  - 受信ペイロードから`accountId`等を検証し、問題がなければ`processAccount`を呼び出す。
  - 成功時・失敗時のHTTPステータスとレスポンスボディをCloud Tasks仕様に沿って返す。
  - _Requirements: 2_

- [ ] 4. Cloud Tasksキュー設定と再試行ポリシーの定義
  - インフラ側（`firebase.json`やGCPコンソール／Terraform等）で、`processAccount`用Cloud Tasksキューを定義する。
  - 再試行ポリシー（最大試行回数、バックオフ等）を、設計ドキュメントの方針に沿って設定する。
  - 設計上のHTTPエラーコード（4xx/5xx）と再試行挙動が期待通りになるように確認する。
  - _Requirements: 2_

- [ ] 5. タイムアウト／実行時間監視の実装
  - `fetchMails`関数のタイムアウトを15分に設定し、関数設定やデプロイ構成を更新する。
  - `fetchMails`開始〜終了の実行時間をメトリクスまたはログとして記録し、10分経過時点で新規タスク投入を停止していることを確認できるようにする。
  - 必要に応じて監視ダッシュボード（Stackdriver等）のメトリクスパネルを追加する。
  - _Requirements: 2, 6_

- [ ] 6. 単体テストの追加・更新
  - `processAccount`モジュールに対する単体テストを作成し、正常系・代表的な異常系（認証エラー、接続エラーなど）をカバーする。
  - `onTaskDispatched`ハンドラの入力バリデーションと`processAccount`呼び出しをモックした単体テストを追加する。
  - 必要に応じて既存テストを更新し、新しいモジュール構成に追従させる。
  - _Requirements: 1, 2_

- [ ] 7. 統合テスト・E2Eテストの更新
  - `fetchMails`実行時に、対象アカウント数分のCloud Tasksタスクが正しく生成されることを確認する統合テストを実装する。
  - Cloud Tasks→`onTaskDispatched`→`processAccount`のフローが一連で動作することを検証する（必要に応じてモック環境またはステージング環境を利用）。
  - `processAccount`分離後も従来どおりメールが取得・保存されることを確認するE2Eテストを追加または更新する。
  - _Requirements: 1, 2_


