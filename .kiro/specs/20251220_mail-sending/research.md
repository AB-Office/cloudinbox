# Research & Design Decisions

## Summary
- **Feature**: 20251220_mail-sending
- **Discovery Scope**: Extension (既存POP3受信機能への拡張)
- **Key Findings**:
  - 既存のPOP3実装パターン（accountTest、暗号化）をSMTP実装にも適用可能
  - nodemailerライブラリが既にpackage-lock.jsonに存在（バージョン7.0.11）
  - FirestoreのmailAccountsコレクションにsmtpフィールドが既に定義されている（SPEC_MVP_FREE.md）
  - 既存のsaveMail関数を再利用して送信済みメールを保存可能

## Research Log

### SMTPクライアントライブラリ調査
- **Context**: 要件でnodemailerの使用が推奨されているため、TypeScript型定義とSSL/TLS対応を確認
- **Sources Consulted**: 
  - package-lock.jsonでnodemailer 7.0.11の存在を確認
  - 既存のPOP3実装パターン（pop3Client.ts、accountTest.ts）を分析
- **Findings**:
  - nodemailerはTypeScript型定義を提供（@types/nodemailer）
  - SSL/TLS接続（SMTPS）をサポート（secure: trueオプション）
  - 既存のPOP3実装と同様に、Cloud Functions内で実行可能
- **Implications**: 
  - 既存の暗号化パターン（decryptPassword）をSMTP認証に再利用
  - accountTest.tsのパターンを踏襲してSMTP接続テスト関数を実装
  - セキュリティ要件（SSL/TLS必須）は既存POP3実装と同一

### 既存実装パターン分析
- **Context**: POP3実装のパターンをSMTP実装に適用するため、既存コードを分析
- **Sources Consulted**:
  - functions/src/mail/accountTest.ts（POP3接続テスト実装）
  - functions/src/mail/pop3Client.ts（POP3クライアント実装）
  - functions/src/mail/saveMail.ts（メール保存実装）
  - functions/src/encryption/（暗号化実装）
- **Findings**:
  - POP3接続テストはCallable Functionとして実装（accountTest）
  - パスワード復号化はdecryptPassword関数を使用
  - メール保存はsaveMail関数でFirestore/Storageに保存
  - SSL/TLS必須チェックが実装されている
- **Implications**:
  - SMTP接続テストも同様のCallable Functionとして実装
  - 既存の暗号化インフラを再利用
  - 送信済みメール保存はsaveMail関数を再利用（smtpアカウント情報を追加）

### Firestoreスキーマ確認
- **Context**: SMTP設定の保存場所とデータ構造を確認
- **Sources Consulted**:
  - docs/SPEC_MVP_FREE.md（mailAccountsスキーマ定義）
  - apps/mobile_app/lib/main.dart（既存のアカウント作成・更新実装）
- **Findings**:
  - mailAccountsコレクションにsmtpフィールドが既に定義されている
  - smtp.passwordEncフィールドでパスワードを暗号化保存
  - POP3実装と同様の構造（host, port, useSsl, userName, passwordEnc）
- **Implications**:
  - 既存スキーマに沿って実装可能
  - AccountFormDataクラスにSMTPフィールドを追加
  - アカウント作成・更新処理を拡張

### UIコンポーネントパターン確認
- **Context**: Flutter UIの実装パターンを確認
- **Sources Consulted**:
  - apps/mobile_app/lib/widgets/navigation_drawer.dart（ナビゲーションドロワー）
  - apps/mobile_app/lib/screens/mail_list_screen.dart（メール一覧画面）
  - apps/mobile_app/lib/screens/account_screen.dart（アカウント設定画面）
- **Findings**:
  - NavigationDrawerにメニュー項目を追加するパターンが確立
  - MailListScreenはフィルタパラメータでラベル条件を変更可能
  - FloatingActionButtonはFlutter標準ウィジェット
- **Implications**:
  - ナビゲーションドロワーに「送信済み」メニューを追加
  - MailListScreenにsentラベル用フィルタを追加
  - メール一覧画面にFloatingActionButtonを追加

## Architecture Pattern Evaluation

既存システムへの拡張のため、新しいアーキテクチャパターンは採用せず、既存のServerless Functionsパターンを継続。

## Design Decisions

### Decision: SMTP接続テストの実装パターン
- **Context**: SMTP接続テスト機能を実装する必要がある
- **Alternatives Considered**:
  1. 新規のsmtpClient.tsとsmtpAccountTest.tsを作成
  2. 既存のaccountTest.tsを拡張してPOP3/SMTP両方に対応
  3. 既存のaccountTest.tsにSMTPテスト機能を追加（別関数として）
- **Selected Approach**: 既存のaccountTest.tsを拡張して、SMTP接続テストも対応する。新しいsmtpClient.tsを作成してSMTP接続ロジックを分離。
- **Rationale**: 
  - POP3実装パターンとの一貫性を維持
  - コードの再利用性と保守性を向上
  - 既存の認証・エラーハンドリングパターンを活用
- **Trade-offs**: 
  - accountTest.tsがやや複雑になるが、統一されたインターフェースを提供
  - smtpClient.tsの分離により、テストと保守が容易
- **Follow-up**: SMTP接続テストのエラーメッセージがPOP3と適切に区別できるか確認

### Decision: 送信済みメールの保存方法
- **Context**: 送信済みメールをFirestore/Storageに保存する必要がある
- **Alternatives Considered**:
  1. 新しいsaveSentMail関数を作成
  2. 既存のsaveMail関数を拡張して送信済みメールにも対応
  3. saveMail関数をそのまま再利用（送信元情報を追加）
- **Selected Approach**: 既存のsaveMail関数を再利用し、送信済みメールにも対応。送信元アカウントIDをパラメータに追加。
- **Rationale**: 
  - 既存の暗号化・保存ロジックを再利用可能
  - コードの重複を避ける
  - 受信メールと送信済みメールの一貫性を維持
- **Trade-offs**: 
  - saveMail関数が送信/受信両方に対応するため、パラメータが増加
  - 関数名の変更検討が必要（sendMailやprocessMailなど）
- **Follow-up**: saveMail関数の名前変更またはオーバーロードの検討

### Decision: SMTP設定のPOP3設定からのコピー機能
- **Context**: ユーザビリティ向上のため、POP3設定からSMTP設定へのコピー機能を実装
- **Alternatives Considered**:
  1. UI側（Flutter）のみで実装
  2. バックエンド側でコピー処理を実行
  3. UI側でフィールド値をコピーし、バックエンドは通常の保存処理のみ
- **Selected Approach**: UI側（Flutter）のみで実装。POP3設定フィールドの値をSMTP設定フィールドにコピー。
- **Rationale**: 
  - シンプルで即座に反映される
  - バックエンドの複雑化を避ける
  - ユーザーが手動で修正可能
- **Trade-offs**: 
  - クライアント側での実装のみで十分
  - SMTPポートのデフォルト値設定（587または465）はUI側で判断
- **Follow-up**: 一般的なSMTPポート番号（587, 465）のデフォルト値設定ロジック

## Risks & Mitigations
- **SMTP接続のタイムアウト**: Cloud Functionsのタイムアウト（9分）内に完了するよう、接続タイムアウトを適切に設定
- **メール送信の失敗時のロールバック**: 送信済みメール保存に失敗した場合のエラーハンドリングを実装
- **SMTP設定とPOP3設定の不整合**: POP3設定からのコピー機能で、SMTP設定が正しくコピーされることをテストで確認
- **送信済みメールの容量管理**: 送信済みメールも受信メールと同様に容量にカウントされるため、容量チェックを実装

## References
- [nodemailer Documentation](https://nodemailer.com/) - SMTPクライアントライブラリ
- functions/src/mail/accountTest.ts - 既存POP3接続テスト実装
- functions/src/mail/pop3Client.ts - 既存POP3クライアント実装
- docs/SPEC_MVP_FREE.md - Firestoreスキーマ定義
- .kiro/specs/20251209_cloudinbox-mvp-pop3/design.md - 既存POP3機能の設計ドキュメント

