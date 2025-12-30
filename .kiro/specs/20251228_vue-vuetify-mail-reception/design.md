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

CloudInboxサービスは現在Flutterモバイルアプリとして実装されており、Firebase Functions、Firestore、Storageを活用したメール受信・管理機能を提供しています。本設計書は、既存のバックエンドインフラを活用し、Vue.jsとVuetifyを使用してWebアプリケーションを構築し、メール受信環境（メール一覧表示、メール詳細表示）を実現するための技術設計を定義します。

**Users**: ユーザーはWebブラウザからFirebase認証でログインし、既存のモバイルアプリと同様にメール一覧を閲覧し、メール詳細を確認できます。既存のFirebase Functions、Firestore、Storageのインフラを共有するため、モバイルアプリとWebアプリで同じデータにアクセスできます。

**Impact**: 既存のFlutterモバイルアプリに加えて、Vue.jsとVuetifyを使用したWebアプリケーションを追加します。既存のバックエンドインフラ（Firebase Functions、Firestore、Storage）を最大限活用し、フロントエンドのみを新規実装します。Firebase Hostingを使用して`/mail`ディレクトリにデプロイし、ルートパス（`/`）には当面`/mail`にリダイレクトするページを配置します。

### Goals
- Vue 3（Composition API）+ Vuetify 3を使用したWebアプリケーションの構築
- Firebase認証（Google Sign-In）の実装
- Firestoreからのメール一覧取得とリアルタイム更新
- Cloud Functions経由でのメール本文復号化
- vue-router、vue-i18n、Piniaを使用したアーキテクチャ
- Firebase Hostingへのデプロイ（`/mail`ディレクトリ）
- レスポンシブデザイン（デスクトップ、タブレット、モバイル対応）

### Non-Goals
- メール送信機能（後続フェーズで実装）
- メール削除・アーカイブ機能（後続フェーズで実装）
- ランディングページの実装（当面はリダイレクトページのみ）

## Architecture

### Existing Architecture Analysis

既存のFlutterモバイルアプリのアーキテクチャパターンを継承：

- **Serverless Functions**: Cloud Functions（TypeScript）によるバックエンド処理
  - `decryptMail`: メール本文の復号化
  - `getAttachmentsList`: 添付ファイル一覧の取得
  - リージョン: `asia-northeast1`

- **Firestore**: メールメタデータの保存
  - `users/{uid}/mailThreads/{threadId}`: メールスレッド
  - `users/{uid}/mailMessages/{messageId}`: メールメッセージ
  - リアルタイム更新（`onSnapshot`）をサポート

- **Firebase Storage**: メール本文（大きい場合）と添付ファイルの保存
  - `mail-data/{uid}/{messageId}/body.html.enc`: 大きいHTML本文（暗号化済み）
  - `mail-data/{uid}/{messageId}/attachments/{filename}.enc`: 添付ファイル（暗号化済み）

- **Firebase Auth**: Google Sign-Inによる認証
  - 既存のFirebase Functionsの`onUserCreate`トリガーでユーザー初期化

### Architecture Pattern & Boundary Map

```
┌─────────────────────────────────────────────────────────┐
│              Web Browser (Vue.js + Vuetify)             │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Vue Router (base: /mail)                          │  │
│  │  - /mail/login (LoginView)                         │  │
│  │  - /mail/ (MailListView)                           │  │
│  │  - /mail/:threadId (MailDetailView)                │  │
│  │  - /mail/settings (SettingsView)                   │  │
│  │  - /mail/settings/accounts (AccountListView)       │  │
│  │  - /mail/settings/accounts/new (AccountFormView)   │  │
│  │  - /mail/settings/accounts/:accountId (AccountFormView) │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Pinia Stores                                      │  │
│  │  - authStore (認証状態)                            │  │
│  │  - mailStore (メール一覧・詳細)                    │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Services                                          │  │
│  │  - firebaseService (Firebase初期化)                 │  │
│  │  - authService (認証処理)                          │  │
│  │  - mailService (メール取得・復号)                  │  │
│  │  - accountService (アカウント管理)                 │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Firebase Services                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Firebase Auth (Google Sign-In)                   │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Firestore                                         │  │
│  │  - users/{uid}/mailThreads                         │  │
│  │  - users/{uid}/mailMessages                       │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Cloud Functions (asia-northeast1)                 │  │
│  │  - decryptMail                                     │  │
│  │  - getAttachmentsList                             │  │
│  │  - accountTest (POP3S/SMTP接続テスト)             │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Firebase Storage                                  │  │
│  │  - mail-data/{uid}/{messageId}/...                 │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Architecture Integration**:
- **Selected pattern**: Vue 3 Composition API + Piniaによる状態管理、vue-routerによるルーティング
- **Domain/feature boundaries**: フロントエンド層（Vue.js）とバックエンド層（Firebase）を明確に分離
- **Existing patterns preserved**: 既存のFirebase Functions、Firestoreスキーマ、Storage構造をそのまま活用
- **New components rationale**: Webアプリ専用のVueコンポーネント、Piniaストア、サービス層を新規実装
- **Steering compliance**: monorepo構造（`apps/web_app/`）に従い、既存の技術スタック（Firebase）を最大限活用

### Technology Stack

| Layer | Choice / Version | Role in Feature | Notes |
|-------|------------------|-----------------|-------|
| Frontend Framework | Vue 3 (Composition API) | Webアプリケーションの基盤 | TypeScript対応 |
| UI Framework | Vuetify 3 | Material Designコンポーネント | レスポンシブ対応 |
| Routing | vue-router 4 | ルーティング管理 | ベースパス: `/mail` |
| State Management | Pinia | 状態管理 | 認証状態、メールデータ |
| Internationalization | vue-i18n | 多言語対応 | 日本語・英語 |
| Build Tool | Vite | ビルドツール | 高速な開発サーバー |
| Language | TypeScript | 型安全性 | strict mode推奨 |
| Backend | Firebase Functions | メール復号化API | 既存のAPIを活用 |
| Database | Firestore | メールメタデータ | 既存のスキーマを活用 |
| Storage | Firebase Storage | メール本文・添付ファイル | 既存の構造を活用 |
| Authentication | Firebase Auth | Google Sign-In | 既存の認証フローを活用 |
| Hosting | Firebase Hosting | デプロイ先 | `/mail`ディレクトリに配置 |

### Project Structure

```
apps/web_app/
├── public/
│   └── index.html (ルートパス用、/mailにリダイレクト)
├── src/
│   ├── main.ts (エントリーポイント)
│   ├── App.vue (ルートコンポーネント)
│   ├── router/
│   │   └── index.ts (vue-router設定、base: /mail)
│   ├── stores/
│   │   ├── auth.ts (認証状態管理)
│   │   ├── mail.ts (メール一覧・詳細状態管理)
│   │   └── account.ts (アカウント状態管理)
│   ├── services/
│   │   ├── firebase.ts (Firebase初期化)
│   │   ├── auth.ts (認証処理)
│   │   ├── mail.ts (メール取得・復号)
│   │   └── account.ts (アカウント管理)
│   ├── views/
│   │   ├── LoginView.vue (ログイン画面)
│   │   ├── MailListView.vue (メール一覧画面、レスポンシブ対応)
│   │   │   └── モバイル: メール一覧のみ表示
│   │   │   └── デスクトップ: メール一覧 + メール詳細を2列表示
│   │   ├── MailDetailView.vue (メール詳細画面、モバイル専用)
│   │   ├── SettingsView.vue (設定画面)
│   │   ├── AccountListView.vue (アカウント一覧画面)
│   │   └── AccountFormView.vue (アカウント作成・編集画面)
│   ├── components/
│   │   ├── MailListItem.vue (メール一覧アイテム)
│   │   ├── MailListPanel.vue (メール一覧パネル、2列レイアウト用)
│   │   ├── MailDetailPanel.vue (メール詳細パネル、2列レイアウト用)
│   │   ├── MailHeader.vue (メールヘッダー)
│   │   └── MailBody.vue (メール本文)
│   ├── composables/
│   │   ├── useAuth.ts (認証Composable)
│   │   └── useMail.ts (メールComposable)
│   ├── locales/
│   │   ├── ja.json (日本語リソース)
│   │   └── en.json (英語リソース)
│   └── types/
│       ├── mail.ts (メール型定義)
│       ├── account.ts (アカウント型定義)
│       └── firebase.ts (Firebase型定義)
├── vite.config.ts (Vite設定)
├── tsconfig.json (TypeScript設定)
├── package.json
└── firebase.json (Firebase Hosting設定)
```

## System Flows

### Flow 1: 認証フロー

```
ユーザーがWebアプリにアクセス
    │
    ▼
Firebase Authで認証状態を確認
    │
    ├─ 認証済み → MailListViewに遷移
    │
    └─ 未認証 → LoginViewを表示
            │
            ▼
        ユーザーが「Googleでログイン」をクリック
            │
            ▼
        Firebase AuthのGoogle Sign-Inを実行
            │
            ├─ 成功 → authStoreを更新、MailListViewに遷移
            │
            └─ 失敗 → エラーメッセージを表示
```

### Flow 2: メール一覧表示フロー（ページネーション対応）

```
ユーザーがMailListViewにアクセス
    │
    ▼
authStoreから認証状態を確認
    │
    ├─ 未認証 → /mail/loginにリダイレクト
    │
    └─ 認証済み → 続行
            │
            ▼
        画面サイズとメール一覧アイテムの高さを計算
            │
            ▼
        1画面で収まる件数を決定（通常10-20件程度）
            │
            ▼
        FirestoreからmailThreadsをクエリ
        (labelsに'inbox'を含み、'trash'を含まない)
            │
            ▼
        lastMessageAtの降順でソート
            │
            ▼
        計算した件数分のみを取得（limit句を使用）
            │
            ▼
        mailStoreに保存、UIに表示
            │
            ▼
        FirestoreのonSnapshotでリアルタイム更新を監視
            │
            ▼
        新しいメールが受信されたら自動更新
            │
            ▼
        ユーザーがスクロールして画面末尾に近づく
            │
            ▼
        Intersection Observerまたはスクロールイベントで検知
            │
            ▼
        追加読み込みを実行（Flow 4参照）
```

### Flow 3: メール詳細表示フロー（レスポンシブ対応）

```
ユーザーがメールスレッドをクリック
    │
    ▼
画面サイズを確認
    │
    ├─ モバイル・タブレット（1列レイアウト） → 続行（画面遷移）
    │
    └─ デスクトップ（2列レイアウト） → 続行（同一画面内更新）
            │
            ▼
    モバイル・タブレットの場合:
    /mail/:threadIdに遷移
            │
            ▼
    MailDetailViewが表示される（全画面）
            │
            ▼
    デスクトップの場合:
    同一画面内で右側のメール詳細エリアを更新
    （URLは変更せず、状態管理で選択中のスレッドを管理）
            │
            ▼
    FirestoreからmailMessagesを取得
            │
            ├─ 成功 → メールメタデータを表示
            │
            └─ 失敗 → エラーメッセージを表示
                    │
                    ▼
                hasLargeBodyを確認
                    │
                    ├─ false → FirestoreのbodyTextEncryptedを使用
                    │
                    └─ true → Storageのbody.html.encを使用
                            │
                            ▼
                        Cloud Functions (decryptMail)を呼び出し
                            │
                            ├─ 成功 → 復号化された本文を表示
                            │
                            └─ 失敗 → エラーメッセージを表示
                                    │
                                    ▼
                                Firestoreを更新してisRead: trueに設定
                                    │
                                    ▼
                                スレッドのhasUnreadを再計算
                                    │
                                    ▼
                                デスクトップの場合:
                                メール一覧で選択中のスレッドをハイライト表示
                                    │
                                    ▼
                                メール詳細画面にアクションボタンを表示
                                （返信、転送、ゴミ箱に移動、アーカイブ等）
```

### Flow 4: ページネーション（無限スクロール）フロー

```
ユーザーがメール一覧をスクロール
    │
    ▼
画面の末尾に近づく（閾値: 画面下端から200-300px程度）
    │
    ▼
Intersection Observerまたはスクロールイベントで検知
    │
    ▼
追加読み込み中フラグを確認
    │
    ├─ 読み込み中 → 何もしない（重複読み込み防止）
    │
    └─ 読み込み中でない → 続行
            │
            ▼
        前回取得した最後のメールスレッドのlastMessageAtを取得
            │
            ▼
        画面サイズに応じた件数（通常10-20件）を決定
            │
            ▼
        ローディングインジケーターを表示
            │
            ▼
        Firestoreから次のN件をクエリ
        (startAfterで前回の最後のドキュメントを指定)
            │
            ├─ データあり → mailStoreに追加、UIに表示
            │              │
            │              ▼
            │          追加読み込み中フラグを解除
            │              │
            │              ▼
            │          ユーザーがさらにスクロールしたら
            │          再度このフローを実行
            │
            └─ データなし → 追加読み込みを停止
                          │
                          ▼
                      「すべてのメールを読み込みました」
                      メッセージを表示
```

## Data Model

### Conceptual Data Model

既存のFirestoreスキーマをそのまま活用：

**Entities**:
- `User`: ユーザー情報（プラン、使用量）
- `MailThread`: メールスレッド（件名、送信者、プレビュー、未読状態、ラベル、最終メッセージ日時）
- `MailMessage`: メールメッセージ（件名、送信者、受信者、送信日時、本文、添付ファイル情報）

**Value Objects**:
- `Plan`: `id`, `label`, `maxStorageBytes`, `maxAccounts`
- `Usage`: `storageBytes`, `updatedAt`
- `StoragePaths`: `rawMimePath`, `largeBodyPath`, `attachmentsBasePath`
- `EncryptedData`: `ciphertext: string`, `nonce: string`, `tag: string`

**Business Rules & Invariants**:
- メール一覧は`labels`に`inbox`を含み、`trash`を含まないスレッドを表示
- メール詳細は`isRead: true`に更新し、スレッドの`hasUnread`を再計算
- 復号済みのメール本文はクライアント側でキャッシュしない

### Logical Data Model

**Structure Definition**:
- `users/{uid}/mailThreads/{threadId}`: メールスレッド
- `users/{uid}/mailMessages/{messageId}`: メールメッセージ

**Entity Relationships**:
- User 1:N MailThread（ユーザーは複数のメールスレッドを持つ）
- MailThread 1:N MailMessage（スレッドは複数のメッセージを持つ）

**Attributes & Types** (TypeScript型定義):

```typescript
interface MailThread {
  threadId: string;
  latestMessageId: string;
  subject: string;
  from: string;
  to: string[];
  preview: string;
  hasUnread: boolean;
  labels: string[];
  lastMessageAt: Timestamp;
  sentAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface MailMessage {
  messageId: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  sentAt: Timestamp;
  receivedAt: Timestamp;
  bodyPreview: string;
  bodyTextEncrypted?: {
    ciphertext: string;
    nonce: string;
    tag: string;
  };
  hasLargeBody: boolean;
  hasAttachments: boolean;
  storage?: {
    rawMimePath: string;
    largeBodyPath?: string;
    attachmentsBasePath?: string;
  };
  isRead: boolean;
  labels: string[];
  deletedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Physical Data Model

**For Document Stores (Firestore)**:
- Collection structures: 
  - `users/{uid}/mailThreads/{threadId}`: メールスレッド
  - `users/{uid}/mailMessages/{messageId}`: メールメッセージ
- Index definitions:
  - `mailThreads`: `uid` (ascending), `lastMessageAt` (descending) — 複合インデックス
  - `mailThreads`: `uid` (ascending), `labels` (array-contains), `lastMessageAt` (descending) — ラベルフィルタ用複合インデックス
- Query patterns:
  - メール一覧: `mailThreads`を`labels`でフィルタリング、`lastMessageAt`でソート
  - メール詳細: `mailMessages`を`messageId`で取得

**For File Storage (Firebase Storage)**:
- Path structure: 
  - `mail-data/{uid}/{messageId}/body.html.enc`: 大きいHTML本文（暗号化済み）
  - `mail-data/{uid}/{messageId}/attachments/{filename}.enc`: 添付ファイル（暗号化済み）
- Access pattern: Cloud Functions経由で復号化して取得（直接アクセス不可）

## Component Design

### Vue Router Configuration

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory('/mail'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/',
      name: 'mail-list',
      component: () => import('@/views/MailListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/:threadId',
      name: 'mail-detail',
      component: () => import('@/views/MailDetailView.vue'),
      meta: { requiresAuth: true },
      // モバイル・タブレット専用（1列レイアウト時のみ使用）
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/accounts',
      name: 'account-list',
      component: () => import('@/views/AccountListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/accounts/new',
      name: 'account-new',
      component: () => import('@/views/AccountFormView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/accounts/:accountId',
      name: 'account-edit',
      component: () => import('@/views/AccountFormView.vue'),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else {
    next();
  }
});

export default router;
```

### Pinia Stores

#### Auth Store

```typescript
// stores/auth.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { User } from 'firebase/auth';
import { authService } from '@/services/auth';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isLoading = ref(false);

  const isAuthenticated = computed(() => user.value !== null);

  async function signInWithGoogle() {
    isLoading.value = true;
    try {
      user.value = await authService.signInWithGoogle();
    } finally {
      isLoading.value = false;
    }
  }

  async function signOut() {
    await authService.signOut();
    user.value = null;
  }

  function setUser(newUser: User | null) {
    user.value = newUser;
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    signInWithGoogle,
    signOut,
    setUser,
  };
});
```

#### Mail Store

```typescript
// stores/mail.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { MailThread, MailMessage } from '@/types/mail';
import { mailService } from '@/services/mail';

export const useMailStore = defineStore('mail', () => {
  const threads = ref<MailThread[]>([]);
  const currentMessage = ref<MailMessage | null>(null);
  const selectedThreadId = ref<string | null>(null); // 2列レイアウト用の選択中スレッドID
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastDocument = ref<any>(null);
  const hasMore = ref(true);

  async function fetchThreads(label: string = 'inbox', limit?: number) {
    // 初期読み込み時は画面サイズに応じた件数を計算
    // 追加読み込み時は指定されたlimitを使用（通常は同じ件数）
    const itemsPerPage = limit || calculateItemsPerPage();
    
    isLoading.value = true;
    error.value = null;
    try {
      const result = await mailService.fetchThreads(label, itemsPerPage, lastDocument.value);
      if (lastDocument.value === null) {
        // 初期読み込み: 既存のリストを置き換え
        threads.value = result.threads;
      } else {
        // 追加読み込み: 既存のリストに追加
        threads.value.push(...result.threads);
      }
      lastDocument.value = result.lastDocument;
      hasMore.value = result.hasMore;
    } catch (e: any) {
      error.value = e.message;
    } finally {
      isLoading.value = false;
    }
  }

  function calculateItemsPerPage(): number {
    // 画面サイズとメール一覧アイテムの高さから表示可能件数を計算
    // デフォルトは15件、画面が大きい場合は20件、小さい場合は10件
    if (typeof window === 'undefined') return 15;
    const viewportHeight = window.innerHeight;
    const itemHeight = 80; // メール一覧アイテムの推定高さ（px）
    const headerHeight = 100; // ヘッダー・ナビゲーションの推定高さ（px）
    const availableHeight = viewportHeight - headerHeight;
    const calculatedItems = Math.floor(availableHeight / itemHeight);
    // 10-20件の範囲に制限し、若干の余裕を持たせる
    return Math.max(10, Math.min(20, calculatedItems + 3));
  }

  async function loadMore(label: string = 'inbox') {
    // 追加読み込み（無限スクロール）
    if (isLoading.value || !hasMore.value) return;
    
    const itemsPerPage = calculateItemsPerPage();
    await fetchThreads(label, itemsPerPage);
  }

  async function fetchMessage(messageId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      currentMessage.value = await mailService.fetchMessage(messageId);
    } catch (e: any) {
      error.value = e.message;
    } finally {
      isLoading.value = false;
    }
  }

  async function decryptMailBody(messageId: string): Promise<{ bodyText?: string; bodyHtml?: string }> {
    return await mailService.decryptMailBody(messageId);
  }

  async function markAsRead(messageId: string, threadId: string) {
    await mailService.markAsRead(messageId, threadId);
    // スレッドのhasUnreadを再計算
    const thread = threads.value.find(t => t.threadId === threadId);
    if (thread) {
      // スレッド内のすべてのメッセージを確認してhasUnreadを再計算
      // （実装詳細はmailServiceに委譲）
    }
  }

  function selectThread(threadId: string | null) {
    // 2列レイアウト用: 選択中のスレッドIDを設定
    selectedThreadId.value = threadId;
    if (threadId) {
      // 選択されたスレッドの最新メッセージを取得
      const thread = threads.value.find(t => t.threadId === threadId);
      if (thread?.latestMessageId) {
        fetchMessage(thread.latestMessageId);
      }
    } else {
      currentMessage.value = null;
    }
  }

  function reset() {
    threads.value = [];
    currentMessage.value = null;
    selectedThreadId.value = null;
    lastDocument.value = null;
    hasMore.value = true;
  }

  return {
    threads,
    currentMessage,
    selectedThreadId,
    isLoading,
    error,
    hasMore,
    fetchThreads,
    loadMore,
    selectThread,
    fetchMessage,
    decryptMailBody,
    downloadAttachment,
    markAsRead,
    reset,
  };
});
```

### Services

#### Auth Service

```typescript
// services/auth.ts
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { firebaseApp } from './firebase';

const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();

export const authService = {
  async signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  },

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  },

  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  getCurrentUser(): User | null {
    return auth.currentUser;
  },
};
```

#### Mail Service

```typescript
// services/mail.ts
import { getAuth } from 'firebase/auth';

const db = getFirestore(firebaseApp);
const functions = getFunctions(firebaseApp, 'asia-northeast1');
const auth = getAuth(firebaseApp);

export const mailService = {
  async fetchThreads(
    label: string,
    limitCount: number,
    lastDoc: QueryDocumentSnapshot | null
  ): Promise<{ threads: MailThread[]; lastDocument: QueryDocumentSnapshot | null; hasMore: boolean }> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    // ページネーション: limitCount + 1件を取得し、hasMoreを判定
    // 実際に返すのはlimitCount件のみ
    let q = query(
      collection(db, 'users', uid, 'mailThreads'),
      orderBy('lastMessageAt', 'desc'),
      limit(limitCount + 1)
    );

    if (label === 'inbox') {
      q = query(
        collection(db, 'users', uid, 'mailThreads'),
        where('labels', 'array-contains', 'inbox'),
        orderBy('lastMessageAt', 'desc'),
        limit(limitCount + 1)
      );
    } else if (label === 'trash') {
      q = query(
        collection(db, 'users', uid, 'mailThreads'),
        where('labels', 'array-contains', 'trash'),
        orderBy('lastMessageAt', 'desc'),
        limit(limitCount + 1)
      );
    }

    // 追加読み込み時は前回の最後のドキュメントから開始
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > limitCount;
    // hasMoreがtrueの場合は最後の1件を除外（次のページ判定用に保持）
    const threadsToReturn = hasMore ? docs.slice(0, limitCount) : docs;

    const threads = threadsToReturn.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as MailThread[];

    return {
      threads,
      lastDocument: threadsToReturn.length > 0 ? threadsToReturn[threadsToReturn.length - 1] : null,
      hasMore,
    };
  },

  watchThreads(
    label: string,
    callback: (threads: MailThread[]) => void
  ): () => void {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    let q = query(
      collection(db, 'users', uid, 'mailThreads'),
      orderBy('lastMessageAt', 'desc')
    );

    if (label === 'inbox') {
      q = query(
        collection(db, 'users', uid, 'mailThreads'),
        where('labels', 'array-contains', 'inbox'),
        orderBy('lastMessageAt', 'desc')
      );
    } else if (label === 'trash') {
      q = query(
        collection(db, 'users', uid, 'mailThreads'),
        where('labels', 'array-contains', 'trash'),
        orderBy('lastMessageAt', 'desc')
      );
    }

    return onSnapshot(q, (snapshot) => {
      const threads = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as MailThread[];
      callback(threads);
    });
  },

  async fetchMessage(messageId: string): Promise<MailMessage> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const docRef = doc(db, 'users', uid, 'mailMessages', messageId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error('Message not found');
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as MailMessage;
  },

  async decryptMailBody(messageId: string): Promise<{ bodyText?: string; bodyHtml?: string }> {
    const decryptMail = httpsCallable(functions, 'decryptMail');
    const result = await decryptMail({ messageId });
    return result.data as { bodyText?: string; bodyHtml?: string };
  },

  async downloadAttachment(
    messageId: string,
    filename: string
  ): Promise<{ content: string; filename: string; contentType: string; size: number }> {
    const downloadAttachment = httpsCallable(functions, 'downloadAttachment');
    const result = await downloadAttachment({ messageId, filename });
    return result.data as { content: string; filename: string; contentType: string; size: number };
  },

  async downloadAttachment(
    messageId: string,
    filename: string
  ): Promise<{ content: string; filename: string; contentType: string; size: number }> {
    const downloadAttachment = httpsCallable(functions, 'downloadAttachment');
    const result = await downloadAttachment({ messageId, filename });
    return result.data as { content: string; filename: string; contentType: string; size: number };
  },

  async markAsRead(messageId: string, threadId: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    // メッセージを既読に更新
    const messageRef = doc(db, 'users', uid, 'mailMessages', messageId);
    await updateDoc(messageRef, { isRead: true });

    // スレッド内のすべてのメッセージを確認してhasUnreadを再計算
    const messagesQuery = query(
      collection(db, 'users', uid, 'mailMessages'),
      where('threadId', '==', threadId)
    );
    const messagesSnapshot = await getDocs(messagesQuery);
    const hasUnread = messagesSnapshot.docs.some(doc => !doc.data().isRead);

    const threadRef = doc(db, 'users', uid, 'mailThreads', threadId);
    await updateDoc(threadRef, { hasUnread });
  },
};
```

#### Account Service

```typescript
// services/account.ts
import { 
  getFirestore, 
  collection, 
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp 
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { firebaseApp } from './firebase';
import { MailAccount, AccountFormData, AccountTestResult } from '@/types/account';

const db = getFirestore(firebaseApp);
const functions = getFunctions(firebaseApp, 'asia-northeast1');

export const accountService = {
  async listAccounts(includeInactive: boolean = false): Promise<MailAccount[]> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    let q = query(collection(db, 'users', uid, 'mailAccounts'));
    if (!includeInactive) {
      q = query(q, where('status', '==', 'active'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as MailAccount[];
  },

  async getAccount(accountId: string): Promise<MailAccount | null> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const docRef = doc(db, 'users', uid, 'mailAccounts', accountId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as MailAccount;
  },

  async testConnection(
    protocol: 'pop3' | 'smtp',
    formData: AccountFormData,
    accountId?: string
  ): Promise<AccountTestResult> {
    const accountTest = httpsCallable(functions, 'accountTest');
    const result = await accountTest({
      protocol,
      host: protocol === 'pop3' ? formData.pop3Host : formData.smtpHost,
      port: protocol === 'pop3' ? formData.pop3Port : formData.smtpPort,
      useSsl: true,
      userName: protocol === 'pop3' ? formData.pop3Username : formData.smtpUsername,
      password: accountId ? undefined : (protocol === 'pop3' ? formData.pop3Password : formData.smtpPassword),
      accountId,
    });

    const data = result.data as { success: boolean; errorMessage?: string };
    return {
      success: data.success,
      errorMessage: data.errorMessage,
    };
  },

  async createAccount(formData: AccountFormData): Promise<string> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    // プラン上限チェック（既存のロジックを参照）
    // ここでは簡略化のため、Firestoreのルールで制御することを想定

    // パスワードの暗号化はCloud Functionsで実行することを想定
    // または、クライアント側で暗号化（既存のロジックに従う）
    
    const accountData = {
      label: formData.label,
      email: formData.email,
      pop3: {
        host: formData.pop3Host,
        port: formData.pop3Port,
        useSsl: true,
        userName: formData.pop3Username,
        passwordEnc: null, // 暗号化はCloud Functionsまたはクライアント側で実行
      },
      smtp: formData.smtpHost ? {
        host: formData.smtpHost,
        port: formData.smtpPort,
        useSsl: true,
        userName: formData.smtpUsername,
        passwordEnc: null, // 暗号化はCloud Functionsまたはクライアント側で実行
      } : undefined,
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'users', uid, 'mailAccounts'), accountData);
    return docRef.id;
  },

  async updateAccount(accountId: string, formData: AccountFormData): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const accountRef = doc(db, 'users', uid, 'mailAccounts', accountId);
    const updateData: any = {
      label: formData.label,
      email: formData.email,
      pop3: {
        host: formData.pop3Host,
        port: formData.pop3Port,
        useSsl: true,
        userName: formData.pop3Username,
      },
      updatedAt: Timestamp.now(),
    };

    if (formData.pop3Password) {
      // パスワードが入力されている場合のみ更新
      updateData.pop3.passwordEnc = null; // 暗号化はCloud Functionsまたはクライアント側で実行
    }

    if (formData.smtpHost) {
      updateData.smtp = {
        host: formData.smtpHost,
        port: formData.smtpPort,
        useSsl: true,
        userName: formData.smtpUsername,
      };
      if (formData.smtpPassword) {
        updateData.smtp.passwordEnc = null; // 暗号化はCloud Functionsまたはクライアント側で実行
      }
    }

    await updateDoc(accountRef, updateData);
  },

  async deleteAccount(accountId: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const accountRef = doc(db, 'users', uid, 'mailAccounts', accountId);
    await updateDoc(accountRef, {
      status: 'inactive',
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  },

  async restoreAccount(accountId: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const accountRef = doc(db, 'users', uid, 'mailAccounts', accountId);
    await updateDoc(accountRef, {
      status: 'active',
      deletedAt: null,
      updatedAt: Timestamp.now(),
    });
  },

  async permanentlyDeleteAccount(accountId: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const accountRef = doc(db, 'users', uid, 'mailAccounts', accountId);
    await deleteDoc(accountRef);
  },
};
```

#### Account Store

```typescript
// stores/account.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { MailAccount, AccountFormData, AccountTestResult } from '@/types/account';
import { accountService } from '@/services/account';

export const useAccountStore = defineStore('account', () => {
  const accounts = ref<MailAccount[]>([]);
  const currentAccount = ref<MailAccount | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const testResult = ref<AccountTestResult | null>(null);
  const isTesting = ref(false);

  async function fetchAccounts(includeInactive: boolean = false) {
    isLoading.value = true;
    error.value = null;
    try {
      accounts.value = await accountService.listAccounts(includeInactive);
    } catch (e: any) {
      error.value = e.message;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchAccount(accountId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      currentAccount.value = await accountService.getAccount(accountId);
    } catch (e: any) {
      error.value = e.message;
    } finally {
      isLoading.value = false;
    }
  }

  async function testConnection(
    protocol: 'pop3' | 'smtp',
    formData: AccountFormData,
    accountId?: string
  ) {
    isTesting.value = true;
    testResult.value = null;
    error.value = null;
    try {
      testResult.value = await accountService.testConnection(protocol, formData, accountId);
    } catch (e: any) {
      error.value = e.message;
      testResult.value = {
        success: false,
        errorMessage: e.message,
      };
    } finally {
      isTesting.value = false;
    }
  }

  async function createAccount(formData: AccountFormData) {
    isLoading.value = true;
    error.value = null;
    try {
      await accountService.createAccount(formData);
      await fetchAccounts();
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateAccount(accountId: string, formData: AccountFormData) {
    isLoading.value = true;
    error.value = null;
    try {
      await accountService.updateAccount(accountId, formData);
      await fetchAccounts();
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteAccount(accountId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await accountService.deleteAccount(accountId);
      await fetchAccounts();
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function restoreAccount(accountId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await accountService.restoreAccount(accountId);
      await fetchAccounts();
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function permanentlyDeleteAccount(accountId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await accountService.permanentlyDeleteAccount(accountId);
      await fetchAccounts();
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  function reset() {
    accounts.value = [];
    currentAccount.value = null;
    testResult.value = null;
    error.value = null;
  }

  return {
    accounts,
    currentAccount,
    isLoading,
    error,
    testResult,
    isTesting,
    fetchAccounts,
    fetchAccount,
    testConnection,
    createAccount,
    updateAccount,
    deleteAccount,
    restoreAccount,
    permanentlyDeleteAccount,
    reset,
  };
});
```

## Error Handling

### Error Strategy

- **User Errors** (4xx): 認証エラー、データ取得エラー → エラーメッセージを表示し、適切な画面にリダイレクト
- **System Errors** (5xx): Cloud Functions呼び出しエラー、ネットワークエラー → エラーメッセージを表示し、リトライ案内
- **Business Logic Errors** (422): データが見つからない、権限エラー → 条件説明とガイダンス

### Error Categories and Responses

**認証エラー**:
- 未認証アクセス: `/mail/login`にリダイレクト
- Google Sign-In失敗: エラーメッセージを表示（技術的詳細は非表示）

**Firestoreクエリエラー**:
- データ取得失敗: エラーメッセージを表示、リトライボタンを表示
- リアルタイム更新エラー: エラーログを出力、手動リフレッシュを案内

**Cloud Functions呼び出しエラー**:
- メール本文復号化失敗: エラーメッセージを表示、再試行ボタンを表示
- タイムアウト: エラーメッセージを表示、リトライ案内
- POP3S/SMTP接続テスト失敗: エラーメッセージを表示、設定を確認するよう案内

**アカウント管理エラー**:
- アカウント数上限到達: エラーメッセージを表示、プラン情報を案内
- アカウント作成・更新失敗: エラーメッセージを表示、入力内容を確認するよう案内

### Error Display

- Vuetifyの`v-alert`コンポーネントを使用してエラーメッセージを表示
- `v-snackbar`を使用して一時的なエラーメッセージを表示
- エラーメッセージは国際化対応（vue-i18n）

## Security

### Authentication & Authorization

- Firebase Authを使用して認証状態を管理
- すべてのFirestoreクエリで認証されたユーザーのUIDを検証
- ルートガード（vue-router）で未認証アクセスを防止

### Data Protection

- メール本文はCloud Functions経由で復号化（クライアント側で暗号鍵を保持しない）
- 復号済みのメール本文はクライアント側でキャッシュしない
- HTMLコンテンツのレンダリング時にXSS対策を実施（`v-html`の使用を最小限に、必要に応じてサニタイズ）

### Content Security Policy

- Firebase Hostingの設定でCSPヘッダーを設定
- 外部リソースの読み込みを制限

## Firebase Hosting Configuration

### firebase.json

```json
{
  "hosting": {
    "public": "apps/web_app/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/mail/**",
        "destination": "/mail/index.html"
      }
    ],
    "headers": [
      {
        "source": "/mail/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=3600"
          }
        ]
      },
      {
        "source": "/mail/assets/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  base: '/mail/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
```

### Root Index.html (リダイレクト用)

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudInbox</title>
  <meta http-equiv="refresh" content="0; url=/mail/">
  <script>
    window.location.href = '/mail/';
  </script>
</head>
<body>
  <p>リダイレクト中...</p>
  <p><a href="/mail/">こちらをクリック</a></p>
</body>
</html>
```

## Testing Strategy

### Unit Testing

- **Vue Components**: Vitestを使用してコンポーネントの単体テストを実装
- **Pinia Stores**: ストアのロジックをテスト
- **Services**: サービスの関数をテスト（Firebaseのモックを使用）

### Integration Testing

- **Firebase統合**: Firebase Emulator Suiteを使用して統合テストを実装
- **ルーティング**: vue-routerのナビゲーションをテスト

### E2E Testing

- **Playwright**または**Cypress**を使用してE2Eテストを実装（将来実装）

## Mail Detail Actions

### Action Buttons

メール詳細画面には以下のアクションボタンが実装されています：

**AppBar（ヘッダー）:**
- ケバブメニュー（`v-menu`）: 返信、全員に返信、転送

**Bottom Navigation Bar（画面下部）:**
- ゴミ箱に移動（`mdi-delete`）- 常に表示
- アーカイブ（`mdi-archive`）- ゴミ箱でない場合のみ表示
- 受信箱に戻す（`mdi-inbox`）- すべてのメール一覧を表示中の場合のみ表示（ゴミ箱でない場合）
- ゴミ箱から復元（`mdi-restore`）- ゴミ箱の場合のみ表示

**注:** 返信・転送関連のボタンはAppBarのケバブメニューからのみアクセス可能です。画面下部のボトムナビゲーションバーにはゴミ箱・アーカイブ関連のボタンのみを表示します。

**実装状況:**
- UIコンポーネント: 実装済み（`MailDetailView.vue`、`MailDetailPanel.vue`）
- ゴミ箱に移動・復元: 実装済み（`mailService.moveToTrash()`、`mailService.restoreFromTrash()`）
- アーカイブ・受信箱に戻す: 実装済み（`mailService.archive()`、`mailService.restoreToInbox()`）
- その他のアクションハンドラー: プレースホルダー実装（後続フェーズで実装予定）

**アクション実装詳細:**
- **ゴミ箱に移動**: メールメッセージの`labels`フィールドに`trash`を追加（`arrayUnion`を使用）。`deletedAt`フィールドにサーバータイムスタンプを設定
- **ゴミ箱から復元**: メールメッセージとメールスレッドの`labels`フィールドから`trash`を削除（`arrayRemove`を使用）。`deletedAt`フィールドを`null`に設定
- **アーカイブ**: メールメッセージとメールスレッドの`labels`フィールドから`inbox`を削除（`arrayRemove`を使用）
- **受信箱に戻す**: メールメッセージとメールスレッドの`labels`フィールドに`inbox`を追加（`arrayUnion`を使用）

## Internationalization (i18n)

### vue-i18n Configuration

```typescript
// main.ts
import { createI18n } from 'vue-i18n';
import ja from './locales/ja.json';
import en from './locales/en.json';

const i18n = createI18n({
  locale: navigator.language.split('-')[0] || 'ja',
  fallbackLocale: 'ja',
  messages: {
    ja,
    en,
  },
});
```

### Locale Files Structure

```json
// locales/ja.json
{
  "common": {
    "login": "ログイン",
    "logout": "ログアウト",
    "loading": "読み込み中...",
    "error": "エラーが発生しました"
  },
  "mail": {
    "inbox": "受信トレイ",
    "all": "すべてのメール",
    "trash": "ゴミ箱",
    "subject": "件名",
    "from": "送信者",
    "date": "日時",
    "reply": "返信",
    "replyAll": "全員に返信",
    "forward": "転送",
    "moveToTrash": "ゴミ箱に移動",
    "archive": "アーカイブ",
    "unarchive": "アーカイブ解除",
    "restoreFromTrash": "ゴミ箱から復元"
  }
}
```

## Responsive Layout Design

### MailListView Component Structure

```vue
<!-- MailListView.vue -->
<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <!-- メール一覧パネル -->
      <v-col 
        :cols="isDesktop ? 4 : 12" 
        :md="isDesktop ? 4 : 12"
        :lg="isDesktop ? 4 : 12"
      >
        <MailListPanel 
          :threads="threads"
          :selected-thread-id="selectedThreadId"
          @select-thread="handleSelectThread"
        />
      </v-col>
      
      <!-- メール詳細パネル（デスクトップのみ表示） -->
      <v-col 
        v-if="isDesktop"
        cols="8"
        md="8"
        lg="8"
      >
        <MailDetailPanel 
          v-if="selectedThreadId && currentMessage"
          :message="currentMessage"
        />
        <v-container v-else class="d-flex align-center justify-center" style="height: 100vh;">
          <v-card-text class="text-center text--secondary">
            {{ $t('mail.selectMessage') }}
          </v-card-text>
        </v-container>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDisplay } from 'vuetify';
import { useMailStore } from '@/stores/mail';
import { useRouter } from 'vue-router';

const { mdAndUp } = useDisplay();
const isDesktop = computed(() => mdAndUp.value);
const mailStore = useMailStore();
const router = useRouter();

const threads = computed(() => mailStore.threads);
const selectedThreadId = computed(() => mailStore.selectedThreadId);
const currentMessage = computed(() => mailStore.currentMessage);

function handleSelectThread(threadId: string) {
  if (isDesktop.value) {
    // デスクトップ: 2列レイアウト - 同一画面内で更新
    mailStore.selectThread(threadId);
  } else {
    // モバイル・タブレット: 1列レイアウト - 画面遷移
    router.push(`/${threadId}`);
  }
}
</script>
```

### Breakpoint Strategy

- **モバイル（xs, sm）**: 1列レイアウト（メール一覧のみ）
  - メールスレッドクリック → `/mail/:threadId`に遷移
  - メール詳細は全画面表示
- **デスクトップ（md以上）**: 2列レイアウト（メール一覧 + メール詳細）
  - メールスレッドクリック → 同一画面内で右側にメール詳細を表示
  - URLは変更せず、状態管理で選択中のスレッドを管理
  - メール一覧で選択中のスレッドをハイライト表示

## Mail Detail Actions

### Action Buttons

メール詳細画面には以下のアクションボタンが実装されています：

**AppBar（ヘッダー）:**
- ケバブメニュー（`v-menu`）: 返信、全員に返信、転送

**Bottom Navigation Bar（画面下部）:**
- ゴミ箱に移動（`mdi-delete`）- 常に表示
- アーカイブ（`mdi-archive`）- ゴミ箱でない場合のみ表示
- 受信箱に戻す（`mdi-inbox`）- すべてのメール一覧を表示中の場合のみ表示（ゴミ箱でない場合）
- ゴミ箱から復元（`mdi-restore`）- ゴミ箱の場合のみ表示

**注:** 返信・転送関連のボタンはAppBarのケバブメニューからのみアクセス可能です。画面下部のボトムナビゲーションバーにはゴミ箱・アーカイブ関連のボタンのみを表示します。

**実装状況:**
- UIコンポーネント: 実装済み（`MailDetailView.vue`、`MailDetailPanel.vue`）
- ゴミ箱に移動・復元: 実装済み（`mailService.moveToTrash()`、`mailService.restoreFromTrash()`）
- アーカイブ・受信箱に戻す: 実装済み（`mailService.archive()`、`mailService.restoreToInbox()`）
- 添付ファイルダウンロード: 実装済み（`mailService.downloadAttachment()`）
- その他のアクションハンドラー: プレースホルダー実装（後続フェーズで実装予定）

**アクション実装詳細:**
- **ゴミ箱に移動**: メールメッセージの`labels`フィールドに`trash`を追加（`arrayUnion`を使用）。`deletedAt`フィールドにサーバータイムスタンプを設定
- **ゴミ箱から復元**: メールメッセージとメールスレッドの`labels`フィールドから`trash`を削除（`arrayRemove`を使用）。`deletedAt`フィールドを`null`に設定
- **アーカイブ**: メールメッセージとメールスレッドの`labels`フィールドから`inbox`を削除（`arrayRemove`を使用）
- **受信箱に戻す**: メールメッセージとメールスレッドの`labels`フィールドに`inbox`を追加（`arrayUnion`を使用）

## Attachment Download

### Download Functionality

メール詳細画面で添付ファイルをクリックすると、ブラウザのダウンロードが実行されます。

**実装詳細:**
- `MailHeader.vue`で添付ファイルをクリック可能な`v-chip`として表示
- クリック時に`mailStore.downloadAttachment()`を呼び出す
- `mailService.downloadAttachment()`が既存のCloud Functions（`downloadAttachment`）を呼び出す
- Cloud Functionsから返されたBase64エンコードされた復号化済みコンテンツをBlobに変換
- 一時的なダウンロードリンクを作成し、プログラム的にクリックしてダウンロードを実行
- ダウンロード中はローディングインジケーターを表示（`v-chip`の`:loading`プロパティを使用）
- エラー発生時は`mailStore`のエラー状態を更新し、エラーメッセージを表示

## Performance Considerations

### Code Splitting

- ルートごとにコード分割（`import()`を使用）
- コンポーネントの遅延読み込み

### Caching

- 静的アセット（CSS、JavaScript）は長期キャッシュ
- HTMLは短期キャッシュ
- Firestoreクエリ結果はPiniaストアでキャッシュ

### Lazy Loading

- メール一覧は無限スクロール方式のページネーションで段階的に読み込み
  - 初期表示: 1画面で収まる件数（通常10-20件）のみ取得
  - 追加読み込み: ユーザーがスクロールして画面末尾に近づいたら、次の10-20件を取得
  - Intersection Observer APIまたはスクロールイベントで追加読み込みをトリガー
- メール詳細は必要時にのみ取得
- デスクトップ（2列レイアウト）では、メール詳細を事前に読み込まない（選択時のみ取得）

## Deployment

### Build Process

```bash
# 開発環境
cd apps/web_app
npm run dev

# 本番ビルド
npm run build

# Firebase Hostingにデプロイ
firebase deploy --only hosting
```

### Environment Configuration

- 開発環境: `firebase-config-dev.json`
- 本番環境: `firebase-config-prod.json`
- 環境変数で切り替え

