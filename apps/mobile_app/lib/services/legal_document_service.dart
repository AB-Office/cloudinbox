/// Legal Document Service
///
/// Service for fetching legal documents (terms, privacy policy, etc.) from Firebase Storage

import 'dart:convert';
import 'package:firebase_storage/firebase_storage.dart';

/// Legal Document Service
///
/// Provides methods to fetch legal documents from Firebase Storage
class LegalDocumentService {
  /// Get legal document from Firebase Storage
  ///
  /// [documentType] Type of document (terms, privacy, commercial, pricing)
  /// [locale] Language locale (ja, en)
  /// Returns the Markdown content of the document
  /// Throws [Exception] if document cannot be fetched (file not found, network error, etc.)
  Future<String> getDocument(String documentType, String locale) async {
    final storage = FirebaseStorage.instance;
    final path = 'legal-docs/${documentType}_${locale}.md';
    final ref = storage.ref(path);

    try {
      final data = await ref.getData();
      if (data == null) {
        throw Exception('Document not found: $path');
      }
      return utf8.decode(data);
    } on FirebaseException catch (e) {
      // Firebase Storageのエラーを処理
      if (e.code == 'object-not-found') {
        throw Exception('Document not found: $path');
      } else if (e.code == 'unauthorized') {
        throw Exception('Unauthorized: Authentication required');
      } else if (e.code == 'canceled') {
        throw Exception('Request canceled');
      } else {
        throw Exception('Failed to fetch document: ${e.message}');
      }
    } catch (e) {
      // その他のエラー（ネットワークエラーなど）
      if (e is Exception) {
        rethrow;
      }
      throw Exception('Failed to fetch document: $e');
    }
  }
}

