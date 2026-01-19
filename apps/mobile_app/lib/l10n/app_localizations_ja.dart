// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Japanese (`ja`).
class AppLocalizationsJa extends AppLocalizations {
  AppLocalizationsJa([String locale = 'ja']) : super(locale);

  @override
  String get appTitle => 'CloudInbox';

  @override
  String get login => 'ログイン';

  @override
  String get loginWithGoogle => 'Googleでログイン';

  @override
  String get loginWithApple => 'Appleでログイン';

  @override
  String get logout => 'ログアウト';

  @override
  String get error => 'エラー';

  @override
  String get loading => '読み込み中...';

  @override
  String get accountSettings => 'メールアカウント設定';

  @override
  String get settings => '設定';

  @override
  String get inbox => '受信トレイ';

  @override
  String get allMail => 'すべてのメール';

  @override
  String get sent => '送信済み';

  @override
  String get trash => 'ゴミ箱';

  @override
  String get account => 'アカウント';

  @override
  String get label => 'ラベル';

  @override
  String get email => 'メールアドレス';

  @override
  String get pop3Host => 'POP3ホスト';

  @override
  String get pop3Port => 'POP3ポート';

  @override
  String get pop3Username => 'POP3ユーザー名';

  @override
  String get pop3Password => 'POP3パスワード';

  @override
  String get testConnection => '接続テスト';

  @override
  String get createAccount => 'アカウント作成';

  @override
  String get pop3PasswordHint => '変更する場合のみ入力してください';

  @override
  String get updateAccount => 'アカウント更新';

  @override
  String get deleteAccount => 'アカウント削除';

  @override
  String get deleteAccountConfirm => 'このアカウントを削除しますか？';

  @override
  String get deleteAccountConfirmTitle => 'アカウント削除';

  @override
  String get cancel => 'キャンセル';

  @override
  String get delete => '削除';

  @override
  String get accountDeleted => 'アカウントを削除しました';

  @override
  String get deleteAccountTypeTitle => '削除方法を選択';

  @override
  String get softDelete => '一時的に削除（復元可能）';

  @override
  String get permanentDelete => '完全に削除（復元不可）';

  @override
  String get permanentDeleteConfirm => 'このアカウントを完全に削除しますか？\nこの操作は取り消せません。';

  @override
  String get permanentDeleteConfirmTitle => '完全削除の確認';

  @override
  String get accountRestored => 'アカウントを復元しました';

  @override
  String get accountPermanentlyDeleted => 'アカウントを完全に削除しました';

  @override
  String get plan => 'プラン';

  @override
  String get used => '使用済み';

  @override
  String get available => '利用可能';

  @override
  String get maxStorage => '最大ストレージ（バイト）';

  @override
  String get usedStorage => '使用済みストレージ（バイト）';

  @override
  String get usageRate => '利用率（％）';

  @override
  String get mailAccounts => 'メールアカウント';

  @override
  String get restore => '復元';

  @override
  String logoutError(String error) {
    return 'ログアウトエラー: $error';
  }

  @override
  String get noMailAccounts => 'メールアカウントがありません';

  @override
  String get addAccountFromSettings => '下の「メールアカウント設定」から追加してください';

  @override
  String get restoreAccountConfirm => 'このアカウントを復元しますか？';

  @override
  String connectionTestError(String error) {
    return '接続テストエラー: $error';
  }

  @override
  String get accountUpdated => 'アカウントを更新しました';

  @override
  String get accountCreated => 'アカウントを作成しました';

  @override
  String accountUpdateError(String error) {
    return 'アカウント更新エラー: $error';
  }

  @override
  String accountCreationError(String error) {
    return 'アカウント作成エラー: $error';
  }

  @override
  String accountDeletionError(String error) {
    return 'アカウント削除エラー: $error';
  }

  @override
  String get connectionTestSucceeded => '接続テスト成功';

  @override
  String get smtpHost => 'SMTPホスト';

  @override
  String get smtpPort => 'SMTPポート';

  @override
  String get smtpUsername => 'SMTPユーザー名';

  @override
  String get smtpPassword => 'SMTPパスワード';

  @override
  String get smtpPasswordHint => '変更する場合のみ入力してください';

  @override
  String get copyFromPop3 => 'POP3設定からコピー';

  @override
  String get testSmtpConnection => 'SMTP接続テスト';

  @override
  String get reply => '返信';

  @override
  String get replyAll => '全員に返信';

  @override
  String get forward => '転送';

  @override
  String get moveToTrash => 'ゴミ箱に移動';

  @override
  String get archive => 'アーカイブ';

  @override
  String get restoreFromTrash => 'ゴミ箱から復元';

  @override
  String get unarchive => 'アーカイブから復元';

  @override
  String get compose => 'メール作成';

  @override
  String get send => '送信';

  @override
  String get from => '送信元';

  @override
  String get to => '宛先';

  @override
  String get enterEmailAddress => 'メールアドレスを入力';

  @override
  String get showCcBcc => 'Cc/Bccを表示';

  @override
  String get hideCcBcc => 'Cc/Bccを隠す';

  @override
  String get subject => '件名';

  @override
  String get body => '本文';

  @override
  String get addAttachment => '添付ファイルを追加';

  @override
  String get discard => '破棄';

  @override
  String get discardInputConfirm => '入力内容を破棄しますか？';

  @override
  String get forwardedMessagePrefix => '-------- 転送メッセージ --------';

  @override
  String get errorPleaseEnterRecipient => '宛先を入力してください';

  @override
  String get errorPleaseEnterSubject => '件名を入力してください';

  @override
  String get errorPleaseSelectSenderAccount => '送信元アカウントを選択してください';

  @override
  String errorInvalidEmailAddress(String email) {
    return '無効なメールアドレス: $email';
  }

  @override
  String get errorFailedToSendMail => 'メール送信に失敗しました';

  @override
  String get mailSent => 'メールを送信しました';

  @override
  String get mailSendTimeout => 'メール送信結果の確認に失敗しました。しばらくしてから送信済みフォルダをご確認ください。';

  @override
  String errorGeneric(String error) {
    return 'エラー: $error';
  }

  @override
  String errorFailedToReadFile(String filename) {
    return 'ファイルの読み込みに失敗しました: $filename';
  }

  @override
  String errorFileSizeExceedsLimit(int maxSize, String filename) {
    return 'ファイルサイズが${maxSize}MBを超えています: $filename';
  }

  @override
  String get errorFailedToPickFiles => 'ファイル選択に失敗しました';

  @override
  String get errorFileAccessPermissionDenied => 'ファイルへのアクセス権限がありません。設定から権限を許可してください。';

  @override
  String get errorFileAccessPermissionDeniedGeneric => 'ファイルへのアクセス権限がありません';

  @override
  String get errorFileSelectionCanceled => 'ファイル選択がキャンセルされました';

  @override
  String get errorFileSelectionUnknown => 'ファイル選択に失敗しました（不明なエラー）';

  @override
  String errorFileSelectionFailed(String message) {
    return 'ファイル選択に失敗しました: $message';
  }

  @override
  String get noMail => 'メールがありません';

  @override
  String get smtpSettings => 'SMTP設定';

  @override
  String get loadMore => 'もっと見る';

  @override
  String errorFailedToLoadAccounts(String error) {
    return 'アカウントの読み込みに失敗しました: $error';
  }

  @override
  String get errorOperationFailed => '操作に失敗しました。もう一度お試しください。';

  @override
  String get legal => '法的情報';

  @override
  String get privacyPolicy => 'プライバシーポリシー';

  @override
  String get termsOfService => '利用規約';

  @override
  String get pricingBilling => '特定商取引法に基づく表記';

  @override
  String get legalConsentTitle => '利用規約・プライバシーポリシーへの同意';

  @override
  String get legalConsentReconsentMessage => '法的文書が更新されました。最新版に同意してください。';

  @override
  String get legalConsentDescription => 'CloudInboxをご利用いただくには、利用規約とプライバシーポリシーへの同意が必要です。以下のチェックボックスにチェックを入れて同意してください。';

  @override
  String get legalConsentAgreeTerms => '利用規約に同意する';

  @override
  String get legalConsentAgreePrivacy => 'プライバシーポリシーに同意する';

  @override
  String get legalConsentView => '表示';

  @override
  String get legalConsentViewAgain => '再表示';

  @override
  String get legalConsentReadFullText => '（全文を読んでください）';

  @override
  String get legalConsentSubmit => '同意する';

  @override
  String legalConsentSaveError(String error) {
    return '同意の保存に失敗しました: $error';
  }

  @override
  String get legalDocumentReadComplete => '全文を読んだ';

  @override
  String get retry => '再試行';

  @override
  String get noContentAvailable => 'コンテンツが利用できません';
}
