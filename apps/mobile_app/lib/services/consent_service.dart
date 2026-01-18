/// Consent Service
///
/// Service for managing legal consent status

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloudinbox_mobile_app/services/legal_document_service.dart';

/// 法的文書の同意情報の型定義
class LegalConsents {
  final ConsentInfo? terms;
  final ConsentInfo? privacy;

  LegalConsents({this.terms, this.privacy});

  factory LegalConsents.fromMap(Map<String, dynamic>? map) {
    if (map == null) {
      return LegalConsents();
    }
    return LegalConsents(
      terms: map['terms'] != null ? ConsentInfo.fromMap(map['terms']) : null,
      privacy: map['privacy'] != null ? ConsentInfo.fromMap(map['privacy']) : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      if (terms != null) 'terms': terms!.toMap(),
      if (privacy != null) 'privacy': privacy!.toMap(),
    };
  }
}

/// 同意情報の型定義
class ConsentInfo {
  final DateTime consentedAt;
  final String documentVersion; // ISO 8601形式の更新日時

  ConsentInfo({required this.consentedAt, required this.documentVersion});

  factory ConsentInfo.fromMap(Map<String, dynamic> map) {
    return ConsentInfo(
      consentedAt: (map['consentedAt'] as Timestamp).toDate(),
      documentVersion: map['documentVersion'] as String,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'consentedAt': Timestamp.fromDate(consentedAt),
      'documentVersion': documentVersion,
    };
  }
}

/// Consent Service
///
/// Provides methods to manage legal consent status
class ConsentService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final LegalDocumentService _documentService = LegalDocumentService();

  /// 現在のロケールを取得する（デフォルトは'ja'）
  String _getCurrentLocale() {
    // 簡易版: デフォルトで'ja'を返す
    // より正確な実装が必要な場合は、i18n設定やSharedPreferencesから取得、
    // または呼び出し側からロケールをパラメータとして渡す
    // 現時点では、日本語と英語の法的文書が存在するため、デフォルトで'ja'を使用
    // 将来的には、ユーザー設定やアプリのロケール設定から取得することを検討
    return 'ja';
  }

  /// ISO 8601形式の文字列を比較する
  /// [version1] > [version2] の場合 true
  bool _compareVersions(String version1, String version2) {
    return version1.compareTo(version2) > 0;
  }

  /// ユーザーの同意情報を取得
  ///
  /// Returns the user's consent information, or null if not set
  Future<LegalConsents?> getConsents() async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final userDoc = await _firestore.collection('users').doc(user.uid).get();
      if (!userDoc.exists) {
        return null;
      }

      final data = userDoc.data();
      final legalConsents = data?['legalConsents'] as Map<String, dynamic>?;

      if (legalConsents == null) {
        return null;
      }

      return LegalConsents.fromMap(legalConsents);
    } catch (e) {
      throw Exception('Failed to get consents: $e');
    }
  }

  /// 同意が必要かどうかを判定
  ///
  /// Returns true if consent is required (no consent or document updated)
  Future<bool> isConsentRequired() async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      // ユーザードキュメントからlegalConsentsを取得
      final consents = await getConsents();

      // 同意がない場合は同意が必要
      if (consents == null || consents.terms == null || consents.privacy == null) {
        return true;
      }

      // Storageから法的文書のメタデータを取得
      final locale = _getCurrentLocale();
      String termsVersion;
      String privacyVersion;

      try {
        termsVersion = await _documentService.getDocumentMetadata('terms', locale);
        privacyVersion = await _documentService.getDocumentMetadata('privacy', locale);
      } catch (e) {
        // メタデータ取得エラー: 既存の同意があればそれを尊重
        // デバッグ用のログを出力
        print('Warning: Failed to fetch document metadata: $e');
        return false;
      }

      // バージョン比較
      final termsNeedsUpdate = _compareVersions(termsVersion, consents.terms!.documentVersion);
      final privacyNeedsUpdate = _compareVersions(privacyVersion, consents.privacy!.documentVersion);

      return termsNeedsUpdate || privacyNeedsUpdate;
    } catch (e) {
      throw Exception('Failed to check consent status: $e');
    }
  }

  /// 同意を保存
  ///
  /// [termsVersion] Terms of service version (ISO 8601 format)
  /// [privacyVersion] Privacy policy version (ISO 8601 format)
  Future<void> saveConsent(String termsVersion, String privacyVersion) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final now = DateTime.now();
      final newConsents = LegalConsents(
        terms: ConsentInfo(consentedAt: now, documentVersion: termsVersion),
        privacy: ConsentInfo(consentedAt: now, documentVersion: privacyVersion),
      );

      await _firestore.collection('users').doc(user.uid).update({
        'legalConsents': newConsents.toMap(),
        'updatedAt': Timestamp.now(),
      });
    } catch (e) {
      throw Exception('Failed to save consent: $e');
    }
  }
}

