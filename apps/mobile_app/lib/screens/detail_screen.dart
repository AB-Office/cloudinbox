import 'package:cloudinbox_mobile_app/services/ad_service.dart';
import 'package:cloudinbox_mobile_app/screens/compose_screen.dart';
import 'package:cloudinbox_mobile_app/screens/account_screen.dart';
import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:flutter/material.dart';

/// メール本文を含むメッセージ詳細
class MailMessageDetail {
  const MailMessageDetail({
    required this.id,
    required this.subject,
    required this.from,
    required this.to,
    required this.sentAt,
    required this.bodyText,
    this.cc = const [],
    this.bcc = const [],
    this.threadId,
  });

  final String id;
  final String subject;
  final String from;
  final List<String> to;
  final List<String> cc;
  final List<String> bcc;
  final String sentAt;
  final String bodyText;
  final String? threadId;
}

/// メール詳細取得用リポジトリ抽象
abstract class MailDetailRepository {
  Future<MailMessageDetail> loadMessage(String messageId);
  Future<void> moveToTrash(String messageId);
  Future<void> archive(String messageId);
  Future<void> restoreFromTrash(String messageId);
  Future<void> unarchive(String messageId);
}

class DetailScreen extends StatefulWidget {
  const DetailScreen({
    super.key,
    required this.messageId,
    required this.repository,
    this.adService = const AdService(),
    this.planId,
    this.composeRepository,
    this.accountRepository,
  });

  final String messageId;
  final MailDetailRepository repository;
  final AdService adService;
  final String? planId;
  final MailComposeRepository? composeRepository;
  final AccountRepository? accountRepository;

  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  MailMessageDetail? _message;
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _handleMoveToTrash() async {
    if (_message == null) return;
    await widget.repository.moveToTrash(_message!.id);
  }

  Future<void> _handleArchive() async {
    if (_message == null) return;
    await widget.repository.archive(_message!.id);
  }

  Future<void> _handleRestoreFromTrash() async {
    if (_message == null) return;
    await widget.repository.restoreFromTrash(_message!.id);
  }

  Future<void> _handleUnarchive() async {
    if (_message == null) return;
    await widget.repository.unarchive(_message!.id);
  }

  Future<void> _handleReply() async {
    if (_message == null ||
        widget.composeRepository == null ||
        widget.accountRepository == null) {
      return;
    }

    if (!mounted) return;

    final intent = ComposeIntent(
      type: ComposeType.reply,
      threadId: _message!.threadId,
      replyTo: _message!.from,
      subject: _message!.subject,
      body: _message!.bodyText,
    );

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ComposeScreen(
          repository: widget.composeRepository!,
          accountRepository: widget.accountRepository!,
          intent: intent,
        ),
      ),
    );
  }

  Future<void> _handleReplyAll() async {
    if (_message == null ||
        widget.composeRepository == null ||
        widget.accountRepository == null) {
      return;
    }

    if (!mounted) return;

    // 送信者とCc受信者を結合（重複を避ける）
    final allRecipients = <String>[
      _message!.from,
      ..._message!.to,
      ..._message!.cc,
    ];
    // 自分のアドレス（利用可能であれば取得、未取得時は空で処理）
    final selfEmails = <String>{
      // 将来的に選択アカウントのメールやログインユーザーのメールを入れる
      // 例: selectedAccountEmail ?? ''
    };
    final uniqueReplyToAll = allRecipients
      .where((e) => e.isNotEmpty)
      .toSet()
      .difference(selfEmails)
      .toList();

    final intent = ComposeIntent(
      type: ComposeType.replyAll,
      threadId: _message!.threadId,
      replyToAll: uniqueReplyToAll,
      subject: _message!.subject,
      body: _message!.bodyText,
    );

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ComposeScreen(
          repository: widget.composeRepository!,
          accountRepository: widget.accountRepository!,
          intent: intent,
        ),
      ),
    );
  }

  Future<void> _handleForward() async {
    if (_message == null ||
        widget.composeRepository == null ||
        widget.accountRepository == null) {
      return;
    }

    if (!mounted) return;

    final intent = ComposeIntent(
      type: ComposeType.forward,
      threadId: _message!.threadId,
      subject: _message!.subject,
      body: _message!.bodyText,
    );

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ComposeScreen(
          repository: widget.composeRepository!,
          accountRepository: widget.accountRepository!,
          intent: intent,
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final message = await widget.repository.loadMessage(widget.messageId);
      setState(() {
        _message = message;
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
        title: Text(_message?.subject ?? 'Mail Detail'),
      ),
      bottomNavigationBar: _message == null
          ? null
          : Container(
              padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
              decoration: BoxDecoration(
                color: Theme.of(context).scaffoldBackgroundColor,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 4.0,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: SafeArea(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    if (widget.composeRepository != null &&
                        widget.accountRepository != null) ...[
                      IconButton(
                        key: const Key('button_reply'),
                        onPressed: _handleReply,
                        icon: const Icon(Icons.reply),
                        tooltip: I18nService.translateReply(
                          Localizations.localeOf(context),
                        ),
                      ),
                      IconButton(
                        key: const Key('button_reply_all'),
                        onPressed: _handleReplyAll,
                        icon: const Icon(Icons.reply_all),
                        tooltip: I18nService.translateReplyAll(
                          Localizations.localeOf(context),
                        ),
                      ),
                      IconButton(
                        key: const Key('button_forward'),
                        onPressed: _handleForward,
                        icon: const Icon(Icons.forward),
                        tooltip: I18nService.translateForward(
                          Localizations.localeOf(context),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    IconButton(
                      key: const Key('button_move_to_trash'),
                      onPressed: _handleMoveToTrash,
                      icon: const Icon(Icons.delete),
                      tooltip: I18nService.translateMoveToTrash(
                        Localizations.localeOf(context),
                      ),
                    ),
                    IconButton(
                      key: const Key('button_archive'),
                      onPressed: _handleArchive,
                      icon: const Icon(Icons.archive),
                      tooltip: I18nService.translateArchive(
                        Localizations.localeOf(context),
                      ),
                    ),
                    IconButton(
                      key: const Key('button_restore_from_trash'),
                      onPressed: _handleRestoreFromTrash,
                      icon: const Icon(Icons.restore),
                      tooltip: I18nService.translateRestoreFromTrash(
                        Localizations.localeOf(context),
                      ),
                    ),
                    IconButton(
                      key: const Key('button_unarchive'),
                      onPressed: _handleUnarchive,
                      icon: const Icon(Icons.unarchive),
                      tooltip: I18nService.translateUnarchive(
                        Localizations.localeOf(context),
                      ),
                    ),
                  ],
                ),
              ),
            ),
      body: _isLoading && _message == null
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.red),
                  ),
                )
              : _message == null
                  ? const SizedBox.shrink()
                  : Column(
                      children: [
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _message!.subject,
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                                const SizedBox(height: 8),
                                Text('From: ${_message!.from}'),
                                Text('To: ${_message!.to.join(', ')}'),
                                Text('Date: ${_message!.sentAt}'),
                                const SizedBox(height: 16),
                                Expanded(
                                  child: _message!.bodyText.isEmpty
                                      ? const Center(
                                          child: Text(
                                            'メール本文がありません',
                                            style: TextStyle(color: Colors.grey),
                                          ),
                                        )
                                      : SingleChildScrollView(
                                          child: Padding(
                                            padding: const EdgeInsets.all(8.0),
                                            child: SelectableText(
                                              _message!.bodyText,
                                              style: const TextStyle(fontSize: 16),
                                            ),
                                          ),
                                        ),
                                ),
                              ],
                            ),
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


