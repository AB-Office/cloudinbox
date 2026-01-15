# CloudInbox Scripts

このディレクトリには、CloudInboxプロジェクトのユーティリティスクリプトが含まれています。

## セットアップ

```bash
npm install
```

## 法的文書のアップロード

### 前提条件

Firebase Admin SDKの認証情報が必要です。以下のいずれかの方法で認証を設定してください：

1. **サービスアカウントキーファイルを使用**:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
   ```

2. **gcloud CLIで認証**:
   ```bash
   gcloud auth application-default login
   ```

### アップロード

```bash
npm run upload-legal-docs
```

このスクリプトは、`apps/web_app/public/`内のMarkdownファイルをFirebase Storageの`legal-docs/`パスにアップロードします。

### 検証

アップロード後、以下のコマンドでファイルの存在とメタデータを検証できます：

```bash
npm run verify-legal-docs
```

このスクリプトは、以下の項目を確認します：
- すべての期待されるファイルが存在すること
- 各ファイルの`contentType`が`text/markdown`であること
- 各ファイルのサイズが0バイトでないこと

## スクリプト一覧

- `upload-legal-docs.ts`: 法的文書をFirebase Storageにアップロード
- `verify-legal-docs.ts`: アップロードされた法的文書の存在とメタデータを検証

