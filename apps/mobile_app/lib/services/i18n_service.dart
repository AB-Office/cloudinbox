import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:cloudinbox_mobile_app/l10n/app_localizations.dart';
import 'package:cloudinbox_mobile_app/l10n/app_localizations_en.dart';
import 'package:cloudinbox_mobile_app/l10n/app_localizations_ja.dart';

/// 国際化リソース管理サービス
class I18nService {
  /// 現在のロケールを取得
  static Locale getCurrentLocale(BuildContext context) {
    return Localizations.localeOf(context);
  }

  /// 日付をフォーマット
  static String formatDate(DateTime date, BuildContext context) {
    final locale = getCurrentLocale(context);
    return DateFormat.yMMMd(locale.toString()).format(date);
  }

  /// 日時をフォーマット
  static String formatDateTime(DateTime dateTime, BuildContext context) {
    final locale = getCurrentLocale(context);
    return DateFormat.yMMMd(locale.toString()).add_jm().format(dateTime);
  }

  /// バイト数をフォーマット（GB、MB等）
  static String formatBytes(int bytes, BuildContext context) {
    final locale = getCurrentLocale(context);
    if (bytes < 1024) {
      return '${bytes}B';
    } else if (bytes < 1024 * 1024) {
      final kb = bytes / 1024;
      return NumberFormat.decimalPattern(locale.toString()).format(kb) + 'KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      final mb = bytes / (1024 * 1024);
      return NumberFormat.decimalPattern(locale.toString()).format(mb) + 'MB';
    } else {
      final gb = bytes / (1024 * 1024 * 1024);
      return NumberFormat.decimalPattern(locale.toString()).format(gb) + 'GB';
    }
  }

  /// 数値をフォーマット
  static String formatNumber(num value, BuildContext context) {
    final locale = getCurrentLocale(context);
    return NumberFormat.decimalPattern(locale.toString()).format(value);
  }

  /// ロケールからログインラベルを取得するユーティリティ
  ///
  /// AuthScreen のテストで使用するため、ARB の内容に合わせたシンプルな実装とする。
  static String translateLogin(Locale locale) {
    if (locale.languageCode == 'ja') {
      return 'ログイン';
    }
    return 'Login';
  }

  /// ロケールからGoogleログインラベルを取得するユーティリティ
  static String translateLoginWithGoogle(Locale locale) {
    if (locale.languageCode == 'ja') {
      return 'Googleでログイン';
    }
    return 'Sign in with Google';
  }

  /// ロケールからAppleログインラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateLoginWithApple(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.loginWithApple;
  }

  /// ロケールからログアウトラベルを取得するユーティリティ
  static String translateLogout(Locale locale) {
    if (locale.languageCode == 'ja') {
      return 'ログアウト';
    }
    return 'Logout';
  }

  /// ロケールからアカウント設定ラベルを取得するユーティリティ
  static String translateAccountSettings(Locale locale) {
    if (locale.languageCode == 'ja') {
      return 'メールアカウント設定';
    }
    return 'Account Settings';
  }

  /// ロケールから設定ラベルを取得するユーティリティ
  static String translateSettings(Locale locale) {
    if (locale.languageCode == 'ja') {
      return '設定';
    }
    return 'Settings';
  }

  /// ロケールから受信トレイラベルを取得するユーティリティ
  static String translateInbox(Locale locale) {
    if (locale.languageCode == 'ja') {
      return '受信トレイ';
    }
    return 'Inbox';
  }

  /// ロケールからすべてのメールラベルを取得するユーティリティ
  static String translateAllMail(Locale locale) {
    if (locale.languageCode == 'ja') {
      return 'すべてのメール';
    }
    return 'All Mail';
  }

  /// ロケールから送信済みラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateSent(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.sent;
  }

  /// ロケールからゴミ箱ラベルを取得するユーティリティ
  static String translateTrash(Locale locale) {
    if (locale.languageCode == 'ja') {
      return 'ゴミ箱';
    }
    return 'Trash';
  }

  /// ロケールからアカウントラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateAccount(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.account;
  }

  /// ロケールからラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateLabel(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.label;
  }

  /// ロケールからメールアドレスラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateEmail(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.email;
  }

  /// ロケールからPOP3ホストラベルを取得するユーティリティ（ARBファイルから取得）
  static String translatePop3Host(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.pop3Host;
  }

  /// ロケールからPOP3ポートラベルを取得するユーティリティ（ARBファイルから取得）
  static String translatePop3Port(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.pop3Port;
  }

  /// ロケールからPOP3ユーザー名ラベルを取得するユーティリティ（ARBファイルから取得）
  static String translatePop3Username(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.pop3Username;
  }

  /// ロケールからPOP3パスワードラベルを取得するユーティリティ（ARBファイルから取得）
  static String translatePop3Password(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.pop3Password;
  }

  /// ロケールから接続テストラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateTestConnection(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.testConnection;
  }

  /// ロケールからアカウント作成ラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateCreateAccount(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.createAccount;
  }

  /// ロケールからパスワードヒントを取得するユーティリティ（ARBファイルから取得）
  static String translatePop3PasswordHint(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.pop3PasswordHint;
  }

  /// ロケールからアカウント更新ラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateUpdateAccount(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.updateAccount;
  }

  /// ロケールからアカウント削除ラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateDeleteAccount(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.deleteAccount;
  }

  /// ロケールから削除確認メッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateDeleteAccountConfirm(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.deleteAccountConfirm;
  }

  /// ロケールから削除確認タイトルを取得するユーティリティ（ARBファイルから取得）
  static String translateDeleteAccountConfirmTitle(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.deleteAccountConfirmTitle;
  }

  /// ロケールからキャンセルラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateCancel(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.cancel;
  }

  /// ロケールから削除ラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateDelete(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.delete;
  }

  /// ロケールからアカウント削除成功メッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateAccountDeleted(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.accountDeleted;
  }

  /// ロケールから削除方法選択タイトルを取得するユーティリティ（ARBファイルから取得）
  static String translateDeleteAccountTypeTitle(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.deleteAccountTypeTitle;
  }

  /// ロケールから論理削除説明を取得するユーティリティ（ARBファイルから取得）
  static String translateSoftDelete(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.softDelete;
  }

  /// ロケールから完全削除説明を取得するユーティリティ（ARBファイルから取得）
  static String translatePermanentDelete(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.permanentDelete;
  }

  /// ロケールから完全削除確認メッセージを取得するユーティリティ（ARBファイルから取得）
  static String translatePermanentDeleteConfirm(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.permanentDeleteConfirm;
  }

  /// ロケールから完全削除確認タイトルを取得するユーティリティ（ARBファイルから取得）
  static String translatePermanentDeleteConfirmTitle(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.permanentDeleteConfirmTitle;
  }

  /// ロケールからアカウント復元成功メッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateAccountRestored(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.accountRestored;
  }

  /// ロケールからアカウント完全削除成功メッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateAccountPermanentlyDeleted(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.accountPermanentlyDeleted;
  }

  /// ロケールからプランラベルを取得するユーティリティ（ARBファイルから取得）
  static String translatePlan(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.plan;
  }

  /// ロケールから使用済みラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateUsed(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.used;
  }

  /// ロケールから利用可能ラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateAvailable(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.available;
  }

  /// ロケールから最大ストレージラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateMaxStorage(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.maxStorage;
  }

  /// ロケールから使用済みストレージラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateUsedStorage(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.usedStorage;
  }

  /// ロケールから利用率ラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateUsageRate(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.usageRate;
  }

  /// ロケールからメールアカウントラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateMailAccounts(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.mailAccounts;
  }

  /// ロケールから復元ラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateRestore(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.restore;
  }

  /// ロケールからログアウトエラーメッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateLogoutError(Locale locale, String error) {
    final localizations = _getLocalizations(locale);
    return localizations.logoutError(error);
  }

  /// ロケールからメールアカウントなしメッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateNoMailAccounts(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.noMailAccounts;
  }

  /// ロケールからアカウント追加案内メッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateAddAccountFromSettings(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.addAccountFromSettings;
  }

  /// ロケールから復元確認メッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateRestoreAccountConfirm(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.restoreAccountConfirm;
  }

  /// ロケールから接続テストエラーメッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateConnectionTestError(Locale locale, String error) {
    final localizations = _getLocalizations(locale);
    return localizations.connectionTestError(error);
  }

  /// ロケールからアカウント更新成功メッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateAccountUpdated(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.accountUpdated;
  }

  /// ロケールからアカウント作成成功メッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateAccountCreated(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.accountCreated;
  }

  /// ロケールからアカウント更新エラーメッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateAccountUpdateError(Locale locale, String error) {
    final localizations = _getLocalizations(locale);
    return localizations.accountUpdateError(error);
  }

  /// ロケールからアカウント作成エラーメッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateAccountCreationError(Locale locale, String error) {
    final localizations = _getLocalizations(locale);
    return localizations.accountCreationError(error);
  }

  /// ロケールからアカウント削除エラーメッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateAccountDeletionError(Locale locale, String error) {
    final localizations = _getLocalizations(locale);
    return localizations.accountDeletionError(error);
  }

  /// ロケールから接続テスト成功メッセージを取得するユーティリティ（ARBファイルから取得）
  static String translateConnectionTestSucceeded(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.connectionTestSucceeded;
  }

  /// ロケールからSMTPホストラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateSmtpHost(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.smtpHost;
  }

  /// ロケールからSMTPポートラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateSmtpPort(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.smtpPort;
  }

  /// ロケールからSMTPユーザー名ラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateSmtpUsername(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.smtpUsername;
  }

  /// ロケールからSMTPパスワードラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateSmtpPassword(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.smtpPassword;
  }

  /// ロケールからSMTPパスワードヒントを取得するユーティリティ（ARBファイルから取得）
  static String translateSmtpPasswordHint(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.smtpPasswordHint;
  }

  /// ロケールからPOP3設定からコピーボタンラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateCopyFromPop3(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.copyFromPop3;
  }

  /// ロケールからSMTP接続テストボタンラベルを取得するユーティリティ（ARBファイルから取得）
  static String translateTestSmtpConnection(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.testSmtpConnection;
  }

  /// ロケールから返信ボタンのツールチップを取得するユーティリティ（ARBファイルから取得）
  static String translateReply(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.reply;
  }

  /// ロケールから全員に返信ボタンのツールチップを取得するユーティリティ（ARBファイルから取得）
  static String translateReplyAll(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.replyAll;
  }

  /// ロケールから転送ボタンのツールチップを取得するユーティリティ（ARBファイルから取得）
  static String translateForward(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.forward;
  }

  /// ロケールからゴミ箱に移動ボタンのツールチップを取得するユーティリティ（ARBファイルから取得）
  static String translateMoveToTrash(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.moveToTrash;
  }

  /// ロケールからアーカイブボタンのツールチップを取得するユーティリティ（ARBファイルから取得）
  static String translateArchive(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.archive;
  }

  /// ロケールからゴミ箱から復元ボタンのツールチップを取得するユーティリティ（ARBファイルから取得）
  static String translateRestoreFromTrash(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.restoreFromTrash;
  }

  /// ロケールからアーカイブから復元ボタンのツールチップを取得するユーティリティ（ARBファイルから取得）
  static String translateUnarchive(Locale locale) {
    final localizations = _getLocalizations(locale);
    return localizations.unarchive;
  }

  /// ロケールからAppLocalizationsインスタンスを取得するヘルパーメソッド
  static AppLocalizations _getLocalizations(Locale locale) {
    // AppLocalizationsのサブクラスを直接インスタンス化
    if (locale.languageCode == 'ja') {
      return AppLocalizationsJa();
    }
    return AppLocalizationsEn();
  }
}


