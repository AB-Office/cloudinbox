# Research & Design Decisions Template

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

**Usage**:
- Log research activities and outcomes during the discovery phase.
- Document design decision trade-offs that are too detailed for `design.md`.
- Provide references and evidence for future audits or reuse.
---

## Summary
- **Feature**: `20251226_mail-with-attachments`
- **Discovery Scope**: Extension（既存システムの拡張）
- **Key Findings**:
  - 添付ファイルの保存機能は既に実装済み（saveMail.ts）
  - Storageからファイルをリストするパターンが既に存在（purgeTrash.ts）
  - decryptMail.tsのパターンを踏襲して新しいFunctionを作成
  - Firestoreには添付ファイルのメタデータが保存されていないため、Storageから直接リストする必要がある

## Research Log

### 既存コードベース分析
- **Context**: 添付ファイル機能の実装状況を確認
- **Sources Consulted**: 
  - `functions/src/mail/saveMail.ts` - 添付ファイル保存ロジック
  - `functions/src/mail/decryptMail.ts` - 本文復号化パターン
  - `functions/src/mail/purgeTrash.ts` - Storageファイルリスト取得パターン
  - `functions/src/mail/storagePaths.ts` - Storageパス定義
  - `functions/src/mail/types.ts` - 型定義
- **Findings**: 
  - 添付ファイルは既に`mail-data/{uid}/{messageId}/attachments/{filename}.enc`形式で保存されている
  - ファイル名とcontentTypeはStorageのメタデータに保存されている
  - Firestoreには`hasAttachments`と`storage.attachmentsBasePath`のみが保存されている
  - 個別の添付ファイルのメタデータ（ファイル名、サイズ、コンテンツタイプ）はFirestoreに保存されていない
  - Storageからファイルをリストするには`bucket.getFiles({ prefix: attachmentsBasePath })`を使用（purgeTrash.tsで実証済み）
- **Implications**: 
  - 添付ファイルリスト取得機能はStorageから直接リストする必要がある
  - ファイル名はStorageパスから`.enc`拡張子を除去して取得する必要がある
  - 既存のdecryptMail.tsのパターンに従って新しいCloud Functionを作成する

### 既存アーキテクチャパターン分析
- **Context**: 既存のメール処理パターンを確認
- **Sources Consulted**:
  - `functions/src/mail/decryptMail.ts` - HTTP Callable Functionパターン
  - `functions/src/index.ts` - Functionエクスポートパターン
- **Findings**:
  - 既存のdecryptMailは`functions.region('asia-northeast1').https.onCall`を使用
  - 認証チェック、バリデーション、エラーハンドリングのパターンが確立されている
  - executeXXX形式でコアロジックを分離してテスト可能にしている
- **Implications**: 
  - 新しい添付ファイル機能も同じパターンに従う
  - executeGetAttachmentsList、executeDownloadAttachmentのような関数を作成
  - 認証・認可チェックを実装

### Storage API使用パターン
- **Context**: Firebase Storageからのファイル取得方法を確認
- **Sources Consulted**:
  - `functions/src/mail/decryptMail.ts` - Storageからのダウンロードパターン
  - `functions/src/mail/purgeTrash.ts` - Storageファイルリスト取得パターン
- **Findings**:
  - `bucket.file(path).download()`でファイルをダウンロード
  - `bucket.getFiles({ prefix })`でファイルをリスト
  - `file.getMetadata()`でメタデータ（contentType、size）を取得
  - 暗号化されたファイルはJSON形式で保存されている（EncryptedData形式）
- **Implications**: 
  - 添付ファイルリスト取得時は`getFiles`でリストして、メタデータからファイル名とサイズを取得
  - ファイル名はパスから`.enc`を除去
  - ダウンロード時は`download()`で取得してから復号化

## Architecture Pattern Evaluation

既存システムはサーバーレスアーキテクチャで、Firebase Functions + Firestore/Storageの構成。既存のdecryptMailパターンに従って新しいFunctionを追加する方針。

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存パターン踏襲 | decryptMailと同じパターンで新しいFunctionを作成 | 一貫性、保守性、既存パターンの再利用 | なし | 既存コードとの整合性が高い |

## Design Decisions

### Decision: 添付ファイルリスト取得の実装方法
- **Context**: Firestoreに添付ファイルメタデータが保存されていないため、リスト取得方法を決定する必要がある
- **Alternatives Considered**:
  1. Firestoreに添付ファイルメタデータを保存する - 既存データ構造を変更する必要があり、後方互換性の問題がある
  2. Storageから直接リストする - 既存のpurgeTrash.tsで実証済みのパターンを使用
- **Selected Approach**: Storageから直接リストする
- **Rationale**: 
  - 既存コードを変更する必要がない
  - purgeTrash.tsで既に同じパターンが使用されている
  - Firestoreのドキュメントサイズを増やさない
- **Trade-offs**: 
  - メリット: 既存コードへの影響なし、実装が簡単
  - デメリット: Storage API呼び出しが追加される（ただし、既存のpurgeTrashでも同じパターン）
- **Follow-up**: 
  - Storage APIのレート制限に注意
  - パフォーマンステストを実施

### Decision: 添付ファイルリストとダウンロード機能の分離
- **Context**: 要件1（リスト取得）と要件2（ダウンロード）を1つのFunctionで実装するか分けるか
- **Alternatives Considered**:
  1. 1つのFunctionで両方を実装 - getAttachments（リスト取得）、downloadAttachment（ダウンロード）を同じFunctionに
  2. 2つのFunctionに分離 - getAttachmentsList、downloadAttachmentを別々のFunctionに
- **Selected Approach**: 2つのFunctionに分離
- **Rationale**: 
  - 単一責任の原則に従う
  - decryptMailと同様に、各Functionが明確な責任を持つ
  - テストと保守が容易
- **Trade-offs**: 
  - メリット: 責任が明確、テストが容易、将来の拡張が容易
  - デメリット: Function数が増える（ただし、管理上は問題ない）
- **Follow-up**: 
  - 実装時に両方のFunctionが適切にエクスポートされていることを確認

### Decision: モバイルアプリでのファイルダウンロード方法
- **Context**: Flutterアプリでファイルをダウンロードして保存する方法を決定
- **Alternatives Considered**:
  1. Cloud FunctionからBase64エンコードされたバイナリを返す - 簡単だが、大きなファイルには不向き
  2. Cloud FunctionからBase64エンコードされたバイナリを返す（要件に従う） - 実装が簡単、既存のdecryptMailパターンと一貫性がある
- **Selected Approach**: Cloud FunctionからBase64エンコードされたバイナリを返す
- **Rationale**: 
  - 既存のdecryptMailパターンと一貫性がある
  - 認証・認可のチェックをサーバー側で行える
  - 実装が比較的簡単
- **Trade-offs**: 
  - メリット: 実装が簡単、既存パターンとの一貫性
  - デメリット: 大きなファイルの場合、メモリ使用量が増える可能性（ただし、Cloud Functionsのメモリ制限内であれば問題なし）
- **Follow-up**: 
  - 大きな添付ファイル（例：10MB以上）でのパフォーマンステストを実施
  - 必要に応じてストリーミングダウンロードを検討（将来の拡張）

## Risks & Mitigations
- **Storage API呼び出しのパフォーマンス** - 添付ファイルリスト取得時にStorage APIを呼び出すため、レイテンシが発生する可能性。軽減策：必要に応じてキャッシュを検討（将来の拡張）
- **大きなファイルのメモリ使用量** - Base64エンコードされたバイナリをメモリに保持するため、大きなファイルでメモリ使用量が増える可能性。軽減策：Cloud Functionsのメモリ制限内であれば問題なし。必要に応じてストリーミングを検討（将来の拡張）
- **ファイル名の安全な処理** - ファイル名に特殊文字が含まれる場合の処理。軽減策：Storageパスから安全にファイル名を抽出する処理を実装

## References
- `functions/src/mail/decryptMail.ts` - 既存の復号化パターン
- `functions/src/mail/purgeTrash.ts` - Storageファイルリスト取得パターン
- `functions/src/mail/saveMail.ts` - 添付ファイル保存ロジック
- `functions/src/mail/storagePaths.ts` - Storageパス定義

