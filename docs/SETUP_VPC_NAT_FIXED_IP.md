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

Direct VPC Egressを使用するため、VPC内にサブネットを作成します。

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

**注意**: Direct VPC Egressを使用する場合、Serverless VPC Access Connectorは不要です。Cloud Functions Gen2が直接VPCに接続します。

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

### 7. Cloud Functions Gen2のDirect VPC Egress設定

**重要**: Direct VPC Egressを使用する場合、Serverless VPC Access Connectorは**不要**です。Cloud Functions Gen2が直接VPCに接続します。

**推奨方法**: gcloudコマンドを使用して設定します（GUIでの設定はUIが変更される可能性があるため）。

#### 方法1: Firebase CLIでデプロイ後、gcloud runでDirect VPC Egressを設定（推奨）

Gen2関数はCloud Runとして実行されるため、Firebase CLIでデプロイ後、`gcloud run services update`コマンドでDirect VPC Egressを設定します。

**既存のVPC connector設定がない場合（新規デプロイ）:**

```bash
cd /home/abtc/Projects/cloudinbox

# まず通常通りデプロイ（コードではVPC設定を指定しない）
firebase deploy --only functions:accountTest

# デプロイ後、Cloud RunサービスとしてDirect VPC Egressを設定
gcloud run services update accounttest \
    --region=asia-northeast1 \
    --vpc-egress=all-traffic \
    --network=vpc-cloud-run \
    --subnet=subnet-cloud-run \
    --project=cloudinbox-dev
```

**既存のVPC connector設定がある場合（既存関数の移行）:**

既存の関数にServerless VPC Access Connectorが設定されている場合、まずVPC connectorをクリアしてから、Direct VPC Egressを設定する必要があります。

```bash
# ステップ1: VPC connectorをクリア（vpc-egress=private-ranges-onlyが必要）
gcloud run services update accounttest \
    --region=asia-northeast1 \
    --clear-vpc-connector \
    --vpc-egress=private-ranges-only \
    --project=cloudinbox-dev

# ステップ2: Direct VPC Egressを設定
gcloud run services update accounttest \
    --region=asia-northeast1 \
    --vpc-egress=all-traffic \
    --network=vpc-cloud-run \
    --subnet=subnet-cloud-run \
    --project=cloudinbox-dev
```

**重要**: 
- `--vpc-egress=all-traffic`でDirect VPC Egressを有効化（すべてのトラフィックをVPC経由で送信）
- `--network`でVPCネットワークを指定
- `--subnet`でサブネットを指定（リージョンと同じリージョンである必要があります）
- Serverless VPC Access Connectorは不要です
- Gen2関数はCloud Runサービスとして管理されるため、`gcloud run services update`を使用します
- **VPC connectorとDirect VPC Egressは同時に使用できません**。既存のVPC connectorがある場合は、必ず先にクリアしてください
- VPC connectorをクリアする際は、`--vpc-egress=private-ranges-only`を同時に指定する必要があります

**Cloud Runサービス名の確認方法:**

関数名がCloud Runサービス名にどのように変換されるかを確認：

```bash
# デプロイ済みのCloud Runサービス一覧を確認
gcloud run services list --region=asia-northeast1 --project=cloudinbox-dev

# または、関数名から推測（通常は小文字に変換される）
# sendMail → sendmail
# accountTest → accounttest
```

#### 方法3: Firebase Console / Google Cloud Consoleを使用する場合（補足）

GUIでの設定は、UIが変更される可能性があるため、gcloudコマンドを推奨します。

- **Firebase Console**: Functionsの詳細ページから「設定」タブまたは「VPC接続」セクションを確認
- **Google Cloud Console**: 「Cloud Run」セクションから関数を選択し、設定画面でVPC接続を確認
- **Cloud Runとして管理**: Gen2関数は「Cloud Run」として表示される場合があります

**注意**: GUIでの設定場所は、Cloud Functionsのバージョンやリージョンによって異なる場合があります。設定が見つからない場合は、gcloudコマンドを使用してください。

### 8. 関数のデプロイとDirect VPC Egress設定

Direct VPC Egress設定を反映する手順：

#### 8-1. 新規デプロイの場合（VPC connector設定がない場合）

```bash
cd /home/abtc/Projects/cloudinbox

# 1. Firebase CLIで関数をデプロイ（コードではVPC設定を指定しない）
firebase deploy --only functions:accountTest

# 2. accountTest関数にDirect VPC Egressを設定
gcloud run services update accounttest \
    --region=asia-northeast1 \
    --vpc-egress=all-traffic \
    --network=vpc-cloud-run \
    --subnet=subnet-cloud-run \
    --project=cloudinbox-dev
```

#### 8-2. 既存のVPC connector設定がある場合（移行手順）

**重要**: 既存の関数にServerless VPC Access Connectorが設定されている場合、VPC connectorをクリアしてからDirect VPC Egressを設定する必要があります。**VPC connectorとDirect VPC Egressは同時に使用できません。**

```bash
# ステップ1: 既存のVPC connector設定を確認
gcloud run services describe accounttest \
    --region=asia-northeast1 \
    --project=cloudinbox-dev \
    --format="get(spec.template.metadata.annotations)" | grep -i vpc

# ステップ2: VPC connectorをクリア（vpc-egress=private-ranges-onlyを同時に指定する必要がある）
gcloud run services update accounttest \
    --region=asia-northeast1 \
    --clear-vpc-connector \
    --vpc-egress=private-ranges-only \
    --project=cloudinbox-dev

# ステップ3: Direct VPC Egressを設定
gcloud run services update accounttest \
    --region=asia-northeast1 \
    --vpc-egress=all-traffic \
    --network=vpc-cloud-run \
    --subnet=subnet-cloud-run \
    --project=cloudinbox-dev
```

**エラーが発生した場合:**

エラーメッセージ `VPC connector and direct VPC can not be used together` が表示される場合：

1. **既存のVPC connector設定を確認:**
   ```bash
   gcloud run services describe <サービス名> \
       --region=asia-northeast1 \
       --project=cloudinbox-dev \
       --format="get(spec.template.metadata.annotations)" | grep -i vpc
   ```

2. **VPC connectorをクリア:**
   ```bash
   gcloud run services update <サービス名> \
       --region=asia-northeast1 \
       --clear-vpc-connector \
       --vpc-egress=private-ranges-only \
       --project=cloudinbox-dev
   ```

3. **その後、Direct VPC Egressを設定:**
   ```bash
   gcloud run services update <サービス名> \
       --region=asia-northeast1 \
       --vpc-egress=all-traffic \
       --network=vpc-cloud-run \
       --subnet=subnet-cloud-run \
       --project=cloudinbox-dev
   ```

**注意事項**: 
- **VPC connectorとDirect VPC Egressは同時に使用できません**
- VPC connectorをクリアする際は、`--vpc-egress=private-ranges-only`を同時に指定する必要があります（`--vpc-egress=all-traffic`は指定できません）
- Gen2関数はCloud Runサービスとして実行されるため、`gcloud run services update`を使用します
- Cloud Runサービス名は関数名を小文字にしたものになります（例: `sendMail` → `sendmail`、`accountTest` → `accounttest`）
- `--vpc-egress=all-traffic`でDirect VPC Egressを有効化します（すべてのトラフィックをVPC経由で送信）
- `--network`と`--subnet`でVPCネットワークとサブネットを指定します

### 9. 動作確認（Direct VPC Egress設定の反映確認）

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

### Direct VPC Egress設定エラーが発生する場合

1. **VPCネットワークとサブネットの確認**
   ```bash
   # VPCネットワークの確認
   gcloud compute networks describe vpc-cloud-run
   
   # サブネットの確認
   gcloud compute networks subnets describe subnet-cloud-run --region=asia-northeast1
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

4. **Direct VPC Egressの設定を確認**
   ```bash
   gcloud functions describe sendMail --gen2 --region=asia-northeast1 \
       --format="value(serviceConfig.vpcAccess)"
   ```

5. **エラーメッセージ `VPC connector ... does not exist` が表示される場合**
   - Direct VPC Egressを使用する場合、VPC接続器（Serverless VPC Access Connector）は不要です
   - コードから`vpcConnector`の設定を削除してください
   - デプロイ時に`--vpc-egress=all-traffic`、`--vpc-network`、`--vpc-subnet`オプションを指定してください

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

- [Cloud NAT のドキュメント](https://cloud.google.com/nat/docs/overview)
- [Cloud Functions Gen2 の VPC 接続](https://cloud.google.com/functions/docs/networking/connecting-vpc)
- [Direct VPC Egress の設定](https://cloud.google.com/functions/docs/networking/direct-vpc-egress)
- [Direct VPC Egress と Serverless VPC Access Connector の比較](https://cloud.google.com/functions/docs/networking/vpc-direct-egress)

## Direct VPC Egress と Serverless VPC Access Connector の違い

| 項目 | Direct VPC Egress | Serverless VPC Access Connector |
|------|------------------|--------------------------------|
| **接続方法** | Cloud Functions Gen2が直接VPCに接続 | 中間のコネクタ経由で接続 |
| **コスト** | コネクタのコストなし | コネクタのインスタンスコストが発生 |
| **レイテンシ** | 低い（直接接続） | やや高い（コネクタ経由） |
| **設定** | デプロイ時に`--vpc-egress`で設定 | `vpcConnector`オプションで設定 |
| **サブネット要件** | 任意のサイズ（推奨: /24以上） | /28（16個のIPアドレス）必須 |

**CloudInbox MVPでは、Direct VPC Egressを使用するため、Serverless VPC Access Connectorは不要です。**

## コスト考慮事項

Direct VPC Egressを使用する場合のコスト：

- **VPCネットワーク**: 基本料金はありません
- **サブネット**: 基本料金はありません
- **Cloud Router**: 基本料金はありません（転送トラフィックに対してのみ課金）
- **Cloud NAT**: NATゲートウェイ経由のトラフィックに対して課金されます
  - NAT IPアドレス: 1時間あたりの料金
  - 処理されたGB: データ処理量に応じた料金
- **固定IPアドレス**: 未使用でもIPアドレスの予約費用が発生します

**注意**: Direct VPC Egressを使用する場合、Serverless VPC Access Connectorは不要なため、コネクタのコストは発生しません。これはServerless VPC Access Connectorを使用する場合と比較してコストが削減されます。

