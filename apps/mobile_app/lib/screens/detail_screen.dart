import 'dart:io';
import 'dart:typed_data';
import 'package:cloudinbox_mobile_app/services/ad_service.dart';
import 'package:cloudinbox_mobile_app/screens/compose_screen.dart';
import 'package:cloudinbox_mobile_app/screens/account_screen.dart';
import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// 添付ファイルリストアイテム
class AttachmentListItem {
  const AttachmentListItem({
    required this.filename,
    required this.size,
    required this.contentType,
  });

  final String filename;
  final int size;  // bytes
  final String contentType;
}

/// ダウンロードされた添付ファイル
class DownloadedAttachment {
  const DownloadedAttachment({
    required this.content,
    required this.filename,
    required this.contentType,
    required this.size,
  });

  final Uint8List content;
  final String filename;
  final String contentType;
  final int size;  // bytes
}

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
    this.sentAtDateTime, // 実日時（引用形式用）
  });

  final String id;
  final String subject;
  final String from;
  final List<String> to;
  final List<String> cc;
  final List<String> bcc;
  final String sentAt; // 表示用のフォーマット済み日時
  final String bodyText;
  final String? threadId;
  final DateTime? sentAtDateTime; // 実日時（引用形式用）
}

/// メール詳細取得用リポジトリ抽象
abstract class MailDetailRepository {
  Future<MailMessageDetail> loadMessage(String messageId);
  Future<List<AttachmentListItem>> getAttachmentsList(String messageId);
  Future<DownloadedAttachment> downloadAttachment(String messageId, String filename);
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
  List<AttachmentListItem> _attachments = [];
  bool _isLoading = false;
  String? _errorMessage;
  final Set<String> _downloadingFilenames = {};

  Future<void> _handleMoveToTrash() async {
    if (_message == null) return;
    try {
      setState(() => _isLoading = true);
      await widget.repository.moveToTrash(_message!.id);
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        final locale = Localizations.localeOf(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(I18nService.translateErrorOperationFailed(locale))),
        );
      }
      debugPrint('Error in _handleMoveToTrash: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleArchive() async {
    if (_message == null) return;
    try {
      await widget.repository.archive(_message!.id);
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      // エラーは既にrepositoryで処理されているため、ここでは画面を閉じない
      debugPrint('Error in _handleArchive: $e');
    }
  }

  Future<void> _handleRestoreFromTrash() async {
    if (_message == null) return;
    try {
      await widget.repository.restoreFromTrash(_message!.id);
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      // エラーは既にrepositoryで処理されているため、ここでは画面を閉じない
      debugPrint('Error in _handleRestoreFromTrash: $e');
    }
  }

  Future<void> _handleUnarchive() async {
    if (_message == null) return;
    try {
      await widget.repository.unarchive(_message!.id);
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      // エラーは既にrepositoryで処理されているため、ここでは画面を閉じない
      debugPrint('Error in _handleUnarchive: $e');
    }
  }

  /// メールアドレス文字列から実際のメールアドレス部分を抽出する
  /// 例: "表示名" <email@example.com> → email@example.com
  /// 例: email@example.com → email@example.com
  String _extractEmailAddress(String address) {
    // RFC 5322形式（"表示名" <email@example.com>）を処理
    final bracketMatch = RegExp(r'<([^>]+)>').firstMatch(address);
    if (bracketMatch != null) {
      return bracketMatch.group(1)!.trim();
    }
    
    // 通常のメールアドレス形式の場合はそのまま返す
    return address.trim();
  }

  /// 日時を実日時形式にフォーマットする（引用形式用）
  String _formatDateTimeForQuote(DateTime dateTime) {
    final year = dateTime.year;
    final month = dateTime.month.toString().padLeft(2, '0');
    final day = dateTime.day.toString().padLeft(2, '0');
    final hour = dateTime.hour.toString().padLeft(2, '0');
    final minute = dateTime.minute.toString().padLeft(2, '0');
    return '$year/$month/$day $hour:$minute';
  }

  /// 元のメール本文を引用形式に変換する
  String _formatQuotedBody(String from, String bodyText, DateTime? sentAtDateTime) {
    final emailAddress = _extractEmailAddress(from);
    final quotedBody = bodyText
        .split('\n')
        .map((line) => '> $line')
        .join('\n');
    
    // 実日時があればそれを使用、なければ現在時刻を同フォーマットで使用（フォールバック）
    final dateTimeStr = _formatDateTimeForQuote(sentAtDateTime ?? DateTime.now());
    
    // 引用の手前に空行を追加
    return '\n$dateTimeStr <$emailAddress>\n$quotedBody';
  }

  Future<void> _handleReply() async {
    if (_message == null ||
        widget.composeRepository == null ||
        widget.accountRepository == null) {
      return;
    }

    if (!mounted) return;

    // 元のメールを引用形式で本文に追加
    final quotedBody = _formatQuotedBody(
      _message!.from,
      _message!.bodyText,
      _message!.sentAtDateTime,
    );

    final intent = ComposeIntent(
      type: ComposeType.reply,
      threadId: _message!.threadId,
      replyTo: _message!.from,
      subject: _message!.subject,
      body: quotedBody,
      inReplyToMessageId: _message!.id, // In-Reply-Toヘッダー用
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

    // 元のメールを引用形式で本文に追加
    final quotedBody = _formatQuotedBody(
      _message!.from,
      _message!.bodyText,
      _message!.sentAtDateTime,
    );

    final intent = ComposeIntent(
      type: ComposeType.replyAll,
      threadId: _message!.threadId,
      replyToAll: uniqueReplyToAll,
      subject: _message!.subject,
      body: quotedBody,
      inReplyToMessageId: _message!.id, // In-Reply-Toヘッダー用
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

    // 添付ファイルをダウンロードして転送用の添付ファイルリストを作成
    List<AttachmentData> forwardAttachments = [];
    if (_attachments.isNotEmpty) {
      // ローディング表示（必要に応じて）
      setState(() {
        _isLoading = true;
      });

      try {
        for (final attachment in _attachments) {
          try {
            final downloaded = await widget.repository.downloadAttachment(
              _message!.id,
              attachment.filename,
            );
            forwardAttachments.add(
              AttachmentData(
                filename: downloaded.filename,
                content: downloaded.content,
                contentType: downloaded.contentType,
              ),
            );
          } catch (e) {
            // 個別の添付ファイルのダウンロードに失敗した場合はスキップ
            debugPrint('Failed to download attachment ${attachment.filename}: $e');
          }
        }
      } finally {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      }
    }

    if (!mounted) return;

    // 元のメールを引用形式で本文に追加
    final quotedBody = _formatQuotedBody(
      _message!.from,
      _message!.bodyText,
      _message!.sentAtDateTime,
    );

    final intent = ComposeIntent(
      type: ComposeType.forward,
      threadId: _message!.threadId,
      subject: _message!.subject,
      body: quotedBody,
      inReplyToMessageId: _message!.id, // In-Reply-Toヘッダー用
      attachments: forwardAttachments, // 転送時の添付ファイル
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
      final attachments = await widget.repository.getAttachmentsList(widget.messageId);
      setState(() {
        _message = message;
        _attachments = attachments;
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

  Icon _getAttachmentIcon(String contentType) {
    if (contentType.startsWith('image/')) {
      return const Icon(Icons.image);
    } else if (contentType.startsWith('video/')) {
      return const Icon(Icons.video_file);
    } else if (contentType.startsWith('audio/')) {
      return const Icon(Icons.audio_file);
    } else if (contentType == 'application/pdf') {
      return const Icon(Icons.picture_as_pdf);
    } else if (contentType.startsWith('text/')) {
      return const Icon(Icons.description);
    } else {
      return const Icon(Icons.attach_file);
    }
  }

  Future<void> _handleAttachmentTap(AttachmentListItem attachment) async {
    if (_message == null) return;
    if (_downloadingFilenames.contains(attachment.filename)) return;

    setState(() {
      _downloadingFilenames.add(attachment.filename);
      _errorMessage = null;
    });

    try {
      // ダウンロード
      final downloaded = await widget.repository.downloadAttachment(
        _message!.id,
        attachment.filename,
      );

      // 一時ファイルに保存
      final tempDir = await getTemporaryDirectory();
      final safeName = downloaded.filename.split(Platform.pathSeparator).last;
      final file = File('${tempDir.path}/$safeName');
      await file.writeAsBytes(downloaded.content);

      // 共有/保存
      if (!mounted) return;
      await Share.shareXFiles(
        [XFile(file.path)],
        subject: downloaded.filename,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'ファイルのダウンロードに失敗しました: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _downloadingFilenames.remove(attachment.filename);
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
        actions: [
          // 返信・転送機能が利用可能な場合のみケバブメニューを表示
          if (widget.composeRepository != null &&
              widget.accountRepository != null)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert),
              onSelected: (value) {
                switch (value) {
                  case 'reply':
                    _handleReply();
                    break;
                  case 'reply_all':
                    _handleReplyAll();
                    break;
                  case 'forward':
                    _handleForward();
                    break;
                }
              },
              itemBuilder: (BuildContext context) {
                final locale = Localizations.localeOf(context);
                final isEnabled = _message != null;

                return [
                  PopupMenuItem<String>(
                    value: 'reply',
                    enabled: isEnabled,
                    child: Row(
                      children: [
                        const Icon(Icons.reply),
                        const SizedBox(width: 8),
                        Text(I18nService.translateReply(locale)),
                      ],
                    ),
                  ),
                  PopupMenuItem<String>(
                    value: 'reply_all',
                    enabled: isEnabled,
                    child: Row(
                      children: [
                        const Icon(Icons.reply_all),
                        const SizedBox(width: 8),
                        Text(I18nService.translateReplyAll(locale)),
                      ],
                    ),
                  ),
                  PopupMenuItem<String>(
                    value: 'forward',
                    enabled: isEnabled,
                    child: Row(
                      children: [
                        const Icon(Icons.forward),
                        const SizedBox(width: 8),
                        Text(I18nService.translateForward(locale)),
                      ],
                    ),
                  ),
                ];
              },
            ),
        ],
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
                                // 添付ファイルリスト
                                if (_attachments.isNotEmpty) ...[
                                  Text(
                                    '添付ファイル',
                                    style: Theme.of(context).textTheme.titleMedium,
                                  ),
                                  const SizedBox(height: 8),
                                  ..._attachments.map((attachment) => ListTile(
                                        leading: _downloadingFilenames.contains(attachment.filename)
                                            ? const SizedBox(
                                                width: 24,
                                                height: 24,
                                                child: CircularProgressIndicator(strokeWidth: 2),
                                              )
                                            : _getAttachmentIcon(attachment.contentType),
                                        title: Text(attachment.filename),
                                        subtitle: Text(
                                          I18nService.formatBytes(attachment.size, context),
                                        ),
                                        dense: true,
                                        onTap: _downloadingFilenames.contains(attachment.filename)
                                            ? null
                                            : () => _handleAttachmentTap(attachment),
                                      )),
                                  const SizedBox(height: 16),
                                ],
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


