import 'package:cloudinbox_mobile_app/screens/settings_screen.dart';
import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:flutter/material.dart';

/// ナビゲーションドロワー
class NavigationDrawer extends StatefulWidget {
  const NavigationDrawer({
    super.key,
    required this.settingsRepository,
    required this.currentRoute,
    required this.onNavigate,
  });

  final SettingsRepository settingsRepository;
  final String currentRoute;
  final void Function(String route) onNavigate;

  @override
  State<NavigationDrawer> createState() => _NavigationDrawerState();
}

class _NavigationDrawerState extends State<NavigationDrawer> {
  SettingsData? _settingsData;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    try {
      final data = await widget.settingsRepository.loadSettings();
      if (mounted) {
        setState(() {
          _settingsData = data;
        });
      }
    } catch (e) {
      // エラーは無視（プラン情報が表示されないだけ）
    }
  }

  void _onMenuItemTap(String route) {
    Navigator.of(context).pop();
    widget.onNavigate(route);
  }

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final inboxLabel = I18nService.translateInbox(locale);
    final allMailLabel = I18nService.translateAllMail(locale);
    final trashLabel = I18nService.translateTrash(locale);
    final settingsLabel = I18nService.translateSettings(locale);

    return Drawer(
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                ListTile(
                  leading: const Icon(Icons.inbox),
                  title: Text(inboxLabel),
                  selected: widget.currentRoute == '/inbox',
                  onTap: () => _onMenuItemTap('/inbox'),
                ),
                ListTile(
                  leading: const Icon(Icons.email),
                  title: Text(allMailLabel),
                  selected: widget.currentRoute == '/all',
                  onTap: () => _onMenuItemTap('/all'),
                ),
                ListTile(
                  leading: const Icon(Icons.delete),
                  title: Text(trashLabel),
                  selected: widget.currentRoute == '/trash',
                  onTap: () => _onMenuItemTap('/trash'),
                ),
                ListTile(
                  leading: const Icon(Icons.settings),
                  title: Text(settingsLabel),
                  selected: widget.currentRoute == '/settings',
                  onTap: () => _onMenuItemTap('/settings'),
                ),
              ],
            ),
          ),
          if (_settingsData != null)
            Container(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Plan: ${_settingsData!.planLabel}'),
                  const SizedBox(height: 4),
                  Text(
                    'Used: ${I18nService.formatBytes(_settingsData!.usedStorageBytes, context)} / ${I18nService.formatBytes(_settingsData!.maxStorageBytes, context)}',
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Available: ${I18nService.formatBytes(_settingsData!.maxStorageBytes - _settingsData!.usedStorageBytes, context)}',
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

