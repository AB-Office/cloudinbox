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

## Storage CORS設定

WebアプリからFirebase Storageにアクセスする際のCORSエラーを回避するため、StorageバケットにCORS設定を適用する必要があります。

### 前提条件

- Google Cloud SDK (`gsutil`) がインストールされていること
- 認証が設定されていること（`gcloud auth application-default login` または `GOOGLE_APPLICATION_CREDENTIALS`）

### CORS設定の適用

```bash
npm run setup-storage-cors
```

このスクリプトは、`infra/firebase/storage.cors.json`の設定をFirebase Storageバケットに適用します。

**注意**: 本番環境と開発環境で異なるバケットを使用している場合は、環境変数`FIREBASE_STORAGE_BUCKET`を設定してください：

```bash
FIREBASE_STORAGE_BUCKET=cloudinbox-prod.firebasestorage.app npm run setup-storage-cors
```

## スクリプト一覧

- `upload-legal-docs.ts`: 法的文書をFirebase Storageにアップロード
- `verify-legal-docs.ts`: アップロードされた法的文書の存在とメタデータを検証
- `setup-storage-cors.ts`: Firebase StorageバケットにCORS設定を適用
- `test-storage-rules.ts`: Storageルールの設定を検証
- `list-storage-files.ts`: Storage内のファイル一覧を表示

