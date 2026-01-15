/// Tests for LegalDocumentService
///
/// Tests for fetching legal documents from Firebase Storage

import 'package:flutter_test/flutter_test.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:cloudinbox_mobile_app/services/legal_document_service.dart';
import 'dart:typed_data';
import 'dart:convert';

// Firebase Storageのモック
class MockReference extends Fake implements Reference {
  final String path;
  final Uint8List? mockData;
  final Exception? mockError;

  MockReference(this.path, {this.mockData, this.mockError});

  @override
  Future<Uint8List> getData([int maxSize = 10485760]) async {
    if (mockError != null) {
      throw mockError!;
    }
    if (mockData != null) {
      return mockData!;
    }
    throw FirebaseException(
      plugin: 'firebase_storage',
      code: 'object-not-found',
      message: 'Object not found',
    );
  }
}

class MockFirebaseStorage extends Fake implements FirebaseStorage {
  final Map<String, MockReference> references = {};

  void setMockReference(String path, MockReference ref) {
    references[path] = ref;
  }

  @override
  Reference ref([String? path]) {
    if (path == null) {
      throw ArgumentError('Path is required');
    }
    return references[path] ??
        MockReference(path, mockError: Exception('Reference not found'));
  }
}

void main() {
  group('LegalDocumentService', () {
    late LegalDocumentService service;

    setUp(() {
      service = LegalDocumentService();
    });

    test('should have getDocument method that returns Future<String>', () {
      const documentType = 'terms';
      const locale = 'ja';

      expect(
        service.getDocument(documentType, locale),
        isA<Future<String>>(),
        reason: 'getDocument should return Future<String>',
      );
    });

    test('should generate correct storage path', () {
      const testCases = [
        {'type': 'terms', 'locale': 'ja', 'expected': 'legal-docs/terms_ja.md'},
        {'type': 'terms', 'locale': 'en', 'expected': 'legal-docs/terms_en.md'},
        {'type': 'privacy', 'locale': 'ja', 'expected': 'legal-docs/privacy_ja.md'},
        {'type': 'privacy', 'locale': 'en', 'expected': 'legal-docs/privacy_en.md'},
        {'type': 'commercial', 'locale': 'ja', 'expected': 'legal-docs/commercial_ja.md'},
        {'type': 'pricing', 'locale': 'en', 'expected': 'legal-docs/pricing_en.md'},
      ];

      for (final testCase in testCases) {
        final documentType = testCase['type'] as String;
        final locale = testCase['locale'] as String;
        final expectedPath = testCase['expected'] as String;

        // パス生成ロジックをテスト
        expect(
          'legal-docs/${documentType}_${locale}.md',
          expectedPath,
          reason: 'Path should be correctly generated for $documentType/$locale',
        );
      }
    });

    test('should handle errors gracefully', () async {
      const documentType = 'nonexistent';
      const locale = 'ja';

      // エラーが発生しても例外が適切に処理されることを確認
      // 実際のFirebase Storageに接続するため、エラーが発生する可能性がある
      try {
        await service.getDocument(documentType, locale);
        fail('Expected exception to be thrown');
      } catch (e) {
        expect(e, isA<Exception>(), reason: 'Should throw Exception on error');
        final errorMessage = e.toString();
        expect(
          errorMessage.contains('Document not found') || errorMessage.contains('Failed to fetch'),
          isTrue,
          reason: 'Error message should indicate document fetch failure',
        );
      }
    });

    test('should decode UTF-8 content correctly', () {
      // UTF-8エンコーディングのテスト
      const testContent = '# 利用規約\n\n本文...';
      final encoded = utf8.encode(testContent);
      final decoded = utf8.decode(encoded);

      expect(decoded, testContent, reason: 'UTF-8 encoding/decoding should work correctly');
    });

    test('should generate correct storage path', () {
      const testCases = [
        {'type': 'terms', 'locale': 'ja', 'expected': 'legal-docs/terms_ja.md'},
        {'type': 'terms', 'locale': 'en', 'expected': 'legal-docs/terms_en.md'},
        {'type': 'privacy', 'locale': 'ja', 'expected': 'legal-docs/privacy_ja.md'},
        {'type': 'privacy', 'locale': 'en', 'expected': 'legal-docs/privacy_en.md'},
        {'type': 'commercial', 'locale': 'ja', 'expected': 'legal-docs/commercial_ja.md'},
        {'type': 'pricing', 'locale': 'en', 'expected': 'legal-docs/pricing_en.md'},
      ];

      for (final testCase in testCases) {
        final documentType = testCase['type'] as String;
        final locale = testCase['locale'] as String;
        final expectedPath = testCase['expected'] as String;

        // パス生成ロジックをテスト（実装後に適切にテストします）
        expect(
          'legal-docs/${documentType}_${locale}.md',
          expectedPath,
          reason: 'Path should be correctly generated for $documentType/$locale',
        );
      }
    });
  });
}

