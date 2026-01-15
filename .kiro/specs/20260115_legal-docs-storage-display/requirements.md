# Requirements Document

## Introduction
利用規約、プライバシーポリシー、特定商取引法に基づく表記、Pricing/BillingのMarkdownファイルをFirebase Storageに格納し、WebアプリとFlutterアプリでStorage上のMarkdownを取得・表示できるようにすることで、法的文書の一元管理と動的な更新を実現する。

## Requirements

### Requirement 1: 法的文書のMarkdownファイルをFirebase Storageに格納
**Objective:** バックエンドエンジニアとして、法的文書（利用規約、プライバシーポリシー、特定商取引法に基づく表記、Pricing/Billing）のMarkdownファイルをFirebase Storageに格納できるようにしたい。そうすることで、法的文書を一元管理し、コード変更なしで文書を更新できるようになる。

#### Acceptance Criteria
1. 以下のMarkdownファイルがFirebase Storageに格納されていること：
   - `terms.md`（日本語利用規約）
   - `terms_en.md`（英語利用規約）
   - `privacy.md`（日本語プライバシーポリシー）
   - `privacy_en.md`（英語プライバシーポリシー）
   - `commercial.md`（特定商取引法に基づく表記・日本語のみ）
   - `pricing_en.md`（Pricing/Billing・英語のみ）
2. Storageのパス構造が定義され、一貫性のある命名規則に従っていること（例: `legal-docs/{document-type}_{locale}.md`）。
3. Storageルールが更新され、認証ユーザーが法的文書を読み取れるようになっていること（書き込みは管理者のみ）。
4. 既存の`apps/web_app/public/`ディレクトリ内のMarkdownファイルをStorageにアップロードする手順またはスクリプトが用意されていること。
5. Storageに格納されたMarkdownファイルのメタデータ（最終更新日時、ファイルサイズなど）が適切に設定されていること。

### Requirement 2: WebアプリでStorage上のMarkdownを表示
**Objective:** フロントエンドエンジニアとして、Webアプリの設定画面から法的文書へのリンクをクリックした際に、Firebase StorageからMarkdownを取得して表示できるようにしたい。そうすることで、静的HTMLファイルへの依存を排除し、Storage上の最新の文書を常に表示できるようになる。

#### Acceptance Criteria
1. Webアプリの設定画面（`SettingsView.vue`）で、法的文書へのリンクをクリックした際に、Firebase StorageからMarkdownを取得して表示すること。
2. MarkdownをHTMLに変換して表示する機能が実装されていること（既存の`marked`ライブラリまたは同等のライブラリを使用）。
3. 言語（日本語/英語）に応じて適切なMarkdownファイルを取得すること（例: 日本語環境では`terms.md`、英語環境では`terms_en.md`）。
4. 特定商取引法に基づく表記は日本語環境でのみ表示し、Pricing/Billingは英語環境でのみ表示すること。
5. Storageからの取得に失敗した場合、適切なエラーメッセージを表示すること。
6. 読み込み中はローディングインジケーターを表示すること。
7. 表示されるHTMLは適切なスタイリングが適用され、既存のデザインと一貫性があること。
8. 外部URL（`https://cloudinbox.cloud/privacy.html`など）への直接リンクを削除し、Storageからの取得に置き換えること。

### Requirement 3: FlutterアプリでStorage上のMarkdownを表示
**Objective:** モバイルアプリ開発者として、Flutterアプリの設定画面から法的文書へのリンクをクリックした際に、Firebase StorageからMarkdownを取得して表示できるようにしたい。そうすることで、Webアプリと同様にStorage上の最新の文書を常に表示できるようになる。

#### Acceptance Criteria
1. Flutterアプリの設定画面（`settings_screen.dart`）で、法的文書へのリンクをクリックした際に、Firebase StorageからMarkdownを取得して表示すること。
2. MarkdownをHTMLに変換して表示する機能が実装されていること（`flutter_markdown`パッケージまたは同等のパッケージを使用）。
3. 言語（日本語/英語）に応じて適切なMarkdownファイルを取得すること（例: 日本語環境では`terms.md`、英語環境では`terms_en.md`）。
4. 特定商取引法に基づく表記は日本語環境でのみ表示し、Pricing/Billingは英語環境でのみ表示すること。
5. Storageからの取得に失敗した場合、適切なエラーメッセージを表示すること。
6. 読み込み中はローディングインジケーターを表示すること。
7. 表示されるHTMLは適切なスタイリングが適用され、既存のデザインと一貫性があること。
8. 外部URL（`https://cloudinbox.cloud/privacy.html`など）への直接リンクを削除し、Storageからの取得に置き換えること。
9. WebViewまたはMarkdown表示用の専用画面を実装し、ユーザーが文書を閲覧できること。


