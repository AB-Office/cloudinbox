import 'package:cloudinbox_mobile_app/services/ad_service.dart';
import 'package:cloudinbox_mobile_app/widgets/navigation_drawer.dart' as app;
import 'package:cloudinbox_mobile_app/screens/settings_screen.dart';
import 'package:cloudinbox_mobile_app/screens/detail_screen.dart';
import 'package:cloudinbox_mobile_app/screens/compose_screen.dart';
import 'package:cloudinbox_mobile_app/screens/account_screen.dart';
import 'package:cloudinbox_mobile_app/main.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
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
  /// 最初のページを取得（リアルタイム更新を監視）
  Stream<InboxPage> watchFirstPage(int limit);
  /// 次のページを取得（手動読み込み）
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
    this.settingsRepository,
    this.onNavigate,
    this.currentRoute = '/inbox',
    this.composeRepository,
    this.accountRepository,
  });

  final InboxRepository repository;
  final AdService adService;
  final String? planId;
  final String title;
  final SettingsRepository? settingsRepository;
  final void Function(String route)? onNavigate;
  final String currentRoute;
  final MailComposeRepository? composeRepository;
  final AccountRepository? accountRepository;

  @override
  State<MailListScreen> createState() => _MailListScreenState();
}

class _MailListScreenState extends State<MailListScreen> {
  final List<InboxThread> _additionalThreads = []; // 追加読み込み分
  bool _isLoadingMore = false;
  bool _hasMoreAdditional = true; // 追加読み込み用のhasMore
  String? _errorMessage;

  static const int _defaultPageSize = 20;
  int? _pageSize;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_pageSize == null) {
      _pageSize = _calculatePageSize(context);
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

  Future<void> _onComposePressed() async {
    if (widget.composeRepository == null || widget.accountRepository == null) {
      return;
    }

    if (!mounted) return;

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ComposeScreen(
          repository: widget.composeRepository!,
          accountRepository: widget.accountRepository!,
        ),
      ),
    );
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !_hasMoreAdditional) return;
    setState(() {
      _isLoadingMore = true;
      _errorMessage = null;
    });
    try {
      final page =
          await widget.repository.loadNextPage(_pageSize ?? _defaultPageSize);
      setState(() {
        _additionalThreads.addAll(page.threads);
        _hasMoreAdditional = page.hasMore;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'error: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingMore = false;
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
      drawer: widget.settingsRepository != null && widget.onNavigate != null
          ? app.NavigationDrawer(
              settingsRepository: widget.settingsRepository!,
              currentRoute: widget.currentRoute,
              onNavigate: widget.onNavigate!,
            )
          : null,
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
            child: StreamBuilder<InboxPage>(
              stream: widget.repository.watchFirstPage(_pageSize ?? _defaultPageSize),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                
                if (snapshot.hasError) {
                  return Center(
                    child: Text(
                      'Error: ${snapshot.error}',
                      style: const TextStyle(color: Colors.red),
                    ),
                  );
                }
                
                final firstPageThreads = snapshot.data?.threads ?? [];
                final allThreads = [...firstPageThreads, ..._additionalThreads];
                
                if (allThreads.isEmpty) {
                  final locale = Localizations.localeOf(context);
                  return Center(
                    child: Text(
                      locale.languageCode == 'ja'
                          ? 'メールがありません'
                          : 'No mail',
                    ),
                  );
                }
                
                return ListView.separated(
                    itemCount: allThreads.length,
                    separatorBuilder: (context, index) => const Divider(
                      height: 1,
                      thickness: 1,
                    ),
                    itemBuilder: (context, index) {
                      final thread = allThreads[index];
                      // プレビューの改行をスペースに変換し、長い場合は省略
                      final previewText = thread.preview
                          .replaceAll('\r\n', ' ')
                          .replaceAll('\n', ' ')
                          .replaceAll('\r', ' ')
                          .trim();
                      
                      return ListTile(
                        title: Text(
                          thread.subject,
                          style: TextStyle(
                            fontWeight: thread.hasUnread ? FontWeight.bold : FontWeight.normal,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(
                          previewText,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        leading: Icon(
                          thread.hasUnread
                              ? Icons.mark_email_unread
                              : Icons.mark_email_read,
                        ),
                        trailing: Text(thread.lastMessageAt),
                        onTap: () async {
                          // スレッドから最新メッセージIDを取得
                          final user = FirebaseAuth.instance.currentUser;
                          if (user == null) return;

                          try {
                            final threadDoc = await FirebaseFirestore.instance
                                .collection('users')
                                .doc(user.uid)
                                .collection('mailThreads')
                                .doc(thread.id)
                                .get();

                            if (!threadDoc.exists) return;

                            final threadData = threadDoc.data() as Map<String, dynamic>;
                            final messageId = threadData['latestMessageId'] as String?;
                            
                            if (messageId == null) return;

                            // DetailScreenに遷移
                            final detailRepository = FirebaseDetailRepository();
                            if (context.mounted) {
                              await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => DetailScreen(
                                    messageId: messageId,
                                    repository: detailRepository,
                                    planId: widget.planId,
                                  ),
                                ),
                              );
                              // StreamBuilderが自動的に更新を反映するため、再読み込みは不要
                            }
                          } catch (e) {
                            debugPrint('Error navigating to detail: $e');
                          }
                        },
                      );
                    },
                  );
              },
            ),
          ),
          StreamBuilder<InboxPage>(
            stream: widget.repository.watchFirstPage(_pageSize ?? _defaultPageSize),
            builder: (context, snapshot) {
              final firstPageHasMore = snapshot.data?.hasMore ?? false;
              final hasMore = firstPageHasMore || _hasMoreAdditional;
              if (!hasMore) {
                return const SizedBox.shrink();
              }
              return Padding(
                padding: const EdgeInsets.all(8.0),
                child: ElevatedButton(
                  key: const Key('button_load_more'),
                  onPressed: _isLoadingMore ? null : _loadMore,
                  child: _isLoadingMore
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(Localizations.localeOf(context).languageCode == 'ja'
                          ? 'もっと見る'
                          : 'Load more'),
                ),
              );
            },
          ),
          if (adBanner != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
              child: adBanner,
            ),
        ],
      ),
      floatingActionButton: (widget.composeRepository != null &&
              widget.accountRepository != null)
          ? FloatingActionButton(
              onPressed: _onComposePressed,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}


