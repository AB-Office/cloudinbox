# Project Structure

## Organization Philosophy

Monorepo構成を採用。機能別（apps, functions, packages, infra）とドメイン別（mail, users, shared）のハイブリッド構造で、コードの再利用性と保守性を確保。

## Directory Patterns

### Applications (`apps/`)
**Location**: `/apps/`  
**Purpose**: クライアントアプリケーション（Flutter）  
**Example**: `apps/mobile_app/`, `apps/web_app/`

### Cloud Functions (`functions/`)
**Location**: `/functions/src/`  
**Purpose**: Firebase Cloud Functionsの実装  
**Pattern**: ドメイン別ディレクトリ（mail/, users/, shared/, config/）  
**Example**: `functions/src/mail/fetchMails.ts`, `functions/src/users/onUserCreate.ts`

### Shared Packages (`packages/`)
**Location**: `/packages/`  
**Purpose**: 複数アプリで共有するパッケージ  
**Example**: `packages/dart_models/`（Firestoreモデル定義）

### Infrastructure (`infra/`)
**Location**: `/infra/`  
**Purpose**: インフラ設定、環境変数、デプロイスクリプト  
**Example**: `infra/firebase/`, `infra/env/`, `infra/scripts/`

### Documentation (`docs/`)
**Location**: `/docs/`  
**Purpose**: プロジェクト仕様書とアーキテクチャドキュメント  
**Example**: `docs/SPEC_MVP_FREE.md`, `docs/ARCHITECTURE.md`

## Naming Conventions

- **Functions**: camelCase（例: `fetchMails.ts`, `deleteMail.ts`）
- **Firestore Collections**: camelCase（例: `mailAccounts`, `messages`）
- **Storage Paths**: kebab-case（例: `body.txt`, `raw.eml`）
- **Flutter Files**: snake_case（Dart標準）

## Import Organization

### TypeScript (Functions)
```typescript
// Firebase Admin SDK
import * as admin from 'firebase-admin';

// ローカルモジュール（相対パス）
import { pop3Client } from './pop3Client';
import { validatePlan } from '../shared/planValidator';
```

### Dart (Flutter)
```dart
// Firebase SDK
import 'package:cloud_firestore/cloud_firestore.dart';

// 共有パッケージ
import 'package:dart_models/models.dart';

// ローカル（相対パス）
import '../models/mail_account.dart';
```

## Code Organization Principles

1. **ドメイン分離**: Functions内でmail/, users/, shared/に分離
2. **共有ロジック**: `shared/`に共通ユーティリティとバリデーション
3. **設定管理**: `config/`に環境変数と設定ロジック
4. **型定義**: TypeScriptは各ドメイン内、Dartは`packages/dart_models/`に集約

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_

