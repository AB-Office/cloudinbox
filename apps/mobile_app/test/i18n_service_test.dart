import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('I18nService', () {
    test('translateLoginWithApple returns correct Japanese text', () {
      final locale = const Locale('ja');
      final result = I18nService.translateLoginWithApple(locale);
      expect(result, 'Appleでログイン');
    });

    test('translateLoginWithApple returns correct English text', () {
      final locale = const Locale('en');
      final result = I18nService.translateLoginWithApple(locale);
      expect(result, 'Sign in with Apple');
    });

    test('translateUsageRate returns correct Japanese text', () {
      final locale = const Locale('ja');
      final result = I18nService.translateUsageRate(locale);
      expect(result, '利用率（％）');
    });

    test('translateUsageRate returns correct English text', () {
      final locale = const Locale('en');
      final result = I18nService.translateUsageRate(locale);
      expect(result, 'Usage rate (%)');
    });

    testWidgets('formatBytes formats bytes correctly for Japanese locale', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja'),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja'),
            Locale('en'),
          ],
          home: Builder(
            builder: (context) {
              expect(I18nService.formatBytes(1024, context), '1KB');
              expect(I18nService.formatBytes(1024 * 1024, context), '1MB');
              expect(I18nService.formatBytes(1024 * 1024 * 1024, context), '1GB');
              return const SizedBox.shrink();
            },
          ),
        ),
      );
    });

    testWidgets('formatBytes formats bytes correctly for English locale', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja'),
            Locale('en'),
          ],
          home: Builder(
            builder: (context) {
              expect(I18nService.formatBytes(1024, context), '1KB');
              expect(I18nService.formatBytes(1024 * 1024, context), '1MB');
              expect(I18nService.formatBytes(1024 * 1024 * 1024, context), '1GB');
              return const SizedBox.shrink();
            },
          ),
        ),
      );
    });
  });
}

