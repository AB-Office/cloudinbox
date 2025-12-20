# Google Cloud KMS 設定手順

## 概要

CloudInbox MVPでは、Google Cloud KMSを使用してKEK（Key Encryption Key）を管理し、ユーザーごとのDEK（Data Encryption Key）をwrap/unwrapします。

## 前提条件

- Google Cloud プロジェクトが作成されていること
- Firebase CLIがインストールされていること
- Google Cloud CLI（gcloud）がインストールされていること

## 設定手順

### 1. KMS APIの有効化

```bash
gcloud services enable cloudkms.googleapis.com
```

### 2. KMS鍵リング（Key Ring）の作成

```bash
# リージョンを指定（asia-northeast1を推奨）
gcloud kms keyrings create cloudinbox \
  --location=asia-northeast1 \
  --project=YOUR_PROJECT_ID
```

**注意**: 鍵リングの名前は`cloudinbox`を推奨しますが、プロジェクトの命名規則に従って変更可能です。

### 3. KEK（Key Encryption Key）の作成

```bash
# AES-256鍵を作成
gcloud kms keys create kek \
  --keyring=cloudinbox \
  --location=asia-northeast1 \
  --purpose=encryption \
  --default-algorithm=google-symmetric-encryption \
  --project=YOUR_PROJECT_ID
```

**注意**: 
- 鍵名は`kek`を推奨しますが、プロジェクトの命名規則に従って変更可能です
- `google-symmetric-encryption`はAES-256-GCMアルゴリズムを使用します

### 4. Cloud FunctionsのIAMロール設定

Cloud FunctionsのサービスアカウントにKMS鍵へのアクセス権限を付与します。

```bash
# プロジェクト番号を取得
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

# Cloud FunctionsのサービスアカウントにKMS鍵へのアクセス権限を付与
gcloud kms keys add-iam-policy-binding kek \
  --keyring=cloudinbox \
  --location=asia-northeast1 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" \
  --project=YOUR_PROJECT_ID

# Cloud Functionsの実行サービスアカウントにも権限を付与
gcloud kms keys add-iam-policy-binding kek \
  --keyring=cloudinbox \
  --location=asia-northeast1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" \
  --project=YOUR_PROJECT_ID
```

### 5. 環境変数の設定

KMS鍵の完全なリソース名を環境変数として設定します。

鍵の完全なリソース名の形式：
```
projects/YOUR_PROJECT_ID/locations/asia-northeast1/keyRings/cloudinbox/cryptoKeys/kek
```

#### Firebase Functions v2での環境変数設定

`firebase.json`または`.env`ファイルで設定するか、Firebase Consoleから設定します。

```bash
# Firebase Functions v2の環境変数設定
firebase functions:config:set kms.key_name="projects/YOUR_PROJECT_ID/locations/asia-northeast1/keyRings/cloudinbox/cryptoKeys/kek"
```

または、`.env`ファイルを使用する場合：

```env
KMS_KEY_NAME=projects/YOUR_PROJECT_ID/locations/asia-northeast1/keyRings/cloudinbox/cryptoKeys/kek
```

**注意**: 実際のコードでは`process.env.KMS_KEY_NAME`を使用しているため、環境変数名は`KMS_KEY_NAME`である必要があります。

## 検証

設定が正しく行われているか確認します。

```bash
# 鍵リングの存在確認
gcloud kms keyrings list --location=asia-northeast1 --project=YOUR_PROJECT_ID

# KEKの存在確認
gcloud kms keys list --keyring=cloudinbox --location=asia-northeast1 --project=YOUR_PROJECT_ID

# IAMポリシーの確認
gcloud kms keys get-iam-policy kek \
  --keyring=cloudinbox \
  --location=asia-northeast1 \
  --project=YOUR_PROJECT_ID
```

## トラブルシューティング

### KMS APIが有効化されていない

```bash
gcloud services enable cloudkms.googleapis.com
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

`KMS_KEY_NAME`環境変数が正しく設定されているか確認してください。

```bash
# Firebase Functionsの環境変数を確認
firebase functions:config:get
```

## 参考資料

- [Google Cloud KMS ドキュメント](https://cloud.google.com/kms/docs)
- [Firebase Functions 環境変数](https://firebase.google.com/docs/functions/config-env)

