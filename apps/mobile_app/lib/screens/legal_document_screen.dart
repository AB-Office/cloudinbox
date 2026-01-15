import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:cloudinbox_mobile_app/services/legal_document_service.dart';

/// Legal Document Screen
///
/// Screen for displaying legal documents (terms, privacy policy, etc.) from Firebase Storage
class LegalDocumentScreen extends StatefulWidget {
  const LegalDocumentScreen({
    super.key,
    required this.documentType,
    required this.locale,
    this.service,
  });

  final String documentType; // 'terms', 'privacy', 'commercial', 'pricing'
  final Locale locale;
  final LegalDocumentService? service;

  @override
  State<LegalDocumentScreen> createState() => _LegalDocumentScreenState();
}

class _LegalDocumentScreenState extends State<LegalDocumentScreen> {
  String? _content;
  bool _loading = true;
  String? _error;
  late final LegalDocumentService _service;

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? LegalDocumentService();
    _loadDocument();
  }

  /// タイトルを取得
  String _getTitle() {
    final titles = <String, Map<String, String>>{
      'terms': {
        'ja': '利用規約',
        'en': 'Terms of Service',
      },
      'privacy': {
        'ja': 'プライバシーポリシー',
        'en': 'Privacy Policy',
      },
      'commercial': {
        'ja': '特定商取引法に基づく表記',
        'en': 'Commercial Transaction',
      },
      'pricing': {
        'ja': 'Pricing / Billing',
        'en': 'Pricing / Billing',
      },
    };

    return titles[widget.documentType]?[widget.locale.languageCode] ??
        'Legal Document';
  }

  /// Storageから法的文書を取得
  Future<void> _loadDocument() async {
    setState(() {
      _loading = true;
      _error = null;
      _content = null;
    });

    try {
      final content = await _service.getDocument(
        widget.documentType,
        widget.locale.languageCode,
      );
      if (mounted) {
        setState(() {
          _content = content;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
        // SnackBarでエラーメッセージを表示
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_getTitle()),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Loading...'),
          ],
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.red,
            ),
            const SizedBox(height: 16),
            Text(
              'Error',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                _error!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadDocument,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_content != null) {
      return Markdown(
        data: _content!,
        styleSheet: MarkdownStyleSheet(
          p: const TextStyle(fontSize: 16, height: 1.6),
          h1: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          h2: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          h3: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
      );
    }

    return const Center(
      child: Text('No content available'),
    );
  }
}

