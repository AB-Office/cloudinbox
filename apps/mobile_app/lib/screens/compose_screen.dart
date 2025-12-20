import 'dart:typed_data';
import 'package:cloudinbox_mobile_app/screens/account_screen.dart';
import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:flutter/material.dart';

/// メール送信リクエスト
class SendMailRequest {
  const SendMailRequest({
    required this.accountId,
    required this.to,
    required this.subject,
    required this.body,
    this.cc = const [],
    this.bcc = const [],
    this.attachments = const [],
    this.threadId,
  });

  final String accountId;
  final List<String> to;
  final List<String> cc;
  final List<String> bcc;
  final String subject;
  final String body;
  final List<AttachmentData> attachments;
  final String? threadId;
}

/// 添付ファイルデータ
class AttachmentData {
  const AttachmentData({
    required this.filename,
    required this.content,
    this.contentType,
  });

  final String filename;
  final Uint8List content;
  final String? contentType;
}

/// メール送信レスポンス
class SendMailResponse {
  const SendMailResponse({
    required this.success,
    this.messageId,
    this.errorMessage,
  });

  final bool success;
  final String? messageId;
  final String? errorMessage;
}

/// メール作成用のリポジトリ抽象
abstract class MailComposeRepository {
  Future<List<MailAccount>> listAccounts();
  Future<SendMailResponse> sendMail(SendMailRequest request);
}

/// 返信・転送用のデータ
class ComposeIntent {
  const ComposeIntent({
    this.type = ComposeType.newMail,
    this.threadId,
    this.replyTo,
    this.replyToAll,
    this.subject,
    this.body,
  });

  final ComposeType type;
  final String? threadId;
  final String? replyTo; // 返信先（単一）
  final List<String>? replyToAll; // 返信先（全員に返信の場合）
  final String? subject;
  final String? body;

  static const ComposeIntent newMail = ComposeIntent();
}

enum ComposeType {
  newMail,
  reply,
  replyAll,
  forward,
}

/// メール作成画面
class ComposeScreen extends StatefulWidget {
  const ComposeScreen({
    super.key,
    required this.repository,
    required this.accountRepository,
    this.intent = ComposeIntent.newMail,
  });

  final MailComposeRepository repository;
  final AccountRepository accountRepository;
  final ComposeIntent intent;

  @override
  State<ComposeScreen> createState() => _ComposeScreenState();
}

class _ComposeScreenState extends State<ComposeScreen> {
  final _toController = TextEditingController();
  final _ccController = TextEditingController();
  final _bccController = TextEditingController();
  final _subjectController = TextEditingController();
  final _bodyController = TextEditingController();

  String? _selectedAccountId;
  List<MailAccount> _accounts = [];
  List<AttachmentData> _attachments = [];
  bool _isLoading = false;
  bool _isSending = false;
  String? _errorMessage;
  bool _showCcBcc = false;

  @override
  void initState() {
    super.initState();
    _loadAccounts();
    _initializeFromIntent();
  }

  Future<void> _loadAccounts() async {
    setState(() {
      _isLoading = true;
    });
    try {
      final accounts = await widget.accountRepository.listAccounts();
      if (mounted) {
        setState(() {
          _accounts = accounts;
          _selectedAccountId = accounts.isNotEmpty ? accounts.first.id : null;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to load accounts: $e';
        });
      }
    }
  }

  void _initializeFromIntent() {
    if (widget.intent.type == ComposeType.reply) {
      // 返信
      if (widget.intent.replyTo != null) {
        _toController.text = widget.intent.replyTo!;
      }
      if (widget.intent.subject != null) {
        _subjectController.text = widget.intent.subject!.startsWith('Re: ')
            ? widget.intent.subject!
            : 'Re: ${widget.intent.subject!}';
      }
    } else if (widget.intent.type == ComposeType.replyAll) {
      // 全員に返信
      if (widget.intent.replyToAll != null) {
        _toController.text = widget.intent.replyToAll!.join(', ');
      }
      if (widget.intent.subject != null) {
        _subjectController.text = widget.intent.subject!.startsWith('Re: ')
            ? widget.intent.subject!
            : 'Re: ${widget.intent.subject!}';
      }
    } else if (widget.intent.type == ComposeType.forward) {
      // 転送
      if (widget.intent.subject != null) {
        _subjectController.text = widget.intent.subject!.startsWith('Fw: ')
            ? widget.intent.subject!
            : 'Fw: ${widget.intent.subject!}';
      }
      if (widget.intent.body != null) {
        final locale = Localizations.localeOf(context);
        final prefix = locale.languageCode == 'ja'
            ? '-------- 転送メッセージ --------'
            : '-------- Forwarded Message --------';
        _bodyController.text = '\n\n$prefix\n${widget.intent.body!}';
      }
    }
  }

  Future<void> _onSendPressed() async {
    // 入力検証
    final locale = Localizations.localeOf(context);
    final toAddresses = _parseEmailAddresses(_toController.text);
    if (toAddresses.isEmpty) {
      setState(() {
        _errorMessage = locale.languageCode == 'ja'
            ? '宛先を入力してください'
            : 'Please enter recipient';
      });
      return;
    }

    if (_subjectController.text.trim().isEmpty) {
      setState(() {
        _errorMessage = locale.languageCode == 'ja'
            ? '件名を入力してください'
            : 'Please enter subject';
      });
      return;
    }

    if (_selectedAccountId == null) {
      setState(() {
        _errorMessage = locale.languageCode == 'ja'
            ? '送信元アカウントを選択してください'
            : 'Please select sender account';
      });
      return;
    }

    // メールアドレス形式検証
    final emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    final allRecipients = [
      ...toAddresses,
      ..._parseEmailAddresses(_ccController.text),
      ..._parseEmailAddresses(_bccController.text),
    ];
    
    for (final email in allRecipients) {
      if (!emailRegex.hasMatch(email)) {
        setState(() {
          _errorMessage = locale.languageCode == 'ja'
              ? '無効なメールアドレス: $email'
              : 'Invalid email address: $email';
        });
        return;
      }
    }

    setState(() {
      _errorMessage = null;
      _isSending = true;
    });

    try {
      // 添付ファイルをBase64エンコード（sendMail実装側で処理）

      final request = SendMailRequest(
        accountId: _selectedAccountId!,
        to: toAddresses,
        cc: _parseEmailAddresses(_ccController.text),
        bcc: _parseEmailAddresses(_bccController.text),
        subject: _subjectController.text.trim(),
        body: _bodyController.text,
        attachments: _attachments,
        threadId: widget.intent.threadId,
      );

      final response = await widget.repository.sendMail(request);

      if (mounted) {
        if (response.success) {
          Navigator.of(context).pop();
        } else {
          final locale = Localizations.localeOf(context);
          setState(() {
            _errorMessage = response.errorMessage ??
                (locale.languageCode == 'ja'
                    ? 'メール送信に失敗しました'
                    : 'Failed to send mail');
            _isSending = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        final locale = Localizations.localeOf(context);
        setState(() {
          _errorMessage = locale.languageCode == 'ja'
              ? 'エラー: $e'
              : 'Error: $e';
          _isSending = false;
        });
      }
    }
  }

  Future<void> _onCancelPressed() async {
    final locale = Localizations.localeOf(context);
    final cancelText = I18nService.translateCancel(locale);
    final discardText = locale.languageCode == 'ja' ? '破棄' : 'Discard';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(discardText),
        content: Text(locale.languageCode == 'ja'
            ? '入力内容を破棄しますか？'
            : 'Do you want to discard the input?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(cancelText),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(discardText),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _onAddAttachmentPressed() async {
    // TODO: file_pickerパッケージを追加後に実装
    // 現在は一時的に空実装
    if (mounted) {
      final locale = Localizations.localeOf(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(locale.languageCode == 'ja'
              ? '添付ファイル機能は準備中です'
              : 'Attachment feature is coming soon'),
        ),
      );
    }
  }

  void _onRemoveAttachment(int index) {
    setState(() {
      _attachments.removeAt(index);
    });
  }

  List<String> _parseEmailAddresses(String text) {
    return text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(locale.languageCode == 'ja' ? 'メール作成' : 'Compose'),
        actions: [
          if (_isSending)
            const Padding(
              padding: EdgeInsets.all(16.0),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            TextButton(
              onPressed: _onSendPressed,
              child: Text(locale.languageCode == 'ja' ? '送信' : 'Send'),
            ),
        ],
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: _onCancelPressed,
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 送信元アカウント選択
                  if (_accounts.length > 1) ...[
                    DropdownButtonFormField<String>(
                      value: _selectedAccountId,
                      decoration: InputDecoration(
                        labelText: locale.languageCode == 'ja' ? '送信元' : 'From',
                      ),
                      items: _accounts.map((account) {
                        return DropdownMenuItem(
                          value: account.id,
                          child: Text(account.email),
                        );
                      }).toList(),
                      onChanged: (value) {
                        setState(() {
                          _selectedAccountId = value;
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                  ],
                  // 宛先
                  TextField(
                    controller: _toController,
                    decoration: InputDecoration(
                      labelText: locale.languageCode == 'ja' ? '宛先' : 'To',
                      hintText: locale.languageCode == 'ja'
                          ? 'メールアドレスを入力'
                          : 'Enter email address',
                    ),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  // Cc/Bcc展開ボタン
                  TextButton.icon(
                    onPressed: () {
                      setState(() {
                        _showCcBcc = !_showCcBcc;
                      });
                    },
                    icon: Icon(
                        _showCcBcc ? Icons.expand_less : Icons.expand_more),
                    label: Text(_showCcBcc
                        ? (locale.languageCode == 'ja'
                            ? 'Cc/Bccを隠す'
                            : 'Hide Cc/Bcc')
                        : (locale.languageCode == 'ja'
                            ? 'Cc/Bccを表示'
                            : 'Show Cc/Bcc')),
                  ),
                  // Cc/Bccフィールド
                  if (_showCcBcc) ...[
                    TextField(
                      controller: _ccController,
                      decoration: InputDecoration(
                        labelText: 'Cc',
                        hintText: locale.languageCode == 'ja'
                            ? 'メールアドレスを入力'
                            : 'Enter email address',
                      ),
                      keyboardType: TextInputType.emailAddress,
                    ),
                    TextField(
                      controller: _bccController,
                      decoration: InputDecoration(
                        labelText: 'Bcc',
                        hintText: locale.languageCode == 'ja'
                            ? 'メールアドレスを入力'
                            : 'Enter email address',
                      ),
                      keyboardType: TextInputType.emailAddress,
                    ),
                  ],
                  // 件名
                  TextField(
                    controller: _subjectController,
                    decoration: InputDecoration(
                      labelText: locale.languageCode == 'ja' ? '件名' : 'Subject',
                    ),
                  ),
                  // 本文
                  TextField(
                    controller: _bodyController,
                    decoration: InputDecoration(
                      labelText: locale.languageCode == 'ja' ? '本文' : 'Body',
                      alignLabelWithHint: true,
                    ),
                    maxLines: null,
                    minLines: 10,
                    keyboardType: TextInputType.multiline,
                  ),
                  // 添付ファイル
                  if (_attachments.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    ...List.generate(
                        _attachments.length,
                        (index) => ListTile(
                              leading: const Icon(Icons.attachment),
                              title: Text(_attachments[index].filename),
                              trailing: IconButton(
                                icon: const Icon(Icons.delete),
                                onPressed: () => _onRemoveAttachment(index),
                              ),
                            )),
                  ],
                  // 添付ファイル追加ボタン
                  TextButton.icon(
                    onPressed: _onAddAttachmentPressed,
                    icon: const Icon(Icons.attach_file),
                    label: Text(locale.languageCode == 'ja'
                        ? '添付ファイルを追加'
                        : 'Add Attachment'),
                  ),
                  // エラーメッセージ
                  if (_errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 16.0),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  @override
  void dispose() {
    _toController.dispose();
    _ccController.dispose();
    _bccController.dispose();
    _subjectController.dispose();
    _bodyController.dispose();
    super.dispose();
  }
}
