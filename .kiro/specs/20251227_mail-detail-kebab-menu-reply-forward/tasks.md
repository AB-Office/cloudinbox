# Implementation Plan

- [x] 1. DetailScreenのAppBarにケバブメニューを追加する実装
- [x] 1.1 (P) AppBarのactionsプロパティにPopupMenuButtonを追加する
  - `DetailScreen`の`build`メソッド内の`AppBar`に`actions`プロパティを追加する
  - `widget.composeRepository != null && widget.accountRepository != null`の条件で`PopupMenuButton`を表示する
  - `PopupMenuButton`の`icon`プロパティに`Icons.more_vert`を設定する
  - `PopupMenuButton`の`onSelected`コールバックで、選択された値に応じて既存のハンドラーメソッドを呼び出す
    - `'reply'`の場合は`_handleReply()`を呼び出す
    - `'reply_all'`の場合は`_handleReplyAll()`を呼び出す
    - `'forward'`の場合は`_handleForward()`を呼び出す
  - `PopupMenuButton`の`itemBuilder`コールバックでメニュー項目を構築する
    - `Localizations.localeOf(context)`を使用してロケールを取得する
    - `_message != null`を`isEnabled`として定義する
    - 「返信」メニュー項目（`value: 'reply'`）を追加する
      - `enabled: isEnabled`を設定する
      - `child`に`Row`を使用して`Icons.reply`アイコンと`I18nService.translateReply(locale)`テキストを表示する
    - 「全員に返信」メニュー項目（`value: 'reply_all'`）を追加する
      - `enabled: isEnabled`を設定する
      - `child`に`Row`を使用して`Icons.reply_all`アイコンと`I18nService.translateReplyAll(locale)`テキストを表示する
    - 「転送」メニュー項目（`value: 'forward'`）を追加する
      - `enabled: isEnabled`を設定する
      - `child`に`Row`を使用して`Icons.forward`アイコンと`I18nService.translateForward(locale)`テキストを表示する
  - メニュー項目の`Row`内でアイコンとテキストの間に`SizedBox(width: 8)`を追加してスペーシングを設定する
  - 既存の`AppBar`の`title`プロパティに影響を与えないことを確認する
  - コードコメントを適切に追加する（必要に応じて）
  - _Requirements: 1.1,1.2,1.3,1.4,1.5,1.6,1.7,2.1,2.2,2.4,2.5,2.6,3.1,3.2,3.4,3.5,3.6,4.1,4.2,4.4,4.5,4.6,5.1,5.2,5.3,5.4,6.1,6.2,6.3,6.4,7.1,7.2,7.3,7.4,7.5_

- [x] 2. 既存テストコードの動作確認
- [x] 2.1 既存テストの実行と動作確認
  - `detail_screen_test.dart`の既存テストを実行する
  - すべてのテストが正常に動作することを確認する
  - 必要に応じてテストを更新する（AppBarのactionsプロパティが追加されたことによる影響がないことを確認）
  - _Requirements: 7.6_

- [x] 3. ケバブメニューのテストケース追加（オプション）
- [x] 3.1 ケバブメニューの表示テスト
  - `composeRepository`と`accountRepository`が`null`でない場合、メニューが表示されることを検証する
  - `composeRepository`または`accountRepository`が`null`の場合、メニューが表示されないことを検証する
  - _Requirements: 7.7_

- [x] 3.2 メニュー項目の有効化/無効化テスト
  - `_message`が`null`の場合、メニュー項目が無効化されることを検証する
  - `_message`が`null`でない場合、メニュー項目が有効化されることを検証する
  - _Requirements: 7.7_

- [x] 3.3 メニュー項目のタップ処理テスト
  - 「返信」メニュー項目がタップされた場合、`_handleReply()`が呼び出されることを検証する
  - 「全員に返信」メニュー項目がタップされた場合、`_handleReplyAll()`が呼び出されることを検証する
  - 「転送」メニュー項目がタップされた場合、`_handleForward()`が呼び出されることを検証する
  - _Requirements: 7.7_

