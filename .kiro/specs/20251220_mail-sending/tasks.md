# Implementation Tasks

## Overview

本ドキュメントは、メール送信機能の実装タスクを定義します。要件（requirements.md）と設計（design.md）に基づき、実装可能な単位に分解しています。

**実装順序**: 依存関係を考慮し、バックエンド基盤（SMTPクライアント、接続テスト） → メール送信機能 → フロントエンドUIの順で実装します。

## Task Categories

### 1. バックエンド実装（SMTP基盤）

#### - [x] 1.1 (P) SMTPクライアント実装 - smtpClient
- **目的**: SMTP接続と認証、メール送信機能を実装
- **作業内容**:
  - `functions/src/mail/smtpClient.ts`の作成
  - nodemailerライブラリを使用したSMTP接続実装
  - SSL/TLS必須チェック（useSsl=falseの場合はエラー）
  - SMTP接続テスト機能（testConnection）の実装
  - SMTPメール送信機能（sendMail）の実装
  - 接続タイムアウトとエラーハンドリング
  - 認証エラーと接続エラーの適切な処理
- **成果物**: functions/src/mail/smtpClient.ts
- **依存関係**: なし
- **要件カバー**: 1.7, 1.11, 2.8, 5.6, 5.7
- **見積もり**: 4時間

#### - [x] 1.2 (P) 接続テスト機能拡張 - accountTest
- **目的**: 既存のaccountTest関数を拡張してSMTP接続テストに対応
- **作業内容**:
  - `functions/src/mail/accountTest.ts`を拡張
  - `protocol`パラメータ（'pop3' | 'smtp'）の追加
  - SMTP接続テストロジックの追加（smtpClient.testConnectionを呼び出し）
  - 既存のPOP3接続テストロジックは維持
  - パスワード復号化処理（既存アカウントの場合）
  - 平文パスワードの処理（新規アカウントの場合、接続テスト後は即座に破棄）
  - SSL/TLS必須チェック
  - エラーハンドリングとレスポンス返却
- **成果物**: functions/src/mail/accountTest.ts（更新）
- **依存関係**: 1.1
- **要件カバー**: 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13
- **見積もり**: 3時間

#### - [x] 1.3 (P) メール送信機能実装 - sendMail
- **目的**: Cloud Functions経由でメールを送信し、送信済みメールを保存
- **作業内容**:
  - `functions/src/mail/sendMail.ts`の作成
  - HTTP Callable Functionとして実装
  - Firebase Authによる認証チェック
  - リクエストパラメータ検証（accountId、宛先、件名、本文）
  - メールアカウント情報取得（SMTP設定含む）
  - SMTPパスワード復号化（既存のdecryptPassword関数を使用）
  - smtpClient.sendMailを呼び出してメール送信
  - 送信成功後、既存のsaveMail関数を呼び出して送信済みメールを保存
  - MIMEメールの作成と解析（mailparserを使用）
  - 送信済みメールに`sent`ラベルを付与
  - スレッドIDの処理（返信・転送の場合は既存のthreadIdを使用）
  - エラーハンドリング（送信失敗、保存失敗）
  - タイムアウト設定（9分以内）
- **成果物**: functions/src/mail/sendMail.ts
- **依存関係**: 1.1
- **要件カバー**: 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.11, 3.12, 3.13, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15, 5.16, 5.17, 5.18
- **見積もり**: 6時間

#### - [x] 1.4 saveMail関数の拡張
- **目的**: 送信済みメール保存に対応するため、既存のsaveMail関数を拡張
- **作業内容**:
  - `functions/src/mail/saveMail.ts`を拡張
  - 送信元アカウントIDをパラメータに追加（オプション）
  - 送信済みメールの場合、`sent`ラベルを付与
  - 送信済みメールのスレッドID処理（返信・転送の場合は既存threadIdを使用）
  - 受信メールとの互換性を維持
- **成果物**: functions/src/mail/saveMail.ts（更新）
- **依存関係**: 1.3
- **要件カバー**: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
- **見積もり**: 2時間

### 2. フロントエンド実装（UI拡張）

#### - [x] 2.1 アカウント設定画面拡張 - AccountScreen
- **目的**: SMTP設定入力フィールドとPOP3設定からのコピー機能を追加
- **作業内容**:
  - `apps/mobile_app/lib/screens/account_screen.dart`を拡張
  - AccountFormDataクラスにSMTP設定フィールドを追加（smtpHost, smtpPort, smtpUsername, smtpPassword）
  - SMTP設定入力フィールドの追加（ホスト、ポート、ユーザー名、パスワード）
  - SMTP設定のuseSslをtrueに固定（UI上で非表示）
  - 「POP3設定からコピー」ボタンの追加（SMTP設定が未入力の場合のみ表示）
  - POP3設定からのコピー処理（ホスト、ユーザー名、パスワードをコピー、ポートは587または465にデフォルト設定）
  - SMTP接続テストボタンの追加
  - accountTest関数を呼び出してSMTP接続テストを実行
  - テスト結果の表示（成功/失敗、エラーメッセージ）
  - SMTP設定の保存処理（暗号化パスワードを含む）
  - SMTP設定必須チェック（POP3設定のみのアカウントは送信不可の明示）
  - 国際化対応（日本語・英語）
- **成果物**: apps/mobile_app/lib/screens/account_screen.dart（更新）
- **依存関係**: 1.2
- **要件カバー**: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 1.9, 1.10, 1.15, 1.16, 1.17, 1.18
- **見積もり**: 5時間

#### - [x] 2.2 メール作成画面実装 - ComposeScreen
- **目的**: メール作成・送信UI画面を実装
- **作業内容**:
  - `apps/mobile_app/lib/screens/compose_screen.dart`の作成
  - メール作成フォーム（宛先To、Cc、Bcc、件名、本文、添付ファイル）
  - 送信元アカウント選択ドロップダウン（複数アカウントがある場合）
  - 返信・転送時の自動入力処理（返信: 宛先と件名にRe:追加、転送: 件名にFw:追加と本文を含む）
  - 添付ファイル追加・削除機能
  - 入力検証（宛先、件名の必須チェック、メールアドレス形式検証）
  - 送信ボタン（送信中は無効化、送信状態を表示）
  - キャンセルボタン（確認ダイアログ表示、破棄選択で画面を閉じる）
  - sendMail関数を呼び出してメール送信
  - エラーハンドリングとユーザーフィードバック
  - 送信成功時の画面閉鎖とメール一覧画面への戻り
  - 国際化対応（日本語・英語）
  - Material Designに準拠したUI
- **成果物**: apps/mobile_app/lib/screens/compose_screen.dart
- **依存関係**: 1.3
- **要件カバー**: 2.1, 2.2, 2.3, 2.4, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.18, 4.19, 4.20, 4.21
- **見積もり**: 8時間

#### - [x] 2.3 メール一覧画面拡張 - MailListScreen
- **目的**: FloatingActionButton追加と送信済みメール一覧表示に対応
- **作業内容**:
  - `apps/mobile_app/lib/screens/mail_list_screen.dart`を拡張
  - FloatingActionButton（「＋」アイコン）を画面右下に追加
  - FloatingActionButtonタップ時にComposeScreenに遷移（新規作成）
  - 「送信済み」ラベル用のフィルタ条件を追加（labelsに`sent`を含む）
  - ページネーション対応（既存機能を継承）
  - 国際化対応
- **成果物**: apps/mobile_app/lib/screens/mail_list_screen.dart（更新）
- **依存関係**: 2.2
- **要件カバー**: 3.9, 3.10, 4.1
- **見積もり**: 2時間

#### - [x] 2.4 ナビゲーションメニュー拡張 - NavigationDrawer
- **目的**: 「送信済み」メニュー項目を追加
- **作業内容**:
  - `apps/mobile_app/lib/widgets/navigation_drawer.dart`を拡張
  - 「送信済み」メニュー項目（ListTile）を追加（アイコン: Icons.send）
  - ルーティング処理（/sentルートに対応）
  - 国際化対応（日本語・英語）
  - メニュー項目の順序: 受信トレイ、すべてのメール、送信済み、ゴミ箱、設定
- **成果物**: apps/mobile_app/lib/widgets/navigation_drawer.dart（更新）
- **依存関係**: 2.3
- **要件カバー**: 4.22, 4.23
- **見積もり**: 1時間

#### - [x] 2.5 メール詳細画面拡張 - DetailScreen
- **目的**: 返信・転送ボタンを追加
- **作業内容**:
  - `apps/mobile_app/lib/screens/detail_screen.dart`を拡張
  - 「返信」ボタンの追加（送信者への返信、件名にRe:追加）
  - 「全員に返信」ボタンの追加（送信者とCc受信者への返信、件名にRe:追加）
  - 「転送」ボタンの追加（件名にFw:追加、本文を含む）
  - ComposeScreenへの遷移（返信・転送データを渡す）
  - 国際化対応（日本語・英語）
- **成果物**: apps/mobile_app/lib/screens/detail_screen.dart（更新）
- **依存関係**: 2.2
- **要件カバー**: 2.2, 2.3, 4.2, 4.3, 4.4
- **見積もり**: 3時間

#### - [x] 2.6 ルーティング拡張 - main.dart
- **目的**: 新規ルート（/sent、/compose）を追加
- **作業内容**:
  - `apps/mobile_app/lib/main.dart`を拡張
  - `/sent`ルートの追加（送信済みメール一覧、MailListScreenでsentラベルフィルタ適用）
  - `/compose`ルートの追加（メール作成画面、ComposeScreen）
  - ナビゲーション処理の更新
  - 返信・転送時のComposeScreenへの遷移処理
- **成果物**: apps/mobile_app/lib/main.dart（更新）
- **依存関係**: 2.2, 2.3, 2.4
- **要件カバー**: 4.1, 4.22, 4.23
- **見積もり**: 2時間

### 3. テスト実装

#### - [x] 3.1 SMTPクライアントテスト - smtpClient.test.ts
- **目的**: SMTPクライアントの単体テスト
- **作業内容**:
  - `functions/src/mail/__tests__/smtpClient.test.ts`の作成
  - SMTP接続テストの成功/失敗ケース
  - SSL/TLS必須チェックのテスト
  - 認証エラーのテスト
  - 接続タイムアウトのテスト
  - メール送信の成功/失敗ケース
- **成果物**: functions/src/mail/__tests__/smtpClient.test.ts
- **依存関係**: 1.1
- **要件カバー**: 1.7, 1.11, 2.8, 5.6, 5.7
- **見積もり**: 3時間

#### - [x] 3.2 接続テスト機能拡張テスト - accountTest.test.ts
- **目的**: accountTest関数の拡張機能のテスト
- **作業内容**:
  - `functions/src/mail/__tests__/accountTest.test.ts`を更新
  - SMTP接続テストのテストケース追加
  - POP3/SMTP両方のプロトコル対応テスト
  - 既存アカウントのSMTP接続テスト
  - 新規アカウントのSMTP接続テスト
  - SSL/TLS必須チェックのテスト
- **成果物**: functions/src/mail/__tests__/accountTest.test.ts（更新）
- **依存関係**: 1.2
- **要件カバー**: 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13
- **見積もり**: 2時間

#### - [x] 3.3 メール送信機能テスト - sendMail.test.ts
- **目的**: メール送信機能の統合テスト
- **作業内容**:
  - `functions/src/mail/__tests__/sendMail.test.ts`の作成
  - メール送信の成功ケース
  - パラメータ検証のテスト
  - 認証エラーのテスト
  - 送信失敗時のエラーハンドリングテスト
  - 送信済みメール保存のテスト
  - スレッドID処理のテスト（返信・転送）
- **成果物**: functions/src/mail/__tests__/sendMail.test.ts
- **依存関係**: 1.3
- **要件カバー**: 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4, 5.5
- **見積もり**: 4時間

#### - [x] 3.4 UIテスト - ComposeScreen
- **目的**: メール作成画面のWidgetテスト
- **作業内容**:
  - `apps/mobile_app/test/compose_screen_test.dart`の作成
  - メール作成フォーム表示のテスト
  - 返信・転送時の自動入力テスト
  - 入力検証のテスト
  - 送信ボタンの動作テスト
  - エラー表示のテスト
- **成果物**: apps/mobile_app/test/compose_screen_test.dart
- **依存関係**: 2.2
- **要件カバー**: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.14, 4.15, 4.16
- **見積もり**: 3時間

#### - [x] 3.5 UIテスト - AccountScreen拡張
- **目的**: アカウント設定画面のSMTP設定機能のテスト
- **作業内容**:
  - `apps/mobile_app/test/account_screen_test.dart`を更新
  - SMTP設定入力フィールドのテスト
  - 「POP3設定からコピー」機能のテスト
  - SMTP接続テストボタンのテスト
  - SMTP設定保存のテスト
- **成果物**: apps/mobile_app/test/account_screen_test.dart（更新）
- **依存関係**: 2.1
- **要件カバー**: 1.1, 1.2, 1.3, 1.4, 1.16, 1.17, 1.18
- **見積もり**: 2時間

#### - [x] 3.6 UIテスト - NavigationDrawer拡張
- **目的**: ナビゲーションメニューの「送信済み」項目のテスト
- **作業内容**:
  - `apps/mobile_app/test/navigation_drawer_test.dart`を更新
  - 「送信済み」メニュー項目の表示テスト
  - 「送信済み」メニュータップ時のルーティングテスト
- **成果物**: apps/mobile_app/test/navigation_drawer_test.dart（更新）
- **依存関係**: 2.4
- **要件カバー**: 4.22, 4.23
- **見積もり**: 1時間

#### - [x] 3.7 UIテスト - DetailScreen拡張
- **目的**: メール詳細画面の返信・転送ボタンのテスト
- **作業内容**:
  - `apps/mobile_app/test/detail_screen_test.dart`を更新
  - 「返信」ボタンのテスト
  - 「全員に返信」ボタンのテスト
  - 「転送」ボタンのテスト
  - ComposeScreenへの遷移テスト
- **成果物**: apps/mobile_app/test/detail_screen_test.dart（更新）
- **依存関係**: 2.5
- **要件カバー**: 2.2, 2.3, 4.2, 4.3, 4.4
- **見積もり**: 2時間

#### - [x] 3.8 E2Eテスト - メール送信フロー
- **目的**: メール送信のエンドツーエンドテスト
- **作業内容**:
  - `apps/mobile_app/integration_test/send_mail_test.dart`の作成
  - メール作成から送信までのフローテスト
  - 送信済みメールの一覧表示テスト
  - 返信・転送フローのテスト
- **成果物**: apps/mobile_app/integration_test/send_mail_test.dart
- **依存関係**: 2.6
- **要件カバー**: 2.1, 2.2, 2.3, 2.4, 2.5, 3.9, 3.10
- **見積もり**: 3時間

