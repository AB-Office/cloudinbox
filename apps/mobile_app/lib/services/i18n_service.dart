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
}

