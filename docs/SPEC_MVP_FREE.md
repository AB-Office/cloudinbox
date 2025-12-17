# 📘 CloudInbox – MVP 仕様書（Freeプラン実装版）
**File:** `docs/SPEC_MVP_FREE.md`  
**Version:** 2.0  
**Last Update:** 2025-12-09  
**Project Root:** `cloudinbox`  
**Primary Domain:** `https://cloudinbox.cloud`

---

# 1. サービス概要

CloudInbox は、外部メールサーバ（POP3S、SSL/TLS必須）から受信したメールをクラウド上へ保存し、  
スマートフォンアプリ（Flutter）からどの端末でも同じ受信箱を閲覧できる "クラウド受信箱サービス" である。

Googleの外部メール受信終了後、複数メールを一元管理できる代替サービスとして設計されている。

本仕様書は MVP（Freeプランのみ）に関する技術仕様を定義する。

---

# 2. MVP機能一覧（Freeプラン）

| カテゴリ | 内容 |
|---------|------|
| 外部メール受信 | POP3S（SSL/TLS必須）による受信 |
| 受信後動作 | POP3Sサーバから削除 |
| 保存先 | Firestore（メタデータ・小さい本文）、Storage（MIME原本・大きい本文・添付） |
| 受信間隔 | 15〜30分 |
| アカウント数 | Freeは1件のみ |
| 保存容量 | Freeは2GBまで |
| 容量制御 | 保存前にチェックし上限超過なら受信停止 |
| メール閲覧 | Flutter単一受信トレイ（mailThreadsクエリ） |
| メール管理 | ゴミ箱（30日後に完全削除）、アーカイブ機能 |
| 認証 | Firebase Auth（Google Sign-In） |
| 暗号化 | アプリケーションレベル暗号化（AES-256-GCM、KMS + DEK） |
| 国際化 | Flutter UI（日本語・英語、デバイス言語設定に基づく自動選択） |
| 広告表示 | Freeプランのみ画面下部にバナー広告（Google AdMob） |
| 拡張性 | Pro用フィールド確保 |

---

# 3. アーキテクチャ概要

```
外部メール(POP3S, SSL/TLS必須)
   ↓
Cloud Functions(fetchMails)
   ├ EncryptionService (KMS + DEK)
   ├ Firestore(mailThreads/mailMessages)
   └ Storage(MIME原本・大きい本文・添付、暗号化済み)
   ↓
Flutterアプリ (i18n対応)
```

---

# 4. Firestore スキーマ

## 4.1 users

```
users/{uid}
  plan:
    id: "free"
    label: "Free"
    maxStorageBytes: 2147483648
    maxAccounts: 1
  usage:
    storageBytes: number
    updatedAt: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
  billing: {}
```

---

## 4.2 mailAccounts

```
users/{uid}/mailAccounts/{accountId}
  label: string
  emailAddress: string
  pop3:
    host: string
    port: number
    useSsl: true  # 必須（POP3Sのみ許可）
    userName: string
    passwordEnc: string  # AES-256-GCM暗号化済み
  smtp:
    host: string
    port: number
    useSsl: boolean
    userName: string
    passwordEnc: string  # AES-256-GCM暗号化済み
  deleteAfterFetch: true
  lastFetchedAt: Timestamp|null
  status: "active"|"error"|"disabled"
  lastErrorMessage: string|null
  createdAt: Timestamp
  updatedAt: Timestamp
```

---

## 4.3 mailThreads

```
users/{uid}/mailThreads/{threadId}
  threadId: string
  latestMessageId: string
  subject: string
  from: string
  to: string[]
  preview: string  # bodyPreview
  hasUnread: boolean
  labels: string[]  # ["inbox"], ["archive"], ["trash"] など
  lastMessageAt: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
```

受信トレイ表示：

```dart
FirebaseFirestore.instance
  .collection('users')
  .doc(uid)
  .collection('mailThreads')
  .where('labels', arrayContains: 'inbox')
  .where('labels', arrayContainsAny: ['inbox'])
  .where(Filter.not(Filter.arrayContains('labels', 'trash')))
  .orderBy('lastMessageAt', descending: true);
```

---

## 4.4 mailMessages

```
users/{uid}/mailMessages/{messageId}
  messageId: string
  threadId: string
  from: string
  to: string[]
  cc: string[] | undefined
  bcc: string[] | undefined
  subject: string
  sentAt: Timestamp
  receivedAt: Timestamp
  bodyPreview: string  # プレビュー用（最初の200文字程度）
  bodyTextEncrypted: {
    ciphertext: string  # base64
    nonce: string       # base64 (12 bytes)
    tag: string         # base64
  } | undefined  # 小さい本文（1MiB未満）のみ
  hasLargeBody: boolean  # 大きい本文はStorageに保存
  hasAttachments: boolean
  storage:
    rawMimePath: string  # mail-data/{uid}/{messageId}/raw.eml.enc
    largeBodyPath: string | undefined  # mail-data/{uid}/{messageId}/body.html.enc
    attachmentsBasePath: string | undefined  # mail-data/{uid}/{messageId}/attachments/
  isRead: boolean
  labels: string[]  # ["inbox"], ["archive"], ["trash"] など
  deletedAt: Timestamp | null  # ゴミ箱に移動した日時、復元時はnull
  createdAt: Timestamp
  updatedAt: Timestamp
```

---

# 5. Storage パス

```
mail-data/{uid}/{messageId}/raw.eml.enc          # MIME原本（暗号化済み）
mail-data/{uid}/{messageId}/body.html.enc         # 大きいHTML本文（暗号化済み）
mail-data/{uid}/{messageId}/attachments/{filename}.enc  # 添付ファイル（暗号化済み）
```

**注意**: すべてのファイルは保存前にAES-256-GCMで暗号化される。

---

# 6. 暗号化基盤

## 6.1 暗号化戦略

- **アルゴリズム**: AES-256-GCM
- **鍵管理**: Google Cloud KMS（KEK）+ Secret Manager（DEK、KMSでwrap）
- **対象データ**:
  - メールアカウントのパスワード（`passwordEnc`）
  - メール本文（Firestore/Storage）
  - MIME原本（Storage）
  - 添付ファイル（Storage、MVPでは暗号化は将来対応）

## 6.2 暗号化フロー

1. ユーザー初回ログイン時にDEK（Data Encryption Key）を生成
2. KMSのKEK（Key Encryption Key）でDEKをwrap
3. wrapされたDEKをSecret Managerに保存
4. データ暗号化時はSecret ManagerからDEKを取得し、KMSでunwrap
5. DEKを使用してAES-256-GCMでデータを暗号化
6. 暗号化データ（ciphertext, nonce, tag）を保存

## 6.3 セキュリティ要件

- 平文データは永続化されない
- 暗号鍵（KEK/DEK）はクライアント側に送信されない
- 暗号化/復号化はCloud Functions内でのみ実行
- ログに平文データを出力しない

---

# 7. Cloud Functions 仕様

## 7.1 fetchMails.ts

フロー：

1. users 取得  
2. plan / usage 読み込み  
3. mailAccounts(active) を走査  
4. POP3S接続（SSL/TLS必須、`useSsl: true`チェック）  
5. MIMEパース、bodyPreview生成、スレッドID生成
6. 本文サイズ判定（1MiB未満はFirestore、以上はStorage）
7. `usage.storageBytes + mailSize > maxStorageBytes` → 受信停止  
8. 暗号化保存（Firestore/Storage）
9. mailThreads/mailMessages更新
10. 保存成功したら usage 更新  
11. POP3Sサーバから削除  
12. usage を Firestoreへ反映

擬似コード：

```ts
for user in users:
  load plan, usage
  for account in accounts:
    if account.pop3.useSsl !== true:
      reject("POP3S only")
    mails = pop3s.fetch()  # SSL/TLS接続
    for mail in mails:
      parsed = parseMIME(mail)
      preview = generatePreview(parsed)
      threadId = generateThreadId(parsed)
      est = estimate(mail)
      if usage+est > plan.limit:
        break
      if bodySize < 1MiB:
        encrypted = encrypt(body)
        saveToFirestore(encrypted)
      else:
        encrypted = encrypt(body)
        saveToStorage(encrypted)
      updateMailThreads(threadId, preview)
      updateMailMessages(messageId, parsed)
      usage += saved
  update usage
```

---

## 7.2 moveToTrash.ts / restoreFromTrash.ts

**moveToTrash**:
1. mailThreads/mailMessagesの`labels`から`inbox`を削除、`trash`を追加
2. `deletedAt`に現在日時を設定
3. 使用量は変更しない

**restoreFromTrash**:
1. mailThreads/mailMessagesの`labels`から`trash`を削除、`inbox`を追加
2. `deletedAt`を`null`に設定

---

## 7.3 purgeTrash.ts

1. `deletedAt`が30日以上前のメールを検索
2. Storageパス取得
3. ファイルサイズ合計
4. Storage削除
5. Firestore削除（mailThreads/mailMessages）
6. `usage.storageBytes - freedBytes`

**実行**: Cloud Schedulerで1日1回実行

---

## 7.4 archiveMail.ts / unarchiveMail.ts

**archiveMail**:
1. mailThreads/mailMessagesの`labels`から`inbox`を削除、`archive`を追加
2. 使用量は変更しない

**unarchiveMail**:
1. mailThreads/mailMessagesの`labels`から`archive`を削除、`inbox`を追加

---

## 7.5 decryptMail.ts

1. mailMessage取得
2. `hasLargeBody`を確認
3. `hasLargeBody === false`: Firestoreの`bodyTextEncrypted`を復号化
4. `hasLargeBody === true`: Storageから`largeBodyPath`を取得して復号化
5. 復号化された本文を返却

---

## 7.6 accountTest.ts  

POP3S接続確認（SSL/TLS必須、`useSsl: true`チェック）

**機能**:
- アカウント作成前の接続テスト: 平文パスワード（HTTPSで保護）を受け取り、POP3Sサーバへ接続テストを実行（接続テスト後は即座に破棄）
- 既存アカウントの接続テスト: Secret ManagerからDEKを取得し、KMSでunwrapして暗号化パスワードを復号化
- 接続テスト結果を返却（成功/失敗、エラーメッセージ）
- セキュリティ: 平文パスワードは接続テスト後すぐに破棄し、永続化しない

---

## 7.7 onUserCreate.ts  

Freeプラン設定を注入、DEK（Data Encryption Key）を生成してSecret Managerに保存。

---

# 8. Flutter仕様（MVP）

## 8.1 画面構成

```
- 認証（Google Sign-In）
- メールアカウント追加(1件、POP3S設定、SSL/TLS必須)
  - 接続テストボタン（確認ボタン）
  - 接続テスト結果表示（成功/失敗、エラーメッセージ）
  - 接続テスト成功時にアカウント作成ボタンを有効化
  - 画面下部に広告表示（Freeプランのみ）
- 受信トレイ一覧(mailThreadsクエリ)
  - 画面下部に広告表示（Freeプランのみ）
- メール詳細（decryptMail Function呼び出し）
  - 画面下部に広告表示（Freeプランのみ）
- ゴミ箱画面
- アーカイブ画面
- 設定(プラン表示)
  - 画面下部に広告表示（Freeプランのみ）
```

## 8.2 国際化（i18n）

- **対象**: Flutter UI画面のみ
- **言語**: 日本語（ja）、英語（en）
- **選択方法**: デバイスの言語設定に基づく自動選択
- **実装**: `intl`、`flutter_localizations`パッケージ、`.arb`リソースファイル
- **注意**: コメント、ログ、エラーメッセージ（バックエンド）は日本語のまま

---

# 9. Monorepo構成

```
cloudinbox/
├ apps/
│ ├ mobile_app/
│ └ web_app/
├ functions/
│ ├ src/
│ │ ├ index.ts
│ │ ├ mail/
│ │ │ ├ fetchMails.ts
│ │ │ ├ decryptMail.ts
│ │ │ ├ moveToTrash.ts
│ │ │ ├ restoreFromTrash.ts
│ │ │ ├ purgeTrash.ts
│ │ │ ├ archiveMail.ts
│ │ │ ├ unarchiveMail.ts
│ │ │ └ accountTest.ts
│ │ ├ users/
│ │ │ └ onUserCreate.ts
│ │ ├ shared/
│ │ │ └ encryption/
│ │ │   ├ kms.ts
│ │ │   ├ keys.ts
│ │ │   ├ encrypt.ts
│ │ │   └ decrypt.ts
│ │ └ config/
├ packages/
│ └ dart_models/
├ infra/
│ ├ firebase/
│ ├ env/
│ └ scripts/
└ docs/
   ├ SPEC_MVP_FREE.md
   ├ ARCHITECTURE.md
   └ API_FUNCTIONS.md
```

---

# 10. 開発タスク（MVP）

## Functions
- POP3Sクライアント（SSL/TLS必須）  
- EncryptionService（KMS + DEK管理）
- fetchMails（MIMEパース、暗号化保存含む）
- decryptMail
- moveToTrash / restoreFromTrash
- purgeTrash（Cloud Scheduler統合）
- archiveMail / unarchiveMail
- accountTest（POP3S接続テスト）
- onUserCreate（DEK生成含む）
- Firestoreセキュリティルール
- Storageセキュリティルール
- Firestoreインデックス定義
- Cloud Scheduler設定
- Google Cloud KMS設定
- Secret Manager設定（DEK保存用）

## Flutter
- 認証（Google Sign-In）
- 国際化（i18n）基盤構築
- メールアカウント追加（POP3S設定、SSL/TLS必須）
  - 接続テストボタン（確認ボタン）の実装
  - 接続テスト実行中のローディング表示
  - 接続テスト結果の表示（成功/失敗、エラーメッセージ）
  - 接続テスト成功時にアカウント作成ボタンを有効化
- 受信トレイ（mailThreadsクエリ）
- メール詳細（decryptMail Function呼び出し）
- ゴミ箱画面
- アーカイブ画面
- 設定（プラン表示）
- 広告表示機能（Freeプランのみ）
  - Google AdMob SDK統合
  - 画面下部にバナー広告表示
  - プラン情報に基づく表示制御

## インフラ
- Firebaseプロジェクト  
- Cloud Scheduler（fetchMails、purgeTrash）
- Secret Manager（DEK保存）
- Google Cloud KMS（KEK管理）
- Hosting

---

# 11. ブランド仕様

- サービス名：CloudInbox  
- ドメイン：https://cloudinbox.cloud  
- キャッチコピー：  
  > 外部メールを、あなた専用のクラウド受信箱へ。
