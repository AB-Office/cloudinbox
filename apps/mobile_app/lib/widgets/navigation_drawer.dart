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
  void _onMenuItemTap(String route) {
    Navigator.of(context).pop();
    widget.onNavigate(route);
  }

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final inboxLabel = I18nService.translateInbox(locale);
    final allMailLabel = I18nService.translateAllMail(locale);
    final sentLabel = I18nService.translateSent(locale);
    final trashLabel = I18nService.translateTrash(locale);
    final settingsLabel = I18nService.translateSettings(locale);

    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            // ヘッダー: CloudInboxの文字と水平線
            Container(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'CloudInbox',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const Divider(),
                ],
              ),
            ),
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
                    leading: const Icon(Icons.send),
                    title: Text(sentLabel),
                    selected: widget.currentRoute == '/sent',
                    onTap: () => _onMenuItemTap('/sent'),
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
            // StreamBuilderでリアルタイム更新
            StreamBuilder<SettingsData>(
              stream: widget.settingsRepository.watchSettings(),
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return const SizedBox.shrink();
                }
                final settingsData = snapshot.data!;
                return Container(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${I18nService.translatePlan(locale)}: ${settingsData.planLabel}'),
                      const SizedBox(height: 4),
                      Text(
                        '${I18nService.translateUsed(locale)}: ${I18nService.formatBytes(settingsData.usedStorageBytes, context)} / ${I18nService.formatBytes(settingsData.maxStorageBytes, context)} (${(settingsData.usedStorageBytes / settingsData.maxStorageBytes * 100).toStringAsFixed(1)}%)',
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${I18nService.translateAvailable(locale)}: ${I18nService.formatBytes(settingsData.maxStorageBytes - settingsData.usedStorageBytes, context)}',
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

