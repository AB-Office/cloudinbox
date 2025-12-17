import 'dart:async';

import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:flutter/material.dart';

/// 認証リポジトリの抽象インターフェース
///
/// - [authStateChanges] で認証状態（true: 認証済み）を通知
/// - [signInWithGoogle] で Google サインインを開始
abstract class AuthRepository {
  Stream<bool> authStateChanges();
  Future<void> signInWithGoogle();
}

/// Firebase Auth + Google Sign-In 実装は別途用意し、
/// この画面には抽象 [AuthRepository] のみを依存させる。

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.repository,
    required this.onSignedIn,
  });

  final AuthRepository repository;
  final VoidCallback onSignedIn;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  late final StreamSubscription<bool> _sub;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _sub = widget.repository.authStateChanges().listen((authed) {
      if (authed) {
        widget.onSignedIn();
      }
    });
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }

  Future<void> _onLoginPressed() async {
    setState(() {
      _isLoading = true;
    });
    try {
      await widget.repository.signInWithGoogle();
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final loginLabel = I18nService.translateLogin(locale);

    return Scaffold(
      appBar: AppBar(
        title: const Text('CloudInbox'),
      ),
      body: Center(
        child: _isLoading
            ? const CircularProgressIndicator()
            : ElevatedButton(
                onPressed: _onLoginPressed,
                child: Text(loginLabel),
              ),
      ),
    );
  }
}


