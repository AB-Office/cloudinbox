/// Test to verify flutter_markdown package is available
///
/// This test verifies that the flutter_markdown package has been added
/// to pubspec.yaml and can be imported successfully.

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

void main() {
  test('flutter_markdown package should be available', () {
    // Verify that MarkdownBody widget exists (main component of flutter_markdown)
    expect(MarkdownBody, isNotNull, reason: 'flutter_markdown package is available');
  });
}

