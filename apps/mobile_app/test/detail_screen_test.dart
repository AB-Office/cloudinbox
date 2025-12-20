import 'package:cloudinbox_mobile_app/screens/detail_screen.dart';
import 'package:cloudinbox_mobile_app/services/ad_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeMailDetailRepository implements MailDetailRepository {
  _FakeMailDetailRepository({
    required this.message,
    this.shouldThrow = false,
  });

  final MailMessageDetail message;
  final bool shouldThrow;

  bool loadCalled = false;
  bool moveToTrashCalled = false;
  bool archiveCalled = false;
  bool restoreFromTrashCalled = false;
  bool unarchiveCalled = false;

  @override
  Future<MailMessageDetail> loadMessage(String messageId) async {
    loadCalled = true;
    if (shouldThrow) {
      throw Exception('load error');
    }
    return message;
  }

  @override
  Future<void> moveToTrash(String messageId) async {
    moveToTrashCalled = true;
  }

  @override
  Future<void> archive(String messageId) async {
    archiveCalled = true;
  }

  @override
  Future<void> restoreFromTrash(String messageId) async {
    restoreFromTrashCalled = true;
  }

  @override
  Future<void> unarchive(String messageId) async {
    unarchiveCalled = true;
  }
}

void main() {
  group('DetailScreen', () {
    testWidgets('メッセージ詳細が表示される', (tester) async {
      final repo = _FakeMailDetailRepository(
        message: const MailMessageDetail(
          id: 'm1',
          subject: 'Test Subject',
          from: 'alice@example.com',
          to: ['bob@example.com'],
          sentAt: '2025-01-01',
          bodyText: 'Hello body',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: DetailScreen(
            messageId: 'm1',
            repository: repo,
          ),
        ),
      );

      // ローディング完了待ち
      await tester.pumpAndSettle();

      // AppBar タイトル + 本文ヘッダで 2 箇所に表示されるため、少なくとも 1 件を確認
      expect(find.text('Test Subject'), findsWidgets);
      expect(find.textContaining('Hello body'), findsOneWidget);
      expect(repo.loadCalled, isTrue);
    });

    testWidgets('読み込みエラー時にエラーメッセージを表示する', (tester) async {
      final repo = _FakeMailDetailRepository(
        message: const MailMessageDetail(
          id: 'm1',
          subject: 'Error Subject',
          from: 'alice@example.com',
          to: ['bob@example.com'],
          sentAt: '2025-01-01',
          bodyText: 'Should not show',
        ),
        shouldThrow: true,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: DetailScreen(
            messageId: 'm1',
            repository: repo,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.textContaining('error'), findsOneWidget);
    });

    testWidgets('Free プランでは広告バナーが表示される', (tester) async {
      final repo = _FakeMailDetailRepository(
        message: const MailMessageDetail(
          id: 'm1',
          subject: 'Ad Test',
          from: 'alice@example.com',
          to: ['bob@example.com'],
          sentAt: '2025-01-01',
          bodyText: 'body',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: DetailScreen(
            messageId: 'm1',
            repository: repo,
            adService: const AdService(),
            planId: 'free',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('ad_banner')), findsOneWidget);
    });

    testWidgets('削除ボタン押下で moveToTrash が呼ばれる', (tester) async {
      final repo = _FakeMailDetailRepository(
        message: const MailMessageDetail(
          id: 'm1',
          subject: 'Trash Test',
          from: 'alice@example.com',
          to: ['bob@example.com'],
          sentAt: '2025-01-01',
          bodyText: 'body',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: DetailScreen(
            messageId: 'm1',
            repository: repo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('button_move_to_trash')));
      await tester.pumpAndSettle();

      expect(repo.moveToTrashCalled, isTrue);
    });

    testWidgets('アーカイブ／復元ボタン押下で対応メソッドが呼ばれる', (tester) async {
      final repo = _FakeMailDetailRepository(
        message: const MailMessageDetail(
          id: 'm1',
          subject: 'Archive Test',
          from: 'alice@example.com',
          to: ['bob@example.com'],
          sentAt: '2025-01-01',
          bodyText: 'body',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: DetailScreen(
            messageId: 'm1',
            repository: repo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('button_archive')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('button_restore_from_trash')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('button_unarchive')));
      await tester.pumpAndSettle();

      expect(repo.archiveCalled, isTrue);
      expect(repo.restoreFromTrashCalled, isTrue);
      expect(repo.unarchiveCalled, isTrue);
    });
  });
}


