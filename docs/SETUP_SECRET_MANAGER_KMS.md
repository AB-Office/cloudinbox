# Secret Manager と KMS の設定手順

## 概要

CloudInbox MVPでは、ユーザーごとのDEK（Data Encryption Key）をKMSでwrapしてSecret Managerに保存します。
`onUserCreate`関数が実行される際に、自動的にDEKが生成・保存されます。

## 前提条件

- GCPプロジェクト: `cloudinbox-dev`
- リージョン: `asia-northeast1`
- Cloud Functionsがデプロイ済みであること

## 設定手順

### 1. KMSキーリングとキーの作成

Cloud Shellまたはローカルの`gcloud`コマンドで実行します。

```bash
# プロジェクトを設定
gcloud config set project cloudinbox-dev

# キーリングを作成
gcloud kms keyrings create cloudinbox-keys \
  --location=asia-northeast1

# 暗号化キー（KEK）を作成
gcloud kms keys create dek-kek \
  --location=asia-northeast1 \
  --keyring=cloudinbox-keys \
  --purpose=encryption
```

**作成されるKMSキーのフルパス:**
```
projects/cloudinbox-dev/locations/asia-northeast1/keyRings/cloudinbox-keys/cryptoKeys/dek-kek
```

### 2. Cloud Functionsの環境変数設定

`onUserCreate`関数に`KMS_KEY_NAME`環境変数を設定します。

#### 方法1: Firebase CLIで設定（設定値をコードから参照する場合）

将来的に `functions.config().kms.key_name` をコードから参照する場合に備えた手順です。  
（**現状の実装は `process.env.KMS_KEY_NAME` を直接参照しているため、必須ではありませんが、設定コマンド自体はここに残しておきます**）

```bash
cd /home/abtc/Projects/cloudinbox
firebase functions:config:set kms.key_name="projects/cloudinbox-dev/locations/asia-northeast1/keyRings/cloudinbox-keys/cryptoKeys/dek-kek"
firebase deploy --only functions:onUserCreate
```

#### 方法2: GCPコンソールで直接環境変数を設定（現行実装で推奨）

（コードは `process.env.KMS_KEY_NAME` を直接参照しているため、**GCPコンソールの環境変数として設定する**のがもっとも確実です）

1. [Cloud Functions コンソール](https://console.cloud.google.com/functions)にアクセス
2. `onUserCreate`関数を選択
3. 「編集」をクリック
4. 「ランタイム、ビルド、接続」タブを開く
5. 「環境変数」セクションで以下を追加:
   - **名前**: `KMS_KEY_NAME`
   - **値**: `projects/cloudinbox-dev/locations/asia-northeast1/keyRings/cloudinbox-keys/cryptoKeys/dek-kek`
6. 「デプロイ」をクリック

    **注意**: 他のFunctions（`encryptPasswordFunction`, `accountTest`, `fetchMails`, `decryptMail`, `purgeTrash`など）も同じKMSキーを使用する場合は、同様に環境変数を設定してください。
    
    **重要**: `encryptPasswordFunction`はアカウント作成時にパスワードを暗号化するため、必ず`KMS_KEY_NAME`環境変数を設定してください。

### 3. Cloud Functionsのサービスアカウントに権限を付与

Cloud Functionsのサービスアカウントに、KMSとSecret Managerへのアクセス権限を付与します。

#### サービスアカウントの確認

Cloud Functionsの詳細画面で「ランタイムサービスアカウント」を確認します。
実際に使用されているサービスアカウントは以下のコマンドで確認できます:

```bash
gcloud functions describe onUserCreate \
  --region=asia-northeast1 \
  --format="value(serviceAccountEmail)"
```

通常は以下のいずれかです:
- `cloudinbox-dev@appspot.gserviceaccount.com`（実際に使用されている）
- `690982893350-compute@developer.gserviceaccount.com`

#### KMS権限の付与

```bash
# KMS CryptoKey Encrypter/Decrypterロールを付与
# 実際に使用されているサービスアカウントに付与してください
gcloud kms keys add-iam-policy-binding dek-kek \
  --location=asia-northeast1 \
  --keyring=cloudinbox-keys \
  --member="serviceAccount:cloudinbox-dev@appspot.gserviceaccount.com" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
```

#### Secret Manager権限の付与

```bash
# Secret Manager Adminロールを付与（シークレット作成とバージョン追加に必要）
# 実際に使用されているサービスアカウントに付与してください
gcloud projects add-iam-policy-binding cloudinbox-dev \
  --member="serviceAccount:cloudinbox-dev@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.admin"
```

**より細かい権限設定（推奨）:**

最小権限の原則に従う場合は、以下のロールを個別に付与します:

```bash
# Secret Manager Secret Version Adderロール（バージョン追加に必要）
gcloud projects add-iam-policy-binding cloudinbox-dev \
  --member="serviceAccount:690982893350-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretVersionAdder"

# Secret Manager Secret Accessorロール（シークレット読み取りに必要）
gcloud projects add-iam-policy-binding cloudinbox-dev \
  --member="serviceAccount:690982893350-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 動作確認

### 1. Functionsを再デプロイ

```bash
cd /home/abtc/Projects/cloudinbox/functions
npm run build
firebase deploy --only functions:onUserCreate
```

### 2. 新しいユーザーでログイン

Flutterアプリで新しいユーザーでログインし、`onUserCreate`関数をトリガーします。

### 3. ログの確認

```bash
firebase functions:log --only onUserCreate
```

以下のログが表示されれば成功です:
- `onUserCreate triggered for user: <uid>`
- `Initializing user: <uid>`
- `User document created in transaction: <uid>`
- `Creating DEK for user: <uid>`
- `DEK created successfully for user: <uid>`
- `User initialized successfully: <uid>`

### 4. Secret Managerの確認

[Secret Manager コンソール](https://console.cloud.google.com/security/secret-manager)にアクセスし、以下のシークレットが作成されていることを確認します:

- **シークレット名**: `dek-<uid>`（`<uid>`はユーザーID）
- **リージョン**: `asia-northeast1`（自動レプリケーション）

## トラブルシューティング

### エラー: `KMS_KEY_NAME environment variable is not set`

**原因**: 環境変数が設定されていない

**解決方法**: 上記の「2. Cloud Functionsの環境変数設定」を実行してください。

### エラー: `Permission denied` または `IAM permission error`

**原因**: サービスアカウントに権限が付与されていない

**解決方法**: 上記の「3. Cloud Functionsのサービスアカウントに権限を付与」を実行してください。

### エラー: `Data key already exists for user`

**原因**: 既にDEKが存在している

**解決方法**: これは正常な動作です。ユーザーが既に初期化されているため、DEKの再作成はスキップされます。

### Secret Managerにシークレットが作成されない

**確認項目**:
1. `onUserCreate`のログにエラーがないか確認
2. サービスアカウントにSecret Manager権限が付与されているか確認
3. 環境変数`KMS_KEY_NAME`が正しく設定されているか確認
4. KMSキーが正しく作成されているか確認

**デバッグ方法**:
```bash
# onUserCreateの最新ログを確認
firebase functions:log --only onUserCreate

# Secret Managerのシークレット一覧を確認
gcloud secrets list --project=cloudinbox-dev
```

## 関連ドキュメント

- [Google Cloud KMS ドキュメント](https://cloud.google.com/kms/docs)
- [Secret Manager ドキュメント](https://cloud.google.com/secret-manager/docs)
- [Cloud Functions 環境変数](https://cloud.google.com/functions/docs/configuring/env-var)
