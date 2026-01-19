/// Tests for LegalDocumentScreen
///
/// Tests for displaying legal documents from Firebase Storage

import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:cloudinbox_mobile_app/screens/legal_document_screen.dart';
import 'package:cloudinbox_mobile_app/services/legal_document_service.dart';
import 'package:cloudinbox_mobile_app/l10n/app_localizations.dart';

// LegalDocumentServiceのモック
class _FakeLegalDocumentService extends LegalDocumentService {
  final String? mockContent;
  final Exception? mockError;
  bool getDocumentCalled = false;
  String? lastDocumentType;
  String? lastLocale;

  _FakeLegalDocumentService({this.mockContent, this.mockError});

  void reset() {
    getDocumentCalled = false;
    lastDocumentType = null;
    lastLocale = null;
  }

  @override
  Future<String> getDocument(String documentType, String locale) async {
    getDocumentCalled = true;
    lastDocumentType = documentType;
    lastLocale = locale;

    if (mockError != null) {
      throw mockError!;
    }

    if (mockContent != null) {
      return mockContent!;
    }

    throw Exception('Document not found');
  }

  @override
  Future<String> getDocumentMetadata(String documentType, String locale) async {
    return '2024-01-01T00:00:00.000Z';
  }
}

void main() {
  group('LegalDocumentScreen', () {
    testWidgets('should display loading state initially', (tester) async {
      // Completerを使用するサービスを作成（ローディング状態の確認のため）
      final service = _DelayedLegalDocumentService(
        mockContent: '# Content',
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'terms',
            locale: const Locale('ja', ''),
            service: service,
          ),
        ),
      );

      // 初期状態ではローディングが表示される（非同期処理が完了する前）
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      // 日本語環境では「読み込み中...」、英語環境では「Loading...」が表示される
      expect(find.text('読み込み中...'), findsOneWidget);
      
      // Completerを完了させて、非同期処理を完了させる
      service.complete();
      // タイマーを処理するため、タイムアウトを長くする
      await tester.pumpAndSettle(const Duration(seconds: 5));
    });

    testWidgets('should display document content when loaded', (tester) async {
      const mockContent = '# 利用規約\n\n本文...';
      final service = _FakeLegalDocumentService(mockContent: mockContent);

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'terms',
            locale: const Locale('ja', ''),
            service: service,
          ),
        ),
      );

      // 非同期処理を待つ（タイマーを処理するため、タイムアウトを長くする）
      await tester.pumpAndSettle(const Duration(seconds: 5));

      expect(service.getDocumentCalled, isTrue);
      expect(service.lastDocumentType, 'terms');
      expect(service.lastLocale, 'ja');
      // Markdownコンテンツが表示されることを確認
      expect(find.textContaining('利用規約'), findsWidgets);
    });

    testWidgets('should display error message when document fetch fails', (tester) async {
      final service = _FakeLegalDocumentService(
        mockError: Exception('Document not found'),
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'privacy',
            locale: const Locale('en', ''),
            service: service,
          ),
        ),
      );

      // 非同期処理を待つ（タイマーを処理するため、タイムアウトを長くする）
      await tester.pumpAndSettle(const Duration(seconds: 5));

      expect(service.getDocumentCalled, isTrue);
      // エラーメッセージが表示されることを確認（英語環境では「Error」）
      expect(find.textContaining('Error'), findsWidgets);
    });

    testWidgets('should display correct title in AppBar', (tester) async {
      const mockContent = '# Content';
      final service = _FakeLegalDocumentService(mockContent: mockContent);

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'terms',
            locale: const Locale('ja', ''),
            service: service,
          ),
        ),
      );

      // タイマーを処理するため、タイムアウトを長くする
      await tester.pumpAndSettle(const Duration(seconds: 5));

      // AppBarにタイトルが表示されることを確認
      expect(find.byType(AppBar), findsOneWidget);
    });

    testWidgets('should call getDocument with correct parameters for terms/ja', (tester) async {
      final service = _FakeLegalDocumentService(mockContent: '# Content');

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'terms',
            locale: const Locale('ja', ''),
            service: service,
          ),
        ),
      );

      // タイマーを処理するため、タイムアウトを長くする
      await tester.pumpAndSettle(const Duration(seconds: 5));

      expect(service.getDocumentCalled, isTrue);
      expect(service.lastDocumentType, 'terms');
      expect(service.lastLocale, 'ja');
    });

    testWidgets('should call getDocument with correct parameters for privacy/en', (tester) async {
      final service = _FakeLegalDocumentService(mockContent: '# Content');

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'privacy',
            locale: const Locale('en', ''),
            service: service,
          ),
        ),
      );

      // タイマーを処理するため、タイムアウトを長くする
      await tester.pumpAndSettle(const Duration(seconds: 5));

      expect(service.getDocumentCalled, isTrue);
      expect(service.lastDocumentType, 'privacy');
      expect(service.lastLocale, 'en');
    });

    testWidgets('should call getDocument with correct parameters for commercial/ja', (tester) async {
      final service = _FakeLegalDocumentService(mockContent: '# Content');

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'commercial',
            locale: const Locale('ja', ''),
            service: service,
          ),
        ),
      );

      // タイマーを処理するため、タイムアウトを長くする
      await tester.pumpAndSettle(const Duration(seconds: 5));

      expect(service.getDocumentCalled, isTrue);
      expect(service.lastDocumentType, 'commercial');
      expect(service.lastLocale, 'ja');
    });

    testWidgets('should call getDocument with correct parameters for pricing/en', (tester) async {
      final service = _FakeLegalDocumentService(mockContent: '# Content');

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'pricing',
            locale: const Locale('en', ''),
            service: service,
          ),
        ),
      );

      // タイマーを処理するため、タイムアウトを長くする
      await tester.pumpAndSettle(const Duration(seconds: 5));

      expect(service.getDocumentCalled, isTrue);
      expect(service.lastDocumentType, 'pricing');
      expect(service.lastLocale, 'en');
    });

    testWidgets('should have back button in AppBar', (tester) async {
      const mockContent = '# Content';
      final service = _FakeLegalDocumentService(mockContent: mockContent);

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'terms',
            locale: const Locale('ja', ''),
            service: service,
          ),
        ),
      );

      // タイマーを処理するため、タイムアウトを長くする
      await tester.pumpAndSettle(const Duration(seconds: 5));

      // AppBarに戻るボタンがあることを確認
      final appBar = tester.widget<AppBar>(find.byType(AppBar));
      expect(appBar.leading, isNotNull);
    });

    testWidgets('should display retry button when error occurs', (tester) async {
      final service = _FakeLegalDocumentService(
        mockError: Exception('Network error'),
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'privacy',
            locale: const Locale('en', ''),
            service: service,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // リトライボタンが表示されることを確認（英語環境では「Retry」）
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('should retry loading document when retry button is tapped', (tester) async {
      // getDocumentをオーバーライドして呼び出し回数をカウント
      final serviceWithCounter = _FakeLegalDocumentServiceWithCounter(
        initialError: Exception('Network error'),
        successContent: '# Content',
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'terms',
            locale: const Locale('ja', ''),
            service: serviceWithCounter,
          ),
        ),
      );

      // タイマーを処理するため、タイムアウトを長くする
      await tester.pumpAndSettle(const Duration(seconds: 5));

      // 最初のエラーが表示されることを確認（日本語環境では「再試行」）
      expect(find.text('再試行'), findsOneWidget);
      expect(serviceWithCounter.callCount, 1);

      // リトライボタンをタップ
      await tester.tap(find.text('再試行'));
      // タイマーを処理するため、タイムアウトを長くする
      await tester.pumpAndSettle(const Duration(seconds: 5));

      // 2回目の呼び出しが行われたことを確認
      expect(serviceWithCounter.callCount, 2);
    });

    testWidgets('should display correct title for different document types', (tester) async {
      const testCases = [
        {'type': 'terms', 'locale': 'ja', 'expected': '利用規約'},
        {'type': 'terms', 'locale': 'en', 'expected': 'Terms of Service'},
        {'type': 'privacy', 'locale': 'ja', 'expected': 'プライバシーポリシー'},
        {'type': 'privacy', 'locale': 'en', 'expected': 'Privacy Policy'},
        {'type': 'commercial', 'locale': 'ja', 'expected': '特定商取引法に基づく表記'},
        {'type': 'pricing', 'locale': 'en', 'expected': 'Pricing / Billing'},
      ];

      for (final testCase in testCases) {
        final documentType = testCase['type'] as String;
        final localeCode = testCase['locale'] as String;
        final expectedTitle = testCase['expected'] as String;
        final service = _FakeLegalDocumentService(mockContent: '# Content');

        await tester.pumpWidget(
          MaterialApp(
            locale: Locale(localeCode, ''),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [
              Locale('ja', ''),
              Locale('en', ''),
            ],
            home: LegalDocumentScreen(
              documentType: documentType,
              locale: Locale(localeCode, ''),
              service: service,
            ),
          ),
        );

        // タイマーを処理するため、タイムアウトを長くする
        await tester.pumpAndSettle(const Duration(seconds: 5));

        // タイトルが正しく表示されることを確認
        expect(find.text(expectedTitle), findsOneWidget);
        tester.binding.window.clearPhysicalSizeTestValue();
      }
    });

    testWidgets('should show SnackBar when error occurs', (tester) async {
      final service = _FakeLegalDocumentService(
        mockError: Exception('Document not found'),
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en', ''),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: LegalDocumentScreen(
            documentType: 'privacy',
            locale: const Locale('en', ''),
            service: service,
          ),
        ),
      );

      // タイマーを処理するため、タイムアウトを長くする
      await tester.pumpAndSettle(const Duration(seconds: 5));

      // SnackBarが表示されることを確認
      expect(find.byType(SnackBar), findsOneWidget);
      // 英語環境では「Error」が表示される
      expect(find.textContaining('Error'), findsWidgets);
    });

  });
}

// リトライ機能のテスト用のカウンター付きFakeサービス
class _FakeLegalDocumentServiceWithCounter extends LegalDocumentService {
  final Exception? initialError;
  final String? successContent;
  int callCount = 0;

  _FakeLegalDocumentServiceWithCounter({
    this.initialError,
    this.successContent,
  });

  @override
  Future<String> getDocument(String documentType, String locale) async {
    callCount++;
    if (callCount == 1 && initialError != null) {
      throw initialError!;
    }
    if (successContent != null) {
      return successContent!;
    }
    throw Exception('Document not found');
  }

  @override
  Future<String> getDocumentMetadata(String documentType, String locale) async {
    return '2024-01-01T00:00:00.000Z';
  }
}

// 遅延するサービス（ローディング状態のテスト用）
// Completerを使用してタイマーを回避
class _DelayedLegalDocumentService extends LegalDocumentService {
  final Completer<String> _completer = Completer<String>();
  final String? mockContent;
  bool getDocumentCalled = false;
  String? lastDocumentType;
  String? lastLocale;

  _DelayedLegalDocumentService({
    this.mockContent,
  });

  void complete() {
    if (!_completer.isCompleted) {
      if (mockContent != null) {
        _completer.complete(mockContent!);
      } else {
        _completer.completeError(Exception('Document not found'));
      }
    }
  }

  @override
  Future<String> getDocument(String documentType, String locale) async {
    getDocumentCalled = true;
    lastDocumentType = documentType;
    lastLocale = locale;
    // Completerを使用してタイマーを回避
    return _completer.future;
  }

  @override
  Future<String> getDocumentMetadata(String documentType, String locale) async {
    return '2024-01-01T00:00:00.000Z';
  }
}

