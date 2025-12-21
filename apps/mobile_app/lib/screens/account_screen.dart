import 'package:cloudinbox_mobile_app/services/ad_service.dart';
import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:flutter/material.dart';

/// メールアカウント設定フォームのデータ
class AccountFormData {
  const AccountFormData({
    required this.label,
    required this.email,
    required this.pop3Host,
    required this.pop3Port,
    required this.pop3Username,
    required this.pop3Password,
    this.smtpHost = '',
    this.smtpPort = 587,
    this.smtpUsername = '',
    this.smtpPassword = '',
  });

  final String label;
  final String email;
  final String pop3Host;
  final int pop3Port;
  final String pop3Username;
  final String pop3Password;
  final String smtpHost;
  final int smtpPort;
  final String smtpUsername;
  final String smtpPassword;
}

/// POP3S 接続テスト結果
class AccountTestResult {
  const AccountTestResult({
    required this.success,
    this.errorMessage,
  });

  final bool success;
  final String? errorMessage;
}

/// メールアカウント情報
class MailAccount {
  const MailAccount({
    required this.id,
    required this.label,
    required this.email,
    required this.pop3Host,
    required this.pop3Port,
    required this.pop3Username,
    this.status = 'active',
    this.deletedAt,
  });

  final String id;
  final String label;
  final String email;
  final String pop3Host;
  final int pop3Port;
  final String pop3Username;
  final String status; // 'active' or 'inactive'
  final DateTime? deletedAt; // 削除日時（論理削除の場合）
  
  bool get isDeleted => status == 'inactive';
}

/// アカウント設定用のリポジトリ抽象
abstract class AccountRepository {
  Future<AccountTestResult> testConnection(AccountFormData data);
  Future<AccountTestResult> testSmtpConnection(AccountFormData data);
  Future<void> createAccount(AccountFormData data);
  Future<List<MailAccount>> listAccounts({bool includeInactive = false});
  Future<MailAccount?> getAccount(String accountId);
  Future<void> updateAccount(String accountId, AccountFormData data);
  Future<void> deleteAccount(String accountId); // 論理削除
  Future<void> restoreAccount(String accountId); // 復元
  Future<void> permanentlyDeleteAccount(String accountId); // 完全削除
}

class AccountScreen extends StatefulWidget {
  const AccountScreen({
    super.key,
    required this.repository,
    this.adService = const AdService(),
    this.planId,
    this.accountId,
    this.account,
  });

  final AccountRepository repository;
  final AdService adService;
  final String? planId;
  final String? accountId; // 編集モードの場合のアカウントID
  final MailAccount? account; // 編集モードの場合の既存アカウントデータ

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _labelController = TextEditingController();
  final _emailController = TextEditingController();
  final _pop3HostController = TextEditingController();
  final _pop3PortController = TextEditingController(text: '995');
  final _pop3UsernameController = TextEditingController();
  final _pop3PasswordController = TextEditingController();
  final _smtpHostController = TextEditingController();
  final _smtpPortController = TextEditingController(text: '587');
  final _smtpUsernameController = TextEditingController();
  final _smtpPasswordController = TextEditingController();

  bool _isTesting = false;
  bool _testSucceeded = false;
  String? _errorMessage;
  bool _isLoading = false;
  bool _isTestingSmtp = false;
  bool _smtpTestSucceeded = false;
  String? _smtpErrorMessage;

  @override
  void initState() {
    super.initState();
    // 編集モードの場合、既存データをフォームに設定
    if (widget.account != null) {
      _labelController.text = widget.account!.label;
      _emailController.text = widget.account!.email;
      _pop3HostController.text = widget.account!.pop3Host;
      _pop3PortController.text = widget.account!.pop3Port.toString();
      _pop3UsernameController.text = widget.account!.pop3Username;
      // パスワードは既存のものを取得できないため、空のまま
    } else if (widget.accountId != null) {
      // accountIdのみが指定されている場合、アカウントデータを取得
      _loadAccount();
    }
  }

  Future<void> _loadAccount() async {
    if (widget.accountId == null) return;
    
    setState(() {
      _isLoading = true;
    });
    
    try {
      final account = await widget.repository.getAccount(widget.accountId!);
      if (account != null && mounted) {
        _labelController.text = account.label;
        _emailController.text = account.email;
        _pop3HostController.text = account.pop3Host;
        _pop3PortController.text = account.pop3Port.toString();
        _pop3UsernameController.text = account.pop3Username;
      }
    } catch (e) {
      debugPrint('Error loading account: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  AccountFormData _buildFormData() {
    final pop3Port = int.tryParse(_pop3PortController.text) ?? 995;
    final smtpPort = int.tryParse(_smtpPortController.text) ?? 587;
    return AccountFormData(
      label: _labelController.text,
      email: _emailController.text,
      pop3Host: _pop3HostController.text,
      pop3Port: pop3Port,
      pop3Username: _pop3UsernameController.text,
      pop3Password: _pop3PasswordController.text,
      smtpHost: _smtpHostController.text,
      smtpPort: smtpPort,
      smtpUsername: _smtpUsernameController.text,
      smtpPassword: _smtpPasswordController.text,
    );
  }

  Future<void> _onTestConnectionPressed() async {
    setState(() {
      _isTesting = true;
      _testSucceeded = false;
      _errorMessage = null;
    });
    try {
      final result = await widget.repository.testConnection(_buildFormData());
      if (mounted) {
        applyTestResult(result);
      }
    } catch (e) {
      if (mounted) {
        final locale = Localizations.localeOf(context);
        applyTestResult(AccountTestResult(
          success: false,
          errorMessage: I18nService.translateConnectionTestError(locale, e.toString()),
        ));
      }
    } finally {
      if (mounted) {
        setState(() {
          _isTesting = false;
        });
      }
    }
  }

  Future<void> _onTestSmtpConnectionPressed() async {
    setState(() {
      _isTestingSmtp = true;
      _smtpTestSucceeded = false;
      _smtpErrorMessage = null;
    });
    try {
      final result = await widget.repository.testSmtpConnection(_buildFormData());
      if (mounted) {
        setState(() {
          _smtpTestSucceeded = result.success;
          _smtpErrorMessage = result.errorMessage;
        });
      }
    } catch (e) {
      if (mounted) {
        final locale = Localizations.localeOf(context);
        setState(() {
          _smtpTestSucceeded = false;
          _smtpErrorMessage = I18nService.translateConnectionTestError(locale, e.toString());
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isTestingSmtp = false;
        });
      }
    }
  }

  void _onCopyFromPop3Pressed() {
    // コントローラーのテキストを更新（setStateの外で実行）
    _smtpHostController.text = _pop3HostController.text;
    _smtpUsernameController.text = _pop3UsernameController.text;
    _smtpPasswordController.text = _pop3PasswordController.text;
    // ポートは587または465にデフォルト設定（587をデフォルトとする）
    if (_smtpPortController.text.isEmpty) {
      _smtpPortController.text = '587';
    }
    // Builderの再評価を促すためにsetStateを呼び出す
    setState(() {});
  }

  Future<void> _onCreateAccountPressed() async {
    // ボタンの有効化条件をチェック（編集モードの場合はSMTP接続テストが必要な場合もある）
    if (!_shouldEnableCreateButton()) {
      return;
    }
    
    setState(() {
      _isTesting = true;
      _errorMessage = null;
    });
    
    final locale = Localizations.localeOf(context);
    
    try {
      if (widget.accountId != null) {
        // 編集モード
        await widget.repository.updateAccount(widget.accountId!, _buildFormData());
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(I18nService.translateAccountUpdated(locale)),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop();
        }
      } else {
        // 新規作成モード
    await widget.repository.createAccount(_buildFormData());
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(I18nService.translateAccountCreated(locale)),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop();
        }
      }
    } catch (e) {
      if (mounted) {
        final errorText = widget.accountId != null
            ? I18nService.translateAccountUpdateError(locale, e.toString())
            : I18nService.translateAccountCreationError(locale, e.toString());
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorText),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isTesting = false;
        });
      }
    }
  }

  /// 外部からテスト結果を反映するためのメソッド（Provider 等で差し替え可能）
  void applyTestResult(AccountTestResult result) {
    setState(() {
      _testSucceeded = result.success;
      _errorMessage = result.errorMessage;
    });
  }

  /// アカウント作成/更新ボタンを有効化するかどうかを判定
  bool _shouldEnableCreateButton() {
    final isEditMode = widget.accountId != null || widget.account != null;
    final isCreating = _isTesting && _testSucceeded;
    
    if (isCreating) {
      return false;
    }
    
    // 編集モードの場合
    if (isEditMode) {
      // SMTP設定が入力されている場合は、SMTP接続テストが成功している必要がある
      final hasSmtpSettings = _smtpHostController.text.isNotEmpty && 
                             _smtpUsernameController.text.isNotEmpty;
      if (hasSmtpSettings) {
        return _smtpTestSucceeded;
      }
      // SMTP設定がない場合は、既存アカウントなので更新可能
      return true;
    }
    
    // 新規作成モードの場合、POP3接続テストが成功している必要がある
    return _testSucceeded;
  }

  Future<void> _onDeleteAccountPressed() async {
    if (widget.accountId == null) return;

    final locale = Localizations.localeOf(context);
    final typeTitle = I18nService.translateDeleteAccountTypeTitle(locale);
    final softDeleteText = I18nService.translateSoftDelete(locale);
    final permanentDeleteText = I18nService.translatePermanentDelete(locale);
    final cancelText = I18nService.translateCancel(locale);

    // 削除方法を選択
    final deleteType = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(typeTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(softDeleteText),
              leading: const Icon(Icons.restore),
              onTap: () => Navigator.of(context).pop('soft'),
            ),
            ListTile(
              title: Text(permanentDeleteText),
              leading: const Icon(Icons.delete_forever, color: Colors.red),
              onTap: () => Navigator.of(context).pop('permanent'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(cancelText),
          ),
        ],
      ),
    );

    if (deleteType == null || !mounted) return;

    // 完全削除の場合は追加確認
    if (deleteType == 'permanent') {
      final permanentConfirmTitle = I18nService.translatePermanentDeleteConfirmTitle(locale);
      final permanentConfirmMessage = I18nService.translatePermanentDeleteConfirm(locale);
      final deleteText = I18nService.translateDelete(locale);

      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(permanentConfirmTitle),
          content: Text(permanentConfirmMessage),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(cancelText),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: TextButton.styleFrom(foregroundColor: Colors.red),
              child: Text(deleteText),
            ),
          ],
        ),
      );

      if (confirmed != true || !mounted) return;
    }

    setState(() {
      _isTesting = true;
      _errorMessage = null;
    });

    try {
      if (deleteType == 'permanent') {
        // 完全削除
        await widget.repository.permanentlyDeleteAccount(widget.accountId!);
        if (mounted) {
          final deletedMessage = I18nService.translateAccountPermanentlyDeleted(locale);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(deletedMessage),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop();
        }
      } else {
        // 論理削除
        await widget.repository.deleteAccount(widget.accountId!);
        if (mounted) {
          final deletedMessage = I18nService.translateAccountDeleted(locale);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(deletedMessage),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(I18nService.translateAccountDeletionError(locale, e.toString())),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isTesting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final adBanner = widget.adService.buildBanner(widget.planId);
    final locale = Localizations.localeOf(context);
    final isCreating = _isTesting && _testSucceeded;

    final isEditMode = widget.accountId != null || widget.account != null;
    final accountTitle = I18nService.translateAccount(locale);
    final labelText = I18nService.translateLabel(locale);
    final emailText = I18nService.translateEmail(locale);
    final pop3HostText = I18nService.translatePop3Host(locale);
    final pop3PortText = I18nService.translatePop3Port(locale);
    final pop3UsernameText = I18nService.translatePop3Username(locale);
    final pop3PasswordText = I18nService.translatePop3Password(locale);
    final pop3PasswordHint = isEditMode ? I18nService.translatePop3PasswordHint(locale) : null;
    final testConnectionText = I18nService.translateTestConnection(locale);
    final createAccountText = isEditMode 
        ? I18nService.translateUpdateAccount(locale)
        : I18nService.translateCreateAccount(locale);
    final deleteAccountText = I18nService.translateDeleteAccount(locale);
    final successText = I18nService.translateConnectionTestSucceeded(locale);

    return Scaffold(
      appBar: AppBar(
        title: Text(accountTitle),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  TextField(
                    key: const Key('account_label'),
                    controller: _labelController,
                    decoration: InputDecoration(labelText: labelText),
                  ),
                  TextField(
                    key: const Key('account_email'),
                    controller: _emailController,
                    decoration: InputDecoration(labelText: emailText),
                  ),
                  TextField(
                    key: const Key('pop3_host'),
                    controller: _pop3HostController,
                    decoration: InputDecoration(labelText: pop3HostText),
                    onChanged: (_) => setState(() {}), // Builderの再評価を促す
                  ),
                  TextField(
                    key: const Key('pop3_port'),
                    controller: _pop3PortController,
                    decoration: InputDecoration(labelText: pop3PortText),
                    keyboardType: TextInputType.number,
                  ),
                  TextField(
                    key: const Key('pop3_username'),
                    controller: _pop3UsernameController,
                    decoration: InputDecoration(labelText: pop3UsernameText),
                    onChanged: (_) => setState(() {}), // Builderの再評価を促す
                  ),
                  TextField(
                    key: const Key('pop3_password'),
                    controller: _pop3PasswordController,
                    decoration: InputDecoration(
                      labelText: pop3PasswordText,
                      hintText: pop3PasswordHint,
                      helperText: pop3PasswordHint,
                    ),
                    obscureText: true,
                  ),
                  const SizedBox(height: 24),
                  // SMTP設定セクション
                  Text(
                    locale.languageCode == 'ja' ? 'SMTP設定' : 'SMTP Settings',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    key: const Key('smtp_host'),
                    controller: _smtpHostController,
                    decoration: InputDecoration(
                      labelText: I18nService.translateSmtpHost(locale),
                    ),
                    onChanged: (_) => setState(() {}), // Builderの再評価を促す
                  ),
                  TextField(
                    key: const Key('smtp_port'),
                    controller: _smtpPortController,
                    decoration: InputDecoration(
                      labelText: I18nService.translateSmtpPort(locale),
                    ),
                    keyboardType: TextInputType.number,
                  ),
                  TextField(
                    key: const Key('smtp_username'),
                    controller: _smtpUsernameController,
                    decoration: InputDecoration(
                      labelText: I18nService.translateSmtpUsername(locale),
                    ),
                    onChanged: (_) => setState(() {}), // Builderの再評価を促す
                  ),
                  TextField(
                    key: const Key('smtp_password'),
                    controller: _smtpPasswordController,
                    decoration: InputDecoration(
                      labelText: I18nService.translateSmtpPassword(locale),
                      hintText: isEditMode ? I18nService.translateSmtpPasswordHint(locale) : null,
                      helperText: isEditMode ? I18nService.translateSmtpPasswordHint(locale) : null,
                    ),
                    obscureText: true,
                  ),
                  // POP3設定からコピーボタン（SMTP設定が未入力の場合のみ表示）
                  Builder(
                    builder: (context) {
                      final shouldShowCopyButton = _smtpHostController.text.isEmpty &&
                          _smtpUsernameController.text.isEmpty &&
                          _pop3HostController.text.isNotEmpty &&
                          _pop3UsernameController.text.isNotEmpty;
                      
                      if (!shouldShowCopyButton) {
                        return const SizedBox.shrink();
                      }
                      
                      return Padding(
                        padding: const EdgeInsets.only(top: 8.0),
                        child: OutlinedButton.icon(
                          key: const Key('button_copy_from_pop3'),
                          onPressed: _onCopyFromPop3Pressed,
                          icon: const Icon(Icons.copy),
                          label: Text(I18nService.translateCopyFromPop3(locale)),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  // SMTP接続テストボタン
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      key: const Key('button_test_smtp_connection'),
                      onPressed: _isTestingSmtp ? null : _onTestSmtpConnectionPressed,
                      child: _isTestingSmtp
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(I18nService.translateTestSmtpConnection(locale)),
                    ),
                  ),
                  if (_isTestingSmtp && !_smtpTestSucceeded)
                    const Padding(
                      padding: EdgeInsets.only(top: 8.0),
                      child: CircularProgressIndicator(),
                    ),
                  if (_smtpTestSucceeded && !_isTestingSmtp)
                    Padding(
                      padding: const EdgeInsets.only(top: 8.0),
                      child: Text(
                        successText,
                        style: TextStyle(color: Colors.green.shade700),
                      ),
                    ),
                  if (_smtpErrorMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8.0),
                      child: Text(
                        _smtpErrorMessage!,
                        style: const TextStyle(color: Colors.red),
                      ),
                  ),
                  const SizedBox(height: 16),
                  if (_isTesting && !_testSucceeded) const CircularProgressIndicator(),
                  if (_testSucceeded && !_isTesting && !isCreating)
                    Padding(
                      padding: const EdgeInsets.only(top: 8.0),
                      child: Text(
                        successText,
                        style: TextStyle(color: Colors.green.shade700),
                      ),
                    ),
                  if (_errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8.0),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          key: const Key('button_test_connection'),
                          onPressed:
                              _isTesting ? null : _onTestConnectionPressed,
                          child: Text(testConnectionText),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton(
                          key: const Key('button_create_account'),
                          onPressed: _shouldEnableCreateButton() 
                              ? _onCreateAccountPressed 
                              : null,
                          child: isCreating 
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : Text(createAccountText),
                        ),
                      ),
                    ],
                  ),
                  if (isEditMode) ...[
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        key: const Key('button_delete_account'),
                        onPressed: _isTesting ? null : _onDeleteAccountPressed,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red,
                          side: const BorderSide(color: Colors.red),
                        ),
                        child: Text(deleteAccountText),
                      ),
                    ),
                  ],
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


