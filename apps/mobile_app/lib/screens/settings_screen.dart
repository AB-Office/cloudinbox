import 'package:cloudinbox_mobile_app/screens/account_screen.dart';
import 'package:cloudinbox_mobile_app/services/ad_service.dart';
import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:cloudinbox_mobile_app/widgets/navigation_drawer.dart' as app_drawer;
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

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
  /// Firestoreの変更をリアルタイムで監視
  Stream<SettingsData> watchSettings();
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.repository,
    required this.accountRepository,
    required this.onLogout,
    this.adService = const AdService(),
    this.planId,
    this.currentRoute = '/settings',
    this.onNavigate,
  });

  final SettingsRepository repository;
  final AccountRepository accountRepository;
  final Future<void> Function() onLogout;
  final AdService adService;
  final String? planId;
  final String currentRoute;
  final void Function(String route)? onNavigate;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  List<MailAccount> _accounts = [];
  bool _isLoadingAccounts = false;

  @override
  void initState() {
    super.initState();
    _loadAccounts();
  }

  Future<void> _loadAccounts() async {
    setState(() {
      _isLoadingAccounts = true;
    });
    try {
      // アクティブと削除済みの両方を取得
      final accounts = await widget.accountRepository.listAccounts(includeInactive: true);
      if (mounted) {
        setState(() {
          _accounts = accounts;
        });
      }
    } catch (e) {
      debugPrint('Error loading accounts: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingAccounts = false;
        });
      }
    }
  }

  Future<void> _onRestoreAccount(MailAccount account) async {
    if (!mounted) return;
    
    final locale = Localizations.localeOf(context);
    final restoreText = I18nService.translateRestore(locale);
    final cancelText = I18nService.translateCancel(locale);
    final confirmMessage = I18nService.translateRestoreAccountConfirm(locale);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(restoreText),
        content: Text(confirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(cancelText),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(restoreText),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await widget.accountRepository.restoreAccount(account.id);
      if (mounted) {
        final locale = Localizations.localeOf(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(I18nService.translateAccountRestored(locale)),
            backgroundColor: Colors.green,
          ),
        );
        // アカウント一覧を再読み込み
        _loadAccounts();
      }
    } catch (e) {
      if (mounted) {
        final locale = Localizations.localeOf(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(I18nService.translateLogoutError(locale, e.toString())),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _onAccountTapped(MailAccount account) async {
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => AccountScreen(
          repository: widget.accountRepository,
          adService: widget.adService,
          planId: widget.planId,
          accountId: account.id,
          account: account,
        ),
      ),
    );
    // 編集画面から戻ったら、アカウント一覧を再読み込み
    _loadAccounts();
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
    // 新規作成画面から戻ったら、アカウント一覧を再読み込み
    _loadAccounts();
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
      final locale = Localizations.localeOf(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(I18nService.translateLogoutError(locale, e.toString())),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  String _getPrivacyPolicyUrl(Locale locale) {
    return locale.languageCode == 'ja'
        ? 'https://cloudinbox.cloud/privacy.html'
        : 'https://cloudinbox.cloud/privacy_en.html';
  }

  String _getTermsOfServiceUrl(Locale locale) {
    return locale.languageCode == 'ja'
        ? 'https://cloudinbox.cloud/terms.html'
        : 'https://cloudinbox.cloud/terms_en.html';
  }

  String _getCommercialTransactionUrl(Locale locale) {
    return locale.languageCode == 'ja'
        ? 'https://cloudinbox.cloud/commercial.html'
        : 'https://cloudinbox.cloud/pricing_en.html';
  }

  Future<void> _openLink(Locale locale, String url) async {
    try {
      final uri = Uri.parse(url);
      // Android 11以降ではcanLaunchUrlがfalseを返す場合があるため、
      // 直接launchUrlを試みる
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        // canLaunchUrlがfalseでも、直接launchUrlを試みる
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (!mounted) return;
      debugPrint('Failed to launch URL: $url, error: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(I18nService.translateErrorOperationFailed(locale)),
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
      drawer: widget.onNavigate != null
          ? app_drawer.NavigationDrawer(
              settingsRepository: widget.repository,
              currentRoute: widget.currentRoute,
              onNavigate: widget.onNavigate!,
            )
          : null,
      body: StreamBuilder<SettingsData>(
        stream: widget.repository.watchSettings(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          
          if (snapshot.hasError) {
            return Center(
              child: Text(
                'error: ${snapshot.error}',
                style: const TextStyle(color: Colors.red),
              ),
            );
          }

          final settingsData = snapshot.data;
          if (settingsData == null) {
            return const SizedBox.shrink();
          }

          return Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16.0),
                  children: [
                    Text(
                      '${I18nService.translateMaxStorage(locale)}: ${I18nService.formatBytes(settingsData.maxStorageBytes, context)}',
                    ),
                    Text(
                      '${I18nService.translateUsedStorage(locale)}: ${I18nService.formatBytes(settingsData.usedStorageBytes, context)}',
                    ),
                    Text(
                      '${I18nService.translateUsageRate(locale)}: ${(settingsData.usedStorageBytes / settingsData.maxStorageBytes * 100).toStringAsFixed(1)}%',
                    ),
                    const SizedBox(height: 24),
                    // メールアカウント一覧
                    if (_isLoadingAccounts)
                      const Center(child: CircularProgressIndicator())
                    else if (_accounts.isEmpty)
                      ListTile(
                        title: Text(I18nService.translateNoMailAccounts(locale)),
                        subtitle: Text(I18nService.translateAddAccountFromSettings(locale)),
                      )
                    else ...[
                      Text(
                        I18nService.translateMailAccounts(locale),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      ..._accounts.map((account) {
                        final isDeleted = account.isDeleted;
                        return ListTile(
                          title: Text(
                            account.label.isNotEmpty 
                                ? account.label 
                                : account.email,
                            style: TextStyle(
                              color: isDeleted ? Colors.grey : null,
                              decoration: isDeleted ? TextDecoration.lineThrough : null,
                            ),
                          ),
                          subtitle: Text(
                            account.email,
                            style: TextStyle(
                              color: isDeleted ? Colors.grey : null,
                            ),
                          ),
                          leading: Icon(
                            Icons.email,
                            color: isDeleted ? Colors.grey : null,
                          ),
                          trailing: isDeleted
                              ? TextButton(
                                  onPressed: () => _onRestoreAccount(account),
                                  child: Text(
                                    I18nService.translateRestore(locale),
                                  ),
                                )
                              : const Icon(Icons.chevron_right),
                          onTap: isDeleted ? null : () => _onAccountTapped(account),
                        );
                      }),
                      const SizedBox(height: 16),
                    ],
                    const Divider(),
                    ListTile(
                      title: Text(accountSettingsLabel),
                      leading: const Icon(Icons.add),
                      onTap: _onAccountSettingsPressed,
                    ),
                    const Divider(),
                    // 法的情報リンク
                    Text(
                      I18nService.translateLegal(locale),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    ListTile(
                      title: Text(I18nService.translatePrivacyPolicy(locale)),
                      leading: const Icon(Icons.privacy_tip),
                      trailing: const Icon(Icons.open_in_new),
                      onTap: () => _openLink(locale, _getPrivacyPolicyUrl(locale)),
                    ),
                    ListTile(
                      title: Text(I18nService.translateTermsOfService(locale)),
                      leading: const Icon(Icons.description),
                      trailing: const Icon(Icons.open_in_new),
                      onTap: () => _openLink(locale, _getTermsOfServiceUrl(locale)),
                    ),
                    ListTile(
                      title: Text(I18nService.translatePricingBilling(locale)),
                      leading: const Icon(Icons.attach_money),
                      trailing: const Icon(Icons.open_in_new),
                      onTap: () => _openLink(locale, _getCommercialTransactionUrl(locale)),
                    ),
                    const Divider(),
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
          );
        },
      ),
    );
  }
}


