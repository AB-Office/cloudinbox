import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:cloudinbox_mobile_app/services/legal_document_service.dart';
import 'package:cloudinbox_mobile_app/l10n/app_localizations.dart';

/// Legal Document Screen
///
/// Screen for displaying legal documents (terms, privacy policy, etc.) from Firebase Storage
class LegalDocumentScreen extends StatefulWidget {
  const LegalDocumentScreen({
    super.key,
    required this.documentType,
    required this.locale,
    this.service,
    this.onReadComplete,
  });

  final String documentType; // 'terms', 'privacy', 'commercial', 'pricing'
  final Locale locale;
  final LegalDocumentService? service;
  final VoidCallback? onReadComplete; // 全文を読んだときに呼ばれるコールバック

  @override
  State<LegalDocumentScreen> createState() => _LegalDocumentScreenState();
}

class _LegalDocumentScreenState extends State<LegalDocumentScreen> {
  String? _content;
  bool _loading = true;
  String? _error;
  late final LegalDocumentService _service;
  final ScrollController _scrollController = ScrollController();
  bool _hasScrolledToBottom = false;

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? LegalDocumentService();
    _scrollController.addListener(_checkScrollPosition);
    _loadDocument();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_checkScrollPosition);
    _scrollController.dispose();
    super.dispose();
  }

  /// スクロール位置をチェックして、最後までスクロールしたかどうかを判定
  void _checkScrollPosition() {
    if (!_scrollController.hasClients) {
      return;
    }

    try {
      final position = _scrollController.position;
      if (!position.hasContentDimensions) {
        return;
      }

      final threshold = 100.0; // 100pxの閾値（最後までスクロールしたとみなす）

      // コンテンツが短くてスクロール不要な場合も有効化
      if (position.maxScrollExtent <= 0) {
        if (!_hasScrolledToBottom) {
          setState(() {
            _hasScrolledToBottom = true;
          });
        }
        return;
      }

      // 最後までスクロールしたかどうかを判定
      final isAtBottom = position.pixels + position.viewportDimension >= position.maxScrollExtent - threshold;

      if (isAtBottom != _hasScrolledToBottom) {
        setState(() {
          _hasScrolledToBottom = isAtBottom;
        });
      }
    } catch (e) {
      // スクロール位置の取得に失敗した場合は無視
      debugPrint('Error checking scroll position: $e');
    }
  }

  /// タイトルを取得
  String _getTitle(AppLocalizations? localizations) {
    switch (widget.documentType) {
      case 'terms':
        return localizations?.termsOfService ?? '利用規約';
      case 'privacy':
        return localizations?.privacyPolicy ?? 'プライバシーポリシー';
      case 'commercial':
      case 'pricing':
        return localizations?.pricingBilling ?? '特定商取引法に基づく表記';
      default:
        return 'Legal Document';
    }
  }

  /// Storageから法的文書を取得
  Future<void> _loadDocument() async {
    setState(() {
      _loading = true;
      _error = null;
      _content = null;
    });

    try {
      debugPrint('Loading document: ${widget.documentType}_${widget.locale.languageCode}.md');
      final content = await _service.getDocument(
        widget.documentType,
        widget.locale.languageCode,
      );
      debugPrint('Document loaded successfully, length: ${content.length}');
      
      if (mounted) {
        setState(() {
          _content = content;
          _loading = false;
          _hasScrolledToBottom = false; // リセット
        });
        // DOM更新を待ってからスクロール位置をチェック
        WidgetsBinding.instance.addPostFrameCallback((_) {
          // 複数回チェックして確実に検出
          Future.delayed(const Duration(milliseconds: 100), () {
            if (mounted) {
              _checkScrollPosition();
            }
          });
          Future.delayed(const Duration(milliseconds: 300), () {
            if (mounted) {
              _checkScrollPosition();
            }
          });
        });
      }
    } catch (e, stackTrace) {
      debugPrint('Error loading document: $e');
      debugPrint('Stack trace: $stackTrace');
      
      if (mounted) {
        final errorMessage = e.toString();
        setState(() {
          _error = errorMessage;
          _loading = false;
        });
        // SnackBarでエラーメッセージを表示
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $errorMessage'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(_getTitle(localizations)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    final localizations = AppLocalizations.of(context);
    if (_loading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(localizations?.loading ?? 'Loading...'),
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
              localizations?.error ?? 'Error',
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
              child: Text(localizations?.retry ?? 'Retry'),
            ),
          ],
        ),
      );
    }

    if (_content != null) {
      return Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              padding: const EdgeInsets.all(16.0),
              child: MarkdownBody(
                data: _content!,
                styleSheet: MarkdownStyleSheet(
                  p: const TextStyle(fontSize: 16, height: 1.6),
                  h1: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  h2: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  h3: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ),
          if (widget.onReadComplete != null)
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 4,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _hasScrolledToBottom
                      ? () {
                          widget.onReadComplete?.call();
                          Navigator.of(context).pop();
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16.0),
                  ),
                  child: Text(
                    localizations?.legalDocumentReadComplete ?? '全文を読んだ',
                    style: const TextStyle(fontSize: 16.0),
                  ),
                ),
              ),
            ),
        ],
      );
    }

    return Center(
      child: Text(localizations?.noContentAvailable ?? 'No content available'),
    );
  }
}

