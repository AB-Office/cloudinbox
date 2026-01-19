/// Tests for ConsentService
///
/// Tests for managing legal consent status

import 'package:flutter_test/flutter_test.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloudinbox_mobile_app/services/consent_service.dart';

void main() {
  group('ConsentService', () {
    group('getConsents', () {
      test('should have getConsents method that returns Future<LegalConsents?>', () {
        // 型チェックのみ（実際のFirebaseに接続しない）
        // 注意: ConsentServiceのコンストラクタでFirebaseインスタンスを取得するため、
        // Firebase Appが初期化されていない場合はエラーが発生します。
        // 実際の動作確認は統合テストで行います
        late ConsentService service;
        try {
          service = ConsentService();
        } catch (e) {
          // Firebase Appが初期化されていない場合は、テストをスキップ
          return;
        }
        final result = service.getConsents();
        expect(
          result,
          isA<Future<LegalConsents?>>(),
          reason: 'getConsents should return Future<LegalConsents?>',
        );
        // 実際のFirebaseに接続しないため、結果は使用しない（エラーを無視）
        result.catchError((_) {});
      }, skip: true); // Firebase Appの初期化が必要なため、スキップ
    });

    group('isConsentRequired', () {
      test('should have isConsentRequired method that returns Future<bool>', () {
        // 型チェックのみ（実際のFirebaseに接続しない）
        // 注意: ConsentServiceのコンストラクタでFirebaseインスタンスを取得するため、
        // Firebase Appが初期化されていない場合はエラーが発生します。
        // 実際の動作確認は統合テストで行います
        late ConsentService service;
        try {
          service = ConsentService();
        } catch (e) {
          // Firebase Appが初期化されていない場合は、テストをスキップ
          return;
        }
        final result = service.isConsentRequired();
        expect(
          result,
          isA<Future<bool>>(),
          reason: 'isConsentRequired should return Future<bool>',
        );
        // 実際のFirebaseに接続しないため、結果は使用しない（エラーを無視）
        result.catchError((_) {});
      }, skip: true); // Firebase Appの初期化が必要なため、スキップ
    });

    group('saveConsent', () {
      test('should have saveConsent method that returns Future<void>', () {
        const termsVersion = '2024-01-01T00:00:00.000Z';
        const privacyVersion = '2024-01-01T00:00:00.000Z';

        // 型チェックのみ（実際のFirebaseに接続しない）
        // 注意: ConsentServiceのコンストラクタでFirebaseインスタンスを取得するため、
        // Firebase Appが初期化されていない場合はエラーが発生します。
        // 実際の動作確認は統合テストで行います
        late ConsentService service;
        try {
          service = ConsentService();
        } catch (e) {
          // Firebase Appが初期化されていない場合は、テストをスキップ
          return;
        }
        final result = service.saveConsent(termsVersion, privacyVersion);
        expect(
          result,
          isA<Future<void>>(),
          reason: 'saveConsent should return Future<void>',
        );
        // 実際のFirebaseに接続しないため、結果は使用しない（エラーを無視）
        result.catchError((_) {});
      }, skip: true); // Firebase Appの初期化が必要なため、スキップ
    });

    group('version comparison', () {
      test('should compare ISO 8601 versions correctly', () {
        // バージョン比較のテスト
        // '2024-12-31T00:00:00.000Z' > '2024-01-01T00:00:00.000Z' は true
        const version1 = '2024-12-31T00:00:00.000Z';
        const version2 = '2024-01-01T00:00:00.000Z';

        expect(
          version1.compareTo(version2) > 0,
          isTrue,
          reason: 'version1 should be greater than version2',
        );

        // '2024-01-01T00:00:00.000Z' > '2024-12-31T00:00:00.000Z' は false
        expect(
          version2.compareTo(version1) > 0,
          isFalse,
          reason: 'version2 should not be greater than version1',
        );

        // 同じバージョンの比較
        expect(
          version1.compareTo(version1) > 0,
          isFalse,
          reason: 'Same versions should not be greater than each other',
        );
      });

      test('should handle different ISO 8601 formats', () {
        // 異なるISO 8601形式の比較
        const versions = [
          '2024-01-01T00:00:00.000Z',
          '2024-01-01T00:00:00.001Z',
          '2024-01-01T00:00:01.000Z',
          '2024-01-01T01:00:00.000Z',
          '2024-01-02T00:00:00.000Z',
          '2024-02-01T00:00:00.000Z',
          '2025-01-01T00:00:00.000Z',
        ];

        // 各バージョンが次のバージョンより小さいことを確認
        for (int i = 0; i < versions.length - 1; i++) {
          expect(
            versions[i].compareTo(versions[i + 1]) < 0,
            isTrue,
            reason: 'Version $i should be less than version ${i + 1}',
          );
        }
      });
    });

    group('LegalConsents serialization', () {
      test('should serialize and deserialize LegalConsents correctly', () {
        final now = DateTime.now();
        final consents = LegalConsents(
          terms: ConsentInfo(
            consentedAt: now,
            documentVersion: '2024-01-01T00:00:00.000Z',
          ),
          privacy: ConsentInfo(
            consentedAt: now,
            documentVersion: '2024-01-01T00:00:00.000Z',
          ),
        );

        final map = consents.toMap();
        final restored = LegalConsents.fromMap(map);

        expect(
          restored.terms?.documentVersion,
          consents.terms?.documentVersion,
          reason: 'Terms document version should be preserved',
        );
        expect(
          restored.privacy?.documentVersion,
          consents.privacy?.documentVersion,
          reason: 'Privacy document version should be preserved',
        );
      });

      test('should handle null legalConsents', () {
        final consents = LegalConsents.fromMap(null);

        expect(
          consents.terms,
          isNull,
          reason: 'Terms should be null when map is null',
        );
        expect(
          consents.privacy,
          isNull,
          reason: 'Privacy should be null when map is null',
        );
      });

      test('should handle partial legalConsents', () {
        final map = {
          'terms': {
            'consentedAt': Timestamp.now(),
            'documentVersion': '2024-01-01T00:00:00.000Z',
          },
        };
        final consents = LegalConsents.fromMap(map);

        expect(
          consents.terms,
          isNotNull,
          reason: 'Terms should not be null when present in map',
        );
        expect(
          consents.privacy,
          isNull,
          reason: 'Privacy should be null when not present in map',
        );
      });
    });

    group('ConsentInfo serialization', () {
      test('should serialize and deserialize ConsentInfo correctly', () {
        final now = DateTime.now();
        const version = '2024-01-01T00:00:00.000Z';
        final consentInfo = ConsentInfo(
          consentedAt: now,
          documentVersion: version,
        );

        final map = consentInfo.toMap();
        final restored = ConsentInfo.fromMap(map);

        expect(
          restored.documentVersion,
          version,
          reason: 'Document version should be preserved',
        );
        expect(
          restored.consentedAt,
          isA<DateTime>(),
          reason: 'ConsentedAt should be DateTime',
        );
      });
    });
  });
}

