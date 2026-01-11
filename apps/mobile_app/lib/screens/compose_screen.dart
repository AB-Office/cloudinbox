import 'dart:io' show Platform;
import 'dart:async';
import 'dart:typed_data';
import 'package:cloudinbox_mobile_app/screens/account_screen.dart';
import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';

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
    this.inReplyToMessageId, // 返信・転送時の元のメールID（In-Reply-Toヘッダー用）
  });

  final String accountId;
  final List<String> to;
  final List<String> cc;
  final List<String> bcc;
  final String subject;
  final String body;
  final List<AttachmentData> attachments;
  final String? threadId;
  final String? inReplyToMessageId; // 返信・転送時の元のメールID（In-Reply-Toヘッダー用）
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
    this.taskId, // タスクID（非同期処理用）
    this.messageId, // 後方互換性のため保持（非同期処理では使用されない）
    this.errorMessage,
  });

  final bool success;
  final String? taskId; // タスクID（非同期処理用）
  final String? messageId; // 後方互換性のため保持（非同期処理では使用されない）
  final String? errorMessage;
}

/// メール送信タスク結果
class SendMailTaskResult {
  const SendMailTaskResult({
    required this.success,
    required this.taskId,
    required this.accountId,
    required this.subject,
    this.messageId, // 成功時のメッセージID
    this.errorMessage, // 失敗時のエラーメッセージ
    this.createdAt,
    this.completedAt,
  });

  final bool success;
  final String? messageId;
  final String? errorMessage;
  final String taskId;
  final String accountId;
  final String subject;
  final dynamic createdAt; // Firestore Timestamp
  final dynamic completedAt; // Firestore Timestamp

  factory SendMailTaskResult.fromFirestore(Map<String, dynamic> data, String taskId) {
    return SendMailTaskResult(
      success: data['success'] as bool? ?? false,
      messageId: data['messageId'] as String?,
      errorMessage: data['errorMessage'] as String?,
      taskId: data['taskId'] as String? ?? taskId,
      accountId: data['accountId'] as String? ?? '',
      subject: data['subject'] as String? ?? '',
      createdAt: data['createdAt'],
      completedAt: data['completedAt'],
    );
  }
}

/// メール作成用のリポジトリ抽象
abstract class MailComposeRepository {
  Future<List<MailAccount>> listAccounts();
  Future<SendMailResponse> sendMail(SendMailRequest request);
  Stream<SendMailTaskResult?> watchTaskResult(String uid, String taskId);
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
    this.inReplyToMessageId, // 返信・転送時の元のメールID（In-Reply-Toヘッダー用）
    this.attachments, // 転送時の添付ファイル
  });

  final ComposeType type;
  final String? threadId;
  final String? replyTo; // 返信先（単一）
  final List<String>? replyToAll; // 返信先（全員に返信の場合）
  final String? subject;
  final String? body;
  final String? inReplyToMessageId; // 返信・転送時の元のメールID（In-Reply-Toヘッダー用）
  final List<AttachmentData>? attachments; // 転送時の添付ファイル

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
  // ファイルサイズ制限（10MB）
  static const int _maxAttachmentSizeBytes = 10 * 1024 * 1024; // 10MB

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
  bool _initializedFromIntent = false;
  StreamSubscription<SendMailTaskResult?>? _taskResultSubscription;

  @override
  void initState() {
    super.initState();
    _loadAccounts();
    // 転送以外の場合はinitStateで初期化（contextが必要ないため）
    if (widget.intent.type != ComposeType.forward) {
      _initializeFromIntent();
      _initializedFromIntent = true;
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // 転送の場合はdidChangeDependenciesで初期化（contextが必要なため）
    if (!_initializedFromIntent && widget.intent.type == ComposeType.forward) {
      _initializeFromIntent();
      _initializedFromIntent = true;
    }
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
        final locale = Localizations.localeOf(context);
        setState(() {
          _isLoading = false;
          _errorMessage = I18nService.translateErrorFailedToLoadAccounts(locale, e.toString());
        });
      }
    }
  }

  void _initializeFromIntent() {
    if (widget.intent.type == ComposeType.reply) {
      // 返信
      if (widget.intent.replyTo != null) {
        // 表示名付きメールアドレスからメールアドレス部分のみを抽出
        _toController.text = _extractEmailAddress(widget.intent.replyTo!);
      }
      if (widget.intent.subject != null) {
        _subjectController.text = widget.intent.subject!.startsWith('Re: ')
            ? widget.intent.subject!
            : 'Re: ${widget.intent.subject!}';
      }
      // 引用形式の本文を設定
      if (widget.intent.body != null) {
        _bodyController.text = widget.intent.body!;
        // カーソルを先頭に設定
        _bodyController.selection = TextSelection.collapsed(offset: 0);
      }
    } else if (widget.intent.type == ComposeType.replyAll) {
      // 全員に返信
      if (widget.intent.replyToAll != null) {
        // 表示名付きメールアドレスからメールアドレス部分のみを抽出
        final emailAddresses = widget.intent.replyToAll!
            .map((address) => _extractEmailAddress(address))
            .where((email) => email.isNotEmpty)
            .toList();
        _toController.text = emailAddresses.join(', ');
      }
      if (widget.intent.subject != null) {
        _subjectController.text = widget.intent.subject!.startsWith('Re: ')
            ? widget.intent.subject!
            : 'Re: ${widget.intent.subject!}';
      }
      // 引用形式の本文を設定
      if (widget.intent.body != null) {
        _bodyController.text = widget.intent.body!;
        // カーソルを先頭に設定
        _bodyController.selection = TextSelection.collapsed(offset: 0);
      }
    } else if (widget.intent.type == ComposeType.forward) {
      // 転送
      if (widget.intent.subject != null) {
        _subjectController.text = widget.intent.subject!.startsWith('Fw: ')
            ? widget.intent.subject!
            : 'Fw: ${widget.intent.subject!}';
      }
      // 引用形式の本文を設定（転送プレフィックスは既に本文に含まれているため、そのまま設定）
      if (widget.intent.body != null) {
        _bodyController.text = widget.intent.body!;
        // カーソルを先頭に設定
        _bodyController.selection = TextSelection.collapsed(offset: 0);
      }
      // 転送時の添付ファイルを追加
      if (widget.intent.attachments != null && widget.intent.attachments!.isNotEmpty) {
        setState(() {
          _attachments.addAll(widget.intent.attachments!);
        });
      }
    }
  }

  /// 送信ボタンを有効化するかどうかを判定
  bool _canSendMail() {
    if (_selectedAccountId == null) return false;
    final selectedAccount = _accounts.firstWhere(
      (account) => account.id == _selectedAccountId,
      orElse: () => throw Exception('Account not found'),
    );
    return selectedAccount.smtpHost != null && selectedAccount.smtpUsername != null;
  }

  Future<void> _onSendPressed() async {
    // 入力検証
    final locale = Localizations.localeOf(context);
    final toAddresses = _parseEmailAddresses(_toController.text);
    if (toAddresses.isEmpty) {
      setState(() {
        _errorMessage = I18nService.translateErrorPleaseEnterRecipient(locale);
      });
      return;
    }

    if (_subjectController.text.trim().isEmpty) {
      setState(() {
        _errorMessage = I18nService.translateErrorPleaseEnterSubject(locale);
      });
      return;
    }

    if (_selectedAccountId == null) {
      setState(() {
        _errorMessage = I18nService.translateErrorPleaseSelectSenderAccount(locale);
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
          _errorMessage = I18nService.translateErrorInvalidEmailAddress(locale, email);
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
        inReplyToMessageId: widget.intent.inReplyToMessageId,
      );

      final response = await widget.repository.sendMail(request);

      if (mounted) {
        if (response.success && response.taskId != null) {
          // タスクIDが返却された場合、タスク結果を監視
          final currentUser = FirebaseAuth.instance.currentUser;
          if (currentUser != null) {
            // 既存の監視をクリーンアップ
            _taskResultSubscription?.cancel();
            _taskResultSubscription = null;

            // タスク結果を監視
            _taskResultSubscription = widget.repository
                .watchTaskResult(currentUser.uid, response.taskId!)
                .listen(
              (result) {
                if (!mounted) return;

                final locale = Localizations.localeOf(context);
                
                if (result != null) {
                  // タスク結果が保存された
                  _taskResultSubscription?.cancel();
                  _taskResultSubscription = null;

                  if (result.success) {
                    // 成功時: スナックバーで成功メッセージを表示
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(I18nService.translateMailSent(locale)),
                        backgroundColor: Colors.green,
                        duration: const Duration(seconds: 3),
                      ),
                    );
                    // メール一覧画面に戻る
                    Navigator.of(context).pop();
                  } else {
                    // 失敗時: スナックバーでエラーメッセージを表示
                    setState(() {
                      _isSending = false;
                    });
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(result.errorMessage ?? 
                            I18nService.translateErrorFailedToSendMail(locale)),
                        backgroundColor: Colors.red,
                        duration: const Duration(seconds: 5),
                      ),
                    );
                  }
                } else {
                  // タイムアウト時: スナックバーでタイムアウトメッセージを表示
                  _taskResultSubscription?.cancel();
                  _taskResultSubscription = null;
                  setState(() {
                    _isSending = false;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(I18nService.translateMailSendTimeout(locale)),
                      backgroundColor: Colors.orange,
                      duration: const Duration(seconds: 5),
                    ),
                  );
                }
              },
              onError: (error) {
                if (!mounted) return;

                final locale = Localizations.localeOf(context);
                _taskResultSubscription?.cancel();
                _taskResultSubscription = null;
                setState(() {
                  _isSending = false;
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(I18nService.translateErrorFailedToSendMail(locale)),
                    backgroundColor: Colors.red,
                    duration: const Duration(seconds: 5),
                  ),
                );
              },
            );
          } else {
            // UIDが取得できない場合、エラー
            final locale = Localizations.localeOf(context);
            setState(() {
              _errorMessage = I18nService.translateErrorFailedToSendMail(locale);
              _isSending = false;
            });
          }
        } else if (response.success) {
          // タスクIDが返却されなかったが、successがtrueの場合（後方互換性のため）
          Navigator.of(context).pop();
        } else {
          // エラーレスポンス
          final locale = Localizations.localeOf(context);
          setState(() {
            _errorMessage = response.errorMessage ??
                I18nService.translateErrorFailedToSendMail(locale);
            _isSending = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        final locale = Localizations.localeOf(context);
        setState(() {
          _errorMessage = I18nService.translateErrorGeneric(locale, e.toString());
          _isSending = false;
        });
      }
    }
  }

  Future<void> _onCancelPressed() async {
    final locale = Localizations.localeOf(context);
    final cancelText = I18nService.translateCancel(locale);
    final discardText = I18nService.translateDiscard(locale);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(discardText),
        content: Text(I18nService.translateDiscardInputConfirm(locale)),
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
    if (!mounted) return;

    try {
      // ファイル選択ダイアログを表示
      final FilePickerResult? result = await FilePicker.platform.pickFiles(
        allowMultiple: true,
        withData: true, // ファイルデータをメモリに読み込む
      );

      // ファイル選択がキャンセルされた場合
      if (result == null || result.files.isEmpty) {
        return; // エラーメッセージを表示せずに終了
      }

      // ファイル処理中であることを示す（複数ファイル処理の場合に有効）
      if (mounted && result.files.length > 1) {
        setState(() {
          _isLoading = true;
        });
      }

      // 選択されたファイルを処理
      final List<AttachmentData> newAttachments = [];
      for (final platformFile in result.files) {
        try {
          // ファイルの内容を読み込む（withData: trueによりbytesが利用可能）
          final Uint8List? fileBytes = platformFile.bytes;

          if (fileBytes == null) {
            // ファイル読み込みに失敗
            if (mounted) {
              final locale = Localizations.localeOf(context);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(I18nService.translateErrorFailedToReadFile(locale, platformFile.name)),
                ),
              );
            }
            continue;
          }

          // ファイルサイズチェック
          if (fileBytes.length > _maxAttachmentSizeBytes) {
            // ファイルサイズ超過
            if (mounted) {
              final locale = Localizations.localeOf(context);
              final maxSizeMB = _maxAttachmentSizeBytes / (1024 * 1024);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(I18nService.translateErrorFileSizeExceedsLimit(locale, maxSizeMB.toInt(), platformFile.name)),
                ),
              );
            }
            debugPrint('[Attachment Error] File size exceeds limit: filename=${platformFile.name}, size=${fileBytes.length} bytes, limit=${_maxAttachmentSizeBytes} bytes');
            continue; // このファイルは追加しない
          }

          // コンテンツタイプを取得（拡張子から推測）
          // file_pickerのPlatformFileからextensionを取得して推測
          String? contentType;
          if (platformFile.extension != null) {
            contentType = _getContentTypeFromExtension(platformFile.extension!);
          }
          // 推測できない場合はデフォルトとしてapplication/octet-streamを設定
          contentType ??= 'application/octet-stream';

          // AttachmentDataオブジェクトを作成
          final attachment = AttachmentData(
            filename: platformFile.name,
            content: fileBytes,
            contentType: contentType,
          );

          newAttachments.add(attachment);
        } catch (e) {
          // ファイル読み込みエラー
          debugPrint('[Attachment Error] File read error: filename=${platformFile.name}, error=$e, errorType=${e.runtimeType}');
          if (mounted) {
            final locale = Localizations.localeOf(context);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(I18nService.translateErrorFailedToReadFile(locale, platformFile.name)),
              ),
            );
          }
        }
      }

      // 添付ファイルリストに追加
      if (newAttachments.isNotEmpty && mounted) {
        setState(() {
          _attachments.addAll(newAttachments);
          _isLoading = false; // 処理完了
        });
      } else if (mounted) {
        setState(() {
          _isLoading = false; // 処理完了（追加するファイルがない場合も）
        });
      }
    } on PlatformException catch (e) {
      // プラットフォーム固有のエラー（権限エラー等）
      debugPrint('[Attachment Error] Platform error: platform=${Platform.operatingSystem}, code=${e.code}, message=${e.message}, details=${e.details}');
      if (mounted) {
        setState(() {
          _isLoading = false; // エラー時も読み込み状態を解除
        });
        final locale = Localizations.localeOf(context);
        String errorMessage = _getPlatformSpecificErrorMessage(e, locale);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
          ),
        );
      }
    } catch (e) {
      // その他のエラー
      debugPrint('[Attachment Error] File picker error: error=$e, errorType=${e.runtimeType}');
      if (mounted) {
        setState(() {
          _isLoading = false; // エラー時も読み込み状態を解除
        });
        final locale = Localizations.localeOf(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(I18nService.translateErrorFailedToPickFiles(locale)),
          ),
        );
      }
    }
  }

  /// プラットフォーム固有のエラーメッセージを取得
  String _getPlatformSpecificErrorMessage(PlatformException e, Locale locale) {
    final isAndroid = Platform.isAndroid;
    final isIOS = Platform.isIOS;

    // 権限エラーの場合
    if (e.code == 'permission_denied' || 
        e.message?.toLowerCase().contains('permission') == true ||
        e.message?.toLowerCase().contains('権限') == true) {
      if (isAndroid || isIOS) {
        return I18nService.translateErrorFileAccessPermissionDenied(locale);
      } else {
        return I18nService.translateErrorFileAccessPermissionDeniedGeneric(locale);
      }
    }

    // プラットフォーム固有のエラーコードの処理
    if (isAndroid || isIOS) {
      switch (e.code) {
        case 'user_canceled':
        case 'pick_files_canceled':
          return I18nService.translateErrorFileSelectionCanceled(locale);
        case 'unknown':
          return I18nService.translateErrorFileSelectionUnknown(locale);
        default:
          return I18nService.translateErrorFileSelectionFailed(locale, e.message ?? e.code);
      }
    }

    // その他のプラットフォームエラー
    return I18nService.translateErrorFailedToPickFiles(locale);
  }

  /// 拡張子からコンテンツタイプを推測
  String? _getContentTypeFromExtension(String extension) {
    final ext = extension.toLowerCase();
    const contentTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'text/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
    };
    return contentTypes[ext];
  }

  void _onRemoveAttachment(int index) {
    setState(() {
      _attachments.removeAt(index);
    });
  }

  /// メールアドレス文字列をパースして、メールアドレス部分のみを抽出する
  /// RFC 5322形式（"表示名" <email@example.com>）も対応
  List<String> _parseEmailAddresses(String text) {
    return text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .map((address) => _extractEmailAddress(address))
        .where((email) => email.isNotEmpty)
        .toList();
  }

  /// メールアドレス文字列から実際のメールアドレス部分を抽出する
  /// 例: "XXXX" <email@example.com> → email@example.com
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

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(I18nService.translateCompose(locale)),
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
              onPressed: _canSendMail() ? _onSendPressed : null,
              child: Text(I18nService.translateSend(locale)),
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
                        labelText: I18nService.translateFrom(locale),
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
                      labelText: I18nService.translateTo(locale),
                      hintText: I18nService.translateEnterEmailAddress(locale),
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
                        ? I18nService.translateHideCcBcc(locale)
                        : I18nService.translateShowCcBcc(locale)),
                  ),
                  // Cc/Bccフィールド
                  if (_showCcBcc) ...[
                    TextField(
                      controller: _ccController,
                      decoration: InputDecoration(
                        labelText: 'Cc',
                        hintText: I18nService.translateEnterEmailAddress(locale),
                      ),
                      keyboardType: TextInputType.emailAddress,
                    ),
                    TextField(
                      controller: _bccController,
                      decoration: InputDecoration(
                        labelText: 'Bcc',
                        hintText: I18nService.translateEnterEmailAddress(locale),
                      ),
                      keyboardType: TextInputType.emailAddress,
                    ),
                  ],
                  // 件名
                  TextField(
                    controller: _subjectController,
                    decoration: InputDecoration(
                      labelText: I18nService.translateSubject(locale),
                    ),
                  ),
                  // 本文
                  TextField(
                    controller: _bodyController,
                    decoration: InputDecoration(
                      labelText: I18nService.translateBody(locale),
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
                        (index) {
                          final attachment = _attachments[index];
                          final fileSize = I18nService.formatBytes(
                            attachment.content.length,
                            context,
                          );
                          return ListTile(
                            leading: const Icon(Icons.attachment),
                            title: Text(attachment.filename),
                            subtitle: Text(fileSize),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete),
                              onPressed: () => _onRemoveAttachment(index),
                            ),
                          );
                        }),
                  ],
                  // 添付ファイル追加ボタン
                  TextButton.icon(
                    onPressed: _isLoading ? null : _onAddAttachmentPressed,
                    icon: _isLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.attach_file),
                    label: Text(I18nService.translateAddAttachment(locale)),
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
    // ストリームのクリーンアップ
    _taskResultSubscription?.cancel();
    _taskResultSubscription = null;
    // コントローラーのクリーンアップ
    _toController.dispose();
    _ccController.dispose();
    _bccController.dispose();
    _subjectController.dispose();
    _bodyController.dispose();
    super.dispose();
  }
}
