import 'package:cloudinbox_mobile_app/screens/account_screen.dart';
import 'package:cloudinbox_mobile_app/screens/settings_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeSettingsRepository implements SettingsRepository {
  _FakeSettingsRepository(this.data, {this.shouldThrow = false});

  final SettingsData data;
  final bool shouldThrow;
  bool loadCalled = false;

  @override
  Future<SettingsData> loadSettings() async {
    loadCalled = true;
    if (shouldThrow) {
      throw Exception('load error');
    }
    return data;
  }
}

class _FakeAccountRepository implements AccountRepository {
  @override
  Future<void> testConnection(AccountFormData data) async {}

  @override
  Future<void> createAccount(AccountFormData data) async {}
}

bool _signOutCalled = false;

void main() {
  group('SettingsScreen', () {
    testWidgets('プラン情報と使用量が表示される', (tester) async {
      final repo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 1073741824,
        ),
      );

      _signOutCalled = false;
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
          home: SettingsScreen(
            repository: repo,
            accountRepository: _FakeAccountRepository(),
            onLogout: () async {
              _signOutCalled = true;
            },
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.textContaining('Free'), findsOneWidget);
      expect(find.textContaining('2147483648'), findsOneWidget);
      expect(find.textContaining('1073741824'), findsOneWidget);
      expect(repo.loadCalled, isTrue);
    });

    testWidgets('読み込みエラー時にエラーメッセージを表示する', (tester) async {
      final repo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
        ),
        shouldThrow: true,
      );

      _signOutCalled = false;
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
          home: SettingsScreen(
            repository: repo,
            accountRepository: _FakeAccountRepository(),
            onLogout: () async {
              _signOutCalled = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('error'), findsOneWidget);
    });

    testWidgets('メールアカウント設定メニュー項目が表示される', (tester) async {
      final repo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
        ),
      );

      _signOutCalled = false;
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
          home: SettingsScreen(
            repository: repo,
            accountRepository: _FakeAccountRepository(),
            onLogout: () async {
              _signOutCalled = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('メールアカウント設定'), findsOneWidget);
    });

    testWidgets('ログアウトメニュー項目が表示される', (tester) async {
      final repo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
        ),
      );

      _signOutCalled = false;
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
          home: SettingsScreen(
            repository: repo,
            accountRepository: _FakeAccountRepository(),
            onLogout: () async {
              _signOutCalled = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('ログアウト'), findsOneWidget);
    });

    testWidgets('メールアカウント設定タップ時にAccountScreenへ遷移する', (tester) async {
      final repo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
        ),
      );
      final accountRepo = _FakeAccountRepository();

      _signOutCalled = false;
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
          home: SettingsScreen(
            repository: repo,
            accountRepository: accountRepo,
            onLogout: () async {
              _signOutCalled = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('メールアカウント設定'));
      await tester.pumpAndSettle();

      expect(find.byType(AccountScreen), findsOneWidget);
    });

    testWidgets('ログアウトタップ時にonLogoutコールバックが呼ばれる', (tester) async {
      final repo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
        ),
      );
      _signOutCalled = false;

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
          home: SettingsScreen(
            repository: repo,
            accountRepository: _FakeAccountRepository(),
            onLogout: () async {
              _signOutCalled = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('ログアウト'));
      await tester.pumpAndSettle();

      expect(_signOutCalled, isTrue);
    });
  });
}



