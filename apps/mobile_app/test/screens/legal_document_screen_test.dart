/// Tests for LegalDocumentScreen
///
/// Tests for displaying legal documents from Firebase Storage

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:cloudinbox_mobile_app/screens/legal_document_screen.dart';
import 'package:cloudinbox_mobile_app/services/legal_document_service.dart';

// LegalDocumentServiceのモック
class _FakeLegalDocumentService extends LegalDocumentService {
  final String? mockContent;
  final Exception? mockError;
  bool getDocumentCalled = false;
  String? lastDocumentType;
  String? lastLocale;

  _FakeLegalDocumentService({this.mockContent, this.mockError});

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
}

void main() {
  group('LegalDocumentScreen', () {
    testWidgets('should display loading state initially', (tester) async {
      // 遅延するサービスを作成
      final service = _DelayedLegalDocumentService(
        delay: const Duration(seconds: 1),
        mockContent: '# Content',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: LegalDocumentScreen(
            documentType: 'terms',
            locale: const Locale('ja', ''),
            service: service,
          ),
        ),
      );

      // 初期状態ではローディングが表示される
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Loading...'), findsOneWidget);
    });

    testWidgets('should display document content when loaded', (tester) async {
      const mockContent = '# 利用規約\n\n本文...';
      final service = _FakeLegalDocumentService(mockContent: mockContent);

      await tester.pumpWidget(
        MaterialApp(
          home: LegalDocumentScreen(
            documentType: 'terms',
            locale: const Locale('ja', ''),
            service: service,
          ),
        ),
      );

      // 非同期処理を待つ
      await tester.pumpAndSettle();

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
          home: LegalDocumentScreen(
            documentType: 'privacy',
            locale: const Locale('en', ''),
            service: service,
          ),
        ),
      );

      // 非同期処理を待つ
      await tester.pumpAndSettle();

      expect(service.getDocumentCalled, isTrue);
      // エラーメッセージが表示されることを確認
      expect(find.textContaining('error'), findsWidgets);
    });

    testWidgets('should display correct title in AppBar', (tester) async {
      const mockContent = '# Content';
      final service = _FakeLegalDocumentService(mockContent: mockContent);

      await tester.pumpWidget(
        MaterialApp(
          home: LegalDocumentScreen(
            documentType: 'terms',
            locale: const Locale('ja', ''),
            service: service,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // AppBarにタイトルが表示されることを確認
      expect(find.byType(AppBar), findsOneWidget);
    });

    testWidgets('should call getDocument with correct parameters for different document types', (tester) async {
      const testCases = [
        {'type': 'terms', 'locale': 'ja'},
        {'type': 'privacy', 'locale': 'en'},
        {'type': 'commercial', 'locale': 'ja'},
        {'type': 'pricing', 'locale': 'en'},
      ];

      for (final testCase in testCases) {
        final documentType = testCase['type'] as String;
        final localeCode = testCase['locale'] as String;
        final service = _FakeLegalDocumentService(mockContent: '# Content');

        await tester.pumpWidget(
          MaterialApp(
            home: LegalDocumentScreen(
              documentType: documentType,
              locale: Locale(localeCode, ''),
              service: service,
            ),
          ),
        );

        await tester.pumpAndSettle();

        expect(service.lastDocumentType, documentType);
        expect(service.lastLocale, localeCode);
        // ウィジェットをクリーンアップ
        await tester.binding.delayed(const Duration(milliseconds: 100));
      }
    });

    testWidgets('should have back button in AppBar', (tester) async {
      const mockContent = '# Content';
      final service = _FakeLegalDocumentService(mockContent: mockContent);

      await tester.pumpWidget(
        MaterialApp(
          home: LegalDocumentScreen(
            documentType: 'terms',
            locale: const Locale('ja', ''),
            service: service,
          ),
        ),
      );

      await tester.pumpAndSettle();

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
          home: LegalDocumentScreen(
            documentType: 'privacy',
            locale: const Locale('en', ''),
            service: service,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // リトライボタンが表示されることを確認
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
          home: LegalDocumentScreen(
            documentType: 'terms',
            locale: const Locale('ja', ''),
            service: serviceWithCounter,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // 最初のエラーが表示されることを確認
      expect(find.text('Retry'), findsOneWidget);
      expect(serviceWithCounter.callCount, 1);

      // リトライボタンをタップ
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();

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
            home: LegalDocumentScreen(
              documentType: documentType,
              locale: Locale(localeCode, ''),
              service: service,
            ),
          ),
        );

        await tester.pumpAndSettle();

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
          home: LegalDocumentScreen(
            documentType: 'privacy',
            locale: const Locale('en', ''),
            service: service,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // SnackBarが表示されることを確認
      expect(find.byType(SnackBar), findsOneWidget);
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
}

// 遅延するサービス（ローディング状態のテスト用）
class _DelayedLegalDocumentService extends LegalDocumentService {
  final Duration delay;
  final String? mockContent;

  _DelayedLegalDocumentService({
    required this.delay,
    this.mockContent,
  });

  @override
  Future<String> getDocument(String documentType, String locale) async {
    await Future.delayed(delay);
    if (mockContent != null) {
      return mockContent!;
    }
    throw Exception('Document not found');
  }
}

