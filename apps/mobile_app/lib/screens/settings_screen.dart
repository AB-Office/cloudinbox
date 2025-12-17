import 'package:cloudinbox_mobile_app/screens/account_screen.dart';
import 'package:cloudinbox_mobile_app/services/ad_service.dart';
import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:flutter/material.dart';

/// 設定画面で表示するプラン・使用量情報
class SettingsData {
  const SettingsData({
    required this.planLabel,
    required this.maxStorageBytes,
    required this.usedStorageBytes,
  });

  final String planLabel;
  final int maxStorageBytes;
  final int usedStorageBytes;
}

/// 設定情報取得用リポジトリ抽象
abstract class SettingsRepository {
  Future<SettingsData> loadSettings();
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.repository,
    required this.accountRepository,
    required this.onLogout,
    this.adService = const AdService(),
    this.planId,
  });

  final SettingsRepository repository;
  final AccountRepository accountRepository;
  final Future<void> Function() onLogout;
  final AdService adService;
  final String? planId;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  SettingsData? _data;
  bool _isLoading = false;
  String? _errorMessage;

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
      final data = await widget.repository.loadSettings();
      setState(() {
        _data = data;
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

  Future<void> _onAccountSettingsPressed() async {
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => AccountScreen(
          repository: widget.accountRepository,
          adService: widget.adService,
          planId: widget.planId,
        ),
      ),
    );
  }

  Future<void> _onLogoutPressed() async {
    try {
      await widget.onLogout();
      if (!mounted) return;
      // ログアウト後はAuthScreenに遷移するが、実際の実装では
      // onLogoutコールバック内でNavigatorを操作することが想定される
      // ここではテスト用にNavigator操作を残す
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('ログアウトエラー: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final adBanner = widget.adService.buildBanner(widget.planId);
    final locale = Localizations.localeOf(context);
    final settingsTitle = I18nService.translateSettings(locale);
    final accountSettingsLabel = I18nService.translateAccountSettings(locale);
    final logoutLabel = I18nService.translateLogout(locale);

    return Scaffold(
      appBar: AppBar(
        title: Text(settingsTitle),
      ),
      body: _isLoading && _data == null
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.red),
                  ),
                )
              : _data == null
                  ? const SizedBox.shrink()
                  : Column(
                      children: [
                        Expanded(
                          child: ListView(
                            padding: const EdgeInsets.all(16.0),
                            children: [
                              if (_data != null) ...[
                                Text('Plan: ${_data!.planLabel}'),
                                const SizedBox(height: 8),
                                Text(
                                  'Max storage (bytes): ${_data!.maxStorageBytes}',
                                ),
                                Text(
                                  'Used storage (bytes): ${_data!.usedStorageBytes}',
                                ),
                                const SizedBox(height: 24),
                              ],
                              ListTile(
                                title: Text(accountSettingsLabel),
                                leading: const Icon(Icons.settings),
                                onTap: _onAccountSettingsPressed,
                              ),
                              ListTile(
                                title: Text(logoutLabel),
                                leading: const Icon(Icons.logout),
                                onTap: _onLogoutPressed,
                              ),
                            ],
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


