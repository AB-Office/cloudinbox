#!/bin/bash
# Secret Manager 設定スクリプト
# 
# 使用方法:
#   ./setup-secret-manager.sh YOUR_PROJECT_ID

set -e

if [ -z "$1" ]; then
  echo "エラー: プロジェクトIDを指定してください"
  echo "使用方法: ./setup-secret-manager.sh YOUR_PROJECT_ID"
  exit 1
fi

PROJECT_ID=$1

echo "Secret Manager 設定を開始します..."
echo "プロジェクトID: ${PROJECT_ID}"
echo ""

# プロジェクトを設定
gcloud config set project ${PROJECT_ID}

# Secret Manager APIの有効化
echo "1. Secret Manager APIを有効化しています..."
gcloud services enable secretmanager.googleapis.com --project=${PROJECT_ID}

# プロジェクト番号を取得
echo "2. プロジェクト番号を取得しています..."
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
echo "   プロジェクト番号: ${PROJECT_NUMBER}"

# Cloud FunctionsのサービスアカウントにIAM権限を付与
echo "3. IAM権限を設定しています..."

# Cloud Buildサービスアカウント
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
echo "   Cloud Buildサービスアカウント: ${CLOUDBUILD_SA}"
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None \
  --quiet || echo "   権限は既に設定されています。"

# Cloud Functions実行サービスアカウント
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "   Cloud Functions実行サービスアカウント: ${COMPUTE_SA}"
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None \
  --quiet || echo "   権限は既に設定されています。"

echo ""
echo "=========================================="
echo "設定が完了しました！"
echo "=========================================="
echo ""
echo "Secret Managerのシークレット命名規則:"
echo "  形式: dek-{uid}"
echo "  例: dek-user123, dek-abc123def456"
echo ""
echo "シークレットは、ユーザー初回ログイン時に自動的に作成されます。"
echo "（onUserCreateトリガーで実行）"
echo ""

