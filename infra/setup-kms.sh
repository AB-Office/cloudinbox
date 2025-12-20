#!/bin/bash
# Google Cloud KMS 設定スクリプト
# 
# 使用方法:
#   ./setup-kms.sh YOUR_PROJECT_ID

set -e

if [ -z "$1" ]; then
  echo "エラー: プロジェクトIDを指定してください"
  echo "使用方法: ./setup-kms.sh YOUR_PROJECT_ID"
  exit 1
fi

PROJECT_ID=$1
LOCATION="asia-northeast1"
KEYRING_NAME="cloudinbox"
KEY_NAME="kek"

echo "Google Cloud KMS 設定を開始します..."
echo "プロジェクトID: ${PROJECT_ID}"
echo "リージョン: ${LOCATION}"
echo "鍵リング名: ${KEYRING_NAME}"
echo "鍵名: ${KEY_NAME}"
echo ""

# プロジェクトを設定
gcloud config set project ${PROJECT_ID}

# KMS APIの有効化
echo "1. KMS APIを有効化しています..."
gcloud services enable cloudkms.googleapis.com --project=${PROJECT_ID}

# 鍵リングの作成（既に存在する場合はスキップ）
echo "2. 鍵リングを作成しています..."
if gcloud kms keyrings describe ${KEYRING_NAME} --location=${LOCATION} --project=${PROJECT_ID} 2>/dev/null; then
  echo "   鍵リング '${KEYRING_NAME}' は既に存在します。スキップします。"
else
  gcloud kms keyrings create ${KEYRING_NAME} \
    --location=${LOCATION} \
    --project=${PROJECT_ID}
  echo "   鍵リング '${KEYRING_NAME}' を作成しました。"
fi

# KEKの作成（既に存在する場合はスキップ）
echo "3. KEKを作成しています..."
if gcloud kms keys describe ${KEY_NAME} --keyring=${KEYRING_NAME} --location=${LOCATION} --project=${PROJECT_ID} 2>/dev/null; then
  echo "   KEK '${KEY_NAME}' は既に存在します。スキップします。"
else
  gcloud kms keys create ${KEY_NAME} \
    --keyring=${KEYRING_NAME} \
    --location=${LOCATION} \
    --purpose=encryption \
    --default-algorithm=google-symmetric-encryption \
    --project=${PROJECT_ID}
  echo "   KEK '${KEY_NAME}' を作成しました。"
fi

# プロジェクト番号を取得
echo "4. プロジェクト番号を取得しています..."
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
echo "   プロジェクト番号: ${PROJECT_NUMBER}"

# Cloud FunctionsのサービスアカウントにIAM権限を付与
echo "5. IAM権限を設定しています..."

# Cloud Buildサービスアカウント
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
echo "   Cloud Buildサービスアカウント: ${CLOUDBUILD_SA}"
gcloud kms keys add-iam-policy-binding ${KEY_NAME} \
  --keyring=${KEYRING_NAME} \
  --location=${LOCATION} \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" \
  --project=${PROJECT_ID} \
  --quiet || echo "   権限は既に設定されています。"

# Cloud Functions実行サービスアカウント
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "   Cloud Functions実行サービスアカウント: ${COMPUTE_SA}"
gcloud kms keys add-iam-policy-binding ${KEY_NAME} \
  --keyring=${KEYRING_NAME} \
  --location=${LOCATION} \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" \
  --project=${PROJECT_ID} \
  --quiet || echo "   権限は既に設定されています。"

# 鍵の完全なリソース名を表示
KEY_FULL_NAME="projects/${PROJECT_ID}/locations/${LOCATION}/keyRings/${KEYRING_NAME}/cryptoKeys/${KEY_NAME}"
echo ""
echo "=========================================="
echo "設定が完了しました！"
echo "=========================================="
echo ""
echo "KMS鍵の完全なリソース名:"
echo "${KEY_FULL_NAME}"
echo ""
echo "環境変数として設定してください:"
echo "  export KMS_KEY_NAME=\"${KEY_FULL_NAME}\""
echo ""
echo "または、Firebase Functionsの環境変数として設定:"
echo "  firebase functions:config:set kms.key_name=\"${KEY_FULL_NAME}\""
echo ""
echo "注意: 実際のコードでは process.env.KMS_KEY_NAME を使用しているため、"
echo "      環境変数名は KMS_KEY_NAME である必要があります。"
echo ""

