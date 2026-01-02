# Design Document

---
**Purpose**: Provide sufficient detail to ensure implementation consistency across different implementers, preventing interpretation drift.

**Approach**:
- Include essential sections that directly inform implementation decisions
- Omit optional sections unless critical to preventing implementation errors
- Match detail level to feature complexity
- Use diagrams and tables over lengthy prose
---

## Overview

CloudInboxサービスは現在Vue.jsとVuetifyを使用したWebアプリケーションとしてメール受信・閲覧機能を提供しています。また、バックエンド（Cloud Functions）には既にメール送信機能（`sendMail`関数）が実装されています。本設計書は、既存のバックエンドインフラを活用し、Vue.jsとVuetifyを使用してWebアプリケーションにメール送信機能を追加するための技術設計を定義します。

**Users**: ユーザーはWebブラウザからメール作成画面でメールを作成し、既存のバックエンドAPI経由でメールを送信できます。送信済みメールは既存のメール一覧・詳細表示機能を使用して閲覧できます。

**Impact**: 既存のVue.jsとVuetifyを使用したWebアプリケーションにメール送信機能を追加します。既存のバックエンドインフラ（Cloud Functionsの`sendMail`関数）を最大限活用し、フロントエンドのみを新規実装します。既存のメール一覧・詳細表示機能も拡張して送信済みフォルダをサポートします。

### Goals
- Vue 3（Composition API）+ Vuetify 3を使用したメール作成・送信UIの実装
- 既存のCloud Functions（`sendMail`）との統合
- 返信・全員に返信・転送機能の実装
- 送信済みフォルダの表示機能
- 添付ファイルの追加・削除機能（転送時は元のメールの添付ファイルも含める）

### Non-Goals
- 下書き保存機能（将来実装）
- リッチテキストエディタの実装（プレーンテキストのみ）
- メール送信スケジューリング機能（将来実装）

## Architecture

### Existing Architecture Analysis

既存のWebアプリケーションのアーキテクチャパターンを継承：

- **Serverless Functions**: Cloud Functions（TypeScript）によるバックエンド処理
  - `sendMail`: メール送信（既存実装済み）
  - `downloadAttachment`: 添付ファイルのダウンロード（転送時に使用）
  - リージョン: `asia-northeast1`

- **Firestore**: メールメタデータの保存
  - `users/{uid}/mailThreads/{threadId}`: メールスレッド（`labels`に`sent`を含む）
  - `users/{uid}/mailMessages/{messageId}`: メールメッセージ（送信済みメールも同様のスキーマ）

- **Firebase Auth**: Google Sign-Inによる認証（既存実装済み）

- **Vue.js + Vuetify**: フロントエンドフレームワーク
  - Vue Router: ルーティング管理
  - Pinia: 状態管理
  - vue-i18n: 国際化対応

### Architecture Pattern & Boundary Map

```
┌─────────────────────────────────────────────────────────┐
│              Web Browser (Vue.js + Vuetify)             │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Vue Router (base: /mail)                          │  │
│  │  - /mail/compose (ComposeView)                    │  │
│  │  - /mail/compose?reply=messageId                  │  │
│  │  - /mail/compose?replyAll=messageId               │  │
│  │  - /mail/compose?forward=messageId                │  │
│  │  - /mail/?label=sent (MailListView)               │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Pinia Stores                                      │  │
│  │  - mailStore (メール送信状態追加)                  │  │
│  │    - isSending: boolean                           │  │
│  │    - sendError: string | null                     │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Services                                          │  │
│  │  - mailService.sendMail (新規追加)                 │  │
│  │  - accountService.getAccounts (既存、SMTP設定取得) │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Firebase Services                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Cloud Functions (asia-northeast1)                 │  │
│  │  - sendMail (既存実装済み)                         │  │
│  │  - downloadAttachment (転送時の添付ファイル取得)    │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Firestore                                         │  │
│  │  - users/{uid}/mailThreads (labels: ["sent"])     │  │
│  │  - users/{uid}/mailMessages                       │  │
│  │  - users/{uid}/mailAccounts (SMTP設定取得)        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Component Design

### ComposeView.vue

メール作成画面のメインコンポーネント。

**Location**: `apps/web_app/src/views/ComposeView.vue`

**Props**: None（ルートクエリパラメータから取得）

**State**:
- `to`: string[] - 宛先メールアドレス配列
- `cc`: string[] - CCメールアドレス配列（オプション）
- `bcc`: string[] - BCCメールアドレス配列（オプション）
- `subject`: string - 件名
- `body`: string - 本文（プレーンテキスト）
- `selectedAccountId`: string - 選択された送信元アカウントID
- `attachments`: File[] - 添付ファイル配列
- `originalMessage`: MailMessage | null - 返信・転送元のメール（オプション）
- `composeMode`: 'new' | 'reply' | 'replyAll' | 'forward' - 作成モード
- `isSending`: boolean - 送信中フラグ
- `showCcBcc`: boolean - Cc/Bcc入力フィールドの表示状態

**Methods**:
- `initializeCompose()` - クエリパラメータから作成モードを判定し、初期化
- `loadOriginalMessage(messageId: string)` - 返信・転送元のメールを取得
- `loadForwardAttachments(messageId: string)` - 転送時の添付ファイルを取得
- `addAttachment(file: File)` - 添付ファイルを追加
- `removeAttachment(index: number)` - 添付ファイルを削除
- `validateForm()` - フォーム入力の検証
- `sendMail()` - メール送信処理
- `handleCancel()` - キャンセル処理（確認ダイアログ表示）

**UI Structure**:
```
<v-container>
  <v-card>
    <v-card-title>
      <v-btn @click="handleCancel">{{ t('common.cancel') }}</v-btn>
      <v-spacer />
      <v-btn @click="sendMail" :disabled="isSending" :loading="isSending">
        {{ t('mail.compose.send') }}
      </v-btn>
    </v-card-title>
    <v-card-text>
      <!-- 送信元アカウント選択 -->
      <v-select v-model="selectedAccountId" :items="accounts" />
      <!-- 宛先入力 -->
      <v-text-field v-model="to" :label="t('mail.compose.to')" />
      <!-- Cc/Bcc展開ボタン -->
      <v-btn @click="showCcBcc = !showCcBcc">Cc/Bcc</v-btn>
      <!-- Cc入力（展開時のみ） -->
      <v-text-field v-if="showCcBcc" v-model="cc" :label="t('mail.compose.cc')" />
      <!-- Bcc入力（展開時のみ） -->
      <v-text-field v-if="showCcBcc" v-model="bcc" :label="t('mail.compose.bcc')" />
      <!-- 件名入力 -->
      <v-text-field v-model="subject" :label="t('mail.compose.subject')" />
      <!-- 本文入力 -->
      <v-textarea v-model="body" :label="t('mail.compose.body')" rows="15" />
      <!-- 添付ファイル一覧 -->
      <v-list v-if="attachments.length > 0">
        <v-list-item v-for="(file, index) in attachments" :key="index">
          <v-list-item-title>{{ file.name }}</v-list-item-title>
          <v-list-item-action>
            <v-btn icon @click="removeAttachment(index)">×</v-btn>
          </v-list-item-action>
        </v-list-item>
      </v-list>
      <!-- 添付ファイル追加ボタン -->
      <v-btn @click="addAttachment">{{ t('mail.compose.attachFile') }}</v-btn>
    </v-card-text>
  </v-card>
</v-container>
```

### MailListPanel.vue (拡張)

既存の`MailListPanel.vue`コンポーネントにFAB（Floating Action Button）を追加。

**Location**: `apps/web_app/src/components/MailListPanel.vue`

**Changes**:
- 画面右下にFABを追加（`v-fab`コンポーネントまたは`v-btn` with `fixed` prop）
- FABクリック時に`/compose`ルートに遷移

### MailDetailPanel.vue (拡張)

既存の`MailDetailPanel.vue`コンポーネントのケバブメニューからメール作成画面への遷移を実装。

**Location**: `apps/web_app/src/components/MailDetailPanel.vue`

**Changes**:
- `handleReply()` - `/compose?reply=${messageId}`に遷移
- `handleReplyAll()` - `/compose?replyAll=${messageId}`に遷移
- `handleForward()` - `/compose?forward=${messageId}`に遷移

### App.vue (拡張)

既存の`App.vue`コンポーネントのナビゲーションメニューに「送信済み」を追加。

**Location**: `apps/web_app/src/App.vue`

**Changes**:
- `navItems`配列に「送信済み」メニュー項目を追加
  ```typescript
  {
    title: t('mail.sent'),
    icon: 'mdi-send',
    route: { name: 'mail-list', query: { label: 'sent' } },
    label: 'sent',
  }
  ```

## Service Design

### mailService.sendMail()

メール送信サービス関数。

**Location**: `apps/web_app/src/services/mail.ts`

**Signature**:
```typescript
async function sendMail(request: SendMailRequest): Promise<SendMailResponse>
```

**Request Interface**:
```typescript
interface SendMailRequest {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded
    contentType?: string;
  }>;
  threadId?: string; // 返信・転送の場合
  inReplyToMessageId?: string; // 返信・転送の場合
}
```

**Response Interface**:
```typescript
interface SendMailResponse {
  success: boolean;
  messageId?: string;
  errorMessage?: string;
}
```

**Implementation**:
1. Firebase Functions SDKを使用して`sendMail` Cloud Functionを呼び出す
2. リージョンは`asia-northeast1`を指定
3. 認証トークンは自動的に付与される
4. 添付ファイルがある場合は、Base64エンコードして送信
5. エラーハンドリングを実装し、適切なエラーメッセージを返す

**Error Handling**:
- `unauthenticated` - 認証エラー
- `invalid-argument` - パラメータエラー
- `failed-precondition` - SMTP設定未設定エラー
- `not-found` - アカウント未找到エラー
- `internal` - サーバーエラー
- その他のエラーも適切にキャッチして処理

### mailService.fetchThreads() (拡張)

既存の`fetchThreads`関数は`label='sent'`をサポートする（既存実装で対応済みの可能性あり）。

## Store Design

### useMailStore (拡張)

既存の`useMailStore`にメール送信関連の状態を追加。

**Location**: `apps/web_app/src/stores/mail.ts`

**Additional State**:
```typescript
const isSending = ref(false);
const sendError = ref<string | null>(null);
```

**Additional Methods**:
```typescript
async function sendMail(request: SendMailRequest): Promise<void> {
  isSending.value = true;
  sendError.value = null;
  try {
    await mailService.sendMail(request);
  } catch (e: unknown) {
    const { message } = parseError(e);
    sendError.value = message;
    throw e;
  } finally {
    isSending.value = false;
  }
}

function clearSendError() {
  sendError.value = null;
}
```

## Routing Design

### Router Configuration

**Location**: `apps/web_app/src/router/index.ts`

**New Route**:
```typescript
{
  path: '/compose',
  name: 'compose',
  component: () => import('@/views/ComposeView.vue'),
  meta: { requiresAuth: true },
}
```

**Route Query Parameters**:
- `?reply=messageId` - 返信モード
- `?replyAll=messageId` - 全員に返信モード
- `?forward=messageId` - 転送モード

## Type Definitions

### SendMailRequest

**Location**: `apps/web_app/src/types/mail.ts`

```typescript
/**
 * メール送信リクエスト
 */
export interface SendMailRequest {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded
    contentType?: string;
  }>;
  threadId?: string; // 返信・転送の場合
  inReplyToMessageId?: string; // 返信・転送の場合
}
```

### SendMailResponse

**Location**: `apps/web_app/src/types/mail.ts`

```typescript
/**
 * メール送信レスポンス
 */
export interface SendMailResponse {
  success: boolean;
  messageId?: string;
  errorMessage?: string;
}
```

### ComposeAttachment

**Location**: `apps/web_app/src/types/mail.ts`

```typescript
/**
 * メール作成時の添付ファイル
 */
export interface ComposeAttachment {
  file: File; // 元のFileオブジェクト
  filename: string;
  contentType: string;
  content: string; // Base64 encoded (送信時に生成)
}
```

## UI/UX Design

### ComposeView Layout

**Desktop (2列レイアウト)**:
- メール作成画面を全画面で表示（メール一覧は非表示）

**Mobile/Tablet (1列レイアウト)**:
- メール作成画面を全画面で表示

### Form Validation

1. **宛先（To）**: 必須、メールアドレス形式チェック
2. **件名**: 必須
3. **Cc/Bcc**: オプション、メールアドレス形式チェック
4. **本文**: 必須
5. **送信元アカウント**: 必須（SMTP設定があるアカウントのみ選択可能）

### Error Display

- バリデーションエラー: フィールド直下に`v-alert`または`v-text-field`の`error-messages`で表示
- 送信エラー: `v-snackbar`で画面下部に表示

### Loading States

- 送信ボタン: `loading` propを使用してスピナー表示
- 送信中は送信ボタンを無効化（`disabled` prop）

### Success Feedback

- 送信成功時: `v-snackbar`で成功メッセージを表示
- メール作成画面を閉じてメール一覧画面に戻る

## Internationalization

### New Translation Keys

**Location**: `apps/web_app/src/locales/ja.json`, `apps/web_app/src/locales/en.json`

**Japanese (ja.json)**:
```json
{
  "mail": {
    "compose": {
      "title": "メール作成",
      "to": "宛先",
      "cc": "Cc",
      "bcc": "Bcc",
      "subject": "件名",
      "body": "本文",
      "attachFile": "添付ファイル",
      "send": "送信",
      "sending": "送信中...",
      "sendSuccess": "メールを送信しました",
      "sendError": "メールの送信に失敗しました",
      "cancel": "キャンセル",
      "cancelConfirm": "入力内容を破棄しますか？",
      "discard": "破棄",
      "validation": {
        "toRequired": "宛先を入力してください",
        "toInvalid": "有効なメールアドレスを入力してください",
        "subjectRequired": "件名を入力してください",
        "bodyRequired": "本文を入力してください"
      }
    },
    "sent": "送信済み"
  }
}
```

**English (en.json)**:
```json
{
  "mail": {
    "compose": {
      "title": "Compose Mail",
      "to": "To",
      "cc": "Cc",
      "bcc": "Bcc",
      "subject": "Subject",
      "body": "Body",
      "attachFile": "Attach File",
      "send": "Send",
      "sending": "Sending...",
      "sendSuccess": "Mail sent successfully",
      "sendError": "Failed to send mail",
      "cancel": "Cancel",
      "cancelConfirm": "Discard changes?",
      "discard": "Discard",
      "validation": {
        "toRequired": "Please enter recipient",
        "toInvalid": "Please enter a valid email address",
        "subjectRequired": "Please enter subject",
        "bodyRequired": "Please enter body"
      }
    },
    "sent": "Sent"
  }
}
```

## Error Handling

### Error Categories

1. **Validation Errors**: クライアント側で検証（フィールドレベルで表示）
2. **Network Errors**: `v-snackbar`でエラーメッセージを表示
3. **Server Errors**: Cloud Functionsから返されるエラーメッセージを`v-snackbar`で表示
4. **Authentication Errors**: ログイン画面にリダイレクト

### Error Message Mapping

Cloud Functionsのエラーコードをユーザーフレンドリーなメッセージに変換：

```typescript
function mapErrorMessage(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'unauthenticated':
      return t('errors.auth.required');
    case 'invalid-argument':
      return error.message || t('errors.mail.invalidArgument');
    case 'failed-precondition':
      return t('errors.mail.smtpNotConfigured');
    case 'not-found':
      return t('errors.mail.accountNotFound');
    default:
      return t('errors.mail.sendFailed');
  }
}
```

## Implementation Details

### File Upload Handling

添付ファイルの処理：

1. **ファイル選択**: `<input type="file">`を使用（`multiple`属性はオプション）
2. **ファイル読み込み**: `FileReader` APIを使用してBase64エンコード
3. **ファイルサイズ制限**: クライアント側で制限（例: 10MB per file）
4. **Content-Type検出**: `File.type`プロパティを使用

### Forward Attachment Handling

転送時に元のメールの添付ファイルを取得：

1. `downloadAttachment` Cloud Functionを使用して添付ファイルを取得
2. 取得したBase64エンコードされたコンテンツをそのまま使用
3. ファイル名とContent-Typeを保持

### Reply/Forward Subject Prefix

- 返信: `Re: `プレフィックスを追加（既に`Re: `がある場合は追加しない）
- 転送: `Fw: `プレフィックスを追加（既に`Fw: `がある場合は追加しない）

### Reply/Forward Body Formatting

- **返信**: 元のメール本文を引用として追加（`\n\n---\n元のメール本文\n---`形式）
- **転送**: 元のメール本文をそのまま含める

## Testing Considerations

### Unit Tests

1. **mailService.sendMail()**: モックを使用してCloud Functions呼び出しをテスト
2. **useMailStore.sendMail()**: ストアの状態管理をテスト
3. **ComposeView**: フォームバリデーション、添付ファイル処理をテスト

### Integration Tests

1. **メール送信フロー**: エンドツーエンドのテスト（モックCloud Functions使用）
2. **返信・転送フロー**: 元のメール取得からメール送信まで

### E2E Tests (Optional)

1. **メール作成から送信まで**: 実際のUI操作をテスト
2. **送信済みフォルダ**: 送信後のメール一覧表示をテスト

## Deployment Considerations

### No Backend Changes Required

既存のCloud Functions（`sendMail`）を使用するため、バックエンドの変更は不要です。

### Frontend Build

既存のビルドプロセスを使用：

```bash
cd apps/web_app
npm run build
```

### Firebase Hosting

既存のFirebase Hosting設定を使用（`/mail`ディレクトリにデプロイ）。

## Security Considerations

1. **認証**: すべてのメール送信リクエストはFirebase Authで認証が必要
2. **入力検証**: クライアント側とサーバー側の両方で検証
3. **ファイルサイズ制限**: クライアント側で制限（サーバー側でも制限されている想定）
4. **XSS対策**: 本文入力はプレーンテキストのみ（HTMLは将来的にサニタイズが必要）

## Storage Usage Display Design

### Component Design

#### App.vue (拡張)

ナビゲーションドロワーの下部に容量情報を表示。

**Changes**:
- `useSettingsStore`を使用して容量情報を取得
- `watchSettings`を使用してリアルタイム更新
- ドロワーの`append`スロットに容量情報を表示

**Display Format**:
```
プラン: Free
使用済み容量: 500 MB / 2 GB (25.0%)
使用可能容量: 1.5 GB
```

#### SettingsView.vue (拡張)

設定画面に容量情報をカード形式で表示。

**Changes**:
- `useSettingsStore`を使用して容量情報を取得
- `watchSettings`を使用してリアルタイム更新
- `v-card`を使用して容量情報を表示

### Service Design

#### settingsService

容量情報を取得・監視するサービス。

**Location**: `apps/web_app/src/services/settings.ts`

**Functions**:
- `loadSettings()`: 設定データを一度取得
- `watchSettings(callback)`: 設定データをリアルタイムで監視

**Data Source**: Firestore `users/{uid}` ドキュメント
- `plan.label`: プラン名（例: "Free"）
- `plan.maxStorageBytes`: 最大容量（バイト）
- `usage.storageBytes`: 使用済み容量（バイト）

### Store Design

#### useSettingsStore

容量情報を管理するストア。

**Location**: `apps/web_app/src/stores/settings.ts`

**State**:
```typescript
const settings = ref<SettingsData | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const availableStorageBytes = computed(() => {
  if (!settings.value) return 0;
  return Math.max(0, settings.value.maxStorageBytes - settings.value.usedStorageBytes);
});
```

**Methods**:
- `loadSettings()`: 設定データを読み込む
- `startWatching()`: リアルタイム監視を開始
- `stopWatching()`: リアルタイム監視を停止

### Type Definitions

#### SettingsData

**Location**: `apps/web_app/src/types/settings.ts`

```typescript
export interface SettingsData {
  planLabel: string;
  maxStorageBytes: number;
  usedStorageBytes: number;
}
```

### Internationalization

#### New Translation Keys

**Location**: `apps/web_app/src/locales/ja.json`, `apps/web_app/src/locales/en.json`

**Japanese (ja.json)**:
```json
{
  "settings": {
    "plan": "プラン",
    "usedStorage": "使用済み容量",
    "availableStorage": "使用可能容量",
    "storageUsage": "容量使用状況"
  }
}
```

**English (en.json)**:
```json
{
  "settings": {
    "plan": "Plan",
    "usedStorage": "Used Storage",
    "availableStorage": "Available Storage",
    "storageUsage": "Storage Usage"
  }
}
```

