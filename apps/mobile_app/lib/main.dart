import 'dart:async';

import 'package:cloudinbox_mobile_app/screens/auth_screen.dart';
import 'package:cloudinbox_mobile_app/screens/mail_list_screen.dart';
import 'package:cloudinbox_mobile_app/screens/settings_screen.dart';
import 'package:cloudinbox_mobile_app/screens/account_screen.dart';
import 'package:cloudinbox_mobile_app/screens/detail_screen.dart';
import 'package:cloudinbox_mobile_app/screens/compose_screen.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloudinbox_mobile_app/l10n/app_localizations.dart';
import 'package:cloudinbox_mobile_app/firebase_options_dev.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:cloudinbox_mobile_app/services/i18n_service.dart';
import 'dart:convert';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (const String.fromEnvironment('FLAVOR') == 'prod') {
    //await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  } else {
    await Firebase.initializeApp(options: DefaultFirebaseOptionsDev.currentPlatform);
  }
  // Firebase Authの認証状態の復元を待つ
  // authStateChanges().first は認証状態が復元されるまで待機する
  await FirebaseAuth.instance.authStateChanges().first;
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late final FirebaseAuthRepository _authRepository;
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  String _currentRoute = '/inbox'; // Track current route for drawer highlighting

  @override
  void initState() {
    super.initState();
    _authRepository = FirebaseAuthRepository();
  }

  Widget _buildScreenForRoute(String route, BuildContext context) {
    final currentUser = FirebaseAuth.instance.currentUser;
    final inboxRepository = currentUser != null
        ? FirebaseInboxRepository(currentUser.uid, route)
        : StubInboxRepository();
    
    final locale = Localizations.localeOf(context);
    
    switch (route) {
      case '/inbox':
        return MailListScreen(
          key: const ValueKey('mail_list_inbox'),
          repository: inboxRepository,
          title: I18nService.translateInbox(locale),
          settingsRepository: FirebaseSettingsRepository(),
          currentRoute: '/inbox',
          onNavigate: _navigateToRoute,
          composeRepository: FirebaseMailComposeRepository(),
          accountRepository: FirebaseAccountRepository(),
        );
      case '/all':
        return MailListScreen(
          key: const ValueKey('mail_list_all'),
          repository: inboxRepository,
          title: I18nService.translateAllMail(locale),
          settingsRepository: FirebaseSettingsRepository(),
          currentRoute: '/all',
          onNavigate: _navigateToRoute,
          composeRepository: FirebaseMailComposeRepository(),
          accountRepository: FirebaseAccountRepository(),
        );
        // 注意: InboxRepository側で'/sent'→'sent'のマッピングとデータ存在を必ず保証すること
      case '/sent':
        return MailListScreen(
          key: const ValueKey('mail_list_sent'),
          repository: inboxRepository,
          title: I18nService.translateSent(locale),
          settingsRepository: FirebaseSettingsRepository(),
          currentRoute: '/sent',
          onNavigate: _navigateToRoute,
          composeRepository: FirebaseMailComposeRepository(),
          accountRepository: FirebaseAccountRepository(),
        );
      case '/trash':
        return MailListScreen(
          key: const ValueKey('mail_list_trash'),
          repository: inboxRepository,
          title: I18nService.translateTrash(locale),
          settingsRepository: FirebaseSettingsRepository(),
          currentRoute: '/trash',
          onNavigate: _navigateToRoute,
          composeRepository: FirebaseMailComposeRepository(),
          accountRepository: FirebaseAccountRepository(),
        );
      case '/settings':
        return SettingsScreen(
          key: const ValueKey('settings'),
          repository: FirebaseSettingsRepository(),
          accountRepository: FirebaseAccountRepository(),
          onLogout: _handleLogout,
          currentRoute: '/settings',
          onNavigate: _navigateToRoute,
        );
      case '/compose':
        return ComposeScreen(
          key: const ValueKey('compose_mail'),
          repository: FirebaseMailComposeRepository(),
          accountRepository: FirebaseAccountRepository(),
          intent: const ComposeIntent(),
        );
      default:
        return _buildScreenForRoute('/inbox', context);
    }
  }

  void _navigateToRoute(String route) {
    setState(() {
      _currentRoute = route;
    });
    final navigator = _navigatorKey.currentState;
    if (navigator != null && navigator.context.mounted) {
      navigator.pushReplacement(
        MaterialPageRoute(
          builder: (context) => _buildScreenForRoute(route, context),
        ),
      );
    }
  }

  Future<void> _handleLogout() async {
    debugPrint('Logout initiated');
    try {
      await _authRepository.signOut();
      // Navigatorでログイン画面に遷移
      final navigator = _navigatorKey.currentState;
      if (navigator != null) {
        navigator.pushAndRemoveUntil(
          MaterialPageRoute(
            builder: (context) => AuthScreen(
              key: const ValueKey('auth'),
              repository: _authRepository,
              onSignedIn: () {
                setState(() {
                  _currentRoute = '/inbox';
                });
                _navigateToMailScreen();
              },
            ),
          ),
          (route) => false, // すべてのルートを削除
        );
      }
      debugPrint('Logout completed');
    } catch (e) {
      debugPrint('Error during logout: $e');
      rethrow;
    }
  }

  void _navigateToMailScreen() {
    final navigator = _navigatorKey.currentState;
    if (navigator != null && navigator.context.mounted) {
      navigator.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => _buildScreenForRoute(_currentRoute, context),
        ),
        (route) => false, // すべてのルートを削除
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // StreamBuilderで認証状態を監視し、認証状態の復元を待つ
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      initialData: FirebaseAuth.instance.currentUser,
      builder: (context, snapshot) {
        // 認証状態の復元が完了するまで待つ
        if (snapshot.connectionState == ConnectionState.waiting) {
          return MaterialApp(
            title: 'CloudInbox',
            theme: ThemeData(
              colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
              useMaterial3: true,
            ),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [
              Locale('ja', ''),
              Locale('en', ''),
            ],
            home: const Scaffold(
              body: Center(
                child: CircularProgressIndicator(),
              ),
            ),
          );
        }

        final currentUser = snapshot.data;
        final initialScreen = currentUser != null
            ? Builder(
                builder: (context) => _buildScreenForRoute(_currentRoute, context),
              )
            : AuthScreen(
                key: const ValueKey('auth'),
                repository: _authRepository,
                onSignedIn: () {
                  // 認証成功後、Navigatorで画面遷移
                  setState(() {
                    _currentRoute = '/inbox';
                  });
                  _navigateToMailScreen();
                },
              );
    
        return MaterialApp(
          navigatorKey: _navigatorKey,
          title: 'CloudInbox',
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
            useMaterial3: true,
          ),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('ja', ''),
            Locale('en', ''),
          ],
          localeResolutionCallback: (locale, supportedLocales) {
            // システムのロケールがサポートされている場合はそれを使用
            if (locale != null) {
              for (var supportedLocale in supportedLocales) {
                if (supportedLocale.languageCode == locale.languageCode) {
                  return supportedLocale;
                }
              }
            }
            // デフォルトは英語
            return const Locale('en', '');
          },
          home: initialScreen,
        );
      },
    );
  }
}

/// Firebase Auth + Google Sign-In 実装
class FirebaseAuthRepository implements AuthRepository {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );
  Stream<bool>? _authStateStream;

  @override
  Stream<bool> authStateChanges() {
    _authStateStream ??= _auth.authStateChanges().map((user) {
      final isAuthenticated = user != null;
      debugPrint('FirebaseAuth authStateChanges: user=${user?.uid}, authenticated=$isAuthenticated');
      return isAuthenticated;
    }).distinct();
    return _authStateStream!;
  }

  @override
  Future<void> signInWithGoogle() async {
    // 既存のサインインをクリア（新規ログイン・再ログイン共通）
    await _googleSignIn.signOut();
    
    // Google Sign-In を開始
    final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
    if (googleUser == null) return;
    
    // Google Sign-In から認証情報を取得
    final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
    if (googleAuth.accessToken == null || googleAuth.idToken == null) {
      throw Exception('Failed to get authentication tokens from Google Sign-In');
    }

    // Firebase 認証情報を作成
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );

    // Firebase にサインイン（新規ログイン・再ログイン共通）
    try {
      await _auth.signInWithCredential(credential);
      debugPrint('signInWithCredential succeeded: user=${_auth.currentUser?.uid}');
    } catch (e) {
      // 型キャストエラーは無視（認証は成功している）
      final errorStr = e.toString();
      if (errorStr.contains('PigeonUserDetails') || errorStr.contains('type cast')) {
        debugPrint('Type cast error detected, waiting for auth state update...');
        // 認証状態の更新を待つ（authStateChanges()が発火するまで待機）
        for (int i = 0; i < 10; i++) {
          await Future.delayed(const Duration(milliseconds: 100));
          if (_auth.currentUser != null) {
            debugPrint('Auth state updated: user=${_auth.currentUser?.uid}');
            return;
          }
        }
        debugPrint('WARNING: Auth state not updated after type cast error');
      }
      rethrow;
    }
  }

  @override
  Future<void> signInWithApple() async {
    // Apple認証の実装は後で追加
    throw UnimplementedError('Apple Sign-In is not yet implemented');
  }

  /// ログアウト
  Future<void> signOut() async {
    await Future.wait([
      _auth.signOut(),
      _googleSignIn.signOut(),
    ]);
    debugPrint('Signed out successfully');
  }
}

/// スタブのInboxRepository実装（認証されていない場合に使用）
class StubInboxRepository implements InboxRepository {
  @override
  Stream<InboxPage> watchFirstPage(int limit) {
    // スタブ実装: 空のリストを返すStream
    return Stream.value(const InboxPage(
      threads: [],
      hasMore: false,
    ));
  }

  @override
  Future<InboxPage> loadNextPage(int limit) async {
    // スタブ実装: 空のリストを返す
    await Future.delayed(const Duration(milliseconds: 500));
    return const InboxPage(
      threads: [],
      hasMore: false,
    );
  }
}

/// 実際のFirestoreを使用するInboxRepository実装
class FirebaseInboxRepository implements InboxRepository {
  final String _uid;
  final String _route;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  DocumentSnapshot? _lastDocument;
  
  FirebaseInboxRepository(this._uid, this._route);

  String _getLabel() {
    switch (_route) {
      case '/inbox':
        return 'inbox';
      case '/trash':
        return 'trash';
      case '/sent':
        return 'sent';
      case '/all':
      default:
        return ''; // すべてのメール（ラベルフィルタなし）
    }
  }

  String _formatTimestamp(Timestamp timestamp) {
    final date = timestamp.toDate();
    final now = DateTime.now();
    final difference = now.difference(date);
    
    if (difference.inDays == 0) {
      // 今日: 時刻のみ
      return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } else if (difference.inDays == 1) {
      return '昨日';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}日前';
    } else {
      // 1週間以上前: 日付
      return '${date.year}/${date.month}/${date.day}';
    }
  }

  @override
  Stream<InboxPage> watchFirstPage(int limit) {
    _lastDocument = null; // リセット
    
    Query query = _firestore
        .collection('users')
        .doc(_uid)
        .collection('mailThreads')
        .orderBy('lastMessageAt', descending: true)
        .limit((limit + 1) * 2); // フィルタリングのため多めに取得

    final label = _getLabel();
    
    // リアルタイム更新を監視（snapshots()を使用）
    return query.snapshots().map((snapshot) {
      try {
        var docs = snapshot.docs;
        
        // ラベルでフィルタリング（クライアント側）
        if (label.isNotEmpty) {
          docs = docs.where((doc) {
            final data = doc.data() as Map<String, dynamic>;
            final labels = data['labels'] as List<dynamic>? ?? [];
            return labels.contains(label);
          }).toList();
        }
        
        final hasMore = docs.length > limit;
        final threadsToReturn = hasMore ? docs.sublist(0, limit) : docs;

        if (hasMore && threadsToReturn.isNotEmpty) {
          _lastDocument = threadsToReturn.last;
        } else {
          _lastDocument = null;
        }

        final threads = threadsToReturn.map((doc) {
          final data = doc.data() as Map<String, dynamic>;
          // sentAtを使用（メールの送信日時）、なければlastMessageAtを使用
          final timestamp = data['sentAt'] as Timestamp? ?? data['lastMessageAt'] as Timestamp?;
          return InboxThread(
            id: doc.id,
            subject: data['subject'] as String? ?? '',
            from: data['from'] as String? ?? '',
            preview: data['preview'] as String? ?? '',
            lastMessageAt: timestamp != null
                ? _formatTimestamp(timestamp)
                : '',
            hasUnread: data['hasUnread'] as bool? ?? false,
          );
        }).toList();

        return InboxPage(
          threads: threads,
          hasMore: hasMore,
        );
      } catch (e) {
        debugPrint('Error watching first page: $e');
        return const InboxPage(
          threads: [],
          hasMore: false,
        );
      }
    });
  }

  @override
  Future<InboxPage> loadNextPage(int limit) async {
    if (_lastDocument == null) {
      return const InboxPage(threads: [], hasMore: false);
    }

    try {
      Query query = _firestore
          .collection('users')
          .doc(_uid)
          .collection('mailThreads')
          .orderBy('lastMessageAt', descending: true)
          .startAfterDocument(_lastDocument!)
          .limit((limit + 1) * 2); // フィルタリングのため多めに取得

      final label = _getLabel();
      
      // インデックスが作成されるまでの暫定対応: クライアント側でフィルタリング
      final snapshot = await query.get();
      var docs = snapshot.docs;
      
      // ラベルでフィルタリング（クライアント側）
      if (label.isNotEmpty) {
        docs = docs.where((doc) {
          final data = doc.data() as Map<String, dynamic>;
          final labels = data['labels'] as List<dynamic>? ?? [];
          return labels.contains(label);
        }).toList();
      }
      
      final hasMore = docs.length > limit;
      final threadsToReturn = hasMore ? docs.sublist(0, limit) : docs;

      if (hasMore && threadsToReturn.isNotEmpty) {
        _lastDocument = threadsToReturn.last;
      } else {
        _lastDocument = null;
      }

      final threads = threadsToReturn.map((doc) {
        final data = doc.data() as Map<String, dynamic>;
        // sentAtを使用（メールの送信日時）、なければlastMessageAtを使用
        final timestamp = data['sentAt'] as Timestamp? ?? data['lastMessageAt'] as Timestamp?;
        return InboxThread(
          id: doc.id,
          subject: data['subject'] as String? ?? '',
          from: data['from'] as String? ?? '',
          preview: data['preview'] as String? ?? '',
          lastMessageAt: timestamp != null
              ? _formatTimestamp(timestamp)
              : '',
          hasUnread: data['hasUnread'] as bool? ?? false,
        );
      }).toList();

      return InboxPage(
        threads: threads,
        hasMore: hasMore,
      );
    } catch (e) {
      debugPrint('Error loading next page: $e');
      return const InboxPage(
        threads: [],
        hasMore: false,
      );
    }
  }
}

/// スタブのSettingsRepository実装（後で実際の実装に置き換える）
class StubSettingsRepository implements SettingsRepository {
  @override
  Future<SettingsData> loadSettings() async {
    // スタブ実装: デフォルト値を返す
    await Future.delayed(const Duration(milliseconds: 300));
    return const SettingsData(
      planLabel: 'Free Plan',
      maxStorageBytes: 1024 * 1024 * 1024, // 1GB
      usedStorageBytes: 0,
    );
  }

  @override
  Stream<SettingsData> watchSettings() {
    // スタブ実装: 一度だけ値を返すStream
    return Stream.value(const SettingsData(
      planLabel: 'Free Plan',
      maxStorageBytes: 1024 * 1024 * 1024, // 1GB
      usedStorageBytes: 0,
    ));
  }
}

/// 実際のFirebaseを使用するSettingsRepository実装
class FirebaseSettingsRepository implements SettingsRepository {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  @override
  Future<SettingsData> loadSettings() async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    final userDoc = await _firestore.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      throw Exception('User document not found');
    }

    final data = userDoc.data()!;
    final plan = data['plan'] as Map<String, dynamic>;
    final usage = data['usage'] as Map<String, dynamic>? ?? {};

    return SettingsData(
      planLabel: plan['label'] as String? ?? 'Free',
      maxStorageBytes: (plan['maxStorageBytes'] as num?)?.toInt() ?? 2147483648,
      usedStorageBytes: (usage['storageBytes'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  Stream<SettingsData> watchSettings() {
    final user = _auth.currentUser;
    if (user == null) {
      return Stream.error(Exception('User not authenticated'));
    }

    return _firestore
        .collection('users')
        .doc(user.uid)
        .snapshots()
        .map((snapshot) {
      if (!snapshot.exists) {
        throw Exception('User document not found');
      }

      final data = snapshot.data()!;
      final plan = data['plan'] as Map<String, dynamic>;
      final usage = data['usage'] as Map<String, dynamic>? ?? {};

      return SettingsData(
        planLabel: plan['label'] as String? ?? 'Free',
        maxStorageBytes: (plan['maxStorageBytes'] as num?)?.toInt() ?? 2147483648,
        usedStorageBytes: (usage['storageBytes'] as num?)?.toInt() ?? 0,
      );
    });
  }
}

/// 実際のFirebase Functionsを使用するAccountRepository実装
class FirebaseAccountRepository implements AccountRepository {
  final FirebaseFunctions _functions = FirebaseFunctions.instanceFor(region: 'asia-northeast1');
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  @override
  Future<AccountTestResult> testConnection(AccountFormData data) async {
    try {
      final callable = _functions.httpsCallable('accountTest');
      final result = await callable.call({
        'protocol': 'pop3',
        'host': data.pop3Host,
        'port': data.pop3Port,
        'useSsl': true, // SSL/TLS必須
        'userName': data.pop3Username,
        'password': data.pop3Password, // アカウント作成前の平文パスワード
      });

      // 型安全なキャスト
      final dataResult = Map<String, dynamic>.from(result.data as Map);
      return AccountTestResult(
        success: dataResult['success'] as bool? ?? false,
        errorMessage: dataResult['errorMessage'] as String?,
      );
    } on FirebaseFunctionsException catch (e) {
      debugPrint('Firebase Functions error: ${e.code} - ${e.message}');
      return AccountTestResult(
        success: false,
        errorMessage: e.message ?? 'Connection test failed',
      );
    } catch (e) {
      debugPrint('Error calling accountTest: $e');
      return AccountTestResult(
        success: false,
        errorMessage: 'Error: $e',
      );
    }
  }

  @override
  Future<AccountTestResult> testSmtpConnection(AccountFormData data) async {
    try {
      final callable = _functions.httpsCallable('accountTest');
      final result = await callable.call({
        'protocol': 'smtp',
        'host': data.smtpHost,
        'port': data.smtpPort,
        'useSsl': true, // SSL/TLS必須
        'userName': data.smtpUsername,
        'password': data.smtpPassword.isNotEmpty
            ? data.smtpPassword
            : data.pop3Password, // SMTPパスワードが空の場合はPOP3パスワードを使用
      });

      // 型安全なキャスト
      final dataResult = Map<String, dynamic>.from(result.data as Map);
      return AccountTestResult(
        success: dataResult['success'] as bool? ?? false,
        errorMessage: dataResult['errorMessage'] as String?,
      );
    } on FirebaseFunctionsException catch (e) {
      debugPrint('Firebase Functions error: ${e.code} - ${e.message}');
      return AccountTestResult(
        success: false,
        errorMessage: e.message ?? 'SMTP connection test failed',
      );
    } catch (e) {
      debugPrint('Error calling accountTest for SMTP: $e');
      return AccountTestResult(
        success: false,
        errorMessage: 'Error: $e',
      );
    }
  }

  @override
  Future<void> createAccount(AccountFormData data) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      // パスワードを暗号化
      final encryptCallable = _functions.httpsCallable('encryptPasswordFunction');
      final encryptResult = await encryptCallable.call({
        'password': data.pop3Password,
      });

      // 型安全なキャスト
      final encryptData = Map<String, dynamic>.from(encryptResult.data as Map);
      final passwordEnc = Map<String, dynamic>.from(encryptData['passwordEnc'] as Map);

      // SMTPパスワードを暗号化（SMTP設定がある場合）
      Map<String, dynamic>? smtpPasswordEnc;
      if (data.smtpPassword.isNotEmpty || data.smtpHost.isNotEmpty) {
        final smtpPasswordToEncrypt = data.smtpPassword.isNotEmpty
            ? data.smtpPassword
            : data.pop3Password; // SMTPパスワードが空の場合はPOP3パスワードを使用
        final smtpEncryptResult = await encryptCallable.call({
          'password': smtpPasswordToEncrypt,
        });
        final smtpEncryptData = Map<String, dynamic>.from(smtpEncryptResult.data as Map);
        smtpPasswordEnc = Map<String, dynamic>.from(smtpEncryptData['passwordEnc'] as Map);
      }

      // Firestoreにアカウントを保存
      final accountRef = _firestore
          .collection('users')
          .doc(user.uid)
          .collection('mailAccounts')
          .doc(); // 自動生成ID

      final accountData = <String, dynamic>{
        'label': data.label,
        'email': data.email,
        'pop3': {
          'host': data.pop3Host,
          'port': data.pop3Port,
          'useSsl': true, // SSL/TLS必須
          'userName': data.pop3Username,
          'passwordEnc': {
            'ciphertext': passwordEnc['ciphertext'],
            'nonce': passwordEnc['nonce'],
            'tag': passwordEnc['tag'],
          },
        },
        'status': 'active',
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      // SMTP設定を追加（設定がある場合）
      if (data.smtpHost.isNotEmpty && smtpPasswordEnc != null) {
        accountData['smtp'] = {
          'host': data.smtpHost,
          'port': data.smtpPort,
          'useSsl': true, // SSL/TLS必須
          'userName': data.smtpUsername.isNotEmpty ? data.smtpUsername : data.pop3Username,
          'passwordEnc': {
            'ciphertext': smtpPasswordEnc['ciphertext'],
            'nonce': smtpPasswordEnc['nonce'],
            'tag': smtpPasswordEnc['tag'],
          },
        };
      }

      await accountRef.set(accountData);

      debugPrint('Account created successfully: ${accountRef.id}');
    } on FirebaseFunctionsException catch (e) {
      debugPrint('Firebase Functions error: ${e.code} - ${e.message}');
      rethrow;
    } catch (e) {
      debugPrint('Error creating account: $e');
      rethrow;
    }
  }

  @override
  Future<List<MailAccount>> listAccounts({bool includeInactive = false}) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      QuerySnapshot<Map<String, dynamic>> accountsSnapshot;
      if (includeInactive) {
        // すべてのアカウントを取得（active + inactive）
        accountsSnapshot = await _firestore
            .collection('users')
            .doc(user.uid)
            .collection('mailAccounts')
            .get();
      } else {
        // activeなアカウントのみ取得
        accountsSnapshot = await _firestore
            .collection('users')
            .doc(user.uid)
            .collection('mailAccounts')
            .where('status', isEqualTo: 'active')
            .get();
      }

      return accountsSnapshot.docs.map((doc) {
        final data = doc.data();
        final pop3 = data['pop3'] as Map<String, dynamic>?;
        final status = data['status'] as String? ?? 'active';
        final deletedAtTimestamp = data['deletedAt'] as Timestamp?;
        final deletedAt = deletedAtTimestamp?.toDate();
        
        return MailAccount(
          id: doc.id,
          label: data['label'] as String? ?? '',
          email: data['email'] as String? ?? '',
          pop3Host: pop3?['host'] as String? ?? '',
          pop3Port: pop3?['port'] as int? ?? 995,
          pop3Username: pop3?['userName'] as String? ?? '',
          status: status,
          deletedAt: deletedAt,
        );
      }).toList();
    } catch (e) {
      debugPrint('Error listing accounts: $e');
      rethrow;
    }
  }

  @override
  Future<MailAccount?> getAccount(String accountId) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final accountDoc = await _firestore
          .collection('users')
          .doc(user.uid)
          .collection('mailAccounts')
          .doc(accountId)
          .get();

      if (!accountDoc.exists) {
        return null;
      }

      final data = accountDoc.data()!;
      final pop3 = data['pop3'] as Map<String, dynamic>?;
      final status = data['status'] as String? ?? 'active';
      final deletedAtTimestamp = data['deletedAt'] as Timestamp?;
      final deletedAt = deletedAtTimestamp?.toDate();
      
      return MailAccount(
        id: accountDoc.id,
        label: data['label'] as String? ?? '',
        email: data['email'] as String? ?? '',
        pop3Host: pop3?['host'] as String? ?? '',
        pop3Port: pop3?['port'] as int? ?? 995,
        pop3Username: pop3?['userName'] as String? ?? '',
        status: status,
        deletedAt: deletedAt,
      );
    } catch (e) {
      debugPrint('Error getting account: $e');
      rethrow;
    }
  }

  @override
  Future<void> updateAccount(String accountId, AccountFormData data) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final accountRef = _firestore
          .collection('users')
          .doc(user.uid)
          .collection('mailAccounts')
          .doc(accountId);

      // パスワードが入力されている場合のみ暗号化して更新
      Map<String, dynamic> updateData = {
        'label': data.label,
        'email': data.email,
        'pop3.host': data.pop3Host,
        'pop3.port': data.pop3Port,
        'pop3.useSsl': true,
        'pop3.userName': data.pop3Username,
        'updatedAt': FieldValue.serverTimestamp(),
      };

        final encryptCallable = _functions.httpsCallable('encryptPasswordFunction');
      
      if (data.pop3Password.isNotEmpty) {
        // POP3パスワードを暗号化
        final encryptResult = await encryptCallable.call({
          'password': data.pop3Password,
        });

        // 型安全なキャスト
        final encryptData = Map<String, dynamic>.from(encryptResult.data as Map);
        final passwordEnc = Map<String, dynamic>.from(encryptData['passwordEnc'] as Map);

        updateData['pop3.passwordEnc'] = {
          'ciphertext': passwordEnc['ciphertext'],
          'nonce': passwordEnc['nonce'],
          'tag': passwordEnc['tag'],
        };
      }

      // SMTP設定を更新（設定がある場合）
      if (data.smtpHost.isNotEmpty) {
        final smtpPasswordToEncrypt = data.smtpPassword.isNotEmpty
            ? data.smtpPassword
            : data.pop3Password; // SMTPパスワードが空の場合はPOP3パスワードを使用
        
        final smtpEncryptResult = await encryptCallable.call({
          'password': smtpPasswordToEncrypt,
        });
        final smtpEncryptData = Map<String, dynamic>.from(smtpEncryptResult.data as Map);
        final smtpPasswordEnc = Map<String, dynamic>.from(smtpEncryptData['passwordEnc'] as Map);

        updateData['smtp.host'] = data.smtpHost;
        updateData['smtp.port'] = data.smtpPort;
        updateData['smtp.useSsl'] = true;
        updateData['smtp.userName'] = data.smtpUsername.isNotEmpty
            ? data.smtpUsername
            : data.pop3Username;
        updateData['smtp.passwordEnc'] = {
          'ciphertext': smtpPasswordEnc['ciphertext'],
          'nonce': smtpPasswordEnc['nonce'],
          'tag': smtpPasswordEnc['tag'],
        };
      }

      await accountRef.update(updateData);
      debugPrint('Account updated successfully: $accountId');
    } on FirebaseFunctionsException catch (e) {
      debugPrint('Firebase Functions error: ${e.code} - ${e.message}');
      rethrow;
    } catch (e) {
      debugPrint('Error updating account: $e');
      rethrow;
    }
  }

  @override
  Future<void> deleteAccount(String accountId) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final accountRef = _firestore
          .collection('users')
          .doc(user.uid)
          .collection('mailAccounts')
          .doc(accountId);

      // 論理削除: statusを'inactive'に変更し、削除日時を記録
      await accountRef.update({
        'status': 'inactive',
        'deletedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      debugPrint('Account deleted (soft delete) successfully: $accountId');
    } catch (e) {
      debugPrint('Error deleting account: $e');
      rethrow;
    }
  }

  @override
  Future<void> restoreAccount(String accountId) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final accountRef = _firestore
          .collection('users')
          .doc(user.uid)
          .collection('mailAccounts')
          .doc(accountId);

      // 復元: statusを'active'に戻し、deletedAtを削除
      await accountRef.update({
        'status': 'active',
        'deletedAt': FieldValue.delete(),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      debugPrint('Account restored successfully: $accountId');
    } catch (e) {
      debugPrint('Error restoring account: $e');
      rethrow;
    }
  }

  @override
  Future<void> permanentlyDeleteAccount(String accountId) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final accountRef = _firestore
          .collection('users')
          .doc(user.uid)
          .collection('mailAccounts')
          .doc(accountId);

      // 完全削除: ドキュメントを物理削除
      await accountRef.delete();

      debugPrint('Account permanently deleted: $accountId');
    } catch (e) {
      debugPrint('Error permanently deleting account: $e');
      rethrow;
    }
  }
}

/// 実際のFirebaseを使用するMailDetailRepository実装
class FirebaseDetailRepository implements MailDetailRepository {
  final FirebaseFunctions _functions = FirebaseFunctions.instanceFor(region: 'asia-northeast1');
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  String _formatTimestamp(Timestamp timestamp) {
    final date = timestamp.toDate();
    final now = DateTime.now();
    final difference = now.difference(date);
    
    if (difference.inDays == 0) {
      // 今日: 時刻のみ
      return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } else if (difference.inDays == 1) {
      return '昨日';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}日前';
    } else {
      // 1週間以上前: 日付
      return '${date.year}/${date.month}/${date.day}';
    }
  }

  @override
  Future<MailMessageDetail> loadMessage(String messageId) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      // Firestoreからメッセージメタデータを取得
      final messageRef = _firestore
          .collection('users')
          .doc(user.uid)
          .collection('mailMessages')
          .doc(messageId);

      final messageDoc = await messageRef.get();
      if (!messageDoc.exists) {
        throw Exception('Message not found');
      }

      final data = messageDoc.data() as Map<String, dynamic>;
      
      // メッセージの状態を確認
      final hasLargeBody = data['hasLargeBody'] as bool? ?? false;
      final hasBodyTextEncrypted = data['bodyTextEncrypted'] != null;
      final storage = data['storage'] as Map<String, dynamic>?;
      final largeBodyPath = storage?['largeBodyPath'] as String?;
      
      debugPrint('Message metadata: messageId=$messageId, hasLargeBody=$hasLargeBody, hasBodyTextEncrypted=$hasBodyTextEncrypted, largeBodyPath=$largeBodyPath');
      
      // メール本文を復号
      String emailBody = '';
      try {
        final decryptCallable = _functions.httpsCallable('decryptMail');
        final decryptResult = await decryptCallable.call({
          'messageId': messageId,
        });

        final decryptData = Map<String, dynamic>.from(decryptResult.data as Map<String, dynamic>);
        final bodyText = decryptData['bodyText'] as String? ?? '';
        final bodyHtml = decryptData['bodyHtml'] as String? ?? '';
        
        // bodyTextまたはbodyHtmlのいずれかを使用（HTMLの場合はbodyHtmlを優先）
        // decryptMailは既に本文のみを返すため、そのまま使用する
        emailBody = bodyHtml.isNotEmpty ? bodyHtml : bodyText;
      } on FirebaseFunctionsException catch (e) {
        debugPrint('Firebase Functions error: ${e.code} - ${e.message}');
        debugPrint('Error details: ${e.details}');
        // エラーが発生しても続行（メタデータは表示できる）
        emailBody = '[メール本文の取得に失敗しました: ${e.message}]';
      } catch (e) {
        debugPrint('Error calling decryptMail: $e');
        emailBody = '[メール本文の取得に失敗しました: $e]';
      }

      // メールを開いたときにisRead: trueに更新し、hasUnreadを再計算
      await _markAsRead(messageId, data['threadId'] as String);

      return MailMessageDetail(
        id: messageId,
        subject: data['subject'] as String? ?? '',
        from: data['from'] as String? ?? '',
        to: (data['to'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
        cc: (data['cc'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
        bcc: (data['bcc'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
        sentAt: data['sentAt'] != null
            ? _formatTimestamp(data['sentAt'] as Timestamp)
            : '',
        bodyText: emailBody,
        threadId: data['threadId'] as String?,
      );
    } catch (e) {
      debugPrint('Error loading message: $e');
      rethrow;
    }
  }

  /// メールを既読にする（isRead: trueに更新し、hasUnreadを再計算）
  Future<void> _markAsRead(String messageId, String threadId) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      // メッセージをisRead: trueに更新
      final messageRef = _firestore
          .collection('users')
          .doc(user.uid)
          .collection('mailMessages')
          .doc(messageId);

      await messageRef.update({
        'isRead': true,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      // スレッド内のすべてのメッセージを取得してhasUnreadを再計算
      final messagesSnapshot = await _firestore
          .collection('users')
          .doc(user.uid)
          .collection('mailMessages')
          .where('threadId', isEqualTo: threadId)
          .get();

      final hasUnread = messagesSnapshot.docs.any((doc) {
        final data = doc.data();
        return data['isRead'] != true;
      });

      // スレッドのhasUnreadを更新
      final threadRef = _firestore
          .collection('users')
          .doc(user.uid)
          .collection('mailThreads')
          .doc(threadId);

      await threadRef.update({
        'hasUnread': hasUnread,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('Error marking message as read: $e');
      // エラーが発生しても続行（メール表示は成功しているため）
    }
  }

  @override
  Future<List<AttachmentListItem>> getAttachmentsList(String messageId) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final callable = _functions.httpsCallable('getAttachmentsList');
      final result = await callable.call({
        'messageId': messageId,
      });

      final data = Map<String, dynamic>.from(result.data as Map);
      final attachments = (data['attachments'] as List<dynamic>?) ?? [];

      return attachments.map((item) {
        final attachmentData = Map<String, dynamic>.from(item as Map);
        return AttachmentListItem(
          filename: attachmentData['filename'] as String? ?? '',
          size: attachmentData['size'] as int? ?? 0,
          contentType: attachmentData['contentType'] as String? ?? 'application/octet-stream',
        );
      }).toList();
    } on FirebaseFunctionsException catch (e) {
      debugPrint('Firebase Functions error: ${e.code} - ${e.message}');
      debugPrint('Error details: ${e.details}');
      // エラーが発生した場合は空リストを返す（添付ファイルがない場合と同じ扱い）
      return [];
    } catch (e) {
      debugPrint('Error calling getAttachmentsList: $e');
      // エラーが発生した場合は空リストを返す（添付ファイルがない場合と同じ扱い）
      return [];
    }
  }

  @override
  Future<DownloadedAttachment> downloadAttachment(String messageId, String filename) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final callable = _functions.httpsCallable('downloadAttachment');
      final result = await callable.call({
        'messageId': messageId,
        'filename': filename,
      });

      final data = Map<String, dynamic>.from(result.data as Map);
      final contentBase64 = data['content'] as String? ?? '';
      final decodedContent = base64Decode(contentBase64);

      return DownloadedAttachment(
        content: decodedContent,
        filename: data['filename'] as String? ?? filename,
        contentType: data['contentType'] as String? ?? 'application/octet-stream',
        size: data['size'] as int? ?? decodedContent.length,
      );
    } on FirebaseFunctionsException catch (e) {
      debugPrint('Firebase Functions error: ${e.code} - ${e.message}');
      debugPrint('Error details: ${e.details}');
      rethrow;
    } catch (e) {
      debugPrint('Error calling downloadAttachment: $e');
      rethrow;
    }
  }

  @override
  Future<void> moveToTrash(String messageId) async {
    // TODO: 実装
    throw UnimplementedError();
  }

  @override
  Future<void> archive(String messageId) async {
    // TODO: 実装
    throw UnimplementedError();
  }

  @override
  Future<void> restoreFromTrash(String messageId) async {
    // TODO: 実装
    throw UnimplementedError();
  }

  @override
  Future<void> unarchive(String messageId) async {
    // TODO: 実装
    throw UnimplementedError();
  }
}

/// 実際のFirebase Functionsを使用するMailComposeRepository実装
class FirebaseMailComposeRepository implements MailComposeRepository {
  final FirebaseFunctions _functions = FirebaseFunctions.instanceFor(region: 'asia-northeast1');
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  @override
  Future<List<MailAccount>> listAccounts() async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final accountsSnapshot = await _firestore
          .collection('users')
          .doc(user.uid)
          .collection('mailAccounts')
          .where('status', isEqualTo: 'active')
          .get();

      return accountsSnapshot.docs.map((doc) {
        final data = doc.data();
        final pop3 = data['pop3'] as Map<String, dynamic>?;
        final status = data['status'] as String? ?? 'active';
        final deletedAtTimestamp = data['deletedAt'] as Timestamp?;
        final deletedAt = deletedAtTimestamp?.toDate();
        
        return MailAccount(
          id: doc.id,
          label: data['label'] as String? ?? '',
          email: data['email'] as String? ?? '',
          pop3Host: pop3?['host'] as String? ?? '',
          pop3Port: pop3?['port'] as int? ?? 995,
          pop3Username: pop3?['userName'] as String? ?? '',
          status: status,
          deletedAt: deletedAt,
        );
      }).toList();
    } catch (e) {
      debugPrint('Error listing accounts: $e');
      rethrow;
    }
  }

  @override
  Future<SendMailResponse> sendMail(SendMailRequest request) async {
    try {
      final callable = _functions.httpsCallable('sendMail');
      
      // 添付ファイルをBase64エンコード
      final attachments = request.attachments.map((att) => {
        'filename': att.filename,
        'content': base64Encode(att.content),
        'contentType': att.contentType,
      }).toList();

      final result = await callable.call({
        'accountId': request.accountId,
        'to': request.to,
        'cc': request.cc.isNotEmpty ? request.cc : null,
        'bcc': request.bcc.isNotEmpty ? request.bcc : null,
        'subject': request.subject,
        'body': request.body,
        'attachments': attachments.isNotEmpty ? attachments : null,
        'threadId': request.threadId,
      });

      final dataResult = Map<String, dynamic>.from(result.data as Map);
      return SendMailResponse(
        success: dataResult['success'] as bool? ?? false,
        messageId: dataResult['messageId'] as String?,
        errorMessage: dataResult['errorMessage'] as String?,
      );
    } on FirebaseFunctionsException catch (e) {
      debugPrint('Firebase Functions error: ${e.code} - ${e.message}');
      return SendMailResponse(
        success: false,
        errorMessage: e.message ?? 'Failed to send mail',
      );
    } catch (e) {
      debugPrint('Error calling sendMail: $e');
      return SendMailResponse(
        success: false,
        errorMessage: 'Error: $e',
      );
    }
  }
}

/// スタブのAccountRepository実装（テスト用）
class StubAccountRepository implements AccountRepository {
  @override
  Future<AccountTestResult> testConnection(AccountFormData data) async {
    // スタブ実装: 常に成功
    await Future.delayed(const Duration(milliseconds: 500));
    debugPrint('StubAccountRepository.testConnection called with: ${data.pop3Host}:${data.pop3Port}');
    return const AccountTestResult(success: true);
  }

  @override
  Future<AccountTestResult> testSmtpConnection(AccountFormData data) async {
    // スタブ実装: 常に成功
    await Future.delayed(const Duration(milliseconds: 500));
    debugPrint('StubAccountRepository.testSmtpConnection called with: ${data.smtpHost}:${data.smtpPort}');
    return const AccountTestResult(success: true);
  }

  @override
  Future<void> createAccount(AccountFormData data) async {
    // スタブ実装: 常に成功
    await Future.delayed(const Duration(milliseconds: 500));
    debugPrint('StubAccountRepository.createAccount called for: ${data.label}');
  }

  @override
  Future<List<MailAccount>> listAccounts({bool includeInactive = false}) async {
    // スタブ実装: 空のリストを返す
    await Future.delayed(const Duration(milliseconds: 300));
    return [];
  }

  @override
  Future<MailAccount?> getAccount(String accountId) async {
    // スタブ実装: nullを返す
    await Future.delayed(const Duration(milliseconds: 300));
    return null;
  }

  @override
  Future<void> updateAccount(String accountId, AccountFormData data) async {
    // スタブ実装: 常に成功
    await Future.delayed(const Duration(milliseconds: 500));
    debugPrint('StubAccountRepository.updateAccount called for: $accountId');
  }

  @override
  Future<void> deleteAccount(String accountId) async {
    // スタブ実装: 常に成功
    await Future.delayed(const Duration(milliseconds: 500));
    debugPrint('StubAccountRepository.deleteAccount called for: $accountId');
  }

  @override
  Future<void> restoreAccount(String accountId) async {
    // スタブ実装: 常に成功
    await Future.delayed(const Duration(milliseconds: 500));
    debugPrint('StubAccountRepository.restoreAccount called for: $accountId');
  }

  @override
  Future<void> permanentlyDeleteAccount(String accountId) async {
    // スタブ実装: 常に成功
    await Future.delayed(const Duration(milliseconds: 500));
    debugPrint('StubAccountRepository.permanentlyDeleteAccount called for: $accountId');
  }
}



