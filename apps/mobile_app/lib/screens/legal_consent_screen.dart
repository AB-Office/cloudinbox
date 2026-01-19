import 'package:flutter/material.dart';
import 'package:cloudinbox_mobile_app/services/consent_service.dart';
import 'package:cloudinbox_mobile_app/services/legal_document_service.dart';
import 'package:cloudinbox_mobile_app/screens/legal_document_screen.dart';
import 'package:cloudinbox_mobile_app/screens/mail_list_screen.dart';
import 'package:cloudinbox_mobile_app/l10n/app_localizations.dart';
import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloudinbox_mobile_app/main.dart' show FirebaseInboxRepository, FirebaseSettingsRepository, FirebaseMailComposeRepository, FirebaseAccountRepository;

/// Legal Consent Screen
///
/// Screen for displaying legal consent checkboxes and saving consent
class LegalConsentScreen extends StatefulWidget {
  const LegalConsentScreen({
    super.key,
    this.isReconsent = false,
  });

  final bool isReconsent; // 再確認かどうか

  @override
  State<LegalConsentScreen> createState() => _LegalConsentScreenState();
}

class _LegalConsentScreenState extends State<LegalConsentScreen> {
  bool _termsChecked = false;
  bool _privacyChecked = false;
  bool _termsRead = false; // 利用規約を読んだかどうか
  bool _privacyRead = false; // プライバシーポリシーを読んだかどうか
  String? _termsVersion;
  String? _privacyVersion;
  bool _loading = false;
  String? _error;
  late final ConsentService _consentService;
  late final LegalDocumentService _documentService;

  @override
  void initState() {
    super.initState();
    _consentService = ConsentService();
    _documentService = LegalDocumentService();
    _loadDocumentVersions();
  }

  /// 現在のロケールを取得
  Locale _getCurrentLocale() {
    return Localizations.localeOf(context);
  }

  /// 法的文書のバージョンを取得
  Future<void> _loadDocumentVersions() async {
    try {
      final locale = _getCurrentLocale();
      _termsVersion = await _documentService.getDocumentMetadata('terms', locale.languageCode);
      _privacyVersion = await _documentService.getDocumentMetadata('privacy', locale.languageCode);
    } catch (e) {
      // メタデータ取得エラーは警告のみ（同意時にもう一度取得を試みる）
      debugPrint('Warning: Failed to fetch document metadata: $e');
    }
  }

  /// 法的文書を開く
  Future<void> _openDocument(String documentType) async {
    final locale = _getCurrentLocale();
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => LegalDocumentScreen(
          documentType: documentType,
          locale: locale,
          onReadComplete: () {
            // 文書を読み終えたときに呼ばれるコールバック
            setState(() {
              if (documentType == 'terms') {
                _termsRead = true;
              } else if (documentType == 'privacy') {
                _privacyRead = true;
              }
            });
          },
        ),
      ),
    );
  }

  /// 同意を送信
  Future<void> _handleConsent() async {
    if (!_canSubmit() || _loading) {
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      // メタデータを取得してバージョンを確定（まだ取得していない場合）
      final locale = _getCurrentLocale();
      if (_termsVersion == null || _privacyVersion == null) {
        _termsVersion = await _documentService.getDocumentMetadata('terms', locale.languageCode);
        _privacyVersion = await _documentService.getDocumentMetadata('privacy', locale.languageCode);
      }

      // 同意を保存
      await _consentService.saveConsent(_termsVersion!, _privacyVersion!);

      // メイン画面（/inbox）に遷移
      if (mounted) {
        // MaterialAppのNavigatorを使用して、MailListScreenに遷移
        final currentUser = FirebaseAuth.instance.currentUser;
        if (currentUser != null) {
          final inboxRepository = FirebaseInboxRepository(currentUser.uid, '/inbox');
          final locale = Localizations.localeOf(context);
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(
              builder: (context) => MailListScreen(
                key: const ValueKey('mail_list_inbox'),
                repository: inboxRepository,
                title: I18nService.translateInbox(locale),
                settingsRepository: FirebaseSettingsRepository(),
                currentRoute: '/inbox',
                onNavigate: (route) {
                  // ナビゲーションは親のNavigatorで処理される
                  // ここでは何もしない（必要に応じて実装）
                },
                composeRepository: FirebaseMailComposeRepository(),
                accountRepository: FirebaseAccountRepository(),
              ),
            ),
            (route) => false, // すべてのルートを削除
          );
        } else {
          // ユーザーが認証されていない場合はエラー
          setState(() {
            _error = 'ユーザーが認証されていません';
            _loading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
      final localizations = AppLocalizations.of(context);
      setState(() {
        _error = localizations?.legalConsentSaveError(e.toString()) ?? '同意の保存に失敗しました: ${e.toString()}';
        _loading = false;
      });
        // エラーメッセージをSnackBarで表示
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_error!),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  /// 提出可能かどうか
  bool _canSubmit() {
    return _termsChecked && _privacyChecked;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text(localizations?.legalConsentTitle ?? '利用規約・プライバシーポリシーへの同意'),
        automaticallyImplyLeading: false, // 戻るボタンを無効化（スキップできないようにする）
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 再確認の場合のメッセージ
            if (widget.isReconsent)
              Container(
                padding: const EdgeInsets.all(16.0),
                margin: const EdgeInsets.only(bottom: 16.0),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(8.0),
                  border: Border.all(color: Colors.blue.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.blue.shade700),
                    const SizedBox(width: 8.0),
                    Expanded(
                      child: Text(
                        localizations?.legalConsentReconsentMessage ?? '法的文書が更新されました。最新版に同意してください。',
                        style: TextStyle(color: Colors.blue.shade900),
                      ),
                    ),
                  ],
                ),
              ),

            // エラーメッセージ
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(16.0),
                margin: const EdgeInsets.only(bottom: 16.0),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8.0),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.red.shade700),
                    const SizedBox(width: 8.0),
                    Expanded(
                      child: Text(
                        _error!,
                        style: TextStyle(color: Colors.red.shade900),
                      ),
                    ),
                  ],
                ),
              ),

            // 説明文
            Text(
              localizations?.legalConsentDescription ?? 'CloudInboxをご利用いただくには、利用規約とプライバシーポリシーへの同意が必要です。以下のチェックボックスにチェックを入れて同意してください。',
              style: const TextStyle(fontSize: 16.0, height: 1.6),
            ),
            const SizedBox(height: 24.0),

            // チェックボックス
            Row(
              children: [
                Expanded(
                  child: CheckboxListTile(
                    title: Text(localizations?.legalConsentAgreeTerms ?? '利用規約に同意する'),
                    value: _termsChecked,
                    enabled: true, // 常に有効（表示ボタンを押せるようにする）
                    onChanged: _termsRead
                        ? (value) {
                            setState(() {
                              _termsChecked = value ?? false;
                            });
                          }
                        : null, // 読んでいない場合はチェックできない
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
                TextButton(
                  onPressed: () => _openDocument('terms'),
                  child: Text(_termsRead 
                    ? (localizations?.legalConsentViewAgain ?? '再表示')
                    : (localizations?.legalConsentView ?? '表示')),
                ),
              ],
            ),
            if (!_termsRead)
              Padding(
                padding: const EdgeInsets.only(left: 48.0, bottom: 8.0),
                child: Text(
                  localizations?.legalConsentReadFullText ?? '（全文を読んでください）',
                  style: const TextStyle(fontSize: 12.0, color: Colors.grey),
                ),
              ),
            const SizedBox(height: 8.0),
            Row(
              children: [
                Expanded(
                  child: CheckboxListTile(
                    title: Text(localizations?.legalConsentAgreePrivacy ?? 'プライバシーポリシーに同意する'),
                    value: _privacyChecked,
                    enabled: true, // 常に有効（表示ボタンを押せるようにする）
                    onChanged: _privacyRead
                        ? (value) {
                            setState(() {
                              _privacyChecked = value ?? false;
                            });
                          }
                        : null, // 読んでいない場合はチェックできない
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
                TextButton(
                  onPressed: () => _openDocument('privacy'),
                  child: Text(_privacyRead 
                    ? (localizations?.legalConsentViewAgain ?? '再表示')
                    : (localizations?.legalConsentView ?? '表示')),
                ),
              ],
            ),
            if (!_privacyRead)
              Padding(
                padding: const EdgeInsets.only(left: 48.0),
                child: Text(
                  localizations?.legalConsentReadFullText ?? '（全文を読んでください）',
                  style: const TextStyle(fontSize: 12.0, color: Colors.grey),
                ),
              ),

            const SizedBox(height: 32.0),

            // 同意するボタン
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _canSubmit() && !_loading ? _handleConsent : null,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16.0),
                ),
                child: _loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : Text(
                        localizations?.legalConsentSubmit ?? '同意する',
                        style: const TextStyle(fontSize: 16.0),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

