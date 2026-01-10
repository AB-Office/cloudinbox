# VPC と Cloud NAT を使用した固定IP設定手順

## 概要

CloudInbox MVPでは、SMTP送信時の固定IPアドレスを提供するため、Direct VPC EgressとCloud NATを使用します。これにより、メール送信時のIPアドレスが固定され、受信側サーバーでのホワイトリスト登録やセキュリティ設定が容易になります。

## アーキテクチャ

```
Cloud Functions (Gen2)
    ↓ (Direct VPC Egress)
VPC (vpc-cloud-run)
    ↓
Subnet (subnet-cloud-run, 10.10.0.0/16)
    ↓
Cloud Router (router-cloud-run)
    ↓
Cloud NAT (nat-cloud-run)
    ↓
Static IP Address (固定IP)
    ↓
Internet (SMTP送信)
```

## 前提条件

- GCPプロジェクト: `cloudinbox-dev`
- リージョン: `asia-northeast1`
- Cloud Functions Gen2がデプロイ済みであること
- 管理者権限を持ったアカウントでログインしていること

## 設定手順

### 1. プロジェクトの設定

```bash
# プロジェクトを設定
gcloud config set project cloudinbox-dev
```

### 2. VPCの作成

カスタムサブネットモードでVPCを作成します。

```bash
gcloud compute networks create vpc-cloud-run --subnet-mode=custom
```

**確認方法:**
```bash
gcloud compute networks describe vpc-cloud-run
```

### 3. サブネットの構築

VPC内にサブネットを作成します。IPレンジは`10.10.0.0/16`を使用します。

```bash
gcloud compute networks subnets create subnet-cloud-run \
    --region=asia-northeast1 \
    --network=vpc-cloud-run \
    --range=10.10.0.0/16
```

**確認方法:**
```bash
gcloud compute networks subnets describe subnet-cloud-run --region=asia-northeast1
```

### 4. ルーターの構築

Cloud Routerを作成します。これはCloud NATが使用するルーターです。

```bash
gcloud compute routers create router-cloud-run \
    --region=asia-northeast1 \
    --network=vpc-cloud-run
```

**確認方法:**
```bash
gcloud compute routers describe router-cloud-run --region=asia-northeast1
```

### 5. IPアドレスの予約

固定IPアドレスを予約します。このIPアドレスはCloud NATで使用されます。

```bash
gcloud compute addresses create static-ip --region=asia-northeast1
```

**確認方法:**
```bash
gcloud compute addresses describe static-ip --region=asia-northeast1
```

**予約されたIPアドレスの確認:**
```bash
gcloud compute addresses list --filter="name:static-ip" --format="value(address)"
```

出力例:
```
34.84.123.45
```

このIPアドレスをメモしておいてください。SMTPサーバーのホワイトリスト登録などで使用します。

### 6. Cloud NATの設定

Cloud NATを作成し、すべてのサブネットIPレンジをNAT経由でルーティングし、予約した固定IPアドレスを使用するように設定します。

```bash
gcloud compute routers nats create nat-cloud-run \
    --router=router-cloud-run \
    --region=asia-northeast1 \
    --nat-all-subnet-ip-ranges \
    --nat-external-ip-pool=static-ip
```

**確認方法:**
```bash
gcloud compute routers nats describe nat-cloud-run \
    --router=router-cloud-run \
    --region=asia-northeast1
```

### 7. Cloud Functions Gen2のVPC接続設定（GUI）

Firebase ConsoleまたはGoogle Cloud Consoleで、`sendMail`関数にVPC接続を設定します。

#### 方法1: Firebase Consoleを使用する場合

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクト（`cloudinbox-dev`）を選択
3. 左メニューから「Functions」を選択
4. `sendMail`関数をクリック
5. 「設定」タブを選択
6. 「VPC接続」セクションを展開
7. 「VPC接続を設定」をクリック
8. 以下の設定を入力:
   - **VPC接続器**: `vpc-cloud-run-connector`（まだ存在しない場合は作成が必要）
   - **Egress設定**: 「プライベートIPのみ」を選択
   - **VPC**: `vpc-cloud-run`を選択
   - **サブネット**: `subnet-cloud-run`を選択
9. 「保存」をクリック

#### 方法2: Google Cloud Consoleを使用する場合

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクト（`cloudinbox-dev`）を選択
3. 左メニューから「Cloud Functions」を選択
4. `sendMail`関数をクリック
5. 「編集」タブをクリック
6. 「接続設定」セクションを展開
7. 「VPC接続器」ドロップダウンから「既存の接続器を使用」を選択
   - または「新しい接続器を作成」を選択して接続器を作成
8. 「Egress設定」で「プライベートIPのみ」を選択
9. 「デプロイ」をクリック

#### 方法3: Serverless VPC Access Connectorの作成（必要な場合）

VPC接続器が存在しない場合は、先に作成する必要があります。

```bash
gcloud compute networks vpc-access connectors create vpc-cloud-run-connector \
    --region=asia-northeast1 \
    --subnet=subnet-cloud-run \
    --subnet-project=cloudinbox-dev \
    --min-instances=2 \
    --max-instances=3 \
    --machine-type=e2-micro
```

**確認方法:**
```bash
gcloud compute networks vpc-access connectors describe vpc-cloud-run-connector \
    --region=asia-northeast1
```

### 8. Cloud Functions Gen2のコード設定

`sendMail`関数のコードで、Direct VPC Egressを使用するように設定します。

関数定義の例（`functions/src/mail/sendMail.ts`）:

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

// VPC接続設定をグローバルに設定（必要に応じて）
setGlobalOptions({
  vpcConnector: 'vpc-cloud-run-connector',
  vpcConnectorEgressSettings: 'PRIVATE_RANGES_ONLY',
  region: 'asia-northeast1',
});

// または、関数レベルで設定
export const sendMail = onCall(
  {
    region: 'asia-northeast1',
    vpcConnector: 'vpc-cloud-run-connector',
    vpcConnectorEgressSettings: 'PRIVATE_RANGES_ONLY',
    timeoutSeconds: 540,
    memory: '512MB',
  },
  async (request) => {
    // SMTP送信処理
    // ...
  }
);
```

**注意**: コードレベルでの設定は、GUIでの設定と競合する可能性があるため、GUIでの設定を推奨します。

### 9. 関数の再デプロイ

VPC接続設定を反映するため、関数を再デプロイします。

```bash
cd /home/abtc/Projects/cloudinbox
firebase deploy --only functions:sendMail
```

### 10. 動作確認

#### 固定IPアドレスの確認

Cloud Functionsから外部への通信が予約したIPアドレスを使用しているか確認します。

```bash
# NATの統計情報を確認
gcloud compute routers nats describe nat-cloud-run \
    --router=router-cloud-run \
    --region=asia-northeast1 \
    --format="value(natIpAllocations)"

# または、Cloud Functionsのログを確認
gcloud functions logs read sendMail --limit 50
```

#### SMTP送信テスト

実際にメールを送信して、固定IPアドレスから送信されていることを確認します。送信元IPアドレスは、受信側のメールサーバーのログで確認できます。

## トラブルシューティング

### VPC接続エラーが発生する場合

1. **VPC接続器の状態を確認**
   ```bash
   gcloud compute networks vpc-access connectors describe vpc-cloud-run-connector \
       --region=asia-northeast1
   ```

2. **Cloud Functionsのログを確認**
   ```bash
   gcloud functions logs read sendMail --limit 100
   ```

3. **ファイアウォールルールを確認**
   VPC内から外部への通信が許可されていることを確認します。
   ```bash
   gcloud compute firewall-rules list --filter="network:vpc-cloud-run"
   ```

### NATが動作していない場合

1. **NATの設定を確認**
   ```bash
   gcloud compute routers nats describe nat-cloud-run \
       --router=router-cloud-run \
       --region=asia-northeast1
   ```

2. **固定IPアドレスが正しく割り当てられているか確認**
   ```bash
   gcloud compute addresses describe static-ip --region=asia-northeast1
   ```

### メール送信が失敗する場合

1. **SMTPサーバーのホワイトリストに固定IPを追加**
   予約した固定IPアドレス（`34.84.123.45`など）をSMTPサーバーのホワイトリストに追加してください。

2. **Cloud Functionsのタイムアウト設定を確認**
   SMTP送信には時間がかかる場合があるため、タイムアウトを十分に設定してください（例: 540秒）。

3. **ファイアウォールルールでSMTPポート（25, 465, 587）が許可されているか確認**

## 参考情報

- [Serverless VPC Access の概要](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access)
- [Cloud NAT のドキュメント](https://cloud.google.com/nat/docs/overview)
- [Cloud Functions Gen2 の VPC 接続](https://cloud.google.com/functions/docs/networking/connecting-vpc)
- [Direct VPC Egress の設定](https://cloud.google.com/functions/docs/networking/direct-vpc-egress)

## コスト考慮事項

- **VPC接続器**: 常時実行されるインスタンスのコストが発生します（最小インスタンス数 × インスタンスタイプのコスト）
- **Cloud NAT**: NATゲートウェイ経由のトラフィックに対して課金されます
- **固定IPアドレス**: 未使用でもIPアドレスの予約費用が発生します

コストを最小化するには、最小インスタンス数を調整し、必要に応じてVPC接続器のインスタンスタイプを小さく設定します。

