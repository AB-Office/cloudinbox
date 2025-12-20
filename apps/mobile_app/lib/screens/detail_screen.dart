import 'package:cloudinbox_mobile_app/services/ad_service.dart';
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
  });

  final String id;
  final String subject;
  final String from;
  final List<String> to;
  final String sentAt;
  final String bodyText;
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
  });

  final String messageId;
  final MailDetailRepository repository;
  final AdService adService;
  final String? planId;

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
                    IconButton(
                      key: const Key('button_move_to_trash'),
                      onPressed: _handleMoveToTrash,
                      icon: const Icon(Icons.delete),
                      tooltip: 'ゴミ箱に移動',
                    ),
                    IconButton(
                      key: const Key('button_archive'),
                      onPressed: _handleArchive,
                      icon: const Icon(Icons.archive),
                      tooltip: 'アーカイブ',
                    ),
                    IconButton(
                      key: const Key('button_restore_from_trash'),
                      onPressed: _handleRestoreFromTrash,
                      icon: const Icon(Icons.restore),
                      tooltip: 'ゴミ箱から復元',
                    ),
                    IconButton(
                      key: const Key('button_unarchive'),
                      onPressed: _handleUnarchive,
                      icon: const Icon(Icons.unarchive),
                      tooltip: 'アーカイブから復元',
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


