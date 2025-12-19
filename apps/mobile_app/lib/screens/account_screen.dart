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
  });

  final String label;
  final String email;
  final String pop3Host;
  final int pop3Port;
  final String pop3Username;
  final String pop3Password;
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

  bool _isTesting = false;
  bool _testSucceeded = false;
  String? _errorMessage;
  bool _isLoading = false;

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
    final port = int.tryParse(_pop3PortController.text) ?? 995;
    return AccountFormData(
      label: _labelController.text,
      email: _emailController.text,
      pop3Host: _pop3HostController.text,
      pop3Port: port,
      pop3Username: _pop3UsernameController.text,
      pop3Password: _pop3PasswordController.text,
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

  Future<void> _onCreateAccountPressed() async {
    if (!_testSucceeded) {
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
                          onPressed: (_testSucceeded && !isCreating) 
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


