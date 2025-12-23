# Cloud Tasks と OIDC 認証の設定手順

## 概要

CloudInbox MVPでは、`fetchMails`関数がCloud Tasksを使用して`processAccountTaskHandler`（`onTaskDispatched`ハンドラ）にタスクを投入します。Cloud TasksからCloud Functions v2へのHTTPリクエストを認証するために、OIDCトークンを使用します。

## 前提条件

- GCPプロジェクトが設定済みであること
- Cloud Functions v2がデプロイ済みであること
- `processAccountTaskHandler`関数がデプロイ済みであること
- App Engineが有効化されていること（`@appspot.gserviceaccount.com`サービスアカウントが必要）

## アーキテクチャ

```
fetchMails (Cloud Function v1)
    ↓
Cloud Tasks Queue (processAccountTaskHandler)
    ↓ (OIDC認証付きHTTPリクエスト)
processAccountTaskHandler (Cloud Function v2, onTaskDispatched)
    ↓
processAccount (ドメインロジック)
```

## 設定手順

### 1. プロジェクトの確認

```bash
# 現在のプロジェクトを確認
gcloud config get-value project

# プロジェクトを設定（必要に応じて）
gcloud config set project <プロジェクトID>
```

### 2. App Engineの有効化確認

App Engineのサービスアカウント（`<プロジェクトID>@appspot.gserviceaccount.com`）が必要です。App Engineが有効化されていない場合は、有効化してください。

```bash
# App Engineのサービスアカウントを確認
gcloud iam service-accounts list --filter="email:*appspot*" --format="value(email)"
```

**出力例:**
```
cloudinbox-dev@appspot.gserviceaccount.com
```

### 3. Cloud Tasksキューの確認

`processAccountTaskHandler`関数をデプロイすると、自動的に同名のCloud Tasksキューが作成されます。

```bash
# キュー一覧を確認
gcloud tasks queues list --location=asia-northeast1
```

**出力例:**
```
QUEUE_NAME                 STATE    MAX_NUM_OF_TASKS  MAX_RATE (/sec)  MAX_ATTEMPTS
processAccountTaskHandler  RUNNING  1000              500.0            3
```

### 4. IAM権限の付与

App Engineのサービスアカウントに、Cloud Runサービス（`processAccountTaskHandler`）のInvokerロールを付与します。

```bash
# プロジェクトIDを変数に設定（必要に応じて）
PROJECT_ID=$(gcloud config get-value project)

# IAM権限を付与
gcloud run services add-iam-policy-binding processaccounttaskhandler \
  --region=asia-northeast1 \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/run.invoker"
```

**出力例:**
```
Updated IAM policy for service [processaccounttaskhandler].
bindings:
- members:
  - serviceAccount:cloudinbox-dev@appspot.gserviceaccount.com
  role: roles/run.invoker
etag: BwZGoo4Ec5Y=
version: 1
```

### 5. 環境変数の設定（オプション）

デフォルトでは、コードは自動的に `<プロジェクトID>@appspot.gserviceaccount.com` を使用します。異なるサービスアカウントを使用する場合は、環境変数を設定してください。

#### 方法1: Firebase CLIで設定

```bash
firebase functions:config:set cloud_tasks.service_account="<サービスアカウントのメールアドレス>"
firebase deploy --only functions:processAccountTaskHandler
```

#### 方法2: GCPコンソールで設定

1. [Cloud Functions コンソール](https://console.cloud.google.com/functions)を開く
2. `processAccountTaskHandler`関数を選択
3. 「編集」をクリック
4. 「環境変数、ネットワーク、タイムアウト」セクションを展開
5. 「環境変数を追加」をクリック
6. 以下を設定:
   - **名前**: `CLOUD_TASKS_SERVICE_ACCOUNT`
   - **値**: `<サービスアカウントのメールアドレス>`
7. 「デプロイ」をクリック

### 6. 動作確認

`fetchMails`関数を実行して、タスクが正常に投入され、`processAccountTaskHandler`が呼び出されることを確認します。

```bash
# ログを確認
firebase functions:log --only fetchMails
firebase functions:log --only processAccountTaskHandler
```

## 本番環境への適用

本番環境でも同様の手順を実行してください。

### 本番環境での設定手順

1. **プロジェクトを本番環境に切り替え**
   ```bash
   gcloud config set project <本番プロジェクトID>
   ```

2. **App Engineのサービスアカウントを確認**
   ```bash
   gcloud iam service-accounts list --filter="email:*appspot*" --format="value(email)"
   ```

3. **IAM権限を付与**
   ```bash
   gcloud run services add-iam-policy-binding processaccounttaskhandler \
     --region=asia-northeast1 \
     --member="serviceAccount:<本番プロジェクトID>@appspot.gserviceaccount.com" \
     --role="roles/run.invoker"
   ```

4. **Cloud Tasksキューの確認**
   ```bash
   gcloud tasks queues list --location=asia-northeast1
   ```

## トラブルシューティング

### エラー: "The request was not authenticated"

**原因**: App EngineのサービスアカウントにCloud RunサービスのInvokerロールが付与されていない。

**解決方法**: 上記の「4. IAM権限の付与」を実行してください。

### エラー: "Queue does not exist"

**原因**: Cloud Tasksキューが存在しない。

**解決方法**: 
1. `processAccountTaskHandler`関数がデプロイされているか確認
2. キュー名が正しいか確認（デフォルトでは関数名と同じ）
3. 環境変数 `CLOUD_TASKS_QUEUE_NAME` が正しく設定されているか確認

### エラー: "Service account not found"

**原因**: App Engineが有効化されていない、またはサービスアカウントが存在しない。

**解決方法**:
1. App Engineを有効化する
2. または、別のサービスアカウント（例: `{project-number}-compute@developer.gserviceaccount.com`）を使用し、環境変数 `CLOUD_TASKS_SERVICE_ACCOUNT` で指定する

### デバッグ方法

```bash
# Cloud Tasksキューの詳細を確認
gcloud tasks queues describe processAccountTaskHandler --location=asia-northeast1

# Cloud RunサービスのIAMポリシーを確認
gcloud run services get-iam-policy processaccounttaskhandler --region=asia-northeast1

# 関数のログを確認
firebase functions:log --only processAccountTaskHandler --limit 50
```

## 関連ドキュメント

- [Cloud Tasks ドキュメント](https://cloud.google.com/tasks/docs)
- [Cloud Functions v2 タスクキュー ドキュメント](https://firebase.google.com/docs/functions/task-queue-functions)
- [Cloud Run 認証 ドキュメント](https://cloud.google.com/run/docs/securing/authenticating)

## コード実装の詳細

### cloudTasksClient.ts

`cloudTasksClient.ts`では、以下のようにOIDCトークンを設定しています:

```typescript
const serviceAccountEmail = process.env.CLOUD_TASKS_SERVICE_ACCOUNT || 
  `${this.projectId}@appspot.gserviceaccount.com`;

const task = {
  httpRequest: {
    httpMethod: 'POST' as const,
    url: `https://${this.location}-${this.projectId}.cloudfunctions.net/${this.functionName}`,
    headers: {
      'Content-Type': 'application/json',
    },
    body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    oidcToken: {
      serviceAccountEmail: serviceAccountEmail,
    },
  },
};
```

### processAccountTaskHandler.ts

`processAccountTaskHandler.ts`では、`onTaskDispatched`を使用してタスクを受け取ります:

```typescript
export const processAccountTaskHandler = onTaskDispatched(
  {
    region: 'asia-northeast1',
    timeoutSeconds: 900, // 15分
    retryConfig: {
      maxAttempts: 3,
      maxRetrySeconds: 3600, // 1時間
      maxBackoffSeconds: 300, // 5分
    },
  },
  async (task) => {
    try {
      await handleProcessAccountTask(task.data);
    } catch (error: any) {
      functions.logger.error('processAccountTaskHandler failed', error);
      throw error;
    }
  }
);
```

## 更新履歴

- 2025-12-23: 初版作成

