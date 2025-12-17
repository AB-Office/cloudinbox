import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

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

  /// ロケールからゴミ箱ラベルを取得するユーティリティ
  static String translateTrash(Locale locale) {
    if (locale.languageCode == 'ja') {
      return 'ゴミ箱';
    }
    return 'Trash';
  }
}


