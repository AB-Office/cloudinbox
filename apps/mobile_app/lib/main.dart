import 'package:cloudinbox_mobile_app/screens/auth_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CloudInbox',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('ja', ''),
        Locale('en', ''),
      ],
      home: AuthScreen(
        // 実際の Firebase Auth 実装は後続タスクで注入する。
        repository: _StubAuthRepository(),
        onSignedIn: () {
          // MVP 初期段階では、ホーム画面遷移は後続タスクで実装。
        },
      ),
    );
  }
}

/// 仮の実装（Firebase Auth 連携は別タスク）
class _StubAuthRepository implements AuthRepository {
  @override
  Stream<bool> authStateChanges() async* {
    yield false;
  }

  @override
  Future<void> signInWithGoogle() async {
    // no-op
  }
}


