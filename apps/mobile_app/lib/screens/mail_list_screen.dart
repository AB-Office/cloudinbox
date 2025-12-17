import 'package:cloudinbox_mobile_app/services/ad_service.dart';
import 'package:flutter/material.dart';

/// メール一覧に表示するスレッド情報
class InboxThread {
  const InboxThread({
    required this.id,
    required this.subject,
    required this.from,
    required this.preview,
    required this.lastMessageAt,
    required this.hasUnread,
  });

  final String id;
  final String subject;
  final String from;
  final String preview;
  final String lastMessageAt;
  final bool hasUnread;
}

/// 1ページ分の結果
class InboxPage {
  const InboxPage({
    required this.threads,
    required this.hasMore,
  });

  final List<InboxThread> threads;
  final bool hasMore;
}

/// スレッド一覧取得の抽象リポジトリ（メール一覧共通画面用）
abstract class InboxRepository {
  Future<InboxPage> loadFirstPage(int limit);
  Future<InboxPage> loadNextPage(int limit);
}

/// メール一覧共通画面（受信トレイ／ゴミ箱／すべてのメールなどで再利用）
class MailListScreen extends StatefulWidget {
  const MailListScreen({
    super.key,
    required this.repository,
    this.adService = const AdService(),
    this.planId,
    this.title = 'Inbox',
  });

  final InboxRepository repository;
  final AdService adService;
  final String? planId;
  final String title;

  @override
  State<MailListScreen> createState() => _MailListScreenState();
}

class _MailListScreenState extends State<MailListScreen> {
  final List<InboxThread> _threads = [];
  bool _isLoading = false;
  bool _hasMore = true;
  String? _errorMessage;

  static const int _defaultPageSize = 20;
  int? _pageSize;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_pageSize == null) {
      _pageSize = _calculatePageSize(context);
      _loadFirstPage();
    }
  }

  int _calculatePageSize(BuildContext context) {
    final size = MediaQuery.of(context).size;
    const itemHeight = 72.0;
    const minItems = 10;
    const maxItems = 50;

    final estimated = (size.height / itemHeight).floor() + 3;
    return estimated.clamp(minItems, maxItems);
  }

  Future<void> _loadFirstPage() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final page =
          await widget.repository.loadFirstPage(_pageSize ?? _defaultPageSize);
      setState(() {
        _threads
          ..clear()
          ..addAll(page.threads);
        _hasMore = page.hasMore;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'error: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadMore() async {
    if (_isLoading || !_hasMore) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final page =
          await widget.repository.loadNextPage(_pageSize ?? _defaultPageSize);
      setState(() {
        _threads.addAll(page.threads);
        _hasMore = page.hasMore;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'error: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final adBanner = widget.adService.buildBanner(widget.planId);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Column(
        children: [
          if (_errorMessage != null)
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Text(
                _errorMessage!,
                style: const TextStyle(color: Colors.red),
              ),
            ),
          Expanded(
            child: _isLoading && _threads.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    itemCount: _threads.length,
                    itemBuilder: (context, index) {
                      final thread = _threads[index];
                      return ListTile(
                        title: Text(thread.subject),
                        subtitle: Text(thread.preview),
                        leading: Icon(
                          thread.hasUnread
                              ? Icons.mark_email_unread
                              : Icons.email,
                        ),
                        trailing: Text(thread.lastMessageAt),
                      );
                    },
                  ),
          ),
          if (_hasMore)
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: ElevatedButton(
                key: const Key('button_load_more'),
                onPressed: _isLoading ? null : _loadMore,
                child: const Text('Load more'),
              ),
            ),
          if (adBanner != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
              child: adBanner,
            ),
        ],
      ),
    );
  }
}


