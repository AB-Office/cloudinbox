import 'dart:async';

import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:cloudinbox_mobile_app/screens/auth_screen.dart';

/// テスト用のシンプルな AuthRepository 実装
class _FakeAuthRepository implements AuthRepository {
  final StreamController<bool> _controller = StreamController<bool>.broadcast();
  bool signInCalled = false;

  @override
  Stream<bool> authStateChanges() => _controller.stream;

  @override
  Future<void> signInWithGoogle() async {
    signInCalled = true;
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
    testWidgets('ログイン用のボタンが表示される', (tester) async {
      final repo = _FakeAuthRepository();

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja'),
          home: AuthScreen(
            repository: repo,
            onSignedIn: () {},
          ),
        ),
      );

      // ログインアクション用のボタンが 1 つ表示されること
      expect(find.byType(ElevatedButton), findsOneWidget);

      repo.dispose();
    });

    testWidgets('ログインボタン押下で signInWithGoogle が呼ばれる', (tester) async {
      final repo = _FakeAuthRepository();

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja'),
          home: AuthScreen(
            repository: repo,
            onSignedIn: () {},
          ),
        ),
      );

      await tester.tap(find.byType(ElevatedButton));
      await tester.pump();

      expect(repo.signInCalled, isTrue);

      repo.dispose();
    });

    testWidgets('認証状態が true になったら onSignedIn が呼ばれる', (tester) async {
      final repo = _FakeAuthRepository();
      var signedInCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ja'),
          home: AuthScreen(
            repository: repo,
            onSignedIn: () {
              signedInCalled = true;
            },
          ),
        ),
      );

      repo.emitAuthState(true);
      await tester.pump();

      expect(signedInCalled, isTrue);

      repo.dispose();
    });
  });
}


