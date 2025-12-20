import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:cloudinbox_mobile_app/screens/auth_screen.dart';

/// テスト用のシンプルな AuthRepository 実装
class _FakeAuthRepository implements AuthRepository {
  final StreamController<bool> _controller = StreamController<bool>.broadcast();
  bool signInCalled = false;
  bool signInWithAppleCalled = false;

  @override
  Stream<bool> authStateChanges() => _controller.stream;

  @override
  Future<void> signInWithGoogle() async {
    signInCalled = true;
  }

  @override
  Future<void> signInWithApple() async {
    signInWithAppleCalled = true;
  }

  void emitAuthState(bool authed) {
    _controller.add(authed);
  }

  void dispose() {
    _controller.close();
  }
}

void main() {
  group('AuthScreen', () {
    testWidgets('Googleログイン用のボタンが表示される', (tester) async {
      final repo = _FakeAuthRepository();

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja'),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja'),
            Locale('en'),
          ],
          home: AuthScreen(
            repository: repo,
            onSignedIn: () {},
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Googleログインボタンのラベルが表示されること
      expect(find.textContaining('Google'), findsOneWidget);
      // Appleログインボタンは非表示
      expect(find.textContaining('Apple'), findsNothing);

      repo.dispose();
    });

    testWidgets('ログインボタン押下で signInWithGoogle が呼ばれる', (tester) async {
      final repo = _FakeAuthRepository();

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja'),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja'),
            Locale('en'),
          ],
          home: AuthScreen(
            repository: repo,
            onSignedIn: () {},
          ),
        ),
      );

      await tester.pumpAndSettle();
      // Googleログインボタンをタップ
      await tester.tap(find.textContaining('Google'));
      await tester.pump();
      // Future.delayedを処理
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump(); // 追加のpumpでコールバックを処理

      expect(repo.signInCalled, isTrue);
      expect(repo.signInWithAppleCalled, isFalse);

      repo.dispose();
    });

    testWidgets('認証成功後に onSignedIn が呼ばれる', (tester) async {
      final repo = _FakeAuthRepository();
      var signedInCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja'),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja'),
            Locale('en'),
          ],
          home: AuthScreen(
            repository: repo,
            onSignedIn: () {
              signedInCalled = true;
            },
          ),
        ),
      );

      await tester.pumpAndSettle();
      // Googleログインボタンをタップ
      await tester.tap(find.textContaining('Google'));
      await tester.pump();
      // Future.delayedを処理
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump(); // 追加のpumpでコールバックを処理

      expect(signedInCalled, isTrue);

      repo.dispose();
    });
  });
}


