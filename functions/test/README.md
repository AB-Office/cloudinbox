# SMTPテストプログラム

このディレクトリには、実際のSMTPサーバーに接続してメール送信をテストするプログラムが含まれています。

## smtp-test.ts

実際のSMTPサーバーに接続して、メール送信をテストするためのスクリプトです。

### 使用方法

```bash
npm run test:smtp <host>:<port> <username> <password> <from> <to>
```

または

```bash
npx ts-node test/smtp-test.ts <host>:<port> <username> <password> <from> <to>
```

### パラメータ

- `<host>:<port>`: SMTPサーバーのホスト名とポート番号（例: `smtp.example.com:587` または `smtp.example.com:465`）
- `username`: SMTP認証ユーザー名（例: `user@example.com`）
- `password`: SMTP認証パスワード
- `from`: 送信元メールアドレス（例: `user@example.com`）
- `to`: 宛先メールアドレス（例: `recipient@example.com`）

### 例

```bash
npm run test:smtp smtp.example.com:587 user@example.com password user@example.com recipient@example.com
```

### 動作

1. SMTPサーバーへの接続と認証をテストします
2. テストメールを送信します
3. 結果をコンソールに出力します

### 注意事項

- 実際のSMTPサーバーに接続するため、有効な認証情報が必要です
- ポート465の場合は自動的に`secure: true`になります（SSL/TLS）
- ポート587などの場合は`secure: false`になります（STARTTLS）

