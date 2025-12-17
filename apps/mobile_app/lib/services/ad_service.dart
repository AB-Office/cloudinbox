import 'package:flutter/material.dart';

/// 広告表示サービス（Free プランのみバナーを表示）
class AdService {
  const AdService();

  /// プラン ID に応じてバナーウィジェットを返す（free のみ表示）
  Widget? buildBanner(String? planId) {
    if (planId == 'free') {
      return const _AdBannerPlaceholder();
    }
    return null;
  }
}

class _AdBannerPlaceholder extends StatelessWidget {
  const _AdBannerPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('ad_banner'),
      height: 50,
      color: Colors.grey.shade300,
      alignment: Alignment.center,
      child: const Text('Ad Banner'),
    );
  }
}


