import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:flutter/material.dart';

/// 認証リポジトリの抽象インターフェース
///
/// - [authStateChanges] で認証状態（true: 認証済み）を通知
/// - [signInWithGoogle] で Google サインインを開始
/// - [signInWithApple] で Apple サインインを開始
abstract class AuthRepository {
  Stream<bool> authStateChanges();
  Future<void> signInWithGoogle();
  Future<void> signInWithApple();
}

/// Firebase Auth + Google Sign-In / Apple Sign-In 実装は別途用意し、
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
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _onLoginPressed() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      await widget.repository.signInWithGoogle();
      // 認証成功後、コールバックを呼んで画面を更新
      await Future.delayed(const Duration(milliseconds: 200));
      if (mounted) {
        widget.onSignedIn();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = _getErrorMessage(e);
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  String _getErrorMessage(dynamic error) {
    final errorString = error.toString();
    if (errorString.contains('ApiException: 10') ||
        errorString.contains('DEVELOPER_ERROR')) {
      return 'Google Sign-Inの設定エラーです。\n'
          'SHA-1フィンガープリントがFirebase Consoleに登録されているか確認してください。\n'
          'SHA-1: E9:51:EF:E3:66:77:5F:66:C8:DA:F2:00:9B:DB:B9:F3:95:50:B4:E9';
    }
    return 'ログインに失敗しました: $error';
  }

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final loginWithGoogleLabel = I18nService.translateLoginWithGoogle(locale);

    return Scaffold(
      appBar: AppBar(
        title: const Text('CloudInbox'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16.0),
                  child: Container(
                    padding: const EdgeInsets.all(12.0),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      border: Border.all(color: Colors.red.shade300),
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: TextStyle(
                        color: Colors.red.shade900,
                        fontSize: 12,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              if (_isLoading)
                const CircularProgressIndicator()
              else
                _buildGoogleSignInButton(loginWithGoogleLabel),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGoogleSignInButton(String label) {
    return OutlinedButton.icon(
      onPressed: _onLoginPressed,
      icon: Image.asset(
        'assets/google_logo.png',
        height: 20,
        width: 20,
        errorBuilder: (context, error, stackTrace) {
          // アセットがない場合はGoogleの「G」ロゴを代替表示
          return Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              color: const Color(0xFF4285F4), // Google Blue
              borderRadius: BorderRadius.circular(2),
            ),
            child: const Center(
              child: Text(
                'G',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          );
        },
      ),
      label: Text(
        label,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w500,
          color: Color(0xFF3C4043), // Google Dark Gray
        ),
      ),
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        minimumSize: const Size(double.infinity, 48),
        side: const BorderSide(color: Color(0xFFDADCE0)), // Google Gray
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(4),
        ),
      ),
    );
  }
}

