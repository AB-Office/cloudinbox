# Requirements Document

## Project Description (Input)
メール詳細画面のタイトル右にケバブメニューを設置し、それぞれ「返信」「全員に返信」「転送」を設置しそれぞれの処理を実装する

## Introduction

CloudInboxサービスのメール詳細画面（`DetailScreen`）には、現在`bottomNavigationBar`に「返信」「全員に返信」「転送」のアイコンボタンが配置されており、それぞれの処理（`_handleReply()`, `_handleReplyAll()`, `_handleForward()`）も既に実装されています。しかし、ユーザビリティ向上のため、これらの機能を`AppBar`のタイトル右にケバブメニュー（`PopupMenuButton`）として配置し、よりアクセスしやすくする必要があります。

本機能により、メール詳細画面の`AppBar`にケバブメニューを追加し、「返信」「全員に返信」「転送」の各アクションを実行できるようになります。既存の処理ロジックは再利用し、UI配置のみを変更します。

## Requirements

### Requirement 1: ケバブメニューの追加

**Objective:** As a ユーザー, I want メール詳細画面のAppBarにケバブメニューを表示できること, so that 返信・転送機能にアクセスしやすくなる

#### Acceptance Criteria

1. When メール詳細画面が表示される, CloudInbox shall `AppBar`の`actions`プロパティに`PopupMenuButton`を追加する
2. When `PopupMenuButton`が表示される, CloudInbox shall ケバブメニューアイコン（`Icons.more_vert`）を表示する
3. When ケバブメニューアイコンがタップされる, CloudInbox shall ポップアップメニューを表示する
4. The CloudInbox shall ケバブメニューは`AppBar`のタイトル右側に配置する
5. The CloudInbox shall 既存の`AppBar`のタイトル表示機能に影響を与えない
6. The CloudInbox shall `composeRepository`と`accountRepository`が`null`の場合、ケバブメニューを表示しない（返信・転送機能が使用できないため）
7. When `composeRepository`と`accountRepository`が存在する場合, CloudInbox shall ケバブメニューを表示する

### Requirement 2: 返信メニュー項目の実装

**Objective:** As a ユーザー, I want ケバブメニューから「返信」を選択できること, so that メールに返信できる

#### Acceptance Criteria

1. When ケバブメニューが表示される, CloudInbox shall 「返信」メニュー項目を表示する
2. When 「返信」メニュー項目がタップされる, CloudInbox shall 既存の`_handleReply()`メソッドを呼び出す
3. When `_handleReply()`が実行される, CloudInbox shall 既存の処理ロジックに従って`ComposeScreen`に遷移する
4. When 「返信」メニュー項目が表示される, CloudInbox shall `I18nService.translateReply()`を使用して国際化されたテキストを表示する
5. When 「返信」メニュー項目が表示される, CloudInbox shall `Icons.reply`アイコンを表示する（オプション）
6. If メールメッセージが読み込まれていない場合（`_message == null`）, CloudInbox shall 「返信」メニュー項目を無効化する（`enabled: false`）

### Requirement 3: 全員に返信メニュー項目の実装

**Objective:** As a ユーザー, I want ケバブメニューから「全員に返信」を選択できること, so that メールの全受信者に返信できる

#### Acceptance Criteria

1. When ケバブメニューが表示される, CloudInbox shall 「全員に返信」メニュー項目を表示する
2. When 「全員に返信」メニュー項目がタップされる, CloudInbox shall 既存の`_handleReplyAll()`メソッドを呼び出す
3. When `_handleReplyAll()`が実行される, CloudInbox shall 既存の処理ロジックに従って`ComposeScreen`に遷移する
4. When 「全員に返信」メニュー項目が表示される, CloudInbox shall `I18nService.translateReplyAll()`を使用して国際化されたテキストを表示する
5. When 「全員に返信」メニュー項目が表示される, CloudInbox shall `Icons.reply_all`アイコンを表示する（オプション）
6. If メールメッセージが読み込まれていない場合（`_message == null`）, CloudInbox shall 「全員に返信」メニュー項目を無効化する（`enabled: false`）

### Requirement 4: 転送メニュー項目の実装

**Objective:** As a ユーザー, I want ケバブメニューから「転送」を選択できること, so that メールを転送できる

#### Acceptance Criteria

1. When ケバブメニューが表示される, CloudInbox shall 「転送」メニュー項目を表示する
2. When 「転送」メニュー項目がタップされる, CloudInbox shall 既存の`_handleForward()`メソッドを呼び出す
3. When `_handleForward()`が実行される, CloudInbox shall 既存の処理ロジックに従って`ComposeScreen`に遷移する
4. When 「転送」メニュー項目が表示される, CloudInbox shall `I18nService.translateForward()`を使用して国際化されたテキストを表示する
5. When 「転送」メニュー項目が表示される, CloudInbox shall `Icons.forward`アイコンを表示する（オプション）
6. If メールメッセージが読み込まれていない場合（`_message == null`）, CloudInbox shall 「転送」メニュー項目を無効化する（`enabled: false`）

### Requirement 5: UIの一貫性とユーザー体験

**Objective:** As a ユーザー, I want ケバブメニューのUIが既存のデザインシステムと一貫性があること, so that 直感的に操作できる

#### Acceptance Criteria

1. The CloudInbox shall ケバブメニューのスタイルが既存のFlutter Material Designガイドラインに従う
2. The CloudInbox shall ケバブメニューの項目が適切な順序で表示される（「返信」「全員に返信」「転送」の順）
3. The CloudInbox shall ケバブメニュー項目間に適切な区切り線（`Divider`または`PopupMenuDivider`）を表示する（オプション、必要に応じて）
4. When ケバブメニューが表示される, CloudInbox shall メニュー項目がタップしやすいサイズで表示される
5. The CloudInbox shall 既存の`bottomNavigationBar`の機能に影響を与えない（返信・転送ボタンは残すか削除するかは設計フェーズで決定）

### Requirement 6: エラーハンドリングと状態管理

**Objective:** As a ユーザー, I want ケバブメニュー操作時のエラーが適切に処理されること, so that 問題が発生した場合でも操作を継続できる

#### Acceptance Criteria

1. When ケバブメニューから「返信」「全員に返信」「転送」が実行される, CloudInbox shall 既存の`_handleReply()`, `_handleReplyAll()`, `_handleForward()`メソッドのエラーハンドリングロジックを使用する
2. If メールメッセージの読み込み中にケバブメニューが表示される, CloudInbox shall メニュー項目を無効化する（`_message == null`の場合）
3. The CloudInbox shall 既存のエラーハンドリングパターン（`debugPrint`、`SnackBar`など）に従う
4. If `composeRepository`または`accountRepository`が`null`の場合, CloudInbox shall ケバブメニューを表示しない（Requirement 1と同じ）

### Requirement 7: 実装の一貫性とコード品質

**Objective:** As a 開発者, I want 実装が既存のコードベースと一貫性を保つこと, so that 保守性と可読性を確保できる

#### Acceptance Criteria

1. The CloudInbox shall 既存の`DetailScreen`クラスの実装パターンに従う（`StatefulWidget`、`setState`、`mounted`チェックなど）
2. The CloudInbox shall 既存の国際化パターン（`I18nService`の使用）に従う
3. The CloudInbox shall 既存の`ComposeScreen`への遷移パターン（`Navigator.push`、`ComposeIntent`の使用）を再利用する
4. The CloudInbox shall 既存のメソッド（`_handleReply()`, `_handleReplyAll()`, `_handleForward()`）を再利用し、重複コードを避ける
5. The CloudInbox shall コードコメントを適切に追加する（必要に応じて）
6. The CloudInbox shall 既存のテストコード（`detail_screen_test.dart`）が動作することを確認する
7. The CloudInbox shall 新しいテストケースを追加して、ケバブメニューの動作を検証する（オプション）
