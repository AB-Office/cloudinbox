import 'package:cloudinbox_mobile_app/services/ad_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AdService', () {
    testWidgets('Free プランではバナーを返す', (tester) async {
      const service = AdService();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: service.buildBanner('free') ?? const SizedBox.shrink(),
          ),
        ),
      );

      expect(find.byKey(const Key('ad_banner')), findsOneWidget);
    });

    testWidgets('Pro プランではバナーを返さない', (tester) async {
      const service = AdService();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: service.buildBanner('pro') ?? const SizedBox.shrink(),
          ),
        ),
      );

      expect(find.byKey(const Key('ad_banner')), findsNothing);
    });
  });
}


