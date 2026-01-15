import 'dart:async';

import 'package:cloudinbox_mobile_app/screens/account_screen.dart';
import 'package:cloudinbox_mobile_app/screens/settings_screen.dart';
import 'package:cloudinbox_mobile_app/screens/legal_document_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeSettingsRepository implements SettingsRepository {
  _FakeSettingsRepository(this.data, {this.shouldThrow = false});

  final SettingsData data;
  final bool shouldThrow;
  bool loadCalled = false;
  final StreamController<SettingsData> _controller = StreamController<SettingsData>.broadcast();

  @override
  Future<SettingsData> loadSettings() async {
    loadCalled = true;
    if (shouldThrow) {
      throw Exception('load error');
    }
    return data;
  }

  @override
  Stream<SettingsData> watchSettings() {
    if (shouldThrow) {
      return Stream.error(Exception('load error'));
    }
    _controller.add(data);
    return _controller.stream;
  }

  void dispose() {
    _controller.close();
  }
}

class _FakeAccountRepository implements AccountRepository {
  @override
  Future<AccountTestResult> testConnection(AccountFormData data) async {
    return const AccountTestResult(success: true);
  }

  @override
  Future<AccountTestResult> testSmtpConnection(AccountFormData data) async {
    return const AccountTestResult(success: true);
  }

  @override
  Future<void> createAccount(AccountFormData data) async {}

  @override
  Future<List<MailAccount>> listAccounts({bool includeInactive = false}) async {
    return [];
  }

  @override
  Future<MailAccount?> getAccount(String accountId) async {
    return null;
  }

  @override
  Future<void> updateAccount(String accountId, AccountFormData data) async {}

  @override
  Future<void> deleteAccount(String accountId) async {}

  @override
  Future<void> restoreAccount(String accountId) async {}

  @override
  Future<void> permanentlyDeleteAccount(String accountId) async {}
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

      // formatBytesを使った表示を確認（GB、MBなど）
      expect(find.textContaining('GB'), findsWidgets);
      // 利用率（％）が表示されることを確認
      expect(find.textContaining('%'), findsOneWidget);
      
      repo.dispose();
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
      
      repo.dispose();
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
      
      repo.dispose();
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
      
      repo.dispose();
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
      
      repo.dispose();
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
      
      repo.dispose();
    });

    testWidgets('プライバシーポリシーリンクタップ時にLegalDocumentScreenへ遷移する', (tester) async {
      final repo = _FakeSettingsRepository(
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
          home: SettingsScreen(
            repository: repo,
            accountRepository: _FakeAccountRepository(),
            onLogout: () async {},
          ),
        ),
      );

      await tester.pumpAndSettle();

      // プライバシーポリシーリンクをタップ
      final privacyLink = find.text('プライバシーポリシー');
      await tester.tap(privacyLink);
      await tester.pumpAndSettle();

      // LegalDocumentScreenに遷移することを確認
      expect(find.byType(LegalDocumentScreen), findsOneWidget);
      
      repo.dispose();
    });

    testWidgets('利用規約リンクタップ時にLegalDocumentScreenへ遷移する', (tester) async {
      final repo = _FakeSettingsRepository(
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
          home: SettingsScreen(
            repository: repo,
            accountRepository: _FakeAccountRepository(),
            onLogout: () async {},
          ),
        ),
      );

      await tester.pumpAndSettle();

      // 利用規約リンクをタップ
      final termsLink = find.text('利用規約');
      await tester.tap(termsLink);
      await tester.pumpAndSettle();

      // LegalDocumentScreenに遷移することを確認
      expect(find.byType(LegalDocumentScreen), findsOneWidget);
      
      repo.dispose();
    });

    testWidgets('日本語環境で特定商取引法リンクが表示され、タップ時にLegalDocumentScreenへ遷移する', (tester) async {
      final repo = _FakeSettingsRepository(
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
          home: SettingsScreen(
            repository: repo,
            accountRepository: _FakeAccountRepository(),
            onLogout: () async {},
          ),
        ),
      );

      await tester.pumpAndSettle();

      // 特定商取引法リンクが表示されることを確認（pricingBillingは日本語では「特定商取引法に基づく表記」を返す）
      final commercialLink = find.text('特定商取引法に基づく表記');
      expect(commercialLink, findsOneWidget);

      // リンクをタップ
      await tester.tap(commercialLink);
      await tester.pumpAndSettle();

      // LegalDocumentScreenに遷移することを確認
      expect(find.byType(LegalDocumentScreen), findsOneWidget);
      
      repo.dispose();
    });

    testWidgets('英語環境でPricing/Billingリンクが表示され、タップ時にLegalDocumentScreenへ遷移する', (tester) async {
      final repo = _FakeSettingsRepository(
        const SettingsData(
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en', ''),
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
            onLogout: () async {},
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Pricing/Billingリンクが表示されることを確認
      final pricingLink = find.text('Pricing / Billing');
      expect(pricingLink, findsOneWidget);

      // リンクをタップ
      await tester.tap(pricingLink);
      await tester.pumpAndSettle();

      // LegalDocumentScreenに遷移することを確認
      expect(find.byType(LegalDocumentScreen), findsOneWidget);
      
      repo.dispose();
    });

    testWidgets('外部URLを開かない（url_launcherを使用しない）', (tester) async {
      final repo = _FakeSettingsRepository(
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
          home: SettingsScreen(
            repository: repo,
            accountRepository: _FakeAccountRepository(),
            onLogout: () async {},
          ),
        ),
      );

      await tester.pumpAndSettle();

      // プライバシーポリシーリンクをタップ
      final privacyLink = find.text('プライバシーポリシー');
      await tester.tap(privacyLink);
      await tester.pumpAndSettle();

      // LegalDocumentScreenに遷移することを確認（外部URLは開かない）
      expect(find.byType(LegalDocumentScreen), findsOneWidget);
      
      repo.dispose();
    });
  });
}



