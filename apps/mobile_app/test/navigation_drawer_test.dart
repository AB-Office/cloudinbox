import 'package:cloudinbox_mobile_app/screens/account_screen.dart';
import 'package:cloudinbox_mobile_app/screens/mail_list_screen.dart';
import 'package:cloudinbox_mobile_app/screens/settings_screen.dart';
import 'package:cloudinbox_mobile_app/widgets/navigation_drawer.dart' as app_drawer;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeInboxRepository implements InboxRepository {
  @override
  Future<InboxPage> loadFirstPage(int limit) async {
    return const InboxPage(threads: [], hasMore: false);
  }

  @override
  Future<InboxPage> loadNextPage(int limit) async {
    return const InboxPage(threads: [], hasMore: false);
  }
}

class _FakeSettingsRepository implements SettingsRepository {
  _FakeSettingsRepository(this.data);

  final SettingsData data;

  @override
  Future<SettingsData> loadSettings() async => data;
}

class _FakeAccountRepository implements AccountRepository {
  @override
  Future<void> testConnection(AccountFormData data) async {}

  @override
  Future<void> createAccount(AccountFormData data) async {}
}

void main() {
  group('NavigationDrawer', () {
    testWidgets('受信トレイメニュー項目が表示される', (tester) async {
      final settingsRepo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 1073741824,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: Scaffold(
            drawer: app_drawer.NavigationDrawer(
              settingsRepository: settingsRepo,
              currentRoute: '/inbox',
              onNavigate: (route) {},
            ),
            body: const Center(child: Text('Test')),
          ),
        ),
      );

      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      expect(find.text('受信トレイ'), findsOneWidget);
    });

    testWidgets('すべてのメールメニュー項目が表示される', (tester) async {
      final settingsRepo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: Scaffold(
            drawer: app_drawer.NavigationDrawer(
              settingsRepository: settingsRepo,
              currentRoute: '/inbox',
              onNavigate: (route) {},
            ),
            body: const Center(child: Text('Test')),
          ),
        ),
      );

      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      expect(find.text('すべてのメール'), findsOneWidget);
    });

    testWidgets('ゴミ箱メニュー項目が表示される', (tester) async {
      final settingsRepo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: Scaffold(
            drawer: app_drawer.NavigationDrawer(
              settingsRepository: settingsRepo,
              currentRoute: '/inbox',
              onNavigate: (route) {},
            ),
            body: const Center(child: Text('Test')),
          ),
        ),
      );

      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      expect(find.text('ゴミ箱'), findsOneWidget);
    });

    testWidgets('設定メニュー項目が表示される', (tester) async {
      final settingsRepo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: Scaffold(
            drawer: app_drawer.NavigationDrawer(
              settingsRepository: settingsRepo,
              currentRoute: '/inbox',
              onNavigate: (route) {},
            ),
            body: const Center(child: Text('Test')),
          ),
        ),
      );

      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      expect(find.text('設定'), findsOneWidget);
    });

    testWidgets('プラン情報と使用量が表示される', (tester) async {
      final settingsRepo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 1073741824,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: Scaffold(
            drawer: app_drawer.NavigationDrawer(
              settingsRepository: settingsRepo,
              currentRoute: '/inbox',
              onNavigate: (route) {},
            ),
            body: const Center(child: Text('Test')),
          ),
        ),
      );

      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      expect(find.textContaining('Free'), findsOneWidget);
    });

    testWidgets('受信トレイタップ時にonNavigateが呼ばれる', (tester) async {
      final settingsRepo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
        ),
      );
      String? navigatedRoute;
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: Scaffold(
            drawer: app_drawer.NavigationDrawer(
              settingsRepository: settingsRepo,
              currentRoute: '/all',
              onNavigate: (route) {
                navigatedRoute = route;
              },
            ),
            body: const Center(child: Text('Test')),
          ),
        ),
      );

      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();
      await tester.tap(find.text('受信トレイ'));
      await tester.pumpAndSettle();

      expect(navigatedRoute, '/inbox');
    });

    testWidgets('設定タップ時にonNavigateが呼ばれる', (tester) async {
      final settingsRepo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
        ),
      );
      String? navigatedRoute;
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja', ''),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          home: Scaffold(
            drawer: app_drawer.NavigationDrawer(
              settingsRepository: settingsRepo,
              currentRoute: '/inbox',
              onNavigate: (route) {
                navigatedRoute = route;
              },
            ),
            body: const Center(child: Text('Test')),
          ),
        ),
      );

      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();
      await tester.tap(find.text('設定'));
      await tester.pumpAndSettle();

      expect(navigatedRoute, '/settings');
    });
  });
}

