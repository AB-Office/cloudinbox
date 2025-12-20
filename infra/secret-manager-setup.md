# Secret Manager 設定手順

## 概要

CloudInbox MVPでは、Google Cloud Secret Managerを使用してユーザーごとのDEK（Data Encryption Key）を保存します。DEKはKMSでwrapされた状態でSecret Managerに保存されます。

## 前提条件

- Google Cloud プロジェクトが作成されていること
- Google Cloud KMSが設定されていること（タスク4.5参照）
- Google Cloud CLI（gcloud）がインストールされていること

## 設定手順

### 1. Secret Manager APIの有効化

```bash
gcloud services enable secretmanager.googleapis.com --project=YOUR_PROJECT_ID
```

### 2. Cloud FunctionsのIAMロール設定

Cloud FunctionsのサービスアカウントにSecret Managerへのアクセス権限を付与します。

```bash
# プロジェクト番号を取得
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

# Cloud BuildサービスアカウントにSecret Manager Secret Accessorロールを付与
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Functions実行サービスアカウントにSecret Manager Secret Accessorロールを付与
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**注意**: 
- `roles/secretmanager.secretAccessor`ロールは、シークレットの読み取り権限を提供します
- シークレットの作成・更新・削除は、Cloud Functionsのコード内で実行されます（初回ユーザー作成時など）

### 3. Secret Managerのシークレット命名規則

CloudInbox MVPでは、以下の命名規則を使用します：

- **形式**: `dek-{uid}`
- **例**: `dek-user123`, `dek-abc123def456`

**実装場所**: `functions/src/encryption/keys.ts`の`getSecretName()`関数

```typescript
function getSecretName(uid: string): string {
  return `dek-${uid}`;
}
```

### 4. Firebase Functions v2の設定

Firebase Functions v2では、Secret Managerへのアクセスは自動的に有効化されます。追加の設定は不要です。

ただし、環境変数として`GCLOUD_PROJECT`が設定されている必要があります（通常は自動設定されます）。

## 検証

設定が正しく行われているか確認します。

```bash
# Secret Manager APIが有効化されているか確認
gcloud services list --enabled --project=YOUR_PROJECT_ID | grep secretmanager

# IAMポリシーの確認
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*-compute@developer.gserviceaccount.com" \
  --format="table(bindings.role)"
```

## シークレットのライフサイクル

### 作成

- **タイミング**: ユーザー初回ログイン時（`onUserCreate`トリガー）
- **実装**: `functions/src/encryption/keys.ts`の`createDataKeyForUser()`関数
- **処理内容**:
  1. 32バイト（256ビット）のDEKを生成
  2. KMSのKEKでwrap
  3. Secret Managerにシークレットを作成
  4. wrapされたDEKをシークレットバージョンとして保存

### 取得

- **タイミング**: パスワードやメール本文の暗号化・復号化時
- **実装**: `functions/src/encryption/keys.ts`の`getDataKey()`関数
- **処理内容**:
  1. メモリキャッシュをチェック（関数実行中のみ有効）
  2. Secret Managerから最新バージョンを取得
  3. KMSのKEKでunwrap
  4. メモリキャッシュに保存

### 削除

- **タイミング**: ユーザーアカウント削除時（将来実装）
- **注意**: ユーザー削除時は、関連するシークレットも削除する必要があります

## トラブルシューティング

### Secret Manager APIが有効化されていない

```bash
gcloud services enable secretmanager.googleapis.com --project=YOUR_PROJECT_ID
```

### IAM権限エラー

Cloud Functionsのサービスアカウントに正しいIAMロールが付与されているか確認してください。

```bash
# サービスアカウントの確認
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*-compute@developer.gserviceaccount.com"
```

### 環境変数が設定されていない

`GCLOUD_PROJECT`環境変数が正しく設定されているか確認してください。Firebase Functions v2では通常自動設定されます。

```bash
# Firebase Functionsの環境変数を確認
firebase functions:config:get
```

## セキュリティ考慮事項

1. **最小権限の原則**: Cloud Functionsのサービスアカウントには、必要最小限の権限のみを付与します
2. **シークレットの暗号化**: DEKはKMSでwrapされた状態でSecret Managerに保存されます
3. **アクセスログ**: Secret ManagerへのアクセスはCloud Audit Logsに記録されます
4. **シークレットのローテーション**: 将来的には、DEKのローテーション機能を実装することを検討します

## 参考資料

- [Google Cloud Secret Manager ドキュメント](https://cloud.google.com/secret-manager/docs)
- [Secret Manager IAM ロール](https://cloud.google.com/secret-manager/docs/access-control)

