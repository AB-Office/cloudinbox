import 'package:cloudinbox_mobile_app/services/ad_service.dart';
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

/// アカウント設定用のリポジトリ抽象
abstract class AccountRepository {
  Future<void> testConnection(AccountFormData data);
  Future<void> createAccount(AccountFormData data);
}

class AccountScreen extends StatefulWidget {
  const AccountScreen({
    super.key,
    required this.repository,
    this.adService = const AdService(),
    this.planId,
  });

  final AccountRepository repository;
  final AdService adService;
  final String? planId;

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
      await widget.repository.testConnection(_buildFormData());
      // 実際の結果はリポジトリ側からの通知で更新される想定だが、
      // テストでは直接 state を変更しない（Widget テスト側でリポジトリの結果を検証）。
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
    await widget.repository.createAccount(_buildFormData());
  }

  /// 外部からテスト結果を反映するためのメソッド（Provider 等で差し替え可能）
  void applyTestResult(AccountTestResult result) {
    setState(() {
      _testSucceeded = result.success;
      _errorMessage = result.errorMessage;
    });
  }

  @override
  Widget build(BuildContext context) {
    final adBanner = widget.adService.buildBanner(widget.planId);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Account'),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  TextField(
                    key: const Key('account_label'),
                    controller: _labelController,
                    decoration: const InputDecoration(labelText: 'Label'),
                  ),
                  TextField(
                    key: const Key('account_email'),
                    controller: _emailController,
                    decoration: const InputDecoration(labelText: 'Email'),
                  ),
                  TextField(
                    key: const Key('pop3_host'),
                    controller: _pop3HostController,
                    decoration: const InputDecoration(labelText: 'POP3 Host'),
                  ),
                  TextField(
                    key: const Key('pop3_port'),
                    controller: _pop3PortController,
                    decoration: const InputDecoration(labelText: 'POP3 Port'),
                    keyboardType: TextInputType.number,
                  ),
                  TextField(
                    key: const Key('pop3_username'),
                    controller: _pop3UsernameController,
                    decoration:
                        const InputDecoration(labelText: 'POP3 Username'),
                  ),
                  TextField(
                    key: const Key('pop3_password'),
                    controller: _pop3PasswordController,
                    decoration:
                        const InputDecoration(labelText: 'POP3 Password'),
                    obscureText: true,
                  ),
                  const SizedBox(height: 16),
                  if (_isTesting) const CircularProgressIndicator(),
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
                          child: const Text('Test Connection'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton(
                          key: const Key('button_create_account'),
                          onPressed:
                              _testSucceeded ? _onCreateAccountPressed : null,
                          child: const Text('Create Account'),
                        ),
                      ),
                    ],
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


